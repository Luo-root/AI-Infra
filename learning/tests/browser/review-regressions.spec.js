import { test, expect } from '@playwright/test';
const route = (id, anchor) => `/#${new URLSearchParams({ doc: id, ...(anchor ? { anchor } : {}) })}`;

test('Pod source English anchor reaches deduplicated Chinese section', async ({ page }) => {
  await page.goto(route('docs/kubernetes/pod-lifecycle.md', 'restart-decision-runbook-kubernetes-135'));
  await expect(page.locator('#article h1')).toBeVisible();
  await expect(page.locator('#app-status')).not.toContainText('未找到章节');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
});

test('Pod bilingual source anchor also resolves', async ({ page }) => {
  await page.goto(route('docs/kubernetes/pod-lifecycle.md', '解决方案-solutions'));
  await expect(page.locator('#article h1')).toBeVisible();
  await expect(page.locator('#app-status')).not.toContainText('未找到章节');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
});

test('CPU offload card does not claim KV cache migration', async ({ page }) => {
  await page.goto(route('docs/inference/caching.md'));
  const term = page.locator('#article li').filter({ hasText: /^CPU 卸载/ }).locator('button.term').filter({ hasText: /^卸载$/ }).first();
  await term.click();
  await expect(page.locator('#term-content')).toContainText('CPU');
  await expect(page.locator('#term-content')).toContainText('数据');
  await expect(page.locator('#term-content')).toContainText('不是让 CPU');
});
