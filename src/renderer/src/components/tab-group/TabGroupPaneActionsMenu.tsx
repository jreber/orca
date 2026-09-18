import { Ellipsis, LayoutGrid, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'

const menuButtonClassName =
  'my-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Ellipsis menu for a focused split pane: toggle its card deck, or close the split. */
export function TabGroupPaneActionsMenu({
  deckModeActive,
  onToggleCardDeck,
  onCloseGroup
}: {
  deckModeActive: boolean
  onToggleCardDeck: () => void
  onCloseGroup: () => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <DropdownMenu modal={false}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={translate(
                'auto.components.tab.group.TabGroupPanel.9acaf92093',
                'Pane Actions'
              )}
              onClick={(event) => {
                event.stopPropagation()
              }}
              className={menuButtonClassName}
            >
              <Ellipsis className="size-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={4}>
          <DropdownMenuItem onSelect={onToggleCardDeck}>
            <LayoutGrid className="size-4" />
            {deckModeActive
              ? translate('auto.components.tab.group.TabGroupPanel.exitCardDeck', 'Exit card deck')
              : translate(
                  'auto.components.tab.group.TabGroupPanel.enterCardDeck',
                  'Card deck layout'
                )}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onCloseGroup}>
            <X className="size-4" />
            {translate(
              'auto.components.tab.group.TabGroupPanel.closePaneColumn',
              'Close split pane'
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent side="bottom" sideOffset={6}>
        {translate('auto.components.tab.group.TabGroupPanel.9acaf92093', 'Pane Actions')}
      </TooltipContent>
    </Tooltip>
  )
}
