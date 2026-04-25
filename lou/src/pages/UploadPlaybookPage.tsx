import React from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { uploadApiPlaybook } from '../api/client'

export function UploadPlaybookPage(): JSX.Element {
  const navigate = useNavigate()
  const [file, setFile] = React.useState<File | null>(null)
  const [owner, setOwner] = React.useState('Peter')
  const [name, setName] = React.useState('NDA Playbook')
  const [description, setDescription] = React.useState('Siemens-style negotiation playbook')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!file) {
      setError('Choose a Siemens-style .xlsx playbook first.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await uploadApiPlaybook(file, owner, name, description)
      navigate(`/playbooks/${response.playbook.playbook_id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="creamPage appPage">
      <section className="toolSurface uploadSurface">
        <div>
          <p className="panelKicker">Playbook API Engine</p>
          <h1>Upload playbook</h1>
          <p>
            Upload a spreadsheet with the Siemens playbook columns. Lou will turn
            each row into a governed draft API clause.
          </p>
        </div>

        <form className="playbookForm" onSubmit={(event) => void submit(event)}>
          <label>
            Playbook name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Owner
            <input value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="fileDrop">
            <FileSpreadsheet size={24} />
            <span>{file ? file.name : 'Choose .xlsx playbook'}</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {error && <p className="formError">{error}</p>}
          <button className="primaryAction" disabled={loading} type="submit">
            <Upload size={16} />
            {loading ? 'Uploading...' : 'Create draft API'}
          </button>
        </form>
      </section>
    </main>
  )
}
