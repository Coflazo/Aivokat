import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge, GraphData } from '../types'
import { graphApi } from '../api/client'
import RuleCard from './RuleCard'

interface Props {
  highlightedNode: string | null
  onClearHighlight: () => void
}

const RULE_COLORS: Record<string, string> = {
  standard: '#00d4aa',
  fallback: '#f59e0b',
  red_line: '#ef4444',
  escalation: '#3b82f6',
}

const CATEGORIES = ['All', 'Financial Risk', 'Confidentiality', 'IP & Data', 'Governance', 'Payment', 'Termination', 'Warranties', 'Dispute Resolution', 'Other']
const RULE_TYPES = ['all', 'standard', 'fallback', 'red_line', 'escalation']

export default function NeuralMap({ highlightedNode, onClearHighlight }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [filter, setFilter] = useState({ category: 'All', ruleType: 'all', search: '' })
  const [loading, setLoading] = useState(true)

  const loadGraph = useCallback(() => {
    setLoading(true)
    graphApi.get()
      .then(setGraphData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadGraph() }, [loadGraph])

  useEffect(() => {
    if (highlightedNode && graphData.nodes.length > 0) {
      const node = graphData.nodes.find(n => n.id === highlightedNode)
      if (node) setSelectedNode(node)
      onClearHighlight()
    }
  }, [highlightedNode, graphData.nodes, onClearHighlight])

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const w = svgRef.current.clientWidth || 800
    const h = svgRef.current.clientHeight || 600

    const filtered = graphData.nodes.filter(n => {
      if (filter.category !== 'All' && n.category !== filter.category) return false
      if (filter.ruleType !== 'all' && n.rule_type !== filter.ruleType) return false
      if (filter.search && !n.topic.toLowerCase().includes(filter.search.toLowerCase())) return false
      return true
    })
    const filteredIds = new Set(filtered.map(n => n.id))
    const filteredEdges = graphData.edges.filter(e => filteredIds.has(e.source as string) && filteredIds.has(e.target as string))

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    const sim = d3.forceSimulation(filtered as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(filteredEdges).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide(30))

    const link = g.append('g').selectAll('line')
      .data(filteredEdges)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', (d) => d.similarity)

    const node = g.append('g').selectAll('g')
      .data(filtered)
      .join('g')
      .attr('cursor', 'pointer')
      .call((selection) => {
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d: any) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (event, d: any) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d: any) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
          (selection as any)
      })
      .on('click', (_, d) => setSelectedNode(d))

    node.append('circle')
      .attr('r', (d) => 12 + d.confidence * 4)
      .attr('fill', (d) => RULE_COLORS[d.rule_type] || '#00d4aa')
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d) => d.id === selectedNode?.id ? '#fff' : 'transparent')
      .attr('stroke-width', 2)

    node.append('text')
      .attr('dy', (d) => 12 + d.confidence * 4 + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', 11)
      .attr('font-family', 'Inter, sans-serif')
      .text((d) => d.topic.length > 20 ? d.topic.slice(0, 19) + '…' : d.topic)

    // Tooltip
    const tooltip = d3.select('body').select<HTMLDivElement>('#graph-tooltip')
    let tooltipDiv = tooltip.empty()
      ? d3.select('body').append('div').attr('id', 'graph-tooltip')
      : tooltip

    tooltipDiv.style('position', 'fixed').style('pointer-events', 'none').style('opacity', 0)
      .style('background', '#1a1f2e').style('border', '1px solid #334155')
      .style('border-radius', '8px').style('padding', '10px 14px')
      .style('font-family', 'Inter, sans-serif').style('font-size', '12px').style('color', '#e2e8f0')
      .style('max-width', '260px').style('z-index', '999')

    node
      .on('mouseover', (event, d) => {
        tooltipDiv.transition().duration(100).style('opacity', 1)
        tooltipDiv.html(`
          <div style="font-weight:600;margin-bottom:4px;color:#00d4aa">${d.topic}</div>
          <div style="color:#94a3b8;margin-bottom:6px">${d.category}</div>
          <div style="color:#cbd5e1;line-height:1.4">${d.standard_position.slice(0, 100)}…</div>
          <div style="margin-top:6px;color:#64748b;font-family:'IBM Plex Mono',monospace;font-size:11px">Confidence: ${Math.round(d.confidence * 100)}%</div>
        `)
        tooltipDiv.style('left', (event.clientX + 12) + 'px').style('top', (event.clientY - 20) + 'px')
      })
      .on('mousemove', (event) => {
        tooltipDiv.style('left', (event.clientX + 12) + 'px').style('top', (event.clientY - 20) + 'px')
      })
      .on('mouseout', () => tooltipDiv.transition().duration(100).style('opacity', 0))

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    return () => { sim.stop() }
  }, [graphData, filter, selectedNode?.id])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #1e293b',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        background: '#141820',
      }}>
        <input
          placeholder="Search by topic..."
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          style={inputStyle}
        />
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} style={selectStyle}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {RULE_TYPES.map(rt => (
            <button key={rt} onClick={() => setFilter(f => ({ ...f, ruleType: rt }))}
              style={{
                padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 500,
                background: filter.ruleType === rt ? (RULE_COLORS[rt] || '#334155') : '#1e293b',
                color: filter.ruleType === rt ? '#0f1117' : '#64748b',
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
              {rt === 'all' ? 'All' : rt.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button onClick={loadGraph} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #334155', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
          Refresh
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569', fontFamily: "'IBM Plex Mono', monospace" }}>
          {graphData.nodes.length} rules · {graphData.edges.length} connections
        </span>
      </div>

      {/* Graph area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 14 }}>
            Loading knowledge graph…
          </div>
        )}
        {!loading && graphData.nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', gap: 12 }}>
            <div style={{ fontSize: 48 }}>🕸</div>
            <div style={{ fontSize: 14 }}>No rules in the knowledge graph yet.</div>
            <div style={{ fontSize: 12, color: '#334155' }}>Upload a playbook using the sidebar to get started.</div>
          </div>
        )}
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
        {selectedNode && (
          <RuleCard node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 20px', borderTop: '1px solid #1e293b', display: 'flex', gap: 20, background: '#141820' }}>
        {Object.entries(RULE_COLORS).map(([rt, c]) => (
          <div key={rt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            {rt.replace('_', ' ')}
          </div>
        ))}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid #334155', borderRadius: 6,
  padding: '6px 10px', color: '#e2e8f0', fontSize: 12,
  fontFamily: "'Inter', sans-serif", outline: 'none', width: 180,
}

const selectStyle: React.CSSProperties = {
  background: '#0f1117', border: '1px solid #334155', borderRadius: 6,
  padding: '6px 8px', color: '#94a3b8', fontSize: 12, cursor: 'pointer', outline: 'none',
}
