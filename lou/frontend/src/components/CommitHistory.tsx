import { useEffect, useState } from 'react'
import type { Commit, ChangeType } from '../types'
import { commitsApi } from '../api/client'

interface Props {
  onNavigateToNode: (id: string) => void
}

const CHANGE_COLORS: Record<ChangeType, { bg: string; text: string }> = {
  initial:    { bg: '#1e293b', text: '#64748b' },
  confirms:   { bg: '#14532d', text: '#22c55e' },
  contradicts:{ bg: '#450a0a', text: '#ef4444' },
  extends:    { bg: '#451a03', text: '#f59e0b' },
  new_rule:   { bg: '#1e3a5f', text: '#3b82f6' },
  manual:     { bg: '#1e293b', text: '#94a3b8' },
}

const ALL_TYPES: ChangeType[] = ['initial', 'confirms', 'contradicts', 'extends', 'new_rule', 'manual']

export default function CommitHistory({ onNavigateToNode }: Props) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<ChangeType | 'all'>('all')
  const [page, setPage] = useState(1)
  const [expandedDiff, setExpandedDiff] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    commitsApi.list({ page, limit: 50 })
      .then(setCommits)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  const filtered = commits.filter(c => filterType === 'all' || c.change_type === filterType)

  const getPositionText = (jsonStr?: string | null): string => {
    if (!jsonStr) return ''
    try {
      const d = JSON.parse(jsonStr)
      return d.standard_position || d.implied_position || ''
    } catch { return '' }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#141820' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>Commit History</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('all')} style={filterBtn(filterType === 'all', '#334155', '#e2e8f0')}>All</button>
          {ALL_TYPES.map(t => {
            const { bg, text } = CHANGE_COLORS[t]
            return (
              <button key={t} onClick={() => setFilterType(t)} style={filterBtn(filterType === t, bg, text)}>
                {t.replace('_', ' ')}
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading && <div style={{ color: '#475569', fontSize: 13 }}>Loading history…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#334155', fontSize: 13, marginTop: 60 }}>
            No commits yet. Upload a playbook to create the first commits.
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          {filtered.length > 0 && (
            <div style={{
              position: 'absolute', left: 11, top: 8, bottom: 8,
              width: 2, background: '#1e293b', borderRadius: 1,
            }} />
          )}

          {filtered.map((c, i) => {
            const { bg, text } = CHANGE_COLORS[c.change_type]
            const oldPos = getPositionText(c.old_value)
            const newPos = getPositionText(c.new_value)
            const hasDiff = (c.change_type === 'contradicts' || c.change_type === 'extends') && oldPos && newPos

            return (
              <div key={c.id} style={{ display: 'flex', gap: 16, marginBottom: 16, position: 'relative' }}>
                {/* Dot */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: bg,
                  border: `2px solid ${text}`, flexShrink: 0, marginTop: 2, zIndex: 1,
                }} />

                {/* Card */}
                <div style={{
                  flex: 1, background: '#141820', border: '1px solid #1e293b',
                  borderRadius: 8, padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {c.change_type.toUpperCase().replace('_', ' ')}
                    </span>
                    <button onClick={() => onNavigateToNode(c.rule_id)}
                      style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}>
                      {c.rule_id.replace(/_/g, ' ')}
                    </button>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569', fontFamily: "'IBM Plex Mono', monospace" }}>{c.commit_hash}</span>
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: c.lawyer_note || hasDiff ? 8 : 0 }}>
                    {c.committed_by} · {new Date(c.committed_at).toLocaleString()}
                    {c.source_document && <span style={{ marginLeft: 8, color: '#334155' }}>from {c.source_document}</span>}
                  </div>

                  {c.lawyer_note && (
                    <div style={{
                      borderLeft: '3px solid #334155', paddingLeft: 10, marginTop: 8,
                      fontSize: 12, color: '#64748b', fontStyle: 'italic',
                    }}>"{c.lawyer_note}"</div>
                  )}

                  {hasDiff && (
                    <>
                      <button onClick={() => setExpandedDiff(expandedDiff === c.id ? null : c.id)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 11, padding: '4px 0', marginTop: 4 }}>
                        {expandedDiff === c.id ? '▾ Hide diff' : '▸ Show diff'}
                      </button>
                      {expandedDiff === c.id && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                          <div style={{ background: '#2d0a0a', borderRadius: 4, padding: '8px 10px', fontSize: 11, color: '#fca5a5', lineHeight: 1.5, textDecoration: 'line-through' }}>
                            {oldPos}
                          </div>
                          <div style={{ background: '#0a2d0a', borderRadius: 4, padding: '8px 10px', fontSize: 11, color: '#86efac', lineHeight: 1.5 }}>
                            {newPos}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>Previous</button>
        <span style={{ fontSize: 12, color: '#475569', padding: '6px 8px' }}>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={commits.length < 50} style={pageBtn}>Next</button>
      </div>
    </div>
  )
}

const filterBtn = (active: boolean, bg: string, text: string): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 4, border: `1px solid ${active ? text : '#1e293b'}`,
  background: active ? bg : 'transparent', color: active ? text : '#64748b',
  cursor: 'pointer', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: active ? 600 : 400,
})

const pageBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 4, border: '1px solid #334155',
  background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12,
}
