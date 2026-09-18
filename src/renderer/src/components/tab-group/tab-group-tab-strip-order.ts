/**
 * Sorts tabs to match the group's visual tab-strip order (left-to-right),
 * falling back to the given order when `tabOrder` is empty or absent. Shared
 * by the deck rail (top-to-bottom mirrors left-to-right) and the deck
 * rotation chords (Cmd+Shift+PageDown/PageUp), so both agree with the strip
 * instead of drifting to unifiedTabs insertion order after a drag-reorder.
 */
export function orderTabsByTabStripOrder<T extends { id: string }>(
  tabs: readonly T[],
  tabOrder: readonly string[] | undefined
): T[] {
  if (!tabOrder || tabOrder.length === 0) {
    return [...tabs]
  }
  const indexOf = (id: string): number => {
    const index = tabOrder.indexOf(id)
    return index === -1 ? Infinity : index
  }
  return [...tabs].sort((a, b) => indexOf(a.id) - indexOf(b.id))
}
