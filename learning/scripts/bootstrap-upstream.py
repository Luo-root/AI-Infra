"""One-time preservation of original upstream landing pages from Git."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMIT = '3cc83ef18ed502929e55d0e598129c7525e5f993'
DEST = ROOT / 'learning/upstream'
DEST.mkdir(parents=True, exist_ok=True)
for name in ['README.md', 'README.zh-CN.md']:
    target = DEST / name
    if target.exists():
        raise SystemExit(f'Refusing to overwrite {target}')
    data = subprocess.run(['git', 'show', f'{COMMIT}:{name}'], cwd=ROOT, check=True, capture_output=True).stdout
    target.write_bytes(data)
paths = subprocess.run(['git', 'ls-tree', '-r', '--name-only', COMMIT], cwd=ROOT, check=True, capture_output=True).stdout.decode().splitlines()
roots = {'README.md','README.zh-CN.md','BLOG.md','RoadMap.md','STRUCTURE.md','project_watchlist.json'}
exts = {'.md','.svg','.png','.jpg','.jpeg','.gif','.webp','.json','.mmd','.pdf'}
managed = [p for p in paths if (p in roots or p.startswith(('docs/','diagrams/','case-study/','agent-infra/'))) and Path(p).suffix.lower() in exts]
(DEST / 'sync-state.json').write_text(json.dumps({'repository':'pacoxu/AI-Infra','commit':COMMIT,'files':managed}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Preserved landing pages and {len(managed)} managed paths')
