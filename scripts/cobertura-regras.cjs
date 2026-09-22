// cobertura-regras — a tabela "Cobertura R# → verificação" de cada docs/state/<m>.md é
// DERIVADA: as regras do módulo vêm da tabela de docs/requirements/<m>.md (linhas "| Rn |"),
// e a verificação é contada em scripts/verificar-logica.cjs (menções nominais a Rn).
// Regra sem menção nominal aparece como tal — e isso é informação para o verifier.
//
//   node scripts/cobertura-regras.cjs            regrava o bloco entre os marcadores
//   node scripts/cobertura-regras.cjs --check    só confere; sai com 1 se algum state está velho
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const soConferir = process.argv.includes('--check');
const INI = '<!-- cobertura:inicio -->';
const FIM = '<!-- cobertura:fim -->';

const verificador = fs.readFileSync(path.join(RAIZ, 'scripts/verificar-logica.cjs'), 'utf8');
const mencoes = new Map();
for (const m of verificador.matchAll(/(?<![A-Za-z0-9])R(\d+)(?![0-9])/g)) {
  mencoes.set(Number(m[1]), (mencoes.get(Number(m[1])) ?? 0) + 1);
}

const dirReq = path.join(RAIZ, 'docs/requirements');
let velhos = 0, gravados = 0;
for (const arq of fs.readdirSync(dirReq).filter((f) => f.endsWith('.md') && !f.startsWith('_'))) {
  const regras = [...fs.readFileSync(path.join(dirReq, arq), 'utf8').matchAll(/^\| R(\d+) \|/gm)]
    .map((m) => Number(m[1]));
  const alvo = path.join(RAIZ, 'docs/state', arq);
  if (!fs.existsSync(alvo)) { console.log('  (sem state) ' + arq); continue; }
  const com = regras.filter((r) => (mencoes.get(r) ?? 0) > 0).length;
  const linhas = [
    INI,
    '<!-- Gerado por `node scripts/cobertura-regras.cjs` — não edite à mão. -->',
    '',
    'Regras do módulo: ' + regras.length + ' · com asserção nominal no verificador: ' + com
      + ' · sem menção nominal: ' + (regras.length - com) + '.',
    '',
    '| Regra | Verificado por |',
    '|---|---|',
    ...regras.map((r) => {
      const n = mencoes.get(r) ?? 0;
      return '| produto:R' + r + ' | ' + (n > 0
        ? n + ' menç' + (n === 1 ? 'ão' : 'ões') + ' nominal' + (n === 1 ? '' : 'is') + ' em `scripts/verificar-logica.cjs`'
        : '— sem menção nominal; cobertura indireta (tsc, build, asserções da tela)') + ' |';
    }),
    FIM,
  ].join('\n');
  const atual = fs.readFileSync(alvo, 'utf8');
  const a = atual.indexOf(INI), b = atual.indexOf(FIM);
  if (a < 0 || b < 0 || b < a) { console.log('✗ ' + arq + ': sem os marcadores de cobertura'); velhos++; continue; }
  const novo = atual.slice(0, a) + linhas + atual.slice(b + FIM.length);
  if (novo === atual) continue;
  if (soConferir) { console.log('✗ docs/state/' + arq + ': cobertura fora de sincronia'); velhos++; continue; }
  fs.writeFileSync(alvo, novo);
  gravados++;
  console.log('✓ docs/state/' + arq + ' (' + regras.length + ' regras, ' + com + ' com asserção nominal)');
}
if (soConferir) {
  if (velhos) { console.log('cobertura-regras: ' + velhos + ' state(s) fora de sincronia — rode node scripts/cobertura-regras.cjs'); process.exit(1); }
  console.log('cobertura-regras: em sincronia');
} else {
  console.log('cobertura-regras: ' + gravados + ' state(s) regravado(s)');
}
