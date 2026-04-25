#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Starting Lou frontend on http://localhost:5175 ..."
npm run dev
