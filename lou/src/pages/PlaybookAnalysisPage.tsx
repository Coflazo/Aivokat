import React from 'react'
import { AlertTriangle, ArrowLeft, Check, RefreshCw, SearchCheck, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { acceptIssueFix, analyzePlaybook, fetchPlaybook, rejectIssue } from '../api/client'
import type { PlaybookApi, PlaybookIssue } from '../types'

export function PlaybookAnalysisPage(): JSX.Element {
  const { playbookId = 'current' } = useParams()
  const navigate = useNavigate()
  const [playbook, setPlaybook] = React.useState<PlaybookApi | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [running, setRunning] = React.useState(false)
  const [actingIssueId, setActingIssueId] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPlaybook(playbookId)
        if (!cancelled) setPlaybook(data)
      } catch {
        if (!cancelled) setError('Open a playbook by uploading one first.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [playbookId])

  async function runAnalysis(): Promise<void> {
    setRunning(true)
    setError(null)
    try {
      setPlaybook(await analyzePlaybook(playbookId))
    } catch {
      setError('Could not run logic analysis.')
    } finally {
      setRunning(false)
    }
  }

  async function accept(issue: PlaybookIssue): Promise<void> {
    if (!issue.id) return
    setActingIssueId(issue.id)
    setError(null)
    try {
      setPlaybook(await acceptIssueFix(issue.id))
    } catch {
      setError('Could not apply this proposed fix.')
    } finally {
      setActingIssueId(null)
    }
  }

  async function reject(issue: PlaybookIssue): Promise<void> {
    if (!issue.id) return
    setActingIssueId(issue.id)
    setError(null)
    try {
      setPlaybook(await rejectIssue(issue.id))
    } catch {
      setError('Could not reject this issue.')
    } finally {
      setActingIssueId(null)
    }
  }

  const issues = playbook?.clauses.flatMap((clause) => clause.issues.map((issue) => ({
    ...issue,
    clause_name: clause.clause_name,
    analysis_status: clause.analysis_status,
  }))) ?? []
  const openIssues = issues.filter((issue) => !issue.resolved_at)
  const criticalCount = openIssues.filter((issue) => issue.severity === 'critical').length
  const warningCount = openIssues.filter((issue) => issue.severity === 'warning').length

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Logic analysis</p>
          <h1>{playbook?.name ?? 'Playbook analysis'}</h1>
        </div>
        <div className="topbarActions">
          <button className="secondaryAction" type="button" onClick={() => navigate(`/playbooks/${playbookId}/edit`)}>
            <ArrowLeft size={16} />
            Back to editor
          </button>
          <button className="primaryAction" type="button" disabled={running || loading} onClick={() => void runAnalysis()}>
            <SearchCheck size={16} />
            {running ? 'Checking...' : 'Run logic analysis'}
          </button>
        </div>
      </section>

      {loading && (
        <section className="toolSurface loadingState">
          <RefreshCw size={18} />
          Loading analysis...
        </section>
      )}

      {error && !loading && (
        <section className="toolSurface emptyState">
          <p>{error}</p>
        </section>
      )}

      {playbook && !loading && (
        <section className="analysisLayout">
          <div className="analysisSummary">
            <article>
              <span>{playbook.clauses.length}</span>
              Clauses
            </article>
            <article className={criticalCount ? 'critical' : ''}>
              <span>{criticalCount}</span>
              Critical
            </article>
            <article className={warningCount ? 'warning' : ''}>
              <span>{warningCount}</span>
              Warnings
            </article>
          </div>

          <div className="analysisGrid">
            <div className="analysisTableWrap">
              <table className="playbookTable analysisTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Clause</th>
                    <th>Status</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {playbook.clauses.map((clause) => (
                    <tr key={clause.clause_id} className={clause.analysis_status}>
                      <td>{clause.clause_number}</td>
                      <td>{clause.clause_name}</td>
                      <td>{clause.analysis_status}</td>
                      <td>{clause.analysis_summary ?? 'Not analyzed yet.'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className="issuePanel">
              <p className="panelKicker">Review queue</p>
              <h2>{openIssues.length ? `${openIssues.length} issue(s)` : 'No open issues'}</h2>
              <div className="issueList">
                {openIssues.length === 0 && (
                  <p className="emptyCopy">Run analysis or return to the editor. The playbook has no open logic issues.</p>
                )}
                {openIssues.map((issue) => (
                  <article key={issue.id} className={`issueCard ${issue.severity}`}>
                    <div className="issueCardTop">
                      <AlertTriangle size={16} />
                      <strong>{issue.clause_name}</strong>
                      <span>{issue.severity}</span>
                    </div>
                    <p>{issue.explanation}</p>
                    <small>{issue.field_name} / {issue.issue_type}</small>
                    {issue.proposed_fix && (
                      <blockquote>{issue.proposed_fix}</blockquote>
                    )}
                    <div className="drawerActions">
                      <button
                        className="secondaryAction"
                        type="button"
                        disabled={actingIssueId === issue.id}
                        onClick={() => void reject(issue)}
                      >
                        <X size={15} />
                        Reject
                      </button>
                      <button
                        className="primaryAction"
                        type="button"
                        disabled={!issue.proposed_fix || actingIssueId === issue.id}
                        onClick={() => void accept(issue)}
                      >
                        <Check size={15} />
                        Accept fix
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}
    </main>
  )
}
