import { parseWebPairingInput, type WebPairingOffer } from '../web/web-pairing'

export type SingleSessionParams = {
  offer: WebPairingOffer
  sessionId: string
  agent: string
}

/** Reads pairing offer + session identity from the embedding host's query string.
 *  Unlike the full web client, this never persists to localStorage or shows a
 *  connect screen — an embed with a missing/invalid param is just broken. */
export function parseSingleSessionLocation(location: Location): SingleSessionParams | null {
  const search = new URLSearchParams(location.search)
  const sessionId = search.get('session')?.trim()
  const agent = search.get('agent')?.trim()
  const pairingParam = search.get('pairing')?.trim()
  if (!sessionId || !agent || !pairingParam) {
    return null
  }
  const offer = parseWebPairingInput(pairingParam)
  if (!offer) {
    return null
  }
  return { offer, sessionId, agent }
}
