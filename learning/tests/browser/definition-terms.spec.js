import { test, expect } from '@playwright/test';

async function assertCard(page, area, text, expectedTitle, meaning) {
  const button = area.locator('button.term').filter({ hasText: text }).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#term-title')).toContainText(expectedTitle);
  await expect(page.locator('#term-content')).toContainText(meaning);
  await page.locator('#term-close').click();
}

test('the actual three-item definition explains Chinese concepts and multiline lowercase phrases', async ({ page }) => {
  await page.goto('/#doc=README.md');
  const definition = page.locator('#article ol').first();
  await expect(definition).toContainText('策略闭环');
  await assertCard(page, definition, /^PD\s*分离$/, 'P/D', '预填充');
  await assertCard(page, definition, /^RL$/, 'RL', '奖励');
  await assertCard(page, definition, /^策略闭环$/, '策略闭环', '反馈');
  await assertCard(page, definition, /^agentic\s+workflow$/i, 'Agentic Workflow', '智能体');
  await assertCard(page, definition, /^KVCache$/, 'KV cache', '缓存');
  await assertCard(page, definition, /^训推一致性$/, '一致性', '训练');
  for (const phrase of ['分布式训练', '可靠性', '服务栈', '模型路由', '效率优化', '在线/离线效率']) {
    await expect(definition.locator('button.term').filter({ hasText: phrase }).first()).toBeVisible();
  }
});

test('whitespace matching preserves lowercase compound text without matching code blocks or substrings', async ({ page }) => {
  await page.route('**/library.json', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const doc = data.documents.find(d => d.id === 'learning/content/guides/00-start.md');
    doc.body = '# Test\n\nagentic\nworkflow; inference\tengine; inference\u00a0engine; RL; RLike; URL; PD分离; PD 分离.\n\n`RL`\n\n```text\nRL agentic workflow\n```\n\n[agentic workflow](https://example.com)';
    await route.fulfill({ json: data });
  });
  await page.goto('/#doc=learning%2Fcontent%2Fguides%2F00-start.md');
  const article = page.locator('#article');
  await expect(article.locator('button.term').filter({ hasText: /^agentic\s+workflow$/i })).toHaveCount(1);
  await expect(article.locator('button.term').filter({ hasText: /^inference\s+engine$/i })).toHaveCount(2);
  await expect(article.locator('button.term').filter({ hasText: /^RL$/ })).toHaveCount(2);
  await expect(article.locator('pre button.term, a button.term')).toHaveCount(0);
  await expect(article).toContainText('RLike; URL;');
  await assertCard(page, article, /^agentic\s+workflow$/i, 'Agentic Workflow', '智能体');
  await assertCard(page, article, /^inference\s+engine$/i, 'inference engine', '推理');
});
