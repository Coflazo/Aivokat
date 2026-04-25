import json
from backend.core.schema import ChatMessage, ChatResponse
from backend.services.vector_store import search_rules
from backend.services.llm import complete

RAG_SYSTEM = """You are Lou, an intelligent legal playbook assistant for Siemens contract negotiations.
You answer questions about negotiation positions, rules, and guidance based ONLY on the playbook rules provided below.
You speak in plain English. You never use legal jargon without immediately explaining it.
You always cite which rule you are drawing from, using the format [Rule: topic_name].
If the answer requires escalation (e.g., deal above a threshold), you say so explicitly.
If you cannot find a relevant rule in the provided context, you say clearly: "I don't have a specific rule for that in the current playbook."
You never make up positions that are not in the rules.
You never say what Siemens "should" do beyond what the playbook states — you report what the playbook says.

CURRENT PLAYBOOK RULES (your only source of truth):
{rules_context}"""


def _format_rules_context(rules: list[dict]) -> str:
    parts = []
    for r in rules:
        sources = r.get("sources", [])
        if isinstance(sources, str):
            sources = json.loads(sources)
        part = (
            f"--- Rule: {r['topic']} (Confidence: {r.get('confidence', 1.0):.0%}) ---\n"
            f"Standard Position: {r['standard_position']}\n"
            f"Fallback Position: {r.get('fallback_position') or 'Not specified'}\n"
            f"Red Line: {r.get('red_line') or 'Not specified'}\n"
            f"Reasoning: {r.get('reasoning', '')}\n"
            f"Source: {', '.join(sources) if sources else 'Playbook'}"
        )
        parts.append(part)
    return "\n\n".join(parts)


async def answer_question(
    question: str,
    history: list[ChatMessage],
    n_rules: int = 5,
) -> ChatResponse:
    retrieved = search_rules(question, n_results=n_rules)

    if not retrieved:
        return ChatResponse(
            answer="I don't have a specific rule for that in the current playbook. Please upload a playbook first.",
            sources=[],
            retrieved_rules=[],
        )

    rules_context = _format_rules_context(retrieved)
    system = RAG_SYSTEM.format(rules_context=rules_context)

    history_msgs = ""
    for msg in history[-6:]:
        history_msgs += f"\n{msg.role.upper()}: {msg.content}"

    user_msg = question
    if history_msgs:
        user_msg = f"Previous conversation:{history_msgs}\n\nNew question: {question}"

    answer = await complete(system_prompt=system, user_message=user_msg, max_tokens=1500)

    sources = [
        {
            "rule_id": r["rule_id"],
            "topic": r["topic"],
            "excerpt": r["standard_position"][:150],
            "confidence": r.get("confidence", 1.0),
        }
        for r in retrieved
    ]

    return ChatResponse(
        answer=answer,
        sources=sources,
        retrieved_rules=[r["rule_id"] for r in retrieved],
    )
