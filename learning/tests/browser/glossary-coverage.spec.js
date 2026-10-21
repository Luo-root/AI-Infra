import { test, expect } from '@playwright/test';

async function openDoc(page, id) {
  await page.goto(`/#${new URLSearchParams({ doc: id })}`);
  await expect(page.locator('#article h1')).toBeVisible();
}

test('compound inference engine is highlighted as one term', async ({ page }) => {
  await openDoc(page, 'learning/content/guides/00-start.md');
  const engine = page.locator('#article button.term').filter({ hasText: /^inference engine$/i });
  await expect(engine).toHaveCount(1);
  await expect(engine).toHaveAttribute('aria-label', /inference engine/i);
  await engine.click();
  await expect(page.locator('#term-title')).toContainText('inference engine');
  await expect(page.locator('#term-content')).toContainText('推理引擎');
});

test('foundation terms are present in the glossary', async ({ page }) => {
  await openDoc(page, 'learning/content/guides/00-start.md');
  for (const phrase of ['CRI', 'containerd', 'KubeVirt', 'KWOK', 'Helm']) {
    await expect(page.locator(`#article button.term[aria-label="查阅术语：${phrase}"]`)).toHaveCount(1);
  }
});

test('CNI is explained in the Kubernetes learning plan and CSI in Pod lifecycle', async ({ page }) => {
  await openDoc(page, 'docs/kubernetes/learning-plan.md');
  for (const phrase of ['CNI']) {
    const term = page.locator('#article button.term').filter({ hasText: new RegExp(`^${phrase}(?: 插件)?$`, 'i') });
    await expect(term).toHaveCount(1);
    await term.click();
    await expect(page.locator('#term-title')).toContainText(phrase);
    await expect(page.locator('#term-content')).toContainText(/接口/);
    await page.locator('#term-close').click();
  }
  await openDoc(page, 'docs/kubernetes/pod-lifecycle.md');
  const csi = page.locator('#article button.term').filter({ hasText: /^CSI$/i });
  await expect(csi).toHaveCount(1);
  await csi.click();
  await expect(page.locator('#term-content')).toContainText(/存储|接口/);
});
