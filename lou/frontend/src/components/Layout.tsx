import { useEffect, useState, useRef } from 'react'
import { Network, MessageSquare, GitCommit, ClipboardCheck, Download, Upload, X } from 'lucide-react'
import type { Screen } from '../App'
import { reviewApi, playbookApi, contractsApi, exportApi } from '../api/client'

interface Props {
  screen: Screen
  onNavigate: (s: Screen) => void
  children: React.ReactNode
}

const NAV = [
  { id: 'neural' as Screen, label: 'Neural Map', Icon: Network },
  { id: 'chat' as Screen, label: 'Chat with Lou', Icon: MessageSquare },
  { id: 'commits' as Screen, label: 'Commit History', Icon: GitCommit },
  { id: 'review' as Screen, label: 'Review Queue', Icon: ClipboardCheck },
]

export default function Layout({ screen, onNavigate, children }: Props) {
  const [pendingCount, setPendingCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState<'playbook' | 'contract'>('playbook')
  const [lawyerName, setLawyerName] = useState('Anonymous')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = () => reviewApi.listPending().then(d => setPendingCount(d.length)).catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('Uploading and parsing...')
    try {
      if (uploadType === 'playbook') {
        const res = await playbookApi.upload(file, lawyerName)
        setUploadMsg(`✓ Ingested ${res.rules_created} rules from playbook`)
      } else {
        const res = await contractsApi.upload(file, lawyerName)
        setUploadMsg(`✓ Generated ${res.proposed_commits} proposed updates`)
        reviewApi.listPending().then(d => setPendingCount(d.length)).catch(() => {})
      }
    } catch {
      setUploadMsg('Upload failed. Check the console.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f1117' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minWidth: 220, background: '#141820', borderRight: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column', padding: '0',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1e293b' }}>
          <span style={{
            display: 'inline-block',
            fontFamily: "'Cedarville Cursive', cursive",
            fontSize: 34,
            fontWeight: 400,
            color: '#050505',
            letterSpacing: 0,
            lineHeight: 1,
            background: '#f4ead8',
            borderRadius: 6,
            padding: '2px 12px 5px',
          }}>Lou</span>
          <div style={{ fontSize: 10, color: '#475569', marginTop: -4, fontFamily: "'IBM Plex Mono', monospace" }}>Playbook Engine</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', marginBottom: 2, borderRadius: 8, border: 'none',
                background: screen === id ? 'rgba(0,212,170,0.12)' : 'transparent',
                color: screen === id ? '#00d4aa' : '#94a3b8',
                cursor: 'pointer', fontSize: 13, fontWeight: screen === id ? 600 : 400,
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {id === 'review' && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', right: 10, background: '#f59e0b',
                  color: '#0f1117', borderRadius: 10, fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', minWidth: 18, textAlign: 'center',
                }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => { setUploadType('playbook'); setShowUploadModal(true) }} style={btnStyle('#00d4aa')}>
            <Upload size={14} /> Upload Playbook
          </button>
          <button onClick={() => { setUploadType('contract'); setShowUploadModal(true) }} style={btnStyle('#3b82f6')}>
            <Upload size={14} /> Upload Contract
          </button>
          <button onClick={() => exportApi.excel()} style={btnStyle('#1e293b', '#94a3b8')}>
            <Download size={14} /> Export Excel
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12,
            padding: 28, width: 420, position: 'relative',
          }}>
            <button onClick={() => { setShowUploadModal(false); setUploadMsg('') }}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
              <X size={18} />
            </button>
            <h3 style={{ color: '#e2e8f0', marginBottom: 16, fontSize: 15 }}>
              {uploadType === 'playbook' ? '📘 Upload Playbook' : '📄 Upload Contract'}
            </h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
              {uploadType === 'playbook'
                ? 'Upload a Word (.docx) or Excel (.xlsx) playbook. Lou will extract all rules and add them to the knowledge graph.'
                : 'Upload a Word (.docx) or PDF contract. Lou will analyze it against the playbook and generate proposed updates for your review.'}
            </p>
            <input
              placeholder="Your name (e.g. Dr. Schmidt)"
              value={lawyerName}
              onChange={e => setLawyerName(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12, width: '100%' }}
            />
            <input type="file" ref={fileRef} accept=".docx,.xlsx,.pdf" onChange={handleUpload}
              style={{ display: 'none' }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ ...btnStyle('#00d4aa'), width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: 13 }}
            >
              {uploading ? 'Processing...' : 'Choose File & Upload'}
            </button>
            {uploadMsg && (
              <p style={{ marginTop: 12, fontSize: 12, color: uploadMsg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>
                {uploadMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle = (bg: string, color = '#0f1117') => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  background: bg, color, border: 'none', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif",
  transition: 'opacity 0.15s', width: '100%',
} as React.CSSProperties)

const inputStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid #334155', borderRadius: 6,
  padding: '8px 10px', color: '#e2e8f0', fontSize: 13,
  fontFamily: "'Inter', sans-serif", outline: 'none',
}
