import React from 'react'
import { sendChat } from '../api/client'
import type { ChatMessage, SourceCitation } from '../types'

const prompts = [
  'Can we accept unlimited liability?',
  "What's our position on IP ownership?",
  'Has any counterparty tried perpetual confidentiality?',
  'When do we escalate to senior legal?',
]

export function ChatScreen(): JSX.Element {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [sources, setSources] = React.useState<SourceCitation[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function ask(text = input): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const history = messages
    setMessages([...history, { role: 'user', content: trimmed }])
    setInput('')
    setBusy(true)
    try {
      const response = await sendChat(trimmed, history, 'Demo Lawyer')
      setMessages([...history, { role: 'user', content: trimmed }, { role: 'assistant', content: response.answer }])
      setSources(response.sources)
    } catch (error) {
      setMessages([...history, { role: 'user', content: trimmed }, { role: 'assistant', content: error instanceof Error ? error.message : 'Lou could not answer.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '28px 32px 28px 112px', background: 'var(--cream)', color: 'var(--ink)', display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 20 }}>
      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: 'calc(100vh - 56px)' }}>
        <h1 style={{ margin: 0, fontSize: 30 }}>Ask Lou</h1>
        <div style={{ overflow: 'auto', padding: '22px 0', display: 'grid', alignContent: 'start', gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void ask(prompt)} style={{ background: 'rgba(0,153,153,.08)', border: '1px solid rgba(0,153,153,.2)', color: 'var(--turquoise)', borderRadius: 999, padding: '9px 12px' }}>
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} style={{
              justifySelf: message.role === 'user' ? 'end' : 'start',
              maxWidth: '78%',
              background: message.role === 'user' ? 'var(--cream-deep)' : 'white',
              borderLeft: message.role === 'assistant' ? '3px solid var(--turquoise)' : '0',
              borderRadius: 8,
              padding: '12px 14px',
              lineHeight: 1.55,
              boxShadow: '0 8px 24px rgba(47,42,34,.06)',
              whiteSpace: 'pre-wrap',
            }}>{message.content}</article>
          ))}
          {busy && <p style={{ color: 'var(--muted)' }}>Lou is reading the playbook...</p>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void ask() }} style={{ display: 'flex', gap: 10, background: 'var(--cream-deep)', padding: 12, borderRadius: 8 }}>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a negotiation question" style={{ flex: 1 }} />
          <button className="reviewButton" type="submit" disabled={busy}>Send</button>
        </form>
      </section>
      <aside style={{ borderLeft: '1px solid rgba(47,42,34,.12)', paddingLeft: 20 }}>
        <h2 style={{ marginTop: 0 }}>Sources cited</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {sources.map((source) => (
            <article key={source.rule_id} style={{ background: 'rgba(255,255,255,.72)', border: '1px solid rgba(0,153,153,.18)', borderRadius: 8, padding: 14 }}>
              <strong>{source.topic}</strong>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>{source.excerpt}</p>
              <small style={{ color: 'var(--turquoise)' }}>{Math.round(source.confidence * 100)}% match</small>
            </article>
          ))}
        </div>
      </aside>
    </main>
  )
}
