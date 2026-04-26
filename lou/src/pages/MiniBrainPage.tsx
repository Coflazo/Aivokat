import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { GitCommit, Pencil, Plus, Send, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybookBrain, publishPlaybook, analyzePublicContractFile, analyzePublicContractText, brainCopilot } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { AnalyzeContractResponse, AnalyzedContractClause, BrainEdgeView, BrainNodeView, PlaybookBrain } from '../types'
import { resolvePlaybookId, saveCurrentPlaybookId } from '../utils/currentPlaybook'
import { useUser } from '../contexts/UserContext'

interface ProposedBrainChange {
  action: 'add' | 'edit' | 'delete'
  targetNodeId?: string | null
  targetClause?: string | null
  newText?: string | null
  newNodeType?: BrainNodeView['node_type'] | null
  explanation: string
}

const DEMO_CONTRACT_TEXT = `MUTUAL NON-DISCLOSURE AGREEMENT

This Agreement is entered into as of January 15, 2024, between TechCorp GmbH and Acme Industries AG.

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public technical, business or financial information disclosed by one party to the other, whether in writing, orally, or electronically, including trade secrets, product roadmaps, source code, customer lists, pricing data, and know-how.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party shall: (a) hold all Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent; (c) use it solely to evaluate a potential business relationship; (d) apply at least the same security measures it uses for its own confidential data, but no less than reasonable care.

3. PERMITTED RECIPIENTS
Confidential Information may be shared only with employees, contractors, legal counsel and financial advisors who have a strict need-to-know and are bound by written confidentiality obligations at least as restrictive as those herein.

4. TERM AND TERMINATION
This Agreement is effective on the date signed and continues for three (3) years. Either party may terminate with 30 days written notice. Confidentiality obligations survive termination for five (5) years.

5. RETURN OR DESTRUCTION
Upon request or termination, the Receiving Party shall promptly return or permanently destroy all Confidential Information, including copies and extracts, and certify destruction in writing within 10 business days.

6. INTELLECTUAL PROPERTY AND OWNERSHIP
No license or intellectual property rights are granted. All Confidential Information remains the exclusive property of the Disclosing Party. Nothing herein transfers ownership of any patents, trademarks, or copyrights.

7. GOVERNING LAW AND DISPUTE RESOLUTION
This Agreement is governed by the laws of Germany. Disputes shall first be submitted to mediation, then to binding arbitration under ICC rules in Munich, Germany.

8. LIABILITY AND REMEDIES
The parties acknowledge that breach would cause irreparable harm entitling the Disclosing Party to seek injunctive relief without bond. Aggregate liability under this Agreement shall not exceed EUR 50,000.

9. GENERAL PROVISIONS
This Agreement is the entire agreement between the parties regarding its subject matter and supersedes all prior oral and written agreements. It may not be amended except in writing signed by both parties.`

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
  const globalScaleRef = React.useRef(1)
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

  // Brain editing (Peter only)
  const [editMode, setEditMode] = React.useState(false)
  const [editLabel, setEditLabel] = React.useState('')
  const [editText, setEditText] = React.useState('')
  const [nlInput, setNlInput] = React.useState('')
  const [nlProcessing, setNlProcessing] = React.useState(false)
  const [proposedChange, setProposedChange] = React.useState<ProposedBrainChange | null>(null)

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
    // Graph-space: D3 simulation centers nodes around (0,0)
    const R = Math.min(dims.w, dims.h) * 0.41 / (globalScaleRef.current || 1)

    function contractForce(alpha: number): void {
      for (const node of (graph.graphData()?.nodes ?? [])) {
        const nx = node.x ?? 0
        const ny = node.y ?? 0
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
      setMessage('Contract analysis failed — check that the file is a valid PDF, DOCX or TXT.')
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

  // Memoize graphData so ForceGraph2D never gets a new object reference on
  // unrelated state changes (contract upload, selection, etc.), which would
  // restart the D3 simulation and scatter all nodes back to the origin.
  const graphData = React.useMemo(
    () => brain ? { nodes: brain.nodes, links: brain.edges } : { nodes: [], links: [] },
    [brain],
  )

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

  // ─── Brain editing ────────────────────────────────────────────────────────
  function startEditing(node: BrainNodeView): void {
    setEditMode(true)
    setEditLabel(node.label)
    setEditText(node.text ?? '')
  }

  function saveNodeEdit(): void {
    if (!selected) return
    setBrain(prev => prev ? {
      ...prev,
      nodes: prev.nodes.map(n => n.id === selected.id
        ? { ...n, label: editLabel.trim() || n.label, text: editText }
        : n),
    } : prev)
    setSelected(prev => prev ? { ...prev, label: editLabel.trim() || prev.label, text: editText } : prev)
    setEditMode(false)
  }

  function deleteSelectedNode(): void {
    if (!selected) return
    setBrain(prev => prev ? {
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== selected.id),
      edges: prev.edges.filter(e => {
        const s = typeof e.source === 'string' ? e.source : (e.source as BrainNodeView).id
        const t = typeof e.target === 'string' ? e.target : (e.target as BrainNodeView).id
        return s !== selected.id && t !== selected.id
      }),
    } : prev)
    setSelected(null)
    setCitation(null)
    setEditMode(false)
  }

  function addChildNode(parent: BrainNodeView, nodeType: BrainNodeView['node_type']): void {
    const newId = `${parent.clause?.clause_id ?? parent.id}:${nodeType}-${Date.now()}`
    const newNode: BrainNodeView = {
      id: newId,
      label: nodeType.replace(/_/g, ' '),
      status: 'clean',
      color: NODE_TYPE_COLORS[nodeType] ?? '#007c79',
      node_type: nodeType,
      text: '',
      clause: parent.clause,
    }
    setBrain(prev => prev ? {
      ...prev,
      nodes: [...prev.nodes, newNode],
      edges: [...prev.edges, { source: parent.id, target: newId, similarity: 0.5, relationship: 'playbook_hierarchy', edge_scope: 'island' }],
    } : prev)
    setSelected(newNode)
    setEditMode(true)
    setEditLabel(newNode.label)
    setEditText('')
    graphRef.current?.d3ReheatSimulation()
  }

  async function handleNlSubmit(): Promise<void> {
    if (!nlInput.trim() || !brain) return
    setNlProcessing(true)
    setProposedChange(null)
    try {
      const nodeSummaries = brain.nodes
        .filter(n => n.node_type === 'clause')
        .map(n => `${n.id}: ${n.label}`)
      const result = await brainCopilot(playbookId, nlInput, nodeSummaries)
      setProposedChange(result)
    } catch {
      setProposedChange({
        action: 'edit',
        explanation: 'Could not parse instruction. Please try being more specific.',
      })
    } finally {
      setNlProcessing(false)
      setNlInput('')
    }
  }

  function applyProposedChange(): void {
    if (!proposedChange || !brain) return
    if (proposedChange.action === 'delete' && proposedChange.targetNodeId) {
      const target = brain.nodes.find(n => n.id === proposedChange.targetNodeId)
      if (target) { setSelected(target); deleteSelectedNode() }
    } else if (proposedChange.action === 'add' && proposedChange.newNodeType) {
      const clauseNodes = brain.nodes.filter(n => n.node_type === 'clause')
      const parent = clauseNodes.find(n =>
        proposedChange.targetClause && n.label.toLowerCase().includes(proposedChange.targetClause.toLowerCase())
      ) ?? clauseNodes[0]
      if (parent) addChildNode(parent, proposedChange.newNodeType as BrainNodeView['node_type'])
    } else if (proposedChange.action === 'edit' && proposedChange.targetNodeId && proposedChange.newText) {
      setBrain(prev => prev ? {
        ...prev,
        nodes: prev.nodes.map(n => n.id === proposedChange.targetNodeId
          ? { ...n, text: proposedChange.newText! }
          : n),
      } : prev)
    }
    setProposedChange(null)
    setCommitted(false)
    setMessage('Change applied. Review the brain and commit when ready.')
  }

  function handleNodeClick(node: BrainNodeView): void {
    setSelected(node)
    setEditMode(false)
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
              graphData={graphData}
              nodeId="id"
              width={dims.w}
              height={dims.h}
              nodeLabel={() => ''}
              nodeCanvasObject={(node, ctx, scale) =>
                drawMiniNode(node as BrainNodeView, ctx, scale, selected, matchedIdsRef)
              }
              onRenderFramePre={(ctx, globalScale) => {
                globalScaleRef.current = globalScale
                if (contractAnalysisRef.current && circleProgressRef.current > 0) {
                  const R = Math.min(dims.w, dims.h) * 0.41 / globalScale
                  drawContractCircle(ctx, R, circleProgressRef.current)
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

            {/* Node inspector + editor */}
            {selected && !citation && (
              <div className="megaBrainNodeCard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <p className="panelKicker" style={{ color: NODE_TYPE_COLORS[selected.node_type], margin: 0 }}>
                    {selected.node_type.replace(/_/g, ' ')}
                  </p>
                  {isPeter && !editMode && (
                    <button type="button" onClick={() => startEditing(selected)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                </div>

                {editMode && isPeter ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, display: 'grid', gap: 3 }}>
                      Label
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        style={{ fontSize: 12, padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(47,42,34,.2)', background: 'rgba(255,251,243,.9)', color: 'var(--ink)', outline: 'none' }}
                      />
                    </label>
                    <label style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, display: 'grid', gap: 3 }}>
                      Text / position
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={4}
                        style={{ fontSize: 11, padding: '5px 8px', borderRadius: 5, border: '1px solid rgba(47,42,34,.2)', background: 'rgba(255,251,243,.9)', color: 'var(--ink)', outline: 'none', resize: 'vertical' }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="primaryAction" style={{ flex: 1, fontSize: 11 }} onClick={saveNodeEdit}>Save</button>
                      <button type="button" className="secondaryAction" style={{ flex: 1, fontSize: 11 }} onClick={() => setEditMode(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 style={{ margin: '0 0 4px' }}>{selected.label}</h3>
                    <p style={{ fontSize: 12, margin: '0 0 6px', lineHeight: 1.5 }}>
                      {(selected.text || selected.clause?.preferred_position || '').slice(0, 200)}
                    </p>
                    {selected.clause?.red_line && (
                      <p style={{ marginTop: 4, fontSize: 11, color: 'var(--risk)' }}>
                        Red line: {selected.clause.red_line.slice(0, 100)}
                      </p>
                    )}
                    <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                      {selected.node_type} / {selected.status}
                    </p>
                  </>
                )}

                {isPeter && !editMode && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <button type="button" onClick={deleteSelectedNode}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(180,40,40,.08)', border: '1px solid rgba(180,40,40,.22)', color: 'var(--risk)', cursor: 'pointer' }}>
                      <Trash2 size={10} /> Delete
                    </button>
                    {selected.node_type === 'clause' && (
                      <>
                        {(['preferred','fallback_1','fallback_2','red_line','escalation'] as const).map(t => (
                          <button key={t} type="button" onClick={() => addChildNode(selected, t)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 8px', borderRadius: 5, background: 'rgba(0,124,121,.07)', border: '1px solid rgba(0,124,121,.2)', color: 'var(--turquoise)', cursor: 'pointer' }}>
                            <Plus size={10} /> {t.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* NL Copilot — Peter only */}
            {isPeter && (
              <section style={{ borderTop: '1px solid rgba(47,42,34,.1)', paddingTop: 12, marginTop: 4 }}>
                <p className="panelKicker" style={{ marginBottom: 6 }}>Brain Copilot</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
                  Describe a change in plain language. Lou will propose an edit.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={nlInput}
                    onChange={e => setNlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleNlSubmit() } }}
                    placeholder="e.g. Add a red line for the liability clause…"
                    disabled={nlProcessing}
                    style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 5, border: '1px solid rgba(47,42,34,.18)', background: 'rgba(255,251,243,.9)', color: 'var(--ink)', outline: 'none' }}
                  />
                  <button type="button" onClick={() => void handleNlSubmit()} disabled={nlProcessing || !nlInput.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '6px 10px', borderRadius: 5, background: 'var(--turquoise)', color: 'white', border: 'none', cursor: 'pointer', opacity: nlProcessing || !nlInput.trim() ? 0.5 : 1 }}>
                    <Sparkles size={12} />
                  </button>
                </div>
                {nlProcessing && (
                  <div className="uploadProgressWrap" style={{ marginTop: 8 }}>
                    <div className="uploadProgressBar" style={{ width: '70%' }} />
                  </div>
                )}
                {proposedChange && (
                  <div className="pageEnter" style={{ marginTop: 10, background: 'rgba(0,124,121,.06)', border: '1px solid rgba(0,124,121,.2)', borderRadius: 8, padding: '10px 12px' }}>
                    <p className="panelKicker" style={{ color: 'var(--turquoise)', marginBottom: 4 }}>
                      Proposed: {proposedChange.action.toUpperCase()}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.5 }}>
                      {proposedChange.explanation}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="primaryAction" style={{ flex: 1, fontSize: 11 }} onClick={applyProposedChange}>
                        Accept &amp; apply
                      </button>
                      <button type="button" className="secondaryAction" style={{ flex: 1, fontSize: 11 }} onClick={() => setProposedChange(null)}>
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </section>
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
                  {!contractAnalysis && !uploading && (
                    <button
                      className="secondaryAction drawerWide"
                      type="button"
                      style={{ marginTop: 6, fontSize: 11 }}
                      onClick={() => {
                        setUploading(true)
                        setMessage(null)
                        analyzePublicContractText(playbookId, DEMO_CONTRACT_TEXT, 'Demo-NDA.txt')
                          .then((result) => {
                            const ids = new Set<string>()
                            for (const c of result.clauses) {
                              if (c.match) {
                                ids.add(c.match.matched_clause.clause_id)
                                ids.add(`${c.match.matched_clause.clause_id}:preferred`)
                              }
                            }
                            setMatchedIds(ids)
                            matchedIdsRef.current = ids
                            setContractAnalysis(result)
                            setCitation(null)
                            setSelected(null)
                          })
                          .catch(() => {
                            setMessage('Demo analysis failed — check the API connection.')
                          })
                          .finally(() => {
                            setUploading(false)
                          })
                      }}
                    >
                      Try demo NDA
                    </button>
                  )}
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

// R is in D3 graph-space units; ctx is already in graph-space (camera transform applied)
function drawContractCircle(ctx: CanvasRenderingContext2D, R: number, progress: number): void {
  // Draw centered on D3 simulation origin (0,0) — where nodes cluster
  const glowGrad = ctx.createRadialGradient(0, 0, R - R * 0.14, 0, 0, R + R * 0.14)
  glowGrad.addColorStop(0, 'rgba(20,15,10,0)')
  glowGrad.addColorStop(0.5, `rgba(20,15,10,${0.07 * progress})`)
  glowGrad.addColorStop(1, 'rgba(20,15,10,0)')
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.strokeStyle = glowGrad
  ctx.lineWidth = R * 0.28
  ctx.stroke()
  // Dashed arc drawing proportional to progress
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
  ctx.strokeStyle = `rgba(20,15,10,${0.75 * progress})`
  ctx.lineWidth = 2.5
  ctx.setLineDash([R * 0.055, R * 0.028])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
  // Label fades in at end
  if (progress > 0.9) {
    ctx.font = '10px Inter, sans-serif'
    ctx.fillStyle = `rgba(20,15,10,${Math.min(1, (progress - 0.9) * 10)})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CONTRACT BOUNDARY', 0, -R - 18)
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
