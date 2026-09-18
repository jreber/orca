import type { NativeChatAnnotation } from './native-chat-annotation-queue'

function quoteBlock(text: string): string {
  return text
    .split(/\r\n|\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

/**
 * Prepends each pending annotation as a quoted-context block above the
 * user's typed message, oldest first. The typed message is never reordered
 * or altered.
 */
export function mergeNativeChatAnnotationsIntoMessage(
  annotations: readonly NativeChatAnnotation[],
  message: string
): string {
  if (annotations.length === 0) {
    return message
  }
  // A blank line between the quote and the note is required, not stylistic:
  // Markdown's lazy-continuation rule sweeps a line right after `> quote`
  // into the SAME blockquote when it isn't blank, so without it the note
  // reads (to a renderer and to the model) as more quoted response text
  // rather than the user's own commentary.
  const blocks = annotations.map(
    (annotation) => `${quoteBlock(annotation.quotedText)}\n\n${annotation.note}`
  )
  return message ? `${blocks.join('\n\n')}\n\n${message}` : blocks.join('\n\n')
}
