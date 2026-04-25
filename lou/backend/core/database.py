import os
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session
from backend.core.config import settings

# Resolve the DB path relative to the backend directory
db_path = settings.database_url.replace("sqlite:///", "")
os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)

engine = create_engine(settings.database_url, echo=False)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _run_lightweight_migrations()


def get_session():
    with Session(engine) as session:
        yield session


def _run_lightweight_migrations() -> None:
    """Small SQLite migrations for the hackathon local database.

    SQLModel's create_all creates missing tables but does not add new columns to
    existing tables. Keep this narrow and explicit until a real migration tool is
    introduced.
    """
    inspector = inspect(engine)
    if "playbookissue" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("playbookissue")}
    with engine.begin() as connection:
        if "rejected" not in columns:
            connection.execute(text("ALTER TABLE playbookissue ADD COLUMN rejected BOOLEAN DEFAULT 0 NOT NULL"))
