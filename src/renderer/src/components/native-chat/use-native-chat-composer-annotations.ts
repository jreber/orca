import { useMemo } from 'react'
import { mergeNativeChatAnnotationsIntoMessage } from './native-chat-annotation-merge'
import {
  clearNativeChatAnnotations,
  removeNativeChatAnnotation,
  useNativeChatAnnotations,
  type NativeChatAnnotation
} from './native-chat-annotation-queue'

export type NativeChatComposerAnnotations = {
  annotations: readonly NativeChatAnnotation[]
  /** Draft with every pending annotation prepended, oldest first — the text actually sent. */
  draftWithAnnotations: string
  onRemoveAnnotation: (id: string) => void
  clearAnnotations: () => void
}

/** Pane-scoped annotation queue plus the send-time merge of pending annotations into the draft. */
export function useNativeChatComposerAnnotations(
  paneKey: string,
  draft: string
): NativeChatComposerAnnotations {
  const annotations = useNativeChatAnnotations(paneKey)
  const draftWithAnnotations = useMemo(
    () => mergeNativeChatAnnotationsIntoMessage(annotations, draft),
    [annotations, draft]
  )
  return {
    annotations,
    draftWithAnnotations,
    onRemoveAnnotation: (id: string) => removeNativeChatAnnotation(paneKey, id),
    clearAnnotations: () => clearNativeChatAnnotations(paneKey)
  }
}
