/**
 * @vitest-environment happy-dom
 */
import React, { createRef, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyNativeChatContextMenuActions,
  useNativeChatContextMenu,
  type NativeChatContextMenuActions
} from './use-native-chat-context-menu'

type ItemProps = { onSelect?: () => void; children?: ReactNode; disabled?: boolean }

const items = vi.hoisted(() => ({ list: [] as ItemProps[] }))
const mocks = vi.hoisted(() => ({ addNativeChatAnnotation: vi.fn() }))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuItem: (props: ItemProps) => {
    items.list.push(props)
    return props.children
  },
  DropdownMenuLabel: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuSeparator: () => null,
  DropdownMenuShortcut: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuSub: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuSubContent: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuSubTrigger: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => children
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open }: { children?: ReactNode; open: boolean }) =>
    open ? children : null,
  PopoverAnchor: ({ children }: { children?: ReactNode }) => children ?? null,
  PopoverContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}))

vi.mock('./native-chat-annotation-queue', () => ({
  addNativeChatAnnotation: mocks.addNativeChatAnnotation
}))

vi.mock('lucide-react', () => {
  const Icon = () => null
  return {
    Clipboard: Icon,
    Copy: Icon,
    GitFork: Icon,
    Maximize2: Icon,
    MessageSquarePlus: Icon,
    Minimize2: Icon,
    PanelBottomClose: Icon,
    PanelsTopLeft: Icon,
    PanelRightClose: Icon,
    Pencil: Icon,
    SquareTerminal: Icon,
    StickyNote: Icon,
    X: Icon
  }
})

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/components/tab-bar/TabWorkspaceLayoutMenuSection', () => ({
  TabWorkspaceLayoutMenuSection: () => 'Move Tab to Split'
}))

/** Fake selection anchored inside `root`, matching what getSelection() returns
 *  for a real user text selection. */
function selectionWithinRoot(root: HTMLElement, text: string): Selection {
  return {
    isCollapsed: false,
    anchorNode: root,
    focusNode: root,
    toString: () => text,
    rangeCount: 1,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        left: 5,
        top: 0,
        right: 5,
        bottom: 15,
        width: 0,
        height: 15,
        x: 5,
        y: 0,
        toJSON: () => ({})
      })
    })
  } as unknown as Selection
}

function lastItemLabeled(label: string): ItemProps | undefined {
  return items.list
    .toReversed()
    .find((candidate) => childrenText(candidate.children).startsWith(label))
}

function childrenText(children: ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') {
        return child
      }
      return React.isValidElement<{ children?: ReactNode }>(child)
        ? childrenText(child.props.children)
        : ''
    })
    .join('')
}

function Harness({
  onSwitchToTerminal,
  structured = false,
  enabled = true,
  paneKey = 'tab-1:leaf-1'
}: {
  onSwitchToTerminal?: () => void
  structured?: boolean
  enabled?: boolean
  paneKey?: string
}) {
  const rootRef = createRef<HTMLDivElement>()
  const { menu, onContextMenuCapture } = useNativeChatContextMenu({
    rootRef,
    paneKey,
    enabled,
    onSwitchToTerminal,
    showTerminalPaneActions: !structured,
    workspaceLayout: structured ? { unifiedTabId: 'chat-tab', groupId: 'group-1' } : undefined,
    actions: {
      ...emptyNativeChatContextMenuActions,
      onPaste: vi.fn()
    } satisfies NativeChatContextMenuActions
  })
  return (
    <div ref={rootRef} data-testid="native-chat-root" onContextMenuCapture={onContextMenuCapture}>
      {menu}
    </div>
  )
}

describe('useNativeChatContextMenu', () => {
  beforeEach(() => {
    items.list = []
    mocks.addNativeChatAnnotation.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('restores the bridge switch-to-terminal action when supplied', () => {
    const onSwitchToTerminal = vi.fn()

    renderToStaticMarkup(<Harness onSwitchToTerminal={onSwitchToTerminal} />)

    // Keep the assertions tied to the mocked menu item's semantic children.
    const labels = items.list.map((candidate) => childrenText(candidate.children))

    expect(labels.some((label) => label.startsWith('Switch to terminal view'))).toBe(true)
    const item = items.list.find((candidate) =>
      childrenText(candidate.children).startsWith('Switch to terminal view')
    )
    expect(item).toBeDefined()
    item?.onSelect?.()
    expect(onSwitchToTerminal).toHaveBeenCalledTimes(1)
  })

  it('does not render a terminal switch action without a bridge callback', () => {
    renderToStaticMarkup(<Harness />)

    expect(
      items.list.some((candidate) => childrenText(candidate.children) === 'Switch to terminal view')
    ).toBe(false)
  })

  it('reuses workspace layout actions without terminal-only pane commands', () => {
    const markup = renderToStaticMarkup(<Harness structured />)

    expect(markup).toContain('Move Tab to Split')
    expect(markup).not.toContain('Split Terminal Right')
    expect(markup).not.toContain('Fork Agent Session')
  })

  it('subscribes to selection changes only while its retained chat is visible', () => {
    const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue(null)
    const view = render(<Harness enabled={false} />)

    getSelection.mockClear()
    document.dispatchEvent(new Event('selectionchange'))
    expect(getSelection).not.toHaveBeenCalled()

    view.rerender(<Harness enabled />)
    getSelection.mockClear()
    document.dispatchEvent(new Event('selectionchange'))
    expect(getSelection).toHaveBeenCalledOnce()

    view.rerender(<Harness enabled={false} />)
    getSelection.mockClear()
    document.dispatchEvent(new Event('selectionchange'))
    expect(getSelection).not.toHaveBeenCalled()
  })

  it('gates Annotate on a selection and saves the note via the queue on Enter', () => {
    vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
    const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue(null)

    render(<Harness paneKey="tab-1:leaf-1" />)
    const root = screen.getByTestId('native-chat-root')

    expect(lastItemLabeled('Annotate')?.disabled).toBe(true)

    getSelection.mockReturnValue(selectionWithinRoot(root, 'quoted response text'))
    fireEvent.contextMenu(root, { clientX: 12, clientY: 34 })

    const annotateItem = lastItemLabeled('Annotate')
    expect(annotateItem?.disabled).toBe(false)

    act(() => annotateItem?.onSelect?.())

    const input = screen.getByPlaceholderText('Add a note…')
    fireEvent.change(input, { target: { value: 'this is wrong' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mocks.addNativeChatAnnotation).toHaveBeenCalledWith(
      'tab-1:leaf-1',
      'quoted response text',
      'this is wrong'
    )
    expect(screen.queryByPlaceholderText('Add a note…')).toBeNull()
  })

  it('opens the note popover from the keyboard chord and cancels on Escape without saving', () => {
    vi.stubGlobal('navigator', { userAgent: 'Macintosh' })
    const getSelection = vi.spyOn(window, 'getSelection').mockReturnValue(null)

    render(<Harness paneKey="tab-2:leaf-1" />)
    const root = screen.getByTestId('native-chat-root')
    getSelection.mockReturnValue(selectionWithinRoot(root, 'quoted via chord'))

    fireEvent.keyDown(document, { key: 'h', metaKey: true, shiftKey: true })

    const input = screen.getByPlaceholderText('Add a note…')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByPlaceholderText('Add a note…')).toBeNull()
    expect(mocks.addNativeChatAnnotation).not.toHaveBeenCalled()
  })
})
