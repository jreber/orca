import { describe, expect, it } from 'vitest'
import { mergeNativeChatAnnotationsIntoMessage } from './native-chat-annotation-merge'
import type { NativeChatAnnotation } from './native-chat-annotation-queue'

function annotation(overrides: Partial<NativeChatAnnotation> = {}): NativeChatAnnotation {
  return { id: 'id', quotedText: 'quoted text', note: 'a note', ...overrides }
}

describe('mergeNativeChatAnnotationsIntoMessage', () => {
  it('returns the message unchanged when there are no annotations', () => {
    expect(mergeNativeChatAnnotationsIntoMessage([], 'hello')).toBe('hello')
  })

  it('prepends a single annotation as a quoted block above the typed message', () => {
    const result = mergeNativeChatAnnotationsIntoMessage(
      [annotation({ quotedText: 'the response text', note: 'is this right?' })],
      'my typed message'
    )
    expect(result).toBe('> the response text\n\nis this right?\n\nmy typed message')
  })

  it('prepends multiple annotations in creation order, oldest first', () => {
    const result = mergeNativeChatAnnotationsIntoMessage(
      [
        annotation({ quotedText: 'first', note: 'note one' }),
        annotation({ quotedText: 'second', note: 'note two' })
      ],
      'typed'
    )
    expect(result).toBe('> first\n\nnote one\n\n> second\n\nnote two\n\ntyped')
  })

  it('quotes every line of a multi-line selection', () => {
    const result = mergeNativeChatAnnotationsIntoMessage(
      [annotation({ quotedText: 'line one\nline two', note: 'note' })],
      'typed'
    )
    expect(result).toBe('> line one\n> line two\n\nnote\n\ntyped')
  })

  it('keeps the blank line from swallowing the note into the blockquote (markdown lazy-continuation)', () => {
    const result = mergeNativeChatAnnotationsIntoMessage(
      [annotation({ quotedText: 'quoted', note: 'note' })],
      ''
    )
    // A renderer (or the model reading raw markdown) must see two separate
    // blocks: a blockquote, then a plain paragraph. No blank line here would
    // make the note a continuation of the same blockquote.
    expect(result).toBe('> quoted\n\nnote')
    expect(result.split('\n\n')).toEqual(['> quoted', 'note'])
  })

  it('quotes CRLF-sourced selections without leaving a stray carriage return mid-line', () => {
    const result = mergeNativeChatAnnotationsIntoMessage(
      [annotation({ quotedText: 'line one\r\nline two', note: 'note' })],
      ''
    )
    expect(result).toBe('> line one\n> line two\n\nnote')
  })

  it('omits the trailing blank message when the user sends annotations with no typed text', () => {
    const result = mergeNativeChatAnnotationsIntoMessage([annotation()], '')
    expect(result).toBe('> quoted text\n\na note')
  })
})
