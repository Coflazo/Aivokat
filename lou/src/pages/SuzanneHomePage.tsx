import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { useNavigate } from 'react-router-dom'
import { fetchPlaybookBrain, fetchPublicPlaybooks } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { BrainEdgeView, BrainNodeView, PlaybookBrain, PublicPlaybookListItem } from '../types'
import { saveCurrentPlaybookId } from '../utils/currentPlaybook'

const NODE_TYPE_COLORS: Record<string, string> = {
  clause:     '#007c79',
  preferred:  '#007c79',
  fallback_1: '#9b6f43',
  fallback_2: '#b98546',
  red_line:   '#4a2430',
  escalation: '#ec6602',
}

// Ghost node positions scattered inside the ellipse for the empty placeholder
const GHOST_NODES = [
  { cx: 200, cy: 130 }, { cx: 155, cy: 110 }, { cx: 245, cy: 115 },
  { cx: 290, cy: 145 }, { cx: 120, cy: 155 }, { cx: 175, cy: 170 },
  { cx: 230, cy: 165 }, { cx: 270, cy: 175 }, { cx: 145, cy: 185 },
  { cx: 320, cy: 165 }, { cx: 200, cy: 185 }, { cx: 100, cy: 145 },
  { cx: 255, cy: 195 }, { cx: 175, cy: 200 },
]

const GHOST_LINKS: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 5], [2, 3], [3, 7], [4, 9], [5, 6], [8, 13],
]

function EmptyBrainPlaceholder(): JSX.Element {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ display: 'block' }}>
      <ellipse
        cx={200} cy={150} rx={160} ry={110}
        fill="none" stroke="rgba(47,42,34,.10)" strokeWidth="1.5"
      />
      {GHOST_LINKS.map(([a, b], i) => (
        <line
          key={i}
          x1={GHOST_NODES[a].cx} y1={GHOST_NODES[a].cy}
          x2={GHOST_NODES[b].cx} y2={GHOST_NODES[b].cy}
          stroke="rgba(47,42,34,.07)" strokeWidth="1"
        />
      ))}
      {GHOST_NODES.map((pos, i) => (
        <circle key={i} cx={pos.cx} cy={pos.cy} r={4} fill="rgba(47,42,34,.10)" />
      ))}
      <text x={200} y={290} fontSize={12} fill="rgba(47,42,34,.35)" textAnchor="middle">
        Select or upload a playbook
      </text>
    </svg>
  )
}

function drawPreviewNode(
  node: NodeObject<BrainNodeView>,
  ctx: CanvasRenderingContext2D,
): void {
  const n = node as BrainNodeView
  const x = n.x ?? 0
  const y = n.y ?? 0
  const isClause = n.node_type === 'clause'
  const radius = isClause ? 7 : 4
  const color = NODE_TYPE_COLORS[n.node_type] ?? '#007c79'
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.88
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawPreviewLink(
  link: LinkObject<BrainNodeView, BrainEdgeView>,
  ctx: CanvasRenderingContext2D,
): void {
  const source = link.source as NodeObject<BrainNodeView>
  const target = link.target as NodeObject<BrainNodeView>
  if (typeof source !== 'object' || typeof target !== 'object') return
  ctx.beginPath()
  ctx.moveTo(source.x ?? 0, source.y ?? 0)
  ctx.lineTo(target.x ?? 0, target.y ?? 0)
  ctx.strokeStyle = 'rgba(47,42,34,.12)'
  ctx.lineWidth = 0.8
  ctx.stroke()
}

export function SuzanneHomePage({ onPlaybookSelected }: { onPlaybookSelected?: (id: string) => void }): JSX.Element {
  const navigate = useNavigate()

  const [playbooks, setPlaybooks] = React.useState<PublicPlaybookListItem[]>([])
  const [loadingList, setLoadingList] = React.useState(true)
  const [selectedPlaybook, setSelectedPlaybook] = React.useState<PublicPlaybookListItem | null>(null)
  const [brain, setBrain] = React.useState<PlaybookBrain | null>(null)
  const [brainLoading, setBrainLoading] = React.useState(false)

  const previewContainerRef = React.useRef<HTMLDivElement>(null)
  const [previewDims, setPreviewDims] = React.useState({ w: 600, h: 480 })

  const graphData = React.useMemo(
    () => brain ? { nodes: brain.nodes, links: brain.edges } : { nodes: [], links: [] },
    [brain],
  )

  // Track preview container size
  React.useEffect(() => {
    if (!previewContainerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setPreviewDims({ w: width, h: height })
    })
    ro.observe(previewContainerRef.current)
    return () => ro.disconnect()
  }, [])

  // Load published playbooks on mount
  React.useEffect(() => {
    setLoadingList(true)
    fetchPublicPlaybooks()
      .then((data) => setPlaybooks(data))
      .catch(() => setPlaybooks([]))
      .finally(() => setLoadingList(false))
  }, [])

  async function handleSelectPlaybook(playbook: PublicPlaybookListItem): Promise<void> {
    setSelectedPlaybook(playbook)
    setBrainLoading(true)
    setBrain(null)
    try {
      const data = await fetchPlaybookBrain(playbook.playbook_id)
      setBrain(data)
    } catch {
      setBrain(null)
    } finally {
      setBrainLoading(false)
    }
  }

  function handleOpenMiniBrain(): void {
    if (!selectedPlaybook) return
    saveCurrentPlaybookId(selectedPlaybook.playbook_id)
    onPlaybookSelected?.(selectedPlaybook.playbook_id)
    navigate(`/playbooks/${selectedPlaybook.playbook_id}/brain`)
  }

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Contract Review</p>
          <h1>Choose a playbook</h1>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingTop: 12 }}>
        {/* LEFT COLUMN */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
            Pick a published playbook to work against. Your contract analysis will be matched to its clauses.
          </p>

          <div style={{ display: 'grid', gap: 8 }}>
            {loadingList && (
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Loading playbooks…</p>
            )}
            {!loadingList && playbooks.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No published playbooks available yet.</p>
            )}
            {playbooks.map((playbook) => {
              const isSelected = selectedPlaybook?.playbook_id === playbook.playbook_id
              return (
                <div
                  key={playbook.playbook_id}
                  style={{
                    background: 'rgba(255,251,243,.92)',
                    border: isSelected ? '2px solid var(--turquoise)' : '1px solid rgba(47,42,34,.13)',
                    borderRadius: 8,
                    padding: isSelected ? 13 : 14,
                    display: 'grid',
                    gap: 8,
                    transition: 'border .15s',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>
                      {playbook.name}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {playbook.clause_count} clauses · {playbook.owner}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="secondaryAction"
                    onClick={() => void handleSelectPlaybook(playbook)}
                  >
                    Work with this brain →
                  </button>
                </div>
              )
            })}
          </div>

          {selectedPlaybook && (
            <button
              type="button"
              className="primaryAction"
              style={{ width: '100%', marginTop: 16 }}
              onClick={handleOpenMiniBrain}
            >
              Open Mini Brain →
            </button>
          )}
        </div>

        {/* RIGHT COLUMN — brain preview */}
        <div style={{ flex: 1 }}>
          <div
            ref={previewContainerRef}
            style={{
              height: 480,
              borderRadius: 10,
              background: 'rgba(255,251,243,.64)',
              border: '1px solid rgba(47,42,34,.13)',
              boxShadow: '0 24px 70px rgba(47,42,34,.12)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {brainLoading && <BrainLoader label="Loading brain…" />}
            {!brainLoading && !brain && <EmptyBrainPlaceholder />}
            {!brainLoading && brain && (
              <ForceGraph2D<BrainNodeView, BrainEdgeView>
                graphData={graphData}
                nodeId="id"
                width={previewDims.w}
                height={previewDims.h}
                nodeLabel={() => ''}
                nodeCanvasObject={(node, ctx) => drawPreviewNode(node as NodeObject<BrainNodeView>, ctx)}
                linkCanvasObject={(link, ctx) => drawPreviewLink(link as LinkObject<BrainNodeView, BrainEdgeView>, ctx)}
                linkCanvasObjectMode={() => 'replace'}
                backgroundColor="rgba(0,0,0,0)"
                cooldownTicks={200}
                d3AlphaDecay={0.015}
                d3VelocityDecay={0.25}
                autoPauseRedraw={false}
              />
            )}
          </div>

          {selectedPlaybook && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,251,243,.80)', borderRadius: 8, border: '1px solid rgba(47,42,34,.10)' }}>
              <strong style={{ fontSize: 13, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                {selectedPlaybook.name}
              </strong>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                Once in the Mini Brain, you can chat with the brain and upload a contract for analysis.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
