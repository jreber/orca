import { resolveTabGroupDeckWidth } from '../../../../shared/tab-group-deck-width'
import { useAppStore } from '../../store'
import { useWindowWidth } from '../right-sidebar/use-window-width'

/** Resolved width of the deck's resizable rail — shared by the rail itself and the main stage it leaves room for. */
export function useTabGroupDeckWidth(): number {
  const storedWidth = useAppStore((state) => state.tabGroupDeckWidth)
  const windowWidth = useWindowWidth()
  return resolveTabGroupDeckWidth(storedWidth, windowWidth)
}
