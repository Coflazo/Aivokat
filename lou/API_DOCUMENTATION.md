# Lou API Reference

> **Lou** is the data API layer for legal playbooks. Every approved playbook becomes a versioned, queryable, auditable API module that any AI tool, contract workflow, or internal system can consume programmatically.

---

## Overview

### Base URL

```
https://louapi.com
```

All endpoints return JSON. File upload endpoints accept `multipart/form-data`.

### Authentication

Lou is currently designed for internal deployment behind your network perimeter. No API key is required in the default configuration. Production deployments should add an API gateway or OAuth 2.0 token validation layer in front of the service.

### Content Type

Unless noted, all `POST` and `PATCH` requests expect:

```
Content-Type: application/json
```

### Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request — missing or invalid field |
| `404` | Resource not found |
| `409` | Conflict — resource already in a terminal state |
| `422` | Unprocessable entity — file format or schema mismatch |

---

## API Groups

1. [Playbook Management API](#1-playbook-management-api)
2. [Public Playbook API](#2-public-playbook-api)
3. [Mega Brain API](#3-mega-brain-api)
4. [Analysis API](#4-analysis-api)
5. [Rewrite API](#5-rewrite-api)
6. [RAG Chat API](#6-rag-chat-api)
7. [History and Review API](#7-history-and-review-api)

---

## 1. Playbook Management API

Prefix: `/api/playbooks`

These endpoints manage the full lifecycle of a playbook: upload, inspect, edit, visualize, and publish. Playbooks start as drafts and must be explicitly published before they become queryable by external tools.

---

### POST /api/playbooks/upload

Upload a Siemens-style XLSX playbook file and create a draft API module. The spreadsheet must have exactly these eight column headers in order:

`Clause #` | `Clause Name` | `Why It Matters (Summary)` | `Preferred Position` | `Fallback 1` | `Fallback 2` | `Red Line` | `Escalation Trigger`

**Request** — `multipart/form-data`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | `file` | Yes | — | `.xlsx` playbook file |
| `owner` | `string` | No | `"Peter"` | Lawyer or team who owns this playbook |
| `name` | `string` | No | `"Uploaded Playbook"` | Human-readable playbook name |
| `description` | `string` | No | `""` | Short description of scope |

**Response** — `PlaybookUploadResponse`

| Field | Type | Description |
|-------|------|-------------|
| `playbook` | `PlaybookApiView` | Full playbook object in draft status |
| `clauses_created` | `integer` | Number of clauses parsed from the sheet |

```bash
curl -X POST https://louapi.com/api/playbooks/upload \
  -F "file=@siemens-nda-playbook.xlsx" \
  -F "owner=Peter" \
  -F "name=NDA Playbook v3" \
  -F "description=Standard NDA terms for supplier agreements"
```

```json
{
  "playbook": {
    "playbook_id": "nda-playbook-v3",
    "name": "NDA Playbook v3",
    "owner": "Peter",
    "version": 1,
    "status": "draft",
    "clauses": [...]
  },
  "clauses_created": 12
}
```

---

### GET /api/playbooks

List all playbooks ordered by most recently updated. Returns all statuses (draft, published, archived).

**Response** — `list[PlaybookApiView]`

```bash
curl https://louapi.com/api/playbooks | jq '[.[] | {id:.playbook_id, name:.name, status:.status, clauses:(.clauses|length)}]'
```

```json
[
  {
    "playbook_id": "nda-playbook-v3",
    "name": "NDA Playbook v3",
    "owner": "Peter",
    "version": 1,
    "status": "draft",
    "clauses": [...]
  }
]
```

---

### GET /api/playbooks/{playbook_id}

Retrieve a single playbook including all clauses and any open issues per clause.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `playbook_id` | `string` | Playbook slug identifier |

**Response** — `PlaybookApiView`

| Field | Type | Description |
|-------|------|-------------|
| `playbook_id` | `string` | Unique slug |
| `name` | `string` | Display name |
| `owner` | `string` | Responsible lawyer |
| `version` | `integer` | Monotonic version counter |
| `status` | `enum` | `draft` / `published` / `archived` |
| `clauses` | `list[PlaybookClauseView]` | Full clause list with issues |
| `created_at` | `string` | ISO 8601 timestamp |
| `published_at` | `string\|null` | ISO 8601 publish timestamp |

```bash
curl https://louapi.com/api/playbooks/nda-playbook-v3 | jq '{id:.playbook_id, status:.status, clause_count:(.clauses|length)}'
```

---

### GET /api/playbooks/{playbook_id}/brain

Returns the playbook as a graph of nodes and edges for the Mini Brain visualization. Each clause becomes a root node; its hierarchy levels (preferred, fallback 1, fallback 2, red line, escalation) become child nodes. Semantic similarity edges connect clauses with overlapping meaning (cosine similarity >= 0.46).

**Response** — `PlaybookBrainView`

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `list[BrainNodeView]` | All clause and hierarchy nodes |
| `edges` | `list[BrainEdgeView]` | Hierarchy edges + semantic similarity edges |

**BrainNodeView fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Node identifier (e.g. `limitation-of-liability:red_line`) |
| `label` | `string` | Display label |
| `node_type` | `string` | `clause`, `preferred`, `fallback_1`, `fallback_2`, `red_line`, `escalation` |
| `color` | `string` | Hex color driven by analysis status |
| `status` | `string` | `clean` / `warning` / `issue` |

**BrainEdgeView fields**

| Field | Type | Description |
|-------|------|-------------|
| `source` | `string` | Source node ID |
| `target` | `string` | Target node ID |
| `similarity` | `float` | 0.0–1.0 |
| `relationship` | `string` | `playbook_hierarchy` or `semantic_similarity` |
| `edge_scope` | `string` | `island` or `cross_island` |

```bash
curl https://louapi.com/api/playbooks/nda-playbook-v3/brain | jq '{nodes:(.nodes|length), edges:(.edges|length), status:.status}'
```

```json
{
  "nodes": 47,
  "edges": 23,
  "status": "draft"
}
```

---

### PATCH /api/playbooks/{playbook_id}/clauses/{clause_id}

Edit one field of one clause in a draft playbook. Only draft playbooks can be edited. Every change is recorded in a `_draft_history` array (last 25 entries) stored with the clause for full audit visibility.

**Editable fields:** `clause_name`, `why_it_matters`, `preferred_position`, `fallback_1`, `fallback_2`, `red_line`, `escalation_trigger`

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field_name` | `string` | Yes | One of the editable fields above |
| `value` | `string` | Yes | New text content |
| `edited_by` | `string` | No | Name of the editor (defaults to `"Anonymous"`) |

**Response** — `PlaybookClausePatchResponse`

| Field | Type | Description |
|-------|------|-------------|
| `playbook` | `PlaybookApiView` | Updated full playbook |
| `updated_clause` | `PlaybookClauseView` | The clause after the edit |
| `draft_diff` | `object` | `{field_name, old_value, new_value, edited_by, edited_at}` |

```bash
curl -X PATCH https://louapi.com/api/playbooks/nda-playbook-v3/clauses/limitation-of-liability \
  -H 'Content-Type: application/json' \
  -d '{
    "field_name": "red_line",
    "value": "We will not accept uncapped liability under any circumstances.",
    "edited_by": "Peter"
  }' | jq '{field:.draft_diff.field_name, old:.draft_diff.old_value, new:.draft_diff.new_value}'
```

```bash
# View another clause's preferred position
curl -X PATCH https://louapi.com/api/playbooks/nda-playbook-v3/clauses/governing-law \
  -H 'Content-Type: application/json' \
  -d '{
    "field_name": "preferred_position",
    "value": "German law applies. Disputes resolved in Munich courts.",
    "edited_by": "Suzanne"
  }'
```

---

### POST /api/playbooks/{playbook_id}/publish

Publish a draft playbook. This is the single gate action — it freezes the playbook text, writes an immutable commit record, increments version state, and indexes all clauses into the Mega Brain vector store for semantic search.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `committed_by` | `string` | Yes | Lawyer name — required for audit trail |
| `comment` | `string` | Yes | Commit message describing what changed |

**Response** — `PublishPlaybookResponse`

| Field | Type | Description |
|-------|------|-------------|
| `playbook` | `PlaybookApiView` | Playbook now in `published` status |
| `commit_hash` | `string` | 12-character SHA-1 hash of this publish event |
| `mega_brain_entries` | `integer` | Number of clause vectors written to Mega Brain |

```bash
curl -X POST https://louapi.com/api/playbooks/nda-playbook-v3/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "committed_by": "Peter",
    "comment": "Approved by legal committee 2026-04-25. Updated red lines on liability and IP ownership."
  }' | jq '{hash:.commit_hash, entries:.mega_brain_entries, status:.playbook.status}'
```

```json
{
  "hash": "a3f7c91b2d04",
  "entries": 12,
  "status": "published"
}
```

```bash
# Attempt to publish a playbook with no clauses — returns 400
curl -X POST https://louapi.com/api/playbooks/empty-draft/publish \
  -H 'Content-Type: application/json' \
  -d '{"committed_by":"Peter","comment":"Test publish"}'
```

---

## 2. Public Playbook API

Prefix: `/api/public`

These endpoints expose **published** playbooks as a structured data layer for AI tools, contract review systems, and developer integrations. All endpoints under this prefix require the playbook to be in `published` status — any request against a draft or archived playbook returns `404`.

---

### GET /api/public/playbooks

List all published playbooks. Lightweight — no clause text returned.

**Response** — `list[PublicPlaybookListItem]`

| Field | Type | Description |
|-------|------|-------------|
| `playbook_id` | `string` | Slug identifier |
| `name` | `string` | Playbook name |
| `owner` | `string` | Owning lawyer |
| `version` | `integer` | Current published version |
| `published_at` | `string` | ISO 8601 publish timestamp |
| `clause_count` | `integer` | Number of clauses in this playbook |

```bash
curl https://louapi.com/api/public/playbooks | jq .
```

```bash
# Filter published playbooks for those owned by a particular lawyer
curl https://louapi.com/api/public/playbooks | jq '[.[] | select(.owner == "Peter")]'
```

---

### GET /api/public/playbooks/{playbook_id}/schema

Return the complete published playbook schema — all clauses with all hierarchy fields. This is the structured data payload downstream AI tools consume.

```bash
curl https://louapi.com/api/public/playbooks/nda-playbook-v3/schema \
  | jq '{id:.playbook_id, name:.name, clauses:(.clauses | length)}'
```

---

### POST /api/public/playbooks/{playbook_id}/ask

Ask the playbook a natural language question. Lou finds the most relevant clause, generates a grounded LLM answer, and returns citations with confidence scores.

This is the `lou_api/text` endpoint — returns structured playbook knowledge in response to free-text questions.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | Yes | Free-text legal question |

**Response** — `PublicAskResponse`

| Field | Type | Description |
|-------|------|-------------|
| `answer` | `string` | LLM-generated answer grounded in the playbook |
| `confidence` | `float` | Calibrated answer quality score (0.60–0.97) |
| `citations` | `list[PublicCitation]` | Supporting clauses with excerpts and raw match scores |

**PublicCitation fields**

| Field | Type | Description |
|-------|------|-------------|
| `clause_id` | `string` | Matched clause identifier |
| `clause_name` | `string` | Matched clause name |
| `excerpt` | `string` | First 220 characters of the preferred position |
| `confidence` | `float` | Raw semantic match score (0.0–1.0) |

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Can we accept unlimited liability?"}' \
  | jq '{answer:.answer, confidence:.confidence, clause:.citations[0].clause_name}'
```

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Who owns the intellectual property created during the engagement?"}' \
  | jq .
```

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"What is our fallback position on governing law if the counterparty insists on their jurisdiction?"}' \
  | jq '{answer:.answer, confidence:.confidence}'
```

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"At what point must we escalate a negotiation to senior legal?"}' \
  | jq '{answer:.answer, clause:.citations[0].clause_name}'
```

---

### POST /api/public/playbooks/{playbook_id}/match-clause

Match a single contract clause against the playbook and classify it against the negotiation hierarchy. This is the `lou_api/match` endpoint.

Returns which playbook position the incoming clause falls into (preferred, fallback, red line, escalation, or unclassified) with a multi-signal score breakdown.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clause_text` | `string` | Yes | The contract clause text to evaluate |
| `heading` | `string` | No | Section heading from the contract (improves matching) |

**Response** — `MatchClauseResponse`

| Field | Type | Description |
|-------|------|-------------|
| `matched_clause` | `PlaybookClauseView` | The playbook clause this contract clause was mapped to |
| `matched_hierarchy_position` | `string` | Text of the matched position |
| `classification` | `string` | `preferred`, `fallback_1`, `fallback_2`, `red_line`, `escalation` |
| `explanation` | `string` | LLM rationale for this classification |
| `score_breakdown` | `ScoreBreakdown` | Multi-signal score decomposition |
| `recommended_action` | `string` | Suggested next step |
| `needs_lawyer_review` | `boolean` | Whether a lawyer should review this match |

**ScoreBreakdown fields**

| Field | Type | Description |
|-------|------|-------------|
| `dense_embedding_score` | `float` | Semantic vector similarity |
| `lexical_score` | `float` | Keyword overlap score |
| `topic_alias_score` | `float` | Topic alias matching bonus |
| `structural_score` | `float` | Structural pattern match |
| `final_score` | `float` | Composite weighted score (0.0–1.0) |

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "The Receiving Party accepts unlimited liability for all direct, indirect, incidental, and consequential damages.",
    "heading": "Liability"
  }' | jq '{classification:.classification, clause:.matched_clause.clause_name, score:.score_breakdown.final_score, needs_review:.needs_lawyer_review}'
```

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "The recipient shall hold all confidential information in strict confidence for a period of five years.",
    "heading": "Confidentiality"
  }' | jq '{classification:.classification, action:.recommended_action, score:.score_breakdown}'
```

```bash
# Match a clause with no heading — Lou infers from content
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "Either party may terminate this agreement for convenience upon 30 days written notice."
  }' | jq '{classification:.classification, explanation:.explanation}'
```

```bash
# Match a clause that touches the red line
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "Liability shall be capped at one euro.",
    "heading": "Limitation of Liability"
  }' | jq '{classification:.classification, needs_review:.needs_lawyer_review}'
```

---

### POST /api/public/playbooks/{playbook_id}/suggest-rewrite

Given a contract clause and a matched playbook clause ID, generate a suggested rewrite that aligns the contract text with the playbook's preferred position while preserving the original business intent.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contract_clause` | `string` | Yes | The contract clause to rewrite |
| `matched_clause_id` | `string` | Yes | The `clause_id` from a prior `match-clause` response |

**Response** — `SuggestRewriteResponse`

| Field | Type | Description |
|-------|------|-------------|
| `matched_clause_id` | `string` | The playbook clause used as the target |
| `original` | `string` | The original contract clause text |
| `suggested_rewrite` | `string` | Rewritten clause aligned to playbook preferred position |
| `explanation` | `string` | Explanation of what was changed and why |

```bash
# Two-step: match then rewrite
CLAUSE_ID=$(curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/match-clause \
  -H 'Content-Type: application/json' \
  -d '{"clause_text":"Liability shall be capped at one euro.","heading":"Limitation of Liability"}' \
  | jq -r '.matched_clause.clause_id')

curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/suggest-rewrite \
  -H 'Content-Type: application/json' \
  -d "{
    \"contract_clause\": \"Liability shall be capped at one euro.\",
    \"matched_clause_id\": \"$CLAUSE_ID\"
  }" | jq '{rewrite:.suggested_rewrite, explanation:.explanation}'
```

```bash
# Suggest rewrite for a liability clause
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/suggest-rewrite \
  -H 'Content-Type: application/json' \
  -d '{
    "contract_clause": "Both parties waive all rights to seek consequential damages.",
    "matched_clause_id": "limitation-of-liability"
  }' | jq .
```

---

### POST /api/public/playbooks/{playbook_id}/analyze-contract

Analyze a full contract supplied as plain text. Lou segments the contract into clauses, maps each to the playbook hierarchy, classifies them, and returns a risk heatmap showing the distribution of preferred, fallback, red line, and unmapped positions.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | Yes | Full contract text |
| `source_filename` | `string` | No | Label for the source document (default: `pasted-contract.txt`) |

**Response** — `AnalyzeContractResponse`

| Field | Type | Description |
|-------|------|-------------|
| `playbook_id` | `string` | The playbook used for analysis |
| `segmented_contract` | `SegmentedContract` | The contract segmented into clauses |
| `clauses` | `list[AnalyzedContractClause]` | Each clause with its match and classification |
| `risk_heatmap` | `ContractRiskHeatmap` | Counts by classification bucket |
| `explanations` | `list[string]` | Human-readable explanation for each clause's classification |

**ContractRiskHeatmap fields**

| Field | Type | Description |
|-------|------|-------------|
| `preferred_count` | `integer` | Clauses matching preferred position |
| `fallback_count` | `integer` | Clauses in fallback 1 or 2 |
| `redline_count` | `integer` | Clauses that cross a red line |
| `escalation_count` | `integer` | Clauses triggering escalation |
| `unmapped_count` | `integer` | Clauses with no confident playbook match |

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/analyze-contract \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "1. Confidentiality\nThe Receiving Party shall keep all information confidential with reasonable care.\n\n2. Liability\nBoth parties accept unlimited liability for all damages.\n\n3. Governing Law\nThis agreement is governed by the laws of England and Wales.",
    "source_filename": "example-nda.txt"
  }' | jq '{preferred:.risk_heatmap.preferred_count, fallback:.risk_heatmap.fallback_count, red_line:.risk_heatmap.redline_count, unmapped:.risk_heatmap.unmapped_count}'
```

```bash
# Analyze a full NDA and view all explanations
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/analyze-contract \
  -H 'Content-Type: application/json' \
  -d @full-nda.json | jq '.explanations[]'
```

---

### POST /api/public/playbooks/{playbook_id}/analyze-contract-file

Same as `analyze-contract` but accepts a file upload (PDF, DOCX, or TXT). The file is parsed and segmented server-side.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `file` | Yes | Contract file (PDF, DOCX, TXT) |
| `source_filename` | `string` | No | Override display name for the document |

**Response** — Same as `analyze-contract`

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/analyze-contract-file \
  -F "file=@supplier-nda-draft.pdf" \
  | jq '{preferred:.risk_heatmap.preferred_count, red_line:.risk_heatmap.redline_count, unmapped:.risk_heatmap.unmapped_count}'
```

```bash
# Analyze a DOCX and get per-clause details
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/analyze-contract-file \
  -F "file=@counterparty-terms.docx" \
  -F "source_filename=counterparty-terms-2026-04-25.docx" \
  | jq '.clauses[] | {clause:.segmented_clause.heading, classification:.match.classification}'
```

---

### POST /api/public/playbooks/{playbook_id}/coverage-gaps

Identify contract clauses that do not map to any position in the playbook — content that falls outside what your playbook governs. Useful for spotting novel provisions that need lawyer attention before signing.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | Yes | Full contract text |
| `source_filename` | `string` | No | Label for the source document |

**Response** — `CoverageGapsResponse`

| Field | Type | Description |
|-------|------|-------------|
| `gaps` | `list[CoverageGap]` | Clauses with no confident playbook match |

**CoverageGap fields**

| Field | Type | Description |
|-------|------|-------------|
| `clause_id` | `string` | Internal identifier for the segmented clause |
| `heading` | `string\|null` | Section heading if detected |
| `text` | `string` | Raw clause text |
| `reason` | `string` | Explanation of why this clause is unmapped |

```bash
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/coverage-gaps \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "1. Payment\nInvoices are due 60 days after receipt.\n\n2. Force Majeure\nNeither party shall be liable for delays caused by events outside their control.",
    "source_filename": "incomplete-nda.txt"
  }' | jq '.gaps[] | {heading:.heading, reason:.reason}'
```

```bash
# Count unmapped clauses in a full contract
curl -s -X POST https://louapi.com/api/public/playbooks/nda-playbook-v3/coverage-gaps \
  -H 'Content-Type: application/json' \
  -d '{"text":"...full contract text..."}' \
  | jq '.gaps | length'
```

---

## 3. Mega Brain API

Prefix: `/api/mega-brain`

The Mega Brain is the company-level knowledge graph — a unified visualization of all published playbooks as interconnected islands. It is automatically populated when you publish a playbook.

---

### GET /api/mega-brain

Retrieve the complete Mega Brain: all published playbooks as islands, all nodes and edges within each island, and cross-island edges connecting thematically similar clauses across different playbooks.

**Response** — `MegaBrainView`

| Field | Type | Description |
|-------|------|-------------|
| `modules` | `list[MegaBrainModuleView]` | Lightweight index of all playbooks and their topics |
| `islands` | `list[MegaBrainIslandView]` | Full node and edge sets per playbook |
| `nodes` | `list[BrainNodeView]` | Flat list of all nodes across all islands |
| `edges` | `list[BrainEdgeView]` | All edges including cross-island links |

**MegaBrainModuleView fields**

| Field | Type | Description |
|-------|------|-------------|
| `playbook_id` | `string` | Playbook identifier |
| `playbook_version` | `integer` | Published version |
| `name` | `string` | Playbook name |
| `owner` | `string` | Owning lawyer |
| `topics` | `list[string]` | All clause names indexed in this playbook |
| `node_count` | `integer` | Total node count for the island |

```bash
curl https://louapi.com/api/mega-brain | jq '{total_nodes:(.nodes|length), total_edges:(.edges|length), playbooks:(.modules|length)}'
```

```bash
# List all playbooks in the brain with their topic counts
curl https://louapi.com/api/mega-brain | jq '.modules[] | {name:.name, owner:.owner, topics:(.topics|length)}'
```

```bash
# Find all cross-island edges (connections between different playbooks)
curl https://louapi.com/api/mega-brain | jq '[.edges[] | select(.edge_scope == "cross_island")]'
```

```bash
# See all nodes with warning or issue status
curl https://louapi.com/api/mega-brain | jq '[.nodes[] | select(.status != "clean") | {id:.id, status:.status, label:.label}]'
```

---

### GET /api/mega-brain/search

Semantic search across all published playbook clauses. Uses vector embeddings to find the most relevant clauses regardless of exact wording.

This is the `lou_api/experience` endpoint — returns clauses most semantically relevant to a query, drawn from the full corpus of published playbooks.

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Search query (minimum 2 characters) |

**Response** — `list[MegaBrainSearchResult]`

| Field | Type | Description |
|-------|------|-------------|
| `playbook_id` | `string` | Source playbook |
| `playbook_version` | `integer` | Version of the source playbook |
| `clause_id` | `string` | Matched clause identifier |
| `topic` | `string` | Clause name |
| `document` | `string` | Full clause text from the vector store |
| `similarity` | `float` | Cosine similarity score (0.0–1.0) |

Results are ranked by similarity descending, top 8 returned.

```bash
curl "https://louapi.com/api/mega-brain/search?q=limitation+of+liability" | jq '[.[] | {topic:.topic, playbook:.playbook_id, similarity:.similarity}]'
```

```bash
curl "https://louapi.com/api/mega-brain/search?q=data+protection+GDPR" | jq '.[0]'
```

```bash
curl "https://louapi.com/api/mega-brain/search?q=termination+for+convenience" \
  | jq '[.[] | {topic:.topic, playbook:.playbook_id, score:.similarity}]'
```

```bash
# Search for escalation triggers across all playbooks
curl "https://louapi.com/api/mega-brain/search?q=when+to+escalate+to+senior+legal" \
  | jq '.[] | {playbook:.playbook_id, clause:.topic, similarity:.similarity}'
```

---

## 4. Analysis API

Prefix: `/api/analysis`

The analysis engine runs deterministic hierarchy checks on draft playbook clauses and proposes issues for lawyer review. Analysis never mutates legal text — it only writes issue records and status flags. Lawyers then accept or reject each proposed fix explicitly.

---

### POST /api/analysis/playbook/{playbook_id}

Run analysis on all clauses in a playbook. Detects issues like:
- `hierarchy_inversion` — fallback is stricter than preferred
- `vague_red_line` — red line is too ambiguous to enforce
- `missing_escalation` — no escalation trigger defined when red line exists
- `duplicate_position` — preferred and fallback are identical
- `fallback_too_strict` — fallback is more restrictive than preferred
- `red_line_too_soft` — red line allows what preferred prohibits
- `unclear_business_language` — clause is written in opaque legalese

Existing open issues are cleared and regenerated on each run. Resolved issues (accepted or rejected) are tracked and not re-raised.

**Response** — `PlaybookApiView`

The full updated playbook with `analysis_status` and `analysis_summary` fields set per clause, and `issues` arrays populated.

| Clause status | Meaning |
|---------------|---------|
| `clean` | No open issues |
| `warning` | One or more warning-severity issues |
| `issue` | At least one critical-severity issue |

```bash
curl -X POST https://louapi.com/api/analysis/playbook/nda-playbook-v3 \
  | jq '[.clauses[] | {clause:.clause_name, status:.analysis_status, summary:.analysis_summary}]'
```

```bash
# Show only clauses with critical issues
curl -X POST https://louapi.com/api/analysis/playbook/nda-playbook-v3 \
  | jq '[.clauses[] | select(.analysis_status == "issue") | {name:.clause_name, issues:(.issues | length)}]'
```

---

### POST /api/analysis/issues/{issue_id}/accept-fix

Apply one proposed fix after explicit lawyer acceptance. This is the only way proposed fixes enter the live playbook — there is no auto-apply. Only fixable field types are eligible; structural issues require manual editing.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `issue_id` | `integer` | Issue ID from the `issues` array of a PlaybookClauseView |

**Response** — `PlaybookApiView`

The updated playbook with the fix applied to the relevant clause. Clause status is recalculated immediately.

```bash
# Accept fix for issue ID 42
curl -X POST https://louapi.com/api/analysis/issues/42/accept-fix \
  | jq '.clauses[] | select(.clause_id == "limitation-of-liability") | {status:.analysis_status, open_issues:(.issues | length)}'
```

```bash
# Accept a fix and confirm the clause is now clean
curl -X POST https://louapi.com/api/analysis/issues/7/accept-fix \
  | jq '[.clauses[] | select(.analysis_status != "clean") | {name:.clause_name, status:.analysis_status}]'
```

---

### POST /api/analysis/issues/{issue_id}/reject

Reject a proposed fix. The issue is permanently resolved as rejected and will not be re-raised by future analysis runs. The clause text is left unchanged.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `issue_id` | `integer` | Issue ID to reject |

**Response** — `PlaybookApiView`

```bash
curl -X POST https://louapi.com/api/analysis/issues/43/reject \
  | jq '{status:"rejected", clauses_with_issues:([.clauses[] | select(.analysis_status == "issue")] | length)}'
```

---

## 5. Rewrite API

Prefix: `/api/rewrite`

The rewrite API generates AI-assisted rewrites of playbook clause text in different styles. Rewrites are proposals only — they do not update the database. A lawyer must review the suggestion and apply it via the PATCH clause endpoint if approved.

**Rewrite modes**

| Mode | Description |
|------|-------------|
| `business_clear` | Plain business English, accessible to non-lawyers |
| `legal_precise` | Formal legal drafting language |
| `shorter` | Condensed version preserving all meaning |
| `humanized` | Conversational, relationship-oriented tone |

---

### POST /api/rewrite/cell

Rewrite a single field of a single clause.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `playbook_id` | `string` | Yes | Playbook identifier |
| `clause_id` | `string` | Yes | Clause identifier |
| `field_name` | `string` | Yes | Field to rewrite (e.g. `red_line`, `why_it_matters`) |
| `text` | `string` | Yes | Current text to rewrite |
| `mode` | `enum` | No | Rewrite mode (default: `business_clear`) |

**Response** — `RewriteCellResponse`

| Field | Type | Description |
|-------|------|-------------|
| `original` | `string` | The input text |
| `rewritten` | `string` | The AI-proposed rewrite |
| `meaning_preservation_note` | `string` | Explanation of what was and was not changed |

```bash
curl -X POST https://louapi.com/api/rewrite/cell \
  -H 'Content-Type: application/json' \
  -d '{
    "playbook_id": "nda-playbook-v3",
    "clause_id": "limitation-of-liability",
    "field_name": "why_it_matters",
    "text": "The limitation of liability clause circumscribes the quantum of damages recoverable by either party in the event of a tortious or contractual breach.",
    "mode": "business_clear"
  }' | jq '{original:.original, rewrite:.rewritten, note:.meaning_preservation_note}'
```

---

### POST /api/rewrite/row

Rewrite all populated fields of one clause in a single call.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `playbook_id` | `string` | Yes | Playbook identifier |
| `clause_id` | `string` | Yes | Clause identifier |
| `mode` | `enum` | No | Rewrite mode (default: `business_clear`) |

**Response** — `RewriteRowResponse` with a `rewrites` array of `RewriteCellResponse` objects.

```bash
curl -X POST https://louapi.com/api/rewrite/row \
  -H 'Content-Type: application/json' \
  -d '{"playbook_id":"nda-playbook-v3","clause_id":"confidentiality","mode":"shorter"}' \
  | jq '.rewrites[] | {field:.field_name, rewrite:.rewritten}'
```

---

### POST /api/rewrite/playbook

Rewrite every field of every clause in a playbook. Long-running for large playbooks.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `playbook_id` | `string` | Yes | Playbook identifier |
| `mode` | `enum` | No | Rewrite mode (default: `business_clear`) |

**Response** — `RewritePlaybookResponse` with a flat `rewrites` list across all clauses.

```bash
curl -X POST https://louapi.com/api/rewrite/playbook \
  -H 'Content-Type: application/json' \
  -d '{"playbook_id":"nda-playbook-v3","mode":"humanized"}' \
  | jq '.rewrites | length'
```

---

## 6. RAG Chat API

Prefix: `/api/chat`

Conversational interface to the company knowledge base. Retrieves the most relevant playbook rules from the vector store and generates a grounded answer with source citations.

---

### POST /api/chat

Ask a question in natural language. Conversation history can be supplied to enable multi-turn dialogue.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | `string` | Yes | The user's question |
| `history` | `list[ChatMessage]` | No | Prior conversation turns |
| `lawyer_name` | `string` | No | Display name for the requester |

**ChatMessage shape**

```json
{"role": "user" | "assistant", "content": "..."}
```

**Response** — `ChatResponse`

| Field | Type | Description |
|-------|------|-------------|
| `answer` | `string` | Generated answer |
| `sources` | `list[SourceCitation]` | Supporting rules with excerpts and confidence |
| `retrieved_rules` | `list[string]` | Rule IDs retrieved from the vector store |

**SourceCitation fields**

| Field | Type | Description |
|-------|------|-------------|
| `rule_id` | `string` | Unique rule identifier |
| `topic` | `string` | Rule topic |
| `excerpt` | `string` | Relevant excerpt |
| `confidence` | `float` | Retrieval confidence score |

```bash
curl -s -X POST https://louapi.com/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is our position on limitation of liability in supplier agreements?",
    "lawyer_name": "Suzanne"
  }' | jq '{answer:.answer, sources:([.sources[] | {topic:.topic, confidence:.confidence}])}'
```

```bash
# Multi-turn conversation
curl -s -X POST https://louapi.com/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Can you give me the fallback position on that?",
    "history": [
      {"role":"user","content":"What is our IP ownership position?"},
      {"role":"assistant","content":"Our preferred position is that all IP created during the engagement belongs to the client..."}
    ],
    "lawyer_name": "Peter"
  }' | jq .answer
```

```bash
# Ask about escalation procedures
curl -s -X POST https://louapi.com/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"When should a junior lawyer escalate to a partner on liability clauses?"}' \
  | jq '{answer:.answer, rules:.retrieved_rules}'
```

---

## 7. History and Review API

These two APIs cover the full audit trail and the human-in-the-loop approval workflow for proposed rule changes surfaced by document analysis.

---

### Commits API — GET /api/commits

Return commit history ordered by most recent. Commits are created when playbooks are published or when proposed changes are approved through the review queue.

Prefix: `/api/commits`

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rule_id` | `string` | No | Filter to commits for a specific rule |
| `page` | `integer` | No | Page number (default: 1) |
| `limit` | `integer` | No | Results per page (default: 50, max: 200) |

**Response** — `list[Commit]`

| Field | Type | Description |
|-------|------|-------------|
| `commit_hash` | `string` | Unique 12-char SHA-1 hash |
| `rule_id` | `string` | Rule that was changed |
| `topic` | `string` | Human-readable topic |
| `change_type` | `enum` | `initial`, `confirms`, `contradicts`, `extends`, `new_rule`, `manual` |
| `old_value` | `string\|null` | Previous value snapshot (JSON) |
| `new_value` | `string` | New value (JSON) |
| `committed_by` | `string` | Lawyer who committed the change |
| `committed_at` | `string` | ISO 8601 timestamp |
| `approval_status` | `enum` | `approved` / `rejected` |

```bash
curl "https://louapi.com/api/commits" | jq '[.[] | {hash:.commit_hash, topic:.topic, by:.committed_by, type:.change_type}]'
```

```bash
# Filter commits by rule
curl "https://louapi.com/api/commits?rule_id=limitation-of-liability&limit=10" | jq .
```

```bash
# Paginate through commit history
curl "https://louapi.com/api/commits?page=2&limit=25" | jq '[.[] | {hash:.commit_hash, at:.committed_at}]'
```

---

### Review Queue — GET /api/review

List all pending proposed changes, sorted by priority: `contradicts` first (highest risk), then `extends`, `new_rule`, `confirms`.

Prefix: `/api/review`

**Response** — `list[ProposedCommit]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `integer` | Proposed commit ID |
| `rule_id` | `string` | Target rule |
| `topic` | `string` | Rule topic |
| `change_type` | `enum` | The nature of the proposed change |
| `existing_rule_snapshot` | `string\|null` | JSON snapshot of the current rule |
| `proposed_change` | `string` | JSON payload of the proposed update |
| `source_document` | `string` | Document that triggered this proposal |
| `source_clause` | `string` | Verbatim clause from the source document |
| `cosine_similarity` | `float` | Similarity between source and existing rule |
| `ai_reasoning` | `string` | LLM explanation of why this change is proposed |
| `approval_status` | `enum` | `pending` / `approved` / `rejected` |
| `created_at` | `string` | ISO 8601 timestamp |

```bash
curl https://louapi.com/api/review | jq '[.[] | {id:.id, topic:.topic, change_type:.change_type, similarity:.cosine_similarity}]'
```

```bash
# Show only contradicting proposals (highest priority)
curl https://louapi.com/api/review | jq '[.[] | select(.change_type == "contradicts")]'
```

---

### Approve or Reject — POST /api/review/{proposed_id}/approve

Approve or reject a proposed change. Approvals write the change to the live rule, bump the rule version, and create an immutable commit record. Rejections are also recorded in history for audit purposes.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `proposed_id` | `integer` | The proposed commit ID |

**Request body** — `ApprovalRequest`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `decision` | `enum` | Yes | `approved` or `rejected` |
| `lawyer_name` | `string` | Yes | Name of the reviewing lawyer |
| `lawyer_note` | `string` | No | Optional note recorded in the commit |
| `proposed_text` | `string` | No | Lawyer-edited version of the proposed text (overrides AI proposal) |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `enum` | Final approval status |
| `commit_hash` | `string` | Hash of the created commit record |
| `item` | `object` | Updated proposed commit |

```bash
# Approve a proposed change
curl -X POST https://louapi.com/api/review/12/approve \
  -H 'Content-Type: application/json' \
  -d '{
    "decision": "approved",
    "lawyer_name": "Suzanne",
    "lawyer_note": "Confirmed with the commercial team. New cap is acceptable.",
    "proposed_text": "Liability is capped at the contract value for the preceding 12 months."
  }' | jq '{status:.status, hash:.commit_hash}'
```

```bash
# Reject a proposed change with a reason
curl -X POST https://louapi.com/api/review/15/approve \
  -H 'Content-Type: application/json' \
  -d '{
    "decision": "rejected",
    "lawyer_name": "Peter",
    "lawyer_note": "This contradicts our board-approved red line. Not acceptable."
  }' | jq '{status:.status, hash:.commit_hash}'
```

```bash
# Approve a new rule proposal
curl -X POST https://louapi.com/api/review/8/approve \
  -H 'Content-Type: application/json' \
  -d '{
    "decision": "approved",
    "lawyer_name": "Suzanne",
    "proposed_text": "Data processing agreements must comply with GDPR Article 28 requirements."
  }' | jq .
```

---

## Schema Reference

### PlaybookClauseView

The core data structure representing one clause in a playbook.

| Field | Type | Description |
|-------|------|-------------|
| `clause_id` | `string` | Slug identifier (e.g. `limitation-of-liability`) |
| `clause_number` | `string` | Original row number from the XLSX |
| `clause_name` | `string` | Full clause name |
| `why_it_matters` | `string` | Business context and rationale |
| `preferred_position` | `string` | Our ideal contractual position |
| `fallback_1` | `string\|null` | Acceptable fallback if preferred is rejected |
| `fallback_2` | `string\|null` | Second acceptable fallback |
| `red_line` | `string\|null` | Position we will not go below under any circumstances |
| `escalation_trigger` | `string\|null` | Conditions requiring escalation to senior legal |
| `rewritten_fields` | `object` | Accepted rewrites keyed by field name, includes `_draft_history` |
| `analysis_status` | `enum` | `clean` / `warning` / `issue` |
| `analysis_summary` | `string\|null` | Human-readable summary of open issues |
| `issues` | `list[PlaybookIssueView]` | Open analysis issues for this clause |

### PlaybookIssueView

| Field | Type | Description |
|-------|------|-------------|
| `id` | `integer` | Issue database ID |
| `clause_id` | `string` | Parent clause |
| `field_name` | `string` | Affected field |
| `severity` | `enum` | `info` / `warning` / `critical` |
| `issue_type` | `enum` | One of the 7 issue types above |
| `explanation` | `string` | Why this is flagged |
| `proposed_fix` | `string\|null` | AI-proposed replacement text |
| `accepted` | `boolean` | Whether the lawyer accepted this fix |
| `rejected` | `boolean` | Whether the lawyer rejected this fix |
| `resolved_at` | `string\|null` | ISO 8601 timestamp of resolution |
