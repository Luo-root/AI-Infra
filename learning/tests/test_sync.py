"""Offline sync safety tests. All fixtures stay under test-results/sync-tests."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('sync_upstream', ROOT / 'learning/scripts/sync-upstream.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncTests(unittest.TestCase):
    def setUp(self):
        base = ROOT / 'learning/test-results/sync-tests'
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=base)
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source'
        self.root = Path(self.temp.name) / 'target'
        self.source.mkdir()
        self.root.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Offline tests')
        self.git('config', 'user.email', 'tests@example.invalid')
        self.put(self.source, 'README.md', 'Original upstream')
        self.put(self.source, 'docs/a.md', 'Document A')
        self.commit()
        self.put(self.root, 'README.md', 'Local project introduction')
        self.state([])

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.source), *args], stderr=subprocess.STDOUT)

    def put(self, root, name, text):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')

    def commit(self):
        self.git('add', '-A')
        self.git('commit', '-qm', 'fixture')
        self.sha = self.git('rev-parse', 'HEAD').decode().strip()

    def state(self, files):
        hashes = {name: sync.content_hash((self.root / sync.destination(name)).read_bytes())
                  for name in files if sync.allowed(name)}
        self.put(self.root, sync.STATE, json.dumps({
            'repository': sync.REPOSITORY, 'commit': self.sha, 'files': files, 'hashes': hashes}))

    def run_sync(self):
        return sync.synchronize(self.source, self.root, self.sha)

    def test_copy_mapping_tracked_only_and_idempotence(self):
        self.put(self.source, 'docs/untracked.md', 'Must not be copied')
        # The Git blob, not a modified checkout file, is authoritative.
        self.put(self.source, 'docs/a.md', 'Dirty checkout must not be copied')
        summary = self.run_sync()
        self.assertEqual((self.root / 'README.md').read_text(), 'Local project introduction')
        self.assertEqual((self.root / 'learning/upstream/README.md').read_text(), 'Original upstream')
        self.assertEqual((self.root / 'docs/a.md').read_text(), 'Document A')
        self.assertFalse((self.root / 'docs/untracked.md').exists())
        state = json.loads((self.root / sync.STATE).read_text())
        self.assertEqual(state['files'], ['README.md', 'docs/a.md'])
        self.assertEqual(state['commit'], self.sha)
        before = (self.root / sync.STATE).read_bytes()
        self.assertIn('Added (2)', summary)
        self.assertIn('Added (0)', self.run_sync())
        self.assertEqual((self.root / sync.STATE).read_bytes(), before)

    def test_deletion_only_managed_and_stale_translation_report(self):
        self.put(self.root, 'docs/deleted.md', 'Old source')
        self.state(['docs/deleted.md'])
        self.put(self.root, 'docs/local.md', 'Local unowned document')
        self.put(self.root, 'learning/content/zh/docs/deleted.md',
                 '---\nsource_path: docs/deleted.md\n---\nLocal translation')
        self.put(self.root, 'learning/content/zh/docs/a.md',
                 '---\nsource_path: docs/a.md\n---\nTranslation')
        summary = self.run_sync()
        self.assertFalse((self.root / 'docs/deleted.md').exists())
        self.assertTrue((self.root / 'docs/local.md').exists())
        self.assertTrue((self.root / 'learning/content/zh/docs/deleted.md').exists())
        self.assertIn('Deleted (1)', summary)
        self.assertIn('Stale translation candidates (2)', summary)

    def test_excludes_upstream_code_and_keeps_static_assets(self):
        for name in ['.github/workflows/attack.yml', 'learning/attack.md',
                     'docs/run.py', 'docs/run.sh', 'agent-infra/app.js', 'scripts/run.md']:
            self.put(self.source, name, 'Do not copy')
        for name in ['README.zh-CN.md', 'diagrams/a.svg', 'docs/data.json', 'BLOG.md']:
            self.put(self.source, name, 'Allowed content')
        self.commit()
        self.run_sync()
        self.assertTrue((self.root / 'diagrams/a.svg').exists())
        self.assertTrue((self.root / 'docs/data.json').exists())
        self.assertTrue((self.root / 'learning/upstream/README.zh-CN.md').exists())
        self.assertFalse((self.root / 'docs/run.py').exists())
        self.assertFalse((self.root / '.github').exists())
        self.assertFalse((self.root / 'learning/attack.md').exists())
        self.assertFalse((self.root / 'agent-infra/app.js').exists())

    def test_bootstrap_mmd_and_pdf_paths_and_managed_deletion(self):
        self.put(self.root, 'diagrams/old.mmd', 'Old managed diagram')
        self.put(self.root, 'docs/old.pdf', 'Old managed PDF')
        self.state(['diagrams/old.mmd', 'docs/old.pdf'])
        self.put(self.source, 'diagrams/new.mmd', 'graph TD; A-->B')
        self.put(self.source, 'docs/new.pdf', '%PDF-1.7 fixture')
        self.commit()
        self.run_sync()
        self.assertEqual((self.root / 'diagrams/new.mmd').read_text(), 'graph TD; A-->B')
        self.assertEqual((self.root / 'docs/new.pdf').read_text(), '%PDF-1.7 fixture')
        self.assertFalse((self.root / 'diagrams/old.mmd').exists())
        self.assertFalse((self.root / 'docs/old.pdf').exists())

    def test_managed_local_edit_refuses_overwrite_and_preserves_state(self):
        self.run_sync()
        before = (self.root / sync.STATE).read_bytes()
        self.put(self.root, 'docs/a.md', 'My local edit')
        self.put(self.source, 'docs/a.md', 'Upstream changed too')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'Local modification'):
            self.run_sync()
        self.assertEqual((self.root / 'docs/a.md').read_text(), 'My local edit')
        self.assertEqual((self.root / sync.STATE).read_bytes(), before)

    def test_managed_local_edit_refuses_deletion_before_other_copies(self):
        self.run_sync()
        self.put(self.root, 'docs/a.md', 'Local work must survive')
        (self.source / 'docs/a.md').unlink()
        self.put(self.source, 'docs/new.md', 'Would otherwise be copied')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'Local modification'):
            self.run_sync()
        self.assertEqual((self.root / 'docs/a.md').read_text(), 'Local work must survive')
        self.assertFalse((self.root / 'docs/new.md').exists())

    def test_new_path_conflict_is_rejected_before_any_mutation(self):
        self.put(self.root, 'docs/a.md', 'Local unowned content')
        before = (self.root / sync.STATE).read_bytes()
        with self.assertRaisesRegex(ValueError, 'conflicts with local content'):
            self.run_sync()
        self.assertEqual((self.root / 'docs/a.md').read_text(), 'Local unowned content')
        self.assertFalse((self.root / 'learning/upstream/README.md').exists())
        self.assertEqual((self.root / sync.STATE).read_bytes(), before)

    def test_identical_new_path_can_be_adopted_with_lf_hashes(self):
        self.put(self.source, 'docs/a.md', 'Document A\nNext line\n')
        self.commit()
        target = self.root / 'docs/a.md'
        target.parent.mkdir(parents=True)
        target.write_bytes(b'Document A\r\nNext line\r\n')
        self.run_sync()
        state = json.loads((self.root / sync.STATE).read_text())
        self.assertEqual(set(state['hashes']), set(state['files']))
        self.assertEqual(state['hashes']['docs/a.md'], sync.content_hash(b'Document A\nNext line\n'))
        self.assertEqual(target.read_bytes(), b'Document A\r\nNext line\r\n')
        self.run_sync()  # A CRLF checkout remains valid on the next sync.

    def test_missing_or_incomplete_hashes_require_explicit_initialization(self):
        self.put(self.root, 'docs/a.md', 'Document A')
        self.state(['docs/a.md'])
        path = self.root / sync.STATE
        valid = json.loads(path.read_text())
        for hashes in [None, {}, {'docs/a.md': 'invalid'}]:
            state = dict(valid)
            if hashes is None:
                state.pop('hashes')
            else:
                state['hashes'] = hashes
            path.write_text(json.dumps(state), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'initialize hashes'):
                self.run_sync()
            self.assertFalse((self.root / 'learning/upstream/README.md').exists())

    def test_local_deletion_of_managed_file_is_not_restored(self):
        self.run_sync()
        (self.root / 'docs/a.md').unlink()
        with self.assertRaisesRegex(ValueError, 'Local modification'):
            self.run_sync()
        self.assertFalse((self.root / 'docs/a.md').exists())

    def test_invalid_managed_paths_rejected_before_mutation(self):
        for name in ['../README.md', '/docs/a.md', 'docs/../README.md',
                     'docs\\a.md', 'C:/docs/a.md', 'learning/content/zh/a.md',
                     '.github/workflows/a.yml', 'docs/run.py', 'docs//a.md']:
            with self.subTest(name=name):
                self.state([name])
                with self.assertRaises(ValueError):
                    self.run_sync()
                self.assertFalse((self.root / 'docs/a.md').exists())

    def test_bad_commit_and_repository_and_missing_baseline(self):
        with self.assertRaisesRegex(ValueError, 'HEAD'):
            sync.synchronize(self.source, self.root, '0' * 40)
        with self.assertRaisesRegex(ValueError, 'full lowercase'):
            sync.synchronize(self.source, self.root, 'HEAD')
        self.put(self.root, sync.STATE, json.dumps({
            'repository': 'attacker/repo', 'commit': self.sha, 'files': []}))
        with self.assertRaisesRegex(ValueError, 'Invalid sync baseline'):
            self.run_sync()
        (self.root / sync.STATE).unlink()
        with self.assertRaisesRegex(ValueError, 'Missing baseline'):
            self.run_sync()

    def test_upstream_git_symlink_rejected_without_checkout(self):
        # Reuse an existing blob as symlink payload; no OS symlink privileges needed.
        oid = self.git('rev-parse', 'HEAD:README.md').decode().strip()
        self.git('update-index', '--add', '--cacheinfo', f'120000,{oid},docs/link.md')
        self.git('commit', '-qm', 'symlink fixture')
        self.sha = self.git('rev-parse', 'HEAD').decode().strip()
        with self.assertRaisesRegex(ValueError, 'regular Git blob'):
            self.run_sync()
        self.assertFalse((self.root / 'docs/a.md').exists())

    def test_destination_symlink_rejected(self):
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        try:
            (self.root / 'docs').symlink_to(outside, target_is_directory=True)
        except OSError as exc:
            self.skipTest(f'OS does not permit symlink creation: {exc}')
        with self.assertRaisesRegex(ValueError, 'Linked destination'):
            self.run_sync()
        self.assertFalse((outside / 'a.md').exists())

    def test_deletion_symlink_rejected_before_any_mutation(self):
        outside = Path(self.temp.name) / 'keep.md'
        outside.write_text('Keep me', encoding='utf-8')
        self.put(self.root, 'docs/deleted.md', 'Keep me')
        self.state(['docs/deleted.md'])
        (self.root / 'docs/deleted.md').unlink()
        try:
            (self.root / 'docs/deleted.md').symlink_to(outside)
        except OSError as exc:
            self.skipTest(f'OS does not permit symlink creation: {exc}')
        with self.assertRaisesRegex(ValueError, 'Linked destination'):
            self.run_sync()
        self.assertEqual(outside.read_text(), 'Keep me')
        self.assertFalse((self.root / 'docs/a.md').exists())


if __name__ == '__main__':
    unittest.main()
