import { useEffect, useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import type { GraphNode, Commit } from '../types'
import { commitsApi } from '../api/client'

interface Props {
  node: GraphNode
  onClose: () => void
}

const RULE_TYPE_COLORS: Record<string, string> = {
  standard: '#00d4aa',
  fallback: '#f59e0b',
  red_line: '#ef4444',
  escalation: '#3b82f6',
}

export default function RuleCard({ node, onClose }: Props) {
  const [commits, setCommits] = useState<Commit[]>([])

  useEffect(() => {
    commitsApi.list({ rule_id: node.id, limit: 5 }).then(setCommits).catch(() => {})
  }, [node.id])

  const color = RULE_TYPE_COLORS[node.rule_type] || '#00d4aa'

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 420,
      background: '#141820', borderLeft: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column', zIndex: 10,
      boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.3 }}>{node.topic}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge label={node.category} color="#334155" textColor="#94a3b8" />
            <Badge label={node.rule_type.replace('_', ' ')} color={color + '22'} textColor={color} />
            <Badge label={`v${node.version}`} color="#1e293b" textColor="#64748b" />
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Standard Position" color="#00d4aa">
          <p style={textStyle}>{node.standard_position}</p>
        </Section>

        {node.fallback_position && (
          <Section title="Fallback Position" color="#f59e0b">
            <p style={textStyle}>{node.fallback_position}</p>
          </Section>
        )}

        {node.red_line && (
          <Section title="Red Line — Never Accept" color="#ef4444">
            <p style={textStyle}>{node.red_line}</p>
          </Section>
        )}

        <Section title="Why This Matters" color="#64748b">
          <p style={{ ...textStyle, color: '#94a3b8' }}>{node.reasoning}</p>
        </Section>

        {/* Confidence */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" }}>CONFIDENCE</span>
            <span style={{ fontSize: 11, color: '#00d4aa', fontFamily: "'IBM Plex Mono', monospace" }}>{Math.round(node.confidence * 100)}%</span>
          </div>
          <div style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${node.confidence * 100}%`, background: '#00d4aa', borderRadius: 2 }} />
          </div>
        </div>

        {/* Sources */}
        {node.sources.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>SOURCES</div>
            {node.sources.map(s => (
              <div key={s} style={{ fontSize: 12, color: '#64748b', padding: '4px 0', borderBottom: '1px solid #1e293b' }}>{s}</div>
            ))}
          </div>
        )}

        {/* Recent commits */}
        {commits.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" }}>COMMIT HISTORY</div>
            {commits.map(c => (
              <div key={c.id} style={{
                padding: '8px 10px', background: '#0f1117', borderRadius: 6,
                marginBottom: 4, borderLeft: `3px solid ${CHANGE_COLORS[c.change_type] || '#334155'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: CHANGE_COLORS[c.change_type] || '#64748b' }}>{c.change_type.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: '#475569', fontFamily: "'IBM Plex Mono', monospace" }}>{c.commit_hash}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{c.committed_by} · {new Date(c.committed_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div style={{ fontSize: 11, color: '#475569', fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
          <div>committed_by: {node.committed_by}</div>
          <div>committed_at: {new Date(node.committed_at).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{title.toUpperCase()}</div>
      {children}
    </div>
  )
}

function Badge({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return (
    <span style={{
      background: color, color: textColor, padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace",
    }}>{label}</span>
  )
}

const textStyle: React.CSSProperties = {
  fontSize: 13, color: '#cbd5e1', lineHeight: 1.6,
}

const CHANGE_COLORS: Record<string, string> = {
  initial: '#64748b',
  confirms: '#22c55e',
  contradicts: '#ef4444',
  extends: '#f59e0b',
  new_rule: '#3b82f6',
  manual: '#94a3b8',
}
