import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'
import {
  extractExecutableToken,
  hasPathSeparatorToken
} from '../../shared/managed-agent-command-token'
import { resolveCliCommand } from '../../shared/node-cli-command-resolution'

type ClaudeCommandOverrideOptions = {
  homePath?: string
  platform?: NodeJS.Platform
  pathEnv?: string | null
}

/**
 * The executable of the user's configured `agentCmdOverrides.claude`; null when there is none.
 *
 * Why only the first word: the setting is a terminal command line (`claude --model opus`,
 * `"/opt/My Tools/claude" --beta`), and its arguments do not apply to structured chat — the
 * launch builds its own argv. A bare name is resolved like the default `claude` lookup so the
 * CLI's own directory can join PATH and Windows PATHEXT applies.
 */
export function resolveClaudeCommandOverride(
  override: string | undefined,
  options: ClaudeCommandOverrideOptions = {}
): string | null {
  const platform = options.platform ?? process.platform
  const token = extractExecutableToken(override, { platform })
  if (!token) {
    return null
  }
  const homePath = options.homePath ?? homedir()
  if (token === '~') {
    return homePath
  }
  if (token.startsWith('~/') || token.startsWith('~\\')) {
    const join = platform === 'win32' ? win32.join : posix.join
    return join(homePath, token.slice(2))
  }
  if (!hasPathSeparatorToken(token)) {
    return resolveCliCommand(token, { platform, homePath, pathEnv: options.pathEnv })
  }
  return token
}

export function resolveStructuredClaudeCommand(
  override: string | undefined,
  fallback: () => string
): string {
  return resolveClaudeCommandOverride(override) ?? fallback()
}
