"""Source revision and stale-translation behavior."""
import importlib.util
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('build_library', ROOT / 'learning/scripts/build-library.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FreshnessTests(unittest.TestCase):
    def test_unchanged_source_is_translated(self):
        path = 'docs/inference/caching.md'
        meta = module.metadata(module.read_text(ROOT / 'learning/content/zh' / path))
        original = subprocess.run(['git', 'show', f"{meta['source_commit']}:{path}"], cwd=ROOT, check=True, capture_output=True).stdout.decode()
        status, warning = module.translation_state(meta, path, original)
        self.assertEqual(status, 'translated')
        self.assertEqual(warning, '')

    def test_changed_source_is_stale_not_build_failure(self):
        path = 'docs/inference/caching.md'
        meta = module.metadata(module.read_text(ROOT / 'learning/content/zh' / path))
        status, warning = module.translation_state(meta, path, module.read_text(ROOT / path) + '\nNew source paragraph.\n')
        self.assertEqual(status, 'stale')
        self.assertIn('待同步', warning)

    def test_malformed_source_commit_is_error(self):
        with self.assertRaises(ValueError):
            module.translation_state({'source_path': 'x', 'source_commit': '../bad'}, 'x', '')

    def test_local_source_drift_is_rejected(self):
        from unittest.mock import patch
        original = Path.read_bytes
        target = ROOT / 'docs/inference/caching.md'
        def changed(path):
            data = original(path)
            return data + b'\nLOCAL ONLY\n' if path == target else data
        with patch.object(Path, 'read_bytes', changed):
            with self.assertRaisesRegex(ValueError, 'differs from upstream ledger'):
                module.collect()

    def test_deleted_source_translation_is_archived_and_route_pruned(self):
        from unittest.mock import patch
        removed = 'docs/kubernetes/pod-lifecycle.md'
        state = {**module.STATE, 'files': [p for p in module.STATE['files'] if p != removed]}
        with patch.object(module, 'STATE', state):
            data = module.collect()
        self.assertNotIn(removed, data['route'])
        self.assertIn(removed, data['archivedTranslations'])
        self.assertNotIn(removed, [d['id'] for d in data['documents']])

    def test_deleted_source_passes_entire_content_suite(self):
        from unittest.mock import patch
        import test_content
        removed = 'docs/kubernetes/learning-plan.md'
        state = {**module.STATE, 'files': [p for p in module.STATE['files'] if p != removed]}
        state['hashes'] = {p: h for p, h in state['hashes'].items() if p != removed}
        with patch.object(test_content.module, 'STATE', state):
            suite = unittest.defaultTestLoader.loadTestsFromTestCase(test_content.ContentTests)
            result = unittest.TestResult()
            suite.run(result)
        self.assertEqual(result.errors, [])
        self.assertEqual(result.failures, [])

    def test_readme_uses_preserved_upstream_not_project_landing(self):
        doc = next(d for d in module.collect()['documents'] if d['id'] == 'README.md')
        self.assertIn('全景图', doc['title'])
        self.assertNotIn('GitHub Pages 部署配置正在接入', doc['body'])
        self.assertEqual(module.source_file('README.md'), ROOT / 'learning/upstream/README.md')
        upstream = subprocess.run(['git', 'show', f'{module.BASELINE}:README.md'], cwd=ROOT, check=True, capture_output=True).stdout.decode()
        self.assertEqual(module.read_text(module.source_file('README.md')), upstream)


if __name__ == '__main__':
    unittest.main()
