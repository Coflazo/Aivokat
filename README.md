<div align="center">

<img src="./assets/lou-wordmark.svg" width="220" alt="Lou">

**Munich Hacking Legal 2026 — Siemens AG Challenge**

Lou turns static legal playbooks into a living, queryable, auditable knowledge system.

</div>

---

## What Lou Is

Lou is a legal playbook engine. It transforms a Word or Excel negotiation playbook into structured decision knowledge: preferred positions, fallbacks, red lines, escalation triggers, source documents, and commit history.

Lou is not a bulk contract review tool. It is a system for making legal negotiation knowledge easier to understand, update, audit, and approve.

## Core Idea

Static playbooks are hard to use because they sit in documents, are not AI-ready, and become stale. Lou turns them into an interactive legal knowledge graph with a lawyer-controlled update loop.

| Challenge question | Lou answer |
|---|---|
| Talk | Ask the playbook plain-language questions and get cited answers. |
| Think | Convert Word/Excel guidance into structured rules. |
| Grow | Let new contracts propose updates without auto-changing the playbook. |
| Scale | Keep source traceability, commits, approvals, and exportable knowledge. |

## Guardrails

- No vendor lock-in: LLM calls are isolated behind a provider wrapper.
- No black boxes: answers and nodes cite source documents.
- Lawyer approval is required: proposed updates do not enter the playbook automatically.
- Business users get plain language; lawyers get source and audit views.

## Repository Structure

```text
.
├── README.md
├── assets/
│   ├── lou-wordmark.svg
│   └── challenge-page-*.png
├── Siemens Sample Documents/
│   ├── Sample NDA Playbook.csv.xlsx
│   ├── Sample NDA Playbook.docx
│   ├── Sample Standard NDA.docx
│   └── Sample NDAs/
├── demo UI UX/
│   └── Cream visual-brain prototype
└── lou/
    ├── backend/
    ├── frontend/
    └── scripts/
```

## Demo UI

The `demo UI UX` folder contains the current product experience prototype:

- Cream paper-like interface
- Cedarville Cursive `Lou` wordmark
- 2D force-directed legal brain
- Nodes generated from `Sample NDA Playbook.csv.xlsx`
- Click-to-open audit panel
- Human-in-the-loop workflow opened manually from `Review change`
- Local actions for staging, committing, approving, adding fallback nodes, sequencing fallback nodes, and deleting nodes

Run it:

```bash
cd "demo UI UX"
npm install
npm run dev
```

Open:

```text
http://localhost:5174/
```

Build check:

```bash
cd "demo UI UX"
npm run build
```

## Full App

The `lou` folder contains the fuller FastAPI and React implementation.

Backend:

```bash
cd lou/backend
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd lou/frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Data Sources

The Siemens sample materials live in `Siemens Sample Documents/`.

Primary playbook source:

```text
Siemens Sample Documents/Sample NDA Playbook.csv.xlsx
```

The visual-brain prototype maps each playbook row into:

- Topic node
- Preferred position node
- Fallback node or nodes
- Red line and escalation node
- Dataset provenance
- Commit comments

## Legal Commit Model

Lou treats legal knowledge like controlled versioned knowledge.

Each rule or node can carry:

- Source document
- Decision family
- Current legal text
- Commit comments
- Last actor
- Manual or dataset-derived origin
- Review status

The intended lifecycle is:

```text
extract → stage → lawyer review → commit → active playbook
```

## Product Identity

Product name:

```text
Lou
```

Wordmark font:

```text
Cedarville Cursive
```

Wordmark color:

```text
Dark black
```

The README title uses `assets/lou-wordmark.svg` so the title visually matches the in-app Lou wordmark.

## Tech Stack

| Layer | Technology |
|---|---|
| Visual prototype | React, TypeScript, Vite, react-force-graph-2d |
| Full frontend | React, TypeScript, Vite, D3 |
| Backend | FastAPI, SQLModel, SQLite |
| Vector search | ChromaDB |
| Embeddings | sentence-transformers |
| LLM wrapper | LiteLLM |
| Documents | python-docx, openpyxl, pypdf |

## Verification

Current verified builds:

```bash
cd "demo UI UX" && npm run build
cd lou/frontend && npm run build
```

Both builds pass.

## Security Notes

Do not expose or commit secrets from:

```text
.env
lou/.env
TUMHL_API_KEY.txt
```

Use `.env.example` as the shareable template.
