import { expect, test } from '@playwright/test';

async function waitForSettingsReady(page) {
  await page.waitForSelector('#game-root canvas', { state: 'attached' });
  await page.waitForFunction(() => {
    const debugBridge = globalThis.__FRUIT_SALAD_DEBUG__;
    return !!debugBridge && !!debugBridge.scene && debugBridge.session === null;
  });
  await page.waitForTimeout(300);
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
});
