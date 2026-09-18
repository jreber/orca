// Why: browser and terminal panes are mounted once at the worktree level and
// positioned over their owning TabGroupPanel body. A stable per-group anchor
// lets those overlays follow split-group layout changes without reparenting
// heavyweight pane DOM.

const ANCHOR_PREFIX = '--orca-tab-group-body-'
const PANE_ANCHOR_PREFIX = '--orca-tab-pane-'

/** Why: the measured (non-CSS-anchor) fallback locates the anchor provider via this dataset. */
export const TAB_PANE_ANCHOR_DATASET = 'data-tab-pane-anchor-id'

/**
 * Returns the CSS anchor name for a given tab-group id. Anchor names must be
 * `<dashed-ident>`; remote/runtime groups can include path-like ids, so encode
 * the full id into hex code points before appending it to the custom prefix.
 */
export function tabGroupBodyAnchorName(groupId: string): string {
  const encoded = Array.from(groupId, (char) => char.codePointAt(0)?.toString(16) ?? '').join('-')
  return `${ANCHOR_PREFIX}${encoded || 'empty'}`
}

/** Per-tab anchor name — deck cards claim these so each tab's retained overlay paints into its own card. */
export function tabPaneAnchorName(tabId: string): string {
  const encoded = Array.from(tabId, (char) => char.codePointAt(0)?.toString(16) ?? '').join('-')
  return `${PANE_ANCHOR_PREFIX}${encoded || 'empty'}`
}

/**
 * The overlay id a tab's retained surface is keyed by: terminals and browsers
 * key overlays by entityId, agent sessions and simulators by the unified id.
 */
export function tabPaneOverlayId(tab: {
  id: string
  entityId: string
  contentType: string
}): string {
  return tab.contentType === 'terminal' || tab.contentType === 'browser' ? tab.entityId : tab.id
}

/** Why: these tabs keep a worktree-level retained surface positioned via a per-tab anchor; editor-like tabs render inline instead. */
export function isOverlayHostedTab(tab: { contentType: string }): boolean {
  return (
    tab.contentType === 'terminal' ||
    tab.contentType === 'browser' ||
    tab.contentType === 'simulator' ||
    tab.contentType === 'agent-session'
  )
}

/**
 * Whether a deck rail card may claim this tab's per-tab anchor and host its
 * real retained surface. Terminals may not: xterm fits itself to whatever box
 * it is painted into and forwards that grid to the PTY, so a card-sized
 * terminal reflows the live session to card dimensions — which rewraps an
 * agent TUI's frame in the main stage too. Terminal cards show a read-only
 * mirror at the session's own grid instead.
 */
export function isDeckCardHostedTab(tab: { contentType: string }): boolean {
  return isOverlayHostedTab(tab) && tab.contentType !== 'terminal'
}
