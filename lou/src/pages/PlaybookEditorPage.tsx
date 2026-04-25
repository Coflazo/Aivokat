import React from 'react'
import { ArrowRight, Check, Pencil, RefreshCw, Wand2, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybook, rewriteCell, rewritePlaybook, updatePlaybookClause } from '../api/client'
import type { PlaybookApi, PlaybookClause, RewriteCellResponse, RewriteMode } from '../types'
import { resolvePlaybookId, saveCurrentPlaybookId } from '../utils/currentPlaybook'

type ClauseField =
  | 'clause_name'
  | 'why_it_matters'
  | 'preferred_position'
  | 'fallback_1'
  | 'fallback_2'
  | 'red_line'
  | 'escalation_trigger'

const columns: Array<{ key: ClauseField; label: string }> = [
  { key: 'clause_name', label: 'Clause Name' },
  { key: 'why_it_matters', label: 'Why It Matters' },
  { key: 'preferred_position', label: 'Preferred' },
  { key: 'fallback_1', label: 'Fallback 1' },
  { key: 'fallback_2', label: 'Fallback 2' },
  { key: 'red_line', label: 'Red Line' },
  { key: 'escalation_trigger', label: 'Escalation' },
]

export function PlaybookEditorPage(): JSX.Element {
  const params = useParams()
  const playbookId = resolvePlaybookId(params.playbookId)
  const navigate = useNavigate()
  const [playbook, setPlaybook] = React.useState<PlaybookApi | null>(null)
  const [selectedClauseId, setSelectedClauseId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<{ clauseId: string; field: ClauseField; value: string } | null>(null)
  const [rewriteProposal, setRewriteProposal] = React.useState<RewriteCellResponse | null>(null)
  const [bulkRewrite, setBulkRewrite] = React.useState<RewriteCellResponse[] | null>(null)
  const [rewriteMode, setRewriteMode] = React.useState<RewriteMode>('business_clear')
  const [editedBy, setEditedBy] = React.useState('Peter')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [rewriting, setRewriting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPlaybook(playbookId)
        if (!cancelled) {
          saveCurrentPlaybookId(data.playbook_id)
          setPlaybook(data)
          setSelectedClauseId(data.clauses[0]?.clause_id ?? null)
        }
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

  async function saveEdit(): Promise<void> {
    if (!editing || !playbook) return
    setSaving(true)
    setError(null)
    try {
      const response = await updatePlaybookClause(
        playbook.playbook_id,
        editing.clauseId,
        editing.field,
        editing.value,
        editedBy
      )
      setPlaybook(response.playbook)
      setEditing(null)
      setRewriteProposal(null)
    } catch {
      setError('Could not save this draft edit.')
    } finally {
      setSaving(false)
    }
  }

  async function proposeCellRewrite(): Promise<void> {
    if (!editing || !playbook) return
    setRewriting(true)
    setError(null)
    try {
      const proposal = await rewriteCell(
        playbook.playbook_id,
        editing.clauseId,
        editing.field,
        editing.value,
        rewriteMode
      )
      setRewriteProposal(proposal)
    } catch {
      setError('Could not generate a safe rewrite proposal.')
    } finally {
      setRewriting(false)
    }
  }

  async function proposeWholePlaybookRewrite(): Promise<void> {
    if (!playbook) return
    setRewriting(true)
    setError(null)
    try {
      const response = await rewritePlaybook(playbook.playbook_id, rewriteMode)
      setBulkRewrite(response.rewrites)
    } catch {
      setError('Could not generate whole-playbook rewrite proposals.')
    } finally {
      setRewriting(false)
    }
  }

  async function acceptRewrite(proposal: RewriteCellResponse): Promise<void> {
    if (!playbook) return
    setSaving(true)
    setError(null)
    try {
      const response = await updatePlaybookClause(
        playbook.playbook_id,
        proposal.clause_id,
        proposal.field_name,
        proposal.rewritten,
        editedBy
      )
      setPlaybook(response.playbook)
      setEditing(null)
      setRewriteProposal(null)
    } catch {
      setError('Could not apply the accepted rewrite.')
    } finally {
      setSaving(false)
    }
  }

  async function acceptAllRewrites(): Promise<void> {
    if (!playbook || !bulkRewrite) return
    setSaving(true)
    setError(null)
    try {
      let latest = playbook
      for (const proposal of bulkRewrite) {
        const response = await updatePlaybookClause(
          latest.playbook_id,
          proposal.clause_id,
          proposal.field_name,
          proposal.rewritten,
          editedBy
        )
        latest = response.playbook
      }
      setPlaybook(latest)
      setBulkRewrite(null)
    } catch {
      setError('Could not apply every accepted rewrite.')
    } finally {
      setSaving(false)
    }
  }

  const selectedClause = playbook?.clauses.find((clause) => clause.clause_id === selectedClauseId)

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Draft playbook</p>
          <h1>{playbook?.name ?? 'Playbook editor'}</h1>
        </div>
        <div className="topbarActions">
          <label>
            Editor
            <input value={editedBy} onChange={(event) => setEditedBy(event.target.value)} />
          </label>
          <label>
            Rewrite mode
            <select value={rewriteMode} onChange={(event) => setRewriteMode(event.target.value as RewriteMode)}>
              <option value="business_clear">Business clear</option>
              <option value="legal_precise">Legal precise</option>
              <option value="shorter">Shorter</option>
              <option value="humanized">Humanized</option>
            </select>
          </label>
          <button
            className="secondaryAction"
            type="button"
            disabled={!playbook || rewriting}
            onClick={() => void proposeWholePlaybookRewrite()}
          >
            <Wand2 size={16} />
            {rewriting ? 'Rewriting...' : 'Rewrite all'}
          </button>
          <button
            className="primaryAction"
            type="button"
            disabled={!playbook}
            onClick={() => playbook && navigate(`/playbooks/${playbook.playbook_id}/analysis`)}
          >
            Ready: Analyze Logic
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section className="playbookWorkspace">
        {loading && (
          <div className="toolSurface loadingState">
            <RefreshCw size={18} />
            Loading playbook...
          </div>
        )}
        {error && !loading && (
          <div className="toolSurface emptyState">
            <p>{error}</p>
            <button className="primaryAction" type="button" onClick={() => navigate('/')}>Upload playbook</button>
          </div>
        )}
        {playbook && !loading && (
          <>
            <div className="playbookTableWrap">
              <table className="playbookTable">
                <thead>
                  <tr>
                    <th>#</th>
                    {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {playbook.clauses.map((clause) => (
                    <tr
                      key={clause.clause_id}
                      className={`${selectedClauseId === clause.clause_id ? 'selected' : ''} ${clause.analysis_status}`}
                      onClick={() => setSelectedClauseId(clause.clause_id)}
                    >
                      <td>{clause.clause_number}</td>
                      {columns.map((column) => (
                        <td key={column.key}>
                          <EditableCell
                            clause={clause}
                            field={column.key}
                            onEdit={(value) => {
                              setRewriteProposal(null)
                              setEditing({ clauseId: clause.clause_id, field: column.key, value })
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className="clauseInspector">
              <p className="panelKicker">Selected clause</p>
              {selectedClause ? (
                <>
                  <h2>{selectedClause.clause_name}</h2>
                  <dl className="metadataGrid">
                    <div>
                      <dt>Status</dt>
                      <dd>{selectedClause.analysis_status}</dd>
                    </div>
                    <div>
                      <dt>Clause ID</dt>
                      <dd>{selectedClause.clause_id}</dd>
                    </div>
                    <div>
                      <dt>Issues</dt>
                      <dd>{selectedClause.issues.length}</dd>
                    </div>
                  </dl>
                  <p>{selectedClause.why_it_matters}</p>
                </>
              ) : (
                <p>Select a row to inspect the clause.</p>
              )}
            </aside>
          </>
        )}
      </section>

      {editing && (
        <section className="editDrawer">
          <p className="panelKicker">Draft edit</p>
          <h2>{columns.find((column) => column.key === editing.field)?.label}</h2>
          <textarea value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} />
          <button className="secondaryAction drawerWide" type="button" disabled={rewriting} onClick={() => void proposeCellRewrite()}>
            <Wand2 size={15} />
            {rewriting ? 'Rewriting...' : 'Propose business rewrite'}
          </button>
          {rewriteProposal && (
            <div className="rewriteProposal">
              <div>
                <p className="panelKicker">Original</p>
                <p>{rewriteProposal.original}</p>
              </div>
              <div>
                <p className="panelKicker">Proposed</p>
                <p>{rewriteProposal.rewritten}</p>
              </div>
              <small>{rewriteProposal.meaning_preservation_note}</small>
              <div className="drawerActions">
                <button className="secondaryAction" type="button" onClick={() => setRewriteProposal(null)}>
                  <X size={15} />
                  Reject
                </button>
                <button className="primaryAction" type="button" disabled={saving} onClick={() => void acceptRewrite(rewriteProposal)}>
                  <Check size={15} />
                  Accept rewrite
                </button>
              </div>
            </div>
          )}
          <div className="drawerActions">
            <button className="secondaryAction" type="button" onClick={() => setEditing(null)}>Cancel</button>
            <button className="primaryAction" type="button" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? 'Saving...' : 'Save draft edit'}
            </button>
          </div>
        </section>
      )}
      {bulkRewrite && (
        <section className="bulkRewritePanel">
          <div className="panelTop">
            <div>
              <p className="panelKicker">Whole playbook rewrite</p>
              <h2>{bulkRewrite.length} proposed field rewrites</h2>
            </div>
            <button className="closeButton" type="button" onClick={() => setBulkRewrite(null)}>Close</button>
          </div>
          <div className="bulkRewriteList">
            {bulkRewrite.map((proposal, index) => (
              <article key={`${proposal.clause_id}-${proposal.field_name}-${index}`}>
                <strong>{proposal.clause_id} / {proposal.field_name}</strong>
                <p>{proposal.rewritten}</p>
              </article>
            ))}
          </div>
          <div className="drawerActions">
            <button className="secondaryAction" type="button" onClick={() => setBulkRewrite(null)}>Reject all</button>
            <button className="primaryAction" type="button" disabled={saving} onClick={() => void acceptAllRewrites()}>
              {saving ? 'Applying...' : 'Accept all rewrites'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

function EditableCell(props: {
  clause: PlaybookClause
  field: ClauseField
  onEdit: (value: string) => void
}): JSX.Element {
  const value = props.clause[props.field] ?? ''
  return (
    <div className="editableCell">
      <span>{value || 'Not specified'}</span>
      <button
        type="button"
        title="Edit or rewrite"
        onClick={(event) => {
          event.stopPropagation()
          props.onEdit(String(value))
        }}
      >
        <Pencil size={13} />
      </button>
    </div>
  )
}
