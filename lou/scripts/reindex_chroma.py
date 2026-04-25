#!/usr/bin/env python3
"""Rebuild ChromaDB from approved SQLite rules using the active embedder."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select

from backend.core.config import settings
from backend.core.database import create_db_and_tables, engine
from backend.core.schema import Rule
from backend.services.vector_store import add_rule, get_chroma_client


def main() -> None:
    create_db_and_tables()
    chroma_path = Path(settings.chroma_persist_dir)
    if chroma_path.exists():
        shutil.rmtree(chroma_path)
    chroma_path.mkdir(parents=True, exist_ok=True)
    get_chroma_client.cache_clear()

    with Session(engine) as session:
        rules = session.exec(select(Rule).where(Rule.is_active == True)).all()
        for rule in rules:
            add_rule(rule)

    print(f"reindexed rules: {len(rules)}")
    print(f"chroma path: {chroma_path.resolve()}")


if __name__ == "__main__":
    main()
