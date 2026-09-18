/**
 * FLIP (First-Last-Invert-Play) transition for deck-card activation.
 *
 * A deck-anchored tab's retained overlay (terminal/browser/simulator/agent
 * chat) jumps between two very different rects — a small rail card and the
 * full-size stage — the instant the active tab changes, because CSS anchor
 * positioning resolves the new geometry immediately. That instant jump reads
 * as a flash. This plays a GPU-composited `transform` animation from the old
 * rect to the new one so the resize looks smooth instead, without touching
 * the anchor-positioned top/left/width/height themselves (so it can't add
 * lag to the unrelated, continuous rail drag-resize).
 */

const FLIP_DURATION_MS = 220
const FLIP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
// Why: cleanup must win even if the browser never fires transitionend (e.g.
// the element unmounts, or a same-size flip skips the transform entirely).
const FLIP_CLEANUP_FALLBACK_MS = FLIP_DURATION_MS + 100

function findOverlayElement(overlayId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-retained-pane-overlay-id="${overlayId}"]`)
}

function playFlip(element: HTMLElement, before: DOMRect): void {
  const after = element.getBoundingClientRect()
  const dx = before.left - after.left
  const dy = before.top - after.top
  const sx = after.width === 0 ? 1 : before.width / after.width
  const sy = after.height === 0 ? 1 : before.height / after.height
  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) {
    return
  }
  const clear = (): void => {
    element.style.transition = ''
    element.style.transform = ''
    element.style.transformOrigin = ''
    element.style.willChange = ''
  }
  element.style.transition = 'none'
  element.style.transformOrigin = 'top left'
  element.style.willChange = 'transform'
  element.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
  // Why: force a reflow so the browser paints the inverted (First) transform
  // before the transition below animates it away — otherwise both style
  // writes coalesce into a single frame and nothing visibly animates.
  void element.offsetHeight
  element.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`
  element.style.transform = 'none'
  element.addEventListener('transitionend', clear, { once: true })
  window.setTimeout(clear, FLIP_CLEANUP_FALLBACK_MS)
}

/**
 * Call before the store update that changes a decked group's active tab.
 * Captures the current rect of each affected tab's overlay, then returns a
 * callback to invoke right after — it waits a frame for the anchor swap to
 * land, measures the new rect, and animates the visual delta away.
 */
export function captureDeckCardFlipRects(overlayIds: readonly string[]): () => void {
  const beforeRectsByOverlayId = new Map<string, DOMRect>()
  for (const overlayId of overlayIds) {
    const element = findOverlayElement(overlayId)
    if (element) {
      beforeRectsByOverlayId.set(overlayId, element.getBoundingClientRect())
    }
  }
  if (beforeRectsByOverlayId.size === 0) {
    return () => {}
  }
  return () => {
    requestAnimationFrame(() => {
      for (const [overlayId, before] of beforeRectsByOverlayId) {
        const element = findOverlayElement(overlayId)
        if (element) {
          playFlip(element, before)
        }
      }
    })
  }
}
