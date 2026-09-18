import { useSyncExternalStore } from 'react'

// Pane-scoped queue of user annotations on assistant messages, collected while
// reading a response and merged into the next outgoing message on send.
// Mirrors structured-agent-session-handoff-store.ts's module-map +
// useSyncExternalStore pattern so message-row (writer) and composer (reader)
// components share reactive state without a global Zustand slice.

export type NativeChatAnnotation = {
  id: string
  quotedText: string
  note: string
}

const queues = new Map<string, NativeChatAnnotation[]>()
const listeners = new Set<() => void>()
// Stable reference for the untouched-scope case: useSyncExternalStore treats a
// fresh `[]` literal each call as a change and loops forever re-rendering.
const EMPTY_ANNOTATIONS: NativeChatAnnotation[] = []

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function readNativeChatAnnotations(scopeKey: string): NativeChatAnnotation[] {
  return queues.get(scopeKey) ?? EMPTY_ANNOTATIONS
}

export function addNativeChatAnnotation(scopeKey: string, quotedText: string, note: string): void {
  const trimmedNote = note.trim()
  if (!trimmedNote) {
    return
  }
  const existing = queues.get(scopeKey) ?? []
  queues.set(scopeKey, [...existing, { id: crypto.randomUUID(), quotedText, note: trimmedNote }])
  notify()
}

export function removeNativeChatAnnotation(scopeKey: string, id: string): void {
  const existing = queues.get(scopeKey)
  if (!existing) {
    return
  }
  queues.set(
    scopeKey,
    existing.filter((annotation) => annotation.id !== id)
  )
  notify()
}

export function clearNativeChatAnnotations(scopeKey: string): void {
  if (!queues.delete(scopeKey)) {
    return
  }
  notify()
}

export function useNativeChatAnnotations(scopeKey: string): NativeChatAnnotation[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => readNativeChatAnnotations(scopeKey)
  )
}

export function clearNativeChatAnnotationQueueForTests(): void {
  queues.clear()
}
