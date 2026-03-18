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

def execute_code(code_snippet: str, language: str):
    """Executes arbitrary assessment code based on the provided language."""
    language = language.lower()
    os_name = platform.system().lower()
    
    extension_map = {
        "python": ".py",
        "javascript": ".js",
        "bash": ".sh",
        "powershell": ".ps1"
    }
    
    if language not in extension_map:
        return "", "", f"Execution not supported for language: {language}"
        
    ext = extension_map[language]
    
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(code_snippet.encode('utf-8'))
            temp_path = f.name
            
        if language == "python":
            command = ["python", temp_path]
        elif language == "javascript":
            command = ["node", temp_path]
        elif language == "powershell":
            command = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", temp_path]
        elif language == "bash":
            if os_name == "windows":
                # Fallback or WSL could be used, but for MVP let's return error on windows for bash
                os.unlink(temp_path)
                return "", "", "Bash execution not natively supported on Windows MVP without WSL."
            os.chmod(temp_path, 0o755)
            command = ["bash", temp_path]
            
        result = subprocess.run(command, capture_output=True, text=True, timeout=10) # 10s timeout to prevent infinite loops
        os.unlink(temp_path)
        
        return result.stdout, result.stderr, None
        
    except subprocess.TimeoutExpired:
        os.unlink(temp_path)
        return "", "", "Execution timed out (10s limit exceeded)."
    except Exception as e:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        return "", "", str(e)
