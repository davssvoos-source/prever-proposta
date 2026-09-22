"""Behavioral checks using temporary manifests and harmless shell commands."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml

RUNNER = Path(__file__).resolve().parents[1] / 'harness-gates.py'


class GateRunnerTests(unittest.TestCase):
    def run_manifest(self, gates, commands=None, raw=None):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / 'manifest.yaml'
            manifest.write_text(raw if raw is not None else yaml.safe_dump(
                {'version': 1, 'commands': commands, 'gates': gates}))
            return subprocess.run([sys.executable, str(RUNNER), '--manifest', str(manifest)],
                                  cwd=directory, capture_output=True, text=True)

    def gate(self, run, required=True, name='test'):
        return {'name': name, 'run': run, 'required': required}

    def test_nested_references_and_repository_working_directory(self):
        result = self.run_manifest([self.gate('${commands.test:api}')],
                                   {'test:api': '${commands.check}', 'check': 'test -f .harness/harness.yaml'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('PASS test', result.stdout)

    def test_required_failure_and_following_gate(self):
        result = self.run_manifest([self.gate('exit 7'), self.gate('true', name='next')])
        self.assertEqual(result.returncode, 1)
        self.assertIn('exit=7', result.stdout)
        self.assertIn('PASS next', result.stdout)

    def test_optional_failure(self):
        result = self.run_manifest([self.gate('false', required=False)])
        self.assertEqual(result.returncode, 0)
        self.assertIn('FAIL test', result.stdout)

    def test_missing_executable_fails_required_gate(self):
        result = self.run_manifest([self.gate('pattern_nonexistent_command_7241')])
        self.assertEqual(result.returncode, 1)
        self.assertIn('exit=127', result.stdout)

    def test_invalid_configuration_runs_nothing(self):
        cases = [
            ([self.gate('${commands.missing}')], {}),
            ([self.gate('${commands.a}')], {'a': '${commands.b}', 'b': '${commands.a}'}),
            ([self.gate('${commands.bad')], {}),
            ([self.gate('true', required='true')], {}),
            ([self.gate('')], {}),
            ([self.gate('true'), self.gate('false')], {}),
            ([], {}),
            ([self.gate('true')], {'test': 42}),
        ]
        for gates, commands in cases:
            with self.subTest(gates=gates, commands=commands):
                result = self.run_manifest([self.gate('echo MUST_NOT_RUN', name='first'), *gates]
                                           if gates else [], commands)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertNotIn('MUST_NOT_RUN', result.stdout)

    def test_duplicate_yaml_keys_and_invalid_yaml(self):
        for raw in ['version: 1\nversion: 1\n', 'gates: [', '[]', 'version: true\n']:
            with self.subTest(raw=raw):
                result = self.run_manifest(None, raw=raw)
                self.assertEqual(result.returncode, 2)
                self.assertIn('INVALID MANIFEST', result.stderr)


if __name__ == '__main__':
    unittest.main()
