type MembershipWorktree = { id: string }

/** Worktrees exempt from cold-parking because at least one group somewhere is
 *  in deck mode. The deck rail pools every worktree's tabs globally (see
 *  computeGlobalDeckTabs), so a background card's live pty mirror can point
 *  at any worktree — every worktree must stay unparked while any deck is
 *  open, not just the active worktree's own project. */
export function getDeckModeParkingExemptWorktreeIds(args: {
  deckModeActiveWorktreeIds: readonly string[]
  worktrees: readonly MembershipWorktree[]
}): Set<string> {
  if (args.deckModeActiveWorktreeIds.length === 0) {
    return new Set()
  }
  return new Set(args.worktrees.map((worktree) => worktree.id))
}
