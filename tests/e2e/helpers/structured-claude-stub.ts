import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@stablyai/playwright-test'
import type { Locator, Page } from '@stablyai/playwright-test'

/** The stream-json Claude stand-in (`claude`/`claude.cmd` + `claude-stub.cjs`). */
export const STRUCTURED_CLAUDE_STUB_DIR = path.join(
  process.cwd(),
  'tests',
  'e2e',
  'fixtures',
  'structured-claude-stub'
)

/** The seed turn `agentSession.create` sends; it becomes the session's latest prompt. */
export const STRUCTURED_SESSION_SEED_TEXT = /just been started in this workspace/

// A stream-json Claude stand-in first on PATH: the e2e HOME has no Claude sign-in, and the create
// path under test (attach, tab publish, seed turn, status projection) is Orca's, not the CLI's.
export function structuredClaudeStubLaunchEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  return {
    [pathKey]: [STRUCTURED_CLAUDE_STUB_DIR, process.env[pathKey] ?? '']
      .filter(Boolean)
      .join(path.delimiter),
    ...extra
  }
}

/** Turns on structured Claude chat and the in-window Agent Dashboard (idle cards included). */
export async function enableStructuredChatDashboard(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settings = await window.api.settings.set({
      experimentalNativeChat: true,
      experimentalStructuredNativeChat: true,
      experimentalAgentDashboardPopout: true,
      experimentalAgentDashboardMode: 'in-window',
      experimentalAgentDashboardShowIdle: true
    })
    window.__store?.setState({ settings })
  })
}

/** Opens the Agent Dashboard sheet and waits for the seeded "Claude Chat" card. */
export async function openDashboardWithSeededClaudeCard(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /Agent Dashboard/ }).click()
  const dashboard = page.locator('[data-agent-dashboard-sheet]')
  await dashboard.waitFor({ state: 'visible' })
  await expect(dashboard.getByText(STRUCTURED_SESSION_SEED_TEXT).first()).toBeVisible({
    timeout: 30_000
  })
  await expect(dashboard.getByText('Claude Chat').first()).toBeVisible()
  return dashboard
}

export type ClaudeStubInvocation = { entry: string; cwd: string; argv: string[] }

/** Reads the `CLAUDE_STUB_LOG` records; an unwritten log means no stub has run yet. */
export function readClaudeStubInvocations(logPath: string): ClaudeStubInvocation[] {
  let text: string
  try {
    text = readFileSync(logPath, 'utf8')
  } catch {
    return []
  }
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ClaudeStubInvocation)
}

/** A chat-session launch, as opposed to a `--version` probe. */
export function isClaudeSessionLaunch(invocation: ClaudeStubInvocation): boolean {
  return !invocation.argv.includes('--version') && !invocation.argv.includes('-v')
}
