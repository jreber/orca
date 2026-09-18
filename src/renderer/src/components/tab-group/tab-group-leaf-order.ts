import type { TabGroupLayoutNode } from '../../../../shared/tab-types'

/** Collect leaf group ids in visual (first→second DFS) order; split ratios don't matter. */
export function collectLeafGroupIds(layout: TabGroupLayoutNode): string[] {
  if (layout.type === 'leaf') {
    return [layout.groupId]
  }
  return [...collectLeafGroupIds(layout.first), ...collectLeafGroupIds(layout.second)]
}
