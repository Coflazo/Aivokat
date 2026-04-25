import React from 'react'
import { Send } from 'lucide-react'
import { sendChat } from '../api/client'
import type { ChatMessage, SourceCitation } from '../types'

const PROMPTS = [
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
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

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
      setMessages([...history, { role: 'user', content: trimmed }, {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Lou could not answer.',
      }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="creamPage appPage chatPage">
      <section className="chatMain">
        <div className="editorTopbar" style={{ marginBottom: 0 }}>
          <div>
            <p className="panelKicker">Playbook RAG</p>
            <h1>Ask Lou</h1>
          </div>
        </div>

        <div className="chatMessages">
          {messages.length === 0 && (
            <div className="chatPromptGrid">
              {PROMPTS.map((p) => (
                <button key={p} type="button" className="chatPromptChip" onClick={() => void ask(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chatBubble ${msg.role}`}>
              {msg.role === 'assistant' && (
                <span className="chatAvatar">L</span>
              )}
              <article className="chatBubbleBody">
                {msg.content}
              </article>
            </div>
          ))}
          {busy && (
            <div className="chatBubble assistant">
              <span className="chatAvatar">L</span>
              <article className="chatBubbleBody chatTyping">
                <span /><span /><span />
              </article>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="chatInput"
          onSubmit={(e) => { e.preventDefault(); void ask() }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a negotiation question…"
            disabled={busy}
          />
          <button className="primaryAction chatSend" type="submit" disabled={busy || !input.trim()}>
            <Send size={15} />
          </button>
        </form>
      </section>

      <aside className="chatSidebar">
        <p className="panelKicker">Sources cited</p>
        {sources.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sources from the playbook appear here after each answer.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {sources.map((src) => (
              <article key={src.rule_id} className="chatSourceCard">
                <strong>{src.topic}</strong>
                <p>{src.excerpt}</p>
                <span style={{ color: 'var(--turquoise)', fontSize: 11 }}>{Math.round(src.confidence * 100)}% match</span>
              </article>
            ))}
          </div>
        )}
      </aside>
    </main>
  )
}
