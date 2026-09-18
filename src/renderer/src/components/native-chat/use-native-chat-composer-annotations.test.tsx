// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useNativeChatComposerAnnotations } from './use-native-chat-composer-annotations'
import {
  addNativeChatAnnotation,
  clearNativeChatAnnotationQueueForTests,
  readNativeChatAnnotations
} from './native-chat-annotation-queue'

afterEach(() => clearNativeChatAnnotationQueueForTests())

describe('useNativeChatComposerAnnotations', () => {
  it('merges pending annotations into the draft, oldest first', () => {
    addNativeChatAnnotation('pane-1', 'first', 'note a')
    addNativeChatAnnotation('pane-1', 'second', 'note b')
    const { result } = renderHook(() => useNativeChatComposerAnnotations('pane-1', 'typed'))

    expect(result.current.annotations).toHaveLength(2)
    expect(result.current.draftWithAnnotations).toBe(
      '> first\n\nnote a\n\n> second\n\nnote b\n\ntyped'
    )
  })

  it('leaves the draft unchanged with no pending annotations', () => {
    const { result } = renderHook(() => useNativeChatComposerAnnotations('pane-1', 'typed'))

    expect(result.current.draftWithAnnotations).toBe('typed')
  })

  it('removes a single annotation without touching another pane', () => {
    addNativeChatAnnotation('pane-1', 'quoted', 'note')
    addNativeChatAnnotation('pane-2', 'other', 'note')
    const { result } = renderHook(() => useNativeChatComposerAnnotations('pane-1', ''))

    act(() => result.current.onRemoveAnnotation(result.current.annotations[0]!.id))

    expect(result.current.annotations).toEqual([])
    expect(readNativeChatAnnotations('pane-2')).toHaveLength(1)
  })

  it('clears every pending annotation for the pane', () => {
    addNativeChatAnnotation('pane-1', 'quoted', 'note')
    const { result } = renderHook(() => useNativeChatComposerAnnotations('pane-1', ''))

    act(() => result.current.clearAnnotations())

    expect(readNativeChatAnnotations('pane-1')).toEqual([])
  })
})
