import { useState, useRef, useEffect } from 'react'
import { Send, ChevronRight } from 'lucide-react'
import type { ChatMessage } from '../types'
import { chatApi } from '../api/client'

interface Props {
  onNavigateToNode: (id: string) => void
}

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ rule_id: string; topic: string; excerpt: string; confidence: number }>
  retrieved_count?: number
}

const EXAMPLE_PROMPTS = [
  'Can we accept unlimited liability?',
  "What's our position on IP ownership?",
  'When should we escalate to senior legal?',
  'What are our red lines on confidentiality?',
]

export default function ChatInterface({ onNavigateToNode }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lawyerName, setLawyerName] = useState('Anonymous')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: DisplayMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await chatApi.send({ message: text, history, lawyer_name: lawyerName })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        retrieved_count: res.retrieved_rules.length,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Make sure the backend is running.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e293b', background: '#141820', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Chat with Lou</h2>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Ask anything about the negotiation playbook</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>As:</span>
          <input
            value={lawyerName}
            onChange={e => setLawyerName(e.target.value)}
            placeholder="Your name"
            style={{ ...inputStyle, width: 140 }}
          />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: 15, color: '#64748b', marginBottom: 6 }}>Ask Lou anything about the playbook</div>
              <div style={{ fontSize: 12, color: '#334155' }}>All answers are cited from the active playbook rules</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 600 }}>
              {EXAMPLE_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)} style={{
                  background: '#141820', border: '1px solid #334155', color: '#94a3b8',
                  padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
                  fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            <div style={{
              maxWidth: '78%',
              background: msg.role === 'user' ? '#00d4aa' : '#1a1f2e',
              color: msg.role === 'user' ? '#0f1117' : '#e2e8f0',
              padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: 13, lineHeight: 1.7,
              border: msg.role === 'assistant' ? '1px solid #1e293b' : 'none',
            }}>
              {msg.content}
            </div>

            {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '78%' }}>
                {msg.sources.map(s => (
                  <button key={s.rule_id} onClick={() => onNavigateToNode(s.rule_id)} title={s.excerpt}
                    style={{
                      background: '#0f1117', border: '1px solid #334155', color: '#00d4aa',
                      padding: '4px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
                      fontFamily: "'IBM Plex Mono', monospace", display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                    <ChevronRight size={10} />
                    {s.topic}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: '#334155', alignSelf: 'center', marginLeft: 4 }}>
                  Based on {msg.retrieved_count} playbook rules
                </span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#00d4aa',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#475569' }}>Lou is thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid #1e293b', background: '#141820', display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send(input))}
          placeholder="Ask about liability, IP, confidentiality, escalation…"
          style={{ ...inputStyle, flex: 1, padding: '10px 14px', fontSize: 13 }}
          disabled={loading}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}
          style={{
            background: '#00d4aa', border: 'none', borderRadius: 8, padding: '10px 16px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            color: '#0f1117', display: 'flex', alignItems: 'center',
          }}>
          <Send size={16} />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid #334155', borderRadius: 8,
  padding: '8px 12px', color: '#e2e8f0', fontSize: 12,
  fontFamily: "'Inter', sans-serif", outline: 'none',
}
