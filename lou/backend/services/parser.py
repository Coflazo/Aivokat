import json
from pathlib import Path
from docx import Document
import openpyxl
from backend.services.llm import complete_json

EXTRACTION_SYSTEM = """You are a legal knowledge extraction specialist. You extract negotiation rules from legal playbooks.
A playbook contains guidance for contract negotiations including standard positions, fallback positions, red lines, and escalation rules.
You must return ONLY valid JSON. No preamble, no explanation, no markdown fences."""

EXTRACTION_USER_TEMPLATE = """Extract all negotiation rules from the following playbook content.

For each distinct topic (e.g., "Liability Cap", "Confidentiality Duration", "IP Ownership", "Payment Terms", "Governing Law", etc.), extract a rule object with this exact structure:

{{
  "rules": [
    {{
      "rule_id": "snake_case_unique_id",
      "topic": "Human-readable topic name",
      "category": "One of: Financial Risk, Confidentiality, IP & Data, Governance, Payment, Termination, Warranties, Dispute Resolution, Other",
      "rule_type": "standard",
      "standard_position": "What we always want — exact quote or close paraphrase from the document",
      "fallback_position": "What we can accept under pressure — null if not stated",
      "red_line": "What we will never accept — null if not stated",
      "reasoning": "Plain-language explanation of WHY this rule exists — 1-2 sentences accessible to a non-lawyer",
      "suggested_language": "Pre-written clause text if provided — null if not stated",
      "decision_logic": "Conditional escalation rules if any — null if not stated"
    }}
  ]
}}

Rules:
- Every rule must have at minimum: rule_id, topic, category, rule_type, standard_position, reasoning
- rule_id must be unique, lowercase, underscores only, descriptive (e.g. "liability_cap", "confidentiality_duration")
- reasoning must be in plain English, no legal jargon
- If the document has a table mapping topics to positions, extract each row as a separate rule
- If a topic has multiple positions (standard, fallback, red line), they all go in ONE rule object for that topic
- Infer rule_type as "standard" unless the document explicitly marks something as a fallback or red line

PLAYBOOK CONTENT:
{content}"""


def _extract_docx_text(path: str) -> str:
    doc = Document(path)
    sections: list[str] = []
    current_heading = ""
    current_body: list[str] = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        style = para.style.name
        if "Heading" in style or text.startswith("Clause "):
            if current_heading or current_body:
                sections.append(f"\n## {current_heading}\n" + "\n".join(current_body))
            current_heading = text
            current_body = []
        else:
            current_body.append(text)

    if current_heading or current_body:
        sections.append(f"\n## {current_heading}\n" + "\n".join(current_body))

    return "\n".join(sections)


def _extract_xlsx_text(path: str) -> str:
    wb = openpyxl.load_workbook(path, data_only=True)
    rows: list[str] = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows.append(f"Sheet: {sheet_name}")
        headers: list[str] = []
        for row in ws.iter_rows(values_only=True):
            if all(v is None for v in row):
                continue
            cells = [str(v) if v is not None else "" for v in row]
            if not headers:
                headers = cells
                rows.append(" | ".join(headers))
            else:
                pairs = [f"{h}: {v}" for h, v in zip(headers, cells) if v]
                rows.append("\n".join(pairs) + "\n---")
    return "\n".join(rows)


async def parse_playbook(file_path: str, filename: str) -> list[dict]:
    suffix = Path(filename).suffix.lower()

    if suffix in (".docx", ".doc"):
        content = _extract_docx_text(file_path)
    elif suffix in (".xlsx", ".xls", ".csv"):
        content = _extract_xlsx_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    # Chunk if content is very long
    max_chars = 12000
    chunks = [content[i:i + max_chars] for i in range(0, len(content), max_chars)]

    all_rules: list[dict] = []
    seen_ids: set[str] = set()

    for chunk in chunks:
        prompt = EXTRACTION_USER_TEMPLATE.format(content=chunk)
        result = await complete_json(EXTRACTION_SYSTEM, prompt, max_tokens=4000)
        rules = result.get("rules", [])
        for rule in rules:
            rid = rule.get("rule_id", "").strip()
            if not rid or rid in seen_ids:
                continue
            seen_ids.add(rid)
            all_rules.append(rule)

    return all_rules
