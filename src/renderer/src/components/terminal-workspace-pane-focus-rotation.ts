import { useAppStore } from '../store'
import { activateGroupTab } from './tab-group/tab-group-tab-activation'
import { computeGlobalDeckTabs } from './tab-group/tab-group-tab-strip-order'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'

/**
 * Cmd/Ctrl+Shift+PageUp/Down: rotate the active card in a worktree's deck.
 * Rotates over the same pooled, project-ordered list the deck rail shows
 * (every worktree, not just this one), so the chord cycles the same set of
 * cards that's on screen. Returns false (a no-op) outside deck mode or with
 * fewer than two cards to rotate between.
 */
export function rotatePaneFocusDeckCard(activeWorktreeId: string, direction: 1 | -1): boolean {
  const state = useAppStore.getState()
  if (state.paneCardDeckByWorktree[activeWorktreeId] !== true) {
    return false
  }
  const groupId = state.activeGroupIdByWorktree[activeWorktreeId] ?? ''
  const group = (state.groupsByWorktree[activeWorktreeId] ?? []).find(
    (candidate) => candidate.id === groupId
  )
  const groupTabs = computeGlobalDeckTabs(
    activeWorktreeId,
    groupId,
    group?.tabOrder,
    state.worktreesByRepo ?? {},
    state.unifiedTabsByWorktree
  )
  // Why: a lone tab has nothing to rotate — the rail shows its single card.
  if (!groupId || groupTabs.length < 2) {
    return false
  }
  const activeTabId = group?.activeTabId ?? ''
  const currentIndex = groupTabs.findIndex(
    (tab) => tab.id === activeTabId && tab.worktreeId === activeWorktreeId
  )
  const nextTab =
    currentIndex === -1
      ? direction === 1
        ? groupTabs[0]
        : (groupTabs.at(-1) ?? groupTabs[0])
      : groupTabs[(currentIndex + direction + groupTabs.length) % groupTabs.length]
  // Why: a pooled tab from a foreign worktree belongs to that worktree's own
  // group, not this one's — passing this groupId would corrupt that
  // worktree's activeGroupIdByWorktree with an id it doesn't own.
  const nextTabGroupId = nextTab.groupId ?? groupId
  if (nextTab.worktreeId !== activeWorktreeId) {
    useAppStore.getState().setPaneCardDeck(nextTab.worktreeId, true)
    void activateWorktreeFromSidebar(nextTab.worktreeId).then(() => {
      activateGroupTab(nextTab.worktreeId, nextTabGroupId, nextTab)
    })
    return true
  }
  activateGroupTab(activeWorktreeId, nextTabGroupId, nextTab)
  return true
}
