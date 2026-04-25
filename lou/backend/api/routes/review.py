import json
import hashlib
from datetime import datetime
from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select, col

from backend.core.database import engine
from backend.core.schema import (
    ProposedCommit, Commit, Rule,
    ApprovalRequest, ApprovalStatus, ChangeType,
)
from backend.services.vector_store import add_commit, add_rule

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("")
async def list_pending():
    with Session(engine) as session:
        pending = session.exec(
            select(ProposedCommit)
            .where(ProposedCommit.approval_status == ApprovalStatus.PENDING)
            .order_by(col(ProposedCommit.created_at).desc())
        ).all()
    order = {
        ChangeType.CONTRADICTS: 0,
        ChangeType.EXTENDS: 1,
        ChangeType.NEW_RULE: 2,
        ChangeType.CONFIRMS: 3,
    }
    pending = sorted(pending, key=lambda item: order.get(item.change_type, 99))
    return [p.model_dump() for p in pending]


def _commit_hash(rule_id: str, ts: str) -> str:
    return hashlib.sha1(f"{rule_id}:{ts}".encode()).hexdigest()[:12]


@router.post("/{proposed_id}/approve")
async def approve_or_reject(proposed_id: int, body: ApprovalRequest):
    if body.decision not in (ApprovalStatus.APPROVED, ApprovalStatus.REJECTED):
        raise HTTPException(status_code=400, detail="decision must be APPROVED or REJECTED")

    with Session(engine) as session:
        pc = session.get(ProposedCommit, proposed_id)
        if not pc:
            raise HTTPException(status_code=404, detail="Proposed commit not found")
        if pc.approval_status != ApprovalStatus.PENDING:
            raise HTTPException(status_code=409, detail="Already reviewed")

        pc.approval_status = body.decision
        pc.reviewed_by = body.lawyer_name
        pc.reviewed_at = datetime.utcnow()
        pc.lawyer_note = body.lawyer_note

        now_str = pc.reviewed_at.isoformat()

        if body.decision == ApprovalStatus.APPROVED:
            # Apply the change to the playbook
            rule = session.exec(select(Rule).where(Rule.rule_id == pc.rule_id)).first()
            proposed_data = json.loads(pc.proposed_change) if pc.proposed_change else {}

            old_snapshot = None
            if rule:
                old_snapshot = json.dumps({
                    "rule_id": rule.rule_id,
                    "topic": rule.topic,
                    "standard_position": rule.standard_position,
                    "fallback_position": rule.fallback_position,
                    "red_line": rule.red_line,
                })

            if pc.change_type == ChangeType.NEW_RULE and not rule:
                # Create a new rule
                rule = Rule(
                    rule_id=pc.rule_id,
                    topic=proposed_data.get("topic", pc.rule_id),
                    category="Other",
                    rule_type="standard",
                    standard_position=body.proposed_text or proposed_data.get("implied_position", ""),
                    reasoning=pc.ai_reasoning,
                    sources=json.dumps([pc.source_document]),
                    confidence=pc.cosine_similarity,
                    version=1,
                    committed_by=body.lawyer_name,
                    committed_at=pc.reviewed_at,
                    is_active=True,
                )
                session.add(rule)
                session.flush()
                add_rule(rule)
            elif rule:
                # Update existing rule
                implied = proposed_data.get("implied_position", "")
                update_text = body.proposed_text or implied
                if update_text and pc.change_type in (ChangeType.CONTRADICTS, ChangeType.EXTENDS, ChangeType.CONFIRMS):
                    rule.fallback_position = (rule.fallback_position or "") + f"\n[Updated from {pc.source_document}]: {update_text}"
                    rule.version += 1
                    rule.committed_by = body.lawyer_name
                    rule.committed_at = pc.reviewed_at

                    sources = json.loads(rule.sources) if isinstance(rule.sources, str) else rule.sources
                    if pc.source_document not in sources:
                        sources.append(pc.source_document)
                    rule.sources = json.dumps(sources)
                    add_rule(rule)

            new_snapshot = json.dumps(proposed_data)
            commit = Commit(
                commit_hash=_commit_hash(pc.rule_id, now_str),
                rule_id=pc.rule_id,
                topic=pc.topic or (rule.topic if rule else pc.rule_id),
                change_type=pc.change_type,
                old_value=old_snapshot,
                new_value=new_snapshot,
                source_document=pc.source_document,
                source_clause=pc.source_clause[:500] if pc.source_clause else None,
                lawyer_note=body.lawyer_note,
                committed_by=body.lawyer_name,
                committed_at=pc.reviewed_at,
                approval_status=ApprovalStatus.APPROVED,
            )
            session.add(commit)
            session.flush()
            add_commit(commit, commit.topic)
        else:
            # Rejected — just log it
            commit = Commit(
                commit_hash=_commit_hash(pc.rule_id + "_reject", now_str),
                rule_id=pc.rule_id,
                topic=pc.topic or pc.rule_id,
                change_type=pc.change_type,
                old_value=pc.existing_rule_snapshot,
                new_value=json.dumps({"rejected": True, "reason": body.lawyer_note}),
                source_document=pc.source_document,
                lawyer_note=body.lawyer_note,
                committed_by=body.lawyer_name,
                committed_at=pc.reviewed_at,
                approval_status=ApprovalStatus.REJECTED,
            )
            session.add(commit)

        session.commit()
        session.refresh(pc)

    return {"status": pc.approval_status, "commit_hash": commit.commit_hash, "item": pc.model_dump()}
