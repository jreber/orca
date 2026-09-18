import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { NativeChatAnnotation } from './native-chat-annotation-queue'

type Props = {
  annotation: NativeChatAnnotation
  onRemove: (id: string) => void
}

/** Chip for a pending response annotation; remove control mirrors the image-attachment chip's. */
export function NativeChatAnnotationChip({ annotation, onRemove }: Props): React.JSX.Element {
  const label = `${annotation.quotedText} — ${annotation.note}`
  return (
    <div
      className="relative max-w-56 shrink-0 rounded-md border border-border bg-background py-1 pl-2 pr-5 text-xs"
      title={label}
    >
      <div className="truncate">
        <span className="text-muted-foreground">{annotation.quotedText}</span>
        {' — '}
        <span className="text-foreground/90">{annotation.note}</span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(annotation.id)}
        aria-label={translate(
          'components.native-chat.composer.removeAnnotation',
          'Remove annotation'
        )}
        className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
