import json
import re
import os
import litellm
from backend.core.config import settings

os.environ["OPENAI_API_KEY"] = settings.openai_api_key
litellm.drop_params = True

_BLOCKED_MODELS: set[str] = set()


async def complete(
    system_prompt: str,
    user_message: str,
    temperature: float | None = None,
    max_tokens: int = 2000,
    response_format: dict | None = None,
) -> str:
    last_error: Exception | None = None
    for model in _candidate_models():
        if model in _BLOCKED_MODELS:
            continue

        kwargs: dict = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": _temperature_for_model(model, temperature),
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format

        try:
            response = await litellm.acompletion(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:
            last_error = exc
            if _looks_like_model_access_error(exc):
                _BLOCKED_MODELS.add(model)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("No LLM models are configured.")


def _extract_json(text: str) -> dict:
    """Extract JSON from model output, stripping markdown fences if present."""
    # Some models wrap JSON in fences, so clean that off first.
    clean = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    # Start at the first JSON-looking character and let json.loads do the rest.
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
    # Ask for JSON first. If the model ignores that option, parse the text below.
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


def _candidate_models() -> list[str]:
    models = [settings.llm_model]
    models.extend(model.strip() for model in settings.llm_fallback_models.split(",") if model.strip())
    seen: set[str] = set()
    return [model for model in models if not (model in seen or seen.add(model))]


def _looks_like_model_access_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(
        marker in message
        for marker in (
            "model_not_found",
            "does not have access",
            "not have access to model",
            "model does not exist",
        )
    )


def _temperature_for_model(model: str, requested: float | None) -> float:
    if model.startswith("gpt-5"):
        return 1.0
    return requested if requested is not None else settings.llm_temperature
