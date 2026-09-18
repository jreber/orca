import { useCallback } from 'react'
import { useAppStore } from '../../store'
import { activateGroupTab } from './tab-group-tab-activation'

/**
 * Pointer/focus handler for retained pane overlays. Outside deck mode this is
 * the plain focus-group behavior; inside the decked group a click on any
 * card's real surface activates that tab (the overlay paints over the card,
 * so the card's own handler never sees the event).
 */
export function focusOrActivateOverlayTab(
  worktreeId: string,
  groupId: string,
  unifiedTabId?: string
): void {
  const state = useAppStore.getState()
  if (
    unifiedTabId &&
    state.paneCardDeckByWorktree?.[worktreeId] === true &&
    state.activeGroupIdByWorktree[worktreeId] === groupId
  ) {
    // Why: overlays key by entityId for terminals/browsers and by unified id
    // for the rest — accept either.
    const tab =
      (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
        (candidate) => candidate.id === unifiedTabId
      ) ??
      (state.unifiedTabsByWorktree[worktreeId] ?? []).find(
        (candidate) =>
          candidate.entityId === unifiedTabId &&
          (candidate.contentType === 'terminal' || candidate.contentType === 'browser')
      )
    if (tab) {
      activateGroupTab(worktreeId, groupId, tab)
      return
    }
  }
  state.focusGroup(worktreeId, groupId)
}

/** Deck mode for a worktree: the flag plus the decked (focused) group id, or null when off. */
export function getDeckedGroupId(
  state: {
    paneCardDeckByWorktree: Record<string, boolean | undefined>
    activeGroupIdByWorktree: Record<string, string | undefined>
  },
  worktreeId: string
): string | null {
  return state.paneCardDeckByWorktree?.[worktreeId] === true
    ? (state.activeGroupIdByWorktree[worktreeId] ?? null)
    : null
}

export type OverlayFocusActivation = (groupId: string | undefined, unifiedTabId?: string) => void

/** Stable per-layer callback wiring focusOrActivateOverlayTab to a worktree. */
export function useOverlayFocusActivation(worktreeId: string): OverlayFocusActivation {
  return useCallback(
    (groupId: string | undefined, unifiedTabId?: string) => {
      if (groupId === undefined) {
        return
      }
      focusOrActivateOverlayTab(worktreeId, groupId, unifiedTabId)
    },
    [worktreeId]
  )
}
