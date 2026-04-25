import json
from pathlib import Path
from datetime import datetime
from docx import Document
import pypdf

from backend.core.schema import ProposedCommit, ChangeType, ApprovalStatus
from backend.core.database import get_session
from backend.services.vector_store import search_rules
from backend.services.embedder import embed_text
from backend.services.llm import complete_json, complete

CLAUSE_EXTRACTION_SYSTEM = """You extract individual negotiation clauses from contract documents.
Return ONLY valid JSON."""

CLAUSE_EXTRACTION_USER = """Extract individual negotiation clauses from this contract document.
For each clause, identify: the topic, the exact clause text, and the position it represents.

Return:
{{
  "clauses": [
    {{
      "topic": "what this clause is about",
      "clause_text": "exact text of the clause",
      "implied_position": "what position this clause represents in one sentence"
    }}
  ]
}}

Focus on: liability, IP ownership, confidentiality, payment, termination, warranties, indemnification, dispute resolution, governing law, limitation periods.
Ignore boilerplate (definitions, recitals, signature blocks).

CONTRACT TEXT:
{contract_text}"""

CONFLICT_SYSTEM = """You are a legal analyst. Determine if a contract clause contradicts, confirms, or is neutral with respect to a negotiation playbook rule.
Return ONLY one word: CONTRADICTS, CONFIRMS, or NEUTRAL."""

CONFLICT_USER = """PLAYBOOK RULE (what Siemens wants):
Standard Position: {standard_position}
Red Line (never accept): {red_line}

CONTRACT CLAUSE:
{clause_text}

Does this contract clause CONTRADICT the playbook rule, CONFIRM it, or is it NEUTRAL?"""

REASONING_SYSTEM = """You are Lou, a legal AI assistant. Explain in plain English why a contract clause requires a proposed change to the playbook.
Be concise (2-3 sentences). No legal jargon."""

REASONING_USER = """A contract clause differs from the current playbook rule. Explain why this warrants a playbook update proposal.

Playbook rule: {standard_position}
Contract clause: {clause_text}
Relationship: {relationship}"""


def _extract_docx_text(path: str) -> str:
    doc = Document(path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_pdf_text(path: str) -> str:
    reader = pypdf.PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _classify_similarity(similarity: float, relationship: str) -> ChangeType:
    if similarity >= 0.85:
        if relationship == "CONTRADICTS":
            return ChangeType.CONTRADICTS
        return ChangeType.CONFIRMS
    elif similarity >= 0.50:
        return ChangeType.EXTENDS
    return ChangeType.NEW_RULE


async def process_new_contract(
    file_path: str,
    document_name: str,
    uploaded_by: str,
) -> list[ProposedCommit]:
    suffix = Path(file_path).suffix.lower()
    if suffix in (".docx", ".doc"):
        contract_text = _extract_docx_text(file_path)
    elif suffix == ".pdf":
        contract_text = _extract_pdf_text(file_path)
    else:
        raise ValueError(f"Unsupported contract format: {suffix}")

    # Extract clauses
    max_chars = 10000
    chunk = contract_text[:max_chars]
    result = await complete_json(
        CLAUSE_EXTRACTION_SYSTEM,
        CLAUSE_EXTRACTION_USER.format(contract_text=chunk),
        max_tokens=3000,
    )
    clauses = result.get("clauses", [])

    proposed: list[ProposedCommit] = []

    for clause in clauses:
        topic = clause.get("topic", "")
        clause_text = clause.get("clause_text", "")
        implied_position = clause.get("implied_position", "")

        if not clause_text:
            continue

        # Find the most similar existing rule
        matches = search_rules(f"{topic}: {implied_position}", n_results=1)
        if not matches:
            # No existing rules at all — NEW_RULE
            reasoning = f"No existing playbook rule found for this topic. The contract clause introduces a new position on '{topic}'."
            pc = ProposedCommit(
                rule_id=topic.lower().replace(" ", "_")[:50],
                change_type=ChangeType.NEW_RULE,
                existing_rule_snapshot=None,
                proposed_change=json.dumps({
                    "topic": topic,
                    "implied_position": implied_position,
                    "clause_text": clause_text,
                }),
                source_document=document_name,
                source_clause=clause_text[:1000],
                cosine_similarity=0.0,
                ai_reasoning=reasoning,
                approval_status=ApprovalStatus.PENDING,
                created_at=datetime.utcnow(),
            )
            proposed.append(pc)
            continue

        top_match = matches[0]
        similarity = top_match.get("similarity", 0.0)

        # Determine conflict
        relationship = "NEUTRAL"
        if similarity >= 0.50:
            rel_raw = await complete(
                system_prompt=CONFLICT_SYSTEM,
                user_message=CONFLICT_USER.format(
                    standard_position=top_match["standard_position"],
                    red_line=top_match.get("red_line") or "Not specified",
                    clause_text=clause_text[:500],
                ),
                max_tokens=10,
                temperature=0.0,
            )
            word = rel_raw.strip().upper()
            if word in ("CONTRADICTS", "CONFIRMS", "NEUTRAL"):
                relationship = word

        change_type = _classify_similarity(similarity, relationship)

        # Skip CONFIRMS with high similarity — not interesting enough to propose
        if change_type == ChangeType.CONFIRMS and similarity >= 0.90:
            continue

        reasoning = await complete(
            system_prompt=REASONING_SYSTEM,
            user_message=REASONING_USER.format(
                standard_position=top_match["standard_position"],
                clause_text=clause_text[:500],
                relationship=relationship,
            ),
            max_tokens=200,
        )

        existing_snapshot = json.dumps({
            "rule_id": top_match["rule_id"],
            "topic": top_match["topic"],
            "standard_position": top_match["standard_position"],
            "fallback_position": top_match.get("fallback_position", ""),
            "red_line": top_match.get("red_line", ""),
        })

        proposed_change = json.dumps({
            "rule_id": top_match["rule_id"],
            "topic": top_match["topic"],
            "contract_clause": clause_text,
            "implied_position": implied_position,
            "suggested_update": f"Consider updating based on: {implied_position}",
        })

        pc = ProposedCommit(
            rule_id=top_match["rule_id"],
            change_type=change_type,
            existing_rule_snapshot=existing_snapshot,
            proposed_change=proposed_change,
            source_document=document_name,
            source_clause=clause_text[:1000],
            cosine_similarity=similarity,
            ai_reasoning=reasoning,
            approval_status=ApprovalStatus.PENDING,
            created_at=datetime.utcnow(),
        )
        proposed.append(pc)

    # Save to DB
    session_gen = get_session()
    session = next(session_gen)
    try:
        for pc in proposed:
            session.add(pc)
        session.commit()
        for pc in proposed:
            session.refresh(pc)
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass

    return proposed
