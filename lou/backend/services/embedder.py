from functools import lru_cache
import hashlib
import math
import re
from pathlib import Path

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover - lets tests pass when this package is not installed
    SentenceTransformer = None  # type: ignore[assignment]

from backend.core.config import settings


@lru_cache(maxsize=1)
def get_embedder():
    """Load the sentence-transformer if it is already available locally.

    The demo should still start if the big model is missing, so we only load
    models that are already on disk.
    """
    if SentenceTransformer is None:
        return None
    model_path = _resolve_backend_path(settings.lou_embedding_model_path)
    if model_path.exists():
        try:
            return SentenceTransformer(str(model_path))
        except Exception:
            pass
    try:
        return SentenceTransformer(settings.embedding_model, local_files_only=True)
    except Exception:
        return None


def embed_text(text: str) -> list[float]:
    model = get_embedder()
    if model is not None:
        return model.encode(text, normalize_embeddings=True).tolist()
    return _hash_embedding(text)


def embed_batch(texts: list[str]) -> list[list[float]]:
    model = get_embedder()
    if model is not None:
        return model.encode(texts, normalize_embeddings=True).tolist()
    return [_hash_embedding(text) for text in texts]


def _hash_embedding(text: str, dimensions: int = 768) -> list[float]:
    vector = [0.0] * dimensions
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    for token in tokens:
        digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


def _resolve_backend_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute() or path.exists():
        return path
    backend_dir = Path(__file__).resolve().parents[1]
    trimmed = value.removeprefix("./backend/")
    candidates = [backend_dir / value, backend_dir / trimmed]
    return next((candidate for candidate in candidates if candidate.exists()), candidates[-1])
