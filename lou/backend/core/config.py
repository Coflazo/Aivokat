import os
from pathlib import Path
from pydantic_settings import BaseSettings

# config.py lives at lou/backend/core/config.py
# _project_root is lou/ — always correct regardless of CWD.
_here = Path(__file__).resolve()
_project_root = _here.parent.parent.parent  # lou/

_env_candidates = [
    _project_root / ".env",               # lou/.env (normal case)
    _here.parent.parent / ".env",          # backend/.env (fallback)
]
_env_file = next((str(p) for p in _env_candidates if p.exists()), ".env")

_data_dir = _project_root / "data"


class Settings(BaseSettings):
    openai_api_key: str
    llm_model: str = "gpt-5.5"
    llm_fallback_models: str = "gpt-5.5"
    llm_temperature: float = 0.1
    embedding_model: str = "all-mpnet-base-v2"
    lou_embedding_model_path: str = str(_project_root / "backend" / "models" / "lou-retriever")
    lou_classifier_path: str = str(_project_root / "backend" / "models" / "clause-classifier" / "model.joblib")
    lou_classifier_confidence_threshold: float = 0.70
    training_data_dir: str = str(_data_dir / "training")
    chroma_persist_dir: str = str(_data_dir / "chroma")
    upload_dir: str = str(_data_dir / "uploads")
    database_url: str = f"sqlite:///{_data_dir}/lou.db"
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:5174,"
        "http://127.0.0.1:5174,"
        "http://localhost:5175,"
        "http://127.0.0.1:5175,"
        "http://localhost:5176,"
        "http://127.0.0.1:5176"
    )
    max_upload_size_mb: int = 50

    class Config:
        env_file = _env_file


settings = Settings()
