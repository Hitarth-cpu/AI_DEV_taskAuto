import os
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy.orm import Session
from agent_core.db.models import AutomationMemory

class AutomationResultSchema(BaseModel):
    script: str = Field(description="The exact executable script code. No markdown block backticks around it.")
    reasoning: str = Field(description="Brief explanation of how the script works and why it was written.")
    validation_script: str = Field(description="A script to verify the main script succeeded. Should exit 0 on success.")
    blast_radius_report: list[str] = Field(description="A list of warnings detailing any destructive or high-risk actions the script performs. Empty list if none.")

class AutomationEngine:
    def __init__(self):
        # We hook up our LLM. It grabs GOOGLE_API_KEY from the environment automatically.
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            print("Warning: GOOGLE_API_KEY is missing. Add it to .env or this engine will fail.")
            
        # gemini-2.5-flash is extremely fast at dynamic script assembly
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
        self.structured_llm = self.llm.with_structured_output(AutomationResultSchema)

    async def build_script(self, task_description: str, target_env: str, db: Session = None, working_directory: str = "") -> tuple[str, str, str, list, int]:
        # Context extraction (RAG) from the Self-Improving Loop Memory
        memory_context = ""
        if db:
            past_edits = db.query(AutomationMemory).filter(
                AutomationMemory.user_edited_script.isnot(None),
                AutomationMemory.target_env == target_env
            ).order_by(AutomationMemory.id.desc()).limit(3).all()
            
            if past_edits:
                memory_context = "\n--- TEAM PREFERENCES & PREVIOUS CORRECTIONS ---\n"
                memory_context += "The developer team previously corrected your output for similar scripts. Honour these patterns:\n"
                for memory in past_edits:
                    memory_context += f"Task: {memory.intent}\n"
                    memory_context += f"Corrected Script:\n{memory.user_edited_script}\n\n"
                memory_context += "-----------------------------------------------\n"

        # Knowledge Base context (semantic RAG from uploaded team documents)
        knowledge_context = ""
        try:
            from agent_core.knowledge.store import get_knowledge_store
            ks = get_knowledge_store()
            relevant_docs = ks.query(task_description, n_results=3)
            if relevant_docs:
                knowledge_context = "\n--- TEAM KNOWLEDGE BASE (Uploaded Docs & Configs) ---\n"
                knowledge_context += "The following context was retrieved from the team's uploaded documents. Use it to align the script with team conventions:\n\n"
                for i, doc in enumerate(relevant_docs, 1):
                    knowledge_context += f"[Doc {i}]:\n{doc[:800]}\n\n"
                knowledge_context += "------------------------------------------------------\n"
        except Exception as e:
            print(f"[AutomationEngine] Knowledge base unavailable: {e}")

        # Build the working directory context block
        if working_directory and working_directory.strip():
            cwd_block = f"""
Working Directory: {working_directory.strip()}
IMPORTANT: The script MUST start by changing into this directory. Use:
  - PowerShell: Set-Location -Path "{working_directory.strip()}"
  - Bash: cd "{working_directory.strip()}"
All file/folder operations should be relative to this directory unless the user's intent requires an absolute path.
"""
        else:
            cwd_block = "Working Directory: not specified — use relative paths from the daemon's current working directory."

        # Derive the shell type explicitly
        if target_env.lower() == "windows":
            shell_info = "PowerShell 5.1+ on Windows. Use PowerShell cmdlets (Remove-Item, Copy-Item, New-Item, Invoke-WebRequest, etc.) and .NET methods where appropriate."
        else:
            shell_info = "Bash on Linux/macOS. Use POSIX-compatible commands (rm, cp, mkdir, curl, wget, apt/yum/brew, pip, npm, etc.)."

        prompt = f"""
You are a senior DevOps/systems engineer writing real automation scripts that will be executed by a CLI daemon with full OS-level access.

You have FULL permission to:
- Delete files and directories (rm -rf / Remove-Item -Recurse -Force)
- Install packages (pip install, npm install, apt-get, brew, etc.)
- Modify files and configuration
- Start and stop services
- Run build/test/deploy pipelines
- Create, rename, move, and manipulate any files

Do NOT:
- Use placeholder comments like "# TODO", "# Add your logic here", or mock echo statements instead of real commands
- Generate incomplete stubs — write the FULL working script
- Add unnecessary safety guards unless they are genuinely required (e.g. checking if a file exists before deleting it)

User Intent: "{task_description}"
Target Shell: {shell_info}
{cwd_block}
{memory_context}
{knowledge_context}

Deliver:
1. script — A COMPLETE, IMMEDIATELY EXECUTABLE script. Raw code only, NO markdown fences (no ```bash or ```powershell). It must work on first run without editing.
2. reasoning — A concise explanation of what the script does step by step.
3. validation_script — A lightweight script that verifies the main script succeeded (exits 0 on success, non-zero on failure).
4. blast_radius_report — A list of specific warnings for ANY destructive or irreversible actions (deletes, overwrites, service restarts, package removals). Empty list if all operations are read-only or easily reversible.
"""
        
        try:
            result = self.structured_llm.invoke(prompt)
            blast_report = result.blast_radius_report
            
            if db:
                import json
                memory = AutomationMemory(
                    intent=task_description,
                    target_env=target_env,
                    generated_script=result.script,
                    reasoning=result.reasoning,
                    validation_script=result.validation_script,
                    blast_radius_report=json.dumps(blast_report) if blast_report else None,
                    context_used=memory_context if memory_context else None,
                    working_directory=working_directory
                )
                db.add(memory)
                db.commit()
                db.refresh(memory)
                return result.script, result.reasoning, result.validation_script, blast_report, memory.id
                
            return result.script, result.reasoning, result.validation_script, blast_report, -1
            
        except Exception as e:
            if db:
                db.add(AutomationMemory(intent=task_description, is_successful=False, reasoning=str(e)))
                db.commit()
            return f"echo 'Failed to generate script: {str(e)}'", f"Error: {str(e)}", "", [], -1

    async def fix_script(
        self,
        original_intent: str,
        failed_script: str,
        error_output: str,
        target_env: str,
        iteration: int,
        db: Session = None,
        record_id: int = None,
    ) -> tuple[str, str, str, list, int]:
        """
        Feature 4 — Auto Fix-It Loop.
        Analyse a failed script + its captured stderr/stdout and return a corrected version.
        Iteration history is written to the existing `iteration_history` DB column.
        """
        if target_env.lower() == "windows":
            shell_info = "PowerShell 5.1+ on Windows. Use PowerShell cmdlets."
        else:
            shell_info = "Bash on Linux/macOS. Use POSIX-compatible commands."

        # Truncate very long error output to keep prompt size reasonable
        truncated_error = error_output[-1500:] if len(error_output) > 1500 else error_output

        prompt = f"""
You are a senior DevOps engineer debugging a FAILED automation script.

Original Task Intent: "{original_intent}"
Target Shell: {shell_info}
Fix Iteration: {iteration}/3

The following script FAILED during execution:
```
{failed_script}
```

Captured Error Output:
```
{truncated_error}
```

Analyse the error carefully, identify the exact root cause, and provide a COMPLETELY FIXED version.

Do NOT:
- Repeat the same mistake
- Use placeholder comments or stub code
- Leave any section incomplete

Deliver:
1. script — The COMPLETE FIXED script. Raw code only, NO markdown fences.
2. reasoning — What caused the failure and exactly what you changed to fix it.
3. validation_script — A lightweight script to confirm the fix succeeded (exits 0 on success).
4. blast_radius_report — Warnings for destructive actions. Empty list if safe.
"""

        try:
            result = self.structured_llm.invoke(prompt)

            if db and record_id:
                import json
                record = db.query(AutomationMemory).filter(AutomationMemory.id == record_id).first()
                if record:
                    history = json.loads(record.iteration_history or "[]")
                    history.append({
                        "iteration": iteration,
                        "error_output": error_output[-500:],
                        "reasoning": result.reasoning,
                    })
                    record.iteration_history = json.dumps(history)
                    record.generated_script = result.script  # keep latest fixed version
                    db.commit()
                    db.refresh(record)

            return result.script, result.reasoning, result.validation_script, result.blast_radius_report, record_id if record_id else -1

        except Exception as e:
            return (
                f"echo 'Fix generation failed: {str(e)}'",
                f"Fix Error: {str(e)}",
                "",
                [],
                record_id if record_id else -1,
            )
