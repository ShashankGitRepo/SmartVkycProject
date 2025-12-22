import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CA_PATH = os.path.join(BASE_DIR, "ca.pem")

connect_args = {}
if DATABASE_URL and "aivencloud" in DATABASE_URL:
    if os.path.exists(CA_PATH):
        connect_args = {
            "ssl": {
                "ca": CA_PATH
            }
        }
    else:
        print(f"Warning: SSL CA file not found at {CA_PATH}. Connecting WITHOUT SSL verification (dev only).")
        connect_args = {
            "ssl": {
                "cert_reqs": False
            }
        }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
