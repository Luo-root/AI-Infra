"""Content integrity checks; no network and no cluster execution."""
import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('library', ROOT / 'learning/scripts/build-library.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ContentTests(unittest.TestCase):
    def test_translation_provenance_and_structure(self):
        translations = list((ROOT / 'learning/content/zh').rglob('*.md'))
        self.assertGreaterEqual(len(translations), 6)
        for translation in translations:
            with self.subTest(path=translation.name):
                text = module.read_text(translation)
                meta = module.metadata(text)
                self.assertRegex(meta.get('source_commit', ''), r'^[0-9a-f]{40}$')
                self.assertEqual(meta.get('translation_status'), 'translated')
                source = ROOT / meta['source_path']
                # Deleted upstream originals may leave archived translations; their recorded Git source remains testable.
                import subprocess
                original = subprocess.run(['git', 'show', f"{meta['source_commit']}:{meta['source_path']}"], cwd=ROOT, check=True, capture_output=True).stdout.decode('utf-8')
                self.assertEqual(text.count('```') % 2, 0)
                # All external source destinations must survive translation.
                urls = set(re.findall(r'https?://[^\s<>\)\"\']+', original))
                for url in urls:
                    self.assertIn(url, text)
                self.assertNotIn(b'\r', translation.read_bytes().replace(b'\r\n', b'\n'), 'Unexpected lone CR; normal checkout CRLF is allowed')
                self.assertGreater(len(re.findall(r'[\u4e00-\u9fff]', text)), 100)

    def test_exact_executable_code(self):
        for path in ['docs/kubernetes/nvidia-gpu-operator.md', 'docs/inference/aibrix.md']:
            translated = module.read_text(ROOT / 'learning/content/zh' / path)
            meta = module.metadata(translated)
            import subprocess
            original = subprocess.run(['git', 'show', f"{meta['source_commit']}:{path}"], cwd=ROOT, check=True, capture_output=True).stdout.decode('utf-8')
            blocks = lambda text: re.findall(r'^```[^\n]*\n(.*?)^```', text, re.M | re.S)
            self.assertEqual(blocks(original), blocks(translated), path)

    def test_library_route_and_truthful_status(self):
        library = module.collect()
        documents = library['documents']
        ids = [doc['id'] for doc in documents]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(library['coverage']['paired'], 1)
        translation_files = list((ROOT / 'learning/content/zh').rglob('*.md'))
        self.assertEqual(library['coverage']['translated'] + library['coverage']['stale']
                         + len(library['archivedTranslations']), len(translation_files))
        for path in library['route']:
            self.assertIn(path, ids)
            doc = next(d for d in documents if d['id'] == path)
            self.assertNotEqual(doc['status'], 'original', path)
        for doc in documents:
            if doc['status'] == 'translated':
                self.assertTrue(doc['originalBody'])
                self.assertTrue(doc['translationPath'])
            self.assertEqual(len(doc['sourceHash']), 64)

    def test_glossary_has_meaning_not_empty_shells(self):
        terms = module.collect()['terms']
        self.assertGreaterEqual(len(terms), 25)
        ids = [term['id'] for term in terms]
        self.assertEqual(len(ids), len(set(ids)))
        for term in terms:
            for key in ['term', 'zh', 'meaning', 'literal', 'source']:
                self.assertTrue(term.get(key), (term['id'], key))

    def test_guides_links_resolve(self):
        documents = module.collect()['documents']
        ids = {doc['id'] for doc in documents}
        from urllib.parse import urljoin, unquote
        for doc in documents:
            if doc['status'] != 'guide':
                continue
            for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', doc['body']):
                if link.startswith(('http', '#')):
                    continue
                resolved = unquote(urljoin('/' + doc['sourcePath'], link).split('#')[0]).lstrip('/')
                self.assertIn(resolved, ids, (doc['id'], link))


if __name__ == '__main__':
    unittest.main()
