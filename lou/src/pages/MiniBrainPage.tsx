import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { GitBranch, RefreshCw, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybookBrain, publishPlaybook } from '../api/client'
import type { BrainEdgeView, BrainNodeView, PlaybookBrain } from '../types'

export function MiniBrainPage(): JSX.Element {
  const { playbookId = 'current' } = useParams()
  const navigate = useNavigate()
  const [brain, setBrain] = React.useState<PlaybookBrain | null>(null)
  const [selected, setSelected] = React.useState<BrainNodeView | null>(null)
  const [committedBy, setCommittedBy] = React.useState('Peter')
  const [comment, setComment] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [publishing, setPublishing] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const data = await fetchPlaybookBrain(playbookId)
        if (!cancelled) setBrain(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [playbookId])

  async function publish(): Promise<void> {
    if (!comment.trim()) {
      setMessage('Add a commit comment before publishing.')
      return
    }
    setPublishing(true)
    setMessage(null)
    try {
      const response = await publishPlaybook(playbookId, committedBy, comment)
      setMessage(`Published ${response.mega_brain_entries} clauses. Commit ${response.commit_hash}.`)
      setBrain(await fetchPlaybookBrain(playbookId))
    } catch {
      setMessage('Publish failed. Check committer and comment.')
    } finally {
      setPublishing(false)
    }
  }

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
            Mega Brain
          </button>
        </div>
      </section>

      {loading && (
        <section className="toolSurface loadingState">
          <RefreshCw size={18} />
          Loading mini brain...
        </section>
      )}

      {brain && !loading && (
        <section className="miniBrainLayout">
          <div className="miniBrainCanvas" aria-label="Mini brain graph">
            <ForceGraph2D<BrainNodeView, BrainEdgeView>
              graphData={{ nodes: brain.nodes, links: brain.edges }}
              nodeId="id"
              nodeLabel={(node) => `${node.label} (${node.status})`}
              nodeCanvasObject={(node, ctx, scale) => drawMiniNode(node as BrainNodeView, ctx, scale)}
              linkCanvasObject={(link, ctx) => drawMiniLink(link as LinkObject<BrainNodeView, BrainEdgeView> & BrainEdgeView, ctx)}
              linkCanvasObjectMode={() => 'replace'}
              backgroundColor="rgba(0,0,0,0)"
              onNodeClick={(node: NodeObject<BrainNodeView>) => setSelected(node as BrainNodeView)}
              cooldownTicks={80}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.2}
              height={520}
            />
          </div>

          <aside className="clauseInspector">
            <p className="panelKicker">Publish control</p>
            <h2>{brain.status}</h2>
            <label>
              Committer
              <input value={committedBy} onChange={(event) => setCommittedBy(event.target.value)} />
            </label>
            <label>
              Commit comment
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explain why this playbook is ready to become an API." />
            </label>
            <button className="primaryAction drawerWide" type="button" disabled={publishing} onClick={() => void publish()}>
              <Send size={15} />
              {publishing ? 'Publishing...' : 'Commit and push'}
            </button>
            {message && <p>{message}</p>}

            <section>
              <p className="panelKicker">Selected node</p>
              {selected ? (
                <>
                  <h2>{selected.label}</h2>
                  <p>{selected.clause.preferred_position}</p>
                  <small>{selected.status}</small>
                </>
              ) : (
                <p>Select a clause node to inspect it.</p>
              )}
            </section>
          </aside>
        </section>
      )}
    </main>
  )
}

function drawMiniNode(node: BrainNodeView, ctx: CanvasRenderingContext2D, scale: number): void {
  const x = node.x ?? 0
  const y = node.y ?? 0
  const radius = node.status === 'issue' ? 7 : node.status === 'warning' ? 6 : 5
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = node.color
  ctx.globalAlpha = .9
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.font = `${10 / scale}px Inter, sans-serif`
  ctx.fillStyle = '#31291f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(node.label, x, y + radius + 5 / scale)
}

function drawMiniLink(link: LinkObject<BrainNodeView, BrainEdgeView> & BrainEdgeView, ctx: CanvasRenderingContext2D): void {
  const source = link.source as NodeObject<BrainNodeView>
  const target = link.target as NodeObject<BrainNodeView>
  if (typeof source !== 'object' || typeof target !== 'object') return
  ctx.beginPath()
  ctx.moveTo(source.x ?? 0, source.y ?? 0)
  ctx.lineTo(target.x ?? 0, target.y ?? 0)
  ctx.strokeStyle = 'rgba(47,42,34,.16)'
  ctx.lineWidth = Math.max(.6, link.similarity * 1.8)
  ctx.stroke()
}
