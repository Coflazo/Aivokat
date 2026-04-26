import React from 'react'
import { BrainCircuit, ClipboardList, Download, FileSpreadsheet, History, MessageCircle, Network, Upload, UserRoundCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { exportExcel } from '../api/client'
import { useUser } from '../contexts/UserContext'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

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
  const { user, setUser } = useUser()
  const location = useLocation()

  // Derive playbook ID from current URL — source of truth over stale prop
  const urlPlaybookId = React.useMemo(() => {
    const m = location.pathname.match(/\/playbooks\/([^/]+)/)
    const id = m?.[1]
    return id && id !== 'new' && id !== 'current' ? id : null
  }, [location.pathname])

  const realPlaybookId = urlPlaybookId ?? (currentPlaybookId && currentPlaybookId !== 'new' ? currentPlaybookId : null)
  const activePlaybookPath = realPlaybookId ? `/playbooks/${realPlaybookId}` : null
  const activePlaybookShort = realPlaybookId ? realPlaybookId.slice(0, 10) : null

  const peterItems: NavItem[] = [
    { to: activePlaybookPath ? `${activePlaybookPath}/edit` : '/playbooks/new/edit', label: 'Editor', icon: FileSpreadsheet },
    ...(activePlaybookPath ? [{ to: `${activePlaybookPath}/brain`, label: 'Brain', icon: Network }] : []),
    { to: '/mega-brain', label: 'Mega', icon: BrainCircuit },
    { to: '/chat', label: 'Chat', icon: MessageCircle },
    { to: '/history', label: 'History', icon: History },
    { to: '/review-queue', label: 'Review', icon: ClipboardList, badge: pendingCount },
  ]

  const suzanneItems: NavItem[] = [
    { to: '/mega-brain', label: 'Brain', icon: BrainCircuit },
    ...(activePlaybookPath ? [{ to: `${activePlaybookPath}/brain`, label: 'Mini Brain', icon: Network }] : []),
    { to: '/chat', label: 'Chat', icon: MessageCircle },
  ]

  const items: NavItem[] = user?.role === 'suzanne' ? suzanneItems : peterItems
  const roleColor = user?.role === 'suzanne' ? 'var(--turquoise)' : '#4a2076'

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
      {/* Lou wordmark as home link */}
      <NavLink
        to="/"
        style={{ textDecoration: 'none', border: 0, background: 'transparent' }}
      >
        <div style={{
          display: 'grid',
          gap: 2,
          justifyItems: 'center',
          padding: '10px 6px 8px',
        }}>
          <span style={{
            fontFamily: "'Cedarville Cursive', cursive",
            fontSize: 26,
            color: 'var(--ink)',
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}>
            Lou
          </span>
          <span style={{
            fontSize: 9,
            color: 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 68,
            textAlign: 'center',
          }}>
            {activePlaybookShort ?? '—'}
          </span>
        </div>
      </NavLink>

      {user && (
        <div style={{ display: 'grid', placeItems: 'center', gap: 2, padding: '6px 4px', marginBottom: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: roleColor, color: 'white',
            display: 'grid', placeItems: 'center',
            fontSize: 12, fontWeight: 700,
          }}>
            {user.name[0]}
          </div>
          <span style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>{user.name}</span>
        </div>
      )}

      <nav style={{ display: 'grid', gap: 4, marginTop: 4 }}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...itemStyle,
                color: isActive ? 'var(--ink)' : 'var(--muted)',
                borderLeftColor: isActive ? roleColor : 'transparent',
                background: isActive ? `${roleColor}14` : 'transparent',
              })}
            >
              <span style={{ position: 'relative' }}>
                <Icon size={19} />
                {item.badge != null && item.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -9, right: -12,
                    minWidth: 17, height: 17, borderRadius: 999,
                    background: 'var(--orange)', color: 'white',
                    fontSize: 10, display: 'grid', placeItems: 'center',
                  }}>{item.badge}</span>
                )}
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', display: 'grid', gap: 0, paddingBottom: 16 }}>
        {user?.role === 'peter' && (
          <button
            type="button"
            onClick={() => void exportExcel()}
            title="Export Excel"
            style={{ ...itemStyle, border: 0, background: 'transparent', cursor: 'pointer' }}
          >
            <Download size={19} />
            Export
          </button>
        )}
        <button
          type="button"
          onClick={() => setUser(null)}
          title="Change account"
          style={{ ...itemStyle, border: 0, background: 'transparent', cursor: 'pointer' }}
        >
          <UserRoundCog size={19} />
          Account
        </button>
      </div>
    </aside>
  )
}
