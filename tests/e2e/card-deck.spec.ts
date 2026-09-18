/**
 * E2E for the tab-level card-deck layout:
 * real chords → window keydown handler → store flag → focused-group deck render.
 *
 * Deck cards are the focused group's TABS (no split required). The active tab's
 * real surface is staged full size; a terminal's rail card shows a read-only
 * mirror of the same PTY instead of the real pane, because painting the pane
 * into a card would fit xterm to card size and reflow the live session. Uses
 * the store only to reach the starting state and asserts on the DOM.
 */

import { test, expect } from './helpers/orca-app'
import type { Page } from '@stablyai/playwright-test'
import { waitForSessionReady, waitForActiveWorktree } from './helpers/store'

const isMac = process.platform === 'darwin'
const mod = isMac ? 'Meta' : 'Control'
// Why: Mod+Shift+K stays clear of the terminal-scope split chords; any
// Mod+Shift+D default is claimed by the pane-level hook while a terminal is
// focused (terminal.splitRight/splitDown win the capture phase).
const toggleChord = `${mod}+Shift+k`
const focusNextChord = `${mod}+Shift+PageDown`
const focusPreviousChord = `${mod}+Shift+PageUp`

async function seedTabs(page: Page, count: number): Promise<{ worktreeId: string }> {
  return page.evaluate((tabCount) => {
    const store = window.__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    const activeWorktreeId = store.getState().activeWorktreeId
    if (!activeWorktreeId) {
      throw new Error('No active worktree')
    }
    // Why: the fixture may have created a baseline tab; top up to the count.
    const tabs = store.getState().tabsByWorktree[activeWorktreeId] ?? []
    for (let index = tabs.length; index < tabCount; index += 1) {
      store.getState().createTab(activeWorktreeId)
    }
    return { worktreeId: activeWorktreeId }
  }, count)
}

async function deckCardIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-tab-group-deck-card-id]')).map(
      (card) => card.getAttribute('data-tab-group-deck-card-id') ?? ''
    )
  )
}

async function activeDeckCardId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const activeCard = document.querySelector('[data-tab-group-deck-card-active="true"]')
    return activeCard?.getAttribute('data-tab-group-deck-card-id') ?? null
  })
}

async function mosaicTabOrder(page: Page): Promise<string[]> {
  // Why: cards must stay stationary — their DOM order in the mosaic must never
  // change; only the highlight (and which card hosts a real surface vs a
  // placeholder) moves.
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-tab-group-deck-mosaic] > [data-tab-group-deck-card-id]')
    ).map((child) => child.getAttribute('data-tab-group-deck-card-id') ?? '')
  )
}

// Why: the active tab's real surface shows large in the stage (its rail card
// is a highlighted placeholder instead) — this reads the stage's anchor
// claim to confirm which tab is staged.
async function stageOverlayTabId(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      document
        .querySelector('[data-tab-group-deck-stage]')
        ?.getAttribute('data-tab-pane-anchor-id') ?? null
  )
}

async function unifiedTabIdsInGroup(page: Page, worktreeId: string): Promise<string[]> {
  return page.evaluate((wt) => {
    const store = window.__store
    const groupId = store?.getState().activeGroupIdByWorktree[wt]
    return (
      store
        ?.getState()
        .unifiedTabsByWorktree[wt]?.filter((tab) => tab.groupId === groupId)
        .map((tab) => tab.id) ?? []
    )
  }, worktreeId)
}

// Why: retained terminal surfaces key by entityId (the terminal tab id), not
// the unified tab id the cards use.
async function terminalEntityIdsInGroup(page: Page, worktreeId: string): Promise<string[]> {
  return page.evaluate((wt) => {
    const store = window.__store
    const groupId = store?.getState().activeGroupIdByWorktree[wt]
    return (
      store
        ?.getState()
        .unifiedTabsByWorktree[wt]?.filter(
          (tab) => tab.groupId === groupId && tab.contentType === 'terminal'
        )
        .map((tab) => tab.entityId) ?? []
    )
  }, worktreeId)
}

// Why: a terminal tab only spawns its shell once its pane mounts, and the
// fixture's baseline tab has never been opened — a card can only mirror a live
// session, so visit every tab first.
async function startEveryTerminalSession(
  page: Page,
  terminalIds: readonly string[]
): Promise<void> {
  for (const terminalId of terminalIds) {
    await page.evaluate((tabId) => {
      const state = window.__store?.getState()
      state?.setActiveTabType('terminal')
      state?.setActiveTab(tabId)
    }, terminalId)
    await expect
      .poll(
        () =>
          page.evaluate(
            (tabId) => (window.__store?.getState().ptyIdsByTabId[tabId] ?? []).length,
            terminalId
          ),
        { timeout: 20_000, message: `terminal ${terminalId} never started a session` }
      )
      .toBeGreaterThan(0)
  }
}

// Why: a chord pressed right after store churn can be missed by the window
// keydown handler (the event reaches the page untouched, the handler doesn't
// run — the same press a moment later works). Press until the expected
// page-side transition lands, like a real user retapping.
async function pressChordUntil(
  page: Page,
  chord: string,
  condition: (arg: string) => boolean,
  arg: string
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press(chord)
    try {
      await page.waitForFunction(condition, arg, { timeout: 2_000 })
      return
    } catch {
      // Missed — retap below.
    }
  }
  throw new Error(`chord ${chord} never took effect after 3 presses`)
}

const cardCountAtLeast = (minimum: number, page: Page) =>
  pressChordUntil(
    page,
    toggleChord,
    (min: string) =>
      document.querySelectorAll('[data-tab-group-deck-card-id]').length >= Number(min),
    String(minimum)
  )

const deckOff = (page: Page) =>
  pressChordUntil(
    page,
    toggleChord,
    () => document.querySelectorAll('[data-tab-group-deck-card-id]').length === 0,
    ''
  )

// Why: browser-tab activation claims group focus asynchronously and can
// outlive a fixed sleep — refocus the terminal group until the store agrees
// it stuck, so the deck (which follows group focus) renders the right group.
async function focusGroupUntilStuck(
  page: Page,
  worktreeId: string,
  groupId: string
): Promise<void> {
  await page.waitForFunction(
    ({ wt, target }: { wt: string; target: string }) => {
      const store = window.__store
      store?.getState().focusGroup(wt, target)
      return store?.getState().activeGroupIdByWorktree[wt] === target
    },
    { wt: worktreeId, target: groupId },
    { timeout: 10_000 }
  )
}

// Why: the staged tab's real surface must fill the stage's anchor body exactly
// (full size, no transform-scaled mirror) and be painted (opacity 1).
async function expectStagedSurfaceFillsAnchor(page: Page, overlayTabId: string): Promise<void> {
  const match = await page.evaluate((tabId) => {
    const body = document.querySelector(`[data-tab-pane-anchor-id="${tabId}"]`)
    const overlay = document.querySelector(`[data-terminal-overlay-tab-id="${tabId}"]`)
    if (!(body instanceof HTMLElement) || !(overlay instanceof HTMLElement)) {
      return null
    }
    const bodyRect = body.getBoundingClientRect()
    const overlayRect = overlay.getBoundingClientRect()
    const within = (a: number, b: number): boolean => Math.abs(a - b) < 2
    return {
      painted: overlay.style.opacity === '1' && overlay.style.display === 'flex',
      geometryAligned:
        within(bodyRect.top, overlayRect.top) &&
        within(bodyRect.left, overlayRect.left) &&
        within(bodyRect.width, overlayRect.width) &&
        within(bodyRect.height, overlayRect.height),
      unscaled: getComputedStyle(overlay).transform === 'none'
    }
  }, overlayTabId)
  expect(match, `staged surface for ${overlayTabId} not mounted`).not.toBeNull()
  expect(match?.painted, 'overlay not painted (opacity/display)').toBe(true)
  expect(match?.geometryAligned, 'overlay not aligned to its anchor body').toBe(true)
  expect(match?.unscaled, 'overlay carries a transform scale').toBe(true)
}

// Why: each tab's applied grid as main knows it. A BACKGROUND session's grid is
// the fact decking must never change — a reflow rewraps the agent's frame for
// whoever is working in it. (The staged tab is the exception: its real pane
// genuinely shrinks with the stage.)
async function ptyGrids(
  page: Page,
  terminalIds: readonly string[]
): Promise<Record<string, string>> {
  return page.evaluate(async (tabIds) => {
    const grids: Record<string, string> = {}
    for (const tabId of tabIds) {
      const ptyId = window.__store?.getState().ptyIdsByTabId[tabId]?.[0]
      const size = ptyId ? await window.api.pty.getSize(ptyId) : null
      grids[tabId] = size ? `${size.cols}x${size.rows}` : 'none'
    }
    return grids
  }, terminalIds)
}

test.describe('card deck layout', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
  })

  test('deck toggles on a lone group with a card per tab', async ({ orcaPage }) => {
    const { worktreeId } = await seedTabs(orcaPage, 3)
    const expectedTabs = await unifiedTabIdsInGroup(orcaPage, worktreeId)
    expect(expectedTabs.length).toBeGreaterThanOrEqual(3)
    await expect(orcaPage.locator('[data-tab-group-deck-mosaic]')).toHaveCount(0)

    await cardCountAtLeast(expectedTabs.length, orcaPage)

    // Why: the rail cards every tab, one per tab — no split was created. The
    // active tab (the fixture's last-created tab) also shows large in the
    // stage; its own card is a highlighted placeholder, not a duplicate.
    const cardIds = await deckCardIds(orcaPage)
    expect(cardIds).toEqual(expectedTabs)
    expect(await activeDeckCardId(orcaPage)).toBe(expectedTabs.at(-1))
    await expect(orcaPage.locator('[data-tab-group-deck-stage]')).toHaveCount(1)

    await deckOff(orcaPage)
    await expect(orcaPage.locator('[data-tab-group-deck-card-id]')).toHaveCount(0)
  })

  test('staged terminal keeps its full-size surface while rail cards mirror the pty', async ({
    orcaPage
  }) => {
    const { worktreeId } = await seedTabs(orcaPage, 2)
    const expectedTabs = await unifiedTabIdsInGroup(orcaPage, worktreeId)
    const terminalIds = await terminalEntityIdsInGroup(orcaPage, worktreeId)
    await startEveryTerminalSession(orcaPage, terminalIds)
    // Why: capture the big-pane xterm's normal font size before decking so the
    // staged surface can be held to the exact same size — no scaled mirror.
    const normalFontSizeHandle = await orcaPage.waitForFunction(
      (tabId) => {
        const term = document
          .querySelector(`[data-terminal-overlay-tab-id="${tabId}"]`)
          ?.querySelector('.xterm')
        return term instanceof HTMLElement ? getComputedStyle(term).fontSize : null
      },
      terminalIds.at(-1),
      { timeout: 10_000 }
    )
    const normalFontSize = (await normalFontSizeHandle.jsonValue()) as string | null
    expect(normalFontSize).not.toBeNull()
    const backgroundTerminalIds = terminalIds.slice(0, -1)
    const gridsBeforeDeck = await ptyGrids(orcaPage, backgroundTerminalIds)
    expect(Object.values(gridsBeforeDeck).every((grid) => grid !== 'none')).toBe(true)

    await cardCountAtLeast(expectedTabs.length, orcaPage)

    // Why: the active tab's real surface is staged at full size.
    await expectStagedSurfaceFillsAnchor(orcaPage, terminalIds.at(-1) as string)
    // Why: every terminal card mirrors a live pty (one mirror per terminal tab,
    // the staged one included).
    const mirrorPtyIds = await orcaPage
      .locator('[data-tab-group-deck-card-mirror-pty-id]')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.tabGroupDeckCardMirrorPtyId)
      )
    expect(mirrorPtyIds).toHaveLength(terminalIds.length)
    expect(mirrorPtyIds.every((ptyId) => Boolean(ptyId))).toBe(true)
    // Why: a background terminal's REAL pane is never painted into its card —
    // that is what used to reflow the session down to card size.
    for (const terminalId of backgroundTerminalIds) {
      expect(
        await orcaPage.evaluate(
          (tabId) => document.querySelectorAll(`[data-tab-pane-anchor-id="${tabId}"]`).length,
          terminalId
        ),
        'a background terminal card claimed the pane anchor'
      ).toBe(0)
    }
    // Why: the fix, stated as a fact — decking must leave a background
    // session's grid exactly as it was. Polled, because a stray fit from a
    // card's ResizeObserver would land a frame later.
    await expect
      .poll(async () => ptyGrids(orcaPage, backgroundTerminalIds), {
        timeout: 4_000,
        message: 'decking reflowed a background PTY'
      })
      .toEqual(gridsBeforeDeck)
    // Why: the stage's surface renders at the big pane's font size (normal
    // font) and its rendering screen spans the full stage body.
    const cardSurface = await orcaPage.evaluate((tabId) => {
      const overlay = document.querySelector(`[data-terminal-overlay-tab-id="${tabId}"]`)
      const term = overlay?.querySelector('.xterm')
      const screen = overlay?.querySelector('.xterm-screen')
      const body = document.querySelector(`[data-tab-pane-anchor-id="${tabId}"]`)
      if (
        !(term instanceof HTMLElement) ||
        !(screen instanceof HTMLElement) ||
        !(body instanceof HTMLElement)
      ) {
        return null
      }
      return {
        fontSize: getComputedStyle(term).fontSize,
        screenWidth: screen.getBoundingClientRect().width,
        bodyWidth: body.getBoundingClientRect().width
      }
    }, terminalIds.at(-1))
    expect(cardSurface).not.toBeNull()
    expect(cardSurface?.fontSize).toBe(normalFontSize)
    // Why: the screen spans the stage minus xterm's ~15px scrollbar gutter.
    expect(Math.abs((cardSurface?.screenWidth ?? 0) - (cardSurface?.bodyWidth ?? 1))).toBeLessThan(
      20
    )

    // Why: full-functioning — clicking the stage's real surface focuses the
    // xterm textarea so keyboard input lands in that pane.
    await orcaPage
      .locator(`[data-terminal-overlay-tab-id="${terminalIds.at(-1)}"] textarea`)
      .click()
    await expect
      .poll(async () =>
        orcaPage.evaluate(
          (tabId) =>
            document.activeElement?.closest(`[data-terminal-overlay-tab-id="${tabId}"]`) !== null,
          terminalIds.at(-1)
        )
      )
      .toBe(true)
  })

  test('rail cards are ordered like the tab strip, not tab creation order', async ({
    orcaPage
  }) => {
    const { worktreeId } = await seedTabs(orcaPage, 3)
    const expectedTabs = await unifiedTabIdsInGroup(orcaPage, worktreeId)
    // Why: reverse the tab strip order through the same store action a tab
    // drag-reorder commits, so the rail's sort input is genuinely decoupled
    // from creation order rather than incidentally matching it.
    const reversedOrder = expectedTabs.toReversed()
    await orcaPage.evaluate(
      ({ wt, order }) => {
        const store = window.__store
        const groupId = store?.getState().activeGroupIdByWorktree[wt]
        if (!groupId) {
          throw new Error('No active group')
        }
        store?.getState().reorderUnifiedTabs(groupId, order)
      },
      { wt: worktreeId, order: reversedOrder }
    )

    await cardCountAtLeast(expectedTabs.length, orcaPage)

    expect(await deckCardIds(orcaPage)).toEqual(reversedOrder)
  })

  test('deck defaults to about one third of the window and is resizable', async ({ orcaPage }) => {
    const { worktreeId } = await seedTabs(orcaPage, 2)
    const expectedTabs = await unifiedTabIdsInGroup(orcaPage, worktreeId)
    await cardCountAtLeast(expectedTabs.length, orcaPage)

    const mosaic = orcaPage.locator('[data-tab-group-deck-mosaic]')
    const windowWidth = await orcaPage.evaluate(() => window.innerWidth)
    const initialBox = await mosaic.boundingBox()
    expect(initialBox).not.toBeNull()
    // Why: default is 1/3 of the window, clamped — allow slack for the
    // reserved non-deck area on a narrow test window.
    expect(Math.abs((initialBox?.width ?? 0) - windowWidth / 3)).toBeLessThan(windowWidth / 3)
    expect(initialBox?.width ?? 0).toBeGreaterThanOrEqual(320)

    // Why: drag the resize handle on the mosaic's left edge further left to
    // grow the deck (docked to the right edge) and confirm it actually resizes.
    const handle = mosaic.locator('[role="separator"]')
    const handleBox = await handle.boundingBox()
    expect(handleBox).not.toBeNull()
    const startX = handleBox!.x + handleBox!.width / 2
    const startY = handleBox!.y + handleBox!.height / 2
    // Why: the very first synthetic mouse action in a test can land before
    // Electron's input pipeline has a cursor position primed, so the
    // following mousedown misses its target — a throwaway click settles it.
    await orcaPage.mouse.move(startX, startY)
    await orcaPage.mouse.down()
    await orcaPage.mouse.up()
    await orcaPage.mouse.move(startX, startY)
    await orcaPage.mouse.down()
    await orcaPage.mouse.move(startX - 120, startY, { steps: 10 })
    await orcaPage.mouse.up()

    await expect
      .poll(async () => (await mosaic.boundingBox())?.width ?? 0)
      .toBeGreaterThan((initialBox?.width ?? 0) + 80)
  })

  test('focus-next chord rotates the active card and cards stay stationary', async ({
    orcaPage
  }) => {
    const { worktreeId } = await seedTabs(orcaPage, 3)
    const expectedTabs = await unifiedTabIdsInGroup(orcaPage, worktreeId)
    await cardCountAtLeast(expectedTabs.length, orcaPage)
    expect(await activeDeckCardId(orcaPage)).toBe(expectedTabs.at(-1))
    expect(await stageOverlayTabId(orcaPage)).not.toBeNull()
    const orderBefore = await mosaicTabOrder(orcaPage)

    await pressChordUntil(
      orcaPage,
      focusNextChord,
      (expected: string) =>
        document
          .querySelector('[data-tab-group-deck-card-active="true"]')
          ?.getAttribute('data-tab-group-deck-card-id') === expected,
      expectedTabs[0]
    )
    await expect.poll(async () => mosaicTabOrder(orcaPage)).toEqual(orderBefore)

    await pressChordUntil(
      orcaPage,
      focusPreviousChord,
      (expected: string) =>
        document
          .querySelector('[data-tab-group-deck-card-active="true"]')
          ?.getAttribute('data-tab-group-deck-card-id') === expected,
      expectedTabs.at(-1) as string
    )
  })

  test('clicking a background card promotes that tab into the stage', async ({ orcaPage }) => {
    const { worktreeId } = await seedTabs(orcaPage, 3)
    const expectedTabs = await unifiedTabIdsInGroup(orcaPage, worktreeId)
    await cardCountAtLeast(expectedTabs.length, orcaPage)

    // Why: clicking a background card's header must switch the group's active
    // tab — the surface, keyboard, and the active-card highlight follow, and
    // that tab's real surface moves into the stage.
    await orcaPage
      .locator(`[data-tab-group-deck-card-id="${expectedTabs[0]}"]`)
      .click({ position: { x: 10, y: 10 } })

    await expect
      .poll(async () => activeDeckCardId(orcaPage), {
        timeout: 5_000,
        message: 'card click did not focus the tab'
      })
      .toBe(expectedTabs[0])
  })

  test('in a split the deck covers only the focused group', async ({ orcaPage }) => {
    const { worktreeId } = await seedTabs(orcaPage, 2)
    // Why: createEmptySplitGroup is the store action a tab-drag-onto-edge split
    // commits; an empty group is pruned, so seed a real pane in the new group.
    const firstGroupId = await orcaPage.evaluate((wt) => {
      const store = window.__store
      const rootGroupId = store?.getState().ensureWorktreeRootGroup(wt)
      if (!rootGroupId) {
        throw new Error('No root group')
      }
      const second = store?.getState().createEmptySplitGroup(wt, rootGroupId, 'right')
      if (!second) {
        throw new Error('Split unavailable')
      }
      store?.getState().createBrowserTab(wt, 'about:blank', {
        activate: true,
        focusAddressBar: false,
        targetGroupId: second
      })
      return rootGroupId
    }, worktreeId)
    // Why: the split activated the browser group; the deck belongs to the
    // focused group — pin focus back on the terminal group. The toggle here is
    // store-driven (chord delivery with a live webview is covered by the
    // lone-group tests); the assertions stay DOM-side.
    await focusGroupUntilStuck(orcaPage, worktreeId, firstGroupId)
    await orcaPage.evaluate((wt) => {
      window.__store?.getState().togglePaneCardDeck(wt)
    }, worktreeId)

    // Why: the focused (terminal) group's cards are its tabs, one per tab,
    // with the active one both flagged and staged; the browser group's own
    // strip keeps rendering beside the deck.
    await expect(orcaPage.locator('[data-tab-group-deck-card-id]')).toHaveCount(2)
    await expect(orcaPage.locator('[data-tab-group-deck-card-active="true"]')).toHaveCount(1)
    await expect(orcaPage.locator('[data-tab-group-deck-stage]')).toHaveCount(1)
    await expect(orcaPage.locator('[data-tab-group-strip-id]')).toHaveCount(2)

    await orcaPage.evaluate((wt) => {
      window.__store?.getState().togglePaneCardDeck(wt)
    }, worktreeId)
    await expect(orcaPage.locator('[data-tab-group-deck-card-id]')).toHaveCount(0)
  })

  test('Pane Actions menu toggles the deck in a split', async ({ orcaPage }) => {
    const { worktreeId } = await seedTabs(orcaPage, 2)
    const firstGroupId = await orcaPage.evaluate((wt) => {
      const store = window.__store
      const rootGroupId = store?.getState().ensureWorktreeRootGroup(wt)
      if (!rootGroupId) {
        throw new Error('No root group')
      }
      const second = store?.getState().createEmptySplitGroup(wt, rootGroupId, 'right')
      if (!second) {
        throw new Error('Split unavailable')
      }
      store?.getState().createBrowserTab(wt, 'about:blank', {
        activate: true,
        focusAddressBar: false,
        targetGroupId: second
      })
      return rootGroupId
    }, worktreeId)
    // Why: the menu's deck item decks the FOCUSED group — pin focus on the
    // two-tab terminal group so the rail cards both of its tabs.
    await focusGroupUntilStuck(orcaPage, worktreeId, firstGroupId)
    await orcaPage.getByRole('button', { name: 'Pane Actions' }).click()
    await orcaPage.getByRole('menuitem', { name: 'Card deck layout' }).click()

    await expect(orcaPage.locator('[data-tab-group-deck-card-id]')).toHaveCount(2)
    await expect(orcaPage.locator('[data-tab-group-deck-stage]')).toHaveCount(1)
  })

  test('creating a tab while decked focuses the real pane, not its rail-card mirror', async ({
    orcaPage
  }) => {
    const { worktreeId } = await seedTabs(orcaPage, 1)
    const initialTerminalIds = await terminalEntityIdsInGroup(orcaPage, worktreeId)
    await startEveryTerminalSession(orcaPage, initialTerminalIds)
    await cardCountAtLeast(initialTerminalIds.length, orcaPage)

    const tabsBefore = await unifiedTabIdsInGroup(orcaPage, worktreeId)

    await orcaPage.getByRole('button', { name: 'New tab' }).click()
    await orcaPage
      .getByRole('menuitem', { name: /New Terminal/i })
      .first()
      .click()

    let newTabId: string | null = null
    await expect
      .poll(
        async () => {
          const tabsNow = await unifiedTabIdsInGroup(orcaPage, worktreeId)
          newTabId = tabsNow.find((id) => !tabsBefore.includes(id)) ?? null
          return Boolean(newTabId)
        },
        { timeout: 5_000, message: 'new terminal tab never appeared' }
      )
      .toBe(true)
    await cardCountAtLeast(tabsBefore.length + 1, orcaPage)

    // Why: the fix — a deck-card mirror (AgentTerminalPreview with
    // claimGrid=false) must not steal focus back from the new tab's real
    // staged surface once it has been focused.
    await expect
      .poll(
        async () =>
          orcaPage.evaluate(
            (tabId) =>
              document.activeElement?.closest(`[data-terminal-overlay-tab-id="${tabId}"]`) !== null,
            newTabId
          ),
        { timeout: 5_000, message: 'focus did not land on the new tab real surface' }
      )
      .toBe(true)
    expect(
      await orcaPage.evaluate(
        () => document.activeElement?.closest('[data-tab-group-deck-card-id]') !== null
      ),
      'focus landed on a deck card instead of the real pane'
    ).toBe(false)
  })
})
