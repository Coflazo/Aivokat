import json
import os
from typing import Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.core.config import settings
from backend.core.schema import Rule
from backend.services.embedder import embed_text, embed_batch

_client: Optional[chromadb.PersistentClient] = None
_collection = None

COLLECTION_NAME = "lou_rules"


def _get_collection():
    global _client, _collection
    if _collection is None:
        persist_dir = os.path.abspath(settings.chroma_persist_dir)
        os.makedirs(persist_dir, exist_ok=True)
        _client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _rule_to_text(rule: Rule) -> str:
    return (
        f"Topic: {rule.topic}\n"
        f"Category: {rule.category}\n"
        f"Standard Position: {rule.standard_position}\n"
        f"Fallback Position: {rule.fallback_position or 'N/A'}\n"
        f"Red Line: {rule.red_line or 'N/A'}\n"
        f"Reasoning: {rule.reasoning}"
    )


def add_rule(rule: Rule) -> None:
    col = _get_collection()
    text = _rule_to_text(rule)
    embedding = embed_text(text)
    sources = json.loads(rule.sources) if isinstance(rule.sources, str) else rule.sources
    metadata = {
        "rule_id": rule.rule_id,
        "topic": rule.topic,
        "category": rule.category,
        "rule_type": rule.rule_type.value if hasattr(rule.rule_type, "value") else str(rule.rule_type),
        "standard_position": rule.standard_position[:1000],
        "fallback_position": (rule.fallback_position or "")[:500],
        "red_line": (rule.red_line or "")[:500],
        "reasoning": rule.reasoning[:500],
        "confidence": rule.confidence,
        "version": rule.version,
        "committed_by": rule.committed_by,
        "committed_at": rule.committed_at.isoformat(),
        "sources": json.dumps(sources),
    }
    doc_id = f"rule_{rule.rule_id}"
    existing = col.get(ids=[doc_id])
    if existing["ids"]:
        col.update(ids=[doc_id], embeddings=[embedding], documents=[text], metadatas=[metadata])
    else:
        col.add(ids=[doc_id], embeddings=[embedding], documents=[text], metadatas=[metadata])


def search_rules(query: str, n_results: int = 5) -> list[dict]:
    col = _get_collection()
    count = col.count()
    if count == 0:
        return []
    n = min(n_results, count)
    embedding = embed_text(query)
    results = col.query(query_embeddings=[embedding], n_results=n, include=["documents", "metadatas", "distances"])
    out = []
    for i in range(len(results["ids"][0])):
        meta = results["metadatas"][0][i]
        distance = results["distances"][0][i]
        out.append({
            "rule_id": meta["rule_id"],
            "topic": meta["topic"],
            "category": meta["category"],
            "rule_type": meta["rule_type"],
            "standard_position": meta["standard_position"],
            "fallback_position": meta.get("fallback_position", ""),
            "red_line": meta.get("red_line", ""),
            "reasoning": meta.get("reasoning", ""),
            "confidence": meta.get("confidence", 1.0),
            "committed_by": meta.get("committed_by", ""),
            "committed_at": meta.get("committed_at", ""),
            "sources": json.loads(meta.get("sources", "[]")),
            "distance": distance,
            "similarity": max(0.0, 1.0 - distance),
        })
    return out


def get_all_rules() -> list[dict]:
    col = _get_collection()
    count = col.count()
    if count == 0:
        return []
    results = col.get(include=["documents", "metadatas"])
    out = []
    for i in range(len(results["ids"])):
        meta = results["metadatas"][i]
        out.append({
            "chroma_id": results["ids"][i],
            "rule_id": meta["rule_id"],
            "topic": meta["topic"],
            "category": meta["category"],
            "rule_type": meta["rule_type"],
            "standard_position": meta["standard_position"],
            "fallback_position": meta.get("fallback_position", ""),
            "red_line": meta.get("red_line", ""),
            "reasoning": meta.get("reasoning", ""),
            "confidence": meta.get("confidence", 1.0),
            "version": meta.get("version", 1),
            "committed_by": meta.get("committed_by", ""),
            "committed_at": meta.get("committed_at", ""),
            "sources": json.loads(meta.get("sources", "[]")),
        })
    return out


def get_rule_by_id(rule_id: str) -> Optional[dict]:
    col = _get_collection()
    doc_id = f"rule_{rule_id}"
    result = col.get(ids=[doc_id], include=["documents", "metadatas"])
    if not result["ids"]:
        return None
    meta = result["metadatas"][0]
    return {
        "chroma_id": result["ids"][0],
        "rule_id": meta["rule_id"],
        **meta,
        "sources": json.loads(meta.get("sources", "[]")),
    }


def delete_rule(rule_id: str) -> None:
    col = _get_collection()
    doc_id = f"rule_{rule_id}"
    col.delete(ids=[doc_id])


def compute_all_similarities(threshold: float = 0.35) -> list[tuple[str, str, float]]:
    col = _get_collection()
    count = col.count()
    if count < 2:
        return []
    results = col.get(include=["embeddings", "metadatas"])
    ids = results["ids"]
    embeddings = results["embeddings"]
    rule_ids = [m["rule_id"] for m in results["metadatas"]]

    pairs = []
    import numpy as np
    emb_matrix = np.array(embeddings)
    # Cosine similarity (embeddings already normalized)
    sim_matrix = emb_matrix @ emb_matrix.T

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            sim = float(sim_matrix[i, j])
            if sim > threshold:
                pairs.append((rule_ids[i], rule_ids[j], sim))
    return pairs
