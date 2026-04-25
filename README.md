<div align="center">

<img src="./assets/lou-wordmark.svg" width="220" alt="Lou">

**Munich Hacking Legal 2026 - Siemens AG Challenge**

</div>

## What Lou Is

Lou is a legal playbook engine for negotiation teams.

It takes the NDA playbook that usually lives in Word or Excel and turns it into structured legal knowledge: preferred positions, fallbacks, red lines, escalation triggers, source documents, and a review history.

The important bit is control. Lou can propose updates after a negotiated contract comes in, but it cannot update the live playbook by itself. A lawyer has to approve or reject the change.

Lou is not a bulk contract review tool. It is the system behind the guidance: the part that tells a team what the playbook says, why it says it, and how that guidance changed over time.

## What It Does

Lou answers four questions from the Siemens brief:

| Question | Lou's answer |
|---|---|
| How does a playbook talk? | Ask a plain-English question and get a cited answer from the playbook. |
| How does it think? | Each clause becomes a structured rule with standard, fallback, red-line, and escalation fields. |
| How does it grow? | Negotiated contracts create proposed commits for lawyer review. |
| How does it scale? | The same schema works for NDA, M&A, procurement, or any other playbook type. |

The demo uses the Siemens NDA materials in `Siemens Sample Documents/`. The production app lives in `lou/`.

## Repository

```text
.
├── README.md
├── assets/
│   └── lou-wordmark.svg
├── Siemens Sample Documents/
│   ├── Sample NDA Playbook.csv.xlsx
│   ├── Sample NDA Playbook.docx
│   ├── Sample Standard NDA.docx
│   └── Sample NDAs/
└── lou/
    ├── backend/
    ├── scripts/
    ├── src/
    ├── package.json
    └── start_*.sh
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, react-force-graph-2d |
| API | FastAPI |
| Relational store | SQLite via SQLModel |
| Semantic search | ChromaDB |
| Embeddings | sentence-transformers, with a local deterministic fallback for offline demos |
| LLM access | LiteLLM |
| Documents | python-docx, openpyxl, pypdf |

## Run It

Use the Python 3.11 environment that has the backend dependencies installed.

Backend:

```bash
cd lou
./start_backend.sh
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

Frontend:

```bash
cd lou
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Seed The Demo

The seed script reads the real Siemens file:

```text
Siemens Sample Documents/Sample NDA Playbook.csv.xlsx
```

That file has eight columns:

```text
Clause #, Clause Name, Why It Matters (Summary), Preferred Position,
Fallback 1, Fallback 2, Red Line, Escalation Trigger
```

The Excel playbook is parsed directly. No LLM call is needed for those 14 rules.

Run:

```bash
cd lou
python scripts/seed_demo.py
```

The script then processes the sample negotiated NDAs and writes proposed commits into the review queue. Those contract-analysis steps use the configured LLM.

## Demo Flow

1. Seed the app.
2. Open the Neural Map.
3. Click a staged rule and inspect its provenance.
4. Open Review Queue.
5. Approve or reject one proposed commit with a lawyer note.
6. Return to the Neural Map and watch the lifecycle ring change.
7. Ask Lou: `Can we accept unlimited liability?`
8. Export the Excel workbook.

## Guardrails

- Lou routes LLM calls through `backend/services/llm.py`.
- Playbook rules live in SQLite; embeddings live in ChromaDB.
- The evolution pipeline writes `ProposedCommit` records only.
- Live rule updates go through `POST /api/review/{id}/approve`.
- Every chat answer returns source citations.
- Every approved or rejected proposal creates a commit record.

That approval gate is the product. Without it, Lou would just be another AI suggestion box.

## Useful Checks

Frontend:

```bash
cd lou
npm run build
```

Backend import check:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python -m compileall backend
```

Parser sanity check:

```bash
cd lou/backend
PYTHONPATH=.. /opt/miniconda3/envs/py311/bin/python - <<'PY'
from backend.services.parser import parse_excel_playbook
rules = parse_excel_playbook('../../Siemens Sample Documents/Sample NDA Playbook.csv.xlsx')
print(len(rules), rules[0]['rule_id'], rules[-1]['rule_id'])
PY
```

Expected:

```text
14 type_of_nda signatures_authority
```

## Training The Local ML Models

Lou now has a local training pipeline for the Siemens sample set.

It trains two things:

- a retriever model under `lou/backend/models/lou-retriever/`
- a clause classifier under `lou/backend/models/clause-classifier/`

Build weak-label training data:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/build_training_dataset.py
```

Train the classifier:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/train_clause_classifier.py
```

Train the retriever:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/train_retriever.py
```

By default the retriever script runs one local training step so the demo does not spend twenty minutes on CPU. For a full epoch:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/train_retriever.py --max-steps 0
```

Evaluate both models:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/evaluate_models.py
```

Rebuild ChromaDB with the trained retriever:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/reindex_chroma.py
```

Training does not change the live playbook. It writes data files, model files, and metrics. The approval gate still controls any change to the `Rule` table.

## Secrets

Do not commit real keys.

Ignored files include:

```text
lou/.env
TUMHL_API_KEY.txt
lou/backend/data/
```

Use `lou/.env.example` as the template.
