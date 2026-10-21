"""Check the intended source publication set, not local caches or built artifacts."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
files = []
for directory in ['learning', 'learning-plan', '.github/workflows']:
    for path in (ROOT / directory).rglob('*'):
        if not path.is_file():
            continue
        parts = path.relative_to(ROOT).parts
        if any(part in {'node_modules', 'dist', 'public', 'test-results', 'release', '__pycache__', 'playwright-report'} for part in parts):
            continue
        files.append(path)
files += [ROOT / 'README.md', ROOT / 'README.zh-CN.md']
patterns = [r'gh[pousr]_[A-Za-z0-9]{20,}', r'github_pat_[A-Za-z0-9_]{20,}',
            r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----', r'sk-[A-Za-z0-9]{30,}']
findings = []
for path in files:
    try:
        text = path.read_text(encoding='utf-8-sig')
    except (UnicodeError, OSError):
        continue
    if any(re.search(pattern, text) for pattern in patterns):
        findings.append(path.relative_to(ROOT).as_posix())
if findings:
    raise SystemExit('Credential-shaped content found in: ' + ', '.join(findings))
print(f'Checked {len(files)} intended source files; no matches for limited credential patterns.')
print('This is a limited pattern check, not a guarantee that every secret or private datum was detected.')
