import { homedir } from 'node:os'
import { join } from 'node:path'

/** The user's configured `agentCmdOverrides.claude`, normalized; null when there is none. */
export function resolveClaudeCommandOverride(
  override: string | undefined,
  homePath: string = homedir()
): string | null {
  const trimmed = override?.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed === '~') {
    return homePath
  }
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(homePath, trimmed.slice(2))
  }
  return trimmed
}

export function resolveStructuredClaudeCommand(
  override: string | undefined,
  fallback: () => string
): string {
  return resolveClaudeCommandOverride(override) ?? fallback()
}
