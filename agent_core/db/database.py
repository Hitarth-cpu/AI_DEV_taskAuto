import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Priority 1: Supabase / any PostgreSQL (DATABASE_URL)
# Priority 2: MySQL (DB_HOST set)
# Priority 3: SQLite fallback (local dev)

DATABASE_URL = os.getenv("DATABASE_URL")
DB_HOST      = os.getenv("DB_HOST")

def _make_engine():
    # ── PostgreSQL (Supabase) ──────────────────────────────────────────────
    if DATABASE_URL:
        url = DATABASE_URL
        # SQLAlchemy requires postgresql:// not postgres://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        try:
            eng = create_engine(url, echo=False, pool_pre_ping=True, pool_size=5, max_overflow=10)
            with eng.connect() as c:
                c.execute(text("SELECT 1"))
            print("[DB] Connected to PostgreSQL (Supabase)")
            return eng
        except Exception as e:
            print(f"[DB] PostgreSQL unavailable ({e}). Trying next option.")

    # ── MySQL ─────────────────────────────────────────────────────────────
    if DB_HOST:
        DB_PORT     = os.getenv("DB_PORT", "3306")
        DB_USER     = os.getenv("DB_USER", "root")
        DB_PASSWORD = os.getenv("DB_PASSWORD", "")
        DB_NAME     = os.getenv("DB_NAME", "taskautodb")
        url = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        try:
            eng = create_engine(url, echo=False, pool_pre_ping=True)
            with eng.connect() as c:
                c.execute(text("SELECT 1"))
            print(f"[DB] Connected to MySQL ({DB_HOST}:{DB_PORT}/{DB_NAME})")
            return eng
        except Exception as e:
            print(f"[DB] MySQL unavailable ({e}). Falling back to SQLite.")

    # ── SQLite fallback ───────────────────────────────────────────────────
    print("[DB] Using SQLite (local_memory.db)")
    return create_engine("sqlite:///./local_memory.db", connect_args={"check_same_thread": False})


engine       = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
