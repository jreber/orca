import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'

export type NativeChatAnnotationPopoverState = {
  open: boolean
  point: { x: number; y: number }
  selectedText: string
}

export const closedNativeChatAnnotationPopoverState: NativeChatAnnotationPopoverState = {
  open: false,
  point: { x: 0, y: 0 },
  selectedText: ''
}

type NativeChatAnnotationPopoverProps = {
  state: NativeChatAnnotationPopoverState
  onOpenChange: (open: boolean) => void
  onSave: (quotedText: string, note: string) => void
}

/** Single-line note capture for a text selection, anchored at the selection's
 *  point. Enter calls onSave; Escape cancels. Save behavior is caller-owned so
 *  native-chat (queue-based) and terminal (paste-based) callers can share this UI. */
export function NativeChatAnnotationPopover({
  state,
  onOpenChange,
  onSave
}: NativeChatAnnotationPopoverProps): React.JSX.Element {
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.open) {
      setNote('')
    }
  }, [state.open])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSave(state.selectedText, note)
      onOpenChange(false)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  return (
    <Popover open={state.open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <button
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none fixed size-px opacity-0"
          style={{ left: state.point.x, top: state.point.y }}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <Input
          ref={inputRef}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={translate(
            'components.native-chat.annotationPopover.notePlaceholder',
            'Add a note…'
          )}
        />
      </PopoverContent>
    </Popover>
  )
}
