import React from 'react'
import { FileSearch, MessageSquareText, RefreshCw, Search, Wand2 } from 'lucide-react'
import {
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

export function ApiConsolePage(): JSX.Element {
  const [playbooks, setPlaybooks] = React.useState<PublicPlaybookListItem[]>([])
  const [playbookId, setPlaybookId] = React.useState('')
  const [question, setQuestion] = React.useState('Can we accept unlimited liability?')
  const [clauseText, setClauseText] = React.useState(sampleClause)
  const [contractText, setContractText] = React.useState(sampleContract)
  const [result, setResult] = React.useState<ConsoleResult>(null)
  const [lastMatch, setLastMatch] = React.useState<MatchClauseResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [])

  async function run(action: () => Promise<ConsoleResult>): Promise<void> {
    if (!playbookId) {
      setError('Publish a playbook before using the API console.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await action()
      setResult(next)
      if (next && 'matched_clause' in next) setLastMatch(next)
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
              <p className="panelKicker">Contract endpoint</p>
              <h2>Analyze contract text</h2>
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
              Analyze contract
            </button>
            <button
              className="secondaryAction"
              type="button"
              disabled={loading}
              onClick={() => void run(() => fetchCoverageGaps(playbookId, contractText))}
            >
              Coverage gaps
            </button>
          </div>
        </article>

        <article className="apiPanel resultPanel">
          <div className="apiPanelTop">
            <div>
              <p className="panelKicker">Response</p>
              <h2>{selected ? selected.playbook_id : 'No published playbook'}</h2>
            </div>
            {loading && <span className="statusPill">Running</span>}
          </div>
          <pre>{result ? JSON.stringify(result, null, 2) : 'Run an endpoint to see the JSON response.'}</pre>
        </article>
      </section>
    </main>
  )
}
