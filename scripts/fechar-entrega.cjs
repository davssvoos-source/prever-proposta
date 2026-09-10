// scripts/fechar-entrega.cjs — o fim de entrega numa tacada (passos 3, 7 e 8
// do ciclo em CLAUDE.md).
//
//   node scripts/fechar-entrega.cjs --versao 0.0.9 --regra R247 --diario U127
//   node scripts/fechar-entrega.cjs                 (só refaz sumários e números)
//
// Davi, 10/09/2026: "garanta que o desenvolvimento contínuo e manutenções no
// sistema sejam feitas de tal maneira que economize esforço e ganhe eficiência
// no trabalho da I.A." A cada versão, o fim de entrega repetia à mão: dois
// arquivos de versão, o cabeçalho do ESTADO (um bloco de sete linhas casado ao
// byte), o número do verificador em dois lugares, os sumários. Agora é um
// comando, e ele faz as coisas NA ORDEM que o verificador exige:
//
//   1. sobe a versão nas DUAS fontes (package.json e src/lib/versao.ts) — o
//      pino permanente do verificador confere a igualdade e a entrada mais
//      nova do VERSOES.md (que quem entrega escreve antes);
//   2. atualiza os campos do cabeçalho do ESTADO por padrão estável (data,
//      última regra, último diário) — o verificador confere que a última regra
//      do ESTADO é a do PRODUTO;
//   3. regenera os sumários — o verificador roda `sumario --check`;
//   4. roda o verificador; se não terminar em 0 falharam, PARA e mostra as
//      falhas — nenhum número é gravado;
//   5. grava o número de asserções no cabeçalho do ESTADO e em todo
//      {{VERIFICADOR}} do diário e do ESTADO;
//   6. sumários de novo (barato).
//
// O que ele NÃO faz, de propósito: escrever a entrada do VERSOES.md, o diário,
// a regra, o ESTADO §3/§4 — isso é prosa de quem entregou, não formulário.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const raiz = path.resolve(__dirname, '..');
const arq = (p) => path.join(raiz, p);
const ler = (p) => fs.readFileSync(arq(p), 'utf8');
const gravar = (p, s) => fs.writeFileSync(arq(p), s);

// ── argumentos ──────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true; }
}
const hoje = new Date().toISOString().slice(0, 10);

function trocaUnica(p, regex, novo, rotulo) {
  const s = ler(p);
  const m = s.match(regex);
  if (!m) { console.log(`✗ ${p}: não achei ${rotulo} (${regex})`); process.exit(1); }
  gravar(p, s.replace(regex, novo));
  console.log(`  ${p}: ${rotulo} → ${novo.replace(/\*\*/g, '')}`);
}

// ── 1. a versão ─────────────────────────────────────────────────────────────
if (args.versao) {
  if (!/^\d+\.\d+\.\d+$/.test(args.versao)) { console.log(`✗ versão inválida: ${args.versao}`); process.exit(1); }
  console.log(`1. versão ${args.versao}`);
  trocaUnica('package.json', /"version": "\d+\.\d+\.\d+"/, `"version": "${args.versao}"`, 'package.json');
  trocaUnica('src/lib/versao.ts', /export const VERSAO = "\d+\.\d+\.\d+";/, `export const VERSAO = "${args.versao}";`, 'versao.ts');
  if (!new RegExp(`^## v${args.versao.replace(/\./g, '\\.')} `, 'm').test(ler('docs/VERSOES.md'))) {
    console.log(`✗ docs/VERSOES.md não tem a entrada "## v${args.versao} …" — escreva-a primeiro (é prosa, não formulário)`);
    process.exit(1);
  }
}

// ── 2. o cabeçalho do ESTADO ────────────────────────────────────────────────
console.log('2. cabeçalho do ESTADO');
trocaUnica('docs/ESTADO_ATUAL.md', /Última atualização: \*\*\d{4}-\d{2}-\d{2}\*\*/, `Última atualização: **${hoje}**`, 'data');
if (args.regra) trocaUnica('docs/ESTADO_ATUAL.md', /última regra: \*\*R\d+\*\*/, `última regra: **${args.regra}**`, 'última regra');
if (args.diario) trocaUnica('docs/ESTADO_ATUAL.md', /último diário:\s*\*\*U\d+[a-z]?\*\*/, `último diário:\n**${args.diario}**`, 'último diário');

// ── 3. sumários ─────────────────────────────────────────────────────────────
function sumarios(rotulo) {
  const r = spawnSync(process.execPath, ['scripts/sumario.cjs'], { cwd: raiz, encoding: 'utf8' });
  if (r.status !== 0) { console.log(`✗ sumario.cjs falhou:\n${r.stdout}${r.stderr}`); process.exit(1); }
  console.log(`${rotulo} sumários regenerados`);
}
sumarios('3.');

// ── 4. o verificador ────────────────────────────────────────────────────────
console.log('4. verificador…');
const v = spawnSync(process.execPath, ['scripts/verificar-logica.cjs'], { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const saida = (v.stdout || '') + (v.stderr || '');
const m = saida.match(/(\d+) verificações passaram, (\d+) falharam/);
if (!m || m[2] !== '0') {
  const linhas = saida.split('\n').filter((l) => !/^\s*ok /.test(l) && l.trim());
  console.log(linhas.slice(-40).join('\n'));
  console.log('\n✗ o verificador não está em 0 falharam — números NÃO gravados');
  process.exit(1);
}
const texto = `${Number(m[1]).toLocaleString('pt-BR')} asserções, 0 falharam`;
console.log(`   ${texto}`);

// ── 5. os números ───────────────────────────────────────────────────────────
console.log('5. números');
trocaUnica('docs/ESTADO_ATUAL.md', /verificador: \*\*[\d.]+ asserções, 0 falharam\*\*/, `verificador: **${texto}**`, 'verificador');
for (const p of ['docs/PLANO_UNIFICACAO.md', 'docs/ESTADO_ATUAL.md']) {
  const s = ler(p);
  const k = s.split('{{VERIFICADOR}}').length - 1;
  if (k) { gravar(p, s.split('{{VERIFICADOR}}').join(texto)); console.log(`  ${p}: ${k} marcador(es) {{VERIFICADOR}} preenchido(s)`); }
}

// ── 6. sumários de novo ─────────────────────────────────────────────────────
sumarios('6.');
console.log('\npronto — falta: tsc (baseline 57), vite build, commit + push, build:windows se a versão subiu');
