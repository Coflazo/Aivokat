import React from 'react'
import { fetchCommits } from '../api/client'
import type { ChangeType, Commit } from '../types'

const TYPE_META: Record<ChangeType, { color: string; label: string; bg: string }> = {
  initial:     { color: 'var(--muted)',    label: 'init',        bg: 'rgba(122,108,92,.10)' },
  confirms:    { color: 'var(--turquoise)', label: 'confirms',   bg: 'rgba(0,153,153,.10)' },
  contradicts: { color: 'var(--risk)',      label: 'contradicts', bg: 'rgba(74,36,48,.10)' },
  extends:     { color: 'var(--orange)',    label: 'extends',    bg: 'rgba(236,102,2,.10)' },
  new_rule:    { color: '#4a2076',          label: 'new rule',   bg: 'rgba(74,32,118,.10)' },
  manual:      { color: 'var(--muted)',     label: 'manual',     bg: 'rgba(122,108,92,.10)' },
}

function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function CommitHistoryScreen(): JSX.Element {
  const [commits, setCommits] = React.useState<Commit[]>([])
  const [filter, setFilter] = React.useState<ChangeType | 'all'>('all')
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  React.useEffect(() => {
    void fetchCommits(undefined, 1).then(setCommits)
  }, [])

  const visible = commits.filter((c) => {
    if (filter !== 'all' && c.change_type !== filter) return false
    const hay = `${c.topic} ${c.rule_id} ${c.committed_by}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  })

  const FILTERS: (ChangeType | 'all')[] = ['all', 'confirms', 'contradicts', 'extends', 'new_rule', 'manual']

  return (
    <main className="creamPage appPage historyPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Governance log</p>
          <h1>Commit History</h1>
        </div>
        <div className="topbarActions">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topic or author…"
            style={{ minWidth: 220 }}
          />
        </div>
      </section>

      <div className="historyFilters">
        {FILTERS.map((f) => {
          const meta = f !== 'all' ? TYPE_META[f] : null
          const active = filter === f
          return (
            <button
              key={f}
              type="button"
              className={active ? 'filterPill active' : 'filterPill'}
              style={active && meta ? { background: meta.bg, color: meta.color, borderColor: meta.color + '44' } : {}}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : TYPE_META[f].label}
              {f !== 'all' && (
                <span className="filterCount">
                  {commits.filter(c => c.change_type === f).length}
                </span>
              )}
            </button>
          )
        })}
        <span className="filterTotal">{visible.length} commits</span>
      </div>

      {visible.length === 0 ? (
        <p style={{ marginTop: 40, color: 'var(--muted)', fontSize: 13 }}>No commits match your filter.</p>
      ) : (
        <div className="timelineWrap">
          <div className="timelineRail" />
          {visible.map((commit, i) => {
            const meta = TYPE_META[commit.change_type] ?? TYPE_META.manual
            const isOpen = expanded === commit.commit_hash
            return (
              <div key={commit.commit_hash} className="timelineItem pageEnter" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="timelineDot" style={{ background: meta.color }} />
                <article
                  className={`timelineCard${isOpen ? ' open' : ''}`}
                  onClick={() => setExpanded(isOpen ? null : commit.commit_hash)}
                >
                  <div className="timelineCardTop">
                    <span className="timelineHash">{shortHash(commit.commit_hash)}</span>
                    <span className="timelineType" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                    <h3 className="timelineTopic">{commit.topic || commit.rule_id}</h3>
                    <span className="timelineMeta">{commit.committed_by} · {relativeTime(commit.committed_at)}</span>
                  </div>

                  {isOpen && (
                    <div className="timelineCardBody">
                      {commit.source_document && (
                        <div className="timelineField">
                          <span>Source</span>
                          <code>{commit.source_document}</code>
                        </div>
                      )}
                      {commit.source_clause && (
                        <div className="timelineField">
                          <span>Clause</span>
                          <blockquote>{commit.source_clause}</blockquote>
                        </div>
                      )}
                      {commit.new_value && (
                        <div className="timelineField">
                          <span>New value</span>
                          <pre>{commit.new_value}</pre>
                        </div>
                      )}
                      {commit.old_value && (
                        <div className="timelineField">
                          <span>Old value</span>
                          <pre style={{ opacity: .6 }}>{commit.old_value}</pre>
                        </div>
                      )}
                      {commit.lawyer_note && (
                        <div className="timelineField">
                          <span>Lawyer note</span>
                          <p style={{ fontStyle: 'italic' }}>{commit.lawyer_note}</p>
                        </div>
                      )}
                      <div className="timelineField">
                        <span>Committed</span>
                        <p>{new Date(commit.committed_at).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}</p>
                      </div>
                    </div>
                  )}
                </article>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
