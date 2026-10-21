"""Package built reader plus its authoring sources; exclude dependency/cache trees."""
from pathlib import Path
import zipfile

LEARNING = Path(__file__).resolve().parents[1]
OUTPUT = LEARNING / 'release' / 'ai-infra-learning-v0.1.zip'
if not (LEARNING / 'dist/index.html').is_file():
    raise SystemExit('Build the site first')
OUTPUT.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as archive:
    for directory in ['dist', 'content', 'web/src', 'scripts', 'tests/browser']:
        for source in sorted((LEARNING / directory).rglob('*')):
            if source.is_file() and '__pycache__' not in source.parts:
                archive.write(source, source.relative_to(LEARNING))
    for name in ['README.zh-CN.md', 'start.ps1', 'package.json', 'bun.lock', 'glossary.json',
                 'updates.json', 'playwright.config.js', 'web/index.html', 'web/vite.config.js',
                 'tests/test_content.py', 'tests/test_sync.py', 'tests/test_freshness.py',
                 'upstream/README.md', 'upstream/README.zh-CN.md', 'upstream/sync-state.json']:
        source = LEARNING / name
        if source.is_file():
            archive.write(source, name)
    for source in sorted((LEARNING.parent / 'learning-plan').glob('*.md')):
        archive.write(source, Path('planning') / source.name)
    archive.write(LEARNING.parent / 'LICENSE', 'LICENSE')
with zipfile.ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    assert 'dist/index.html' in archive.namelist()
print(f'{OUTPUT} ({OUTPUT.stat().st_size:,} bytes)')
