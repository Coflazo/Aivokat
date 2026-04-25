import json
import os
from functools import lru_cache

import chromadb
import numpy as np
from chromadb.config import Settings as ChromaSettings

from backend.core.config import settings
from backend.core.schema import Commit, Rule
from backend.services.embedder import embed_text


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.PersistentClient:
    persist_dir = os.path.abspath(settings.chroma_persist_dir)
    os.makedirs(persist_dir, exist_ok=True)
    return chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_rules_collection():
    return get_chroma_client().get_or_create_collection(
        name="lou_rules",
        metadata={"hnsw:space": "cosine"},
    )


def get_commits_collection():
    return get_chroma_client().get_or_create_collection(
        name="lou_commits",
        metadata={"hnsw:space": "cosine"},
    )


def rule_to_text(rule: Rule) -> str:
    parts = [
        f"Topic: {rule.topic}",
        f"Category: {rule.category}",
        f"Standard Position: {rule.standard_position}",
    ]
    if rule.fallback_position:
        parts.append(f"Fallback Position: {rule.fallback_position}")
    if rule.red_line:
        parts.append(f"Red Line: {rule.red_line}")
    if rule.decision_logic:
        parts.append(f"Escalation Trigger: {rule.decision_logic}")
    if rule.reasoning:
        parts.append(f"Why It Matters: {rule.reasoning}")
    return "\n".join(parts)


def add_rule(rule: Rule) -> None:
    col = get_rules_collection()
    text = rule_to_text(rule)
    sources = rule.sources_list()
    col.upsert(
        ids=[rule.rule_id],
        embeddings=[embed_text(text)],
        documents=[text],
        metadatas=[{
            "rule_id": rule.rule_id,
            "topic": rule.topic,
            "category": rule.category,
            "rule_type": rule.rule_type.value if hasattr(rule.rule_type, "value") else str(rule.rule_type),
            "standard_position": rule.standard_position[:1000],
            "fallback_position": (rule.fallback_position or "")[:1000],
            "red_line": (rule.red_line or "")[:1000],
            "reasoning": rule.reasoning[:1000],
            "decision_logic": (rule.decision_logic or "")[:1000],
            "confidence": rule.confidence,
            "version": rule.version,
            "committed_by": rule.committed_by,
            "committed_at": rule.committed_at.isoformat(),
            "sources": json.dumps(sources),
        }],
    )


def delete_rule(rule_id: str) -> None:
    get_rules_collection().delete(ids=[rule_id])


def search_rules(query: str, n_results: int = 5) -> list[dict]:
    col = get_rules_collection()
    count = col.count()
    if count == 0:
        return []
    results = col.query(
        query_embeddings=[embed_text(query)],
        n_results=min(n_results, count),
        include=["documents", "metadatas", "distances"],
    )

    output: list[dict] = []
    for idx, rule_id in enumerate(results["ids"][0]):
        meta = results["metadatas"][0][idx]
        distance = float(results["distances"][0][idx])
        output.append({
            "chroma_id": rule_id,
            "rule_id": meta["rule_id"],
            "topic": meta["topic"],
            "category": meta["category"],
            "rule_type": meta.get("rule_type", "standard"),
            "standard_position": meta.get("standard_position", ""),
            "fallback_position": meta.get("fallback_position", ""),
            "red_line": meta.get("red_line", ""),
            "reasoning": meta.get("reasoning", ""),
            "decision_logic": meta.get("decision_logic", ""),
            "confidence": meta.get("confidence", 1.0),
            "committed_by": meta.get("committed_by", ""),
            "committed_at": meta.get("committed_at", ""),
            "sources": json.loads(meta.get("sources", "[]")),
            "document": results["documents"][0][idx],
            "distance": distance,
            "similarity": max(0.0, 1.0 - distance),
        })
    return output


def get_all_rules() -> list[dict]:
    col = get_rules_collection()
    if col.count() == 0:
        return []
    results = col.get(include=["documents", "metadatas"])
    output: list[dict] = []
    for idx, rule_id in enumerate(results["ids"]):
        meta = results["metadatas"][idx]
        output.append({
            "chroma_id": rule_id,
            "rule_id": meta["rule_id"],
            "topic": meta["topic"],
            "category": meta["category"],
            "rule_type": meta.get("rule_type", "standard"),
            "standard_position": meta.get("standard_position", ""),
            "fallback_position": meta.get("fallback_position", ""),
            "red_line": meta.get("red_line", ""),
            "reasoning": meta.get("reasoning", ""),
            "decision_logic": meta.get("decision_logic", ""),
            "confidence": meta.get("confidence", 1.0),
            "version": meta.get("version", 1),
            "committed_by": meta.get("committed_by", ""),
            "committed_at": meta.get("committed_at", ""),
            "sources": json.loads(meta.get("sources", "[]")),
        })
    return output


def compute_all_similarities(threshold: float = 0.35) -> list[tuple[str, str, float]]:
    col = get_rules_collection()
    if col.count() < 2:
        return []
    data = col.get(include=["embeddings", "metadatas"])
    rule_ids = [meta["rule_id"] for meta in data["metadatas"]]
    embeddings = np.array(data["embeddings"])
    sim_matrix = embeddings @ embeddings.T

    edges: list[tuple[str, str, float]] = []
    for i in range(len(rule_ids)):
        for j in range(i + 1, len(rule_ids)):
            sim = float(sim_matrix[i, j])
            if sim > threshold:
                edges.append((rule_ids[i], rule_ids[j], sim))
    return edges


def add_commit(commit: Commit, rule_topic: str) -> None:
    col = get_commits_collection()
    text = (
        f"Rule: {rule_topic}\n"
        f"Change Type: {commit.change_type.value if hasattr(commit.change_type, 'value') else commit.change_type}\n"
        f"Source Document: {commit.source_document or 'Manual'}\n"
        f"Source Clause: {commit.source_clause or 'N/A'}\n"
        f"Lawyer Note: {commit.lawyer_note or 'None'}\n"
        f"Committed By: {commit.committed_by}"
    )
    col.upsert(
        ids=[commit.commit_hash],
        embeddings=[embed_text(text)],
        documents=[text],
        metadatas=[{
            "rule_id": commit.rule_id,
            "topic": rule_topic,
            "change_type": commit.change_type.value if hasattr(commit.change_type, "value") else str(commit.change_type),
            "source_document": commit.source_document or "",
            "committed_by": commit.committed_by,
        }],
    )


def search_precedents(query: str, n_results: int = 3) -> list[dict]:
    col = get_commits_collection()
    if col.count() == 0:
        return []
    results = col.query(
        query_embeddings=[embed_text(query)],
        n_results=min(n_results, col.count()),
        include=["documents", "metadatas"],
    )
    return [
        {
            "document": results["documents"][0][idx],
            "metadata": results["metadatas"][0][idx],
        }
        for idx in range(len(results["ids"][0]))
    ]
