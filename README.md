<div align="center">

<div style="display:inline-block;padding:18px 34px;background:#ffffff;border:1px solid #b8b8b8;border-radius:10px;background-image:radial-gradient(#d6d6d6 1px, transparent 1px);background-size:12px 12px;">
  <img src="./assets/lou-wordmark.svg" width="220" alt="Lou">
</div>

**Munich Hacking Legal 2026 - Siemens AG Challenge**

</div>

## What Lou is

Lou turns legal playbooks into governed, versioned APIs.

A senior lawyer uploads a playbook spreadsheet. Lou parses it into clauses, shows it as a clean editable table, checks whether the hierarchy makes sense, and lets the lawyer inspect the result as a mini brain. When the lawyer is ready, they publish it with a name and commit comment. That published playbook becomes an API that other teams can query, match against contracts, and build tools on top of.

The graph is still here. It is no longer the product. It is the audit view: a way for Peter to see where the playbook is clean, where Lou found issues, and how this playbook connects to the company mega brain.

## The product flow

1. Upload a Siemens-style playbook spreadsheet.
2. Review the parsed clauses in a minimal table.
3. Rewrite one cell, one row, or the whole playbook in clearer business language.
4. Run hierarchy checks across Preferred, Fallback 1, Fallback 2, Red Line, and Escalation.
5. Accept or reject proposed fixes. Lou does not apply them automatically.
6. Inspect the playbook as a mini brain.
7. Publish with a committer name and comment.
8. The playbook joins the mega brain as its own island.
9. Downstream users call the public Playbook API.

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
    │   ├── api/routes/
    │   ├── core/
    │   ├── data/
    │   ├── models/
    │   └── services/
    ├── scripts/
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── pages/
    │   └── types/
    └── package.json
```

## Playbook format

The main upload flow expects the same eight columns as:

```text
Siemens Sample Documents/Sample NDA Playbook.csv.xlsx
```

Expected columns:

```text
Clause #
Clause Name
Why It Matters (Summary)
Preferred Position
Fallback 1
Fallback 2
Red Line
Escalation Trigger
```

Excel is parsed directly with `openpyxl`. Lou does not need an LLM to read this structured playbook.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, react-force-graph-2d |
| API | FastAPI |
| Relational store | SQLite via SQLModel |
| Semantic search | ChromaDB |
| Embeddings | sentence-transformers, with local trained artifacts when present |
| LLM access | LiteLLM through `backend/services/llm.py` |
| Documents | openpyxl, python-docx, pypdf |

## Run it

Backend:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python -m uvicorn backend.main:app --port 8000 --host 127.0.0.1
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

Vite usually starts on:

```text
http://localhost:5173
```

If that port is busy, use the URL printed by Vite.

## Main screens

| Screen | Purpose |
|---|---|
| Upload Playbook | Upload the structured playbook and create a draft API module. |
| Playbook Editor | Review and edit the parsed playbook table. |
| Analysis | See hierarchy issues and accept or reject proposed fixes. |
| Mini Brain | Inspect one playbook as a clause graph. |
| Mega Brain | See published playbooks as separate connected islands. |
| API Console | Test the public API as a downstream lawyer or tool builder. |

## Public Playbook API

Published playbooks expose these endpoints:

```text
GET  /api/public/playbooks
GET  /api/public/playbooks/{playbook_id}/schema
POST /api/public/playbooks/{playbook_id}/ask
POST /api/public/playbooks/{playbook_id}/match-clause
POST /api/public/playbooks/{playbook_id}/analyze-contract
POST /api/public/playbooks/{playbook_id}/analyze-contract-file
POST /api/public/playbooks/{playbook_id}/suggest-rewrite
POST /api/public/playbooks/{playbook_id}/coverage-gaps
```

The matching pipeline is deliberately hybrid:

```text
file
-> extract raw blocks
-> normalize text
-> detect headings and boundaries
-> segment clauses
-> dense embedding score
-> lexical score
-> topic alias boost
-> heading/structure boost
-> local classifier or deterministic hierarchy classification
-> LLM only when needed for rewrite or ambiguity
```

Lou does not use sentiment analysis for compliance decisions. It does not use clustering to decide whether a clause is acceptable. Cosine similarity helps find the nearest playbook topic, but segmentation happens first because matching cannot tell you where a clause begins.

## Contract segmentation

Excel is easy: rows are clauses.

DOCX and PDF are harder. Lou handles them automatically:

1. Extract blocks from DOCX styles, tables, or PDF text.
2. Normalize spacing.
3. Detect likely headings from numbering, legal words, and document structure.
4. Group text under headings.
5. Assign a boundary confidence.
6. Mark low confidence spans for review instead of pretending they are perfect.

This keeps the workflow realistic. Nobody has to manually paragraph or number a contract before using the API.

## Local ML

Lou can use local model artifacts when present:

```text
lou/backend/models/lou-retriever/
lou/backend/models/clause-classifier/
```

Training scripts live in `lou/scripts/`:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/build_training_dataset.py
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/train_clause_classifier.py
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/train_retriever.py
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python scripts/evaluate_models.py
```

Training writes data and model files. It does not publish a playbook and does not bypass lawyer approval.

## Guardrails

- All LLM calls go through `backend/services/llm.py`.
- Playbook analysis creates issues. It does not apply fixes.
- A fix is applied only through `POST /api/analysis/issues/{issue_id}/accept-fix`.
- Publishing requires a committer name and commit comment.
- Published playbooks keep version boundaries in the mega brain.
- The mega brain links playbook islands; it does not flatten them into one anonymous graph.
- Public API responses cite playbook clauses and return score breakdowns where matching is involved.
- If the configured LLM model is unavailable, rewrite endpoints return a conservative local proposal instead of breaking the demo.

## Siemens challenge audit

### How Lou makes playbooks talk

The public `ask` endpoint answers plain language questions against a published playbook and returns clause citations. A business user can ask, "Can we accept unlimited liability?" and Lou returns the relevant clause, the preferred position, the fallbacks, the red line, and the escalation trigger.

### How Lou makes playbooks think

Each row becomes structured data: preferred position, fallback 1, fallback 2, red line, escalation trigger, reasoning, issues, and version state. Lou can check the hierarchy instead of treating the playbook as a flat document.

### How Lou makes playbooks grow

Lou proposes rewrites and logic fixes, but the lawyer decides what changes. Accepted fixes update the draft playbook. Publishing creates a commit and indexes the clauses into the mega brain.

### How Lou makes playbooks scale

The schema is generic. NDA is the demo, not the limit. Procurement, M&A, employment, and supplier playbooks can use the same upload, analysis, mini brain, publish, and public API flow.

### How Lou avoids black boxes

The API returns matched clause IDs, explanations, and score breakdowns. The mini brain shows which clauses have warnings or critical issues. The mega brain keeps each playbook as an island so lawyers can see where knowledge came from.

### How Lou keeps lawyers in control

Lou can suggest. It cannot silently rewrite the playbook. Fixes require explicit acceptance, and publishing requires a committer name plus a comment.

### Why the Playbook API is the surprising part

The output is not another contract review screen. The output is an API. Suzanne can plug a published playbook into contract comparison, clause matching, coverage gap detection, or another legal tool without rebuilding the playbook logic.

## Verification commands

Frontend build:

```bash
cd lou
npm run build
```

Backend compile:

```bash
cd lou
PYTHONPATH=. /opt/miniconda3/envs/py311/bin/python -m compileall backend
```

Provider isolation check:

```bash
rg "openai|anthropic|import litellm" lou/backend/services lou/backend/api -n
```

Expected result: only `backend/services/llm.py` should import LiteLLM or set provider credentials.

## Secrets

Do not commit real keys.

Ignored runtime files include:

```text
lou/.env
lou/backend/data/
lou/dist/
__pycache__/
.DS_Store
```

Use `lou/.env.example` as the template.
