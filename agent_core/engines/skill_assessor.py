import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from agent_core.models.schemas import SkillAssessment
from sqlalchemy.orm import Session
from agent_core.db.models import SkillAssessmentRecord
from agent_core.execution.cross_platform import execute_code

class SkillAssessmentEngine:
    def __init__(self):
        # We hook up our LLM. It grabs GOOGLE_API_KEY from the environment automatically.
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            print("Warning: GOOGLE_API_KEY is missing. Add it to .env or this engine will fail.")
        
        # We initialize gemini-2.5-flash which is very fast and strong at structured analysis
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1)
        # Force the LLM to reply exactly matching our strictly typed JSON schema
        self.structured_llm = self.llm.with_structured_output(SkillAssessment)

    async def assess_snippet(self, code_snippet: str, language: str, db: Session = None) -> SkillAssessment:
        # First, act as a QA tester and execute the code to find out what it does
        stdout, stderr, execute_error = execute_code(code_snippet, language)
        
        execution_context = ""
        full_output = f"Stdout:\n{stdout}\nStderr:\n{stderr}\nError:\n{execute_error}"
        if execute_error:
            execution_context = f"The code FAILED to execute properly. Execution error: {execute_error}"
        else:
            execution_context = f"The code executed successfully. Output:\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
            
        prompt = f"""
        You are an elite QA Automation Tester and Senior Staff Engineer. Conduct a rigorous review of the following {language} code snippet.
        Assess the developer's proficiency and return the exact requested JSON blueprint.
        Provide a technical score out of 10.
        Outline key strengths and specific, actionable areas for improvement based on standard best practices, security, and algorithmic efficiency.
        
        CRITICAL QA STEP: I have executed this code locally.
        {execution_context}
        
        Please synthesize this execution output. Populate the `tester_suggestions` array in the JSON schema with your QA feedback based entirely on how the code performed.
        Also, cleanly embed the raw output logs into `test_execution_output`.
        
        Snippet:
        ```{language}
        {code_snippet}
        ```
        """
        
        try:
            result = self.structured_llm.invoke(prompt)
            result.primary_language = language
            
            # Save the record of this evaluation and the QA results to the self-improving database
            if db:
                import json
                record = SkillAssessmentRecord(
                    primary_language=language,
                    overall_level=result.overall_level,
                    technical_score=result.technical_score,
                    raw_snippet=code_snippet,
                    test_execution_output=result.test_execution_output,
                    tester_suggestions=json.dumps(result.tester_suggestions)
                )
                db.add(record)
                db.commit()
                
            return result
        except Exception as e:
            # Fallback if connection fails
            raise Exception(f"Failed to generate AI assessment. Ensure Google API Key is valid. Details: {str(e)}")
