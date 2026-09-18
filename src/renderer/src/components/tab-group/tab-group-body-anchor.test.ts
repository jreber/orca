import { describe, expect, it } from 'vitest'
import {
  isDeckCardHostedTab,
  isOverlayHostedTab,
  tabGroupBodyAnchorName,
  tabPaneAnchorName,
  tabPaneOverlayId
} from './tab-group-body-anchor'

describe('tabGroupBodyAnchorName', () => {
  it('returns a valid CSS custom anchor name for UUID-style group ids', () => {
    const anchorName = tabGroupBodyAnchorName('11111111-1111-4111-8111-111111111111')

    expect(anchorName).toMatch(/^--orca-tab-group-body-[0-9a-f-]+$/)
  })

  it('encodes remote runtime group ids that include path separators', () => {
    const anchorName = tabGroupBodyAnchorName(
      'headless-terminals:repo::/Users/jinwoohong/orca/workspaces/orca/branch'
    )

    expect(anchorName).not.toContain(':')
    expect(anchorName).not.toContain('/')
    expect(anchorName).toMatch(/^--orca-tab-group-body-[0-9a-f-]+$/)
  })
})

describe('tabPaneAnchorName', () => {
  it('uses a distinct prefix from the group body anchor', () => {
    const tabId = '11111111-1111-4111-8111-111111111111'

    expect(tabPaneAnchorName(tabId)).toMatch(/^--orca-tab-pane-[0-9a-f-]+$/)
    expect(tabPaneAnchorName(tabId)).not.toBe(tabGroupBodyAnchorName(tabId))
  })

  it('encodes path-like runtime tab ids', () => {
    const anchorName = tabPaneAnchorName('runtime:tabs::/some/path')

    expect(anchorName).not.toContain(':')
    expect(anchorName).not.toContain('/')
  })
})

describe('isDeckCardHostedTab', () => {
  it('refuses terminals so a rail card can never reflow the live PTY', () => {
    expect(isOverlayHostedTab({ contentType: 'terminal' })).toBe(true)
    expect(isDeckCardHostedTab({ contentType: 'terminal' })).toBe(false)
  })

  it('keeps the other retained surfaces card-hostable, and editors out', () => {
    for (const contentType of ['browser', 'simulator', 'agent-session']) {
      expect(isDeckCardHostedTab({ contentType })).toBe(true)
    }
    for (const contentType of ['editor', 'diff', 'check-details']) {
      expect(isDeckCardHostedTab({ contentType })).toBe(false)
    }
  })
})

describe('tabPaneOverlayId', () => {
  it('keys terminals and browsers by entityId and the rest by unified id', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const entityId = '22222222-2222-4222-8222-222222222222'

    expect(tabPaneOverlayId({ id, entityId, contentType: 'terminal' })).toBe(entityId)
    expect(tabPaneOverlayId({ id, entityId, contentType: 'browser' })).toBe(entityId)
    expect(tabPaneOverlayId({ id, entityId, contentType: 'agent-session' })).toBe(id)
    expect(tabPaneOverlayId({ id, entityId, contentType: 'simulator' })).toBe(id)
  })
})
