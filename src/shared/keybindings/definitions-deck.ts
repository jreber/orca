import type { KeybindingDefinition } from './types'
import { platformBindings } from './definitions-support'

export const KEYBINDING_DEFINITION_DECK: readonly KeybindingDefinition[] = [
  {
    id: 'pane.toggleDeck',
    title: 'Toggle card deck layout',
    group: 'Card Deck',
    scope: 'tabs',
    searchKeywords: ['shortcut', 'deck', 'card', 'toggle', 'tabs', 'overview'],
    // Why: any Mod+Shift+D-based default would be stolen while a terminal is
    // focused — the pane-level keyboard hook claims terminal-scope chords
    // (splitRight/splitDown) at window capture before the workspace handler.
    // Mod+Shift+K is free in every default set and matches no terminal action.
    defaultBindings: platformBindings(['Mod+Shift+K']),
    allowInTerminal: true
  },
  {
    id: 'pane.focusNext',
    title: 'Focus next deck card',
    group: 'Card Deck',
    scope: 'tabs',
    searchKeywords: ['shortcut', 'deck', 'card', 'focus', 'next', 'rotate', 'tab'],
    // Why: cards are the focused group's tabs, so rotation cycles that group's
    // active tab while the deck is on.
    defaultBindings: {
      darwin: ['Mod+Shift+PageDown'],
      linux: ['Ctrl+Shift+PageDown'],
      win32: ['Ctrl+Shift+PageDown']
    },
    allowInTerminal: true
  },
  {
    id: 'pane.focusPrevious',
    title: 'Focus previous deck card',
    group: 'Card Deck',
    scope: 'tabs',
    searchKeywords: ['shortcut', 'deck', 'card', 'focus', 'previous', 'rotate', 'tab'],
    defaultBindings: {
      darwin: ['Mod+Shift+PageUp'],
      linux: ['Ctrl+Shift+PageUp'],
      win32: ['Ctrl+Shift+PageUp']
    },
    allowInTerminal: true
  }
]
