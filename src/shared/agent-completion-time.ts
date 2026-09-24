import type { AgentStateHistoryEntry, AgentStatusEntry } from './agent-status-types'

/** The subset of a hook entry a completion time is derived from. */
export type AgentCompletionSource = Pick<
  AgentStatusEntry,
  'state' | 'stateStartedAt' | 'stateHistory' | 'interrupted' | 'sessionBoundary'
>

function mostRecentCompletedTurnInHistory(
  history: readonly AgentStateHistoryEntry[] | undefined
): number | null {
  let max = 0
  for (const row of history ?? []) {
    if (
      row.state === 'done' &&
      row.interrupted !== true &&
      Number.isFinite(row.startedAt) &&
      row.startedAt > max
    ) {
      max = row.startedAt
    }
  }
  return max > 0 ? max : null
}

/**
 * When the entry's agent last actually COMPLETED a turn, or null when nothing qualifies.
 * One clock for both the displayed completion age and Smart Sort's Done eligibility, so a row
 * can't rank as freshly done while showing an age past the staleness threshold.
 *
 * A completion is only:
 *   - a non-interrupted `done` (its `stateStartedAt` — unmoved by same-state tool/prompt pings); or
 *   - for a session-boundary `done` (connected idle, not a turn), the real completion it displaced.
 */
export function agentEntryCompletionAt(entry: AgentCompletionSource): number | null {
  if (entry.state !== 'done' || entry.interrupted === true) {
    return null
  }
  if (entry.sessionBoundary === true) {
    return mostRecentCompletedTurnInHistory(entry.stateHistory)
  }
  return Number.isFinite(entry.stateStartedAt) ? entry.stateStartedAt : null
}

/**
 * A session-boundary `done` (a Claude/OpenCode SessionStart, a created-but-unprompted structured
 * chat, a Grok shutdown) that did not displace a real completion: a connected, ready agent, not a
 * finished turn. Every completion surface reads it as idle — not unread, not bold, no done dot.
 * A boundary that displaced a real completion (e.g. `/clear` after a finished turn) is not ready:
 * it still carries that completion.
 */
export function isReadySessionBoundary(entry: AgentCompletionSource): boolean {
  return (
    entry.state === 'done' &&
    entry.sessionBoundary === true &&
    agentEntryCompletionAt(entry) === null
  )
}
