"""
TaskAuto CLI Daemon — HuggingFace Space
Runs the WebSocket daemon in a background thread and exposes a minimal
status UI on port 7860 so HF Spaces keeps the container alive.
"""

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import threading
import platform
from datetime import datetime

import gradio as gr
import websockets

# ── Config from HF Space secrets ─────────────────────────────────────────
TOKEN  = os.getenv("DAEMON_TOKEN",   "hf_agent")
SERVER = os.getenv("BACKEND_SERVER", "ai-dev-taskauto.onrender.com")

# ── State ─────────────────────────────────────────────────────────────────
state = {
    "status":    "connecting",
    "jobs_done": 0,
    "last_job":  "—",
    "log":       [],
}

def add_log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    state["log"].append(f"[{ts}] {msg}")
    if len(state["log"]) > 100:
        state["log"].pop(0)
    print(msg)

# ── Daemon loop ───────────────────────────────────────────────────────────
async def daemon_loop():
    uri     = f"wss://{SERVER}/ws/cli/{TOKEN}"
    backoff = 1

    while True:
        add_log(f"Connecting to {uri} ...")
        state["status"] = "connecting"
        try:
            async with websockets.connect(uri) as ws:
                backoff = 1
                state["status"] = "online"
                add_log("Connected — waiting for jobs.")

                while True:
                    message = await ws.recv()
                    data    = json.loads(message)

                    if data.get("action") != "execute":
                        continue

                    script_content   = data.get("script", "")
                    is_validation    = data.get("is_validation", False)
                    working_dir      = data.get("working_directory", "").strip() or None
                    add_log(f"Job received ({'validation' if is_validation else 'script'})")

                    if working_dir and not os.path.isdir(working_dir):
                        err = f"[ERROR] Working directory not found: {working_dir}"
                        add_log(err)
                        await ws.send(json.dumps({"type": "log",  "token": TOKEN, "data": err}))
                        await ws.send(json.dumps({"type": "exit", "token": TOKEN, "code": 1, "is_validation": is_validation}))
                        continue

                    os_name = platform.system().lower()
                    suffix  = ".ps1" if os_name == "windows" else ".sh"

                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode="w") as f:
                        f.write(script_content)
                        tmp = f.name

                    try:
                        cwd = working_dir or os.getcwd()
                        await ws.send(json.dumps({"type": "log", "token": TOKEN, "data": f"[SYSTEM] Running in: {cwd}\n"}))

                        if os_name == "windows":
                            cmd = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", tmp]
                        else:
                            os.chmod(tmp, 0o755)
                            cmd = ["bash", tmp]

                        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                                text=True, bufsize=1, cwd=working_dir)

                        for line in iter(proc.stdout.readline, ""):
                            sys.stdout.write(line)
                            await ws.send(json.dumps({"type": "log", "token": TOKEN, "data": line}))

                        proc.wait()
                        await ws.send(json.dumps({"type": "exit", "token": TOKEN,
                                                  "code": proc.returncode, "is_validation": is_validation}))

                        state["jobs_done"] += 1
                        state["last_job"]   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        add_log(f"Job done — exit code {proc.returncode}")

                    finally:
                        if os.path.exists(tmp):
                            os.unlink(tmp)

        except Exception as e:
            state["status"] = "offline"
            add_log(f"Disconnected: {e}. Retrying in {backoff}s ...")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


def start_daemon():
    asyncio.run(daemon_loop())


# Start daemon in background thread
threading.Thread(target=start_daemon, daemon=True).start()

# ── Gradio status UI ──────────────────────────────────────────────────────
def get_status():
    color = {"online": "#10b981", "connecting": "#f59e0b", "offline": "#ef4444"}.get(state["status"], "#6b7280")
    badge = f'<span style="background:{color};color:#fff;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:600">{state["status"].upper()}</span>'
    log   = "\n".join(state["log"][-20:])
    return badge, state["jobs_done"], state["last_job"], log


with gr.Blocks(title="TaskAuto Daemon", theme=gr.themes.Base()) as demo:
    gr.Markdown("# TaskAuto CLI Daemon")
    gr.Markdown(f"Connected to `{SERVER}` as token **`{TOKEN}`**")

    with gr.Row():
        status_html  = gr.HTML(label="Status")
        jobs_counter = gr.Number(label="Jobs executed", value=0, interactive=False)
        last_job_txt = gr.Textbox(label="Last job", value="—", interactive=False)

    log_box = gr.Textbox(label="Log", lines=20, interactive=False, max_lines=20)

    refresh_btn = gr.Button("Refresh")

    def refresh():
        badge, jobs, last, log = get_status()
        return badge, jobs, last, log

    refresh_btn.click(refresh, outputs=[status_html, jobs_counter, last_job_txt, log_box])
    demo.load(refresh, outputs=[status_html, jobs_counter, last_job_txt, log_box])

demo.launch(server_name="0.0.0.0", server_port=7860)
