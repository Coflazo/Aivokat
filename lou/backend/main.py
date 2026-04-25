import sys
import os

# Ensure backend package is importable when running from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.database import create_db_and_tables
from backend.core.config import settings
from backend.api.routes import playbook, chat, graph, commits, review, contracts, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
    create_db_and_tables()
    from backend.services.embedder import get_embedder
    get_embedder()
    yield


app = FastAPI(title="Lou API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(playbook.router)
app.include_router(chat.router)
app.include_router(graph.router)
app.include_router(commits.router)
app.include_router(review.router)
app.include_router(contracts.router)
app.include_router(export.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/health")
async def legacy_health():
    return {"status": "ok"}
