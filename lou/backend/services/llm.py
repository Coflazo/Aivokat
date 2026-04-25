import json
import re
import os
import litellm
from backend.core.config import settings

os.environ["OPENAI_API_KEY"] = settings.openai_api_key
litellm.drop_params = True


async def complete(
    system_prompt: str,
    user_message: str,
    temperature: float | None = None,
    max_tokens: int = 2000,
    response_format: dict | None = None,
) -> str:
    kwargs: dict = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        # gpt-5.5 only supports default temperature (1.0); drop custom values
        "temperature": 1.0,
        "max_tokens": max_tokens,
    }
    # gpt-5.5 may not support response_format — drop_params handles it
    if response_format:
        kwargs["response_format"] = response_format

    response = await litellm.acompletion(**kwargs)
    return response.choices[0].message.content or ""


def _extract_json(text: str) -> dict:
    """Extract JSON from model output, stripping markdown fences if present."""
    # Strip markdown code blocks
    clean = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    # Find first { ... } or [ ... ]
    start = min(
        (clean.find("{") if "{" in clean else len(clean)),
        (clean.find("[") if "[" in clean else len(clean)),
    )
    if start == len(clean):
        raise ValueError(f"No JSON found in response: {text[:200]}")
    return json.loads(clean[start:])


async def complete_json(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 3000,
) -> dict:
    # Try with json_object format first, fall back to plain text parsing
    try:
        raw = await complete(
            system_prompt=system_prompt,
            user_message=user_message,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
    except Exception:
        raw = await complete(
            system_prompt=system_prompt,
            user_message=user_message,
            max_tokens=max_tokens,
        )

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            return _extract_json(raw)
        except (ValueError, json.JSONDecodeError) as e:
            raise ValueError(f"LLM returned invalid JSON: {e}\nRaw: {raw[:500]}")
