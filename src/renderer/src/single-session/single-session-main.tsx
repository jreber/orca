import '../assets/main.css'

import ReactDOM from 'react-dom/client'
import { I18nProvider } from '../i18n/I18nProvider'
import { translate } from '../i18n/i18n'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'
import { parseSingleSessionLocation } from './single-session-pairing'
import { SingleSessionApp } from './SingleSessionApp'

function SingleSessionRoot(): React.JSX.Element {
  const params = parseSingleSessionLocation(window.location)
  if (!params) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {translate(
          'singleSession.missingParams',
          'Missing or invalid session link. Re-open this pane from its embedding app.'
        )}
      </div>
    )
  }
  return <SingleSessionApp params={params} />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider>
    <RecoverableRenderErrorBoundary
      boundaryId="single-session.root"
      surface="single-session-root"
      title={translate('app.recoverableError.webTitle', 'Orca web hit a renderer error.')}
      description={translate(
        'app.recoverableError.webDescription',
        'Retry the web client or reconnect to the paired runtime.'
      )}
    >
      <SingleSessionRoot />
    </RecoverableRenderErrorBoundary>
  </I18nProvider>
)
