// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useAppStore } from '@/store'
import TabGroupDeckLayout from './TabGroupDeckLayout'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { activateGroupTab } from './tab-group-tab-activation'

// Why: real TabGroupDeckCard exposes `data-tab-group-deck-card-id`, not
// `data-testid` — this test targets that real attribute.
function getCard(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector(`[data-tab-group-deck-card-id="${id}"]`)
  if (!el) {
    throw new Error(`card ${id} not found`)
  }
  return el as HTMLElement
}

vi.mock('@/lib/sidebar-worktree-activation', () => ({
  activateWorktreeFromSidebar: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('./tab-group-tab-activation', () => ({
  activateGroupTab: vi.fn()
}))
vi.mock('./useTabGroupWorkspaceModel', () => ({
  useTabGroupWorkspaceModel: () => ({
    group: { id: 'g1', tabOrder: [] },
    activeTab: { id: 'tabA1' },
    deckTabs: [
      { id: 'tabA1', entityId: 'e1', contentType: 'terminal', worktreeId: 'wtA', groupId: 'g1' },
      { id: 'tabB1', entityId: 'e2', contentType: 'browser', worktreeId: 'wtB', groupId: 'g2' }
    ],
    groupTabs: [],
    commands: {}
  })
}))

describe('TabGroupDeckLayout cross-worktree activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ activeWorktreeId: 'wtA' } as never)
  })

  it("switches worktree before activating a foreign-worktree card, using the card's own group", async () => {
    const { container } = render(
      <TabGroupDeckLayout
        groupId="g1"
        worktreeId="wtA"
        activeOverlayTabId={null}
        stageContent={null}
      />
    )
    fireEvent.pointerDown(getCard(container, 'tabB1'))
    await vi.waitFor(() => expect(activateGroupTab).toHaveBeenCalled())
    expect(activateWorktreeFromSidebar).toHaveBeenCalledWith('wtB')
    // Why: 'g2' (the tab's own group), never this deck's 'g1' — passing 'g1'
    // would corrupt wtB's activeGroupIdByWorktree with a group id it doesn't own.
    expect(activateGroupTab).toHaveBeenCalledWith(
      'wtB',
      'g2',
      expect.objectContaining({ id: 'tabB1' })
    )
  })

  it('skips the worktree switch when the card is already in the active worktree', async () => {
    const { container } = render(
      <TabGroupDeckLayout
        groupId="g1"
        worktreeId="wtA"
        activeOverlayTabId={null}
        stageContent={null}
      />
    )
    fireEvent.pointerDown(getCard(container, 'tabA1'))
    await vi.waitFor(() => expect(activateGroupTab).toHaveBeenCalled())
    expect(activateWorktreeFromSidebar).not.toHaveBeenCalled()
    expect(activateGroupTab).toHaveBeenCalledWith(
      'wtA',
      'g1',
      expect.objectContaining({ id: 'tabA1' })
    )
  })
})
