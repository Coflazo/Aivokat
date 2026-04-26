import React from 'react'
import { uploadApiPlaybook, uploadContract } from '../api/client'
import { saveCurrentPlaybookId } from '../utils/currentPlaybook'

export function UploadModal({
  onClose,
  onDone,
  onPlaybookUploaded,
}: {
  onClose: () => void
  onDone: () => void
  onPlaybookUploaded?: (playbookId: string) => void
}): JSX.Element {
  const [file, setFile] = React.useState<File | null>(null)
  const [kind, setKind] = React.useState<'playbook' | 'contract'>('contract')
  const [lawyer, setLawyer] = React.useState('Dr. Schmidt')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState('')

  async function submit(): Promise<void> {
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      const result = kind === 'playbook'
        ? await uploadApiPlaybook(file, lawyer, file.name.replace(/\.xlsx$/i, ''), 'Uploaded from Lou quick upload')
        : await uploadContract(file, lawyer)
      if (kind === 'playbook') {
        const playbookId = result.playbook.playbook_id
        saveCurrentPlaybookId(playbookId)
        onPlaybookUploaded?.(playbookId)
      }
      setMessage(`success:${kind === 'playbook' ? result.playbook?.name ?? 'Playbook' : 'Contract'} uploaded successfully.`)
      onDone()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(47,42,34,.22)', zIndex: 500, display: 'grid', placeItems: 'center' }}>
      <section style={{ width: 460, maxWidth: 'calc(100vw - 32px)', background: 'var(--cream)', border: '1px solid rgba(47,42,34,.18)', borderRadius: 8, padding: 22, boxShadow: '0 18px 60px rgba(47,42,34,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <h2 style={{ margin: 0, color: 'var(--ink)' }}>Upload</h2>
          <button type="button" onClick={onClose} className="closeButton">Close</button>
        </div>
        <label style={{ display: 'grid', gap: 8, marginTop: 18 }}>
          Type
          <select value={kind} onChange={(event) => setKind(event.target.value as 'playbook' | 'contract')}>
            <option value="contract">Negotiated contract</option>
            <option value="playbook">Playbook</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          Lawyer
          <input value={lawyer} onChange={(event) => setLawyer(event.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          File
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <button className="reviewButton" type="button" disabled={!file || busy} onClick={() => void submit()} style={{ marginTop: 18 }}>
          {busy ? 'Uploading...' : 'Upload'}
        </button>
        {message && (
          <div style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 7,
            background: message.startsWith('success:') ? 'rgba(0,124,121,.08)' : 'rgba(180,40,40,.07)',
            border: `1px solid ${message.startsWith('success:') ? 'rgba(0,124,121,.25)' : 'rgba(180,40,40,.22)'}`,
            fontSize: 12,
            color: message.startsWith('success:') ? 'var(--turquoise)' : 'var(--risk)',
            lineHeight: 1.5,
          }}>
            {message.startsWith('success:') ? `✓ ${message.slice(8)}` : message}
          </div>
        )}
      </section>
    </div>
  )
}
