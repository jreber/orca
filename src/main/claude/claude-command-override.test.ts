import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveClaudeCommandOverride,
  resolveStructuredClaudeCommand
} from './claude-command-override'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-override-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('resolveClaudeCommandOverride', () => {
  it('returns null when unset, empty, or whitespace', () => {
    expect(resolveClaudeCommandOverride(undefined)).toBeNull()
    expect(resolveClaudeCommandOverride('')).toBeNull()
    expect(resolveClaudeCommandOverride('   ')).toBeNull()
  })

  it('trims and returns absolute paths unchanged', () => {
    expect(resolveClaudeCommandOverride('  /opt/bin/claude  ')).toBe('/opt/bin/claude')
  })

  it('keeps only the executable when the override carries arguments', () => {
    expect(resolveClaudeCommandOverride('/o/claude --model opus')).toBe('/o/claude')
  })

  it('unquotes a quoted path containing spaces and drops its arguments', () => {
    expect(resolveClaudeCommandOverride('"/opt/My Tools/claude" --x')).toBe('/opt/My Tools/claude')
  })

  it('expands a leading ~ using the home path', () => {
    const home = join('/home', 'tester')
    expect(resolveClaudeCommandOverride('~/bin/local-claude', { homePath: home })).toBe(
      join(home, 'bin', 'local-claude')
    )
    expect(resolveClaudeCommandOverride('~', { homePath: home })).toBe(home)
  })

  it('expands ~ on the executable and drops the arguments', () => {
    const home = join('/home', 'tester')
    expect(resolveClaudeCommandOverride('~/bin/local-claude --flag', { homePath: home })).toBe(
      join(home, 'bin', 'local-claude')
    )
  })

  it('expands a Windows-style ~\\ prefix', () => {
    const home = 'C:\\Users\\tester'
    expect(
      resolveClaudeCommandOverride('~\\bin\\x --flag', { homePath: home, platform: 'win32' })
    ).toBe(win32.join(home, 'bin', 'x'))
  })

  it('passes a Windows absolute path through', () => {
    expect(
      resolveClaudeCommandOverride('C:\\tools\\claude.cmd --beta', { platform: 'win32' })
    ).toBe('C:\\tools\\claude.cmd')
  })

  it('does not expand ~ in the middle of a value or ~user forms', () => {
    expect(resolveClaudeCommandOverride('/x/~/y', { homePath: '/home/t' })).toBe('/x/~/y')
    expect(resolveClaudeCommandOverride('~other/bin/c', { homePath: '/home/t' })).toBe(
      '~other/bin/c'
    )
  })

  it('resolves a bare command name through PATH to its absolute path', () => {
    const binDir = makeTempDir()
    const executable = join(binDir, 'local-claude')
    writeFileSync(executable, '#!/bin/sh\n')
    chmodSync(executable, 0o755)
    expect(
      resolveClaudeCommandOverride('local-claude --model opus', {
        platform: 'linux',
        pathEnv: binDir,
        homePath: makeTempDir()
      })
    ).toBe(executable)
  })

  it('returns a bare command name unchanged when nothing on PATH matches', () => {
    expect(
      resolveClaudeCommandOverride('local-claude', {
        platform: 'linux',
        pathEnv: makeTempDir(),
        homePath: makeTempDir()
      })
    ).toBe('local-claude')
  })
})

describe('resolveStructuredClaudeCommand', () => {
  it('uses the override when set and the fallback otherwise', () => {
    expect(resolveStructuredClaudeCommand('/o/claude', () => 'fallback')).toBe('/o/claude')
    expect(resolveStructuredClaudeCommand('/o/claude --model opus', () => 'fallback')).toBe(
      '/o/claude'
    )
    expect(resolveStructuredClaudeCommand(undefined, () => 'fallback')).toBe('fallback')
    expect(resolveStructuredClaudeCommand('  ', () => 'fallback')).toBe('fallback')
  })
})
