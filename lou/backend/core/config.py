import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Look for .env in the two places we usually run the backend from.
_here = Path(__file__).resolve()
_env_candidates = [
    _here.parent.parent.parent / ".env",  # This is lou/.env when we start from TUMHL.
    _here.parent.parent / ".env",          # This is backend/.env when we start from lou.
]
_env_file = next((str(p) for p in _env_candidates if p.exists()), ".env")


class Settings(BaseSettings):
    openai_api_key: str
    llm_model: str = "gpt-5.5"
    llm_fallback_models: str = "gpt-5.5"
    llm_temperature: float = 0.1
    embedding_model: str = "all-mpnet-base-v2"
    lou_embedding_model_path: str = "./models/lou-retriever"
    lou_classifier_path: str = "./models/clause-classifier/model.joblib"
    lou_classifier_confidence_threshold: float = 0.70
    training_data_dir: str = "./data/training"
    chroma_persist_dir: str = "./data/chroma"
    upload_dir: str = "./data/uploads"
    database_url: str = "sqlite:///./data/lou.db"
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
