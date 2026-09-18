import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import EmulatorPane from './EmulatorPane'
import { tabPaneAnchorName } from '../tab-group/tab-group-body-anchor'
import { getDeckedGroupId, useOverlayFocusActivation } from '../tab-group/tab-group-overlay-focus'

const EMPTY_UNIFIED_TABS: readonly Tab[] = []
const EMPTY_GROUPS: readonly TabGroup[] = []

type SimulatorOverlaySlotProps = {
  tab: Tab
  groupId: string | undefined
  isActive: boolean
  // Why: deck mode paints every decked simulator tab into its own card.
  isDecked: boolean
  onFocusOwningTab: ((groupId: string | undefined, overlayTabId?: string) => void) | undefined
}

const SimulatorOverlaySlot = memo(function SimulatorOverlaySlot({
  tab,
  groupId,
  isActive,
  isDecked,
  onFocusOwningTab
}: SimulatorOverlaySlotProps): React.JSX.Element {
  // Why: per-tab anchor — over the group body normally, into the tab's deck card when decked.
  const anchorName = groupId !== undefined ? tabPaneAnchorName(tab.id) : undefined
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
            zIndex: isActive ? 2 : 1,
            visibility: isActive || isDecked ? 'visible' : 'hidden',
            pointerEvents: isActive || isDecked ? 'auto' : 'none'
          }
        : { display: 'none' },
    [anchorName, isActive, isDecked]
  )

  return (
    <div
      style={style}
      className="orca-emulator-overlay-slot min-h-0 min-w-0 overflow-hidden"
      onPointerDownCapture={() => {
        if (groupId && onFocusOwningTab) {
          onFocusOwningTab(groupId, tab.id)
        }
      }}
    >
      <EmulatorPane tab={tab} worktreeId={tab.worktreeId} isActive={isActive} />
    </div>
  )
})

const EmulatorPaneOverlayLayer = memo(function EmulatorPaneOverlayLayer({
  worktreeId,
  isWorktreeActive
}: {
  worktreeId: string
  isWorktreeActive: boolean
}): React.JSX.Element {
  const { unifiedTabs, groups, deckedGroupId } = useAppStore(
    useShallow((state) => ({
      unifiedTabs: state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_UNIFIED_TABS,
      groups: state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS,
      deckedGroupId: getDeckedGroupId(state, worktreeId)
    }))
  )
  // Why: deck cards host each tab's real surface, so a click on a background
  // card's pane must activate that tab, not just focus the group.
  const focusOwningTab = useOverlayFocusActivation(worktreeId)

  const groupActiveTabById = useMemo(() => {
    const lookup: Record<string, string | null | undefined> = {}
    for (const group of groups) {
      lookup[group.id] = group.activeTabId
    }
    return lookup
  }, [groups])

  const simulatorTabs = useMemo(
    () => unifiedTabs.filter((t) => t.contentType === 'simulator'),
    [unifiedTabs]
  )

  return (
    <>
      {simulatorTabs.map((tab) => {
        const isActiveInGroup = groupActiveTabById[tab.groupId] === tab.id
        const isActive = Boolean(isWorktreeActive && isActiveInGroup)
        const isDecked = deckedGroupId !== null && tab.groupId === deckedGroupId
        return (
          <SimulatorOverlaySlot
            key={tab.id}
            tab={tab}
            groupId={tab.groupId}
            isActive={isActive}
            isDecked={isDecked}
            onFocusOwningTab={focusOwningTab}
          />
        )
      })}
    </>
  )
})

export default EmulatorPaneOverlayLayer
