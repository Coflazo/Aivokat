import React from 'react'
import { useUser } from '../contexts/UserContext'

const ROLES = [
  {
    role: 'peter' as const,
    name: 'Peter',
    title: 'Legal Manager',
    description: 'Upload and govern playbooks, run analysis, manage the review queue, and publish versioned APIs to the company brain.',
    abilities: ['Upload & edit playbooks', 'Run AI analysis', 'Publish to Mega Brain', 'Approve review queue', 'Full API console', 'Commit history'],
    color: '#4a2076',
    bg: 'rgba(74,32,118,.07)',
    border: 'rgba(74,32,118,.22)',
  },
  {
    role: 'suzanne' as const,
    name: 'Suzanne',
    title: 'Contract Reviewer',
    description: 'Evaluate incoming contracts against published playbooks. Upload contracts to the brain, analyse clause-by-clause, and propose updates.',
    abilities: ['Search Mega Brain', 'Upload & analyse contracts', 'Chat with playbook AI', 'Propose node updates', 'View Mini Brain'],
    color: '#007c79',
    bg: 'rgba(0,153,153,.07)',
    border: 'rgba(0,153,153,.22)',
  },
]

export function RoleSelect(): JSX.Element {
  const { setUser } = useUser()
  const [hoveredRole, setHoveredRole] = React.useState<string | null>(null)

  function enter(role: typeof ROLES[0]): void {
    setUser({ name: role.name, role: role.role })
  }

  return (
    <main className="roleSelectPage">
      <div className="roleSelectInner">
        <div className="roleSelectHeader">
          <strong className="roleSelectBrand">Lou</strong>
          <p className="panelKicker">The GitHub for Lawyers</p>
          <h1>Who are you today?</h1>
          <p className="roleSelectSubtitle">
            Lou adapts to your role. Select your profile to continue.
          </p>
        </div>

        <div className="roleCardGrid">
          {ROLES.map((r) => (
            <button
              key={r.role}
              type="button"
              className="roleCard"
              style={{
                borderColor: hoveredRole === r.role ? r.border : 'rgba(47,42,34,.14)',
                background: hoveredRole === r.role ? r.bg : 'rgba(255,255,255,.62)',
              }}
              onMouseEnter={() => setHoveredRole(r.role)}
              onMouseLeave={() => setHoveredRole(null)}
              onClick={() => enter(r)}
            >
              <div className="roleCardAvatar" style={{ background: r.color }}>
                {r.name[0]}
              </div>
              <div className="roleCardContent">
                <strong className="roleCardName" style={{ color: r.color }}>{r.name}</strong>
                <span className="roleCardTitle">{r.title}</span>
                <p className="roleCardDesc">{r.description}</p>
                <ul className="roleCardAbilities">
                  {r.abilities.map((a) => (
                    <li key={a}>
                      <span className="roleCardCheck" style={{ color: r.color }}>✓</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="roleCardCta" style={{ color: r.color }}>
                Enter as {r.name} →
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
