import { test, expect } from '@playwright/test';

test('landscape glossary explains key infrastructure abbreviations', async ({ page }) => {
  await page.goto('/#doc=README.md');
  await expect(page.locator('#article h1')).toBeVisible();
  for (const phrase of ['DP', 'TP', 'EP', 'SP', 'PP', 'CUDA', 'MCP', 'A2A', 'RAG']) {
    const button = page.locator('#article button.term').filter({ hasText: new RegExp(`^${phrase}$`, 'i') }).first();
    await expect(button, phrase).toHaveCount(1);
  }
});

test('compound landscape terms remain grouped', async ({ page }) => {
  await page.goto('/#doc=README.md');
  const terms = page.locator('#article button.term');
  await expect(terms.filter({ hasText: /^AI 网关$/i })).toHaveCount(3);
  await expect(terms.filter({ hasText: /^智能体工作流$/i })).toHaveCount(2);
});
