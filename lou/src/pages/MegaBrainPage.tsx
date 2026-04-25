import React from 'react'
import { BrainCircuit, RefreshCw, Search } from 'lucide-react'
import { fetchMegaBrain, searchMegaBrain } from '../api/client'
import type { MegaBrain, MegaBrainSearchResult } from '../types'

export function MegaBrainPage(): JSX.Element {
  const [megaBrain, setMegaBrain] = React.useState<MegaBrain | null>(null)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MegaBrainSearchResult[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const data = await fetchMegaBrain()
        if (!cancelled) setMegaBrain(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function runSearch(): Promise<void> {
    if (query.trim().length < 2) return
    setResults(await searchMegaBrain(query.trim()))
  }

  return (
    <main className="creamPage appPage">
      <section className="editorTopbar">
        <div>
          <p className="panelKicker">Company knowledge</p>
          <h1>Mega Brain</h1>
        </div>
        <div className="megaSearch">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search published playbooks" />
          <button className="primaryAction" type="button" onClick={() => void runSearch()}>
            <Search size={16} />
            Search
          </button>
        </div>
      </section>

      {loading && (
        <section className="toolSurface loadingState">
          <RefreshCw size={18} />
          Loading mega brain...
        </section>
      )}

      {megaBrain && !loading && (
        <section className="megaLayout">
          <div className="megaIslandGrid">
            {megaBrain.islands.length === 0 && (
              <section className="toolSurface">
                <p className="panelKicker">No islands yet</p>
                <h1>Publish a playbook first</h1>
                <p>Each published playbook appears here as its own island. Lou keeps version boundaries visible.</p>
              </section>
            )}
            {megaBrain.islands.map((island) => (
              <article className="megaIsland" key={`${island.playbook_id}-${island.playbook_version}`}>
                <div className="megaIslandTop">
                  <BrainCircuit size={20} />
                  <div>
                    <h2>{island.name}</h2>
                    <p>{island.owner} / v{island.playbook_version}</p>
                  </div>
                </div>
                <div className="islandNodes" aria-label={`${island.name} mini brain island`}>
                  {island.nodes.map((node) => (
                    <span key={node.id} style={{ borderColor: node.color, color: node.color }}>
                      {node.label}
                    </span>
                  ))}
                </div>
                <small>{island.edges.length} internal link(s)</small>
              </article>
            ))}
          </div>

          <aside className="issuePanel">
            <p className="panelKicker">Published modules</p>
            <h2>{megaBrain.modules.length} island(s)</h2>
            <div className="issueList">
              {megaBrain.modules.map((module) => (
                <article className="issueCard" key={`${module.playbook_id}-${module.playbook_version}`}>
                  <strong>{module.name}</strong>
                  <p>{module.node_count} clause API nodes.</p>
                  <small>{module.playbook_id} / v{module.playbook_version}</small>
                </article>
              ))}
            </div>
            {results.length > 0 && (
              <>
                <p className="panelKicker searchResultsKicker">Search results</p>
                <div className="issueList">
                  {results.map((result) => (
                    <article className="issueCard" key={`${result.playbook_id}-${result.clause_id}`}>
                      <strong>{result.topic}</strong>
                      <p>{result.document.slice(0, 180)}...</p>
                      <small>{result.playbook_id} / {(result.similarity * 100).toFixed(0)}%</small>
                    </article>
                  ))}
                </div>
              </>
            )}
          </aside>
        </section>
      )}
    </main>
  )
}
