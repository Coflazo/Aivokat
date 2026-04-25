import json
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
        "temperature": temperature if temperature is not None else settings.llm_temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        kwargs["response_format"] = response_format

    response = await litellm.acompletion(**kwargs)
    return response.choices[0].message.content or ""


async def complete_json(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 3000,
) -> dict:
    raw = await complete(
        system_prompt=system_prompt,
        user_message=user_message,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw: {raw[:500]}")
