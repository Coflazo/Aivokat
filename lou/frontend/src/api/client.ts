import axios from 'axios'
import type { GraphData, ChatResponse, Commit, ProposedCommit } from '../types'

const api = axios.create({ baseURL: '/api' })

export const graphApi = {
  get: (): Promise<GraphData> => api.get('/graph').then(r => r.data),
}

export const chatApi = {
  send: (body: { message: string; history: Array<{ role: string; content: string }>; lawyer_name: string }): Promise<ChatResponse> =>
    api.post('/chat', body).then(r => r.data),
}

export const commitsApi = {
  list: (params?: { rule_id?: string; page?: number; limit?: number }): Promise<Commit[]> =>
    api.get('/commits', { params }).then(r => r.data),
}

export const reviewApi = {
  listPending: (): Promise<ProposedCommit[]> => api.get('/review').then(r => r.data),
  approve: (id: number, body: { proposed_commit_id: number; decision: string; lawyer_name: string; lawyer_note?: string }): Promise<ProposedCommit> =>
    api.post(`/review/${id}/approve`, body).then(r => r.data),
}

export const playbookApi = {
  upload: (file: File, lawyerName: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('lawyer_name', lawyerName)
    return api.post('/playbook/upload', fd).then(r => r.data)
  },
}

export const contractsApi = {
  upload: (file: File, lawyerName: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('lawyer_name', lawyerName)
    return api.post('/contracts/upload', fd).then(r => r.data)
  },
}

export const exportApi = {
  excel: () => api.get('/export/excel', { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lou_playbook_export.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }),
}
