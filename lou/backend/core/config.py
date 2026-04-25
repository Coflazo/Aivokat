import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Walk up from this file to find .env (supports running from backend/ or lou/)
_here = Path(__file__).resolve()
_env_candidates = [
    _here.parent.parent.parent / ".env",  # lou/.env  (running from TUMHL)
    _here.parent.parent / ".env",          # backend/.env (running from lou)
]
_env_file = next((str(p) for p in _env_candidates if p.exists()), ".env")


class Settings(BaseSettings):
    openai_api_key: str
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.1
    embedding_model: str = "all-mpnet-base-v2"
    chroma_persist_dir: str = "./data/chroma"
    upload_dir: str = "./data/uploads"
    database_url: str = "sqlite:///./data/lou.db"
    cors_origins: str = "http://localhost:5173"
    max_upload_size_mb: int = 50

    class Config:
        env_file = _env_file


settings = Settings()
