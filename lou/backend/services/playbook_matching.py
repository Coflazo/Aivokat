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
    "return": {"return", "destruction", "destroy", "copies", "backup"},
    "solicitation": {"solicitation", "solicit", "poaching", "recruitment", "hire"},
    "exceptions": {"exceptions", "exclusions", "carve-out", "public", "domain", "known"},
}

# Use LLM judge only in the ambiguous band to save tokens.
_LLM_LOW_THRESHOLD = 0.30
_LLM_HIGH_THRESHOLD = 0.72


async def match_clause_to_playbook(
    clause_text: str,
    heading: str | None,
    playbook_clauses: list[PlaybookClauseView],
    use_llm: bool = True,
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

    final, dense, lexical, alias, structural, best_clause = max(scored, key=lambda item: item[0])
    classification = _classify_position(clause_text, best_clause)
    position = _position_label(classification)

    base_result = MatchClauseResponse(
        matched_clause=best_clause,
        matched_hierarchy_position=position,
        classification=classification,
        explanation=_explanation(clause_text, best_clause, classification, final),
        score_breakdown=ScoreBreakdown(
            dense_embedding_score=round(max(0.0, dense), 4),
            lexical_score=round(lexical, 4),
            topic_alias_score=round(alias, 4),
            structural_score=round(structural, 4),
            final_score=round(final, 4),
        ),
        needs_lawyer_review=final < _LLM_HIGH_THRESHOLD,
        recommended_action=_default_action(classification, final),
    )

    if not use_llm or final < _LLM_LOW_THRESHOLD or final >= _LLM_HIGH_THRESHOLD:
        return base_result

    return await _apply_llm_judge(clause_text, best_clause, base_result, final)


async def _apply_llm_judge(
    clause_text: str,
    clause: PlaybookClauseView,
    base: MatchClauseResponse,
    score: float,
) -> MatchClauseResponse:
    from backend.services.llm import complete_json

    system_prompt = (
        "You are a legal AI assistant specializing in contract review. "
        "Given a contract clause and a matched playbook rule, determine the clause's compliance position. "
        "Respond ONLY with valid JSON matching the schema below.\n\n"
        "JSON schema:\n"
        "{\n"
        '  "position": "preferred | fallback_1 | fallback_2 | red_line | escalation | unmapped",\n'
        '  "confidence": 0.0-1.0,\n'
        '  "reason": "one paragraph legal explanation",\n'
        '  "recommended_action": "what Siemens negotiator should do next",\n'
        '  "needs_lawyer_review": true | false\n'
        "}"
    )

    clause_context = (
        f"Playbook rule: {clause.clause_name}\n"
        f"Preferred position: {clause.preferred_position}\n"
        f"Fallback 1: {clause.fallback_1 or 'not specified'}\n"
        f"Fallback 2: {clause.fallback_2 or 'not specified'}\n"
        f"Red line (must not cross): {clause.red_line or 'not specified'}\n"
        f"Escalation trigger: {clause.escalation_trigger or 'not specified'}\n\n"
        f"Contract clause to classify:\n{clause_text}"
    )

    try:
        result = await complete_json(
            system_prompt=system_prompt,
            user_message=clause_context,
            max_tokens=500,
        )
        llm_position = result.get("position", base.classification)
        llm_reason = result.get("reason", base.explanation)
        llm_action = result.get("recommended_action", base.recommended_action)
        llm_review = bool(result.get("needs_lawyer_review", base.needs_lawyer_review))
        llm_confidence = float(result.get("confidence", score))

        final_score = round((score + llm_confidence) / 2, 4)

        return MatchClauseResponse(
            matched_clause=base.matched_clause,
            matched_hierarchy_position=_position_label(llm_position),
            classification=llm_position,
            explanation=llm_reason,
            score_breakdown=ScoreBreakdown(
                dense_embedding_score=base.score_breakdown.dense_embedding_score,
                lexical_score=base.score_breakdown.lexical_score,
                topic_alias_score=base.score_breakdown.topic_alias_score,
                structural_score=base.score_breakdown.structural_score,
                final_score=final_score,
            ),
            recommended_action=llm_action,
            needs_lawyer_review=llm_review,
        )
    except Exception:
        return base


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


def _default_action(classification: str, score: float) -> str:
    if score < _LLM_LOW_THRESHOLD:
        return "Contract clause could not be mapped. Flag for lawyer review to identify the relevant playbook rule."
    actions = {
        "preferred": "Accept — this clause aligns with Siemens' preferred position.",
        "fallback_1": "Negotiate — this clause matches Fallback 1, which is acceptable under pressure.",
        "fallback_2": "Escalate to team lead — this clause requires Fallback 2, which is a significant concession.",
        "red_line": "Reject — this clause crosses the red line. Escalate to senior legal immediately.",
        "escalation": "Escalate — this clause triggers the escalation condition. Senior legal must approve.",
        "unmapped": "Review manually — no playbook rule covers this clause. Consider adding a new playbook rule.",
    }
    return actions.get(classification, "Review and decide.")


def _explanation(text: str, clause: PlaybookClauseView, classification: str, score: float) -> str:
    return (
        f"Matched to '{clause.clause_name}' (score: {score:.2f}). "
        f"Position classification: {classification}. "
        f"The clause text overlaps with the playbook topic and its structured positions."
    )
