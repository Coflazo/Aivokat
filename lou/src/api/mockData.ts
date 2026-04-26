import type {
  AnalyzeContractResponse,
  MegaBrain,
  PlaybookApi,
  PlaybookBrain,
  PublicPlaybookListItem,
  PublishPlaybookResponse,
} from '../types'

// ─── Shared clause data ───────────────────────────────────────────────────────
const MOCK_CLAUSES = [
  {
    clause_id: 'clause-confidentiality',
    clause_number: '1',
    clause_name: 'Definition of Confidential Information',
    why_it_matters: 'Broad definitions reduce ambiguity in enforcement.',
    preferred_position: 'All non-public information disclosed in any form, including trade secrets, know-how, source code, and business data.',
    fallback_1: 'Written information marked Confidential; oral information confirmed in writing within 10 days.',
    fallback_2: null,
    red_line: 'No "residuals" carve-out. No exclusion for information in memory.',
    escalation_trigger: 'Any attempt to narrow to written-only requires senior counsel sign-off.',
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-obligations',
    clause_number: '2',
    clause_name: 'Obligations of Receiving Party',
    why_it_matters: 'Core duty of care must meet the same standard as the party applies to its own secrets.',
    preferred_position: 'Strict confidence, no third-party disclosure, use solely for evaluation, same security measures as own confidential data, no less than reasonable care.',
    fallback_1: 'Reasonable security measures; disclosure only to those with direct need-to-know.',
    fallback_2: null,
    red_line: 'No obligation lighter than "reasonable care". No right to use for purposes beyond stated scope.',
    escalation_trigger: 'Requested deviation to "efforts" standard triggers legal review.',
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-recipients',
    clause_number: '3',
    clause_name: 'Permitted Recipients',
    why_it_matters: 'Limits blast radius in case of breach.',
    preferred_position: 'Employees, contractors, legal counsel, and financial advisors with strict need-to-know, bound by equivalent written confidentiality obligations.',
    fallback_1: 'Employees and legal counsel only; contractors require prior written approval.',
    fallback_2: null,
    red_line: 'No affiliate-wide disclosure rights without explicit carve-out.',
    escalation_trigger: null,
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-term',
    clause_number: '4',
    clause_name: 'Term and Termination',
    why_it_matters: 'Post-termination survival period determines ongoing exposure.',
    preferred_position: '3-year agreement; confidentiality obligations survive termination for 5 years.',
    fallback_1: '2-year agreement; 3-year survival of confidentiality obligations.',
    fallback_2: null,
    red_line: 'Confidentiality survival below 3 years is unacceptable without board approval.',
    escalation_trigger: 'Any attempt to cap survival below 3 years requires legal escalation.',
    rewritten_fields: {},
    analysis_status: 'warning' as const,
    analysis_summary: 'Fallback survival period may expose IP in long-cycle procurement.',
    issues: [],
  },
  {
    clause_id: 'clause-return',
    clause_number: '5',
    clause_name: 'Return or Destruction',
    why_it_matters: 'Ensures information is not retained after relationship ends.',
    preferred_position: 'Prompt return or permanent destruction of all copies, including extracts, certified in writing within 10 business days.',
    fallback_1: 'Destruction of physical copies; electronic copies purged within 30 days with written certification.',
    fallback_2: null,
    red_line: 'No exception for backup retention without explicit security protocol.',
    escalation_trigger: null,
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-ip',
    clause_number: '6',
    clause_name: 'Intellectual Property and Ownership',
    why_it_matters: 'Prevents implied license or IP transfer during evaluation.',
    preferred_position: 'No license or IP rights granted. All information remains exclusive property of Disclosing Party. Nothing transfers patents, trademarks, or copyrights.',
    fallback_1: 'Limited license to use solely for stated evaluation purpose; no sub-license right.',
    fallback_2: null,
    red_line: 'No implied license language. No joint IP creation outside a separate written agreement.',
    escalation_trigger: 'Any license grant beyond evaluation use requires IP counsel review.',
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-governing-law',
    clause_number: '7',
    clause_name: 'Governing Law and Dispute Resolution',
    why_it_matters: 'Determines enforcement jurisdiction and cost of dispute.',
    preferred_position: 'German law governs; disputes first mediated then ICC arbitration in Munich.',
    fallback_1: 'German law governs; exclusive jurisdiction of Munich courts.',
    fallback_2: null,
    red_line: 'No foreign law (non-EU) without GC approval.',
    escalation_trigger: 'Counterparty insistence on US or UK law triggers General Counsel review.',
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-liability',
    clause_number: '8',
    clause_name: 'Liability and Remedies',
    why_it_matters: 'Ensures injunctive relief is available for irreparable harm; limits financial exposure.',
    preferred_position: 'Breach causes irreparable harm entitling injunctive relief without bond; aggregate liability capped at EUR 50,000.',
    fallback_1: 'Injunctive relief acknowledged; liability cap EUR 25,000.',
    fallback_2: null,
    red_line: 'No waiver of injunctive relief. Liability cap below EUR 25,000 is unacceptable.',
    escalation_trigger: 'Any limitation on injunctive remedies requires immediate legal escalation.',
    rewritten_fields: {},
    analysis_status: 'issue' as const,
    analysis_summary: 'EUR 50,000 cap may be insufficient for high-value IP disclosures.',
    issues: [],
  },
  {
    clause_id: 'clause-general',
    clause_number: '9',
    clause_name: 'General Provisions',
    why_it_matters: 'Integration clause prevents reliance on prior oral assurances.',
    preferred_position: 'Entire agreement; supersedes all prior agreements; amendment requires written signature of both parties.',
    fallback_1: 'Entire agreement; prior oral agreements superseded; amendments in writing.',
    fallback_2: null,
    red_line: null,
    escalation_trigger: null,
    rewritten_fields: {},
    analysis_status: 'clean' as const,
    analysis_summary: null,
    issues: [],
  },
]

// ─── Brain nodes ──────────────────────────────────────────────────────────────
function makeNodes() {
  const nodes: PlaybookBrain['nodes'] = []
  MOCK_CLAUSES.forEach((c) => {
    nodes.push({
      id: c.clause_id,
      label: c.clause_name,
      status: c.analysis_status,
      color: '#007c79',
      node_type: 'clause',
      text: c.why_it_matters,
      clause: c,
    })
    nodes.push({
      id: `${c.clause_id}:preferred`,
      label: 'Preferred',
      status: 'clean',
      color: '#007c79',
      node_type: 'preferred',
      text: c.preferred_position,
      clause: c,
    })
    if (c.fallback_1) {
      nodes.push({
        id: `${c.clause_id}:fallback_1`,
        label: 'Fallback 1',
        status: 'clean',
        color: '#9b6f43',
        node_type: 'fallback_1',
        text: c.fallback_1,
        clause: c,
      })
    }
    if (c.red_line) {
      nodes.push({
        id: `${c.clause_id}:red_line`,
        label: 'Red line',
        status: c.analysis_status === 'issue' ? 'issue' : 'clean',
        color: '#4a2430',
        node_type: 'red_line',
        text: c.red_line,
        clause: c,
      })
    }
    if (c.escalation_trigger) {
      nodes.push({
        id: `${c.clause_id}:escalation`,
        label: 'Escalation',
        status: 'clean',
        color: '#ec6602',
        node_type: 'escalation',
        text: c.escalation_trigger,
        clause: c,
      })
    }
  })
  return nodes
}

function makeEdges(): PlaybookBrain['edges'] {
  const edges: PlaybookBrain['edges'] = []
  MOCK_CLAUSES.forEach((c) => {
    edges.push({ source: c.clause_id, target: `${c.clause_id}:preferred`, similarity: 0.92, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.fallback_1) edges.push({ source: c.clause_id, target: `${c.clause_id}:fallback_1`, similarity: 0.74, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.red_line) edges.push({ source: c.clause_id, target: `${c.clause_id}:red_line`, similarity: 0.82, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.escalation_trigger) edges.push({ source: c.clause_id, target: `${c.clause_id}:escalation`, similarity: 0.68, relationship: 'playbook_hierarchy', edge_scope: 'island' })
  })
  // Cross-island semantic edges
  edges.push({ source: 'clause-confidentiality', target: 'clause-obligations', similarity: 0.61, relationship: 'semantic_similarity', edge_scope: 'cross_island' })
  edges.push({ source: 'clause-obligations', target: 'clause-recipients', similarity: 0.55, relationship: 'semantic_similarity', edge_scope: 'cross_island' })
  edges.push({ source: 'clause-term', target: 'clause-return', similarity: 0.48, relationship: 'semantic_similarity', edge_scope: 'cross_island' })
  edges.push({ source: 'clause-ip', target: 'clause-general', similarity: 0.41, relationship: 'semantic_similarity', edge_scope: 'cross_island' })
  edges.push({ source: 'clause-liability', target: 'clause-governing-law', similarity: 0.38, relationship: 'semantic_similarity', edge_scope: 'cross_island' })
  return edges
}

export const MOCK_BRAIN: PlaybookBrain = {
  playbook_id: 'sample-nda-playbook-csv',
  version: 3,
  status: 'published',
  nodes: makeNodes(),
  edges: makeEdges(),
}

// ─── Public playbook list ─────────────────────────────────────────────────────
export const MOCK_PUBLIC_PLAYBOOKS: PublicPlaybookListItem[] = [
  {
    playbook_id: 'sample-nda-playbook-csv',
    name: 'Standard NDA 2024',
    owner: 'Siemens Legal',
    version: 3,
    published_at: '2024-03-15T10:00:00Z',
    clause_count: 9,
  },
  {
    playbook_id: 'procurement-nda-v2',
    name: 'Procurement NDA v2',
    owner: 'Procurement Legal',
    version: 2,
    published_at: '2024-01-20T09:00:00Z',
    clause_count: 7,
  },
]

// ─── All playbooks (peter view) ───────────────────────────────────────────────
export const MOCK_ALL_PLAYBOOKS: PlaybookApi[] = [
  {
    playbook_id: 'sample-nda-playbook-csv',
    name: 'Standard NDA 2024',
    description: 'Mutual non-disclosure agreement for supplier evaluations.',
    owner: 'Siemens Legal',
    version: 3,
    status: 'published',
    source_filename: 'Sample NDA Playbook.csv',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-03-15T10:00:00Z',
    published_at: '2024-03-15T10:00:00Z',
    clauses: MOCK_CLAUSES,
  },
  {
    playbook_id: 'procurement-nda-v2',
    name: 'Procurement NDA v2',
    description: 'Lightweight NDA for procurement onboarding.',
    owner: 'Procurement Legal',
    version: 2,
    status: 'published',
    source_filename: 'Procurement NDA v2.xlsx',
    created_at: '2023-11-01T08:00:00Z',
    updated_at: '2024-01-20T09:00:00Z',
    published_at: '2024-01-20T09:00:00Z',
    clauses: MOCK_CLAUSES.slice(0, 7),
  },
  {
    playbook_id: 'tech-partnership-nda',
    name: 'Tech Partnership NDA',
    description: 'Draft NDA for technology partnership deals.',
    owner: 'Coflazo Legal Tech',
    version: 1,
    status: 'draft',
    source_filename: 'Tech Partnership NDA.docx',
    created_at: '2024-04-01T14:00:00Z',
    updated_at: '2024-04-20T16:00:00Z',
    published_at: null,
    clauses: MOCK_CLAUSES.slice(0, 5),
  },
]

// ─── Contract analysis (matches DEMO_CONTRACT_TEXT) ───────────────────────────
function score(dense: number, lexical: number, topic: number, structural: number) {
  const final = dense * 0.45 + lexical * 0.25 + topic * 0.20 + structural * 0.10
  return { dense_embedding_score: dense, lexical_score: lexical, topic_alias_score: topic, structural_score: structural, final_score: +final.toFixed(3) }
}

const CONTRACT_SECTIONS = [
  {
    heading: 'DEFINITION OF CONFIDENTIAL INFORMATION',
    text: '"Confidential Information" means any non-public technical, business or financial information disclosed by one party to the other, whether in writing, orally, or electronically, including trade secrets, product roadmaps, source code, customer lists, pricing data, and know-how.',
    clauseId: 'clause-confidentiality',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Broad multi-form definition aligned with preferred position. Explicit enumeration of categories (trade secrets, source code, pricing) meets Siemens standard.',
    scoreBreakdown: score(0.91, 0.87, 0.94, 0.88),
    action: 'Accept as-is',
  },
  {
    heading: 'OBLIGATIONS OF RECEIVING PARTY',
    text: 'The Receiving Party shall: (a) hold all Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent; (c) use it solely to evaluate a potential business relationship; (d) apply at least the same security measures it uses for its own confidential data, but no less than reasonable care.',
    clauseId: 'clause-obligations',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Four-part obligation structure matches preferred position exactly. "Same measures as own data, no less than reasonable care" language is verbatim preferred standard.',
    scoreBreakdown: score(0.94, 0.92, 0.96, 0.90),
    action: 'Accept as-is',
  },
  {
    heading: 'PERMITTED RECIPIENTS',
    text: 'Confidential Information may be shared only with employees, contractors, legal counsel and financial advisors who have a strict need-to-know and are bound by written confidentiality obligations at least as restrictive as those herein.',
    clauseId: 'clause-recipients',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Recipient list matches preferred position. "At least as restrictive" downstream obligation is the correct standard.',
    scoreBreakdown: score(0.89, 0.85, 0.91, 0.87),
    action: 'Accept as-is',
  },
  {
    heading: 'TERM AND TERMINATION',
    text: 'This Agreement is effective on the date signed and continues for three (3) years. Either party may terminate with 30 days written notice. Confidentiality obligations survive termination for five (5) years.',
    clauseId: 'clause-term',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: '3-year term and 5-year survival exactly match preferred position. 30-day termination notice is acceptable.',
    scoreBreakdown: score(0.95, 0.93, 0.97, 0.92),
    action: 'Accept as-is',
  },
  {
    heading: 'RETURN OR DESTRUCTION',
    text: 'Upon request or termination, the Receiving Party shall promptly return or permanently destroy all Confidential Information, including copies and extracts, and certify destruction in writing within 10 business days.',
    clauseId: 'clause-return',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Preferred position met: prompt return/destruction, includes extracts and copies, written certification within 10 business days.',
    scoreBreakdown: score(0.92, 0.90, 0.93, 0.91),
    action: 'Accept as-is',
  },
  {
    heading: 'INTELLECTUAL PROPERTY AND OWNERSHIP',
    text: 'No license or intellectual property rights are granted. All Confidential Information remains the exclusive property of the Disclosing Party. Nothing herein transfers ownership of any patents, trademarks, or copyrights.',
    clauseId: 'clause-ip',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Strong no-license clause with explicit enumeration (patents, trademarks, copyrights). Matches preferred position exactly.',
    scoreBreakdown: score(0.93, 0.91, 0.95, 0.89),
    action: 'Accept as-is',
  },
  {
    heading: 'GOVERNING LAW AND DISPUTE RESOLUTION',
    text: 'This Agreement is governed by the laws of Germany. Disputes shall first be submitted to mediation, then to binding arbitration under ICC rules in Munich, Germany.',
    clauseId: 'clause-governing-law',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'German law with ICC arbitration in Munich is the preferred position. Mediation-first step is an acceptable addition.',
    scoreBreakdown: score(0.90, 0.88, 0.92, 0.86),
    action: 'Accept as-is',
  },
  {
    heading: 'LIABILITY AND REMEDIES',
    text: 'The parties acknowledge that breach would cause irreparable harm entitling the Disclosing Party to seek injunctive relief without bond. Aggregate liability under this Agreement shall not exceed EUR 50,000.',
    clauseId: 'clause-liability',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Injunctive relief without bond preserved. EUR 50,000 cap matches preferred but may be tight for high-value IP — flag for senior review on large deals.',
    scoreBreakdown: score(0.88, 0.84, 0.89, 0.85),
    action: 'Flag for lawyer review on high-value transactions',
  },
  {
    heading: 'GENERAL PROVISIONS',
    text: 'This Agreement is the entire agreement between the parties regarding its subject matter and supersedes all prior oral and written agreements. It may not be amended except in writing signed by both parties.',
    clauseId: 'clause-general',
    hierarchy: 'preferred',
    classification: 'preferred_position',
    explanation: 'Standard entire-agreement and amendment clause. Matches preferred position exactly.',
    scoreBreakdown: score(0.87, 0.86, 0.90, 0.88),
    action: 'Accept as-is',
  },
]

export const MOCK_CONTRACT_ANALYSIS: AnalyzeContractResponse = {
  playbook_id: 'sample-nda-playbook-csv',
  segmented_contract: {
    source_filename: 'Demo-NDA.txt',
    clauses: CONTRACT_SECTIONS.map((s, i) => ({
      clause_id: `contract-clause-${i + 1}`,
      heading: s.heading,
      text: s.text,
      start_page: 1,
      end_page: 1,
      boundary_confidence: 0.96,
      boundary_reason: 'Clear section heading and paragraph boundary.',
      extraction_method: 'heading_detection',
    })),
    segmentation_summary: '9 sections detected with high confidence. All major NDA topics covered.',
    low_confidence_count: 0,
  },
  clauses: CONTRACT_SECTIONS.map((s, i) => ({
    segmented_clause: {
      clause_id: `contract-clause-${i + 1}`,
      heading: s.heading,
      text: s.text,
      start_page: 1,
      end_page: 1,
      boundary_confidence: 0.96,
      boundary_reason: 'Clear section heading.',
      extraction_method: 'heading_detection',
    },
    match: {
      matched_clause: MOCK_CLAUSES.find(c => c.clause_id === s.clauseId)!,
      matched_hierarchy_position: s.hierarchy,
      classification: s.classification,
      explanation: s.explanation,
      score_breakdown: s.scoreBreakdown,
      recommended_action: s.action,
      needs_lawyer_review: s.action.includes('Flag') || s.action.includes('lawyer'),
    },
  })),
  risk_heatmap: {
    preferred_count: 9,
    fallback_count: 0,
    redline_count: 0,
    escalation_count: 0,
    unmapped_count: 0,
  },
  explanations: [
    'All 9 contract sections matched to playbook clauses at preferred-position standard.',
    'Liability cap (EUR 50,000) should be reviewed on high-value deals.',
    'No red-line violations detected. Contract is ready for signature subject to deal-size review.',
  ],
}

// ─── Mega brain ───────────────────────────────────────────────────────────────
export const MOCK_MEGA_BRAIN: MegaBrain = {
  modules: [
    { playbook_id: 'sample-nda-playbook-csv', playbook_version: 3, name: 'Standard NDA 2024', owner: 'Siemens Legal', topics: ['confidentiality', 'ip', 'governing-law', 'liability'], node_count: 36 },
    { playbook_id: 'procurement-nda-v2', playbook_version: 2, name: 'Procurement NDA v2', owner: 'Procurement Legal', topics: ['confidentiality', 'obligations', 'term'], node_count: 21 },
  ],
  islands: [],
  nodes: makeNodes(),
  edges: makeEdges(),
}

// ─── Publish response ─────────────────────────────────────────────────────────
export const MOCK_PUBLISH_RESPONSE = (playbookId: string): PublishPlaybookResponse => ({
  playbook: MOCK_ALL_PLAYBOOKS.find(p => p.playbook_id === playbookId) ?? MOCK_ALL_PLAYBOOKS[0],
  commit_hash: Math.random().toString(16).slice(2, 11),
  mega_brain_entries: 36,
})

// ─── Upload response ──────────────────────────────────────────────────────────
export const MOCK_UPLOAD_RESPONSE = (name: string, owner: string) => ({
  playbook: {
    playbook_id: `playbook-${Date.now()}`,
    name,
    description: 'Uploaded playbook',
    owner,
    version: 1,
    status: 'draft' as const,
    source_filename: name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: null,
    clauses: MOCK_CLAUSES,
  },
  clauses_created: 9,
})
