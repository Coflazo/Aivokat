#!/usr/bin/env python3
"""
Seed Lou with the Siemens sample documents.
Usage: python scripts/seed_demo.py

Run from the lou/ directory.
"""
import sys
import os
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from backend.core.database import create_db_and_tables, engine
from backend.core.schema import Rule, Commit, ChangeType, ApprovalStatus
from backend.services.parser import parse_playbook
from backend.services.vector_store import add_rule
from backend.services.evolution import process_new_contract
from sqlmodel import Session, select
import hashlib
from datetime import datetime


SIEMENS_DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..',
                             'Siemens Sample Documents')
PLAYBOOK_XLSX = os.path.join(SIEMENS_DOCS, 'Sample NDA Playbook.csv.xlsx')
PLAYBOOK_DOCX = os.path.join(SIEMENS_DOCS, 'Sample NDA Playbook.docx')

NDA_DIR_A = os.path.join(SIEMENS_DOCS, 'Sample NDAs', 'Standard NDAs negotiated')
NDA_DIR_B = os.path.join(SIEMENS_DOCS, 'Sample NDAs', 'Customer NDAs')

LAWYER = 'Dr. Schmidt (Siemens Legal)'


def make_hash(rule_id: str, ts: str) -> str:
    return hashlib.sha1(f"{rule_id}:{ts}".encode()).hexdigest()[:12]


async def ingest_playbook():
    print('\n📘 Ingesting NDA Playbook (Excel)…')
    # Prefer Excel (structured), fallback to Word
    if os.path.exists(PLAYBOOK_XLSX):
        path, name = PLAYBOOK_XLSX, 'Sample NDA Playbook.csv.xlsx'
    elif os.path.exists(PLAYBOOK_DOCX):
        path, name = PLAYBOOK_DOCX, 'Sample NDA Playbook.docx'
    else:
        print('  ⚠  Playbook not found at:', SIEMENS_DOCS)
        return 0

    raw_rules = await parse_playbook(path, name)
    print(f'  Extracted {len(raw_rules)} rules from LLM')

    created = 0
    with Session(engine) as session:
        for r in raw_rules:
            rule_id = r.get('rule_id', '').strip()
            if not rule_id:
                continue
            existing = session.exec(select(Rule).where(Rule.rule_id == rule_id)).first()
            if existing:
                continue

            rule = Rule(
                rule_id=rule_id,
                topic=r.get('topic', rule_id),
                category=r.get('category', 'Other'),
                rule_type=r.get('rule_type', 'standard'),
                standard_position=r.get('standard_position', ''),
                fallback_position=r.get('fallback_position'),
                red_line=r.get('red_line'),
                reasoning=r.get('reasoning', ''),
                suggested_language=r.get('suggested_language'),
                decision_logic=r.get('decision_logic'),
                sources=json.dumps([name]),
                confidence=1.0,
                version=1,
                committed_by=LAWYER,
                committed_at=datetime.utcnow(),
                is_active=True,
            )
            session.add(rule)
            session.flush()

            now_str = rule.committed_at.isoformat()
            commit = Commit(
                commit_hash=make_hash(rule_id, now_str),
                rule_id=rule_id,
                change_type=ChangeType.INITIAL,
                new_value=json.dumps({'rule_id': rule.rule_id, 'topic': rule.topic,
                                       'standard_position': rule.standard_position}),
                source_document=name,
                committed_by=LAWYER,
                committed_at=rule.committed_at,
                approval_status=ApprovalStatus.APPROVED,
            )
            session.add(commit)
            add_rule(rule)
            created += 1
            print(f'    ✓ {rule.topic}')

        session.commit()
    return created


async def process_ndas():
    proposed_total = 0
    for nda_dir in [NDA_DIR_A, NDA_DIR_B]:
        if not os.path.exists(nda_dir):
            continue
        for fname in sorted(os.listdir(nda_dir)):
            if not fname.endswith('.docx'):
                continue
            fpath = os.path.join(nda_dir, fname)
            print(f'\n  📄 Processing {fname}…')
            try:
                proposed = await process_new_contract(fpath, fname, LAWYER)
                print(f'     → {len(proposed)} proposed commits')
                proposed_total += len(proposed)
            except Exception as e:
                print(f'     ⚠  Error: {e}')
    return proposed_total


async def main():
    print('🌱 Lou Demo Seed Script')
    print('=' * 50)
    create_db_and_tables()

    rules_created = await ingest_playbook()
    print(f'\n  Total rules ingested: {rules_created}')

    print('\n📄 Processing negotiated NDAs through evolution pipeline…')
    proposed = await process_ndas()

    print('\n' + '=' * 50)
    print(f'✅ Seed complete!')
    print(f'   Rules in playbook:     {rules_created}')
    print(f'   Proposed commits:      {proposed}')
    print(f'\nOpen http://localhost:5173 to view Lou')
    print('Review Queue will show the proposed changes for lawyer approval.')


if __name__ == '__main__':
    asyncio.run(main())
