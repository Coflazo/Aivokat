import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { useNavigate } from 'react-router-dom'
import { fetchAllPlaybooks, fetchPlaybookBrain, uploadApiPlaybook } from '../api/client'
import { BrainLoader } from '../components/BrainLoader'
import type { BrainEdgeView, BrainNodeView, PlaybookApi, PlaybookBrain } from '../types'

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

export function PeterHomePage({ onUploaded }: { onUploaded?: (playbookId: string) => void }): JSX.Element {
  const navigate = useNavigate()

  // Tab state
  const [tab, setTab] = React.useState<'upload' | 'choose'>('upload')

  // Upload form state
  const [uploadName, setUploadName] = React.useState('')
  const [uploadOwner, setUploadOwner] = React.useState('')
  const [uploadDesc, setUploadDesc] = React.useState('')
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Existing playbooks state
  const [allPlaybooks, setAllPlaybooks] = React.useState<PlaybookApi[]>([])
  const [loadingList, setLoadingList] = React.useState(false)

  // Brain preview state
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

  // Load existing playbooks when switching to "choose" tab
  React.useEffect(() => {
    if (tab !== 'choose') return
    setLoadingList(true)
    fetchAllPlaybooks()
      .then((data) => setAllPlaybooks(data))
      .catch(() => setAllPlaybooks([]))
      .finally(() => setLoadingList(false))
  }, [tab])

  async function handleUploadSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!uploadFile) { setUploadError('Please choose a file.'); return }
    if (!uploadName.trim()) { setUploadError('Playbook name is required.'); return }
    if (!uploadOwner.trim()) { setUploadError('Owner is required.'); return }
    setUploadError(null)
    setUploading(true)
    try {
      const result = await uploadApiPlaybook(uploadFile, uploadOwner, uploadName, uploadDesc)
      const id = result.playbook.playbook_id
      onUploaded?.(id)
      navigate(`/playbooks/${id}/brain`)
    } catch {
      setUploadError('Upload failed — check that the file is a valid playbook format.')
    } finally {
      setUploading(false)
    }
  }

  async function handleChoosePlaybook(playbook: PlaybookApi): Promise<void> {
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

  function handleOpenPlaybook(playbook: PlaybookApi): void {
    onUploaded?.(playbook.playbook_id)
    navigate(`/playbooks/${playbook.playbook_id}/brain`)
  }

  const tabBase: React.CSSProperties = {
    flex: 1,
    padding: '7px 0',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background .15s, color .15s',
  }

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Playbook API Engine</p>
          <h1>Start with a playbook</h1>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingTop: 12 }}>
        {/* LEFT COLUMN */}
        <div style={{ width: 340, minWidth: 300, maxWidth: 340, flexShrink: 0, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            gap: 4,
            background: 'rgba(47,42,34,.07)',
            borderRadius: 8,
            padding: 3,
            marginBottom: 16,
          }}>
            <button
              type="button"
              style={{
                ...tabBase,
                background: tab === 'upload' ? 'var(--cream)' : 'transparent',
                color: tab === 'upload' ? 'var(--ink)' : 'var(--muted)',
                boxShadow: tab === 'upload' ? '0 1px 4px rgba(47,42,34,.10)' : 'none',
              }}
              onClick={() => setTab('upload')}
            >
              Upload new
            </button>
            <button
              type="button"
              style={{
                ...tabBase,
                background: tab === 'choose' ? 'var(--cream)' : 'transparent',
                color: tab === 'choose' ? 'var(--ink)' : 'var(--muted)',
                boxShadow: tab === 'choose' ? '0 1px 4px rgba(47,42,34,.10)' : 'none',
              }}
              onClick={() => setTab('choose')}
            >
              Choose existing
            </button>
          </div>

          {/* Upload new tab */}
          {tab === 'upload' && (
            <form onSubmit={(e) => void handleUploadSubmit(e)} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>
                Playbook name
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. Standard NDA 2024"
                  style={{ fontSize: 13, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(47,42,34,.18)', background: 'rgba(255,251,243,.8)', color: 'var(--ink)', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>
                Owner
                <input
                  type="text"
                  value={uploadOwner}
                  onChange={(e) => setUploadOwner(e.target.value)}
                  placeholder="e.g. Legal Team"
                  style={{ fontSize: 13, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(47,42,34,.18)', background: 'rgba(255,251,243,.8)', color: 'var(--ink)', outline: 'none' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ink)', fontWeight: 600 }}>
                Description
                <textarea
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Optional description…"
                  rows={2}
                  style={{ fontSize: 13, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(47,42,34,.18)', background: 'rgba(255,251,243,.8)', color: 'var(--ink)', outline: 'none', resize: 'vertical' }}
                />
              </label>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.docx,.doc,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="secondaryAction"
                  style={{ width: '100%' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadFile ? `📄 ${uploadFile.name}` : 'Choose file…'}
                </button>
              </div>
              {uploadError && (
                <p style={{ fontSize: 11, color: 'var(--risk)', margin: 0 }}>{uploadError}</p>
              )}
              <button
                type="submit"
                className="primaryAction"
                style={{ width: '100%' }}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload & open brain →'}
              </button>
            </form>
          )}

          {/* Choose existing tab */}
          {tab === 'choose' && (
            <div style={{ display: 'grid', gap: 8 }}>
              {loadingList && (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>Loading playbooks…</p>
              )}
              {!loadingList && allPlaybooks.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No playbooks found. Upload one first.</p>
              )}
              {allPlaybooks.map((playbook) => (
                <div
                  key={playbook.playbook_id}
                  style={{
                    background: 'rgba(255,251,243,.92)',
                    border: '1px solid rgba(47,42,34,.13)',
                    borderRadius: 8,
                    padding: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    transition: 'box-shadow .15s',
                  }}
                  onClick={() => handleChoosePlaybook(playbook)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleChoosePlaybook(playbook) }}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {playbook.name}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {playbook.clauses.length} clauses · {playbook.owner}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: playbook.status === 'published' ? 'rgba(0,153,153,.10)' : 'rgba(47,42,34,.08)',
                      color: playbook.status === 'published' ? 'var(--turquoise)' : 'var(--muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                    }}>
                      {playbook.status}
                    </span>
                    <button
                      type="button"
                      className="primaryAction"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={(e) => { e.stopPropagation(); handleOpenPlaybook(playbook) }}
                    >
                      Open →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — brain preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            ref={previewContainerRef}
            style={{
              height: 480,
              borderRadius: 10,
              background: 'rgba(255,251,243,.88)',
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
        </div>
      </div>
    </main>
  )
}
