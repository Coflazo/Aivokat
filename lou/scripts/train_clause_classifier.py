#!/usr/bin/env python3
"""Train Lou's local clause relationship classifier."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRAINING_FILE = PROJECT_ROOT / "backend" / "data" / "training" / "classifier_pairs.jsonl"
MODEL_DIR = PROJECT_ROOT / "backend" / "models" / "clause-classifier"


def main() -> None:
    rows = load_jsonl(TRAINING_FILE)
    if len(rows) < 8:
        raise SystemExit(f"Not enough classifier rows in {TRAINING_FILE}. Run build_training_dataset.py first.")

    labels = [row["label"] for row in rows]
    texts = [classifier_text(row) for row in rows]
    stratify = labels if min(Counter(labels).values()) >= 2 else None
    x_train, x_test, y_train, y_test = train_test_split(
        texts,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=stratify,
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=6000)),
        ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])
    pipeline.fit(x_train, y_train)

    predictions = pipeline.predict(x_test)
    metrics = {
        "rows": len(rows),
        "train_rows": len(x_train),
        "test_rows": len(x_test),
        "label_counts": dict(Counter(labels)),
        "accuracy": accuracy_score(y_test, predictions),
        "macro_f1": f1_score(y_test, predictions, average="macro"),
        "classification_report": classification_report(y_test, predictions, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=sorted(set(labels))).tolist(),
        "labels": sorted(set(labels)),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_DIR / "model.joblib")
    (MODEL_DIR / "labels.json").write_text(json.dumps(sorted(set(labels)), indent=2), encoding="utf-8")
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"saved classifier: {MODEL_DIR / 'model.joblib'}")
    print(f"accuracy: {metrics['accuracy']:.3f}")
    print(f"macro_f1: {metrics['macro_f1']:.3f}")


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
