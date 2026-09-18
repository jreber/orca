import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SYNC_FIT_PANES_EVENT } from '@/constants/terminal'
import {
  TAB_PANE_ANCHOR_DATASET,
  tabGroupBodyAnchorName,
  tabPaneAnchorName
} from './tab-group-body-anchor'

const HAS_CSS_ANCHOR_POSITIONING =
  typeof CSS !== 'undefined' &&
  CSS.supports('position-anchor', '--orca-terminal-overlay-probe') &&
  CSS.supports('top', 'anchor(--orca-terminal-overlay-probe top)') &&
  CSS.supports('width', 'anchor-size(--orca-terminal-overlay-probe width)')
const MIN_OVERLAY_FIT_WIDTH_PX = 48
const MIN_OVERLAY_FIT_HEIGHT_PX = 24
const FALLBACK_RECT_MIN_CHANGE_PX = 1

function shouldUseCssAnchorPositioning(): boolean {
  return (
    HAS_CSS_ANCHOR_POSITIONING &&
    (globalThis as { __ORCA_WEB_CLIENT__?: boolean }).__ORCA_WEB_CLIENT__ !== true
  )
}

type MeasuredFallbackRect = {
  top: number
  left: number
  width: number
  height: number
}

type RetainedPaneHostProps = {
  groupId: string | undefined
  /**
   * Why: deck cards claim per-tab anchors, so a set overlayTabId retargets this
   * host from its group's body to that tab's own card surface.
   */
  overlayTabId?: string
  isVisible: boolean
  measureWhileHidden?: boolean
  fitTerminal?: boolean
  onFocusOwningTab?: (groupId: string | undefined, overlayTabId?: string) => void
  children: React.ReactNode
  'data-terminal-overlay-tab-id'?: string
  'data-structured-agent-session-overlay-tab-id'?: string
}

export function RetainedPaneHost({
  groupId,
  overlayTabId,
  isVisible,
  measureWhileHidden = false,
  fitTerminal = false,
  onFocusOwningTab,
  children,
  ...identity
}: RetainedPaneHostProps): React.JSX.Element {
  // Why: deck cards claim per-tab anchors so every carded tab paints its real
  // retained surface; without one, fall back to the owning group's body.
  const anchorName = overlayTabId
    ? tabPaneAnchorName(overlayTabId)
    : groupId !== undefined
      ? tabGroupBodyAnchorName(groupId)
      : undefined
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const [measuredFallbackRect, setMeasuredFallbackRect] = useState<MeasuredFallbackRect | null>(
    null
  )
  useLayoutEffect(() => {
    if (!anchorName || shouldUseCssAnchorPositioning() || !groupId) {
      return
    }

    const findBody = (): HTMLElement | null => {
      // Why: deck cards claim the per-tab anchor element; prefer it over the
      // group body so the fallback paints into the card, not the mosaic.
      if (overlayTabId) {
        const card = document.querySelector<HTMLElement>(
          `[${TAB_PANE_ANCHOR_DATASET}="${overlayTabId}"]`
        )
        if (card) {
          return card
        }
      }
      for (const candidate of document.querySelectorAll<HTMLElement>('[data-tab-group-body-id]')) {
        if (candidate.dataset.tabGroupBodyId === groupId) {
          return candidate
        }
      }
      return null
    }

    const updateRect = (): void => {
      const overlay = overlayRef.current
      const parent = overlay?.parentElement
      const body = findBody()
      if (!parent || !body) {
        setMeasuredFallbackRect(null)
        return
      }
      const parentRect = parent.getBoundingClientRect()
      const bodyRect = body.getBoundingClientRect()
      const next: MeasuredFallbackRect = {
        top: bodyRect.top - parentRect.top,
        left: bodyRect.left - parentRect.left,
        width: bodyRect.width,
        height: bodyRect.height
      }
      // Why: ResizeObserver and xterm fit can otherwise amplify sub-pixel jitter forever.
      setMeasuredFallbackRect((prev) =>
        prev &&
        Math.abs(prev.top - next.top) < FALLBACK_RECT_MIN_CHANGE_PX &&
        Math.abs(prev.left - next.left) < FALLBACK_RECT_MIN_CHANGE_PX &&
        Math.abs(prev.width - next.width) < FALLBACK_RECT_MIN_CHANGE_PX &&
        Math.abs(prev.height - next.height) < FALLBACK_RECT_MIN_CHANGE_PX
          ? prev
          : next
      )
    }

    updateRect()
    const body = findBody()
    const parent = overlayRef.current?.parentElement
    const resizeObserver = new ResizeObserver(updateRect)
    if (body) {
      resizeObserver.observe(body)
    }
    if (parent) {
      resizeObserver.observe(parent)
    }
    window.addEventListener('resize', updateRect)
    // Why: the deck mosaic scrolls cards without resizing them; capture-phase
    // scroll keeps the measured rect glued to the card as it moves.
    window.addEventListener('scroll', updateRect, true)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [anchorName, groupId, overlayTabId, isVisible])

  useLayoutEffect(() => {
    if (!fitTerminal || !isVisible || !anchorName) {
      return
    }
    const dispatchFitIfMeasurable = (): void => {
      const rect = overlayRef.current?.getBoundingClientRect()
      if (
        !rect ||
        rect.width < MIN_OVERLAY_FIT_WIDTH_PX ||
        rect.height < MIN_OVERLAY_FIT_HEIGHT_PX
      ) {
        return
      }
      window.dispatchEvent(new Event(SYNC_FIT_PANES_EVENT))
    }

    // Why: tab switches can resume visibility before anchor/fallback geometry
    // settles. Re-fit only after the overlay has real dimensions so the PTY
    // never stays pinned at a stale ~2-col width.
    const frameId = requestAnimationFrame(() => {
      dispatchFitIfMeasurable()
    })
    const retryId = window.setTimeout(() => {
      dispatchFitIfMeasurable()
    }, 50)
    const settledRetryId = window.setTimeout(() => {
      dispatchFitIfMeasurable()
    }, 150)
    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(retryId)
      window.clearTimeout(settledRetryId)
    }
  }, [anchorName, fitTerminal, isVisible, measuredFallbackRect])

  const style: React.CSSProperties = useMemo(
    () =>
      anchorName && shouldUseCssAnchorPositioning()
        ? {
            position: 'absolute',
            positionAnchor: anchorName,
            top: `anchor(${anchorName} top)`,
            left: `anchor(${anchorName} left)`,
            width: `anchor-size(${anchorName} width)`,
            height: `anchor-size(${anchorName} height)`,
            display: isVisible || measureWhileHidden ? 'flex' : 'none',
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'auto' : 'none'
          }
        : anchorName
          ? {
              // Why: Chrome builds without CSS anchor positioning otherwise
              // mount the terminal into a 0x0 overlay. Measure the tab-group
              // body so the fallback does not cover the tab strip.
              position: 'absolute',
              top: measuredFallbackRect?.top ?? 32,
              left: measuredFallbackRect?.left ?? 0,
              width: measuredFallbackRect?.width ?? '100%',
              height: measuredFallbackRect?.height ?? 'calc(100% - 32px)',
              display: isVisible || measureWhileHidden ? 'flex' : 'none',
              opacity: isVisible ? 1 : 0,
              pointerEvents: isVisible ? 'auto' : 'none'
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
    [anchorName, isVisible, measuredFallbackRect, measureWhileHidden]
  )
  const focusGroup = useCallback(() => {
    if (onFocusOwningTab) {
      onFocusOwningTab(groupId, overlayTabId)
    }
  }, [groupId, overlayTabId, onFocusOwningTab])

  return (
    <div
      ref={overlayRef}
      style={style}
      // Pane-local layers cannot compete with app notifications or escape their split rectangle.
      className="isolate z-10 min-h-0 min-w-0 overflow-hidden"
      data-retained-pane-host=""
      // Why: a type-agnostic hook (terminal/browser/simulator/agent-session
      // all differ in their own identity dataset) so the deck's FLIP
      // transition can find this overlay by tab id alone.
      data-retained-pane-overlay-id={overlayTabId}
      {...identity}
      inert={!isVisible}
      aria-hidden={!isVisible}
      onPointerDown={focusGroup}
      onFocusCapture={focusGroup}
    >
      {children}
    </div>
  )
}
