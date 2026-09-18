// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNativeChatComposerInterrupt } from './use-native-chat-composer-interrupt'

const sendRuntimePtyInput = vi.fn()
vi.mock('@/runtime/runtime-terminal-inspection', () => ({
  sendRuntimePtyInput: (...args: unknown[]) => sendRuntimePtyInput(...args)
}))
vi.mock('@/lib/agent-paste-draft', () => ({
  getSettingsForAgentTabRuntimeOwner: () => ({ owner: 'settings' })
}))

describe('useNativeChatComposerInterrupt', () => {
  beforeEach(() => sendRuntimePtyInput.mockClear())

  it('resolves null when there is no target pty', () => {
    const { result } = renderHook(() =>
      useNativeChatComposerInterrupt({
        targetPtyId: null,
        terminalTabId: 'tab-1',
        isWorking: false,
        cancelPendingSends: vi.fn()
      })
    )

    expect(result.current.resolveTarget()).toBeNull()
  })

  it('resolves the pty and its runtime-owner settings when a target exists', () => {
    const { result } = renderHook(() =>
      useNativeChatComposerInterrupt({
        targetPtyId: 'pty-1',
        terminalTabId: 'tab-1',
        isWorking: false,
        cancelPendingSends: vi.fn()
      })
    )

    expect(result.current.resolveTarget()).toEqual({
      ptyId: 'pty-1',
      settings: { owner: 'settings' }
    })
  })

  it('calls onStop instead of writing ESC while the agent is working', () => {
    const onStop = vi.fn()
    const cancelPendingSends = vi.fn()
    const { result } = renderHook(() =>
      useNativeChatComposerInterrupt({
        targetPtyId: 'pty-1',
        terminalTabId: 'tab-1',
        isWorking: true,
        onStop,
        cancelPendingSends
      })
    )

    result.current.interrupt()

    expect(cancelPendingSends).toHaveBeenCalled()
    expect(onStop).toHaveBeenCalled()
    expect(sendRuntimePtyInput).not.toHaveBeenCalled()
  })

  it('writes ESC over the pty when idle and no onStop is active', () => {
    const cancelPendingSends = vi.fn()
    const { result } = renderHook(() =>
      useNativeChatComposerInterrupt({
        targetPtyId: 'pty-1',
        terminalTabId: 'tab-1',
        isWorking: false,
        cancelPendingSends
      })
    )

    result.current.interrupt()

    expect(cancelPendingSends).toHaveBeenCalled()
    expect(sendRuntimePtyInput).toHaveBeenCalledWith({ owner: 'settings' }, 'pty-1', '\x1b')
  })

  it('no-ops the ESC write when there is no target pty', () => {
    const cancelPendingSends = vi.fn()
    const { result } = renderHook(() =>
      useNativeChatComposerInterrupt({
        targetPtyId: null,
        terminalTabId: 'tab-1',
        isWorking: false,
        cancelPendingSends
      })
    )

    result.current.interrupt()

    expect(cancelPendingSends).toHaveBeenCalled()
    expect(sendRuntimePtyInput).not.toHaveBeenCalled()
  })
})
