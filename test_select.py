import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text
from agent_core.db.database import engine

def test_select():
    print("Testing SELECT * FROM automation_memories...")
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT TOP 1 * FROM automation_memories"))
            print(f"Columns in result set: {res.keys()}")
            row = res.fetchone()
            print(f"Sample row: {row}")
    except Exception as e:
        print(f"SELECT failed: {e}")

if __name__ == "__main__":
    test_select()
