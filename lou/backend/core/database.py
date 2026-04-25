import os
from sqlmodel import SQLModel, create_engine, Session
from backend.core.config import settings

# Resolve the DB path relative to the backend directory
db_path = settings.database_url.replace("sqlite:///", "")
os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

engine = create_engine(settings.database_url, echo=False)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
