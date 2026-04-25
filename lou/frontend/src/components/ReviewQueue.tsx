import { useEffect, useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import type { ProposedCommit, ChangeType } from '../types'
import { reviewApi } from '../api/client'

const CHANGE_COLORS: Record<ChangeType, { bg: string; text: string }> = {
  initial:    { bg: '#1e293b', text: '#64748b' },
  confirms:   { bg: '#14532d', text: '#22c55e' },
  contradicts:{ bg: '#450a0a', text: '#ef4444' },
  extends:    { bg: '#451a03', text: '#f59e0b' },
  new_rule:   { bg: '#1e3a5f', text: '#3b82f6' },
  manual:     { bg: '#1e293b', text: '#94a3b8' },
}

interface CardState {
  lawyerName: string
  note: string
  loading: boolean
  done: boolean
  decision?: 'approved' | 'rejected'
}

export default function ReviewQueue() {
  const [items, setItems] = useState<ProposedCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<Record<number, CardState>>({})
  const [toast, setToast] = useState('')

  useEffect(() => {
    reviewApi.listPending()
      .then(data => {
        setItems(data)
        const initial: Record<number, CardState> = {}
        data.forEach(d => { initial[d.id] = { lawyerName: 'Dr. Schmidt', note: '', loading: false, done: false } })
        setCards(initial)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const setCard = (id: number, patch: Partial<CardState>) =>
    setCards(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const decide = async (item: ProposedCommit, decision: 'approved' | 'rejected') => {
    const card = cards[item.id]
    if (!card?.lawyerName.trim()) {
      showToast('Please enter your name before reviewing.')
      return
    }
    setCard(item.id, { loading: true })
    try {
      await reviewApi.approve(item.id, {
        proposed_commit_id: item.id,
        decision,
        lawyer_name: card.lawyerName,
        lawyer_note: card.note || undefined,
      })
      setCard(item.id, { loading: false, done: true, decision })
      showToast(decision === 'approved' ? '✓ Change approved and applied to playbook' : '✗ Change rejected')
    } catch {
      setCard(item.id, { loading: false })
      showToast('Error processing decision.')
    }
  }

  const getSnapshotText = (json?: string | null, field = 'standard_position') => {
    if (!json) return ''
    try { return JSON.parse(json)[field] || '' }
    catch { return '' }
  }

  const visible = items.filter(i => !cards[i.id]?.done)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#141820' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>Review Queue</h2>
        <p style={{ fontSize: 12, color: '#475569' }}>
          {visible.length} proposed {visible.length === 1 ? 'change' : 'changes'} awaiting lawyer approval
        </p>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && <div style={{ color: '#475569', fontSize: 13 }}>Loading review queue…</div>}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 16, color: '#475569', fontWeight: 500, marginBottom: 8 }}>
              The playbook is up to date.
            </div>
            <div style={{ fontSize: 13, color: '#334155' }}>No proposed changes awaiting review.</div>
          </div>
        )}

        {visible.map(item => {
          const card = cards[item.id] || { lawyerName: '', note: '', loading: false, done: false }
          const { bg, text } = CHANGE_COLORS[item.change_type]
          const existingPos = getSnapshotText(item.existing_rule_snapshot)
          const proposedPos = getSnapshotText(item.proposed_change, 'implied_position') || getSnapshotText(item.proposed_change, 'contract_clause')
          const hasDiff = (item.change_type === 'contradicts' || item.change_type === 'extends') && existingPos

          return (
            <div key={item.id} style={{
              background: '#141820', border: '1px solid #1e293b', borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* Card header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: bg, color: text, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {item.change_type.toUpperCase().replace('_', ' ')}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                  {item.rule_id.replace(/_/g, ' ')}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace', monospace" }}>
                  <span style={{ color: '#64748b' }}>similarity: </span>
                  <span style={{ color: item.cosine_similarity > 0.7 ? '#22c55e' : item.cosine_similarity > 0.4 ? '#f59e0b' : '#ef4444' }}>
                    {Math.round(item.cosine_similarity * 100)}%
                  </span>
                </span>
              </div>

              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Source clause */}
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>
                    SOURCE: {item.source_document}
                  </div>
                  <blockquote style={{
                    borderLeft: '3px solid #334155', paddingLeft: 12, margin: 0,
                    fontSize: 12, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace",
                    lineHeight: 1.6, maxHeight: 100, overflow: 'hidden',
                  }}>
                    {item.source_clause}
                  </blockquote>
                </div>

                {/* Lou's reasoning */}
                <div style={{ background: '#0f1117', borderRadius: 6, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#00d4aa', marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>LOU'S REASONING</div>
                  <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{item.ai_reasoning}</p>
                </div>

                {/* Diff */}
                {hasDiff && (
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>PROPOSED CHANGE</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 4 }}>CURRENT</div>
                        <div style={{ background: '#2d0a0a', borderRadius: 4, padding: '8px 10px', fontSize: 11, color: '#fca5a5', lineHeight: 1.5 }}>
                          {existingPos}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#22c55e', marginBottom: 4 }}>PROPOSED</div>
                        <div style={{ background: '#0a2d0a', borderRadius: 4, padding: '8px 10px', fontSize: 11, color: '#86efac', lineHeight: 1.5 }}>
                          {proposedPos || 'See source clause above'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lawyer inputs */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    placeholder="Your name (required)"
                    value={card.lawyerName}
                    onChange={e => setCard(item.id, { lawyerName: e.target.value })}
                    style={{ ...inputStyle, flex: '0 0 180px' }}
                  />
                  <input
                    placeholder="Note (optional)"
                    value={card.note}
                    onChange={e => setCard(item.id, { note: e.target.value })}
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => decide(item, 'approved')} disabled={card.loading}
                    style={{ ...actionBtn('#14532d', '#22c55e'), flex: 1, justifyContent: 'center' }}>
                    <CheckCircle size={14} />
                    {card.loading ? 'Processing…' : 'Approve — Apply to Playbook'}
                  </button>
                  <button onClick={() => decide(item, 'rejected')} disabled={card.loading}
                    style={{ ...actionBtn('#450a0a', '#ef4444'), flex: 1, justifyContent: 'center' }}>
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8,
          padding: '10px 20px', fontSize: 13, color: '#e2e8f0', zIndex: 2000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid #334155', borderRadius: 6,
  padding: '8px 10px', color: '#e2e8f0', fontSize: 12,
  fontFamily: "'Inter', sans-serif", outline: 'none',
}

const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
  background: bg, border: `1px solid ${color}`, borderRadius: 6,
  color, cursor: 'pointer', fontSize: 12, fontWeight: 500,
  fontFamily: "'Inter', sans-serif",
})
