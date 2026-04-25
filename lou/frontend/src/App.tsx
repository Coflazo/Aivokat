import { useState } from 'react'
import Layout from './components/Layout'
import NeuralMap from './components/NeuralMap'
import ChatInterface from './components/ChatInterface'
import CommitHistory from './components/CommitHistory'
import ReviewQueue from './components/ReviewQueue'

export type Screen = 'neural' | 'chat' | 'commits' | 'review'

export default function App() {
  const [screen, setScreen] = useState<Screen>('neural')
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)

  const navigateTo = (s: Screen, nodeId?: string) => {
    setScreen(s)
    if (nodeId) setHighlightedNode(nodeId)
  }

  return (
    <Layout screen={screen} onNavigate={navigateTo}>
      {screen === 'neural' && (
        <NeuralMap highlightedNode={highlightedNode} onClearHighlight={() => setHighlightedNode(null)} />
      )}
      {screen === 'chat' && (
        <ChatInterface onNavigateToNode={(id) => navigateTo('neural', id)} />
      )}
      {screen === 'commits' && (
        <CommitHistory onNavigateToNode={(id) => navigateTo('neural', id)} />
      )}
      {screen === 'review' && (
        <ReviewQueue />
      )}
    </Layout>
  )
}
