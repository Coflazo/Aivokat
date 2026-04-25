import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { GitCommit, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybookBrain, publishPlaybook } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { BrainEdgeView, BrainNodeView, PlaybookBrain } from '../types'
import { resolvePlaybookId, saveCurrentPlaybookId } from '../utils/currentPlaybook'

export function MiniBrainPage(): JSX.Element {
  const params = useParams()
  const playbookId = resolvePlaybookId(params.playbookId)
  const navigate = useNavigate()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dims, setDims] = React.useState({ w: 800, h: 600 })
  const [brain, setBrain] = React.useState<PlaybookBrain | null>(null)
  const [selected, setSelected] = React.useState<BrainNodeView | null>(null)
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; text: string } | null>(null)
  const mousePos = React.useRef({ x: 0, y: 0 })
  React.useEffect(() => {
    function track(e: MouseEvent): void { mousePos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])
  const [committedBy, setCommittedBy] = React.useState('Peter')
  const [comment, setComment] = React.useState('')
  const [committed, setCommitted] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [publishing, setPublishing] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const data = await fetchPlaybookBrain(playbookId)
        if (!cancelled) {
          saveCurrentPlaybookId(data.playbook_id)
          setBrain(data)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [playbookId])

  React.useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  function commitDraft(): void {
    if (!comment.trim()) { setMessage('Add a commit comment before committing.'); return }
    if (!committedBy.trim()) { setMessage('Add your name before committing.'); return }
    setCommitted(true)
    setMessage('Committed. Push when you are ready to publish this playbook as a versioned API.')
  }

  async function pushPublishedApi(): Promise<void> {
    if (!committed) { setMessage('Commit the playbook before pushing.'); return }
    setPublishing(true)
    setMessage(null)
    try {
      const response = await publishPlaybook(playbookId, committedBy, comment)
      setIsSuccess(true)
      setMessage(`Pushed ${response.mega_brain_entries} clauses to the company Mega Brain. Hash ${response.commit_hash.slice(0, 7)}.`)
      setBrain(await fetchPlaybookBrain(playbookId))
    } catch {
      setMessage('Publish failed. Check committer name and comment.')
    } finally {
      setPublishing(false)
    }
  }

  const statusLabel = brain ? brain.status.charAt(0).toUpperCase() + brain.status.slice(1).toLowerCase() : '—'
  const issueCount = brain ? brain.nodes.filter(n => n.status === 'issue').length : 0
  const warnCount  = brain ? brain.nodes.filter(n => n.status === 'warning').length : 0
  const clauseCount = brain ? brain.nodes.filter(n => n.node_type === 'clause').length : 0

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Mini brain</p>
          <h1>{brain?.playbook_id ?? 'Playbook brain'}</h1>
        </div>
        <div className="topbarActions">
          <button className="secondaryAction" type="button" onClick={() => navigate(`/playbooks/${playbookId}/analysis`)}>
            Back to analysis
          </button>
          <button className="secondaryAction" type="button" onClick={() => navigate('/mega-brain')}>
            Mega Brain →
          </button>
        </div>
      </section>

      {loading && <BrainLoader label="Loading mini brain…" />}

      {brain && !loading && (
        <section className="miniBrainLayout pageEnter">
          <div className="miniBrainCanvas" ref={containerRef} aria-label="Mini brain graph">
            <ForceGraph2D<BrainNodeView, BrainEdgeView>
              graphData={{ nodes: brain.nodes, links: brain.edges }}
              nodeId="id"
              width={dims.w}
              height={dims.h}
              nodeLabel={() => ''}
              nodeCanvasObject={(node, ctx, scale) => drawMiniNode(node as BrainNodeView, ctx, scale)}
              linkCanvasObject={(link, ctx) => drawMiniLink(link as LinkObject<BrainNodeView, BrainEdgeView> & BrainEdgeView, ctx)}
              linkCanvasObjectMode={() => 'replace'}
              backgroundColor="rgba(0,0,0,0)"
              onNodeHover={(node) => {
                if (node) {
                  const n = node as BrainNodeView
                  const label = n.node_type === 'clause'
                    ? `${n.label} — ${n.status}`
                    : `${n.label}: ${(n.text || '').slice(0, 90)}`
                  setTooltip({ x: mousePos.current.x + 12, y: mousePos.current.y - 8, text: label })
                } else {
                  setTooltip(null)
                }
              }}
              onNodeClick={(node) => {
                setSelected(node as BrainNodeView)
                setTooltip(null)
              }}
              onBackgroundClick={() => setSelected(null)}
              cooldownTicks={100}
              d3AlphaDecay={0.015}
              d3VelocityDecay={0.22}
              linkDirectionalParticles={(link) => {
                const l = link as BrainEdgeView & { edge_scope?: string }
                return l.edge_scope === 'island' ? 1 : 2
              }}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleColor={() => 'rgba(0,153,153,.5)'}
            />
          </div>

          <aside className="clauseInspector">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
              {[
                { label: 'Clauses', value: clauseCount },
                { label: 'Status', value: statusLabel },
                { label: 'Issues', value: issueCount, color: issueCount > 0 ? 'var(--risk)' : undefined },
                { label: 'Warnings', value: warnCount, color: warnCount > 0 ? 'var(--orange)' : undefined },
              ].map(s => (
                <div key={s.label} className="megaBrainStatItem">
                  <strong style={s.color ? { color: s.color } : {}}>{s.value}</strong>
                  <small>{s.label}</small>
                </div>
              ))}
            </div>

            <section className="commitFlow">
              <p className="panelKicker">Publish to Mega Brain</p>
              <label>
                Committer
                <input value={committedBy} onChange={(e) => setCommittedBy(e.target.value)} />
              </label>
              <label>
                Commit note
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain why this playbook is ready to publish as an API."
                  rows={3}
                />
              </label>
              <button
                className="secondaryAction drawerWide"
                type="button"
                disabled={publishing || committed}
                onClick={commitDraft}
              >
                <GitCommit size={15} />
                {committed ? 'Committed ✓' : 'Commit'}
              </button>
              <button
                className="primaryAction drawerWide"
                type="button"
                disabled={publishing || !committed}
                onClick={() => void pushPublishedApi()}
              >
                <Send size={15} />
                {publishing ? 'Pushing…' : 'Push to API'}
              </button>
              {message && (
                <p className={isSuccess ? 'pushSuccess' : ''} style={{ fontSize: 12, margin: 0 }}>
                  {message}
                </p>
              )}
            </section>

            <section>
              <p className="panelKicker">Selected node</p>
              {selected ? (
                <div className="megaBrainNodeCard">
                  <h3>{selected.label}</h3>
                  <p>{(selected.text || selected.clause.preferred_position || '').slice(0, 180)}</p>
                  <p style={{ marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: selected.color }}>●</span>{' '}
                    {selected.node_type} / {selected.status}
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>Click a node to inspect it.</p>
              )}
            </section>

            <section>
              <p className="panelKicker">Legend</p>
              <div className="megaBrainLegend">
                {[
                  { color: '#007c79', label: 'Clause (clean)' },
                  { color: '#ec6602', label: 'Warning' },
                  { color: '#4a2430', label: 'Issue' },
                  { color: '#9b6f43', label: 'Position node' },
                ].map(l => (
                  <div key={l.label} className="megaBrainLegendItem">
                    <div className="megaBrainLegendDot" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      )}

      {tooltip && (
        <div className="nodeTooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </main>
  )
}

function drawMiniNode(node: BrainNodeView, ctx: CanvasRenderingContext2D, scale: number): void {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const isClause = node.node_type === 'clause'
  const radius = isClause
    ? (node.status === 'issue' ? 9 : node.status === 'warning' ? 7.5 : 6.5)
    : (node.node_type === 'red_line' ? 5.5 : 4.5)

  // Glow ring for issues/warnings
  if (isClause && node.status !== 'clean') {
    const ringAlpha = 0.18 + 0.10 * Math.sin(Date.now() / 600)
    ctx.beginPath()
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2)
    ctx.fillStyle = node.status === 'issue'
      ? `rgba(74,36,48,${ringAlpha})`
      : `rgba(236,102,2,${ringAlpha})`
    ctx.fill()
  }

  // Main dot
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = node.color
  ctx.globalAlpha = 0.92
  ctx.fill()
  ctx.globalAlpha = 1

  // Label
  const show = isClause || scale > 1.4
  if (!show) return
  ctx.font = `${(isClause ? 10 : 8) / scale}px Inter, sans-serif`
  ctx.fillStyle = '#31291f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(node.label, x, y + radius + 4 / scale)
}

function drawMiniLink(
  link: LinkObject<BrainNodeView, BrainEdgeView> & BrainEdgeView,
  ctx: CanvasRenderingContext2D,
): void {
  const source = link.source as NodeObject<BrainNodeView>
  const target = link.target as NodeObject<BrainNodeView>
  if (typeof source !== 'object' || typeof target !== 'object') return
  const isCross = link.edge_scope === 'cross_island'
  ctx.beginPath()
  ctx.moveTo(source.x ?? 0, source.y ?? 0)
  ctx.lineTo(target.x ?? 0, target.y ?? 0)
  ctx.strokeStyle = isCross ? 'rgba(0,153,153,.22)' : 'rgba(47,42,34,.14)'
  ctx.lineWidth = Math.max(0.6, (link.similarity ?? 0) * 2.2)
  if (isCross) {
    ctx.setLineDash([3, 5])
  }
  ctx.stroke()
  ctx.setLineDash([])
}
