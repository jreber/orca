import { describe, it, expect } from 'vitest'
import { computeGlobalDeckTabs, orderTabsByTabStripOrder } from './tab-group-tab-strip-order'

describe('orderTabsByTabStripOrder', () => {
  it('returns tabs unchanged when tabOrder is absent', () => {
    const tabs = [{ id: 'a' }, { id: 'b' }]
    expect(orderTabsByTabStripOrder(tabs, undefined)).toEqual(tabs)
  })

  it('sorts by tabOrder, pushing ids missing from tabOrder to the end', () => {
    const tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(orderTabsByTabStripOrder(tabs, ['c', 'a'])).toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' }
    ])
  })
})

describe('computeGlobalDeckTabs', () => {
  const worktreesByRepo = {
    repoA: [{ id: 'wtA' }],
    repoB: [{ id: 'wtB' }]
  }

  it('pools every worktree, in worktreesByRepo order', () => {
    const unifiedTabsByWorktree = {
      wtA: [{ id: 'tabA1', groupId: 'g1' }],
      wtB: [{ id: 'tabB1', groupId: 'g2' }]
    }
    const result = computeGlobalDeckTabs(
      'wtA',
      'g1',
      undefined,
      worktreesByRepo,
      unifiedTabsByWorktree
    )
    expect(result.map((tab) => tab.id)).toEqual(['tabA1', 'tabB1'])
    expect(result.map((tab) => tab.worktreeId)).toEqual(['wtA', 'wtB'])
  })

  it("scopes the origin worktree to groupId, excluding a sibling split's tabs", () => {
    const unifiedTabsByWorktree = {
      wtA: [
        { id: 'tabA1', groupId: 'g1' },
        { id: 'tabA2', groupId: 'sibling-group' }
      ],
      wtB: [{ id: 'tabB1', groupId: 'g2' }]
    }
    const result = computeGlobalDeckTabs(
      'wtA',
      'g1',
      undefined,
      worktreesByRepo,
      unifiedTabsByWorktree
    )
    expect(result.map((tab) => tab.id)).toEqual(['tabA1', 'tabB1'])
  })

  it("pools every one of a foreign worktree's tabs regardless of group", () => {
    const unifiedTabsByWorktree = {
      wtA: [{ id: 'tabA1', groupId: 'g1' }],
      wtB: [
        { id: 'tabB1', groupId: 'g2' },
        { id: 'tabB2', groupId: 'other-split-group' }
      ]
    }
    const result = computeGlobalDeckTabs(
      'wtA',
      'g1',
      undefined,
      worktreesByRepo,
      unifiedTabsByWorktree
    )
    expect(result.map((tab) => tab.id)).toEqual(['tabA1', 'tabB1', 'tabB2'])
  })

  it("only honors the origin worktree's drag-reordered tabOrder", () => {
    const unifiedTabsByWorktree = {
      wtA: [
        { id: 'tabA1', groupId: 'g1' },
        { id: 'tabA2', groupId: 'g1' }
      ],
      wtB: [
        { id: 'tabB2', groupId: 'g2' },
        { id: 'tabB1', groupId: 'g2' }
      ]
    }
    const result = computeGlobalDeckTabs(
      'wtA',
      'g1',
      ['tabA2', 'tabA1'],
      worktreesByRepo,
      unifiedTabsByWorktree
    )
    expect(result.map((tab) => tab.id)).toEqual(['tabA2', 'tabA1', 'tabB2', 'tabB1'])
  })

  it('returns an empty list when no worktree has any tabs', () => {
    expect(computeGlobalDeckTabs('wtA', 'g1', undefined, worktreesByRepo, {})).toEqual([])
  })
})
