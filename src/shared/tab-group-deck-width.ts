export const TAB_GROUP_DECK_MIN_WIDTH = 320
export const TAB_GROUP_DECK_MIN_NON_DECK_AREA = 320
export const TAB_GROUP_DECK_ABSOLUTE_FALLBACK_MAX_WIDTH = 2000
export const TAB_GROUP_DECK_DEFAULT_WIDTH_RATIO = 1 / 3

export function computeMaxTabGroupDeckWidth(windowWidth: number | null | undefined): number {
  if (typeof windowWidth !== 'number' || !Number.isFinite(windowWidth)) {
    return TAB_GROUP_DECK_ABSOLUTE_FALLBACK_MAX_WIDTH
  }
  return Math.max(TAB_GROUP_DECK_MIN_WIDTH, windowWidth - TAB_GROUP_DECK_MIN_NON_DECK_AREA)
}

export function clampTabGroupDeckWidth(
  width: number,
  windowWidth: number | null | undefined
): number {
  return Math.min(
    computeMaxTabGroupDeckWidth(windowWidth),
    Math.max(TAB_GROUP_DECK_MIN_WIDTH, width)
  )
}

/** 1/3 of the window by default, clamped the same as an explicit resize. */
export function computeDefaultTabGroupDeckWidth(windowWidth: number | null | undefined): number {
  if (typeof windowWidth !== 'number' || !Number.isFinite(windowWidth)) {
    return TAB_GROUP_DECK_MIN_WIDTH
  }
  return clampTabGroupDeckWidth(
    Math.round(windowWidth * TAB_GROUP_DECK_DEFAULT_WIDTH_RATIO),
    windowWidth
  )
}

/** Stored width is null until the user resizes; resolve to the effective rendered width. */
export function resolveTabGroupDeckWidth(
  storedWidth: number | null | undefined,
  windowWidth: number | null | undefined
): number {
  if (typeof storedWidth !== 'number' || !Number.isFinite(storedWidth)) {
    return computeDefaultTabGroupDeckWidth(windowWidth)
  }
  return clampTabGroupDeckWidth(storedWidth, windowWidth)
}
