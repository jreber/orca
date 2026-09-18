// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TabGroupDeckLayout from './TabGroupDeckLayout'

vi.mock('./useTabGroupWorkspaceModel', () => ({
  useTabGroupWorkspaceModel: () => ({
    group: { id: 'g1', tabOrder: [] },
    activeTab: { id: 'tabA1' },
    deckTabs: [
      { id: 'tabA1', entityId: 'e1', contentType: 'terminal', worktreeId: 'wtA' },
      { id: 'tabB1', entityId: 'e2', contentType: 'browser', worktreeId: 'wtB' }
    ],
    groupTabs: [{ id: 'tabA1', entityId: 'e1', contentType: 'terminal', worktreeId: 'wtA' }],
    commands: {}
  })
}))

vi.mock('./TabGroupDeckCard', () => ({
  default: ({ worktreeId, tab }: { worktreeId: string; tab: { id: string } }) => (
    <div data-testid={`card-${tab.id}`} data-worktree={worktreeId} />
  )
}))

describe('TabGroupDeckLayout pooled rail', () => {
  it("renders one card per deckTabs entry using each tab's own worktreeId", () => {
    render(
      <TabGroupDeckLayout
        groupId="g1"
        worktreeId="wtA"
        activeOverlayTabId={null}
        stageContent={null}
      />
    )
    expect(screen.getByTestId('card-tabA1').getAttribute('data-worktree')).toBe('wtA')
    expect(screen.getByTestId('card-tabB1').getAttribute('data-worktree')).toBe('wtB')
  })
})
