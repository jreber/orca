import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveClaudeCommandOverride,
  resolveStructuredClaudeCommand
} from './claude-command-override'

describe('resolveClaudeCommandOverride', () => {
  it('returns null when unset, empty, or whitespace', () => {
    expect(resolveClaudeCommandOverride(undefined)).toBeNull()
    expect(resolveClaudeCommandOverride('')).toBeNull()
    expect(resolveClaudeCommandOverride('   ')).toBeNull()
  })

  it('trims and returns absolute paths unchanged', () => {
    expect(resolveClaudeCommandOverride('  /opt/bin/claude  ')).toBe('/opt/bin/claude')
  })

  it('expands a leading ~ using the home path', () => {
    const home = join('/home', 'tester')
    expect(resolveClaudeCommandOverride('~/bin/local-claude', home)).toBe(
      join(home, 'bin', 'local-claude')
    )
    expect(resolveClaudeCommandOverride('~', home)).toBe(home)
  })

  it('does not expand ~ in the middle of a value or ~user forms', () => {
    expect(resolveClaudeCommandOverride('/x/~/y', '/home/t')).toBe('/x/~/y')
    expect(resolveClaudeCommandOverride('~other/bin/c', '/home/t')).toBe('~other/bin/c')
  })

  it('passes a bare command name through for PATH lookup', () => {
    expect(resolveClaudeCommandOverride('local-claude')).toBe('local-claude')
  })
})

describe('resolveStructuredClaudeCommand', () => {
  it('uses the override when set and the fallback otherwise', () => {
    expect(resolveStructuredClaudeCommand('/o/claude', () => 'fallback')).toBe('/o/claude')
    expect(resolveStructuredClaudeCommand(undefined, () => 'fallback')).toBe('fallback')
    expect(resolveStructuredClaudeCommand('  ', () => 'fallback')).toBe('fallback')
  })
})
