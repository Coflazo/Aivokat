export type ChangeType = 'initial' | 'confirms' | 'contradicts' | 'extends' | 'new_rule' | 'manual'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type Lifecycle = 'active' | 'staged' | 'approved'
export type PlaybookStatus = 'draft' | 'published' | 'archived'
export type ClauseAnalysisStatus = 'clean' | 'warning' | 'issue'
export type IssueSeverity = 'info' | 'warning' | 'critical'
export type RewriteMode = 'business_clear' | 'legal_precise' | 'shorter' | 'humanized'
export type PlaybookIssueType =
  | 'hierarchy_inversion'
  | 'vague_red_line'
  | 'missing_escalation'
  | 'duplicate_position'
  | 'fallback_too_strict'
  | 'red_line_too_soft'
  | 'unclear_business_language'

export interface GraphNode {
  id: string
  label: string
  topic: string
  category: string
  rule_type: string
  confidence: number
  version: number
  committed_by: string
  committed_at: string
  standard_position: string
  fallback_position?: string | null
  red_line?: string | null
  reasoning: string
  decision_logic?: string | null
  sources: string[]
  lifecycle: Lifecycle
}

export interface GraphEdge {
  source: string
  target: string
  similarity: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SourceCitation {
  rule_id: string
  topic: string
  excerpt: string
  confidence: number
}

export interface ChatResponse {
  answer: string
  sources: SourceCitation[]
  retrieved_rules: string[]
}

export interface Commit {
  id: number
  commit_hash: string
  rule_id: string
  topic: string
  change_type: ChangeType
  old_value?: string | null
  new_value: string
  source_document?: string | null
  source_clause?: string | null
  lawyer_note?: string | null
  committed_by: string
  committed_at: string
  approval_status: ApprovalStatus
}

export interface ProposedCommit {
  id: number
  rule_id: string
  topic: string
  change_type: ChangeType
  existing_rule_snapshot?: string | null
  proposed_change: string
  source_document: string
  source_clause: string
  cosine_similarity: number
  ai_reasoning: string
  approval_status: ApprovalStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  lawyer_note?: string | null
  created_at: string
}

export interface PlaybookIssue {
  id?: number | null
  clause_id: string
  field_name: string
  severity: IssueSeverity
  issue_type: PlaybookIssueType
  explanation: string
  proposed_fix?: string | null
  accepted: boolean
  rejected: boolean
  created_at?: string | null
  resolved_at?: string | null
}

export interface PlaybookClause {
  clause_id: string
  clause_number: string
  clause_name: string
  why_it_matters: string
  preferred_position: string
  fallback_1?: string | null
  fallback_2?: string | null
  red_line?: string | null
  escalation_trigger?: string | null
  rewritten_fields: Record<string, unknown>
  analysis_status: ClauseAnalysisStatus
  analysis_summary?: string | null
  issues: PlaybookIssue[]
}

export interface PlaybookApi {
  playbook_id: string
  name: string
  description: string
  owner: string
  version: number
  status: PlaybookStatus
  source_filename: string
  created_at: string
  updated_at: string
  published_at?: string | null
  clauses: PlaybookClause[]
}

export interface PlaybookUploadResponse {
  playbook: PlaybookApi
  clauses_created: number
}

export interface PlaybookPatchResponse {
  playbook: PlaybookApi
  updated_clause: PlaybookClause
  draft_diff: Record<string, unknown>
}

export interface RewriteCellResponse {
  playbook_id: string
  clause_id: string
  field_name: string
  mode: RewriteMode
  original: string
  rewritten: string
  meaning_preservation_note: string
}

export interface RewriteRowResponse {
  playbook_id: string
  clause_id: string
  rewrites: RewriteCellResponse[]
}

export interface RewritePlaybookResponse {
  playbook_id: string
  mode: RewriteMode
  rewrites: RewriteCellResponse[]
}

export interface BrainNodeView {
  id: string
  label: string
  status: ClauseAnalysisStatus
  color: string
  node_type: 'clause' | 'preferred' | 'fallback_1' | 'fallback_2' | 'red_line' | 'escalation'
  text: string
  island_id?: string | null
  clause: PlaybookClause
  x?: number
  y?: number
}

export interface BrainEdgeView {
  source: string | BrainNodeView
  target: string | BrainNodeView
  similarity: number
  relationship: string
  edge_scope: 'island' | 'cross_island'
}

export interface PlaybookBrain {
  playbook_id: string
  version: number
  status: PlaybookStatus
  nodes: BrainNodeView[]
  edges: BrainEdgeView[]
}

export interface PublishPlaybookResponse {
  playbook: PlaybookApi
  commit_hash: string
  mega_brain_entries: number
}

export interface MegaBrainModule {
  playbook_id: string
  playbook_version: number
  name: string
  owner: string
  topics: string[]
  node_count: number
}

export interface MegaBrainIsland {
  playbook_id: string
  playbook_version: number
  name: string
  owner: string
  nodes: BrainNodeView[]
  edges: BrainEdgeView[]
}

export interface MegaBrain {
  modules: MegaBrainModule[]
  islands: MegaBrainIsland[]
  nodes: BrainNodeView[]
  edges: BrainEdgeView[]
}

export interface MegaBrainSearchResult {
  playbook_id: string
  playbook_version: number
  clause_id: string
  topic: string
  document: string
  similarity: number
}

export interface PublicPlaybookListItem {
  playbook_id: string
  name: string
  owner: string
  version: number
  published_at?: string | null
  clause_count: number
}

export interface PublicCitation {
  clause_id: string
  clause_name: string
  excerpt: string
  confidence: number
}

export interface PublicAskResponse {
  answer: string
  citations: PublicCitation[]
  confidence: number
}

export interface ScoreBreakdown {
  dense_embedding_score: number
  lexical_score: number
  topic_alias_score: number
  structural_score: number
  final_score: number
}

export interface MatchClauseResponse {
  matched_clause: PlaybookClause
  matched_hierarchy_position: string
  classification: string
  explanation: string
  score_breakdown: ScoreBreakdown
  recommended_action: string
  needs_lawyer_review: boolean
}

export interface SegmentedClause {
  clause_id: string
  heading?: string | null
  text: string
  start_page?: number | null
  end_page?: number | null
  boundary_confidence: number
  boundary_reason: string
  extraction_method: string
}

export interface SegmentedContract {
  source_filename: string
  clauses: SegmentedClause[]
  segmentation_summary: string
  low_confidence_count: number
}

export interface AnalyzedContractClause {
  segmented_clause: SegmentedClause
  match?: MatchClauseResponse | null
}

export interface ContractRiskHeatmap {
  preferred_count: number
  fallback_count: number
  redline_count: number
  escalation_count: number
  unmapped_count: number
}

export interface AnalyzeContractResponse {
  playbook_id: string
  segmented_contract: SegmentedContract
  clauses: AnalyzedContractClause[]
  risk_heatmap: ContractRiskHeatmap
  explanations: string[]
}

export interface SuggestRewriteResponse {
  matched_clause_id: string
  original: string
  suggested_rewrite: string
  explanation: string
}

export interface CoverageGap {
  clause_id: string
  heading?: string | null
  text: string
  reason: string
}

export interface CoverageGapsResponse {
  gaps: CoverageGap[]
}
