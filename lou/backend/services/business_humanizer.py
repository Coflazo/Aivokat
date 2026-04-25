from __future__ import annotations

from backend.core.schema import RewriteMode
from backend.services.llm import complete_json


FIELD_GUARDRAILS: dict[str, str] = {
    "preferred_position": "This is the preferred position. Do not weaken it or make it sound optional.",
    "fallback_1": "This is Fallback 1. Keep it less ideal than the preferred position and more acceptable than Fallback 2.",
    "fallback_2": "This is Fallback 2. Keep it less ideal than Fallback 1 and do not cross the red line.",
    "red_line": "This is the red line. Do not soften it, qualify it away, or make it acceptable.",
    "escalation_trigger": "This is an escalation trigger. Keep the condition clear and actionable.",
    "why_it_matters": "This is business reasoning. Keep it plain, specific, and easy to scan.",
    "clause_name": "This is a short clause label. Keep it concise.",
}

AI_WRITING_PATTERNS = """
Anti-AI writing pass:
- Remove inflated significance language: "serves as", "testament", "pivotal", "crucial", "underscores", "broader landscape".
- Remove promotional wording: "vibrant", "profound", "groundbreaking", "showcasing", "commitment to", "seamless".
- Remove superficial -ing phrases that add fake depth: "highlighting", "ensuring", "reflecting", "contributing to".
- Replace vague attribution with concrete wording, or remove it if no source is present.
- Avoid "not only X but Y", "not just X, it is Y", and tailing fragments like "no guessing".
- Avoid forced rule-of-three phrasing.
- Avoid synonym cycling. Repeat the precise legal term when that is clearer.
- Prefer simple "is", "are", and "has" over "serves as", "stands as", "boasts", or "features" when legally accurate.
- Avoid em dashes, emojis, boldface-style emphasis, title-case headings, and curly quotes.
- Remove chatbot artifacts: "of course", "certainly", "great question", "I hope this helps", "let me know".
- Remove knowledge-cutoff disclaimers, generic positive conclusions, excessive hedging, and filler phrases.
- Use varied sentence rhythm, but keep legal playbook language professional and controlled.
- Do not add personality that would make legal guidance casual, emotional, or less authoritative.
"""


async def rewrite_playbook_text(
    text: str,
    field_name: str,
    mode: RewriteMode = RewriteMode.BUSINESS_CLEAR,
    clause_name: str | None = None,
) -> dict[str, str]:
    """Rewrite legal playbook text without changing legal meaning.

    The model returns a proposal only. Callers must require lawyer acceptance
    before applying it to any playbook field.
    """

    if not text.strip():
        return {
            "rewritten": text,
            "meaning_preservation_note": "No rewrite proposed because the original field is empty.",
        }

    result = await complete_json(
        system_prompt=_system_prompt(mode, field_name),
        user_message="\n".join([
            f"CLAUSE NAME: {clause_name or 'Unknown'}",
            f"FIELD: {field_name}",
            f"MODE: {mode.value}",
            "ORIGINAL TEXT:",
            text,
        ]),
        max_tokens=900,
    )

    rewritten = str(result.get("rewritten", "")).strip()
    note = str(result.get("meaning_preservation_note", "")).strip()
    if not rewritten:
        rewritten = text
        note = "No safe rewrite was returned, so the original text is preserved."
    if not note:
        note = "Meaning preserved; wording made clearer without changing the legal position."

    return {
        "rewritten": rewritten,
        "meaning_preservation_note": note,
    }


def _system_prompt(mode: RewriteMode, field_name: str) -> str:
    mode_instruction = {
        RewriteMode.BUSINESS_CLEAR: "Make the text clearer for business users while preserving legal meaning.",
        RewriteMode.LEGAL_PRECISE: "Make the text legally precise, concise, and unambiguous.",
        RewriteMode.SHORTER: "Shorten the text without losing any legal condition, limit, or escalation trigger.",
        RewriteMode.HUMANIZED: "Remove generic AI phrasing and make the text sound like careful human legal guidance.",
    }[mode]

    return f"""You are Lou's legal/business playbook rewriting service.
Return only valid JSON with:
{{
  "rewritten": "...",
  "meaning_preservation_note": "..."
}}

Task:
{mode_instruction}

Field-specific guardrail:
{FIELD_GUARDRAILS.get(field_name, "Preserve the field's legal function.")}

Non-negotiable rules:
- Preserve legal meaning.
- Do not invent rights, obligations, exceptions, amounts, time periods, approvals, or thresholds.
- Do not weaken red lines.
- Do not turn fallback language into preferred language.
- Do not remove escalation triggers.
- Keep legal terms where needed.
- Prefer specific language over general language.
- Prefer active voice over passive voice where it remains legally accurate.
- Write to express, not impress.
- Be articulate, not flowery.
- Keep the result fact-based and easy to scan quickly.
- Avoid generic AI phrasing, inflated importance, promotional wording, vague attribution, and filler.
- AI is an editing aid, not the author. If a safe rewrite is not possible, return the original text.

{AI_WRITING_PATTERNS}

Final review before returning JSON:
1. Ask internally: "What makes this sound obviously AI generated?"
2. Remove those tells.
3. Return only the final rewrite and a short note explaining how meaning was preserved.
"""
