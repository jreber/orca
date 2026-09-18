// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SingleSessionApp } from './SingleSessionApp'

vi.mock('../components/native-chat/NativeChatStructuredSession', () => ({
  NativeChatStructuredSession: (props: { sessionId: string; agent: string }) => (
    <div data-testid="native-chat-structured-session">
      {props.sessionId}:{props.agent}
    </div>
  )
}))

vi.mock('../web/web-preload-api', () => ({
  installWebPreloadApi: vi.fn()
}))

describe('SingleSessionApp', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.documentElement.classList.remove('dark', 'light')
  })

  it('follows the OS dark-mode preference — this embed has no settings sync to read a theme from', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
    const params = {
      offer: { v: 2 as const, endpoint: 'wss://x', deviceToken: 't', publicKeyB64: 'a2V5' },
      sessionId: 'sess-1',
      agent: 'claude'
    }
    render(<SingleSessionApp params={params} />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('installs the web preload api and renders the structured chat session', () => {
    const params = {
      offer: { v: 2 as const, endpoint: 'wss://x', deviceToken: 't', publicKeyB64: 'a2V5' },
      sessionId: 'sess-1',
      agent: 'claude'
    }
    render(<SingleSessionApp params={params} />)
    expect(screen.getByTestId('native-chat-structured-session').textContent).toBe('sess-1:claude')
  })

  it('does not persist the pairing offer to localStorage', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const params = {
      offer: { v: 2 as const, endpoint: 'wss://x', deviceToken: 't', publicKeyB64: 'a2V5' },
      sessionId: 'sess-1',
      agent: 'claude'
    }
    render(<SingleSessionApp params={params} />)
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
