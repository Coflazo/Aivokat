export type RuleType = 'standard' | 'fallback' | 'red_line' | 'escalation'
export type ChangeType = 'initial' | 'confirms' | 'contradicts' | 'extends' | 'new_rule' | 'manual'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface GraphNode {
  id: string
  label: string
  topic: string
  category: string
  rule_type: RuleType
  confidence: number
  version: number
  committed_by: string
  committed_at: string
  standard_position: string
  fallback_position?: string
  red_line?: string
  reasoning: string
  sources: string[]
  x?: number
  y?: number
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

export interface ChatResponse {
  answer: string
  sources: Array<{ rule_id: string; topic: string; excerpt: string; confidence: number }>
  retrieved_rules: string[]
}

export interface Commit {
  id: number
  commit_hash: string
  rule_id: string
  change_type: ChangeType
  old_value?: string
  new_value: string
  source_document?: string
  source_clause?: string
  lawyer_note?: string
  committed_by: string
  committed_at: string
  approval_status: ApprovalStatus
}

export interface ProposedCommit {
  id: number
  rule_id: string
  change_type: ChangeType
  existing_rule_snapshot?: string
  proposed_change: string
  source_document: string
  source_clause: string
  cosine_similarity: number
  ai_reasoning: string
  approval_status: ApprovalStatus
  created_at: string
}
