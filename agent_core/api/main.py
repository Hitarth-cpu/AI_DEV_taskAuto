import os
import re
from time import time
from collections import defaultdict
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
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

# ---------------------------------------------------------------------------
# Input sanitization utility
# ---------------------------------------------------------------------------

def sanitize_input(text: str, max_length: int = 2000) -> str:
    """Strip control characters, enforce max length — basic prompt-injection defence."""
    text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]", "", text)
    return text[:max_length].strip()

# ---------------------------------------------------------------------------
# Simple in-memory rate limiter (10 LLM requests per IP per 60 s)
# ---------------------------------------------------------------------------

_rate_store: dict = defaultdict(list)
_RATE_LIMIT = 10
_RATE_WINDOW = 60   # seconds
_RATE_PATHS = {"/api/v1/automate", "/api/v1/assess", "/api/v1/automate/fix"}

# ---------------------------------------------------------------------------
# DB init
# ---------------------------------------------------------------------------

def init_db():
    print("INFO: [DB] Verifying infrastructure...")
    try:
        models.Base.metadata.create_all(bind=engine)

        def add_col(table, col, ctype):
            try:
                with engine.begin() as conn:
                    check_sql = f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{table}' AND COLUMN_NAME = '{col}' AND TABLE_SCHEMA = DATABASE()"
                    exists = conn.execute(text(check_sql)).fetchone()
                    if not exists:
                        conn.execute(text(f"ALTER TABLE {table} ADD {col} {ctype}"))
                        print(f"INFO: [DB] Added column {col} to {table}")
            except Exception as e:
                if "sqlite" in str(engine.url):
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ctype}"))
                    except Exception:
                        pass
                else:
                    print(f"DEBUG: [DB] Schema match skip for {table}.{col}: {e}")

        add_col("skill_assessment_records", "test_execution_output", "TEXT")
        add_col("skill_assessment_records", "tester_suggestions", "TEXT")
        add_col("skill_assessment_records", "working_directory", "TEXT")
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
    init_db()
    yield


app = FastAPI(
    title="AI Dev Agent API",
    description="Core API for the AI Developer Agent",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate-limit middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Only rate-limit LLM-heavy endpoints
    if any(request.url.path.startswith(p) for p in _RATE_PATHS) and request.method == "POST":
        client_ip = (request.client.host if request.client else "unknown")
        now = time()
        _rate_store[client_ip] = [t for t in _rate_store[client_ip] if now - t < _RATE_WINDOW]
        if len(_rate_store[client_ip]) >= _RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded — max {_RATE_LIMIT} requests per minute."},
            )
        _rate_store[client_ip].append(now)
    return await call_next(request)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "agents_online": list(manager.cli_connections.keys())}

# ---------------------------------------------------------------------------
# WebSocket routes
# ---------------------------------------------------------------------------

@app.websocket("/ws/cli/{token}")
async def websocket_cli_endpoint(websocket: WebSocket, token: str):
    await manager.connect_cli(token, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast_ui(data)
    except WebSocketDisconnect:
        manager.disconnect_cli(token)
        await manager.broadcast_ui({"type": "agent_status", "token": token, "status": "offline"})

@app.websocket("/ws/ui/{session_id}")
async def websocket_ui_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect_ui(session_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "execute_remote":
                target_token = data.get("token", "default_agent")
                success = await manager.send_to_cli(target_token, {
                    "action": "execute",
                    "script": data.get("script"),
                    "is_validation": data.get("is_validation", False),
                    "working_directory": data.get("working_directory", ""),
                })
                if not success:
                    await websocket.send_json({"type": "error", "message": f"CLI Agent '{target_token}' is not connected."})
    except WebSocketDisconnect:
        manager.disconnect_ui(session_id)

# ---------------------------------------------------------------------------
# Automation endpoints
# ---------------------------------------------------------------------------

@app.post("/api/v1/automate", response_model=TaskResponse)
async def generate_automation(req: TaskRequest, db: Session = Depends(get_db)):
    req.task_description = sanitize_input(req.task_description)
    eng = AutomationEngine()
    script, reasoning, val_script, blast_report, record_id = await eng.build_script(
        req.task_description, req.target_env, db, req.working_directory
    )
    return TaskResponse(
        id=record_id if record_id != -1 else None,
        script=script,
        reasoning=reasoning,
        validation_script=val_script,
        blast_radius_report=blast_report,
    )

@app.get("/api/v1/automate/history")
async def get_automation_history(db: Session = Depends(get_db)):
    records = db.query(models.AutomationMemory).order_by(models.AutomationMemory.created_at.desc()).limit(50).all()
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

# ---------------------------------------------------------------------------
# Feature 4 — Auto Fix-It Loop
# ---------------------------------------------------------------------------

class FixRequest(BaseModel):
    original_intent: str
    failed_script: str
    error_output: str
    target_env: str = "linux"
    iteration: int = 1
    record_id: Optional[int] = None

@app.post("/api/v1/automate/fix", response_model=TaskResponse)
async def fix_automation(req: FixRequest, db: Session = Depends(get_db)):
    if req.iteration > 3:
        raise HTTPException(status_code=400, detail="Maximum fix iterations (3) exceeded.")
    req.original_intent = sanitize_input(req.original_intent)
    eng = AutomationEngine()
    script, reasoning, val_script, blast_report, record_id = await eng.fix_script(
        req.original_intent, req.failed_script, req.error_output,
        req.target_env, req.iteration, db, req.record_id,
    )
    return TaskResponse(
        id=record_id if record_id != -1 else None,
        script=script, reasoning=reasoning,
        validation_script=val_script, blast_radius_report=blast_report,
    )

# ---------------------------------------------------------------------------
# Assessment endpoints
# ---------------------------------------------------------------------------

@app.post("/api/v1/assess", response_model=SkillAssessment)
async def assess_skills(req: SkillAssessmentRequest, db: Session = Depends(get_db)):
    req.code_snippet = sanitize_input(req.code_snippet, max_length=5000)
    eng = SkillAssessmentEngine()
    assessment = await eng.assess_snippet(req.code_snippet, req.language, db, req.working_directory)
    return assessment

@app.get("/api/v1/assess/history")
async def get_assessment_history(db: Session = Depends(get_db)):
    records = db.query(models.SkillAssessmentRecord).order_by(models.SkillAssessmentRecord.created_at.desc()).limit(50).all()
    return records

# ---------------------------------------------------------------------------
# Feature 2 — Team Knowledge Base (Vector RAG) endpoints
# ---------------------------------------------------------------------------

@app.post("/api/v1/knowledge/upload")
async def upload_knowledge_doc(file: UploadFile = File(...)):
    try:
        from agent_core.knowledge.store import get_knowledge_store
        content_bytes = await file.read()
        text_content = content_bytes.decode("utf-8", errors="replace")
        ks = get_knowledge_store()
        doc_id = ks.add_document(text_content, file.filename or "unnamed", "uploaded_doc")
        return {"status": "success", "id": doc_id, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Knowledge store unavailable: {str(e)}")

@app.get("/api/v1/knowledge/documents")
async def list_knowledge_docs():
    try:
        from agent_core.knowledge.store import get_knowledge_store
        ks = get_knowledge_store()
        return ks.list_documents()
    except Exception:
        return []

@app.delete("/api/v1/knowledge/documents/{doc_id}")
async def delete_knowledge_doc(doc_id: str):
    try:
        from agent_core.knowledge.store import get_knowledge_store
        ks = get_knowledge_store()
        ks.delete_document(doc_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Knowledge store unavailable: {str(e)}")

# ---------------------------------------------------------------------------
# Script Templates — save, list, delete reusable scripts
# ---------------------------------------------------------------------------

class TemplateCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    script: str
    validation_script: Optional[str] = None
    target_env: str = "linux"
    tags: Optional[str] = None  # comma-separated

@app.post("/api/v1/templates")
async def create_template(req: TemplateCreateRequest, db: Session = Depends(get_db)):
    if not req.name.strip() or not req.script.strip():
        raise HTTPException(status_code=400, detail="Name and script are required.")
    tpl = models.ScriptTemplate(
        name=req.name.strip()[:200],
        description=req.description,
        script=req.script,
        validation_script=req.validation_script,
        target_env=req.target_env,
        tags=req.tags,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl

@app.get("/api/v1/templates")
async def list_templates(db: Session = Depends(get_db)):
    return db.query(models.ScriptTemplate).order_by(models.ScriptTemplate.created_at.desc()).all()

@app.delete("/api/v1/templates/{template_id}")
async def delete_template(template_id: int, db: Session = Depends(get_db)):
    tpl = db.query(models.ScriptTemplate).filter(models.ScriptTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found.")
    db.delete(tpl)
    db.commit()
    return {"status": "success"}
