import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve('config/scripts/verify-web-build.mjs')
const temporaryRoots = []

const RELATIVE_PAGE = '<script type="module" src="./assets/entry.js"></script>'
const ABSOLUTE_PAGE = '<script type="module" src="/assets/entry.js"></script>'

function createWebBuildFixture(pages) {
  const root = mkdtempSync(join(tmpdir(), 'orca-verify-web-build-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'out/web'), { recursive: true })
  for (const [name, html] of Object.entries(pages)) {
    writeFileSync(join(root, 'out/web', name), html)
  }
  return root
}

function runVerify(root) {
  return spawnSync(process.execPath, [scriptPath], { cwd: root, encoding: 'utf8' })
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('verify-web-build', () => {
  it('passes when both web entry pages use relative asset URLs', () => {
    const root = createWebBuildFixture({
      'web-index.html': RELATIVE_PAGE,
      'single-session-index.html': RELATIVE_PAGE
    })

    expect(runVerify(root).status).toBe(0)
  })

  it('fails naming web-index.html when it references /assets/ absolutely', () => {
    const root = createWebBuildFixture({
      'web-index.html': ABSOLUTE_PAGE,
      'single-session-index.html': RELATIVE_PAGE
    })

    const result = runVerify(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('web-index.html')
  })

  it('fails naming single-session-index.html when it references /assets/ absolutely', () => {
    const root = createWebBuildFixture({
      'web-index.html': RELATIVE_PAGE,
      'single-session-index.html': ABSOLUTE_PAGE
    })

    const result = runVerify(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('single-session-index.html')
  })

  it('fails when the single-session page is missing from the build', () => {
    const root = createWebBuildFixture({ 'web-index.html': RELATIVE_PAGE })

    expect(runVerify(root).status).not.toBe(0)
  })
})
