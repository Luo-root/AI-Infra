"""Build a static learning library from the checked-out documentation.

No network access. Original Markdown remains unchanged. Generated assets live
under learning/web/public; the Git baseline and source digests are explicit.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
LEARNING = ROOT / 'learning'
PUBLIC = LEARNING / 'web' / 'public'
STATE = json.loads((LEARNING / 'upstream/sync-state.json').read_text(encoding='utf-8'))
BASELINE = STATE['commit']
if not re.fullmatch(r'[0-9a-f]{40}', BASELINE):
    raise ValueError('Invalid upstream commit in sync-state.json')


def source_file(path: str) -> Path:
    if path in {'README.md', 'README.zh-CN.md'}:
        return LEARNING / 'upstream' / path
    return ROOT / path


def translation_state(meta: dict, path: str, original: str) -> tuple[str, str]:
    commit = meta.get('source_commit', '')
    if meta.get('source_path') != path or not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError(f'Translation provenance mismatch: {path}')
    result = subprocess.run(['git', 'show', f'{commit}:{path}'], cwd=ROOT,
                            capture_output=True)
    if result.returncode:
        raise ValueError(f'Translation source commit unavailable: {commit}:{path}')
    baseline_text = result.stdout.decode('utf-8')
    if baseline_text.replace('\r\n', '\n') != original.replace('\r\n', '\n'):
        return 'stale', '上游原文已更新，当前中文仍对应旧版本；请对照最新英文，译文待同步。'
    return 'translated', ''


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8-sig')


def strip_frontmatter(text: str) -> str:
    return re.sub(r'\A---\r?\n.*?\r?\n---\r?\n', '', text, count=1, flags=re.S)


def metadata(text: str) -> dict[str, str]:
    match = re.match(r'\A---\r?\n(.*?)\r?\n---', text, re.S)
    if not match:
        return {}
    result = {}
    for line in match.group(1).splitlines():
        key, sep, value = line.partition(':')
        if sep:
            result[key.strip()] = value.strip().strip('\"\'')
    return result


def digest(path: Path) -> str:
    # Normalize checkout EOL differences; content, not autocrlf, defines drift.
    return hashlib.sha256(read_text(path).replace('\r\n', '\n').encode()).hexdigest()


def title(text: str, fallback: str) -> str:
    match = re.search(r'^#\s+(.+)$', strip_frontmatter(text), re.M)
    return match.group(1).strip() if match else fallback


def category(path: str) -> str:
    if path.startswith('docs/'):
        part = path.split('/')[1]
        return {'inference': '推理与性能', 'kubernetes': 'Kubernetes 与 GPU',
                'training': '训练与 MLOps', 'observability': '观测与可靠性',
                'hardware': '硬件', 'blog': '专题文章',
                'archive-blog': '历史文章', 'planning': '规划资料'}.get(part, '附录')
    if path.startswith('agent-infra/'):
        return 'Agent 基础设施'
    if path.startswith('case-study/'):
        return '案例研究'
    return '领域全景与导航'


def pairs(paths: set[str]) -> dict[str, str]:
    result = {'README.md': 'README.zh-CN.md'}
    for path in sorted(paths):
        for suffix in ('_zh.md', '-zh.md', '.zh-CN.md'):
            if path.endswith(suffix):
                stem = path[:-len(suffix)]
                for candidate in (stem + '.md', stem + '_en.md'):
                    if candidate in paths:
                        result[candidate] = path
                        break
    result['docs/blog/2026-04-01/2026-04-01-kubernetes-swap-status-kubelet-and-memory-pressure.md'] = (
        'docs/blog/2026-04-01/2026-04-01-kubernetes-swap-status-kubelet-memory-pressure_zh.md')
    return {en: zh for en, zh in result.items() if en in paths and zh in paths}


def has_chinese_body(path: str, text: str) -> bool:
    # Conservative explicit classification; no claim of sentence-level review.
    if path.endswith(('_zh.md', '-zh.md', '.zh-CN.md')):
        return True
    if path.startswith('case-study/'):
        return True
    known = {
        'agent-infra/ai-agent-infra-9-layers-zh.md',
        'docs/hardware/supernode.md', 'docs/kubernetes/tas-validation.md',
        'docs/kubernetes/lws-keps-learning-path.md',
        'docs/kubernetes/sig-release/v1.36/release.md',
        'docs/kubernetes/sig-release/v1.37/release.md',
        'docs/planning/executable-backlog-2026Q2.md',
    }
    return path in known


def collect() -> dict:
    for logical in STATE['files']:
        path = source_file(logical)
        if not path.is_file():
            raise ValueError(f'Missing managed source: {logical}; synchronize the ledger explicitly')
        expected = STATE.get('hashes', {}).get(logical)
        actual = hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
        if not expected or actual != expected:
            raise ValueError(f'Managed source differs from upstream ledger: {logical}')
    tracked = {p for p in STATE['files'] if p.endswith('.md') and source_file(p).is_file()}
    mapping = pairs(tracked)
    reverse = {zh: en for en, zh in mapping.items()}
    documents = []
    for path in sorted(tracked):
        if path in reverse:
            continue
        source = source_file(path)
        original = read_text(source)
        translation = LEARNING / 'content' / 'zh' / path
        status = 'original'
        body_text = original
        translation_path = None
        warning = ''
        translation_commit = None
        if translation.exists():
            body_text = read_text(translation)
            meta = metadata(body_text)
            status, warning = translation_state(meta, path, original)
            translation_commit = meta['source_commit']
            translation_path = translation.relative_to(ROOT).as_posix()
        elif path in mapping:
            body_text = read_text(source_file(mapping[path]))
            status = 'existing-zh'
            translation_path = mapping[path]
        elif has_chinese_body(path, original):
            status = 'existing-zh'
        doc = {
            'id': path, 'title': title(body_text, source.stem), 'category': category(path),
            'status': status, 'sourcePath': path,
            'sourceUrl': f'https://github.com/pacoxu/AI-Infra/blob/{BASELINE}/{path}',
            'sourceHash': digest(source), 'sourceCommit': BASELINE,
            'body': strip_frontmatter(body_text),
            'originalBody': strip_frontmatter(original) if status in {'translated', 'stale'} or path in mapping else None,
            'translationPath': translation_path,
            'translationCommit': translation_commit,
            'translationWarning': warning,
            'updated': metadata(original).get('last_updated', metadata(original).get('date', '')),
            'sourceStatus': metadata(original).get('status', '未标注'),
            'aliases': [mapping[path]] if path in mapping else [],
        }
        documents.append(doc)
    for source in sorted((LEARNING / 'content' / 'guides').glob('*.md')):
        text = read_text(source)
        path = source.relative_to(ROOT).as_posix()
        documents.append({'id': path, 'title': title(text, source.stem), 'category': '从这里开始',
                          'status': 'guide', 'sourcePath': path, 'sourceUrl': '',
                          'sourceHash': digest(source), 'sourceCommit': BASELINE,
                          'body': strip_frontmatter(text), 'originalBody': None,
                          'translationPath': None, 'updated': '2026-10-21',
                          'sourceStatus': '学习导读', 'aliases': []})
    raw_terms = json.loads(read_text(LEARNING / 'glossary.json'))
    if isinstance(raw_terms, dict):
        raw_terms = raw_terms['terms']
    terms = []
    for item in raw_terms:
        terms.append({**item, 'aliases': item.get('aliases', []),
                      'literal': item.get('literal', item.get('original', '')),
                      'meaning': item.get('meaning', item.get('plain', '')),
                      'example': item.get('example', ' / '.join(filter(None, [item.get('exampleEn'), item.get('exampleZh')]))),
                      'contextOverrides': item.get('contextOverrides', {})})
    updates = json.loads(read_text(LEARNING / 'updates.json'))
    route = [
        'learning/content/guides/00-start.md',
        'README.md',
        'learning/content/guides/01-request.md',
        'docs/kubernetes/pod-lifecycle.md',
        'docs/kubernetes/nvidia-gpu-operator.md',
        'learning/content/guides/02-metrics.md',
        'docs/inference/performance-testing.md',
        'docs/inference/caching.md',
        'learning/content/guides/03-platform.md',
        'docs/inference/aibrix.md',
    ]
    ids = {doc['id'] for doc in documents}
    # Deleted upstream articles leave historical translations on disk but must
    # not block unrelated publishing or remain a broken learning-route entry.
    route = [item for item in route if item in ids]
    return {'baseline': BASELINE, 'generatedAt': datetime.now(timezone.utc).isoformat(),
            'documents': documents, 'terms': terms, 'route': route, 'updates': updates,
            'pairing': mapping,
            'site': {'repositoryUrl': 'https://github.com/Luo-root/AI-Infra',
                     'upstreamUrl': 'https://github.com/pacoxu/AI-Infra'},
            'archivedTranslations': [p.relative_to(LEARNING / 'content/zh').as_posix()
                                     for p in sorted((LEARNING / 'content/zh').rglob('*.md'))
                                     if p.relative_to(LEARNING / 'content/zh').as_posix() not in tracked],
            'translationBacklog': [{'id': d['id'], 'status': d['status'],
                                    'sourceCommit': d['sourceCommit'],
                                    'translationCommit': d.get('translationCommit')}
                                   for d in documents if d['status'] in {'original', 'stale'}],
            'coverage': {'sourceMarkdown': len(tracked), 'paired': len(mapping),
                         'translated': sum(d['status'] == 'translated' for d in documents),
                         'stale': sum(d['status'] == 'stale' for d in documents),
                         'existingZh': sum(d['status'] == 'existing-zh' for d in documents),
                         'pending': sum(d['status'] == 'original' for d in documents)}}


def copy_assets(library: dict) -> int:
    count = 0
    asset_root = PUBLIC / 'assets'
    for doc in library['documents']:
        for field in ('body', 'originalBody'):
            body = doc.get(field) or ''
            links = re.findall(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', body)
            links += re.findall(r'(?:src|href)=[\"\']([^\"\']+)[\"\']', body)
            for link in links:
                if link.startswith(('#', '/', 'http:', 'https:', 'data:', 'mailto:')):
                    continue
                from urllib.parse import unquote
                relative = unquote(link.split('#')[0].split('?')[0])
                source = (ROOT / PurePosixPath(doc['sourcePath']).parent / relative).resolve()
                if not source.is_relative_to(ROOT) or not source.is_file() or source.suffix.lower() == '.md':
                    continue
                # Only static public assets; never copy arbitrary workspace files.
                if source.suffix.lower() not in {'.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'}:
                    continue
                target = asset_root / source.relative_to(ROOT)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                count += 1
    return count


def main() -> None:
    library = collect()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    output = PUBLIC / 'library.json'
    output.write_text(json.dumps(library, ensure_ascii=False, indent=2), encoding='utf-8')
    shutil.copy2(ROOT / 'LICENSE', PUBLIC / 'LICENSE.txt')
    copied = copy_assets(library)
    print(json.dumps({'documents': len(library['documents']), 'terms': len(library['terms']),
                      'coverage': library['coverage'], 'assetReferencesCopied': copied}, ensure_ascii=False))


if __name__ == '__main__':
    main()
