// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewBoxFit } from './preview-terminal-box-fit'

// Why: the DOM stub reports 0 for every layout box, so the sizes the fit reads are stubbed.
function mount(args: {
  boxWidth: number
  boxHeight: number
  screenWidth: number
  screenHeight: number
}): { container: HTMLElement; box: HTMLElement } {
  const box = document.createElement('div')
  const container = document.createElement('div')
  const screen = document.createElement('div')
  screen.className = 'xterm-screen'
  container.appendChild(screen)
  box.appendChild(container)
  document.body.appendChild(box)
  Object.defineProperty(box, 'clientWidth', { value: args.boxWidth })
  Object.defineProperty(box, 'clientHeight', { value: args.boxHeight })
  Object.defineProperty(screen, 'offsetWidth', { value: args.screenWidth })
  Object.defineProperty(screen, 'offsetHeight', { value: args.screenHeight })
  return { container, box }
}

const terminal = { rows: 24, buffer: { active: { cursorY: 23 } } } as never

describe('createPreviewBoxFit', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  it('fits the full width when no floor is given', () => {
    const { container } = mount({
      boxWidth: 300,
      boxHeight: 400,
      screenWidth: 1000,
      screenHeight: 480
    })

    createPreviewBoxFit({ container, getTerminal: () => terminal }).fit()

    expect(container.style.transform).toBe('scale(0.3)')
  })

  it('holds the floor and lets the box clip the extra columns', () => {
    const { container } = mount({
      boxWidth: 300,
      boxHeight: 400,
      screenWidth: 1000,
      screenHeight: 480
    })

    createPreviewBoxFit({ container, getTerminal: () => terminal, minScale: 0.7 }).fit()

    expect(container.style.transform).toBe('scale(0.7)')
  })

  it('never scales a small frame up past its real size', () => {
    const { container } = mount({
      boxWidth: 1200,
      boxHeight: 400,
      screenWidth: 600,
      screenHeight: 300
    })

    createPreviewBoxFit({ container, getTerminal: () => terminal, minScale: 0.7 }).fit()

    expect(container.style.transform).toBe('')
  })
})
