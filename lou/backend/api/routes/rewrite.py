from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from backend.core.database import engine
from backend.core.schema import (
    Playbook,
    PlaybookClause,
    RewriteCellRequest,
    RewriteCellResponse,
    RewritePlaybookRequest,
    RewritePlaybookResponse,
    RewriteRowRequest,
    RewriteRowResponse,
)
from backend.services.business_humanizer import rewrite_playbook_text

router = APIRouter(prefix="/api/rewrite", tags=["rewrite"])

REWRITABLE_FIELDS = [
    "clause_name",
    "why_it_matters",
    "preferred_position",
    "fallback_1",
    "fallback_2",
    "red_line",
    "escalation_trigger",
]


@router.post("/cell", response_model=RewriteCellResponse)
async def rewrite_cell(request: RewriteCellRequest) -> RewriteCellResponse:
    clause = _get_clause(request.playbook_id, request.clause_id)
    if request.field_name not in REWRITABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Field is not rewritable: {request.field_name}")

    proposal = await rewrite_playbook_text(
        text=request.text,
        field_name=request.field_name,
        mode=request.mode,
        clause_name=clause.clause_name,
    )
    return RewriteCellResponse(
        playbook_id=request.playbook_id,
        clause_id=request.clause_id,
        field_name=request.field_name,
        mode=request.mode,
        original=request.text,
        rewritten=proposal["rewritten"],
        meaning_preservation_note=proposal["meaning_preservation_note"],
    )


@router.post("/row", response_model=RewriteRowResponse)
async def rewrite_row(request: RewriteRowRequest) -> RewriteRowResponse:
    clause = _get_clause(request.playbook_id, request.clause_id)
    rewrites = []
    for field_name in REWRITABLE_FIELDS:
        original = getattr(clause, field_name) or ""
        if not original.strip():
            continue
        proposal = await rewrite_playbook_text(
            text=original,
            field_name=field_name,
            mode=request.mode,
            clause_name=clause.clause_name,
        )
        rewrites.append(RewriteCellResponse(
            playbook_id=request.playbook_id,
            clause_id=request.clause_id,
            field_name=field_name,
            mode=request.mode,
            original=original,
            rewritten=proposal["rewritten"],
            meaning_preservation_note=proposal["meaning_preservation_note"],
        ))
    return RewriteRowResponse(
        playbook_id=request.playbook_id,
        clause_id=request.clause_id,
        rewrites=rewrites,
    )


@router.post("/playbook", response_model=RewritePlaybookResponse)
async def rewrite_playbook(request: RewritePlaybookRequest) -> RewritePlaybookResponse:
    with Session(engine) as session:
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == request.playbook_id)).first()
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found.")
        clauses = session.exec(
            select(PlaybookClause)
            .where(PlaybookClause.playbook_id == request.playbook_id)
            .order_by(PlaybookClause.id)
        ).all()

    rewrites = []
    for clause in clauses:
        for field_name in REWRITABLE_FIELDS:
            original = getattr(clause, field_name) or ""
            if not original.strip():
                continue
            proposal = await rewrite_playbook_text(
                text=original,
                field_name=field_name,
                mode=request.mode,
                clause_name=clause.clause_name,
            )
            rewrites.append(RewriteCellResponse(
                playbook_id=request.playbook_id,
                clause_id=clause.clause_id,
                field_name=field_name,
                mode=request.mode,
                original=original,
                rewritten=proposal["rewritten"],
                meaning_preservation_note=proposal["meaning_preservation_note"],
            ))

    return RewritePlaybookResponse(
        playbook_id=request.playbook_id,
        mode=request.mode,
        rewrites=rewrites,
    )


def _get_clause(playbook_id: str, clause_id: str) -> PlaybookClause:
    with Session(engine) as session:
        clause = session.exec(
            select(PlaybookClause).where(
                PlaybookClause.playbook_id == playbook_id,
                PlaybookClause.clause_id == clause_id,
            )
        ).first()
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found.")
    return clause
