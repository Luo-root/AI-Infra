import { test, expect } from '@playwright/test';

test('GitHub Pages project path loads library, styles, license and internal navigation', async ({ page }) => {
  const failed = [];
  page.on('requestfailed', request => failed.push(request.url()));
  await page.route('http://127.0.0.1:4173/AI-Infra/**', async route => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/AI-Infra\//, '/');
    const response = await route.fetch({ url: url.href });
    await route.fulfill({ response });
  });
  await page.goto('/AI-Infra/');
  await expect(page.locator('#library-stats')).toContainText('全库收录');
  await expect(page.locator('#license-link')).toHaveAttribute('href', 'http://127.0.0.1:4173/AI-Infra/LICENSE.txt');
  await page.locator('#continue-reading').click();
  await expect(page.locator('#article h1')).toContainText('从一次请求');
  expect(new URL(page.url()).pathname).toBe('/AI-Infra/');
  const background = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(failed).toEqual([]);
});
