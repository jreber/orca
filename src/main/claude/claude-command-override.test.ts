import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetClaudeCommandOverrideWarningsForTests,
  resolveClaudeCommandOverride,
  resolveStructuredClaudeCommand
} from './claude-command-override'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-override-'))
  tempDirs.push(dir)
  return dir
}

function makeExecutable(path: string): string {
  writeFileSync(path, '#!/bin/sh\n')
  chmodSync(path, 0o755)
  return path
}

beforeEach(() => {
  resetClaudeCommandOverrideWarningsForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function honored(command: string) {
  return { kind: 'honored', command }
}

describe('resolveClaudeCommandOverride', () => {
  it('reports none when unset, empty, or whitespace', () => {
    expect(resolveClaudeCommandOverride(undefined)).toEqual({ kind: 'none' })
    expect(resolveClaudeCommandOverride('')).toEqual({ kind: 'none' })
    expect(resolveClaudeCommandOverride('   ')).toEqual({ kind: 'none' })
  })

  it('trims and honors an absolute path', () => {
    expect(resolveClaudeCommandOverride('  /opt/bin/claude  ')).toEqual(honored('/opt/bin/claude'))
  })

  it('honors a quoted path containing spaces', () => {
    expect(resolveClaudeCommandOverride('"/opt/My Tools/claude"')).toEqual(
      honored('/opt/My Tools/claude')
    )
  })

  it('expands a leading ~ using the home path', () => {
    const home = join('/home', 'tester')
    expect(resolveClaudeCommandOverride('~/bin/local-claude', { homePath: home })).toEqual(
      honored(join(home, 'bin', 'local-claude'))
    )
    expect(resolveClaudeCommandOverride('~', { homePath: home })).toEqual(honored(home))
  })

  it('expands a Windows-style ~\\ prefix', () => {
    const home = 'C:\\Users\\tester'
    expect(
      resolveClaudeCommandOverride('~\\bin\\x', { homePath: home, platform: 'win32' })
    ).toEqual(honored(win32.join(home, 'bin', 'x')))
  })

  it('honors a lone quoted Windows path', () => {
    expect(
      resolveClaudeCommandOverride('"C:\\Program Files\\x\\claude.exe"', { platform: 'win32' })
    ).toEqual(honored('C:\\Program Files\\x\\claude.exe'))
  })

  it('does not expand ~ in the middle of a value or ~user forms', () => {
    expect(resolveClaudeCommandOverride('/x/~/y', { homePath: '/home/t' })).toEqual(
      honored('/x/~/y')
    )
    expect(resolveClaudeCommandOverride('~other/bin/c', { homePath: '/home/t' })).toEqual(
      honored('~other/bin/c')
    )
  })

  it('resolves a bare command name through PATH to its absolute path', () => {
    const binDir = makeTempDir()
    const executable = makeExecutable(join(binDir, 'local-claude'))
    expect(
      resolveClaudeCommandOverride('local-claude', {
        platform: 'linux',
        pathEnv: binDir,
        homePath: makeTempDir()
      })
    ).toEqual(honored(executable))
  })

  it('keeps a bare command name when nothing on PATH matches', () => {
    expect(
      resolveClaudeCommandOverride('local-claude', {
        platform: 'linux',
        pathEnv: makeTempDir(),
        homePath: makeTempDir()
      })
    ).toEqual(honored('local-claude'))
  })

  // Structured chat spawns without a shell, so a command line cannot run faithfully.
  it.each([
    ['/o/claude --model opus', 'linux'],
    ['npx -y @anthropic-ai/claude-code', 'linux'],
    ['env FOO=1 claude', 'linux'],
    ['ANTHROPIC_MODEL=x claude', 'linux'],
    ['op run -- claude', 'darwin'],
    ['caffeinate -i claude', 'darwin'],
    ['& "C:\\tools\\claude.exe"', 'win32'],
    ['C:\\tools\\claude.cmd --beta', 'win32']
  ] as const)('ignores %s, which is more than one executable', (override, platform) => {
    expect(resolveClaudeCommandOverride(override, { platform })).toMatchObject({
      kind: 'ignored'
    })
  })

  it('ignores unexpanded environment variables', () => {
    expect(
      resolveClaudeCommandOverride('%USERPROFILE%\\bin\\claude.cmd', { platform: 'win32' })
    ).toMatchObject({ kind: 'ignored' })
    expect(resolveClaudeCommandOverride('$HOME/bin/claude', { platform: 'linux' })).toMatchObject({
      kind: 'ignored'
    })
  })
})

describe('resolveStructuredClaudeCommand', () => {
  it('uses an existing override and the fallback when there is none', () => {
    const executable = makeExecutable(join(makeTempDir(), 'claude'))
    expect(resolveStructuredClaudeCommand(executable, () => 'fallback')).toBe(executable)
    expect(resolveStructuredClaudeCommand(undefined, () => 'fallback')).toBe('fallback')
    expect(resolveStructuredClaudeCommand('  ', () => 'fallback')).toBe('fallback')
  })

  it('honors the ~/bin/local-claude form', () => {
    const home = makeTempDir()
    mkdirSync(join(home, 'bin'))
    const executable = makeExecutable(join(home, 'bin', 'local-claude'))
    expect(
      resolveStructuredClaudeCommand('~/bin/local-claude', () => 'fallback', { homePath: home })
    ).toBe(executable)
  })

  it('falls back for a command line and warns once, naming the override', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const override = 'npx -y @anthropic-ai/claude-code'
    expect(resolveStructuredClaudeCommand(override, () => 'fallback')).toBe('fallback')
    expect(resolveStructuredClaudeCommand(override, () => 'fallback')).toBe('fallback')
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain(JSON.stringify(override))
  })

  it('fails before spawn, naming the override, when its path does not exist', () => {
    const missing = join(makeTempDir(), 'nope', 'claude')
    expect(() => resolveStructuredClaudeCommand(missing, () => 'fallback')).toThrow(
      `Claude command override ${JSON.stringify(missing)} was not found at ${missing}`
    )
  })
})
