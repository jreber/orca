import { describe, it, expect } from 'vitest'
import {
  matchesNativeChatAnnotateShortcut,
  nativeChatAnnotateShortcutLabel
} from './native-chat-annotation-shortcut'

type Combo = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

function combo(overrides: Partial<Combo>): Combo {
  return {
    key: 'h',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides
  }
}

describe('nativeChatAnnotateShortcutLabel', () => {
  it('uses Cmd/Shift glyphs on Mac', () => {
    expect(nativeChatAnnotateShortcutLabel(true)).toBe('⌘⇧H')
  })

  it('uses Ctrl+/Shift+ text elsewhere', () => {
    expect(nativeChatAnnotateShortcutLabel(false)).toBe('Ctrl+Shift+H')
  })
})

describe('matchesNativeChatAnnotateShortcut', () => {
  it('matches Cmd+Shift+H on Mac', () => {
    expect(matchesNativeChatAnnotateShortcut(combo({ metaKey: true, shiftKey: true }), true)).toBe(
      true
    )
  })

  it('does not match Ctrl+Shift+H on Mac (wrong primary modifier)', () => {
    expect(matchesNativeChatAnnotateShortcut(combo({ ctrlKey: true, shiftKey: true }), true)).toBe(
      false
    )
  })

  it('matches Ctrl+Shift+H on Windows/Linux', () => {
    expect(matchesNativeChatAnnotateShortcut(combo({ ctrlKey: true, shiftKey: true }), false)).toBe(
      true
    )
  })

  it('requires the shift modifier', () => {
    expect(matchesNativeChatAnnotateShortcut(combo({ metaKey: true }), true)).toBe(false)
  })

  it('rejects when alt is held', () => {
    expect(
      matchesNativeChatAnnotateShortcut(
        combo({ metaKey: true, shiftKey: true, altKey: true }),
        true
      )
    ).toBe(false)
  })

  it('rejects a different key', () => {
    expect(
      matchesNativeChatAnnotateShortcut(combo({ key: 'k', metaKey: true, shiftKey: true }), true)
    ).toBe(false)
  })
})
