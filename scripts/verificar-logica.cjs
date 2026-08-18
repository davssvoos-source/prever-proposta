// Verificação da lógica de cobrança — Etapa U4 da unificação.
// Sucessor do scripts/teste-logica.ts do gestor-os.
//
// Rodar:  node scripts/verificar-logica.cjs
//
// O projeto não tem framework de teste, e trazer um só para isto seria custo
// sem retorno. Este script transpila os módulos .ts na hora e roda as
// asserções — as mesmas que o gestor-os já usava, mais as regras novas
// (cobertura determinística, franquia, ano ISO na virada).
//
// São funções PURAS de propósito: se algum dia elas quebrarem, o erro vai
// direto para o boleto do cliente.

const ts = require('typescript'), fs = require('fs'), path = require('path'), Module = require('module');
// carrega os .ts puros transpilando na hora (sem framework de teste no projeto)
const cache = {};
function carregar(rel) {
  const arq = path.resolve(rel);
  if (cache[arq]) return cache[arq];
  const js = ts.transpileModule(fs.readFileSync(arq, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = new Module(arq); m.filename = arq; m.paths = Module._nodeModulePaths(path.dirname(arq));
  const req = (spec) => spec.startsWith('./') || spec.startsWith('@/')
    ? carregar(spec.startsWith('@/') ? 'src/' + spec.slice(2) + '.ts' : path.join(path.dirname(rel), spec) + '.ts')
    : require(spec);
  m.exports = {}; cache[arq] = m.exports;
  new Function('exports','require','module','__filename','__dirname', js)(m.exports, req, m, arq, path.dirname(arq));
  cache[arq] = m.exports; return m.exports;
}
const M = carregar('src/lib/matching.ts');
const P = carregar('src/lib/periodos.ts');

let ok = 0, falhas = 0;
const eq = (nome, obtido, esperado) => {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { ok++; } else { falhas++; console.log(`FALHOU  ${nome}\n  obtido=${a}\n  esperado=${b}`); }
};

// ── matching: a cascata, na ordem de confiança ──────────────────────────────
const cobertura = [
  { id: 'A', marca: 'Intelbras', modelo: 'VIP 3230', numero_serie: 'SN123', tag_patrimonio: 'PAT-1', descricao: 'Câmera bullet' },
  { id: 'B', marca: 'Hikvision', modelo: 'DS-2CD', numero_serie: 'SN999', tag_patrimonio: 'PAT-2', descricao: 'Câmera dome' },
  { id: 'C', marca: 'Intelbras', modelo: 'VIP 3230', numero_serie: 'SN777', tag_patrimonio: null, descricao: 'Câmera bullet 2' },
];
eq('serie identica → 1.0', M.casarEquipamento({ numero_serie: 'sn123' }, cobertura)?.score, 1);
eq('serie identica → id A', M.casarEquipamento({ numero_serie: 'SN123' }, cobertura)?.candidato.id, 'A');
eq('TAG identica → 0.95', M.casarEquipamento({ tag_patrimonio: 'pat-2' }, cobertura)?.score, 0.95);
eq('modelo unico → 0.85', M.casarEquipamento({ modelo: 'DS-2CD' }, cobertura)?.score, 0.85);
eq('modelo repetido + marca nao desempata → cai p/ descricao',
   M.casarEquipamento({ modelo: 'VIP 3230', marca: 'Intelbras' }, cobertura)?.motivo, 'descrição parecida');
eq('nada parecido → null', M.casarEquipamento({ descricao: 'parafuso sextavado' }, cobertura), null);
eq('lista vazia → null', M.casarEquipamento({ numero_serie: 'SN123' }, []), null);

// ── valoração: precedência estrita, e nunca zero ────────────────────────────
const pc = [{ descricao: 'Hora técnica', valor_unitario: 180 }];
const pcat = [{ descricao: 'Hora técnica', valor_unitario: 150 }];
eq('informado vence tudo',
   M.valorarItem({ descricao: 'Hora técnica', valor_unitario_informado: 200 }, pc, pcat),
   { valor_unitario: 200, origem: 'informado' });
eq('contrato vence catalogo',
   M.valorarItem({ descricao: 'Hora técnica' }, pc, pcat), { valor_unitario: 180, origem: 'contrato' });
eq('catalogo quando nao ha contrato',
   M.valorarItem({ descricao: 'Hora técnica' }, [], pcat), { valor_unitario: 150, origem: 'catalogo' });
eq('sem preco NUNCA vira zero',
   M.valorarItem({ descricao: 'Item exótico' }, [], []), { valor_unitario: null, origem: 'sem_preco' });
eq('valor informado zero nao conta como informado',
   M.valorarItem({ descricao: 'Hora técnica', valor_unitario_informado: 0 }, pc, pcat).origem, 'contrato');

// ── cobertura determinística: a regra do Vinicius ───────────────────────────
const locacao = { modalidade: 'locacao', inclui_pecas: false, inclui_mao_de_obra: true, inclui_deslocamento: false };
const manut = { modalidade: 'manutencao', inclui_pecas: false, inclui_mao_de_obra: true, inclui_deslocamento: false };
eq('sem contrato → tudo faturavel',
   M.coberturaDeterministica('peca', null, null)?.resultado, 'faturavel');
eq('locacao → peca coberta',
   M.coberturaDeterministica('peca', locacao, null)?.resultado, 'coberto');
eq('manutencao → peca faturavel',
   M.coberturaDeterministica('peca', manut, null)?.resultado, 'faturavel');
eq('manutencao → mao de obra coberta',
   M.coberturaDeterministica('mao_de_obra', manut, null)?.resultado, 'coberto');
eq('deslocamento fora do contrato → faturavel',
   M.coberturaDeterministica('deslocamento', manut, null)?.resultado, 'faturavel');
eq('item marcado nao_coberto vence a regra geral',
   M.coberturaDeterministica('peca', locacao, { cobertura: 'nao_coberto', inclui_pecas: null, inclui_mao_de_obra: null })?.resultado,
   'faturavel');
eq('override do item cobre peca em contrato de manutencao',
   M.coberturaDeterministica('peca', manut, { cobertura: 'integral', inclui_pecas: true, inclui_mao_de_obra: null })?.resultado,
   'coberto');
eq('servico depende de leitura → null (vai p/ IA)',
   M.coberturaDeterministica('servico', manut, null), null);

// ── franquia ────────────────────────────────────────────────────────────────
eq('sem franquia nunca estoura', M.franquiaEstourada(null, 99), false);
eq('dentro da franquia', M.franquiaEstourada(2, 2), false);
eq('visita N+1 estoura', M.franquiaEstourada(2, 3), true);

// ── períodos: ano ISO na virada ─────────────────────────────────────────────
eq('31/12/2025 pertence a semana 1 de 2026', P.referenciaSemanal(new Date(2025, 11, 31)), '2026-S01');
eq('01/01/2026 tambem', P.referenciaSemanal(new Date(2026, 0, 1)), '2026-S01');
eq('competencia', P.competencia(new Date(2026, 7, 18)), '2026-08');
eq('rotulo mensal', P.rotuloReferencia('2026-08'), 'agosto/2026');
eq('rotulo semanal', P.rotuloReferencia('2026-S08'), 'semana 8 de 2026');
eq('inicio de semana e segunda', P.inicioSemana(new Date(2026, 7, 18)).getDay(), 1);
eq('domingo pertence a semana que comecou na segunda anterior',
   P.dataIso(P.inicioSemana(new Date(2026, 7, 23))), '2026-08-17');

// ── parcelamento em centavos ────────────────────────────────────────────────
eq('100 em 3 → resto na primeira', P.parcelar(100, 3), [33.34, 33.33, 33.33]);
eq('soma fecha exata', P.parcelar(100, 3).reduce((a, b) => a + b, 0), 100);
eq('1000,01 em 7 fecha exato',
   Math.round(P.parcelar(1000.01, 7).reduce((a, b) => a + b, 0) * 100) / 100, 1000.01);
eq('1 parcela = valor cheio', P.parcelar(250.5, 1), [250.5]);

console.log(`\n${ok} verificações passaram, ${falhas} falharam.`);
process.exit(falhas === 0 ? 0 : 1);
