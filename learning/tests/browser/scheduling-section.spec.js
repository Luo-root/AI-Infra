import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Deliberate semantic inventory of the user's entire screenshot, not a regex
// guessing that capitals are the only technical concepts.
const { concepts: labels } = JSON.parse(readFileSync(new URL('../scheduling-coverage.json', import.meta.url), 'utf8'));

async function section(page) {
  await page.goto('/#doc=README.md');
  const heading = page.locator('#article h3').filter({ hasText: /^.*1\. 调度与工作负载/ }).first();
  await expect(heading).toBeVisible();
  // Keep assertions inside this actual section, not incidental matches in TOC.
  await heading.evaluate(node => {
    const wrapper = document.createElement('section'); wrapper.id = 'scheduling-under-test';
    node.before(wrapper);
    let next = node.nextSibling;
    wrapper.append(node);
    while (next && !(next.nodeType === 1 && next.tagName === 'H3')) {
      const following = next.nextSibling; wrapper.append(next); next = following;
    }
  });
  return page.locator('#scheduling-under-test');
}

test('each scheduling-section concept has a real explanation entry and opens the right card', async ({ page }) => {
  const glossary = await (await page.request.get('/library.json')).json();
  const normalize = text => text.trim().replace(/\s+/gu, ' ').toLowerCase();
  const expected = new Map();
  for (const term of glossary.terms) for (const value of [term.term, ...(term.aliases || [])]) {
    if (!expected.has(normalize(value))) expected.set(normalize(value), term);
  }
  const area = await section(page);
  for (const label of labels) {
    const text = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const normal = area.locator('button.term').filter({ hasText: new RegExp(`^${text}$`, 'i') });
    const linked = area.getByRole('button', { name: `解释术语：${label}`, exact: true });
    const button = (await normal.count()) ? normal.first() : linked.first();
    await expect(button, `Missing screenshot concept: ${label}`).toBeVisible();
    const term = expected.get(normalize(label));
    expect(term, `Missing exact glossary mapping: ${label}`).toBeTruthy();
    await expect(button).toHaveAttribute('data-term-id', term.id);
    await button.click();
    await expect(page.locator('#term-title')).toHaveText(`${term.term} · ${term.zh || ''}`);
    await expect(page.locator('#term-card')).toBeVisible();
    await expect(page.locator('#term-content')).not.toContainText('本地词库没有');
    await expect(page.locator('#term-content')).toContainText('本文义');
    await page.locator('#term-close').click();
  }
});

test('linked terms retain their navigation and expose a separate keyboard explanation', async ({ page }) => {
  const area = await section(page);
  const original = area.getByRole('link', { name: 'Kubernetes WG Batch', exact: true });
  await expect(original).toHaveAttribute('href', 'https://github.com/kubernetes/community/blob/master/wg-batch/README.md');
  await expect(original.locator('button')).toHaveCount(0);
  const help = area.getByRole('button', { name: '解释术语：Kubernetes WG Batch', exact: true });
  await help.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#term-title')).toContainText('Batch');
  await page.keyboard.press('Escape'); await expect(help).toBeFocused();
});
