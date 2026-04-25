from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib

from backend.core.config import settings
from backend.core.schema import ChangeType


@lru_cache(maxsize=1)
def get_clause_classifier():
    path = _resolve_backend_path(settings.lou_classifier_path)
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception:
        return None


def classify_clause_pair(
    clause_text: str,
    rule_text: str,
    lexical_similarity: float,
    document_family: str = "unknown",
) -> tuple[ChangeType | None, float]:
    classifier = get_clause_classifier()
    if classifier is None:
        return None, 0.0

    text = _classifier_text(clause_text, rule_text, lexical_similarity, document_family)
    prediction = classifier.predict([text])[0]
    confidence = 1.0
    if hasattr(classifier, "predict_proba"):
        probabilities = classifier.predict_proba([text])[0]
        confidence = float(max(probabilities))
    return ChangeType(prediction.lower()), confidence


def _classifier_text(clause_text: str, rule_text: str, lexical_similarity: float, document_family: str) -> str:
    sim_bucket = "high_similarity" if lexical_similarity >= 0.45 else "medium_similarity" if lexical_similarity >= 0.2 else "low_similarity"
    return "\n".join([
        f"CLAUSE: {clause_text}",
        f"RULE: {rule_text}",
        f"DOCUMENT_FAMILY: {document_family}",
        f"SIMILARITY_BUCKET: {sim_bucket}",
    ])


def _resolve_backend_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute() or path.exists():
        return path
    backend_dir = Path(__file__).resolve().parents[1]
    trimmed = value.removeprefix("./backend/")
    candidates = [backend_dir / value, backend_dir / trimmed]
    return next((candidate for candidate in candidates if candidate.exists()), candidates[-1])
