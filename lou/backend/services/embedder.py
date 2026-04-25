from functools import lru_cache
from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_embedder() -> SentenceTransformer:
    return SentenceTransformer("all-mpnet-base-v2")


def embed_text(text: str) -> list[float]:
    model = get_embedder()
    return model.encode(text, normalize_embeddings=True).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    model = get_embedder()
    return model.encode(texts, normalize_embeddings=True).tolist()
