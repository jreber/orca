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

/**
 * The global deck's pooled tab list: every worktree's tabs, in fixed
 * project/repo order (never reordered by which worktree is active — the
 * deck rail and the rotation chords must agree on one stable order, or
 * selecting a card would visibly reshuffle the rail). Only `worktreeId`'s
 * own tabs honor its group's drag-reordered `tabOrder`, and are narrowed to
 * `groupId` — a worktree split into several groups must not leak a sibling
 * group's cards into this one's deck. Other worktrees pool every one of
 * their tabs (across all of their groups) in unifiedTabs order.
 */
export function computeGlobalDeckTabs<
  T extends { id: string; worktreeId?: string; groupId?: string }
>(
  worktreeId: string,
  groupId: string,
  tabOrder: readonly string[] | undefined,
  worktreesByRepo: Readonly<Record<string, readonly { id: string }[]>>,
  unifiedTabsByWorktree: Readonly<Record<string, readonly T[] | undefined>>
): (T & { worktreeId: string })[] {
  const orderedWorktreeIds = Object.values(worktreesByRepo).flatMap((worktrees) =>
    worktrees.map((worktree) => worktree.id)
  )
  return orderedWorktreeIds.flatMap((memberWorktreeId) => {
    const tabsForWorktree = unifiedTabsByWorktree[memberWorktreeId] ?? []
    const scopedTabs =
      memberWorktreeId === worktreeId
        ? tabsForWorktree.filter((tab) => tab.groupId === groupId)
        : tabsForWorktree
    const orderedTabs = orderTabsByTabStripOrder(
      scopedTabs,
      memberWorktreeId === worktreeId ? tabOrder : undefined
    )
    return orderedTabs.map((tab) => ({ ...tab, worktreeId: memberWorktreeId }))
  })
}
