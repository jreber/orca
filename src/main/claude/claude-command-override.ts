import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'
import {
  hasPathSeparatorToken,
  splitExecutableToken
} from '../../shared/managed-agent-command-token'
import { resolveCliCommand } from '../../shared/node-cli-command-resolution'

type ClaudeCommandOverrideOptions = {
  homePath?: string
  platform?: NodeJS.Platform
  pathEnv?: string | null
}

export type ClaudeCommandOverrideResolution =
  | { kind: 'none' }
  | { kind: 'honored'; command: string }
  | { kind: 'ignored'; reason: string }

/**
 * How structured chat reads `agentCmdOverrides.claude`. The setting is a terminal command line,
 * but structured chat builds its own argv and spawns without a shell, so only a lone executable
 * (`~/bin/local-claude`, a bare name, an absolute or quoted path) runs faithfully. A wrapper
 * (`npx …`, `env FOO=1 claude`), arguments, an unexpanded variable, or a relative path (`./claude`,
 * `bin/claude`: relative to which directory?) is ignored rather than half-run.
 * A bare name resolves like the default `claude` lookup.
 */
export function resolveClaudeCommandOverride(
  override: string | undefined,
  options: ClaudeCommandOverrideOptions = {}
): ClaudeCommandOverrideResolution {
  const platform = options.platform ?? process.platform
  const split = splitExecutableToken(override, { platform })
  if (!split) {
    return { kind: 'none' }
  }
  const { token, rest } = split
  if (rest) {
    return {
      kind: 'ignored',
      reason: looksLikeUnquotedPathWithSpaces(token, rest)
        ? 'it looks like a path with spaces; quote paths that contain spaces'
        : 'it is not a single executable (it has arguments)'
    }
  }
  if (token.includes('$') || (platform === 'win32' && token.includes('%'))) {
    return { kind: 'ignored', reason: 'environment variables in it are not expanded' }
  }
  const homePath = options.homePath ?? homedir()
  if (token === '~') {
    return { kind: 'honored', command: homePath }
  }
  if (token.startsWith('~/') || token.startsWith('~\\')) {
    const join = platform === 'win32' ? win32.join : posix.join
    return { kind: 'honored', command: join(homePath, token.slice(2)) }
  }
  if (!hasPathSeparatorToken(token)) {
    return {
      kind: 'honored',
      command: resolveCliCommand(token, { platform, homePath, pathEnv: options.pathEnv })
    }
  }
  // Why: the pre-spawn check would read a relative path against Orca's cwd while the spawn reads
  // it against the workspace's, so neither answer is trustworthy.
  const isAbsolute = platform === 'win32' ? win32.isAbsolute : posix.isAbsolute
  if (!isAbsolute(token)) {
    return {
      kind: 'ignored',
      reason: 'a relative path is ambiguous; use an absolute path or one starting with ~/'
    }
  }
  return { kind: 'honored', command: token }
}

/** `C:\Program Files\Claude\claude.exe` unquoted: the path splits at the space, and what follows
 *  continues the path (a relative-looking path segment) rather than being a flag or a new path. */
function looksLikeUnquotedPathWithSpaces(token: string, rest: string): boolean {
  const next = rest.split(/\s+/, 1)[0] ?? ''
  return (
    hasPathSeparatorToken(token) &&
    hasPathSeparatorToken(next) &&
    !/^[-~/\\]/.test(next) &&
    !win32.isAbsolute(next)
  )
}

// Windows' default PATHEXT order, for a path given without an extension.
const WINDOWS_EXECUTABLE_EXTENSIONS = ['.com', '.exe', '.bat', '.cmd']
const warnedIgnoredOverrides = new Set<string>()

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() === true
}

/**
 * The file an override path names, or null. On Windows an extension-less path resolves through
 * PATHEXT to the file that exists (`C:\tools\claude` → `C:\tools\claude.cmd`): the spawn needs the
 * real extension, both to route `.cmd`/`.bat` through cmd.exe and because libuv only appends
 * `.com`/`.exe` itself.
 */
function resolveCommandPath(command: string, platform: NodeJS.Platform): string | null {
  if (platform !== 'win32' || win32.extname(command) !== '') {
    return isFile(command) ? command : null
  }
  for (const extension of WINDOWS_EXECUTABLE_EXTENSIONS) {
    if (isFile(`${command}${extension}`)) {
      return `${command}${extension}`
    }
  }
  return null
}

/** The Claude executable a structured session spawns: the override when it can be honored,
 *  otherwise the default lookup (warning once per ignored value). */
export function resolveStructuredClaudeCommand(
  override: string | undefined,
  fallback: () => string,
  options: ClaudeCommandOverrideOptions = {}
): string {
  const resolution = resolveClaudeCommandOverride(override, options)
  if (resolution.kind === 'none') {
    return fallback()
  }
  if (resolution.kind === 'ignored') {
    const key = override ?? ''
    if (!warnedIgnoredOverrides.has(key)) {
      warnedIgnoredOverrides.add(key)
      console.warn(
        `[claude] structured chat ignores the Claude command override ${JSON.stringify(override)}: ${resolution.reason}; using the default claude`
      )
    }
    return fallback()
  }
  // An unresolved bare name is left to the spawn, whose error already names it.
  if (!hasPathSeparatorToken(resolution.command)) {
    return resolution.command
  }
  const command = resolveCommandPath(resolution.command, options.platform ?? process.platform)
  if (command === null) {
    // Fail before spawn with the override named; a bare ENOENT would not say where it came from.
    throw new Error(
      `Claude command override ${JSON.stringify(override)} was not found at ${resolution.command}`
    )
  }
  return command
}

export function resetClaudeCommandOverrideWarningsForTests(): void {
  warnedIgnoredOverrides.clear()
}
