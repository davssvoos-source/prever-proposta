#!/usr/bin/env node
// harness-index — gera .harness/INDEX.md, o nó raiz de navegação do harness.
// Índice é DERIVADO, nunca redigido: um recurso por linha, ordenado por caminho
// (ordem de bytes, como `LC_ALL=C sort`), com a descrição extraída do próprio arquivo
// (frontmatter `description:`, primeiro título `# `, ou primeira linha). Node puro (ADR-0004).
//
// Adaptação ao Prever OS: entram também as skills de .claude/skills/; ficam de fora a
// cópia local do padrão (docs/padrao-projeto/, clone fora do git) e os dados da carga do
// QAP (docs/importacao/), que não são documentação.
//
//   node scripts/harness-index.cjs          # (re)gera .harness/INDEX.md
//   node scripts/harness-index.cjs --check  # falha se o índice divergiu (CI e gate)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const OUT = path.join(ROOT, '.harness/INDEX.md');
const FIXOS = ['AGENTS.md', 'README.md', 'DESIGN_SYSTEM.md', 'ONBOARDING.md'];
const RAIZES = ['.harness', '.claude/skills', 'docs'];
const EXCLUIR = ['docs/padrao-projeto/', 'docs/importacao/'];

function andar(rel, saida) {
  for (const nome of fs.readdirSync(path.join(ROOT, rel))) {
    const filho = rel + '/' + nome;
    if (EXCLUIR.some((e) => (filho + '/').startsWith(e))) continue;
    const st = fs.statSync(path.join(ROOT, filho));
    if (st.isDirectory()) andar(filho, saida);
    else if (/\.(md|yaml|json)$/.test(nome) && nome !== 'INDEX.md') saida.push(filho);
  }
}

function descrever(rel) {
  const texto = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (rel.endsWith('.json')) {
    try { return String(JSON.parse(texto).$comment ?? ''); } catch { return ''; }
  }
  const linhas = texto.split(/\r?\n/);
  for (const l of linhas) {
    if (/^description:/.test(l)) return l.replace(/^description:[ \t]*/, '');
    if (/^# /.test(l)) return l.slice(2);
  }
  return linhas[0] ?? '';
}

const achados = [];
for (const r of RAIZES) if (fs.existsSync(path.join(ROOT, r))) andar(r, achados);
const todos = [...FIXOS, ...achados].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const conteudo = [
  '# Índice — Prever OS',
  '',
  '> Gerado por `scripts/harness-index.cjs` — não editar à mão.',
  '> Nó raiz da navegação: um recurso por linha, ordenado por caminho.',
  '> Arestas entre recursos usam referências tipadas por ID estável',
  '> (R# de docs/PRODUTO.md, U#, P#, ADR-####, nome de skill) dentro dos próprios arquivos.',
  '',
  ...todos.map((f) => '- `' + f + '` — ' + descrever(f)),
].join('\n') + '\n';

if (CHECK) {
  const atual = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : null;
  if (atual !== conteudo) {
    console.error('DIVERGENTE: .harness/INDEX.md (rode node scripts/harness-index.cjs)');
    process.exitCode = 1;
  } else {
    console.log('índice em sincronia');
  }
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, conteudo);
  console.log('gerado: .harness/INDEX.md');
}
