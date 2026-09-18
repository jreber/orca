import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AgentStatusModule from '@/lib/agent-status'

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))

vi.mock('@/lib/agent-status', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentStatusModule>()
  return { ...actual, detectAgentStatusFromTitle: vi.fn().mockReturnValue(null) }
})

import { createTestStore, makeWorktree, seedStore } from '../slices/store-test-helpers'
import { buildWorktreePurgeState } from '../slices/worktrees/teardown/worktree-purge-state'

const WT1 = 'repo1::/path/wt1'
const WT2 = 'repo1::/path/wt2'

function makeStore() {
  const store = createTestStore()
  seedStore(store, {
    worktreesByRepo: {
      repo1: [
        makeWorktree({ id: WT1, repoId: 'repo1', path: '/path/wt1' }),
        makeWorktree({ id: WT2, repoId: 'repo1', path: '/path/wt2' })
      ]
    },
    layoutByWorktree: {
      [WT1]: {
        type: 'split',
        direction: 'horizontal',
        ratio: 0.5,
        first: { type: 'leaf', groupId: 'g1' },
        second: { type: 'leaf', groupId: 'g2' }
      },
      [WT2]: { type: 'leaf', groupId: 'g3' }
    },
    groupsByWorktree: {
      [WT1]: [
        { id: 'g1', worktreeId: WT1, activeTabId: null, tabOrder: [] },
        { id: 'g2', worktreeId: WT1, activeTabId: null, tabOrder: [] }
      ],
      [WT2]: [{ id: 'g3', worktreeId: WT2, activeTabId: null, tabOrder: [] }]
    },
    activeGroupIdByWorktree: { [WT1]: 'g1', [WT2]: 'g3' }
  })
  return store
}

describe('paneCardDeckByWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles the deck flag on and off per worktree', () => {
    const store = makeStore()
    store.getState().togglePaneCardDeck(WT1)

    expect(store.getState().paneCardDeckByWorktree[WT1]).toBe(true)

    store.getState().togglePaneCardDeck(WT1)
    expect(store.getState().paneCardDeckByWorktree[WT1]).toBe(false)
  })

  it('keeps worktree flags independent', () => {
    const store = makeStore()
    store.getState().togglePaneCardDeck(WT1)
    store.getState().togglePaneCardDeck(WT2)

    expect(store.getState().paneCardDeckByWorktree).toEqual({
      [WT1]: true,
      [WT2]: true
    })
  })

  it('is a no-op for an unknown worktree', () => {
    const store = makeStore()
    const before = store.getState().paneCardDeckByWorktree
    store.getState().togglePaneCardDeck('ghost::/nowhere')

    expect(store.getState().paneCardDeckByWorktree).toBe(before)
    expect(store.getState().paneCardDeckByWorktree['ghost::/nowhere']).toBeUndefined()
  })

  it('purge-state omits the flag for removed worktrees and keeps siblings', () => {
    const store = makeStore()
    store.getState().togglePaneCardDeck(WT1)
    store.getState().togglePaneCardDeck(WT2)

    const next = buildWorktreePurgeState(store.getState(), [{ id: WT1 }])

    expect(next.paneCardDeckByWorktree).toEqual({ [WT2]: true })
    expect(next.paneCardDeckByWorktree?.[WT1]).toBeUndefined()
  })
})
