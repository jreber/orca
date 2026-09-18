// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_HISTORY } from './native-chat-composer-state'

const sendNativeChatMessage = vi.fn()

vi.mock('./native-chat-runtime-send', () => ({
  sendNativeChatMessage: (...args: unknown[]) => sendNativeChatMessage(...args),
  sendNativeChatTypedCommand: vi.fn(),
  submitNativeChatPrompt: vi.fn()
}))
vi.mock('./native-chat-runtime-image-send', () => ({
  sendNativeChatMessageWithImageAttachments: vi.fn()
}))
vi.mock('@/lib/native-chat-telemetry', () => ({ emitNativeChatMessageSent: vi.fn() }))
vi.mock('./native-chat-launch-draft-send', () => ({
  resolveNativeChatLaunchDraftSend: () => ({ sendOptions: undefined })
}))
vi.mock('../../store', () => ({
  useAppStore: { getState: () => ({ clearNativeChatLaunchDraft: vi.fn() }) }
}))

import { useNativeChatPtyComposerSend } from './use-native-chat-pty-composer-send'

function renderSend(overrides: Partial<Parameters<typeof useNativeChatPtyComposerSend>[0]> = {}) {
  return renderHook(() =>
    useNativeChatPtyComposerSend({
      agent: 'claude',
      draft: 'hello',
      imageAttachments: [],
      disabled: false,
      isDispatchingSessionOption: false,
      launchDraftResolved: false,
      resolveTarget: () => ({ settings: {}, ptyId: 'pty-1' }),
      classifySend: () => 'chat',
      sessionOptionsSurface: null,
      terminalTabId: 'tab-1',
      trackPendingSend: vi.fn(),
      setHistory: vi.fn((update) => update(EMPTY_HISTORY)),
      setDraft: vi.fn(),
      setCaret: vi.fn(),
      clearSkillOrigin: vi.fn(),
      clearImageAttachments: vi.fn(),
      setNotice: vi.fn(),
      ...overrides
    })
  )
}

describe('useNativeChatPtyComposerSend return value', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendNativeChatMessage.mockReturnValue({ cancel: vi.fn(), settleAfterMs: 0 })
  })

  it('returns true once it dispatches a message', () => {
    const hook = renderSend()
    expect(hook.result.current()).toBe(true)
    expect(sendNativeChatMessage).toHaveBeenCalled()
  })

  it('returns false without sending when the draft and attachments are both empty', () => {
    const hook = renderSend({ draft: '   ' })
    expect(hook.result.current()).toBe(false)
    expect(sendNativeChatMessage).not.toHaveBeenCalled()
  })

  it('returns false without sending while disabled', () => {
    const hook = renderSend({ disabled: true })
    expect(hook.result.current()).toBe(false)
    expect(sendNativeChatMessage).not.toHaveBeenCalled()
  })

  it('returns false without sending while a session option is mid-dispatch', () => {
    const hook = renderSend({ isDispatchingSessionOption: true })
    expect(hook.result.current()).toBe(false)
    expect(sendNativeChatMessage).not.toHaveBeenCalled()
  })

  it('returns false without sending when no target resolves', () => {
    const hook = renderSend({ resolveTarget: () => null })
    expect(hook.result.current()).toBe(false)
    expect(sendNativeChatMessage).not.toHaveBeenCalled()
  })
})
