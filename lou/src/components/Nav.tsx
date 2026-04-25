import { BrainCircuit, Braces, Download, FileSpreadsheet, Network, SearchCode, Upload, Wand2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { exportExcel } from '../api/client'

const itemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  justifyItems: 'center',
  padding: '12px 6px',
  color: 'var(--muted)',
  textDecoration: 'none',
  borderLeft: '3px solid transparent',
  fontSize: 11,
}

export function Nav({
  pendingCount,
  onUpload,
  currentPlaybookId,
}: {
  pendingCount: number
  onUpload: () => void
  currentPlaybookId: string | null
}): JSX.Element {
  const activePlaybookPath = currentPlaybookId ? `/playbooks/${currentPlaybookId}` : '/playbooks/current'
  const items = [
    { to: '/', label: 'Upload', icon: Upload },
    { to: `${activePlaybookPath}/edit`, label: 'Editor', icon: FileSpreadsheet },
    { to: `${activePlaybookPath}/analysis`, label: 'Logic', icon: Wand2 },
    { to: `${activePlaybookPath}/brain`, label: 'Brain', icon: Network, badge: pendingCount },
    { to: '/api-console', label: 'API', icon: Braces },
    { to: '/mega-brain', label: 'Mega', icon: BrainCircuit },
  ]

  return (
    <aside style={{
      position: 'fixed',
      inset: '0 auto 0 0',
      width: 80,
      zIndex: 200,
      background: 'rgba(244,234,216,0.94)',
      borderRight: '1px solid rgba(47,42,34,.12)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      paddingTop: 16,
    }}>
      <button
        type="button"
        onClick={onUpload}
        title="Upload"
        style={{ ...itemStyle, border: 0, background: 'transparent', cursor: 'pointer' }}
      >
        <SearchCode size={19} />
        Lou
      </button>
      <nav style={{ display: 'grid', gap: 4, marginTop: 10 }}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...itemStyle,
                color: isActive ? 'var(--ink)' : 'var(--muted)',
                borderLeftColor: isActive ? 'var(--turquoise)' : 'transparent',
                background: isActive ? 'rgba(0,153,153,.08)' : 'transparent',
              })}
            >
              <span style={{ position: 'relative' }}>
                <Icon size={19} />
                {!!item.badge && (
                  <span style={{
                    position: 'absolute',
                    top: -9,
                    right: -12,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 999,
                    background: 'var(--orange)',
                    color: 'white',
                    fontSize: 10,
                    display: 'grid',
                    placeItems: 'center',
                  }}>{item.badge}</span>
                )}
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <button
        type="button"
        onClick={() => void exportExcel()}
        title="Export Excel"
        style={{ ...itemStyle, border: 0, background: 'transparent', cursor: 'pointer', marginTop: 'auto', marginBottom: 16 }}
      >
        <Download size={19} />
        Export
      </button>
    </aside>
  )
}
