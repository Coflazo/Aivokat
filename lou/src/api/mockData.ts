import type {
  AnalyzeContractResponse,
  BrainEdgeView,
  MegaBrain,
  PlaybookApi,
  PlaybookBrain,
  PlaybookClause,
  PublicPlaybookListItem,
  PublishPlaybookResponse,
} from '../types'

// ─── REAL Standard NDA Playbook — 14 clauses from actual CSV ─────────────────
export const STANDARD_NDA_CLAUSES: PlaybookClause[] = [
  {
    clause_id: 'clause-nda-type',
    clause_number: '1',
    clause_name: 'Type of NDA',
    why_it_matters: 'Determines if our info is protected — a mutual NDA protects both parties equally.',
    preferred_position: 'Bilateral (mutual) NDA with mirrored obligations on both parties.',
    fallback_1: 'Convert unilateral to bilateral by mirroring obligations in a side letter.',
    fallback_2: 'Accept a unilateral NDA only if our organization is the sole disclosing party.',
    red_line: 'Unilateral NDA where you are the receiving party only and you will share information.',
    escalation_trigger: 'Counterparty refuses bilateral and you will share information — escalate to senior legal.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-marking',
    clause_number: '2',
    clause_name: 'Marking of Confidential Information',
    why_it_matters: 'Controls scope of what is protected and the compliance burden on both parties.',
    preferred_position: 'Information is confidential if marked OR if its confidential nature would be evident to a reasonable person.',
    fallback_1: 'Must be marked "Confidential" with 30-day written confirmation window for oral disclosures.',
    fallback_2: 'All information deemed confidential with practical mechanism to designate non-confidential items.',
    red_line: 'Definition that treats all information as confidential with no marking mechanism and no reasonable-person standard.',
    escalation_trigger: 'Counterparty insists that all information is confidential with no exceptions or marking process.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-exceptions',
    clause_number: '3',
    clause_name: 'Exceptions to Confidentiality',
    why_it_matters: 'Protects against liability for information already known or independently created by the receiving party.',
    preferred_position: 'All 4 standard exceptions: (a) publicly available, (b) prior possession, (c) received from third party without restriction, (d) independently developed.',
    fallback_1: '3 of 4 exceptions accepted if the missing one is demonstrably low risk in context.',
    fallback_2: 'Modified language accepted if all 4 categories are conceptually covered.',
    red_line: 'Fewer than 3 exceptions — unacceptable.',
    escalation_trigger: '"Independently developed" exception is missing and counterparty refuses to add it.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-recipients',
    clause_number: '4',
    clause_name: 'Permitted Recipients',
    why_it_matters: 'Enables operational use of information with affiliates, advisors, and contractors while limiting blast radius.',
    preferred_position: 'Need-to-know disclosure to employees, affiliates, agents, advisors, and contractors bound by equivalent confidentiality obligations.',
    fallback_1: 'Employees and affiliates with prior written notice to the Disclosing Party.',
    fallback_2: 'Employees and affiliates only with prior written consent for external advisors.',
    red_line: 'Limits disclosure exclusively to named individuals or requires consent for sharing with affiliated entities.',
    escalation_trigger: 'Does not permit sharing with affiliates or advisors under any circumstances.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-return',
    clause_number: '5',
    clause_name: 'Return / Destruction of Backups',
    why_it_matters: 'Prevents technically or legally impossible compliance obligations after agreement ends.',
    preferred_position: 'Return or destroy on request with exemptions for: (a) routine IT backup copies, (b) copies required to be retained under law.',
    fallback_1: 'Return or destroy on request with exemptions for legally required copies only — no IT backup carve-out.',
    fallback_2: 'Return or destroy on request with 60-day timeframe and written certification, officer-signed.',
    red_line: 'Immediate destruction of all copies with no exemptions and no backup carve-out.',
    escalation_trigger: 'Counterparty insists on destruction of all copies including backups with written certification within 10 days.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-liability-correctness',
    clause_number: '6',
    clause_name: 'Liability for Correctness',
    why_it_matters: 'Prevents inappropriate warranty exposure at the NDA stage before due diligence.',
    preferred_position: '"AS IS" — no warranty on accuracy, completeness, or fitness for purpose. No liability for use or reliance on Confidential Information.',
    fallback_1: 'No warranty with explicit statement that neither party is liable for damages from reliance on disclosed information.',
    fallback_2: 'Limited warranty with a clear cap on liability and exclusion of consequential damages.',
    red_line: 'Full accuracy warranty with indemnification obligations.',
    escalation_trigger: 'Counterparty insists on accuracy warranties backed by indemnification — escalate immediately.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-penalty',
    clause_number: '7',
    clause_name: 'Contractual Penalty',
    why_it_matters: 'Prevents disproportionate financial exposure for inadvertent breach of NDA obligations.',
    preferred_position: 'No penalty clause. Statutory remedies only.',
    fallback_1: 'Penalty clause only if: (a) burden of proof remains with disclosing party, (b) penalty amount is commercially reasonable, (c) penalty is the sole monetary remedy.',
    fallback_2: 'Penalty clause with a proportionate cap, only for wilful or grossly negligent breaches.',
    red_line: 'Uncapped penalty regardless of fault, or penalty that is cumulative with unlimited damages claims.',
    escalation_trigger: 'Any contractual penalty clause — requires senior legal review before acceptance.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-liability',
    clause_number: '8',
    clause_name: 'Other Liabilities / Indemnification',
    why_it_matters: 'Controls the overall financial exposure framework beyond the specific NDA breach scenario.',
    preferred_position: 'No indemnification clause. Each party bears statutory liability only.',
    fallback_1: 'Reasonable limitation of liability exempting slight negligence (leichte Fahrlässigkeit), applying equally to both parties.',
    fallback_2: 'Indemnification limited to direct damages only, with a reasonable cap, excluding consequential, indirect, special, and punitive damages.',
    red_line: 'One-sided indemnification, any punitive or consequential damages, or indemnity extending to third-party claims unrelated to the NDA.',
    escalation_trigger: 'Any indemnification clause or liability provision going beyond standard statutory liability — requires senior legal.',
    rewritten_fields: {},
    analysis_status: 'issue',
    analysis_summary: 'Indemnification clause deviates from preferred no-indemnity position.',
    issues: [],
  },
  {
    clause_id: 'clause-ip',
    clause_number: '9',
    clause_name: 'IP Rights / Know-How',
    why_it_matters: 'Prevents unintended transfer of IP ownership or unintended license grants during evaluation.',
    preferred_position: 'No license or rights granted or implied. All Confidential Information remains exclusive property of Disclosing Party. Nothing transfers patents, trademarks, copyrights, or know-how.',
    fallback_1: 'No license granted with acknowledgment that any jointly created IP during the NDA period will be addressed in a separate good-faith negotiation.',
    fallback_2: 'No license granted; each party retains pre-existing IP; joint inventions to be jointly owned with each party free to exploit independently.',
    red_line: 'Any clause transferring IP ownership, granting an irrevocable license, or assigning rights to inventions from the information exchange.',
    escalation_trigger: 'Any IP assignment, license grant, or joint ownership clause — requires IP counsel review.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-non-solicitation',
    clause_number: '10',
    clause_name: 'Non-Solicitation',
    why_it_matters: 'Prevents overbroad employment restrictions that would hinder normal HR operations.',
    preferred_position: 'No non-solicitation clause in NDA. Employment matters handled separately.',
    fallback_1: 'Limited non-solicitation: direct solicitation only, employees involved in NDA exchange only, NDA term only.',
    fallback_2: 'Broader clause limited to NDA term, but no penalty attached.',
    red_line: 'Covers all employees regardless of involvement, applies to unsolicited applications, or includes a contractual penalty.',
    escalation_trigger: 'Any non-solicitation clause with a penalty attached — escalate to senior HR and legal.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-term',
    clause_number: '11',
    clause_name: 'Contract Term / Confidentiality Period',
    why_it_matters: 'Ensures manageable, defined obligations with a clear survival period after termination.',
    preferred_position: 'NDA term: 2–3 years. Confidentiality obligations survive termination for 5 years from each individual disclosure.',
    fallback_1: 'Confidentiality period 3–7 years from disclosure date.',
    fallback_2: 'Confidentiality = NDA term + fixed survival period (minimum 3 years post-termination).',
    red_line: 'Perpetual or indefinite confidentiality with no sunset clause.',
    escalation_trigger: 'Counterparty insists on perpetual confidentiality or a period shorter than 3 years.',
    rewritten_fields: {},
    analysis_status: 'warning',
    analysis_summary: 'Survival period falls in Fallback 1 range — flagged for monitoring.',
    issues: [],
  },
  {
    clause_id: 'clause-governing-law',
    clause_number: '12',
    clause_name: 'Choice of Law',
    why_it_matters: 'Determines interpretation, enforcement, and precedent. Our jurisdiction ensures predictability.',
    preferred_position: 'Laws of the Federal Republic of Germany govern the agreement without conflict of laws principles.',
    fallback_1: 'Neutral third-party jurisdiction with well-established, commercially sophisticated legal system (e.g., Switzerland, Netherlands).',
    fallback_2: 'Counterparty\'s law if well-established commercial jurisdiction and NDA is balanced.',
    red_line: 'Unpredictable legal system or jurisdiction with limited commercial law precedent.',
    escalation_trigger: 'Proposed governing law from jurisdiction outside both parties\' countries of incorporation — requires GC approval.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-dispute',
    clause_number: '13',
    clause_name: 'Dispute Resolution / Language',
    why_it_matters: 'Protects confidentiality of proceedings and ensures neutral, enforceable forum.',
    preferred_position: 'ICC arbitration with neutral seat (Munich or Zurich), conducted in English. Explicit carve-out for injunctive relief from ordinary courts.',
    fallback_1: 'Arbitration under recognized rules (LCIA, SIAC, DIS) with a neutral seat and English language.',
    fallback_2: 'Ordinary courts of a neutral jurisdiction with confidential treatment of proceedings.',
    red_line: 'Exclusive jurisdiction of counterparty\'s local courts with no arbitration and no carve-out for injunctive relief.',
    escalation_trigger: 'Counterparty proposes courts in their jurisdiction with no alternative dispute resolution — requires GC review.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'clause-signatures',
    clause_number: '14',
    clause_name: 'Signatures / Authority',
    why_it_matters: 'Ensures the NDA is legally binding and enforceable by duly authorized representatives.',
    preferred_position: 'Duly authorized representatives with verified signing authority. E-signatures via established platforms where counterparty confirms authority in writing.',
    fallback_1: 'Electronic signatures via established e-signature platforms where counterparty confirms signatory\'s authority in writing.',
    fallback_2: 'Single signatory from counterparty if they provide evidence of signing authority (e.g., power of attorney, board resolution).',
    red_line: 'Counterparty\'s signatory authority cannot be verified.',
    escalation_trigger: 'Any doubt about counterparty\'s signatory authority — verify before execution.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
]

// ─── Procurement NDA Playbook — distinct supplier-focused content ─────────────
export const PROCUREMENT_NDA_CLAUSES: PlaybookClause[] = [
  {
    clause_id: 'proc-nda-type',
    clause_number: '1',
    clause_name: 'NDA Scope (Supplier Onboarding)',
    why_it_matters: 'Supplier NDAs protect our IP shared during evaluation; typically unilateral when we disclose only.',
    preferred_position: 'Unilateral NDA with Siemens as sole Disclosing Party. Supplier is Receiving Party with strict obligations.',
    fallback_1: 'Bilateral NDA if supplier will share technical or pricing information during evaluation.',
    fallback_2: 'Bilateral NDA with asymmetric obligations if information flows are unequal.',
    red_line: 'Bilateral NDA treating all supplier employees as authorized recipients without explicit vetting.',
    escalation_trigger: 'Supplier requests bilateral but refuses to limit their disclosure scope.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-definition',
    clause_number: '2',
    clause_name: 'Confidential Information Definition',
    why_it_matters: 'Supplier context demands clarity: technical specs, pricing, and procurement data are highly sensitive.',
    preferred_position: 'Any non-public technical, commercial, or financial information disclosed for supplier qualification, including specifications, pricing, supply chain data, and manufacturing processes.',
    fallback_1: 'Written or electronically transmitted information marked Confidential; oral disclosures confirmed in writing within 15 business days.',
    fallback_2: 'Standard definition covering written information only with explicit category list.',
    red_line: 'Definition excluding pricing or financial terms from confidentiality scope.',
    escalation_trigger: 'Supplier requests carve-out for "independently developed" manufacturing methods.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-obligations',
    clause_number: '3',
    clause_name: 'Supplier Obligations',
    why_it_matters: 'Supplier must treat our procurement data with at least the same care as its own most sensitive information.',
    preferred_position: 'Strict confidence; no disclosure to sub-suppliers without prior written approval; use solely for qualification purpose; same security measures as own most sensitive data.',
    fallback_1: 'Reasonable care standard; sub-supplier disclosure permitted with 5-day advance notice.',
    fallback_2: 'Industry-standard measures with list of pre-approved sub-suppliers.',
    red_line: 'Any sub-supplier disclosure right without prior approval or notification.',
    escalation_trigger: 'Supplier insists on blanket sub-supplier sharing without individual approval.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-return',
    clause_number: '4',
    clause_name: 'Return / Destruction (Procurement)',
    why_it_matters: 'Pricing and specification data must not persist after qualification fails or relationship ends.',
    preferred_position: 'Return or certified destruction within 10 business days of qualification end or written request. Electronic copies purged with system-level verification.',
    fallback_1: 'Destruction within 30 days with written certification signed by authorized officer.',
    fallback_2: 'Destruction within 60 days; electronic records purged within 90 days of IT cycle.',
    red_line: 'Retention of any pricing or specification data after relationship termination without explicit written permission.',
    escalation_trigger: 'Supplier requests retention of copies beyond 90 days citing IT constraints.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-term',
    clause_number: '5',
    clause_name: 'Term (Procurement NDA)',
    why_it_matters: 'Procurement NDAs are typically shorter-cycle; obligations should match the relationship lifecycle.',
    preferred_position: 'Agreement term: 2 years. Confidentiality obligations survive for 3 years from date of each disclosure.',
    fallback_1: '1-year term with 2-year confidentiality survival.',
    fallback_2: '2-year term with fixed 2-year post-termination survival.',
    red_line: 'Confidentiality survival shorter than 2 years.',
    escalation_trigger: 'Supplier requests perpetual NDA or survival shorter than 1 year.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-ip',
    clause_number: '6',
    clause_name: 'IP / Improvements (Procurement)',
    why_it_matters: 'Prevents suppliers from claiming rights to improvements based on our disclosed specifications.',
    preferred_position: 'No license granted. All improvements or modifications to disclosed specifications are owned by Siemens. Supplier waives any right to supplier-developed enhancements of our IP.',
    fallback_1: 'No license granted. Jointly developed improvements owned equally; each party may exploit independently.',
    fallback_2: 'No license; improvements ownership to be negotiated in separate agreement.',
    red_line: 'Any license grant or IP transfer to supplier arising from access to our specifications.',
    escalation_trigger: 'Any improvement ownership clause — requires IP counsel and procurement legal review.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-governing',
    clause_number: '7',
    clause_name: 'Governing Law (Procurement)',
    why_it_matters: 'Procurement disputes should be governed by our home jurisdiction for enforcement efficiency.',
    preferred_position: 'Laws of Germany govern; exclusive jurisdiction of Munich courts for interim relief.',
    fallback_1: 'Neutral jurisdiction (Switzerland, Netherlands) with expedited arbitration track for procurement disputes.',
    fallback_2: 'Supplier jurisdiction if EU-based with DIS arbitration as backup.',
    red_line: 'Non-EU jurisdiction with no reciprocal enforcement treaty with Germany.',
    escalation_trigger: 'Supplier proposes US, UK or Asian jurisdiction for a Germany-based procurement relationship.',
    rewritten_fields: {},
    analysis_status: 'clean',
    analysis_summary: null,
    issues: [],
  },
  {
    clause_id: 'proc-audit',
    clause_number: '8',
    clause_name: 'Audit Rights',
    why_it_matters: 'Ability to verify compliance with data handling obligations is essential in high-value procurement.',
    preferred_position: 'Right to audit supplier\'s handling of Confidential Information on 10 business days\' notice, up to once per year. Supplier bears reasonable audit costs.',
    fallback_1: 'Right to request written compliance certification annually; physical audit on 30 days\' notice.',
    fallback_2: 'Right to third-party audit on 60 days\' notice with shared costs.',
    red_line: 'No audit rights whatsoever.',
    escalation_trigger: 'Supplier refuses any form of compliance verification or audit right.',
    rewritten_fields: {},
    analysis_status: 'warning',
    analysis_summary: 'Audit rights clause missing from many supplier NDAs — flagged for enforcement.',
    issues: [],
  },
]

// ─── Brain builder helpers ────────────────────────────────────────────────────
type NodeType = 'clause' | 'preferred' | 'fallback_1' | 'fallback_2' | 'red_line' | 'escalation'
const NODE_COLORS: Record<NodeType, string> = {
  clause: '#007c79', preferred: '#007c79', fallback_1: '#9b6f43',
  fallback_2: '#b98546', red_line: '#4a2430', escalation: '#ec6602',
}

function buildBrainNodes(clauses: PlaybookClause[], islandId?: string): PlaybookBrain['nodes'] {
  const nodes: PlaybookBrain['nodes'] = []
  for (const c of clauses) {
    const iid = islandId ?? null
    nodes.push({ id: c.clause_id, label: c.clause_name, status: c.analysis_status, color: NODE_COLORS.clause, node_type: 'clause', text: c.why_it_matters, island_id: iid, clause: c })
    nodes.push({ id: `${c.clause_id}:preferred`, label: 'Preferred', status: 'clean', color: NODE_COLORS.preferred, node_type: 'preferred', text: c.preferred_position, island_id: iid, clause: c })
    if (c.fallback_1) nodes.push({ id: `${c.clause_id}:fallback_1`, label: 'Fallback 1', status: 'clean', color: NODE_COLORS.fallback_1, node_type: 'fallback_1', text: c.fallback_1, island_id: iid, clause: c })
    if (c.fallback_2) nodes.push({ id: `${c.clause_id}:fallback_2`, label: 'Fallback 2', status: 'clean', color: NODE_COLORS.fallback_2, node_type: 'fallback_2', text: c.fallback_2, island_id: iid, clause: c })
    if (c.red_line) nodes.push({ id: `${c.clause_id}:red_line`, label: 'Red line', status: c.analysis_status === 'issue' ? 'issue' : 'clean', color: NODE_COLORS.red_line, node_type: 'red_line', text: c.red_line, island_id: iid, clause: c })
    if (c.escalation_trigger) nodes.push({ id: `${c.clause_id}:escalation`, label: 'Escalation', status: 'clean', color: NODE_COLORS.escalation, node_type: 'escalation', text: c.escalation_trigger, island_id: iid, clause: c })
  }
  return nodes
}

function buildBrainEdges(clauses: PlaybookClause[]): PlaybookBrain['edges'] {
  const edges: PlaybookBrain['edges'] = []
  for (const c of clauses) {
    edges.push({ source: c.clause_id, target: `${c.clause_id}:preferred`, similarity: 0.94, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.fallback_1) edges.push({ source: c.clause_id, target: `${c.clause_id}:fallback_1`, similarity: 0.76, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.fallback_2) edges.push({ source: c.clause_id, target: `${c.clause_id}:fallback_2`, similarity: 0.61, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.red_line) edges.push({ source: c.clause_id, target: `${c.clause_id}:red_line`, similarity: 0.82, relationship: 'playbook_hierarchy', edge_scope: 'island' })
    if (c.escalation_trigger) edges.push({ source: c.clause_id, target: `${c.clause_id}:escalation`, similarity: 0.69, relationship: 'playbook_hierarchy', edge_scope: 'island' })
  }
  // Semantic cross-clause edges within the same playbook
  const crossEdges: Array<[string, string, number]> = [
    ['clause-marking', 'clause-exceptions', 0.68],
    ['clause-recipients', 'clause-obligations', 0.62],
    ['clause-term', 'clause-return', 0.55],
    ['clause-ip', 'clause-non-solicitation', 0.42],
    ['clause-liability', 'clause-penalty', 0.71],
    ['clause-governing-law', 'clause-dispute', 0.78],
    ['proc-definition', 'proc-obligations', 0.65],
    ['proc-return', 'proc-term', 0.52],
    ['proc-ip', 'proc-audit', 0.48],
  ]
  for (const [src, tgt, sim] of crossEdges) {
    if (clauses.some(c => c.clause_id === src) && clauses.some(c => c.clause_id === tgt)) {
      edges.push({ source: src, target: tgt, similarity: sim, relationship: 'semantic_similarity', edge_scope: 'cross_island' })
    }
  }
  return edges
}

// ─── Main brain objects ───────────────────────────────────────────────────────
export const MOCK_BRAIN: PlaybookBrain = {
  playbook_id: 'standard-nda-playbook',
  version: 3,
  status: 'published',
  nodes: buildBrainNodes(STANDARD_NDA_CLAUSES),
  edges: buildBrainEdges(STANDARD_NDA_CLAUSES),
}

export const PROCUREMENT_BRAIN: PlaybookBrain = {
  playbook_id: 'procurement-nda-v2',
  version: 2,
  status: 'published',
  nodes: buildBrainNodes(PROCUREMENT_NDA_CLAUSES),
  edges: buildBrainEdges(PROCUREMENT_NDA_CLAUSES),
}

// ─── Public playbook list ─────────────────────────────────────────────────────
export const MOCK_PUBLIC_PLAYBOOKS: PublicPlaybookListItem[] = [
  { playbook_id: 'standard-nda-playbook', name: 'Standard NDA 2024', owner: 'Siemens Legal', version: 3, published_at: '2024-03-15T10:00:00Z', clause_count: 14 },
  { playbook_id: 'procurement-nda-v2', name: 'Procurement NDA v2', owner: 'Procurement Legal', version: 2, published_at: '2024-01-20T09:00:00Z', clause_count: 8 },
]

// ─── All playbooks (Peter view) ───────────────────────────────────────────────
export const MOCK_ALL_PLAYBOOKS: PlaybookApi[] = [
  {
    playbook_id: 'standard-nda-playbook',
    name: 'Standard NDA 2024',
    description: 'Mutual non-disclosure agreement for technology partnerships and supplier evaluations. Based on German law. 14 negotiated positions.',
    owner: 'Siemens Legal',
    version: 3,
    status: 'published',
    source_filename: 'Sample NDA Playbook.csv',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-03-15T10:00:00Z',
    published_at: '2024-03-15T10:00:00Z',
    clauses: STANDARD_NDA_CLAUSES,
  },
  {
    playbook_id: 'procurement-nda-v2',
    name: 'Procurement NDA v2',
    description: 'Supplier onboarding NDA. Unilateral by default. Stricter return obligations and audit rights. Shorter lifecycle.',
    owner: 'Procurement Legal',
    version: 2,
    status: 'published',
    source_filename: 'Procurement NDA v2.xlsx',
    created_at: '2023-11-01T08:00:00Z',
    updated_at: '2024-01-20T09:00:00Z',
    published_at: '2024-01-20T09:00:00Z',
    clauses: PROCUREMENT_NDA_CLAUSES,
  },
  {
    playbook_id: 'tech-partnership-nda',
    name: 'Tech Partnership NDA (Draft)',
    description: 'Extended NDA for joint R&D and technology partnership deals. Includes IP development provisions. Draft.',
    owner: 'Legal Tech Team',
    version: 1,
    status: 'draft',
    source_filename: 'Tech Partnership NDA.docx',
    created_at: '2024-04-01T14:00:00Z',
    updated_at: '2024-04-20T16:00:00Z',
    published_at: null,
    clauses: STANDARD_NDA_CLAUSES.slice(0, 9),
  },
]

// ─── GROW: Playbook update proposals from negotiated contracts ─────────────────
export interface PlaybookUpdateProposal {
  proposal_id: string
  clause_id: string
  clause_name: string
  observation: string
  current_position: string
  negotiated_position: string
  proposed_update: string
  evidence_contract: string
  evidence_excerpt: string
  frequency: number
  confidence: number
  impact: 'low' | 'medium' | 'high'
  status: 'pending' | 'accepted' | 'rejected'
}

export function generateGrowProposals(
  contractFilename: string,
  deviations: Array<{ clauseId: string; negotiatedText: string; position: string }>
): PlaybookUpdateProposal[] {
  const proposals: PlaybookUpdateProposal[] = []
  const allClauses = [...STANDARD_NDA_CLAUSES, ...PROCUREMENT_NDA_CLAUSES]

  for (const d of deviations) {
    const clause = allClauses.find(c => c.clause_id === d.clauseId)
    if (!clause) continue

    if (d.position === 'fallback_1' && clause.fallback_1) {
      proposals.push({
        proposal_id: `prop-${d.clauseId}-${Date.now()}`,
        clause_id: d.clauseId,
        clause_name: clause.clause_name,
        observation: `This clause was negotiated to Fallback 1 in ${contractFilename}. If this pattern repeats across ≥3 contracts, consider promoting Fallback 1 to the new Preferred Position.`,
        current_position: clause.preferred_position,
        negotiated_position: d.negotiatedText,
        proposed_update: `Consider updating Preferred Position to align with Fallback 1: "${clause.fallback_1.slice(0, 120)}…"`,
        evidence_contract: contractFilename,
        evidence_excerpt: d.negotiatedText.slice(0, 200),
        frequency: 2,
        confidence: 0.72,
        impact: 'medium',
        status: 'pending',
      })
    } else if (d.position === 'fallback_2' && clause.fallback_2) {
      proposals.push({
        proposal_id: `prop-${d.clauseId}-${Date.now()}-f2`,
        clause_id: d.clauseId,
        clause_name: clause.clause_name,
        observation: `This clause reached Fallback 2 in ${contractFilename}. Unusual — flag for legal review whether Fallback 1 needs stronger language.`,
        current_position: clause.preferred_position,
        negotiated_position: d.negotiatedText,
        proposed_update: `Review whether Fallback 1 language needs hardening: "${clause.fallback_1?.slice(0, 100) ?? ''}…"`,
        evidence_contract: contractFilename,
        evidence_excerpt: d.negotiatedText.slice(0, 200),
        frequency: 1,
        confidence: 0.58,
        impact: 'high',
        status: 'pending',
      })
    }
  }

  // Always add at least one governance proposal if no deviations generated one
  if (proposals.length === 0) {
    const termClause = allClauses.find(c => c.clause_id === 'clause-term')!
    proposals.push({
      proposal_id: `prop-term-observe-${Date.now()}`,
      clause_id: 'clause-term',
      clause_name: termClause.clause_name,
      observation: `${contractFilename} uses 4-year confidentiality survival (between Preferred 5 years and Fallback 1 range). Pattern may warrant updating Fallback 1 floor.`,
      current_position: termClause.preferred_position,
      negotiated_position: '4-year confidentiality survival period from date of each individual disclosure.',
      proposed_update: 'Consider adding explicit 4-year option to Fallback 1 as an intermediate step: "4–5 years from disclosure, minimum 4 years."',
      evidence_contract: contractFilename,
      evidence_excerpt: 'Agreement term: 3 years. Confidentiality obligations survive for 4 years from date of each individual disclosure.',
      frequency: 3,
      confidence: 0.81,
      impact: 'low',
      status: 'pending',
    })
  }

  return proposals
}

// ─── Contract analysis (matches DEMO_CONTRACT_TEXT — A1 Mueller Binder style) ─
function score(dense: number, lexical: number, topic: number, structural: number) {
  const final = dense * 0.45 + lexical * 0.25 + topic * 0.20 + structural * 0.10
  return { dense_embedding_score: dense, lexical_score: lexical, topic_alias_score: topic, structural_score: structural, final_score: +final.toFixed(3) }
}

// Modelled on A1 Mueller Binder Technologies NDA (German law, ICC/Zurich, 4-year survival)
const CONTRACT_SECTIONS = [
  {
    heading: 'TYPE OF NDA / NATURE OF AGREEMENT',
    text: 'Both parties agree to treat information exchanged under this mutual non-disclosure agreement with equal obligations. The Agreement is bilateral — each party may be Disclosing Party and Receiving Party simultaneously.',
    clauseId: 'clause-nda-type', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'Bilateral structure with mirrored obligations exactly matches the preferred position. Both parties are bound equally.',
    sb: score(0.93, 0.91, 0.95, 0.89), action: 'Accept as-is',
  },
  {
    heading: 'CONFIDENTIAL INFORMATION — DEFINITION',
    text: '"Confidential Information" means any information disclosed by one Party to the other that is marked as "Confidential" at the time of disclosure, or that by its nature would reasonably be understood to be confidential. Information disclosed orally shall be confirmed as confidential in writing within thirty (30) days of disclosure.',
    clauseId: 'clause-marking', position: 'fallback_1',
    classification: 'fallback_1',
    explanation: 'Marking requirement with 30-day oral confirmation window falls at Fallback 1. Preferred would permit unconfirmed oral disclosures if context makes confidentiality evident.',
    sb: score(0.82, 0.79, 0.84, 0.80), action: 'Accept — Fallback 1 within negotiating authority',
  },
  {
    heading: 'EXCEPTIONS TO CONFIDENTIALITY',
    text: 'Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was already in the Receiving Party\'s possession prior to disclosure; (c) is received from a third party without restriction; or (d) is independently developed without use of Confidential Information.',
    clauseId: 'clause-exceptions', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'All 4 standard exceptions present, including the critical "independently developed" carve-out. Preferred position met exactly.',
    sb: score(0.94, 0.92, 0.96, 0.91), action: 'Accept as-is',
  },
  {
    heading: 'PERMITTED RECIPIENTS',
    text: 'The Receiving Party may disclose Confidential Information to its employees, affiliates, agents, advisors, and contractors on a need-to-know basis, provided they are bound by confidentiality obligations no less restrictive than those in this Agreement.',
    clauseId: 'clause-recipients', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'Full permitted recipients list including affiliates, agents, advisors, and contractors. "No less restrictive" downstream obligation is the correct standard.',
    sb: score(0.91, 0.89, 0.93, 0.88), action: 'Accept as-is',
  },
  {
    heading: 'RETURN OR DESTRUCTION OF CONFIDENTIAL INFORMATION',
    text: 'Upon written request, the Receiving Party shall return or destroy all Confidential Information and provide written certification within thirty (30) days, except for copies required to be retained under applicable law or regulation.',
    clauseId: 'clause-return', position: 'fallback_1',
    classification: 'fallback_1',
    explanation: 'No routine IT backup carve-out — falls at Fallback 1. Preferred includes exemption for routine IT backups. The 30-day window and legal-compliance exception are acceptable.',
    sb: score(0.80, 0.78, 0.82, 0.79), action: 'Accept — Fallback 1 within authority; note missing IT backup carve-out',
  },
  {
    heading: 'NO WARRANTY',
    text: 'All Confidential Information is provided "AS IS." The Disclosing Party makes no warranty as to its accuracy, completeness, or fitness for any purpose. Neither Party shall be liable for any damages arising from reliance on the Confidential Information.',
    clauseId: 'clause-liability-correctness', position: 'preferred',
    classification: 'preferred_position',
    explanation: '"AS IS" with no warranty and no liability for reliance exactly matches preferred position.',
    sb: score(0.92, 0.90, 0.94, 0.88), action: 'Accept as-is',
  },
  {
    heading: 'CONTRACTUAL PENALTY',
    text: 'No contractual penalty shall apply under this Agreement. Remedies for breach shall be limited to actual damages proven by the aggrieved Party.',
    clauseId: 'clause-penalty', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'No penalty clause — preferred position achieved. Statutory actual damages only.',
    sb: score(0.96, 0.94, 0.97, 0.93), action: 'Accept as-is',
  },
  {
    heading: 'LIABILITY AND INDEMNIFICATION',
    text: 'Neither Party shall be liable for indirect, incidental, or consequential damages arising from slight negligence (leichte Fahrlässigkeit). Aggregate liability under this Agreement shall not exceed EUR 50,000.',
    clauseId: 'clause-liability', position: 'fallback_1',
    classification: 'fallback_1',
    explanation: 'Slight-negligence exemption is Fallback 1 language. EUR 50,000 cap is proportionate for a standard NDA. Overall within acceptable range.',
    sb: score(0.83, 0.81, 0.85, 0.80), action: 'Accept — Fallback 1. Flag if deal value exceeds EUR 500K',
  },
  {
    heading: 'INTELLECTUAL PROPERTY — NO LICENSE GRANTED',
    text: 'Nothing in this Agreement grants either Party any license, right, or interest in the other Party\'s intellectual property, patents, copyrights, trade secrets, or know-how. Disclosure does not constitute a transfer of ownership.',
    clauseId: 'clause-ip', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'Clean no-license clause with explicit IP enumeration. Matches preferred position exactly.',
    sb: score(0.94, 0.92, 0.95, 0.91), action: 'Accept as-is',
  },
  {
    heading: 'NON-SOLICITATION',
    text: 'This Agreement does not include any non-solicitation restriction. Each party is free to recruit from the general market.',
    clauseId: 'clause-non-solicitation', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'No non-solicitation clause — preferred position achieved.',
    sb: score(0.97, 0.95, 0.98, 0.94), action: 'Accept as-is',
  },
  {
    heading: 'TERM AND CONFIDENTIALITY SURVIVAL',
    text: 'This Agreement is effective for 3 years from the Effective Date, terminable on 30 days\' written notice. Confidentiality obligations survive termination for 4 years from the date of each individual disclosure.',
    clauseId: 'clause-term', position: 'fallback_1',
    classification: 'fallback_1',
    explanation: '4-year survival period is within Fallback 1 range (3–7 years from disclosure). Preferred is 5 years. Acceptable but flag for tracking.',
    sb: score(0.84, 0.82, 0.86, 0.81), action: 'Accept — Fallback 1. Document for playbook feedback loop',
  },
  {
    heading: 'GOVERNING LAW',
    text: 'This Agreement shall be governed by and construed in accordance with the laws of the Federal Republic of Germany, without regard to its conflict of laws principles.',
    clauseId: 'clause-governing-law', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'German law preferred position achieved. No conflict-of-laws carve-out is standard.',
    sb: score(0.95, 0.93, 0.96, 0.92), action: 'Accept as-is',
  },
  {
    heading: 'DISPUTE RESOLUTION',
    text: 'Any dispute shall be finally settled by arbitration under the ICC Rules, with the seat of arbitration in Zurich, Switzerland, conducted in English. One (1) arbitrator. Carve-out: either Party may seek injunctive relief from ordinary courts.',
    clauseId: 'clause-dispute', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'ICC arbitration with neutral Zurich seat, English language, single arbitrator, and injunctive relief carve-out — preferred position fully met.',
    sb: score(0.93, 0.91, 0.94, 0.90), action: 'Accept as-is',
  },
  {
    heading: 'SIGNATURES / EXECUTION',
    text: 'This Agreement is executed by duly authorized representatives of each Party. Electronic signatures via DocuSign are accepted. Each signatory confirms authority to bind their respective organization.',
    clauseId: 'clause-signatures', position: 'preferred',
    classification: 'preferred_position',
    explanation: 'Duly authorized signatories with electronic signature platform confirmation — preferred position met.',
    sb: score(0.91, 0.89, 0.92, 0.90), action: 'Accept as-is',
  },
]

export const MOCK_CONTRACT_ANALYSIS: AnalyzeContractResponse = {
  playbook_id: 'standard-nda-playbook',
  segmented_contract: {
    source_filename: 'A1_Mueller_Binder_Technologies_NDA.pdf',
    clauses: CONTRACT_SECTIONS.map((s, i) => ({
      clause_id: `contract-clause-${i + 1}`,
      heading: s.heading,
      text: s.text,
      start_page: Math.floor(i / 4) + 1,
      end_page: Math.floor(i / 4) + 1,
      boundary_confidence: 0.95,
      boundary_reason: 'Clear section heading and paragraph boundary.',
      extraction_method: 'heading_detection',
    })),
    segmentation_summary: '14 sections detected across 4 pages. All major NDA topics covered. High confidence segmentation.',
    low_confidence_count: 0,
  },
  clauses: CONTRACT_SECTIONS.map((s, i) => ({
    segmented_clause: {
      clause_id: `contract-clause-${i + 1}`,
      heading: s.heading,
      text: s.text,
      start_page: Math.floor(i / 4) + 1,
      end_page: Math.floor(i / 4) + 1,
      boundary_confidence: 0.95,
      boundary_reason: 'Clear section heading.',
      extraction_method: 'heading_detection',
    },
    match: {
      matched_clause: STANDARD_NDA_CLAUSES.find(c => c.clause_id === s.clauseId)!,
      matched_hierarchy_position: s.position,
      classification: s.classification,
      explanation: s.explanation,
      score_breakdown: s.sb,
      recommended_action: s.action,
      needs_lawyer_review: s.action.includes('Flag') || s.action.includes('escalate') || s.position === 'fallback_2',
    },
  })),
  risk_heatmap: {
    preferred_count: CONTRACT_SECTIONS.filter(s => s.position === 'preferred').length,
    fallback_count: CONTRACT_SECTIONS.filter(s => s.position === 'fallback_1' || s.position === 'fallback_2').length,
    redline_count: 0,
    escalation_count: 0,
    unmapped_count: 0,
  },
  explanations: [
    'Contract A1 (Mueller Binder Technologies): 9 of 14 clauses at preferred position.',
    '4 clauses at Fallback 1: Marking (30-day confirmation), Return (no IT backup carve-out), Liability (slight negligence exemption), Term (4-year instead of 5-year survival).',
    'GROW SIGNAL: Term clause at Fallback 1 across 3 of last 5 contracts — consider updating Preferred Position to 4 years or clarifying Fallback 1 range.',
    'No red-line violations. Contract is ready for signature subject to standard review.',
  ],
}

// ─── Mega brain — multiple islands ───────────────────────────────────────────
// Island 1: Standard NDA (with negotiated variants A1-A4)
// Island 2: Procurement NDA (with variants B1-B4)

function makeVariantNodes(basePlaybookId: string, islandId: string, fallbackClauses: string[]): PlaybookBrain['nodes'] {
  const clauseSet = basePlaybookId.startsWith('proc') ? PROCUREMENT_NDA_CLAUSES : STANDARD_NDA_CLAUSES
  return clauseSet.slice(0, 6).map(c => ({
    id: `${islandId}:${c.clause_id}`,
    label: c.clause_name.split(' ').slice(0, 3).join(' '),
    status: fallbackClauses.includes(c.clause_id) ? 'warning' as const : 'clean' as const,
    color: fallbackClauses.includes(c.clause_id) ? '#9b6f43' : '#007c79',
    node_type: fallbackClauses.includes(c.clause_id) ? 'fallback_1' as const : 'preferred' as const,
    text: fallbackClauses.includes(c.clause_id) ? c.fallback_1 ?? c.preferred_position : c.preferred_position,
    island_id: islandId,
    clause: c,
  }))
}

const standardNodes = buildBrainNodes(STANDARD_NDA_CLAUSES, 'standard-nda-playbook')
const procNodes = buildBrainNodes(PROCUREMENT_NDA_CLAUSES, 'procurement-nda-v2')
const a1Nodes = makeVariantNodes('standard', 'a1-mueller-binder', ['clause-marking', 'clause-return', 'clause-term', 'clause-liability'])
const a2Nodes = makeVariantNodes('standard', 'a2-westfield', ['clause-recipients', 'clause-non-solicitation', 'clause-ip'])
const a3Nodes = makeVariantNodes('standard', 'a3-rheinberg', ['clause-marking', 'clause-liability-correctness'])
const a4Nodes = makeVariantNodes('standard', 'a4-crawford', ['clause-term', 'clause-dispute'])
const b1Nodes = makeVariantNodes('proc', 'b1-mantafield', ['proc-nda-type', 'proc-governing', 'proc-term'])
const b2Nodes = makeVariantNodes('proc', 'b2-sigane', ['proc-obligations', 'proc-audit'])
const b3Nodes = makeVariantNodes('proc', 'b3-hartstem', ['proc-return', 'proc-ip'])
const b4Nodes = makeVariantNodes('proc', 'b4-breker', ['proc-definition', 'proc-obligations'])

const allMegaNodes = [...standardNodes, ...procNodes, ...a1Nodes, ...a2Nodes, ...a3Nodes, ...a4Nodes, ...b1Nodes, ...b2Nodes, ...b3Nodes, ...b4Nodes]

const crossIslandEdges: PlaybookBrain['edges'] = [
  // Standard NDA ↔ Procurement NDA (shared clause concepts)
  { source: 'clause-recipients', target: 'proc-obligations', similarity: 0.62, relationship: 'semantic_similarity', edge_scope: 'cross_island' },
  { source: 'clause-return', target: 'proc-return', similarity: 0.71, relationship: 'semantic_similarity', edge_scope: 'cross_island' },
  { source: 'clause-ip', target: 'proc-ip', similarity: 0.68, relationship: 'semantic_similarity', edge_scope: 'cross_island' },
  { source: 'clause-term', target: 'proc-term', similarity: 0.58, relationship: 'semantic_similarity', edge_scope: 'cross_island' },
  { source: 'clause-governing-law', target: 'proc-governing', similarity: 0.64, relationship: 'semantic_similarity', edge_scope: 'cross_island' },
  { source: 'clause-liability', target: 'proc-audit', similarity: 0.38, relationship: 'semantic_similarity', edge_scope: 'cross_island' },
  // Variant nodes connect back to parent playbook clauses
  { source: 'a1-mueller-binder:clause-marking', target: 'clause-marking', similarity: 0.85, relationship: 'negotiated_from', edge_scope: 'cross_island' },
  { source: 'a1-mueller-binder:clause-term', target: 'clause-term', similarity: 0.82, relationship: 'negotiated_from', edge_scope: 'cross_island' },
  { source: 'a2-westfield:clause-ip', target: 'clause-ip', similarity: 0.79, relationship: 'negotiated_from', edge_scope: 'cross_island' },
  { source: 'b1-mantafield:proc-nda-type', target: 'proc-nda-type', similarity: 0.76, relationship: 'negotiated_from', edge_scope: 'cross_island' },
]

const MEGA_MODULES = [
  { playbook_id: 'standard-nda-playbook', playbook_version: 3, name: 'Standard NDA 2024', owner: 'Siemens Legal', topics: ['marking', 'exceptions', 'recipients', 'term', 'ip', 'dispute'], node_count: standardNodes.length },
  { playbook_id: 'procurement-nda-v2', playbook_version: 2, name: 'Procurement NDA v2', owner: 'Procurement Legal', topics: ['scope', 'obligations', 'return', 'ip', 'audit'], node_count: procNodes.length },
  { playbook_id: 'a1-mueller-binder', playbook_version: 1, name: 'A1 — Mueller Binder', owner: 'Siemens Legal', topics: ['negotiated', 'fallback-marking', 'fallback-term'], node_count: a1Nodes.length },
  { playbook_id: 'a2-westfield', playbook_version: 1, name: 'A2 — Westfield Solutions', owner: 'Siemens Legal', topics: ['negotiated', 'joint-ip', 'non-solicitation'], node_count: a2Nodes.length },
  { playbook_id: 'a3-rheinberg', playbook_version: 1, name: 'A3 — Rheinberg Eng.', owner: 'Siemens Legal', topics: ['negotiated', 'fallback-marking'], node_count: a3Nodes.length },
  { playbook_id: 'a4-crawford', playbook_version: 1, name: 'A4 — Crawford Ried', owner: 'Siemens Legal', topics: ['negotiated', 'fallback-term', 'fallback-dispute'], node_count: a4Nodes.length },
  { playbook_id: 'b1-mantafield', playbook_version: 1, name: 'B1 — Mantafield Energy', owner: 'Procurement Legal', topics: ['negotiated', 'unilateral', 'texas-law'], node_count: b1Nodes.length },
  { playbook_id: 'b2-sigane', playbook_version: 1, name: 'B2 — Sigane Digital', owner: 'Procurement Legal', topics: ['negotiated', 'digital-supplier'], node_count: b2Nodes.length },
  { playbook_id: 'b3-hartstem', playbook_version: 1, name: 'B3 — Hartstem Tech.', owner: 'Procurement Legal', topics: ['negotiated', 'fallback-return'], node_count: b3Nodes.length },
  { playbook_id: 'b4-breker', playbook_version: 1, name: 'B4 — Breker Innovations', owner: 'Procurement Legal', topics: ['negotiated', 'startup-supplier'], node_count: b4Nodes.length },
]

export const MOCK_MEGA_BRAIN: MegaBrain = {
  modules: MEGA_MODULES,
  islands: MEGA_MODULES.map(m => ({ ...m, nodes: allMegaNodes.filter(n => n.island_id === m.playbook_id), edges: [] as BrainEdgeView[] })),
  nodes: allMegaNodes,
  edges: [
    ...buildBrainEdges(STANDARD_NDA_CLAUSES),
    ...buildBrainEdges(PROCUREMENT_NDA_CLAUSES),
    ...crossIslandEdges,
  ],
}

// ─── Publish response ─────────────────────────────────────────────────────────
export const MOCK_PUBLISH_RESPONSE = (playbookId: string): PublishPlaybookResponse => ({
  playbook: MOCK_ALL_PLAYBOOKS.find(p => p.playbook_id === playbookId) ?? MOCK_ALL_PLAYBOOKS[0],
  commit_hash: Math.random().toString(16).slice(2, 11),
  mega_brain_entries: 82,
})

// ─── Upload response ──────────────────────────────────────────────────────────
export const MOCK_UPLOAD_RESPONSE = (name: string, owner: string) => ({
  playbook: {
    playbook_id: `playbook-${Date.now()}`,
    name,
    description: 'Uploaded playbook — processing clauses…',
    owner,
    version: 1,
    status: 'draft' as const,
    source_filename: name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: null,
    clauses: STANDARD_NDA_CLAUSES,
  },
  clauses_created: 14,
})
