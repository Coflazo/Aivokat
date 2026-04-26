import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { Search, ZoomIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchMegaBrain, searchMegaBrain } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { BrainNodeView, BrainEdgeView, MegaBrain, MegaBrainSearchResult } from '../types'
import { useUser } from '../contexts/UserContext'

const ISLAND_PALETTE = [
  '#007c79', // turquoise
  '#ec6602', // orange
  '#4a2076', // energy purple
  '#2f5f7a', // slate
  '#7a3f0a', // warm amber
  '#1a6b45', // forest green
  '#7c2d60', // plum
  '#3a5f8a', // deep blue
]

const NODE_TYPE_COLOR: Record<string, string> = {
  clause:     '', // set by island palette
  preferred:  '#007c79',
  fallback_1: '#9b6f43',
  fallback_2: '#b98546',
  red_line:   '#4a2430',
  escalation: '#ec6602',
}

const NODE_TYPE_SIZE: Record<string, number> = {
  clause:     7,
  preferred:  4.5,
  fallback_1: 3.5,
  fallback_2: 3,
  red_line:   4,
  escalation: 3.5,
}

interface GraphNode extends BrainNodeView {
  islandColor: string
  playbookLabel: string
}

interface GraphEdge extends BrainEdgeView {
  source: string | GraphNode
  target: string | GraphNode
}

function buildGraph(brain: MegaBrain): { nodes: GraphNode[]; links: GraphEdge[] } {
  const islandColorMap = new Map<string, string>()
  const islandLabelMap = new Map<string, string>()
  brain.islands.forEach((island, i) => {
    islandColorMap.set(island.playbook_id, ISLAND_PALETTE[i % ISLAND_PALETTE.length])
    islandLabelMap.set(island.playbook_id, `${island.name} v${island.playbook_version}`)
  })

  // Pre-assign island ring positions so warmupTicks starts with nodes already separated
  const count = brain.islands.length
  const ringR = count <= 2 ? 320 : count <= 5 ? 480 : 650
  const islandPosMap = new Map<string, { x: number; y: number }>()
  brain.islands.forEach((island, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    islandPosMap.set(island.playbook_id, { x: Math.cos(angle) * ringR, y: Math.sin(angle) * ringR })
  })

  const nodes: GraphNode[] = brain.nodes.map(n => {
    const islandKey = n.island_id ?? ''
    const islandColor = islandColorMap.get(islandKey) ?? '#9b6f43'
    const playbookLabel = islandLabelMap.get(islandKey) ?? islandKey

    let nodeColor: string
    if (n.node_type === 'clause') {
      nodeColor = n.status === 'issue' ? '#4a2430' : n.status === 'warning' ? '#ec6602' : islandColor
    } else {
      nodeColor = NODE_TYPE_COLOR[n.node_type] ?? n.color ?? islandColor
    }

    const pos = islandPosMap.get(islandKey)
    const jitter = () => (Math.random() - 0.5) * 60
    return { ...n, islandColor, playbookLabel, color: nodeColor, x: pos ? pos.x + jitter() : undefined, y: pos ? pos.y + jitter() : undefined }
  })

  const links: GraphEdge[] = (brain.edges as BrainEdgeView[]).map(e => ({
    ...e,
    source: typeof e.source === 'string' ? e.source : (e.source as BrainNodeView).id,
    target: typeof e.target === 'string' ? e.target : (e.target as BrainNodeView).id,
  }))

  return { nodes, links }
}

export function MegaBrainPage(): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const graphRef = React.useRef<any>(null)
  const [dims, setDims] = React.useState({ w: 800, h: 600 })
  const [megaBrain, setMegaBrain] = React.useState<MegaBrain | null>(null)
  const [graph, setGraph] = React.useState<{ nodes: GraphNode[]; links: GraphEdge[] } | null>(null)
  const [selected, setSelected] = React.useState<GraphNode | null>(null)
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; text: string } | null>(null)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MegaBrainSearchResult[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searching, setSearching] = React.useState(false)
  const [highlightedIsland, setHighlightedIsland] = React.useState<string | null>(null)
  const mousePos = React.useRef({ x: 0, y: 0 })
  const navigate = useNavigate()
  const { user } = useUser()

  const graphData = React.useMemo(
    () => graph ? { nodes: graph.nodes, links: graph.links } : { nodes: [], links: [] },
    [graph],
  )

  React.useEffect(() => {
    function track(e: MouseEvent): void { mousePos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const data = await fetchMegaBrain()
        if (!cancelled) {
          setMegaBrain(data)
          setGraph(buildGraph(data))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  React.useEffect(() => {
    if (!graph || loading || !containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    ro.observe(el)
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) setDims({ w: rect.width, h: rect.height })
    const t = setTimeout(() => { graphRef.current?.zoomToFit(400, 30) }, 200)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [graph, loading])

  // Island separation: place each playbook at a ring position
  React.useEffect(() => {
    const g = graphRef.current
    if (!g || !megaBrain || megaBrain.islands.length === 0) return

    const count = megaBrain.islands.length
    const ringR = count <= 2 ? 320 : count <= 5 ? 480 : 650
    const targetPos = new Map<string, { x: number; y: number }>()
    megaBrain.islands.forEach((island, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2
      targetPos.set(island.playbook_id, { x: Math.cos(angle) * ringR, y: Math.sin(angle) * ringR })
    })

    function islandRingForce(alpha: number): void {
      for (const node of (g.graphData()?.nodes ?? [])) {
        const t = targetPos.get((node as any).island_id ?? '')
        if (!t) continue
        node.vx = (node.vx ?? 0) + (t.x - (node.x ?? 0)) * alpha * 0.15
        node.vy = (node.vy ?? 0) + (t.y - (node.y ?? 0)) * alpha * 0.15
      }
    }
    ;(islandRingForce as any).initialize = (): void => {}
    g.d3Force('islandRing', islandRingForce)
    g.d3Force('charge')?.strength(-350)
    g.d3Force('link')?.distance((link: any) =>
      link.edge_scope === 'cross_island' ? 700 : 60
    )
    g.d3ReheatSimulation()
    return () => { g.d3Force('islandRing', null) }
  }, [megaBrain])

  async function runSearch(): Promise<void> {
    if (query.trim().length < 2) return
    setSearching(true)
    try {
      const res = await searchMegaBrain(query.trim())
      setResults(res)
      // Zoom to best matching island
      if (res.length > 0 && graph) {
        const bestIsland = res[0].playbook_id
        setHighlightedIsland(bestIsland)
        zoomToIsland(bestIsland)
      }
    } finally {
      setSearching(false)
    }
  }

  function zoomToIsland(islandId: string): void {
    if (!graph || !graphRef.current) return
    const islandNodes = graph.nodes.filter(n => n.island_id === islandId && n.node_type === 'clause')
    if (islandNodes.length === 0) return

    const xs = islandNodes.map(n => n.x ?? 0)
    const ys = islandNodes.map(n => n.y ?? 0)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    graphRef.current.centerAt(cx, cy, 800)
    graphRef.current.zoom(2.4, 800)
  }

  function goToMiniBrain(islandId: string): void {
    navigate(`/playbooks/${islandId}/brain`)
  }

  const legendEntries = megaBrain?.islands.map((island, i) => ({
    color: ISLAND_PALETTE[i % ISLAND_PALETTE.length],
    label: `${island.name} v${island.playbook_version}`,
    id: island.playbook_id,
  })) ?? []

  const totalNodes = megaBrain?.nodes.filter(n => n.node_type === 'clause').length ?? 0
  const totalEdges = megaBrain?.edges.length ?? 0
  const crossEdges = (megaBrain?.edges as (BrainEdgeView & { edge_scope?: string })[] ?? [])
    .filter(e => e.edge_scope === 'cross_island').length

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Company knowledge</p>
          <h1>Mega Brain</h1>
        </div>
        <div className="megaSearch">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void runSearch()}
            placeholder={user?.role === 'suzanne' ? 'Search your contract topic…' : 'Search published clauses…'}
          />
          <button
            className="primaryAction"
            type="button"
            disabled={searching}
            onClick={() => void runSearch()}
          >
            <Search size={16} />
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </section>

      <section className="megaBrainLayout pageEnter">
          <div className="megaBrainCanvas" ref={containerRef} aria-label="Mega brain graph" style={{ position: 'relative' }}>
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 10, pointerEvents: 'none',
              }}>
                <BrainLoader label="Loading Mega Brain…" />
              </div>
            )}
            {!loading && megaBrain && megaBrain.nodes.length === 0 ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 16, color: 'var(--muted)',
              }}>
                <p className="panelKicker">No islands yet</p>
                <h2 style={{ margin: 0 }}>Publish a playbook first</h2>
                <p style={{ fontSize: 13, maxWidth: 340, textAlign: 'center' }}>
                  Each published playbook appears here as its own island in the company brain.
                </p>
              </div>
            ) : (
              <ForceGraph2D<GraphNode, GraphEdge>
                ref={graphRef}
                graphData={graphData}
                nodeId="id"
                width={dims.w}
                height={dims.h}
                nodeLabel={() => ''}
                nodeCanvasObject={(node, ctx, scale) => drawMegaNode(node as GraphNode, ctx, scale, highlightedIsland, selected)}
                linkCanvasObject={(link, ctx) => drawMegaLink(link as LinkObject<GraphNode, GraphEdge> & GraphEdge, ctx)}
                linkCanvasObjectMode={() => 'replace'}
                backgroundColor="rgba(0,0,0,0)"
                onNodeHover={(node) => {
                  if (node) {
                    const n = node as GraphNode
                    setTooltip({
                      x: mousePos.current.x + 14,
                      y: mousePos.current.y - 10,
                      text: `${n.label} · ${n.playbookLabel}`,
                    })
                  } else {
                    setTooltip(null)
                  }
                }}
                onNodeClick={node => {
                  setSelected(node as GraphNode)
                  setTooltip(null)
                }}
                onBackgroundClick={() => { setSelected(null); setHighlightedIsland(null) }}
                warmupTicks={120}
                cooldownTicks={200}
                d3AlphaDecay={0.018}
                d3VelocityDecay={0.28}
                autoPauseRedraw={false}
                linkDirectionalParticles={link => {
                  const l = link as GraphEdge & { edge_scope?: string }
                  return l.edge_scope === 'cross_island' ? 3 : 1
                }}
                linkDirectionalParticleSpeed={0.004}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleColor={link => {
                  const l = link as GraphEdge & { edge_scope?: string }
                  return l.edge_scope === 'cross_island' ? 'rgba(236,102,2,.8)' : 'rgba(0,153,153,.5)'
                }}
              />
            )}
          </div>

          <aside className="megaBrainInspector">
            {/* Stats */}
            <div className="megaBrainStat">
              {[
                { label: 'Playbooks', value: megaBrain?.islands.length ?? 0 },
                { label: 'Clauses', value: totalNodes },
                { label: 'Connections', value: totalEdges },
                { label: 'Cross-links', value: crossEdges },
              ].map(s => (
                <div key={s.label} className="megaBrainStatItem">
                  <strong>{s.value}</strong>
                  <small>{s.label}</small>
                </div>
              ))}
            </div>

            {/* Selected node */}
            {selected && (
              <div className="megaBrainNodeCard">
                <p className="panelKicker" style={{ color: selected.islandColor }}>
                  {selected.playbookLabel}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {selected.node_type.replace('_', ' ')}
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
                {selected.node_type === 'clause' && (
                  <button
                    className="primaryAction"
                    type="button"
                    style={{ marginTop: 10, width: '100%', fontSize: 12 }}
                    onClick={() => goToMiniBrain(selected.island_id ?? '')}
                  >
                    Open Mini Brain →
                  </button>
                )}
              </div>
            )}

            {/* Search results */}
            {results.length > 0 && (
              <div>
                <p className="panelKicker">Search results</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.map(r => (
                    <div
                      key={`${r.playbook_id}-${r.clause_id}`}
                      className="megaBrainNodeCard"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setHighlightedIsland(r.playbook_id); zoomToIsland(r.playbook_id) }}
                    >
                      <strong style={{ fontSize: 13 }}>{r.topic}</strong>
                      <p style={{ marginTop: 4 }}>{r.document.slice(0, 120)}…</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <p style={{ fontSize: 11, color: 'var(--turquoise)' }}>
                          {r.playbook_id} · {(r.similarity * 100).toFixed(0)}% match
                        </p>
                        <button
                          className="secondaryAction"
                          type="button"
                          style={{ fontSize: 10, padding: '3px 8px', minHeight: 24 }}
                          onClick={(e) => { e.stopPropagation(); goToMiniBrain(r.playbook_id) }}
                        >
                          <ZoomIn size={11} />
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Node type legend */}
            <div>
              <p className="panelKicker">Node types</p>
              <div className="megaBrainLegend" style={{ flexDirection: 'column', gap: 5 }}>
                {[
                  { color: '#007c79', label: 'Clause', shape: 'circle' },
                  { color: '#007c79', label: 'Preferred', shape: 'ring' },
                  { color: '#9b6f43', label: 'Fallback 1', shape: 'diamond' },
                  { color: '#b98546', label: 'Fallback 2', shape: 'square' },
                  { color: '#4a2430', label: 'Red line', shape: 'danger' },
                  { color: '#ec6602', label: 'Escalation', shape: 'triangle' },
                ].map(l => (
                  <div key={l.label} className="megaBrainLegendItem">
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
                      {l.shape === 'circle' && <circle cx="7" cy="7" r="5" fill={l.color} />}
                      {l.shape === 'ring' && <><circle cx="7" cy="7" r="5" fill={l.color} /><circle cx="7" cy="7" r="3.2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" fill="none" /></>}
                      {l.shape === 'diamond' && <polygon points="7,1 13,7 7,13 1,7" fill={l.color} />}
                      {l.shape === 'square' && <rect x="2" y="2" width="10" height="10" fill={l.color} />}
                      {l.shape === 'danger' && <><circle cx="7" cy="7" r="5" fill={l.color} /><circle cx="7" cy="7" r="6" stroke="rgba(180,40,40,0.7)" strokeWidth="1.5" fill="none" /></>}
                      {l.shape === 'triangle' && <polygon points="7,1 13,13 1,13" fill={l.color} />}
                    </svg>
                    <span style={{ fontSize: 11 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Island legend */}
            {legendEntries.length > 0 && (
              <div>
                <p className="panelKicker">Islands</p>
                <div className="megaBrainLegend" style={{ flexDirection: 'column' }}>
                  {legendEntries.map(l => (
                    <div
                      key={l.label}
                      className="megaBrainLegendItem"
                      style={{
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        background: highlightedIsland === l.id ? `${l.color}18` : 'transparent',
                      }}
                      onClick={() => { setHighlightedIsland(l.id); zoomToIsland(l.id) }}
                    >
                      <div className="megaBrainLegendDot" style={{ background: l.color, width: 12, height: 12 }} />
                      <span style={{ flex: 1, fontSize: 12 }}>{l.label}</span>
                      <ZoomIn size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>

      {tooltip && (
        <div className="nodeTooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </main>
  )
}

function drawMegaNode(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  scale: number,
  highlightedIsland: string | null,
  selected: GraphNode | null,
): void {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const isClause = node.node_type === 'clause'
  const r = NODE_TYPE_SIZE[node.node_type] ?? 4

  const isDimmed = highlightedIsland !== null && node.island_id !== highlightedIsland
  const isHighlighted = highlightedIsland !== null && node.island_id === highlightedIsland
  const isSelected = selected?.id === node.id

  // Soft glow halo for clause nodes
  if (isClause && !isDimmed) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5)
    glow.addColorStop(0, node.islandColor + '28')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(x, y, r * 3.5, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  }

  // Highlighted island glow
  if (isHighlighted && isClause) {
    const pulse = 0.18 + 0.10 * Math.sin(Date.now() / 400)
    ctx.beginPath()
    ctx.arc(x, y, r + 8, 0, Math.PI * 2)
    ctx.fillStyle = node.islandColor + Math.round(pulse * 255).toString(16).padStart(2, '0')
    ctx.fill()
  }

  // Issue/warning pulse ring
  if (isClause && node.status !== 'clean') {
    const pulse = 0.15 + 0.10 * Math.sin(Date.now() / 500)
    ctx.beginPath()
    ctx.arc(x, y, r + 5, 0, Math.PI * 2)
    ctx.fillStyle = node.status === 'issue'
      ? `rgba(74,36,48,${pulse})`
      : `rgba(236,102,2,${pulse})`
    ctx.fill()
  }

  // Selected ring
  if (isSelected) {
    ctx.beginPath()
    ctx.arc(x, y, r + 4, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,153,153,.7)'
    ctx.lineWidth = 2 / scale
    ctx.stroke()
  }

  // Draw shape by node type
  ctx.globalAlpha = isDimmed ? 0.18 : 0.92
  if (node.node_type === 'clause') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = node.color; ctx.fill()
  } else if (node.node_type === 'preferred') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = node.color; ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke()
  } else if (node.node_type === 'fallback_1') {
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
    ctx.fillStyle = node.color; ctx.fill()
  } else if (node.node_type === 'fallback_2') {
    const s = r * 0.9; ctx.beginPath(); ctx.rect(x - s, y - s, s * 2, s * 2); ctx.fillStyle = node.color; ctx.fill()
  } else if (node.node_type === 'red_line') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = node.color; ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(180,40,40,0.7)'; ctx.lineWidth = 1.5 / scale; ctx.stroke()
  } else if (node.node_type === 'escalation') {
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.87, y + r * 0.5); ctx.lineTo(x - r * 0.87, y + r * 0.5); ctx.closePath()
    ctx.fillStyle = node.color; ctx.fill()
  } else {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = node.color; ctx.fill()
  }
  ctx.globalAlpha = 1

  // Label for clause nodes (or all at high zoom)
  const showLabel = isClause || scale > 1.8
  if (!showLabel || isDimmed) return
  ctx.font = `${(isClause ? 9.5 : 7.5) / scale}px Inter, sans-serif`
  ctx.fillStyle = '#31291f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(node.label, x, y + r + 3.5 / scale)
}

function drawMegaLink(
  link: LinkObject<GraphNode, GraphEdge> & GraphEdge,
  ctx: CanvasRenderingContext2D,
): void {
  const source = link.source as NodeObject<GraphNode>
  const target = link.target as NodeObject<GraphNode>
  if (typeof source !== 'object' || typeof target !== 'object') return
  const isCross = (link as { edge_scope?: string }).edge_scope === 'cross_island'
  ctx.beginPath()
  ctx.moveTo(source.x ?? 0, source.y ?? 0)
  ctx.lineTo(target.x ?? 0, target.y ?? 0)
  if (isCross) {
    ctx.strokeStyle = 'rgba(236,102,2,.22)'
    ctx.setLineDash([4, 6])
    ctx.lineWidth = 1.4
  } else {
    ctx.strokeStyle = 'rgba(47,42,34,.12)'
    ctx.lineWidth = Math.max(0.4, (link.similarity ?? 0) * 1.8)
  }
  ctx.stroke()
  ctx.setLineDash([])
}
