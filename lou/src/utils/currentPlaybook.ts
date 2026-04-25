const CURRENT_PLAYBOOK_KEY = 'lou.currentPlaybookId'

export function saveCurrentPlaybookId(playbookId: string): void {
  window.localStorage.setItem(CURRENT_PLAYBOOK_KEY, playbookId)
}

export function getCurrentPlaybookId(): string | null {
  return window.localStorage.getItem(CURRENT_PLAYBOOK_KEY)
}

export function resolvePlaybookId(playbookId: string | undefined): string {
  if (!playbookId || playbookId === 'current') {
    return getCurrentPlaybookId() || 'current'
  }
  return playbookId
}
