import { expect, test } from '@playwright/test';

async function waitForSettingsReady(page) {
  await page.waitForSelector('#game-root canvas', { state: 'attached' });
  await page.waitForFunction(() => {
    const debugBridge = globalThis.__FRUIT_SALAD_DEBUG__;
    return !!debugBridge && !!debugBridge.scene && debugBridge.session === null;
  });
  await page.waitForTimeout(300);
}

async function waitForActiveSession(page) {
  await page.waitForFunction(() => {
    const debugBridge = globalThis.__FRUIT_SALAD_DEBUG__;
    return !!debugBridge?.session;
  });
  await page.waitForTimeout(400);
}

async function startFairSession(page) {
  await page.evaluate(() => {
    const scene = globalThis.__FRUIT_SALAD_DEBUG__?.scene;
    if (!scene) {
      return;
    }
    scene.launchSession({
      mode: 'standard',
      playerCount: 2,
      playerNames: ['Player 1', 'Player 2'],
      locale: 'en',
      liveScoring: false,
      seedDemoProgress: false,
      randomSeed: 'playwright-mobile-layout'
    });
  });
  await waitForActiveSession(page);
}

async function freezeGameplayVisuals(page) {
  await page.evaluate(() => {
    const scene = globalThis.__FRUIT_SALAD_DEBUG__?.scene;
    if (!scene?.session?.turnTimer) {
      return;
    }
    scene.session.turnTimer.remainingMs = 87000;
    scene.session.turnTimer.deadlineAt = null;
    scene.renderDynamicUi();
  });
  await page.waitForTimeout(250);
}

test.describe('gameplay mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.localStorage?.clear();
      globalThis.sessionStorage?.clear();
    });
  });

  test('renders market section in mobile landscape', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only gameplay snapshot');
    await page.setViewportSize({ width: 915, height: 412 });
    await page.goto('/?lang=en');
    await waitForSettingsReady(page);
    await startFairSession(page);
    await freezeGameplayVisuals(page);
    await expect(page).toHaveScreenshot('gameplay-mobile-market.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.06
    });
  });

  test('renders player section in mobile landscape', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only gameplay snapshot');
    await page.setViewportSize({ width: 915, height: 412 });
    await page.goto('/?lang=en');
    await waitForSettingsReady(page);
    await startFairSession(page);
    await freezeGameplayVisuals(page);
    await page.evaluate(() => {
      globalThis.__FRUIT_SALAD_DEBUG__?.scene?.setMobileSection('player-0');
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('gameplay-mobile-player.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.06
    });
  });

  test('shows rotate prompt in mobile portrait', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only gameplay snapshot');
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('/?lang=en');
    await waitForSettingsReady(page);
    await startFairSession(page);
    await freezeGameplayVisuals(page);
    await expect(page).toHaveScreenshot('gameplay-mobile-rotate-prompt.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.06
    });
  });
});