# Lou — The GitHub for Lawyers

**The data API layer for legal playbooks. We turn every approved playbook into versioned, queryable, auditable data that you can plug into any AI tool.**

Legal knowledge has always been trapped in files — PDFs on SharePoint, Word documents in email threads, institutional wisdom that lives only in a senior partner's head. Lou breaks that pattern. When a lawyer uploads a playbook, Lou immediately transforms it into structured relational data, embeds it into a semantic vector store, and publishes it as a versioned REST API that any system can query.

---

## The Problem: Legal Knowledge Locked in Files

Every law firm and in-house legal team operates from playbooks: documents that encode years of negotiating experience into preferred positions, acceptable fallbacks, hard red lines, and escalation triggers. The problem is that these documents are static. They cannot answer questions. They cannot compare themselves to incoming contracts. They cannot tell you whether a clause you are reviewing is at your red line or well within your comfort zone.

When a lawyer leaves, their knowledge leaves too. When a playbook is updated, no one gets notified. When a new AI tool needs to understand your negotiating posture, there is no API to call.

Lou is the fix.

---

## The Solution: Three Pillars

### 1. Structured Knowledge Graph

Every clause in every playbook is parsed into a five-level negotiation hierarchy: **preferred position**, **fallback 1**, **fallback 2**, **red line**, and **escalation trigger**. This is not a flat document dump — it is a relational data model at the clause level. Each field is independently queryable, editable, versioned, and auditable.

The Mini Brain visualization renders each playbook as a living graph: clauses as root nodes, hierarchy levels as children, and semantic similarity edges connecting clauses that cover overlapping legal ground. The Mega Brain rolls every published playbook into a single company-wide knowledge graph.

### 2. Semantic Contract Matching

Lou's matching engine evaluates incoming contract clauses against the playbook hierarchy using a four-signal composite score: dense vector embeddings, lexical keyword overlap, topic alias matching, and structural pattern recognition. Each clause is classified into exactly the right tier of the hierarchy — or flagged as uncovered — and the score breakdown is fully transparent.

This powers three production workflows: ask a question and get a grounded answer with citations, match a clause and get an instant classification, or submit a full contract and receive a risk heatmap showing the distribution of preferred, fallback, red line, and unmapped positions across every clause.

### 3. Versioned API Engine

No change to a playbook reaches production without an explicit lawyer commit. Every publish event writes an immutable commit record with a 12-character hash, a committer name, a comment, and a diff. Clause edits accumulate a draft history of up to 25 entries. Analysis issues must be explicitly accepted or rejected — the system never auto-applies fixes to legal text.

When a document is ingested, proposed changes enter a review queue sorted by risk: contradictions appear first, then extensions, then new rules, then confirmations. A lawyer approves or rejects each item; only approved changes propagate to the live knowledge base.

---

## Architecture

```
XLSX Playbook Upload
        |
        v
  Clause Parser
  (8-column XLSX schema)
        |
        v
  SQL Database (SQLite / Postgres)
  Playbook  -->  PlaybookClause  -->  PlaybookIssue
                                 -->  PlaybookCommit
        |
        v
  Analysis Engine
  (deterministic hierarchy checks)
        |
        v
  Lawyer Review
  (accept / reject each proposed fix)
        |
        v
  Publish Gate
  (explicit commit required)
        |
        v
  Vector Store (ChromaDB)         SQL Index
  Mega Brain clause embeddings     Commit history
        |
        v
  Public REST API
  ask / match-clause / analyze-contract / coverage-gaps
  semantic search / RAG chat
```

The data flows from human-authored XLSX through structured parsing, deterministic analysis, lawyer-gated approval, and finally into a published API surface. No clause text is mutated without explicit lawyer action at every step.

---

## Core Endpoints Quick Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/playbooks/upload` | Upload XLSX playbook, create draft |
| `GET` | `/api/playbooks` | List all playbooks (all statuses) |
| `GET` | `/api/playbooks/{id}` | Get full playbook with clauses and issues |
| `GET` | `/api/playbooks/{id}/brain` | Get Mini Brain graph for visualization |
| `PATCH` | `/api/playbooks/{id}/clauses/{clause_id}` | Edit one clause field (draft only) |
| `POST` | `/api/playbooks/{id}/publish` | Publish draft, write commit, index to Mega Brain |
| `GET` | `/api/public/playbooks` | List published playbooks |
| `GET` | `/api/public/playbooks/{id}/schema` | Get full published playbook schema |
| `POST` | `/api/public/playbooks/{id}/ask` | Ask a natural language question |
| `POST` | `/api/public/playbooks/{id}/match-clause` | Match a contract clause to the hierarchy |
| `POST` | `/api/public/playbooks/{id}/suggest-rewrite` | Get AI-suggested clause rewrite |
| `POST` | `/api/public/playbooks/{id}/analyze-contract` | Analyze full contract text |
| `POST` | `/api/public/playbooks/{id}/analyze-contract-file` | Analyze a PDF/DOCX/TXT contract |
| `POST` | `/api/public/playbooks/{id}/coverage-gaps` | Find contract clauses with no playbook match |
| `GET` | `/api/mega-brain` | Full company knowledge graph |
| `GET` | `/api/mega-brain/search?q=...` | Semantic search across all published clauses |
| `POST` | `/api/analysis/playbook/{id}` | Run hierarchy analysis, generate issues |
| `POST` | `/api/analysis/issues/{id}/accept-fix` | Apply a proposed fix after lawyer approval |
| `POST` | `/api/analysis/issues/{id}/reject` | Reject a proposed fix |
| `POST` | `/api/rewrite/cell` | AI-rewrite one clause field |
| `POST` | `/api/rewrite/row` | AI-rewrite all fields of one clause |
| `POST` | `/api/rewrite/playbook` | AI-rewrite entire playbook |
| `POST` | `/api/chat` | RAG chat against the knowledge base |
| `GET` | `/api/commits` | Full commit history with pagination |
| `GET` | `/api/review` | Pending proposed changes, sorted by risk |
| `POST` | `/api/review/{id}/approve` | Approve or reject a proposed change |

---

## The Three Challenge Endpoints

Lou's core value proposition is delivered through three canonical API endpoints that transform a static playbook into an active, queryable knowledge service.

### `lou_api/text` — Ask the Playbook

```bash
curl -X POST http://localhost:8000/api/public/playbooks/{playbook_id}/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Can we accept unlimited liability?"}'
```

Returns a grounded LLM answer with clause citations and a calibrated confidence score. The answer is generated strictly from the matched playbook clause — not from the model's general training data. Every response includes the clause name, an excerpt from the preferred position, and a raw semantic match score so the consumer knows exactly which playbook content is driving the answer.

### `lou_api/match` — Match a Clause

```bash
curl -X POST http://localhost:8000/api/public/playbooks/{playbook_id}/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "The Receiving Party accepts unlimited liability for all damages.",
    "heading": "Liability"
  }'
```

Returns a full classification: which playbook clause this maps to, which tier of the hierarchy it falls into (preferred / fallback / red line / escalation), a recommended action, a flag for whether lawyer review is needed, and a transparent four-signal score breakdown. This is the engine that powers contract review automation.

### `lou_api/experience` — Search the Mega Brain

```bash
curl "http://localhost:8000/api/mega-brain/search?q=limitation+of+liability+supplier"
```

Semantic search across every published playbook in the company. Returns the top 8 most relevant clauses with cosine similarity scores, the source playbook, and full clause text. This is the retrieval backbone for RAG applications and the endpoint that aggregates institutional legal experience across the entire organization into a single query interface.

---

## Quick Start

**Backend**

```bash
cd lou && uvicorn backend.main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

**Frontend**

```bash
cd lou && npm run dev
```

The React frontend runs at `http://localhost:5173` and provides the full playbook management UI, Mini Brain visualization, Mega Brain explorer, contract analysis circle view, and review queue.

---

## Key Features

**Versioned Playbooks**
Every playbook has a monotonic version counter. Publishing creates an immutable commit with a hash, committer, and message — the same mental model as a Git commit, applied to legal knowledge.

**Mini Brain Visualization**
Each playbook is rendered as an interactive graph. Clauses appear as nodes; their hierarchy levels (preferred through escalation) appear as child nodes. Semantic similarity edges connect clauses that overlap in meaning. Color coding surfaces analysis status at a glance: clean (teal), warning (orange), issue (dark red).

**Mega Brain**
All published playbooks merge into a single company-wide knowledge graph with cross-island edges linking thematically similar clauses across different playbooks. The Mega Brain is the semantic index that powers cross-playbook search and the RAG chat.

**Contract Circle Analysis**
The analyze-contract endpoints return a risk heatmap and clause-by-clause classification that feeds the frontend's circular contract visualization — every clause plotted by risk tier, giving lawyers an instant visual read of where a counterparty's draft stands relative to the playbook.

**Peter and Suzanne Roles**
Lou is designed for two personas who interact at different stages. Peter uploads and manages draft playbooks, runs analysis, reviews proposed fixes, and approves the final publish. Suzanne queries published playbooks, matches incoming contracts, approves proposed changes from document ingestion, and uses the RAG chat for day-to-day legal questions.

**RAG Chat**
The `/api/chat` endpoint provides a multi-turn conversational interface to the entire knowledge base. Questions are answered by retrieving the five most relevant rules from the vector store and generating a grounded response with source citations and confidence scores.

**Commit History**
Every change is tracked. The commits endpoint returns the full audit trail with before-and-after value snapshots, source documents, committer names, and timestamps. Filter by rule ID to see the complete history of any specific clause.

**Review Queue**
When document ingestion surfaces a proposed change — whether it contradicts, extends, or confirms an existing rule — it enters a prioritized review queue. Contradictions surface first. Lawyers approve or reject with optional notes and can override the AI-proposed text before committing. Every decision creates an immutable record.

**Deterministic Analysis Engine**
Seven issue types, checked automatically on demand: hierarchy inversion, vague red line, missing escalation trigger, duplicate positions, fallback too strict, red line too soft, and unclear business language. Analysis is never destructive — it proposes, lawyers decide.

**AI-Assisted Rewrites**
Four rewrite modes (business clear, legal precise, shorter, humanized) generate alternative phrasings for any clause field. Rewrites are proposals; they do not update the database until a lawyer explicitly applies them through the PATCH endpoint.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI (Python 3.11+) |
| Database ORM | SQLModel + SQLite |
| Vector Store | ChromaDB |
| Embeddings | Sentence Transformers (local) |
| LLM | Claude (Anthropic API) |
| Document Parsing | pdfplumber, python-docx, openpyxl |
| Frontend | React + TypeScript + Vite |
| Graph Visualization | D3.js force-directed graph |
| Styling | CSS custom properties |

---

## How Lou Solves the Challenge

The challenge is this: **legal knowledge is locked into files**. A playbook PDF cannot answer a question. It cannot compare itself to a counterparty's draft. It cannot be queried by an AI tool. It cannot tell you whether a clause crosses a red line.

Lou addresses this with four interlocking mechanisms:

**Relational JSON at the clause level.**
Every playbook clause is stored as a structured row with seven named fields. This is not a document; it is data. Each field can be addressed independently, compared, analyzed, and served as an API response. The `why_it_matters`, `preferred_position`, `fallback_1`, `fallback_2`, `red_line`, and `escalation_trigger` fields model the negotiating hierarchy that experienced lawyers carry in their heads — and make it queryable by any system.

**Vector embeddings for semantic retrieval.**
Each published clause is embedded and stored in ChromaDB. Semantic search works on meaning, not keywords. A query about "caps on damages" correctly retrieves clauses about "limitation of liability" even without lexical overlap. The match-clause endpoint combines dense embeddings with lexical and structural signals for a multi-dimensional confidence score that is transparent to the consumer.

**Versioned API with human-in-the-loop approval.**
Legal text is different from application configuration. It has legal consequences. Lou enforces a strict separation between proposals and commits: no clause text changes without an explicit lawyer action. Analysis issues are proposals. Rewrite suggestions are proposals. Document-ingested rule changes are proposals. Only explicit lawyer approval — recorded with a name, timestamp, and optional note — creates a commit. The result is an API that carries the same audit guarantees as a regulated document management system, while being as queryable as a modern REST service.

**Human-gated publish as the quality gate.**
The publish endpoint is the boundary between draft and production. A playbook cannot be queried by the public API until a lawyer has explicitly committed it with a name and message. After publish, the playbook is indexed into the Mega Brain and becomes part of the searchable corpus. This means the knowledge available through the API is always lawyer-approved knowledge — not a raw document dump.

Together, these mechanisms turn a static XLSX file into a living, versioned, auditable API that any AI tool, contract workflow, or internal system can consume — without ever losing the lawyer's judgment as the governing authority over what the data says.
