import { test, expect } from '@playwright/test';

const route = (id) => `/#${new URLSearchParams({ doc: id })}`;

test('library loads, search works and English is not counted as translated', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#library-stats')).toContainText('本批译文');
  await expect(page.locator('#library-stats')).toContainText('英文待译');
  await expect(page.locator('#learning-route li')).toHaveCount(10);
  await page.locator('#search').fill('无法匹配xyz987');
  await expect(page.locator('#search-count')).toContainText('未找到');
  await page.locator('#search').fill('KV cache');
  await expect(page.locator('#document-list a').first()).toBeVisible();
});

test('translated article switches language and words open accessible cards', async ({ page }) => {
  await page.goto(route('docs/inference/aibrix.md'));
  await expect(page.locator('#article h1')).toContainText('AIBrix');
  await expect(page.locator('#document-meta')).toContainText('本批译文');
  await page.locator('#language-toggle').click();
  await expect(page.locator('#article h1')).toContainText('Cloud-Native');
  const term = page.locator('#article button.term').filter({ hasText: /^inference$/i }).first();
  await term.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#term-card')).toBeVisible();
  await expect(page.locator('#term-content')).toContainText('原义');
  await expect(page.locator('#term-content')).toContainText('本文义');
  await page.keyboard.press('Escape');
  await expect(page.locator('#term-card')).toBeHidden();
  await expect(term).toBeFocused();
  await expect(page.locator('#article pre button.term')).toHaveCount(0);
});

test('Chinese aliases and translated table of contents stay internal', async ({ page }) => {
  await page.goto(route('README.md'));
  const aliases = page.locator('#article a[href*="doc="]');
  await expect(aliases.first()).toBeVisible();
  await page.goto(route('docs/inference/caching.md'));
  const tocLink = page.locator('#article a').filter({ hasText: '前缀缓存' }).first();
  await tocLink.click();
  await expect(page.locator('#app-status')).not.toContainText('未找到章节');
  await expect(page.locator('#reader')).toBeVisible();
});

test('mobile has no page overflow and card supports touch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route('learning/content/guides/01-request.md'));
  await expect(page.locator('#article h1')).toBeVisible();
  await page.locator('#article button.term').first().click();
  await expect(page.locator('#term-card')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  await page.locator('#term-close').click();
  await page.locator('#menu-toggle').click();
  await expect(page.locator('#sidebar')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
});

test('untrusted markdown cannot execute scripts or event handlers', async ({ page }) => {
  await page.route('**/library.json', async (routeRequest) => {
    const response = await routeRequest.fetch();
    const data = await response.json();
    const doc = data.documents.find(d => d.id === 'learning/content/guides/00-start.md');
    doc.body = '# Safety\n<script>window.readerPwned=1</script>\n<img src=x onerror="window.readerPwned=2">\n<a href="javascript:window.readerPwned=3">bad</a>\nToken\n```js\nconst token = 1;\n```';
    await routeRequest.fulfill({ json: data });
  });
  await page.goto(route('learning/content/guides/00-start.md'));
  await expect(page.locator('#article h1')).toHaveText('Safety');
  expect(await page.evaluate(() => window.readerPwned)).toBeUndefined();
  await expect(page.locator('#article script, #article [onerror], #article a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator('#article pre .term')).toHaveCount(0);
});

test('Mermaid retains visible text and no page-load errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(route('learning/content/guides/01-request.md'));
  await page.locator('#article pre').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.mermaid-diagram svg')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.mermaid-diagram svg')).toContainText('输入文本');
  expect(errors).toEqual([]);
});

test('unavailable English speech is honestly reported', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: { getVoices: () => [], addEventListener: () => {}, cancel: () => {} }, configurable: true,
    });
  });
  await page.goto(route('learning/content/guides/01-request.md'));
  await page.locator('#article button.term').first().click();
  await page.locator('#speak-term').click();
  await expect(page.locator('#speech-status')).toContainText('没有可用的英语语音');
});
