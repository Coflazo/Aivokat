#!/bin/bash
# Run from lou/ directory
cd "$(dirname "$0")/backend"
export PYTHONPATH="$(dirname "$0")"
conda run -n py311 python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0
