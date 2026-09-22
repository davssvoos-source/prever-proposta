"""Behavioral checks of scripts/docs-lint.sh over temporary documentation trees (harness:R6)."""
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

LINT = Path(__file__).resolve().parents[1] / 'docs-lint.sh'
LONG = 'x' * 121
ADR = '# ADR-0001 — Decisão\n\n- **Data:** 2026-01-01\n- **Status:** Aceito\n'
STATE = '# m — Estado\n\n## O que existe\n\n- ok\n\n## Pendências\n\n- (nenhuma)\n'


class DocsLintTests(unittest.TestCase):
    def valid_tree(self):
        return {
            'AGENTS.md': '# Cápsula\n',
            'README.md': '# Projeto\n',
            'docs/ARCHITECTURE.md': '# Índice\n\n| ADR | D |\n|---|---|\n'
                                    '| [ADR-0001](decisions/ADR-0001-x.md) | x |\n',
            'docs/REQUIREMENTS.md': '# Índice\n\n| Módulo | Conteúdo | Status |\n|---|---|---|\n'
                                    '| [m](requirements/m.md) | c | Completo |\n',
            'docs/requirements/m.md': '# m — Requisitos\n',
            'docs/state/m.md': STATE,
            'docs/decisions/ADR-0001-x.md': ADR,
            'docs/decisions/ADR-0000-template.md': '# ADR-0000 — <Título>\n',
        }

    def run_lint(self, files, env=None):
        with tempfile.TemporaryDirectory() as directory:
            for name, content in files.items():
                path = Path(directory) / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding='utf-8')
            return subprocess.run(['sh', str(LINT), directory], capture_output=True, text=True, encoding='utf-8',
                                  env={**os.environ, 'DOCS_LINT_LEGACY': '', **(env or {})})

    def assert_fails(self, files, rule, env=None):
        result = self.run_lint(files, env)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(f'ERRO  {rule}', result.stdout)

    def test_valid_tree_passes(self):
        result = self.run_lint(self.valid_tree())
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('docs-lint: ok', result.stdout)

    def test_r1_long_prose_line_fails(self):
        files = self.valid_tree()
        files['AGENTS.md'] += LONG + '\n'
        self.assert_fails(files, 'R1 AGENTS.md')

    def test_r1_exempts_tables_code_links_and_frontmatter(self):
        files = self.valid_tree()
        files['AGENTS.md'] = ('---\ndescription: ' + LONG + '\n---\n| ' + LONG + ' |\n```\n' + LONG
                              + '\n```\nveja [' + LONG + '](x.md)\n')
        result = self.run_lint(files)
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_r1_counts_characters_not_bytes(self):
        files = self.valid_tree()
        files['AGENTS.md'] += 'ç' * 120 + '\n'
        self.assertEqual(self.run_lint(files).returncode, 0)

    def test_r1_legacy_only_warns(self):
        files = self.valid_tree()
        files['docs/old.md'] = LONG + '\n'
        result = self.run_lint(files, {'DOCS_LINT_LEGACY': 'docs/old.md'})
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('aviso R1 docs/old.md', result.stdout)
        self.assertIn('1 aviso(s)', result.stdout)

    def test_r2_status_over_140_fails(self):
        files = self.valid_tree()
        files['docs/REQUIREMENTS.md'] = files['docs/REQUIREMENTS.md'].replace('Completo', 'P' * 141)
        self.assert_fails(files, 'R2 Status > 140')

    def test_r3_adr_without_header_or_index_fails(self):
        files = self.valid_tree()
        files['docs/decisions/ADR-0001-x.md'] = '# ADR-0001 — Decisão\n\n- **Data:** 2026-01-01\n'
        self.assert_fails(files, 'R3 docs/decisions/ADR-0001-x.md sem cabeçalho Status')
        files = self.valid_tree()
        files['docs/decisions/ADR-0002-y.md'] = ADR
        self.assert_fails(files, 'R3 ADR-0002 não indexado')

    def test_r4_requirement_not_indexed_and_state_without_requirement_fail(self):
        files = self.valid_tree()
        files['docs/requirements/n.md'] = '# n\n'
        self.assert_fails(files, 'R4 docs/requirements/n.md fora do índice')
        files = self.valid_tree()
        files['docs/state/n.md'] = STATE
        self.assert_fails(files, 'R4 docs/state/n.md sem docs/requirements/n.md')

    def test_r5_date_outside_pendencias_fails_inside_passes(self):
        files = self.valid_tree()
        files['docs/state/m.md'] = STATE.replace('- ok', '- entregue em 2026-01-01')
        self.assert_fails(files, 'R5 docs/state/m.md')
        files = self.valid_tree()
        files['docs/state/m.md'] = STATE.replace('- (nenhuma)', '- Stripe real (aguardando desde 01/02/2026)')
        self.assertEqual(self.run_lint(files).returncode, 0)

    def test_r5_ignores_identifiers_in_backticks(self):
        files = self.valid_tree()
        files['docs/state/m.md'] = STATE.replace('- ok', '- migration `000012_2026-01-01_x`')
        self.assertEqual(self.run_lint(files).returncode, 0)


if __name__ == '__main__':
    unittest.main()
