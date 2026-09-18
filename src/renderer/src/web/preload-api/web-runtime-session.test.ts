// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  registerEphemeralWebRuntimeEnvironment,
  updateEnvironmentFromResponse,
  webRuntimeState
} from './web-runtime-session'
import type { StoredWebRuntimeEnvironment } from '../web-runtime-environment'

function makeEnvironment(id: string): StoredWebRuntimeEnvironment {
  return {
    id,
    name: 'Embedded session',
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
    runtimeId: null,
    preferredEndpointId: `ws-${id}`,
    endpoints: [
      {
        id: `ws-${id}`,
        kind: 'websocket',
        label: 'WebSocket',
        endpoint: 'wss://x',
        deviceToken: 't',
        publicKeyB64: 'a2V5'
      }
    ]
  }
}

describe('updateEnvironmentFromResponse with an ephemeral environment', () => {
  afterEach(() => {
    webRuntimeState.activeEnvironment = null
    vi.restoreAllMocks()
  })

  it('updates the in-memory environment but never persists to localStorage', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    const environment = makeEnvironment('web-ephemeral-1')
    registerEphemeralWebRuntimeEnvironment(environment)

    updateEnvironmentFromResponse(environment, {
      id: 'call',
      ok: true,
      result: { pairedDeviceId: 'device-1' },
      _meta: { runtimeId: 'runtime-1' }
    })

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(webRuntimeState.activeEnvironment?.runtimeId).toBe('runtime-1')
    expect(webRuntimeState.activeEnvironment?.pairedDeviceId).toBe('device-1')
  })
})
