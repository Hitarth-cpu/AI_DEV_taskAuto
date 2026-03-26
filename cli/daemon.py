import asyncio
import websockets
import json
import subprocess
import typer
import sys
import os

app = typer.Typer(help="AI Developer Agent: Zero-Click CLI Daemon")

async def listen_for_jobs(token: str, server_url: str):
    is_local = "localhost" in server_url or "127.0.0.1" in server_url
    scheme = "ws" if is_local else "wss"
    uri = f"{scheme}://{server_url}/ws/cli/{token}"
    backoff = 1   # seconds; doubles on each failure, capped at 60s
    max_backoff = 60

    while True:  # Auto-reconnect loop with exponential backoff
        typer.secho(f"Connecting to AI Dashboard at {uri}...", fg=typer.colors.CYAN)
        try:
            async with websockets.connect(uri) as websocket:
                backoff = 1  # reset on successful connection
                typer.secho("[OK] Connected successfully. Waiting for remote execution jobs...", fg=typer.colors.GREEN, bold=True)
                
                while True:
                    message = await websocket.recv()
                    data = json.loads(message)
                    
                    if data.get("action") == "execute":
                        script_content = data.get("script", "")
                        is_validation = data.get("is_validation", False)
                        working_directory = data.get("working_directory", "").strip() or None
                        typer.secho(f"\n[RECEIVED JOB] Executing {'validation' if is_validation else 'primary'} script...", fg=typer.colors.YELLOW)

                        # Validate working directory if provided
                        if working_directory and not os.path.isdir(working_directory):
                            err_msg = f"[ERROR] Working directory does not exist: {working_directory}"
                            typer.secho(err_msg, fg=typer.colors.RED)
                            await websocket.send(json.dumps({"type": "log", "token": token, "data": err_msg}))
                            await websocket.send(json.dumps({"type": "exit", "token": token, "code": 1, "is_validation": is_validation}))
                            continue

                        import tempfile
                        import platform
                        os_name = platform.system().lower()
                        suffix = ".ps1" if os_name == "windows" else ".sh"

                        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                            f.write(script_content.encode('utf-8'))
                            temp_path = f.name

                        try:
                            # Log the resolved working directory to the UI
                            cwd_display = working_directory if working_directory else os.getcwd()
                            await websocket.send(json.dumps({
                                "type": "log", "token": token,
                                "data": f"[SYSTEM] Executing in: {cwd_display}\n"
                            }))

                            if os_name == "windows":
                                cmd = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", temp_path]
                            else:
                                os.chmod(temp_path, 0o755)
                                cmd = ["bash", temp_path]

                            process = subprocess.Popen(
                                cmd,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                text=True,
                                bufsize=1,
                                cwd=working_directory  # None = daemon's own cwd
                            )

                            for line in iter(process.stdout.readline, ''):
                                sys.stdout.write(line)
                                await websocket.send(json.dumps({
                                    "type": "log",
                                    "token": token,
                                    "data": line
                                }))

                            process.wait()

                            await websocket.send(json.dumps({
                                "type": "exit",
                                "token": token,
                                "code": process.returncode,
                                "is_validation": is_validation
                            }))

                            status_color = typer.colors.GREEN if process.returncode == 0 else typer.colors.RED
                            typer.secho(f"[JOB COMPLETE] Exit Code: {process.returncode}\n", fg=status_color)

                        finally:
                            if os.path.exists(temp_path):
                                os.unlink(temp_path)
                                
        except Exception as e:
            typer.secho(f"[ERR] Disconnected: {e}. Retrying in {backoff}s...", fg=typer.colors.RED)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)

@app.command()
def start_daemon(
    token: str = typer.Option("default_agent", help="Unique identifier token for this machine"),
    server: str = typer.Option("127.0.0.1:8000", help="Hostname and port of the AI backend")
):
    """Starts the CLI Daemon to accept remote execution commands from the AI Dashboard."""
    asyncio.run(listen_for_jobs(token, server))

if __name__ == "__main__":
    app()
