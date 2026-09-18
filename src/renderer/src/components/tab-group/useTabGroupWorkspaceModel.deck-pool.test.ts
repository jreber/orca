/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAppStore } from '@/store'
import { useTabGroupWorkspaceModel } from './useTabGroupWorkspaceModel'

describe('useTabGroupWorkspaceModel deckTabs pooling', () => {
  beforeEach(() => {
    useAppStore.setState({
      projects: [
        {
          id: 'proj1',
          displayName: 'Proj',
          badgeColor: '#000',
          sourceRepoIds: ['repoA', 'repoB'],
          createdAt: 0,
          updatedAt: 0
        }
      ],
      repos: [
        { id: 'repoA', path: '/a', displayName: 'a', badgeColor: '#000', addedAt: 0, kind: 'git' },
        {
          id: 'repoB',
          path: '/b',
          displayName: 'b',
          badgeColor: '#000',
          addedAt: 0,
          kind: 'folder'
        }
      ],
      worktreesByRepo: {
        repoA: [{ id: 'wtA', repoId: 'repoA' }],
        repoB: [{ id: 'wtB', repoId: 'repoB' }]
      },
      unifiedTabsByWorktree: {
        wtA: [{ id: 'tabA1', entityId: 'e1', contentType: 'terminal', groupId: 'g1' }],
        wtB: [{ id: 'tabB1', entityId: 'e2', contentType: 'browser', groupId: 'g2' }]
      }
    } as never)
  })

  it('pools tabs from every worktree app-wide, in worktreesByRepo order', () => {
    const { result } = renderHook(() =>
      useTabGroupWorkspaceModel({ groupId: 'g1', worktreeId: 'wtA' })
    )
    expect(result.current.deckTabs.map((tab) => tab.id)).toEqual(['tabA1', 'tabB1'])
    expect(result.current.deckTabs.map((tab) => tab.worktreeId)).toEqual(['wtA', 'wtB'])
  })

  it("excludes a sibling group's tabs in its own worktree, but keeps other worktrees unfiltered", () => {
    useAppStore.setState({
      unifiedTabsByWorktree: {
        wtA: [
          { id: 'tabA1', entityId: 'e1', contentType: 'terminal', groupId: 'g1' },
          { id: 'tabA2', entityId: 'e3', contentType: 'terminal', groupId: 'sibling-group' }
        ],
        wtB: [{ id: 'tabB1', entityId: 'e2', contentType: 'browser', groupId: 'g2' }]
      }
    } as never)
    const { result } = renderHook(() =>
      useTabGroupWorkspaceModel({ groupId: 'g1', worktreeId: 'wtA' })
    )
    expect(result.current.deckTabs.map((tab) => tab.id)).toEqual(['tabA1', 'tabB1'])
  })
})
