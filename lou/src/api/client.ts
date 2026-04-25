import axios from 'axios'
import type {
  ChatMessage,
  ChatResponse,
  Commit,
  GraphData,
  MegaBrain,
  MegaBrainSearchResult,
  PlaybookApi,
  PlaybookBrain,
  PlaybookPatchResponse,
  PlaybookUploadResponse,
  PublishPlaybookResponse,
  ProposedCommit,
  RewriteCellResponse,
  RewriteMode,
  RewritePlaybookResponse,
  RewriteRowResponse
} from '../types'

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

export const fetchPlaybookBrain = (playbookId: string): Promise<PlaybookBrain> =>
  api.get(`/playbooks/${playbookId}/brain`).then((r) => r.data)

export const publishPlaybook = (
  playbookId: string,
  committedBy: string,
  comment: string
): Promise<PublishPlaybookResponse> =>
  api.post(`/playbooks/${playbookId}/publish`, {
    committed_by: committedBy,
    comment,
  }).then((r) => r.data)

export const fetchMegaBrain = (): Promise<MegaBrain> =>
  api.get('/mega-brain').then((r) => r.data)

export const searchMegaBrain = (q: string): Promise<MegaBrainSearchResult[]> =>
  api.get('/mega-brain/search', { params: { q } }).then((r) => r.data)

export const uploadContract = (file: File, lawyerName: string) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('lawyer_name', lawyerName)
  return api.post('/playbook/upload-contract', fd).then((r) => r.data)
}
