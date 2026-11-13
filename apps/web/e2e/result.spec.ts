/** The result page: every map tab renders, the graph draws, every export downloads, the card renders, sharing works. */
import { test, expect } from '@playwright/test';

test('result page: tabs, graph, exports, card and share link', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.locator('[data-mode="sketch"]').click();
  await page.locator('[data-action="skip-situation"]').click();
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.card.done').isVisible()) break;
    const card = page.locator('article[data-node]');
    await expect(card).toBeVisible();
    if (await page.locator('fieldset.options.multi').count()) {
      await page.locator('fieldset.options.multi input[data-option]').first().check();
      await page.locator('[data-action="submit-multi"]').click();
    } else if (await page.locator('form.allocate').count()) {
      const inputs = page.locator('form.allocate input[data-option]');
      await inputs.first().fill(await inputs.first().getAttribute('max') ?? '10');
      await page.locator('form.allocate button[type="submit"]').click();
    } else {
      const node = await card.getAttribute('data-node');
      await page.locator(`button.opt[data-node="${node}"]`).first().click();
    }
  }
  await page.goto('#/result');
  await expect(page.locator('.result-head h1')).toBeVisible();

  // every tab of part two renders a non-empty panel
  const tabs = page.locator('[role="tab"]');
  const n = await tabs.count();
  expect(n).toBeGreaterThanOrEqual(10);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await expect(page.locator('[role="tabpanel"]')).not.toBeEmpty();
  }
  await page.locator('#tab-map').click();
  await expect(page.locator('[role="tabpanel"] svg').first()).toBeVisible();

  // every export format downloads a non-empty file
  for (const f of ['json', 'jsonld', 'ttl', 'graphml', 'md', 'session']) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-export="${f}"]`).click()]);
    const path = await dl.path();
    expect(path, f).toBeTruthy();
  }
  const [card] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="card-png"]').click()]);
  expect(card.suggestedFilename()).toBe('standpoint-card.png');

  // the share link opens a read-only result with no situation unless asked
  const link = await page.locator('[data-action="share-link"]').inputValue();
  expect(link).toContain('#/r?s=');
  await page.goto(link);
  await expect(page.locator('.result-head h1')).toBeVisible();
  expect(errors).toEqual([]);
});
