// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_HISTORY } from './native-chat-composer-state'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'
import { useNativeChatStructuredComposerSend } from './use-native-chat-structured-composer-send'

vi.mock('@/lib/native-chat-telemetry', () => ({ emitNativeChatMessageSent: vi.fn() }))
vi.mock('@/lib/worker-terminal-takeover-report', () => ({
  reportStructuredSessionUserInput: vi.fn()
}))

function makeTransport(
  overrides: Partial<NativeChatStructuredComposerTransport> = {}
): NativeChatStructuredComposerTransport {
  return {
    send: vi.fn(() => true),
    dispatchCommand: vi.fn(async () => ({ handled: false, accepted: false, error: null })),
    optionsSurface: {
      getSnapshot: () => [],
      setOption: vi.fn(),
      invokeAction: vi.fn(),
      subscribe: () => () => {}
    },
    optionSnapshot: [],
    onError: vi.fn(),
    runtime: 'local',
    sessionId: 'session-1',
    runtimeEnvironmentId: null,
    ...overrides
  }
}

function renderSend(transport?: NativeChatStructuredComposerTransport) {
  return renderHook(() =>
    useNativeChatStructuredComposerSend({
      agent: 'claude',
      draft: 'hello',
      imageAttachments: [],
      structuredTransport: transport,
      clearImageAttachments: vi.fn(),
      clearSkillOrigin: vi.fn(),
      setHistory: vi.fn((update) => update(EMPTY_HISTORY)),
      setDraft: vi.fn(),
      setCaret: vi.fn()
    })
  )
}

describe('useNativeChatStructuredComposerSend return value', () => {
  it('resolves true once the transport accepts the send', async () => {
    const transport = makeTransport()
    const hook = renderSend(transport)
    await expect(hook.result.current('hello')).resolves.toBe(true)
    expect(transport.send).toHaveBeenCalled()
  })

  it('resolves false without dispatching when there is no structured transport', async () => {
    const hook = renderSend(undefined)
    await expect(hook.result.current('hello')).resolves.toBe(false)
  })

  it('resolves false when the transport rejects the send', async () => {
    const transport = makeTransport({ send: vi.fn(() => false) })
    const hook = renderSend(transport)
    await expect(hook.result.current('hello')).resolves.toBe(false)
  })

  it('resolves false when a handled command is not accepted', async () => {
    const transport = makeTransport({
      dispatchCommand: vi.fn(async () => ({ handled: true, accepted: false, error: 'nope' }))
    })
    const hook = renderSend(transport)
    await expect(hook.result.current('/clear')).resolves.toBe(false)
    expect(transport.onError).toHaveBeenCalledWith('nope')
  })
})
