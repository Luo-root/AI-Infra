import { test, expect } from '@playwright/test';

const documents = [
  'training/README', 'training/argocd', 'training/kubeflow', 'training/mlops',
  'training/parallelism', 'training/pre-training', 'training/pytorch-ecosystem',
  'training/transformers', 'observability/README', 'observability/agent-otel-genai',
];
for (const document of documents) {
  test(`Chinese article and source navigation: ${document}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/#${new URLSearchParams({ doc: `docs/${document}.md` })}`);
    await expect(page.locator('#document-meta')).toContainText('本批译文');
    const title = page.locator('#article h1');
    await expect(title).toBeVisible();
    const chineseTitle = await title.innerText();
    expect(await page.locator('#article').innerText()).toMatch(/[\u4e00-\u9fff]/);
    await page.locator('#language-toggle').click();
    expect(await title.innerText()).not.toBe(chineseTitle);
    await page.locator('#language-toggle').click();
    await expect(title).toHaveText(chineseTitle);
    await page.locator('#toc a').nth(1).click();
    await expect(page.locator('#app-status')).not.toContainText('未找到章节');
    expect(errors).toEqual([]);
  });
}
