/**
 * One full run per mode through the browser, driven only by the stable data-* attributes
 * that agents use (data-mode, data-node, data-option, data-affordance, data-action).
 */
import { test, expect, type Page } from '@playwright/test';

async function answerCurrent(page: Page, step: number): Promise<'answered' | 'done'> {
  const done = page.locator('.card.done');
  const card = page.locator('article[data-node]');
  await expect(done.or(card).first()).toBeVisible();
  if (await done.isVisible()) return 'done';
  const node = await card.getAttribute('data-node');
  // every seventh prompt, use an affordance instead of an option, so they are exercised too
  if (step % 7 === 3 && (await page.locator('[data-affordance="decline"]').count())) {
    await page.locator('[data-affordance="decline"]').click();
  } else if (await page.locator('form.allocate').count()) {
    const inputs = page.locator('form.allocate input[data-option]');
    const max = Number(await inputs.first().getAttribute('max'));
    await inputs.first().fill(String(max));
    await page.locator('form.allocate button[type="submit"]').click();
  } else if (await page.locator('fieldset.options.multi').count()) {
    await page.locator('fieldset.options.multi input[data-option]').first().check();
    await page.locator('[data-action="submit-multi"]').click();
  } else {
    const opts = page.locator(`button.opt[data-node="${node}"]`);
    const n = await opts.count();
    await opts.nth(step % n).click();
  }
  // the prompt must change (or the journey must finish)
  await expect(page.locator(`article[data-node="${node}"]`)).toHaveCount(0);
  return 'answered';
}

async function checkResult(page: Page) {
  await page.goto('#/result');
  await expect(page.locator('.result-head h1')).toBeVisible();
  await expect(page.locator('.coverage')).toContainText(/decisions/);
  await expect(page.locator('article.claim').first()).toBeVisible();
}

for (const mode of ['sketch', 'survey', 'excavation'] as const) {
  test(`${mode}: a full run from landing to result`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('./');
    await page.locator(`[data-mode="${mode}"]`).click();
    await expect(page).toHaveURL(/#\/situation/);
    await page.locator('[data-action="skip-situation"]').click();
    await expect(page).toHaveURL(/#\/journey/);
    const cap = mode === 'excavation' ? 40 : 160;
    let finished = false;
    for (let i = 0; i < cap; i++) {
      if ((await answerCurrent(page, i)) === 'done') {
        finished = true;
        break;
      }
    }
    if (mode !== 'excavation') expect(finished, `${mode} should reach its end`).toBe(true);
    await checkResult(page);
    expect(errors).toEqual([]);
  });
}

test('text-only route answers by plain links', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-mode="sketch"]').click();
  await page.locator('[data-action="skip-situation"]').click();
  await page.goto('#/text');
  const first = page.locator('section.textroute[data-node]');
  await expect(first).toBeVisible();
  const node = await first.getAttribute('data-node');
  await page.locator(`a[data-node="${node}"][data-option]`).first().click();
  await expect(page.locator(`section.textroute[data-node="${node}"]`)).toHaveCount(0);
});
