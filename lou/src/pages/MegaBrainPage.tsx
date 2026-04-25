import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { Search } from 'lucide-react'
import { fetchMegaBrain, searchMegaBrain } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { BrainNodeView, BrainEdgeView, MegaBrain, MegaBrainSearchResult } from '../types'

// A palette of distinct colors for each published playbook island.
const ISLAND_PALETTE = [
  '#007c79', // turquoise
  '#ec6602', // orange
  '#4a2076', // energy purple
  '#2f5f7a', // slate
  '#7a3f0a', // warm amber
  '#1a6b45', // forest green
  '#7c2d60', // plum
]

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
    const key = `${island.playbook_id}-v${island.playbook_version}`
    islandColorMap.set(key, ISLAND_PALETTE[i % ISLAND_PALETTE.length])
    islandLabelMap.set(key, `${island.name} v${island.playbook_version}`)
  })

  const nodes: GraphNode[] = brain.nodes.map(n => {
    const islandKey = n.island_id ?? ''
    const islandColor = islandColorMap.get(islandKey) ?? '#9b6f43'
    const playbookLabel = islandLabelMap.get(islandKey) ?? islandKey
    return {
      ...n,
      islandColor,
      playbookLabel,
      // Override color for non-clause nodes to be softer
      color: n.node_type === 'clause'
        ? (n.status === 'issue' ? '#4a2430' : n.status === 'warning' ? '#ec6602' : islandColor)
        : islandColor + 'aa',
    }
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
  const [dims, setDims] = React.useState({ w: 800, h: 600 })
  const [megaBrain, setMegaBrain] = React.useState<MegaBrain | null>(null)
  const [graph, setGraph] = React.useState<{ nodes: GraphNode[]; links: GraphEdge[] } | null>(null)
  const [selected, setSelected] = React.useState<GraphNode | null>(null)
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; text: string } | null>(null)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MegaBrainSearchResult[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searching, setSearching] = React.useState(false)
  const mousePos = React.useRef({ x: 0, y: 0 })
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
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  async function runSearch(): Promise<void> {
    if (query.trim().length < 2) return
    setSearching(true)
    try {
      setResults(await searchMegaBrain(query.trim()))
    } finally {
      setSearching(false)
    }
  }

  // Compute legend entries from islands
  const legendEntries = megaBrain?.islands.map((island, i) => ({
    color: ISLAND_PALETTE[i % ISLAND_PALETTE.length],
    label: `${island.name} v${island.playbook_version}`,
  })) ?? []

  const totalNodes = megaBrain?.nodes.length ?? 0
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
            placeholder="Search published clauses…"
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

      {loading && <BrainLoader label="Loading Mega Brain…" />}

      {graph && !loading && (
        <section className="megaBrainLayout pageEnter">
          <div className="megaBrainCanvas" ref={containerRef} aria-label="Mega brain graph">
            {megaBrain && megaBrain.nodes.length === 0 ? (
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
                graphData={{ nodes: graph.nodes, links: graph.links }}
                nodeId="id"
                width={dims.w}
                height={dims.h}
                nodeLabel={() => ''}
                nodeCanvasObject={(node, ctx, scale) => drawMegaNode(node as GraphNode, ctx, scale)}
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
                onBackgroundClick={() => setSelected(null)}
                cooldownTicks={120}
                d3AlphaDecay={0.012}
                d3VelocityDecay={0.25}
                linkDirectionalParticles={link => {
                  const l = link as GraphEdge & { edge_scope?: string }
                  return l.edge_scope === 'cross_island' ? 2 : 1
                }}
                linkDirectionalParticleSpeed={0.004}
                linkDirectionalParticleWidth={1.8}
                linkDirectionalParticleColor={link => {
                  const l = link as GraphEdge & { edge_scope?: string }
                  return l.edge_scope === 'cross_island' ? 'rgba(236,102,2,.7)' : 'rgba(0,153,153,.5)'
                }}
              />
            )}
          </div>

          <aside className="megaBrainInspector">
            {/* Stats */}
            <div className="megaBrainStat">
              {[
                { label: 'Playbooks', value: megaBrain?.islands.length ?? 0 },
                { label: 'Clause nodes', value: totalNodes },
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

            {/* Search results */}
            {results.length > 0 && (
              <div>
                <p className="panelKicker">Search results</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.map(r => (
                    <div key={`${r.playbook_id}-${r.clause_id}`} className="megaBrainNodeCard">
                      <strong style={{ fontSize: 13 }}>{r.topic}</strong>
                      <p style={{ marginTop: 4 }}>{r.document.slice(0, 140)}…</p>
                      <p style={{ marginTop: 4, fontSize: 11, color: 'var(--turquoise)' }}>
                        {r.playbook_id} · {(r.similarity * 100).toFixed(0)}% match
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            {legendEntries.length > 0 && (
              <div>
                <p className="panelKicker">Islands</p>
                <div className="megaBrainLegend">
                  {legendEntries.map(l => (
                    <div key={l.label} className="megaBrainLegendItem">
                      <div className="megaBrainLegendDot" style={{ background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

function drawMegaNode(node: GraphNode, ctx: CanvasRenderingContext2D, scale: number): void {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const isClause = node.node_type === 'clause'
  const r = isClause
    ? (node.status === 'issue' ? 9 : node.status === 'warning' ? 7.5 : 6.5)
    : 4.5

  // Soft glow halo
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5)
  glow.addColorStop(0, node.islandColor + '28')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(x, y, r * 3.5, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()

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

  // Main dot
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = node.color
  ctx.globalAlpha = 0.92
  ctx.fill()
  ctx.globalAlpha = 1

  // Label for clause nodes
  if (isClause || scale > 1.6) {
    ctx.font = `${(isClause ? 9.5 : 7.5) / scale}px Inter, sans-serif`
    ctx.fillStyle = '#31291f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(node.label, x, y + r + 3.5 / scale)
  }
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
    ctx.strokeStyle = 'rgba(236,102,2,.20)'
    ctx.setLineDash([4, 6])
    ctx.lineWidth = 1.2
  } else {
    ctx.strokeStyle = 'rgba(47,42,34,.13)'
    ctx.lineWidth = Math.max(0.5, (link.similarity ?? 0) * 2)
  }
  ctx.stroke()
  ctx.setLineDash([])
}
