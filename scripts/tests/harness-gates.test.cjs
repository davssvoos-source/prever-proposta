// Testes de comportamento de scripts/harness-gates.cjs com manifestos temporários e comandos
// inofensivos NEUTROS de shell (rodam em cmd.exe e em sh). Porte 1:1 dos testes do Pattern
// Harness (test_harness_gates.py) para `node --test` (ADR-0004).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RUNNER = path.resolve(__dirname, '..', 'harness-gates.cjs');
// JSON é YAML válido: o manifesto de teste vai em JSON para não depender de um emissor YAML.
function rodarManifesto(gates, commands, raw) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-gates-'));
  try {
    const manifesto = path.join(dir, 'manifest.yaml');
    fs.writeFileSync(manifesto, raw ?? JSON.stringify({ version: 1, commands, gates }));
    return spawnSync(process.execPath, [RUNNER, '--manifest', manifesto], { cwd: dir, encoding: 'utf8' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const gate = (run, required = true, name = 'test') => ({ name, run, required });
const EXISTE_MANIFESTO = 'node -e "process.exit(require(\'fs\').existsSync(\'.harness/harness.yaml\') ? 0 : 1)"';

test('referências aninhadas e diretório de trabalho na raiz do repositório', () => {
  const r = rodarManifesto([gate('${commands.test:api}')], { 'test:api': '${commands.check}', check: EXISTE_MANIFESTO });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('PASS test'), r.stdout);
});

test('gate obrigatório que falha não impede o seguinte, e o executor sai 1', () => {
  const r = rodarManifesto([gate('exit 7'), gate('exit 0', true, 'next')]);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes('exit=7'), r.stdout);
  assert.ok(r.stdout.includes('PASS next'), r.stdout);
});

test('gate opcional que falha não derruba o executor', () => {
  const r = rodarManifesto([gate('exit 1', false)]);
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('FAIL test'), r.stdout);
});

test('comando inexistente falha o gate obrigatório — 127 no sh; o cmd.exe devolve 1', () => {
  const r = rodarManifesto([gate('pattern_nonexistent_command_7241')]);
  assert.equal(r.status, 1);
  // O cmd.exe não distingue "não encontrado" (9009 é só o ERRORLEVEL interno) de falha comum: sai 1.
  const esperado = process.platform === 'win32' ? /exit=(1|127)\b/ : /exit=127\b/;
  assert.match(r.stdout, esperado, r.stdout);
});

test('configuração inválida não executa nada e sai 2', () => {
  const casos = [
    [[gate('${commands.missing}')], {}],
    [[gate('${commands.a}')], { a: '${commands.b}', b: '${commands.a}' }],
    [[gate('${commands.bad')], {}],
    [[gate('exit 0', 'true')], {}],
    [[gate('')], {}],
    [[gate('exit 0'), gate('exit 1')], {}],
    [[], {}],
    [[gate('exit 0')], { test: 42 }],
  ];
  for (const [gates, commands] of casos) {
    const r = rodarManifesto(gates.length ? [gate('echo MUST_NOT_RUN', true, 'first'), ...gates] : [], commands);
    assert.equal(r.status, 2, JSON.stringify({ gates, commands }) + '\n' + r.stdout + r.stderr);
    assert.ok(!r.stdout.includes('MUST_NOT_RUN'), r.stdout);
  }
});

test('chave YAML duplicada e YAML inválido são manifesto inválido', () => {
  for (const raw of ['version: 1\nversion: 1\n', 'gates: [', '[]', 'version: true\n']) {
    const r = rodarManifesto(null, null, raw);
    assert.equal(r.status, 2, raw + '\n' + r.stdout + r.stderr);
    assert.ok(r.stderr.includes('INVALID MANIFEST'), r.stderr);
  }
});
