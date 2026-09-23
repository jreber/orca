import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { AppState } from '@/store/types'
import { isReadySessionBoundary } from '../../../../shared/agent-completion-time'

type AcknowledgedAgentTimesState = Pick<AppState, 'acknowledgedAgentsByPaneKey'>

/** Projects only the acknowledgement timestamps rendered by one card. */
export function selectAcknowledgedAgentTimes(
  state: AcknowledgedAgentTimesState,
  agents: readonly Pick<DashboardAgentRow, 'paneKey'>[]
): number[] {
  return agents.map((agent) => state.acknowledgedAgentsByPaneKey[agent.paneKey] ?? 0)
}

/**
 * Whether an inline agent row is bold (unvisited): its state changed after the user last
 * acknowledged it. A ready session boundary is a connected agent, not a turn to read, so it is
 * never unvisited — the dashboard's `unseen` rule (dashboard-row-bucket.ts) too.
 */
export function isAgentRowUnvisited(
  agent: Pick<DashboardAgentRow, 'entry'>,
  acknowledgedAt: number
): boolean {
  return !isReadySessionBoundary(agent.entry) && acknowledgedAt < agent.entry.stateStartedAt
}
