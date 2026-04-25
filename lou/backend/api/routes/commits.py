from fastapi import APIRouter, Query
from sqlmodel import Session, select, col
from typing import Optional

from backend.core.database import engine
from backend.core.schema import Commit

router = APIRouter(prefix="/api/commits", tags=["commits"])


@router.get("")
async def list_commits(
    rule_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    with Session(engine) as session:
        stmt = select(Commit)
        if rule_id:
            stmt = stmt.where(Commit.rule_id == rule_id)
        stmt = stmt.order_by(col(Commit.committed_at).desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)
        commits = session.exec(stmt).all()

    return [c.model_dump() for c in commits]
