import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './style.css';

const $ = (id) => document.getElementById(id);
const base = new URL(import.meta.env.BASE_URL, location.href);
$('license-link').href = new URL('LICENSE.txt', base).href;
const statusLabels = {
  translated: '本批译文 · 未人工审校',
  stale: '原文已更新 · 译文待同步',
  'existing-zh': '上游中文 · 未逐段复核',
  original: '英文原文 · 待翻译',
  guide: '学习导读 · 非翻译',
};
let library;
let currentDoc;
let english = false;
let currentTerm;
let cardTrigger;
let selectedText = '';
let mermaidObserver;
let renderVersion = 0;
let saveTimer;
let restoreFrame;
let progress;
let voices = [];
let storageAvailable = true;
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { storageAvailable = false; return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { storageAvailable = false; } },
};
try { progress = JSON.parse(storage.get('aiinfra-progress') || 'null'); } catch { progress = null; }
if (!progress || typeof progress.id !== 'string') progress = null;
let positions = {};
try { positions = JSON.parse(storage.get('aiinfra-positions') || '{}'); } catch { positions = {}; }
if (!positions || typeof positions !== 'object' || Array.isArray(positions)) positions = {};
if (progress && !Object.hasOwn(positions, progress.id)) positions[progress.id] = progress;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function docHref(id, anchor) {
  const params = new URLSearchParams({ doc: id });
  if (anchor) params.set('anchor', anchor);
  return `#${params}`;
}
function link(text, href) {
  const node = element('a', text);
  node.href = href;
  return node;
}
function safeExternal(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
function sourceLink(text, url) {
  const href = safeExternal(url);
  if (!href) return element('span', text);
  const node = link(text, href);
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}
function stripFrontmatter(body) {
  return String(body || '').replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
}
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-toggle').textContent = dark ? '浅色' : '深色';
  $('theme-toggle').setAttribute('aria-label', dark ? '切换浅色主题' : '切换深色主题');
}
setTheme(storage.get('aiinfra-theme') === 'dark');
$('theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  setTheme(dark);
  storage.set('aiinfra-theme', dark ? 'dark' : 'light');
});
function toggleMenu(open) {
  $('sidebar').classList.toggle('open', open);
  $('nav-backdrop').hidden = !open;
  $('menu-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('search').focus();
  else if (matchMedia('(max-width: 800px)').matches) $('menu-toggle').focus();
}
$('menu-toggle').addEventListener('click', () => toggleMenu(true));
$('menu-close').addEventListener('click', () => toggleMenu(false));
$('nav-backdrop').addEventListener('click', () => toggleMenu(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!$('term-card').hidden) closeCard();
    else if ($('sidebar').classList.contains('open')) toggleMenu(false);
  }
  if (event.key === 'Tab' && !$('term-card').hidden) {
    const items = [...$('term-card').querySelectorAll('button, a[href], [tabindex="0"]')].filter((node) => !node.hidden && !node.disabled);
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || !$('term-card').contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !$('term-card').contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    return;
  }
  if (event.key === 'Tab' && $('sidebar').classList.contains('open') && matchMedia('(max-width: 800px)').matches) {
    const items = [...$('sidebar').querySelectorAll('button, input, select, a')].filter((node) => !node.hidden);
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

function renderLibrary() {
  const documents = library.documents;
  const translated = documents.filter((doc) => doc.status === 'translated').length;
  const existing = documents.filter((doc) => doc.status === 'existing-zh').length;
  const original = documents.filter((doc) => doc.status === 'original').length;
  const guide = documents.filter((doc) => doc.status === 'guide').length;
  const stale = documents.filter((doc) => doc.status === 'stale').length;
  const sourceCount = translated + existing + original + stale;
  $('library-stats').textContent = `全库收录 ${documents.length} 篇 · 本批译文 ${translated} 篇 · 上游中文 ${existing} 篇 · 译文待同步 ${stale} 篇 · 英文待译 ${original} 篇 · 导读 ${guide} 篇。本批同步译文覆盖 ${sourceCount ? Math.round(translated / sourceCount * 100) : 0}%；含上游中文的同步中文覆盖 ${sourceCount ? Math.round((translated + existing) / sourceCount * 100) : 0}%（不含导读；待同步译文不计入同步覆盖；不代表已审校）。`;
  $('repository-link').href = safeExternal(library.site?.repositoryUrl) || 'https://github.com/Luo-root/AI-Infra';
  $('upstream-link').href = safeExternal(library.site?.upstreamUrl) || 'https://github.com/pacoxu/AI-Infra';
  for (const category of [...new Set(documents.map((doc) => doc.category || '未分类'))].sort()) {
    const option = element('option', category);
    option.value = category;
    $('category').append(option);
  }
  renderDocumentList();
  const route = $('learning-route');
  for (const id of library.route) {
    const doc = documents.find((item) => item.id === id);
    if (!doc) continue;
    const item = element('li');
    item.append(link(doc.title, docHref(id)), element('small', statusLabels[doc.status] || '状态未知', 'muted'));
    route.append(item);
  }
  if (!route.childElementCount) route.append(element('li', '尚未配置学习路线，请从书架选择文档。'));
  updateContinue();
  for (const update of library.updates) {
    const item = element('li');
    item.append(sourceLink(update.title || '上游更新', update.url), element('p', `${update.note || ''}${update.status ? ` · ${update.status}` : ''}`));
    $('updates').append(item);
  }
  if (!library.updates.length) $('updates').append(element('li', '暂无更新记录。'));
  $('baseline').textContent = `资料基线：${library.baseline || '未注明'} · 生成时间：${library.generatedAt || '未注明'}`;
}
function updateContinue() {
  const doc = library.documents.find((item) => item.id === progress?.id);
  const next = doc || library.documents.find((item) => item.id === library.route[0]) || library.documents[0];
  $('continue-reading').hidden = !next;
  if (next) {
    $('continue-reading').href = docHref(next.id);
    $('continue-reading').textContent = `${doc ? '继续阅读' : '开始阅读'} → ${next.title}`;
  }
}
function renderDocumentList() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const category = $('category').value;
  const matchedTermDocs = new Set();
  if (query) {
    for (const term of library.terms) {
      if ([term.term, term.zh, term.literal, term.meaning, ...(term.aliases || [])].join(' ').toLocaleLowerCase().includes(query)) {
        for (const doc of library.documents) {
          if ([term.term, ...(term.aliases || [])].some((word) => word && `${doc.body} ${doc.originalBody || ''}`.toLocaleLowerCase().includes(word.toLocaleLowerCase()))) matchedTermDocs.add(doc.id);
        }
      }
    }
  }
  const matches = library.documents.filter((doc) => (!category || (doc.category || '未分类') === category)
    && (!query || `${doc.title} ${stripFrontmatter(doc.body)} ${stripFrontmatter(doc.originalBody)}`.toLocaleLowerCase().includes(query) || matchedTermDocs.has(doc.id)));
  $('document-list').replaceChildren();
  for (const doc of matches) {
    const node = link('', docHref(doc.id));
    node.append(element('span', doc.title), element('small', statusLabels[doc.status] || '状态未知'));
    if (currentDoc?.id === doc.id) node.setAttribute('aria-current', 'page');
    $('document-list').append(node);
  }
  $('search-count').textContent = matches.length ? `显示 ${matches.length} / ${library.documents.length} 篇` : '未找到符合条件的文档，请换个关键词或分类。';
}
$('search').addEventListener('input', () => { if (library) renderDocumentList(); });
$('category').addEventListener('change', () => { if (library) renderDocumentList(); });

function rewriteLinks(root, doc) {
  const source = new URL(doc.sourcePath || doc.id, 'https://reader.invalid/');
  for (const node of root.querySelectorAll('[href], [src], [poster]')) {
    // A srcset can contain several URLs; removing it keeps every local asset on the audited path.
    node.removeAttribute('srcset');
    for (const attr of ['href', 'src', 'poster']) {
      if (!node.hasAttribute(attr)) continue;
      const value = node.getAttribute(attr).trim();
      if (!value) continue;
      if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) {
        if (attr === 'href' && /^https?:/i.test(value)) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
        continue;
      }
      if (value.startsWith('#')) { node.setAttribute(attr, docHref(doc.id, decodeHash(value.slice(1)))); continue; }
      try {
        const resolved = new URL(value, source);
        const path = decodeURIComponent(resolved.pathname.slice(1));
        const target = library.documents.find((item) => item.id === path || item.sourcePath === path || item.aliases?.includes(path));
        if (attr === 'href' && /\.md$/i.test(path)) {
          if (target) node.setAttribute(attr, docHref(target.id, decodeHash(resolved.hash.slice(1))));
          else {
            const upstream = new URL(`https://github.com/pacoxu/AI-Infra/blob/${encodeURIComponent(library.baseline)}/${resolved.pathname.slice(1)}`);
            upstream.hash = resolved.hash;
            node.setAttribute(attr, upstream.href);
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
            node.append(document.createTextNode(' ↗（未收录，查看上游）'));
          }
        } else node.setAttribute(attr, new URL(`assets/${resolved.pathname.slice(1)}${resolved.search}${resolved.hash}`, base).href);
      } catch { node.removeAttribute(attr); }
    }
  }
  for (const node of root.querySelectorAll('[srcset]')) node.removeAttribute('srcset');
}
function decodeHash(value) { try { return decodeURIComponent(value); } catch { return value; } }
function headingSlug(text) { return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') || 'section'; }
let headingAliases = new Map();
function createToc(root) {
  headingAliases = new Map();
  const used = new Set([...root.querySelectorAll('[id]:not(h1,h2,h3,h4,h5,h6)')].map((node) => node.id));
  $('toc').replaceChildren();
  for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const baseId = heading.id || headingSlug(heading.textContent);
    let id = baseId;
    let suffix = 1;
    while (used.has(id) || document.getElementById(id)) id = `${baseId}-${suffix++}`;
    used.add(id);
    heading.id = id;
    const node = link(heading.textContent, docHref(currentDoc.id, id));
    node.className = `toc-level-${heading.tagName.slice(1)}`;
    $('toc').append(node);
  }
  if (!$('toc').childElementCount) $('toc').append(element('p', '本篇暂无章节标题。', 'muted'));
  if (!english && currentDoc.originalBody) {
    const original = document.createElement('div');
    original.append(DOMPurify.sanitize(marked.parse(stripFrontmatter(currentDoc.originalBody)), { RETURN_DOM_FRAGMENT: true }));
    const originals = [...original.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    const translated = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    // Only pair a structurally identical heading sequence; never guess after an added/removed section.
    if (originals.length === translated.length && originals.every((heading, index) => heading.tagName === translated[index].tagName)) {
      const counts = new Map();
      originals.forEach((heading, index) => {
        const slug = headingSlug(heading.textContent);
        const count = counts.get(slug) || 0;
        counts.set(slug, count + 1);
        headingAliases.set(count ? `${slug}-${count}` : slug, translated[index].id);
        if (heading.id) headingAliases.set(heading.id.replace(/^user-content-/, ''), translated[index].id);
      });
    }
  }
}
function highlightTerms(root) {
  const lookup = new Map();
  for (const term of library.terms) for (const word of [term.term, ...(term.aliases || [])]) {
    if (typeof word === 'string' && word.trim() && !lookup.has(word.toLocaleLowerCase())) lookup.set(word.toLocaleLowerCase(), term);
  }
  if (!lookup.size) return;
  const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp([...lookup.keys()].sort((a, b) => b.length - a.length).map(escape).join('|'), 'giu');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent?.closest('pre,a,button,svg,math,script,style,textarea')) return NodeFilter.FILTER_REJECT;
      if (parent?.tagName === 'CODE') {
        const value = node.textContent.trim().toLocaleLowerCase();
        return lookup.has(value) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.textContent;
    const fragment = document.createDocumentFragment();
    let last = 0;
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;
      if (/^[a-z\d]/i.test(word) && /[a-z\d_]/i.test(text[start - 1] || '')) continue;
      if (/[a-z\d]$/i.test(word) && /[a-z\d_]/i.test(text[end] || '')) continue;
      fragment.append(document.createTextNode(text.slice(last, start)));
      const button = element('button', word, 'term');
      button.type = 'button';
      button.setAttribute('aria-label', `查阅术语：${word}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => openCard(lookup.get(word.toLocaleLowerCase()), button));
      fragment.append(button);
      last = end;
    }
    if (last) { fragment.append(document.createTextNode(text.slice(last))); node.replaceWith(fragment); }
  }
}
function addCodeCopyButtons(root) {
  for (const pre of root.querySelectorAll('pre')) {
    const code = pre.querySelector('code');
    if (!code || code.classList.contains('language-mermaid')) continue;
    const text = code.textContent;
    const controls = element('div', undefined, 'code-controls');
    const button = element('button', '复制代码');
    const status = element('span', '', 'muted');
    status.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(text);
        status.textContent = '已复制。';
      } catch { status.textContent = '复制失败：浏览器未允许访问剪贴板，请手动选择代码复制。'; }
    });
    controls.append(button, status);
    pre.before(controls);
  }
}
function prepareMermaid(root, version) {
  mermaidObserver?.disconnect();
  const blocks = [...root.querySelectorAll('pre > code.language-mermaid')];
  if (!blocks.length) return;
  const render = async (code) => {
    const pre = code.parentElement;
    if (!pre || pre.dataset.attempted) return;
    pre.dataset.attempted = 'true';
    const source = code.textContent;
    try {
      const { default: mermaid } = await import('mermaid');
      if (version !== renderVersion || !pre.isConnected) return;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: 'neutral', htmlLabels: false, flowchart: { htmlLabels: false } });
      const { svg } = await mermaid.render(`diagram-${version}-${blocks.indexOf(code)}`, source);
      if (version !== renderVersion || !pre.isConnected) return;
      const figure = element('figure', undefined, 'mermaid-diagram');
      // Mermaid output is still untrusted HTML; never insert it without a second sanitization.
      figure.append(DOMPurify.sanitize(svg, { RETURN_DOM_FRAGMENT: true, USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject'] }));
      figure.setAttribute('aria-label', 'Mermaid 图表');
      const details = element('details');
      details.append(element('summary', '查看图表源码'), pre.cloneNode(true));
      figure.append(details);
      pre.replaceWith(figure);
    } catch {
      if (version === renderVersion && pre.isConnected) pre.before(element('p', '图表未能渲染，以下保留原始 Mermaid 源码。', 'notice'));
    }
  };
  if ('IntersectionObserver' in window) {
    mermaidObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { mermaidObserver.unobserve(entry.target); void render(entry.target.firstElementChild); }
    }, { rootMargin: '200px' });
    blocks.forEach((code) => mermaidObserver.observe(code.parentElement));
  } else blocks.forEach((code) => void render(code));
}
function saveProgress() {
  if (!currentDoc || $('reader').hidden) return;
  progress = { id: currentDoc.id, y: window.scrollY, english, updatedAt: new Date().toISOString() };
  positions[currentDoc.id] = progress;
  storage.set('aiinfra-positions', JSON.stringify(positions));
  storage.set('aiinfra-progress', JSON.stringify(progress));
  updateContinue();
}
window.addEventListener('scroll', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveProgress, 180); }, { passive: true });
window.addEventListener('pagehide', saveProgress);
function goToAnchor(anchor) {
  if (!anchor) return false;
  const alias = headingAliases.get(anchor.replace(/^user-content-/, ''));
  const target = [...$('article').querySelectorAll('[id]')].find((node) => node.id === anchor || node.id === `user-content-${anchor}` || node.id === alias);
  if (target) { target.scrollIntoView(); return true; }
  $('app-status').textContent = `未找到章节锚点“${anchor}”，已打开该文档。`;
  return false;
}
function renderDocument(doc, anchor, restore = false) {
  cancelAnimationFrame(restoreFrame);
  closeCard(false);
  selectedText = '';
  const version = ++renderVersion;
  currentDoc = doc;
  $('dashboard').hidden = true;
  $('reader').hidden = false;
  $('app-status').textContent = storageAvailable ? '' : '浏览器未允许本地存储，阅读位置与主题将无法保存。';
  document.title = `${doc.title} · AI Infra 学习阅读器`;
  $('language-toggle').hidden = !doc.originalBody;
  $('language-toggle').textContent = english ? '查看中文正文' : '查看英文原文';
  $('document-meta').replaceChildren(
    element('span', statusLabels[doc.status] || '状态未知', 'badge'),
    element('span', doc.category || '未分类'),
    sourceLink('原文来源', doc.sourceUrl),
    element('span', `路径：${doc.sourcePath || doc.id}`),
  );
  if (doc.sourceCommit) $('document-meta').append(element('span', `来源提交：${doc.sourceCommit}`));
  if (doc.sourceHash) $('document-meta').append(element('span', `内容哈希：${doc.sourceHash}`));
  $('translation-warning').hidden = !doc.translationWarning;
  $('translation-warning').textContent = doc.translationWarning || '';
  const root = document.createElement('div');
  root.append(DOMPurify.sanitize(marked.parse(stripFrontmatter(english && doc.originalBody ? doc.originalBody : doc.body), { gfm: true }), {
    RETURN_DOM_FRAGMENT: true,
    SANITIZE_NAMED_PROPS: true,
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'object', 'embed', 'base', 'link', 'meta'],
    FORBID_ATTR: ['style', 'srcset', 'autofocus'],
  }));
  rewriteLinks(root, doc);
  $('article').replaceChildren();
  createToc(root);
  highlightTerms(root);
  if (!root.querySelector('h1')) $('article').append(element('h1', doc.title));
  $('article').append(...root.childNodes);
  for (const image of $('article').querySelectorAll('img')) {
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.replaceWith(element('span', `图片无法加载：${image.alt || '未命名图片'}`, 'notice'));
    }, { once: true });
  }
  addCodeCopyButtons($('article'));
  prepareMermaid($('article'), version);
  const routeIndex = library.route.indexOf(doc.id);
  $('route-navigation').replaceChildren();
  for (const [offset, label] of [[-1, '上一篇'], [1, '下一篇']]) {
    const next = routeIndex >= 0 && library.documents.find((item) => item.id === library.route[routeIndex + offset]);
    if (next) $('route-navigation').append(link(`${label}：${next.title}`, docHref(next.id)));
  }
  renderDocumentList();
  const y = restore ? Math.max(0, Number(positions[doc.id]?.y) || 0) : 0;
  restoreFrame = requestAnimationFrame(() => {
    if (!anchor || !goToAnchor(anchor)) window.scrollTo(0, y);
    saveProgress();
  });
}
function handleRoute() {
  if (!library) return;
  clearTimeout(saveTimer);
  cancelAnimationFrame(restoreFrame);
  const params = new URLSearchParams(location.hash.slice(1));
  const id = params.get('doc');
  const anchor = params.get('anchor');
  const doc = library.documents.find((item) => item.id === id);
  toggleMenu(false);
  if (!id || !doc) {
    saveProgress();
    currentDoc = null;
    renderVersion++;
    mermaidObserver?.disconnect();
    closeCard(false);
    $('dashboard').hidden = false;
    $('reader').hidden = true;
    $('toc').replaceChildren();
    $('app-status').textContent = id ? `未收录此文档：${id}。请从书架选择已收录内容。` : (storageAvailable ? '' : '本地存储不可用，阅读进度无法保存。');
    document.title = 'AI Infra · 学习阅读器';
    renderDocumentList();
    window.scrollTo(0, 0);
    return;
  }
  if (currentDoc?.id === id) {
    if (anchor) goToAnchor(anchor);
    return;
  }
  saveProgress();
  english = !!positions[id]?.english && !!doc.originalBody;
  renderDocument(doc, anchor, true);
}
window.addEventListener('hashchange', handleRoute);
$('language-toggle').addEventListener('click', () => {
  if (!currentDoc?.originalBody) return;
  saveProgress();
  english = !english;
  renderDocument(currentDoc, null, true);
});

function addDefinition(label, value) {
  const row = element('dl', undefined, 'definition');
  row.append(element('dt', label), element('dd', value || '未提供'));
  $('term-content').append(row);
}
function openCard(term, trigger, unmatched = '') {
  if (!$('term-card').hidden) closeCard(false);
  cardTrigger = trigger || document.activeElement;
  currentTerm = term;
  $('term-title').textContent = term ? `${term.term} · ${term.zh || ''}` : `“${unmatched}”尚未收录`;
  $('term-content').replaceChildren();
  if (term) {
    addDefinition('一句话', term.plain);
    addDefinition('读音 / 词性', [term.ipa, term.accent, term.pos].filter(Boolean).join(' · '));
    addDefinition('原文短语', term.original);
    addDefinition('原义', term.literal);
    addDefinition('本文义', term.contextOverrides?.[currentDoc?.id] || term.meaning);
    addDefinition('中文', term.zh);
    addDefinition('自造例句', term.example || [term.exampleEn, term.exampleZh].filter(Boolean).join('\n'));
    $('term-content').append(element('p', '例句用于学习，非原文引用；朗读使用系统英语合成语音，不是真人发音。', 'muted'));
    addDefinition('来源', term.source);
    if (term.note) addDefinition('核验说明', term.note);
    if (term.sourceUrl) $('term-content').append(sourceLink('打开参考来源', term.sourceUrl));
  } else $('term-content').append(element('p', '本地词库没有这个词条。请尝试选中一个完整术语；这里不会编造释义，也不会把所选内容上传。'));
  $('speak-term').hidden = !term;
  $('speech-status').textContent = '';
  $('term-card').hidden = false;
  $('term-close').focus({ preventScroll: true });
}
function closeCard(returnFocus = true) {
  if ($('term-card').hidden) return;
  $('term-card').hidden = true;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (returnFocus && cardTrigger?.isConnected) cardTrigger.focus({ preventScroll: true });
  currentTerm = null;
}
$('term-close').addEventListener('click', () => closeCard());
document.addEventListener('click', (event) => {
  if (!$('term-card').hidden && !$('term-card').contains(event.target) && !event.target.closest('.term, #lookup-selection')) closeCard();
});
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  if (selection?.anchorNode && $('article').contains(selection.anchorNode) && $('article').contains(selection.focusNode)) {
    const excluded = 'code,pre,a,button,svg,math';
    const start = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
    const end = selection.focusNode.nodeType === Node.ELEMENT_NODE ? selection.focusNode : selection.focusNode.parentElement;
    if (start.closest(excluded) || end.closest(excluded)) { selectedText = ''; return; }
    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    if (range && [...$('article').querySelectorAll(excluded)].some((node) => range.intersectsNode(node))) { selectedText = ''; return; }
    const value = selection.toString().trim();
    if (value) selectedText = value.slice(0, 200);
  }
});
$('lookup-selection').addEventListener('click', () => {
  if (!selectedText) { openCard(null, $('lookup-selection'), '请先在正文选中一个词'); return; }
  const word = selectedText.toLocaleLowerCase();
  const term = library.terms.find((item) => [item.term, item.zh, ...(item.aliases || [])].some((value) => typeof value === 'string' && value.toLocaleLowerCase() === word));
  openCard(term, $('lookup-selection'), selectedText);
});
function refreshVoices() { if ('speechSynthesis' in window) voices = speechSynthesis.getVoices(); }
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}
$('speak-term').addEventListener('click', () => {
  if (!currentTerm) return;
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    $('speech-status').textContent = '当前浏览器不支持语音合成，请查看词卡中的音标。'; return;
  }
  refreshVoices();
  const voice = voices.find((item) => /^en(?:-|_)/i.test(item.lang) || item.lang === 'en');
  if (!voice) { $('speech-status').textContent = '当前没有可用的英语语音。请在系统中安装英语语音后重试；不会使用中文语音代读。'; return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentTerm.term);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.85;
  utterance.onstart = () => { $('speech-status').textContent = '正在朗读…'; };
  utterance.onend = () => { $('speech-status').textContent = '朗读结束。'; };
  utterance.onerror = () => { $('speech-status').textContent = '语音播放失败，请检查系统语音设置。'; };
  speechSynthesis.speak(utterance);
});

async function init() {
  try {
    const response = await fetch(new URL('library.json', base));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.documents) || !Array.isArray(data.terms)) throw new Error('资料格式不正确：缺少 documents 或 terms 数组');
    if (data.documents.some((doc) => !doc || typeof doc.id !== 'string' || typeof doc.body !== 'string' || typeof doc.title !== 'string')) throw new Error('资料格式不正确：文档需要 id、title 和 body 文本');
    library = { ...data, route: Array.isArray(data.route) ? data.route : [], updates: Array.isArray(data.updates) ? data.updates : [] };
    renderLibrary();
    $('app-status').textContent = data.documents.length ? '' : '资料库暂时没有文档。请先生成 library.json。';
    handleRoute();
    if (!data.documents.length) $('app-status').textContent = '资料库暂时没有文档。请先生成 library.json。';
  } catch (error) {
    $('app-status').textContent = `无法加载学习资料：${error.message}。请确认 library.json 已生成，并通过本地 Vite 服务打开本页。`;
    $('app-status').className = 'notice';
    const retry = element('button', '重新加载');
    retry.addEventListener('click', () => location.reload());
    $('app-status').append(document.createTextNode(' '), retry);
  }
}
void init();
