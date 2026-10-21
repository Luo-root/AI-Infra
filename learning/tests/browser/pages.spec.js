import { test, expect } from '@playwright/test';

test('repository link points to reader fork and license respects base', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#repository-link')).toHaveAttribute('href', 'https://github.com/Luo-root/AI-Infra');
  await expect(page.locator('#repository-link')).toHaveAttribute('rel', /noopener/);
});

test('stale translation remains readable with explicit warning and current original', async ({ page }) => {
  await page.route('**/library.json', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const doc = data.documents.find(d => d.id === 'docs/inference/aibrix.md');
    doc.status = 'stale';
    doc.translationWarning = '上游原文已更新，译文待同步。';
    doc.originalBody = '# Updated upstream original\nNew source.';
    await route.fulfill({ json: data });
  });
  await page.goto('/#doc=docs%2Finference%2Faibrix.md');
  await expect(page.locator('#document-meta')).toContainText('译文待同步');
  await expect(page.locator('#translation-warning')).toContainText('待同步');
  await page.locator('#language-toggle').click();
  await expect(page.locator('#article h1')).toHaveText('Updated upstream original');
});
