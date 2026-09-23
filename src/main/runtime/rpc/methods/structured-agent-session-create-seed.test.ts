// A fresh `agentSession.create` is seeded with a non-action first turn so the session reaches the
// agent dashboard (which projects from turn status, not from tabs) without waiting for the user.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeAgentSessionPayloadFingerprint } from '../../../../shared/agent-session-mutation-envelope'
import type { OrcaRuntimeService } from '../../orca-runtime'
import {
  createStructuredAgentSessionForWorktree,
  STRUCTURED_AGENT_SESSION_CREATE_SEED_TEXT
} from './structured-agent-session-create'
import {
  attachParams,
  call,
  clearStructuredHostStub,
  envelope,
  hostCalls,
  installStructuredHostStub,
  runtimeCalls,
  SESSION,
  STRUCTURED_CLIENT
} from './structured-agent-session-rpc.test-fixture'

beforeEach(() => {
  installStructuredHostStub()
})

afterEach(() => {
  clearStructuredHostStub()
})

const WORKTREE = 'id:workspace-1'

function worktreeCreateParams() {
  return {
    envelope: envelope({
      expectedRuntimeFence: null,
      payloadFingerprint: computeAgentSessionPayloadFingerprint({
        method: 'agentSession.create',
        sessionId: SESSION,
        fields: { worktree: WORKTREE, agent: 'claude' }
      })
    }),
    worktree: WORKTREE,
    agent: 'claude'
  }
}

async function attachResultWith(overrides: Record<string, unknown>): Promise<unknown> {
  const stubAttach = hostCalls.attach.getMockImplementation() as () => Promise<object>
  return { ...(await stubAttach()), ...overrides }
}

describe('agentSession.create seed turn', () => {
  it('sends the seed once, after the tab is published, at the fence attach returned', async () => {
    hostCalls.attach.mockResolvedValueOnce(await attachResultWith({ fence: 7 }))

    const created = await call('agentSession.create', worktreeCreateParams(), STRUCTURED_CLIENT)

    expect(created).toMatchObject({ ok: true, result: { ok: true } })
    expect(hostCalls.send).toHaveBeenCalledOnce()
    const [, mutation] = hostCalls.send.mock.calls[0] as [unknown, Record<string, never>]
    const body = {
      kind: 'message',
      role: 'user',
      blocks: [{ type: 'text', text: STRUCTURED_AGENT_SESSION_CREATE_SEED_TEXT }]
    }
    expect(mutation).toMatchObject({
      body,
      envelope: {
        sessionId: SESSION,
        expectedRuntimeFence: 7,
        payloadFingerprint: computeAgentSessionPayloadFingerprint({
          method: 'agentSession.send',
          sessionId: SESSION,
          fields: { body: mutation.body }
        })
      }
    })
    expect(mutation.envelope).not.toMatchObject({
      clientOperationId: worktreeCreateParams().envelope.clientOperationId
    })
    expect(runtimeCalls.publishStructuredAgentSessionTab.mock.invocationCallOrder[0]).toBeLessThan(
      hostCalls.send.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('also seeds a create whose location the client supplied', async () => {
    const created = await call('agentSession.create', attachParams(), STRUCTURED_CLIENT)

    expect(created).toMatchObject({ ok: true, result: { ok: true } })
    expect(runtimeCalls.publishStructuredAgentSessionTab).not.toHaveBeenCalled()
    expect(hostCalls.send).toHaveBeenCalledOnce()
  })

  it('does not seed a replayed create whose session already has a submission, so a retry never adds a second turn', async () => {
    const base = (await attachResultWith({})) as unknown as {
      value: { page: Record<string, unknown> }
    }
    hostCalls.attach.mockResolvedValueOnce(
      await attachResultWith({
        replayed: true,
        value: {
          ...base.value,
          page: { ...base.value.page, submissions: [{ clientMessageId: 'seed' }] }
        }
      })
    )

    const created = await call('agentSession.create', worktreeCreateParams(), STRUCTURED_CLIENT)

    expect(created).toMatchObject({ ok: true, result: { ok: true } })
    expect(hostCalls.send).not.toHaveBeenCalled()
  })

  it('seeds a replayed create whose first run never reached the seed', async () => {
    // The first run can refuse after attach committed (its tab could not be confirmed) and before
    // the seed was sent; the client's retry replays, and must still give the chat its seed.
    hostCalls.attach.mockResolvedValueOnce(await attachResultWith({ replayed: true }))

    const created = await call('agentSession.create', worktreeCreateParams(), STRUCTURED_CLIENT)

    expect(created).toMatchObject({ ok: true, result: { ok: true } })
    expect(hostCalls.send).toHaveBeenCalledOnce()
  })

  it('does not seed a create that adopts an existing provider conversation', async () => {
    const created = await call('agentSession.create', worktreeCreateParams(), STRUCTURED_CLIENT, {
      resolveStructuredAgentSessionCreateIntent: vi.fn(async (params: { envelope: unknown }) => ({
        envelope: params.envelope,
        location: {
          executionHostId: 'local',
          wslDistro: null,
          workspaceId: 'workspace-1',
          workspaceKind: 'git-worktree'
        },
        provider: 'claude',
        agent: 'claude',
        accountHome: { variable: 'CLAUDE_CONFIG_DIR', path: '/host/.claude' },
        runtimeKind: 'native',
        adopt: { providerHandle: 'prior-session' }
      }))
    })

    expect(created).toMatchObject({ ok: true, result: { ok: true } })
    expect(hostCalls.attach.mock.calls[0]?.[1]).toHaveProperty('adopt')
    expect(hostCalls.send).not.toHaveBeenCalled()
  })

  it('does not seed a session whose history already has a submission', async () => {
    const base = (await attachResultWith({})) as unknown as {
      value: { page: Record<string, unknown> }
    }
    hostCalls.attach.mockResolvedValueOnce(
      await attachResultWith({
        value: {
          ...base.value,
          page: { ...base.value.page, submissions: [{ clientMessageId: 'earlier' }] }
        }
      })
    )

    await call('agentSession.create', worktreeCreateParams(), STRUCTURED_CLIENT)

    expect(hostCalls.send).not.toHaveBeenCalled()
  })

  it('still reports the committed create when the seed send fails', async () => {
    hostCalls.send.mockRejectedValueOnce(new Error('provider unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    hostCalls.journalSnapshot = vi.fn(() => ({ submissions: [] }))

    const created = await call('agentSession.create', worktreeCreateParams(), STRUCTURED_CLIENT)

    expect(created).toMatchObject({ ok: true, result: { ok: true, value: { sessionId: SESSION } } })
    expect(hostCalls.send).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('does not seed creates made for agent launch or orchestration, which send their own first turn', async () => {
    await createStructuredAgentSessionForWorktree({
      runtime: runtimeCalls as unknown as OrcaRuntimeService,
      ensureHost: async () => hostCalls as never,
      caller: { callerKey: 'trusted-local:runtime' } as never,
      envelope: worktreeCreateParams().envelope,
      worktree: WORKTREE,
      agent: 'claude',
      activate: false
    })

    expect(hostCalls.attach).toHaveBeenCalledOnce()
    expect(hostCalls.send).not.toHaveBeenCalled()
  })
})
