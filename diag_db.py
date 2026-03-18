import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text

# Get connection string from models/database if needed, but let's assume it's basic for now
# Looking at main.py, it imports engine from agent_core.db.database
from agent_core.db.database import engine

def test_hotpatch():
    print("Starting hotpatch test...")
    def add_col(table, col, col_type):
        print(f"Checking {table}.{col}...")
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD {col} {col_type}"))
                print(f"  SUCCESS: Added {col}")
        except Exception as e:
            print(f"  SKIPPED: {type(e).__name__}")
    
    add_col("skill_assessment_records", "test_execution_output", "TEXT")
    add_col("skill_assessment_records", "tester_suggestions", "TEXT")
    add_col("automation_memories", "validation_script", "TEXT")
    add_col("automation_memories", "blast_radius_report", "TEXT")
    add_col("automation_memories", "iteration_history", "TEXT")
    add_col("automation_memories", "context_used", "TEXT")
    add_col("automation_memories", "working_directory", "TEXT")
    print("Done.")

if __name__ == "__main__":
    test_hotpatch()
