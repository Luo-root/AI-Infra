import { test, expect } from '@playwright/test';

const articles = [
  'README', 'deepseek-serving', 'dynamo', 'grove', 'inference-conformance',
  'kube-agentic-networking', 'large-scale-experts', 'lora', 'memory-context-db',
  'model-architectures', 'model-distribution-stack', 'model-lifecycle',
  'model-switching', 'ome', 'pd-disaggregation', 'serverless',
];

for (const article of articles) {
  test(`complete Chinese inference article: ${article}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const id = `docs/inference/${article}.md`;
    await page.goto(`/#${new URLSearchParams({ doc: id })}`);
    await expect(page.locator('#document-meta')).toContainText('本批译文');
    await expect(page.locator('#article h1')).toBeVisible();
    expect(await page.locator('#article').innerText()).toMatch(/[\u4e00-\u9fff]/);
    const firstTitle = await page.locator('#article h1').innerText();
    await page.locator('#language-toggle').click();
    const englishTitle = await page.locator('#article h1').innerText();
    expect(englishTitle).not.toBe(firstTitle);
    await page.locator('#language-toggle').click();
    await expect(page.locator('#article h1')).toHaveText(firstTitle);
    const entry = page.locator('#toc a').nth(1);
    if (await entry.count()) {
      await entry.click();
      await expect(page.locator('#app-status')).not.toContainText('未找到章节');
    }
    expect(errors).toEqual([]);
  });
}
