import axios from 'axios'
import type { ChatMessage, ChatResponse, Commit, GraphData, ProposedCommit } from '../types'

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

export const uploadContract = (file: File, lawyerName: string) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('lawyer_name', lawyerName)
  return api.post('/playbook/upload-contract', fd).then((r) => r.data)
}
