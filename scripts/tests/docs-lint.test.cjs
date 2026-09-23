// Testes de comportamento de scripts/docs-lint.cjs sobre árvores temporárias de documentação.
// Porte 1:1 dos testes do Pattern Harness (test_docs_lint.py) para `node --test` (ADR-0004).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const LINT = path.resolve(__dirname, '..', 'docs-lint.cjs');
const LONG = 'x'.repeat(121);
const ADR = '# ADR-0001 — Decisão\n\n- **Data:** 2026-01-01\n- **Status:** Aceito\n';
const STATE = '# m — Estado\n\n## O que existe\n\n- ok\n\n## Pendências\n\n- (nenhuma)\n';

const arvoreValida = () => ({
  'AGENTS.md': '# Cápsula\n',
  'README.md': '# Projeto\n',
  'docs/ARCHITECTURE.md': '# Índice\n\n| ADR | D |\n|---|---|\n| [ADR-0001](decisions/ADR-0001-x.md) | x |\n',
  'docs/REQUIREMENTS.md': '# Índice\n\n| Módulo | Conteúdo | Status |\n|---|---|---|\n| [m](requirements/m.md) | c | Completo |\n',
  'docs/requirements/m.md': '# m — Requisitos\n',
  'docs/state/m.md': STATE,
  'docs/decisions/ADR-0001-x.md': ADR,
  'docs/decisions/ADR-0000-template.md': '# ADR-0000 — <Título>\n',
});

// A árvore de teste não tem os documentos legados do repositório: LEGACY fica vazio
// (um espaço — o Windows não garante variável de ambiente com valor vazio).
function rodar(arquivos, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-lint-'));
  try {
    for (const [nome, conteudo] of Object.entries(arquivos)) {
      const p = path.join(dir, nome);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, conteudo);
    }
    return spawnSync(process.execPath, [LINT, dir], {
      encoding: 'utf8',
      env: { ...process.env, DOCS_LINT_LEGACY: ' ', ...env },
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function falha(arquivos, regra, env) {
  const r = rodar(arquivos, env);
  assert.equal(r.status, 1, r.stdout);
  assert.ok(r.stdout.includes(`ERRO  ${regra}`), r.stdout);
}

test('árvore válida passa', () => {
  const r = rodar(arvoreValida());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('docs-lint: ok'), r.stdout);
});

test('R1: linha de prosa longa falha', () => {
  const a = arvoreValida();
  a['AGENTS.md'] += LONG + '\n';
  falha(a, 'R1 AGENTS.md');
});

test('R1: isenta tabela, código, link e frontmatter', () => {
  const a = arvoreValida();
  a['AGENTS.md'] = '---\ndescription: ' + LONG + '\n---\n| ' + LONG + ' |\n```\n' + LONG + '\n```\nveja [' + LONG + '](x.md)\n';
  const r = rodar(a);
  assert.equal(r.status, 0, r.stdout);
});

test('R1: conta caracteres, não bytes', () => {
  const a = arvoreValida();
  a['AGENTS.md'] += 'ç'.repeat(120) + '\n';
  assert.equal(rodar(a).status, 0);
});

test('R1: legado só avisa', () => {
  const a = arvoreValida();
  a['docs/old.md'] = LONG + '\n';
  const r = rodar(a, { DOCS_LINT_LEGACY: 'docs/old.md' });
  assert.equal(r.status, 0, r.stdout);
  assert.ok(r.stdout.includes('aviso R1 docs/old.md'), r.stdout);
  assert.ok(r.stdout.includes('1 aviso(s)'), r.stdout);
});

test('R2: Status com mais de 140 caracteres falha', () => {
  const a = arvoreValida();
  a['docs/REQUIREMENTS.md'] = a['docs/REQUIREMENTS.md'].replace('Completo', 'P'.repeat(141));
  falha(a, 'R2 Status > 140');
});

test('R3: ADR sem cabeçalho ou fora do índice falha', () => {
  let a = arvoreValida();
  a['docs/decisions/ADR-0001-x.md'] = '# ADR-0001 — Decisão\n\n- **Data:** 2026-01-01\n';
  falha(a, 'R3 docs/decisions/ADR-0001-x.md sem cabeçalho Status');
  a = arvoreValida();
  a['docs/decisions/ADR-0002-y.md'] = ADR;
  falha(a, 'R3 ADR-0002 não indexado');
});

test('R4: requisito fora do índice e state sem requisito falham', () => {
  let a = arvoreValida();
  a['docs/requirements/n.md'] = '# n\n';
  falha(a, 'R4 docs/requirements/n.md fora do índice');
  a = arvoreValida();
  a['docs/state/n.md'] = STATE;
  falha(a, 'R4 docs/state/n.md sem docs/requirements/n.md');
});

test('R5: data fora de Pendências falha; dentro passa', () => {
  let a = arvoreValida();
  a['docs/state/m.md'] = STATE.replace('- ok', '- entregue em 2026-01-01');
  falha(a, 'R5 docs/state/m.md');
  a = arvoreValida();
  a['docs/state/m.md'] = STATE.replace('- (nenhuma)', '- Stripe real (aguardando desde 01/02/2026)');
  assert.equal(rodar(a).status, 0);
});

test('R5: ignora identificadores entre crases', () => {
  const a = arvoreValida();
  a['docs/state/m.md'] = STATE.replace('- ok', '- migration `000012_2026-01-01_x`');
  assert.equal(rodar(a).status, 0);
});
