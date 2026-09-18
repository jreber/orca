import {
  TAB_GROUP_DECK_MIN_WIDTH,
  clampTabGroupDeckWidth,
  computeMaxTabGroupDeckWidth
} from '../../../../shared/tab-group-deck-width'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useWindowWidth } from '../right-sidebar/use-window-width'
import { useAppStore } from '../../store'
import { activateGroupTab } from './tab-group-tab-activation'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { tabPaneAnchorName } from './tab-group-body-anchor'
import { useTabGroupDeckWidth } from './use-tab-group-deck-width'
import { useTabGroupWorkspaceModel } from './useTabGroupWorkspaceModel'
import TabGroupDeckCard from './TabGroupDeckCard'
import { translate } from '@/i18n/i18n'

/**
 * Why: deck mode splits the group's body into a main stage (the active tab's
 * real surface, at full size) and a resizable rail docked to the right edge
 * (default 1/3 of the window) listing every one of the group's tabs as a
 * card, one per tab, so the rail's count never surprises the count of open
 * tabs. A terminal card shows a read-only mirror of its live session (scaled,
 * never resizing the real PTY); other background cards host their own real
 * retained surface via a per-tab anchor. Rail cards come from the project-
 * wide pooled `deckTabs` (already ordered: project-worktree-order then
 * tab-strip-order), independent of which one is active. The rail is a flex sibling of the stage (not
 * absolutely positioned) so a live drag resizes both in lockstep with no
 * extra JS: the stage is flex-1 and the rail's width is set imperatively by
 * useSidebarResize on every drag frame.
 */
export default function TabGroupDeckLayout({
  groupId,
  worktreeId,
  activeOverlayTabId,
  stageContent
}: {
  groupId: string
  worktreeId: string
  /** Per-tab anchor id the stage claims for the active tab's real surface, or null when the active tab has no retained overlay (e.g. an editor). */
  activeOverlayTabId: string | null
  /** Inline content for an active tab with no retained overlay (e.g. the editor panel). */
  stageContent: React.ReactNode
}): React.JSX.Element {
  const model = useTabGroupWorkspaceModel({ groupId, worktreeId })
  const activeTabId = model.activeTab?.id ?? null
  const setStoredWidth = useAppStore((s) => s.setTabGroupDeckWidth)
  const windowWidth = useWindowWidth()
  const width = useTabGroupDeckWidth()
  const maxWidth = computeMaxTabGroupDeckWidth(windowWidth)
  const { containerRef, onResizeStart } = useSidebarResize<HTMLDivElement>({
    isOpen: true,
    width,
    minWidth: TAB_GROUP_DECK_MIN_WIDTH,
    maxWidth,
    // Why: docked to the right edge — dragging the left-edge handle leftward
    // (negative clientX delta) must grow the panel, so flip the sign.
    deltaSign: -1,
    setWidth: (next) => setStoredWidth(clampTabGroupDeckWidth(next, windowWidth))
  })

  const handleCardActivate = async (tab: (typeof model.deckTabs)[number]): Promise<void> => {
    if (tab.worktreeId !== useAppStore.getState().activeWorktreeId) {
      // Why: cards pool every worktree — activating a foreign-worktree card
      // must not silently close the deck the user is looking at.
      useAppStore.getState().setPaneCardDeck(tab.worktreeId, true)
      await activateWorktreeFromSidebar(tab.worktreeId)
    }
    // Why: a pooled card from a foreign worktree (or a sibling group)
    // belongs to its own group, not this deck's `groupId` — passing this
    // deck's groupId would corrupt that worktree's activeGroupIdByWorktree
    // with an id it doesn't own.
    activateGroupTab(tab.worktreeId, tab.groupId ?? groupId, tab)
  }

  return (
    <div className="absolute inset-0 flex min-w-0">
      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        data-tab-group-deck-stage=""
        data-tab-pane-anchor-id={activeOverlayTabId ?? undefined}
        style={
          activeOverlayTabId
            ? ({ anchorName: tabPaneAnchorName(activeOverlayTabId) } as React.CSSProperties)
            : undefined
        }
      >
        {stageContent}
      </div>
      <div
        ref={containerRef}
        className="relative flex max-w-full flex-col gap-2 overflow-y-auto border-l border-border bg-background p-2 scrollbar-sleek"
        data-tab-group-deck-mosaic=""
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={translate(
            'auto.components.tab.group.TabGroupDeckLayout.resizeHandle',
            'Resize card deck'
          )}
          title={translate(
            'auto.components.tab.group.TabGroupDeckLayout.resizeHandle',
            'Resize card deck'
          )}
          className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-ring/20 active:bg-ring/30"
          onMouseDown={onResizeStart}
        />
        {model.deckTabs.map((tab) => (
          <TabGroupDeckCard
            key={tab.id}
            worktreeId={tab.worktreeId}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => handleCardActivate(tab)}
          />
        ))}
      </div>
    </div>
  )
}
