#!/usr/bin/env python3
"""Evaluate Lou's trained local ML artifacts against the weak-label dataset."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, f1_score

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRAINING_DIR = PROJECT_ROOT / "backend" / "data" / "training"
CLASSIFIER_PATH = PROJECT_ROOT / "backend" / "models" / "clause-classifier" / "model.joblib"
RETRIEVER_PATH = PROJECT_ROOT / "backend" / "models" / "lou-retriever"
REPORT_PATH = PROJECT_ROOT / "backend" / "models" / "evaluation_report.json"

sys.path.insert(0, str(PROJECT_ROOT))


def main() -> None:
    report: dict = {}
    classifier_rows = load_jsonl(TRAINING_DIR / "classifier_pairs.jsonl")
    retriever_rows = load_jsonl(TRAINING_DIR / "retriever_pairs.jsonl")

    if CLASSIFIER_PATH.exists():
        classifier = joblib.load(CLASSIFIER_PATH)
        x = [classifier_text(row) for row in classifier_rows]
        y = [row["label"] for row in classifier_rows]
        pred = classifier.predict(x)
        report["classifier"] = {
            "rows": len(y),
            "accuracy": accuracy_score(y, pred),
            "macro_f1": f1_score(y, pred, average="macro"),
            "classification_report": classification_report(y, pred, output_dict=True, zero_division=0),
        }
    else:
        report["classifier"] = {"status": "missing", "path": str(CLASSIFIER_PATH)}

    if RETRIEVER_PATH.exists():
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(str(RETRIEVER_PATH))
        rule_texts = sorted({row["positive_rule_id"]: row["positive_text"] for row in retriever_rows}.items())
        rule_ids = [rule_id for rule_id, _ in rule_texts]
        corpus = [text for _, text in rule_texts]
        corpus_embeddings = model.encode(corpus, normalize_embeddings=True)
        query_embeddings = model.encode([row["query"] for row in retriever_rows], normalize_embeddings=True)
        sims = np.asarray(query_embeddings) @ np.asarray(corpus_embeddings).T
        ranks = []
        hit_at_1 = 0
        hit_at_3 = 0
        for idx, row in enumerate(retriever_rows):
            order = np.argsort(-sims[idx])
            ranked_ids = [rule_ids[i] for i in order]
            rank = ranked_ids.index(row["positive_rule_id"]) + 1
            ranks.append(rank)
            hit_at_1 += int(rank <= 1)
            hit_at_3 += int(rank <= 3)
        report["retriever"] = {
            "rows": len(retriever_rows),
            "recall_at_1": hit_at_1 / len(retriever_rows),
            "recall_at_3": hit_at_3 / len(retriever_rows),
            "mrr": sum(1 / rank for rank in ranks) / len(ranks),
        }
    else:
        report["retriever"] = {"status": "missing", "path": str(RETRIEVER_PATH)}

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


def classifier_text(row: dict) -> str:
    similarity = float(row.get("lexical_similarity", 0.0))
    sim_bucket = "high_similarity" if similarity >= 0.45 else "medium_similarity" if similarity >= 0.2 else "low_similarity"
    return "\n".join([
        f"CLAUSE: {row['clause_text']}",
        f"RULE: {row['rule_text']}",
        f"DOCUMENT_FAMILY: {row.get('document_family', 'unknown')}",
        f"SIMILARITY_BUCKET: {sim_bucket}",
    ])


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"Missing {path}. Run build_training_dataset.py first.")
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


if __name__ == "__main__":
    main()
