#!/usr/bin/env node
// docs-lint — gate das regras anti-obesidade da documentação viva (docs/conventions.md).
// Node puro, sem dependências (ADR-0004). Contagem em CARACTERES (pontos de código).
//
// Regras (falham o gate):
//   R1  linhas ≤ 120 caracteres fora de frontmatter, bloco de código, tabela e linhas com link;
//       arquivos em LEGACY só avisam até serem reescritos — remova cada um da lista ao normalizá-lo.
//   R2  coluna Status de docs/REQUIREMENTS.md: 1 linha, ≤ 140 caracteres.
//   R3  todo ADR (exceto o template) tem "- **Data:**" e "- **Status:**" e está indexado em docs/ARCHITECTURE.md.
//   R4  todo docs/requirements/<m>.md está em docs/REQUIREMENTS.md; todo docs/state/<m>.md tem seu requirements/<m>.md.
//   R5  docs/state/*.md sem data (dd/mm/AAAA, AAAA-MM-DD) fora de "## Pendências" — estado ≠ história.
//
// Adaptação ao Prever OS: os documentos mestre anteriores ao padrão estão em LEGACY (avisam, não
// falham) até serem normalizados; a cópia local do padrão (docs/padrao-projeto/) e os dados da
// carga (docs/importacao/) ficam fora; as skills de .claude/skills/ entram.
//
//   node scripts/docs-lint.cjs [raiz]   (padrão: raiz deste checkout; sai 1 em qualquer erro, avisos não falham)
//   DOCS_LINT_LEGACY no ambiente substitui a lista de legados (um espaço = nada é legado).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] ?? path.join(__dirname, '..'));
let fail = false;
let warn = 0;
const err = (m) => { console.log('ERRO  ' + m); fail = true; };
const note = (m) => { console.log('aviso ' + m); warn++; };

// Arquivos ou prefixos ainda não normalizados (projeto existente). Remova um item ao normalizar o arquivo.
const LEGACY_PADRAO = [
  'docs/PRODUTO.md', 'docs/PLANO_UNIFICACAO.md', 'docs/ESTADO_ATUAL.md', 'docs/DECISOES_PENDENTES.md',
  'docs/PENDENCIAS_TECNICAS.md', 'docs/PLANO_V0.1.md', 'docs/VERSOES.md', 'docs/DASHBOARD.md', 'docs/SISTEMA_OS.md',
  'docs/REGRAS_BLOCOS.md', 'docs/REVISAO_2026-09-03.md', 'docs/REVISAO_TIPOGRAFIA_2026-09-15.md', 'docs/CONTEXTO_',
  'docs/manual/', '.claude/skills/organizador/', '.claude/skills/designer/', '.claude/skills/banco/',
];
const LEGACY = process.env.DOCS_LINT_LEGACY !== undefined
  ? process.env.DOCS_LINT_LEGACY.split(/\s+/).filter(Boolean)
  : LEGACY_PADRAO;
const EXCLUIR = ['docs/padrao-projeto/', 'docs/importacao/'];
const isLegacy = (f) => LEGACY.some((l) => f.startsWith(l));
const isExcluded = (f) => EXCLUIR.some((e) => f.startsWith(e));

const existe = (rel) => fs.existsSync(path.join(ROOT, rel));
const ler = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const linhas = (rel) => ler(rel).split(/\r?\n/);
const tamanho = (s) => [...s].length;
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Expande um padrão com `*` (só dentro de segmentos), como o glob do sh: `*` não casa ponto inicial.
function expandir(padrao) {
  const partes = padrao.split('/');
  let atuais = [''];
  partes.forEach((seg, i) => {
    const ultimo = i === partes.length - 1;
    const proximos = [];
    for (const base of atuais) {
      const dir = path.join(ROOT, base);
      if (!seg.includes('*')) {
        const rel = base ? base + '/' + seg : seg;
        const abs = path.join(ROOT, rel);
        if (fs.existsSync(abs) && (ultimo ? fs.statSync(abs).isFile() : fs.statSync(abs).isDirectory())) proximos.push(rel);
        continue;
      }
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const re = new RegExp('^' + seg.split('*').map(escapar).join('[^/]*') + '$');
      for (const nome of fs.readdirSync(dir).sort()) {
        if (nome.startsWith('.') || !re.test(nome)) continue;
        const rel = base ? base + '/' + nome : nome;
        const st = fs.statSync(path.join(ROOT, rel));
        if (ultimo ? st.isFile() : st.isDirectory()) proximos.push(rel);
      }
    }
    atuais = proximos;
  });
  return atuais;
}

// R1 — comprimento de linha
function linhasLongas(rel) {
  let fm = false;
  let fence = false;
  let c = 0;
  linhas(rel).forEach((l, i) => {
    if (i === 0 && l === '---') { fm = true; return; }
    if (fm && l === '---') { fm = false; return; }
    if (fm) return;
    if (/^```/.test(l)) { fence = !fence; return; }
    if (fence) return;
    if (/^\|/.test(l)) return;
    if (/\]\(|https?:\/\//.test(l)) return;
    if (tamanho(l) > 120) c++;
  });
  return c;
}
const ALVOS_R1 = ['AGENTS.md', 'README.md', 'docs/*.md', 'docs/*/*.md', '.harness/agents/*.md', '.claude/skills/*/SKILL.md'];
for (const f of ALVOS_R1.flatMap(expandir)) {
  if (isExcluded(f)) continue;
  const n = linhasLongas(f);
  if (n === 0) continue;
  if (isLegacy(f)) note(`R1 ${f}: ${n} linha(s) > 120 (legado — normalizar ao reescrever)`);
  else err(`R1 ${f}: ${n} linha(s) > 120 caracteres`);
}

// R2 — células Status (linhas de módulo começam com "| [")
if (existe('docs/REQUIREMENTS.md')) {
  for (const l of linhas('docs/REQUIREMENTS.md')) {
    if (!/^\| \[/.test(l)) continue;
    const campos = l.split('|');
    const m = (campos[1] ?? '').trim();
    const s = (campos[3] ?? '').trim();
    if (tamanho(s) > 140) err(`R2 Status > 140 caracteres em ${m}: ${tamanho(s)}`);
  }
}

// R3 — ADRs
const arch = existe('docs/ARCHITECTURE.md') ? ler('docs/ARCHITECTURE.md') : '';
for (const f of expandir('docs/decisions/ADR-*.md')) {
  if (/ADR-0000-/.test(f)) continue;
  const base = path.posix.basename(f);
  const id = base.split('-').slice(0, 2).join('-');
  const t = ler(f);
  if (!/^- \*\*Data:\*\*/m.test(t)) err(`R3 ${f} sem cabeçalho Data`);
  if (!/^- \*\*Status:\*\*/m.test(t)) err(`R3 ${f} sem cabeçalho Status`);
  if (!arch.includes(`[${id}](decisions/${base})`)) err(`R3 ${id} não indexado em docs/ARCHITECTURE.md`);
}

// R4 — índice e par requisito/estado
const reqIndex = existe('docs/REQUIREMENTS.md') ? ler('docs/REQUIREMENTS.md') : '';
for (const f of expandir('docs/requirements/*.md')) {
  if (f.endsWith('/_template.md')) continue;
  if (!reqIndex.includes(`(requirements/${path.posix.basename(f)})`)) err(`R4 ${f} fora do índice docs/REQUIREMENTS.md`);
}
for (const f of expandir('docs/state/*.md')) {
  if (f.endsWith('/_template.md')) continue;
  const base = path.posix.basename(f);
  if (!existe(`docs/requirements/${base}`)) err(`R4 ${f} sem docs/requirements/${base} correspondente`);
}

// R5 — estado ≠ história (tokens entre crases são identificadores e não contam)
const DATA = /(^|[^0-9])[0-3][0-9]\/[01][0-9]\/20[0-9]{2}([^0-9]|$)|(^|[^0-9])20[0-9]{2}-[01][0-9]-[0-3][0-9]([^0-9]|$)/;
for (const f of expandir('docs/state/*.md')) {
  if (f.endsWith('/_template.md')) continue;
  let n = 0;
  for (const l of linhas(f)) {
    if (/^## Pendências/.test(l)) break;
    if (DATA.test(l.replace(/`[^`]*`/g, ''))) n++;
  }
  if (n > 0) err(`R5 ${f}: ${n} marcador(es) temporal(is) fora de Pendências`);
}

if (fail) {
  console.log(`docs-lint: FALHOU (${warn} aviso(s) de legado)`);
  process.exitCode = 1;
} else {
  console.log(`docs-lint: ok (${warn} aviso(s) de legado)`);
}
