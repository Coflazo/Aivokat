import React from 'react'
import ForceGraph2D, { type LinkObject, type NodeObject } from 'react-force-graph-2d'
import { Check, GitCommit, RefreshCw, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybookBrain, publishPlaybook } from '../api/client'
import type { BrainEdgeView, BrainNodeView, PlaybookBrain } from '../types'
import { resolvePlaybookId, saveCurrentPlaybookId } from '../utils/currentPlaybook'

export function MiniBrainPage(): JSX.Element {
  const params = useParams()
  const playbookId = resolvePlaybookId(params.playbookId)
  const navigate = useNavigate()
  const [brain, setBrain] = React.useState<PlaybookBrain | null>(null)
  const [selected, setSelected] = React.useState<BrainNodeView | null>(null)
  const [committedBy, setCommittedBy] = React.useState('Peter')
  const [comment, setComment] = React.useState('')
  const [committed, setCommitted] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [publishing, setPublishing] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [playbookId])

  function commitDraft(): void {
    if (!comment.trim()) {
      setMessage('Add a commit comment before publishing.')
      return
    }
    if (!committedBy.trim()) {
      setMessage('Add a committer name before committing.')
      return
    }
    setCommitted(true)
    setMessage('Committed locally. Push when you are ready to publish this playbook as an API.')
  }

  async function pushPublishedApi(): Promise<void> {
    if (!committed) {
      setMessage('Commit the reviewed playbook before pushing it to the company brain.')
      return
    }
    setPublishing(true)
    setMessage(null)
    try {
      const response = await publishPlaybook(playbookId, committedBy, comment)
      setMessage(`Pushed ${response.mega_brain_entries} clauses to the company brain. Commit ${response.commit_hash}.`)
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
            <button className="secondaryAction drawerWide" type="button" disabled={publishing || committed} onClick={commitDraft}>
              <GitCommit size={15} />
              {committed ? 'Committed' : 'Commit'}
            </button>
            <button className="primaryAction drawerWide" type="button" disabled={publishing || !committed} onClick={() => void pushPublishedApi()}>
              {committed ? <Send size={15} /> : <Check size={15} />}
              {publishing ? 'Pushing...' : 'Push to API'}
            </button>
            {message && <p>{message}</p>}

            <section>
              <p className="panelKicker">Selected node</p>
              {selected ? (
                <>
                  <h2>{selected.label}</h2>
                  <p>{selected.text || selected.clause.preferred_position}</p>
                  <small>{selected.node_type} / {selected.status}</small>
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
  const radius = node.node_type === 'clause'
    ? node.status === 'issue' ? 8 : node.status === 'warning' ? 7 : 6
    : node.node_type === 'red_line' ? 5.5 : 4.5
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = node.color
  ctx.globalAlpha = .9
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.font = `${node.node_type === 'clause' ? 10 / scale : 8 / scale}px Inter, sans-serif`
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
