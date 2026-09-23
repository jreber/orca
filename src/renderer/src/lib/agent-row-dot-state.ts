import type { AgentDotState } from '@/components/AgentStateDot'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import {
  isReadySessionBoundary,
  type AgentCompletionSource
} from '../../../shared/agent-completion-time'
import type { AgentRowState } from './agent-row-decay-state'

/**
 * Map an agent row's state onto the shared state-indicator vocabulary. One copy so the
 * sidebar card, the dashboard row and the notes send menu cannot drift on a new member.
 */
export function agentRowDotState(
  state: AgentRowState,
  entry?: Pick<AgentStatusEntry, 'workingMode'> & AgentCompletionSource
): AgentDotState {
  switch (state) {
    case 'working':
      return entry?.workingMode === 'monitoring' ? 'monitoring' : 'working'
    case 'done':
      // Why: a ready session boundary is a connected agent, not a finished turn — no done dot.
      return entry && isReadySessionBoundary(entry) ? 'idle' : 'done'
    case 'blocked':
    case 'waiting':
    case 'idle':
    case 'unverifiable':
      return state
  }
  return 'idle'
}
