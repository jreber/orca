// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureDeckCardFlipRects } from './deck-card-flip-transition'

describe('captureDeckCardFlipRects', () => {
  let element: HTMLDivElement

  beforeEach(() => {
    element = document.createElement('div')
    element.setAttribute('data-retained-pane-overlay-id', 'tab-1')
    document.body.append(element)
    // Why: run the deferred measure-and-animate step synchronously so tests
    // don't need to juggle real animation frame timing.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
  })

  afterEach(() => {
    element.remove()
    vi.unstubAllGlobals()
  })

  it('is a no-op when no overlay element matches the given id', () => {
    const play = captureDeckCardFlipRects(['missing-id'])
    expect(() => play()).not.toThrow()
  })

  it('leaves the transform untouched when the rect does not change', () => {
    element.getBoundingClientRect = () => new DOMRect(10, 10, 100, 100)
    captureDeckCardFlipRects(['tab-1'])()
    expect(element.style.transform).toBe('')
    expect(element.style.transition).toBe('')
  })

  it('inverts the rect delta into a transform, then animates it back to identity', () => {
    let call = 0
    element.getBoundingClientRect = () =>
      call++ === 0 ? new DOMRect(0, 0, 100, 100) : new DOMRect(200, 50, 400, 300)
    const play = captureDeckCardFlipRects(['tab-1'])

    // Why: the invert-then-animate sequence forces a reflow between the two
    // style writes — reading offsetHeight at that instant captures the
    // inverted (First) transform before it's replaced.
    let transformDuringReflow = ''
    Object.defineProperty(element, 'offsetHeight', {
      configurable: true,
      get() {
        transformDuringReflow = element.style.transform
        return 0
      }
    })

    play()

    expect(transformDuringReflow).toBe('translate(-200px, -50px) scale(0.25, 0.3333333333333333)')
    expect(element.style.transform).toBe('none')
    expect(element.style.transition).toBe('transform 220ms cubic-bezier(0.22, 1, 0.36, 1)')
    expect(element.style.transformOrigin).toBe('top left')
  })

  it('clears the inline transition styles once the transition ends', () => {
    let call = 0
    element.getBoundingClientRect = () =>
      call++ === 0 ? new DOMRect(0, 0, 100, 100) : new DOMRect(50, 50, 200, 200)
    captureDeckCardFlipRects(['tab-1'])()

    element.dispatchEvent(new Event('transitionend'))

    expect(element.style.transform).toBe('')
    expect(element.style.transition).toBe('')
    expect(element.style.transformOrigin).toBe('')
    expect(element.style.willChange).toBe('')
  })
})
