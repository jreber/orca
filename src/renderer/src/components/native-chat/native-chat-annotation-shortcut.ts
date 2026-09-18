/** Platform-correct binding for opening the response-annotation popover from a
 *  text selection.
 *
 *  Key: Cmd/Ctrl + Shift + H. Mod+Shift+A — the natural "Annotate" mnemonic —
 *  is already bound (editor.addReviewNote, and terminal.selectAll on
 *  Linux/Windows), so this uses H ("Highlight [and annotate] the selection")
 *  instead. Primary modifier follows AGENTS.md — metaKey on Mac, ctrlKey
 *  elsewhere.
 */

export function nativeChatAnnotateShortcutLabel(isMac: boolean): string {
  return isMac ? '⌘⇧H' : 'Ctrl+Shift+H'
}

/** True when the event is the annotate chord for the given platform.
 *  Pure so it can be unit-tested without a DOM. */
export function matchesNativeChatAnnotateShortcut(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
  isMac: boolean
): boolean {
  if (e.altKey || !e.shiftKey) {
    return false
  }
  // Primary modifier is Cmd on Mac, Ctrl on Linux/Windows — and must be the
  // *only* primary modifier so this can't collide with Cmd+Ctrl chords.
  const primary = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
  if (!primary) {
    return false
  }
  return e.key.toLowerCase() === 'h'
}
