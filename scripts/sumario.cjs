#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SUMÁRIOS DOS DOCUMENTOS MESTRE (U102, pedido do Davi em 04/09/2026: "podemos
// ter um sumário muito bem desenvolvido nos documentos, ajudando você sempre a
// ler de maneira mais eficiente").
//
// Gera (ou confere) o bloco
//     <!-- sumario:inicio --> … <!-- sumario:fim -->
// logo abaixo do título de cada documento mestre, com os cabeçalhos do
// arquivo. Ninguém lê 10 mil linhas de diário; navega-se — e este bloco é o
// mapa. Cada linha traz a âncora do GitHub (para o leitor humano) e o título
// literal (para `grep -n "^## Título"`, que é como o assistente navega).
//
// No PRODUTO cada seção diz a faixa de regras que contém (R1–R3); nas
// pendências, o título já carrega o estado (FECHADA / BAIXO / MÉDIO); no
// diário, uma linha por entrega.
//
//   node scripts/sumario.cjs            regenera os blocos
//   node scripts/sumario.cjs --check    só confere; sai com 1 se algum está velho
//
// O verificador chama o --check: sumário fora de sincronia é asserção vermelha.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const INICIO = '<!-- sumario:inicio -->';
const FIM = '<!-- sumario:fim -->';

/** Os alvos. `niveis`: quais cabeçalhos entram. `incluir3`: filtro extra para ###. */
const ALVOS = [
  { arquivo: 'docs/PRODUTO.md', niveis: [2], regras: true },
  { arquivo: 'docs/PLANO_UNIFICACAO.md', niveis: [2, 3], incluir3: (t) => /^(U|S)\d/.test(t) },
  { arquivo: 'docs/PENDENCIAS_TECNICAS.md', niveis: [2] },
  { arquivo: 'docs/PLANO_V0.1.md', niveis: [2, 3] },
  { arquivo: 'DESIGN_SYSTEM.md', niveis: [2, 3] },
  { arquivo: 'docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md', niveis: [2] },
  { arquivo: 'docs/CONTEXTO_OPERACAO_TECNICA.md', niveis: [2] },
  { arquivo: 'docs/manual/operacao-campo.md', niveis: [2] },
];

/** Âncora no estilo do GitHub: minúsculas, sem pontuação, espaço → hífen. */
function ancora(titulo) {
  return titulo
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Os cabeçalhos do arquivo, fora de blocos de código e fora do próprio sumário. */
function cabecalhos(texto, alvo) {
  const linhas = texto.split('\n');
  const saida = [];
  let emCodigo = false;
  let emSumario = false;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.startsWith('```')) { emCodigo = !emCodigo; continue; }
    if (l.includes(INICIO)) { emSumario = true; continue; }
    if (l.includes(FIM)) { emSumario = false; continue; }
    if (emCodigo || emSumario) continue;
    const m = /^(#{2,3}) (.+?)\s*$/.exec(l);
    if (!m) continue;
    const nivel = m[1].length;
    if (!alvo.niveis.includes(nivel)) continue;
    if (nivel === 3 && alvo.incluir3 && !alvo.incluir3(m[2])) continue;
    saida.push({ nivel, titulo: m[2], linha: i });
  }
  return saida;
}

/** No PRODUTO: a faixa de regras (R) que cada seção ## contém. */
function faixasDeRegras(texto, cabs) {
  const linhas = texto.split('\n');
  const faixas = new Map();
  for (let k = 0; k < cabs.length; k++) {
    const c = cabs[k];
    if (c.nivel !== 2) continue;
    const proximo = cabs.slice(k + 1).find((x) => x.nivel === 2);
    const fim = proximo ? proximo.linha : linhas.length;
    const regras = [];
    for (let i = c.linha + 1; i < fim; i++) {
      const m = /^- \*\*R(\d+)\*\* —/.exec(linhas[i]);
      if (m) regras.push(Number(m[1]));
    }
    if (regras.length) faixas.set(c.linha, `R${Math.min(...regras)}–R${Math.max(...regras)} (${regras.length})`);
  }
  return faixas;
}

function montarBloco(texto, alvo) {
  const cabs = cabecalhos(texto, alvo);
  const faixas = alvo.regras ? faixasDeRegras(texto, cabs) : new Map();
  const itens = cabs.map((c) => {
    const recuo = c.nivel === 3 ? '  ' : '';
    const faixa = faixas.get(c.linha);
    return `${recuo}- [${c.titulo}](#${ancora(c.titulo)})${faixa ? ` · ${faixa}` : ''}`;
  });
  let cabecalho = `> **Sumário** — ${cabs.length} seções. Gerado por \`node scripts/sumario.cjs\`; não edite à mão. `
    + 'Para ir a uma seção: `grep -n "^## <título>"` no arquivo.';
  if (alvo.arquivo.endsWith('PENDENCIAS_TECNICAS.md')) {
    const fechadas = cabs.filter((c) => /FECHADA|RESOLVID|CONSERTADO|~~/.test(c.titulo)).length;
    cabecalho += ` **${cabs.length - fechadas} em aberto, ${fechadas} fechadas.**`;
  }
  return `${INICIO}\n${cabecalho}\n\n${itens.join('\n')}\n${FIM}`;
}

/** Devolve o texto com o bloco novo no lugar (ou inserido logo após o título). */
function aplicar(texto, bloco) {
  const a = texto.indexOf(INICIO);
  const b = texto.indexOf(FIM);
  if (a >= 0 && b > a) return texto.slice(0, a) + bloco + texto.slice(b + FIM.length);
  // insere depois da linha do título (# …) e da linha em branco que a segue
  const m = /^# .+\n/m.exec(texto);
  if (!m) throw new Error('sem título # para ancorar o sumário');
  const pos = m.index + m[0].length;
  return texto.slice(0, pos) + '\n' + bloco + '\n' + texto.slice(pos);
}

const soConferir = process.argv.includes('--check');
const raiz = path.resolve(__dirname, '..');
const velhos = [];
for (const alvo of ALVOS) {
  const caminho = path.join(raiz, alvo.arquivo);
  if (!fs.existsSync(caminho)) { console.error(`sumário: ${alvo.arquivo} não existe`); process.exitCode = 1; continue; }
  const texto = fs.readFileSync(caminho, 'utf8');
  const novo = aplicar(texto, montarBloco(texto, alvo));
  if (novo === texto) { console.log(`ok       ${alvo.arquivo}`); continue; }
  if (soConferir) { velhos.push(alvo.arquivo); console.log(`VELHO    ${alvo.arquivo}`); continue; }
  fs.writeFileSync(caminho, novo);
  console.log(`gerado   ${alvo.arquivo}`);
}
if (soConferir && velhos.length) {
  console.error(`\n${velhos.length} sumário(s) fora de sincronia — rode: node scripts/sumario.cjs`);
  process.exit(1);
}
