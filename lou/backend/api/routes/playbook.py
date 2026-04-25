import json
import os
import shutil
import hashlib
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sqlmodel import Session, select

from backend.core.config import settings
from backend.core.database import engine
from backend.core.schema import Rule, Commit, ChangeType, ApprovalStatus, GraphNode
from backend.services.parser import parse_playbook
from backend.services.vector_store import add_rule

router = APIRouter(prefix="/api/playbook", tags=["playbook"])


def _make_commit_hash(rule_id: str, timestamp: str) -> str:
    raw = f"{rule_id}:{timestamp}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


@router.post("/upload")
async def upload_playbook(
    file: UploadFile = File(...),
    lawyer_name: str = Form("Anonymous"),
):
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = file.filename.replace(" ", "_")
    dest = os.path.join(settings.upload_dir, safe_name)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        raw_rules = await parse_playbook(dest, file.filename)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parse error: {e}")

    created_rules: list[GraphNode] = []

    with Session(engine) as session:
        for r in raw_rules:
            rule_id = r.get("rule_id", "").strip()
            if not rule_id:
                continue

            # Check for existing rule
            existing = session.exec(select(Rule).where(Rule.rule_id == rule_id)).first()
            if existing:
                continue

            rule = Rule(
                rule_id=rule_id,
                topic=r.get("topic", rule_id),
                category=r.get("category", "Other"),
                rule_type=r.get("rule_type", "standard"),
                standard_position=r.get("standard_position", ""),
                fallback_position=r.get("fallback_position"),
                red_line=r.get("red_line"),
                reasoning=r.get("reasoning", ""),
                suggested_language=r.get("suggested_language"),
                decision_logic=r.get("decision_logic"),
                sources=json.dumps([safe_name]),
                confidence=1.0,
                version=1,
                committed_by=lawyer_name,
                committed_at=datetime.utcnow(),
                is_active=True,
            )
            session.add(rule)
            session.flush()

            now_str = rule.committed_at.isoformat()
            commit = Commit(
                commit_hash=_make_commit_hash(rule_id, now_str),
                rule_id=rule_id,
                change_type=ChangeType.INITIAL,
                old_value=None,
                new_value=json.dumps({
                    "rule_id": rule.rule_id,
                    "topic": rule.topic,
                    "standard_position": rule.standard_position,
                    "fallback_position": rule.fallback_position,
                    "red_line": rule.red_line,
                }),
                source_document=safe_name,
                committed_by=lawyer_name,
                committed_at=rule.committed_at,
                approval_status=ApprovalStatus.APPROVED,
            )
            session.add(commit)

            add_rule(rule)

            sources_list = json.loads(rule.sources) if isinstance(rule.sources, str) else rule.sources
            created_rules.append(GraphNode(
                id=rule.rule_id,
                label=rule.topic,
                topic=rule.topic,
                category=rule.category,
                rule_type=rule.rule_type,
                confidence=rule.confidence,
                version=rule.version,
                committed_by=rule.committed_by,
                committed_at=rule.committed_at.isoformat(),
                standard_position=rule.standard_position,
                fallback_position=rule.fallback_position,
                red_line=rule.red_line,
                reasoning=rule.reasoning,
                sources=sources_list,
            ))

        session.commit()

    return {"rules_created": len(created_rules), "rules": [r.model_dump() for r in created_rules]}
