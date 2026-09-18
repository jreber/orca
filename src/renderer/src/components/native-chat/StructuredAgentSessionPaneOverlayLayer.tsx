import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import { useAppStore } from '@/store'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import { getActiveRuntimeTarget, type RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { RetainedPaneHost } from '../tab-group/RetainedPaneHost'
import { getDeckedGroupId, useOverlayFocusActivation } from '../tab-group/tab-group-overlay-focus'
import NativeChatView from './NativeChatView'

type StructuredAgentSessionTab = Tab & {
  contentType: 'agent-session'
  agentSessionAgent: NonNullable<Tab['agentSessionAgent']>
}

const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []

const StructuredAgentSessionOverlaySlot = memo(function StructuredAgentSessionOverlaySlot({
  tab,
  groupId,
  isActive,
  isFocusedGroup,
  isDecked,
  target,
  onFocusOwningTab
}: {
  tab: StructuredAgentSessionTab
  groupId: string | undefined
  isActive: boolean
  isFocusedGroup: boolean
  // Why: deck mode paints every decked agent-session tab into its own card.
  isDecked: boolean
  target: RuntimeClientTarget
  onFocusOwningTab: ((groupId: string | undefined, overlayTabId?: string) => void) | undefined
}): React.JSX.Element {
  return (
    <RetainedPaneHost
      groupId={groupId}
      overlayTabId={tab.id}
      isVisible={isActive || isDecked}
      data-structured-agent-session-overlay-tab-id={tab.id}
      onFocusOwningTab={onFocusOwningTab}
    >
      <NativeChatView
        mode="structured"
        tabId={tab.id}
        groupId={groupId}
        sessionId={tab.entityId}
        agent={tab.agentSessionAgent}
        isVisible={isActive}
        isFocusedGroup={isFocusedGroup}
        target={target}
      />
    </RetainedPaneHost>
  )
})

const StructuredAgentSessionPaneOverlayLayer = memo(
  function StructuredAgentSessionPaneOverlayLayer({
    worktreeId,
    isWorktreeActive
  }: {
    worktreeId: string
    isWorktreeActive: boolean
  }): React.JSX.Element {
    const { unifiedTabs, groups, runtimeEnvironmentId, activeGroupId, deckedGroupId } =
      useAppStore(
        useShallow((state) => ({
          unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
          groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
          runtimeEnvironmentId: getRuntimeEnvironmentIdForWorktree(state, worktreeId),
          activeGroupId: state.activeGroupIdByWorktree[worktreeId],
          deckedGroupId: getDeckedGroupId(state, worktreeId)
        }))
      )
    // Why: deck cards host each tab's real surface, so a click on a background
    // card's pane must activate that tab, not just focus the group.
    const focusOwningTab = useOverlayFocusActivation(worktreeId)
    const target = useMemo(
      () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId: runtimeEnvironmentId }),
      [runtimeEnvironmentId]
    )
    const groupActiveTabById = useMemo(
      () => new Map(groups.map((group) => [group.id, group.activeTabId] as const)),
      [groups]
    )
    const structuredTabs = useMemo(
      () =>
        unifiedTabs.filter(
          (tab): tab is StructuredAgentSessionTab =>
            tab.contentType === 'agent-session' &&
            isAgentSessionHandleProvider(tab.agentSessionAgent)
        ),
      [unifiedTabs]
    )

    return (
      <>
        {structuredTabs.map((tab) => (
          <StructuredAgentSessionOverlaySlot
            key={tab.id}
            tab={tab}
            groupId={tab.groupId}
            isActive={Boolean(isWorktreeActive && groupActiveTabById.get(tab.groupId) === tab.id)}
            isFocusedGroup={Boolean(
              isWorktreeActive &&
              groupActiveTabById.get(tab.groupId) === tab.id &&
              tab.groupId === activeGroupId
            )}
            isDecked={deckedGroupId !== null && tab.groupId === deckedGroupId}
            target={target}
            onFocusOwningTab={focusOwningTab}
          />
        ))}
      </>
    )
  }
)

export default StructuredAgentSessionPaneOverlayLayer
