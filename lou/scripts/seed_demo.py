#!/usr/bin/env python3
"""Seed Lou with the Siemens sample documents.

Run from the lou directory:
    python scripts/seed_demo.py
"""

import asyncio
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.chdir(Path(__file__).resolve().parent.parent / "backend")

from sqlmodel import Session, select

from backend.core.database import create_db_and_tables, engine
from backend.core.schema import ApprovalStatus, ChangeType, Commit, ProposedCommit, Rule
from backend.services.evolution import process_new_contract
from backend.services.parser import enrich_rules_with_word_doc, parse_excel_playbook
from backend.services.vector_store import add_rule


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SIEMENS_DOCS = PROJECT_ROOT.parent / "Siemens Sample Documents"
PLAYBOOK_XLSX = SIEMENS_DOCS / "Sample NDA Playbook.csv.xlsx"
PLAYBOOK_DOCX = SIEMENS_DOCS / "Sample NDA Playbook.docx"
STANDARD_NDA = SIEMENS_DOCS / "Sample Standard NDA.docx"
A_SERIES = sorted((SIEMENS_DOCS / "Sample NDAs" / "Standard NDAs negotiated").glob("*.docx"))
B_SERIES = sorted((SIEMENS_DOCS / "Sample NDAs" / "Customer NDAs").glob("*.docx"))
LAWYER = "Seed"


def make_hash(rule_id: str, label: str) -> str:
    return hashlib.sha1(f"{rule_id}:{label}".encode()).hexdigest()[:12]


def assert_files_exist() -> None:
    missing = [path for path in [PLAYBOOK_XLSX, PLAYBOOK_DOCX, STANDARD_NDA] if not path.exists()]
    if missing:
        for path in missing:
            print(f"Missing: {path}")
        raise SystemExit(1)
    print(f"Found Siemens documents. A-series: {len(A_SERIES)}, B-series: {len(B_SERIES)}")


def seed_playbook() -> int:
    raw_rules = parse_excel_playbook(PLAYBOOK_XLSX)
    rules = enrich_rules_with_word_doc(raw_rules, PLAYBOOK_DOCX)
    created = 0

    with Session(engine) as session:
        for item in rules:
            existing = session.exec(select(Rule).where(Rule.rule_id == item["rule_id"])).first()
            if existing:
                print(f"SKIP exists: {item['rule_id']}")
                continue

            rule = Rule(
                rule_id=item["rule_id"],
                topic=item["topic"],
                category=item.get("category", "Other"),
                rule_type=item.get("rule_type", "standard"),
                standard_position=item["standard_position"],
                fallback_position=item.get("fallback_position"),
                red_line=item.get("red_line"),
                reasoning=item.get("reasoning", ""),
                suggested_language=item.get("suggested_language"),
                decision_logic=item.get("decision_logic"),
                sources=json.dumps([PLAYBOOK_XLSX.name, PLAYBOOK_DOCX.name]),
                confidence=1.0,
                version=1,
                committed_by=LAWYER,
                committed_at=datetime.utcnow(),
                is_active=True,
            )
            session.add(rule)
            session.flush()
            add_rule(rule)

            commit = Commit(
                commit_hash=make_hash(rule.rule_id, "initial"),
                rule_id=rule.rule_id,
                topic=rule.topic,
                change_type=ChangeType.INITIAL,
                old_value=None,
                new_value=json.dumps(item),
                source_document=PLAYBOOK_XLSX.name,
                committed_by=LAWYER,
                committed_at=rule.committed_at,
                approval_status=ApprovalStatus.APPROVED,
            )
            session.add(commit)
            created += 1
            print(f"Created rule: {rule.rule_id}")

        session.commit()

    print(f"Parsed {len(raw_rules)} rules from Excel without an LLM call.")
    return created


async def process_contract(path: Path) -> int:
    proposed = await process_new_contract(str(path), path.name, LAWYER)
    counts: dict[str, int] = {}
    for item in proposed:
        key = item.change_type.value if hasattr(item.change_type, "value") else str(item.change_type)
        counts[key] = counts.get(key, 0) + 1
    summary = ", ".join(f"{count} {kind}" for kind, count in sorted(counts.items())) or "0 new"
    print(f"{path.name}: {len(proposed)} proposed commits ({summary})")
    return len(proposed)


async def main() -> None:
    print("Lou demo seed")
    print("=" * 50)
    assert_files_exist()
    create_db_and_tables()

    created = seed_playbook()
    print(f"Rules created this run: {created}")

    total = 0
    for path in [STANDARD_NDA, *A_SERIES, *B_SERIES]:
        total += await process_contract(path)

    with Session(engine) as session:
        active_rules = len(session.exec(select(Rule).where(Rule.is_active == True)).all())
        pending = len(session.exec(
            select(ProposedCommit).where(ProposedCommit.approval_status == ApprovalStatus.PENDING)
        ).all())

    print("=" * 50)
    print(f"Rules in playbook: {active_rules}")
    print(f"New proposed commits this run: {total}")
    print(f"Pending proposed commits: {pending}")


if __name__ == "__main__":
    asyncio.run(main())
