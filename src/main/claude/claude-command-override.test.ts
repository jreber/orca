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
    // `~other/…` is not expanded, which leaves a relative path: ambiguous, so not honored.
    expect(resolveClaudeCommandOverride('~other/bin/c', { homePath: '/home/t' })).toMatchObject({
      kind: 'ignored'
    })
  })

  it.each([
    ['./bin/claude', 'linux'],
    ['bin/claude', 'darwin'],
    ['../claude', 'linux'],
    ['.\\bin\\claude.cmd', 'win32'],
    ['bin\\claude.exe', 'win32']
  ] as const)('ignores the relative path %s as ambiguous', (override, platform) => {
    expect(resolveClaudeCommandOverride(override, { platform })).toEqual({
      kind: 'ignored',
      reason: 'a relative path is ambiguous; use an absolute path or one starting with ~/'
    })
  })

  it.each([
    ['C:\\Program Files\\Claude\\claude.exe', 'win32'],
    ['/Applications/My Tools/claude', 'darwin']
  ] as const)('says to quote the unquoted path with spaces %s', (override, platform) => {
    expect(resolveClaudeCommandOverride(override, { platform })).toEqual({
      kind: 'ignored',
      reason: 'it looks like a path with spaces; quote paths that contain spaces'
    })
  })

  it.each([
    ['/o/claude --model opus', 'linux'],
    ['/usr/bin/env /opt/claude', 'linux'],
    ['C:\\tools\\claude.cmd --settings C:\\x.json', 'win32']
  ] as const)('keeps the arguments reason for %s', (override, platform) => {
    expect(resolveClaudeCommandOverride(override, { platform })).toEqual({
      kind: 'ignored',
      reason: 'it is not a single executable (it has arguments)'
    })
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

  it('resolves an extension-less Windows path to the .cmd that exists', () => {
    const dir = makeTempDir()
    const cmd = join(dir, 'claude.cmd')
    writeFileSync(cmd, '@echo off\r\n')
    expect(
      resolveStructuredClaudeCommand(join(dir, 'claude'), () => 'fallback', { platform: 'win32' })
    ).toBe(cmd)
  })

  it('prefers .exe over .cmd for an extension-less Windows path, as PATHEXT does', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'claude.cmd'), '')
    writeFileSync(join(dir, 'claude.exe'), '')
    expect(
      resolveStructuredClaudeCommand(join(dir, 'claude'), () => 'fallback', { platform: 'win32' })
    ).toBe(join(dir, 'claude.exe'))
  })

  it('fails before spawn, naming the override, for an extension-less Windows path with no match', () => {
    const dir = makeTempDir()
    // An extension-less file cannot be spawned on Windows, so it is not a match either.
    writeFileSync(join(dir, 'claude'), '')
    const override = join(dir, 'claude')
    expect(() =>
      resolveStructuredClaudeCommand(override, () => 'fallback', { platform: 'win32' })
    ).toThrow(`Claude command override ${JSON.stringify(override)} was not found at ${override}`)
  })

  it('falls back for a relative path and warns with the reason', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      resolveStructuredClaudeCommand('./bin/claude', () => 'fallback', { platform: 'linux' })
    ).toBe('fallback')
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]?.[0])).toContain('"./bin/claude"')
    expect(String(warn.mock.calls[0]?.[0])).toContain('a relative path is ambiguous')
  })

  it('fails before spawn when the override names a directory', () => {
    const dir = makeTempDir()
    expect(() => resolveStructuredClaudeCommand(dir, () => 'fallback')).toThrow(
      `Claude command override ${JSON.stringify(dir)} was not found at ${dir}`
    )
  })

  it('fails before spawn, naming the override, when its path does not exist', () => {
    const missing = join(makeTempDir(), 'nope', 'claude')
    expect(() => resolveStructuredClaudeCommand(missing, () => 'fallback')).toThrow(
      `Claude command override ${JSON.stringify(missing)} was not found at ${missing}`
    )
  })
})
