import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  ArrowDownToLine,
  Check,
  ClipboardCheck,
  FileUp,
  GitCommit,
  MessageSquare,
  Network,
  Search,
  ShieldCheck,
  X
} from 'lucide-react'
import './styles.css'

type Screen = 'map' | 'chat' | 'history' | 'review'
type RuleType = 'standard' | 'fallback' | 'red_line' | 'escalation'
type ChangeType = 'initial' | 'confirms' | 'contradicts' | 'extends' | 'new_rule'

interface Rule {
  id: string
  topic: string
  category: string
  type: RuleType
  confidence: number
  x: number
  y: number
  standard: string
  fallback?: string
  redLine?: string
  reasoning: string
  sources: string[]
  version: number
  updatedBy: string
}

interface Commit {
  id: string
  type: ChangeType
  topic: string
  by: string
  time: string
  source: string
  oldText?: string
  newText: string
  note?: string
}

interface ReviewItem {
  id: string
  type: ChangeType
  topic: string
  confidence: number
  source: string
  clause: string
  reasoning: string
  current: string
  proposed: string
}

const rules: Rule[] = [
  {
    id: 'liability_cap',
    topic: 'Liability Cap',
    category: 'Financial Risk',
    type: 'red_line',
    confidence: 0.94,
    x: 330,
    y: 145,
    standard: 'Liability should be capped at fees paid or payable under the agreement.',
    fallback: 'A higher cap may be accepted for low-risk deals after legal approval.',
    redLine: 'Unlimited liability is not accepted.',
    reasoning: 'This prevents a routine NDA from creating open-ended financial exposure.',
    sources: ['Sample NDA Playbook.docx', 'Sample Standard NDA.docx'],
    version: 3,
    updatedBy: 'Maria Legal'
  },
  {
    id: 'confidentiality_duration',
    topic: 'Confidentiality Duration',
    category: 'Confidentiality',
    type: 'standard',
    confidence: 0.89,
    x: 510,
    y: 210,
    standard: 'Confidentiality obligations should last five years after disclosure.',
    fallback: 'Three years is acceptable for non-sensitive commercial information.',
    redLine: 'Perpetual obligations should be limited to trade secrets only.',
    reasoning: 'The term should protect sensitive information without creating broad permanent duties.',
    sources: ['Sample NDA Playbook.csv.xlsx'],
    version: 2,
    updatedBy: 'Lou (AI)'
  },
  {
    id: 'ip_ownership',
    topic: 'IP Ownership',
    category: 'IP & Data',
    type: 'standard',
    confidence: 0.91,
    x: 410,
    y: 325,
    standard: 'Each party keeps ownership of its pre-existing intellectual property.',
    fallback: 'Limited use rights can be granted only for the NDA purpose.',
    reasoning: 'This avoids accidental transfer of Siemens technology or background rights.',
    sources: ['Sample Standard NDA.docx'],
    version: 1,
    updatedBy: 'Anika Counsel'
  },
  {
    id: 'governing_law',
    topic: 'Governing Law',
    category: 'Governance',
    type: 'fallback',
    confidence: 0.78,
    x: 205,
    y: 280,
    standard: 'German law is preferred for Siemens templates.',
    fallback: 'Neutral EU jurisdictions may be accepted after review.',
    redLine: 'Unfamiliar high-risk jurisdictions require escalation.',
    reasoning: 'Known governing law reduces uncertainty and review effort.',
    sources: ['Sample NDA Playbook.docx'],
    version: 2,
    updatedBy: 'Maria Legal'
  },
  {
    id: 'data_exports',
    topic: 'Data Exports',
    category: 'IP & Data',
    type: 'escalation',
    confidence: 0.83,
    x: 625,
    y: 345,
    standard: 'Personal data exports require privacy review before acceptance.',
    fallback: 'Aggregated non-personal data may be shared for the NDA purpose.',
    reasoning: 'Cross-border data handling can trigger privacy and regulatory obligations.',
    sources: ['Negotiated NDA - Supplier A.pdf'],
    version: 1,
    updatedBy: 'Lou (AI)'
  }
]

const initialCommits: Commit[] = [
  {
    id: 'c1',
    type: 'initial',
    topic: 'Liability Cap',
    by: 'Maria Legal',
    time: 'Today, 09:18',
    source: 'Sample NDA Playbook.docx',
    newText: 'Created rule: unlimited liability is a red line.'
  },
  {
    id: 'c2',
    type: 'contradicts',
    topic: 'Confidentiality Duration',
    by: 'Jonas Counsel',
    time: 'Today, 10:04',
    source: 'Negotiated NDA - Supplier A.pdf',
    oldText: 'Five-year confidentiality period.',
    newText: 'Supplier requested perpetual confidentiality for all information.',
    note: 'Rejected broad perpetual term; acceptable only for trade secrets.'
  },
  {
    id: 'c3',
    type: 'extends',
    topic: 'Data Exports',
    by: 'Lou (AI)',
    time: 'Today, 10:21',
    source: 'Negotiated NDA - Supplier B.pdf',
    newText: 'New escalation guidance proposed for cross-border personal data sharing.'
  }
]

const initialReview: ReviewItem[] = [
  {
    id: 'r1',
    type: 'contradicts',
    topic: 'Liability Cap',
    confidence: 0.88,
    source: 'Negotiated NDA - Supplier C.pdf',
    clause: 'The parties agree that liability for all claims arising under this agreement shall be unlimited.',
    reasoning: 'This clause conflicts with the active red line against unlimited liability.',
    current: 'Unlimited liability is not accepted.',
    proposed: 'Keep the existing red line and record this supplier clause as a contradiction.'
  },
  {
    id: 'r2',
    type: 'extends',
    topic: 'Data Exports',
    confidence: 0.72,
    source: 'Negotiated NDA - Supplier D.pdf',
    clause: 'Recipient may process evaluation data using approved affiliates located outside the European Economic Area.',
    reasoning: 'The clause relates to data handling but adds a cross-border affiliate processing scenario.',
    current: 'Personal data exports require privacy review before acceptance.',
    proposed: 'Add affiliate processing outside the EEA as an explicit escalation trigger.'
  }
]

const colors: Record<RuleType, string> = {
  standard: '#009999',
  fallback: '#EC6602',
  red_line: '#D5001C',
  escalation: '#4A2076'
}

const changeLabels: Record<ChangeType, string> = {
  initial: 'INITIAL',
  confirms: 'CONFIRMS',
  contradicts: 'CONTRADICTS',
  extends: 'EXTENDS',
  new_rule: 'NEW RULE'
}

function App(): JSX.Element {
  const [screen, setScreen] = React.useState<Screen>('map')
  const [selectedRule, setSelectedRule] = React.useState<Rule>(rules[0])
  const [reviewItems, setReviewItems] = React.useState<ReviewItem[]>(initialReview)
  const [commits, setCommits] = React.useState<Commit[]>(initialCommits)
  const [toast, setToast] = React.useState<string>('')

  function resolveReview(item: ReviewItem, approved: boolean): void {
    setReviewItems((current) => current.filter((candidate) => candidate.id !== item.id))
    setCommits((current) => [
      {
        id: `c-${Date.now()}`,
        type: item.type,
        topic: item.topic,
        by: 'Demo Lawyer',
        time: 'Just now',
        source: item.source,
        oldText: item.current,
        newText: approved ? item.proposed : 'Proposal rejected. Active rule unchanged.',
        note: approved ? 'Approved from review queue.' : 'Rejected from review queue.'
      },
      ...current
    ])
    setToast(approved ? 'Approved. Commit created.' : 'Rejected. Audit entry recorded.')
    window.setTimeout(() => setToast(''), 2600)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Siemens-logo.svg/1280px-Siemens-logo.svg.png" alt="Siemens" />
          </div>
          <div>
            <strong>Lou</strong>
            <span>Playbook Engine</span>
          </div>
        </div>
        <nav>
          <NavButton icon={<Network size={18} />} active={screen === 'map'} label="Map" onClick={() => setScreen('map')} />
          <NavButton icon={<MessageSquare size={18} />} active={screen === 'chat'} label="Chat" onClick={() => setScreen('chat')} />
          <NavButton icon={<GitCommit size={18} />} active={screen === 'history'} label="History" onClick={() => setScreen('history')} />
          <NavButton
            icon={<ClipboardCheck size={18} />}
            active={screen === 'review'}
            label="Review"
            count={reviewItems.length}
            onClick={() => setScreen('review')}
          />
        </nav>
        <div className="sidebarStatus">
          <ShieldCheck size={16} />
          Lawyer approval required for every update
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Siemens hackathon prototype</p>
            <h1>{screenTitle(screen)}</h1>
          </div>
          <div className="actions">
            <button className="ghostButton"><FileUp size={16} /> Upload Playbook</button>
            <button className="primaryButton"><ArrowDownToLine size={16} /> Export Excel</button>
          </div>
        </header>

        {screen === 'map' && <NeuralMap selectedRule={selectedRule} onSelect={setSelectedRule} />}
        {screen === 'chat' && <Chat onSelectRule={(rule) => { setSelectedRule(rule); setScreen('map') }} />}
        {screen === 'history' && <History commits={commits} />}
        {screen === 'review' && <ReviewQueue items={reviewItems} onResolve={resolveReview} />}
      </main>

      {screen === 'map' && <RuleDrawer rule={selectedRule} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function screenTitle(screen: Screen): string {
  const titles: Record<Screen, string> = {
    map: 'Neural Map',
    chat: 'Chat with Lou',
    history: 'Commit History',
    review: 'Review Queue'
  }
  return titles[screen]
}

function NavButton(props: {
  icon: React.ReactNode
  label: string
  active: boolean
  count?: number
  onClick: () => void
}): JSX.Element {
  return (
    <button className={`navButton ${props.active ? 'active' : ''}`} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
      {typeof props.count === 'number' && props.count > 0 && <b>{props.count}</b>}
    </button>
  )
}

function NeuralMap(props: { selectedRule: Rule; onSelect: (rule: Rule) => void }): JSX.Element {
  return (
    <section className="mapScreen">
      <div className="toolbar">
        <label><Search size={15} /> Search topic</label>
        <input placeholder="liability, IP, data..." />
        <select aria-label="Category">
          <option>All categories</option>
          <option>Financial Risk</option>
          <option>Confidentiality</option>
          <option>IP & Data</option>
        </select>
        <div className="segmented">
          <button>All</button>
          <button>Standard</button>
          <button>Fallback</button>
          <button>Red Line</button>
        </div>
      </div>
      <div className="graphPanel">
        <svg viewBox="0 0 760 450" role="img" aria-label="Legal playbook knowledge graph">
          <line x1="330" y1="145" x2="510" y2="210" />
          <line x1="330" y1="145" x2="205" y2="280" />
          <line x1="510" y1="210" x2="625" y2="345" />
          <line x1="410" y1="325" x2="625" y2="345" />
          <line x1="410" y1="325" x2="205" y2="280" />
          {rules.map((rule) => (
            <g key={rule.id} className="node" onClick={() => props.onSelect(rule)}>
              {props.selectedRule.id === rule.id && <circle cx={rule.x} cy={rule.y} r={22} className="selectedRing" />}
              <circle cx={rule.x} cy={rule.y} r={14 + rule.confidence * 5} fill={colors[rule.type]} />
              <text x={rule.x} y={rule.y + 42}>{rule.topic}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  )
}

function RuleDrawer({ rule }: { rule: Rule }): JSX.Element {
  return (
    <aside className="drawer">
      <div className="drawerHeader">
        <div>
          <p className="eyebrow">Rule detail</p>
          <h2>{rule.topic}</h2>
        </div>
        <span className="version">v{rule.version}</span>
      </div>
      <div className="badges">
        <span>{rule.category}</span>
        <span style={{ borderColor: colors[rule.type], color: colors[rule.type] }}>{rule.type.replace('_', ' ')}</span>
      </div>
      <RuleSection title="Standard Position" tone="teal" text={rule.standard} />
      {rule.fallback && <RuleSection title="Fallback Position" tone="amber" text={rule.fallback} />}
      {rule.redLine && <RuleSection title="Red Line" tone="red" text={rule.redLine} />}
      <div className="reasoning">
        <h3>Why this matters</h3>
        <p>{rule.reasoning}</p>
      </div>
      <div className="confidence">
        <div><span>Confidence</span><strong>{Math.round(rule.confidence * 100)}%</strong></div>
        <i style={{ width: `${rule.confidence * 100}%` }} />
      </div>
      <div className="sources">
        <h3>Sources</h3>
        {rule.sources.map((source) => <span key={source}>{source}</span>)}
      </div>
      <p className="muted">Last updated by {rule.updatedBy}</p>
    </aside>
  )
}

function RuleSection({ title, text, tone }: { title: string; text: string; tone: 'teal' | 'amber' | 'red' }): JSX.Element {
  return (
    <section className={`ruleSection ${tone}`}>
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  )
}

function Chat({ onSelectRule }: { onSelectRule: (rule: Rule) => void }): JSX.Element {
  const [asked, setAsked] = React.useState<boolean>(false)
  return (
    <section className="chatScreen">
      <div className="promptChips">
        {['Can we accept unlimited liability?', 'What is our IP ownership position?', 'When do we escalate data exports?'].map((prompt) => (
          <button key={prompt} onClick={() => setAsked(true)}>{prompt}</button>
        ))}
      </div>
      <div className="messages">
        <div className="message user">Can we accept unlimited liability?</div>
        <div className="message lou">
          <p>No. The current playbook says unlimited liability is not accepted. It should be treated as a red line and escalated rather than accepted. [Rule: Liability Cap]</p>
          <button className="sourceChip" onClick={() => onSelectRule(rules[0])}>Liability Cap · 94%</button>
          <small>Based on 1 playbook rule</small>
        </div>
        {asked && (
          <div className="message lou">
            <p>The answer is grounded in the active playbook rule and its listed source documents. [Rule: Liability Cap]</p>
            <button className="sourceChip" onClick={() => onSelectRule(rules[0])}>Liability Cap · 94%</button>
          </div>
        )}
      </div>
      <div className="chatInput">
        <input placeholder="Ask Lou about the playbook..." />
        <button className="primaryButton" onClick={() => setAsked(true)}>Send</button>
      </div>
    </section>
  )
}

function History({ commits }: { commits: Commit[] }): JSX.Element {
  return (
    <section className="historyScreen">
      <div className="toolbar">
        <select><option>All change types</option></select>
        <select><option>All lawyers</option></select>
        <input type="date" />
      </div>
      <div className="timeline">
        {commits.map((commit) => (
          <article className="commitCard" key={commit.id}>
            <div className="commitTop">
              <span className={`changeBadge ${commit.type}`}>{changeLabels[commit.type]}</span>
              <strong>{commit.topic}</strong>
              <time>{commit.time}</time>
            </div>
            <p className="muted">Committed by {commit.by} from {commit.source}</p>
            {commit.oldText && (
              <div className="diff">
                <p><del>{commit.oldText}</del></p>
                <p><ins>{commit.newText}</ins></p>
              </div>
            )}
            {!commit.oldText && <p>{commit.newText}</p>}
            {commit.note && <blockquote>{commit.note}</blockquote>}
          </article>
        ))}
      </div>
    </section>
  )
}

function ReviewQueue({ items, onResolve }: { items: ReviewItem[]; onResolve: (item: ReviewItem, approved: boolean) => void }): JSX.Element {
  if (items.length === 0) {
    return (
      <section className="emptyState">
        <ClipboardCheck size={34} />
        <h2>The playbook is up to date.</h2>
        <p>No proposed changes awaiting review.</p>
      </section>
    )
  }

  return (
    <section className="reviewGrid">
      {items.map((item) => (
        <article className="reviewCard" key={item.id}>
          <div className="reviewHeader">
            <span className={`changeBadge ${item.type}`}>{changeLabels[item.type]}</span>
            <h2>{item.topic}</h2>
            <b>{Math.round(item.confidence * 100)}%</b>
          </div>
          <p className="muted">{item.source}</p>
          <pre>{item.clause}</pre>
          <h3>Lou's Reasoning</h3>
          <p>{item.reasoning}</p>
          <div className="diff">
            <p>{item.current}</p>
            <p>{item.proposed}</p>
          </div>
          <label className="noteLabel">Lawyer note</label>
          <input placeholder="Optional note for audit trail" />
          <div className="reviewActions">
            <button className="rejectButton" onClick={() => onResolve(item, false)}><X size={16} /> Reject</button>
            <button className="approveButton" onClick={() => onResolve(item, true)}><Check size={16} /> Approve</button>
          </div>
        </article>
      ))}
    </section>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
