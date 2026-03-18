import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Build the connection string for pyodbc using SQL Server
# Defaulting to localhost:1433 and 'sa' built from docker-compose.yml
DB_SERVER = os.getenv("DB_SERVER", "localhost,1433")
DB_USER = os.getenv("DB_USER", "sa")
DB_PASSWORD = os.getenv("DB_PASSWORD", "YourStrong!Passw0rd")
DB_NAME = os.getenv("DB_NAME", "master") # Using master for simplicity in MVP
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server") # Common cross-platform driver

# SQLAlchemy format: mssql+pyodbc://<username>:<password>@<dsnname>
# We use a pure connection string format for broader compatibility
SQLALCHEMY_DATABASE_URL = f"mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_SERVER}/{DB_NAME}?driver={DB_DRIVER.replace(' ', '+')}"

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=False)
except Exception as e:
    # Fallback to local SQLite if SQL Server ODBC drivers are missing on the developer's raw machine
    print(f"Failed to connect via MSSQL ({e}). Fallback to SQLite (sqlite:///./local_memory.db).")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./local_memory.db"
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
