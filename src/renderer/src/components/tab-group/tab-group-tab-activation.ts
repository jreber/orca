import type { Tab } from '../../../../shared/tab-types'
import { useAppStore } from '../../store'
import { focusTerminalTabSurface } from '../../lib/focus-terminal-tab-surface'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import {
  activateWebRuntimeSessionTab,
  isWebRuntimeSessionActive
} from '../../runtime/web-runtime-session'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import { browserWorkspaceHasRemoteOwner } from '@/runtime/remote-browser-tab-ownership'
import { captureDeckCardFlipRects } from './deck-card-flip-transition'
import { isDeckCardHostedTab, tabPaneOverlayId } from './tab-group-body-anchor'

/**
 * Why: the two card-hosted tabs whose card/stage geometry is about to swap
 * (the outgoing and incoming active tab) — empty outside deck mode or when the
 * activation is a no-op, so callers pay nothing for the common case. Terminals
 * are excluded: their card shows a mirror, so no overlay travels between the
 * card and the stage to animate.
 */
function deckActivationFlipOverlayIds(
  state: ReturnType<typeof useAppStore.getState>,
  worktreeId: string,
  groupId: string,
  nextTab: Tab
): string[] {
  const isDeckedGroup =
    state.paneCardDeckByWorktree?.[worktreeId] === true &&
    state.activeGroupIdByWorktree[worktreeId] === groupId
  if (!isDeckedGroup) {
    return []
  }
  const previousActiveTabId =
    state.groupsByWorktree[worktreeId]?.find((group) => group.id === groupId)?.activeTabId ?? null
  if (!previousActiveTabId || previousActiveTabId === nextTab.id) {
    return []
  }
  const previousTab = (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
    (tab) => tab.id === previousActiveTabId
  )
  return [previousTab, nextTab]
    .filter((tab): tab is Tab => tab !== undefined && isDeckCardHostedTab(tab))
    .map(tabPaneOverlayId)
}

/**
 * Single activation path for a unified tab inside a group — the deck rail,
 * the tab bar, and the deck rotation chords all land here so side effects
 * (runtime session reattach, surface focus, active-type bookkeeping) cannot
 * drift between entry points.
 */
export function activateGroupTab(worktreeId: string, groupId: string, item: Tab): void {
  const state = useAppStore.getState()
  const flipOverlayIds = deckActivationFlipOverlayIds(state, worktreeId, groupId, item)
  const playFlip =
    flipOverlayIds.length > 0 ? captureDeckCardFlipRects(flipOverlayIds) : (): void => {}
  state.focusGroup(worktreeId, groupId)
  state.activateTab(item.id)
  playFlip()
  if (item.contentType === 'agent-session') {
    activateStructuredAgentSessionTab({ worktreeId, tabId: item.id })
    return
  }
  if (item.contentType === 'terminal') {
    const terminalId = item.entityId
    const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(
      useAppStore.getState(),
      worktreeId
    )
    if (isWebRuntimeSessionActive(runtimeEnvironmentId)) {
      void activateWebRuntimeSessionTab({
        worktreeId,
        tabId: terminalId,
        environmentId: runtimeEnvironmentId
      })
    }
    state.setActiveTab(terminalId)
    state.setActiveTabType('terminal')
    // Why: restore xterm focus to the store-active leaf so keyboard input can't drift to a sibling pane.
    const activeLeafId = state.terminalLayoutsByTabId?.[terminalId]?.activeLeafId ?? null
    focusTerminalTabSurface(terminalId, activeLeafId)
    return
  }
  if (item.contentType === 'browser') {
    const browserTabId = item.entityId
    const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(
      useAppStore.getState(),
      worktreeId
    )
    if (
      isWebRuntimeSessionActive(runtimeEnvironmentId) &&
      browserWorkspaceHasRemoteOwner(useAppStore.getState(), browserTabId, runtimeEnvironmentId)
    ) {
      void activateWebRuntimeSessionTab({
        worktreeId,
        tabId: item.id,
        environmentId: runtimeEnvironmentId
      })
    }
    state.setActiveBrowserTab(browserTabId)
    state.setActiveTabType('browser')
    return
  }
  if (item.contentType === 'simulator') {
    state.setActiveTabType('simulator')
    // simulator has no editor file entity
    return
  }
  state.setActiveFile(item.entityId)
  state.setActiveTabType('editor')
}
