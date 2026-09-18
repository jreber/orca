import {
  FileText,
  GitCompare,
  Globe,
  MessageSquare,
  Smartphone,
  TerminalSquare
} from 'lucide-react'
import type { Tab } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { useAppStore } from '../../store'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import {
  resolveTerminalTabActivityStatus,
  resolveTerminalTabAttentionBadge,
  terminalTabActivityToAgentDotState,
  terminalTabHasUnreadActivity,
  type TerminalTabAttentionBadge
} from '../tab-bar/terminal-tab-activity-status'
import { AgentStateDot } from '@/components/AgentStateDot'
import { FilledBellIcon } from '../sidebar/WorktreeCardHelpers'
import { cn } from '@/lib/utils'
import { isDeckCardHostedTab, tabPaneAnchorName, tabPaneOverlayId } from './tab-group-body-anchor'
import { resolvePrimaryLayoutPtyId } from '../../store/terminals/terminal-pty-identities'
import { AgentTerminalPreview } from '../dashboard-popout/AgentTerminalPreview'

const EMPTY_TERMINAL_TABS: readonly TerminalTab[] = []

// Why: fitting a full 200-col session into a ~600px card leaves text too small
// to read. Holding the mirror at 80% trades the right-hand columns (empty
// margin first, in an agent TUI) for legible text.
const MIRROR_MIN_FIT_SCALE = 0.8

function TabContentTypeGlyph({
  contentType,
  className = 'size-4 shrink-0'
}: {
  contentType: Tab['contentType']
  className?: string
}): React.JSX.Element {
  if (contentType === 'terminal') {
    return <TerminalSquare className={className} aria-hidden="true" />
  }
  if (contentType === 'browser') {
    return <Globe className={className} aria-hidden="true" />
  }
  if (contentType === 'simulator') {
    return <Smartphone className={className} aria-hidden="true" />
  }
  if (contentType === 'agent-session') {
    return <MessageSquare className={className} aria-hidden="true" />
  }
  if (contentType === 'editor' || contentType === 'diff' || contentType === 'check-details') {
    return <FileText className={className} aria-hidden="true" />
  }
  return <GitCompare className={className} aria-hidden="true" />
}

/** Prominent attention glyph — same sources as the tab strip. */
function AttentionGlyph({
  badge
}: {
  badge: TerminalTabAttentionBadge | null
}): React.JSX.Element | null {
  if (badge === 'unread') {
    return <FilledBellIcon className="size-4 text-amber-500" aria-label="Unread activity" />
  }
  const dotState =
    badge === 'working' ||
    badge === 'monitoring' ||
    badge === 'permission' ||
    badge === 'done' ||
    badge === 'interrupted'
      ? terminalTabActivityToAgentDotState(badge)
      : null
  if (!dotState) {
    return null
  }
  return <AgentStateDot state={dotState} size="md" />
}

// Why: one card per tab, so the rail's card count always matches the group's
// tab count. A card's body comes from one of three sources:
//   - terminals: a read-only mirror of the live session (AgentTerminalPreview,
//     streamed from main's per-PTY emulator), for the active tab as well as
//     background ones. It keeps the session's own grid and scales the frame
//     into the card, so the card never resizes the real PTY.
//   - background browser/simulator/agent chat: their REAL retained surface,
//     painted into the card body through a per-tab anchor. Those surfaces
//     reflow harmlessly, and the active one is claimed by the main stage.
//   - everything else (editors/diffs, a terminal with no pty yet): a labeled
//     placeholder, since that surface only exists inside the pane body.
export default function TabGroupDeckCard({
  worktreeId,
  tab,
  isActive = false,
  onActivate
}: {
  worktreeId: string
  tab: Tab
  isActive?: boolean
  onActivate: (tab: Tab) => void
}): React.JSX.Element {
  const terminalTabs = useAppStore(
    (state) => state.tabsByWorktree[worktreeId] ?? EMPTY_TERMINAL_TABS
  )
  const generatedTabTitlesEnabled = useAppStore(
    (state) => state.settings?.tabAutoGenerateTitle === true
  )
  const terminalTab = terminalTabs.find((candidate) => candidate.id === tab.entityId)
  const isTerminal = tab.contentType === 'terminal'
  // Why: mirror the tab strip's unread/state sources so a card flags the same
  // activity its tab would.
  const hasUnread = useAppStore((state) =>
    isTerminal
      ? terminalTabHasUnreadActivity({
          terminalTabId: tab.entityId,
          unreadTerminalTabs: state.unreadTerminalTabs,
          unreadAgentCompletionPanes: state.unreadAgentCompletionPanes
        })
      : false
  )
  const attentionBadge = useAppStore((state) => {
    if (!isTerminal) {
      return null
    }
    const terminalTab = state.tabsByWorktree[worktreeId]?.find(
      (candidate) => candidate.id === tab.entityId
    )
    if (!terminalTab) {
      return null
    }
    return resolveTerminalTabAttentionBadge({
      status: resolveTerminalTabActivityStatus({
        tab: terminalTab,
        agentStatusByPaneKey: state.agentStatusByPaneKey,
        agentStatusEpoch: state.agentStatusEpoch,
        runtimePaneTitlesByTabId: state.runtimePaneTitlesByTabId,
        ptyIdsByTabId: state.ptyIdsByTabId,
        terminalLayout: state.terminalLayoutsByTabId?.[terminalTab.id]
      }),
      hasUnread
    })
  })

  const label = resolveUnifiedTabLabel(
    {
      ...tab,
      quickCommandLabel: tab.quickCommandLabel ?? terminalTab?.quickCommandLabel,
      generatedLabel: tab.generatedLabel ?? terminalTab?.generatedTitle
    },
    generatedTabTitlesEnabled,
    tab.label
  )

  // Why: only a BACKGROUND card-hosted tab claims the per-tab anchor here —
  // the active tab's real surface is already claimed by the main stage.
  const overlayTabId = isDeckCardHostedTab(tab) && !isActive ? tabPaneOverlayId(tab) : undefined
  // Why: the mirror streams from the pty, not from this tab's renderer pane, so
  // it keeps working while the pane is parked or staged elsewhere.
  const mirrorPtyId = useAppStore((state) => {
    if (!isTerminal) {
      return null
    }
    const layout = state.terminalLayoutsByTabId?.[tab.entityId]
    return (
      (layout ? resolvePrimaryLayoutPtyId(layout) : null) ??
      state.ptyIdsByTabId[tab.entityId]?.[0] ??
      null
    )
  })

  // Why: the empty anchor body is the mount point — the tab's retained overlay
  // (worktree-level) positions itself over this exact element.
  const body = overlayTabId ? (
    <div
      className="relative min-h-0 flex-1 overflow-hidden bg-background"
      data-tab-group-deck-card-body=""
      data-tab-pane-anchor-id={overlayTabId}
      style={{ anchorName: tabPaneAnchorName(overlayTabId) } as React.CSSProperties}
    />
  ) : mirrorPtyId ? (
    // Why pointer-events-none: the card is a preview, and a pointer press on it
    // activates the tab (below) instead of typing into a miniature.
    <div
      className="pointer-events-none relative min-h-0 flex-1 overflow-hidden"
      data-tab-group-deck-card-mirror-pty-id={mirrorPtyId}
    >
      <AgentTerminalPreview
        ptyId={mirrorPtyId}
        claimGrid={false}
        minFitScale={MIRROR_MIN_FIT_SCALE}
        className="h-full p-0"
      />
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background px-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </div>
  )

  return (
    <div
      className={cn(
        // Why: border-border/50 matches the Card primitive and every other bordered card surface in the app — full-opacity border-border reads as too heavy at this size.
        // Why min-h-0 + shrink (no floor): cards divide the rail's exact height
        // evenly regardless of tab count, so the rail never needs to scroll —
        // more open tabs means shorter cards, not a longer list.
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-xs transition-colors',
        // Why: 'permission' (agent blocked/waiting on you) is actionable, so its border wins over the active-card marker when both apply.
        attentionBadge === 'permission'
          ? 'border-2 border-agent-question'
          : // Why: same color/thickness as the tab strip's ACTIVE_TAB_INDICATOR_CLASSES underline, so both "this is selected" cues match.
            isActive && 'border-2 border-[color-mix(in_srgb,var(--foreground)_60%,var(--card))]',
        attentionBadge === 'unread'
          ? 'ring-4 ring-amber-500/80 shadow-[0_0_18px_-4px] shadow-amber-500/50'
          : attentionBadge === 'done'
            ? 'ring-4 ring-emerald-500/80 shadow-[0_0_18px_-4px] shadow-emerald-500/50'
            : attentionBadge === 'interrupted'
              ? 'ring-4 ring-red-500/80 shadow-[0_0_18px_-4px] shadow-red-500/50'
              : null
      )}
      data-tab-group-deck-card-id={tab.id}
      {...(isActive ? { 'data-tab-group-deck-card-active': 'true' } : {})}
      {...(attentionBadge ? { 'data-tab-group-deck-card-state': attentionBadge } : {})}
      onPointerDown={() => onActivate(tab)}
      // Why: a card's own body has nothing to scroll (a static mirror, or a
      // pointer-events-none preview), so an unstopped wheel event bubbles past
      // the card straight into the rail's overflow-y-auto and moves the whole
      // list instead of doing nothing under the cursor.
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        <AttentionGlyph badge={attentionBadge} />
        <TabContentTypeGlyph contentType={tab.contentType} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {label}
        </span>
      </div>
      {body}
    </div>
  )
}
