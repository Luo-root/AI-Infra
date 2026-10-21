"""Copy allowlisted Git blobs, never execute upstream code or trust its worktree."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path, PurePosixPath

REPOSITORY = 'pacoxu/AI-Infra'
STATE = 'learning/upstream/sync-state.json'
ROOT_FILES = {'README.md', 'README.zh-CN.md', 'BLOG.md', 'RoadMap.md',
              'STRUCTURE.md', 'project_watchlist.json'}
DIRECTORIES = {'docs', 'diagrams', 'case-study', 'agent-infra'}
EXTENSIONS = {'.md', '.mmd', '.pdf', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.ico'}


def content_hash(data):
    """SHA-256 with CRLF normalized to LF, shared with baseline initialization."""
    return hashlib.sha256(data.replace(b'\r\n', b'\n')).hexdigest()


def git(source, *args):
    return subprocess.check_output(['git', '-C', str(source), *args])


def allowed(name):
    if not isinstance(name, str) or not name or '\\' in name or ':' in name:
        return False
    path = PurePosixPath(name)
    if path.is_absolute() or any(p in ('', '.', '..') for p in name.split('/')):
        return False
    return name in ROOT_FILES or (len(path.parts) > 1 and path.parts[0] in DIRECTORIES
                                 and path.suffix.lower() in EXTENSIONS)


def destination(name):
    if not allowed(name):
        raise ValueError(f'Not an allowed upstream content path: {name!r}')
    return 'learning/upstream/' + name if name in {'README.md', 'README.zh-CN.md'} else name


def safe_path(root, name):
    """Reject symlinks/junctions even when they happen to resolve inside root."""
    path = root
    for part in PurePosixPath(name).parts:
        if part in ('', '.', '..'):
            raise ValueError(f'Unsafe destination: {name!r}')
        path = path / part
        if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
            raise ValueError(f'Linked destination: {path}')
    if not path.resolve().is_relative_to(root):
        raise ValueError(f'Destination escapes root: {name}')
    if path.exists() and not path.is_file():
        raise ValueError(f'Destination is not a file: {name}')
    return path


def synchronize(source, root, commit):
    source, root = Path(source).resolve(), Path(root).resolve()
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('--commit must be a full lowercase SHA-1')
    if git(source, 'rev-parse', 'HEAD').decode().strip() != commit:
        raise ValueError('--commit does not match source HEAD')
    state_path = safe_path(root, STATE)
    if not state_path.is_file():
        raise ValueError(f'Missing baseline: {STATE}; initialize it explicitly before syncing')
    state = json.loads(state_path.read_text(encoding='utf-8'))
    if (state.get('repository') != REPOSITORY or
            not re.fullmatch(r'[0-9a-f]{40}', str(state.get('commit', ''))) or
            not isinstance(state.get('files'), list) or
            any(not allowed(p) for p in state['files']) or
            len(set(state['files'])) != len(state['files'])):
        raise ValueError('Invalid sync baseline (repository, commit or managed paths)')
    previous = set(state['files'])
    hashes = state.get('hashes')
    if (not isinstance(hashes, dict) or set(hashes) != previous or
            any(not isinstance(value, str) or not re.fullmatch(r'[0-9a-f]{64}', value)
                for value in hashes.values())):
        raise ValueError('Missing or invalid baseline hashes; initialize hashes for every managed '
                         'file from the reviewed baseline using SHA-256 of CRLF-to-LF normalized bytes')
    blobs = {}
    for record in git(source, 'ls-tree', '-rz', '--full-tree', commit).split(b'\0'):
        if not record:
            continue
        header, raw_name = record.split(b'\t', 1)
        name = raw_name.decode('utf-8')
        if not allowed(name):
            continue
        mode, kind, oid = header.decode('ascii').split()
        if mode not in {'100644', '100755'} or kind != 'blob':
            raise ValueError(f'Upstream content is not a regular Git blob: {name}')
        blobs[name] = oid
    # Validate every destination before making any mutation, including deletions.
    paths = {name: safe_path(root, destination(name)) for name in previous | blobs.keys()}
    payloads = {name: git(source, 'cat-file', 'blob', oid) for name, oid in blobs.items()}
    # Check ownership/content for the entire plan before any copy or deletion.
    # Missing managed files are local deletions too: do not silently restore them.
    for name in previous:
        target = paths[name]
        if not target.exists() or content_hash(target.read_bytes()) != hashes[name]:
            raise ValueError(f'Local modification of managed content: {name}; reconcile it manually')
    for name in blobs.keys() - previous:
        target = paths[name]
        if target.exists() and content_hash(target.read_bytes()) != content_hash(payloads[name]):
            raise ValueError(f'New upstream path conflicts with local content: {name}; reconcile it manually')
    added, changed, deleted = [], [], []
    for name, data in payloads.items():
        target = paths[name]
        if not target.exists():
            added.append(name)
        elif content_hash(target.read_bytes()) != content_hash(data):
            changed.append(name)
    deleted = sorted(name for name in previous - blobs.keys() if paths[name].exists())
    affected = set(added + changed) | (previous - blobs.keys())
    stale = []
    translations = root / 'learning/content/zh'
    if translations.exists():
        for path in sorted(translations.rglob('*.md')):
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                continue
            text = path.read_text(encoding='utf-8')
            match = re.search(r'^source_path:\s*[\'\"]?([^\s\'\"]+)', text, re.M)
            if match and match.group(1) in affected:
                stale.append(path.relative_to(root).as_posix())
    for name in added + changed:
        paths[name].parent.mkdir(parents=True, exist_ok=True)
        paths[name].write_bytes(payloads[name])
    # No recursive deletion: only files explicitly owned by the old baseline.
    for name in deleted:
        paths[name].unlink()
    new_state = {'repository': REPOSITORY, 'commit': commit, 'files': sorted(blobs),
                 'hashes': {name: content_hash(payloads[name]) for name in sorted(blobs)}}
    state_path.write_text(json.dumps(new_state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = ['## Upstream content sync', '', f'Source: {REPOSITORY} @ `{commit}`', '',
             'Manual review required. No automatic merge or translation.',
             'Stale candidates below mean their source changed/deleted; translations were not modified.', '']
    for title, names in [('Added', added), ('Changed', changed), ('Deleted', deleted),
                         ('Stale translation candidates', stale)]:
        lines.append(f'### {title} ({len(names)})')
        # JSON quoting prevents filenames from injecting Markdown/HTML into the PR body.
        lines.extend('- ' + json.dumps(name, ensure_ascii=True).replace('<', '\\u003c').replace('`', '\\u0060')
                     for name in sorted(names))
        lines.append('')
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    try:
        print(synchronize(args.source, args.root, args.commit))
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f'Sync failed: {exc}\n')


if __name__ == '__main__':
    main()
