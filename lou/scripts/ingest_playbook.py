#!/usr/bin/env python3
"""
CLI: python scripts/ingest_playbook.py /path/to/playbook.docx "John Smith"
"""
import sys
import os
import asyncio
import json
import hashlib
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'))

from backend.core.database import create_db_and_tables, engine
from backend.core.schema import Rule, Commit, ChangeType, ApprovalStatus
from backend.services.parser import parse_playbook
from backend.services.vector_store import add_rule
from sqlmodel import Session, select


async def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/ingest_playbook.py <file_path> [lawyer_name]')
        sys.exit(1)

    file_path = sys.argv[1]
    lawyer_name = sys.argv[2] if len(sys.argv) > 2 else 'Anonymous'

    if not os.path.exists(file_path):
        print(f'Error: file not found: {file_path}')
        sys.exit(1)

    create_db_and_tables()
    filename = os.path.basename(file_path)

    print(f'Ingesting {filename} as {lawyer_name}…')
    raw_rules = await parse_playbook(file_path, filename)
    print(f'Extracted {len(raw_rules)} rules')

    created = 0
    with Session(engine) as session:
        for r in raw_rules:
            rule_id = r.get('rule_id', '').strip()
            if not rule_id:
                continue
            if session.exec(select(Rule).where(Rule.rule_id == rule_id)).first():
                print(f'  skip (exists): {rule_id}')
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
                sources=json.dumps([filename]),
                confidence=1.0,
                version=1,
                committed_by=lawyer_name,
                committed_at=datetime.utcnow(),
                is_active=True,
            )
            session.add(rule)
            session.flush()

            now_str = rule.committed_at.isoformat()
            commit_hash = hashlib.sha1(f"{rule_id}:{now_str}".encode()).hexdigest()[:12]
            commit = Commit(
                commit_hash=commit_hash,
                rule_id=rule_id,
                change_type=ChangeType.INITIAL,
                new_value=json.dumps({'rule_id': rule.rule_id, 'topic': rule.topic,
                                       'standard_position': rule.standard_position}),
                source_document=filename,
                committed_by=lawyer_name,
                committed_at=rule.committed_at,
                approval_status=ApprovalStatus.APPROVED,
            )
            session.add(commit)
            add_rule(rule)
            created += 1
            print(f'  ✓ {rule.topic}')

        session.commit()

    print(f'\nDone. {created} rules ingested into Lou.')


if __name__ == '__main__':
    asyncio.run(main())
