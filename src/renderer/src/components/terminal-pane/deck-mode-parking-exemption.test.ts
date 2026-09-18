import { describe, it, expect } from 'vitest'
import { getDeckModeParkingExemptWorktreeIds } from './deck-mode-parking-exemption'

describe('getDeckModeParkingExemptWorktreeIds', () => {
  const worktrees = [{ id: 'wtA' }, { id: 'wtB' }, { id: 'wtC' }]

  it('exempts every worktree when any of them has deck mode active', () => {
    const exempt = getDeckModeParkingExemptWorktreeIds({
      deckModeActiveWorktreeIds: ['wtA'],
      worktrees
    })
    expect(exempt).toEqual(new Set(['wtA', 'wtB', 'wtC']))
  })

  it('returns empty when no worktree has deck mode active', () => {
    const exempt = getDeckModeParkingExemptWorktreeIds({
      deckModeActiveWorktreeIds: [],
      worktrees
    })
    expect(exempt).toEqual(new Set())
  })
})
