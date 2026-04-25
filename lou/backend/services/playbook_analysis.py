from __future__ import annotations

from dataclasses import dataclass

from backend.core.schema import IssueSeverity, PlaybookClause, PlaybookIssueType


@dataclass(frozen=True)
class IssueCandidate:
    clause_id: str
    field_name: str
    severity: IssueSeverity
    issue_type: PlaybookIssueType
    explanation: str
    proposed_fix: str | None = None


ACCEPTABLE_WORDS = {
    "accept",
    "acceptable",
    "may",
    "can",
    "allow",
    "allowed",
    "permit",
    "permitted",
    "agree",
    "agreed",
}

STRICT_WORDS = {
    "never",
    "must not",
    "will not",
    "refuse",
    "not accept",
    "prohibit",
    "prohibited",
    "only if",
}

PERMISSIVE_WORDS = {
    "unlimited",
    "sole discretion",
    "any",
    "all",
    "without limitation",
    "perpetual",
    "irrevocable",
}

VAGUE_ESCALATION = {
    "if needed",
    "where appropriate",
    "as necessary",
    "case by case",
    "tbd",
    "n/a",
    "ask legal",
    "consult legal",
}


def analyze_clause(clause: PlaybookClause) -> list[IssueCandidate]:
    """Run deterministic hierarchy and clarity checks for one playbook row."""

    issues: list[IssueCandidate] = []
    preferred = _clean(clause.preferred_position)
    fallback_1 = _clean(clause.fallback_1)
    fallback_2 = _clean(clause.fallback_2)
    red_line = _clean(clause.red_line)
    escalation = _clean(clause.escalation_trigger)

    if not preferred:
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="preferred_position",
            severity=IssueSeverity.CRITICAL,
            issue_type=PlaybookIssueType.HIERARCHY_INVERSION,
            explanation="The clause has no preferred position, so the API cannot tell users what the default Siemens position is.",
            proposed_fix="State the default position Siemens wants before any fallback is considered.",
        ))

    if not red_line:
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="red_line",
            severity=IssueSeverity.WARNING,
            issue_type=PlaybookIssueType.VAGUE_RED_LINE,
            explanation="The clause has no red line. Users cannot see the boundary that should never be crossed.",
            proposed_fix="Add a concrete red line that states what Siemens will not accept.",
        ))

    if not escalation:
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="escalation_trigger",
            severity=IssueSeverity.WARNING,
            issue_type=PlaybookIssueType.MISSING_ESCALATION,
            explanation="The clause has no escalation trigger. Users need to know when senior legal must review the position.",
            proposed_fix="Add a specific condition that triggers senior legal review.",
        ))

    duplicate_pairs = [
        ("fallback_1", fallback_1, "preferred_position", preferred),
        ("fallback_2", fallback_2, "fallback_1", fallback_1),
        ("red_line", red_line, "fallback_1", fallback_1),
        ("red_line", red_line, "fallback_2", fallback_2),
    ]
    for left_name, left, right_name, right in duplicate_pairs:
        if left and right and left == right:
            issues.append(IssueCandidate(
                clause_id=clause.clause_id,
                field_name=left_name,
                severity=IssueSeverity.WARNING,
                issue_type=PlaybookIssueType.DUPLICATE_POSITION,
                explanation=f"{_label(left_name)} is identical to {_label(right_name)}, so the hierarchy does not show a real negotiation step.",
                proposed_fix=f"Rewrite {_label(left_name).lower()} so it is a distinct position in the hierarchy.",
            ))

    if red_line and _contains_any(red_line, ACCEPTABLE_WORDS) and not _contains_any(red_line, STRICT_WORDS):
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="red_line",
            severity=IssueSeverity.CRITICAL,
            issue_type=PlaybookIssueType.RED_LINE_TOO_SOFT,
            explanation="The red line is phrased like something negotiable or acceptable.",
            proposed_fix=_make_red_line_stricter(clause.red_line or ""),
        ))

    if escalation and (_clean(escalation) in VAGUE_ESCALATION or len(escalation) < 14):
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="escalation_trigger",
            severity=IssueSeverity.WARNING,
            issue_type=PlaybookIssueType.MISSING_ESCALATION,
            explanation="The escalation trigger is too vague to drive a repeatable workflow.",
            proposed_fix="Escalate to senior legal when the counterparty rejects the preferred position and asks for a fallback that increases legal or commercial risk.",
        ))

    if fallback_1 and red_line and _appears_strict(fallback_1) and not _appears_strict(red_line):
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="fallback_1",
            severity=IssueSeverity.WARNING,
            issue_type=PlaybookIssueType.FALLBACK_TOO_STRICT,
            explanation="Fallback 1 appears stricter than the red line, which reverses the hierarchy.",
            proposed_fix="Move the strict boundary into the red line and keep Fallback 1 as a negotiable concession.",
        ))

    if fallback_2 and red_line and _appears_strict(fallback_2) and not _appears_strict(red_line):
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="fallback_2",
            severity=IssueSeverity.WARNING,
            issue_type=PlaybookIssueType.FALLBACK_TOO_STRICT,
            explanation="Fallback 2 appears stricter than the red line, which makes the final fallback harder than the non-negotiable boundary.",
            proposed_fix="Clarify Fallback 2 as the last acceptable concession and reserve the strict prohibition for the red line.",
        ))

    if preferred and fallback_1 and _appears_more_permissive(preferred, fallback_1):
        issues.append(IssueCandidate(
            clause_id=clause.clause_id,
            field_name="preferred_position",
            severity=IssueSeverity.WARNING,
            issue_type=PlaybookIssueType.HIERARCHY_INVERSION,
            explanation="The preferred position appears more permissive than Fallback 1. The preferred position should be the position Siemens wants first.",
            proposed_fix="Make the preferred position stricter than Fallback 1, or swap the preferred and fallback text.",
        ))

    return _dedupe(issues)


def _clean(value: str | None) -> str:
    return " ".join((value or "").lower().split())


def _contains_any(value: str, words: set[str]) -> bool:
    return any(word in value for word in words)


def _appears_strict(value: str) -> bool:
    return _contains_any(value, STRICT_WORDS)


def _appears_more_permissive(left: str, right: str) -> bool:
    return _contains_any(left, PERMISSIVE_WORDS) and not _contains_any(right, PERMISSIVE_WORDS)


def _make_red_line_stricter(value: str) -> str:
    text = value.strip()
    if not text:
        return "Never accept this position without senior legal approval."
    if text.lower().startswith(("never", "do not", "must not", "will not")):
        return text
    return f"Never accept: {text}"


def _label(field_name: str) -> str:
    return field_name.replace("_", " ").title()


def _dedupe(issues: list[IssueCandidate]) -> list[IssueCandidate]:
    seen: set[tuple[str, str, PlaybookIssueType]] = set()
    output: list[IssueCandidate] = []
    for issue in issues:
        key = (issue.clause_id, issue.field_name, issue.issue_type)
        if key in seen:
            continue
        seen.add(key)
        output.append(issue)
    return output
