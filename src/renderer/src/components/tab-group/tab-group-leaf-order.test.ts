import { describe, expect, it } from 'vitest'
import type { TabGroupLayoutNode } from '../../../../shared/tab-types'
import { collectLeafGroupIds } from './tab-group-leaf-order'

describe('collectLeafGroupIds', () => {
  it('returns the leaf id for a lone group', () => {
    expect(collectLeafGroupIds({ type: 'leaf', groupId: 'g1' })).toEqual(['g1'])
  })

  it('walks a simple side-by-side split first → second', () => {
    const layout: TabGroupLayoutNode = {
      type: 'split',
      direction: 'horizontal',
      first: { type: 'leaf', groupId: 'left' },
      second: { type: 'leaf', groupId: 'right' }
    }
    expect(collectLeafGroupIds(layout)).toEqual(['left', 'right'])
  })

  it('returns nested/mixed splits in visual DFS order', () => {
    const layout: TabGroupLayoutNode = {
      type: 'split',
      direction: 'horizontal',
      first: {
        type: 'split',
        direction: 'vertical',
        first: { type: 'leaf', groupId: 'top-left' },
        second: { type: 'leaf', groupId: 'bottom-left' }
      },
      second: {
        type: 'split',
        direction: 'vertical',
        first: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: 'a' },
          second: { type: 'leaf', groupId: 'b' }
        },
        second: { type: 'leaf', groupId: 'right-bottom' }
      }
    }
    expect(collectLeafGroupIds(layout)).toEqual([
      'top-left',
      'bottom-left',
      'a',
      'b',
      'right-bottom'
    ])
  })

  it('ignores split ratios', () => {
    const layout: TabGroupLayoutNode = {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.85,
      first: { type: 'leaf', groupId: 'big' },
      second: { type: 'leaf', groupId: 'narrow' }
    }
    expect(collectLeafGroupIds(layout)).toEqual(['big', 'narrow'])
  })
})
