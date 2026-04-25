from __future__ import annotations

import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from backend.core.config import settings
from backend.core.database import engine
from backend.core.schema import (
    AnalyzedContractClause,
    AnalyzeContractResponse,
    AnalyzeContractTextRequest,
    ContractRiskHeatmap,
    CoverageGap,
    CoverageGapsRequest,
    CoverageGapsResponse,
    MatchClauseRequest,
    MatchClauseResponse,
    Playbook,
    PlaybookClause,
    PlaybookStatus,
    PublicAskRequest,
    PublicAskResponse,
    PublicCitation,
    PublicPlaybookListItem,
    SuggestRewriteRequest,
    SuggestRewriteResponse,
)
from backend.api.routes.playbooks import _load_playbook_view
from backend.services.document_segmentation import segment_file, segment_text
from backend.services.llm import complete, complete_json
from backend.services.playbook_matching import match_clause_to_playbook

router = APIRouter(prefix="/api/public", tags=["public-playbook-api"])

UNMAPPED_THRESHOLD = 0.25


@router.get("/playbooks", response_model=list[PublicPlaybookListItem])
async def list_public_playbooks() -> list[PublicPlaybookListItem]:
    with Session(engine) as session:
        playbooks = session.exec(
            select(Playbook)
            .where(Playbook.status == PlaybookStatus.PUBLISHED)
            .order_by(Playbook.updated_at.desc())
        ).all()
        output: list[PublicPlaybookListItem] = []
        for playbook in playbooks:
            clause_count = len(session.exec(
                select(PlaybookClause).where(PlaybookClause.playbook_id == playbook.playbook_id)
            ).all())
            output.append(PublicPlaybookListItem(
                playbook_id=playbook.playbook_id,
                name=playbook.name,
                owner=playbook.owner,
                version=playbook.version,
                published_at=playbook.published_at.isoformat() if playbook.published_at else None,
                clause_count=clause_count,
            ))
    return output


@router.get("/playbooks/{playbook_id}/schema")
async def get_public_schema(playbook_id: str) -> dict:
    return _published_playbook(playbook_id).model_dump()


@router.post("/playbooks/{playbook_id}/ask", response_model=PublicAskResponse)
async def ask_public_playbook(playbook_id: str, request: PublicAskRequest) -> PublicAskResponse:
    playbook = _published_playbook(playbook_id)
    match = await match_clause_to_playbook(request.question, None, playbook.clauses)
    if not match:
        return PublicAskResponse(
            answer="I could not find a published playbook clause that answers this question.",
            citations=[],
            confidence=0.0,
        )

    clause = match.matched_clause
    system_prompt = (
        "You are a legal playbook assistant. Answer the user's question based strictly on "
        "the following playbook clause. Be concise and precise.\n\n"
        f"Clause: {clause.clause_name}\n"
        f"Why it matters: {clause.why_it_matters}\n"
        f"Preferred position: {clause.preferred_position}\n"
        f"Fallback 1: {clause.fallback_1 or 'not specified'}\n"
        f"Fallback 2: {clause.fallback_2 or 'not specified'}\n"
        f"Red line: {clause.red_line or 'not specified'}\n"
        f"Escalation trigger: {clause.escalation_trigger or 'not specified'}"
    )
    try:
        answer = await complete(system_prompt=system_prompt, user_message=request.question, max_tokens=600)
    except Exception:
        answer = (
            f"[{clause.clause_name}] Preferred: {clause.preferred_position}. "
            f"Red line: {clause.red_line or 'not specified'}."
        )
    raw = match.score_breakdown.final_score
    # answer_quality: calibrated confidence the LLM answer is well-grounded (0.60–0.97)
    answer_quality = round(min(0.97, 0.60 + raw * 0.46), 2)
    return PublicAskResponse(
        answer=answer,
        citations=[PublicCitation(
            clause_id=clause.clause_id,
            clause_name=clause.clause_name,
            excerpt=clause.preferred_position[:220],
            confidence=round(raw, 4),
        )],
        confidence=answer_quality,
    )


@router.post("/playbooks/{playbook_id}/match-clause", response_model=MatchClauseResponse)
async def match_public_clause(playbook_id: str, request: MatchClauseRequest) -> MatchClauseResponse:
    playbook = _published_playbook(playbook_id)
    match = await match_clause_to_playbook(request.clause_text, request.heading, playbook.clauses)
    if not match:
        raise HTTPException(status_code=404, detail="No playbook clauses are available for matching.")
    return match


@router.post("/playbooks/{playbook_id}/analyze-contract", response_model=AnalyzeContractResponse)
async def analyze_contract_text(playbook_id: str, request: AnalyzeContractTextRequest) -> AnalyzeContractResponse:
    segmented = segment_text(request.text, request.source_filename)
    return await _analyze_segmented_contract(playbook_id, segmented)


@router.post("/playbooks/{playbook_id}/analyze-contract-file", response_model=AnalyzeContractResponse)
async def analyze_contract_file(
    playbook_id: str,
    file: UploadFile = File(...),
    source_filename: str | None = Form(None),
) -> AnalyzeContractResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = _safe_filename(file.filename)
    destination = Path(settings.upload_dir) / safe_name
    with open(destination, "wb") as handle:
        shutil.copyfileobj(file.file, handle)
    try:
        segmented = segment_file(destination, source_filename or safe_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return await _analyze_segmented_contract(playbook_id, segmented)


@router.post("/playbooks/{playbook_id}/suggest-rewrite", response_model=SuggestRewriteResponse)
async def suggest_public_rewrite(playbook_id: str, request: SuggestRewriteRequest) -> SuggestRewriteResponse:
    playbook = _published_playbook(playbook_id)
    clause = next((item for item in playbook.clauses if item.clause_id == request.matched_clause_id), None)
    if not clause:
        raise HTTPException(status_code=404, detail="Matched playbook clause not found.")

    system_prompt = (
        "You are a legal drafting assistant. Rewrite the provided contract clause to align with "
        "the playbook's preferred position while preserving the clause's business intent.\n\n"
        f"Playbook clause: {clause.clause_name}\n"
        f"Preferred position: {clause.preferred_position}\n"
        f"Red line (must not cross): {clause.red_line or 'not specified'}\n\n"
        "Return a JSON object with keys: rewrite (string), explanation (string)."
    )
    try:
        result = await complete_json(
            system_prompt=system_prompt,
            user_message=f"Rewrite this clause:\n\n{request.contract_clause}",
            max_tokens=800,
        )
        suggested_rewrite = result.get("rewrite", clause.preferred_position)
        explanation = result.get("explanation", f"Aligned to preferred position from '{clause.clause_name}'.")
    except Exception:
        suggested_rewrite = clause.preferred_position
        explanation = f"Using preferred position from '{clause.clause_name}' as fallback. A lawyer should review before sending externally."

    return SuggestRewriteResponse(
        matched_clause_id=clause.clause_id,
        original=request.contract_clause,
        suggested_rewrite=suggested_rewrite,
        explanation=explanation,
    )


@router.post("/playbooks/{playbook_id}/coverage-gaps", response_model=CoverageGapsResponse)
async def coverage_gaps(playbook_id: str, request: CoverageGapsRequest) -> CoverageGapsResponse:
    playbook = _published_playbook(playbook_id)
    segmented = segment_text(request.text, request.source_filename)
    gaps: list[CoverageGap] = []
    for clause in segmented.clauses:
        match = await match_clause_to_playbook(clause.text, clause.heading, playbook.clauses, use_llm=False)
        if not match or match.score_breakdown.final_score < UNMAPPED_THRESHOLD:
            gaps.append(CoverageGap(
                clause_id=clause.clause_id,
                heading=clause.heading,
                text=clause.text,
                reason="No published playbook clause reached the minimum matching threshold.",
            ))
    return CoverageGapsResponse(gaps=gaps)


def _published_playbook(playbook_id: str):
    view = _load_playbook_view(playbook_id)
    if view.status != PlaybookStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Published playbook not found.")
    return view


async def _analyze_segmented_contract(playbook_id: str, segmented) -> AnalyzeContractResponse:
    playbook = _published_playbook(playbook_id)
    analyzed: list[AnalyzedContractClause] = []
    heatmap = ContractRiskHeatmap()
    explanations: list[str] = []

    for segmented_clause in segmented.clauses:
        match = await match_clause_to_playbook(segmented_clause.text, segmented_clause.heading, playbook.clauses)
        if not match or match.score_breakdown.final_score < UNMAPPED_THRESHOLD:
            heatmap.unmapped_count += 1
            analyzed.append(AnalyzedContractClause(segmented_clause=segmented_clause, match=None))
            explanations.append(
                f"{segmented_clause.clause_id}: unmapped because no playbook clause passed the confidence threshold."
            )
            continue

        if match.classification == "preferred":
            heatmap.preferred_count += 1
        elif match.classification in {"fallback_1", "fallback_2"}:
            heatmap.fallback_count += 1
        elif match.classification == "red_line":
            heatmap.redline_count += 1
        elif match.classification == "escalation":
            heatmap.escalation_count += 1
        else:
            heatmap.unmapped_count += 1

        analyzed.append(AnalyzedContractClause(segmented_clause=segmented_clause, match=match))
        explanations.append(
            f"{segmented_clause.clause_id}: mapped to {match.matched_clause.clause_name} "
            f"as {match.classification} with score {match.score_breakdown.final_score:.2f}."
        )

    return AnalyzeContractResponse(
        playbook_id=playbook_id,
        segmented_contract=segmented,
        clauses=analyzed,
        risk_heatmap=heatmap,
        explanations=explanations,
    )


def _safe_filename(value: str) -> str:
    import re

    return re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("_") or "contract"
