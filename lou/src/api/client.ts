import axios from 'axios'
import type {
  ChatMessage,
  ChatResponse,
  Commit,
  GraphData,
  MegaBrain,
  MegaBrainSearchResult,
  AnalyzeContractResponse,
  CoverageGapsResponse,
  MatchClauseResponse,
  PlaybookApi,
  PlaybookBrain,
  PlaybookPatchResponse,
  PlaybookUploadResponse,
  PublicAskResponse,
  PublicPlaybookListItem,
  PublishPlaybookResponse,
  ProposedCommit,
  RewriteCellResponse,
  RewriteMode,
  RewritePlaybookResponse,
  RewriteRowResponse,
  SuggestRewriteResponse
} from '../types'
import {
  MOCK_ALL_PLAYBOOKS,
  MOCK_BRAIN,
  PROCUREMENT_BRAIN,
  MOCK_CONTRACT_ANALYSIS,
  MOCK_MEGA_BRAIN,
  MOCK_PUBLIC_PLAYBOOKS,
  MOCK_PUBLISH_RESPONSE,
  MOCK_UPLOAD_RESPONSE,
  generateGrowProposals,
  type PlaybookUpdateProposal,
} from './mockData'

// ─── Mock flag — set false to use real backend ─────────────────────────────
const MOCK = true
function delay<T>(val: T, ms = 600): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(val), ms))
}

const api = axios.create({ baseURL: 'http://localhost:8000/api' })

export const fetchGraph = (): Promise<GraphData> => api.get('/graph').then((r) => r.data)

export const sendChat = (message: string, history: ChatMessage[], lawyerName: string): Promise<ChatResponse> =>
  api.post('/chat', { message, history, lawyer_name: lawyerName }).then((r) => r.data)

export const fetchCommits = (ruleId?: string, page = 1): Promise<Commit[]> =>
  api.get('/commits', { params: { rule_id: ruleId, page } }).then((r) => r.data)

export const fetchReviewQueue = (): Promise<ProposedCommit[]> =>
  api.get('/review').then((r) => r.data)

export const approveCommit = (
  id: number,
  decision: 'approved' | 'rejected',
  lawyerName: string,
  note?: string,
  proposedText?: string
) =>
  api.post(`/review/${id}/approve`, {
    decision,
    lawyer_name: lawyerName,
    lawyer_note: note,
    proposed_text: proposedText,
  }).then((r) => r.data)

export const exportExcel = async (): Promise<void> => {
  const response = await api.get('/export/excel', { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lou_playbook_export.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

export const uploadPlaybook = (file: File, lawyerName: string) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('lawyer_name', lawyerName)
  return api.post('/playbook/upload', fd).then((r) => r.data)
}

export const uploadApiPlaybook = (
  file: File,
  owner: string,
  name: string,
  description = ''
): Promise<PlaybookUploadResponse> => {
  if (MOCK) return delay(MOCK_UPLOAD_RESPONSE(name, owner) as PlaybookUploadResponse, 900)
  const fd = new FormData()
  fd.append('file', file)
  fd.append('owner', owner)
  fd.append('name', name)
  fd.append('description', description)
  return api.post('/playbooks/upload', fd).then((r) => r.data)
}

export const fetchPlaybook = (playbookId: string): Promise<PlaybookApi> =>
  api.get(`/playbooks/${playbookId}`).then((r) => r.data)

export const updatePlaybookClause = (
  playbookId: string,
  clauseId: string,
  fieldName: string,
  value: string,
  editedBy: string
): Promise<PlaybookPatchResponse> =>
  api.patch(`/playbooks/${playbookId}/clauses/${clauseId}`, {
    field_name: fieldName,
    value,
    edited_by: editedBy,
  }).then((r) => r.data)

export const rewriteCell = (
  playbookId: string,
  clauseId: string,
  fieldName: string,
  text: string,
  mode: RewriteMode
): Promise<RewriteCellResponse> =>
  api.post('/rewrite/cell', {
    playbook_id: playbookId,
    clause_id: clauseId,
    field_name: fieldName,
    text,
    mode,
  }).then((r) => r.data)

export const rewriteRow = (
  playbookId: string,
  clauseId: string,
  mode: RewriteMode
): Promise<RewriteRowResponse> =>
  api.post('/rewrite/row', {
    playbook_id: playbookId,
    clause_id: clauseId,
    mode,
  }).then((r) => r.data)

export const rewritePlaybook = (
  playbookId: string,
  mode: RewriteMode
): Promise<RewritePlaybookResponse> =>
  api.post('/rewrite/playbook', {
    playbook_id: playbookId,
    mode,
  }).then((r) => r.data)

export const analyzePlaybook = (playbookId: string): Promise<PlaybookApi> =>
  api.post(`/analysis/playbook/${playbookId}`).then((r) => r.data)

export const acceptIssueFix = (issueId: number): Promise<PlaybookApi> =>
  api.post(`/analysis/issues/${issueId}/accept-fix`).then((r) => r.data)

export const rejectIssue = (issueId: number): Promise<PlaybookApi> =>
  api.post(`/analysis/issues/${issueId}/reject`).then((r) => r.data)

export const fetchPlaybookBrain = (playbookId: string): Promise<PlaybookBrain> => {
  if (MOCK) {
    const brain = playbookId.startsWith('proc') ? PROCUREMENT_BRAIN : MOCK_BRAIN
    return delay({ ...brain, playbook_id: playbookId }, 50)
  }
  return api.get(`/playbooks/${playbookId}/brain`).then((r) => r.data)
}

export const publishPlaybook = (
  playbookId: string,
  committedBy: string,
  comment: string
): Promise<PublishPlaybookResponse> => {
  if (MOCK) return delay(MOCK_PUBLISH_RESPONSE(playbookId), 800)
  return api.post(`/playbooks/${playbookId}/publish`, {
    committed_by: committedBy,
    comment,
  }).then((r) => r.data)
}

export const fetchMegaBrain = (): Promise<MegaBrain> => {
  if (MOCK) return delay(MOCK_MEGA_BRAIN, 50)
  return api.get('/mega-brain').then((r) => r.data)
}

export const searchMegaBrain = (q: string): Promise<MegaBrainSearchResult[]> =>
  api.get('/mega-brain/search', { params: { q } }).then((r) => r.data)

export const fetchPublicPlaybooks = (): Promise<PublicPlaybookListItem[]> => {
  if (MOCK) return delay(MOCK_PUBLIC_PLAYBOOKS, 400)
  return api.get('/public/playbooks').then((r) => r.data)
}

export const fetchPublicPlaybookSchema = (playbookId: string): Promise<PlaybookApi> =>
  api.get(`/public/playbooks/${playbookId}/schema`).then((r) => r.data)

export const askPublicPlaybook = (playbookId: string, question: string): Promise<PublicAskResponse> =>
  api.post(`/public/playbooks/${playbookId}/ask`, { question }).then((r) => r.data)

export const matchPublicClause = (
  playbookId: string,
  clauseText: string,
  heading = ''
): Promise<MatchClauseResponse> =>
  api.post(`/public/playbooks/${playbookId}/match-clause`, {
    clause_text: clauseText,
    heading: heading || null,
  }).then((r) => r.data)

export const analyzePublicContractText = (
  playbookId: string,
  _text: string,
  _sourceFilename = 'pasted-contract.txt'
): Promise<AnalyzeContractResponse> => {
  if (MOCK) return delay({ ...MOCK_CONTRACT_ANALYSIS, playbook_id: playbookId }, 1200)
  return api.post(`/public/playbooks/${playbookId}/analyze-contract`, {
    text: _text,
    source_filename: _sourceFilename,
  }).then((r) => r.data)
}

export const suggestPublicRewrite = (
  playbookId: string,
  contractClause: string,
  matchedClauseId: string
): Promise<SuggestRewriteResponse> =>
  api.post(`/public/playbooks/${playbookId}/suggest-rewrite`, {
    contract_clause: contractClause,
    matched_clause_id: matchedClauseId,
  }).then((r) => r.data)

export const fetchCoverageGaps = (
  playbookId: string,
  text: string,
  sourceFilename = 'pasted-contract.txt'
): Promise<CoverageGapsResponse> =>
  api.post(`/public/playbooks/${playbookId}/coverage-gaps`, {
    text,
    source_filename: sourceFilename,
  }).then((r) => r.data)

export const uploadContract = (file: File, lawyerName: string) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('lawyer_name', lawyerName)
  return api.post('/playbook/upload-contract', fd).then((r) => r.data)
}

export const analyzePublicContractFile = (
  playbookId: string,
  _file: File
): Promise<AnalyzeContractResponse> => {
  if (MOCK) return delay({ ...MOCK_CONTRACT_ANALYSIS, playbook_id: playbookId }, 1200)
  const fd = new FormData()
  fd.append('file', _file)
  return api.post(`/public/playbooks/${playbookId}/analyze-contract-file`, fd).then((r) => r.data)
}

export const fetchAllPlaybooks = (): Promise<PlaybookApi[]> => {
  if (MOCK) return delay(MOCK_ALL_PLAYBOOKS, 400)
  return api.get('/playbooks').then((r) => r.data)
}

// ─── GROW: Playbook update proposals ──────────────────────────────────────────
export { type PlaybookUpdateProposal } from './mockData'

export const fetchGrowProposals = (
  playbookId: string,
  contractFilename: string,
  deviations: Array<{ clauseId: string; negotiatedText: string; position: string }>,
): Promise<PlaybookUpdateProposal[]> => {
  if (MOCK) return delay(generateGrowProposals(contractFilename, deviations), 800)
  return api.post(`/playbooks/${playbookId}/grow-proposals`, {
    contract_filename: contractFilename,
    deviations,
  }).then((r) => r.data)
}

// ─── Brain Copilot ─────────────────────────────────────────────────────────
export const brainCopilot = async (
  playbookId: string,
  instruction: string,
  nodeSummaries: string[],
): Promise<{
  action: 'add' | 'edit' | 'delete'
  targetNodeId?: string
  targetClause?: string
  newText?: string
  newNodeType?: string
  explanation: string
}> => {
  if (MOCK) {
    await delay(null, 900)
    const lower = instruction.toLowerCase()
    const ACTION = (lower.includes('delete') || lower.includes('remove')) ? 'delete' as const
      : (lower.includes('add') || lower.includes('create') || lower.includes('new')) ? 'add' as const
      : 'edit' as const
    const matched = nodeSummaries.find(s =>
      lower.split(/\s+/).some(w => w.length > 3 && s.toLowerCase().includes(w))
    )
    const [nodeId, ...rest] = (matched ?? '').split(': ')
    const clauseName = rest.join(': ')
    return {
      action: ACTION,
      targetNodeId: ACTION !== 'add' ? nodeId : undefined,
      targetClause: clauseName || undefined,
      newNodeType: ACTION === 'add' ? 'escalation' : undefined,
      newText: ACTION === 'edit' ? instruction : undefined,
      explanation: ACTION === 'delete'
        ? `Remove "${clauseName || 'selected node'}" from the playbook brain.`
        : ACTION === 'add'
          ? `Add an escalation trigger based on: "${instruction.slice(0, 60)}…"`
          : `Update "${clauseName || 'clause'}" to reflect: "${instruction.slice(0, 60)}…"`,
    }
  }
  const r = await api.post(`/playbooks/${playbookId}/brain-copilot`, {
    instruction,
    node_summaries: nodeSummaries,
  })
  return {
    action: r.data.action,
    targetNodeId: r.data.target_node_id ?? undefined,
    targetClause: r.data.target_clause ?? undefined,
    newNodeType: r.data.new_node_type ?? undefined,
    newText: r.data.new_text ?? undefined,
    explanation: r.data.explanation,
  }
}
