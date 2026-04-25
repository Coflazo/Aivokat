import React from 'react'
import ReactDOM from 'react-dom/client'
import ForceGraph2D, {
  type ForceGraphMethods,
  type GraphData,
  type LinkObject,
  type NodeObject
} from 'react-force-graph-2d'
import { sourcePlaybookRows, type SourcePlaybookRow } from './playbookData'
import './styles.css'

type PositionKind = 'preferred' | 'fallback' | 'negative'
type BrainKind = PositionKind | 'topic'

interface PlaybookRow {
  id: string
  clause: string
  why: string
  preferred: string
  fallbacks: string[]
  redLine: string
  escalation: string
  sourceFile: string
}

interface BrainNode {
  id: string
  label: string
  kind: BrainKind
  clause: string
  detail: string
  datasets: string[]
  commits: string[]
  x?: number
  y?: number
  val?: number
}

interface BrainLink {
  source: string
  target: string
  strength: number
  kind: PositionKind
}

type SimNode = NodeObject<BrainNode> & BrainNode

interface BrainBoundaryForce {
  (alpha: number): void
  initialize: (nodes: SimNode[]) => void
}

const BRAIN_RX = 330
const BRAIN_RY = 218
const playbookRows: PlaybookRow[] = sourcePlaybookRows.map((row: SourcePlaybookRow) => ({ ...row }))

const kindColors: Record<BrainKind, string> = {
  topic: '#2f2a22',
  preferred: '#007c79',
  fallback: '#9b6f43',
  negative: '#4a2430'
}

function keepInsideBrain(x: number, y: number, padding = 0.88): { x: number; y: number } {
  const rx = BRAIN_RX * padding
  const ry = BRAIN_RY * padding
  const distance = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry))

  if (distance <= 1) {
    return { x, y }
  }

  return {
    x: x / distance,
    y: y / distance
  }
}

function createBrainBoundaryForce(): BrainBoundaryForce {
  let nodes: SimNode[] = []

  const force = ((alpha: number): void => {
    nodes.forEach((node: SimNode) => {
      const x = node.x ?? 0
      const y = node.y ?? 0

      node.vx = (node.vx ?? 0) + -x * 0.018 * alpha
      node.vy = (node.vy ?? 0) + -y * 0.022 * alpha

      const rx = BRAIN_RX * 0.94
      const ry = BRAIN_RY * 0.94
      const distance = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry))

      if (distance > 1) {
        node.x = x / distance
        node.y = y / distance
        node.vx = -(node.vx ?? 0) * 0.18
        node.vy = -(node.vy ?? 0) * 0.18
      }
    })
  }) as BrainBoundaryForce

  force.initialize = (simulationNodes: SimNode[]): void => {
    nodes = simulationNodes
  }

  return force
}

function buildBrainData(): GraphData<BrainNode, BrainLink> {
  const nodes: BrainNode[] = []
  const links: BrainLink[] = []

  playbookRows.forEach((row: PlaybookRow, index: number) => {
    const angle = index * 2.399963
    const radius = Math.sqrt((index + 1) / playbookRows.length)
    const topicPoint = keepInsideBrain(
      Math.cos(angle) * BRAIN_RX * 0.58 * radius,
      Math.sin(angle) * BRAIN_RY * 0.72 * radius,
      0.68
    )
    const topicX = topicPoint.x
    const topicY = topicPoint.y
    const topicId = `topic_${row.id}`
    const fallbackIds: string[] = []

    nodes.push({
      id: topicId,
      label: row.clause,
      kind: 'topic',
      clause: row.clause,
      detail: row.why,
      datasets: [row.sourceFile],
      commits: [
        `Initial extraction: ${row.clause}`,
        'Mapped playbook row into preferred, fallback, and risk positions'
      ],
      x: topicX,
      y: topicY,
      val: 6
    })

    const preferredId = `${row.id}_preferred`
    const preferredPoint = keepInsideBrain(topicX + Math.cos(angle - 0.82) * 42, topicY + Math.sin(angle - 0.82) * 35)
    nodes.push({
      id: preferredId,
      label: 'Preferred',
      kind: 'preferred',
      clause: row.clause,
      detail: row.preferred,
      datasets: [row.sourceFile],
      commits: [
        'Preferred position committed from source playbook',
        'No lawyer override recorded'
      ],
      x: preferredPoint.x,
      y: preferredPoint.y,
      val: 3.2
    })
    links.push({ source: topicId, target: preferredId, strength: 1, kind: 'preferred' })

    row.fallbacks.forEach((fallback: string, fallbackIndex: number) => {
      const fallbackId = `${row.id}_fallback_${fallbackIndex + 1}`
      fallbackIds.push(fallbackId)
      const fallbackAngle = angle + 0.32 + fallbackIndex * 0.42
      const fallbackPoint = keepInsideBrain(
        topicX + Math.cos(fallbackAngle) * (52 + fallbackIndex * 18),
        topicY + Math.sin(fallbackAngle) * (42 + fallbackIndex * 14)
      )
      nodes.push({
        id: fallbackId,
        label: `Fallback ${fallbackIndex + 1}`,
        kind: 'fallback',
        clause: row.clause,
        detail: fallback,
        datasets: [row.sourceFile],
        commits: [
          `Fallback ${fallbackIndex + 1} committed from source playbook`,
          'Available only when negotiation pressure justifies deviation'
        ],
        x: fallbackPoint.x,
        y: fallbackPoint.y,
        val: 2.5
      })
      links.push({ source: topicId, target: fallbackId, strength: 0.72, kind: 'fallback' })
      links.push({ source: preferredId, target: fallbackId, strength: 0.28, kind: 'fallback' })
      if (fallbackIndex > 0) {
        links.push({ source: fallbackIds[fallbackIndex - 1], target: fallbackId, strength: 0.2, kind: 'fallback' })
      }
    })

    const negativeId = `${row.id}_negative`
    const negativePoint = keepInsideBrain(topicX + Math.cos(angle + 2.2) * 48, topicY + Math.sin(angle + 2.2) * 44)
    nodes.push({
      id: negativeId,
      label: 'Red line + escalation',
      kind: 'negative',
      clause: row.clause,
      detail: `${row.redLine}. Escalate: ${row.escalation}.`,
      datasets: [row.sourceFile],
      commits: [
        'Risk boundary committed from red-line and escalation columns',
        'Requires lawyer approval before changing'
      ],
      x: negativePoint.x,
      y: negativePoint.y,
      val: 3
    })
    links.push({ source: topicId, target: negativeId, strength: 0.86, kind: 'negative' })
    if (fallbackIds.length > 0) {
      links.push({ source: fallbackIds[fallbackIds.length - 1], target: negativeId, strength: 0.16, kind: 'negative' })
    }
  })

  playbookRows.forEach((row: PlaybookRow, index: number) => {
    const currentTopic = `topic_${row.id}`
    const nextTopic = `topic_${playbookRows[(index + 1) % playbookRows.length].id}`
    links.push({ source: currentTopic, target: nextTopic, strength: 0.18, kind: 'fallback' })
  })

  const conceptualBridges: Array<[string, string]> = [
    ['topic_type_of_nda', 'topic_permitted_recipients'],
    ['topic_marking_of_confidential_info', 'topic_exceptions_to_confidentiality'],
    ['topic_return_destruction_of_backups', 'topic_contract_term_confidentiality_period'],
    ['topic_liability_for_correctness', 'topic_other_liabilities_indemnification'],
    ['topic_contractual_penalty', 'topic_other_liabilities_indemnification'],
    ['topic_ip_rights_know_how', 'topic_permitted_recipients'],
    ['topic_choice_of_law', 'topic_dispute_resolution_language'],
    ['topic_signatures_authority', 'topic_type_of_nda']
  ]

  conceptualBridges.forEach(([source, target]: [string, string]) => {
    links.push({ source, target, strength: 0.12, kind: 'preferred' })
  })

  return { nodes, links }
}

function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = React.useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight
  })

  React.useEffect(() => {
    function handleResize(): void {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

function App(): JSX.Element {
  const graphRef = React.useRef<ForceGraphMethods<BrainNode, BrainLink>>()
  const size = useWindowSize()
  const graphData = React.useMemo<GraphData<BrainNode, BrainLink>>(() => buildBrainData(), [])
  const [selectedNode, setSelectedNode] = React.useState<BrainNode | null>(null)

  React.useEffect(() => {
    const graph = graphRef.current
    if (!graph) return

    graph.d3Force('charge')?.strength?.(-18)
    graph.d3Force('brainBoundary', createBrainBoundaryForce())
    graph.d3Force('link')?.distance?.((link: LinkObject<BrainNode, BrainLink>) => {
      const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
      return typedLink.kind === 'negative' ? 42 : typedLink.kind === 'fallback' ? 34 : 28
    })
    graph.centerAt(0, 0, 0)
    graph.zoom(1.28, 0)

    const reheater = window.setInterval(() => {
      graph.centerAt(0, 0, 650)
      graph.d3ReheatSimulation()
    }, 3200)

    return () => window.clearInterval(reheater)
  }, [])

  function drawNode(node: NodeObject<BrainNode>, ctx: CanvasRenderingContext2D, globalScale: number): void {
    const typedNode = node as NodeObject<BrainNode> & BrainNode
    const x = typedNode.x ?? 0
    const y = typedNode.y ?? 0
    const radius = typedNode.kind === 'topic' ? 5.4 : typedNode.kind === 'preferred' ? 3.7 : 3.1
    const labelFontSize = typedNode.kind === 'topic' ? 10 / globalScale : 8 / globalScale
    const shouldLabel = typedNode.kind === 'topic' || globalScale > 1.35

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = kindColors[typedNode.kind]
    ctx.globalAlpha = typedNode.kind === 'topic' ? 0.92 : 0.72
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, radius + 4.5, 0, Math.PI * 2)
    ctx.strokeStyle = kindColors[typedNode.kind]
    ctx.globalAlpha = typedNode.kind === 'topic' ? 0.12 : 0.08
    ctx.lineWidth = 1.2 / globalScale
    ctx.stroke()
    ctx.globalAlpha = 1

    if (!shouldLabel) return

    ctx.font = `${labelFontSize}px Inter, sans-serif`
    ctx.fillStyle = typedNode.kind === 'topic' ? '#31291f' : '#756b5f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(typedNode.label, x, y + radius + 5 / globalScale)
  }

  function drawLink(
    link: LinkObject<NodeObject<BrainNode>, LinkObject<BrainNode, BrainLink>>,
    ctx: CanvasRenderingContext2D
  ): void {
    const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
    const source = typedLink.source as NodeObject<BrainNode>
    const target = typedLink.target as NodeObject<BrainNode>
    if (typeof source !== 'object' || typeof target !== 'object') return

    ctx.beginPath()
    ctx.moveTo(source.x ?? 0, source.y ?? 0)
    ctx.lineTo(target.x ?? 0, target.y ?? 0)
    ctx.strokeStyle = typedLink.kind === 'negative' ? 'rgba(74, 36, 48, .18)' : 'rgba(87, 74, 58, .16)'
    ctx.lineWidth = typedLink.kind === 'preferred' ? 1.15 : 0.75
    ctx.stroke()
  }

  return (
    <main className="creamPage">
      <div className="brand">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Siemens-logo.svg/1280px-Siemens-logo.svg.png" alt="Siemens" />
        <span>Lou</span>
      </div>
      <div className="brainShell" aria-label="Lou playbook brain">
        <ForceGraph2D<BrainNode, BrainLink>
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeVal={(node: NodeObject<BrainNode>) => node.val ?? 2}
          nodeLabel={(node: NodeObject<BrainNode>) => {
            const typedNode = node as NodeObject<BrainNode> & BrainNode
            const datasets = typedNode.datasets.map((dataset: string) => `<li>${dataset}</li>`).join('')
            const commits = typedNode.commits.map((commit: string) => `<li>${commit}</li>`).join('')
            return `<div class="tip"><strong>${typedNode.clause}</strong><span>${typedNode.label}</span><p>${typedNode.detail}</p><em>Datasets</em><ul>${datasets}</ul><em>Commit comments</em><ul>${commits}</ul></div>`
          }}
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node: NodeObject<BrainNode>, color: string, ctx: CanvasRenderingContext2D) => {
            const typedNode = node as NodeObject<BrainNode> & BrainNode
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(typedNode.x ?? 0, typedNode.y ?? 0, typedNode.kind === 'topic' ? 11 : 8, 0, Math.PI * 2)
            ctx.fill()
          }}
          linkCanvasObject={drawLink}
          linkCanvasObjectMode={() => 'replace'}
          linkDirectionalParticles={(link: LinkObject<BrainNode, BrainLink>) => {
            const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
            return typedLink.kind === 'preferred' ? 2 : 1
          }}
          linkDirectionalParticleSpeed={(link: LinkObject<BrainNode, BrainLink>) => {
            const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
            return typedLink.kind === 'negative' ? 0.004 : 0.006
          }}
          linkDirectionalParticleWidth={(link: LinkObject<BrainNode, BrainLink>) => {
            const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
            return typedLink.kind === 'preferred' ? 1.8 : 1.2
          }}
          linkDirectionalParticleColor={(link: LinkObject<BrainNode, BrainLink>) => {
            const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
            return typedLink.kind === 'preferred' ? 'rgba(0, 121, 118, .52)' : 'rgba(74, 36, 48, .34)'
          }}
          onNodeClick={(node: NodeObject<BrainNode>) => {
            setSelectedNode(node as SimNode)
          }}
          onBackgroundClick={() => setSelectedNode(null)}
          autoPauseRedraw={false}
          cooldownTicks={Infinity}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.18}
          minZoom={0.58}
          maxZoom={4.2}
          enableNodeDrag
          enablePanInteraction
          enableZoomInteraction
        />
      </div>
      <div className="legend">
        <span><i className="preferred" /> Preferred</span>
        <span><i className="fallback" /> Fallback</span>
        <span><i className="negative" /> Red line / escalation</span>
      </div>
      {selectedNode && <AuditPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
    </main>
  )
}

function AuditPanel({ node, onClose }: { node: BrainNode; onClose: () => void }): JSX.Element {
  const version = node.kind === 'topic' ? 'v1.0' : node.kind === 'preferred' ? 'v1.1' : node.kind === 'fallback' ? 'v1.2' : 'v1.3'
  const sourceType = node.kind === 'negative' ? 'Dataset + legal guardrail' : 'Dataset extraction'
  const actor = node.kind === 'negative' ? 'Senior Legal' : node.kind === 'fallback' ? 'Lou Parser, reviewed by Legal' : 'Lou Parser'
  const change = node.kind === 'topic'
    ? 'Created clause family from playbook row.'
    : node.kind === 'preferred'
      ? 'Committed preferred position as the default decision path.'
      : node.kind === 'fallback'
        ? 'Added negotiable fallback path under lawyer review.'
        : 'Linked red line and escalation trigger into one risk boundary.'

  return (
    <aside className="auditPanel">
      <button className="closeButton" onClick={onClose} aria-label="Close audit panel">Close</button>
      <p className="panelKicker">Version control</p>
      <h2>{node.clause}</h2>
      <span className={`typePill ${node.kind}`}>{node.label}</span>

      <section>
        <dl>
          <div>
            <dt>Version</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>Source type</dt>
            <dd>{sourceType}</dd>
          </div>
          <div>
            <dt>Dataset</dt>
            <dd>{node.datasets.join(', ')}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3>Current Text</h3>
        <p>{node.detail}</p>
      </section>

      <section>
        <h3>Commits</h3>
        <ol className="commits">
          <li>
            <strong>{actor}</strong>
            <span>Today, 12:18</span>
            <p>{change}</p>
          </li>
          <li>
            <strong>Lou Parser</strong>
            <span>Today, 12:03</span>
            <p>{node.commits[0]}</p>
          </li>
          <li>
            <strong>Dataset import</strong>
            <span>Today, 12:00</span>
            <p>Imported from {node.datasets[0]}.</p>
          </li>
        </ol>
      </section>
    </aside>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
