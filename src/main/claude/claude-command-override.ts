import { existsSync } from 'node:fs'
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
 * (`~/bin/local-claude`, a bare name, a quoted path) runs faithfully. A wrapper (`npx …`,
 * `env FOO=1 claude`), arguments, or an unexpanded variable is ignored rather than half-run.
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
    return { kind: 'ignored', reason: 'it is not a single executable (it has arguments)' }
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
  return { kind: 'honored', command: token }
}

const WINDOWS_EXECUTABLE_EXTENSIONS = ['', '.exe', '.cmd', '.bat', '.com']
const warnedIgnoredOverrides = new Set<string>()

function commandPathExists(command: string, platform: NodeJS.Platform): boolean {
  const extensions = platform === 'win32' ? WINDOWS_EXECUTABLE_EXTENSIONS : ['']
  return extensions.some((extension) => existsSync(`${command}${extension}`))
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
  // Fail before spawn with the override named; a bare ENOENT would not say where the path came
  // from. An unresolved bare name is left to the spawn, whose error already names it.
  if (
    hasPathSeparatorToken(resolution.command) &&
    !commandPathExists(resolution.command, options.platform ?? process.platform)
  ) {
    throw new Error(
      `Claude command override ${JSON.stringify(override)} was not found at ${resolution.command}`
    )
  }
  return resolution.command
}

export function resetClaudeCommandOverrideWarningsForTests(): void {
  warnedIgnoredOverrides.clear()
}
