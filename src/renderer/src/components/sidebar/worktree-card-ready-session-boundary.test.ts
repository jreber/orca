import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import { createTestStore } from '@/store/slices/store-test-helpers'
import { resolveWorktreeStatus } from '@/lib/worktree-status'
import { agentRowDotState } from '@/lib/agent-row-dot-state'
import type { AgentStatusPayload } from '@/store/slices/agent-status-contract'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { selectWorktreeAgentActivitySummary } from './worktree-agent-activity-summary'
import { isAgentRowUnvisited } from './worktree-card-agent-ack-inputs'
import {
  resetTerminalTabActivityFlagsCacheForTest,
  resolveTerminalTabActivityStatus
} from '../tab-bar/terminal-tab-activity-status'

// The sidebar surfaces I-A found reading a ready session boundary as an unvisited Done: the
// inline row's bold and dot, the workspace status dot, and the tab dot. Rows are built by the
// real store reducer from the payloads each producer sends, so /clear's history push is real.

const WORKTREE_ID = 'repo::/wt-1'
const TAB_ID = 'tab-1'
const PANE = makePaneKey(TAB_ID, '11111111-1111-4111-8111-111111111111')
const TAB: TerminalTab = {
  id: TAB_ID,
  ptyId: null,
  worktreeId: WORKTREE_ID,
  title: TAB_ID,
  customTitle: null,
  color: null,
  sortOrder: 0,
  createdAt: 0
}

const WORKING: AgentStatusPayload = { state: 'working', prompt: 'fix bug', agentType: 'claude' }
const REAL_DONE: AgentStatusPayload = {
  state: 'done',
  prompt: 'fix bug',
  agentType: 'claude',
  lastAssistantMessage: 'Done.'
}
// Claude TUI SessionStart (startup/resume/clear) and a created structured chat
// (structuredAgentSessionStatusRow(null) via the status bridge) both land as this row.
const BOUNDARY: AgentStatusPayload = {
  state: 'done',
  prompt: '',
  agentType: 'claude',
  sessionBoundary: true
}

function sidebarView(payloads: AgentStatusPayload[]) {
  const store = createTestStore()
  store.setState({ tabsByWorktree: { [WORKTREE_ID]: [TAB] } } as unknown as Partial<AppState>)
  for (const payload of payloads) {
    vi.advanceTimersByTime(10)
    store.getState().setAgentStatus(PANE, payload)
  }
  const state = store.getState()
  const entry = state.agentStatusByPaneKey[PANE]
  const summary = selectWorktreeAgentActivitySummary(state, WORKTREE_ID)
  return {
    bold: isAgentRowUnvisited({ entry }, 0),
    rowDot: agentRowDotState('done', entry),
    hasLiveDone: summary.hasLiveDone,
    workspaceDot: resolveWorktreeStatus({
      tabs: [TAB],
      browserTabs: [],
      ptyIdsByTabId: {},
      agentStatusPaneIdsByTabId: summary.agentStatusPaneIdsByTabId,
      hasPermission: summary.hasPermission,
      hasLiveWorking: summary.hasLiveWorking,
      hasLiveMonitoring: summary.hasLiveMonitoring,
      hasInterrupted: summary.hasInterrupted,
      hasLiveDone: summary.hasLiveDone,
      hasRetainedDone: summary.hasRetainedDone
    }),
    tabDot: resolveTerminalTabActivityStatus({
      tab: TAB,
      agentStatusByPaneKey: state.agentStatusByPaneKey,
      agentStatusEpoch: state.agentStatusEpoch
    })
  }
}

describe('sidebar reading of a ready session boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    resetTerminalTabActivityFlagsCacheForTest()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a fresh SessionStart / created structured chat as idle: not bold, no done dot', () => {
    const view = sidebarView([BOUNDARY])
    expect(view.bold).toBe(false)
    expect(view.rowDot).toBe('idle')
    expect(view.hasLiveDone).toBe(false)
    expect(view.workspaceDot).not.toBe('done')
    expect(view.tabDot).not.toBe('done')
  })

  it('shows a Grok shutdown boundary with no earlier real done as idle', () => {
    const view = sidebarView([
      { state: 'working', prompt: 'build it', agentType: 'grok' },
      { state: 'done', prompt: '', agentType: 'grok', sessionBoundary: true }
    ])
    expect(view.bold).toBe(false)
    expect(view.rowDot).toBe('idle')
    expect(view.hasLiveDone).toBe(false)
    expect(view.workspaceDot).not.toBe('done')
  })

  it('keeps a real completion displaced by /clear as an unvisited done', () => {
    const view = sidebarView([WORKING, REAL_DONE, BOUNDARY])
    expect(view.bold).toBe(true)
    expect(view.rowDot).toBe('done')
    expect(view.hasLiveDone).toBe(true)
    expect(view.workspaceDot).toBe('done')
    expect(view.tabDot).toBe('done')
  })

  it('keeps a plain real completion an unvisited done', () => {
    const view = sidebarView([WORKING, REAL_DONE])
    expect(view.bold).toBe(true)
    expect(view.rowDot).toBe('done')
    expect(view.hasLiveDone).toBe(true)
    expect(view.workspaceDot).toBe('done')
    expect(view.tabDot).toBe('done')
  })

  it('mutes a real completion once acknowledged, as before', () => {
    const store = createTestStore()
    store.getState().setAgentStatus(PANE, REAL_DONE)
    const entry = store.getState().agentStatusByPaneKey[PANE]
    expect(isAgentRowUnvisited({ entry }, entry.stateStartedAt)).toBe(false)
    expect(isAgentRowUnvisited({ entry }, entry.stateStartedAt - 1)).toBe(true)
  })
})
