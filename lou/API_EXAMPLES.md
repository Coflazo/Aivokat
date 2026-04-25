# Lou API — 10 Curl Test Examples

Replace `phase-8-verification-playbook` with your published `playbook_id`.

---

## 1. List published playbooks
```bash
curl http://localhost:8000/api/public/playbooks | jq .
```

## 2. Get full playbook schema
```bash
curl http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/schema | jq '{id:.playbook_id, name:.name, clauses:(.clauses | length)}'
```

## 3. Ask the playbook a question
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Can we accept unlimited liability?"}' | jq '{answer:.answer, confidence:.confidence, clause:.citations[0].clause_name}'
```

## 4. Ask about IP ownership
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Who owns the intellectual property created during the engagement?"}' | jq .
```

## 5. Match a single contract clause
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "The Receiving Party accepts unlimited liability for all direct, indirect, incidental, and consequential damages.",
    "heading": "Liability"
  }' | jq '{classification:.classification, clause:.matched_clause.clause_name, score:.score_breakdown.final_score, needs_review:.needs_lawyer_review}'
```

## 6. Match a confidentiality clause
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/match-clause \
  -H 'Content-Type: application/json' \
  -d '{
    "clause_text": "The recipient shall hold all confidential information in strict confidence for a period of five years.",
    "heading": "Confidentiality"
  }' | jq '{classification:.classification, action:.recommended_action, score:.score_breakdown}'
```

## 7. Suggest a rewrite (run after Match, use clause_id from response)
```bash
CLAUSE_ID=$(curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/match-clause \
  -H 'Content-Type: application/json' \
  -d '{"clause_text":"Liability shall be capped at one euro.","heading":"Limitation of Liability"}' | jq -r '.matched_clause.clause_id')

curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/suggest-rewrite \
  -H 'Content-Type: application/json' \
  -d "{
    \"contract_clause\": \"Liability shall be capped at one euro.\",
    \"matched_clause_id\": \"$CLAUSE_ID\"
  }" | jq '{rewrite:.suggested_rewrite, explanation:.explanation}'
```

## 8. Analyze a full contract (text)
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/analyze-contract \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "1. Confidentiality\nThe Receiving Party shall keep all information confidential with reasonable care.\n\n2. Liability\nBoth parties accept unlimited liability for all damages.\n\n3. Governing Law\nThis agreement is governed by the laws of England and Wales.",
    "source_filename": "example-nda.txt"
  }' | jq '{preferred:.risk_heatmap.preferred_count, fallback:.risk_heatmap.fallback_count, red_line:.risk_heatmap.redline_count, unmapped:.risk_heatmap.unmapped_count}'
```

## 9. Upload a contract PDF for analysis
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/analyze-contract-file \
  -F "file=@/path/to/your-contract.pdf" | jq '{preferred:.risk_heatmap.preferred_count, red_line:.risk_heatmap.redline_count}'
```

## 10. Find coverage gaps in a contract
```bash
curl -s -X POST http://localhost:8000/api/public/playbooks/phase-8-verification-playbook/coverage-gaps \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "1. Payment\nInvoices are due 60 days after receipt.\n\n2. Force Majeure\nNeither party shall be liable for delays caused by events outside their control.",
    "source_filename": "incomplete-nda.txt"
  }' | jq '.gaps[] | {heading:.heading, reason:.reason}'
```

---

*Start the backend: `cd lou && uvicorn backend.main:app --reload`*
*Start the frontend: `cd lou && npm run dev`*
