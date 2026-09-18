import { memo, useCallback, useMemo } from 'react'
import { registerBrowserOverlaySlotViewport } from '../host-guest/browser-page-viewport'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../../store'
import type { BrowserTab as BrowserTabState } from '../../../../../shared/browser-workspace-types'
import type { Tab, TabGroup } from '../../../../../shared/tab-types'
import BrowserPane from './browser-workspace-pane'
import { DeferredBrowserContent } from './DeferredBrowserContent'
import type { BrowserChromeShortcutScope } from '../describe-page/browser-page-types'
import { tabGroupBodyAnchorName, tabPaneAnchorName } from '../../tab-group/tab-group-body-anchor'
import {
  getDeckedGroupId,
  useOverlayFocusActivation
} from '../../tab-group/tab-group-overlay-focus'
import { useBrowserGuestPaintRetention } from '../host-guest/browser-guest-paint-retention'
import {
  isClientHostedBrowserRowSelectionLive,
  useClientHostedBrowserRowSelection,
  useClientHostedBrowserRows
} from '@/lib/pane-manager/client-hosted-browser-row-state'
import { ClientHostedBrowserHostRowPane } from '../client-hosted-browser-host-row-pane'
import { useAnyBrowserPageMountAdmission } from '../host-guest/browser-page-mount-admission'

// Why: Electron <webview> destroys its guest on DOM reparent, so BrowserPanes render at worktree level and moving a tab between groups only swaps the overlay's CSS position-anchor.

type BrowserOverlayAssignment = {
  groupId: string
  isActiveInGroup: boolean
}

const EMPTY_BROWSER_TABS: readonly BrowserTabState[] = []
const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []

type BrowserOverlaySlotProps = {
  browserTab: BrowserTabState
  isWorktreeActive: boolean
  // Why: undefined = orphan tab (in browserTabs but not referenced by any group's unified-tab list); the fallback branch keeps these hidden.
  groupId: string | undefined
  isActive: boolean
  // Why: deck mode paints every decked browser tab into its own card, not just the group's active tab.
  isDecked: boolean
  chromeShortcutScope: BrowserChromeShortcutScope
  // Why: overlay is a sibling of the group layout, so pane focus doesn't bubble to TabGroupPanel; re-sync it here or split-view clicks leave activeGroupIdByWorktree stale.
  onFocusOwningTab: ((groupId: string | undefined, overlayTabId?: string) => void) | undefined
}

// Why: memoize each slot so unrelated worktree mutations don't cascade a re-render into every BrowserPane subtree.
const BrowserOverlaySlot = memo(function BrowserOverlaySlot({
  browserTab,
  isWorktreeActive,
  groupId,
  isActive,
  isDecked,
  chromeShortcutScope,
  onFocusOwningTab
}: BrowserOverlaySlotProps): React.JSX.Element {
  // Why: persistent page viewports (webview guests) live under this root so they survive BrowserPane chrome unmounts without reparenting.
  const setSlotViewportRef = useCallback(
    (node: HTMLDivElement | null): void => {
      registerBrowserOverlaySlotViewport(browserTab.id, node)
    },
    [browserTab.id]
  )
  // Why: per-tab anchor — the overlay paints over its group body normally, or
  // into the tab's own deck card when the group is decked (same element: the
  // group body claims the tab anchor when not decked, the card when decked).
  const anchorName = groupId !== undefined ? tabPaneAnchorName(browserTab.id) : undefined
  const browserPageIds =
    browserTab.pageIds && browserTab.pageIds.length > 0
      ? browserTab.pageIds
      : [browserTab.activePageId ?? browserTab.id]
  const needsGuestPaint = useBrowserGuestPaintRetention(browserPageIds)
  const isMountAdmitted = useAnyBrowserPageMountAdmission(browserPageIds)
  const isPaintable = isActive || isDecked || needsGuestPaint || isMountAdmitted
  // Why: CSS anchor positioning pins the overlay to the tab's anchor provider — a tab move only swaps anchor claims, no measurement/state.
  // Orphan branch (no anchorName) stays display:none until the tab is reassigned or destroyed.
  const style: React.CSSProperties = useMemo(
    () =>
      anchorName
        ? {
            position: 'absolute',
            positionAnchor: anchorName,
            top: `anchor(${anchorName} top)`,
            left: `anchor(${anchorName} left)`,
            width: `anchor-size(${anchorName} width)`,
            height: `anchor-size(${anchorName} height)`,
            display: isPaintable ? 'flex' : 'none',
            pointerEvents: isActive || isDecked ? 'auto' : 'none',
            opacity: isActive || isDecked ? 1 : 0
          }
        : {
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            display: 'none',
            pointerEvents: 'none'
          },
    [anchorName, isActive, isDecked, isPaintable]
  )
  const handleFocus = useCallback(() => {
    if (groupId !== undefined && onFocusOwningTab) {
      onFocusOwningTab(groupId, browserTab.id)
    }
  }, [browserTab.id, groupId, onFocusOwningTab])

  return (
    <div
      style={style}
      // Why: every other per-tab anchor overlay (terminal, agent-session,
      // simulator) clips itself to its anchor-sized box — this one didn't,
      // so a background browser tab's real content could paint past its
      // small deck card onto whatever's underneath.
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      data-browser-overlay-tab-id={browserTab.id}
      onPointerDown={handleFocus}
      onFocusCapture={handleFocus}
    >
      <div ref={setSlotViewportRef} className="absolute inset-0 flex min-h-0 flex-col" />
      <DeferredBrowserContent mountEligible={isPaintable} retainMounted={isWorktreeActive}>
        <BrowserPane
          browserTab={browserTab}
          isWorktreeActive={isWorktreeActive}
          isActive={isActive}
          chromeShortcutScope={chromeShortcutScope}
        />
      </DeferredBrowserContent>
    </div>
  )
})

// Why: memoize so parent re-renders on props this layer doesn't consume don't rerun its selector or assignments mapping (focused-split state comes from the store selector below, not props).
const BrowserPaneOverlayLayer = memo(function BrowserPaneOverlayLayer({
  worktreeId,
  isWorktreeActive
}: {
  worktreeId: string
  isWorktreeActive: boolean
}): React.JSX.Element {
  const { browserTabs, unifiedTabs, groups, focusedGroupId, deckedGroupId } = useAppStore(
    useShallow((state) => ({
      browserTabs: state.browserTabsByWorktree[worktreeId] ?? EMPTY_BROWSER_TABS,
      unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
      groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
      // Why: the focused split within this worktree; gates the browser Find shortcut so a focused terminal in the same split keeps Cmd/Ctrl+F (#11348).
      focusedGroupId: state.activeGroupIdByWorktree[worktreeId],
      deckedGroupId: getDeckedGroupId(state, worktreeId)
    }))
  )
  // Why: deck cards host each tab's real surface, so a click on a background
  // card's pane must activate that tab, not just focus the group.
  const focusOwningTab = useOverlayFocusActivation(worktreeId)
  const knownFocusedGroupId = useMemo(
    () =>
      focusedGroupId !== undefined && groups.some((group) => group.id === focusedGroupId)
        ? focusedGroupId
        : undefined,
    [focusedGroupId, groups]
  )

  // Why: build this lookup outside the zustand selector — a fresh object inside it would break useShallow equality and re-render on every unrelated mutation.
  const groupActiveTabById = useMemo(() => {
    const lookup: Record<string, string | null | undefined> = {}
    for (const group of groups) {
      lookup[group.id] = group.activeTabId
    }
    return lookup
  }, [groups])

  // Map each browser tab to its owning group; tabs not in any group's unified-tab list are transient mid-move "orphans", not a steady state.
  const assignments = useMemo(() => {
    const entries = new Map<string, BrowserOverlayAssignment>()
    for (const tab of unifiedTabs) {
      if (tab.contentType !== 'browser') {
        continue
      }
      entries.set(tab.entityId, {
        groupId: tab.groupId,
        isActiveInGroup: groupActiveTabById[tab.groupId] === tab.id
      })
    }
    return entries
  }, [groupActiveTabById, unifiedTabs])

  return (
    <>
      {browserTabs.map((browserTab) => {
        const assignment = assignments.get(browserTab.id)
        // Why: deck mode paints every tab of the decked group into its card.
        const isDecked = deckedGroupId !== null && assignment?.groupId === deckedGroupId
        const isActive = Boolean(isWorktreeActive && assignment && assignment.isActiveInGroup)
        const chromeShortcutScope: BrowserChromeShortcutScope = !isActive
          ? 'inactive'
          : knownFocusedGroupId === undefined
            ? 'owned-target'
            : assignment?.groupId === knownFocusedGroupId
              ? 'focused'
              : 'inactive'
        return (
          <BrowserOverlaySlot
            key={browserTab.id}
            browserTab={browserTab}
            isWorktreeActive={isWorktreeActive}
            groupId={assignment?.groupId}
            isActive={isActive}
            isDecked={isDecked}
            chromeShortcutScope={chromeShortcutScope}
            onFocusOwningTab={focusOwningTab}
          />
        )
      })}
      {/* Why: last in DOM order so the placeholder paints over whichever guest the group was
          showing — the group's own active tab is untouched, since a client-hosted row owns no
          unified tab to become active. */}
      <ClientHostedBrowserRowOverlaySlot
        worktreeId={worktreeId}
        groups={groups}
        isWorktreeActive={isWorktreeActive}
        // Why: a decked group's body is the card mosaic — a client-hosted row
        // overlay would cover the cards, so it yields while its group is decked.
        skipGroupId={deckedGroupId}
      />
    </>
  )
})

function ClientHostedBrowserRowOverlaySlot({
  worktreeId,
  groups,
  isWorktreeActive,
  skipGroupId
}: {
  worktreeId: string
  groups: readonly TabGroup[]
  isWorktreeActive: boolean
  skipGroupId?: string | null
}): React.JSX.Element | null {
  const rows = useClientHostedBrowserRows(worktreeId)
  const selection = useClientHostedBrowserRowSelection()
  const liveSelection =
    selection?.worktreeId === worktreeId && isClientHostedBrowserRowSelectionLive(selection, groups)
      ? selection
      : null
  const selectedRow = liveSelection
    ? rows.find((row) => row.browserPageId === liveSelection.browserPageId)
    : undefined
  const anchorName =
    selectedRow && liveSelection ? tabGroupBodyAnchorName(liveSelection.groupId) : undefined
  const style = useMemo<React.CSSProperties | null>(
    () =>
      anchorName
        ? {
            position: 'absolute',
            positionAnchor: anchorName,
            top: `anchor(${anchorName} top)`,
            left: `anchor(${anchorName} left)`,
            width: `anchor-size(${anchorName} width)`,
            height: `anchor-size(${anchorName} height)`
          }
        : null,
    [anchorName]
  )
  if (!selectedRow || !style || !isWorktreeActive || liveSelection?.groupId === skipGroupId) {
    return null
  }
  return (
    <div
      style={style}
      className="flex min-h-0 flex-col"
      data-client-hosted-browser-host-row-pane={selectedRow.browserPageId}
    >
      <ClientHostedBrowserHostRowPane row={selectedRow} />
    </div>
  )
}

export const RetainedBrowserPaneOverlayLayer = memo(function RetainedBrowserPaneOverlayLayer({
  worktreeId,
  isWorktreeActive,
  mountEligible
}: {
  worktreeId: string
  isWorktreeActive: boolean
  mountEligible: boolean
}): React.JSX.Element | null {
  return (
    <DeferredBrowserContent mountEligible={mountEligible}>
      <BrowserPaneOverlayLayer worktreeId={worktreeId} isWorktreeActive={isWorktreeActive} />
    </DeferredBrowserContent>
  )
})

export default BrowserPaneOverlayLayer
