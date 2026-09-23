// What the Obsidian plugin's "New session" button does, end to end against the real runtime RPCs:
// register a plain (non-git) folder as a project, find its workspace, and create a Claude chat in
// it with a plain-UUID session id. Plus: that chat launches the `agentCmdOverrides.claude` binary.
import { randomUUID } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'
import {
  enableStructuredChatDashboard,
  isClaudeSessionLaunch,
  openDashboardWithSeededClaudeCard,
  readClaudeStubInvocations,
  STRUCTURED_CLAUDE_STUB_DIR,
  structuredClaudeStubLaunchEnv
} from './helpers/structured-claude-stub'
import { computeAgentSessionPayloadFingerprint } from '../../src/shared/agent-session-mutation-envelope'
import { structuredAgentSessionCreateParams } from '../../src/shared/structured-agent-session-create'

const SCREENSHOT_DIR = process.env.ORCA_E2E_SCREENSHOT_DIR
const DEFAULT_STUB_PATH = path.join(STRUCTURED_CLAUDE_STUB_DIR, 'claude')

async function runtimeCall<T>(page: Page, method: string, params?: unknown): Promise<T> {
  const response = (await page.evaluate(
    (request) => window.api.runtime.call(request),
    params === undefined ? { method } : { method, params }
  )) as { ok: boolean; result?: T }
  expect(response, `${method}: ${JSON.stringify(response)}`).toMatchObject({ ok: true })
  return response.result as T
}

/** repo.add (twice: idempotent) → repo.list → worktree.list, as the plugin resolves its vault. */
async function addFolderProject(page: Page, folder: string): Promise<string> {
  type Repo = { id: string; path: string; kind: string }
  const params = { path: folder, kind: 'folder', displayName: 'Vault' }
  const { repo } = await runtimeCall<{ repo: Repo }>(page, 'repo.add', params)
  expect(repo).toMatchObject({ path: folder, kind: 'folder' })
  const again = await runtimeCall<{ repo: Repo }>(page, 'repo.add', params)
  expect(again.repo.id, 'repo.add is idempotent for a registered path').toBe(repo.id)
  const { repos } = await runtimeCall<{ repos: Repo[] }>(page, 'repo.list')
  expect(repos.filter((entry) => entry.path === folder).map((entry) => entry.id)).toEqual([repo.id])

  const { worktrees } = await runtimeCall<{ worktrees: { id: string; path: string }[] }>(
    page,
    'worktree.list',
    { repo: `id:${repo.id}` }
  )
  const workspaces = worktrees.filter((worktree) => worktree.path === folder)
  expect(workspaces, JSON.stringify(worktrees)).toHaveLength(1)
  return workspaces[0].id
}

/** `agentSession.create` with the plugin's session id (a bare UUID) and envelope. */
async function createClaudeSessionLikeThePlugin(page: Page, workspaceId: string): Promise<string> {
  const sessionId = randomUUID()
  const worktree = `id:${workspaceId}`
  const params = structuredAgentSessionCreateParams({
    sessionId,
    worktree,
    agent: 'claude',
    randomUuid: randomUUID
  })
  // The plugin computes its fingerprint itself; it must be the one Orca recomputes.
  expect(params.envelope.payloadFingerprint).toBe(
    computeAgentSessionPayloadFingerprint({
      method: 'agentSession.create',
      sessionId,
      fields: { worktree, agent: 'claude', resumeFrom: undefined }
    })
  )
  expect(params.envelope.expectedRuntimeFence).toBeNull()
  const created = await runtimeCall<unknown>(page, 'agentSession.create', params)
  expect(created, JSON.stringify(created)).toMatchObject({ ok: true, value: { sessionId } })
  return sessionId
}

function makeFolder(prefix: string): string {
  // realpath: tmpdir can be a symlink alias, and Orca keys projects by the path it was given.
  return realpathSync.native(mkdtempSync(path.join(os.tmpdir(), prefix)))
}

test.describe('structured Claude chat in a non-git folder project', () => {
  test.use({
    // Per test, so each test reads only the launches its own app made. `seedTestRepo` is named
    // only because Playwright needs a destructured first argument (as omp-launch-environment).
    launchEnv: async ({ seedTestRepo }, run, testInfo) => {
      void seedTestRepo
      mkdirSync(testInfo.outputDir, { recursive: true })
      await run(
        structuredClaudeStubLaunchEnv({ CLAUDE_STUB_LOG: testInfo.outputPath('claude-stub.log') })
      )
    }
  })

  test('the plugin create flow yields a normal session with a dashboard card', async ({
    orcaPage
  }, testInfo) => {
    const folder = makeFolder('orca-e2e-vault-')
    try {
      await waitForSessionReady(orcaPage)
      await enableStructuredChatDashboard(orcaPage)
      const workspaceId = await addFolderProject(orcaPage, folder)
      const sessionId = await createClaudeSessionLikeThePlugin(orcaPage, workspaceId)

      const dashboard = await openDashboardWithSeededClaudeCard(orcaPage)
      // The card names the folder project it runs in.
      await expect(dashboard.getByText('Vault', { exact: true }).first()).toBeVisible()
      if (SCREENSHOT_DIR) {
        await dashboard.screenshot({ path: `${SCREENSHOT_DIR}/e2e-folder-card.png` })
      }

      // What the plugin's pane polls to decide the session still exists.
      type InventoryTab = { type: string; sessionId?: string; agent?: string }
      const inventory = await runtimeCall<{ snapshots: { tabs: InventoryTab[] }[] }>(
        orcaPage,
        'session.tabs.listAll'
      )
      const agentTabs = inventory.snapshots
        .flatMap((snapshot) => snapshot.tabs)
        .filter((tab) => tab.type === 'agent-session' && tab.sessionId === sessionId)
      expect(agentTabs, JSON.stringify(inventory)).toEqual([
        expect.objectContaining({ sessionId, agent: 'claude' })
      ])

      // The chat runs rooted at the folder (the stub records its working directory).
      const launches = readClaudeStubInvocations(testInfo.outputPath('claude-stub.log')).filter(
        isClaudeSessionLaunch
      )
      expect(launches.length, 'a Claude session process was launched').toBeGreaterThan(0)
      expect(launches.map((launch) => launch.cwd)).toContain(folder)
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })

  // `with-arguments`: the setting is a terminal command line; structured chat runs its first word.
  for (const form of ['absolute', 'home-relative', 'with-arguments'] as const) {
    test(`a chat session launches the agentCmdOverrides.claude binary (${form})`, async ({
      electronApp,
      orcaPage
    }, testInfo) => {
      test.skip(process.platform === 'win32', 'the override stub is a POSIX shell script')
      const folder = makeFolder('orca-e2e-override-')
      try {
        await waitForSessionReady(orcaPage)
        // `~` expands against the main process's home: prove that is the isolated e2e HOME.
        const home = await electronApp.evaluate(({ app }) => app.getPath('home'))
        const osHome = await electronApp.evaluate(() =>
          process.getBuiltinModule('node:os').homedir()
        )
        expect(osHome).toBe(home)
        expect(home).not.toBe(os.homedir())

        const overridePath = path.join(home, 'bin', 'my-claude')
        mkdirSync(path.dirname(overridePath), { recursive: true })
        const stubScript = path.join(STRUCTURED_CLAUDE_STUB_DIR, 'claude-stub.cjs')
        writeFileSync(
          overridePath,
          `#!/bin/sh\nCLAUDE_STUB_ENTRY="$0" exec node ${JSON.stringify(stubScript)} "$@"\n`
        )
        chmodSync(overridePath, 0o755)
        const override = {
          absolute: overridePath,
          'home-relative': '~/bin/my-claude',
          'with-arguments': `${overridePath} --model opus`
        }[form]

        await enableStructuredChatDashboard(orcaPage)
        await orcaPage.evaluate(async (claude) => {
          const settings = await window.api.settings.set({ agentCmdOverrides: { claude } })
          window.__store?.setState({ settings })
        }, override)
        const workspaceId = await addFolderProject(orcaPage, folder)
        await createClaudeSessionLikeThePlugin(orcaPage, workspaceId)
        await openDashboardWithSeededClaudeCard(orcaPage)

        const launches = readClaudeStubInvocations(testInfo.outputPath('claude-stub.log')).filter(
          isClaudeSessionLaunch
        )
        const entries = launches.map((launch) => launch.entry)
        expect(entries.length, 'a Claude session process was launched').toBeGreaterThan(0)
        expect(entries).toContain(overridePath)
        expect(entries).not.toContain(DEFAULT_STUB_PATH)
        if (form === 'with-arguments') {
          // Only the first word is the binary; the override's own arguments are a terminal
          // command line and must not reach the structured launch.
          const argv = launches.flatMap((launch) => launch.argv)
          expect(argv).not.toContain('opus')
          expect(argv).not.toContain('--model')
        }
      } finally {
        rmSync(folder, { recursive: true, force: true })
      }
    })
  }
})
