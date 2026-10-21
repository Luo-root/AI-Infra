import { test, expect } from '@playwright/test';

test('compound inference engine is highlighted as one term', async ({ page }) => {
  await page.goto('/#doc=learning%2Fcontent%2Fguides%2F00-start.md');
  const engine = page.locator('#article button.term').filter({ hasText: /^inference engine$/i });
  await expect(engine).toHaveCount(1);
  await expect(engine).toHaveAttribute('aria-label', /inference engine/i);
  await engine.click();
  await expect(page.locator('#term-title')).toContainText('inference engine');
  await expect(page.locator('#term-content')).toContainText('推理引擎');
});

test('Kubernetes foundation terms are present in the glossary', async ({ page }) => {
  await page.goto('/#doc=learning%2Fcontent%2Fguides%2F00-start.md');
  for (const phrase of ['CRI', 'containerd', 'KubeVirt', 'KWOK', 'Helm']) {
    await expect(page.locator(`#article button.term[aria-label="查阅术语：${phrase}"]`)).toHaveCount(1);
  }
});
