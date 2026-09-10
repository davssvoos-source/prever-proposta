// scripts/lib/editar.cjs — os ajudantes de patch que TODA entrega reescrevia.
//
// Davi, 10/09/2026: "garanta que o desenvolvimento contínuo e manutenções no
// sistema sejam feitas de tal maneira que economize esforço e ganhe eficiência
// no trabalho da I.A." Das dez entregas anteriores, cada uma reescreveu estes
// quatro ajudantes num .cjs de rascunho — e duas armadilhas morderam quatro
// vezes: crase dentro de template literal e heredoc do Bash comendo barra
// invertida. Agora eles moram aqui, e o texto longo vem de ARQUIVO.
//
// Uso (num .cjs de rascunho escrito pelo Write no scratchpad — nunca por
// heredoc nem `node -e`):
//
//   const { abrir, deArquivo, lote } = require('D:/Prever/sistema/scripts/lib/editar.cjs');
//   const v = abrir('scripts/verificar-logica.cjs');
//   v.troca('velho', 'novo', 'rótulo');                 // exatamente UMA ocorrência
//   v.antesDe('// ── U126', deArquivo('C:/.../bloco.txt')); // insere antes do marcador
//   v.depoisDe('COMMIT;', '\n-- x');                      // insere depois do marcador
//   v.entre('<!-- ini -->', '<!-- fim -->', novo);        // substitui o miolo
//   v.anexa(texto);                                       // no fim do arquivo
//   lote(v, outro, maisUm);                               // grava TODOS ou NENHUM
//
// Regras que custaram caro e agora moram aqui:
// · cada operação confere que o marcador existe UMA vez (0 = "NÃO ACHOU",
//   2+ = "AMBÍGUO"); a falha não interrompe as seguintes — todas são tentadas,
//   todas as falhas são listadas de uma vez, e nada é gravado se houve uma.
//   Nenhum arquivo fica meio-editado, e o rascunho seguinte só reaplica o que
//   faltou (em vez de descobrir uma falha por rodada).
// · o texto novo entra por função (`() => para`): `$&`, `$1` no texto novo
//   NÃO são interpretados pelo replace.
// · texto longo (bloco de asserções, entrada de diário, trecho com crase ou
//   barra invertida) vem de arquivo por `deArquivo(caminho)` — template
//   literal não segura crase, e String.raw não segura crase nem `${`.
// · caminhos relativos são à RAIZ do repo (pai de scripts/lib), de qualquer cwd.

const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..', '..');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(raiz, p));

/** Lê um arquivo inteiro (texto de bloco, entrada de diário…). */
function deArquivo(p) {
  return fs.readFileSync(abs(p), 'utf8');
}

/** Abre um arquivo para editar em memória; `salvar()` grava só se nada falhou. */
function abrir(p) {
  const caminho = abs(p);
  let s = fs.readFileSync(caminho, 'utf8');
  const falhas = [];
  let edicoes = 0;
  const conta = (de) => s.split(de).length - 1;
  const uma = (de, rotulo) => {
    const k = conta(de);
    if (k === 1) return true;
    falhas.push(`${rotulo}: ${k === 0 ? 'NÃO ACHOU' : `AMBÍGUO (${k})`} — ${JSON.stringify(de.slice(0, 90))}`);
    return false;
  };
  const api = {
    caminho,
    get texto() { return s; },
    get falhas() { return falhas.slice(); },
    tem: (de) => conta(de) > 0,
    /** Substitui a ÚNICA ocorrência de `de` por `para`. */
    troca(de, para, rotulo = 'troca') {
      if (uma(de, rotulo)) { s = s.replace(de, () => para); edicoes++; }
      return api;
    },
    /** Substitui todas as ocorrências (tem de haver pelo menos uma). */
    trocaTodas(de, para, rotulo = 'trocaTodas') {
      const k = conta(de);
      if (k === 0) falhas.push(`${rotulo}: NÃO ACHOU — ${JSON.stringify(de.slice(0, 90))}`);
      else { s = s.split(de).join(para); edicoes += k; }
      return api;
    },
    antesDe(marcador, texto, rotulo = 'antesDe') {
      if (uma(marcador, rotulo)) { s = s.replace(marcador, () => texto + marcador); edicoes++; }
      return api;
    },
    depoisDe(marcador, texto, rotulo = 'depoisDe') {
      if (uma(marcador, rotulo)) { s = s.replace(marcador, () => marcador + texto); edicoes++; }
      return api;
    },
    /** Substitui o que está entre os dois marcadores (eles ficam). */
    entre(ini, fim, novo, rotulo = 'entre') {
      if (uma(ini, `${rotulo} (início)`) && uma(fim, `${rotulo} (fim)`)) {
        const a = s.indexOf(ini) + ini.length;
        const b = s.indexOf(fim);
        if (b < a) falhas.push(`${rotulo}: o fim vem antes do início`);
        else { s = s.slice(0, a) + novo + s.slice(b); edicoes++; }
      }
      return api;
    },
    anexa(texto) { s += texto; edicoes++; return api; },
    /** Grava se nada falhou. Devolve true/false; lista as falhas quando há. */
    salvar() {
      const rel = path.relative(raiz, caminho);
      if (falhas.length) {
        console.log(`✗ ${rel} — NADA gravado:\n  ${falhas.join('\n  ')}`);
        return false;
      }
      fs.writeFileSync(caminho, s);
      console.log(`✓ ${rel} — ${edicoes} edição(ões)`);
      return true;
    },
  };
  return api;
}

/**
 * Grava vários arquivos de uma vez — TODOS ou NENHUM. Se qualquer editor tem
 * falha, lista todas e sai com 1 sem gravar arquivo algum.
 */
function lote(...editores) {
  const comFalha = editores.filter((e) => e.falhas.length);
  if (comFalha.length) {
    for (const e of comFalha) console.log(`✗ ${path.relative(raiz, e.caminho)}:\n  ${e.falhas.join('\n  ')}`);
    console.log('\nnada gravado — corrija os marcadores e rode de novo');
    process.exit(1);
  }
  for (const e of editores) e.salvar();
}

module.exports = { abrir, deArquivo, lote, raiz };
