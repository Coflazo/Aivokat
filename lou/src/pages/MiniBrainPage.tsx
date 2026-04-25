import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { GitCommit, Send, Upload, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybookBrain, publishPlaybook, analyzePublicContractFile } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { AnalyzeContractResponse, AnalyzedContractClause, BrainEdgeView, BrainNodeView, PlaybookBrain } from '../types'
import { resolvePlaybookId, saveCurrentPlaybookId } from '../utils/currentPlaybook'
import { useUser } from '../contexts/UserContext'

const NODE_TYPE_COLORS: Record<string, string> = {
  clause:     '#007c79',
  preferred:  '#007c79',
  fallback_1: '#9b6f43',
  fallback_2: '#b98546',
  red_line:   '#4a2430',
  escalation: '#ec6602',
}

const NODE_TYPE_SIZE: Record<string, number> = {
  clause:     8,
  preferred:  5.5,
  fallback_1: 4.5,
  fallback_2: 4,
  red_line:   5,
  escalation: 4.5,
}

export function MiniBrainPage(): JSX.Element {
  const params = useParams()
  const playbookId = resolvePlaybookId(params.playbookId)
  const navigate = useNavigate()
  const { user } = useUser()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const graphRef = React.useRef<any>(null)
  const [dims, setDims] = React.useState({ w: 800, h: 600 })
  const [brain, setBrain] = React.useState<PlaybookBrain | null>(null)
  const [selected, setSelected] = React.useState<BrainNodeView | null>(null)
  const [citation, setCitation] = React.useState<AnalyzedContractClause | null>(null)
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; text: string } | null>(null)
  const mousePos = React.useRef({ x: 0, y: 0 })

  // Commit/publish state
  const [committedBy, setCommittedBy] = React.useState(user?.name ?? 'Peter')
  const [comment, setComment] = React.useState('')
  const [committed, setCommitted] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [publishing, setPublishing] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [commentError, setCommentError] = React.useState(false)

  // Contract analysis — available to all roles
  const [contractAnalysis, setContractAnalysis] = React.useState<AnalyzeContractResponse | null>(null)
  const [matchedIds, setMatchedIds] = React.useState<Set<string>>(new Set())
  const [uploading, setUploading] = React.useState(false)
  const contractFileRef = React.useRef<HTMLInputElement>(null)
  const circleAnimRef = React.useRef<number>(0)

  // Refs so onRenderFramePre never has a stale closure
  const contractAnalysisRef = React.useRef<AnalyzeContractResponse | null>(null)
  const circleProgressRef = React.useRef(0)
  const matchedIdsRef = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    contractAnalysisRef.current = contractAnalysis
    if (!contractAnalysis) circleProgressRef.current = 0
  }, [contractAnalysis])

  React.useEffect(() => {
    matchedIdsRef.current = matchedIds
  }, [matchedIds])

  React.useEffect(() => {
    function track(e: MouseEvent): void { mousePos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  // Contract circle d3 force
  React.useEffect(() => {
    const graph = graphRef.current
    if (!graph || !contractAnalysis) return
    const cx = dims.w / 2
    const cy = dims.h / 2
    const R = Math.min(dims.w, dims.h) * 0.41

    function contractForce(alpha: number): void {
      for (const node of (graph.graphData()?.nodes ?? [])) {
        const nx = (node.x ?? cx) - cx
        const ny = (node.y ?? cy) - cy
        const dist = Math.sqrt(nx * nx + ny * ny) || 1
        if (matchedIdsRef.current.has(node.id)) {
          const pull = ((dist - R) / dist) * alpha * 0.22
          node.vx = (node.vx ?? 0) - nx * pull
          node.vy = (node.vy ?? 0) - ny * pull
        } else {
          const inward = ((dist - R * 0.28) / dist) * alpha * 0.09
          node.vx = (node.vx ?? 0) - nx * inward + (-ny / dist) * alpha * 0.035
          node.vy = (node.vy ?? 0) - ny * inward + (nx / dist) * alpha * 0.035
        }
      }
    }
    ;(contractForce as any).initialize = (): void => {}
    graph.d3Force('contractCircle', contractForce)
    graph.d3ReheatSimulation()

    // Animate circle — write directly to ref so onRenderFramePre always reads fresh value
    cancelAnimationFrame(circleAnimRef.current)
    circleProgressRef.current = 0
    const start = performance.now()
    function animate(now: number): void {
      circleProgressRef.current = Math.min(1, (now - start) / 1200)
      if (circleProgressRef.current < 1) {
        circleAnimRef.current = requestAnimationFrame(animate)
      }
    }
    circleAnimRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(circleAnimRef.current)
      graph.d3Force('contractCircle', null)
    }
  }, [contractAnalysis, dims])

  async function uploadContract(file: File): Promise<void> {
    setUploading(true)
    setMessage(null)
    try {
      const result = await analyzePublicContractFile(playbookId, file)
      const ids = new Set<string>()
      for (const c of result.clauses) {
        if (c.match) {
          ids.add(c.match.matched_clause.clause_id)
          // Also match child hierarchy nodes
          ids.add(`${c.match.matched_clause.clause_id}:preferred`)
        }
      }
      setMatchedIds(ids)
      matchedIdsRef.current = ids
      setContractAnalysis(result)
      setCitation(null)
      setSelected(null)
    } catch {
      setMessage('Contract analysis failed — make sure this playbook is published.')
    } finally {
      setUploading(false)
    }
  }

  function dismissContract(): void {
    cancelAnimationFrame(circleAnimRef.current)
    circleProgressRef.current = 0
    contractAnalysisRef.current = null
    setContractAnalysis(null)
    setMatchedIds(new Set())
    matchedIdsRef.current = new Set()
    setCitation(null)
    graphRef.current?.d3Force('contractCircle', null)
    graphRef.current?.d3ReheatSimulation()
  }

  // Brain load
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
    if (!comment.trim()) { setCommentError(true); return }
    if (!committedBy.trim()) { setMessage('Add your name before committing.'); return }
    setCommentError(false)
    setCommitted(true)
    setMessage('Committed. Push when ready to publish to the Mega Brain.')
  }

  async function pushPublishedApi(): Promise<void> {
    if (!committed) { setMessage('Commit the playbook before pushing.'); return }
    setPublishing(true)
    setMessage(null)
    try {
      const response = await publishPlaybook(playbookId, committedBy, comment)
      setIsSuccess(true)
      setMessage(`Pushed ${response.mega_brain_entries} clauses. Hash ${response.commit_hash.slice(0, 7)}.`)
      setBrain(await fetchPlaybookBrain(playbookId))
    } catch {
      setMessage('Publish failed. Check name and comment.')
    } finally {
      setPublishing(false)
    }
  }

  function handleNodeClick(node: BrainNodeView): void {
    setSelected(node)
    setTooltip(null)
    // If contract is active and this node is matched, show citation
    if (contractAnalysisRef.current) {
      const clauseId = node.clause?.clause_id ?? node.id
      const matched = contractAnalysisRef.current.clauses.find(
        c => c.match?.matched_clause.clause_id === clauseId ||
             c.match?.matched_clause.clause_id === node.id
      )
      setCitation(matched ?? null)
    } else {
      setCitation(null)
    }
  }

  const statusLabel = brain ? brain.status.charAt(0).toUpperCase() + brain.status.slice(1).toLowerCase() : '—'
  const issueCount = brain ? brain.nodes.filter(n => n.status === 'issue').length : 0
  const warnCount  = brain ? brain.nodes.filter(n => n.status === 'warning').length : 0
  const clauseCount = brain ? brain.nodes.filter(n => n.node_type === 'clause').length : 0
  const isPeter = user?.role === 'peter'

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Mini brain</p>
          <h1>{brain?.playbook_id ?? 'Playbook brain'}</h1>
        </div>
        <div className="topbarActions">
          {isPeter && (
            <button className="secondaryAction" type="button" onClick={() => navigate(`/playbooks/${playbookId}/analysis`)}>
              Back to analysis
            </button>
          )}
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
              ref={graphRef}
              graphData={{ nodes: brain.nodes, links: brain.edges }}
              nodeId="id"
              width={dims.w}
              height={dims.h}
              nodeLabel={() => ''}
              nodeCanvasObject={(node, ctx, scale) =>
                drawMiniNode(node as BrainNodeView, ctx, scale, selected, matchedIdsRef)
              }
              onRenderFramePre={(ctx) => {
                if (contractAnalysisRef.current && circleProgressRef.current > 0) {
                  drawContractCircle(ctx, dims.w, dims.h, circleProgressRef.current)
                }
              }}
              linkCanvasObject={(link, ctx) =>
                drawMiniLink(link as LinkObject<BrainNodeView, BrainEdgeView> & BrainEdgeView, ctx)
              }
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
              onNodeClick={(node) => handleNodeClick(node as BrainNodeView)}
              onBackgroundClick={() => { setSelected(null); setCitation(null) }}
              cooldownTicks={Infinity}
              d3AlphaDecay={0.012}
              d3VelocityDecay={0.22}
              autoPauseRedraw={false}
              linkDirectionalParticles={(link) => {
                const l = link as BrainEdgeView
                return l.relationship === 'playbook_hierarchy' ? 1 : 2
              }}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleColor={(link) => {
                const l = link as BrainEdgeView
                return l.relationship === 'playbook_hierarchy' ? 'rgba(0,153,153,.4)' : 'rgba(155,111,67,.4)'
              }}
            />
          </div>

          <aside className="clauseInspector">
            {/* Stats row */}
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

            {/* Citation card — shown when a matched node is clicked */}
            {citation && (
              <div className="citationCard pageEnter" style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  background: `${NODE_TYPE_COLORS[selected?.node_type ?? 'clause']}12`,
                  borderLeft: `3px solid ${NODE_TYPE_COLORS[selected?.node_type ?? 'clause']}`,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                  <div>
                    <p className="panelKicker" style={{ color: NODE_TYPE_COLORS[selected?.node_type ?? 'clause'], marginBottom: 2 }}>
                      {selected?.node_type?.replace(/_/g, ' ')} · contract match
                    </p>
                    <strong style={{ fontSize: 13 }}>{selected?.label}</strong>
                  </div>
                  <button type="button" onClick={() => setCitation(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
                  {citation.segmented_clause?.text && (
                    <blockquote style={{
                      margin: 0, borderLeft: '3px solid rgba(47,42,34,.3)',
                      paddingLeft: 10, fontStyle: 'italic', fontSize: 12,
                      color: 'var(--ink)', lineHeight: 1.55,
                    }}>
                      "{citation.segmented_clause.text.slice(0, 260)}{citation.segmented_clause.text.length > 260 ? '…' : ''}"
                    </blockquote>
                  )}
                  {citation.match?.explanation && (
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                      {citation.match.explanation.slice(0, 180)}
                    </p>
                  )}
                  {citation.match && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        flex: 1, height: 5, borderRadius: 999, background: 'rgba(47,42,34,.1)', overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          width: `${Math.round(citation.match.score_breakdown.final_score * 100)}%`,
                          background: 'var(--turquoise)',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--turquoise)', whiteSpace: 'nowrap' }}>
                        {Math.round(citation.match.score_breakdown.final_score * 100)}% match
                      </span>
                    </div>
                  )}
                  {selected?.text && (
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                      Playbook position: {selected.text.slice(0, 120)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Regular node inspector */}
            {selected && !citation && (
              <div className="megaBrainNodeCard">
                <p className="panelKicker" style={{ color: NODE_TYPE_COLORS[selected.node_type] }}>
                  {selected.node_type.replace(/_/g, ' ')}
                </p>
                <h3>{selected.label}</h3>
                <p>{(selected.text || selected.clause?.preferred_position || '').slice(0, 200)}</p>
                {selected.clause?.red_line && (
                  <p style={{ marginTop: 8, fontSize: 11, color: 'var(--risk)' }}>
                    Red line: {selected.clause.red_line.slice(0, 100)}
                  </p>
                )}
                <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  {selected.node_type} / {selected.status}
                </p>
              </div>
            )}

            {/* Contract upload — all roles */}
            <section style={{ borderTop: '1px solid rgba(47,42,34,.1)', paddingTop: 12, marginTop: 4 }}>
              <p className="panelKicker">Contract check</p>
              <input
                ref={contractFileRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadContract(f)
                  e.target.value = ''
                }}
              />
              {contractAnalysis ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--turquoise)', fontWeight: 600 }}>
                      {matchedIds.size} matched · {contractAnalysis.clauses.length} total sections
                    </span>
                    <button type="button" onClick={dismissContract}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1 }}>
                    {contractAnalysis.risk_heatmap.preferred_count > 0 && <div style={{ flex: contractAnalysis.risk_heatmap.preferred_count, background: '#007c79' }} />}
                    {contractAnalysis.risk_heatmap.fallback_count > 0 && <div style={{ flex: contractAnalysis.risk_heatmap.fallback_count, background: '#9b6f43' }} />}
                    {contractAnalysis.risk_heatmap.redline_count > 0 && <div style={{ flex: contractAnalysis.risk_heatmap.redline_count, background: '#4a2430' }} />}
                    {contractAnalysis.risk_heatmap.unmapped_count > 0 && <div style={{ flex: contractAnalysis.risk_heatmap.unmapped_count, background: 'rgba(47,42,34,.18)' }} />}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                    {[
                      { label: 'Preferred', v: contractAnalysis.risk_heatmap.preferred_count, c: '#007c79' },
                      { label: 'Fallback', v: contractAnalysis.risk_heatmap.fallback_count, c: '#9b6f43' },
                      { label: 'Red line', v: contractAnalysis.risk_heatmap.redline_count, c: '#4a2430' },
                      { label: 'Unmapped', v: contractAnalysis.risk_heatmap.unmapped_count, c: 'var(--muted)' },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center' }}>
                        <strong style={{ display: 'block', fontSize: 16, color: s.c }}>{s.v}</strong>
                        <small style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</small>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 6px' }}>
                    Click highlighted nodes on the brain to see exact citations.
                  </p>
                  <button
                    className="secondaryAction drawerWide"
                    type="button"
                    onClick={() => contractFileRef.current?.click()}
                  >
                    <Upload size={13} /> Replace contract
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px' }}>
                    Upload a contract to overlay it on the brain and see which clauses are covered.
                  </p>
                  <button
                    className="secondaryAction drawerWide"
                    type="button"
                    disabled={uploading}
                    onClick={() => contractFileRef.current?.click()}
                  >
                    <Upload size={13} />
                    {uploading ? 'Analysing…' : 'Upload contract'}
                  </button>
                  {uploading && (
                    <div className="uploadProgressWrap" style={{ marginTop: 8 }}>
                      <div className="uploadProgressBar" style={{ width: '100%' }} />
                    </div>
                  )}
                </>
              )}
              {message && !isPeter && (
                <p style={{ fontSize: 11, marginTop: 8, color: isSuccess ? 'var(--turquoise)' : 'var(--risk)' }}>{message}</p>
              )}
            </section>

            {/* Publish flow — Peter only */}
            {isPeter && (
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
                    onChange={(e) => { setComment(e.target.value); if (commentError) setCommentError(false) }}
                    placeholder="Explain why this playbook is ready to publish."
                    rows={3}
                    style={commentError ? { borderColor: 'var(--risk)' } : {}}
                  />
                  {commentError && <span style={{ fontSize: 11, color: 'var(--risk)' }}>Commit comment required.</span>}
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
                  <p className={isSuccess ? 'pushSuccess' : ''} style={{ fontSize: 12, margin: 0 }}>{message}</p>
                )}
              </section>
            )}

            {/* Legend */}
            <section>
              <p className="panelKicker">Legend</p>
              <div className="megaBrainLegend">
                {[
                  { color: '#007c79', label: 'Clause / Preferred' },
                  { color: '#9b6f43', label: 'Fallback 1' },
                  { color: '#b98546', label: 'Fallback 2' },
                  { color: '#4a2430', label: 'Red line' },
                  { color: '#ec6602', label: 'Escalation' },
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

function drawContractCircle(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number): void {
  const cx = w / 2
  const cy = h / 2
  const R = Math.min(w, h) * 0.41
  // Glow halo
  const glowGrad = ctx.createRadialGradient(cx, cy, R - 30, cx, cy, R + 30)
  glowGrad.addColorStop(0, 'rgba(20,15,10,0)')
  glowGrad.addColorStop(0.5, `rgba(20,15,10,${0.07 * progress})`)
  glowGrad.addColorStop(1, 'rgba(20,15,10,0)')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = glowGrad
  ctx.lineWidth = 60
  ctx.stroke()
  // Dashed arc drawing proportional to progress
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
  ctx.strokeStyle = `rgba(20,15,10,${0.75 * progress})`
  ctx.lineWidth = 2.5
  ctx.setLineDash([12, 6])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
  // Label fades in at end
  if (progress > 0.9) {
    ctx.font = '10px Inter, sans-serif'
    ctx.fillStyle = `rgba(20,15,10,${Math.min(1, (progress - 0.9) * 10)})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CONTRACT BOUNDARY', cx, cy - R - 18)
  }
}

function drawMiniNode(
  node: BrainNodeView,
  ctx: CanvasRenderingContext2D,
  scale: number,
  selected: BrainNodeView | null,
  matchedIdsRef: React.MutableRefObject<Set<string>>,
): void {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const isClause = node.node_type === 'clause'
  const isMatched = matchedIdsRef.current.has(node.id) || matchedIdsRef.current.has(node.clause?.clause_id ?? '')
  const isSelected = selected?.id === node.id

  const radius = NODE_TYPE_SIZE[node.node_type] ?? 4.5
  const color = NODE_TYPE_COLORS[node.node_type] ?? '#007c79'

  // Issue/warning pulse ring
  if (isClause && node.status !== 'clean') {
    const ringAlpha = 0.18 + 0.10 * Math.sin(Date.now() / 600)
    ctx.beginPath()
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2)
    ctx.fillStyle = node.status === 'issue'
      ? `rgba(74,36,48,${ringAlpha})`
      : `rgba(236,102,2,${ringAlpha})`
    ctx.fill()
  }

  // Matched contract node ring
  if (isMatched) {
    const pulse = 0.45 + 0.3 * Math.sin(Date.now() / 400)
    ctx.beginPath()
    ctx.arc(x, y, radius + 7, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(20,15,10,${pulse})`
    ctx.lineWidth = 2 / scale
    ctx.stroke()
  }

  // Selected ring
  if (isSelected) {
    ctx.beginPath()
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    ctx.strokeStyle = isMatched ? 'rgba(0,153,153,.9)' : 'rgba(0,153,153,.7)'
    ctx.lineWidth = 1.8 / scale
    ctx.stroke()
  }

  // Main dot
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.92
  ctx.fill()
  ctx.globalAlpha = 1

  // Label
  const showLabel = isClause || (node.node_type === 'preferred' && scale > 1.2) || scale > 1.8
  if (!showLabel) return
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
  const isHierarchy = link.relationship === 'playbook_hierarchy'
  const isCross = link.edge_scope === 'cross_island'
  ctx.beginPath()
  ctx.moveTo(source.x ?? 0, source.y ?? 0)
  ctx.lineTo(target.x ?? 0, target.y ?? 0)
  if (isCross) {
    ctx.strokeStyle = 'rgba(0,153,153,.22)'
    ctx.setLineDash([3, 5])
  } else if (isHierarchy) {
    ctx.strokeStyle = 'rgba(47,42,34,.22)'
  } else {
    ctx.strokeStyle = 'rgba(47,42,34,.14)'
  }
  ctx.lineWidth = Math.max(0.6, (link.similarity ?? 0) * 2.2)
  ctx.stroke()
  ctx.setLineDash([])
}
