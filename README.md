# AI Dev Task Automator

An AI-powered developer agent that generates cross-platform automation scripts and assesses code quality — all from a single prompt.

Built with a FastAPI backend, a Next.js frontend, and Google Gemini (gemini-2.5-flash) as the LLM brain.

---

## Features

- **Script Automation** — Describe a task in plain English, get a fully executable PowerShell or Bash script back, complete with a validation script and a blast radius report for any destructive operations.
- **Skill Assessment** — Submit a code snippet and get an AI-powered code review: proficiency level, score out of 10, strengths, and actionable improvement suggestions. The code is actually executed locally before review.
- **Self-Improving Memory** — Past user-corrected scripts are stored and fed back as context (RAG) for future generations, so the agent learns your team's preferences over time.
- **Live WebSocket Execution** — The CLI daemon connects to the backend via WebSocket, allowing the Next.js UI to trigger remote script execution and stream logs in real time.
- **Cross-Platform** — Supports Windows (PowerShell) and Linux/macOS (Bash) script generation and execution.

---

## Project Structure

```
taskAuto/
├── agent_core/
│   ├── api/          # FastAPI routes + WebSocket manager
│   ├── db/           # SQLAlchemy models + database setup
│   ├── engines/      # Automation & skill assessment LLM engines
│   ├── execution/    # Cross-platform script/code execution
│   └── models/       # Pydantic schemas
├── cli/              # Typer CLI + daemon for local execution
├── scripts/          # Utility/test scripts
├── web/              # Next.js frontend
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- Docker (optional, for containerized setup)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Hitarth-cpu/AI_DEV_taskAuto.git
cd AI_DEV_taskAuto
```

### 2. Configure environment

Copy `.env` and add your API key:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

### 3. Backend

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn agent_core.api.main:app --reload
cd d:\programming\taskAuto
venv\Scripts\python.exe -m cli.daemon --token default_agent --server 127.0.0.1:8000

```

API will be available at `http://localhost:8000`.

### 4. Frontend

```bash
cd web
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`.

### 5. Docker (alternative)

```bash
docker-compose up --build
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/automate` | Generate an automation script |
| GET | `/api/v1/automate/history` | Fetch past automation records |
| POST | `/api/v1/automate/edit` | Save a user-corrected script to memory |
| POST | `/api/v1/assess` | Assess a code snippet |
| GET | `/api/v1/assess/history` | Fetch past assessment records |
| WS | `/ws/cli/{token}` | CLI daemon connection |
| WS | `/ws/ui/{session_id}` | Frontend live log stream |

### Example: Generate a script

```bash
curl -X POST http://localhost:8000/api/v1/automate \
  -H "Content-Type: application/json" \
  -d '{"task_description": "Delete all .log files older than 7 days", "target_env": "linux"}'
```

---

## CLI Usage

```bash
# Generate an automation script
python -m cli.main automate "Set up a Python virtual environment and install dependencies" --env linux

# Assess a code file
python -m cli.main assess path/to/snippet.py --lang python
```

---

## Tech Stack

- **Backend** — FastAPI, SQLAlchemy, LangChain, Google Gemini
- **Frontend** — Next.js, TypeScript, Tailwind CSS
- **Database** — SQLite (dev) / SQL Server (prod via Docker)
- **LLM** — Google Gemini 2.5 Flash
