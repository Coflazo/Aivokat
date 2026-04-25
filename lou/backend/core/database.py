import os
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session
from backend.core.config import settings

# Make sure the SQLite folder exists before SQLModel opens the file.
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
    """Tiny local migrations for the SQLite demo database.

    create_all can make missing tables, but it will not add new columns to a
    table that already exists. Keep this small until we add Alembic.
    """
    inspector = inspect(engine)
    if "playbookissue" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("playbookissue")}
    with engine.begin() as connection:
        if "rejected" not in columns:
            connection.execute(text("ALTER TABLE playbookissue ADD COLUMN rejected BOOLEAN DEFAULT 0 NOT NULL"))
