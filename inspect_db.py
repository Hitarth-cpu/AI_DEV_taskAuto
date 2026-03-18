import os
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine, text
from agent_core.db.database import engine

def inspect_schema():
    print("Inspecting schema for 'automation_memories'...")
    try:
        with engine.connect() as conn:
            # SQL Server specific query to list columns
            res = conn.execute(text("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'automation_memories'"))
            columns = [row[0] for row in res]
            print(f"Columns in 'automation_memories': {columns}")
            
            if 'working_directory' not in columns:
                print("!! 'working_directory' is missing. Attempting force-add...")
                try:
                    # Try to add it explicitly here
                    conn.execute(text("ALTER TABLE automation_memories ADD working_directory TEXT"))
                    conn.commit()
                    print("  Successfully force-added 'working_directory'")
                except Exception as e:
                    print(f"  Failed to force-add: {e}")
            else:
                print("  'working_directory' exists.")
                
    except Exception as e:
        print(f"Error during inspection: {e}")

if __name__ == "__main__":
    inspect_schema()
