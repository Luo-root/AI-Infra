import { test, expect } from '@playwright/test';
const route = id => `/#${new URLSearchParams({ doc: id })}`;

test('separate articles retain independent reading positions', async ({ page }) => {
  await page.goto(route('docs/inference/caching.md'));
  await expect(page.locator('#article h1')).toBeVisible();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('aiinfra-positions') || '{}')['docs/inference/caching.md']);
  await page.evaluate(() => scrollTo(0, 1400));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aiinfra-positions') || '{}')['docs/inference/caching.md']?.y || 0)).toBeGreaterThan(1000);
  await page.evaluate(() => { location.hash = new URLSearchParams({ doc: 'docs/inference/aibrix.md' }).toString(); });
  await expect(page.locator('#article h1')).toContainText('AIBrix');
  await page.evaluate(() => { location.hash = new URLSearchParams({ doc: 'docs/inference/caching.md' }).toString(); });
  await expect(page.locator('#article h1')).toContainText('缓存');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
});

test('unknown selected words return an honest missing-card state', async ({ page }) => {
  await page.goto(route('learning/content/guides/00-start.md'));
  await expect(page.locator('#article h1')).toBeVisible();
  await page.evaluate(() => {
    const p = document.querySelector('#article p');
    const range = document.createRange();
    range.selectNodeContents(p);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.locator('#lookup-selection').click();
  await expect(page.locator('#term-title')).toContainText('尚未收录');
  await expect(page.locator('#term-content')).toContainText('不会编造');
});

test('translated Chinese alias routes to its paired entry', async ({ page }) => {
  await page.goto(route('docs/blog/2026-05-13/2026-05-13-how-to-choose-inference-orchestration-stacks.md'));
  await expect(page.locator('#article h1')).toBeVisible();
  // Explicitly test the root language link alias rather than merely checking generic internal links.
  await page.goto(route('README.md'));
  await page.locator('#language-toggle').click();
  const zhLink = page.locator('#article a').filter({ hasText: /中文|Chinese/ }).first();
  await expect(zhLink).toHaveAttribute('href', /#doc=README.md/);
});
