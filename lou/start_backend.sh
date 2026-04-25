#!/bin/bash
set -e
cd "$(dirname "$0")/backend"
export PYTHONPATH="$PWD/.."
echo "Starting Lou backend on http://localhost:8000 ..."
/opt/miniconda3/envs/py311/bin/python -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
