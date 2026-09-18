import { describe, expect, it } from 'vitest'
import { parseSingleSessionLocation } from './single-session-pairing'

function fakeLocation(search: string): Location {
  return { search, hash: '', href: `https://example.test/${search}` } as Location
}

describe('parseSingleSessionLocation', () => {
  it('returns null when session id is missing', () => {
    const location = fakeLocation('?pairing=orca%3A%2F%2Fpair%3Fx%3D1&agent=claude')
    expect(parseSingleSessionLocation(location)).toBeNull()
  })

  it('returns null when agent is missing', () => {
    const location = fakeLocation('?pairing=orca%3A%2F%2Fpair%3Fx%3D1&session=sess-1')
    expect(parseSingleSessionLocation(location)).toBeNull()
  })

  it('returns null when pairing input is absent or unparseable', () => {
    const location = fakeLocation('?session=sess-1&agent=claude')
    expect(parseSingleSessionLocation(location)).toBeNull()
  })

  it('parses session, agent, and pairing offer from query params', () => {
    const offer = {
      v: 2,
      endpoint: 'wss://example.test/rpc',
      deviceToken: 'tok-1',
      publicKeyB64: 'a2V5'
    }
    const base64url = Buffer.from(JSON.stringify(offer), 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const encoded = encodeURIComponent(base64url)
    const location = fakeLocation(`?pairing=${encoded}&session=sess-1&agent=claude`)
    expect(parseSingleSessionLocation(location)).toEqual({
      offer,
      sessionId: 'sess-1',
      agent: 'claude'
    })
  })
})
