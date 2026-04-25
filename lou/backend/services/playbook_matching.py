from __future__ import annotations

import math
import re
from collections import Counter

from backend.core.schema import (
    MatchClauseResponse,
    PlaybookClauseView,
    ScoreBreakdown,
)
from backend.services.embedder import embed_text


TOPIC_ALIASES: dict[str, set[str]] = {
    "liability": {"liability", "damages", "loss", "unlimited", "cap", "indirect"},
    "confidential": {"confidential", "confidentiality", "disclosure", "recipient", "information"},
    "ip": {"ip", "intellectual", "property", "ownership", "know-how", "rights"},
    "law": {"law", "governing", "jurisdiction", "dispute", "arbitration", "language"},
    "term": {"term", "duration", "period", "survive", "survival"},
    "penalty": {"penalty", "liquidated", "contractual", "fine"},
    "signature": {"signature", "authority", "signatory", "execution"},
}


def match_clause_to_playbook(
    clause_text: str,
    heading: str | None,
    playbook_clauses: list[PlaybookClauseView],
) -> MatchClauseResponse | None:
    if not playbook_clauses:
        return None

    query_text = f"{heading or ''}\n{clause_text}".strip()
    query_embedding = embed_text(query_text)
    scored = []
    for clause in playbook_clauses:
        dense = _dot(query_embedding, embed_text(_clause_text(clause)))
        lexical = _lexical_score(query_text, _clause_text(clause))
        alias = _topic_alias_score(query_text, clause.clause_name)
        structural = _structural_score(heading, clause.clause_name)
        final = 0.50 * dense + 0.25 * lexical + 0.15 * alias + 0.10 * structural
        scored.append((final, dense, lexical, alias, structural, clause))

    final, dense, lexical, alias, structural, clause = max(scored, key=lambda item: item[0])
    classification = _classify_position(clause_text, clause)
    position = _position_label(classification)
    return MatchClauseResponse(
        matched_clause=clause,
        matched_hierarchy_position=position,
        classification=classification,
        explanation=_explanation(clause_text, clause, classification, final),
        score_breakdown=ScoreBreakdown(
            dense_embedding_score=round(max(0.0, dense), 4),
            lexical_score=round(lexical, 4),
            topic_alias_score=round(alias, 4),
            structural_score=round(structural, 4),
            final_score=round(final, 4),
        ),
    )


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


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _lexical_score(left: str, right: str) -> float:
    left_counts = Counter(_tokens(left))
    right_counts = Counter(_tokens(right))
    if not left_counts or not right_counts:
        return 0.0
    common = set(left_counts) & set(right_counts)
    dot = sum(left_counts[t] * right_counts[t] for t in common)
    left_norm = math.sqrt(sum(v * v for v in left_counts.values()))
    right_norm = math.sqrt(sum(v * v for v in right_counts.values()))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


def _topic_alias_score(text: str, topic: str) -> float:
    query_tokens = set(_tokens(text))
    topic_tokens = set(_tokens(topic))
    best = 0.0
    for aliases in TOPIC_ALIASES.values():
        if not topic_tokens & aliases:
            continue
        overlap = len(query_tokens & aliases)
        if overlap:
            best = max(best, min(1.0, overlap / 3))
    return best


def _structural_score(heading: str | None, topic: str) -> float:
    if not heading:
        return 0.0
    return _lexical_score(heading, topic)


def _classify_position(text: str, clause: PlaybookClauseView) -> str:
    candidates = [
        ("preferred", clause.preferred_position),
        ("fallback_1", clause.fallback_1 or ""),
        ("fallback_2", clause.fallback_2 or ""),
        ("red_line", clause.red_line or ""),
        ("escalation", clause.escalation_trigger or ""),
    ]
    scored = [(_lexical_score(text, candidate_text), label) for label, candidate_text in candidates if candidate_text]
    if not scored:
        return "unmapped"
    score, label = max(scored, key=lambda item: item[0])
    lowered = text.lower()
    if "unlimited" in lowered and (clause.red_line or "").lower():
        return "red_line"
    if any(word in lowered for word in ["escalate", "senior legal", "approval required"]):
        return "escalation"
    return label if score >= 0.08 else "unmapped"


def _position_label(classification: str) -> str:
    return {
        "preferred": "Preferred position",
        "fallback_1": "Fallback 1",
        "fallback_2": "Fallback 2",
        "red_line": "Red line",
        "escalation": "Escalation trigger",
        "unmapped": "Unmapped",
    }.get(classification, classification)


def _explanation(text: str, clause: PlaybookClauseView, classification: str, score: float) -> str:
    return (
        f"Matched to '{clause.clause_name}' because the clause text overlaps with that playbook topic "
        f"and its structured positions. Classification: {classification}. Final score: {score:.2f}."
    )
