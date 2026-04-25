import React from 'react'
import ReactDOM from 'react-dom/client'
import ForceGraph2D, {
  type ForceGraphMethods,
  type GraphData,
  type LinkObject,
  type NodeObject
} from 'react-force-graph-2d'
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

const playbookRows: PlaybookRow[] = [
  {
    id: 'nda_type',
    clause: 'Type of NDA',
    why: 'Determines if our info is protected',
    preferred: 'Bilateral mutual NDA',
    fallbacks: ['Mirror obligations in a unilateral NDA', 'Accept unilateral only if we are the sole disclosing party'],
    redLine: 'Unilateral NDA where we are receiving party only',
    escalation: 'Counterparty refuses bilateral and we will share information'
  },
  {
    id: 'marking',
    clause: 'Marking of Confidential Info',
    why: "Controls scope of what's protected",
    preferred: 'Information must be marked Confidential',
    fallbacks: ['Marked or evidently confidential to a reasonable person', 'All information deemed confidential with a practical designation process'],
    redLine: 'All information confidential with no marking mechanism',
    escalation: 'Counterparty insists on all information being confidential with no exceptions'
  },
  {
    id: 'exceptions',
    clause: 'Exceptions to Confidentiality',
    why: 'Protects against liability for information already known or independently created',
    preferred: 'All four standard exceptions',
    fallbacks: ['Three of four exceptions if missing one is low risk', 'Modified language if all four concepts are covered'],
    redLine: 'Fewer than three exceptions',
    escalation: 'Independently developed exception is missing and cannot be added'
  },
  {
    id: 'recipients',
    clause: 'Permitted Recipients',
    why: 'Enables operational use with affiliates, advisors, and contractors',
    preferred: 'Need-to-know sharing with equivalent NDA duties',
    fallbacks: ['Employees and affiliates with prior notice', 'Employees and affiliates with prior consent'],
    redLine: 'Sharing limited only to named individuals',
    escalation: 'No sharing with affiliates or advisors under any circumstances'
  },
  {
    id: 'backups',
    clause: 'Return and Destruction',
    why: 'Prevents technically impossible compliance obligations',
    preferred: 'Return or destroy with backup and legal-retention exemptions',
    fallbacks: ['Legal-retention exemption only', 'Certification with reasonable timeframe'],
    redLine: 'Immediate destruction of all copies with no exemptions',
    escalation: 'Counterparty requires destruction of backups with written certification'
  },
  {
    id: 'correctness',
    clause: 'Liability for Correctness',
    why: 'Prevents warranty exposure at NDA stage',
    preferred: 'As-is; no warranty or reliance liability',
    fallbacks: ['No warranty', 'Limited warranty'],
    redLine: 'Full warranty',
    escalation: 'Accuracy warranties backed by indemnification'
  },
  {
    id: 'penalty',
    clause: 'Contractual Penalty',
    why: 'Prevents disproportionate financial exposure for breach',
    preferred: 'No penalty clause',
    fallbacks: ['Penalty only with disclosing-party burden of proof', 'Proportionate cap for willful or grossly negligent breach'],
    redLine: 'Uncapped penalty regardless of fault',
    escalation: 'Any contractual penalty clause needs senior legal review'
  },
  {
    id: 'indemnity',
    clause: 'Indemnification',
    why: 'Controls financial exposure framework',
    preferred: 'No indemnification clause',
    fallbacks: ['Reasonable limitation of liability applying equally', 'Direct-damages indemnity with reasonable cap'],
    redLine: 'One-sided indemnity or punitive or consequential damages',
    escalation: 'Any liability provision beyond standard statutory liability'
  },
  {
    id: 'ip',
    clause: 'IP Rights and Know-How',
    why: 'Prevents unintended transfer of IP ownership or license grants',
    preferred: 'No license or rights granted or implied',
    fallbacks: ['No license; future IP handled separately', 'Each party keeps pre-existing IP'],
    redLine: 'IP transfer, irrevocable license, or assignment',
    escalation: 'Any IP assignment, license grant, or joint ownership clause'
  },
  {
    id: 'term',
    clause: 'Confidentiality Period',
    why: 'Ensures manageable, defined obligations',
    preferred: 'NDA term 2 to 3 years; confidentiality 5 years from disclosure',
    fallbacks: ['Confidentiality period 3 to 7 years', 'Fixed survival after termination'],
    redLine: 'Perpetual or indefinite confidentiality',
    escalation: 'Perpetual confidentiality or period shorter than 3 years'
  },
  {
    id: 'law',
    clause: 'Choice of Law',
    why: 'Determines interpretation and enforcement',
    preferred: "Our own jurisdiction's law",
    fallbacks: ['Neutral commercially sophisticated jurisdiction', "Counterparty law if balanced and commercially established"],
    redLine: 'Unpredictable legal system',
    escalation: 'Law outside our country of incorporation or primary place of business'
  },
  {
    id: 'disputes',
    clause: 'Dispute Resolution',
    why: 'Protects confidentiality of proceedings',
    preferred: 'International arbitration with neutral seat and English language',
    fallbacks: ['Recognized institutional arbitration rules', 'Neutral ordinary courts with confidential treatment'],
    redLine: "Exclusive counterparty local courts with no arbitration option",
    escalation: "Ordinary courts in counterparty's jurisdiction with no alternative"
  },
  {
    id: 'signatures',
    clause: 'Signatures and Authority',
    why: 'Ensures the NDA is binding and enforceable',
    preferred: 'Duly authorized representatives',
    fallbacks: ['Established e-signature platform with authority confirmation', 'Single signatory with evidence of authority'],
    redLine: "Counterparty signatory authority cannot be verified",
    escalation: "Any doubt about counterparty signatory authority"
  }
]

const kindColors: Record<BrainKind, string> = {
  topic: '#2f2a22',
  preferred: '#007c79',
  fallback: '#9b6f43',
  negative: '#4a2430'
}

function buildBrainData(): GraphData<BrainNode, BrainLink> {
  const nodes: BrainNode[] = []
  const links: BrainLink[] = []
  const centerX = 0
  const centerY = 0

  playbookRows.forEach((row: PlaybookRow, index: number) => {
    const side = index % 2 === 0 ? -1 : 1
    const lane = Math.floor(index / 2)
    const angle = -1.22 + lane * 0.38
    const topicX = centerX + side * (145 + Math.sin(lane) * 32)
    const topicY = centerY + Math.sin(angle) * 185 + Math.cos(index * 0.7) * 16
    const topicId = `topic_${row.id}`

    nodes.push({
      id: topicId,
      label: row.clause,
      kind: 'topic',
      clause: row.clause,
      detail: row.why,
      datasets: ['Sample NDA Playbook.csv.xlsx'],
      commits: [
        `Initial extraction: ${row.clause}`,
        'Mapped playbook row into preferred, fallback, and risk positions'
      ],
      x: topicX,
      y: topicY,
      val: 6
    })

    const preferredId = `${row.id}_preferred`
    nodes.push({
      id: preferredId,
      label: 'Preferred',
      kind: 'preferred',
      clause: row.clause,
      detail: row.preferred,
      datasets: ['Sample NDA Playbook.csv.xlsx'],
      commits: [
        'Preferred position committed from source playbook',
        'No lawyer override recorded'
      ],
      x: topicX + side * 58,
      y: topicY - 34,
      val: 3.2
    })
    links.push({ source: topicId, target: preferredId, strength: 1, kind: 'preferred' })

    row.fallbacks.forEach((fallback: string, fallbackIndex: number) => {
      const fallbackId = `${row.id}_fallback_${fallbackIndex + 1}`
      nodes.push({
        id: fallbackId,
        label: `Fallback ${fallbackIndex + 1}`,
        kind: 'fallback',
        clause: row.clause,
        detail: fallback,
        datasets: ['Sample NDA Playbook.csv.xlsx'],
        commits: [
          `Fallback ${fallbackIndex + 1} committed from source playbook`,
          'Available only when negotiation pressure justifies deviation'
        ],
        x: topicX + side * (78 + fallbackIndex * 24),
        y: topicY + 10 + fallbackIndex * 32,
        val: 2.5
      })
      links.push({ source: topicId, target: fallbackId, strength: 0.72, kind: 'fallback' })
      links.push({ source: preferredId, target: fallbackId, strength: 0.28, kind: 'fallback' })
    })

    const negativeId = `${row.id}_negative`
    nodes.push({
      id: negativeId,
      label: 'Red line + escalation',
      kind: 'negative',
      clause: row.clause,
      detail: `${row.redLine}. Escalate: ${row.escalation}.`,
      datasets: ['Sample NDA Playbook.csv.xlsx'],
      commits: [
        'Risk boundary committed from red-line and escalation columns',
        'Requires lawyer approval before changing'
      ],
      x: topicX - side * 36,
      y: topicY + 48,
      val: 3
    })
    links.push({ source: topicId, target: negativeId, strength: 0.86, kind: 'negative' })
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

  React.useEffect(() => {
    const graph = graphRef.current
    if (!graph) return

    graph.d3Force('charge')?.strength?.(-58)
    graph.d3Force('link')?.distance?.((link: LinkObject<BrainNode, BrainLink>) => {
      const typedLink = link as LinkObject<BrainNode, BrainLink> & BrainLink
      return typedLink.kind === 'negative' ? 76 : typedLink.kind === 'fallback' ? 58 : 48
    })
    graph.zoomToFit(900, 72)

    const reheater = window.setInterval(() => {
      graph.d3ReheatSimulation()
    }, 2400)

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
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
