import { describe, expect, it } from 'vitest'
import {
  TAB_GROUP_DECK_ABSOLUTE_FALLBACK_MAX_WIDTH,
  TAB_GROUP_DECK_MIN_WIDTH,
  clampTabGroupDeckWidth,
  computeDefaultTabGroupDeckWidth,
  computeMaxTabGroupDeckWidth,
  resolveTabGroupDeckWidth
} from './tab-group-deck-width'

describe('tab group deck width', () => {
  it('defaults to one third of the window width', () => {
    expect(computeDefaultTabGroupDeckWidth(1200)).toBe(400)
    expect(resolveTabGroupDeckWidth(null, 1200)).toBe(400)
    expect(resolveTabGroupDeckWidth(undefined, 1200)).toBe(400)
  })

  it('clamps an explicit width to the min/max bounds', () => {
    expect(clampTabGroupDeckWidth(100, 1200)).toBe(TAB_GROUP_DECK_MIN_WIDTH)
    expect(clampTabGroupDeckWidth(2000, 1200)).toBe(computeMaxTabGroupDeckWidth(1200))
    expect(resolveTabGroupDeckWidth(500, 1200)).toBe(500)
  })

  it('leaves the reserved non-deck area when the window is narrow', () => {
    expect(computeMaxTabGroupDeckWidth(500)).toBe(TAB_GROUP_DECK_MIN_WIDTH)
  })

  it('uses the fallback max outside DOM environments', () => {
    expect(computeMaxTabGroupDeckWidth(null)).toBe(TAB_GROUP_DECK_ABSOLUTE_FALLBACK_MAX_WIDTH)
    expect(computeDefaultTabGroupDeckWidth(undefined)).toBe(TAB_GROUP_DECK_MIN_WIDTH)
  })
})
