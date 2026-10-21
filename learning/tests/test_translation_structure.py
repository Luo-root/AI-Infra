"""Structural checks for complete translations, excluding deliberately deduped legacy Pod text."""
import collections
import re
import subprocess
import unittest
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('lib', ROOT / 'learning/scripts/build-library.py')
lib = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lib)


def without_code(text):
    return re.sub(r'^```[^\n]*\n.*?^```[^\n]*$', '', text, flags=re.M | re.S)


def headings(text):
    return re.findall(r'^(#{1,6})\s+(.+)$', without_code(lib.strip_frontmatter(text)), re.M)


def slug(text):
    text = re.sub(r'<[^>]+>', '', text).strip().lower()
    return re.sub(r'[^\w\s-]', '', text, flags=re.U).replace(' ', '-')


class TranslationStructureTests(unittest.TestCase):
    def test_inference_translations_preserve_structure_code_and_targets(self):
        for path in sorted((ROOT / 'learning/content/zh/docs/inference').glob('*.md')):
            meta = lib.metadata(lib.read_text(path))
            source_path = meta['source_path']
            source = subprocess.run(['git', 'show', f"{meta['source_commit']}:{source_path}"], cwd=ROOT,
                                    capture_output=True, check=True).stdout.decode()
            translated = lib.read_text(path)
            with self.subTest(path=source_path):
                self.assertEqual([h[0] for h in headings(source)], [h[0] for h in headings(translated)])
                blocks = lambda t: re.findall(r'^```([^\n]*)\n(.*?)^```', t, re.M | re.S)
                self.assertEqual(blocks(source), blocks(translated), 'Executable code must remain unchanged')
                targets = lambda t: collections.Counter(re.findall(r'!?\[[^\]]*\]\(([^\s)]+)', t))
                # Added explanatory notes may add links, but original links must survive.
                self.assertFalse(targets(source) - targets(translated), 'Original link targets missing')
                # Numeric/API details are especially easy to damage in translated comparison tables.
                source_tables = [l for l in without_code(source).splitlines() if l.strip().startswith('|')]
                translated_tables = [l for l in without_code(translated).splitlines() if l.strip().startswith('|')]
                self.assertEqual(len(source_tables), len(translated_tables), 'Table rows missing')
                for a, b in zip(source_tables, translated_tables):
                    self.assertEqual(a.count('|'), b.count('|'), 'Table columns differ')
                    numbers = lambda line: collections.Counter(re.findall(r'\d+(?:\.\d+)*', line))
                    for source_cell, translated_cell in zip(a.split('|'), b.split('|')):
                        self.assertEqual(numbers(source_cell), numbers(translated_cell), 'Table cell numeric values differ')
                if path.name not in {'aibrix.md', 'performance-testing.md', 'caching.md'}:
                    ids = re.findall(r'<a\s+id="([^"]+)"', translated)
                    self.assertEqual(len(ids), len(set(ids)), 'Duplicate explicit anchor')
                    self.assertGreaterEqual(len(ids), len(headings(source)), 'Missing source anchors')


if __name__ == '__main__':
    unittest.main()
