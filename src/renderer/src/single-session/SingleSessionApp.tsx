import { useEffect, useMemo, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatStructuredSession } from '../components/native-chat/NativeChatStructuredSession'
import { installWebPreloadApi } from '../web/web-preload-api'
import { registerEphemeralWebRuntimeEnvironment } from '../web/preload-api/web-runtime-session'
import { createStoredWebRuntimeEnvironment } from '../web/web-runtime-environment'
import { applyDocumentTheme } from '../lib/document-theme'
import type { SingleSessionParams } from './single-session-pairing'

const DARK_MODE_QUERY = '(prefers-color-scheme: dark)'

/** Applies the OS-preferred theme to the document root and keeps it live. This
 *  embed has no settings sync (no useAppStore), so it can't read a `theme`
 *  preference the way the full app's useDocumentAppearance does — "system" is
 *  the only preference available here. */
function useSystemDocumentTheme(): void {
  useEffect(() => {
    applyDocumentTheme('system')
    const mq = window.matchMedia(DARK_MODE_QUERY)
    const handler = (): void => applyDocumentTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
}

/** Chrome-free root for the single-session embed entry: no sidebar, tab bar, or
 *  worktree list — just one live agent-session chat surface, for a host like the
 *  Obsidian plugin to embed via <webview>. */
export function SingleSessionApp({ params }: { params: SingleSessionParams }): React.JSX.Element {
  const environmentId = useMemo(() => {
    const environment = createStoredWebRuntimeEnvironment({
      name: 'Embedded session',
      offer: params.offer
    })
    registerEphemeralWebRuntimeEnvironment(environment)
    return environment.id
  }, [params.offer])
  const [ready, setReady] = useState(false)
  useSystemDocumentTheme()

  useEffect(() => {
    installWebPreloadApi()
    setReady(true)
  }, [])

  if (!ready) {
    return <div className="min-h-dvh bg-background" />
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-dvh min-h-0 flex-col">
        <NativeChatStructuredSession
          tabId={params.sessionId}
          sessionId={params.sessionId}
          agent={params.agent}
          target={{ kind: 'environment', environmentId }}
          isVisible
          isFocusedGroup
        />
      </div>
    </TooltipProvider>
  )
}
