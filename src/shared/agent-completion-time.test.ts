import { describe, expect, it } from 'vitest'
import {
  agentEntryCompletionAt,
  isReadySessionBoundary,
  type AgentCompletionSource
} from './agent-completion-time'

function entry(overrides: Partial<AgentCompletionSource>): AgentCompletionSource {
  return { state: 'done', stateStartedAt: 5_000, stateHistory: [], ...overrides }
}

describe('isReadySessionBoundary', () => {
  it('is true for a created-but-unprompted structured chat row', () => {
    // structuredAgentSessionStatusRow(null): done + sessionBoundary, no turn ever ran.
    expect(isReadySessionBoundary(entry({ sessionBoundary: true }))).toBe(true)
  })

  it('is true for a fresh Claude TUI SessionStart', () => {
    // SessionStart(startup) lands as a boundary done; the row may carry earlier non-done history.
    const row = entry({
      sessionBoundary: true,
      stateHistory: [{ state: 'working', prompt: '', startedAt: 1_000 }]
    })
    expect(isReadySessionBoundary(row)).toBe(true)
  })

  it('is true for a Grok shutdown boundary with no earlier real done', () => {
    // Grok killed mid-first-turn: working -> session_end boundary, nothing ever completed.
    const row = entry({
      sessionBoundary: true,
      stateHistory: [{ state: 'working', prompt: 'build it', startedAt: 1_000 }]
    })
    expect(isReadySessionBoundary(row)).toBe(true)
    expect(agentEntryCompletionAt(row)).toBeNull()
  })

  it('is false for /clear landing on a real done (the completion moved to history)', () => {
    const row = entry({
      sessionBoundary: true,
      stateHistory: [
        { state: 'working', prompt: 'fix bug', startedAt: 1_000 },
        { state: 'done', prompt: 'fix bug', startedAt: 2_000 }
      ]
    })
    expect(isReadySessionBoundary(row)).toBe(false)
    expect(agentEntryCompletionAt(row)).toBe(2_000)
  })

  it('is false for any boundary that displaced a real completion, however old', () => {
    const row = entry({
      sessionBoundary: true,
      stateHistory: [
        { state: 'done', prompt: 'first', startedAt: 1_000 },
        { state: 'working', prompt: 'second', startedAt: 2_000 }
      ]
    })
    expect(isReadySessionBoundary(row)).toBe(false)
  })

  it('still reads as ready when the only earlier done was interrupted', () => {
    const row = entry({
      sessionBoundary: true,
      stateHistory: [{ state: 'done', prompt: 'x', startedAt: 1_000, interrupted: true }]
    })
    expect(isReadySessionBoundary(row)).toBe(true)
  })

  it('is false for a real completion and for non-done states', () => {
    expect(isReadySessionBoundary(entry({}))).toBe(false)
    expect(isReadySessionBoundary(entry({ sessionBoundary: false }))).toBe(false)
    expect(isReadySessionBoundary(entry({ state: 'working', sessionBoundary: true }))).toBe(false)
    expect(isReadySessionBoundary(entry({ state: 'blocked' }))).toBe(false)
  })
})
