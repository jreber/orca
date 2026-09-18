import { afterEach, describe, expect, it } from 'vitest'
import {
  addNativeChatAnnotation,
  clearNativeChatAnnotationQueueForTests,
  clearNativeChatAnnotations,
  readNativeChatAnnotations,
  removeNativeChatAnnotation
} from './native-chat-annotation-queue'

afterEach(() => {
  clearNativeChatAnnotationQueueForTests()
})

describe('native-chat-annotation-queue', () => {
  it('reads an empty list for an untouched scope', () => {
    expect(readNativeChatAnnotations('pane-1')).toEqual([])
  })

  it('appends annotations in creation order, scoped per pane', () => {
    addNativeChatAnnotation('pane-1', 'quoted a', 'note a')
    addNativeChatAnnotation('pane-1', 'quoted b', 'note b')
    addNativeChatAnnotation('pane-2', 'other pane', 'note c')

    const pane1 = readNativeChatAnnotations('pane-1')
    expect(pane1).toHaveLength(2)
    expect(pane1[0]).toMatchObject({ quotedText: 'quoted a', note: 'note a' })
    expect(pane1[1]).toMatchObject({ quotedText: 'quoted b', note: 'note b' })
    expect(readNativeChatAnnotations('pane-2')).toHaveLength(1)
  })

  it('trims the note and drops an annotation whose note is blank', () => {
    addNativeChatAnnotation('pane-1', 'quoted', '  padded note  ')
    addNativeChatAnnotation('pane-1', 'quoted', '   ')

    const pane1 = readNativeChatAnnotations('pane-1')
    expect(pane1).toHaveLength(1)
    expect(pane1[0]?.note).toBe('padded note')
  })

  it('removes a single annotation by id without touching the rest', () => {
    addNativeChatAnnotation('pane-1', 'quoted a', 'note a')
    addNativeChatAnnotation('pane-1', 'quoted b', 'note b')
    const [first, second] = readNativeChatAnnotations('pane-1')

    removeNativeChatAnnotation('pane-1', first!.id)

    const remaining = readNativeChatAnnotations('pane-1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe(second!.id)
  })

  it('clears every annotation for a scope', () => {
    addNativeChatAnnotation('pane-1', 'quoted a', 'note a')
    clearNativeChatAnnotations('pane-1')
    expect(readNativeChatAnnotations('pane-1')).toEqual([])
  })
})
