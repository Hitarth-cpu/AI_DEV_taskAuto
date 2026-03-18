import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from agent_core.models.schemas import TaskRequest, TaskResponse, SkillAssessmentRequest, SkillAssessment
from agent_core.engines.automation import AutomationEngine
from agent_core.engines.skill_assessor import SkillAssessmentEngine
from agent_core.db.database import engine, get_db
from agent_core.db import models
from sqlalchemy import text
from fastapi import WebSocket, WebSocketDisconnect
from agent_core.api.websockets import manager

from contextlib import asynccontextmanager

def init_db():
    print("INFO: [DB] Verifying infrastructure...")
    try:
        # 1. Ensure tables exist
        models.Base.metadata.create_all(bind=engine)
        
        # 2. Individual hotpatching for reliability
        def add_col(table, col, ctype):
            try:
                with engine.begin() as conn:
                    # Check if column already exists to avoid unnecessary SQL logs/errors
                    check_sql = f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}' AND COLUMN_NAME = '{col}'"
                    exists = conn.execute(text(check_sql)).fetchone()
                    if not exists:
                        conn.execute(text(f"ALTER TABLE {table} ADD {col} {ctype}"))
                        print(f"INFO: [DB] Added column {col} to {table}")
            except Exception as e:
                # Fallback for SQLite which doesn't have INFORMATION_SCHEMA
                if "sqlite" in str(engine.url):
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ctype}"))
                    except: pass
                else:
                    print(f"DEBUG: [DB] Schema match skip for {table}.{col}: {e}")

        # Core additions
        add_col("skill_assessment_records", "test_execution_output", "TEXT")
        add_col("skill_assessment_records", "tester_suggestions", "TEXT")
        add_col("automation_memories", "validation_script", "TEXT")
        add_col("automation_memories", "blast_radius_report", "TEXT")
        add_col("automation_memories", "iteration_history", "TEXT")
        add_col("automation_memories", "context_used", "TEXT")
        add_col("automation_memories", "working_directory", "TEXT")
        print("INFO: [DB] System ready.")
    except Exception as e:
        print(f"ERROR: [DB] Infrastructure failure: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown

app = FastAPI(
    title="AI Dev Agent API", 
    description="Core API for the AI Developer Agent",
    lifespan=lifespan
)

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# --- Agentic Upgrade: WebSocket Routes ---

@app.websocket("/ws/cli/{token}")
async def websocket_cli_endpoint(websocket: WebSocket, token: str):
    """Endpoint for the local Desktop CLI agents to connect and listen for execution sub-commands"""
    await manager.connect_cli(token, websocket)
    try:
        while True:
            # Receive log streams or execution results from the CLI agent
            data = await websocket.receive_json()
            # Broadcast the logs up to the specific UI tracking this execution
            # In a real app we'd map this to the exact session, for MVP we broadcast
            await manager.broadcast_ui(data)
    except WebSocketDisconnect:
        manager.disconnect_cli(token)
        await manager.broadcast_ui({"type": "agent_status", "token": token, "status": "offline"})

@app.websocket("/ws/ui/{session_id}")
async def websocket_ui_endpoint(websocket: WebSocket, session_id: str):
    """Endpoint for the Next.js frontend to send execution commands and receive live logs"""
    await manager.connect_ui(session_id, websocket)
    try:
        while True:
            # Receive manual Run/Approve commands from the UI
            data = await websocket.receive_json()
            if data.get("action") == "execute_remote":
                target_token = data.get("token", "default_agent")
                success = await manager.send_to_cli(target_token, {
                    "action": "execute",
                    "script": data.get("script"),
                    "is_validation": data.get("is_validation", False),
                    "working_directory": data.get("working_directory", "")
                })
                if not success:
                    await websocket.send_json({"type": "error", "message": f"CLI Agent {target_token} is not connected."})
    except WebSocketDisconnect:
        manager.disconnect_ui(session_id)

@app.post("/api/v1/automate", response_model=TaskResponse)
async def generate_automation(req: TaskRequest, db: Session = Depends(get_db)):
    engine = AutomationEngine()
    script, reasoning, val_script, blast_report, record_id = await engine.build_script(req.task_description, req.target_env, db, req.working_directory)
    return TaskResponse(
        id=record_id if record_id != -1 else None, 
        script=script, 
        reasoning=reasoning,
        validation_script=val_script,
        blast_radius_report=blast_report
    )

@app.post("/api/v1/assess", response_model=SkillAssessment)
async def assess_skills(req: SkillAssessmentRequest, db: Session = Depends(get_db)):
    engine = SkillAssessmentEngine()
    assessment = await engine.assess_snippet(req.code_snippet, req.language, db)
    return assessment

@app.get("/api/v1/assess/history")
async def get_assessment_history(db: Session = Depends(get_db)):
    records = db.query(models.SkillAssessmentRecord).order_by(models.SkillAssessmentRecord.created_at.desc()).limit(20).all()
    return records

@app.get("/api/v1/automate/history")
async def get_automation_history(db: Session = Depends(get_db)):
    records = db.query(models.AutomationMemory).order_by(models.AutomationMemory.created_at.desc()).limit(20).all()
    return records

class AutomationEditRequest(TaskRequest):
    id: int
    user_edited_script: str

@app.post("/api/v1/automate/edit")
async def edit_automation(req: AutomationEditRequest, db: Session = Depends(get_db)):
    record = db.query(models.AutomationMemory).filter(models.AutomationMemory.id == req.id).first()
    if record:
        record.user_edited_script = req.user_edited_script
        db.commit()
        return {"status": "success", "message": "Memory updated for future RAG."}
    return {"status": "error", "message": "Record not found."}
