// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleSwitchTabAcrossAllTypes } from '../hooks/ipc-tab-switch'
import { switchFloatingWorkspaceTab } from '@/lib/floating-workspace-terminal-actions'
import { dispatchWorkspaceTabCommand } from '@/lib/workspace-tab-commands'
import type { Tab } from '../../../shared/tab-types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT,
  type EditorRequestCmdSaveDetail
} from './editor/editor-autosave'
import { handleTerminalWorkspaceKeyDown } from './terminal-workspace-keydown'
import type { TerminalActivationController } from './use-terminal-activation-actions'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  closeTerminalTab: vi.fn(),
  closeStructuredAgentSession: vi.fn(async () => 'closed'),
  callRuntimeRpc: vi.fn(async () => ({ ok: true })),
  cancelStructuredAgentLaunch: vi.fn(),
  floatingFocused: false,
  targetInsideFloatingPanel: false
}))

vi.mock('../store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('../hooks/ipc-tab-switch', () => ({
  handleSwitchRecentTab: vi.fn(),
  handleSwitchTab: vi.fn(),
  handleSwitchTabAcrossAllTypes: vi.fn(),
  handleSwitchTerminalTab: vi.fn()
}))
vi.mock('@/lib/floating-workspace-terminal-actions', () => ({
  createFloatingWorkspaceBrowserTab: vi.fn(),
  createFloatingWorkspaceMarkdownTab: vi.fn(),
  createFloatingWorkspaceTerminalTab: vi.fn(),
  handleEmptyFloatingWorkspacePanelCloseShortcut: () => false,
  isEmptyFloatingWorkspacePanelVisible: () => false,
  isEventTargetInsideFloatingWorkspacePanel: () => mocks.targetInsideFloatingPanel,
  isFloatingWorkspacePanelFocused: () => mocks.floatingFocused,
  switchFloatingWorkspaceTab: vi.fn()
}))
vi.mock('@/lib/terminal-shortcut-capture-notification', () => ({
  showTerminalShortcutCaptureNotification: vi.fn()
}))
vi.mock('./terminal-agent-tab-shortcut', () => ({
  resolveTerminalAgentTabShortcut: () => ({ actionId: null, agent: null })
}))

vi.mock('./terminal/terminal-tab-actions', () => ({ closeTerminalTab: mocks.closeTerminalTab }))
vi.mock('@/runtime/structured-agent-session-close', () => ({
  closeStructuredAgentSession: mocks.closeStructuredAgentSession
}))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' }),
  callRuntimeRpc: mocks.callRuntimeRpc
}))
vi.mock('@/lib/structured-agent-session-launch', () => ({
  cancelStructuredAgentLaunch: mocks.cancelStructuredAgentLaunch
}))
vi.mock('@/lib/worktree-runtime-owner', () => ({ getRuntimeEnvironmentIdForWorktree: () => null }))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionTab: vi.fn()
}))
vi.mock('../runtime/web-runtime-session', () => ({
  activateWebRuntimeSessionTab: vi.fn(),
  isWebRuntimeSessionActive: () => false
}))
vi.mock('@/runtime/runtime-worktree-selector', () => ({
  toRuntimeWorktreeSelector: (id: string) => `id:${id}`
}))
vi.mock('@/runtime/browser-workspace-tab-close', () => ({
  closeBrowserWorkspaceTabOnHosts: () => ({ closesLocally: true, removesVisibleTab: true })
}))
vi.mock('../store/slices/browser-webview-cleanup', () => ({ destroyWorkspaceWebviews: vi.fn() }))
vi.mock('@/lib/sidebar-worktree-activation', () => ({
  activateWorktreeFromSidebar: vi.fn().mockResolvedValue(undefined)
}))

const controller = {
  activeWorktreeId: 'repo-1::/repo/worktree',
  handleCloseAllFiles: vi.fn(),
  handleCloseBrowserTab: vi.fn(),
  handleCloseFile: vi.fn(),
  handleNewAgentTab: vi.fn(),
  handleNewBrowserTab: vi.fn(),
  handleNewFile: vi.fn(),
  handleNewSimulatorTab: vi.fn(),
  handleNewTab: vi.fn(),
  keybindings: undefined,
  mobileEmulatorEnabled: false,
  terminalShortcutPolicy: 'orca-first'
} as unknown as TerminalActivationController

function pressCmdS(): (EditorRequestCmdSaveDetail | undefined)[] {
  const details: (EditorRequestCmdSaveDetail | undefined)[] = []
  const listener = (event: Event): void => {
    details.push((event as CustomEvent<EditorRequestCmdSaveDetail>).detail ?? undefined)
  }
  window.addEventListener(ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT, listener)
  const target = document.createElement('div')
  document.body.appendChild(target)
  const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, cancelable: true })
  Object.defineProperty(event, 'target', { value: target })
  try {
    handleTerminalWorkspaceKeyDown(event, controller, 'darwin')
  } finally {
    window.removeEventListener(ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT, listener)
    target.remove()
  }
  return details
}

describe('handleTerminalWorkspaceKeyDown editor.save', () => {
  beforeEach(() => {
    mocks.floatingFocused = false
    mocks.targetInsideFloatingPanel = false
    mocks.state = {
      activeView: 'terminal',
      activeTabType: 'editor',
      activeFileId: 'file-1',
      getActiveTab: () => null
    }
  })

  it('dispatches the save request with the resolved file id', () => {
    expect(pressCmdS()).toEqual([{ fileId: 'file-1' }])
  })

  it('resolves the floating panel editor when the panel owns the event', () => {
    mocks.targetInsideFloatingPanel = true
    mocks.state.getActiveTab = (worktreeId: string) =>
      worktreeId === FLOATING_TERMINAL_WORKTREE_ID
        ? { contentType: 'editor', entityId: 'floating-file' }
        : null
    expect(pressCmdS()).toEqual([{ fileId: 'floating-file' }])
  })

  it('does not swallow the chord outside the workspace view', () => {
    mocks.state.activeView = 'tasks'
    expect(pressCmdS()).toEqual([])
  })
})

describe('tab.close uses the unified active tab', () => {
  const worktreeId = controller.activeWorktreeId!
  let tab: Tab
  const closeUnifiedTab = vi.fn()
  const closeFile = vi.fn()
  const closeBrowserTab = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.floatingFocused = false
    mocks.targetInsideFloatingPanel = false
    tab = {
      id: 'chat-tab',
      entityId: 'chat-session',
      worktreeId,
      groupId: 'right-group',
      contentType: 'agent-session',
      label: 'Chat',
      customLabel: null,
      color: null,
      sortOrder: 0,
      createdAt: 1
    }
    mocks.state = {
      activeView: 'terminal',
      activeWorktreeId: worktreeId,
      // The old terminal mirror can lag behind focus in a split group.
      activeTabType: 'terminal',
      activeTabId: 'other-terminal',
      activeFileId: 'other-file',
      activeBrowserTabId: 'other-browser',
      getActiveTab: () => tab,
      unifiedTabsByWorktree: { [worktreeId]: [tab] },
      openFiles: [],
      browserPagesByWorkspace: {},
      closeUnifiedTab,
      closeFile,
      closeBrowserTab,
      reconcileWorktreeTabModel: () => ({ renderableTabCount: 1 }),
      requestPinnedTabCloseConfirm: vi.fn(),
      setActiveWorktree: vi.fn()
    }
  })

  function close(platform: NodeJS.Platform = 'darwin', terminalFocus = false): KeyboardEvent {
    const target = document.createElement('textarea')
    if (terminalFocus) {
      target.classList.add('xterm-helper-textarea')
    }
    const event = new KeyboardEvent('keydown', {
      key: 'w',
      metaKey: platform === 'darwin',
      ctrlKey: platform !== 'darwin',
      cancelable: true
    })
    Object.defineProperty(event, 'target', { value: target })
    handleTerminalWorkspaceKeyDown(event, controller, platform)
    return event
  }

  it.each(['darwin', 'win32', 'linux'] as const)(
    'routes native chat close from its composer through the unified tab action on %s',
    async (platform) => {
      expect(close(platform).defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(closeUnifiedTab).toHaveBeenCalledWith(tab.id))
      // Why: the unified store action owns cancellation and host retirement for every close path.
      expect(mocks.closeStructuredAgentSession).not.toHaveBeenCalled()
      expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
      expect(mocks.cancelStructuredAgentLaunch).not.toHaveBeenCalled()
      expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
    }
  )

  it.each(['editor', 'diff', 'conflict-review', 'check-details', 'browser', 'simulator'] as const)(
    'closes the focused %s tab through the same command',
    (contentType) => {
      tab.contentType = contentType
      close()
      expect(closeUnifiedTab).toHaveBeenCalledWith(
        tab.id,
        ...(contentType === 'browser' ? [undefined] : [])
      )
      expect(controller.handleCloseFile).not.toHaveBeenCalled()
      expect(controller.handleCloseBrowserTab).not.toHaveBeenCalled()
    }
  )

  it('leaves a focused terminal split pane to its pane close handler', () => {
    tab.contentType = 'terminal'
    expect(close('darwin', true).defaultPrevented).toBe(false)
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
  })

  it('closes a terminal tab from its native chat overlay through terminal teardown', () => {
    tab.contentType = 'terminal'
    tab.viewMode = 'chat'
    close()
    expect(mocks.closeTerminalTab).toHaveBeenCalledWith(tab.entityId, {
      onClosed: expect.any(Function)
    })
  })

  it('waits for pinned-tab confirmation before closing', async () => {
    tab.isPinned = true
    close()
    expect(mocks.closeStructuredAgentSession).not.toHaveBeenCalled()
    expect(closeUnifiedTab).not.toHaveBeenCalled()
    const request = vi.mocked(mocks.state.requestPinnedTabCloseConfirm as ReturnType<typeof vi.fn>)
      .mock.calls[0][0]
    request.onConfirm()
    await vi.waitFor(() => expect(closeUnifiedTab).toHaveBeenCalledWith(tab.id))
  })

  it('does not close the main workspace tab while the floating panel owns focus', () => {
    mocks.floatingFocused = true
    expect(close().defaultPrevented).toBe(false)
    expect(mocks.closeStructuredAgentSession).not.toHaveBeenCalled()
  })

  it('preserves pinned tabs during a bulk close without prompting', () => {
    tab.isPinned = true
    dispatchWorkspaceTabCommand({
      type: 'close',
      target: { kind: 'tab', worktreeId, tabId: tab.id },
      bulk: true
    })
    expect(mocks.state.requestPinnedTabCloseConfirm).not.toHaveBeenCalled()
    expect(mocks.closeStructuredAgentSession).not.toHaveBeenCalled()
  })

  it('does not substitute the ambient tab for a stale explicit target', () => {
    expect(
      dispatchWorkspaceTabCommand({
        type: 'close',
        target: { kind: 'tab', worktreeId, tabId: 'removed' }
      })
    ).toBe(false)
    expect(mocks.closeStructuredAgentSession).not.toHaveBeenCalled()
  })

  it('does not close another group from an empty focused split', () => {
    mocks.state.getActiveTab = () => null
    mocks.state.activeGroupIdByWorktree = { [worktreeId]: 'empty-group' }
    mocks.state.groupsByWorktree = { [worktreeId]: [{ id: 'empty-group', activeTabId: null }] }
    tab.contentType = 'terminal'
    mocks.state.activeTabId = tab.entityId
    expect(close().defaultPrevented).toBe(false)
    expect(mocks.closeTerminalTab).not.toHaveBeenCalled()
  })

  it('closes only the focused copy of an editor shared between split groups', () => {
    tab.contentType = 'editor'
    mocks.state.unifiedTabsByWorktree = {
      [worktreeId]: [tab, { ...tab, id: 'left-copy', groupId: 'left-group' }]
    }
    close()
    expect(closeUnifiedTab).toHaveBeenCalledWith(tab.id)
    expect(closeFile).not.toHaveBeenCalled()
  })
})

describe('shared tab navigation routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.floatingFocused = false
    mocks.targetInsideFloatingPanel = false
    mocks.state = { activeWorktreeId: controller.activeWorktreeId }
  })

  function nextTab(): void {
    handleTerminalWorkspaceKeyDown(
      new KeyboardEvent('keydown', {
        key: ']',
        metaKey: true,
        shiftKey: true,
        cancelable: true
      }),
      controller,
      'darwin'
    )
  }

  it('sends the keyboard and IPC navigation intent to the same workspace operation', () => {
    nextTab()
    dispatchWorkspaceTabCommand({ type: 'switch', direction: 1, scope: 'all-types' })
    expect(handleSwitchTabAcrossAllTypes).toHaveBeenCalledTimes(2)
    expect(handleSwitchTabAcrossAllTypes).toHaveBeenLastCalledWith(1)
    expect(switchFloatingWorkspaceTab).not.toHaveBeenCalled()
  })

  it('routes both entry points to the floating panel when it owns focus', () => {
    mocks.floatingFocused = true
    nextTab()
    dispatchWorkspaceTabCommand({ type: 'switch', direction: 1, scope: 'all-types' })
    expect(switchFloatingWorkspaceTab).toHaveBeenCalledTimes(2)
    expect(switchFloatingWorkspaceTab).toHaveBeenLastCalledWith(mocks.state, 1, 'all-types')
    expect(handleSwitchTabAcrossAllTypes).not.toHaveBeenCalled()
  })
})

describe('card deck shortcuts', () => {
  const worktreeId = controller.activeWorktreeId!
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.floatingFocused = false
    mocks.targetInsideFloatingPanel = false
    mocks.state = {
      activeWorktreeId: worktreeId,
      togglePaneCardDeck: vi.fn(),
      focusGroup: vi.fn(),
      activateTab: vi.fn(),
      setActiveTab: vi.fn(),
      setActiveTabType: vi.fn(),
      setActiveFile: vi.fn(),
      paneCardDeckByWorktree: { [worktreeId]: true },
      activeGroupIdByWorktree: { [worktreeId]: 'left-group' },
      groupsByWorktree: {
        [worktreeId]: [{ id: 'left-group', activeTabId: 'tab-left-a' }]
      },
      // Why: the rotation chords pool cards via computeGlobalDeckTabs, which
      // enumerates worktrees from worktreesByRepo (not unifiedTabsByWorktree
      // directly) — the active worktree must be listed here or its own tabs
      // silently drop out of the pool.
      worktreesByRepo: {
        'repo-1': [{ id: worktreeId, repoId: 'repo-1' }]
      },
      unifiedTabsByWorktree: {
        [worktreeId]: [
          { id: 'tab-left-a', entityId: 'term-a', groupId: 'left-group', contentType: 'terminal' },
          { id: 'tab-left-b', entityId: 'term-b', groupId: 'left-group', contentType: 'terminal' },
          { id: 'tab-left-c', entityId: 'term-c', groupId: 'left-group', contentType: 'terminal' }
        ]
      }
    }
  })

  function press(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...options })
    handleTerminalWorkspaceKeyDown(event, controller, 'darwin')
    return event
  }

  it('toggles the deck via Mod+Shift+K', () => {
    const event = press('k', { metaKey: true, shiftKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(mocks.state.togglePaneCardDeck).toHaveBeenCalledWith(worktreeId)
  })

  it('rotates to the next tab in the focused group while the deck is on', () => {
    const event = press('PageDown', { metaKey: true, shiftKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(mocks.state.activateTab).toHaveBeenCalledWith('tab-left-b')
    expect(mocks.state.setActiveTab).toHaveBeenCalledWith('term-b')
    expect(mocks.state.setActiveTabType).toHaveBeenCalledWith('terminal')
  })

  it('rotates to the previous tab and wraps from the first', () => {
    const event = press('PageUp', { metaKey: true, shiftKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(mocks.state.activateTab).toHaveBeenCalledWith('tab-left-c')
  })

  it('rotates by the tab-strip order, not unifiedTabs insertion order', () => {
    mocks.state.groupsByWorktree = {
      [worktreeId]: [
        {
          id: 'left-group',
          activeTabId: 'tab-left-c',
          tabOrder: ['tab-left-c', 'tab-left-a', 'tab-left-b']
        }
      ]
    }

    const next = press('PageDown', { metaKey: true, shiftKey: true })
    expect(next.defaultPrevented).toBe(true)
    expect(mocks.state.activateTab).toHaveBeenCalledWith('tab-left-a')

    vi.clearAllMocks()
    const previous = press('PageUp', { metaKey: true, shiftKey: true })
    expect(previous.defaultPrevented).toBe(true)
    expect(mocks.state.activateTab).toHaveBeenCalledWith('tab-left-b')
  })

  it('keeps the rotation chords inert outside deck mode', () => {
    mocks.state.paneCardDeckByWorktree = {}
    const event = press('PageDown', { metaKey: true, shiftKey: true })
    expect(event.defaultPrevented).toBe(false)
    expect(mocks.state.activateTab).not.toHaveBeenCalled()
  })

  it("rotating onto a foreign-worktree card switches worktree and focuses that card's own group", async () => {
    const setPaneCardDeck = vi.fn()
    mocks.state = {
      ...mocks.state,
      setPaneCardDeck,
      groupsByWorktree: {
        [worktreeId]: [{ id: 'left-group', activeTabId: 'tab-left-c' }]
      },
      worktreesByRepo: {
        'repo-1': [
          { id: worktreeId, repoId: 'repo-1' },
          { id: 'other-worktree', repoId: 'repo-1' }
        ]
      },
      unifiedTabsByWorktree: {
        ...(mocks.state.unifiedTabsByWorktree as Record<string, unknown>),
        'other-worktree': [
          {
            id: 'tab-other',
            entityId: 'term-other',
            groupId: 'other-group',
            contentType: 'terminal'
          }
        ]
      }
    }

    const event = press('PageDown', { metaKey: true, shiftKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(setPaneCardDeck).toHaveBeenCalledWith('other-worktree', true)
    await vi.waitFor(() =>
      expect(activateWorktreeFromSidebar).toHaveBeenCalledWith('other-worktree')
    )
    await vi.waitFor(() => expect(mocks.state.focusGroup).toHaveBeenCalled())
    // Why: 'other-group' (the pooled tab's own group), never this pane's
    // 'left-group' — passing 'left-group' would corrupt other-worktree's
    // activeGroupIdByWorktree with a group id it doesn't own.
    expect(mocks.state.focusGroup).toHaveBeenCalledWith('other-worktree', 'other-group')
    expect(mocks.state.activateTab).toHaveBeenCalledWith('tab-other')
  })
})
