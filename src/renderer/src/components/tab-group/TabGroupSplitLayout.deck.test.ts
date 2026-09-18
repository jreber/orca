import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setTabGroupSplitRatioMock = vi.fn()
const recordFeatureInteractionMock = vi.fn()
const setDragRootNodeMock = vi.fn()
// Deck on/off is driven by the same store mock the sibling split-layout test
// uses; each test sets the per-worktree flag before rendering.
let paneCardDeckByWorktree: Record<string, boolean> = {}
let groupsByWorktree: Record<
  string,
  {
    id: string
    worktreeId: string
    activeTabId: string
    tabOrder: string[]
    recentTabIds: string[]
  }[]
> = {}
let unifiedTabsByWorktree: Record<
  string,
  {
    id: string
    entityId: string
    groupId: string
    worktreeId: string
    contentType: string
    label: string
    customLabel: null
    color: null
    sortOrder: number
    createdAt: number
  }[]
> = {}
const focusGroupMock = vi.fn()
type MockStoreState = {
  focusGroup: typeof focusGroupMock
  groupsByWorktree: typeof groupsByWorktree
  paneCardDeckByWorktree: Record<string, boolean>
  recordFeatureInteraction: typeof recordFeatureInteractionMock
  setTabGroupSplitRatio: typeof setTabGroupSplitRatioMock
  settings: { tabAutoGenerateTitle: boolean } | undefined
  tabsByWorktree: Record<string, unknown[]>
  unifiedTabsByWorktree: typeof unifiedTabsByWorktree
}
const useAppStoreMock = vi.fn((selector: (state: MockStoreState) => unknown) =>
  selector({
    focusGroup: focusGroupMock,
    groupsByWorktree,
    paneCardDeckByWorktree,
    recordFeatureInteraction: recordFeatureInteractionMock,
    setTabGroupSplitRatio: setTabGroupSplitRatioMock,
    settings: undefined,
    tabsByWorktree: {},
    unifiedTabsByWorktree
  })
)
vi.mock('../../store', () => ({
  useAppStore: (selector: (state: MockStoreState) => unknown) => useAppStoreMock(selector)
}))

vi.mock('./TabGroupPanel', () => ({
  default: (props: unknown) => ({ __mock: 'TabGroupPanel', props })
}))

vi.mock('./TabGroupDeckCard', () => ({
  default: (props: unknown) => ({ __mock: 'TabGroupDeckCard', props })
}))

vi.mock('./useTabDragSplit', () => ({
  useTabDragSplit: () => ({
    activeDrag: null,
    collisionDetection: vi.fn(),
    hoveredDropTarget: null,
    hoveredTabInsertion: null,
    isTabDragActiveRef: { current: false },
    onDragCancel: vi.fn(),
    onDragEnd: vi.fn(),
    onDragMove: vi.fn(),
    onDragOver: vi.fn(),
    onDragStart: vi.fn(),
    sensors: [],
    setDragRootNode: setDragRootNodeMock
  })
}))

// Why: the deck shell consults the workspace model for the focused group's
// tabs; the model's store subscriptions are covered elsewhere, so a stub keeps
// this test on the layout contract.
vi.mock('./useTabGroupWorkspaceModel', () => ({
  useTabGroupWorkspaceModel: ({ groupId, worktreeId }: { groupId: string; worktreeId: string }) => {
    const tabs = (unifiedTabsByWorktree[worktreeId] ?? []).filter((tab) => tab.groupId === groupId)
    const group = (groupsByWorktree[worktreeId] ?? []).find((item) => item.id === groupId)
    return {
      group,
      groupTabs: tabs,
      activeTab: tabs.find((tab) => tab.id === group?.activeTabId) ?? null,
      commands: {}
    }
  }
}))

// Why: TabGroupDeckLayout resolves its resizable width through real React
// hooks, which this file's plain function-call harness (no React render
// cycle) can't service — stub both to plain values.
vi.mock('../right-sidebar/use-window-width', () => ({
  useWindowWidth: () => 1200
}))
vi.mock('@/hooks/useSidebarResize', () => ({
  useSidebarResize: () => ({
    containerRef: { current: null },
    isResizing: false,
    onResizeStart: vi.fn()
  })
}))

import TabGroupDeckLayout from './TabGroupDeckLayout'
import TabGroupSplitLayout from './TabGroupSplitLayout'

type ReactElementLike = {
  type: string | ((props: Record<string, unknown>) => unknown)
  props: Record<string, unknown>
}

function asElement(node: unknown): ReactElementLike {
  return node as ReactElementLike
}

function invokeComponent(element: ReactElementLike): unknown {
  if (typeof element.type === 'function') {
    return element.type(element.props)
  }
  return element
}
const SPLIT_LAYOUT = {
  type: 'split',
  direction: 'horizontal',
  ratio: 0.5,
  first: { type: 'leaf', groupId: 'left-group' },
  second: { type: 'leaf', groupId: 'right-group' }
} as const

type MockGroup = {
  id: string
  worktreeId: string
  activeTabId: string
  tabOrder: string[]
  recentTabIds: string[]
}

function makeGroup(id: string, tabIds: string[], activeTabId = tabIds[0]): MockGroup {
  return { id, worktreeId: 'wt-1', activeTabId, tabOrder: tabIds, recentTabIds: tabIds }
}

describe('TabGroupSplitLayout deck mode', () => {
  beforeEach(() => {
    paneCardDeckByWorktree = {}
    groupsByWorktree = {}
    unifiedTabsByWorktree = {}
    setTabGroupSplitRatioMock.mockClear()
    recordFeatureInteractionMock.mockClear()
    setDragRootNodeMock.mockClear()
    useAppStoreMock.mockClear()
    focusGroupMock.mockClear()
  })

  function getLayoutWrapper(element: ReturnType<typeof TabGroupSplitLayout>) {
    const dndContext = asElement(element.props.children)
    return React.Children.toArray(dndContext.props.children as React.ReactNode)[0]
  }

  function getSplitBodyChildren(element: ReturnType<typeof TabGroupSplitLayout>) {
    const layoutWrapperChildren = React.Children.toArray(
      asElement(getLayoutWrapper(element)).props.children as React.ReactNode
    )
    const splitBody = layoutWrapperChildren[1]
    return React.Children.toArray(asElement(splitBody).props.children as React.ReactNode)
  }

  function seedFocusedGroupTabs() {
    unifiedTabsByWorktree = {
      'wt-1': [
        {
          id: 'tab-a',
          entityId: 'term-a',
          groupId: 'group-1',
          contentType: 'terminal',
          label: 'A',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          worktreeId: 'wt-1'
        },
        {
          id: 'tab-b',
          entityId: 'term-b',
          groupId: 'group-1',
          contentType: 'terminal',
          label: 'B',
          customLabel: null,
          color: null,
          sortOrder: 1,
          createdAt: 2,
          worktreeId: 'wt-1'
        }
      ]
    }
    groupsByWorktree = { 'wt-1': [makeGroup('group-1', ['tab-a', 'tab-b'], 'tab-b')] }
  }

  it('renders the plain tree when the deck flag is off', () => {
    seedFocusedGroupTabs()
    const element = TabGroupSplitLayout({
      layout: SPLIT_LAYOUT,
      worktreeId: 'wt-1',
      focusedGroupId: 'left-group',
      isWorktreeActive: true
    })
    const [splitBodyChild] = getSplitBodyChildren(element)
    const rootElement = asElement(invokeComponent(asElement(splitBodyChild)))
    const rootChildren = rootElement.props.children as unknown[]
    const leftChild = React.Children.only(asElement(rootChildren[0]).props.children)
    const rightChild = React.Children.only(asElement(rootChildren[2]).props.children)
    expect(asElement(invokeComponent(asElement(leftChild))).props.groupId).toBe('left-group')
    expect(asElement(invokeComponent(asElement(rightChild))).props.groupId).toBe('right-group')
  })

  it('decks a lone group through the panel, no split required', () => {
    paneCardDeckByWorktree = { 'wt-1': true }
    seedFocusedGroupTabs()
    const element = TabGroupSplitLayout({
      layout: { type: 'leaf', groupId: 'group-1' },
      worktreeId: 'wt-1',
      focusedGroupId: 'group-1',
      isWorktreeActive: true
    })

    const [splitBodyChild] = getSplitBodyChildren(element)
    const panel = asElement(invokeComponent(asElement(splitBodyChild)))
    expect(panel.props).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        worktreeId: 'wt-1',
        isFocused: true,
        deckModeActive: true
      })
    )
  })

  it('in a split, decks only the focused leaf and keeps sibling panes plain', () => {
    paneCardDeckByWorktree = { 'wt-1': true }
    seedFocusedGroupTabs()
    unifiedTabsByWorktree['wt-1'].push({
      id: 'tab-right',
      entityId: 'term-right',
      groupId: 'right-group',
      contentType: 'terminal',
      label: 'R',
      customLabel: null,
      color: null,
      sortOrder: 2,
      createdAt: 3,
      worktreeId: 'wt-1'
    })
    const element = TabGroupSplitLayout({
      layout: SPLIT_LAYOUT,
      worktreeId: 'wt-1',
      focusedGroupId: 'left-group',
      isWorktreeActive: true
    })

    const rootElement = asElement(invokeComponent(asElement(getSplitBodyChildren(element)[0])))
    const rootChildren = rootElement.props.children as unknown[]
    const leftChild = React.Children.only(asElement(rootChildren[0]).props.children)
    const rightChild = React.Children.only(asElement(rootChildren[2]).props.children)
    const leftPanel = asElement(invokeComponent(asElement(leftChild)))
    const rightPanel = asElement(invokeComponent(asElement(rightChild)))
    expect(leftPanel.props.groupId).toBe('left-group')
    expect(leftPanel.props.deckModeActive).toBe(true)
    expect(rightPanel.props.groupId).toBe('right-group')
    expect(rightPanel.props.deckModeActive).toBe(false)
  })

  it('deck rail renders one card per tab with the active card flagged', () => {
    seedFocusedGroupTabs()
    const wrapper = asElement(
      TabGroupDeckLayout({
        groupId: 'group-1',
        worktreeId: 'wt-1',
        activeOverlayTabId: null,
        stageContent: null
      })
    )
    const [, mosaic] = React.Children.toArray(wrapper.props.children as React.ReactNode).map(
      (child) => asElement(child)
    )
    expect(mosaic.props['data-tab-group-deck-mosaic']).toBe('')
    // Why: the mosaic's first child is the resize handle, not a card.
    const cards = React.Children.toArray(mosaic.props.children as React.ReactNode)
      .map((child) => asElement(child))
      .filter((card) => card.props.tab !== undefined)
      .map((card) => {
        const props = card.props as { tab?: { id: string }; isActive?: boolean }
        return { tabId: props.tab?.id, isActive: props.isActive === true }
      })
    expect(cards).toEqual([
      { tabId: 'tab-a', isActive: false },
      { tabId: 'tab-b', isActive: true }
    ])
  })

  it('deck rail orders cards by the tab strip order, not tab insertion order', () => {
    seedFocusedGroupTabs()
    // Why: unifiedTabsByWorktree lists tab-a before tab-b (insertion order),
    // but the tab strip has been reordered to put tab-b first — the rail
    // must follow the visual order, not the insertion order.
    groupsByWorktree = { 'wt-1': [makeGroup('group-1', ['tab-b', 'tab-a'], 'tab-b')] }
    const wrapper = asElement(
      TabGroupDeckLayout({
        groupId: 'group-1',
        worktreeId: 'wt-1',
        activeOverlayTabId: null,
        stageContent: null
      })
    )
    const [, mosaic] = React.Children.toArray(wrapper.props.children as React.ReactNode).map(
      (child) => asElement(child)
    )
    const cardIds = React.Children.toArray(mosaic.props.children as React.ReactNode)
      .map((child) => asElement(child))
      .filter((card) => card.props.tab !== undefined)
      .map((card) => (card.props.tab as { id: string }).id)
    expect(cardIds).toEqual(['tab-b', 'tab-a'])
  })
})
