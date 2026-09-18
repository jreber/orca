import { describe, expect, it, vi } from 'vitest'
import {
  STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY,
  WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY
} from '../../../shared/protocol-version'
import { routeWebRuntimeConnectionFrame } from './web-runtime-connection-frame-router'

describe('web runtime connection capability advertisement', () => {
  it('advertises GitHub PR suppression during E2EE authentication', async () => {
    const sendEncrypted = vi.fn(() => true)

    await routeWebRuntimeConnectionFrame(JSON.stringify({ type: 'e2ee_ready' }), undefined, {
      getState: () => 'handshaking',
      getSharedKey: () => new Uint8Array([1]),
      getSocket: () => null,
      pairingToken: 'token',
      pending: new Map(),
      subscriptions: new Map(),
      sendEncrypted,
      setConnected: vi.fn(),
      setAuthFailed: vi.fn(),
      rejectUnauthorized: vi.fn(),
      notifyUnauthorized: vi.fn()
    })

    expect(sendEncrypted).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'e2ee_auth',
        clientCapabilities: expect.arrayContaining([
          WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY
        ])
      })
    )
  })

  it('advertises structured agent session support during E2EE authentication', async () => {
    // Without this, a host refuses every agentSession.* call from a web client —
    // including the single-session embed, whose whole purpose is showing a
    // structured agent session — with 'structured_agent_session_unsupported'.
    const sendEncrypted = vi.fn(() => true)

    await routeWebRuntimeConnectionFrame(JSON.stringify({ type: 'e2ee_ready' }), undefined, {
      getState: () => 'handshaking',
      getSharedKey: () => new Uint8Array([1]),
      getSocket: () => null,
      pairingToken: 'token',
      pending: new Map(),
      subscriptions: new Map(),
      sendEncrypted,
      setConnected: vi.fn(),
      setAuthFailed: vi.fn(),
      rejectUnauthorized: vi.fn(),
      notifyUnauthorized: vi.fn()
    })

    expect(sendEncrypted).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'e2ee_auth',
        clientCapabilities: expect.arrayContaining([STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY])
      })
    )
  })
})
