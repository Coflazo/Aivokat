import React from 'react'
import { approveCommit, fetchReviewQueue } from '../api/client'
import type { ProposedCommit } from '../types'

const colors: Record<string, string> = {
  confirms: 'var(--turquoise)',
  contradicts: 'var(--risk)',
  extends: 'var(--orange)',
  new_rule: 'var(--energy)',
}

function prettyJson(value?: string | null): string {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function ReviewQueueScreen({ onReviewed }: { onReviewed: () => void }): JSX.Element {
  const [items, setItems] = React.useState<ProposedCommit[]>([])
  const [toast, setToast] = React.useState('')

  function load(): void {
    void fetchReviewQueue().then(setItems)
  }

  React.useEffect(load, [])

  async function review(item: ProposedCommit, decision: 'approved' | 'rejected', note: string, text: string): Promise<void> {
    await approveCommit(item.id, decision, 'Demo Lawyer', note, text)
    setItems((current) => current.filter((candidate) => candidate.id !== item.id))
    setToast(decision === 'approved' ? 'Approved. Playbook updated.' : 'Rejected. No changes made to playbook.')
    onReviewed()
  }

  return (
    <main style={{ minHeight: '100vh', padding: '28px 32px 28px 112px', background: 'var(--cream)', color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Review Queue</h1>
        <span style={{ borderRadius: 999, padding: '4px 10px', background: items.length ? 'var(--orange)' : 'var(--muted)', color: 'white' }}>{items.length}</span>
      </div>
      {toast && <p style={{ color: 'var(--turquoise)' }}>{toast}</p>}
      {items.length === 0 ? (
        <p style={{ marginTop: 40, color: 'var(--muted)' }}>The playbook is up to date. No changes awaiting review.</p>
      ) : (
        <section style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          {items.map((item) => <ReviewCard key={item.id} item={item} onReview={review} />)}
        </section>
      )}
    </main>
  )
}

function ReviewCard({ item, onReview }: { item: ProposedCommit; onReview: (item: ProposedCommit, decision: 'approved' | 'rejected', note: string, text: string) => Promise<void> }): JSX.Element {
  const [note, setNote] = React.useState('')
  const [text, setText] = React.useState(item.source_clause)
  const [busy, setBusy] = React.useState(false)
  const color = colors[item.change_type] || 'var(--muted)'
  const similarityColor = item.cosine_similarity >= 0.85 ? 'var(--turquoise)' : item.cosine_similarity >= 0.5 ? 'var(--orange)' : 'var(--risk)'

  async function submit(decision: 'approved' | 'rejected'): Promise<void> {
    setBusy(true)
    try {
      await onReview(item, decision, note, text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article style={{ background: 'rgba(255,255,255,.78)', border: '1px solid rgba(47,42,34,.12)', borderLeft: `4px solid ${color}`, borderRadius: 8, padding: 18, boxShadow: '0 10px 28px rgba(47,42,34,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}>
        <div>
          <strong style={{ color }}>{item.change_type}</strong>
          <h2 style={{ margin: '4px 0 0' }}>{item.topic || item.rule_id}</h2>
          <p style={{ color: 'var(--muted)' }}>{item.source_document}</p>
        </div>
        <div style={{ minWidth: 160 }}>
          <small>Similarity {Math.round(item.cosine_similarity * 100)}%</small>
          <div style={{ height: 8, background: 'var(--cream-deep)', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${Math.max(4, item.cosine_similarity * 100)}%`, height: '100%', background: similarityColor }} />
          </div>
        </div>
      </div>
      <section>
        <h3>What the contract says</h3>
        <blockquote style={{ margin: 0, background: 'var(--cream-deep)', borderLeft: '3px solid var(--muted)', padding: 12, fontStyle: 'italic' }}>{item.source_clause}</blockquote>
      </section>
      <section>
        <h3>Lou's analysis</h3>
        <p>{item.ai_reasoning}</p>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <h3>Current playbook position</h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>{prettyJson(item.existing_rule_snapshot)}</pre>
        </div>
        <div>
          <h3>Proposed change</h3>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--turquoise)' }}>{prettyJson(item.proposed_change)}</pre>
        </div>
      </section>
      <div className="gitFlow" aria-label="Legal approval flow" style={{ marginTop: 12 }}>
        <span className="done">add</span>
        <span className="done">commit</span>
        <span>push</span>
      </div>
      <label style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        Lawyer note
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain the decision." />
      </label>
      <label style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        Edit proposed text
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="reviewButton" type="button" disabled={busy} onClick={() => void submit('approved')}>Approve</button>
        <button type="button" disabled={busy} onClick={() => void submit('rejected')} style={{ border: '1px solid rgba(122,45,45,.25)', color: 'var(--risk)', background: 'white', borderRadius: 999, padding: '9px 14px' }}>Reject</button>
      </div>
    </article>
  )
}
