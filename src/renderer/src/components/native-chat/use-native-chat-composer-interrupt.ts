import { useCallback } from 'react'
import { sendRuntimePtyInput } from '@/runtime/runtime-terminal-inspection'
import { getSettingsForAgentTabRuntimeOwner } from '@/lib/agent-paste-draft'
import type { NativeChatResolvedTarget } from './native-chat-composer-target'

// Why: a plain ESC byte is what the agent TUIs read as the interrupt key over a
// PTY (matching how xterm forwards Escape). The richer interrupt-intent
// inference (agent-interrupt-intent.ts) is driven by the existing PTY input
// observers, so writing ESC through the same send path feeds that machinery.
const ESC = '\x1b'

/** Resolves the live ptyId for a chat leaf and wires Escape/Stop to interrupt
 *  the agent, whether that means canceling optimistic sends, calling the
 *  caller's `onStop`, or writing ESC over the PTY. */
export function useNativeChatComposerInterrupt(args: {
  targetPtyId: string | null
  terminalTabId: string
  isWorking: boolean
  onStop?: () => void
  cancelPendingSends: () => void
}): {
  resolveTarget: () => NativeChatResolvedTarget | null
  interrupt: () => void
} {
  const { targetPtyId, terminalTabId, isWorking, onStop, cancelPendingSends } = args

  // Runtime owner settings route local vs remote (SSH) sends.
  const resolveTarget = useCallback((): NativeChatResolvedTarget | null => {
    if (!targetPtyId) {
      return null
    }
    return { ptyId: targetPtyId, settings: getSettingsForAgentTabRuntimeOwner(terminalTabId) }
  }, [targetPtyId, terminalTabId])

  const interrupt = useCallback(() => {
    cancelPendingSends()
    if (isWorking && onStop) {
      onStop()
      return
    }
    const target = resolveTarget()
    if (!target) {
      return
    }
    sendRuntimePtyInput(target.settings, target.ptyId, ESC)
  }, [cancelPendingSends, isWorking, onStop, resolveTarget])

  return { resolveTarget, interrupt }
}
