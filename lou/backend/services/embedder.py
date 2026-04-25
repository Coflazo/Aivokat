from functools import lru_cache
import hashlib
import math
import re

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover - dependency may be absent in lightweight environments
    SentenceTransformer = None  # type: ignore

from backend.core.config import settings


@lru_cache(maxsize=1)
def get_embedder():
    """Load the sentence-transformer if it is already available locally.

    The hackathon demo should not hang or fail just because the model has not
    been downloaded yet, so network downloads are intentionally avoided here.
    """
    if SentenceTransformer is None:
        return None
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
