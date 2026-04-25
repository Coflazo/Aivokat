import React from 'react'
import { fetchCommits } from '../api/client'
import type { ChangeType, Commit } from '../types'

const colors: Record<string, string> = {
  initial: 'var(--muted)',
  confirms: 'var(--turquoise)',
  contradicts: 'var(--risk)',
  extends: 'var(--orange)',
  new_rule: 'var(--energy)',
  manual: 'var(--muted)',
}

export function CommitHistoryScreen(): JSX.Element {
  const [commits, setCommits] = React.useState<Commit[]>([])
  const [filter, setFilter] = React.useState<ChangeType | 'all'>('all')
  const [query, setQuery] = React.useState('')

  React.useEffect(() => {
    void fetchCommits(undefined, 1).then(setCommits)
  }, [])

  const visible = commits.filter((commit) => {
    if (filter !== 'all' && commit.change_type !== filter) return false
    const haystack = `${commit.topic} ${commit.rule_id} ${commit.committed_by}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  })

  return (
    <main style={{ minHeight: '100vh', padding: '28px 32px 28px 112px', background: 'var(--cream)', color: 'var(--ink)' }}>
      <h1 style={{ marginTop: 0 }}>Commit History</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {(['all', 'confirms', 'contradicts', 'extends', 'new_rule', 'manual'] as const).map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} style={{ borderRadius: 999, padding: '8px 11px', border: '1px solid rgba(47,42,34,.14)', background: filter === item ? 'var(--ink)' : 'white', color: filter === item ? 'var(--cream)' : 'var(--ink)' }}>{item}</button>
        ))}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topic or lawyer" style={{ marginLeft: 'auto', minWidth: 220 }} />
      </div>
      <section style={{ display: 'grid', gap: 12 }}>
        {visible.map((commit) => (
          <article key={commit.commit_hash} style={{ background: 'rgba(255,255,255,.76)', border: '1px solid rgba(47,42,34,.12)', borderLeft: `4px solid ${colors[commit.change_type]}`, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{commit.topic || commit.rule_id}</h2>
              <span style={{ color: colors[commit.change_type], fontWeight: 700 }}>{commit.change_type}</span>
            </div>
            <p style={{ color: 'var(--muted)', margin: '8px 0' }}>{commit.committed_by} · {new Date(commit.committed_at).toLocaleString()}</p>
            {commit.source_document && <code>{commit.source_document}</code>}
            {commit.lawyer_note && <p style={{ fontStyle: 'italic' }}>{commit.lawyer_note}</p>}
          </article>
        ))}
      </section>
    </main>
  )
}
