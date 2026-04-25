import React from 'react'
import { FileSearch, FileUp, MessageSquareText, RefreshCw, Search, Wand2 } from 'lucide-react'
import {
  analyzePublicContractFile,
  analyzePublicContractText,
  askPublicPlaybook,
  fetchCoverageGaps,
  fetchPublicPlaybookSchema,
  fetchPublicPlaybooks,
  matchPublicClause,
  suggestPublicRewrite
} from '../api/client'
import type {
  AnalyzeContractResponse,
  CoverageGapsResponse,
  MatchClauseResponse,
  PlaybookApi,
  PublicAskResponse,
  PublicPlaybookListItem,
  SuggestRewriteResponse
} from '../types'

type ConsoleResult =
  | PublicAskResponse
  | MatchClauseResponse
  | AnalyzeContractResponse
  | CoverageGapsResponse
  | SuggestRewriteResponse
  | PlaybookApi
  | null

const sampleClause = 'The Receiving Party accepts unlimited liability for all direct, indirect, incidental, and consequential damages arising from this Agreement.'
const sampleContract = `1. Confidentiality
The Receiving Party shall protect Confidential Information with reasonable care and may disclose it to employees and affiliates who need it for the permitted purpose.

2. Liability
The Receiving Party accepts unlimited liability for all direct, indirect, incidental, and consequential damages arising from this Agreement.

3. Governing Law
This Agreement is governed by German law.`

const CLASS_COLORS: Record<string, string> = {
  preferred: '#007c79',
  fallback_1: '#9b6f43',
  fallback_2: '#b8893c',
  red_line: '#4a2430',
  escalation: '#4a2076',
  unmapped: 'rgba(47,42,34,.28)',
}

const CLASS_LABELS: Record<string, string> = {
  preferred: 'Preferred',
  fallback_1: 'Fallback 1',
  fallback_2: 'Fallback 2',
  red_line: 'Red line',
  escalation: 'Escalation',
  unmapped: 'Unmapped',
}

function HeatmapView({ data }: { data: AnalyzeContractResponse }): JSX.Element {
  const hm = data.risk_heatmap
  const total = hm.preferred_count + hm.fallback_count + hm.redline_count + hm.escalation_count + hm.unmapped_count || 1
  return (
    <div className="heatmapView pageEnter">
      <div className="heatmapBar">
        {hm.preferred_count > 0 && (
          <div style={{ flex: hm.preferred_count / total, background: CLASS_COLORS.preferred }} title={`${hm.preferred_count} preferred`} />
        )}
        {hm.fallback_count > 0 && (
          <div style={{ flex: hm.fallback_count / total, background: CLASS_COLORS.fallback_1 }} title={`${hm.fallback_count} fallback`} />
        )}
        {hm.redline_count > 0 && (
          <div style={{ flex: hm.redline_count / total, background: CLASS_COLORS.red_line }} title={`${hm.redline_count} red line`} />
        )}
        {hm.escalation_count > 0 && (
          <div style={{ flex: hm.escalation_count / total, background: CLASS_COLORS.escalation }} title={`${hm.escalation_count} escalation`} />
        )}
        {hm.unmapped_count > 0 && (
          <div style={{ flex: hm.unmapped_count / total, background: CLASS_COLORS.unmapped }} title={`${hm.unmapped_count} unmapped`} />
        )}
      </div>
      <div className="heatmapLegend">
        {[
          { key: 'preferred', count: hm.preferred_count },
          { key: 'fallback_1', count: hm.fallback_count },
          { key: 'red_line', count: hm.redline_count },
          { key: 'escalation', count: hm.escalation_count },
          { key: 'unmapped', count: hm.unmapped_count },
        ].filter(l => l.count > 0).map(l => (
          <span key={l.key} className="heatmapLegendItem">
            <i style={{ background: CLASS_COLORS[l.key] }} />
            {CLASS_LABELS[l.key]} ({l.count})
          </span>
        ))}
      </div>
      <div className="heatmapTable">
        {data.clauses.map((row, i) => {
          const cls = row.match?.classification ?? 'unmapped'
          const score = row.match?.score_breakdown.final_score
          return (
            <div key={i} className="heatmapRow" style={{ borderLeftColor: CLASS_COLORS[cls] ?? CLASS_COLORS.unmapped }}>
              <div className="heatmapRowMeta">
                <span className="heatmapClass" style={{ color: CLASS_COLORS[cls] ?? CLASS_COLORS.unmapped }}>
                  {CLASS_LABELS[cls] ?? 'Unmapped'}
                </span>
                {score != null && (
                  <span className="heatmapScore">{Math.round(score * 100)}%</span>
                )}
              </div>
              <p className="heatmapClauseText">{row.segmented_clause.text.slice(0, 180)}{row.segmented_clause.text.length > 180 ? '…' : ''}</p>
              {row.match && (
                <p className="heatmapMatchLabel">→ {row.match.matched_clause.clause_name}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ApiConsolePage(): JSX.Element {
  const [playbooks, setPlaybooks] = React.useState<PublicPlaybookListItem[]>([])
  const [playbookId, setPlaybookId] = React.useState('')
  const [question, setQuestion] = React.useState('Can we accept unlimited liability?')
  const [clauseText, setClauseText] = React.useState(sampleClause)
  const [contractText, setContractText] = React.useState(sampleContract)
  const [contractFile, setContractFile] = React.useState<File | null>(null)
  const [result, setResult] = React.useState<ConsoleResult>(null)
  const [heatmap, setHeatmap] = React.useState<AnalyzeContractResponse | null>(null)
  const [lastMatch, setLastMatch] = React.useState<MatchClauseResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setError(null)
      try {
        const items = await fetchPublicPlaybooks()
        if (cancelled) return
        setPlaybooks(items)
        setPlaybookId((current) => current || items[0]?.playbook_id || '')
      } catch {
        if (!cancelled) setError('Could not load published playbooks. Publish one from the mini brain first.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function run(action: () => Promise<ConsoleResult>): Promise<void> {
    if (!playbookId) {
      setError('Publish a playbook before using the API console.')
      return
    }
    setLoading(true)
    setError(null)
    setHeatmap(null)
    try {
      const next = await action()
      setResult(next)
      if (next && 'matched_clause' in next) setLastMatch(next as MatchClauseResponse)
      if (next && 'clauses' in next && 'risk_heatmap' in next) setHeatmap(next as AnalyzeContractResponse)
    } catch {
      setError('The API request failed. Check that the backend is running and the selected playbook is published.')
    } finally {
      setLoading(false)
    }
  }

  const selected = playbooks.find((item) => item.playbook_id === playbookId)

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Versioned playbook API</p>
          <h1>API console</h1>
        </div>
        <div className="topbarActions">
          <label>
            Published playbook
            <select value={playbookId} onChange={(event) => setPlaybookId(event.target.value)}>
              {playbooks.map((playbook) => (
                <option key={playbook.playbook_id} value={playbook.playbook_id}>
                  {playbook.name} v{playbook.version}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondaryAction"
            type="button"
            disabled={!playbookId || loading}
            onClick={() => void run(() => fetchPublicPlaybookSchema(playbookId))}
          >
            <FileSearch size={16} />
            Schema
          </button>
        </div>
      </section>

      {error && <p className="formError apiError">{error}</p>}

      <section className="apiConsoleGrid">
        <article className="apiPanel">
          <div className="apiPanelTop">
            <div>
              <p className="panelKicker">Ask endpoint</p>
              <h2>Talk to the playbook</h2>
            </div>
            <MessageSquareText size={18} />
          </div>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
          <button
            className="primaryAction"
            type="button"
            disabled={loading}
            onClick={() => void run(() => askPublicPlaybook(playbookId, question))}
          >
            Ask API
          </button>
        </article>

        <article className="apiPanel">
          <div className="apiPanelTop">
            <div>
              <p className="panelKicker">Match endpoint</p>
              <h2>Classify one clause</h2>
            </div>
            <Search size={18} />
          </div>
          <textarea value={clauseText} onChange={(event) => setClauseText(event.target.value)} />
          <div className="apiButtonRow">
            <button
              className="primaryAction"
              type="button"
              disabled={loading}
              onClick={() => void run(() => matchPublicClause(playbookId, clauseText))}
            >
              Match clause
            </button>
            <button
              className="secondaryAction"
              type="button"
              disabled={loading || !lastMatch}
              onClick={() => lastMatch && void run(() => suggestPublicRewrite(
                playbookId,
                clauseText,
                lastMatch.matched_clause.clause_id
              ))}
            >
              <Wand2 size={15} />
              Suggest rewrite
            </button>
          </div>
        </article>

        <article className="apiPanel wide">
          <div className="apiPanelTop">
            <div>
              <p className="panelKicker">Contract analysis</p>
              <h2>Analyze full contract</h2>
            </div>
            <RefreshCw size={18} />
          </div>
          <textarea value={contractText} onChange={(event) => setContractText(event.target.value)} />
          <div className="apiButtonRow">
            <button
              className="primaryAction"
              type="button"
              disabled={loading}
              onClick={() => void run(() => analyzePublicContractText(playbookId, contractText))}
            >
              Analyze text
            </button>
            <button
              className="secondaryAction"
              type="button"
              disabled={loading}
              onClick={() => void run(() => fetchCoverageGaps(playbookId, contractText))}
            >
              Coverage gaps
            </button>
            <label className="fileUploadBtn">
              <FileUp size={14} />
              {contractFile ? contractFile.name : 'Upload PDF / DOCX'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setContractFile(f)
                  if (f) void run(() => analyzePublicContractFile(playbookId, f))
                }}
              />
            </label>
          </div>
        </article>

        <article className="apiPanel resultPanel">
          <div className="apiPanelTop">
            <div>
              <p className="panelKicker">Response</p>
              <h2>{selected ? selected.playbook_id : 'No published playbook'}</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {heatmap && (
                <button
                  className="secondaryAction"
                  type="button"
                  style={{ fontSize: 11, padding: '4px 10px', minHeight: 28 }}
                  onClick={() => setHeatmap(null)}
                >
                  JSON
                </button>
              )}
              {loading && <span className="statusPill">Running</span>}
            </div>
          </div>
          {heatmap ? (
            <HeatmapView data={heatmap} />
          ) : (
            <pre>{result ? JSON.stringify(result, null, 2) : 'Run an endpoint to see the JSON response.'}</pre>
          )}
        </article>
      </section>
    </main>
  )
}
