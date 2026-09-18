import { toast } from 'sonner'
import { dispatchWorkspaceTabCommand } from '@/lib/workspace-tab-commands'
import type { KeybindingActionId } from '../../../shared/keybindings'
import { keybindingMatchesAction } from '../../../shared/keybindings'
import { matchesRecentTabSwitcherChord } from '../../../shared/window-shortcut-policy'
import { useAppStore } from '../store'
import {
  createFloatingWorkspaceBrowserTab,
  createFloatingWorkspaceMarkdownTab,
  createFloatingWorkspaceTerminalTab,
  handleEmptyFloatingWorkspacePanelCloseShortcut,
  isEventTargetInsideFloatingWorkspacePanel,
  isFloatingWorkspacePanelFocused
} from '@/lib/floating-workspace-terminal-actions'
import { showTerminalShortcutCaptureNotification } from '@/lib/terminal-shortcut-capture-notification'
import {
  ensureClientCreationActionAllowed,
  showClientCreationActionError
} from '@/lib/client-creation-action-error'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { translate } from '@/i18n/i18n'
import { getKeybindingContext } from './terminal-workspace-model'
import { resolveTerminalAgentTabShortcut } from './terminal-agent-tab-shortcut'
import { handleTerminalWorkspaceEditorShortcut } from './terminal-workspace-editor-shortcuts'
import { activateGroupTab } from './tab-group/tab-group-tab-activation'
import { orderTabsByTabStripOrder } from './tab-group/tab-group-tab-strip-order'
import type { TerminalActivationController } from './use-terminal-activation-actions'

export function handleTerminalWorkspaceKeyDown(
  event: KeyboardEvent,
  controller: TerminalActivationController,
  shortcutPlatform: NodeJS.Platform
): void {
  const {
    activeWorktreeId,
    handleCloseAllFiles,
    handleNewAgentTab,
    handleNewBrowserTab,
    handleNewFile,
    handleNewSimulatorTab,
    handleNewTab,
    keybindings,
    mobileEmulatorEnabled,
    terminalShortcutPolicy
  } = controller
  if (!activeWorktreeId) {
    return
  }
  const context = getKeybindingContext(event.target)
  const floatingWorkspaceFocused = isFloatingWorkspacePanelFocused()
  const matchShortcut = (actionId: KeybindingActionId): boolean =>
    keybindingMatchesAction(actionId, event, shortcutPlatform, keybindings, {
      context,
      terminalShortcutPolicy
    })
  const notifyTerminalCapture = (actionId: KeybindingActionId): void => {
    if (context !== 'terminal' || terminalShortcutPolicy !== 'orca-first') {
      return
    }
    showTerminalShortcutCaptureNotification({
      actionId,
      platform: shortcutPlatform,
      keybindings
    })
  }
  if (!event.repeat && matchShortcut('tab.newTerminal')) {
    event.preventDefault()
    notifyTerminalCapture('tab.newTerminal')
    if (floatingWorkspaceFocused) {
      void createFloatingWorkspaceTerminalTab(useAppStore.getState())
      return
    }
    handleNewTab()
    return
  }

  if (!event.repeat) {
    const agentShortcut = resolveTerminalAgentTabShortcut({
      activeWorktreeId,
      keybindings,
      matchShortcut
    })
    if (agentShortcut.actionId) {
      event.preventDefault()
      notifyTerminalCapture(agentShortcut.actionId)
      if (agentShortcut.agent) {
        handleNewAgentTab(agentShortcut.agent)
      } else {
        toast.message(
          translate(
            'auto.components.Terminal.5b2c1a9e44',
            'No agent CLI detected — install one or pick a default agent in Settings.'
          )
        )
      }
      return
    }
  }

  if (!event.repeat && matchShortcut('tab.reopenClosed')) {
    event.preventDefault()
    notifyTerminalCapture('tab.reopenClosed')
    try {
      useAppStore.getState().reopenClosedTab(activeWorktreeId)
    } catch (error) {
      showClientCreationActionError(error)
    }
    return
  }
  if (!event.repeat && matchShortcut('tab.newBrowser')) {
    event.preventDefault()
    notifyTerminalCapture('tab.newBrowser')
    const browserWorkspaceId = floatingWorkspaceFocused
      ? FLOATING_TERMINAL_WORKTREE_ID
      : activeWorktreeId
    if (!ensureClientCreationActionAllowed(browserWorkspaceId, 'managed-browser')) {
      return
    }
    if (floatingWorkspaceFocused) {
      void createFloatingWorkspaceBrowserTab(useAppStore.getState()).catch(
        showClientCreationActionError
      )
      return
    }
    handleNewBrowserTab()
    return
  }
  if (!event.repeat && mobileEmulatorEnabled && matchShortcut('tab.newSimulator')) {
    event.preventDefault()
    notifyTerminalCapture('tab.newSimulator')
    if (!ensureClientCreationActionAllowed(activeWorktreeId, 'mobile-emulator')) {
      return
    }
    if (!floatingWorkspaceFocused) {
      handleNewSimulatorTab()
    }
    return
  }
  if (
    handleTerminalWorkspaceEditorShortcut({
      event,
      floatingWorkspaceFocused,
      matchShortcut,
      notifyTerminalCapture
    })
  ) {
    return
  }
  if (!event.repeat && matchShortcut('tab.newMarkdown')) {
    event.preventDefault()
    notifyTerminalCapture('tab.newMarkdown')
    if (floatingWorkspaceFocused) {
      void createFloatingWorkspaceMarkdownTab(useAppStore.getState()).catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : translate(
                'auto.components.Terminal.f0600556b3',
                'Failed to create untitled markdown file.'
              )
        )
      })
      return
    }
    void handleNewFile()
    return
  }
  if (handleEmptyFloatingWorkspacePanelCloseShortcut(event, shortcutPlatform, keybindings)) {
    return
  }
  if (!event.repeat && matchShortcut('tab.close')) {
    const floatingPanelOwnsEvent =
      isEventTargetInsideFloatingWorkspacePanel(event.target) || floatingWorkspaceFocused
    if (floatingPanelOwnsEvent) {
      return
    }
    if (dispatchWorkspaceTabCommand({ type: 'close', context })) {
      event.preventDefault()
      notifyTerminalCapture('tab.close')
    }
    return
  }
  if (!event.repeat && matchShortcut('tab.closeAll')) {
    event.preventDefault()
    notifyTerminalCapture('tab.closeAll')
    handleCloseAllFiles()
    return
  }
  if (
    matchesRecentTabSwitcherChord(event, shortcutPlatform, keybindings, {
      context,
      terminalShortcutPolicy
    })
  ) {
    return
  }
  if (!event.repeat && matchShortcut('tab.previousRecent')) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    dispatchWorkspaceTabCommand({ type: 'previous-recent' })
    return
  }
  const switchSameTypeDirection = matchShortcut('tab.nextSameType')
    ? 1
    : matchShortcut('tab.previousSameType')
      ? -1
      : null
  const switchAllTypesDirection = matchShortcut('tab.nextAllTypes')
    ? 1
    : matchShortcut('tab.previousAllTypes')
      ? -1
      : null
  if (!event.repeat && (switchSameTypeDirection !== null || switchAllTypesDirection !== null)) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    notifyTerminalCapture(
      switchAllTypesDirection !== null
        ? switchAllTypesDirection === 1
          ? 'tab.nextAllTypes'
          : 'tab.previousAllTypes'
        : switchSameTypeDirection === 1
          ? 'tab.nextSameType'
          : 'tab.previousSameType'
    )
    dispatchWorkspaceTabCommand({
      type: 'switch',
      direction: switchAllTypesDirection ?? switchSameTypeDirection ?? 1,
      scope: switchAllTypesDirection !== null ? 'all-types' : 'same-type'
    })
  }
  const terminalTabDirection = matchShortcut('tab.nextTerminal')
    ? 1
    : matchShortcut('tab.previousTerminal')
      ? -1
      : null
  if (!event.repeat && terminalTabDirection !== null) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    dispatchWorkspaceTabCommand({
      type: 'switch',
      direction: terminalTabDirection,
      scope: 'terminal'
    })
  }
  if (!event.repeat && matchShortcut('pane.toggleDeck')) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    notifyTerminalCapture('pane.toggleDeck')
    useAppStore.getState().togglePaneCardDeck(activeWorktreeId)
    return
  }
  const paneFocusDirection = matchShortcut('pane.focusNext')
    ? 1
    : matchShortcut('pane.focusPrevious')
      ? -1
      : null
  if (!event.repeat && paneFocusDirection !== null) {
    const state = useAppStore.getState()
    // Why: keep the chords inert outside deck mode so they can't shadow
    // unrelated chords until the toggle is on.
    if (state.paneCardDeckByWorktree[activeWorktreeId] !== true) {
      return
    }
    const groupId = state.activeGroupIdByWorktree[activeWorktreeId] ?? ''
    const group = (state.groupsByWorktree[activeWorktreeId] ?? []).find(
      (candidate) => candidate.id === groupId
    )
    // Why: sort to the group's visual tab-strip order (same as the deck
    // rail), not unifiedTabs insertion order — otherwise a drag-reorder
    // makes rotation feel backwards relative to what's on screen.
    const groupTabs = orderTabsByTabStripOrder(
      (state.unifiedTabsByWorktree[activeWorktreeId] ?? []).filter(
        (tab) => tab.groupId === groupId
      ),
      group?.tabOrder
    )
    // Why: a lone tab has nothing to rotate — the rail shows its single card.
    if (!groupId || groupTabs.length < 2) {
      return
    }
    const activeTabId = group?.activeTabId ?? ''
    const currentIndex = groupTabs.findIndex((tab) => tab.id === activeTabId)
    const nextTab =
      currentIndex === -1
        ? paneFocusDirection === 1
          ? groupTabs[0]
          : (groupTabs.at(-1) ?? groupTabs[0])
        : groupTabs[(currentIndex + paneFocusDirection + groupTabs.length) % groupTabs.length]
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    notifyTerminalCapture(paneFocusDirection === 1 ? 'pane.focusNext' : 'pane.focusPrevious')
    activateGroupTab(activeWorktreeId, groupId, nextTab)
  }
}
