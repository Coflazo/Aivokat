from __future__ import annotations

import json
import os
import re
import shutil
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from backend.core.config import settings
from backend.core.database import engine
from backend.core.schema import (
    BrainEdgeView,
    BrainNodeView,
    ClauseAnalysisStatus,
    MegaBrainEntry,
    Playbook,
    PlaybookApiView,
    PlaybookClause,
    PlaybookClausePatch,
    PlaybookClausePatchResponse,
    PlaybookClauseView,
    PlaybookBrainView,
    PlaybookCommit,
    PlaybookIssue,
    PlaybookIssueView,
    PlaybookStatus,
    PublishPlaybookRequest,
    PublishPlaybookResponse,
    PlaybookUploadResponse,
)
from backend.services.embedder import embed_text
from backend.services.vector_store import upsert_mega_brain_clause

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])

EXPECTED_HEADERS = [
    "Clause #",
    "Clause Name",
    "Why It Matters (Summary)",
    "Preferred Position",
    "Fallback 1",
    "Fallback 2",
    "Red Line",
    "Escalation Trigger",
]

EDITABLE_FIELDS = {
    "clause_name",
    "why_it_matters",
    "preferred_position",
    "fallback_1",
    "fallback_2",
    "red_line",
    "escalation_trigger",
}


@router.post("/upload", response_model=PlaybookUploadResponse)
async def upload_playbook(
    file: UploadFile = File(...),
    owner: str = Form("Peter"),
    name: str = Form("Uploaded Playbook"),
    description: str = Form(""),
) -> PlaybookUploadResponse:
    """Upload a Siemens-style XLSX playbook and create a draft API module."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    suffix = Path(file.filename).suffix.lower()
    if suffix != ".xlsx":
        raise HTTPException(status_code=400, detail="Playbook upload currently accepts .xlsx files only.")

    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = _safe_filename(file.filename)
    dest = os.path.join(settings.upload_dir, safe_name)
    with open(dest, "wb") as handle:
        shutil.copyfileobj(file.file, handle)

    try:
        rows = _parse_playbook_rows(dest)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    now = datetime.utcnow()
    base_playbook_id = _to_slug(name or Path(file.filename).stem)

    with Session(engine) as session:
        playbook_id = _unique_playbook_id(session, base_playbook_id)
        playbook = Playbook(
            playbook_id=playbook_id,
            name=name or Path(file.filename).stem,
            description=description,
            owner=owner,
            status=PlaybookStatus.DRAFT,
            version=1,
            source_filename=safe_name,
            created_at=now,
            updated_at=now,
        )
        session.add(playbook)

        for row in rows:
            session.add(PlaybookClause(playbook_id=playbook_id, **row))

        session.commit()

    return PlaybookUploadResponse(
        playbook=_load_playbook_view(playbook_id),
        clauses_created=len(rows),
    )


@router.get("/{playbook_id}", response_model=PlaybookApiView)
async def get_playbook(playbook_id: str) -> PlaybookApiView:
    return _load_playbook_view(playbook_id)


@router.get("/{playbook_id}/brain", response_model=PlaybookBrainView)
async def get_playbook_brain(playbook_id: str) -> PlaybookBrainView:
    return _build_playbook_brain(playbook_id)


@router.post("/{playbook_id}/publish", response_model=PublishPlaybookResponse)
async def publish_playbook(playbook_id: str, request: PublishPlaybookRequest) -> PublishPlaybookResponse:
    if not request.committed_by.strip():
        raise HTTPException(status_code=400, detail="Publishing requires a committer name.")
    if not request.comment.strip():
        raise HTTPException(status_code=400, detail="Publishing requires a commit comment.")

    now = datetime.utcnow()
    with Session(engine) as session:
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == playbook_id)).first()
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found.")
        clauses = session.exec(
            select(PlaybookClause)
            .where(PlaybookClause.playbook_id == playbook_id)
            .order_by(PlaybookClause.id)
        ).all()
        if not clauses:
            raise HTTPException(status_code=400, detail="Cannot publish a playbook with no clauses.")

        old_status = playbook.status.value if hasattr(playbook.status, "value") else str(playbook.status)
        playbook.status = PlaybookStatus.PUBLISHED
        playbook.updated_at = now
        playbook.published_at = now
        commit_hash = hashlib.sha1(f"{playbook_id}:{playbook.version}:{request.committed_by}:{request.comment}:{now.isoformat()}".encode()).hexdigest()[:12]
        commit = PlaybookCommit(
            playbook_id=playbook_id,
            version=playbook.version,
            commit_hash=commit_hash,
            comment=request.comment,
            committed_by=request.committed_by,
            committed_at=now,
            diff_json=json.dumps({
                "status": {"old": old_status, "new": PlaybookStatus.PUBLISHED.value},
                "clauses_published": len(clauses),
            }),
        )
        session.add(playbook)
        session.add(commit)

        existing_entries = session.exec(
            select(MegaBrainEntry).where(
                MegaBrainEntry.playbook_id == playbook_id,
                MegaBrainEntry.playbook_version == playbook.version,
            )
        ).all()
        for entry in existing_entries:
            session.delete(entry)

        entries = 0
        for clause in clauses:
            vector_id = upsert_mega_brain_clause(playbook, clause)
            session.add(MegaBrainEntry(
                playbook_id=playbook_id,
                playbook_version=playbook.version,
                topic=clause.clause_name,
                vector_id=vector_id,
                metadata_json=json.dumps({
                    "clause_id": clause.clause_id,
                    "clause_name": clause.clause_name,
                    "status": clause.analysis_status.value if hasattr(clause.analysis_status, "value") else str(clause.analysis_status),
                }),
            ))
            entries += 1
        session.commit()

    return PublishPlaybookResponse(
        playbook=_load_playbook_view(playbook_id),
        commit_hash=commit_hash,
        mega_brain_entries=entries,
    )


@router.patch("/{playbook_id}/clauses/{clause_id}", response_model=PlaybookClausePatchResponse)
async def update_clause(
    playbook_id: str,
    clause_id: str,
    patch: PlaybookClausePatch,
) -> PlaybookClausePatchResponse:
    if patch.field_name not in EDITABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Field is not editable: {patch.field_name}")

    with Session(engine) as session:
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == playbook_id)).first()
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found.")
        if playbook.status != PlaybookStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only draft playbooks can be edited.")

        clause = session.exec(
            select(PlaybookClause).where(
                PlaybookClause.playbook_id == playbook_id,
                PlaybookClause.clause_id == clause_id,
            )
        ).first()
        if not clause:
            raise HTTPException(status_code=404, detail="Clause not found.")

        old_value = getattr(clause, patch.field_name)
        setattr(clause, patch.field_name, patch.value)
        clause.updated_at = datetime.utcnow()
        playbook.updated_at = clause.updated_at

        meta = clause.rewritten_fields_dict()
        history = list(meta.get("_draft_history", []))
        draft_diff = {
            "field_name": patch.field_name,
            "old_value": old_value,
            "new_value": patch.value,
            "edited_by": patch.edited_by,
            "edited_at": clause.updated_at.isoformat(),
        }
        history.append(draft_diff)
        meta["_draft_history"] = history[-25:]
        clause.rewritten_fields = json.dumps(meta)

        session.add(playbook)
        session.add(clause)
        session.commit()

    playbook_view = _load_playbook_view(playbook_id)
    updated = next(item for item in playbook_view.clauses if item.clause_id == clause_id)
    return PlaybookClausePatchResponse(
        playbook=playbook_view,
        updated_clause=updated,
        draft_diff=draft_diff,
    )


def _load_playbook_view(playbook_id: str) -> PlaybookApiView:
    with Session(engine) as session:
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == playbook_id)).first()
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found.")

        clauses = session.exec(
            select(PlaybookClause)
            .where(PlaybookClause.playbook_id == playbook_id)
            .order_by(PlaybookClause.id)
        ).all()
        issues = session.exec(select(PlaybookIssue).where(PlaybookIssue.playbook_id == playbook_id)).all()

    issues_by_clause: dict[str, list[PlaybookIssueView]] = {}
    for issue in issues:
        issues_by_clause.setdefault(issue.clause_id, []).append(_issue_view(issue))

    return PlaybookApiView(
        playbook_id=playbook.playbook_id,
        name=playbook.name,
        description=playbook.description,
        owner=playbook.owner,
        version=playbook.version,
        status=playbook.status,
        source_filename=playbook.source_filename,
        created_at=playbook.created_at.isoformat(),
        updated_at=playbook.updated_at.isoformat(),
        published_at=playbook.published_at.isoformat() if playbook.published_at else None,
        clauses=[_clause_view(clause, issues_by_clause.get(clause.clause_id, [])) for clause in clauses],
    )


def _build_playbook_brain(playbook_id: str) -> PlaybookBrainView:
    view = _load_playbook_view(playbook_id)
    nodes = [
        BrainNodeView(
            id=clause.clause_id,
            label=clause.clause_name,
            status=clause.analysis_status,
            color=_status_color(clause.analysis_status, view.status),
            island_id=view.playbook_id,
            clause=clause,
        )
        for clause in view.clauses
    ]
    edges = _semantic_edges(view.clauses)
    return PlaybookBrainView(
        playbook_id=view.playbook_id,
        version=view.version,
        status=view.status,
        nodes=nodes,
        edges=edges,
    )


def _semantic_edges(clauses: list[PlaybookClauseView], threshold: float = 0.46) -> list[BrainEdgeView]:
    if len(clauses) < 2:
        return []
    texts = [_clause_text(clause) for clause in clauses]
    embeddings = [embed_text(text) for text in texts]
    edges: list[BrainEdgeView] = []
    for left_index, left in enumerate(clauses):
        for right_index in range(left_index + 1, len(clauses)):
            similarity = _dot(embeddings[left_index], embeddings[right_index])
            if similarity >= threshold:
                edges.append(BrainEdgeView(
                    source=left.clause_id,
                    target=clauses[right_index].clause_id,
                    similarity=similarity,
                    relationship="semantic_similarity",
                    edge_scope="island",
                ))
    return edges


def _clause_text(clause: PlaybookClauseView) -> str:
    return "\n".join([
        clause.clause_name,
        clause.why_it_matters,
        clause.preferred_position,
        clause.fallback_1 or "",
        clause.fallback_2 or "",
        clause.red_line or "",
        clause.escalation_trigger or "",
    ])


def _dot(left: list[float], right: list[float]) -> float:
    return float(sum(a * b for a, b in zip(left, right)))


def _status_color(status: ClauseAnalysisStatus, playbook_status: PlaybookStatus) -> str:
    if status == ClauseAnalysisStatus.ISSUE:
        return "#4a2430"
    if status == ClauseAnalysisStatus.WARNING:
        return "#ec6602"
    if playbook_status == PlaybookStatus.PUBLISHED:
        return "#009999"
    return "#2f2a22"


def _clause_view(clause: PlaybookClause, issues: list[PlaybookIssueView]) -> PlaybookClauseView:
    return PlaybookClauseView(
        clause_id=clause.clause_id,
        clause_number=clause.clause_number,
        clause_name=clause.clause_name,
        why_it_matters=clause.why_it_matters,
        preferred_position=clause.preferred_position,
        fallback_1=clause.fallback_1,
        fallback_2=clause.fallback_2,
        red_line=clause.red_line,
        escalation_trigger=clause.escalation_trigger,
        rewritten_fields=clause.rewritten_fields_dict(),
        analysis_status=clause.analysis_status,
        analysis_summary=clause.analysis_summary,
        issues=issues,
    )


def _issue_view(issue: PlaybookIssue) -> PlaybookIssueView:
    return PlaybookIssueView(
        id=issue.id,
        clause_id=issue.clause_id,
        field_name=issue.field_name,
        severity=issue.severity,
        issue_type=issue.issue_type,
        explanation=issue.explanation,
        proposed_fix=issue.proposed_fix,
        accepted=issue.accepted,
        rejected=issue.rejected,
        created_at=issue.created_at.isoformat(),
        resolved_at=issue.resolved_at.isoformat() if issue.resolved_at else None,
    )


def _parse_playbook_rows(path: str) -> list[dict[str, Any]]:
    workbook = openpyxl.load_workbook(path, data_only=True)
    worksheet = workbook.active
    rows = list(worksheet.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Playbook spreadsheet is empty.")

    headers = [str(cell or "").strip() for cell in rows[0][:8]]
    if headers != EXPECTED_HEADERS:
        raise ValueError(f"Unexpected playbook columns. Expected {EXPECTED_HEADERS}, got {headers}.")

    parsed: list[dict[str, Any]] = []
    seen_clause_ids: set[str] = set()
    for row in rows[1:]:
        if not row or not row[1]:
            continue
        clause_name = str(row[1]).strip()
        clause_id = _unique_clause_id(_to_slug(clause_name), seen_clause_ids)
        parsed.append({
            "clause_id": clause_id,
            "clause_number": str(row[0]).strip() if row[0] is not None else "",
            "clause_name": clause_name,
            "why_it_matters": str(row[2]).strip() if row[2] else "",
            "preferred_position": str(row[3]).strip() if row[3] else "",
            "fallback_1": str(row[4]).strip() if row[4] else None,
            "fallback_2": str(row[5]).strip() if row[5] else None,
            "red_line": str(row[6]).strip() if row[6] else None,
            "escalation_trigger": str(row[7]).strip() if row[7] else None,
            "analysis_status": ClauseAnalysisStatus.CLEAN,
        })
    if not parsed:
        raise ValueError("No playbook clauses found in spreadsheet.")
    return parsed


def _unique_playbook_id(session: Session, base: str) -> str:
    candidate = base or "playbook"
    suffix = 2
    while session.exec(select(Playbook).where(Playbook.playbook_id == candidate)).first():
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _unique_clause_id(base: str, seen: set[str]) -> str:
    candidate = base or "clause"
    suffix = 2
    while candidate in seen:
        candidate = f"{base}-{suffix}"
        suffix += 1
    seen.add(candidate)
    return candidate


def _to_slug(value: str) -> str:
    cleaned = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", cleaned)
    return cleaned.strip("-") or "playbook"


def _safe_filename(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_") or "playbook.xlsx"
