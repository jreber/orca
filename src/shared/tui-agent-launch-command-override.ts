import type { GlobalSettings } from './global-settings-types'
import type { TuiAgent } from './tui-agent'

/**
 * Whether the user replaced this agent's launch command (a full terminal command line).
 *
 * In-app launches with such an override still route to a terminal by design, so the whole command
 * line applies. The one structured path that honors it is `agentSession.create` for Claude (e.g.
 * from the paired Obsidian plugin), which runs only the override's executable — the first word —
 * and drops its arguments (see resolveClaudeCommandOverride in src/main/claude).
 *
 * Shared rather than renderer-local because both launch surfaces have to answer it: the renderer
 * routes such a launch back to the TUI, and orchestration falls a worker back to a PTY so the
 * custom command still applies.
 *
 * Arguments and environment are deliberately not read here. Structured native chat applies the
 * configured environment itself, and the Arguments field is a terminal/TUI concern: structured
 * chat drives Claude through the Agent SDK and Codex through app-server, whose option sets are
 * independently versioned and need not match the interactive CLI's.
 */
export function hasExplicitTuiLaunchCommand(
  settings: Partial<Pick<GlobalSettings, 'agentCmdOverrides'>> | null | undefined,
  agent: TuiAgent
): boolean {
  return Boolean(settings?.agentCmdOverrides?.[agent]?.trim())
}
