import React from 'react'
import { ArrowRight, Pencil, RefreshCw, Wand2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPlaybook, updatePlaybookClause } from '../api/client'
import type { PlaybookApi, PlaybookClause } from '../types'

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
  const { playbookId = 'current' } = useParams()
  const navigate = useNavigate()
  const [playbook, setPlaybook] = React.useState<PlaybookApi | null>(null)
  const [selectedClauseId, setSelectedClauseId] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<{ clauseId: string; field: ClauseField; value: string } | null>(null)
  const [editedBy, setEditedBy] = React.useState('Peter')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPlaybook(playbookId)
        if (!cancelled) {
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
    } catch {
      setError('Could not save this draft edit.')
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
          <button className="secondaryAction" type="button" disabled>
            <Wand2 size={16} />
            Rewrite all
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
                            onEdit={(value) => setEditing({ clauseId: clause.clause_id, field: column.key, value })}
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
          <div className="drawerActions">
            <button className="secondaryAction" type="button" onClick={() => setEditing(null)}>Cancel</button>
            <button className="primaryAction" type="button" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? 'Saving...' : 'Save draft edit'}
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
