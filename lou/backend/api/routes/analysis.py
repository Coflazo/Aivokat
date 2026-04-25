from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from backend.core.database import engine
from backend.core.schema import (
    ClauseAnalysisStatus,
    Playbook,
    PlaybookApiView,
    PlaybookClause,
    PlaybookIssue,
)
from backend.api.routes.playbooks import _load_playbook_view
from backend.services.playbook_analysis import analyze_clause

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

FIXABLE_FIELDS = {
    "clause_name",
    "why_it_matters",
    "preferred_position",
    "fallback_1",
    "fallback_2",
    "red_line",
    "escalation_trigger",
}


@router.post("/playbook/{playbook_id}", response_model=PlaybookApiView)
async def analyze_playbook(playbook_id: str) -> PlaybookApiView:
    """Run deterministic hierarchy checks and store proposed issues.

    Analysis never mutates legal clause text. It only writes PlaybookIssue rows
    and analysis status flags so the lawyer can review proposed fixes.
    """

    with Session(engine) as session:
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == playbook_id)).first()
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found.")

        clauses = session.exec(
            select(PlaybookClause)
            .where(PlaybookClause.playbook_id == playbook_id)
            .order_by(PlaybookClause.id)
        ).all()

        existing_open = session.exec(
            select(PlaybookIssue).where(
                PlaybookIssue.playbook_id == playbook_id,
                PlaybookIssue.resolved_at == None,  # noqa: E711
            )
        ).all()
        for issue in existing_open:
            session.delete(issue)

        for clause in clauses:
            candidates = analyze_clause(clause)
            critical_count = 0
            warning_count = 0
            for candidate in candidates:
                if candidate.severity.value == "critical":
                    critical_count += 1
                elif candidate.severity.value == "warning":
                    warning_count += 1
                session.add(PlaybookIssue(
                    playbook_id=playbook_id,
                    clause_id=candidate.clause_id,
                    field_name=candidate.field_name,
                    severity=candidate.severity,
                    issue_type=candidate.issue_type,
                    explanation=candidate.explanation,
                    proposed_fix=candidate.proposed_fix,
                ))

            if critical_count:
                clause.analysis_status = ClauseAnalysisStatus.ISSUE
                clause.analysis_summary = f"{critical_count} critical issue(s), {warning_count} warning(s)."
            elif warning_count:
                clause.analysis_status = ClauseAnalysisStatus.WARNING
                clause.analysis_summary = f"{warning_count} warning(s)."
            else:
                clause.analysis_status = ClauseAnalysisStatus.CLEAN
                clause.analysis_summary = "No hierarchy issues detected."
            session.add(clause)

        playbook.updated_at = datetime.utcnow()
        session.add(playbook)
        session.commit()

    return _load_playbook_view(playbook_id)


@router.post("/issues/{issue_id}/accept-fix", response_model=PlaybookApiView)
async def accept_issue_fix(issue_id: int) -> PlaybookApiView:
    """Apply one proposed fix after explicit lawyer acceptance."""

    with Session(engine) as session:
        issue = session.get(PlaybookIssue, issue_id)
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found.")
        if issue.resolved_at:
            raise HTTPException(status_code=400, detail="Issue has already been resolved.")
        if issue.field_name not in FIXABLE_FIELDS:
            raise HTTPException(status_code=400, detail=f"Field cannot be fixed automatically: {issue.field_name}")
        if not issue.proposed_fix:
            raise HTTPException(status_code=400, detail="Issue has no proposed fix to apply.")

        playbook_id = issue.playbook_id
        clause = session.exec(
            select(PlaybookClause).where(
                PlaybookClause.playbook_id == playbook_id,
                PlaybookClause.clause_id == issue.clause_id,
            )
        ).first()
        if not clause:
            raise HTTPException(status_code=404, detail="Clause not found.")

        setattr(clause, issue.field_name, issue.proposed_fix)
        clause.updated_at = datetime.utcnow()
        issue.accepted = True
        issue.resolved_at = clause.updated_at

        _refresh_clause_status(session, clause)
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == playbook_id)).first()
        if playbook:
            playbook.updated_at = clause.updated_at
            session.add(playbook)
        session.add(issue)
        session.add(clause)
        session.commit()

    return _load_playbook_view(playbook_id)


@router.post("/issues/{issue_id}/reject", response_model=PlaybookApiView)
async def reject_issue(issue_id: int) -> PlaybookApiView:
    with Session(engine) as session:
        issue = session.get(PlaybookIssue, issue_id)
        if not issue:
            raise HTTPException(status_code=404, detail="Issue not found.")
        if issue.resolved_at:
            raise HTTPException(status_code=400, detail="Issue has already been resolved.")

        playbook_id = issue.playbook_id
        issue.rejected = True
        issue.resolved_at = datetime.utcnow()
        clause = session.exec(
            select(PlaybookClause).where(
                PlaybookClause.playbook_id == playbook_id,
                PlaybookClause.clause_id == issue.clause_id,
            )
        ).first()
        if clause:
            _refresh_clause_status(session, clause)
            session.add(clause)
        playbook = session.exec(select(Playbook).where(Playbook.playbook_id == playbook_id)).first()
        if playbook:
            playbook.updated_at = issue.resolved_at
            session.add(playbook)
        session.add(issue)
        session.commit()

    return _load_playbook_view(playbook_id)


def _refresh_clause_status(session: Session, clause: PlaybookClause) -> None:
    open_issues = session.exec(
        select(PlaybookIssue).where(
            PlaybookIssue.playbook_id == clause.playbook_id,
            PlaybookIssue.clause_id == clause.clause_id,
            PlaybookIssue.resolved_at == None,  # noqa: E711
        )
    ).all()
    if any(issue.severity.value == "critical" for issue in open_issues):
        clause.analysis_status = ClauseAnalysisStatus.ISSUE
        clause.analysis_summary = "Critical issue remains unresolved."
    elif open_issues:
        clause.analysis_status = ClauseAnalysisStatus.WARNING
        clause.analysis_summary = f"{len(open_issues)} warning(s) remain unresolved."
    else:
        clause.analysis_status = ClauseAnalysisStatus.CLEAN
        clause.analysis_summary = "No open hierarchy issues."
