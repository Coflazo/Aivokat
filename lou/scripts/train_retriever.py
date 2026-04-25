#!/usr/bin/env python3
"""Fine-tune the sentence-transformer retriever on Siemens playbook pairs."""

from __future__ import annotations

import json
import sys
import argparse
from pathlib import Path

from torch.utils.data import DataLoader

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TRAINING_FILE = PROJECT_ROOT / "backend" / "data" / "training" / "retriever_pairs.jsonl"
MODEL_DIR = PROJECT_ROOT / "backend" / "models" / "lou-retriever"
BASE_MODEL = "all-mpnet-base-v2"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-steps", type=int, default=1, help="Cap training steps for a fast local demo run. Use 0 for full epoch.")
    args = parser.parse_args()

    try:
        from sentence_transformers import InputExample, SentenceTransformer, losses
        from sentence_transformers.trainer import SentenceTransformerTrainer
    except Exception as exc:
        raise SystemExit(f"sentence-transformers is required for retriever training: {exc}") from exc

    patch_sentence_transformer_trainer(SentenceTransformerTrainer)

    rows = load_jsonl(TRAINING_FILE)
    if len(rows) < 16:
        raise SystemExit(f"Not enough retriever rows in {TRAINING_FILE}. Run build_training_dataset.py first.")

    try:
        model = SentenceTransformer(BASE_MODEL, local_files_only=True)
    except Exception as exc:
        raise SystemExit(
            f"Base model '{BASE_MODEL}' is not available locally. Download/cache it first, then rerun training. {exc}"
        ) from exc

    examples = [InputExample(texts=[row["query"], row["positive_text"]]) for row in rows]
    loader = DataLoader(examples, shuffle=True, batch_size=16)
    loss = losses.MultipleNegativesRankingLoss(model)
    steps_per_epoch = None if args.max_steps <= 0 else min(args.max_steps, len(loader))

    model.fit(
        train_objectives=[(loader, loss)],
        epochs=1,
        steps_per_epoch=steps_per_epoch,
        warmup_steps=max(1, len(loader) // 10),
        show_progress_bar=True,
    )
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model.save(str(MODEL_DIR))
    print(f"saved retriever: {MODEL_DIR}")


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"Missing {path}. Run build_training_dataset.py first.")
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def patch_sentence_transformer_trainer(trainer_cls) -> None:
    """Compatibility for sentence-transformers 3.0.x with newer transformers."""
    original = trainer_cls.compute_loss
    if getattr(original, "_lou_patched", False):
        return

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        return original(self, model, inputs, return_outputs=return_outputs)

    compute_loss._lou_patched = True
    trainer_cls.compute_loss = compute_loss


if __name__ == "__main__":
    main()
