import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { createRuntimeDesktopPairingOffer } from './helpers/paired-electron-client'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  createStructuredAgentSessionId,
  structuredAgentSessionCreateParams
} from '../../src/shared/structured-agent-session-create'

// The seed turn `agentSession.create` sends; it becomes the session's latest prompt.
const SEED_TEXT = /just been started in this workspace/

const SCREENSHOT_DIR = process.env.ORCA_E2E_SCREENSHOT_DIR

// A stream-json Claude stand-in first on PATH: the e2e HOME has no Claude sign-in, and the create
// path under test (attach, tab publish, seed turn, status projection) is Orca's, not the CLI's.
function structuredClaudeStubLaunchEnv(): NodeJS.ProcessEnv {
  const stubDir = path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'structured-claude-stub')
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  return { [pathKey]: [stubDir, process.env[pathKey] ?? ''].filter(Boolean).join(path.delimiter) }
}

async function openHiddenWindow(app: ElectronApplication, url: string): Promise<Page> {
  const pagePromise = app.waitForEvent('window')
  await app.evaluate(
    async ({ BrowserWindow }, { partition, targetUrl }) => {
      const embedWindow = new BrowserWindow({
        height: 900,
        show: false,
        width: 900,
        webPreferences: { contextIsolation: true, nodeIntegration: false, partition, sandbox: true }
      })
      await embedWindow.loadURL(targetUrl)
    },
    { partition: `e2e-single-session-${randomUUID()}`, targetUrl: url }
  )
  return pagePromise
}

async function runtimeOrigin(page: Page): Promise<{ origin: string; pairingUrl: string }> {
  const offer = await createRuntimeDesktopPairingOffer(page)
  expect(offer.webClientUrl, 'runtime must serve the bundled web client').toBeTruthy()
  return { origin: new URL(offer.webClientUrl!).origin, pairingUrl: offer.pairingUrl }
}

test('serves and boots the single-session embed page', async ({ electronApp, orcaPage }) => {
  await waitForSessionReady(orcaPage)
  const { origin } = await runtimeOrigin(orcaPage)

  for (const path of ['/single-session-index.html', '/orca/single-session-index.html']) {
    const response = await fetch(`${origin}${path}`)
    expect(response.status, path).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('<title>Orca Session</title>')
  }

  // No params: the React root must boot and render its own "missing link" state — proof the
  // page and its assets loaded, not a Chromium error page.
  const embed = await openHiddenWindow(electronApp, `${origin}/single-session-index.html`)
  await expect(embed.getByText(/Missing or invalid session link/)).toBeVisible()
  if (SCREENSHOT_DIR) {
    await embed.screenshot({ path: `${SCREENSHOT_DIR}/e2e-single-session-missing-params.png` })
  }
  await embed.close()
})

test.describe('with a stub Claude CLI', () => {
  test.use({ launchEnv: structuredClaudeStubLaunchEnv() })

  test('a session created over agentSession.create gets an Agent Dashboard card and renders in the embed', async ({
    electronApp,
    orcaPage
  }) => {
    await waitForSessionReady(orcaPage)
    const worktreeId = await waitForActiveWorktree(orcaPage)
    await orcaPage.evaluate(async () => {
      const settings = await window.api.settings.set({
        experimentalNativeChat: true,
        experimentalStructuredNativeChat: true,
        experimentalAgentDashboardPopout: true,
        experimentalAgentDashboardMode: 'in-window',
        experimentalAgentDashboardShowIdle: true
      })
      window.__store?.setState({ settings })
    })

    const sessionId = createStructuredAgentSessionId('claude', randomUUID)
    const params = structuredAgentSessionCreateParams({
      sessionId,
      worktree: `id:${worktreeId}`,
      agent: 'claude',
      randomUuid: randomUUID
    })
    const created = await orcaPage.evaluate(
      (createParams) =>
        window.api.runtime.call({ method: 'agentSession.create', params: createParams }),
      params
    )
    expect(created, JSON.stringify(created)).toMatchObject({
      ok: true,
      result: { ok: true, value: { sessionId } }
    })

    await orcaPage.getByRole('button', { name: /Agent Dashboard/ }).click()
    const dashboard = orcaPage.locator('[data-agent-dashboard-sheet]')
    await dashboard.waitFor({ state: 'visible' })
    await expect(dashboard.getByText(SEED_TEXT).first()).toBeVisible({ timeout: 30_000 })
    await expect(dashboard.getByText('Claude Chat').first()).toBeVisible()
    if (SCREENSHOT_DIR) {
      // The sheet is an overlay a page-level capture of the hidden window can miss.
      await dashboard.screenshot({ path: `${SCREENSHOT_DIR}/e2e-dashboard-card.png` })
    }

    // What the Obsidian plugin's <webview> loads for this session.
    const { origin, pairingUrl } = await runtimeOrigin(orcaPage)
    const embedUrl = new URL(`${origin}/single-session-index.html`)
    embedUrl.search = new URLSearchParams({
      pairing: pairingUrl,
      session: sessionId,
      agent: 'claude'
    }).toString()
    const embed = await openHiddenWindow(electronApp, embedUrl.toString())
    await expect(embed.getByText(SEED_TEXT).first()).toBeVisible({ timeout: 30_000 })
    if (SCREENSHOT_DIR) {
      await embed.screenshot({ path: `${SCREENSHOT_DIR}/e2e-single-session.png` })
    }
    await embed.close()
  })
})
