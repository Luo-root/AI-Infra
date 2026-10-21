"""Verify managed source bytes against the upstream ownership ledger."""
import hashlib
import json
import subprocess
from pathlib import Path


def normalized_hash(data: bytes) -> str:
    return hashlib.sha256(data.replace(b'\r\n', b'\n')).hexdigest()


def validate_source(path: Path, expected: str, logical_path: str) -> None:
    if not expected or normalized_hash(path.read_bytes()) != expected:
        raise ValueError(f'Managed source differs from upstream ledger: {logical_path}; keep local additions in learning/content or synchronize explicitly')


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    state_path = root / 'learning/upstream/sync-state.json'
    state = json.loads(state_path.read_text(encoding='utf-8'))
    hashes = {}
    for logical in state['files']:
        data = subprocess.run(['git', 'show', f"{state['commit']}:{logical}"], cwd=root, check=True, capture_output=True).stdout
        hashes[logical] = normalized_hash(data)
        local = root / ('learning/upstream/' + logical if logical in {'README.md', 'README.zh-CN.md'} else logical)
        validate_source(local, hashes[logical], logical)
    state['hashes'] = hashes
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Initialized {len(hashes)} source digests from exact upstream Git objects')
