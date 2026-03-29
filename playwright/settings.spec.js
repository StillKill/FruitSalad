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
  await page.waitForTimeout(300);
}

async function setPlayerCount(page, playerCount) {
  await page.evaluate((nextPlayerCount) => {
    globalThis.__FRUIT_SALAD_DEBUG__?.scene?.updateSettingsPlayerCount(nextPlayerCount);
  }, playerCount);
  await page.waitForTimeout(300);
}

async function startFairSession(page) {
  await page.evaluate(() => {
    globalThis.__FRUIT_SALAD_DEBUG__?.scene?.startSessionFromSettings();
  });
  await waitForActiveSession(page);
}

test.describe('settings screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.localStorage?.clear();
      globalThis.sessionStorage?.clear();
    });
  });

  test('renders stable setup UI', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(page.locator('#boot-status')).toBeHidden();
    await waitForSettingsReady(page);
    await expect(page).toHaveScreenshot('settings-screen.png', {
      animations: 'disabled'
    });
  });

  test('renders six-player setup without overflow', async ({ page }) => {
    await page.goto('/?lang=en');
    await waitForSettingsReady(page);
    await setPlayerCount(page, 6);
    await expect(page).toHaveScreenshot('settings-screen-six-players.png', {
      animations: 'disabled'
    });
  });

  test('renders saved-session entry points after reload', async ({ page }) => {
    await page.goto('/?lang=en');
    await waitForSettingsReady(page);
    await startFairSession(page);
    await page.reload();
    await expect(page.locator('#boot-status')).toBeHidden();
    await waitForSettingsReady(page);
    await expect(page).toHaveScreenshot('settings-screen-saved-session.png', {
      animations: 'disabled'
    });
  });

  test('renders stable setup UI in russian locale', async ({ page }) => {
    await page.goto('/?lang=ru');
    await expect(page.locator('#boot-status')).toBeHidden();
    await waitForSettingsReady(page);
    await expect(page).toHaveScreenshot('settings-screen-ru.png', {
      animations: 'disabled'
    });
  });
});