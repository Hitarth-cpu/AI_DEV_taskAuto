import platform
import subprocess
import os
import tempfile

def execute_script(script_content: str, target_env: str = None):
    """Executes the script based on OS boundaries natively."""
    os_name = platform.system().lower()
    
    if target_env and target_env.lower() != os_name and not (target_env.lower() == 'linux' and os_name == 'darwin'):
        return None, f"Cannot execute {target_env} script natively on {os_name}"

    try:
        if os_name == "windows":
            # Write powershell
            with tempfile.NamedTemporaryFile(suffix=".ps1", delete=False) as f:
                f.write(script_content.encode('utf-8'))
                temp_path = f.name
                
            command = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", temp_path]
            result = subprocess.run(command, capture_output=True, text=True, timeout=30)
            os.unlink(temp_path)
            
        elif os_name in ("linux", "darwin"):
            with tempfile.NamedTemporaryFile(suffix=".sh", delete=False) as f:
                f.write(script_content.encode('utf-8'))
                temp_path = f.name
            
            os.chmod(temp_path, 0o755)
            command = ["bash", temp_path]
            result = subprocess.run(command, capture_output=True, text=True, timeout=30)
            os.unlink(temp_path)
        else:
            return None, f"Unsupported OS: {os_name}"
            
        return result.stdout, result.stderr
        
    except Exception as e:
        return None, str(e)

def _runtime_available(cmd: str) -> bool:
    """Check if a CLI runtime is on PATH."""
    try:
        subprocess.run([cmd, "--version"], capture_output=True, timeout=5)
        return True
    except Exception:
        return False


def execute_code(code_snippet: str, language: str):
    """
    Executes arbitrary assessment code based on the provided language.
    Supports: Python, JavaScript, TypeScript, Bash, PowerShell, Go, Java, Rust.
    Returns graceful errors when a runtime is not installed.
    """
    language = language.lower()
    os_name = platform.system().lower()

    extension_map = {
        "python": ".py",
        "javascript": ".js",
        "typescript": ".ts",
        "bash": ".sh",
        "powershell": ".ps1",
        "go": ".go",
        "java": ".java",
        "rust": ".rs",
    }

    if language not in extension_map:
        return "", "", f"Execution not supported for language: {language}"

    ext = extension_map[language]
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False, mode="w", encoding="utf-8") as f:
            f.write(code_snippet)
            temp_path = f.name

        # ── Python ──────────────────────────────────────────────────────────
        if language == "python":
            command = ["python", temp_path]

        # ── JavaScript ──────────────────────────────────────────────────────
        elif language == "javascript":
            if not _runtime_available("node"):
                return "", "", "Node.js not found. Install it to execute JavaScript snippets."
            command = ["node", temp_path]

        # ── TypeScript ──────────────────────────────────────────────────────
        elif language == "typescript":
            if not _runtime_available("npx"):
                return "", "", "npx not found. Install Node.js to execute TypeScript snippets."
            command = ["npx", "--yes", "ts-node", "--skip-project", "--transpile-only", temp_path]

        # ── PowerShell ──────────────────────────────────────────────────────
        elif language == "powershell":
            command = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", temp_path]

        # ── Bash ────────────────────────────────────────────────────────────
        elif language == "bash":
            if os_name == "windows":
                os.unlink(temp_path)
                return "", "", "Bash execution requires WSL on Windows. Analysis will be static."
            os.chmod(temp_path, 0o755)
            command = ["bash", temp_path]

        # ── Go ──────────────────────────────────────────────────────────────
        elif language == "go":
            if not _runtime_available("go"):
                return "", "", "Go runtime not found. Install it to execute Go snippets."
            command = ["go", "run", temp_path]

        # ── Java ────────────────────────────────────────────────────────────
        elif language == "java":
            if not _runtime_available("javac"):
                return "", "", "JDK not found. Install it to execute Java snippets."
            import re
            # Java requires the file to match the public class name
            match = re.search(r"public\s+class\s+(\w+)", code_snippet)
            class_name = match.group(1) if match else "Snippet"
            java_dir = os.path.dirname(temp_path)
            java_file = os.path.join(java_dir, f"{class_name}.java")
            with open(java_file, "w", encoding="utf-8") as jf:
                jf.write(code_snippet)
            os.unlink(temp_path)
            temp_path = java_file
            compile_result = subprocess.run(
                ["javac", java_file], capture_output=True, text=True, timeout=15
            )
            if compile_result.returncode != 0:
                os.unlink(java_file)
                return "", compile_result.stderr, "Java compilation failed."
            command = ["java", "-cp", java_dir, class_name]

        # ── Rust ────────────────────────────────────────────────────────────
        elif language == "rust":
            if not _runtime_available("rustc"):
                return "", "", "Rust compiler (rustc) not found. Install Rust to execute snippets."
            out_bin = temp_path.replace(".rs", "")
            compile_result = subprocess.run(
                ["rustc", temp_path, "-o", out_bin, "--edition", "2021"],
                capture_output=True, text=True, timeout=30,
            )
            if compile_result.returncode != 0:
                os.unlink(temp_path)
                return "", compile_result.stderr, "Rust compilation failed."
            command = [out_bin]

        else:
            return "", "", f"Unsupported language: {language}"

        result = subprocess.run(command, capture_output=True, text=True, timeout=60)
        return result.stdout, result.stderr, None

    except subprocess.TimeoutExpired:
        return "", "", "Execution timed out (60s limit exceeded)."
    except Exception as e:
        return "", "", str(e)
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass
