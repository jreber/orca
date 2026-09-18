// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { useAppStore } from '../../store'
import { TooltipProvider } from '@/components/ui/tooltip'
import type * as TerminalTabActivityStatus from '../tab-bar/terminal-tab-activity-status'
import TabGroupDeckCard from './TabGroupDeckCard'

// Why: stubs the real activity resolver so a 'permission' badge doesn't need a
// fabricated agentStatusByPaneKey entry — only the border priority is under test.
vi.mock('../tab-bar/terminal-tab-activity-status', async (importOriginal) => {
  const actual = await importOriginal<typeof TerminalTabActivityStatus>()
  return { ...actual, resolveTerminalTabAttentionBadge: () => 'permission' }
})

const editorTab: Tab = {
  id: 'tab-1',
  entityId: '/repo/file.ts',
  groupId: 'group-1',
  worktreeId: 'worktree-1',
  contentType: 'editor',
  label: 'file.ts',
  customLabel: null,
  color: null,
  sortOrder: 0,
  createdAt: 0
}

const terminalTab: Tab = {
  id: 'tab-2',
  entityId: 'terminal-1',
  groupId: 'group-1',
  worktreeId: 'worktree-1',
  contentType: 'terminal',
  label: 'shell',
  customLabel: null,
  color: null,
  sortOrder: 1,
  createdAt: 0
}

const terminalTabStoreEntry: TerminalTab = {
  id: 'terminal-1',
  ptyId: null,
  worktreeId: 'worktree-1',
  title: 'shell',
  customTitle: null,
  color: null,
  sortOrder: 1,
  createdAt: 0
}

describe('TabGroupDeckCard', () => {
  it('does not let a wheel event bubble into the deck rail scroller', () => {
    const onDeckWheel = vi.fn()
    const { container } = render(
      <div onWheel={onDeckWheel}>
        <TabGroupDeckCard worktreeId="worktree-1" tab={editorTab} onActivate={() => {}} />
      </div>
    )

    const card = container.querySelector('[data-tab-group-deck-card-id="tab-1"]')
    expect(card).not.toBeNull()
    fireEvent.wheel(card as Element, { deltaY: 40 })

    expect(onDeckWheel).not.toHaveBeenCalled()
  })

  it('marks the active card with the same underline color/width as the tab strip', () => {
    const { container } = render(
      <TabGroupDeckCard worktreeId="worktree-1" tab={editorTab} isActive onActivate={() => {}} />
    )

    const card = container.querySelector('[data-tab-group-deck-card-active="true"]')
    expect(card).not.toBeNull()
    expect(card?.className).toContain('border-2')
    expect(card?.className).toContain(
      'border-[color-mix(in_srgb,var(--foreground)_60%,var(--card))]'
    )
  })

  afterEach(() => {
    useAppStore.setState({ tabsByWorktree: {} })
  })

  it('marks a permission-needing card with the agent-question border, taking priority over the active border', () => {
    useAppStore.setState({ tabsByWorktree: { 'worktree-1': [terminalTabStoreEntry] } })

    const { container } = render(
      <TooltipProvider>
        <TabGroupDeckCard
          worktreeId="worktree-1"
          tab={terminalTab}
          isActive
          onActivate={() => {}}
        />
      </TooltipProvider>
    )

    const card = container.querySelector('[data-tab-group-deck-card-id="tab-2"]')
    expect(card).not.toBeNull()
    expect(card?.className).toContain('border-2')
    expect(card?.className).toContain('border-agent-question')
    expect(card?.className).not.toContain(
      'border-[color-mix(in_srgb,var(--foreground)_60%,var(--card))]'
    )
  })

  // Why: Task 4 passes each card its own tab's worktree id (not a fixed
  // panel worktree), so every store read here must key off the `worktreeId`
  // prop — verifies no stale closed-over panel worktree id slipped in.
  it("reads unread state from the card's own worktreeId prop, not a fixed panel worktree", () => {
    useAppStore.setState({
      tabsByWorktree: {
        wtA: [{ ...terminalTabStoreEntry, id: 'tabA1', worktreeId: 'wtA' }],
        wtB: [{ ...terminalTabStoreEntry, id: 'tabB1', worktreeId: 'wtB' }]
      },
      unreadTerminalTabs: { tabB1: true }
    })

    const { container } = render(
      <TooltipProvider>
        <TabGroupDeckCard
          worktreeId="wtB"
          tab={{ ...terminalTab, id: 'tab-b', entityId: 'tabB1', worktreeId: 'wtB' }}
          isActive={false}
          onActivate={() => {}}
        />
      </TooltipProvider>
    )

    const card = container.querySelector('[data-tab-group-deck-card-id="tab-b"]')
    expect(card).not.toBeNull()
    // hasUnread=true for tabB1 flows into the attention badge only when the
    // card resolves terminalTab from tabsByWorktree['wtB'] (the prop), not
    // some other worktree — proving the read is prop-scoped.
    expect(card?.getAttribute('data-tab-group-deck-card-state')).toBe('permission')
  })
})
