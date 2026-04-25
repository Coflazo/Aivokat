export type ChangeType = 'initial' | 'confirms' | 'contradicts' | 'extends' | 'new_rule' | 'manual'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type Lifecycle = 'active' | 'staged' | 'approved'

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
