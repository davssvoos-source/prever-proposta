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
  const req = (spec) => {
    // O cliente do Supabase usa import.meta.env, que não existe em CommonJS —
    // e as funções aqui são puras, nenhuma toca no banco. Um esqueleto basta
    // para o módulo que só importa o cliente por causa de um vizinho de arquivo.
    if (spec.endsWith('integrations/supabase/client')) return { supabase: {} };
    if (spec === 'react' || spec === '@tanstack/react-query') return new Proxy({}, { get: () => () => undefined });
    return spec.startsWith('./') || spec.startsWith('@/')
      ? carregar(spec.startsWith('@/') ? 'src/' + spec.slice(2) + '.ts' : path.join(path.dirname(rel), spec) + '.ts')
      : require(spec);
  };
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

// ── Home: a tradução de status para coluna do quadro ────────────────────────
// É O artefato onde teste é trivialmente lucrativo: a promessa "nada some em
// silêncio" só é verdade se cada status cru de cada origem tiver destino, e
// isso é uma tabela finita. Sem estas asserções a promessa é boa intenção.
const A = carregar('src/features/atividades/modelo.ts');

const chamado = (status, extra = {}) => ({
  id: 'x', numero: 'CH-2026-0001', titulo: 't', status, natureza: 'campo', tipo: 'corretiva',
  prioridade: 'normal', equipe: null, sprint: null, prazo_limite: null,
  data_hora_agendada: null, responsavel_id: 'u1', aberto_por: 'u1',
  created_at: '2026-01-01T00:00:00Z', updated_at: null, ...extra,
});
const visita = (status, extra = {}) => ({
  id: 'v', status, titulo: null, nome_predio: 'Predio', tecnico_id: 'u1',
  data_hora_agendada: null, created_at: '2026-01-01T00:00:00Z', ...extra,
});

// exaustividade: cada status do CHECK vira a coluna homônima
const CS = carregar('src/lib/chamado-status.ts');
for (const st of CS.STATUS_ORDEM) {
  eq(`chamado "${st}" cai na coluna homonima`,
     A.colunaDoChamado(chamado(st), null, false).coluna, st);
}
eq('o vocabulario tem 7 status (executado saiu na U13)', CS.STATUS_ORDEM.length, 7);
eq('executado nao existe mais', CS.STATUS_ORDEM.includes('executado'), false);

// ── U13/U14: o quadro nao mostra tudo o que o vocabulario tem ───────────────
eq('o quadro tem 5 colunas', A.COLUNAS.length, 5);
eq('agendado nao e coluna', A.COLUNAS.includes('agendado'), false);
eq('cancelado nao e coluna', A.COLUNAS.includes('cancelado'), false);
eq('agendado cai em "Aguardando inicio"', A.colunaVisivel('agendado'), 'aberto');
eq('cancelado nao tem coluna (fica na lista)', A.colunaVisivel('cancelado'), null);
eq('os demais nao sao desviados', A.colunaVisivel('stand_by'), 'stand_by');
eq('rotulo de aberto mudou', CS.chamadoStatusInfo('aberto').label, 'Aguardando início');
eq('concluido encerra', CS.chamadoEmAberto('concluido'), false);
eq('agendado segue em aberto', CS.chamadoEmAberto('agendado'), true);
eq('status fora do CHECK nunca some — vai para sem_status',
   A.colunaDoChamado(chamado('inventado'), null, false).coluna, 'sem_status');
eq('e é marcado como desconhecido',
   A.colunaDoChamado(chamado('inventado'), null, false).alerta, 'status_desconhecido');
eq('aberto sem responsavel é sinalizado',
   A.colunaDoChamado(chamado('aberto', { responsavel_id: null }), null, false).alerta, 'sem_responsavel');

// compra: as 6 situações têm destino, e o terminal do chamado tem precedência
const compra = (situacao, st = 'em_andamento') => A.colunaDoChamado(chamado(st), { situacao }, true);
eq('compra solicitada → Aberto', compra('solicitado').coluna, 'aberto');
eq('compra em cotação → Em andamento', compra('em_cotacao').coluna, 'em_andamento');
eq('compra aprovada → Em andamento', compra('aprovado').coluna, 'em_andamento');
eq('comprado esperando entrega → Stand-by', compra('comprado').coluna, 'stand_by');
eq('compra recebida → Concluído', compra('recebido').coluna, 'concluido');
eq('e o quadro a mostra na coluna Concluído', A.colunaVisivel(compra('recebido').coluna), 'concluido');
eq('compra recusada → Cancelado', compra('recusado').coluna, 'cancelado');
eq('chamado terminal manda mesmo com compra andando',
   compra('em_cotacao', 'cancelado').coluna, 'cancelado');
eq('gasto em mesa aparece como espera de decisão',
   compra('solicitado', 'aguardando_aprovacao').coluna, 'aguardando_aprovacao');
eq('e a bola fica com o financeiro',
   compra('solicitado', 'aguardando_aprovacao').bolaCom, 'financeiro');
eq('ficha ausente é falta de ACESSO, não de dado',
   A.colunaDoChamado(chamado('aberto'), null, true).alerta, 'sem_acesso_ficha');

// visita: cada status cru tem destino — o CHECK foi derrubado, é texto livre
eq('visita pendente com data → Agendado',
   A.colunaDaVisita(visita('pendente', { data_hora_agendada: '2026-03-01T10:00:00Z' })).coluna, 'agendado');
eq('visita pendente sem data → Aberto',
   A.colunaDaVisita(visita('pendente')).coluna, 'aberto');
eq('visita em andamento → Em andamento',
   A.colunaDaVisita(visita('em_andamento')).coluna, 'em_andamento');
eq('visita aguardando o comercial → Aguardando aprovação',
   A.colunaDaVisita(visita('aguardando_aprovacao')).coluna, 'aguardando_aprovacao');
eq('legado "concluida" cai no mesmo lugar',
   A.colunaDaVisita(visita('concluida')).coluna, 'aguardando_aprovacao');
eq('aprovada sem proposta enviada → Aguardando aprovação (o funil parou)',
   A.colunaDaVisita(visita('aprovada')).coluna, 'aguardando_aprovacao');
eq('e a bola é do comercial, que precisa mandar a proposta',
   A.colunaDaVisita(visita('aprovada')).bolaCom, 'comercial');
// R38 (2026-08-22): o fluxo acaba no ENVIO — não existe mais um estado
// "com o cliente, aguardando" entre enviar e concluir.
eq('proposta enviada, sem resultado ainda → Concluído (o fluxo já acabou)',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aguardando' })).coluna,
   'concluido');
eq('e sem bola nenhuma — não há mais nada para o app acompanhar',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aguardando' })).bolaCom,
   null);
eq('enviada com resultado nulo (não só "aguardando") também vira concluído',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z' })).coluna,
   'concluido');
eq('proposta aceita → Concluído',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aceita' })).coluna, 'concluido');
eq('proposta recusada → Cancelado',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'recusada' })).coluna, 'cancelado');
eq('reprovada volta para a fila, não vira lixo',
   A.colunaDaVisita(visita('reprovada')).coluna, 'aberto');
eq('e pede reagendamento', A.colunaDaVisita(visita('reprovada')).alerta, 'reagendar');
eq('status de visita fora do vocabulario nunca some',
   A.colunaDaVisita(visita('qualquer_coisa')).coluna, 'sem_status');

// o banner conta o mesmo array que a tela mostra
const ctxVazio = { userId: 'u1', apoios: new Set(), fichas: new Map() };
const hojeIso = new Date(2026, 2, 10, 9, 0, 0).toISOString();
const doDia = [
  A.atividadeDoChamado(chamado('agendado', { data_hora_agendada: hojeIso }), ctxVazio),
  A.atividadeDoChamado(chamado('aberto', { data_hora_agendada: '2026-12-01T10:00:00Z' }), ctxVazio),
];
eq('banner conta só o que é de hoje',
   A.atividadesDeHoje(doDia, new Date(2026, 2, 10, 15, 0, 0)).length, 1);
eq('encerrado não entra no banner',
   A.atividadesDeHoje([A.atividadeDoChamado(chamado('concluido', { data_hora_agendada: hojeIso }), ctxVazio)],
                      new Date(2026, 2, 10, 15, 0, 0)).length, 0);

// U71 (R83) INVERTEU metade desta invariante, de propósito. Ela era "campo não
// carrega equipe nem sprint", e o modelo zerava `equipe` fora do interno.
// Davi, 2026-08-26: "Em uma atividade de 'Proposta Comercial' por exemplo, o
// técnico é responsável pela visita técnica, enquanto a equipe comercial é
// responsável pela proposta em si." Ou seja: é justamente fora do interno que
// mais de uma equipe aparece, e zerar ali escondia o que ele quer ver.
//
// O SPRINT continua zerado fora do interno — aquilo é ritmo de planejamento
// interno, e não foi o que mudou. As duas metades desta invariante deixaram de
// andar juntas, e é por isso que as asserções agora estão separadas.
const interno = A.atividadeDoChamado(chamado('aberto', { natureza: 'interno', equipe: 'ti', sprint: 'este_mes' }), ctxVazio);
const campo = A.atividadeDoChamado(chamado('aberto', { natureza: 'campo', equipe: 'tecnica', sprint: 'este_mes' }), ctxVazio);
eq('interno mantém equipe', interno.equipe, 'ti');
eq('CRÍTICO (R83): campo TAMBÉM carrega equipe agora — zerar escondia do filtro o trabalho de campo', campo.equipe, 'tecnica');
eq('a lista de equipes começa pela principal', campo.equipes[0], 'tecnica');
eq('sem equipes extras a lista tem só a principal', campo.equipes.length, 1);
eq('campo NÃO carrega sprint', campo.sprint, null);
eq('interno não entra na fila por prioridade', interno.prioridadeRank, 4);

// ── regressões que a revisão adversarial pegou (U10) ────────────────────────
// Cada uma destas quebrou de verdade em código publicado. Ficam travadas.

// o funil comercial inteiro sumia: emAberto vinha do bucket do status cru e
// ignorava a tradução, então visita aprovada e reprovada nasciam encerradas
const vAtiv = (status, extra = {}) =>
  A.atividadeDaVisita(visita(status, extra), { userId: null, apoios: new Set(), fichas: new Map() });
eq('visita aprovada sem proposta continua em aberto', vAtiv('aprovada').emAberto, true);
eq('e tem coluna no quadro', A.colunaVisivel(vAtiv('aprovada').coluna) !== null, true);
eq('R38: proposta enviada encerra na hora — não fica "em aberto" esperando resposta',
   vAtiv('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aguardando' }).emAberto, false);
eq('visita reprovada continua em aberto (tem que ser reagendada)',
   vAtiv('reprovada').emAberto, true);
eq('proposta aceita encerra',
   vAtiv('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aceita' }).emAberto, false);
eq('proposta recusada encerra',
   vAtiv('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'recusada' }).emAberto, false);
eq('visita com status desconhecido nunca é escondida pelo filtro padrão',
   vAtiv('sei_la').emAberto, true);

// chamado com status fora do CHECK também não pode ser cortado pelo padrão,
// senão a coluna "Sem status" seria inalcançável
eq('chamado com status desconhecido fica em aberto',
   A.atividadeDoChamado(chamado('inventado'), ctxVazio).emAberto, true);

// o card de visita não mostrava quando ela é, nem na Início nem em /chamados
eq('visita mostra a hora marcada no card',
   vAtiv('pendente', { data_hora_agendada: '2026-03-01T13:30:00Z' }).prazoTexto !== null, true);
eq('visita sem data não inventa hora', vAtiv('pendente').prazoTexto, null);

// o prazo tem que filtrar de verdade: deixar item sem data passar fazia
// "Hoje" devolver a base inteira, porque interno em geral não tem prazo
// (R60: "Período" virou "Prazo" — mesmo mecanismo, campo renomeado)
const L = carregar('src/features/home/lentes.ts');
const semPrazo = A.atividadeDoChamado(chamado('aberto'), ctxVazio);
eq('item sem data é reconhecido como tal', L.semData(semPrazo), true);
eq('e o prazo o esconde (a tela avisa quantos)',
   L.aplicarLentes([semPrazo], { ...L.FILTROS_INICIAIS, prazo: 'hoje' },
                   { agora: new Date(2026, 2, 10), minhaEquipe: null }, (x) => x).length, 0);
eq('sem prazo escolhido ele aparece',
   L.aplicarLentes([semPrazo], L.FILTROS_INICIAIS,
                   { agora: new Date(2026, 2, 10), minhaEquipe: null }, (x) => x).length, 1);

// ── permissão por tela (U11) ────────────────────────────────────────────────
// A régua tem que estar certa mesmo com o banco fora do ar: um erro aqui ou
// tranca gente para fora, ou libera o que não devia.
const TL = carregar('src/lib/telas.ts');

eq('admin passa em tudo, inclusive no que ninguém tem',
   TL.podeAbrir('gerencial.permissoes', 'admin', {}), true);
eq('admin passa mesmo com a matriz dizendo não',
   TL.podeAbrir('contratos', 'admin', { contratos: { admin: false } }), true);
eq('sem cargo não passa em nada', TL.podeAbrir('dashboard', null, {}), false);

// o banco manda quando responde
eq('matriz libera', TL.podeAbrir('contratos', 'sac', { contratos: { sac: true } }), true);
eq('matriz bloqueia', TL.podeAbrir('contratos', 'comercial', { contratos: { comercial: false } }), false);

// sem linha no banco vale o padrão do catálogo — banco fora do ar não pode
// trancar todo mundo para fora
eq('sem matriz, o padrão do catálogo vale (comercial vê contratos)',
   TL.podeAbrir('contratos', 'comercial', undefined), true);
eq('sem matriz, o padrão do catálogo vale (SAC não vê contratos — R13)',
   TL.podeAbrir('contratos', 'sac', undefined), false);
// (a tela-exemplo era 'chamados'; a lista morreu na R31 — o painel de
// chamados herda o papel de exemplo por ter o mesmo padrão: técnico não)
eq('sem matriz, técnico não abre o painel de chamados',
   TL.podeAbrir('chamados.painel', 'tecnico', undefined), false);
eq('matriz vazia é o mesmo que sem matriz',
   TL.podeAbrir('chamados.painel', 'tecnico', {}), false);

// telas obrigatórias não podem ser bloqueadas nem por engano nem de propósito
eq('perfil é sempre acessível — é por onde se sai do app',
   TL.podeAbrir('perfil', 'tecnico', { perfil: { tecnico: false } }), true);
eq('início é sempre acessível',
   TL.podeAbrir('dashboard', 'sac', { dashboard: { sac: false } }), true);

// tela fora do catálogo não é bloqueada por omissão
eq('chave desconhecida não tranca ninguém', TL.podeAbrir('tela_nova', 'tecnico', {}), true);

// o catálogo e a semente das migrations têm que falar das mesmas telas.
// A semente EFETIVA é a U11 com as migrations posteriores aplicadas por cima,
// na ordem dos arquivos — a U24, por exemplo, tira o técnico de Clientes.
const fs2 = require('fs');
const ARQUIVOS_SEMENTE = [
  'supabase/migrations/20260819180000_u11_permissoes_tela.sql',
  'supabase/migrations/20260820150000_u24_base_clientes.sql',
  'supabase/migrations/20260821120000_u27_prospeccao.sql',
  'supabase/migrations/20260821140000_u28_tres_paineis.sql',
  'supabase/migrations/20260821180000_u30_fusao_de_telas.sql',
  'supabase/migrations/20260821220000_u34_prospeccao_vira_aba.sql',
];
const semente = {};
for (const arq of ARQUIVOS_SEMENTE) {
  const sql = fs2.readFileSync(arq, 'utf8');
  const ini = sql.indexOf('INSERT INTO public.permissoes_tela (tela, cargo, permitido) VALUES');
  const fim = sql.indexOf('ON CONFLICT (tela, cargo)', ini);
  const bloco = sql.slice(ini, fim);
  for (const m of bloco.matchAll(/\('([a-z._]+)',\s*'(tecnico|comercial|sac)',\s*(true|false)\)/g)) {
    (semente[m[1]] ??= {})[m[2]] = m[3] === 'true';
  }
  // a U30 APAGA telas da matriz — o DELETE participa da semente efetiva,
  // senão o catálogo (que perdeu as chaves) nunca mais bateria com ela
  // a U30 apaga com `IN (...)`, a U34 com `= '...'` — as duas formas contam
  for (const del of sql.matchAll(/DELETE FROM public\.permissoes_tela\s+WHERE tela (?:IN \(([^)]+)\)|= ('[a-z._]+'))/g)) {
    for (const m of (del[1] ?? del[2] ?? '').matchAll(/'([a-z._]+)'/g)) delete semente[m[1]];
  }
}
const naSemente = new Set(Object.keys(semente));
const noCatalogo = new Set(TL.TELAS.map((t) => t.chave));
eq('catálogo e semente têm as mesmas telas',
   [...noCatalogo].filter((c) => !naSemente.has(c)).concat([...naSemente].filter((c) => !noCatalogo.has(c))), []);

// e o padrão do catálogo tem que bater com a semente efetiva, senão o app se
// comporta de um jeito antes da migration e de outro depois
const divergem = TL.TELAS.filter((t) =>
  ['tecnico', 'comercial', 'sac'].some((c) => semente[t.chave]?.[c] !== t.padrao[c]));
eq('padrão do catálogo bate com a semente da migration', divergem.map((t) => t.chave), []);

// ── Faixa de prazo: a cor de fundo do card (2026-08-20) ────────────────────
// Esta regra é visual, mas é lógica: errar a faixa pinta de azul um card que
// vence amanhã. O corte é o FIM da semana corrente, não "daqui a 7 dias".
{
  const seg = new Date(2026, 7, 17, 9, 0);         // segunda-feira
  const qui = new Date(2026, 7, 20, 9, 0);         // quinta da mesma semana
  const base = { emAberto: true, prazoEstourado: false, prazoLimite: null, agendadaEm: null };
  const em = (prazo, extra) => A.faixaPrazo({ ...base, prazoLimite: prazo, ...extra }, qui);

  eq('sem prazo → sem faixa', em(null), null);
  eq('encerrada nunca pinta', em(new Date(2026, 7, 21).toISOString(), { emAberto: false }), null);
  eq('prazo estourado → atraso', em(null, { prazoEstourado: true }), 'atraso');
  eq('prazo no passado → atraso mesmo sem a bandeira',
     em(new Date(2026, 7, 18, 9, 0).toISOString()), 'atraso');
  eq('vence amanhã (mesma semana) → esta_semana',
     em(new Date(2026, 7, 21, 12, 0).toISOString()), 'esta_semana');
  eq('vence no domingo, último instante da semana → esta_semana',
     em(new Date(2026, 7, 23, 23, 0).toISOString()), 'esta_semana');
  eq('vence na segunda seguinte → adiante',
     em(new Date(2026, 7, 24, 9, 0).toISOString()), 'adiante');
  eq('daqui a 5 dias mas já na outra semana → adiante (o corte é a semana, não 7 dias)',
     em(new Date(2026, 7, 25, 9, 0).toISOString()), 'adiante');
  eq('visita usa a hora marcada quando não há prazo',
     A.faixaPrazo({ ...base, agendadaEm: new Date(2026, 7, 21, 14, 0).toISOString() }, qui), 'esta_semana');
  eq('na segunda, a semana inteira ainda é "esta semana"',
     A.faixaPrazo({ ...base, prazoLimite: new Date(2026, 7, 23, 20, 0).toISOString() }, seg), 'esta_semana');
}

// ── A rampa de cor (v7: 20% azul · 40% amarelo · 20% laranja · 20% vermelho) ─
{
  const P = carregar('src/lib/paleta.ts');
  const fi = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  const oklch = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = fi(((n >> 16) & 255) / 255), g = fi(((n >> 8) & 255) / 255), b2 = fi((n & 255) / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b2);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b2);
    const s3 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b2);
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s3;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s3;
    let H = Math.atan2(B, A) * 180 / Math.PI; if (H < 0) H += 360;
    return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s3, C: Math.hypot(A, B), H };
  };
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16);
    const [r, g, b2] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(fi);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2; };
  const contraste = (a2, b2) => { const [x, y] = [lum(a2), lum(b2)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05); };
  const meio = (a2, b2) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a2), p(b2)];
    return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join(''); };

  // NOVE passos: a última barra vai da cor 7 à cor 8. Com oito, o laço de
  // espectro() levava a última barra da ponta vermelha de volta ao azul.
  eq('rampa escura tem 9 passos', P.ESPECTRO.dark.length, 9);
  eq('rampa clara tem 9 passos', P.ESPECTRO.light.length, 9);

  // as pontas: o degradê PERCORRE a paleta, não corre por fora dela
  eq('a ponta quente é o vermelho dos botões', P.ESPECTRO.dark[8], '#F17881');

  // v7: os TRÊS amarelos do botão da marca estão LITERAIS nas paradas. Era a
  // última divergência de cor do sistema — degradê com um amarelo, botão com
  // outro. Se alguém reconstruir a rampa e perder os hexes exatos, isto acusa.
  const paradasEscuras = P.ESPECTRO_STOPS.dark.map((s2) => s2.split(' ')[0]);
  for (const [nome, hex] of [['300', '#FCDE48'], ['400', '#F8C811'], ['500', '#E8B00A']]) {
    eq(`SUPERNOVA ${nome} (${hex}) está literal nas paradas do degradê`,
       paradasEscuras.includes(hex), true);
  }
  eq('o coração do degradê (42%) é o amarelo do botão',
     P.ESPECTRO_STOPS.dark.find((s2) => s2.endsWith(' 42%')), '#F8C811 42%');
  eq('amarelo do PRISMA é o amarelo do botão', P.PRISMA.amarelo.dark, '#F8C811');
  eq('azul do PRISMA é a ponta fria da rampa', P.PRISMA.azul.dark, P.ESPECTRO.dark[0]);
  eq('vermelho do PRISMA é a ponta quente da rampa', P.PRISMA.vermelho.dark, P.ESPECTRO.dark[8]);

  for (const [tema, chave, fundo] of [['escuro', 'dark', '#141416'], ['claro', 'light', '#ffffff']]) {
    const r = P.ESPECTRO[chave];
    // azul→amarelo cruza o VERDE em matiz: a costura precisa ser estreita e
    // quase acromática, senão sobra uma barra verde no meio do gráfico.
    const verdes = r.filter((h) => { const o = oklch(h); return o.H > 120 && o.H < 190 && o.C > 0.05; });
    eq(`${tema}: nenhuma amostra caiu no verde`, verdes, []);
    // quem pinta o número de 13px da barra é a rampa de TEXTO, não a de
    // preenchimento: na v7 o tema claro subiu tanto que o miolo amarelo dá
    // 2.5:1 sobre branco. É o espelho do problema que o escuro tinha na v5.1.
    const fracos = P.ESPECTRO_TEXTO[chave].filter((h) => contraste(h, fundo) < 4.5);
    eq(`${tema}: a rampa de TEXTO passa de 4.5:1`, fracos, []);
    // preenchimento (barra, arco) precisa de 3:1 — o mínimo WCAG de não-texto.
    // Na v7 o miolo amarelo claro caiu a 2.45:1 e as barras sumiam no card.
    const palidos = P.ESPECTRO[chave].filter((h) => contraste(h, fundo) < 3);
    eq(`${tema}: a rampa de PREENCHIMENTO passa de 3:1`, palidos, []);
    const paradasPalidas = P.ESPECTRO_STOPS[chave]
      .map((p2) => p2.split(' ')[0])
      .filter((h, i2) => i2 >= 4 && contraste(h, fundo) < 3); // costura (0-3) é fundo, não figura
    eq(`${tema}: paradas do miolo em diante passam de 3:1`, paradasPalidas, []);
    // emenda entre barras vizinhas não pode passar pelo cinza
    const lavadas = r.slice(0, -1)
      .map((h, i) => [i, oklch(meio(h, r[i + 1])).C])
      .filter(([, c]) => c < 0.045).map(([i]) => i);
    eq(`${tema}: nenhuma emenda passa pelo cinza`, lavadas, []);
    // a composição pedida: as paradas cobrem 0→100% em ordem crescente
    const pos = P.ESPECTRO_STOPS[chave].map((p) => parseFloat(p.split(' ')[1]));
    eq(`${tema}: paradas começam em 0% e terminam em 100%`, [pos[0], pos[pos.length - 1]], [0, 100]);
    eq(`${tema}: paradas em ordem crescente`,
       pos.every((v, i) => i === 0 || v >= pos[i - 1]), true);
    // 20/40/20/20 — a fronteira azul→amarelo mora em 20%, a amarelo→laranja em
    // 60%, a laranja→vermelho em 80%. Se alguém mexer nas paradas sem mexer na
    // composição, isto acusa.
    eq(`${tema}: a costura azul→amarelo está em 20%`, pos.includes(20.5), true);
    eq(`${tema}: a fronteira amarelo→laranja está em 60%`, pos.includes(60), true);
    eq(`${tema}: a fronteira laranja→vermelho está em 80%`, pos.includes(80), true);
  }

  // o tema claro tinha ficado escuro demais (barro sobre branco). A v7 subiu
  // a rampa; esta asserção impede que ela volte a afundar.
  const Lmedia = P.ESPECTRO.light
    .map((h) => oklch(h).L).reduce((a2, b2) => a2 + b2, 0) / P.ESPECTRO.light.length;
  eq('a rampa clara não pode voltar a afundar (L média > 0.60)', Lmedia > 0.60, true);
  eq('a rampa clara é mais escura que a escura (é o que a faz ler no branco)',
     Lmedia < P.ESPECTRO.dark.map((h) => oklch(h).L).reduce((a2, b2) => a2 + b2, 0) / 9, true);

  // A EMENDA ENTRE AMOSTRAS: as 9 amostras pulam a costura acromática, então
  // interpolar as duas vizinhas da emenda passa pelo VERDE — foi um achado da
  // auditoria v7 (a barra do gráfico ficava verde no miolo). gradienteBarra()
  // existe para isso; estas asserções impedem o defeito de voltar.
  for (const [tema, chave] of [['escuro', 'dark'], ['claro', 'light']]) {
    const r = P.ESPECTRO[chave];
    const m = oklch(meio(r[1], r[2]));
    eq(`${tema}: o par da emenda interpolado direto CAI no verde (por isso a costura existe)`,
       m.H > 100 && m.H < 190 && m.C > 0.04, true);
    const g = P.gradienteBarra(r[1], r[2], chave === 'light');
    eq(`${tema}: gradienteBarra insere a costura no par da emenda`,
       g.includes(P.COSTURA[chave]), true);
    eq(`${tema}: gradienteBarra no sentido inverso também`,
       P.gradienteBarra(r[2], r[1], chave === 'light').includes(P.COSTURA[chave]), true);
    eq(`${tema}: fora da emenda o gradiente é simples`,
       P.gradienteBarra(r[4], r[5], chave === 'light').includes(P.COSTURA[chave]), false);
    const c1 = oklch(meio(r[1], P.COSTURA[chave])), c2 = oklch(meio(P.COSTURA[chave], r[2]));
    const verde = (o) => o.H > 120 && o.H < 190 && o.C > 0.05;
    eq(`${tema}: com a costura, nenhuma metade da emenda é verde`, [c1, c2].filter(verde), []);
  }

  // avatares: a cor tem de ser ESTÁVEL para a mesma pessoa
  const id = 'a1b2c3d4-0000-4000-8000-000000000001';
  eq('degradê de avatar é estável para o mesmo id',
     P.degradeAvatar(id).grad, P.degradeAvatar(id).grad);
  eq('ids diferentes espalham pelas quatro famílias',
     new Set(['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'].map((k) => P.degradeAvatar(k).grad)).size > 1, true);
  eq('todo degradê de avatar tem glow', ['x1', 'x2', 'x3', 'x4'].every((k) => !!P.degradeAvatar(k).glow), true);
}

// ── U24: a base de clientes e o mapa ───────────────────────────────────────
{
  const fs3 = require('fs');
  const M = carregar('src/features/clientes/mapa-sp.ts');
  const C = carregar('src/features/clientes/cores.ts');

  // a cor do cliente é ESTÁVEL — é como se reconhece o mesmo cliente no mapa
  // e na lista (mesma decisão dos avatares)
  eq('corDoCliente é estável para o mesmo id',
     C.corDoCliente('abc-123', false), C.corDoCliente('abc-123', false));
  eq('corDoCliente muda com o tema',
     C.corDoCliente('abc-123', false) !== C.corDoCliente('abc-123', true), true);

  // 94 distritos: os 96 da cidade MENOS Marsilac e Parelheiros, que são a área
  // rural do extremo sul. Cortá-los foi decisão do Davi e muda o desenho E a
  // contagem do rodapé — se voltarem sem querer, o mapa se deforma de novo.
  // 67 distritos: a área que o Davi contornou. O recorte muda o desenho E a
  // contagem do rodapé — e foi validado com o dado que importa: nenhum dos
  // removidos tem cliente.
  eq('o mapa tem 47 distritos (a área atendida, 3 rodadas de corte)', M.DISTRITOS.length, 47);
  const nomes = M.DISTRITOS.map(([n]) => n);
  for (const b of ['Marsilac', 'Parelheiros', 'Grajaú',
                   'Perus', 'Anhanguera', 'Tremembé', 'Jaçanã',
                   'Itaquera', 'Cidade Tiradentes', 'São Miguel Paulista',
                   // 3ª rodada — Zona Norte/Leste
                   'Aricanduva', 'Sapopemba', 'Vila Matilde', 'Penha', 'Cangaíba',
                   'Vila Maria', 'Vila Medeiros', 'Tucuruvi', 'Vila Guilherme',
                   'Santana', 'Casa Verde', 'Limão', 'Freguesia do Ó', 'Pirituba',
                   'São Domingos', 'Jaguara',
                   // 3ª rodada — Zona Sul
                   'Jardim Ângela', 'Jardim São Luís', 'Capão Redondo', 'Campo Limpo']) {
    eq(`${b} está FORA do recorte`, nomes.includes(b), false);
  }
  for (const b of ['Moema', 'Itaim Bibi', 'Morumbi', 'Mooca', 'Pinheiros', 'Vila Mariana']) {
    eq(`${b} está no mapa`, nomes.includes(b), true);
  }
  eq('todo distrito tem path fechado',
     M.DISTRITOS.every(([, d]) => d.startsWith('M') && d.endsWith('Z')), true);

  // o teste de pertencimento decide quem aparece no mapa e quem vira "fora de
  // São Paulo" no rodapé — errar aqui erra o número que a pessoa lê
  eq('a Sé está na cidade', M.dentroDaCidade(-23.5505, -46.6333), true);
  eq('Moema está na cidade', M.dentroDaCidade(-23.6017, -46.6653), true);
  eq('Santana ficou fora do recorte (3ª rodada)', M.dentroDaCidade(-23.5010, -46.6250), false);
  eq('Itaquera ficou fora do recorte', M.dentroDaCidade(-23.5405, -46.4568), false);
  eq('Cidade Dutra (cliente mais ao sul) está na área', M.dentroDaCidade(-23.7333, -46.7021), true);
  eq('Penha (cortada, tinha 1 cliente) conta como fora', M.dentroDaCidade(-23.5226, -46.5267), false);
  eq('Casa Verde (cortada, tinha 1 cliente) conta como fora', M.dentroDaCidade(-23.4979, -46.6555), false);
  eq('Osasco NÃO está na cidade', M.dentroDaCidade(-23.5325, -46.7917), false);
  eq('Guarulhos NÃO está na cidade', M.dentroDaCidade(-23.4538, -46.5333), false);
  eq('Campinas NÃO está na cidade', M.dentroDaCidade(-22.9099, -47.0626), false);
  eq('Marsilac (área cortada) conta como fora', M.dentroDaCidade(-23.9200, -46.7100), false);
  eq('Grajaú (cortado) conta como fora', M.dentroDaCidade(-23.7885, -46.6900), false);
  eq('Perus (cortado) conta como fora', M.dentroDaCidade(-23.4103, -46.7500), false);

  // a projeção precisa pôr o norte em cima
  const se = M.projetar(-23.5505, -46.6333);
  const moema = M.projetar(-23.6017, -46.6653);
  eq('Moema projeta ABAIXO da Sé (norte é para cima, Moema é ao sul)', moema.y > se.y, true);
  eq('a Sé cai dentro do quadro',
     se.x > 0 && se.x < M.MAPA_SP.largura && se.y > 0 && se.y < M.MAPA_SP.altura, true);

  // centroide (2026-08-21, Davi: "adicione o nome do bairro em cada bairro")
  // — quadrado simples: o centro geométrico tem que cair exatamente no meio,
  // não numa média de vértice que um polígono côncavo já desmentiria.
  {
    const quadrado = 'M0,0L10,0L10,10L0,10Z';
    const c = M.centroide(quadrado);
    eq('centroide de um quadrado 10x10 cai no meio (5,5)', [c.x, c.y], [5, 5]);

    // um "L" (côncavo): a média simples dos 6 vértices cairia FORA da forma;
    // o centroide por área tem que continuar DENTRO dela
    const emL = 'M0,0L10,0L10,4L4,4L4,10L0,10Z';
    const cL = M.centroide(emL);
    eq('centroide de um polígono em L cai DENTRO da forma (não na média ingênua dos vértices)',
       cL.x < 4 || cL.y < 4, true);

    // todo distrito de verdade também tem que centrar DENTRO do próprio
    // desenho — usa o mesmo ray casting que decide quem está "na cidade"
    const dentroDoProprioPoligono = (d) => {
      const pontos = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
        .map(([, x, y]) => [Number(x), Number(y)]);
      const { x: px, y: py } = M.centroide(d);
      let dentro = false;
      for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
        const [xi, yi] = pontos[i], [xj, yj] = pontos[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
      }
      return dentro;
    };
    const forano = M.DISTRITOS.filter(([, d]) => !dentroDoProprioPoligono(d));
    eq('o centroide de TODOS os 47 distritos cai dentro do próprio polígono (esperado: nenhum fora)',
       forano.map(([n]) => n), []);
  }

  // Regra do Davi (3ª rodada de corte, 2026-08-20): cliente que more num
  // distrito removido NÃO trava o corte — vira +1 na contagem "fora de São
  // Paulo" do rodapé. Esta asserção não exige mais ZERO perdidos; ela trava o
  // conjunto EXATO esperado, para que um corte futuro não perca cliente sem
  // ninguém notar (a lista muda, a asserção precisa mudar junto — se não
  // mudar, ela acusa).
  {
    const sqlU24 = fs3.readFileSync('supabase/migrations/20260820150000_u24_base_clientes.sql', 'utf8');
    const re = /\('([^']+)', '[^']+', '[^']*', '([^']+)', '[A-Z]{2}', '[\d-]+', '[^']*', (-?[\d.]+), (-?[\d.]+)\)/g;
    const capital = [...sqlU24.matchAll(re)]
      .filter((m) => m[2] === 'São Paulo')
      .map((m) => ({ nome: m[1], lat: +m[3], lng: +m[4] }));
    eq('a planilha tem clientes na capital para conferir', capital.length > 100, true);
    const perdidos = capital.filter((c) => !M.dentroDaCidade(c.lat, c.lng)).map((c) => c.nome).sort();
    // BSGA (Penha) e Maria Domitila (Casa Verde) — os únicos dois clientes
    // que caem em distritos cortados na 3ª rodada. Se este conjunto crescer
    // sem uma decisão explícita do Davi por trás, a asserção falha.
    eq('os clientes fora do recorte são exatamente os esperados (contam no rodapé)',
       perdidos, ['BSGA', 'Maria Domitila']);

    // E o RÓTULO desses dois não pode dizer "fora de São Paulo": eles moram na
    // cidade, só num bairro que o recorte tirou. O componente separa em três
    // buckets justamente por isso — a asserção trava a separação.
    const comp = fs3.readFileSync('src/features/clientes/MapaClientes.tsx', 'utf8');
    eq('o mapa separa "outra cidade" de "bairro fora do recorte"',
       /foraDaCidade/.test(comp) && /foraDoRecorte/.test(comp), true);
    eq('quem decide "fora de São Paulo" é a CIDADE do cadastro, não a geometria',
       /c\.cidade && c\.cidade !== "São Paulo"/.test(comp), true);
    eq('o rótulo "fora de São Paulo" usa o contador de outra cidade',
       /fora de São Paulo:[\s\S]{0,220}\{foraDaCidade\}/.test(comp), true);

    // nome do bairro no mapa (2026-08-21, Davi: "adicione o nome do bairro em
    // cada bairro... fonte na cor branca, Montserrat regular")
    eq('um rótulo por distrito, no centro geométrico (não a média ingênua)',
       /ROTULOS_DISTRITOS = DISTRITOS\.map\(\(\[nome, d\]\) => \(\{ nome, \.\.\.centroide\(d\) \}\)\)/.test(comp),
       true);
    // R74: o rótulo perdeu o contorno, e por isso a cor teve de passar a
    // SEGUIR O TEMA — o halo escuro era a muleta que fazia um branco fixo
    // servir sobre o distrito quase-branco do tema claro.
    eq('CRÍTICO: o texto do bairro segue o tema — sem o contorno, branco fixo sumiria no claro (§8, anti-padrão nº 3)',
       /fill=\{rotuloDistrito\}/.test(comp)
       && /const rotuloDistrito = isLight \? "rgba\(0,0,0,0\.42\)" : "rgba\(255,255,255,0\.50\)";/.test(comp),
       true);
    eq('CRÍTICO: o rótulo NÃO tem mais contorno nem halo',
       /<text[\s\S]{0,320}(stroke=|paintOrder=)/.test(comp), false);
    eq('fonte Montserrat, peso 400 (regular)',
       /fontFamily: "Montserrat,[\s\S]{0,60}fontWeight: 400/.test(comp), true);
    eq('o grupo dos rótulos não intercepta clique/hover (pointerEvents none)',
       /<g style=\{\{ pointerEvents: "none" \}\}>\s*\n\s*\{ROTULOS_DISTRITOS\.map/.test(comp), true);
  }

  // a migration U24: 192 clientes, todos com coordenada, verificação no fim
  const sql = fs3.readFileSync('supabase/migrations/20260820150000_u24_base_clientes.sql', 'utf8');
  const linhas = [...sql.matchAll(/\n    \('/g)].length;
  const linhasPlanilha = [...sql.matchAll(/\('[^']+', '[\d.\/​-]+', '[^']*', '[^']+', '[A-Z]{2}', '\d{5}-\d{3}', '[^']*', (-?[\d.]+|NULL), (-?[\d.]+|NULL)\)/g)];
  eq('a planilha da U24 tem 192 clientes', linhasPlanilha.length, 192);
  eq('TODOS os 192 têm coordenada (geocodificação fechou em 171/171 CEPs)',
     linhasPlanilha.filter((m) => m[1] === 'NULL' || m[2] === 'NULL').length, 0);
  eq('latitude nunca vira longitude (lat -24..-13, lng -48..-38)',
     linhasPlanilha.every((m) => +m[1] < -13 && +m[1] > -24 && +m[2] < -38 && +m[2] > -48), true);
  eq('a U24 termina com a verificação (RAISE NOTICE é invisível no editor)',
     sql.includes("SELECT 'planilha' AS etapa"), true);
  eq('coordenada apurada em campo vale mais que CEP (COALESCE preserva)',
     sql.includes('latitude       = COALESCE(c.latitude,  p.lat)'), true);
  eq('o rebaixamento é auditável (padrão U8)',
     sql.includes('clientes_rebaixados_u24'), true);
}

// ── S1: a blindagem de segurança ───────────────────────────────────────────
// A RLS é o perímetro do sistema: todo usuário fala direto com o Postgres com
// a mesma chave pública. Um SELECT aberto numa tabela com CPF não é detalhe.
{
  const fs4 = require('fs');
  const s1 = fs4.readFileSync('supabase/migrations/20260820170000_s1_blindagem_rls.sql', 'utf8');

  eq('S1: clientes deixa de ser USING(true)',
     /DROP POLICY IF EXISTS "clientes_select_autenticados"/.test(s1), true);
  eq('S1: a policy nova de clientes passa por pode_ver_cliente',
     /CREATE POLICY "clientes_select"[\s\S]{0,200}pode_ver_cliente/.test(s1), true);
  eq('S1: pode_ver_cliente é SECURITY DEFINER com search_path fixo',
     /FUNCTION public\.pode_ver_cliente[\s\S]{0,160}SECURITY DEFINER SET search_path = public/.test(s1), true);
  eq('S1: pode_ver_cliente não é executável por anon',
     /REVOKE EXECUTE ON FUNCTION public\.pode_ver_cliente\(uuid\) FROM PUBLIC, anon/.test(s1), true);
  eq('S1: a fila sem dono continua mostrando o cliente (senão o card fica sem nome)',
     /responsavel_id IS NULL[\s\S]{0,120}status IN/.test(s1), true);
  eq('S1: a ficha de compra larga pode_acessar_chamado (brecha do responsável nulo)',
     /CREATE POLICY "chamado_compra_select"[\s\S]{0,400}is_gestor/.test(s1)
     && !/CREATE POLICY "chamado_compra_select"[\s\S]{0,400}pode_acessar_chamado/.test(s1), true);
  eq('S1: funil_comercial passa a exigir gestor',
     /FUNCTION public\.funil_comercial\(_desde date[\s\S]{0,600}is_gestor/.test(s1), true);
  eq('S1: funil_comercial mantém a assinatura (o app chama sem mudar)',
     /RETURNS TABLE \(etapa text, quantidade bigint, ordem int\)/.test(s1), true);
  eq('S1: buckets de foto viram privados', /SET public = false/.test(s1), true);
  // O inventário tem TRÊS níveis e só o primeiro tem cliente_id — foi o que
  // fez a migration falhar na primeira execução do Davi.
  eq('S1: cliente_equipamentos chega ao cliente pelo SISTEMA, não por cliente_id',
     /cliente_equipamentos[\s\S]{0,300}cliente_sistema_id/.test(s1), true);
  // só as linhas de CÓDIGO: o comentário da seção 2 cita `e.cliente_id` de
  // propósito, explicando por que a coluna não existe
  const s1cod = s1.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  eq('S1: nenhuma referência a e.cliente_id no código (a coluna não existe)',
     /\be\.cliente_id\b/.test(s1cod), false);
  eq('S1: o inventário não é fechado por laço com IF EXISTS (pularia calado)',
     /FOREACH t IN ARRAY ARRAY\['cliente_sistemas', 'cliente_equipamentos'\]/.test(s1), false);
  // papel por função de DUPLA fonte: has_role só lê user_roles e travaria o
  // comercial cujo cargo esteja apenas em profiles
  eq('S1: escrita em clientes não usa has_role (fonte única)',
     /clientes_update_gestor[\s\S]{0,300}has_role/.test(s1), false);
  eq('S1: pode_gerir_clientes lê as duas fontes de papel',
     /pode_gerir_clientes[\s\S]{0,400}user_roles[\s\S]{0,200}profiles/.test(s1), true);
  eq('S1: apagar foto é só do dono ou de gestor',
     /FOR DELETE TO authenticated[\s\S]{0,120}is_gestor/.test(s1), true);
  eq('S1: termina com verificação por SELECT (RAISE NOTICE é invisível no editor)',
     /SELECT 'clientes: policy restritiva' AS item/.test(s1), true);

  // as telas que LISTAM todos os clientes precisam ser de gestor, senão a
  // policy nova esvazia a tela em vez de proteger
  const TL2 = carregar('src/lib/telas.ts');
  for (const chave of ['clientes', 'contratos', 'fechamentos', 'chamados.novo', 'gerencial.nova']) {
    const t = TL2.TELAS.find((x) => x.chave === chave);
    if (t) eq(`S1: ${chave} não é do técnico (lista clientes)`, t.padrao.tecnico, false);
  }

  // XSS: o popup do Leaflet monta HTML na mão
  const mapa = fs4.readFileSync('src/routes/_authenticated/mapa.tsx', 'utf8');
  eq('S1: o popup do mapa escapa o nome do cliente',
     /escapar\(v\.cliente\?\.nome \?\? v\.titulo\)/.test(mapa), true);
  eq('S1: nenhuma interpolação crua sobrou no popup',
     /\$\{v\.(cliente\?\.nome|titulo)\}/.test(mapa), false);

  // CABEÇALHOS DE SEGURANÇA: REVERTIDOS (2026-08-20).
  //
  // Introduzi CSP + HSTS + nosniff em src/server.ts e o app caiu. Duas vezes.
  // A causa da primeira foi a CSP bloqueante contra o <script> inline do SSR;
  // da segunda não cheguei a provar. O que sei é que src/server.ts é o ÚNICO
  // arquivo que roda só em produção — `vite dev` não o carrega — então eu não
  // tinha como testar antes de o Davi publicar. Reverti para o estado
  // conhecido-bom e registrei como S10.
  //
  // Esta asserção existe para impedir que os cabeçalhos voltem sem que exista
  // uma forma de exercitá-los antes do deploy.
  const srv = fs4.readFileSync('src/server.ts', 'utf8');
  eq('S1: src/server.ts está no estado conhecido-bom (sem cabeçalhos)',
     /content-security-policy|strict-transport-security|comSeguranca/.test(srv), false);

  // REVOKE de coluna é ferramenta errada no Supabase: todo logado é o mesmo
  // role `authenticated`, então o REVOKE atinge o admin junto — e quebra
  // qualquer `select *`. A S1b desfez; a S1 não pode reintroduzir.
  const s1cod2 = s1.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  eq('S1: nenhum REVOKE de coluna sobrou (quebra select * e não separa papel)',
     /REVOKE (SELECT|UPDATE) \(/.test(s1cod2), false);
  const s1b = fs4.readFileSync('supabase/migrations/20260820180000_s1b_desfaz_revoke_coluna.sql', 'utf8');
  eq('S1b: devolve o SELECT de telefone', /GRANT SELECT \(telefone\)/.test(s1b), true);
  eq('S1b: devolve o UPDATE de cargo', /GRANT UPDATE \(cargo\)/.test(s1b), true);
  eq('S1b: confirma que o trigger anti-promoção segue de pé',
     /trg_guard_profiles_privilegios/.test(s1b), true);

  // O .env PRECISA estar versionado: o Lovable builda a partir do repo e, sem
  // ele, o Vite não acha VITE_SUPABASE_* e o client.ts lança na criação —
  // app inteiro fora do ar. Tirei por higiene em 2026-08-20 e derrubei tudo.
  const gi = fs4.readFileSync('.gitignore', 'utf8');
  eq('.env NÃO pode ser ignorado (o build do Lovable depende dele)',
     /^\.env\s*$/m.test(gi), false);
  eq('.env existe no disco', fs4.existsSync('.env'), true);
  const env = fs4.readFileSync('.env', 'utf8');
  eq('.env tem as duas variáveis que o client exige',
     /VITE_SUPABASE_URL=/.test(env) && /VITE_SUPABASE_PUBLISHABLE_KEY=/.test(env), true);
  // e o contrapeso: segredo de verdade JAMAIS pode entrar nesse arquivo
  eq('.env NÃO contém segredo (service_role / anthropic)',
     /service_role|ANTHROPIC|sk-ant-/i.test(env), false);
}

// ── Sidebar recolhível + margens da página Clientes ────────────────────────
{
  const fs5 = require('fs');

  const css = fs5.readFileSync('src/styles.css', 'utf8');
  eq('CSS: --rail recolhida existe e é menor que a expandida',
     /\[data-sidebar="recolhida"\]\s*\{\s*--rail:\s*72px/.test(css), true);
  eq('CSS: a variante recolhida está DENTRO do media query de desktop (não vale no celular)',
     (() => {
       // acha o "@media (min-width: 1024px)" que contém "--rail: 232px" e
       // casa as chaves a partir dele até fechar — [data-sidebar] precisa
       // cair ANTES desse fechamento
       const marca = css.indexOf('--rail: 232px;');
       let ini = css.lastIndexOf('@media (min-width: 1024px)', marca);
       let i = css.indexOf('{', ini), prof = 0, fimBloco = -1;
       for (let k = i; k < css.length; k++) {
         if (css[k] === '{') prof++;
         else if (css[k] === '}') { prof--; if (prof === 0) { fimBloco = k; break; } }
       }
       const j = css.indexOf('[data-sidebar="recolhida"]');
       return ini > 0 && fimBloco > 0 && j > ini && j < fimBloco;
     })(), true);
  eq('CSS: clientes-duas-colunas não depende mais de .pagina-clientes (removida)',
     css.includes('.pagina-clientes'), false);

  const rota = fs5.readFileSync('src/routes/_authenticated/clientes.tsx', 'utf8');
  // className="sangra-x" OU "sangra-x clientes-tela-fixa" (R60) — o que
  // importa é sangra-x estar lá, como token próprio (não miolo de outro nome)
  eq('clientes.tsx usa .sangra-x — a MESMA classe da Início, não um padding próprio',
     /className="sangra-x(?: [\w-]+)*"/.test(rota), true);
  eq('clientes.tsx não inventa padding horizontal (sangra-x já resolve)',
     /padding:\s*"12px 0/.test(rota), false);

  const layout = fs5.readFileSync('src/routes/_authenticated/route.tsx', 'utf8');
  eq('route.tsx aplica data-sidebar no MESMO elemento que lê padding-left: var(--rail)',
     /data-sidebar=\{recolhida[\s\S]{0,120}paddingLeft: "var\(--rail\)"/.test(layout), true);

  const nav = fs5.readFileSync('src/components/SideNav.tsx', 'utf8');
  eq('SideNav tem o botão de alternar (PanelLeftClose/Open)', /alternarSidebar/.test(nav), true);
  eq('SideNav usa a largura recolhida quando recolhida', /LARGURA_RAIL_RECOLHIDA/.test(nav), true);
  eq('o rótulo do item some quando recolhida (ícone só)', /\{!recolhida && label\}/.test(nav), true);

  const S = carregar('src/lib/sidebar-recolhida.ts');
  eq('LARGURA_RAIL (expandida) é maior que a recolhida', S.LARGURA_RAIL > S.LARGURA_RAIL_RECOLHIDA, true);
  eq('a recolhida é estreita o bastante para não virar uma sidebar média',
     S.LARGURA_RAIL_RECOLHIDA >= 56 && S.LARGURA_RAIL_RECOLHIDA <= 88, true);
}

// ── U27: Prospecção — cliente vira leitura do QAP (R21/R22/R23) ────────────
{
  const fs6 = require('fs');
  const u27 = fs6.readFileSync('supabase/migrations/20260821120000_u27_prospeccao.sql', 'utf8');

  eq('U27: cria a tabela prospeccoes', /CREATE TABLE IF NOT EXISTS public\.prospeccoes/.test(u27), true);
  eq('U27: a visita ganha prospeccao_id', /ADD COLUMN IF NOT EXISTS prospeccao_id/.test(u27), true);
  // R23: a proposta é para um cliente OU para uma prospecção, nunca os dois
  eq('U27: trava o alvo duplo da visita (R23)',
     /CHECK \(cliente_id IS NULL OR prospeccao_id IS NULL\)/.test(u27), true);
  // R21: o app não cria cliente — a policy é o que fecha de verdade, porque a
  // tela some no deploy mas o console do navegador não
  eq('U27: derruba a policy de INSERT em clientes (R21)',
     /DROP POLICY IF EXISTS "clientes_insert_gestor" ON public\.clientes/.test(u27), true);
  eq('U27: NÃO recria policy de INSERT em clientes',
     /CREATE POLICY[^;]*ON public\.clientes[^;]*FOR INSERT/.test(u27), false);
  // o aceite deixa de mexer no cadastro do cliente: aquela coluna passa a ser
  // do QAP, e dois donos para o mesmo dado é o defeito que se quer evitar
  // Só o CORPO da função (do CREATE até o $$ que fecha). Sem recortar, a
  // regex casava com a própria verificação SQL do fim do arquivo, que cita
  // a string 'UPDATE public.clientes' para checar exatamente isto.
  const corpoRPC = (() => {
    const i = u27.indexOf('CREATE OR REPLACE FUNCTION public.registrar_resultado_proposta');
    return i < 0 ? '' : u27.slice(i, u27.indexOf('$$;', i));
  })();
  eq('U27: o corpo do aceite não escreve mais em clientes',
     /UPDATE public\.clientes/.test(corpoRPC), false);
  eq('U27: e o corpo do aceite foi mesmo encontrado (a asserção acima não é vácua)',
     corpoRPC.length > 400, true);
  eq('U27: o aceite marca a PROSPECÇÃO (ganha/perdida)',
     /UPDATE public\.prospeccoes[\s\S]{0,200}'ganha'/.test(u27), true);
  // migração não-destrutiva: prospecto com histórico duro não é apagado
  eq('U27: não apaga prospecto que tenha chamado/contrato/cobrança',
     /NOT EXISTS \(SELECT 1 FROM public\.chamados[\s\S]{0,400}cliente_contratos[\s\S]{0,400}cobrancas/.test(u27), true);
  eq('U27: guarda o de-para para reapontar e poder desfazer',
     /prospeccoes_migradas_u27/.test(u27), true);
  eq('U27: termina com verificação por SELECT',
     /SELECT 'prospecções criadas' AS item/.test(u27), true);

  // o app: 'prospecto' deixou de ser situação de cliente
  const cd = fs6.readFileSync('src/features/clientes/data.ts', 'utf8');
  eq("app: SituacaoCliente perdeu 'prospecto'",
     /export type SituacaoCliente = "ativo" \| "inativo";/.test(cd), true);
  const ct = fs6.readFileSync('src/routes/_authenticated/clientes.tsx', 'utf8');
  eq('app: a lista de clientes não filtra mais por prospecto',
     /Prospectos ·/.test(ct), false);
  eq('app: sumiu o botão de criar cliente (R21)',
     /to: "\/clientes\/novo"/.test(ct), false);

  // as rotas de criar/consolidar redirecionam
  for (const arq of ['clientes.novo.tsx', 'clientes.migrar.tsx']) {
    const r = fs6.readFileSync(`src/routes/_authenticated/${arq}`, 'utf8');
    eq(`app: ${arq} redireciona em vez de renderizar`,
       /throw redirect\(\{ to: "\/clientes" \}\)/.test(r), true);
  }

  // R38: Prospecção deixou de ser tela e virou ABA de /gerencial. Quem herda
  // o acesso é a 'gerencial' — e ela tem que ter EXATAMENTE a permissão que a
  // prospecção tinha, senão a mudança de lugar vira mudança de acesso.
  const TL3 = carregar('src/lib/telas.ts');
  eq('prospeccao saiu do catálogo (virou aba do Comercial)',
     TL3.TELAS.some((t) => t.chave === 'prospeccao'), false);
  const ger = TL3.TELAS.find((t) => t.chave === 'gerencial');
  eq('quem absorveu a Prospecção mantém o mesmo acesso (comercial e SAC, não técnico)',
     ger && ger.padrao.comercial === true && ger.padrao.sac === true
         && ger.padrao.tecnico === false, true);
  for (const chave of ['clientes.novo', 'clientes.migrar']) {
    const t = TL3.TELAS.find((x) => x.chave === chave);
    eq(`${chave} está negada para todos os papéis`,
       t && !t.padrao.tecnico && !t.padrao.comercial && !t.padrao.sac, true);
  }
}

// ── U28: os três painéis (R27) ─────────────────────────────────────────────
{
  const fs7 = require('fs');
  const TL4 = carregar('src/lib/telas.ts');
  const chaves = TL4.TELAS.map((t) => t.chave);

  for (const k of ['painel.operacional', 'painel.administrativo']) {
    eq(`catálogo tem ${k}`, chaves.includes(k), true);
  }
  // R32: o Painel Comercial fundiu com a lista de visitas — a chave viva é
  // 'gerencial'; ressuscitar 'painel.comercial' recriaria porta e sala separadas
  eq('painel.comercial saiu do catálogo (R32: fundiu com a lista)',
     chaves.includes('painel.comercial'), false);
  // A chave 'gerencial' NÃO pode ser renomeada: é gravada no banco e o próprio
  // telas.ts avisa que renomear invalida a linha — toda permissão já
  // configurada pelo admin sumiria em silêncio.
  eq("a chave 'gerencial' sobreviveu (renomear apagaria permissões do admin)",
     chaves.includes('gerencial'), true);

  const op = TL4.TELAS.find((t) => t.chave === 'painel.operacional');
  const co = TL4.TELAS.find((t) => t.chave === 'gerencial'); // R32: a página fundida
  const ad = TL4.TELAS.find((t) => t.chave === 'painel.administrativo');
  eq('Operacional abre para comercial e SAC (quem coordena, R26)',
     op.padrao.comercial && op.padrao.sac, true);
  eq('a página comercial abre para comercial e SAC (o SAC agenda a visita)',
     co.padrao.comercial && co.padrao.sac, true);
  eq('Administrativo não abre para ninguém na matriz (só admin, por sistema)',
     ad.padrao.comercial || ad.padrao.sac || ad.padrao.tecnico, false);
  eq('nenhum painel abre para o técnico (ele não coordena — R1/R7)',
     [op, co, ad].some((t) => t.padrao.tecnico), false);

  // menu: o celular tem 5 vagas e elas já estavam tomadas — só um painel lá
  const nav = fs7.readFileSync('src/components/nav-itens.ts', 'utf8');
  eq('as três portas estão no menu (Comercial aponta direto para /gerencial — R32)',
     /painel\/operacional[\s\S]*"\/gerencial", label: "Comercial"[\s\S]*painel\/administrativo/.test(nav), true);
  eq('o Comercial é só desktop (a barra do celular tem 5 vagas)',
     /"\/gerencial", label: "Comercial"[^}]*soDesktop: true/.test(nav), true);
  eq('o Administrativo é só desktop',
     /painel\/administrativo"[^}]*soDesktop: true/.test(nav), true);
  eq('o Operacional entra também no celular (é o painel do dia a dia)',
     /painel\/operacional", label: "Operacional"[^}]*soDesktop/.test(nav), false);

  // a barra do celular não pode estourar as 5 vagas em nenhum cargo
  const NAV = carregar('src/components/nav-itens.ts');
  for (const cargo of ['admin', 'comercial', 'sac', 'tecnico']) {
    const noCelular = NAV.itensDoCargo(cargo).filter((i) => !i.soDesktop);
    eq(`barra do celular de ${cargo} cabe em 5 itens (tem ${noCelular.length})`,
       noCelular.length <= 5, true);
  }

  // a base compartilhada existe — três painéis com anatomia própria viram
  // irmãos desiguais na primeira mudança de design
  eq('os painéis dividem uma base', fs7.existsSync('src/features/paineis/PainelBase.tsx'), true);

  // cada painel tem guarda de rota própria (o menu esconder não é proteção)
  for (const arq of ['painel.operacional.tsx', 'painel.administrativo.tsx']) {
    const r = fs7.readFileSync(`src/routes/_authenticated/${arq}`, 'utf8');
    eq(`${arq} tem guarda de rota`, /guardaDeTela\("painel\./.test(r), true);
  }
  // /painel/comercial é só redirect (R32) — guarda ali seria guardar parede;
  // o porteiro é o do destino, e o redirect não pode ter conteúdo próprio
  const redir = fs7.readFileSync('src/routes/_authenticated/painel.comercial.tsx', 'utf8');
  eq('painel.comercial.tsx só redireciona para /gerencial',
     /redirect\(\{ to: "\/gerencial" \}\)/.test(redir) && !/PainelBase|useQuery/.test(redir), true);

  // o Administrativo não põe dinheiro na porta: R13 barra o SAC de ver valores,
  // e um número grande na entrada vazaria por cima das telas de dentro
  // Só as linhas de CÓDIGO: o cabeçalho do arquivo explica justamente por que
  // não há dinheiro ali, e citava os termos que a asserção procura.
  const adminCod = fs7.readFileSync('src/routes/_authenticated/painel.administrativo.tsx', 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  eq('o Painel Administrativo não mostra valor em reais na entrada (R13)',
     /valor_total|faturamento|receita|R\$/.test(adminCod), false);
}

// ── U29: a proposta é um tipo de chamado (R29) ─────────────────────────────
{
  const fs8 = require('fs');
  const u29 = fs8.readFileSync('supabase/migrations/20260821160000_u29_proposta_e_chamado.sql', 'utf8');
  const CS = carregar('src/lib/chamado-status.ts');

  // R48/U41 (2026-08-21) renomeou "proposta_comercial" → "prospeccao" no
  // vocabulário VIVO (chamado-status.ts) — o texto da migration U29 abaixo
  // continua com o nome antigo de propósito: é o que o arquivo gravava
  // NAQUELE momento, e migration já publicada não se edita.
  eq('o tipo prospeccao existe', CS.TIPOS.includes('prospeccao'), true);
  eq('prospeccao tem rótulo "Prospecção"', CS.TIPO_LABEL.prospeccao, 'Prospecção');
  eq('prospeccao tem cor da paleta', !!CS.TIPO_CORES.prospeccao, true);
  eq('a natureza comercial existe', !!CS.NATUREZA_LABEL.comercial, true);
  // um seletor de chamado de campo não pode oferecer "prospecção"
  eq('prospeccao só aparece na natureza comercial',
     CS.tiposDaNatureza('campo').includes('prospeccao')
     || CS.tiposDaNatureza('interno').includes('prospeccao'), false);
  eq('a natureza comercial oferece o tipo prospeccao',
     CS.tiposDaNatureza('comercial'), ['prospeccao']);

  // banco: os CHECKs precisam aceitar o vocabulário novo, senão o INSERT falha
  eq('U29: o CHECK de natureza aceita comercial',
     /natureza IN \('campo', 'interno', 'comercial'\)/.test(u29), true);
  eq('U29: o CHECK de tipo aceita proposta_comercial',
     /'proposta_comercial'/.test(u29), true);

  // A técnica da U7: MESMO id, para os satélites da visita não precisarem de
  // reescrita de FK. Se o INSERT gerasse id novo, visita_blocos e companhia
  // apontariam para o nada.
  eq('U29: o chamado nasce com o MESMO id da visita',
     /INSERT INTO public\.chamados[\s\S]{0,600}SELECT\s+v\.id,/.test(u29), true);
  eq('U29: a visita vira satélite por FK no próprio id',
     /FOREIGN KEY \(id\) REFERENCES public\.chamados\(id\)/.test(u29), true);
  // sem o trigger a capa congela no estado da migração
  eq('U29: trigger mantém a capa em dia com o funil',
     /CREATE TRIGGER trg_sincronizar_chamado_da_visita/.test(u29), true);
  eq('U29: numera as linhas novas no formato CH-AAAA-NNNN',
     /'CH-' \|\| r\.ano::text/.test(u29), true);

  // A capa não pode ser mais frouxa que o corpo: a lista de chamados viraria a
  // porta dos fundos do funil comercial.
  eq('U29: a policy trata a natureza comercial à parte',
     /WHEN natureza = 'comercial' THEN[\s\S]{0,160}is_gestor/.test(u29), true);
  eq('U29: proposta NÃO herda a regra de "responsável nulo é de todos"',
     /WHEN natureza = 'comercial' THEN\s*\n\s*public\.is_gestor\(auth\.uid\(\)\) OR responsavel_id = auth\.uid\(\)/.test(u29), true);

  // app: a visita deixou de ser cidadã de segunda classe no quadro
  const mod = fs8.readFileSync('src/features/atividades/modelo.ts', 'utf8');
  // R48/U41: o literal aqui é vivo (código atual), não migration — segue
  // "prospeccao", o nome novo.
  eq('a proposta entra no quadro com natureza e tipo (não mais nulos)',
     /natureza: "comercial",\s*\n\s*tipo: "prospeccao",/.test(mod), true);
  eq('a proposta entra com número vindo da capa',
     /numero: v\.chamado\?\.numero/.test(mod), true);
  // a Início precisa trazer a capa no join, senão o número volta a ser null
  // (a lista /chamados, que também trazia, morreu na R31 — sobrou uma tela)
  for (const [arq, alvo] of [
    ['src/features/home/data.ts', 'Início'],
  ]) {
    eq(`${alvo}: o join traz o chamado-capa`,
       /chamado:chamados!visitas_e_chamado\(numero, prioridade\)/.test(fs8.readFileSync(arq, 'utf8')), true);
  }
}

// ── U30: a lista /chamados morreu (R31); Comercial fundiu (R32);
//         indicadores de campo no Painel Operacional ──────────────────────
{
  const fs9 = require('fs');
  const path9 = require('path');
  const TL5 = carregar('src/lib/telas.ts');
  const chaves5 = TL5.TELAS.map((t) => t.chave);

  eq("'chamados' (a lista) saiu do catálogo (R31)", chaves5.includes('chamados'), false);
  eq("'chamados.indicadores' saiu do catálogo (absorvida pelo Painel Operacional)",
     chaves5.includes('chamados.indicadores'), false);
  eq('a página antiga dos indicadores foi apagada',
     fs9.existsSync('src/routes/_authenticated/chamados.indicadores.tsx'), false);

  // /chamados virou tronco: o endereço exato redireciona, as filhas passam
  const tronco = fs9.readFileSync('src/routes/_authenticated/chamados.tsx', 'utf8');
  eq('/chamados exato redireciona para a Início',
     /=== "\/chamados"/.test(tronco) && /redirect\(\{ to: "\/dashboard" \}\)/.test(tronco), true);
  eq('/chamados não tem mais lista própria (a fila mora na Início)',
     /useQuery|useChamados|Atividade/.test(tronco), false);
  eq('/chamados continua deixando as filhas passarem (Outlet)',
     /component: Outlet/.test(tronco), true);

  // ninguém mais navega para a lista morta — nem menu, nem botão de voltar.
  // Varre o src inteiro: um botão esquecido quicaria no redirect (pulo duplo)
  // e o rótulo dele mentiria o destino.
  const apontam = [];
  (function varrer(dir) {
    for (const e of fs9.readdirSync(dir, { withFileTypes: true })) {
      const p = path9.join(dir, e.name);
      if (e.isDirectory()) { varrer(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name) || e.name === 'routeTree.gen.ts') continue;
      if (/to: "\/chamados"/.test(fs9.readFileSync(p, 'utf8'))) apontam.push(p);
    }
  })('src');
  eq('nenhum botão ou item de menu aponta para a lista morta', apontam, []);

  // o Painel Operacional pinta o que o módulo calcula — não calcula nada
  const po = fs9.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');
  eq('o Painel Operacional usa o módulo de indicadores', /calcularIndicadores\(/.test(po), true);
  eq('o Painel Operacional olha só chamados de campo',
     /useChamadosPorNatureza\("campo"\)/.test(po), true);

  // ── o cálculo em si, com dados de laboratório ────────────────────────────
  const IND = carregar('src/features/paineis/indicadores.ts');
  const agora = new Date('2026-08-21T12:00:00');
  const d = (dias) => new Date(agora.getTime() - dias * 86_400_000).toISOString();
  const ch = (extra) => ({
    id: String(Math.random()), status: 'aberto', natureza: 'campo',
    created_at: d(1), ...extra,
  });

  // a proposta comercial NÃO contamina os números de campo (relógios distintos)
  {
    const r = IND.calcularIndicadores([
      ch({}), ch({ natureza: 'comercial', status: 'aberta' }),
    ], agora);
    eq('indicadores: proposta comercial fica de fora', r.abertos, 1);
  }
  // saldo do mês = entradas − saídas; positivo quando a fila cresce
  {
    const r = IND.calcularIndicadores([
      ch({}), ch({}),
      ch({ status: 'concluida', finalizada_em: d(0.5), iniciada_em: d(0.8) }),
    ], agora);
    eq('indicadores: entradas do mês', r.entradasMes, 3);
    eq('indicadores: saídas do mês', r.saidasMes, 1);
    eq('indicadores: saldo positivo = fila cresceu', r.saldoMes, 2);
  }
  // % no prazo só entre os que TINHAM prazo — sem prazo não vira elogio
  {
    const r = IND.calcularIndicadores([
      ch({ status: 'concluida', finalizada_em: d(1), prazo_limite: d(2) }),   // estourou
      ch({ status: 'concluida', finalizada_em: d(2), prazo_limite: d(1) }),   // no prazo
      ch({ status: 'concluida', finalizada_em: d(1) }),                        // SEM prazo
    ], agora);
    eq('indicadores: % no prazo ignora quem não tinha prazo', r.pctNoPrazo, 50);
  }
  // mediana resiste ao outlier (a média não resistiria)
  {
    const r = IND.calcularIndicadores([
      ch({ created_at: d(2) }), ch({ created_at: d(4) }), ch({ created_at: d(90) }),
    ], agora);
    eq('indicadores: idade mediana ignora o outlier', r.idadeMediana, 4);
    eq('indicadores: mas o mais antigo aparece', r.idadeMaisVelho, 90);
    eq('indicadores: encalhados conta o de 90 dias', r.encalhados, 1);
  }
  // reincidência conta PARES próximos, não clientes grandes
  {
    const r = IND.calcularIndicadores([
      ch({ tipo: 'corretiva', cliente_id: 'volta', created_at: d(10) }),
      ch({ tipo: 'corretiva', cliente_id: 'volta', created_at: d(5) }),        // par: 5 dias
      ch({ tipo: 'corretiva', cliente_id: 'grande', created_at: d(300) }),
      ch({ tipo: 'corretiva', cliente_id: 'grande', created_at: d(200) }),     // 100 dias: não é par
      ch({ tipo: 'preventiva', cliente_id: 'volta', created_at: d(6) }),       // preventiva não conta
    ], agora);
    eq('indicadores: reincidência pega quem voltou em 30 dias',
       r.reincidencia.map((x) => x.clienteId), ['volta']);
  }
  // os dois relógios separados: até começar ≠ executando
  {
    const r = IND.calcularIndicadores([
      ch({ status: 'concluida', created_at: d(3), iniciada_em: d(2), finalizada_em: d(1) }),
    ], agora);
    eq('indicadores: até começar (h)', r.horasAteComecar, 24);
    eq('indicadores: executando (h)', r.horasDeExecucao, 24);
  }
  // urgentes: só os em aberto
  {
    const r = IND.calcularIndicadores([
      ch({ prioridade: 'urgente' }),
      ch({ prioridade: 'urgente', status: 'concluida', finalizada_em: d(1) }),
    ], agora);
    eq('indicadores: urgente concluído não é mais urgência', r.urgentes, 1);
  }
  // horasTexto: o painel não tem espaço para frase
  eq('horasTexto: horas', IND.horasTexto(6), '6h');
  eq('horasTexto: dias redondos', IND.horasTexto(48), '2d');
  eq('horasTexto: dias e horas', IND.horasTexto(76), '3d 4h');
  eq('horasTexto: sem dado é travessão', IND.horasTexto(null), '—');

  // o Painel Comercial de verdade: /gerencial com o título novo e sem os
  // botões do domínio administrativo (a reclamação que originou a R32)
  const ger = fs9.readFileSync('src/routes/_authenticated/gerencial.tsx', 'utf8');
  eq('/gerencial se apresenta como Painel Comercial', /Painel Comercial/.test(ger), true);
  const soCodigoGer = ger.split('\n')
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join('\n');
  eq('/gerencial não tem botão para o domínio administrativo',
     /label: "(Contratos|Fechamentos|Usuários|Permissões)"/.test(soCodigoGer), false);

  // a U30 existe e faz as duas coisas que promete
  const u30 = fs9.readFileSync('supabase/migrations/20260821180000_u30_fusao_de_telas.sql', 'utf8');
  eq('U30 transfere o acesso do SAC para a página fundida',
     /\('gerencial', 'sac', true\)/.test(u30), true);
  eq('U30 apaga as linhas das três telas mortas',
     /DELETE FROM public\.permissoes_tela\s+WHERE tela IN \('chamados', 'chamados\.indicadores', 'painel\.comercial'\)/.test(u30), true);
  eq('U30 termina com SELECT de verificação', /SELECT '.*esperado/.test(u30), true);

  // o painel de chamados ganhou a guarda que a chave da matriz prometia
  const pc = fs9.readFileSync('src/routes/_authenticated/chamados.painel.tsx', 'utf8');
  eq('chamados.painel tem guarda de rota própria',
     /guardaDeTela\("chamados\.painel"\)/.test(pc), true);
}

// ── U31: códigos de erro (2026-08-21) ──────────────────────────────────────
// Um código de erro que muda entre ocorrências, ou que classifica errado, é
// pior que não ter código: manda a investigação para o lado errado com ar de
// certeza. Por isso a taxonomia inteira é testada com erros REAIS.
{
  const fs10 = require('fs');
  const E = carregar('src/lib/erros.ts');

  // formato: PRV-<ÁREA>-<CLASSE>-<ORIGEM>
  const rls = { message: 'new row violates row-level security policy', code: '42501' };
  eq('código tem as quatro partes',
     /^PRV-[A-Z]{3}-[A-Z]{4}-[A-Z0-9]+$/.test(E.codigoDeErro(rls, '/clientes')), true);
  eq('código carrega o SQLSTATE de origem (não inventa o nosso)',
     E.codigoDeErro(rls, '/clientes'), 'PRV-CLI-PERM-42501');

  // área: o prefixo mais específico ganha, senão /painel/operacional viraria PNL
  eq('área: painel operacional tem sigla própria', E.areaDaRota('/painel/operacional'), 'POP');
  eq('área: painel administrativo idem', E.areaDaRota('/painel/administrativo'), 'PAD');
  eq('área: permissões não vira gerencial', E.areaDaRota('/gerencial/permissoes'), 'PER');
  eq('área: gerencial puro é GER', E.areaDaRota('/gerencial'), 'GER');
  eq('área: rota filha herda a área do pai', E.areaDaRota('/chamados/abc-123'), 'CHM');
  eq('área: raiz é a Início', E.areaDaRota('/'), 'INI');
  eq('área: desconhecida não quebra', E.areaDaRota('/coisa-nova'), 'APP');

  // classificação — os erros reais que o Supabase/Postgres devolvem
  const classe = (e) => E.classificarErro(e).classe;
  eq('offline vira REDE (e não culpa o banco)',
     classe(Object.assign(new TypeError('Failed to fetch'), {})), 'REDE');
  eq('migration pendente vira ESQM (tabela fora do cache)',
     classe({ code: 'PGRST205', message: "Could not find the table 'public.prospeccoes'" }), 'ESQM');
  eq('coluna inexistente também é ESQM', classe({ code: '42703', message: 'column x does not exist' }), 'ESQM');
  eq('FK que o embed pede e não existe é ESQM', classe({ code: 'PGRST200', message: 'Could not find a relationship' }), 'ESQM');
  eq('RLS vira PERM', classe(rls), 'PERM');
  eq('sessão expirada vira AUTH', classe({ status: 401, message: 'JWT expired' }), 'AUTH');
  eq('401 e 403 não se confundem (entrar ≠ pedir acesso)',
     [classe({ status: 401, message: 'x' }), classe({ status: 403, message: 'x' })], ['AUTH', 'PERM']);
  eq('violação de unicidade vira DADO', classe({ code: '23505', message: 'duplicate key' }), 'DADO');
  eq('FK violada vira DADO', classe({ code: '23503', message: 'violates foreign key' }), 'DADO');
  eq('404 vira ROTA', classe({ status: 404, message: 'Not Found' }), 'ROTA');
  eq('bug de render vira APP', classe(new TypeError("Cannot read properties of undefined (reading 'x')")), 'APP');

  // determinismo e estabilidade — a razão de existir do código
  const semCodigo = new Error('Cannot read properties of undefined (reading nome)');
  eq('mesmo erro dá sempre o mesmo código',
     E.codigoDeErro(semCodigo, '/clientes'), E.codigoDeErro(semCodigo, '/clientes'));
  // a mensagem varia no id/hora, a falha é a mesma → o código não pode variar
  eq('id e data na mensagem não mudam o código',
     E.codigoDeErro(new Error('falhou para 3f2b1a4c-1111-2222-3333-444455556666 em 2026-08-21T10:00:00'), '/chamados'),
     E.codigoDeErro(new Error('falhou para 9a9a9a9a-9999-8888-7777-666655554444 em 2026-01-02T23:59:59'), '/chamados'));
  eq('áreas diferentes dão códigos diferentes',
     E.codigoDeErro(semCodigo, '/clientes') !== E.codigoDeErro(semCodigo, '/contratos'), true);

  // toda classe tem texto — classe sem explicação renderiza tela vazia
  for (const c of ['REDE', 'AUTH', 'PERM', 'DADO', 'ESQM', 'ROTA', 'APP']) {
    const t = E.EXPLICACAO[c];
    eq(`classe ${c} tem título, o que houve e o que fazer`,
       !!(t && t.titulo && t.oQueHouve && t.oQueFazer), true);
  }

  // as portas: rota, 404 e consultas passam pela taxonomia
  const raiz = fs10.readFileSync('src/routes/__root.tsx', 'utf8');
  eq('a tela de erro da rota mostra o código', /TelaDeErro/.test(raiz) && /codigoDeErro/.test(raiz), true);
  eq('o 404 também sai com código (status 404 na fabricação)',
     /status: 404/.test(raiz), true);
  const rt = fs10.readFileSync('src/router.tsx', 'utf8');
  eq('erro de consulta passa pelo funil único (QueryCache)',
     /new QueryCache\(/.test(rt) && /mensagemDeErro/.test(rt), true);
  // ancorar em `new MutationCache(` e não em 'MutationCache': o nome aparece
  // antes, na linha de import, e o split pegaria o bloco do QueryCache junto
  eq('gravação registra código sem duplicar o toast da ação',
     /new MutationCache\(/.test(rt) && !/toast\.error/.test(rt.split('new MutationCache(')[1] ?? ''), true);
  const tela = fs10.readFileSync('src/components/TelaDeErro.tsx', 'utf8');
  eq('a tela de erro tem botão de copiar (o caminho real é o WhatsApp)',
     /clipboard/.test(tela), true);
  eq('o detalhe técnico existe mas fica fechado', /<details/.test(tela), true);
  eq('o escape usa <a>, não <Link> (o roteador pode ser o que quebrou)',
     /<a href="\/dashboard"/.test(tela), true);
}

// ── U31: importação do Notion + etiqueta de cliente (2026-08-21) ───────────
{
  const fs11 = require('fs');
  const IMP = carregar('src/features/chamados/importar-notion.ts');

  // DATAS — o export mistura quatro formatos e um deles é armadilha
  eq('data ISO', IMP.lerData('2026-03-12'), '2026-03-12');
  eq('data BR', IMP.lerData('12/03/2026'), '2026-03-12');
  eq('data em português (o formato da coluna Criação)',
     IMP.lerData('28 de abril de 2025 10:05'), '2025-04-28');
  eq('português com mês acentuado', IMP.lerData('3 de março de 2026'), '2026-03-03');
  // a armadilha: new Date('12/03/2026') devolve 3 de DEZEMBRO (padrão dos EUA).
  // Se o formato BR não vier antes, dia e mês trocam em silêncio.
  eq('BR ganha do parser americano (senão 12/03 vira dezembro)',
     IMP.lerData('12/03/2026').slice(5, 7), '03');
  eq('data vazia é nula', IMP.lerData(''), null);
  eq('data-hora guarda o minuto (é o que dá identidade à linha)',
     IMP.lerDataHora('28 de abril de 2025 10:05'), '2025-04-28 10:05');

  // STATUS — os três que o export novo trouxe
  const st = (s) => IMP.STATUS_NOTION[s];
  eq('"aguardando terceiros" é parada, não fila', st('aguardando terceiros'), 'stand_by');
  eq('"aguardando material" idem', st('aguardando material'), 'stand_by');
  eq('"planejado" é trabalho a fazer', st('planejado'), 'aberto');
  eq('"concluido" fecha', st('concluido'), 'concluido');

  // CLIENTE — as três vias de casamento, e a recusa de adivinhar
  const qap = new Map([
    ['especializados', 'c-esp'],
    ['gaspar dutra', 'c-gd'],
    ['mirant vila madalena residencial', 'c-m1'],
    ['mirant vila madalena studios', 'c-m2'],
    ['pateo klabin', 'c-pk'],
    ['california', 'c-ca'],
  ]);
  const casa = (n) => IMP.casarCliente(n, qap);
  eq('cliente exato', casa('Pateo Klabin').clienteId, 'c-pk');
  eq('"Prever" é a própria casa = Especializados no QAP (1143 atividades)',
     casa('Prever').clienteId, 'c-esp');
  eq('"Prever 2" também', casa('Prever 2').clienteId, 'c-esp');
  eq('contenção sem ambiguidade casa ("Eurico Gaspar Dutra" → "Gaspar Dutra")',
     casa('Eurico Gaspar Dutra').clienteId, 'c-gd');
  // a regra que impede pendurar trabalho no prédio errado
  eq('contenção AMBÍGUA não casa ("Mirant" serve a dois prédios)',
     casa('Mirant').clienteId, null);
  eq('mas o nome escrito é preservado (a etiqueta continua existindo)',
     casa('Mirant').nomeOrigem, 'Mirant');
  eq('célula multivalorada usa o primeiro',
     casa('Califórnia, Pateo Klabin').clienteId, 'c-ca');
  eq('cliente vazio não inventa vínculo',
     [casa('').clienteId, casa('').nomeOrigem], [null, null]);

  // PESSOA — o primeiro COM CONTA, não o primeiro da lista
  const pessoas = IMP.indicePessoas([
    { id: 'p-erik', nome: 'Erik Freitas', email: 'erik.freitas@grupoprever.com.br' },
    { id: 'p-nick', nome: 'Nicholas Matos', email: 'nicholas.matos@grupoprever.com.br' },
  ]);
  eq('pessoa por nome completo', IMP.casarPessoa('Erik Freitas', pessoas).id, 'p-erik');
  eq('sobrenome diferente reconcilia pelo primeiro nome (Kafka × Matos)',
     IMP.casarPessoa('Nicholas Kafka', pessoas).id, 'p-nick');
  eq('em "Maria Souza, Erik Freitas" fica com quem TEM conta',
     IMP.casarPessoa('Maria Souza, Erik Freitas', pessoas).id, 'p-erik');
  eq('ninguém com conta → sem id, mas registra que havia nome',
     [IMP.casarPessoa('Maria Souza', pessoas).id, IMP.casarPessoa('Maria Souza', pessoas).havia],
     [null, true]);

  // A LINHA PRONTA — inclusive a chave de reimportação
  const col = { titulo: 'T', responsavel: 'R', cliente: 'C', equipe: 'E',
                sprint: 'S', status: 'St', prazo: 'P', conclusao: 'Cc', criacao: 'Cr' };
  const reg = (extra) => ({ T: 'Verificar zonas', R: 'Erik Freitas', C: 'Prever',
    E: 'T.I / Técnica', S: 'Backlog', St: 'Não iniciado', P: '', Cc: '',
    Cr: '28 de abril de 2025 10:05', ...extra });
  const r1 = IMP.lerLinhas([reg({})], col, pessoas, qap);
  eq('linha completa entra', r1.linhas.length, 1);
  eq('equipe "T.I / Técnica" vira ti', r1.linhas[0].equipe, 'ti');
  eq('a chave de origem usa criação + título',
     r1.linhas[0].origemId, '2025-04-28 10:05|verificar zonas');
  // o defeito real medido no arquivo: título repetido sem prazo colapsava a
  // chave e 216 das 2099 linhas eram descartadas como falsas duplicatas
  const r2 = IMP.lerLinhas(
    [reg({}), reg({ Cr: '28 de abril de 2025 10:06' })], col, pessoas, qap);
  eq('mesmo título e sem prazo NÃO colidem (a criação separa)',
     new Set(r2.linhas.map((l) => l.origemId)).size, 2);
  // pular quem não tem conta é decisão de produto, não economia
  const r3 = IMP.lerLinhas([reg({ R: 'Maria Souza' })], col, pessoas, qap);
  eq('sem conta: pula em vez de virar "sem responsável"',
     [r3.linhas.length, r3.semConta.length], [0, 1]);
  eq('linha sem título é contada, não importada',
     IMP.lerLinhas([reg({ T: '' })], col, pessoas, qap).semTitulo, 1);
  eq('conclusão só é lida quando o status é concluído',
     [IMP.lerLinhas([reg({ St: 'Concluído', Cc: '07/05/2025' })], col, pessoas, qap).linhas[0].concluida_em,
      IMP.lerLinhas([reg({ St: 'Em andamento', Cc: '07/05/2025' })], col, pessoas, qap).linhas[0].concluida_em],
     ['2025-05-07', null]);

  // A ETIQUETA no quadro: dado e pintura
  const home = fs11.readFileSync('src/features/home/data.ts', 'utf8');
  eq('a Home busca o nome de origem do cliente', /cliente_origem_nome/.test(home), true);
  const mod = fs11.readFileSync('src/features/atividades/modelo.ts', 'utf8');
  eq('o vínculo do QAP vence o texto do Notion',
     /cliente: c\.cliente\?\.nome \?\? c\.cliente_origem_nome/.test(mod), true);
  const cardA = fs11.readFileSync('src/features/home/CardAtividade.tsx', 'utf8');
  // U71: virou LISTA de locais (R84/R85). Continua sendo chip e não texto
  // solto — a razão original não mudou: no quadro, "de qual prédio é isto?" é
  // a segunda pergunta, e a resposta precisa do mesmo peso visual dos outros
  // chips para ser achada varrendo a coluna.
  eq('a etiqueta de LOCAL é um chip (borderRadius 999), não texto solto',
     /a\.locais\.slice\(0, LOCAIS_NO_CARD\)\.map\([\s\S]{0,500}borderRadius: 999/.test(cardA), true);
  eq('CRÍTICO: o card mostra TODOS os locais, com teto e "+N" — sem o teto a fileira quebra e desalinha a coluna de 260px',
     /LOCAIS_NO_CARD/.test(cardA) && /a\.locais\.length > LOCAIS_NO_CARD/.test(cardA)
     && /\+\{a\.locais\.length - LOCAIS_NO_CARD\}/.test(cardA), true);
  eq('o title da etiqueta lista todos os locais — o card resume, o title não esconde',
     /title=\{a\.locais\.join\(" · "\)\}/.test(cardA), true);
  const u31 = fs11.readFileSync('supabase/migrations/20260821200000_u31_cliente_de_origem.sql', 'utf8');
  eq('U31 cria a coluna de forma idempotente',
     /ADD COLUMN IF NOT EXISTS cliente_origem_nome/.test(u31), true);
  eq('U31 termina com SELECT de verificação', /SELECT '.*esperado/.test(u31), true);

  // a tela de importar ganhou guarda própria (o pai virou tronco na R31)
  const imp = fs11.readFileSync('src/routes/_authenticated/chamados.importar.tsx', 'utf8');
  eq('chamados.importar tem guarda de rota',
     /guardaDeTela\("chamados\.importar"\)/.test(imp), true);
  eq('a gravação é em lotes (2 mil linhas de uma vez estouram o PostgREST)',
     /i \+= 400/.test(imp), true);
}

// ── U32: painel de propriedades + calendário consertado (2026-08-21) ───────
{
  const fs12 = require('fs');
  const painel = fs12.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');
  const cal = fs12.readFileSync('src/routes/_authenticated/calendario.tsx', 'utf8');
  const dash = fs12.readFileSync('src/routes/_authenticated/dashboard.tsx', 'utf8');
  // só linhas de código: os cabeçalhos explicam justamente os termos vigiados
  const codigo = (t) => t.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  // A COLUNA QUE NÃO EXISTE — a causa real de o calendário viver vazio.
  // `chamados.tecnico_id` sumiu na U7 (virou responsavel_id); pedi-la fazia o
  // PostgREST responder 42703 e a consulta inteira voltava vazia.
  eq('o calendário não pede chamados.tecnico_id (foi o que o deixou vazio)',
     /chamados[\s\S]{0,400}?tecnico_id/.test(codigo(cal).split('from("chamados')[1] ?? ''), false);
  eq('o calendário usa responsavel_id', /responsavel_id/.test(cal), true);
  // a visita AINDA usa tecnico_id — a coluna existe lá; trocar as duas seria
  // consertar um lado e quebrar o outro
  eq('a visita continua com tecnico_id (a coluna é dela)',
     /visitas_tecnicas[\s\S]{0,300}?tecnico_id/.test(cal), true);

  // a segunda causa: só entrava quem tinha hora marcada, e as 2100 do Notion
  // não têm — o que elas têm é prazo
  eq('o calendário também coloca atividade pelo PRAZO',
     /prazo_limite\.gte/.test(cal) && /prazo_limite\.lte/.test(cal), true);
  eq('e distingue as duas origens de data na célula',
     /porPrazo/.test(cal), true);

  // o que o Davi pediu ver em cada dia
  eq('a célula do dia mostra o título', /\{e\.titulo\}/.test(cal), true);
  eq('a célula do dia mostra o(s) responsável(eis)', /AvatarPilha/.test(cal), true);
  eq('a grade ocupa a tela (dvh, não vh — a barra do celular entra e sai)',
     /100dvh/.test(cal), true);

  // O PAINEL
  eq('o painel entra pela direita', /side="right"/.test(painel), true);
  eq('o painel ocupa no máximo 60% da tela (pedido do Davi)',
     /maxWidth: "60vw"/.test(painel), true);
  eq('o painel NÃO é de tela inteira', /w-full|width: "100vw"/.test(codigo(painel)), false);
  // a data de criação é informação, não campo — é a âncora que a idade do
  // backlog e a reincidência usam para contar
  eq('a data de criação não é editável',
     /patch: \{ created_at/.test(painel) || /name="created_at"/.test(painel), false);
  // "Recebido em" (U33) — o mesmo vocabulário da coluna da tabela
  eq('a data de criação aparece como informação',
     /Recebido em[\s\S]{0,120}chamado\.created_at/.test(painel), true);
  // as propriedades que o Davi listou
  for (const campo of ['responsavel_id', 'tipo', 'status', 'prioridade',
                       'equipe', 'sprint', 'titulo', 'descricao_problema']) {
    eq(`o painel edita ${campo}`, new RegExp(`patch: \\{ ${campo}`).test(painel), true);
  }
  // o prazo entra num patch que pode levar o sprint junto (R40), então o
  // formato não é o literal simples dos outros
  eq('o painel edita prazo_limite', /prazo_limite: prazo/.test(painel), true);
  eq('o painel edita apoio (vários)', /adicionarApoio[\s\S]*removerApoio/.test(painel), true);
  // cliente_id saiu do patch direto (R54, U45): virou campo de VÁRIOS
  // valores, igual a apoio — mesmo cliente_id continuando o principal por
  // baixo dos panos (ver data.ts). U71: o campo virou LOCAL, e o atalho de
  // grupo virou atalho de SETOR — etiqueta, não expansão em N clientes.
  eq('o painel edita LOCAL (vários, com atalho de setor) — não mais um patch direto de cliente_id',
     /adicionarClienteChamado[\s\S]*removerClienteChamado[\s\S]*adicionarSetorChamado/.test(painel), true);
  eq('CRÍTICO (R84): o campo se chama "Local", não "Cliente" — o local pode não ser cliente nenhum',
     /titulo="Local"/.test(painel), true);
  eq('cliente_id não é mais escrito como patch direto no painel (virou lista)',
     /patch: \{ cliente_id/.test(painel), false);

  // React: subcomponente declarado DENTRO do pai ganha identidade nova a cada
  // render — o React remonta e o texto sendo digitado some no meio da frase
  eq('as peças de formulário são de módulo, não funções internas',
     /^function (Campo|Escolha|Texto|Selo)\(/m.test(painel), true);
  eq('nenhuma peça é declarada dentro do componente do painel',
     /export function PainelChamado[\s\S]*?\n  function (Campo|Escolha|Texto|Selo)\(/.test(painel), false);

  // hora local no input de agendamento: toISOString() mostraria UTC e a visita
  // das 9h apareceria como 12h
  eq('o campo de agendamento usa hora local, não UTC',
     /paraEntradaLocal/.test(painel) && !/data_hora_agendada[\s\S]{0,120}toISOString\(\)\.slice/.test(painel), true);

  // as duas telas abrem o mesmo painel
  eq('a Início abre o painel ao clicar no cartão',
     /setPainelId\(a\.registroId\)/.test(dash), true);
  eq('o calendário abre o MESMO painel', /PainelChamado/.test(cal), true);
  // a visita tem fluxo próprio nas duas
  eq('a visita continua indo para o fluxo dela (Início)',
     /fonte === "visita"[\s\S]{0,200}visitaRouteFor/.test(dash), true);
  eq('a visita continua indo para o fluxo dela (calendário)',
     /kind === "visita"[\s\S]{0,200}visitaRouteFor/.test(cal), true);

  // salvar precisa refrescar o que está atrás, senão o cartão fica no lugar velho
  for (const chave of ['chamados', 'home', 'calendario']) {
    eq(`salvar no painel refresca "${chave}"`,
       new RegExp(`queryKey: \\["${chave}"`).test(painel), true);
  }
}

// ── U33: painéis que respondem aos filtros + tabela na Início (2026-08-21) ──
{
  const fs13 = require('fs');
  const G = carregar('src/features/home/metricas.ts');
  const P = carregar('src/lib/periodos.ts');

  const dia = (s) => new Date(s).toISOString();
  const at = (extra) => ({
    id: 'ch-' + Math.random(), natureza: 'interno', sprint: 'este_mes',
    coluna: 'concluido', emAberto: false, encerradoEm: dia('2026-08-10T10:00:00'),
    ...extra,
  });

  // ── metaDoMes: a etiqueta diz a intenção, a data diz o fato ──────────────
  const agora = new Date(2026, 7, 21); // agosto de 2026
  const meta = (lista) => G.metaDoMes(lista, agora);

  eq('meta: conta o que foi encerrado no mês corrente',
     meta([at({})]), { total: 1, feitas: 1 });
  eq('meta: conta o que ainda está em aberto (é o que falta fazer)',
     meta([at({ emAberto: true, coluna: 'aberto', encerradoEm: null })]), { total: 1, feitas: 0 });
  // o defeito real medido no export: 7 atividades marcadas "este mês" tinham
  // sido concluídas em junho/julho — contadas pela etiqueta, virariam entrega
  // de agosto
  eq('meta: etiqueta VELHA não vira entrega do mês (concluída em julho)',
     meta([at({ encerradoEm: dia('2026-07-15T10:00:00') })]), { total: 0, feitas: 0 });
  eq('meta: cancelado não entra (cancelar não é entregar)',
     meta([at({ coluna: 'cancelado' })]), { total: 0, feitas: 0 });
  eq('meta: chamado de campo não entra (a meta é do quadro interno)',
     meta([at({ natureza: 'campo' })]), { total: 0, feitas: 0 });
  eq('meta: sprint diferente não entra',
     meta([at({ sprint: 'backlog' })]), { total: 0, feitas: 0 });

  // ── concluidosPorSemana ─────────────────────────────────────────────────
  const semanaDe = (s) => {
    const d = P.inicioSemana(new Date(s));
    return P.dataIso(d);
  };
  {
    const r = G.concluidosPorSemana([
      at({ encerradoEm: dia('2026-08-10T09:00:00') }),
      at({ encerradoEm: dia('2026-08-11T09:00:00') }),   // mesma semana
      at({ encerradoEm: dia('2026-08-03T09:00:00') }),   // semana anterior
    ]);
    eq('barras: duas da mesma semana somam', r[semanaDe('2026-08-10T09:00:00')], 2);
    eq('barras: a de outra semana vai para o balde dela', r[semanaDe('2026-08-03T09:00:00')], 1);
  }
  eq('barras: em aberto não conta (encerradoEm é null)',
     Object.keys(G.concluidosPorSemana([at({ emAberto: true, encerradoEm: null })])).length, 0);
  eq('barras: cancelado não é entrega',
     Object.keys(G.concluidosPorSemana([at({ coluna: 'cancelado' })])).length, 0);

  // ── encerradoEm: o modelo, não a tela ───────────────────────────────────
  const M = carregar('src/features/atividades/modelo.ts');
  const ctxVazio = { userId: 'u1', apoios: new Set(), fichas: new Map(), apoiosDoChamado: undefined };
  const ch = (extra) => M.atividadeDoChamado({
    id: 'x', numero: 'CH-1', titulo: 'T', status: 'concluido', natureza: 'interno',
    tipo: null, prioridade: null, equipe: 'ti', sprint: 'backlog',
    prazo_limite: null, data_hora_agendada: null, responsavel_id: 'u1', aberto_por: 'u1',
    created_at: dia('2026-01-01T10:00:00'), updated_at: dia('2026-08-20T10:00:00'),
    ...extra,
  }, ctxVazio);

  eq('encerradoEm prefere concluida_em',
     ch({ concluida_em: dia('2026-08-05T10:00:00'), fechada_em: dia('2026-08-09T10:00:00') }).encerradoEm,
     dia('2026-08-05T10:00:00'));
  eq('sem concluida_em, cai em fechada_em',
     ch({ fechada_em: dia('2026-08-09T10:00:00') }).encerradoEm, dia('2026-08-09T10:00:00'));
  eq('sem nenhuma das duas, cai em updated_at',
     ch({}).encerradoEm, dia('2026-08-20T10:00:00'));
  eq('em aberto NÃO tem data de encerramento',
     ch({ status: 'aberto' }).encerradoEm, null);
  // a extração da variável `emAberto` não podia mudar o comportamento
  eq('status desconhecido continua contando como aberto',
     [ch({ status: 'coisa_nova' }).emAberto, ch({ status: 'coisa_nova' }).encerradoEm], [true, null]);

  // ── a fiação na tela ────────────────────────────────────────────────────
  const dash = fs13.readFileSync('src/routes/_authenticated/dashboard.tsx', 'utf8');
  for (const c of ['GraficoDemanda', 'GraficoMeta', 'PainelKpis']) {
    // [\s\S]{0,40}, não espaço fixo: PainelKpis (R60) ganhou props extras
    // (ativo/onSelecionar) e passou a abrir em várias linhas — o que importa
    // é que `atividades` continua sendo `paraPaineis`, não a posição exata.
    eq(`${c} recebe o recorte filtrado, não o array cru`,
       new RegExp(`<${c}[\\s\\S]{0,40}atividades=\\{paraPaineis\\}`).test(dash), true);
  }
  // ── O CAMINHO COMPLETO, do filtro que abre a tela até o número pintado ──
  //
  // Esta é A asserção que faltava, e a falta dela quase mandou ao ar um
  // defeito crítico: os painéis usavam `aplicarLentes` com `periodo: null`, e
  // o filtro inicial (`situacao: "abertos"`) descartava TODO encerrado antes
  // de chegar na conta. Barras do passado em zero, meta travada em 0% — para
  // todo mundo, no primeiro acesso, sem tocar em nada.
  //
  // Testar as peças isoladas não pegava: `metaDoMes` e `concluidosPorSemana`
  // estavam certos, e `aplicarLentes` também. O erro morava na JUNÇÃO, e por
  // isso o teste percorre a junção inteira.
  {
    const LN = carregar('src/features/home/lentes.ts');
    const MT = carregar('src/features/home/metricas.ts');
    const agoraT = new Date(2026, 7, 21);       // sexta, 21 de agosto de 2026
    const feito = {
      id: 'ch-1', natureza: 'interno', sprint: 'este_mes', coluna: 'concluido',
      emAberto: false, encerradoEm: new Date(2026, 7, 12, 10).toISOString(),
      responsavelId: 'u1', souResponsavel: true, souApoio: false, souAutor: true,
      titulo: 'feito', numero: 'CH-1', cliente: null, prazoLimite: null, quando: null,
    };
    const aberto = { ...feito, id: 'ch-2', coluna: 'aberto', emAberto: true,
                     encerradoEm: null, titulo: 'aberto' };

    const recorte = LN.recorteDosPaineis([feito, aberto], LN.FILTROS_INICIAIS, (s) => s.toLowerCase());
    eq('recorte dos painéis NÃO descarta o encerrado (era o defeito crítico)',
       recorte.length, 2);
    eq('e por isso a meta enxerga a entrega',
       MT.metaDoMes(recorte, agoraT), { total: 2, feitas: 1 });
    eq('e a barra do passado deixa de ser zero',
       Object.values(MT.concluidosPorSemana(recorte))[0], 1);

    // o espelho: o recorte NORMAL do quadro continua escondendo encerrado, que
    // é o certo lá — quadro é fila de trabalho
    const doQuadro = LN.aplicarLentes([feito, aberto], LN.FILTROS_INICIAIS,
      { agora: agoraT, minhaEquipe: null }, (s) => s.toLowerCase());
    eq('o quadro continua mostrando só o que está em aberto', doQuadro.length, 1);

    // preset do técnico: sete dos oito exigem emAberto, e meu_dia ainda
    // recorta por dia — se o preset valesse no painel, zeraria tudo de novo
    const comPreset = LN.recorteDosPaineis([feito, aberto],
      { ...LN.FILTROS_INICIAIS, preset: 'meu_dia' }, (s) => s.toLowerCase());
    eq('nem o preset apaga o histórico do painel', comPreset.length, 2);

    // mas o que o Davi PEDIU continua valendo: filtrar por pessoa recorta
    const deOutro = LN.recorteDosPaineis([feito, aberto],
      { ...LN.FILTROS_INICIAIS, pessoa: 'outro-uid' }, (s) => s.toLowerCase());
    eq('filtrar por pessoa continua recortando o painel', deOutro.length, 0);
    const porBusca = LN.recorteDosPaineis([feito, aberto],
      { ...LN.FILTROS_INICIAIS, busca: 'feito' }, (s) => s.toLowerCase());
    eq('a busca continua recortando o painel', porBusca.map((a) => a.id), ['ch-1']);
  }
  eq('o painel usa o recorte próprio, não o do quadro',
     /recorteDosPaineis\(uniao, filtros, normalizarTexto\)/.test(dash), true);
  // nenhum recorte por estado pode voltar: apaga metade do gráfico
  eq('o recorte dos painéis não olha situação nem período',
     /situacao|periodo|dentroDoPeriodo/.test(
       (fs13.readFileSync('src/features/home/lentes.ts', 'utf8')
         .split('export function recorteDosPaineis')[1] ?? '').split('export function ordenar')[0]),
     false);
  eq('o painel soma o histórico ao que está no quadro',
     /\[\.\.\.atividades, \.\.\.historico\]/.test(dash), true);
  eq('a união é deduplicada por id', /vistos\.has\(a\.id\)/.test(dash), true);

  // a janela do histórico NÃO pode se apoiar em updated_at: a importação grava
  // 2000 concluídas de uma vez, todas com updated_at = hoje
  const hd = fs13.readFileSync('src/features/home/data.ts', 'utf8');
  const bloco = hd.split('useHistoricoAmplo')[2] ?? hd.split('useHistoricoAmplo')[1] ?? '';
  eq('o histórico filtra pela data de ENCERRAMENTO',
     /concluida_em\.gte\.\$\{desde\},fechada_em\.gte\.\$\{desde\}/.test(bloco), true);
  eq('o histórico não usa updated_at como corte (traria as 2000 importadas)',
     /gte\("updated_at", desde\)/.test(bloco), false);
  eq('o histórico tem teto explícito (resposta truncada mente sem avisar)',
     /\.limit\(2000\)/.test(bloco), true);

  // ── a tabela ────────────────────────────────────────────────────────────
  const tab = fs13.readFileSync('src/features/home/TabelaAtividades.tsx', 'utf8');
  for (const [chave, titulo] of [
    ['cliente', 'Cliente'], ['titulo', 'Título'], ['responsavel', 'Responsável'],
    ['apoio', 'Apoio'], ['equipe', 'Equipe'], ['tipo', 'Tipo'],
    ['status', 'Status'], ['recebido', 'Recebido em'], ['prazo', 'Prazo'],
  ]) {
    eq(`a tabela tem a coluna ${titulo}`,
       new RegExp(`chave: "${chave}",\\s*titulo: "${titulo}"`).test(tab), true);
  }
  eq('"recebido" é a data de criação, como o Davi pediu',
     /case "recebido": return a\.criadoEm/.test(tab), true);
  eq('apoio = participantes MENOS o responsável',
     /participantes\.filter\(\(p\) => p !== a\.responsavelId\)/.test(tab), true);
  // o DESIGN_SYSTEM proíbe a página rolar de lado: a tabela rola dentro dela
  eq('a tabela rola dentro do próprio envelope', /overflowX: "auto"/.test(tab), true);
  eq('o cabeçalho gruda ao rolar', /position: "sticky", top: 0/.test(tab), true);
  eq('a ordenação anuncia o estado para leitor de tela', /aria-sort/.test(tab), true);
  eq('a Início usa a tabela na visão de lista', /<TabelaAtividades/.test(dash), true);

  // ── o painel redesenhado (sobre o print do Davi, 2026-08-21) ────────────
  const pn = fs13.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');
  const soCodigoPn = pn.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  eq('o painel ficou mais largo, sem furar o teto de 60%',
     /width: "min\(60vw, 880px\)"/.test(pn) && /maxWidth: "60vw"/.test(pn), true);
  // o print mostrava rótulo de 9,5px em cinza: obriga a aproximar do monitor
  eq('rótulo de campo tem 11px (era 9,5)', /fontSize: 11,\s*\n\s*letterSpacing/.test(pn), true);
  eq('valor de campo tem 14px (era 13)', /fontSize: 14, fontWeight: 500/.test(pn), true);
  eq('campo tem altura de toque (44px)', /minHeight: 44/.test(pn), true);
  // coloração estratégica: o MESMO vocabulário dos cards do quadro
  eq('o painel usa as cores de status/tipo/prioridade do sistema',
     /TIPO_CORES/.test(pn) && /PRIORIDADE_CORES/.test(pn) && /chamadoStatusInfo/.test(pn), true);
  eq('estado e urgência viram etiqueta colorida no cabeçalho',
     /<Etiqueta[\s\S]{0,400}info\.label/.test(pn), true);
  eq('o título é o cabeçalho, não um campo rotulado',
     /fontSize: 22, fontWeight: 700/.test(pn), true);
  // dez campos soltos são uma lista; grupos são um mapa. "Detalhe" (a seção
  // só da descrição) saiu na 2ª revisão (2026-08-22): a descrição virou o
  // 2º CAMPO dentro do fluxo De quem é → Descrição → Classificação, sem
  // título de seção próprio — é o que o Davi pediu ("segundo campo deve ser
  // a descrição", não "crie uma seção Detalhe").
  for (const s of ['De quem é', 'Classificação', 'Quando']) {
    eq(`o painel agrupa em seção "${s}"`, new RegExp(`<Secao titulo="${s}"`).test(pn), true);
  }
  eq('atrasado se anuncia no campo de prazo',
     /atrasado \? est\.vermelho/.test(soCodigoPn), true);

  // ── o calendário: sem rolagem por dia, só os títulos ────────────────────
  const cal = fs13.readFileSync('src/routes/_authenticated/calendario.tsx', 'utf8');
  eq('a célula do dia NÃO rola por dentro',
     /overflowY: "auto"/.test(cal), false);
  eq('a linha do calendário cresce com o dia mais cheio',
     /gridAutoRows: "minmax\(120px, auto\)"/.test(cal), true);
  eq('a grade cresce mas não encolhe (flex 1 0 auto)',
     /flex: "1 0 auto"/.test(cal), true);
  // altura fixa faria a grade transbordar agora que a linha cresce
  eq('o contêiner do calendário usa PISO de altura, não teto',
     /minHeight: "calc\(100dvh - 96px\)"/.test(cal) && !/height: "calc\(100dvh/.test(cal), true);
  // o Davi pediu só os títulos na célula
  eq('a célula não mostra hora nem "vence" como texto',
     /vence<\/|Flag size|Clock size/.test(cal), false);
  eq('mas a hora continua no title do navegador (a informação não sumiu)',
     /title=\{`\$\{e\.titulo\}\$\{e\.porPrazo/.test(cal), true);
  eq('o rosto do responsável continua na célula', /AvatarPilha/.test(cal), true);
}

// ── U34: Prospecção vira aba + campo com busca (R38/R39, 2026-08-21) ───────
{
  const fs14 = require('fs');
  const ger = fs14.readFileSync('src/routes/_authenticated/gerencial.tsx', 'utf8');
  const pros = fs14.readFileSync('src/routes/_authenticated/prospeccao.tsx', 'utf8');
  const nav = fs14.readFileSync('src/components/nav-itens.ts', 'utf8');

  // R38 pôs a Prospecção como ABA do Comercial; a R64 tirou a aba (o Davi
  // pediu o painel como lista ÚNICA do ciclo). O que sobrevive da R38 é o
  // princípio: prospeccao fora do menu, /prospeccao só redirect.
  eq('Prospecção saiu do menu lateral', /prospeccao/.test(nav), false);
  eq('/prospeccao redireciona para o Painel Comercial (sem aba — R64)',
     /redirect\(\{ to: "\/gerencial" \}\)/.test(pros), true);
  eq('o redirect não renderiza conteúdo próprio',
     /useProspeccoes|ListaProspeccao/.test(pros), false);
  // R64: o Comercial não tem MAIS abas — nem prospeccao, nem "visitas e
  // propostas". Aba única é botão para lugar nenhum, e a lista é uma só.
  eq('R64: o Comercial não tem mais abas (nem validateSearch de aba)',
     /aba: "prospeccao"|AbaComercial|validateSearch/.test(ger), false);
  eq('R64: a lista de prospecção saiu da interface (componente apagado; a tabela continua no banco)',
     fs14.existsSync('src/features/prospeccao/ListaProspeccao.tsx'), false);

  // a U34 apaga a linha órfã, e o acesso não muda de valor
  const u34 = fs14.readFileSync('supabase/migrations/20260821220000_u34_prospeccao_vira_aba.sql', 'utf8');
  eq('U34 apaga as linhas de prospeccao',
     /DELETE FROM public\.permissoes_tela WHERE tela = 'prospeccao'/.test(u34), true);
  eq('U34 termina com SELECT de verificação', /SELECT '.*esperado/.test(u34), true);

  // ── R39: campo com busca nas listas LONGAS ──────────────────────────────
  const cb = fs14.readFileSync('src/components/CampoComBusca.tsx', 'utf8');
  const pn2 = fs14.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');

  eq('o campo com busca é um combobox de verdade (ARIA)',
     /role="combobox"/.test(cb) && /role="listbox"/.test(cb) && /role="option"/.test(cb), true);
  eq('navega por teclado (setas, Enter, Esc)',
     /ArrowDown/.test(cb) && /"Enter"/.test(cb) && /"Escape"/.test(cb), true);
  // quem digita "vila" quer "Vila Lagos" no topo, não "Alto da Vila"
  eq('começa-com vem antes de contém na ordenação',
     /startsWith\(t\)\) comeca\.push/.test(cb), true);
  // o blur do input dispara ANTES do click e levaria a escolha embora
  eq('a escolha usa mousedown, não click (o blur mataria o click)',
     /onMouseDown=\{\(e\) => \{ e\.preventDefault\(\); escolher\(o\); \}\}/.test(cb), true);
  eq('fecha ao clicar fora', /addEventListener\("mousedown", fora\)/.test(cb), true);
  eq('a busca ignora acento (usa a normalização da casa)',
     /normalizarTexto/.test(cb), true);

  // onde ele entra e onde NÃO entra
  for (const campo of ['painel-cliente', 'painel-responsavel', 'painel-apoio']) {
    eq(`${campo} usa o campo com busca`, new RegExp(`id="${campo}"`).test(pn2), true);
  }
  // lista de 4 opções não ganha busca: digitar para escolher entre "Baixa,
  // Normal, Alta, Urgente" é trocar um clique por clique mais digitação
  eq('prioridade continua select (lista curta não precisa de busca)',
     /titulo="Prioridade"[\s\S]{0,300}PRIORIDADE_LABEL\[p\]/.test(pn2), true);
  eq('status continua select', /<Escolha\s+titulo="Status"/.test(pn2), true);
}

// ── U35: o sprint sai do prazo (R40, 2026-08-21) ───────────────────────────
{
  const fs15 = require('fs');
  const CS = carregar('src/lib/chamado-status.ts');
  const IMP2 = carregar('src/features/chamados/importar-notion.ts');

  // quarta-feira, 19 de agosto de 2026 (a semana começa na segunda, dia 17)
  const qua = new Date(2026, 7, 19);
  const sp = (aaaa, mm, dd) => CS.sprintDoPrazo(new Date(aaaa, mm - 1, dd, 23, 59).toISOString(), qua);

  eq('o vocabulário ganhou os dois baldes semanais',
     CS.SPRINT_ORDEM.slice(0, 2), ['essa_semana', 'semana_que_vem']);
  eq('todo balde tem rótulo',
     CS.SPRINT_ORDEM.every((s) => !!CS.SPRINT_LABEL[s]), true);

  eq('hoje é essa semana', sp(2026, 8, 19), 'essa_semana');
  eq('sexta desta semana é essa semana', sp(2026, 8, 21), 'essa_semana');
  eq('domingo fecha a semana (a semana começa na segunda)', sp(2026, 8, 23), 'essa_semana');
  eq('segunda seguinte já é semana que vem', sp(2026, 8, 24), 'semana_que_vem');
  eq('domingo da outra semana ainda é semana que vem', sp(2026, 8, 30), 'semana_que_vem');
  // o balde mais ESTREITO ganha: dia 31 é deste mês, mas nem esta nem a
  // próxima semana — então "este mês"
  eq('fim do mês, além de duas semanas, é este mês', sp(2026, 8, 31), 'este_mes');
  eq('setembro é mês que vem', sp(2026, 9, 15), 'mes_que_vem');
  eq('outubro em diante é backlog', sp(2026, 10, 2), 'backlog');
  // vencido é trabalho para AGORA — mandá-lo para "mês passado" o esconderia
  eq('prazo vencido cai em essa semana, não no passado', sp(2026, 7, 10), 'essa_semana');
  eq('sem prazo não inventa balde', CS.sprintDoPrazo(null, qua), null);
  eq('data inválida não inventa balde', CS.sprintDoPrazo('nao-e-data', qua), null);

  // a meta do mês tem que seguir a partição, senão despenca sem nada mudar
  eq('os três baldes do mês', CS.SPRINTS_DO_MES, ['essa_semana', 'semana_que_vem', 'este_mes']);
  const MET = carregar('src/features/home/metricas.ts');
  const agosto = new Date(2026, 7, 21);
  const tarefa = (sprint) => ({
    natureza: 'interno', sprint, coluna: 'aberto', emAberto: true, encerradoEm: null,
  });
  eq('meta do mês inclui "essa semana" (era o defeito da partição)',
     MET.metaDoMes([tarefa('essa_semana')], agosto).total, 1);
  eq('meta do mês inclui "semana que vem"',
     MET.metaDoMes([tarefa('semana_que_vem')], agosto).total, 1);
  eq('meta do mês NÃO inclui "mês que vem"',
     MET.metaDoMes([tarefa('mes_que_vem')], agosto).total, 0);
  eq('meta do mês NÃO inclui backlog',
     MET.metaDoMes([tarefa('backlog')], agosto).total, 0);

  // o importador: etiqueta do Notion primeiro, derivação depois, e NUNCA
  // derivar em coisa encerrada (jogaria arquivo de 2025 em "essa semana")
  eq('importador: a etiqueta do Notion vence',
     IMP2.sprintDaLinha('Mês que vem', 'aberto', new Date(2026, 7, 19).toISOString(), qua),
     'mes_que_vem');
  eq('importador: sem etiqueta, deriva do prazo',
     IMP2.sprintDaLinha('', 'aberto', new Date(2026, 7, 19, 23, 59).toISOString(), qua),
     'essa_semana');
  eq('importador: concluído NÃO deriva (arquivo não é "essa semana")',
     IMP2.sprintDaLinha('', 'concluido', new Date(2025, 4, 10).toISOString(), qua), 'backlog');
  eq('importador: sem etiqueta e sem prazo vai para backlog',
     IMP2.sprintDaLinha('', 'aberto', null, qua), 'backlog');
  eq('importador: "Essa Semana" do Notion tem balde próprio agora',
     IMP2.SPRINT_NOTION['essa semana'], 'essa_semana');

  // a tela grava prazo e sprint no MESMO patch: dois patches poderiam deixar
  // o prazo novo com o sprint velho se o segundo falhasse
  const pn3 = fs15.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');
  eq('o painel deriva o sprint ao mudar o prazo', /sprintDoPrazo\(prazo\)/.test(pn3), true);
  eq('prazo e sprint vão no mesmo patch',
     /patch: sprint \? \{ prazo_limite: prazo, sprint \}/.test(pn3), true);

  // o banco precisa aceitar os valores novos, senão toda troca de data volta
  // com erro de constraint na cara do usuário
  const u35 = fs15.readFileSync('supabase/migrations/20260821230000_u35_sprint_semanal.sql', 'utf8');
  for (const v of ['essa_semana', 'semana_que_vem', 'este_mes', 'mes_que_vem', 'mes_passado', 'backlog']) {
    eq(`U35: o CHECK aceita '${v}'`,
       new RegExp(`'${v}'`).test(u35.split('ADD CONSTRAINT')[1] ?? ''), true);
  }
  eq('U35 termina com SELECT de verificação', /SELECT '.*esperado/.test(u35), true);
}

// ── U36: serviço prestado por cliente (R41, 2026-08-22) ────────────────────
{
  const fs16 = require('fs');
  const CD = carregar('src/features/clientes/data.ts');
  const u36 = fs16.readFileSync('supabase/migrations/20260822000000_u36_servicos_prestados.sql', 'utf8');
  const pag = fs16.readFileSync('src/routes/_authenticated/clientes.tsx', 'utf8');
  const det = fs16.readFileSync('src/routes/_authenticated/clientes.$id.tsx', 'utf8');

  eq('os dois serviços, na ordem', CD.SERVICO_ORDEM, ['portaria_remota', 'monitoramento_alarmes']);
  eq('todo serviço tem rótulo e cor',
     CD.SERVICO_ORDEM.every((s) => !!CD.SERVICO_LABEL[s] && !!CD.SERVICO_CORES[s]), true);
  eq('o rótulo é o que o Davi escreveu', CD.SERVICO_LABEL.portaria_remota, 'Portaria Remota');

  // é CONJUNTO: o mesmo prédio pode ter os dois
  eq('temServico acha o serviço na lista',
     CD.temServico({ servicos_prestados: ['portaria_remota'] }, 'portaria_remota'), true);
  eq('temServico com os DOIS serviços',
     [CD.temServico({ servicos_prestados: ['portaria_remota', 'monitoramento_alarmes'] }, 'portaria_remota'),
      CD.temServico({ servicos_prestados: ['portaria_remota', 'monitoramento_alarmes'] }, 'monitoramento_alarmes')],
     [true, true]);
  // cliente antigo (antes da migration) não pode explodir a tela
  eq('temServico tolera coluna ausente', CD.temServico({}, 'portaria_remota'), false);
  eq('temServico tolera null', CD.temServico({ servicos_prestados: null }, 'portaria_remota'), false);
  eq('a consulta traz a coluna nova',
     /servicos_prestados/.test(fs16.readFileSync('src/features/clientes/data.ts', 'utf8')
       .split('const CAMPOS')[1] ?? ''), true);

  // ── a migration ─────────────────────────────────────────────────────────
  eq('U36 cria a coluna como conjunto (array), não valor único',
     /ADD COLUMN IF NOT EXISTS servicos_prestados text\[\]/.test(u36), true);
  eq('U36 tranca o vocabulário com <@ (contido em)',
     /servicos_prestados <@ ARRAY\['portaria_remota', 'monitoramento_alarmes'\]/.test(u36), true);
  eq('U36 indexa para o filtro não varrer a tabela', /USING GIN \(servicos_prestados\)/.test(u36), true);
  // rodar duas vezes não pode duplicar o serviço dentro do array
  eq('U36 só acrescenta se ainda não estiver lá',
     /NOT \('portaria_remota' = ANY \(c\.servicos_prestados\)\)/.test(u36), true);
  eq('U36 tem pré-voo dos que não casam', /PRÉ-VOO/.test(u36), true);
  eq('U36 termina com SELECT de verificação', /esperado 29/.test(u36), true);

  // OS 29 — conferidos contra a base real do QAP (a da U24), pelo CNPJ.
  // Quatro deles têm nome diferente lá ("Villa Lagos" é "Vila Lagos"), e é
  // por isso que o de-para é por documento: casar por nome perderia os quatro
  // em silêncio.
  {
    const norm = (t) => (t || '').toLowerCase()
      .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/\s+/g, ' ').trim();
    const dig = (t) => (t || '').replace(/\D/g, '');
    const u24 = fs16.readFileSync('supabase/migrations/20260820150000_u24_base_clientes.sql', 'utf8');
    const ini = u24.indexOf('INSERT INTO _planilha_u24');
    const base = [...u24.slice(ini, u24.indexOf(';', ini))
      .matchAll(/\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/g)]
      .map((m) => ({ nome: m[1].replace(/''/g, "'"), doc: m[2] }));
    const porDoc = new Set(base.map((b) => dig(b.doc)).filter((d) => d.length >= 11));
    const porNome = new Set(base.map((b) => norm(b.nome)));

    const bloco = u36.slice(u36.indexOf('INSERT INTO _portaria_u36'), u36.indexOf('CREATE OR REPLACE FUNCTION pg_temp.norm_u36'));
    const lista = [...bloco.matchAll(/\(\s*'((?:[^']|'')*)'\s*,\s*(NULL|'[^']*')\)/g)]
      .map((m) => ({ nome: m[1].replace(/''/g, "'"), cnpj: m[2] === 'NULL' ? '' : m[2].slice(1, -1) }));

    eq('U36 lista os 29 da portaria remota', lista.length, 29);
    const orfaos = lista.filter((p) => !(p.cnpj && porDoc.has(dig(p.cnpj))) && !porNome.has(norm(p.nome)));
    eq('todos os 29 têm correspondente na base do QAP', orfaos.map((o) => o.nome), []);
    // o valor real do CNPJ: quatro casam SÓ por documento
    const soPorDoc = lista.filter((p) => p.cnpj && porDoc.has(dig(p.cnpj)) && !porNome.has(norm(p.nome)));
    eq('quatro só casam por CNPJ (nome divergente na base)', soPorDoc.length, 4);
  }

  // ── a tela ──────────────────────────────────────────────────────────────
  // serviço e situação são EIXOS que se combinam: um cliente é ativo E tem
  // portaria. Um seletor só obrigaria a escolher entre as duas perguntas.
  eq('o filtro de serviço é independente do de situação',
     /servico !== "todos" && !temServico\(c, servico\)/.test(pag)
     && /filtro !== "todos" && c\.situacao !== filtro/.test(pag), true);
  eq('a página tem o filtro Portaria Remota', /SERVICO_LABEL\[s\]/.test(pag), true);
  // chip que promete 192 e entrega 29 é chip que mente
  eq('as contagens de um eixo respeitam o filtro do outro',
     /porServico\.filter\(\(c\) => c\.situacao === "ativo"\)/.test(pag)
     && /porSituacao\.filter\(\(c\) => temServico/.test(pag), true);
  eq('a linha do cliente mostra os serviços dele',
     /SERVICO_ORDEM\.filter\(\(s\) => temServico\(c, s\)\)/.test(pag), true);
  // sem edição, a propriedade ficaria congelada nos 29 da migration
  eq('o detalhe do cliente permite ligar e desligar o serviço',
     /salvar\.mutate\(\{ servicos_prestados: novos \}\)/.test(det), true);
  eq('a gravação manda o array inteiro (estado completo, não incremento)',
     /const novos = tem[\s\S]{0,120}\[\.\.\.atuais, s\]/.test(det), true);
}

// ── Achados da revisão adversarial da U33 (2026-08-22) ─────────────────────
// Cinco agentes independentes acharam a mesma raiz crítica e mais quatro
// defeitos médios. Cada um vira asserção aqui — achado corrigido sem trava é
// achado que volta.
{
  const fs17 = require('fs');
  const hd2 = fs17.readFileSync('src/features/home/data.ts', 'utf8');
  const tab2 = fs17.readFileSync('src/features/home/TabelaAtividades.tsx', 'utf8');

  // 1. A PROPOSTA CONTAVA DOBRADO. Desde a U29 a visita tem um chamado-capa
  //    com o MESMO id do banco — mas as Atividades saem com ids diferentes
  //    (`vis-x` e `ch-x`), então nenhuma dedup por id os junta. A proposta
  //    aparecia duas vezes no quadro e contava duas vezes na barra.
  //    (Defeito ANTERIOR à U33; a revisão o encontrou no rastro dela.)
  eq('a Home não traz a capa da proposta (a visita já a representa)',
     /\.neq\("natureza", "comercial"\)/.test(hd2.split('useChamadosDaHome')[1] ?? ''), true);
  eq('o histórico também não traz a capa (barra contaria dobrado)',
     (hd2.match(/\.neq\("natureza", "comercial"\)/g) ?? []).length, 2);
  // e a proposta CONTINUA no quadro pela visita, como a R29 exige
  const mod2 = fs17.readFileSync('src/features/atividades/modelo.ts', 'utf8');
  eq('a proposta segue no quadro pela visita, com número da capa (R29)',
     /numero: v\.chamado\?\.numero/.test(mod2), true);

  // 2. O CABEÇALHO STICKY NÃO GRUDAVA. `overflow-x: auto` + `overflow-y:
  //    visible` resolve para `auto` e cria um contêiner de rolagem de altura
  //    automática; o sticky gruda NELE, que nunca rola.
  eq('o envelope da tabela não cria contêiner de rolagem vertical',
     /overflowY: "clip"/.test(tab2) && !/overflowY: "visible"/.test(tab2), true);

  // 3. A LINHA NÃO ERA OPERÁVEL POR TECLADO — ela substituiu um <button>.
  eq('a linha da tabela é focável e aciona por teclado',
     /tabIndex=\{0\}/.test(tab2) && /e\.key === "Enter" \|\| e\.key === " "/.test(tab2), true);

  // 4. PRAZO EM VERMELHO SOBRE UM TRAÇO. A visita não tem `prazoLimite` mas
  //    tem `prazoEstourado` — pintava alarme sobre nada.
  eq('a coluna Prazo só colore quando existe data',
     /a\.prazoEstourado && \(a\.prazoLimite \|\| a\.agendadaEm\)/.test(tab2), true);
  eq('e a visita mostra a data agendada, que é o prazo dela',
     /dataCurta\(a\.prazoLimite \?\? a\.agendadaEm\)/.test(tab2), true);
}

// ── R42: ordenar as atividades na Início (2026-08-22) ──────────────────────
{
  const fs18 = require('fs');
  const LN2 = carregar('src/features/home/lentes.ts');
  const dash2 = fs18.readFileSync('src/routes/_authenticated/dashboard.tsx', 'utf8');

  // U72 (R88): eram 3 chaves sem direção. Davi, 2026-08-26: "o botão de
  // ordenar deve ser mais bem montado — Prazo Crescente / Decrescente ;
  // Cliente ; Prioridade ; Data de recebimento Crescente / Decrescente."
  // "recentes" entrou no menu como a data de RECEBIMENTO, que é o que ela
  // sempre foi; "atualizacao" continua fora, é ordem só dos presets.
  eq('as 6 ordenações que o Davi pode escolher, nesta ordem',
     LN2.ORDENACOES.map((o) => o.valor),
     ['prazo:asc', 'prazo:desc', 'local', 'prioridade', 'recebimento:asc', 'recebimento:desc']);
  eq('"atualização" fica de fora do seletor (é só dos presets)',
     LN2.ORDENACOES.some((o) => o.chave === 'atualizacao'), false);
  eq('toda opção do menu tem nota — "crescente" sozinho não diz crescente EM QUÊ',
     LN2.ORDENACOES.every((o) => !!o.nota), true);
  eq('lerOrdenacao separa chave e direção',
     LN2.lerOrdenacao('prazo:desc'), { chave: 'prazo', desc: true });
  eq('CRÍTICO: lerOrdenacao tolera a chave crua do sessionStorage antigo — senão a primeira visita após o deploy abre sem ordenação',
     LN2.lerOrdenacao('prazo'), { chave: 'prazo', desc: false });
  eq('valor desconhecido não vira ordenação inventada', LN2.lerOrdenacao('xpto'), null);

  const at2 = (extra) => ({
    id: 'x' + Math.random(), titulo: 'a', numero: null, cliente: null,
    criadoEm: '2026-08-01T10:00:00', ...extra,
  });
  eq('cliente ordena por nome, alfabético',
     LN2.ordenar([at2({ cliente: 'Zebra' }), at2({ cliente: 'Amarilis' })], 'cliente')
       .map((a) => a.cliente), ['Amarilis', 'Zebra']);
  eq('sem cliente vai para o fim (não para o topo do alfabeto)',
     LN2.ordenar([at2({ cliente: null }), at2({ cliente: 'Amarilis' })], 'cliente')
       .map((a) => a.cliente), ['Amarilis', null]);
  eq('"recentes" continua funcionando (era o comportamento implícito de sempre)',
     LN2.ordenar([at2({ criadoEm: '2026-08-01T10:00:00' }), at2({ criadoEm: '2026-08-10T10:00:00' })], 'recentes')
       .map((a) => a.criadoEm), ['2026-08-10T10:00:00', '2026-08-01T10:00:00']);

  eq('Filtros tem o campo ordenacao, começando null (segue o padrão)',
     LN2.FILTROS_INICIAIS.ordenacao, null);
  eq('a escolha manual VENCE a ordem do preset',
     /lerOrdenacao\(filtros\.ordenacao\) \?\? \{ chave: ordemDoPreset\(filtros\.preset\), desc: false \}/.test(dash2), true);
  eq('CRÍTICO (R88): o preset não passa direção — a direção NATURAL de cada chave é preservada, senão "Sem dono" inverteria calado',
     /ordenar\(aplicarLentes\([\s\S]{0,140}ordem\.chave, ordem\.desc\)/.test(dash2), true);
  eq('trocar de padrão zera a ordenação escolhida (senão ela vazaria para o próximo)',
     /preset: v\[0\] \?\? null,[\s\S]{0,600}ordenacao: null,/.test(dash2), true);
  eq('o seletor de ordenação está na barra de filtros', /rotulo="Ordenar"/.test(dash2), true);
}

// ── R43: tabela — margens, sem sigla no título, foto+nome (2026-08-22) ─────
{
  const fs19 = require('fs');
  const tab3 = fs19.readFileSync('src/features/home/TabelaAtividades.tsx', 'utf8');
  const dash3 = fs19.readFileSync('src/routes/_authenticated/dashboard.tsx', 'utf8');

  // a tabela ocupa a tela inteira, como o quadro já ocupava
  eq('a visão de tabela usa a MESMA sangria do quadro (sangra-x)',
     /<div className="sangra-x">[\s\S]{0,300}<TabelaAtividades/.test(dash3), true);

  // sigla fora da vista, mas não perdida
  eq('o número CH- não aparece mais como texto visível na célula',
     /\{a\.numero &&/.test(tab3), false);
  eq('mas continua acessível pelo tooltip (hover)',
     /title=\{a\.numero \? `\$\{a\.numero\} — \$\{a\.titulo\}` : a\.titulo\}/.test(tab3), true);

  // foto ao lado do nome, nas duas colunas — e pela mesma cor de sempre.
  // PessoaComFoto foi para um arquivo COMPARTILHADO na U40 (o painel de
  // propriedades passou a precisar do mesmo par) — a checagem de definição
  // migrou para lá, e aqui só confere que a tabela IMPORTA de lá, não que
  // define a própria cópia.
  eq('TabelaAtividades importa PessoaComFoto do local compartilhado',
     /import \{ PessoaComFoto \} from "@\/components\/PessoaComFoto"/.test(tab3), true);
  eq('Responsável usa foto+nome', /<PessoaComFoto id=\{a\.responsavelId\}/.test(tab3), true);
  eq('Apoio usa foto+nome para cada pessoa (não só a pilha de círculos)',
     /apoios\.map\(\(id\) => \(\s*<PessoaComFoto key=\{id\}/.test(tab3), true);
  const pessoaComFotoSrc = fs19.readFileSync('src/components/PessoaComFoto.tsx', 'utf8');
  eq('a cor do avatar usa o ID (hash estável), não o nome',
     /degradeAvatar\(id\)/.test(pessoaComFotoSrc) && !/degradeAvatar\(nome\)/.test(pessoaComFotoSrc), true);
}

// ── R44: calendário — filtros no design system (2026-08-22) ────────────────
{
  const fs20 = require('fs');
  const cal2 = fs20.readFileSync('src/routes/_authenticated/calendario.tsx', 'utf8');

  eq('o calendário usa o MenuFiltro do resto do app, não <select> nativo',
     /<MenuFiltro[\s\S]{0,120}rotulo="Pessoa"/.test(cal2)
     && /<MenuFiltro[\s\S]{0,200}rotulo="Tipo"/.test(cal2), true);
  eq('nenhum <select> sobrou nos filtros de pessoa/tipo',
     /<select style=\{seletor\}/.test(cal2), false);
  // "visita" não é um ChamadoTipo — sem o fallback, o filtro mostraria a
  // string crua em vez de rótulo nenhum
  eq('tipo sem rótulo central ganha um fallback legível, não a string crua sem tratamento',
     /TIPO_LABEL\[t as keyof typeof TIPO_LABEL\] \?\?/.test(cal2), true);
}

// ── R38: o fluxo da proposta acaba no envio (2026-08-22) ────────────────────
{
  const fs21 = require('fs');
  const M3 = carregar('src/features/atividades/modelo.ts');

  const visita = (extra) => ({
    id: 'v1', status: 'aprovada', titulo: null, nome_predio: 'Condomínio Merit',
    tecnico_id: 't1', data_hora_agendada: null, created_at: '2026-06-01T10:00:00',
    proposta_enviada_em: null, proposta_resultado: null,
    clientes: null, chamado: null, prioridade: null,
    ...extra,
  });
  const ctxV = { userId: 't1', apoios: new Set(), fichas: new Map(), apoiosDoChamado: undefined };

  // ── colunaDaVisita: enviada JÁ é concluído — não existe mais "com o cliente" ─
  eq('aprovada + enviada, sem resultado: concluído (era o defeito do print)',
     M3.colunaDaVisita(visita({ proposta_enviada_em: '2026-08-20T10:00:00' })).coluna, 'concluido');
  eq('e sem bola de "com o cliente" (essa ideia não existe mais)',
     M3.colunaDaVisita(visita({ proposta_enviada_em: '2026-08-20T10:00:00' })).bolaCom, null);
  eq('aprovada, ainda não enviada: continua "falta enviar"',
     M3.colunaDaVisita(visita({})).rotuloNativo, 'Aprovada — falta enviar proposta');
  eq('histórico: recusada registrada ANTES da mudança ainda vira cancelado',
     M3.colunaDaVisita(visita({ proposta_enviada_em: '2026-08-01T10:00:00', proposta_resultado: 'recusada' })).coluna,
     'cancelado');
  eq('histórico: aceita registrada antes também é concluído (mesmo destino)',
     M3.colunaDaVisita(visita({ proposta_enviada_em: '2026-08-01T10:00:00', proposta_resultado: 'aceita' })).coluna,
     'concluido');

  // ── atividadeDaVisita: título fixo, local no lugar de cliente, sem prioridade ─
  const a1 = M3.atividadeDaVisita(visita({
    proposta_enviada_em: '2026-08-20T10:00:00',
    clientes: { nome: 'Um Cliente Real Ltda' },
  }), ctxV);
  eq('título é SEMPRE "Proposta Comercial", nunca o nome do prédio', a1.titulo, 'Proposta Comercial');
  eq('a etiqueta de local usa nome_predio MESMO quando há cliente vinculado (R23)',
     a1.cliente, 'Condomínio Merit');
  eq('sem prédio nem título, cai no cliente como último recurso',
     M3.atividadeDaVisita(visita({ nome_predio: null, titulo: null, clientes: { nome: 'X' } }), ctxV).cliente,
     'X');
  eq('prioridade não aparece mais no card da proposta (Davi: "por enquanto não aplicamos")',
     [a1.prioridade, a1.prioridadeLabel, a1.prioridadeCor], [null, null, null]);
  eq('mas o rank cai pro mais frio, não pro mais quente (a fila é por data, não por urgência)',
     a1.prioridadeRank, 4);
  eq('emAberto vira false assim que enviada (some da tela "abertos" na hora)',
     a1.emAberto, false);

  // encerradoEm: o desfecho de verdade agora é o ENVIO, não a criação da visita
  eq('encerradoEm usa a data do ENVIO (não a de criação, que pode ser de meses atrás)',
     a1.encerradoEm, '2026-08-20T10:00:00');
  const aHistorica = M3.atividadeDaVisita(visita({
    proposta_enviada_em: '2026-08-01T10:00:00', proposta_resultado: 'aceita',
  }), ctxV);
  eq('sem data própria de resultado, cai para a data do envio',
     aHistorica.encerradoEm, '2026-08-01T10:00:00');
  const aHistoricaComData = M3.atividadeDaVisita({
    ...visita({ proposta_enviada_em: '2026-08-01T10:00:00', proposta_resultado: 'aceita' }),
    proposta_resultado_em: '2026-08-05T10:00:00',
  }, ctxV);
  eq('mas quando proposta_resultado_em EXISTE (histórico), ela vence — é a data mais precisa',
     aHistoricaComData.encerradoEm, '2026-08-05T10:00:00');

  // ── a tela da visita: sem os dois botões, sem o formulário de recusa ────
  const vt = fs21.readFileSync('src/routes/_authenticated/visita.$id.tsx', 'utf8');
  eq('sem o botão "O cliente ACEITOU"', /O cliente ACEITOU/.test(vt), false);
  eq('sem o botão "O cliente RECUSOU"', /O cliente RECUSOU/.test(vt), false);
  eq('sem o formulário de motivo de recusa', /showRecusaForm|motivoRecusa/.test(vt), false);
  // só linhas de código: o comentário que expliquei acima MENCIONA a RPC de
  // propósito (para dizer por que ela continua no banco) — filtrar por isso,
  // senão o próprio comentário derruba a asserção
  const vtCodigo = vt.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  eq('a RPC de resultado não é mais CHAMADA por nenhum botão (só citada em comentário)',
     /responderCliente\.mutate|\.rpc\("registrar_resultado_proposta"/.test(vtCodigo), false);
  eq('CheckCircle2 saiu dos imports (só era usado no botão removido)',
     /CheckCircle2/.test(vt), false);
  eq('gerar implantação fica disponível ao ENVIAR, não mais preso ao aceite',
     /\{propostaEnviada && \(\s*<button\s*\n\s*onClick=\{\(\) => gerarImplantacao\.mutate\(\)\}/.test(vt), true);
  eq('o histórico de aceita/recusada de visitas antigas continua exibido (não apagamos leitura)',
     /resultadoProposta === "recusada"/.test(vt) && /resultadoProposta === "aceita"/.test(vt), true);

  // ── o card: sem a etiqueta "Visita técnica" ──────────────────────────────
  const ca = fs21.readFileSync('src/features/home/CardAtividade.tsx', 'utf8');
  eq('a etiqueta "Visita técnica" saiu do card (redundante com o chip de tipo)',
     /a\.fonte === "visita" &&[\s\S]{0,80}Visita técnica/.test(ca), false);

  // ── a migration U38 ──────────────────────────────────────────────────────
  const u38 = fs21.readFileSync('supabase/migrations/20260822010000_u38_fim_do_fluxo_pos_envio.sql', 'utf8');
  eq('U38 não tem o typo que eu quase deixei passar (EEXCLUDED)',
     /EEXCLUDED/.test(u38), false);
  eq('U38: o título da capa é constante, não COALESCE com nome_predio',
     /'Proposta Comercial',\s*\n\s*NEW\.descricao_pedido/.test(u38), true);
  eq('U38: o trigger passa a escutar proposta_enviada_em (não só proposta_resultado)',
     /UPDATE OF status, proposta_resultado, proposta_enviada_em/.test(u38), true);
  eq('U38 faz o backfill de quem já estava preso no estado antigo',
     /UPDATE public\.chamados c\s*\n\s*SET status = 'concluido'/.test(u38), true);
  eq('U38 termina com SELECT de verificação', /SELECT '.*esperado 0/.test(u38), true);
}

// ── Paleta de status retificada + calendário redesenhado (2026-08-22) ──────
{
  const fs22 = require('fs');
  const PAL = carregar('src/lib/paleta.ts');
  const CS2 = carregar('src/lib/chamado-status.ts');

  // PRISMA.verde: formaliza o tom que 17+ arquivos já usavam à mão
  eq('PRISMA.verde existe e é o tom que o resto do app já usava (#2DD2A5/#047862)',
     [PAL.PRISMA.verde.dark, PAL.PRISMA.verde.light], ['#2DD2A5', '#047862']);

  // os 5 status nomeados pelo Davi, na cor que ele pediu — cada um checado
  // contra o hex de origem do PRISMA, não contra um valor solto: se alguém
  // mudar PRISMA.azul amanhã, o status tem que acompanhar sozinho
  const cor = (s) => CS2.chamadoStatusInfo(s).color;
  eq('AGUARDANDO INÍCIO (aberto) é AZUL', cor('aberto'), PAL.PRISMA.azul.dark);
  eq('agendado é da MESMA família de "aguardando início" (evita colidir com aguardando aprovação)',
     cor('agendado'), PAL.PRISMA.azul.dark);
  eq('EM ANDAMENTO é AMARELO (estava trocado com "aguardando início")',
     cor('em_andamento'), PAL.PRISMA.amarelo.dark);
  eq('STAND-BY é LARANJA', cor('stand_by'), PAL.PRISMA.laranja.dark);
  eq('AGUARDANDO APROVAÇÃO é AZUL CLARO (estava pêssego, uma 6ª cor sem nome)',
     cor('aguardando_aprovacao'), PAL.PRISMA.azulClaro.dark);
  eq('CONCLUÍDO é VERDE (estava um azul escuro)', cor('concluido'), PAL.PRISMA.verde.dark);
  eq('cancelado continua neutro — não é um dos 5 nomeados, é a saída do fluxo',
     cor('cancelado'), PAL.PRISMA.neutro.dark);
  // os 5 nomeados não podem colidir em cor entre si (cada um tem que ser
  // reconhecível sozinho, que é o motivo de existir uma paleta de status)
  const cincoNomeados = ['aberto', 'em_andamento', 'stand_by', 'aguardando_aprovacao', 'concluido'];
  eq('os 5 status nomeados têm 5 cores DISTINTAS entre si',
     new Set(cincoNomeados.map(cor)).size, 5);

  // ── o calendário ──────────────────────────────────────────────────────
  const cal3 = fs22.readFileSync('src/routes/_authenticated/calendario.tsx', 'utf8');

  // O BUG: tiposPresentes nascia do array JÁ filtrado por pessoa, e a opção
  // "Tipo" desaparecia da tela quando a pessoa escolhida só tinha 1 tipo.
  eq('tiposPresentes vem de TODOS os eventos, não do conjunto filtrado por pessoa',
     /tiposPresentes = useMemo\(\s*\(\) => Array\.from\(new Set\(todosEventos\.map/.test(cal3), true);
  eq('e não mais do array `eventos` (o que causava o bug)',
     /tiposPresentes = useMemo\(\s*\(\) => Array\.from\(new Set\(eventos\.map/.test(cal3), false);
  eq('o filtro de pessoa/tipo aplica sobre a base COMPLETA (todosEventos)',
     /todosEventos\s*\.filter\(\(e\) => pessoaFiltro/.test(cal3), true);

  // visita usa o vocabulário DELA — chamadoStatusInfo(status de visita)
  // caía sempre no cinza de fallback (nenhuma chave bate)
  eq('eventos de visita usam getStatusInfo (o vocabulário da visita), não chamadoStatusInfo',
     /const info = getStatusInfoVisita\(v\.status\)/.test(cal3), true);

  // atrasado: regra geral (não só os "por prazo"), mas nunca sobre item final
  eq('atrasado considera tanto hora agendada quanto prazo, não só um dos dois',
     /const atrasado = !final && !!v\.data_hora_agendada/.test(cal3)
     && /const atrasado = !final && !!quando/.test(cal3), true);
  eq('mas nunca marca vermelho um item já concluído/cancelado só por estar no passado',
     /const final = c\.status === "concluido" \|\| c\.status === "cancelado"/.test(cal3), true);

  // fundo sólido, não véu translúcido (o "cinza muito claro" que o Davi viu)
  eq('a superfície do calendário é cor SÓLIDA no escuro, não rgba(255,255,255,...)',
     /const superficie = isLight \? "#ffffff" : "#101016"/.test(cal3), true);
  eq('nenhum véu translúcido de branco sobrou como fundo de célula',
     /background: doMes \? superficie : \(isLight \? "#fafafa" : "rgba\(255,255,255,0\.012\)"\)/.test(cal3),
     false);
}

// ── Painel de propriedades, 2ª revisão: De quem é / Descrição com
//    ferramentas / Classificação em linha única / Comentários (2026-08-22) ──
{
  const fs23 = require('fs');
  const ET = carregar('src/lib/edicao-texto.ts');

  // ── envolverSelecao (negrito/itálico) ────────────────────────────────────
  {
    const r = ET.envolverSelecao('o rato roeu a roupa', 2, 6, '**', 'negrito');
    eq('negrito envolve a seleção exata', r.valor, 'o **rato** roeu a roupa');
    eq('e a seleção cobre só o texto (sem os marcadores)',
       r.valor.slice(r.selecaoInicio, r.selecaoFim), 'rato');
  }
  {
    // sem seleção: insere com um exemplo JÁ selecionado, pronto pra sobrescrever
    const r = ET.envolverSelecao('', 0, 0, '**', 'negrito');
    eq('sem seleção, insere com o exemplo pré-selecionado', r.valor, '**negrito**');
    eq('e a seleção cobre exatamente o exemplo (não os marcadores)',
       r.valor.slice(r.selecaoInicio, r.selecaoFim), 'negrito');
  }
  {
    const r = ET.envolverSelecao('café', 0, 4, '*', 'itálico');
    eq('itálico usa um marcador só', r.valor, '*café*');
  }

  // ── prefixarLinhas (checklist/lista) ─────────────────────────────────────
  {
    // cursor no MEIO da única linha (nenhuma seleção) — prefixa essa linha
    const r = ET.prefixarLinhas('comprar cabo', 5, 5, '- [ ] ');
    eq('checklist com cursor no meio prefixa a linha inteira',
       r.valor, '- [ ] comprar cabo');
  }
  {
    // seleção cobrindo 2 das 3 linhas — só essas duas ganham prefixo
    const texto = 'linha1\nlinha2\nlinha3';
    const r = ET.prefixarLinhas(texto, 0, 13, '- '); // cobre linha1 e linha2
    eq('lista prefixa só as linhas TOCADAS pela seleção',
       r.valor, '- linha1\n- linha2\nlinha3');
  }
  {
    // idempotente: linha já prefixada não ganha o prefixo de novo
    const r = ET.prefixarLinhas('- [ ] já é item', 0, 0, '- [ ] ');
    eq('checklist não duplica o prefixo numa linha que já é item',
       r.valor, '- [ ] já é item');
  }
  {
    // cursor bem no INÍCIO da linha (nada digitado): depois de prefixar, o
    // cursor tem que ficar DEPOIS do prefixo novo, pronto pra escrever — não
    // preso antes do marcador
    const r = ET.prefixarLinhas('linha2', 0, 0, '- ');
    eq('cursor no início da linha fica DEPOIS do prefixo novo, não antes',
       r.selecaoInicio, 2);
    eq('e o valor ficou correto', r.valor, '- linha2');
  }
  {
    // a posição do cursor RELATIVA ao texto de verdade não pode mudar —
    // só a posição absoluta (deslocada pelo prefixo inserido)
    const antes = 'linha1\nlinha2\nlinha3';
    const cursorEmLinha2 = 10; // 3 caracteres dentro de "linha2" (após "lin")
    const r = ET.prefixarLinhas(antes, cursorEmLinha2, cursorEmLinha2, '- ');
    const novoInicioDaLinha2 = r.valor.indexOf('- linha2');
    eq('o cursor mantém a MESMA posição relativa dentro do texto original',
       r.selecaoInicio - (novoInicioDaLinha2 + '- '.length), cursorEmLinha2 - 7);
  }

  // ── troca de marcador, não empilhamento (achado da revisão adversarial
  //    de U40, 2026-08-21) ─────────────────────────────────────────────────
  {
    // o bug real: Lista, depois Checklist na MESMA linha, produzia
    // "- [ ] - item" em vez de converter para "- [ ] item"
    const r = ET.prefixarLinhas('- comprar cabo', 0, 0, '- [ ] ');
    eq('Lista → Checklist na mesma linha TROCA o marcador, não empilha',
       r.valor, '- [ ] comprar cabo');
  }
  {
    // a direção inversa já era protegida (checklist já começa com "- "), mas
    // agora também precisa ficar limpa (sem sobrar "[ ] " solto)
    const r = ET.prefixarLinhas('- [x] comprar cabo', 0, 0, '- ');
    eq('Checklist → Lista na mesma linha troca para "- ", sem sobrar "[x] "',
       r.valor, '- comprar cabo');
  }
  {
    // idempotência de sempre continua intacta: mesmo botão, mesma linha
    const r1 = ET.prefixarLinhas('- [ ] item', 0, 0, '- [ ] ');
    eq('Checklist duas vezes na mesma linha continua idempotente', r1.valor, '- [ ] item');
    const r2 = ET.prefixarLinhas('- item', 0, 0, '- ');
    eq('Lista duas vezes na mesma linha continua idempotente', r2.valor, '- item');
  }

  // ── checklist: leitura de linha (2026-08-21, checkbox de verdade na
  //    exibição — TextoComChecklist.tsx) ──────────────────────────────────
  eq('reconhece linha de checklist desmarcada', ET.ehLinhaChecklist('- [ ] comprar cabo'), true);
  eq('reconhece linha de checklist MARCADA', ET.ehLinhaChecklist('- [x] comprar cabo'), true);
  eq('maiúsculo também conta como marcado', ET.ehLinhaChecklist('- [X] comprar cabo'), true);
  eq('linha comum não é checklist', ET.ehLinhaChecklist('comprar cabo'), false);
  eq('item de lista simples ("- ") não é checklist', ET.ehLinhaChecklist('- comprar cabo'), false);

  eq('checklistMarcado lê [ ] como falso', ET.checklistMarcado('- [ ] item'), false);
  eq('checklistMarcado lê [x] como verdadeiro', ET.checklistMarcado('- [x] item'), true);

  eq('checklistTexto tira só o prefixo, preserva o resto',
     ET.checklistTexto('- [x] comprar 10 controles'), 'comprar 10 controles');

  eq('alternarLinhaChecklist: desmarcada vira marcada',
     ET.alternarLinhaChecklist('- [ ] item'), '- [x] item');
  eq('alternarLinhaChecklist: marcada vira desmarcada',
     ET.alternarLinhaChecklist('- [x] item'), '- [ ] item');
  eq('alternarLinhaChecklist não mexe no texto da linha, só no [ ]/[x]',
     ET.alternarLinhaChecklist('- [ ] comprar 10 controles remotos'),
     '- [x] comprar 10 controles remotos');

  // ── TextoComChecklist.tsx: o componente que usa as funções acima ────────
  const tcc = fs23.readFileSync('src/components/TextoComChecklist.tsx', 'utf8');
  eq('usa a classe checklist-check (o design do Uiverse em styles.css)',
     /className="checklist-check"/.test(tcc), true);
  eq('sem aoMudar, o checkbox fica disabled (só leitura)',
     /disabled=\{!aoMudar\}/.test(tcc), true);
  eq('clicar chama aoMudar com o TEXTO INTEIRO (não só a linha)',
     /aoMudar\(novasLinhas\.join\("\\n"\)\)/.test(tcc), true);

  const cssChecklist = fs23.readFileSync('src/styles.css', 'utf8');
  eq('o CSS do checkbox está em styles.css, com seletor de CLASSE (não #id — várias linhas na mesma tela)',
     /\.checklist-input:checked \+ \.checklist-check svg/.test(cssChecklist), true);

  // wired nas duas telas de detalhe: painel interno (editável) e campo (leitura)
  const di2 = fs23.readFileSync('src/features/chamados/DetalheInterno.tsx', 'utf8');
  eq('DetalheInterno usa TextoComChecklist na Descrição, com aoMudar (editável)',
     /<TextoComChecklist[\s\S]{0,120}aoMudar=\{podeEditar/.test(di2), true);
  const dc2 = fs23.readFileSync('src/features/chamados/DetalheCampo.tsx', 'utf8');
  eq('DetalheCampo usa TextoComChecklist no Problema relatado',
     /<TextoComChecklist texto=\{os\.descricao_problema\}/.test(dc2), true);

  // ── comentários do painel: avatar de quem comentou (2026-08-21) ─────────
  // (lido aqui via arquivo próprio: `pc4` só é declarado mais abaixo, no
  // bloco que trava os pedidos do painel)
  const pcAvatar = fs23.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');
  eq('o comentário mostra o AvatarCirculo de quem comentou (não um ícone genérico)',
     /c\.user_id \? \(\s*<AvatarCirculo\s*\n\s*id=\{c\.user_id\}/.test(pcAvatar), true);

  // ── a tela: os pedidos do Davi, cada um travado por asserção ────────────
  const pc4 = fs23.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');
  const soCodigoPc4 = pc4.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  // 1. sigla fora do título
  eq('o número do chamado não aparece mais como texto visível perto do título',
     /\{chamado\.numero\}/.test(soCodigoPc4), false);
  eq('mas continua no tooltip (title=) do bloco do título',
     /<div title=\{chamado\.numero \?\? undefined\}>/.test(pc4), true);

  // 2. De quem é: Cliente + Responsável + Apoio na MESMA grade
  // 3 colunas FIXAS (não auto-fit): a revisão adversarial de U40 achou que
  // auto-fit(180px) quebrava em 2+1 (Apoio órfão) numa faixa comum de
  // largura — fixo nunca quebra, o que "mesma linha" pedia de verdade.
  // U71: o campo "Cliente" virou "Local" (R84). A grade não mudou.
  eq('Local, Responsável e Apoio estão no MESMO grid de 3 colunas FIXAS',
     /gridTemplateColumns: "repeat\(3, minmax\(0, 1fr\)\)"[\s\S]{0,900}<Campo titulo="Local"[\s\S]{0,7000}<Campo titulo="Responsável"[\s\S]{0,900}<Campo titulo="Apoio"/.test(pc4),
     true);
  // R54/U45: Cliente virou chip-list (como Apoio) — o ícone agora mora
  // dentro de cada chip, não mais no iconeEsquerda de um CampoComBusca único
  eq('cada chip de cliente mostra um ícone (Building2) e o nome',
     /<Building2 size=\{10\} color=\{est\.textSecondary\} \/>[\s\S]{0,60}\{nomeClienteDe\(id\)\}/.test(pc4),
     true);
  eq('Responsável mostra o AVATAR da pessoa (não um ícone genérico)',
     /iconeEsquerda=\{\(esc\) => esc[\s\S]{0,40}<AvatarCirculo id=\{esc\.valor\}/.test(pc4), true);
  eq('Apoio mostra avatar + nome em cada chip',
     /<AvatarCirculo id=\{id\} nome=\{nomeDe\(id\)\}/.test(pc4), true);

  // 3. Descrição é a 2ª seção (logo após "De quem é", antes de "Classificação")
  //
  // O regex casa `<Secao titulo="...">` de todo o arquivo — mas "Comentários"
  // é chamado DENTRO do componente `Comentarios`, declarado ANTES do
  // `PainelChamado` no TEXTO do arquivo (é módulo, por convenção) embora
  // RENDERIZE por último. Por isso a checagem de ORDEM usa só o corpo de
  // `PainelChamado` (que não inclui a definição de `Comentarios`, só o
  // ponto onde ele é CHAMADO) — aqui aparecem só as 3 seções que o próprio
  // PainelChamado declara direto; "Comentários" é conferido à parte, abaixo,
  // pela posição da CHAMADA <Comentarios/>, não da declaração da seção.
  const corpoDoPainel = pc4.slice(pc4.indexOf('export function PainelChamado'));
  const ordemSecoes = [...corpoDoPainel.matchAll(/<Secao titulo="([^"]+)"/g)].map((m) => m[1]);
  eq('a ordem das seções é De quem é → Classificação → Quando (Descrição no meio, sem seção própria)',
     ordemSecoes, ['De quem é', 'Classificação', 'Quando']);
  eq('Descrição vem DEPOIS de "De quem é" e ANTES de "Classificação"',
     pc4.indexOf('<Secao titulo="De quem é"') < pc4.indexOf('<DescricaoComFerramentas')
     && pc4.indexOf('<DescricaoComFerramentas') < pc4.indexOf('<Secao titulo="Classificação"'),
     true);

  // 4. a barra de ferramentas: negrito, itálico, checklist, lista
  eq('a descrição tem barra de ferramentas com os 4 botões básicos',
     /Icon: Bold/.test(pc4) && /Icon: Italic/.test(pc4)
     && /Icon: ListChecks/.test(pc4) && /Icon: List\b/.test(pc4), true);
  eq('os botões usam mousedown (o click chegaria depois do blur, tarde demais)',
     /onMouseDown=\{\(e\) => \{ e\.preventDefault\(\); aplicar\(f\); \}\}/.test(pc4), true);

  // ── achados da revisão adversarial de U40 (2026-08-21) ──────────────────
  eq('aplicar() não arma seleção pendente quando o valor NÃO mudou (idempotente) — senão a seleção fica presa e desloca o cursor na próxima tecla real',
     /if \(r\.valor === v\) return;/.test(pc4), true);
  eq('os botões da barra têm 44x44 (alvo mínimo de toque), não 30x30',
     /width: 44, height: 44,/.test(pc4), true);

  // ── v2 do painel (2026-08-22, Davi: "a caixa de descrição não me
  //    agradou... um botão UI com design... de acordo com o Design System") ──
  eq('os títulos de campo (Cliente, Responsável, Prazo...) usam textPrimary — branco no escuro, sem cor fixa fora de branch de tema',
     /rotulo: \{[\s\S]{0,150}color: textPrimary,/.test(pc4), true);
  eq('o título da atividade no cabeçalho ficou maior e em negrito (era 19/600)',
     /fontSize: 22, fontWeight: 700, minHeight: 0,/.test(pc4), true);
  eq('os botões da barra de ferramentas usam a classe .ferramenta-botao (chapa e borda, não ícone flutuando)',
     /className="ferramenta-botao"/.test(pc4), true);
  eq('um divisor separa negrito/itálico de checklist/lista na barra (dois grupos, não 4 botões soltos)',
     /\{i === 2 && \(/.test(pc4), true);
  eq('a Descrição cresce com o texto: sem resize manual e sem scroll interno',
     /resize: "none",\s*\n\s*overflow: "hidden", minHeight: 132,/.test(pc4), true);
  eq('useLayoutEffect mede e aplica scrollHeight a cada mudança de valor — cresce ANTES da pintura, sem flash',
     /useLayoutEffect\(\(\) => \{\s*\n\s*const el = ref\.current;\s*\n\s*if \(!el\) return;\s*\n\s*el\.style\.height = "auto";\s*\n\s*el\.style\.height = `\$\{el\.scrollHeight\}px`;/.test(pc4),
     true);

  eq('.ferramenta-botao existe com borda/fundo/hover dourado, lendo os tokens de tema (não isLight em JS)',
     /\.ferramenta-botao \{[\s\S]{0,200}border: 1px solid var\(--border-color\);/.test(cssChecklist), true);
  eq('.ferramenta-botao:hover acende a borda/ícone em var(--gold-primary)',
     /\.ferramenta-botao:hover \{[\s\S]{0,120}border-color: var\(--gold-primary\);/.test(cssChecklist), true);
  eq('o checkbox marcado usa var(--gold-primary) — não mais o azul original do Uiverse (#4285f4)',
     /\.checklist-input:checked \+ \.checklist-check svg \{\s*\n\s*stroke: var\(--gold-primary\);/.test(cssChecklist),
     true);
  eq('o azul original do Uiverse (#4285f4) saiu do checkbox — só resta o dourado da marca',
     /#4285f4/.test(cssChecklist), false);
  eq('o checkbox marcado tem um "pop" de escala, não só troca de cor (animação de verdade ao checar)',
     /\.checklist-input:checked \+ \.checklist-check svg \{[\s\S]{0,400}transform: translate3d\(0, 0, 0\) scale\(1\.14\);/.test(cssChecklist),
     true);
  eq('o pop de escala respeita prefers-reduced-motion',
     /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,200}\.checklist-input:checked \+ \.checklist-check svg \{ transform: none; \}/.test(cssChecklist),
     true);
  eq('o textarea da Descrição tem id, e o Campo recebe idAlvo — o <label> não associa mais com o primeiro botão da barra',
     /id="painel-descricao-texto"/.test(pc4), true
       && /<Campo titulo="Descrição" estado=\{estado\} idAlvo="painel-descricao-texto">/.test(pc4));
  eq('Campo usa htmlFor=idAlvo no <label> (explícito vence a associação implícita ao primeiro labelable)',
     /<label htmlFor=\{idAlvo\}/.test(pc4), true);
  eq('Enter no campo de comentário respeita enviar.isPending (senão Enter duplo grava o comentário duas vezes)',
     /e\.key === "Enter" && !e\.shiftKey && texto\.trim\(\) && !enviar\.isPending/.test(pc4), true);
  eq('o aviso "No Notion" mora DENTRO do Campo Local (alinhado com a coluna que ele descreve, não a largura toda)',
     /<Campo titulo="Local"[\s\S]{0,6200}No Notion:/.test(pc4), true);
  eq('o aviso "No Notion" só aparece com ZERO clientes ainda escolhidos (some assim que o primeiro é adicionado)',
     /clientesDoChamadoIds\.length === 0 && chamado\.cliente_origem_nome/.test(pc4), true);

  const ccb2 = fs23.readFileSync('src/components/CampoComBusca.tsx', 'utf8');
  eq('temIcone olha se HÁ ESCOLHA (não só se a prop iconeEsquerda foi passada) — senão o padding reserva espaço de um ícone que não é desenhado',
     /const temIcone = !!iconeEsquerda && !!escolhida;/.test(ccb2), true);

  // 5. Classificação: 4 itens numa grade de 4 colunas FIXAS — a revisão
  //    adversarial de U40 achou que auto-fit(150px) quebrava em 3+1 (Equipe
  //    órfão) numa faixa comum de largura, pior que a quebra 2+2 de antes.
  const blocoClassificacao = pc4.split('<Secao titulo="Classificação"')[1]?.split('<Secao titulo="Quando"')[0] ?? '';
  eq('a grade de Classificação usa 4 colunas FIXAS (não auto-fit — nunca quebra)',
     /gridTemplateColumns: "repeat\(4, minmax\(0, 1fr\)\)"/.test(blocoClassificacao), true);
  eq('e tem os 4 campos: Tipo, Status, Prioridade, Equipe',
     /titulo="Tipo de demanda"/.test(blocoClassificacao) && /titulo="Status"/.test(blocoClassificacao)
     && /titulo="Prioridade"/.test(blocoClassificacao) && /titulo="Equipe"/.test(blocoClassificacao),
     true);

  // 6. Comentários: depois do ÚLTIMO campo, reaproveitando a infra existente
  eq('Comentários é a ÚLTIMA coisa renderizada no painel',
     pc4.lastIndexOf('<Comentarios') > pc4.lastIndexOf('<Secao titulo="Quando"'), true);
  eq('reaproveita useChamadoEventos/comentarChamado — não inventa tabela nova',
     /useChamadoEventos\(chamadoId, "asc"\)/.test(pc4) && /await comentarChamado\(chamadoId, t\)/.test(pc4),
     true);
  eq('mostra só tipo="comentario" (não o resto da linha do tempo de eventos)',
     /eventos\.filter\(\(e\) => e\.tipo === "comentario"\)/.test(pc4), true);
  eq('Enter envia, Shift+Enter quebra linha (padrão de chat)',
     /e\.key === "Enter" && !e\.shiftKey && texto\.trim\(\)/.test(pc4), true);

  // 7. o componente de avatar é COMPARTILHADO com a tabela da Início, não
  //    duplicado (a mesma regra de "hash pelo ID" tem que valer nos dois)
  eq('PessoaComFoto foi extraído para um arquivo compartilhado',
     fs23.existsSync('src/components/PessoaComFoto.tsx'), true);
  const tab4 = fs23.readFileSync('src/features/home/TabelaAtividades.tsx', 'utf8');
  eq('TabelaAtividades importa do local compartilhado (não tem cópia própria)',
     /from "@\/components\/PessoaComFoto"/.test(tab4) && !/^function PessoaComFoto\(/m.test(tab4),
     true);
}

// ── U41: vocabulário de tipos de chamado (R48, 2026-08-21) ─────────────────
{
  const fs24 = require('fs');
  const CS3 = carregar('src/lib/chamado-status.ts');

  // rótulos mais explícitos (R48) — o VALOR gravado não muda
  eq('corretiva ganhou o rótulo "Manutenção Corretiva"',
     CS3.TIPO_LABEL.corretiva, 'Manutenção Corretiva');
  eq('preventiva ganhou o rótulo "Manutenção Preventiva"',
     CS3.TIPO_LABEL.preventiva, 'Manutenção Preventiva');

  // pedido_compra sai só da SELEÇÃO — continua em todo o resto do vocabulário
  eq('pedido_compra NÃO é mais oferecido para abrir chamado interno novo',
     CS3.tiposDaNatureza('interno').includes('pedido_compra'), false);
  eq('mas pedido_compra continua no union/TIPOS (histórico legível)',
     CS3.TIPOS.includes('pedido_compra'), true);
  eq('e continua com rótulo e cor (quem já tem um pedido de compra aberto precisa ver)',
     !!CS3.TIPO_LABEL.pedido_compra && !!CS3.TIPO_CORES.pedido_compra, true);

  // o classificador de texto livre (Notion, criação rápida por IA) não pode
  // sugerir um tipo que o seletor visual já não oferece mais
  eq('sugerirTipoChamado("preciso comprar 10 controles") não sugere mais pedido_compra',
     CS3.sugerirTipoChamado('preciso comprar 10 controles novos'), 'operacional');
  eq('sugerirTipoChamado(cotação de fornecedor) vira operacional',
     CS3.sugerirTipoChamado('cotar fornecedor de nobreak'), 'operacional');

  // o atalho de triagem (chamados.novo.tsx) não pode continuar oferecendo o
  // tipo aposentado — vira operacional, equipe patrimonio, como Davi descreveu
  const triagem = fs24.readFileSync('src/routes/_authenticated/chamados.novo.tsx', 'utf8');
  eq('a triagem "Pedido de compra" abre como tipo operacional (não mais pedido_compra)',
     /equipe: "patrimonio", tipo: "operacional"/.test(triagem), true);

  // a IA de criação rápida (chamado-rapido.functions.ts) segue o mesmo corte
  const rapido = fs24.readFileSync('src/lib/chamado-rapido.functions.ts', 'utf8');
  eq('o schema da criação rápida por IA não tem mais "pedido_compra" no enum',
     /enum: \["corretiva", "preventiva", "operacional", "implantacao", "melhoria"\]/.test(rapido), true);

  // a migration U41 — CHECK aberto, trigger reescrito, backfill
  const u41 = fs24.readFileSync('supabase/migrations/20260822020000_u41_tipos_de_chamado.sql', 'utf8');
  eq('U41: o CHECK de tipo aceita prospeccao (mantendo os valores antigos)',
     /'prospeccao'/.test(u41) && /'proposta_comercial'/.test(u41) && /'pedido_compra'/.test(u41), true);
  eq('U41: o trigger da visita passa a gravar tipo=prospeccao',
     /NEW\.id, 'comercial', 'prospeccao', 'Proposta Comercial'/.test(u41), true);
  eq('U41: faz o BACKFILL de toda demanda comercial existente (não só as novas)',
     /UPDATE public\.chamados\s*\n\s*SET tipo = 'prospeccao'.*\n.*natureza = 'comercial' AND tipo = 'proposta_comercial'/.test(u41),
     true);
  eq('U41 termina com SELECT de verificação', /SELECT '.*esperado 0/.test(u41), true);

  // PRODUTO.md: as regras novas (R48 vocabulário, R49 planejado) ficam registradas
  const produto = fs24.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R48 (vocabulário de tipos) está documentado', /\*\*R48\*\*/.test(produto), true);
  eq('R49 (Corretiva/Preventiva com fluxo próprio) está documentado como planejado',
     /\*\*R49\*\* \(planejado, ainda não construído\)/.test(produto), true);
}

// ── Zoom/pan do mapa de Clientes (2026-08-21, Davi: "mecanismo de zoom...
//    movimentar o mapa com zoom, algo sistemicamente completo") ───────────
{
  const fs25 = require('fs');
  const Z = carregar('src/features/clientes/mapa-zoom.ts');

  eq('identidade é k=1, sem deslocamento', Z.IDENTIDADE, { x: 0, y: 0, k: 1 });

  eq('clamp mantém dentro da faixa', Z.clamp(5, 0, 10), 5);
  eq('clamp trava no mínimo', Z.clamp(-5, 0, 10), 0);
  eq('clamp trava no máximo', Z.clamp(50, 0, 10), 10);

  // zoomEm — o ponto sob o cursor tem que ficar PARADO na tela: é a
  // diferença entre "zoom no cursor" (bom) e "zoom sempre no canto" (ruim)
  {
    const t = Z.zoomEm(Z.IDENTIDADE, 2, 100, 100);
    eq('zoomEm dobra o k', t.k, 2);
    eq('o ponto sob o cursor continua no mesmo lugar da tela',
       [t.k * 100 + t.x, t.k * 100 + t.y], [100, 100]);
  }
  {
    // zoom repetido, sempre no MESMO ponto de tela — o conteúdo sob o
    // cursor não pode "escapar" a cada passo do gesto
    let t = Z.IDENTIDADE;
    for (let i = 0; i < 5; i++) t = Z.zoomEm(t, 1.3, 250, 300);
    eq('zoom repetido no mesmo ponto de tela mantém esse ponto fixo',
       [Math.round(t.k * 250 + t.x), Math.round(t.k * 300 + t.y)], [250, 300]);
  }
  eq('zoomEm nunca passa de ZOOM_MAX', Z.zoomEm(Z.IDENTIDADE, 999, 0, 0).k, Z.ZOOM_MAX);
  eq('zoomEm nunca fica abaixo de ZOOM_MIN', Z.zoomEm({ x: 0, y: 0, k: 2 }, 0.001, 0, 0).k, Z.ZOOM_MIN);
  eq('zoomEm já no limite (fator=1, ZOOM_MIN) devolve a MESMA referência — sem trabalho à toa',
     Z.zoomEm(Z.IDENTIDADE, 1, 10, 10) === Z.IDENTIDADE, true);

  // deslocar — preserva k, só soma ao x/y (mesma ordem de chave do literal
  // de entrada, por isso o literal esperado usa x,y,k igual à entrada)
  eq('deslocar soma ao x/y, preserva k', Z.deslocar({ x: 1, y: 2, k: 3 }, 10, -5), { x: 11, y: -3, k: 3 });

  // limitarTransform — em k=1 (zoom mínimo) não há folga: x e y são
  // forçados a 0, porque o conteúdo já enche a janela exatamente
  eq('em k=1, limitarTransform força x=0,y=0 (sem folga pra arrastar)',
     Z.limitarTransform({ x: 500, y: -300, k: 1 }, -6, 1006, -6, 980), { k: 1, x: 0, y: 0 });
  {
    // k=2: o conteúdo é 2x maior que a janela — dá pra arrastar até a
    // borda oposta aparecer, nunca além dela (não pode sobrar vazio)
    const L = 1000;
    const lim = Z.limitarTransform({ x: 99999, y: 0, k: 2 }, 0, L, 0, L);
    eq('arrastar ao extremo não deixa vazio aparecer de um lado', lim.x <= 0, true);
    const limNeg = Z.limitarTransform({ x: -99999, y: 0, k: 2 }, 0, L, 0, L);
    eq('nem do lado oposto', limNeg.x + 2 * L >= L, true);
  }

  // distancia / pontoMedio — a base do pinça de dois dedos
  eq('distancia de (0,0) a (3,4) é 5 (3-4-5)', Z.distancia(0, 0, 3, 4), 5);
  eq('pontoMedio de (0,0) e (10,20) é (5,10)', Z.pontoMedio(0, 0, 10, 20), { x: 5, y: 10 });

  // fatorDaRoda
  eq('deltaY negativo (roda pra cima) amplia (fator > 1)', Z.fatorDaRoda(-100) > 1, true);
  eq('deltaY positivo (roda pra baixo) reduz (fator < 1)', Z.fatorDaRoda(100) < 1, true);
  eq('deltaY=0 não muda nada (fator=1)', Z.fatorDaRoda(0), 1);

  // paraPercentual — a base do posicionamento do balão de dica; existe
  // porque o balão (HTML fora do SVG) precisa saber onde o ponto está NA
  // TELA, e isso muda com zoom/pan mesmo que a coordenada de CONTEÚDO
  // (alvo.x/alvo.y) não mude nunca
  eq('em identidade, o centro do conteúdo cai em 50%/50%',
     Z.paraPercentual(Z.IDENTIDADE, 500, 487, 1000, 974, 6), { left: 50, top: 50 });
  {
    // o bug real que motivou esta função: o balão ficava grudado na
    // posição de k=1 mesmo depois de dar zoom, porque a fórmula antiga
    // não sabia nada sobre a transformação ativa
    const t = Z.zoomEm(Z.IDENTIDADE, 2, 500, 487);
    const pos = Z.paraPercentual(t, 500, 487, 1000, 974, 6);
    eq('o centro do zoom continua em 50%/50% depois do zoom (é o ponto que ficou fixo)',
       [Math.round(pos.left), Math.round(pos.top)], [50, 50]);
    const posOutro = Z.paraPercentual(t, 0, 0, 1000, 974, 6);
    eq('um ponto DIFERENTE do centro do zoom muda de % — o mapa "cresceu" ao redor do centro',
       posOutro.left !== 50 || posOutro.top !== 50, true);
  }

  // ── o componente: mecanismos ligados de verdade ──────────────────────
  const mc = fs25.readFileSync('src/features/clientes/MapaClientes.tsx', 'utf8');
  eq('o viewBox do svg é FIXO — quem se move é o <g> interno, não o viewBox',
     /viewBox=\{`-\$\{MARGEM\} -\$\{MARGEM\} \$\{VB_LARGURA\} \$\{VB_ALTURA\}`\}/.test(mc), true);
  eq('a roda do mouse usa listener NATIVO com passive:false (preventDefault de verdade)',
     /addEventListener\("wheel", aoRolar, \{ passive: false \}\)/.test(mc), true);
  eq('o listener da roda é removido no cleanup do efeito (sem vazamento)',
     /removeEventListener\("wheel", aoRolar\)/.test(mc), true);
  // R74: a pergunta virou "já mexeu no mapa?" em vez de "está no zoom
  // mínimo?" — com a R71 o mapa passou a ABRIR com zoom, e o critério antigo
  // travava o dedo desde o primeiro segundo, prendendo quem só queria descer
  // até a lista no celular.
  eq('CRÍTICO: enquanto ninguém mexeu no mapa o toque é da PÁGINA (pan-y); depois de zoom/arrasto passa a ser do mapa',
     /touchAction: semAlteracao \? "pan-y" : "none"/.test(mc), true);
  eq('atualizações de transform passam por requestAnimationFrame (não repinta mais que o navegador aguenta)',
     /rafRef\.current = requestAnimationFrame/.test(mc), true);
  eq('cancela o rAF pendente ao desmontar (sem setState depois do componente sair da árvore)',
     /cancelAnimationFrame\(rafRef\.current\)/.test(mc), true);
  eq('um clique que terminou arrasto NÃO navega (arrastouRef gate no onClick do ponto)',
     /if \(arrastouRef\.current\) \{ arrastouRef\.current = false; return; \}/.test(mc), true);
  eq('hover no ponto também respeita o arrasto (não reabre o balão durante o pan)',
     /onMouseEnter=\{\(\) => \{ if \(!arrastouRef\.current\) setAlvo\(p\); \}\}/.test(mc), true);
  eq('o balão de dica usa paraPercentual (acompanha o zoom/pan, não fica preso na posição de k=1)',
     /paraPercentual\(transform, alvo\.x, alvo\.y, MAPA_SP\.largura, MAPA_SP\.altura, MARGEM\)/.test(mc), true);
  eq('o traço do distrito usa vector-effect non-scaling-stroke (mesma espessura em qualquer zoom)',
     /strokeWidth=\{1\}[\s\S]{0,400}vectorEffect="non-scaling-stroke"/.test(mc), true);
  eq('há botões de + / − / restaurar, todos com aria-label',
     /rotulo="Aumentar zoom"/.test(mc) && /rotulo="Diminuir zoom"/.test(mc)
       && /rotulo="Restaurar a visão inteira"/.test(mc), true);
  eq('o botão de restaurar fica desabilitado quando já está sem alteração (identidade)',
     /desabilitado=\{semAlteracao\}/.test(mc), true);

  // ── achados da revisão adversarial do zoom/pan (2026-08-21) ──────────
  // R74: a roda sozinha dá zoom ONDE A PÁGINA NÃO ROLA. A exigência de
  // Ctrl/Cmd nasceu quando o mapa ficava ao lado de uma lista rolável; a R60
  // travou a página numa tela fixa e a R71 tirou a rolagem da lista. Abaixo
  // de 1024px a página volta a rolar, e lá a exigência continua valendo.
  eq('CRÍTICO: a roda só vira zoom sem Ctrl onde a página NÃO rola — abaixo do breakpoint da tela fixa a roda continua sendo da página',
     /const telaFixa = window\.matchMedia\(TELA_FIXA\)\.matches;/.test(mc)
     && /if \(!telaFixa && !e\.ctrlKey && !e\.metaKey\) return;/.test(mc), true);
  eq('CRÍTICO: o breakpoint da roda é o MESMO da classe .clientes-tela-fixa — se um mudar sem o outro, a roda vira zoom numa página que ainda rola',
     /const TELA_FIXA = "\(min-width: 1024px\)";/.test(mc)
     && /\.clientes-tela-fixa/.test(require('fs').readFileSync('src/styles.css', 'utf8'))
     && /@media \(min-width: 1024px\) \{[\s\S]{0,900}\.clientes-tela-fixa \{/.test(require('fs').readFileSync('src/styles.css', 'utf8')),
     true);
  eq('a dica embaixo do mapa descreve o gesto que funciona de verdade',
     /Arraste para mover · role o mouse ou use os botões para dar zoom/.test(mc), true);

  eq('CRÍTICO: pointerdown de 1 dedo/mouse NÃO captura o ponteiro na hora — clique parado tem que continuar navegando',
     /function aoPressionarPonteiro[\s\S]{0,700}NÃO captura o ponteiro aqui/.test(mc), true);
  eq('a captura só acontece quando o gesto CRUZA o limiar de arrasto, dentro de aoMoverPonteiro',
     /arrastouRef\.current = true;\s*\n\s*setEmArrasto\(true\);\s*\n\s*setAlvo\(null\);[\s\S]{0,300}setPointerCapture\(e\.pointerId\)/.test(mc), true);
  eq('2 dedos (pinça) capturam TODOS os ponteiros ativos de imediato — nunca é ambíguo com um clique',
     /if \(ponteirosRef\.current\.size >= 2\) \{\s*\n\s*for \(const id of ponteirosRef\.current\.keys\(\)\) e\.currentTarget\.setPointerCapture\(id\);/.test(mc), true);

  eq('recalcularPinch existe e é chamado tanto ao formar a pinça quanto ao voltar a 2 ponteiros depois de soltar um',
     /function recalcularPinch\(\)/.test(mc)
       && /recalcularPinch\(\);\s*\n\s*\}\s*\n\s*\}\s*\n\s*\n\s*function aoMoverPonteiro/.test(mc)
       && /if \(ponteirosRef\.current\.size === 2\) recalcularPinch\(\);/.test(mc),
     true);

  eq('o reset de arrastouRef no pointerup é ADIADO (setTimeout) — senão o clique no marcador perderia a supressão, ou o hover ficaria preso se o arrasto terminar fora de um ponto',
     /setTimeout\(\(\) => \{ arrastouRef\.current = false; \}, 0\)/.test(mc), true);
  eq('ctmRef é cacheada no início do gesto e limpa no fim (evita getScreenCTM a cada pointermove)',
     /ctmRef\.current = svgRef\.current\?\.getScreenCTM\(\) \?\? null;/.test(mc) && /ctmRef\.current = null;/.test(mc),
     true);
  eq('paraOuter usa a CTM cacheada quando existe (gesto em curso), senão pega uma nova (roda/botões)',
     /const ctm = ctmRef\.current \?\? svg\.getScreenCTM\(\);/.test(mc), true);

  eq('pan por teclado (setas) existe — svg é focável (tabIndex) e trata ArrowUp\\/Down\\/Left\\/Right',
     /tabIndex=\{0\}/.test(mc) && /function aoTeclar/.test(mc)
       && /ArrowUp: \[0, PASSO\], ArrowDown: \[0, -PASSO\]/.test(mc), true);

  const produto2 = fs25.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R52 (zoom/pan do mapa) está documentado', /\*\*R52\*\*/.test(produto2), true);
}

// ── U44: marcação de monitoramento de alarmes (R41, continuação da U36,
//    2026-08-22) ────────────────────────────────────────────────────────────
{
  const fs26 = require('fs');
  const u44 = fs26.readFileSync('supabase/migrations/20260822030000_u44_monitoramento_alarmes.sql', 'utf8');

  eq('U44 só acrescenta o serviço se ainda não estiver lá (idempotente)',
     /NOT \('monitoramento_alarmes' = ANY \(c\.servicos_prestados\)\)/.test(u44), true);
  eq('U44 tem pré-voo dos que não casam', /PRÉ-VOO/.test(u44), true);
  eq('U44 termina com SELECT de verificação', /esperado 30/.test(u44), true);
  eq('U44 casa só por documento (a planilha tem nome solto demais para casar por nome)',
     /regexp_replace\(c\.documento, '\\D', '', 'g'\) = regexp_replace\(m\.documento, '\\D', '', 'g'\)/.test(u44),
     true);

  // OS 30 — cada um foi conferido à mão contra a base real do QAP (a da
  // U24), pelo documento (CNPJ/CPF) já existente em `clientes.documento`.
  // Esta asserção reproduz essa conferência: todo documento listado em U44
  // precisa aparecer em algum documento da planilha da U24 — senão a
  // migration marcaria um cliente que não existe (ou existe sob outro
  // documento), em silêncio.
  {
    const dig = (t) => (t || '').replace(/\D/g, '');
    const u24b = fs26.readFileSync('supabase/migrations/20260820150000_u24_base_clientes.sql', 'utf8');
    const ini2 = u24b.indexOf('INSERT INTO _planilha_u24');
    const base2 = [...u24b.slice(ini2, u24b.indexOf(';', ini2))
      .matchAll(/\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/g)]
      .map((m) => ({ nome: m[1].replace(/''/g, "'"), doc: m[2] }));
    const porDoc2 = new Set(base2.map((b) => dig(b.doc)).filter((d) => d.length >= 11));

    const bloco2 = u44.slice(u44.indexOf('INSERT INTO _monitoramento_u44'), u44.indexOf('-- PRÉ-VOO'));
    const lista2 = [...bloco2.matchAll(/\(\s*'((?:[^']|'')*)'\s*,\s*'([^']*)'\)/g)]
      .map((m) => ({ nome: m[1].replace(/''/g, "'"), doc: m[2] }));

    eq('U44 lista os 30 clientes de monitoramento de alarmes', lista2.length, 30);
    const orfaos2 = lista2.filter((p) => !porDoc2.has(dig(p.doc)));
    eq('todos os 30 documentos batem com algum cliente da base do QAP (U24)', orfaos2.map((o) => o.nome), []);
    // nenhum documento repetido na lista — cada linha marca um cliente distinto
    const docsDigits = lista2.map((p) => dig(p.doc));
    eq('nenhum documento duplicado dentro da própria lista da U44',
       new Set(docsDigits).size, docsDigits.length);
  }

  const produto3 = fs26.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R41 continua documentado (monitoramento de alarmes agora também marcado)',
     /\*\*R41\*\*/.test(produto3) || /R41/.test(produto3), true);
}

// ── U45: uma atividade pode ter mais de um cliente + grupo de clientes
//    (R54, 2026-08-22) ──────────────────────────────────────────────────────
{
  const fs27 = require('fs');
  const u45 = fs27.readFileSync('supabase/migrations/20260822040000_u45_chamado_clientes.sql', 'utf8');
  const cd2 = fs27.readFileSync('src/features/chamados/data.ts', 'utf8');
  const pc5 = fs27.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');

  // ── a migration ─────────────────────────────────────────────────────────
  eq('U45 cria chamado_clientes com chave composta (chamado_id, cliente_id)',
     /CREATE TABLE IF NOT EXISTS public\.chamado_clientes \(/.test(u45)
     && /PRIMARY KEY \(chamado_id, cliente_id\)/.test(u45), true);
  eq('U45 referencia chamados e clientes com ON DELETE CASCADE (linha órfã não sobrevive)',
     /REFERENCES public\.chamados\(id\) ON DELETE CASCADE/.test(u45)
     && /REFERENCES public\.clientes\(id\) ON DELETE CASCADE/.test(u45), true);
  eq('U45 liga RLS e cria as 3 policies',
     /ENABLE ROW LEVEL SECURITY/.test(u45)
     && /"chamado_clientes_select"/.test(u45)
     && /"chamado_clientes_insert"/.test(u45)
     && /"chamado_clientes_delete"/.test(u45), true);
  eq('insert/delete usam pode_editar_chamado — a MESMA função que já guarda cliente_id hoje',
     /"chamado_clientes_insert"[\s\S]{0,120}WITH CHECK \(public\.pode_editar_chamado\(chamado_id\)\)/.test(u45)
     && /"chamado_clientes_delete"[\s\S]{0,120}USING \(public\.pode_editar_chamado\(chamado_id\)\)/.test(u45),
     true);
  eq('U45 NÃO faz backfill — cliente extra não existia antes deste recurso',
     /INSERT INTO public\.chamado_clientes/.test(u45), false);
  eq('U45 termina com SELECT de verificação', /Verificação/.test(u45), true);

  // ── a camada de dados ────────────────────────────────────────────────────
  // U71: `chamado_clientes` deu lugar a `chamado_locais`, que sabe falar de
  // cliente, prospecção e setor. As asserções abaixo mudaram de alvo junto — o
  // que elas guardam continua sendo o mesmo: o slot principal é preservado, e
  // remover o principal não promove extra nenhum.
  eq('useChamadoLocais lê chamado_locais filtrando por chamado_id',
     /function useChamadoLocais[\s\S]{0,400}from\("chamado_locais"/.test(cd2), true);
  eq('adicionarClienteChamado: slot principal livre vira cliente_id (1 gravação, não 2)',
     /export async function adicionarClienteChamado[\s\S]{0,200}if \(!clienteIdAtual\) \{\s*\n\s*await atualizarChamado\(chamadoId, \{ cliente_id: clienteId \}\);/.test(cd2),
     true);
  eq('adicionarClienteChamado: slot principal ocupado vai para chamado_locais',
     /export async function adicionarClienteChamado[\s\S]{0,500}\.from\("chamado_locais" as any\)\s*\n\s*\.insert\(\{ chamado_id: chamadoId, cliente_id: clienteId \}/.test(cd2),
     true);
  eq('removerClienteChamado: remover o principal só limpa o slot (sem promoção automática de extra)',
     /export async function removerClienteChamado[\s\S]{0,200}if \(clienteId === clienteIdAtual\) \{\s*\n\s*await atualizarChamado\(chamadoId, \{ cliente_id: null \}\);/.test(cd2),
     true);
  eq('CRÍTICO (R84): existe caminho para pendurar PROSPECÇÃO — o local que não é cliente',
     /export async function adicionarProspeccaoChamado[\s\S]{0,300}prospeccao_id/.test(cd2), true);
  eq('CRÍTICO (R85): o setor entra como UMA etiqueta, não como expansão em N clientes',
     /export async function adicionarSetorChamado[\s\S]{0,300}\.insert\(\{ chamado_id: chamadoId, setor \}/.test(cd2),
     true);

  // ── o painel ─────────────────────────────────────────────────────────────
  eq('clientesDoChamadoIds junta o principal (cliente_id) com os locais, sem duplicar',
     /const clientesDoChamadoIds = useMemo\(\(\) => \{\s*\n\s*const principal = chamado\?\.cliente_id \?\? null;\s*\n\s*const extras = locais/.test(pc5),
     true);
  eq('o seletor de setor lista SERVICO_ORDEM (hoje Portaria Remota e Monitoramento de Alarmes)',
     /<option value="">\+ setor<\/option>[\s\S]{0,140}SERVICO_ORDEM\.filter/.test(pc5), true);
  eq('o seletor de setor não reoferece setor já marcado (senão a etiqueta duplicaria)',
     /SERVICO_ORDEM\.filter\(\(s\) => !setoresDoChamado\.includes\(s\)\)/.test(pc5), true);
  eq('a busca de "+ adicionar" cliente exclui quem já está na atividade (senão ofereceria chave repetida)',
     /opcoes=\{opcoesClientes\.filter\(\(o\) => !clientesDoChamadoIds\.includes\(o\.valor\)\)\}/.test(pc5),
     true);
  eq('remover um local invalida chamado E chamado-locais (o principal pode ter vindo de qualquer um dos dois)',
     /mexerCliente = useMutation\(\{[\s\S]{0,700}chamado-locais/.test(pc5), true);

  const produto4 = fs27.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R54 (múltiplos clientes + grupo) está documentado', /\*\*R54\*\*/.test(produto4), true);
}

// ── R55: paginação de 10 na lista de Clientes + mapa alinhado com o fim da
//    lista (2026-08-22) ─────────────────────────────────────────────────────
{
  const fs28 = require('fs');
  const cl2 = fs28.readFileSync('src/routes/_authenticated/clientes.tsx', 'utf8');
  const css2 = fs28.readFileSync('src/styles.css', 'utf8');
  const mc2 = fs28.readFileSync('src/features/clientes/MapaClientes.tsx', 'utf8');

  // ── paginação ────────────────────────────────────────────────────────────
  eq('10 itens por página', /const ITENS_POR_PAGINA = 10;/.test(cl2), true);
  eq('mudar busca/filtro/serviço volta pra página 1 (senão a tela fica em branco numa página que não existe mais)',
     /useEffect\(\(\) => \{ setPaginaAtual\(1\); \}, \[busca, filtro, servico\]\);/.test(cl2), true);
  eq('a página é fatiada (slice) da lista FILTRADA, com clamp contra o total (defesa se o total encolher)',
     /const pagina = Math\.min\(paginaAtual, totalPaginas\);/.test(cl2)
     && /lista\.slice\(\(pagina - 1\) \* ITENS_POR_PAGINA, pagina \* ITENS_POR_PAGINA\)/.test(cl2),
     true);
  eq('os CARTÕES renderizam a página (listaPaginada), não a lista inteira',
     /listaPaginada\.map\(\(c\) => \{/.test(cl2), true);
  // achado que travaria em silêncio: se alguém "simplificasse" pra
  // listaPaginada aqui, o mapa passaria a mostrar só os 10 da página em vez
  // de todo o resultado filtrado — mudança de comportamento sem aviso nenhum
  eq('CRÍTICO: o MAPA continua recebendo a lista INTEIRA filtrada (lista), não a paginada — paginar é sobre cartões, não sobre esconder ponto do mapa',
     /<MapaClientes clientes=\{lista\} \/>/.test(cl2), true);
  eq('a paginação só aparece com mais de 1 página (lista curta não precisa de numerador)',
     /\{lista\.length > 0 && totalPaginas > 1 && \(/.test(cl2), true);

  // ── numerosDePagina (1,2,…,N com reticências) ───────────────────────────
  eq('até 7 páginas, mostra todas (sem truncar cedo demais)',
     /function numerosDePagina[\s\S]{0,100}if \(total <= 7\) return Array\.from/.test(cl2), true);
  eq('acima de 7, sempre mantém primeira, última e vizinhança da atual',
     /const alvo = new Set\(\[1, 2, total - 1, total, atual - 1, atual, atual \+ 1\]\);/.test(cl2),
     true);

  // ── o pager em si: primeira/anterior/…/próxima/última, todos com aria-label ──
  eq('os 4 botões de navegação existem, todos com aria-label (First/Prev/Next/Last)',
     /aria-label="Primeira página"/.test(cl2) && /aria-label="Página anterior"/.test(cl2)
     && /aria-label="Próxima página"/.test(cl2) && /aria-label="Última página"/.test(cl2),
     true);
  eq('os botões de extremo desabilitam na primeira/última página (não é possível "ir além")',
     /disabled=\{pagina === 1\}/.test(cl2) && /disabled=\{pagina === totalPaginas\}/.test(cl2),
     true);
  eq('a página atual usa o MESMO gradiente dourado que os chips de filtro (chipFiltro) — um vocabulário só de "selecionado" na tela',
     /botaoNumero = \(ativo: boolean\)[\s\S]{0,200}background: ativo \? GRAD_PRIMARIA : fundo,/.test(cl2),
     true);
  eq('o resumo "X–Y de Z" usa o total da lista FILTRADA (totalItens), não o total geral de clientes',
     /\{primeiroItem\}–\{ultimoItem\} de \{totalItens\}/.test(cl2), true);

  // ── layout: mapa alinhado com o fim da lista ────────────────────────────
  eq('a partir de 1024px as duas colunas esticam para a mesma altura (align-items: stretch)',
     /@media \(min-width: 1024px\) \{\s*\n\s*\.clientes-duas-colunas \{[\s\S]{0,900}align-items: stretch;/.test(css2),
     true);
  eq('o sticky do mapa saiu — alturas casadas tornam sticky sem efeito (não sobra sibling mais alto pra "passar por baixo")',
     /\.clientes-duas-colunas > :last-child \{\s*\n\s*order: 0;\s*\n\s*position: sticky;/.test(css2),
     false);
  eq('o :last-child do breakpoint de 1024px agora é só order:0, uma linha só',
     /\.clientes-duas-colunas > :last-child \{ order: 0; \}\s*\n\}/.test(css2), true);
  eq('.mapa-clientes-caixa: vh fixo no celular, flex:1 com piso de 480px a partir de 1024px',
     /\.mapa-clientes-caixa \{\s*\n\s*height: min\(78vh, 900px\);\s*\n\s*\}\s*\n\s*@media \(min-width: 1024px\) \{\s*\n\s*\.mapa-clientes-caixa \{\s*\n\s*height: auto;\s*\n\s*flex: 1;\s*\n\s*min-height: 480px;/.test(css2),
     true);
  eq('MapaClientes usa a classe .mapa-clientes-caixa (não mais a altura fixa inline)',
     /className="mapa-clientes-caixa"/.test(mc2), true);
  eq('a altura fixa antiga (min(78vh, 900px) inline) saiu do componente — só resta na classe CSS, condicional por breakpoint',
     /height: "min\(78vh, 900px\)"/.test(mc2), false);
  eq('o card do MapaClientes pede height:100% — precisa de altura DEFINIDA própria pra repassar aos filhos com flex:1',
     /className="elevavel" style=\{\{[\s\S]{0,200}height: "100%",/.test(mc2), true);
}

// ── U47: duplas de campo, programação e painel operacional
//    (R56/R57/R58/R59, 2026-08-22) ──────────────────────────────────────────
{
  const fs29 = require('fs');
  const DUP = carregar('src/features/duplas/modelo.ts');
  const u47 = fs29.readFileSync('supabase/migrations/20260822050000_u47_duplas_de_campo.sql', 'utf8');
  const prog = fs29.readFileSync('src/routes/_authenticated/chamados.programacao.tsx', 'utf8');
  const pop = fs29.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');
  const dlg = fs29.readFileSync('src/features/duplas/DialogoDuplas.tsx', 'utf8');
  const conv = fs29.readFileSync('src/lib/convites.functions.ts', 'utf8');
  const CS2 = carregar('src/lib/chamado-status.ts');

  const dupla = (o) => ({ id: 'd1', nome: 'Dupla 1', membro_a: 'a', membro_b: 'b', ativa: true, ...o });

  // ── membrosDaDupla ──────────────────────────────────────────────────────
  eq('membrosDaDupla devolve os dois quando há par', DUP.membrosDaDupla(dupla({})), ['a', 'b']);
  eq('membrosDaDupla devolve um só quando não há parceiro — sem null no meio',
     DUP.membrosDaDupla(dupla({ membro_b: null })), ['a']);

  // ── duplaDaPessoa ───────────────────────────────────────────────────────
  eq('duplaDaPessoa acha por membro_a', DUP.duplaDaPessoa('a', [dupla({})])?.id, 'd1');
  eq('duplaDaPessoa acha por membro_b', DUP.duplaDaPessoa('b', [dupla({})])?.id, 'd1');
  eq('duplaDaPessoa ignora dupla DESFEITA — trabalho novo não pode cair numa dupla que não existe mais',
     DUP.duplaDaPessoa('a', [dupla({ ativa: false })]), null);
  eq('duplaDaPessoa com pessoa fora de qualquer dupla', DUP.duplaDaPessoa('z', [dupla({})]), null);
  // chamado sem responsável é o caso mais comum da fila — não pode explodir
  eq('duplaDaPessoa tolera responsável nulo', DUP.duplaDaPessoa(null, [dupla({})]), null);

  // ── rotuloDaDupla ───────────────────────────────────────────────────────
  const nomeDe = (id) => ({ a: 'Breno', b: 'André' }[id] ?? id);
  eq('rotuloDaDupla usa o nome cadastrado', DUP.rotuloDaDupla(dupla({}), nomeDe), 'Dupla 1');
  eq('rotuloDaDupla sem nome monta a partir de quem está nela (legenda do gráfico precisa de rótulo)',
     DUP.rotuloDaDupla(dupla({ nome: '   ' }), nomeDe), 'Breno & André');

  // ── erroDaDupla (as 3 regras que o banco também garante) ────────────────
  eq('erroDaDupla exige nome',
     DUP.erroDaDupla({ nome: ' ', membroA: 'a', membroB: null }, [], nomeDe), 'Dê um nome à dupla.');
  eq('erroDaDupla exige ao menos um técnico',
     DUP.erroDaDupla({ nome: 'X', membroA: null, membroB: null }, [], nomeDe), 'Escolha ao menos um técnico.');
  eq('erroDaDupla recusa a mesma pessoa duas vezes',
     DUP.erroDaDupla({ nome: 'X', membroA: 'a', membroB: 'a' }, [], nomeDe),
     'A dupla precisa de duas pessoas diferentes.');
  eq('erroDaDupla recusa quem já está em outra dupla ativa (a mesma regra do trigger da U47)',
     DUP.erroDaDupla({ nome: 'X', membroA: 'a', membroB: null }, [dupla({})], nomeDe),
     'Breno já está na dupla "Dupla 1".');
  // sem isto, editar a própria dupla acusaria conflito consigo mesma
  eq('erroDaDupla NÃO acusa conflito com a dupla em edição',
     DUP.erroDaDupla({ nome: 'X', membroA: 'a', membroB: 'b' }, [dupla({})], nomeDe, 'd1'), null);
  eq('erroDaDupla aceita dupla válida',
     DUP.erroDaDupla({ nome: 'Dupla 2', membroA: 'c', membroB: 'd' }, [dupla({})], nomeDe), null);
  eq('erroDaDupla aceita técnico sem parceiro (dupla de um continua aparecendo no filtro/gráfico)',
     DUP.erroDaDupla({ nome: 'Solo', membroA: 'c', membroB: null }, [dupla({})], nomeDe), null);

  // ── série do gráfico ────────────────────────────────────────────────────
  {
    const semanas = [{ chave: 'S1', rotulo: '04/08' }, { chave: 'S2', rotulo: '11/08' }];
    // a chave da semana vem de fora (referenciaSemanal, no app); aqui um
    // marcador simples torna o teste independente do calendário real
    const chaveDe = (d) => (d.getUTCDate() <= 10 ? 'S1' : 'S2');
    const cham = (responsavel_id, dia) => ({
      responsavel_id,
      data_hora_agendada: `2026-08-${String(dia).padStart(2, '0')}T12:00:00.000Z`,
    });
    const duplas2 = [dupla({}), dupla({ id: 'd2', nome: 'Dupla 2', membro_a: 'c', membro_b: null })];

    eq('série: conta por dupla e por semana, e o parceiro soma na MESMA dupla (não em duas linhas)',
       DUP.serieAtividadesPorDupla(
         [cham('a', 4), cham('b', 5), cham('c', 4), cham('a', 20)],
         duplas2, semanas, chaveDe,
       ),
       [{ semana: '04/08', d1: 2, d2: 1 }, { semana: '11/08', d1: 1, d2: 0 }]);

    eq('série: semana sem nada vira ZERO, não buraco — a linha não pode saltar por cima da semana vazia',
       DUP.serieAtividadesPorDupla([cham('a', 4)], duplas2, semanas, chaveDe),
       [{ semana: '04/08', d1: 1, d2: 0 }, { semana: '11/08', d1: 0, d2: 0 }]);

    eq('série: chamado SEM data programada não entra (o gráfico é do que foi programado)',
       DUP.serieAtividadesPorDupla(
         [{ responsavel_id: 'a', data_hora_agendada: null }], duplas2, semanas, chaveDe,
       ),
       [{ semana: '04/08', d1: 0, d2: 0 }, { semana: '11/08', d1: 0, d2: 0 }]);

    eq('série: responsável fora de dupla não entra em linha nenhuma',
       DUP.serieAtividadesPorDupla([cham('z', 4)], duplas2, semanas, chaveDe),
       [{ semana: '04/08', d1: 0, d2: 0 }, { semana: '11/08', d1: 0, d2: 0 }]);

    eq('série: dupla DESFEITA não vira linha do gráfico',
       Object.keys(DUP.serieAtividadesPorDupla([], [dupla({ ativa: false })], semanas, chaveDe)[0]),
       ['semana']);

    // o gráfico que some com trabalho sem avisar é um gráfico que mente
    eq('foraDeDupla conta o que o gráfico NÃO mostrou (sem responsável ou fora de dupla)',
       DUP.foraDeDupla([cham('z', 4), cham(null, 5), cham('a', 4)], duplas2, semanas, chaveDe), 2);
    eq('foraDeDupla ignora o que está fora da janela de semanas mostrada',
       DUP.foraDeDupla([{ responsavel_id: 'z', data_hora_agendada: null }], duplas2, semanas, chaveDe), 0);
  }

  // ── a migration ─────────────────────────────────────────────────────────
  eq('U47 cria duplas com membro_b OPCIONAL (técnico sem par continua aparecendo)',
     /membro_b\s+uuid REFERENCES public\.profiles\(id\)/.test(u47), true);
  eq('U47 impede a mesma pessoa duas vezes na MESMA dupla',
     /CHECK \(membro_b IS NULL OR membro_a <> membro_b\)/.test(u47), true);
  eq('U47 tem os dois índices parciais de membro único (só entre duplas ATIVAS)',
     /CREATE UNIQUE INDEX IF NOT EXISTS duplas_membro_a_unico[\s\S]{0,120}WHERE ativa/.test(u47)
     && /CREATE UNIQUE INDEX IF NOT EXISTS duplas_membro_b_unico[\s\S]{0,140}WHERE ativa AND membro_b IS NOT NULL/.test(u47),
     true);
  eq('CRÍTICO: U47 tem o TRIGGER do caso cruzado (membro_a numa dupla e membro_b em outra) — índice nenhum pega isso',
     /CREATE TRIGGER trg_duplas_valida_membros/.test(u47)
     && /d\.membro_b = NEW\.membro_a/.test(u47), true);
  eq('U47: leitura aberta ao time, escrita só de gestor',
     /"duplas_select" ON public\.duplas\s*\n\s*FOR SELECT TO authenticated USING \(true\)/.test(u47)
     && /"duplas_write"[\s\S]{0,140}public\.is_gestor\(auth\.uid\(\)\)/.test(u47), true);
  // O nome `chamados.dupla_id` aparece de propósito no cabeçalho e no COMMENT
  // da tabela, explicando por que ele NÃO existe — então a checagem é sobre a
  // operação de schema, não sobre a string aparecer no arquivo.
  eq('U47 NÃO cria chamados.dupla_id — a dupla é derivada do responsável (uma fonte de verdade só)',
     /ALTER TABLE[\s\S]{0,120}dupla_id/i.test(u47), false);
  eq('e nenhuma outra migration criou a coluna pelas costas',
     fs29.readdirSync('supabase/migrations').some((f) =>
       /ADD COLUMN[^;]{0,80}dupla_id/i.test(fs29.readFileSync(`supabase/migrations/${f}`, 'utf8'))),
     false);
  eq('U47 termina com SELECT de verificação', /Verificação/.test(u47), true);

  // ── tipos de demanda de campo (R57) ─────────────────────────────────────
  eq('TIPOS_DEMANDA_CAMPO são exatamente os 3 que o Davi listou',
     CS2.TIPOS_DEMANDA_CAMPO, ['corretiva', 'preventiva', 'implantacao']);
  eq('e os 3 têm rótulo — são o que aparece no filtro',
     CS2.TIPOS_DEMANDA_CAMPO.map((t) => CS2.TIPO_LABEL[t]),
     ['Manutenção Corretiva', 'Manutenção Preventiva', 'Implantação']);
  // é mais estrito que tiposDaNatureza('campo'), que ainda oferece operacional
  // no formulário de abertura — a diferença é proposital
  eq('TIPOS_DEMANDA_CAMPO é mais estrito que tiposDaNatureza("campo") (que inclui operacional)',
     CS2.tiposDaNatureza('campo').filter((t) => !CS2.TIPOS_DEMANDA_CAMPO.includes(t)), ['operacional']);

  // ── a tela de programação (R57) ─────────────────────────────────────────
  eq('o título é o que o Davi pediu',
     /Programação da equipe técnica de campo/.test(prog), true);
  eq('tem o "+" que abre atividade nova JÁ como chamado de campo',
     /navigate\(\{ to: "\/chamados\/novo-campo" \}\)/.test(prog)
     && /aria-label="Nova atividade para técnico de campo"/.test(prog), true);
  eq('tem o switch semanal/mensal',
     /\(\["semanal", "mensal"\] as ModoDeVisao\[\]\)\.map/.test(prog), true);
  eq('a grade do mês tem 42 células FIXAS (6 linhas) — senão a página pularia de altura ao trocar de mês',
     /Array\.from\(\{ length: 42 \}/.test(prog), true);
  eq('tem filtro por dupla, com a opção "Sem dupla" (a fatia que o gestor precisa achar)',
     /aria-label="Filtrar por dupla"/.test(prog) && /<option value="sem_dupla">Sem dupla<\/option>/.test(prog),
     true);
  eq('tem filtro por tipo de demanda, alimentado por TIPOS_DEMANDA_CAMPO',
     /aria-label="Filtrar por tipo de demanda"/.test(prog)
     && /TIPOS_DEMANDA_CAMPO\.map\(\(t\) => \(/.test(prog), true);
  eq('CRÍTICO: os filtros valem para TUDO na tela (agenda, fila e carga do seletor) — filtram `abertas`, a raiz de todas as três',
     /const abertas = useMemo\(\(\) => emAberto\.filter\(\(o\) => \{[\s\S]{0,400}duplaDaPessoa\(o\.responsavel_id, duplasAtivas\)/.test(prog),
     true);
  eq('a agenda do dia agrupa por DUPLA (não uma linha por técnico, que separaria em dois o trabalho feito junto)',
     /const porGrupo = useMemo/.test(prog) && /for \(const d of duplasAtivas\)/.test(prog), true);
  eq('técnico fora de dupla continua tendo grupo próprio (ninguém some da agenda)',
     /sub: "Sem dupla"/.test(prog), true);
  eq('o vazio explica que é o FILTRO quando há filtro (não deixa parecer que o dia está vazio)',
     /filtrando \? "Nada programado neste dia com esse filtro"/.test(prog), true);

  // ── o painel operacional (R58) ──────────────────────────────────────────
  eq('os 4 atalhos "Ir para" saíram do painel operacional',
     /const ATALHOS: AtalhoPainel\[\] = \[\];/.test(pop), true);
  eq('PainelBase esconde a seção inteira quando não há atalho — não sobra um "Ir para" órfão',
     /\{visiveis\.length > 0 && \(/.test(fs29.readFileSync('src/features/paineis/PainelBase.tsx', 'utf8')),
     true);
  eq('o painel tem o botão que abre o pop-up de cadastro de duplas',
     /setDuplasAberto\(true\)/.test(pop) && /<DialogoDuplas aberto=\{duplasAberto\}/.test(pop), true);
  eq('o gráfico é de LINHAS (pedido explícito), uma <Line> por dupla ativa',
     /<LineChart data=\{serieDuplas\}/.test(pop)
     && /duplasAtivas\.map\(\(d, i\) => \{[\s\S]{0,300}<Line/.test(pop), true);
  eq('cada item do eixo X é uma SEMANA',
     /<XAxis dataKey="semana"/.test(pop) && /SEMANAS_NO_GRAFICO = 12/.test(pop), true);
  eq('a legenda mostra o nome da dupla, não o uuid que é o dataKey',
     /return d \? rotuloDaDupla\(d, nomeDeTecnico\) : v;/.test(pop), true);
  eq('o painel avisa quantos atendimentos ficaram FORA de dupla (gráfico não pode sumir com trabalho em silêncio)',
     /semDuplaNaJanela > 0 && \(/.test(pop), true);
  // R67 mudou COMO o vazio é dito, não a regra. Antes o painel inteiro sumia
  // e um card largo acima explicava o que fazer. Esse card largo saiu (o
  // botão de duplas virou o cabeçalho DESTE painel), e um painel que some
  // desequilibraria a faixa de altura única — então agora o painel fica e o
  // vazio se explica DENTRO dele. O que segue proibido é o mesmo: moldura de
  // gráfico vazia sem uma palavra sobre o próprio vazio.
  eq('sem dupla cadastrada, o painel explica o vazio em vez de mostrar moldura de gráfico sem linha',
     /duplasAtivas\.length === 0 \? \(/.test(pop)
     && /Nenhuma dupla cadastrada — cadastre em/.test(pop), true);
  eq('o gráfico de linhas só é montado quando HÁ dupla (o ramo else do vazio)',
     /Nenhuma dupla cadastrada[\s\S]{0,600}<LineChart data=\{serieDuplas\}/.test(pop), true);
  // R68 trocou a paleta categórica local pelo ESPECTRO — a rampa oficial da
  // casa, a mesma da Início. A regra que a asserção guarda é a de sempre:
  // a cor sai de paleta.ts, não de um hex digitado na tela.
  eq('o gráfico usa a rampa oficial (ESPECTRO), sem inventar cor',
     /stroke=\{`url\(#op-dupla-\$\{passo\}\)`\}/.test(pop)
     && /const passo = i % PECAS_ESPECTRO;/.test(pop), true);

  // ── o pop-up de duplas (R56) ────────────────────────────────────────────
  eq('as opções vêm dos USUÁRIOS do sistema (useTecnicos), como o Davi pediu',
     /useTecnicos\(\)/.test(dlg), true);
  eq('quem já está em outra dupla ativa não é oferecido (o banco recusaria; oferecer seria convidar ao erro)',
     /const disponiveis = \(excetoEsteCampo: string\)/.test(dlg), true);
  eq('desfazer uma dupla DESATIVA, não apaga — o histórico do gráfico depende dela',
     /tipo: "desativar"/.test(dlg) && /tipo: "reativar"/.test(dlg), true);
  eq('valida no cliente antes de gravar, com a mesma função pura testada acima',
     /const erro = erroDaDupla\(/.test(dlg), true);

  // ── R59: cadastrar usuário não depende do e-mail sair ───────────────────
  eq('CRÍTICO: se o convite por e-mail falhar, createUser cria a conta assim mesmo — o cadastro não pode ficar em NADA',
     /if \(inviteErr\) \{[\s\S]{0,600}supabaseAdmin\.auth\.admin\.createUser\(\{/.test(conv), true);
  eq('e-mail já cadastrado é tratado à parte (não vira uma segunda conta com o mesmo e-mail)',
     /Já existe um usuário com este e-mail\./.test(conv), true);
  eq('a função devolve emailEnviado para a tela poder avisar que o convite não saiu',
     /return \{ success: true, user_id: userId, emailEnviado \};/.test(conv), true);
  {
    const usr = fs29.readFileSync('src/routes/_authenticated/gerencial.usuarios.tsx', 'utf8');
    eq('a tela avisa quando a conta foi criada mas o e-mail não saiu (não deixa o admin esperando um e-mail que não vem)',
       /if \(r\?\.emailEnviado === false\)/.test(usr), true);
    eq('cadastrar um usuário invalida as listas que montam dupla/programação/responsável — ele aparece na hora',
       /queryKey: \["pessoas-ativas"\]/.test(usr) && /queryKey: \["tecnicos-ativos"\]/.test(usr), true);
  }

  const produto5 = fs29.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R56 (duplas), R57 (programação), R58 (painel) e R59 (usuário sem e-mail) estão documentados',
     /\*\*R56\*\*/.test(produto5) && /\*\*R57\*\*/.test(produto5)
     && /\*\*R58\*\*/.test(produto5) && /\*\*R59\*\*/.test(produto5), true);
}

// ── PGRST201: o embed de cliente a partir de `chamados` precisa da DICA ─────
//
// Quebra de produção real (2026-08-22): assim que a U45 criou
// `chamado_clientes`, passaram a existir DOIS caminhos de `chamados` para
// `clientes` — a FK direta (`cliente_id`, o cliente principal) e o N:N pela
// tabela de junção. O PostgREST recusa embed ambíguo com PGRST201 e a
// consulta INTEIRA falha: a Home parou de carregar as atividades.
//
// A dica é o NOME DA COLUNA (`!cliente_id`), não o da constraint: `chamados`
// nasceu como `ordens_servico` e o rename de tabela não renomeia constraints,
// então a FK real ainda se chama `ordens_servico_cliente_id_fkey`.
//
// Estas asserções seguram as TRÊS consultas que leem de `chamados`. As demais
// (visitas_tecnicas, cobrancas, contratos, projetos) não têm segundo caminho
// para `clientes` e continuam sem dica de propósito.
{
  const fs30 = require('fs');
  // Cada alvo é a REGIÃO exata da consulta que lê de `chamados` — não o
  // arquivo inteiro. home/data.ts, por exemplo, também declara CAMPOS_VISITA,
  // que lê de `visitas_tecnicas` e continua sem dica com razão.
  const recorte = (txt, de, ate) => {
    const i = txt.indexOf(de);
    return i < 0 ? '' : txt.slice(i, txt.indexOf(ate, i) + 1);
  };
  const home = fs30.readFileSync('src/features/home/data.ts', 'utf8');
  const chdata = fs30.readFileSync('src/features/chamados/data.ts', 'utf8');
  const cal = fs30.readFileSync('src/routes/_authenticated/calendario.tsx', 'utf8');

  const alvos = [
    ['CAMPOS_CHAMADO (a Home — foi esta que caiu)',
     recorte(home, 'const CAMPOS_CHAMADO =', ';')],
    ['CAMPOS de chamados/data.ts',
     recorte(chdata, 'const CAMPOS =', ';')],
    ['a consulta de chamados do Calendário',
     recorte(cal, '.select("id, numero, status, tipo, natureza', ')')],
  ];
  for (const [oQue, trecho] of alvos) {
    // só as linhas de CÓDIGO: os comentários explicam o bug e citam a forma
    // ambígua de propósito
    const cod = trecho.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    eq(`PGRST201: ${oQue} embute cliente com a dica !cliente_id`,
       /clientes!cliente_id\(/.test(cod), true);
    eq(`PGRST201: ${oQue} não tem embed de cliente SEM dica (voltaria a quebrar)`,
       /(^|[^!\w])clientes\(/.test(cod), false);
  }
  // e a região de CAMPOS_VISITA continua sendo de visitas_tecnicas — se um dia
  // ela virar consulta de chamados, esta asserção lembra de pôr a dica
  eq('CAMPOS_VISITA continua lendo de visitas_tecnicas (por isso segue sem dica)',
     /supabase\.from\("visitas_tecnicas"\)\.select\(CAMPOS_VISITA\)/.test(home), true);
}

// ── R60: Início — Ordenar vira ícone, KPIs viram filtro, barra de filtros
//    (situação sai, período vira prazo, equipe entra) (2026-08-22) ─────────
{
  const fs31 = require('fs');
  const MF = fs31.readFileSync('src/features/home/MenuFiltro.tsx', 'utf8');
  const L2 = carregar('src/features/home/lentes.ts');
  const MET = carregar('src/features/home/metricas.ts');
  const dash2 = fs31.readFileSync('src/routes/_authenticated/dashboard.tsx', 'utf8');

  // ── MenuFiltro: variante ícone-só ────────────────────────────────────────
  eq('MenuFiltro aceita um ícone e vira botão quadrado sem texto',
     /icone\?: LucideIcon;/.test(MF) && /Icone \? \(/.test(MF), true);
  eq('o botão-ícone tem aria-label e title com o rótulo (ícone sozinho não é acessível sem isso)',
     /aria-label=\{ativo \? `\$\{rotulo\}: \$\{resumo\}` : rotulo\}/.test(MF), true);

  // ── dashboard.tsx: a lupa quebrada virou o ícone de Ordenar ──────────────
  eq('Ordenar agora é ícone (ArrowUpDown), não mais uma pílula de texto',
     /icone=\{ArrowUpDown\}/.test(dash2), true);
  eq('a pílula de texto "Ordenar" (com vazio="Padrão") saiu da barra',
     /rotulo="Ordenar"\s*\n\s*vazio="Padrão"/.test(dash2), false);
  eq('CRÍTICO: a lupa de busca só existe no celular agora — no desktop ela não fazia nada (o campo já fica sempre visível)',
     /className="so-celular"\s*\n\s*onClick=\{\(\) => \{\s*\n\s*if \(buscaAberta\)/.test(dash2), true);

  // ── Situação saiu, incondicional em aplicarLentes ────────────────────────
  eq('o filtro "Situação" saiu da barra (nem MenuFiltro, nem campo em Filtros)',
     /rotulo="Situação"/.test(dash2), false);
  eq('Filtros não tem mais o campo situacao', /situacao:/.test(dash2), false);
  eq('aplicarLentes esconde encerrado INCONDICIONALMENTE agora (Situação não existe mais pra escolher)',
     /if \(!a\.emAberto\) return false;/.test(fs31.readFileSync('src/features/home/lentes.ts', 'utf8')),
     true);
  {
    const abertoI = { emAberto: true, souResponsavel: false, souApoio: false, souAutor: false,
      responsavelId: null, equipe: null, sprint: null, quando: null, coluna: 'aberto' };
    const fechadoI = { ...abertoI, emAberto: false, coluna: 'concluido' };
    const ctxR60 = { agora: new Date(2026, 7, 21), minhaEquipe: null };
    eq('aplicarLentes: aberto passa', L2.aplicarLentes([abertoI], L2.FILTROS_INICIAIS, ctxR60, (x) => x).length, 1);
    eq('aplicarLentes: encerrado NUNCA passa, mesmo sem nenhum filtro escolhido',
       L2.aplicarLentes([fechadoI], L2.FILTROS_INICIAIS, ctxR60, (x) => x).length, 0);
  }

  // ── Prazo (era Período) — reaproveita sprintDoPrazo ──────────────────────
  eq('Prazo tem as 4 opções que o Davi pediu, na ordem',
     /const PRAZOS: \{ chave: Exclude<Prazo, null>; label: string \}\[\] = \[\s*\n\s*\{ chave: "hoje", label: "Hoje" \},\s*\n\s*\{ chave: "essa_semana", label: "Essa semana" \},\s*\n\s*\{ chave: "semana_que_vem", label: "Semana que vem" \},\s*\n\s*\{ chave: "este_mes", label: "Este mês" \},\s*\n\s*\];/.test(dash2),
     true);
  eq('dentroDoPrazo reaproveita sprintDoPrazo — não reimplementa limite de semana/mês',
     /return sprintDoPrazo\(a\.quando, agora\) === p;/.test(fs31.readFileSync('src/features/home/lentes.ts', 'utf8')),
     true);
  {
    const ctxR60 = { agora: new Date(2026, 7, 21), minhaEquipe: null }; // 21/ago/2026, sexta
    const comData = (iso) => ({
      emAberto: true, souResponsavel: false, souApoio: false, souAutor: false,
      responsavelId: null, equipe: null, sprint: null, quando: iso, coluna: 'aberto',
    });
    eq('Prazo "hoje" casa só com hoje',
       L2.aplicarLentes([comData('2026-08-21T09:00:00')], { ...L2.FILTROS_INICIAIS, prazo: 'hoje' }, ctxR60, (x) => x).length,
       1);
    eq('Prazo "hoje" não casa com amanhã',
       L2.aplicarLentes([comData('2026-08-22T09:00:00')], { ...L2.FILTROS_INICIAIS, prazo: 'hoje' }, ctxR60, (x) => x).length,
       0);
    // R40: vencido cai em "essa_semana" (sprintDoPrazo), e o filtro de Prazo
    // herda isso automaticamente por reaproveitar a mesma função
    eq('Prazo "essa_semana" ENGOLE o vencido (mesma regra de sprintDoPrazo/R40)',
       L2.aplicarLentes([comData('2026-08-01T09:00:00')], { ...L2.FILTROS_INICIAIS, prazo: 'essa_semana' }, ctxR60, (x) => x).length,
       1);
    // este_mes precisa de "agora" longe o bastante do fim do mês — com
    // agora=21/ago, o balde de 2 semanas (semana_que_vem) já engole quase
    // agosto inteiro, e um teste com agora=21 não sobraria alvo pra "este
    // mês" testar de verdade. Ctx própria, cedo no mês.
    const ctxCedoNoMes = { agora: new Date(2026, 7, 1), minhaEquipe: null }; // 01/ago/2026
    eq('Prazo "este_mes" casa com fim de agosto (fora do balde de 2 semanas, dentro do mês)',
       L2.aplicarLentes([comData('2026-08-31T09:00:00')], { ...L2.FILTROS_INICIAIS, prazo: 'este_mes' }, ctxCedoNoMes, (x) => x).length,
       1);
    eq('Prazo "este_mes" NÃO casa com setembro',
       L2.aplicarLentes([comData('2026-09-05T09:00:00')], { ...L2.FILTROS_INICIAIS, prazo: 'este_mes' }, ctxCedoNoMes, (x) => x).length,
       0);
  }

  // ── Equipe (novo) ─────────────────────────────────────────────────────────
  eq('o filtro Equipe está na barra, com as opções de lib/equipes.ts',
     /rotulo="Equipe"[\s\S]{0,200}opcoes=\{EQUIPES\.map/.test(dash2), true);
  {
    const ctxR60 = { agora: new Date(2026, 7, 21), minhaEquipe: null };
    const daEquipe = (eq_) => ({
      emAberto: true, souResponsavel: false, souApoio: false, souAutor: false,
      responsavelId: null, equipe: eq_, sprint: null, quando: null, coluna: 'aberto',
    });
    eq('Equipe "todas" (o padrão) não filtra nada',
       L2.aplicarLentes([daEquipe('tecnica'), daEquipe(null)], L2.FILTROS_INICIAIS, ctxR60, (x) => x).length,
       2);
    eq('escolher uma equipe fica só com quem é dela',
       L2.aplicarLentes([daEquipe('tecnica'), daEquipe('comercial')],
                        { ...L2.FILTROS_INICIAIS, equipe: 'tecnica' }, ctxR60, (x) => x).length,
       1);
    eq('CRÍTICO: quem não tem equipe (campo/comercial, invariante do modelo) some quando uma equipe é escolhida — não é bug, é a definição',
       L2.aplicarLentes([daEquipe(null)], { ...L2.FILTROS_INICIAIS, equipe: 'tecnica' }, ctxR60, (x) => x).length,
       0);
  }

  // ── Os 4 KPIs viram filtro ao clicar ─────────────────────────────────────
  const agoraKpi = new Date(2026, 7, 21); // agosto de 2026
  const diaK = (s) => new Date(s).toISOString();
  const atK = (extra) => ({
    id: 'k-' + Math.random(), natureza: 'interno', sprint: 'este_mes',
    coluna: 'concluido', emAberto: false, encerradoEm: diaK('2026-08-10T10:00:00'),
    tipo: null, prioridade: null, prazoEstourado: false,
    ...extra,
  });

  eq('KPI_LABEL tem as 4 chaves, com os rótulos exatos dos tiles',
     MET.KPI_LABEL,
     {
       concluidas_mes: 'Concluídas no mês', faltam_mes: 'Faltam no mês',
       corretivas_urgentes: 'Corretivas urgentes', atrasadas_aberto: 'Atrasadas em aberto',
     });

  eq('concluidas_mes: encerrado este mês entra',
     MET.atividadesDoKpi('concluidas_mes', [atK({})], agoraKpi).length, 1);
  eq('concluidas_mes: em aberto NÃO entra (ainda não foi concluído)',
     MET.atividadesDoKpi('concluidas_mes', [atK({ emAberto: true, coluna: 'aberto', encerradoEm: null })], agoraKpi).length,
     0);
  eq('faltam_mes: em aberto do mês entra',
     MET.atividadesDoKpi('faltam_mes', [atK({ emAberto: true, coluna: 'aberto', encerradoEm: null })], agoraKpi).length,
     1);
  eq('faltam_mes: já concluído NÃO entra (não é mais "falta")',
     MET.atividadesDoKpi('faltam_mes', [atK({})], agoraKpi).length, 0);
  eq('corretivas_urgentes: aberta + corretiva + urgente entra',
     MET.atividadesDoKpi('corretivas_urgentes',
       [atK({ emAberto: true, tipo: 'corretiva', prioridade: 'urgente' })], agoraKpi).length,
     1);
  eq('corretivas_urgentes: corretiva mas NÃO urgente fica de fora',
     MET.atividadesDoKpi('corretivas_urgentes',
       [atK({ emAberto: true, tipo: 'corretiva', prioridade: 'alta' })], agoraKpi).length,
     0);
  eq('corretivas_urgentes: urgente mas encerrada fica de fora',
     MET.atividadesDoKpi('corretivas_urgentes',
       [atK({ emAberto: false, tipo: 'corretiva', prioridade: 'urgente' })], agoraKpi).length,
     0);
  eq('atrasadas_aberto: aberta + prazo estourado entra',
     MET.atividadesDoKpi('atrasadas_aberto', [atK({ emAberto: true, prazoEstourado: true })], agoraKpi).length,
     1);
  eq('atrasadas_aberto: prazo estourado mas já encerrada fica de fora (não é mais um problema em aberto)',
     MET.atividadesDoKpi('atrasadas_aberto', [atK({ emAberto: false, prazoEstourado: true })], agoraKpi).length,
     0);

  // A GARANTIA CENTRAL do recurso: o tile e a lista que ele abre NUNCA podem
  // discordar. metaDoMes (o número do painel antigo) e atividadesDoKpi (o
  // clique) precisam contar exatamente o mesmo tanto, em qualquer conjunto.
  {
    const conjunto = [
      atK({}),                                                          // concluída este mês
      atK({ emAberto: true, coluna: 'aberto', encerradoEm: null }),      // falta este mês
      atK({ emAberto: true, coluna: 'aberto', encerradoEm: null }),      // falta este mês
      atK({ encerradoEm: diaK('2026-07-15T10:00:00') }),                 // fora do mês — não conta em nenhum
    ];
    const m = MET.metaDoMes(conjunto, agoraKpi);
    eq('CRÍTICO: metaDoMes.feitas === atividadesDoKpi("concluidas_mes").length — o número do tile e o tamanho da lista NUNCA discordam',
       MET.atividadesDoKpi('concluidas_mes', conjunto, agoraKpi).length, m.feitas);
    eq('CRÍTICO: (metaDoMes.total - .feitas) === atividadesDoKpi("faltam_mes").length — mesma garantia, para o outro tile',
       MET.atividadesDoKpi('faltam_mes', conjunto, agoraKpi).length, m.total - m.feitas);
  }

  // ── Graficos.tsx: PainelKpis fica clicável ───────────────────────────────
  const graf = fs31.readFileSync('src/features/home/Graficos.tsx', 'utf8');
  eq('PainelKpis aceita ativo/onSelecionar e cada tile é um <button>, não uma <div> muda',
     /ativo\?: ChaveKpi \| null;/.test(graf) && /onSelecionar\?: \(chave: ChaveKpi\) => void;/.test(graf)
     && /<button\s*\n\s*key=\{k\.chave\}\s*\n\s*onClick=\{\(\) => onSelecionar\?\.\(k\.chave\)\}/.test(graf),
     true);
  eq('o tile ativo ganha destaque visual (borda/halo na própria cor) — senão o clique não teria feedback nenhum',
     /border: selecionado \? `1\.5px solid \$\{k\.cor\}`/.test(graf), true);
  eq('PainelKpis usa UMA função só (atividadesDoKpi) pra contar — não reimplementa os 4 filtros na tela',
     /\.map\(\(k\) => \(\{ \.\.\.k, rotulo: KPI_LABEL\[k\.chave\], valor: atividadesDoKpi\(k\.chave, atividades\)\.length \}\)\)/.test(graf),
     true);

  // ── dashboard.tsx: o clique realmente troca o que a lista/quadro mostram ──
  // (R65 generalizou o estado: kpiSelecionado virou selecaoPainel, cobrindo
  // KPIs + barras + rosca sob um tipo só — as garantias são as mesmas)
  eq('dashboard mantém a seleção do painel LOCAL (não entra em Filtros/sessionStorage — é drill-down, não preferência)',
     /const \[selecaoPainel, setSelecaoPainel\] = useState<SelecaoPainel \| null>\(null\);/.test(dash2), true);
  eq('atividadesSelecao roda sobre paraPaineis — a MESMA base que as peças do painel contam, não `atividades` cru nem `filtradas`',
     /atividadesDaSelecao\(selecaoPainel, paraPaineis, agora\)/.test(dash2), true);
  eq('CRÍTICO: listaAtual (o que quadro/tabela realmente recebem) prioriza o recorte da seleção sobre o filtro normal',
     /const listaAtual = atividadesSelecao \?\? filtradas;/.test(dash2), true);
  eq('CRÍTICO: o Quadro (kanban) usa listaAtual, não filtradas direto — senão clicar uma peça do painel não mudaria a visão de quadro',
     /<Quadro\s*\n\s*atividades=\{listaAtual\}/.test(dash2), true);
  eq('CRÍTICO: a TabelaAtividades (lista) usa listaAtual, não filtradas direto',
     /<TabelaAtividades\s*\n\s*atividades=\{listaAtual\.slice\(0, TETO_TABELA\)\}/.test(dash2), true);
  eq('selecionar a mesma peça de novo desliga o filtro (toggle, não só liga) — nos três: kpi, semana e meta',
     /atual\?\.tipo === "kpi" && atual\.chave === chave \? null : \{ tipo: "kpi", chave \}/.test(dash2)
     && /atual\?\.tipo === "semana" && atual\.chave === chave \? null : \{ tipo: "semana", chave, rotulo, passado \}/.test(dash2)
     && /atual\?\.tipo === "meta" \? null : \{ tipo: "meta" \}/.test(dash2), true);
  eq('a tela mostra "Mostrando: <label>" com um jeito de limpar, enquanto uma seleção filtra',
     /Mostrando: <strong[\s\S]{0,80}\{rotuloDaSelecao\(selecaoPainel\)\}<\/strong>/.test(dash2), true);

  const produto6 = fs31.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R60 está documentado', /\*\*R60\*\*/.test(produto6), true);
}

// ── R61: Clientes vira tela fixa a partir de 1024px (2026-08-22) ───────────
{
  const fs32 = require('fs');
  const cl3 = fs32.readFileSync('src/routes/_authenticated/clientes.tsx', 'utf8');
  const css3 = fs32.readFileSync('src/styles.css', 'utf8');

  eq('a página usa a classe .clientes-tela-fixa, além de .sangra-x',
     /className="sangra-x clientes-tela-fixa"/.test(cl3), true);
  // R71 encolheu a reserva de baixo: os 110px do <main> existem por causa da
  // barra do CELULAR, que não existe a partir de 1024px. A regra que a
  // asserção guarda continua a mesma — travar altura só no desktop.
  eq('.clientes-tela-fixa só trava altura a partir de 1024px — no celular a página continua crescendo/rolando',
     /@media \(min-width: 1024px\) \{[\s\S]{0,900}\.clientes-tela-fixa \{[\s\S]{0,900}height: calc\(100dvh - var\(--topo\) - var\(--rodape-fixo\)\);\s*\n\s*overflow: hidden;/.test(css3),
     true);
  eq('R71: a margem morta de baixo é devolvida — o <main> reserva 110px para a barra do celular, que no desktop não existe',
     /margin-bottom: calc\(-110px \+ var\(--rodape-fixo\)\);/.test(css3), true);
  eq('a margem superior encolheu (era 18/40, R55) — agora 8/8',
     /paddingTop: 8, paddingBottom: 8, display: "flex", flexDirection: "column", gap: 10,/.test(cl3),
     true);

  // ── Situação + Serviço: um painel só, agora atrás do botão redondo (R71) ─
  // O cartão único continua sendo a regra (são dois EIXOS que se combinam);
  // o que mudou é que ele só ocupa altura quando está aberto.
  eq('Situação e Serviço moram no MESMO cartão (card(isLight)), não em duas fileiras soltas',
     /\{filtrosAbertos && \(\s*\n\s*<div style=\{\{\s*\n\s*\.\.\.card\(isLight\), borderRadius: 14/.test(cl3), true);
  eq('as duas fileiras de chip (situação, serviço) estão DENTRO desse cartão único',
     /\{filtrosAbertos && \([\s\S]{0,900}\["todos", `Todos · \$\{contagem\.todos\}`\][\s\S]{0,1200}Serviço/.test(cl3),
     true);

  // ── A coluna da lista rola por dentro; a página, não ─────────────────────
  eq('CRÍTICO: .clientes-duas-colunas ganha flex:1 + minHeight:0 — sem isso a rolagem vazaria pra página inteira',
     /className="clientes-duas-colunas" style=\{\{ flex: 1, minHeight: 0 \}\}/.test(cl3), true);
  // R71 aposentou a rolagem da lista: ela agora CABE, em vez de rolar (as
  // asserções do novo comportamento estão no bloco da R71, mais abaixo).
  eq('a lista não rola mais — quem dá a altura de cada cartão é a grade de 10 linhas',
     /className="clientes-lista" style=\{\{ flex: 1, minHeight: 0 \}\}/.test(cl3)
     && /rolagem-fina/.test(cl3) === false,
     true);
  eq('CRÍTICO: a paginação fica FORA da região que rola — sempre visível, sem precisar rolar até ela',
     /\)\}\s*\n\s*<\/div>\s*\n\s*\n\s*\{\/\* Paginação/.test(cl3), true);
  eq('align-content:stretch explícito no grid — a linha única ocupa o teto inteiro que .clientes-tela-fixa dá',
     /align-content: stretch;/.test(css3), true);

  const produto7 = fs32.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R61 está documentado', /\*\*R61\*\*/.test(produto7), true);
}

// ── R62: mapa de Clientes — texto não seleciona, balão fecha ao sair do
//    ponto (2026-08-22) ─────────────────────────────────────────────────────
{
  const fs33 = require('fs');
  const mc3 = fs33.readFileSync('src/features/clientes/MapaClientes.tsx', 'utf8');

  eq('o <svg> do mapa tem user-select:none (nos 3 prefixos) — arrastar não pode selecionar o nome de um bairro',
     /userSelect: "none",\s*\n\s*WebkitUserSelect: "none",\s*\n\s*MozUserSelect: "none",/.test(mc3),
     true);
  eq('user-select:none está no <svg> em si (style do elemento), não só num filho — vale pro mapa inteiro',
     /<svg\s*\n\s*ref=\{svgRef\}[\s\S]{0,3200}userSelect: "none",/.test(mc3), true);

  eq('CRÍTICO: cada ponto de cliente tem onMouseLeave, não só o <svg> — senão sair do ponto pra uma área vazia deixava o balão preso',
     /onMouseEnter=\{\(\) => \{ if \(!arrastouRef\.current\) setAlvo\(p\); \}\}\s*\n[\s\S]{0,1300}onMouseLeave=\{\(\) => setAlvo/.test(mc3),
     true);
  eq('o onMouseLeave do ponto verifica QUAL ponto está ativo antes de limpar — não um setAlvo(null) cru',
     /onMouseLeave=\{\(\) => setAlvo\(\(atual\) => \(atual\?\.id === p\.id \? null : atual\)\)\}/.test(mc3),
     true);

  const produto8 = fs33.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R62 está documentado', /\*\*R62\*\*/.test(produto8), true);
}

// ── R63/U52: estrutura de blocos permanente do cliente ──────────────────────
{
  const fs34 = require('fs');
  const BC = carregar('src/features/clientes/blocoCliente.ts');
  const u52 = fs34.readFileSync('supabase/migrations/20260822060000_u52_estrutura_de_blocos_do_cliente.sql', 'utf8');
  const inv = fs34.readFileSync('src/features/clientes/inventario.ts', 'utf8');
  const ed = fs34.readFileSync('src/features/clientes/EditorBlocoCliente.tsx', 'utf8');
  const ic = fs34.readFileSync('src/features/clientes/InventarioCliente.tsx', 'utf8');

  // ── configPadrao: nunca abre vazio, e nunca abre já INVÁLIDO ────────────
  const BC_TIPOS = carregar('src/lib/blocos.ts');
  for (const tipo of ['PED', 'VEI', 'CFTV', 'AL', 'CER', 'CENT']) {
    eq(`configPadrao(${tipo}) já nasce válida (o formulário nunca abre "incompleto" de saída)`,
       BC.configValida(BC.configPadrao(tipo)), true);
    eq(`configPadrao(${tipo}) mantém tipoBloco correto`,
       BC.configPadrao(tipo).tipoBloco, tipo);
  }
  eq('configPadrao(PED) já gera um código de verdade, sem precisar preencher nada',
     typeof BC_TIPOS.gerarCodigoBloco(BC.configPadrao('PED')), 'string');
  eq('configPadrao(PED) tem porta como barreira 1 padrão (o caso mais comum de acesso de pedestre)',
     BC.configPadrao('PED').b1.tipo, 'PORP');

  // ── barreiraCompleta / configValida — a régua que decide "pode salvar" ──
  eq('barreira sem tipo NÃO está completa', BC.barreiraCompleta({ tipo: '', entrada: '', saida: '' }), false);
  eq('barreira ELEV completa exige tamanho E abertura (corta-fogo), não entrada/saída',
     [
       BC.barreiraCompleta({ tipo: 'ELEV', entrada: '', saida: '' }),
       BC.barreiraCompleta({ tipo: 'ELEV', entrada: '', saida: '', tamanho: '2EL' }),
       BC.barreiraCompleta({ tipo: 'ELEV', entrada: '', saida: '', tamanho: '2EL', abertura: 'PCF' }),
     ],
     [false, false, true]);
  eq('barreira PORP completa exige entrada E saída (abertura é opcional pra "completa")',
     BC.barreiraCompleta({ tipo: 'PORP', entrada: 'FAC', saida: 'FAC' }), true);
  eq('barreira PORP com entrada mas sem saída NÃO está completa',
     BC.barreiraCompleta({ tipo: 'PORP', entrada: 'FAC', saida: '' }), false);

  eq('CRÍTICO: configValida(PED sem eclusa) só olha b1 — b2 indefinido não pode reprovar quem não é eclusa',
     BC.configValida({ tipoBloco: 'PED', eclusa: false, b1: { tipo: 'PORP', entrada: 'FAC', saida: 'FAC' } }),
     true);
  eq('configValida(PED COM eclusa) exige b1 E b2 completos',
     [
       BC.configValida({ tipoBloco: 'PED', eclusa: true, b1: { tipo: 'PORP', entrada: 'FAC', saida: 'FAC' } }),
       BC.configValida({
         tipoBloco: 'PED', eclusa: true,
         b1: { tipo: 'PORP', entrada: 'FAC', saida: 'FAC' },
         b2: { tipo: 'PORP', entrada: 'FAC', saida: 'FAC' },
       }),
     ],
     [false, true]);
  eq('configValida(CFTV) exige tecnologia',
     [BC.configValida({ tipoBloco: 'CFTV', eclusa: false }),
      BC.configValida({ tipoBloco: 'CFTV', eclusa: false, tecnologia: 'IP' })],
     [false, true]);
  eq('configValida(CER) aceita perímetro/esquinas zerados — "ainda não medido" é um estado válido, não um erro',
     BC.configValida({ tipoBloco: 'CER', eclusa: false, perimetro: 0, esquinas: 0 }), true);
  eq('configValida(CENT) exige portaria escolhida',
     [BC.configValida({ tipoBloco: 'CENT', eclusa: false }),
      BC.configValida({ tipoBloco: 'CENT', eclusa: false, portaria: 'PR' })],
     [false, true]);

  // A garantia central do editor: toda config que configValida aprova
  // PRECISA gerar um código de verdade — senão "válido" mentiria
  {
    const validas = [
      BC.configPadrao('PED'), BC.configPadrao('VEI'), BC.configPadrao('CFTV'),
      BC.configPadrao('AL'), BC.configPadrao('CER'), BC.configPadrao('CENT'),
      { tipoBloco: 'PED', eclusa: true,
        b1: { tipo: 'CAT', entrada: 'FAC', saida: 'FAC' },
        b2: { tipo: 'ELEV', entrada: '', saida: '', tamanho: '2EL', abertura: 'PCF' }, portaria: 'PP' },
      { tipoBloco: 'VEI', eclusa: false, b1: { tipo: 'PORV', entrada: 'TAG', saida: 'TAG', abertura: 'PIVO', tamanho: '350CM', folhas: '2F' }, portaria: 'PR' },
    ];
    const todasGeramCodigo = validas.every((c) => typeof BC_TIPOS.gerarCodigoBloco(c) === 'string' && BC_TIPOS.gerarCodigoBloco(c).length > 0);
    eq('CRÍTICO: TODA config aprovada por configValida gera um codigo_bloco de verdade (não undefined/buraco)',
       todasGeramCodigo, true);
  }

  // ── a migration ─────────────────────────────────────────────────────────
  eq('U52 adiciona codigo_bloco e config_bloco em cliente_sistemas (não cria tabela nova)',
     /ALTER TABLE public\.cliente_sistemas\s*\n\s*ADD COLUMN IF NOT EXISTS codigo_bloco text,\s*\n\s*ADD COLUMN IF NOT EXISTS config_bloco jsonb;/.test(u52),
     true);
  eq('U52 NÃO cria tabela nova (é extensão de cliente_sistemas, a mesma "bloco no mundo real" da Etapa 2)',
     /CREATE TABLE/.test(u52), false);
  eq('U52 não faz backfill — sistema antigo fica com config_bloco NULL, não "estruturado errado"',
     /esperado 0 — sem backfill/.test(u52), true);
  eq('U52 termina com SELECT de verificação', /Verificação/.test(u52), true);

  // ── inventario.ts ────────────────────────────────────────────────────────
  eq('SistemaInstalado carrega codigo_bloco/config_bloco',
     /codigo_bloco: string \| null;\s*\n\s*config_bloco: BlocoConfig \| null;/.test(inv), true);
  eq('useInventario busca as duas colunas novas',
     /codigo_bloco, config_bloco/.test(inv), true);
  eq('TIPOS_COM_ESTRUTURA é EXATAMENTE os 6 tipos que gerarCodigoBloco sabe montar (ELV/TOT ficam de fora, de propósito)',
     inv.match(/export const TIPOS_COM_ESTRUTURA: TipoBloco\[\] = \[([^\]]+)\];/)?.[1].replace(/[\s"]/g, ''),
     'PED,VEI,CFTV,AL,CER,CENT');
  eq('salvarConfigBloco grava codigo_bloco E descricao, os dois DERIVADOS da config (não digitados à parte)',
     /const codigo_bloco = gerarCodigoBloco\(config\);\s*\n\s*const descricao = gerarDescricaoBloco\(config\);/.test(inv),
     true);

  // ── EditorBlocoCliente.tsx ───────────────────────────────────────────────
  eq('o editor usa a MESMA useModalEstilos/BotaoFechar da ficha do cliente — não inventa uma segunda casca de modal',
     /import \{ useModalEstilos, BotaoFechar \} from "\.\/InventarioCliente";/.test(ed), true);
  eq('a prévia do código roda ao vivo (useMemo sobre gerarCodigoBloco), antes de salvar',
     /const codigo = useMemo\(\(\) => \(configValida\(config\) \? gerarCodigoBloco\(config\) : null\), \[config\]\);/.test(ed),
     true);
  eq('o botão Salvar fica desabilitado enquanto a config não é válida — não dá pra gravar um bloco pela metade',
     /disabled=\{salvar\.isPending \|\| !valido\}/.test(ed), true);
  eq('trocar o TIPO da barreira reseta entrada/saída — não herda opção de uma lista que já não se aplica',
     /aoMudar=\{\(tipo\) => aoMudar\(\{ tipo, entrada: "", saida: "" \}\)\}/.test(ed), true);
  eq('trocar a ABERTURA reseta peso/folhas/tamanho — MOL tinha peso, PIVO/BASC têm tamanho, não é o mesmo campo',
     /peso: undefined, folhas: undefined, tamanho: undefined,/.test(ed), true);
  eq('DESL não pergunta peso — mesma regra fixa do wizard original (só um motor em uso)',
     /DESL: sem pergunta de peso/.test(ed), true);

  // ── wiring na ficha do cliente ───────────────────────────────────────────
  eq('InventarioCliente só oferece "Configurar bloco" para quem tem estrutura (temEstrutura)',
     /\{temEstrutura\(s\.tipo\) && \(/.test(ic), true);
  eq('o botão troca de rótulo depois de configurado — "Configurar bloco" vira "Editar estrutura"',
     /\{s\.codigo_bloco \? "Editar estrutura" : "Configurar bloco"\}/.test(ic), true);
  eq('o código do bloco aparece no card, quando existe — sem precisar abrir o editor pra ver se já está estruturado',
     /\{s\.codigo_bloco && \(/.test(ic), true);
  eq('o modal "bloco" está fiado (setModal + render do EditorBlocoCliente)',
     /setModal\(\{ tipo: "bloco", sistema: s \}\)/.test(ic) && /modal\?\.tipo === "bloco" &&/.test(ic),
     true);

  const produto9 = fs34.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R63 está documentado', /\*\*R63\*\*/.test(produto9), true);
}

// ── R64: Painel Comercial vira lista única — etapas do ciclo (2026-08-22) ──
{
  const fs35 = require('fs');
  const ET2 = carregar('src/features/comercial/etapas.ts');
  const ger2 = fs35.readFileSync('src/routes/_authenticated/gerencial.tsx', 'utf8');

  const v = (status, enviada) => ({ status, proposta_enviada_em: enviada ?? null });

  // ── etapaDaVisita: o mapa do ciclo ──────────────────────────────────────
  eq('pendente → visita pendente', ET2.etapaDaVisita(v('pendente')), 'visita_pendente');
  eq('em_andamento → visita pendente (o técnico ainda não terminou de ir)',
     ET2.etapaDaVisita(v('em_andamento')), 'visita_pendente');
  eq('concluida → aguardando aprovação (visita feita, orçamento em análise interna)',
     ET2.etapaDaVisita(v('concluida')), 'aguardando_aprovacao');
  eq('aguardando_aprovacao → aguardando aprovação',
     ET2.etapaDaVisita(v('aguardando_aprovacao')), 'aguardando_aprovacao');
  eq('aprovada SEM envio → falta enviar proposta',
     ET2.etapaDaVisita(v('aprovada')), 'falta_proposta');
  eq('cancelada e reprovada caem na mesma cesta terminal',
     [ET2.etapaDaVisita(v('cancelada')), ET2.etapaDaVisita(v('reprovada'))],
     ['cancelada', 'cancelada']);
  eq('CRÍTICO: proposta_enviada_em VENCE o status — depois do envio o status continua "aprovada" no banco, e sem a precedência toda enviada leria "falta enviar" para sempre',
     ET2.etapaDaVisita(v('aprovada', '2026-08-20T10:00:00Z')), 'enviada');
  eq('status desconhecido não some da lista — cai em visita pendente',
     ET2.etapaDaVisita(v('status_inventado')), 'visita_pendente');
  eq('status null tolerado', ET2.etapaDaVisita(v(null)), 'visita_pendente');

  // ── contagem e funil contam da MESMA função ─────────────────────────────
  {
    const lote = [
      v('pendente'), v('em_andamento'), v('concluida'),
      v('aprovada'), v('aprovada', '2026-08-01T10:00:00Z'), v('cancelada'),
    ];
    eq('contagemPorEtapa fecha com o lote',
       ET2.contagemPorEtapa(lote),
       { visita_pendente: 2, aguardando_aprovacao: 1, falta_proposta: 1, enviada: 1, cancelada: 1 });
    eq('o funil tem TRÊS estágios e termina no envio (aceite do cliente não é mapeado — R64)',
       ET2.funilComercial(lote), { visitas: 6, aprovadas: 2, enviadas: 1 });
  }
  eq('CRÍTICO: o funil é CUMULATIVO — a enviada conta como aprovada, senão o estágio 2 fica menor que o 3 e lê como erro de conta',
     ET2.funilComercial([v('aprovada', '2026-08-01T10:00:00Z')]),
     { visitas: 1, aprovadas: 1, enviadas: 1 });

  // ── cores: pares claro/escuro de verdade (anti-padrão §8 nº 3) ──────────
  eq('nenhuma etapa usa #F8C811 como texto no tema claro (2:1 sobre branco — o bug do STATUS_CONFIG antigo)',
     Object.values(ET2.ETAPA_CORES).some((c) => c.light.toUpperCase() === '#F8C811'), false);
  eq('toda etapa tem o quarteto dark/light/bg/border (véu 12% + borda 30%, §2.4)',
     ET2.ETAPA_ORDEM.every((e) => {
       const c = ET2.ETAPA_CORES[e];
       return !!c.dark && !!c.light && /rgba\(/.test(c.bg) && /rgba\(/.test(c.border);
     }), true);
  eq('a etapa terminal se chama "Proposta enviada" — o rótulo do fim do ciclo',
     ET2.ETAPA_LABEL.enviada, 'Proposta enviada');

  // ── a página ────────────────────────────────────────────────────────────
  eq('R64: o botão Histórico saiu do Painel Comercial (terceira porta para a mesma lista)',
     /label: "Histórico"/.test(ger2), false);
  // só as linhas de CÓDIGO: o comentário do funil cita "Aceitas/Recusadas"
  // de propósito, explicando por que elas NÃO estão mais ali
  const ger2cod = ger2.split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n');
  eq('R64: "Aceitas" e "Recusadas" saíram do funil — nenhum fluxo preenche proposta_resultado desde a R38',
     /Aceitas|Recusadas|proposta_resultado/.test(ger2cod), false);
  eq('a página usa .sangra-x — era a única tela do domínio fora da régua de margem',
     /className="sangra-x"/.test(ger2), true);
  eq('título no padrão da casa: 22/600 com letterSpacing -0.01em (§3), não 24 espaçado',
     /fontSize: 22,\s*\n\s*letterSpacing: "-0\.01em"/.test(ger2), true);
  eq('o filtro por etapa é chip com contagem (padrão de Clientes), com "Todas" na frente',
     /\{`Todas · \$\{funil\.visitas\}`\}/.test(ger2) && /ETAPA_ORDEM\.map\(\(e\) => \(/.test(ger2), true);
  eq('o chip de cada linha vem de ETAPA_CORES/ETAPA_LABEL — a mesma função do filtro e do funil',
     /const et = etapaDaVisita\(v\);/.test(ger2) && /\{ETAPA_LABEL\[et\]\}/.test(ger2), true);
  eq('o chip da linha leva ícone junto da cor (status nunca é só cor, §2.4)',
     /<Icone size=\{13\} \/>/.test(ger2), true);
  eq('a linha enviada mostra QUANDO foi enviada (o carimbo que encerrou o ciclo)',
     /Enviada em \{enviadaEm\}/.test(ger2), true);
  eq('a nota do funil diz a verdade nova: o ciclo encerra no envio, aceite não é mapeado',
     /o aceite do cliente não é mapeado aqui/.test(ger2), true);
  eq('os cards usam card(isLight) de lib/ui — a superfície padrão, não um gradiente próprio da página',
     /card\(isLight\), borderRadius: 16/.test(ger2), true);

  const produto10 = fs35.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R64 está documentado', /\*\*R64\*\*/.test(produto10), true);
}

// ── R65: dashboard 100% dinâmico — barras e rosca também filtram ────────────
{
  const fs36 = require('fs');
  const MET2 = carregar('src/features/home/metricas.ts');
  const P2 = carregar('src/lib/periodos.ts');
  const graf2 = fs36.readFileSync('src/features/home/Graficos.tsx', 'utf8');
  const css4 = fs36.readFileSync('src/styles.css', 'utf8');

  const diaR = (s) => new Date(s).toISOString();
  const atR = (extra) => ({
    id: 'r-' + Math.random(), natureza: 'interno', sprint: 'este_mes',
    coluna: 'concluido', emAberto: false, encerradoEm: diaR('2026-08-10T10:00:00'),
    prazoLimite: null, tipo: null, prioridade: null, prazoEstourado: false,
    ...extra,
  });
  const semanaDeR = (s) => P2.dataIso(P2.inicioSemana(new Date(s)));

  // ── prazosPorSemana: o lado FUTURO das barras, agora puro ───────────────
  {
    const aberta = (prazo) => atR({ emAberto: true, coluna: 'aberto', encerradoEm: null, prazoLimite: diaR(prazo) });
    const r = MET2.prazosPorSemana([
      aberta('2026-08-24T10:00:00'), aberta('2026-08-26T10:00:00'),   // mesma semana
      aberta('2026-08-31T10:00:00'),                                   // semana seguinte
      atR({}),                                                         // encerrada: não é prazo futuro
      atR({ emAberto: true, coluna: 'aberto', encerradoEm: null }),    // sem prazo: fora
    ]);
    eq('prazosPorSemana: duas da mesma semana somam', r[semanaDeR('2026-08-24T10:00:00')], 2);
    eq('prazosPorSemana: a da outra semana vai pro balde dela', r[semanaDeR('2026-08-31T10:00:00')], 1);
    eq('prazosPorSemana: encerrada e sem-prazo ficam de fora', Object.values(r).reduce((s, n) => s + n, 0), 3);
  }

  // ── A INVARIANTE: quem conta a barra é quem a abre ──────────────────────
  {
    const lote = [
      atR({ encerradoEm: diaR('2026-08-10T10:00:00') }),
      atR({ encerradoEm: diaR('2026-08-11T10:00:00') }),
      atR({ coluna: 'cancelado' }),                                    // cancelada não é entrega
      atR({ emAberto: true, coluna: 'aberto', encerradoEm: null, prazoLimite: diaR('2026-08-24T10:00:00') }),
      atR({ emAberto: true, coluna: 'aberto', encerradoEm: null, prazoLimite: diaR('2026-08-25T10:00:00') }),
    ];
    const kPassada = semanaDeR('2026-08-10T10:00:00');
    const kFutura = semanaDeR('2026-08-24T10:00:00');
    eq('CRÍTICO: barra do passado — concluidosPorSemana[k] === atividadesDaSemana(k, true).length',
       MET2.atividadesDaSemana(kPassada, true, lote).length,
       MET2.concluidosPorSemana(lote)[kPassada]);
    eq('CRÍTICO: barra do futuro — prazosPorSemana[k] === atividadesDaSemana(k, false).length',
       MET2.atividadesDaSemana(kFutura, false, lote).length,
       MET2.prazosPorSemana(lote)[kFutura]);
    eq('CRÍTICO: rosca — atividadesDaMeta().length === metaDoMes().total',
       MET2.atividadesDaMeta(lote, new Date(2026, 7, 21)).length,
       MET2.metaDoMes(lote, new Date(2026, 7, 21)).total);
  }

  // ── atividadesDaSelecao despacha para as mesmas funções ─────────────────
  {
    const agoraR = new Date(2026, 7, 21);
    const lote = [
      atR({}),
      atR({ emAberto: true, coluna: 'aberto', encerradoEm: null, prazoLimite: diaR('2026-08-24T10:00:00') }),
    ];
    eq('seleção kpi = atividadesDoKpi',
       MET2.atividadesDaSelecao({ tipo: 'kpi', chave: 'concluidas_mes' }, lote, agoraR).length,
       MET2.atividadesDoKpi('concluidas_mes', lote, agoraR).length);
    eq('seleção semana = atividadesDaSemana',
       MET2.atividadesDaSelecao(
         { tipo: 'semana', chave: semanaDeR('2026-08-24T10:00:00'), rotulo: '24/08', passado: false },
         lote, agoraR,
       ).length, 1);
    eq('seleção meta = atividadesDaMeta',
       MET2.atividadesDaSelecao({ tipo: 'meta' }, lote, agoraR).length,
       MET2.atividadesDaMeta(lote, agoraR).length);
  }
  eq('rotuloDaSelecao distingue passado ("Concluídas na semana") de futuro ("Com prazo na semana")',
     [MET2.rotuloDaSelecao({ tipo: 'semana', chave: 'x', rotulo: '10/08', passado: true }),
      MET2.rotuloDaSelecao({ tipo: 'semana', chave: 'x', rotulo: '24/08', passado: false }),
      MET2.rotuloDaSelecao({ tipo: 'meta' })],
     ['Concluídas na semana de 10/08', 'Com prazo na semana de 24/08', 'Meta do mês']);

  // ── Graficos.tsx: as peças são clicáveis de verdade ─────────────────────
  eq('a coluna inteira da barra é um <button aria-pressed> (alvo generoso, não a barra de 3px)',
     /<button\s*\n\s*key=\{b\.chave\}\s*\n\s*className="barra-btn"\s*\n\s*aria-pressed=\{ativa\}/.test(graf2),
     true);
  eq('GraficoDemanda conta o futuro por prazosPorSemana (metricas.ts) — o inline `futuros` morreu',
     /prazosPorSemana\(atividades\)/.test(graf2), true);
  eq('a barra ativa ganha anel na própria cor de texto da semana',
     /boxShadow: ativa \? `0 0 0 2px \$\{b\.corTexto\}` : "none",/.test(graf2), true);
  eq('a rosca virou botão com aria-pressed e anel dourado quando ativa',
     /<button\s*\n\s*className="elevavel"\s*\n\s*disabled=\{!clicavel\}\s*\n\s*aria-pressed=\{ativa\}/.test(graf2)
     && /border: ativa \? `1\.5px solid \$\{gold\}`/.test(graf2), true);
  eq('sem meta no mês a rosca NÃO é clicável (não há o que abrir)',
     /const clicavel = total > 0 && !!onSelecionar;/.test(graf2), true);

  // ── styles.css: o dinamismo de movimento ────────────────────────────────
  eq('.barra-btn existe (reset de botão) e o hover da barra migrou pra ele',
     /\.barra-btn \{/.test(css4) && /\.barra-btn:hover \.barra-demanda \{ transform: scaleY\(1\.05\)/.test(css4),
     true);
  eq('a ALTURA da barra anima FORA do media de hover — as barras escorrem quando o recorte muda, também no toque',
     /\.barra-demanda \{\s*\n\s*transform-origin: bottom;\s*\n\s*transition: height \.45s cubic-bezier/.test(css4),
     true);
  eq('prefers-reduced-motion desliga o escorrer das barras',
     /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.barra-demanda \{ transition: box-shadow \.18s ease; \}/.test(css4),
     true);

  // ── o documento estrutural ──────────────────────────────────────────────
  const temDoc = fs36.existsSync('docs/DASHBOARD.md');
  eq('docs/DASHBOARD.md existe (a receita para futuros dashboards)', temDoc, true);
  if (temDoc) {
    const doc = fs36.readFileSync('docs/DASHBOARD.md', 'utf8');
    eq('o documento cobre as seções estruturais',
       ['Fundo', 'régua', 'Superfícies', 'Cor', 'Tipografia', 'Dinamismo', 'invariante', 'checklist']
         .every((s) => new RegExp(s, 'i').test(doc)), true);
    eq('o documento registra A invariante central (quem conta é quem filtra)',
       /quem conta é quem filtra/i.test(doc), true);
  }

  const produto11 = fs36.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R65 está documentado', /\*\*R65\*\*/.test(produto11), true);
}

// ── R66: Painel Operacional vira dashboard (2×2, gráficos, lista) ──────────
{
  const fs37 = require('fs');
  const IND2 = carregar('src/features/paineis/indicadores.ts');
  const op2 = fs37.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');

  const ch = (overrides) => ({
    id: 'c-' + Math.random(),
    status: 'aberto', tipo: 'corretiva', prioridade: 'normal',
    cliente_id: null, responsavel_id: 'tec-1', prazo_limite: null,
    created_at: '2026-08-20T10:00:00Z', natureza: 'campo',
    ...overrides,
  });

  // ── naturezaCampo / abertosDeCampo: a base que tudo compartilha ─────────
  eq('naturezaCampo tira só a comercial',
     IND2.naturezaCampo([ch({ natureza: 'campo' }), ch({ natureza: 'comercial' }), ch({ natureza: 'interno' })]).length,
     2);
  eq('abertosDeCampo: só campo E em aberto',
     IND2.abertosDeCampo([
       ch({ status: 'aberto' }), ch({ status: 'concluido' }), ch({ natureza: 'comercial', status: 'aberto' }),
     ]).length, 1);

  // ── chamadosDoKpi: o que cada quadrado conta ─────────────────────────────
  {
    const agoraK = new Date('2026-08-22T12:00:00Z');
    const lote = [
      ch({ id: 'a', responsavel_id: null, prioridade: 'normal', prazo_limite: null }),
      ch({ id: 'b', responsavel_id: 'tec-1', prioridade: 'urgente', prazo_limite: null }),
      ch({ id: 'c', responsavel_id: 'tec-1', prioridade: 'normal', prazo_limite: '2026-08-01T10:00:00Z' }),
      ch({ id: 'd', status: 'concluido' }),
    ];
    eq('chamadosDoKpi abertos: os 3 em aberto — o concluído fica de fora',
       IND2.chamadosDoKpi('abertos', lote, agoraK).map((x) => x.id).sort(), ['a', 'b', 'c']);
    eq('chamadosDoKpi sem_responsavel: só quem não tem responsável',
       IND2.chamadosDoKpi('sem_responsavel', lote, agoraK).map((x) => x.id), ['a']);
    eq('chamadosDoKpi urgentes: só a prioridade urgente',
       IND2.chamadosDoKpi('urgentes', lote, agoraK).map((x) => x.id), ['b']);
    eq('chamadosDoKpi atrasados: só o prazo no passado',
       IND2.chamadosDoKpi('atrasados', lote, agoraK).map((x) => x.id), ['c']);

    // ── CRÍTICO: os 4 quadrados de KPI e a lista que abrem contam da MESMA função ──
    const indK = IND2.calcularIndicadores(lote, agoraK);
    eq('CRÍTICO: ind.abertos === chamadosDoKpi("abertos").length',
       indK.abertos, IND2.chamadosDoKpi('abertos', lote, agoraK).length);
    eq('CRÍTICO: ind.semResponsavel === chamadosDoKpi("sem_responsavel").length',
       indK.semResponsavel, IND2.chamadosDoKpi('sem_responsavel', lote, agoraK).length);
    eq('CRÍTICO: ind.urgentes === chamadosDoKpi("urgentes").length',
       indK.urgentes, IND2.chamadosDoKpi('urgentes', lote, agoraK).length);
    eq('CRÍTICO: ind.atrasados === chamadosDoKpi("atrasados").length',
       indK.atrasados, IND2.chamadosDoKpi('atrasados', lote, agoraK).length);
  }

  eq('a ordem de leitura do 2×2 é azul→amarelo→laranja→vermelho (a rampa de severidade do PRISMA)',
     IND2.KPI_OPERACIONAL_ORDEM, ['abertos', 'sem_responsavel', 'urgentes', 'atrasados']);

  // ── abertosPorCliente: quem está pedindo mais (R68) ──────────────────────
  {
    const agoraC = new Date('2026-08-22T12:00:00Z');
    const lote = [
      ch({ id: '1', cliente_id: 'cli-a' }), ch({ id: '2', cliente_id: 'cli-a' }),
      ch({ id: '3', cliente_id: 'cli-a' }),
      ch({ id: '4', cliente_id: 'cli-b' }),
      ch({ id: '5', cliente_id: null }),
      // fechado e comercial não são "chamado aberto de campo"
      ch({ id: '6', cliente_id: 'cli-c', status: 'concluido' }),
      ch({ id: '7', cliente_id: 'cli-d', natureza: 'comercial' }),
    ];
    eq('abertosPorCliente: do maior para o menor, e o balde sem cliente FICA (barra que some é trabalho sumindo em silêncio)',
       IND2.abertosPorCliente(lote),
       [{ clienteId: 'cli-a', total: 3 }, { clienteId: 'cli-b', total: 1 }, { clienteId: null, total: 1 }]);
    eq('CRÍTICO: cliente SEM chamado aberto não aparece — é o "somente os que têm" do pedido, sem cruzar lista de clientes',
       IND2.abertosPorCliente(lote).some((c) => c.clienteId === 'cli-c' || c.clienteId === 'cli-d'), false);
    eq('CRÍTICO: as barras SOMAM exatamente os chamados em aberto — mesma base dos 4 KPIs',
       IND2.abertosPorCliente(lote).reduce((s, c) => s + c.total, 0),
       IND2.chamadosDoKpi('abertos', lote, agoraC).length);
  }

  // ── ordenarChamados: atrasado (mais velho primeiro) → próximo → no prazo → sem prazo ──
  {
    const agoraO = new Date('2026-08-22T12:00:00Z');
    const lote = [
      ch({ id: 'sem-prazo', prazo_limite: null }),
      ch({ id: 'atrasado-2d', prazo_limite: '2026-08-20T12:00:00Z' }),
      ch({ id: 'no-prazo-longe', prazo_limite: '2026-09-15T12:00:00Z' }),
      ch({ id: 'atrasado-5d', prazo_limite: '2026-08-17T12:00:00Z' }),
      ch({ id: 'proximo', prazo_limite: '2026-08-23T06:00:00Z' }),
    ];
    eq('ordenarChamados: atrasado mais velho primeiro, sem prazo por último',
       IND2.ordenarChamados(lote, agoraO).map((c) => c.id),
       ['atrasado-5d', 'atrasado-2d', 'proximo', 'no-prazo-longe', 'sem-prazo']);
  }

  // ── a página: 2×2, gráficos no lugar de números soltos, lista nova ──────
  eq('os 4 KPIs viraram grid 2×2 (não mais o painel-numeros de 4-em-linha herdado do PainelBase)',
     /gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr"[\s\S]{0,200}\{kpis\.map/.test(op2), true);
  eq('o painel não usa mais o `numeros` genérico do PainelBase — os KPIs agora são bespoke, clicáveis',
     /numeros=\{\[\]\}/.test(op2), true);
  eq('cada quadrado de KPI é <button aria-pressed> — a mesma linguagem de clique da Início',
     /aria-pressed=\{selecionado\}/.test(op2) && /className="elevavel kpi-tile ruido"/.test(op2), true);
  eq('clicar no quadrado ativo desliga (toggle), como os KPIs da Início',
     /setKpiAtivo\(selecionado \? null : k\.chave\);/.test(op2), true);
  // (o painel "Backlog por idade" da R66 foi removido pela R68 — a asserção
  // que o travava saiu junto; o que entrou no lugar está no bloco da R68)
  eq('a lista de chamados técnicos é NOVA (R66) — não existia nesta tela antes',
     /Chamados técnicos/.test(op2) && /Ver todos os chamados →/.test(op2), true);
  eq('a lista anuncia o recorte com "Mostrando:", como a Início pede (DASHBOARD.md §7.3)',
     /Mostrando: <strong/.test(op2), true);
  // R73 trocou o `kpiAtivo ?? "abertos"` pela LENTE: a lista tem três
  // recortes agora. A garantia é a mesma — o KPI abre exatamente o que conta.
  eq('clicar num KPI abre a lista daquele KPI, pela mesma função que o conta',
     /if \(kpiAtivo\) return ordenarChamados\(chamadosDoKpi\(kpiAtivo, chamados, agora\), agora\);/.test(op2),
     true);
  eq('um `agora` só por render — KPIs, indicadores, histograma e ordenação da lista concordam sobre o momento',
     /const agora = useMemo\(\(\) => new Date\(\), \[chamados\]\);/.test(op2), true);

  const produto12 = fs37.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R66 está documentado', /\*\*R66\*\*/.test(produto12), true);
}

// ── R67: o dashboard cabe no topo, e a lista é a tabela da Início ──────────
{
  const fs38 = require('fs');
  const op3 = fs38.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');

  // ── a faixa de altura única (DASHBOARD.md §4) ────────────────────────────
  eq('existe uma ALTURA única, e ela é MENOR que a da Início (mais painéis, tem de terminar mais cedo)',
     /const ALTURA = (\d+);/.test(op3) && Number(op3.match(/const ALTURA = (\d+);/)[1]) < 252, true);
  eq('CRÍTICO: todo painel da faixa herda a altura pelo PAINEL compartilhado — altura própria por painel transforma a fileira numa colagem',
     /const PAINEL: CSSProperties = \{[\s\S]{0,200}height: ALTURA,/.test(op3), true);
  // R69: o gap virou constante (GAP) porque a altura do painel de duas
  // faixas é DERIVADA dele — dois lugares digitando 14 se descolariam.
  eq('as faixas usam o gap canônico do DASHBOARD.md §6 por constante, com wrap',
     (op3.match(/display: "flex", gap: GAP, alignItems: "stretch", flexWrap: "wrap"/g) ?? []).length >= 2
     && /const GAP = 14;/.test(op3), true);
  // 3+ dígitos = altura de PAINEL (168/350). Alturas pequenas (botão 24,
  // barra de progresso 5) são de peça interna e não desalinham fileira.
  eq('nenhum painel declara altura própria em pixel — ou é ALTURA (uma faixa) ou ALTURA_DUPLA (as duas)',
     /height: \d{3,}/.test(op3), false);

  // ── o que encolheu para o dashboard caber no topo ────────────────────────
  eq('Fluxo do mês + Ritmo + Cumprimento de prazo viraram UM painel de micro-números',
     /titulo="Fluxo e ritmo"/.test(op3)
     && ['Entraram', 'Concluídos', 'Saldo da fila', 'Até começar', 'Executando', 'No prazo']
          .every((r) => new RegExp(`rotulo="${r}"`).test(op3)), true);
  // só as linhas de CÓDIGO: o comentário do topo cita o card "Duplas de
  // campo" de propósito, explicando por que ele NÃO está mais ali
  const op3cod = op3.split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n');
  eq('o card largo "Duplas de campo" saiu — o botão que cadastra dupla mora no cabeçalho do gráfico de duplas',
     /Duplas de campo|Cadastrar duplas/.test(op3cod), false);
  eq('…e o botão continua existindo, abrindo o mesmo diálogo',
     /setDuplasAberto\(true\)/.test(op3) && /<DialogoDuplas aberto=\{duplasAberto\}/.test(op3), true);
  eq('a legenda da rosca foi para o LADO do arco (metade da altura, mesma informação)',
     /display: "flex", alignItems: "center", gap: 6 \}\}>[\s\S]{0,400}<PieChart>/.test(op3), true);
  eq('os dois rankings (carga por técnico e reincidência) saem do MESMO componente — não duas barras horizontais copiadas',
     (op3.match(/<Ranking\s/g) ?? []).length, 2);
  eq('ranking corta no topo N e DIZ que cortou (nº silenciosamente truncado lê como "é só isso")',
     /top \{teto\} de \{dados\.length\}/.test(op3), true);

  // ── a lista É a tabela da Início, não uma parecida ───────────────────────
  eq('a lista reusa TabelaAtividades da Início — reescrever aqui criaria a segunda tabela, que fica um passo atrás na primeira mudança de coluna',
     /import \{ TabelaAtividades \} from "@\/features\/home\/TabelaAtividades";/.test(op3)
     && /<TabelaAtividades/.test(op3), true);
  eq('os chamados passam pelo MESMO montador da Início (atividadeDoChamado) — status, cor e rótulo saem de um lugar só',
     /atividadeDoChamado\(c as any, ctx\)/.test(op3), true);
  eq('a linha abre o painel deslizante do chamado (como na Início), e ele leva à página completa',
     /aoAbrir=\{\(a\) => setPainelId\(a\.registroId\)\}/.test(op3)
     && /aoAbrirPagina=\{\(id\) => \{ setPainelId\(null\); navigate\(\{ to: "\/chamados\/\$id"/.test(op3), true);
  eq('a tabela tem o mesmo teto da Início e avisa quando corta',
     /const TETO_TABELA = 200;/.test(op3) && /Mostrando \{TETO_TABELA\} de \{atividades\.length\}/.test(op3), true);

  const produto13 = fs38.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R67 está documentado', /\*\*R67\*\*/.test(produto13), true);
}

// ── R68: o degradê da Início nos gráficos, cliente no lugar de dois painéis ──
{
  const fs39 = require('fs');
  const PAL = carregar('src/lib/paleta.ts');
  const op4 = fs39.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');
  const pb2 = fs39.readFileSync('src/features/paineis/PainelBase.tsx', 'utf8');
  // só as linhas de CÓDIGO: os comentários do arquivo citam de propósito o
  // que NÃO está mais lá (o card "Duplas de campo", o <defs> embrulhado em
  // componente) explicando por quê
  const op4cod = op4.split('\n').filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l)).join('\n');

  // ── paradasBarra: a irmã SVG de gradienteBarra ───────────────────────────
  for (const tema of [true, false]) {
    const nome = tema ? 'claro' : 'escuro';
    const rampa = tema ? PAL.ESPECTRO.light : PAL.ESPECTRO.dark;

    eq(`paradasBarra (${nome}): a peça i vai de ESPECTRO[i] a ESPECTRO[i+1] — o pé de uma emenda no pé da próxima`,
       [0, 3, 6].every((i) => {
         const p = PAL.paradasBarra(i, tema);
         return p[0].cor === rampa[i] && p[p.length - 1].cor === rampa[i + 1];
       }), true);
    eq(`paradasBarra (${nome}): a peça que cruza a emenda ganha a COSTURA no meio (senão o miolo fica VERDE)`,
       PAL.paradasBarra(1, tema),
       [{ cor: rampa[1], pos: '0%' },
        { cor: tema ? PAL.COSTURA.light : PAL.COSTURA.dark, pos: '50%' },
        { cor: rampa[2], pos: '100%' }]);
    eq(`paradasBarra (${nome}): só a emenda tem 3 paradas; as outras 7 têm 2`,
       Array.from({ length: 8 }, (_, i) => PAL.paradasBarra(i, tema).length),
       [2, 3, 2, 2, 2, 2, 2, 2]);
    eq(`paradasBarra (${nome}) e gradienteBarra concordam sobre QUEM cruza a emenda — SVG e CSS não podem discordar`,
       Array.from({ length: 8 }, (_, i) => PAL.paradasBarra(i, tema).length === 3),
       Array.from({ length: 8 }, (_, i) =>
         PAL.gradienteBarra(rampa[i], rampa[i + 1], tema).includes(tema ? PAL.COSTURA.light : PAL.COSTURA.dark)));
  }
  eq('paradasBarra dá a volta na rampa em vez de estourar (peça 8 = peça 0)',
     PAL.paradasBarra(8, false), PAL.paradasBarra(0, false));
  eq('a rampa serve 8 peças — 9 amostras, i → i+1',
     [PAL.PECAS_ESPECTRO, PAL.ESPECTRO.dark.length, PAL.ESPECTRO.light.length], [8, 9, 9]);

  // ── o degradê chegou aos TRÊS tipos de gráfico ───────────────────────────
  // O BUG QUE ISTO TRAVA (2026-08-22, achado na tela pelo Davi): recharts
  // filtra os filhos do gráfico por `isString(child.type)` — ver
  // `isSvgElement` em recharts/util/ReactUtils. Só passa elemento SVG
  // LITERAL. A primeira versão da R68 embrulhou o <defs> num componente
  // próprio (<DegradeEspectro/>), cujo `type` é função: recharts descartou
  // os quatro em silêncio, todo url(#id) resolveu para nada, e a tela ficou
  // com barra sem preenchimento, rosca sem anel e linha sem traço — sem
  // NENHUM erro de console. Daí a asserção ser sobre a FORMA do JSX.
  eq('CRÍTICO: o <defs> é elemento SVG literal, filho direto do gráfico — componente próprio é descartado por recharts em silêncio e o degradê some da tela',
     /<defs>\{gradientesEspectro\(/.test(op4), true);
  eq('CRÍTICO: nenhum <defs> embrulhado em componente próprio voltou a aparecer',
     /<DegradeEspectro/.test(op4cod), false);
  // a função devolve os <linearGradient>, nunca o <defs>: é o que obriga
  // quem chama a escrever o literal. Se TODO <defs> do arquivo é um
  // `<defs>{gradientesEspectro(...)}`, nenhum ficou escondido dentro de
  // componente.
  eq('a função devolve os <linearGradient>, não o <defs> — todo <defs> do código é literal, no gráfico',
     (op4cod.match(/<defs>/g) ?? []).length,
     (op4cod.match(/<defs>\{gradientesEspectro\(/g) ?? []).length);
  eq('os quatro gráficos têm prefixo de id próprio (dois <defs> com o mesmo id fariam o 2º herdar as cores do 1º)',
     ['op-fila', 'op-dupla'].every((p) => op4.includes(`gradientesEspectro("${p}"`))
     && ['op-tec', 'op-cli'].every((p) => op4.includes(`prefixo="${p}"`)), true);
  eq('CRÍTICO: a LINHA usa userSpaceOnUse — linha toda no zero tem caixa de altura zero, e o SVG não desenha degradê sobre caixa de área nula (a linha sumiria justo na semana sem trabalho)',
     /gradientesEspectro\("op-dupla", duplasAtivas\.length, isLight, true\)/.test(op4)
     && /gradientUnits=\{userSpace \? "userSpaceOnUse" : undefined\}/.test(op4), true);
  eq('barra e fatia ficam no padrão objectBoundingBox — cada peça mostra a própria rampa inteira, como as barras da Início',
     /x2=\{userSpace \? "100%" : "1"\}/.test(op4), true);
  eq('o ranking mostra TODOS os nomes (interval={0}) — recharts esconde rótulo quando o painel é baixo, e ranking que omite nome mente sobre quem está na lista',
     /type="category" dataKey="nome" width=\{96\} interval=\{0\}/.test(op4), true);
  eq('ROSCA na rampa: cada fatia puxa o degradê do seu passo',
     /<Cell key=\{f\.nome\} fill=\{`url\(#op-fila-\$\{i % PECAS_ESPECTRO\}\)`\} \/>/.test(op4), true);
  eq('BARRA na rampa: cada barra puxa o degradê do seu passo (e o "sem dono" fica neutro, §9)',
     /fill=\{d\.semDono \? neutro : `url\(#\$\{prefixo\}-\$\{i\}\)`\}/.test(op4), true);
  eq('LINHA na rampa: o traço de cada dupla puxa o degradê do seu passo',
     /stroke=\{`url\(#op-dupla-\$\{passo\}\)`\}/.test(op4), true);
  eq('a legenda da rosca carrega o MESMO degradê da fatia, em CSS — legenda apontando para cor que não existe no gráfico é pior que legenda nenhuma',
     /background: gradienteBarra\(espectro\(passo, isLight\), espectro\(passo \+ 1, isLight\), isLight\)/.test(op4),
     true);
  eq('o número da legenda usa a rampa de TEXTO (o miolo amarelo de preenchimento não passa de 4.5:1 sobre branco)',
     /color: espectroTexto\(passo, isLight\)/.test(op4), true);
  eq('os 4 KPIs continuam no PRISMA, não na rampa — ali a cor é severidade, não série de dados',
     /abertos: PRISMA\.azul, sem_responsavel: PRISMA\.amarelo,/.test(op4), true);
  eq('a paleta categórica local (os 8 hex digitados na tela) saiu junto com o degradê',
     /const CORES_DARK = \[/.test(op4), false);

  // ── os dois painéis que saíram, e o que entrou ───────────────────────────
  eq('R68: "Backlog por idade" e "Reincidência 30d" saíram da tela',
     /Backlog por idade|Reincidência/.test(op4cod), false);
  eq('…e no lugar dos dois entrou UM painel de abertos por cliente, com barras deitadas',
     /titulo="Abertos por cliente"/.test(op4) && /dados=\{clientesComAberto\}/.test(op4), true);
  eq('o painel novo é barra HORIZONTAL (layout="vertical" no recharts é a barra deitada)',
     /<BarChart data=\{visiveis\} layout="vertical"/.test(op4), true);
  eq('a faixa 2 tem os dois rankings do MESMO componente (técnico e cliente)',
     (op4.match(/<Ranking\s/g) ?? []).length, 2);

  // ── o dashboard subiu e encolheu ─────────────────────────────────────────
  eq('o título e o subtítulo saíram da tela',
     /titulo="Painel Operacional"|subtitulo=/.test(op4), false);
  eq('PainelBase aceita ficar sem cabeçalho (os outros dois painéis seguem com o deles)',
     /titulo\?: string;/.test(pb2) && /\{titulo && \(/.test(pb2), true);
  eq('sem cabeçalho o respiro de cima encolhe — senão o padding empurraria o dashboard para baixo à toa',
     /paddingTop: titulo \? 18 : 6/.test(pb2), true);
  eq('CRÍTICO: a lista começa acima da metade da tela — 2 faixas + gap + respiro + topo cabem em 388px, o meio de um notebook de 768',
     (() => {
       const altura = Number(op4.match(/const ALTURA = (\d+);/)[1]);
       const gap = 14, respiro = 6, topo = 24;      // PainelBase sem título + --topo do layout
       return 2 * altura + gap + respiro + topo <= 384;
     })(), true);
  eq('a ALTURA encolheu em relação à R67 (216, quando a tela ainda tinha título e subtítulo)',
     Number(op4.match(/const ALTURA = (\d+);/)[1]) < 216, true);

  const produto14 = fs39.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R68 está documentado', /\*\*R68\*\*/.test(produto14), true);
}

// ── R69: "Abertos por cliente" ocupa as duas faixas ────────────────────────
{
  const fs40 = require('fs');
  const op5 = fs40.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');

  eq('CRÍTICO: a altura do painel de duas faixas é DERIVADA de ALTURA e GAP — um 350 digitado se descolaria na primeira vez que um dos dois mudasse, e o painel deixaria de casar com a faixa 2',
     /const ALTURA_DUPLA = ALTURA \* 2 \+ GAP;/.test(op5), true);
  eq('…e a conta bate: ALTURA_DUPLA cobre exatamente as duas faixas mais o gap entre elas',
     (() => {
       const a = Number(op5.match(/const ALTURA = (\d+);/)[1]);
       const g = Number(op5.match(/const GAP = (\d+);/)[1]);
       return a * 2 + g;
     })(), 350);
  eq('o dashboard virou duas colunas: as faixas à esquerda, o painel alto à direita',
     /flex: "4 1 700px", minWidth: 0, display: "flex", flexDirection: "column", gap: GAP/.test(op5), true);
  eq('"Abertos por cliente" é quem recebe a altura dupla (e só ele)',
     /titulo="Abertos por cliente"[\s\S]{0,220}altura=\{ALTURA_DUPLA\}/.test(op5)
     && (op5.match(/altura=\{ALTURA_DUPLA\}/g) ?? []).length, 1);
  eq('com o dobro de altura ele mostra mais clientes — teto próprio, não o das faixas de uma linha',
     /teto=\{TETO_BARRAS_ALTO\}/.test(op5)
     && Number(op5.match(/const TETO_BARRAS_ALTO = (\d+);/)[1])
        > Number(op5.match(/const TETO_BARRAS = (\d+);/)[1]), true);
  eq('o Ranking aceita altura e teto, com o padrão de UMA faixa — quem não pede, continua como estava',
     /altura = ALTURA, teto = TETO_BARRAS/.test(op5), true);
  eq('"Fila por status" e "Fluxo e ritmo" estreitaram para abrir a coluna da direita',
     /\.\.\.PAINEL, flex: 1, minWidth: 210 \}\}/.test(op5)     // fila
     && /\.\.\.PAINEL, flex: 1, minWidth: 216 \}\}/.test(op5),  // fluxo
     true);
  eq('a base da coluna esquerda comporta a faixa 1 numa linha só (KPIs 244 + fila 210 + fluxo 216 + 2 gaps = 698 ≤ 700) — senão as faixas quebrariam e as alturas se descolariam do painel alto',
     244 + 210 + 216 + 2 * 14 <= 700, true);

  const produto15 = fs40.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R69 está documentado', /\*\*R69\*\*/.test(produto15), true);
}

// ── R70/U59: importação retroativa das 227 OS de manutenção ────────────────
// A migration é o entregável, então o que dá para travar aqui é a FORMA dela:
// que as 227 linhas estão lá, que o de→para de tipo/título obedece as duas
// regras ditadas, e que as salvaguardas (idempotência, triggers, prazo não
// inventado) não sumiram numa edição futura.
{
  const fs41 = require('fs');
  const CAMINHO = 'supabase/migrations/20260822070000_u59_importacao_os_retroativo.sql';
  eq('a migration da importação existe', fs41.existsSync(CAMINHO), true);

  const sql = fs41.readFileSync(CAMINHO, 'utf8');
  const semComentario = sql.replace(/--[^\n]*/g, '');
  const dados = semComentario.split('\n').filter((l) => /^ {2}\('OS\d{4}'/.test(l));

  eq('as 227 OS estão na migration', dados.length, 227);
  eq('os os_id não repetem (a chave de idempotência tem de ser única)',
     new Set(dados.map((l) => l.match(/'(OS\d{4})'/)[1])).size, 227);

  // ── regra 1: título = tipo de demanda ────────────────────────────────────
  {
    const paresErrados = dados.filter((l) => {
      const tipo = (l.match(/'(corretiva|preventiva|implantacao)'/) ?? [])[1];
      const titulo = (l.match(/'(Manutenção Corretiva|Manutenção Preventiva|Implantação)'/) ?? [])[1];
      return ({ corretiva: 'Manutenção Corretiva', preventiva: 'Manutenção Preventiva',
                implantacao: 'Implantação' })[tipo] !== titulo;
    });
    eq('CRÍTICO: toda linha tem título = rótulo do próprio tipo ("os títulos sendo o tipo de demanda")',
       paresErrados.length, 0);
  }

  // ── regra 2: Instalação virou Implantação, e não sobrou em lugar nenhum ──
  eq('CRÍTICO: a palavra "Instalação" não aparece em NENHUMA linha de dado — as 4 viraram Implantação',
     dados.some((l) => l.includes('Instalação')), false);
  eq('as 4 "Instalação" da origem entraram como implantacao/Implantação',
     dados.filter((l) => /'implantacao'/.test(l)).length, 4);
  eq('a quebra por tipo bate com o arquivo de origem (220 / 4 / 3)',
     ['corretiva', 'implantacao', 'preventiva']
       .map((t) => dados.filter((l) => new RegExp(`'${t}'`).test(l)).length),
     [220, 4, 3]);

  // ── as salvaguardas ──────────────────────────────────────────────────────
  eq('CRÍTICO: é idempotente — o INSERT pula quem já tem o mesmo origem_id',
     /WHERE NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.chamados c\s*\n\s*WHERE c\.origem = 'importacao_retroativa' AND c\.origem_id = r\.os_id/.test(sql),
     true);
  eq('CRÍTICO: o trigger que INVENTARIA prazo de SLA é desligado durante a carga (prazo que nunca existiu mudaria o "Cumprimento de prazo" da operação inteira)',
     /DISABLE TRIGGER trg_chamado_preencher_ins/.test(sql), true);
  eq('CRÍTICO: os avisos são desligados — 227 sinos de "novo chamado" por trabalho antigo',
     /DISABLE TRIGGER trg_notify_chamado_ins/.test(sql)
     && /DISABLE TRIGGER trg_notify_chamado_apoio/.test(sql), true);
  eq('todo trigger desligado é religado no fim',
     (sql.match(/DISABLE TRIGGER/g) ?? []).length,
     (sql.match(/ENABLE TRIGGER/g) ?? []).length);
  eq('a numeração NÃO usa a função volátil na lista de seleção (a ordem de avaliação dela contra o ORDER BY não é garantida) — reserva em bloco + row_number',
     /proximo_numero_chamado\(\)/.test(semComentario) === false
     && /row_number\(\) OVER \(PARTITION BY res\.ano/.test(sql), true);
  eq('…e a reserva avança o MESMO contador do app, para não colidir com chamado futuro',
     /INSERT INTO public\.chamado_contadores AS k \(ano, ultimo\)/.test(sql), true);
  eq('pessoa é resolvida pela função da casa (resolver_tecnico, U0), não por matching reinventado',
     /public\.resolver_tecnico\(o\.nome\)/.test(sql), true);
  eq('casamento ambíguo NÃO escolhe ninguém — responsável errado é pior que em branco',
     (sql.match(/CASE WHEN count\((?:p|c)\.id\) = 1 THEN \(array_agg\((?:p|c)\.id\)\)\[1\] END/g) ?? []).length,
     3);
  eq('o nome do cliente da origem é gravado SEMPRE (casando ou não) — nada se perde',
     /r\.cliente_nome,\s+-- o nome da origem fica SEMPRE/.test(sql), true);
  eq('a migration abre e fecha transação',
     /^BEGIN;$/m.test(sql) && /^COMMIT;$/m.test(sql), true);
  eq('termina com SELECT de conferência (a regra das migrations do projeto)',
     /conferencia/.test(sql) && /esperado/.test(sql), true);
  eq('traz o comando de desfazer',
     /DELETE FROM public\.chamados WHERE origem = 'importacao_retroativa';/.test(sql), true);

  const produto16 = fs41.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R70 está documentado', /\*\*R70\*\*/.test(produto16), true);
}

// ── R71: Clientes — lista sem rolagem, filtro no botão, bolinha no degradê ──
{
  const fs42 = require('fs');
  const COR = carregar('src/features/clientes/cores.ts');
  const MZ = carregar('src/features/clientes/mapa-zoom.ts');
  const PAL2 = carregar('src/lib/paleta.ts');
  const cl4 = fs42.readFileSync('src/routes/_authenticated/clientes.tsx', 'utf8');
  const map2 = fs42.readFileSync('src/features/clientes/MapaClientes.tsx', 'utf8');
  const css5 = fs42.readFileSync('src/styles.css', 'utf8');

  // ── a lista cabe em 10, sem rolar ────────────────────────────────────────
  eq('CRÍTICO: a grade tem 10 linhas de minmax(0,1fr) — o minmax(0,…) é o que deixa a faixa ficar MENOR que o cartão; com 1fr puro (piso auto) a lista voltaria a estourar e rolar',
     /grid-template-rows: repeat\(10, minmax\(0, 1fr\)\);/.test(css5), true);
  eq('as 10 linhas valem só no desktop — no celular dez cartões numa tela de telefone dariam ~30px cada',
     /@media \(min-width: 1024px\) \{\s*\n\s*\.clientes-lista \{/.test(css5), true);
  eq('a página continua paginando de 10 em 10 — o número da grade e o da paginação são o mesmo',
     /const ITENS_POR_PAGINA = 10;/.test(cl4), true);
  eq('os estados de carregando/vazio ocupam a GRADE INTEIRA, não a 1ª de 10 faixas',
     (cl4.match(/gridRow: "1 \/ -1"/g) ?? []).length, 2);

  // ── busca alinhada ao título, filtros atrás do botão redondo ─────────────
  eq('a busca está na MESMA linha do título "Clientes"',
     /<div style=\{\{ fontFamily: FONT, fontWeight: 600, fontSize: 22, letterSpacing: "-0\.01em" \}\}>Clientes<\/div>[\s\S]{0,900}placeholder="Buscar cliente, endereço, posto…"/.test(cl4),
     true);
  eq('o botão de filtro é um CÍRCULO ao lado da busca',
     /width: 42, height: 42, borderRadius: "50%"/.test(cl4), true);
  eq('ele anuncia que revela um painel (aria-expanded) — botão que esconde conteúdo sem dizer é armadilha',
     /aria-expanded=\{filtrosAbertos\}/.test(cl4), true);
  eq('CRÍTICO: filtro ATIVO e escondido acende um ponto no botão — sem isso "sumiu cliente da lista" vira mistério em vez de um clique',
     /const temFiltro = filtro !== "todos" \|\| servico !== "todos";/.test(cl4)
     && /\{temFiltro && !filtrosAbertos && \(/.test(cl4), true);
  eq('o painel aberto oferece limpar os filtros',
     /Limpar filtros/.test(cl4), true);

  // ── a bolinha: degradê, sem contorno, sem glow ───────────────────────────
  eq('o passo do cliente cai sempre em 0…7 — a rampa tem 9 amostras para servir 8 peças, e um passo 8 não teria par seguinte',
     Array.from({ length: 400 }, (_, i) => COR.passoDoCliente(`cliente-${i}`))
       .every((p) => Number.isInteger(p) && p >= 0 && p < PAL2.PECAS_ESPECTRO), true);
  eq('o passo é ESTÁVEL para o mesmo id (a cor é como se reconhece o cliente no mapa E na lista)',
     COR.passoDoCliente('abc-123'), COR.passoDoCliente('abc-123'));
  eq('corDoCliente é o INÍCIO do degradê do passo — lista e mapa continuam falando a mesma cor',
     COR.corDoCliente('abc-123', false), PAL2.espectro(COR.passoDoCliente('abc-123'), false));
  eq('gradienteDoCliente devolve o degradê da casa (gradienteBarra), não um linear-gradient inventado',
     COR.gradienteDoCliente('abc-123', false),
     PAL2.gradienteBarra(PAL2.espectro(COR.passoDoCliente('abc-123'), false),
                         PAL2.espectro(COR.passoDoCliente('abc-123') + 1, false), false));
  eq('a bolinha da LISTA usa o degradê e não tem mais glow (boxShadow saiu)',
     /background: gradienteDoCliente\(c\.id, isLight\),/.test(cl4)
     && /boxShadow: `0 0 8px \$\{cor\}66`/.test(cl4) === false, true);
  eq('CRÍTICO: o ponto do MAPA perdeu o halo (r=13 em 22%) e o contorno — sobrou só a bolinha',
     /r=\{13\}/.test(map2) === false
     && /stroke=\{isLight \? "#ffffff" : "#141416"\}/.test(map2) === false, true);
  eq('…e ela é pintada pelo degradê do passo dela',
     /<circle cx=\{p\.x\} cy=\{p\.y\} r=\{5\.5\} fill=\{`url\(#cli-grad-\$\{p\.passo\}\)`\} \/>/.test(map2), true);
  eq('os degradês do mapa saem de paradasBarra (o mesmo caminho SVG dos gráficos, com a costura tratada)',
     /paradasBarra\(passo, isLight\)\.map/.test(map2), true);
  eq('o <defs> fica FORA do <g> que recebe o zoom — degradê não escala junto com o mapa',
     /<\/defs>\s*\n\s*<g transform=\{`translate\(/.test(map2), true);

  // ── o mapa abre com um pouco de zoom ─────────────────────────────────────
  eq('o mapa ABRE com zoom acima do mínimo (o pedido: "um pouquinho de zoom")',
     MZ.ZOOM_INICIAL > MZ.ZOOM_MIN, true);
  eq('…e sem exagero: acima de ~1.5 a tela abriria já pedindo para arrastar',
     MZ.ZOOM_INICIAL <= 1.5, true);
  {
    const L = 1000, A = 800, M = 6;
    const v = MZ.vistaInicial(L, A, M);
    eq('CRÍTICO: a vista inicial fica CENTRADA — o ponto do meio do mapa continua no meio depois do zoom',
       [Math.round(v.k * (L / 2) + v.x), Math.round(v.k * (A / 2) + v.y)],
       [L / 2, A / 2]);
    eq('a vista inicial já nasce dentro dos limites de arrasto (passou por limitarTransform)',
       JSON.stringify(MZ.limitarTransform(v, -M, L + M, -M, A + M)), JSON.stringify(v));
    eq('o zoom da vista inicial é o ZOOM_INICIAL', v.k, MZ.ZOOM_INICIAL);
  }
  eq('resetar volta para a vista de ABERTURA, não para o zoom 1 que a tela nunca mostra sozinha',
     /transformRef\.current = VISTA_INICIAL;\s*\n\s*setTransform\(VISTA_INICIAL\);/.test(map2), true);
  eq('"nada a resetar" passou a ser comparado com a vista de abertura',
     /const semAlteracao = Math\.abs\(transform\.k - VISTA_INICIAL\.k\)/.test(map2), true);

  const produto17 = fs42.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R71 está documentado', /\*\*R71\*\*/.test(produto17), true);
}

// ── R72/U61: reimportação com os marcos de campo (chegada/saída) ───────────
{
  const fs43 = require('fs');
  const CAMINHO = 'supabase/migrations/20260822080000_u61_reimportacao_os_marcos.sql';
  eq('a migration da reimportação existe', fs43.existsSync(CAMINHO), true);

  const sql = fs43.readFileSync(CAMINHO, 'utf8');
  const semComentario = sql.replace(/--[^\n]*/g, '');
  const dados = semComentario.split('\n').filter((l) => /^ {2}\('OS\d{4}'/.test(l));

  eq('as 227 OS continuam lá', dados.length, 227);
  eq('cada linha agora tem 13 campos — os dois marcos novos entraram',
     new Set(dados.map((l) => (l.trim().replace(/,$/, '').slice(1, -1)
       .match(/(?:'(?:''|[^'])*'|NULL)/g) ?? []).length)), new Set([13]));

  // ── a regra do título continua, agora COM GUARDA ────────────────────────
  {
    const errados = dados.filter((l) => {
      const tipo = (l.match(/'(corretiva|preventiva|implantacao)'/) ?? [])[1];
      const titulo = (l.match(/'(Manutenção Corretiva|Manutenção Preventiva|Implantação)'/) ?? [])[1];
      return ({ corretiva: 'Manutenção Corretiva', preventiva: 'Manutenção Preventiva',
                implantacao: 'Implantação' })[tipo] !== titulo;
    });
    eq('CRÍTICO: título continua sendo o rótulo do tipo em todas as linhas', errados.length, 0);
  }
  eq('CRÍTICO: o UPDATE do título tem GUARDA — o Davi vai renomear um por um, e rodar de novo não pode desfazer isso',
     /titulo = CASE WHEN c\.titulo IN \('Manutenção Corretiva','Manutenção Preventiva','Implantação'\)\s*\n\s*THEN r\.titulo ELSE c\.titulo END,/.test(sql),
     true);
  eq('a descrição tem a mesma guarda (se deixou de ser a linha de procedência, o texto é de alguém)',
     /WHEN c\.descricao_problema LIKE 'Importação retroativa %'/.test(sql), true);
  eq('"Instalação" segue sem aparecer em linha de dado', dados.some((l) => l.includes('Instalação')), false);

  // ── os marcos ────────────────────────────────────────────────────────────
  eq('CRÍTICO: chegada→iniciada_em e saída→finalizada_em — é o que faz "Até começar" e "Executando" pararem de ignorar as 227',
     /SET iniciada_em   = r\.chegada,\s*\n\s*finalizada_em = r\.saida,/.test(sql), true);
  eq('a conclusão administrativa continua em concluida_em/fechada_em, separada dos marcos de campo',
     /concluida_em  = r\.data_conclusao,\s*\n\s*fechada_em    = r\.data_conclusao,/.test(sql), true);
  eq('CRÍTICO: a migration ABORTA se algum marco vier fora de ordem — par invertido viraria duração negativa, que o indicador descarta em silêncio',
     /NOT \(data_abertura <= chegada AND chegada <= saida AND saida <= data_conclusao\)/.test(sql)
     && /RAISE EXCEPTION '% linha\(s\) com marcos fora de ordem/.test(sql), true);

  // ── atualiza em lugar, sem apagar ────────────────────────────────────────
  eq('CRÍTICO: ATUALIZA por origem_id em vez de apagar e reinserir — apagar daria números novos, trocaria os ids e perderia o histórico',
     /UPDATE public\.chamados c/.test(sql)
     && /WHERE c\.origem = 'importacao_retroativa' AND c\.origem_id = r\.os_id;/.test(sql), true);
  eq('…e ainda insere o que faltar, caso a U59 não tenha rodado inteira',
     /INSERT INTO public\.chamados \(/.test(sql)
     && /WHERE NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.chamados c/.test(sql), true);
  eq('cliente e responsável só são SOBRESCRITOS quando o de→para achou alguém (COALESCE) — casamento novo não pode apagar vínculo bom',
     /cliente_id           = COALESCE\(cd\.cliente_id, c\.cliente_id\),/.test(sql)
     && /responsavel_id       = COALESCE\(pd\.profile_id, c\.responsavel_id\),/.test(sql), true);
  eq('CRÍTICO: os triggers de UPDATE também são desligados — religar responsável em 227 chamados dispararia 227 notificações e 227 eventos de histórico',
     /DISABLE TRIGGER trg_notify_chamado_upd/.test(sql)
     && /DISABLE TRIGGER trg_chamado_evento_upd/.test(sql), true);
  eq('todo trigger desligado é religado',
     (sql.match(/DISABLE TRIGGER/g) ?? []).length, (sql.match(/ENABLE TRIGGER/g) ?? []).length);
  eq('prazo segue não sendo inventado',
     /prazo_limite IS NULL/.test(sql) && /prazo_limite =/.test(semComentario) === false, true);
  eq('a conferência mostra as MEDIANAS que o painel vai exibir, para bater com o README do dataset',
     /mediana até começar \(h\)/.test(sql) && /mediana executando \(h\)/.test(sql), true);

  const produto18 = fs43.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R72 está documentado', /\*\*R72\*\*/.test(produto18), true);
}

// ── R73: as lentes da lista — o histórico ganhou onde ser visto ────────────
// O defeito que originou isto: as 227 OS retroativas entraram CONCLUÍDAS, e
// nenhuma tela do sistema listava chamado encerrado. O dado estava no banco e
// não existia na interface.
{
  const fs44 = require('fs');
  const IND3 = carregar('src/features/paineis/indicadores.ts');
  const op6 = fs44.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');

  const ch2 = (o) => ({
    id: 'x-' + Math.random(), status: 'aberto', tipo: 'corretiva', prioridade: 'normal',
    cliente_id: null, responsavel_id: 'tec', prazo_limite: null,
    created_at: '2026-08-20T10:00:00Z', natureza: 'campo', ...o,
  });

  {
    const agoraL = new Date('2026-08-22T12:00:00Z');
    const lote = [
      ch2({ id: 'a', status: 'aberto' }),
      ch2({ id: 'b', status: 'em_andamento' }),
      ch2({ id: 'c', status: 'concluido', finalizada_em: '2026-08-10T10:00:00Z' }),
      ch2({ id: 'd', status: 'concluido', finalizada_em: '2026-08-15T10:00:00Z' }),
      ch2({ id: 'e', status: 'cancelado' }),
      ch2({ id: 'f', status: 'concluido', natureza: 'comercial' }),   // funil, não campo
    ];
    eq('lente "abertos" mostra o que pede ação',
       IND3.chamadosDaLente('abertos', lote, agoraL).map((c) => c.id).sort(), ['a', 'b']);
    eq('CRÍTICO: lente "concluidos" mostra os ENCERRADOS — sem ela as 227 OS importadas não apareciam em tela nenhuma',
       IND3.chamadosDaLente('concluidos', lote, agoraL).map((c) => c.id).sort(), ['c', 'd']);
    eq('lente "todos" mostra o campo inteiro, e só o campo (a proposta comercial fica de fora)',
       IND3.chamadosDaLente('todos', lote, agoraL).map((c) => c.id).sort(), ['a', 'b', 'c', 'd', 'e']);
    eq('CRÍTICO: "abertos" e "concluidos" são subconjuntos de "todos" — chip que soma mais que o total mente',
       ['abertos', 'concluidos'].every((l) =>
         IND3.chamadosDaLente(l, lote, agoraL).length <= IND3.chamadosDaLente('todos', lote, agoraL).length),
       true);
    eq('o histórico sai do mais RECENTE para o mais antigo — encerrado não tem urgência de prazo para ordenar',
       IND3.ordenarHistorico(IND3.chamadosDaLente('concluidos', lote, agoraL)).map((c) => c.id),
       ['d', 'c']);
    eq('ordenarHistorico cai para fechada_em/created_at quando não há finalizada_em',
       IND3.ordenarHistorico([
         ch2({ id: 'velho', created_at: '2026-01-01T00:00:00Z' }),
         ch2({ id: 'novo', created_at: '2026-07-01T00:00:00Z' }),
       ]).map((c) => c.id), ['novo', 'velho']);
  }

  eq('as três lentes estão na ordem de uso: o dia primeiro, o arquivo depois',
     IND3.LENTE_ORDEM, ['abertos', 'concluidos', 'todos']);
  eq('a tela oferece as três como chip, e o número de cada uma sai da MESMA função que monta a lista',
     /LENTE_ORDEM\.map\(\(l\) => \{/.test(op6)
     && /chamadosDaLente\(l, chamados, agora\)\.length/.test(op6), true);
  // R76 acrescentou o retorno à visão de LISTA: o KPI é drill-down de lista,
  // e no quadro ele esvaziaria as colunas que não são "em aberto".
  eq('CRÍTICO: clicar num KPI devolve a lente para "abertos" E volta para a lista — os 4 contam só o que está em aberto, e abrir um deles sobre o histórico (ou sobre o quadro) mostraria algo que não bate com o número tocado',
     /setLente\("abertos"\);\s*\n\s*setVisao\("lista"\);[^\n]*\n\s*setKpiAtivo\(selecionado \? null : k\.chave\);/.test(op6),
     true);
  eq('e escolher uma lente limpa o KPI — só uma peça filtra por vez',
     /onClick=\{\(\) => \{ setKpiAtivo\(null\); setLente\(l\); \}\}/.test(op6), true);
  eq('o estado vazio nomeia a LENTE, em vez de dizer "em aberto" mesmo olhando o histórico',
     /LENTE_LABEL\[lente\]/.test(op6), true);

  const produto19 = fs44.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R73 está documentado', /\*\*R73\*\*/.test(produto19), true);
}

// ── R75/U64: apoio automático pela dupla ───────────────────────────────────
{
  const fs45 = require('fs');
  const DUP = carregar('src/features/duplas/modelo.ts');
  const CAMINHO = 'supabase/migrations/20260822090000_u64_apoio_automatico_da_dupla.sql';
  eq('a migration do apoio automático existe', fs45.existsSync(CAMINHO), true);
  const sql = fs45.readFileSync(CAMINHO, 'utf8');

  const duplas = [
    { id: 'd1', nome: 'Dupla do Breno', membro_a: 'breno', membro_b: 'luan', ativa: true },
    { id: 'd2', nome: 'Dupla do Lucas', membro_a: 'lucas', membro_b: 'paulo', ativa: true },
    { id: 'd3', nome: 'Sozinho',        membro_a: 'vinicius', membro_b: null, ativa: true },
    { id: 'd4', nome: 'Desfeita',       membro_a: 'antigo', membro_b: 'outro', ativa: false },
  ];
  eq('o par sai dos DOIS lados da dupla — tanto faz quem foi cadastrado como membro_a',
     [DUP.parceiroDaDupla('breno', duplas), DUP.parceiroDaDupla('luan', duplas)],
     ['luan', 'breno']);
  eq('cada técnico puxa o par da SUA dupla', DUP.parceiroDaDupla('lucas', duplas), 'paulo');
  eq('dupla de uma pessoa só não tem par — e inventar um seria pior que deixar em branco',
     DUP.parceiroDaDupla('vinicius', duplas), null);
  eq('CRÍTICO: dupla DESFEITA não puxa ninguém — senão quem já saiu continuaria sendo escalado',
     DUP.parceiroDaDupla('antigo', duplas), null);
  eq('quem não está em dupla nenhuma não tem par', DUP.parceiroDaDupla('ninguem', duplas), null);
  eq('sem responsável não há par', DUP.parceiroDaDupla(null, duplas), null);
  eq('CRÍTICO: o par é o OUTRO, nunca a própria pessoa',
     ['breno', 'luan', 'lucas', 'paulo'].every((p) => DUP.parceiroDaDupla(p, duplas) !== p), true);

  // ── o gatilho, no SQL ────────────────────────────────────────────────────
  eq('CRÍTICO: o apoio é GRAVADO, não derivado — "desse dia em diante" quer dizer que trocar a dupla não pode reescrever quem foi ao prédio no passado',
     /INSERT INTO public\.chamado_apoios \(chamado_id, profile_id, origem\)/.test(sql)
     && /VALUES \(NEW\.id, v_parceiro, 'dupla'\)/.test(sql), true);
  eq('dispara ao INSERIR e ao TROCAR o responsável — é isso que dá o "sempre dinâmico"',
     /CREATE TRIGGER trg_chamado_apoio_dupla_ins AFTER INSERT ON public\.chamados/.test(sql)
     && /CREATE TRIGGER trg_chamado_apoio_dupla_upd AFTER UPDATE OF responsavel_id ON public\.chamados/.test(sql),
     true);
  eq('CRÍTICO: existe `origem` para o gatilho só mexer no que ELE criou — sem isso, trocar o responsável teria de apagar todos os apoios do chamado, levando junto quem alguém pôs à mão',
     /ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'/.test(sql)
     && /DELETE FROM public\.chamado_apoios[\s\S]{0,200}AND origem = 'dupla'/.test(sql), true);
  eq('apoio posto à mão vence o automático (ON CONFLICT DO NOTHING)',
     /ON CONFLICT \(chamado_id, profile_id\) DO NOTHING;/.test(sql), true);
  eq('só vale para CAMPO — o chamado interno tem equipe própria e a proposta não tem par que a acompanhe',
     /IF NEW\.natureza <> 'campo' THEN RETURN NEW; END IF;/.test(sql), true);
  eq('a função SQL só olha dupla ATIVA, como a gêmea em TS',
     /WHERE d\.ativa\s*\n\s*AND \(d\.membro_a = _pessoa OR d\.membro_b = _pessoa\)/.test(sql), true);
  eq('NÃO há backfill automático — usar a dupla de hoje em chamado antigo é o erro que a decisão de gravar evita',
     /NÃO HÁ BACKFILL, DE PROPÓSITO/.test(sql), true);

  const produto20 = fs45.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R75 está documentado', /\*\*R75\*\*/.test(produto20), true);
}

// ── R76: o quadro (kanban) do Painel Operacional ───────────────────────────
{
  const fs46 = require('fs');
  const IND4 = carregar('src/features/paineis/indicadores.ts');
  const op7 = fs46.readFileSync('src/routes/_authenticated/painel.operacional.tsx', 'utf8');
  const css6 = fs46.readFileSync('src/styles.css', 'utf8');

  const agoraK = new Date('2026-08-22T12:00:00Z');
  const c = (o) => ({
    id: 'k-' + Math.random(), status: 'aberto', tipo: 'corretiva', prioridade: 'normal',
    cliente_id: null, responsavel_id: null, prazo_limite: null,
    created_at: '2026-08-01T10:00:00Z', natureza: 'campo', data_hora_agendada: null, ...o,
  });

  eq('as quatro colunas, na ordem pedida',
     IND4.COLUNA_OP_ORDEM.map((k) => IND4.COLUNA_OP_LABEL[k]),
     ['Não agendados', 'Agendados', 'Atrasados', 'Concluídos']);
  eq('CRÍTICO: cancelado fica FORA do quadro (pedido explícito) — e sai antes de tudo, senão um cancelado sem prazo cairia em "não agendado"',
     IND4.colunaOperacional(c({ status: 'cancelado' }), agoraK), null);
  eq('concluído é destino final — não importa se o prazo estourou no caminho',
     IND4.colunaOperacional(c({ status: 'concluido', prazo_limite: '2026-08-01T00:00:00Z' }), agoraK),
     'concluido');
  eq('CRÍTICO: ATRASADO vence AGENDADO — um chamado marcado para terça que venceu continua vencido, e deixar a data escondê-lo é o oposto do que a coluna existe para denunciar',
     IND4.colunaOperacional(
       c({ prazo_limite: '2026-08-20T00:00:00Z', data_hora_agendada: '2026-08-25T00:00:00Z' }), agoraK),
     'atrasado');
  eq('com data marcada e no prazo → Agendados',
     IND4.colunaOperacional(c({ prazo_limite: '2026-08-30T00:00:00Z', data_hora_agendada: '2026-08-25T00:00:00Z' }), agoraK),
     'agendado');
  eq('sem data marcada → Não agendados', IND4.colunaOperacional(c({}), agoraK), 'nao_agendado');
  eq('sem prazo não é atraso — quem não tem prazo não pode estar atrasado',
     IND4.colunaOperacional(c({ prazo_limite: null }), agoraK), 'nao_agendado');

  {
    const lote = [
      c({ id: '1' }), c({ id: '2', data_hora_agendada: '2026-08-25T00:00:00Z' }),
      c({ id: '3', prazo_limite: '2026-08-01T00:00:00Z' }),
      c({ id: '4', status: 'concluido' }), c({ id: '5', status: 'cancelado' }),
      c({ id: '6', natureza: 'comercial' }),
    ];
    const q = IND4.agruparPorColuna(lote, agoraK);
    eq('CRÍTICO: as quatro colunas PARTICIONAM o campo — nada duplicado, nada perdido (fora cancelado e o que não é campo)',
       IND4.COLUNA_OP_ORDEM.reduce((s, k) => s + q[k].length, 0), 4);
    eq('nenhum chamado aparece em duas colunas',
       new Set(IND4.COLUNA_OP_ORDEM.flatMap((k) => q[k].map((x) => x.id))).size, 4);
    eq('a proposta comercial não entra no quadro de campo',
       IND4.COLUNA_OP_ORDEM.flatMap((k) => q[k].map((x) => x.id)).includes('6'), false);
  }

  eq('a tela oferece o alternador lista/quadro',
     /setVisao\(v\); if \(v === "kanban"\) setKpiAtivo\(null\);/.test(op7), true);
  eq('as lentes só aparecem na LISTA — no quadro elas esvaziariam colunas (as três recortam subconjuntos de "em aberto")',
     /\{visao === "lista" && \(\s*\n\s*<div className="trilho-x"/.test(op7), true);
  eq('as colunas do quadro vêm da função pura, não de um filtro reescrito na tela',
     /agruparPorColuna\(chamados as any\[\], agora\)/.test(op7)
     && /COLUNA_OP_ORDEM\.map\(\(col\) => \{/.test(op7), true);
  eq('a cor da coluna sai do vocabulário de ESTADO (PRISMA), não da rampa de dados',
     /nao_agendado: isLight \? PRISMA\.azul\.light/.test(op7)
     && /atrasado:     isLight \? PRISMA\.vermelho\.light/.test(op7), true);
  eq('quem rola é a COLUNA, não a página — a tela é fixa',
     /\.kanban-op-itens \{[\s\S]{0,200}overflow-y: auto;/.test(css6), true);
  eq('e a coluna precisa de min-height:0 para poder encolher (senão a rolagem vaza pra página)',
     /\.kanban-op-coluna \{[\s\S]{0,200}min-height: 0;/.test(css6), true);

  const produto21 = fs46.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R76 está documentado', /\*\*R76\*\*/.test(produto21), true);
}

// ── R77/U65: os 30 chamados de teste ───────────────────────────────────────
{
  const fs47 = require('fs');
  const CAMINHO = 'supabase/migrations/20260822100000_u65_chamados_de_teste.sql';
  eq('a migration dos chamados de teste existe', fs47.existsSync(CAMINHO), true);
  const sql = fs47.readFileSync(CAMINHO, 'utf8');

  const linhas = sql.split('\n').filter((l) => /^ {2}\(\s*\d+, '/.test(l));
  eq('são 30 chamados', linhas.length, 30);

  const campos = linhas.map((l) => {
    const m = l.match(/^ {2}\(\s*(\d+), '(?:''|[^'])*',\s*'(\w+)',\s*'(\w+)',\s*'(\w+)',\s*(\d+),\s*(-?\d+|NULL),\s*(-?\d+|NULL),\s*(true|false)\)/);
    if (!m) throw new Error('linha de seed fora do formato: ' + l.slice(0, 60));
    return { n: +m[1], tipo: m[2], status: m[3], pri: m[4],
             prazo: m[6] === 'NULL' ? null : +m[6],
             agenda: m[7] === 'NULL' ? null : +m[7], sem: m[8] === 'true' };
  });
  const ABERTO = ['aberto', 'agendado', 'em_andamento', 'stand_by'];
  const abertos = campos.filter((r) => ABERTO.includes(r.status));

  eq('numeração 1..30, sem repetir (é a chave de idempotência)',
     campos.map((r) => r.n).sort((a, b) => a - b), Array.from({ length: 30 }, (_, i) => i + 1));
  eq('todos os tipos são de CAMPO (a equipe é a Técnica)',
     [...new Set(campos.map((r) => r.tipo))].sort(),
     ['corretiva', 'implantacao', 'operacional', 'preventiva']);
  eq('nenhum status fora do vocabulário do campo',
     campos.every((r) => [...ABERTO, 'concluido'].includes(r.status)), true);
  eq('CRÍTICO: a maioria fica EM ABERTO — as 227 importadas são todas concluídas, e quase todo painel desta tela conta o que está aberto',
     abertos.length, 26);

  // o lote precisa CONTER os casos que o dashboard sabe mostrar
  eq('tem prazo estourado (acende "Prazo estourado" e a coluna Atrasados)',
     abertos.filter((r) => r.prazo !== null && r.prazo < 0).length, 4);
  eq('tem urgente em aberto (acende "Urgentes")',
     abertos.filter((r) => r.pri === 'urgente').length, 3);
  eq('tem sem responsável (acende "Sem responsável")',
     campos.filter((r) => r.sem).length, 3);
  eq('tem concluído (enche a coluna Concluídos e o fluxo do mês)',
     campos.filter((r) => r.status === 'concluido').length, 4);

  // as quatro colunas do quadro, pela MESMA precedência de colunaOperacional
  {
    const col = { nao_agendado: 0, agendado: 0, atrasado: 0, concluido: 0 };
    for (const r of campos) {
      if (r.status === 'concluido') col.concluido++;
      else if (r.prazo !== null && r.prazo < 0) col.atrasado++;
      else if (r.agenda !== null) col.agendado++;
      else col.nao_agendado++;
    }
    eq('CRÍTICO: as quatro colunas do quadro nascem TODAS com item — um quadro com coluna vazia não mostra que funciona',
       Object.values(col).every((v) => v > 0), true);
    eq('e as contagens declaradas no SELECT de conferência batem com as linhas',
       [col.nao_agendado, col.agendado, col.atrasado, col.concluido], [8, 14, 4, 4]);
    eq('os números do SELECT de conferência estão escritos na migration',
       [`'quadro · Não agendados', count(*)::text, '${col.nao_agendado}'`,
        `'quadro · Agendados', count(*)::text, '${col.agendado}'`,
        `'quadro · Atrasados', count(*)::text, '${col.atrasado}'`,
        `'quadro · Concluídos', count(*)::text, '${col.concluido}'`]
         .every((t) => sql.includes(t)), true);
  }

  eq('é idempotente pelo origem_id', /c\.origem = 'seed_teste' AND c\.origem_id = 'TESTE-'/.test(sql), true);
  eq('sai inteiro com um DELETE — é dado de teste, tem de ser fácil de remover',
     /DELETE FROM public\.chamados WHERE origem = 'seed_teste';/.test(sql), true);
  eq('CRÍTICO: os técnicos saem de DUPLAS ATIVAS — é o que faz o gatilho da U64 ter par e o apoio automático aparecer sozinho',
     /EXISTS \(SELECT 1 FROM public\.duplas d\s*\n\s*WHERE d\.ativa AND \(d\.membro_a = p\.id OR d\.membro_b = p\.id\)\)/.test(sql),
     true);
  eq('aborta com mensagem útil se não houver dupla cadastrada, em vez de criar 30 chamados órfãos',
     /RAISE EXCEPTION 'Nenhum técnico em dupla ativa/.test(sql), true);
  eq('o gatilho de notificação fica desligado — 30 sinos por dado de teste é ruído',
     /DISABLE TRIGGER trg_notify_chamado_ins/.test(sql)
     && /ENABLE TRIGGER trg_notify_chamado_ins/.test(sql), true);
  eq('marcos de campo só em quem já começou/terminou, e sempre depois da abertura',
     /WHEN s\.status IN \('em_andamento','concluido'\)/.test(sql)
     && /interval '3 hours'/.test(sql) && /interval '5 hours'/.test(sql), true);

  const produto22 = fs47.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R77 está documentado', /\*\*R77\*\*/.test(produto22), true);
}

// ── R78: título do item comercial + marcar enviada pelo card ───────────────
{
  const fs48 = require('fs');
  const ET3 = carregar('src/features/comercial/etapas.ts');
  const ger3 = fs48.readFileSync('src/routes/_authenticated/gerencial.tsx', 'utf8');

  // ── o nome do lugar ──────────────────────────────────────────────────────
  eq('condomínio: o nome do cliente cadastrado',
     ET3.tituloDaVisita({ tipo_local: 'condominio_vertical', cliente_nome: 'Ed. Azaleia' }),
     'Ed. Azaleia');
  eq('empresa: idem — o título é o nome do lugar, não o do contato',
     ET3.tituloDaVisita({ tipo_local: 'empresa', cliente_nome: 'Alfaplast', nome_sindico: 'João' }),
     'Alfaplast');
  eq('CRÍTICO: residência de pessoa física ganha o prefixo — numa fila de prédios, "Alcino Braga" sozinho parece nome de condomínio',
     ET3.tituloDaVisita({ tipo_local: 'residencia', cliente_nome: 'Alcino Braga' }),
     'Residência Alcino Braga');
  eq('na residência o proprietário pode vir do contato, quando não há cliente cadastrado',
     ET3.tituloDaVisita({ tipo_local: 'residencia', nome_sindico: 'Pedro Adam' }),
     'Residência Pedro Adam');
  eq('CRÍTICO: não duplica o prefixo quando o cadastro já o tem',
     [ET3.tituloDaVisita({ tipo_local: 'residencia', cliente_nome: 'Residência Silva' }),
      ET3.tituloDaVisita({ tipo_local: 'residencia', cliente_nome: 'residencia Souza' }),
      ET3.tituloDaVisita({ tipo_local: 'residencia', cliente_nome: 'RESIDÊNCIA Lima' })],
     ['Residência Silva', 'residencia Souza', 'RESIDÊNCIA Lima']);
  eq('residência sem nenhum nome ainda diz o que é',
     ET3.tituloDaVisita({ tipo_local: 'residencia' }), 'Residência');
  eq('nome só com espaço não conta como nome',
     ET3.tituloDaVisita({ tipo_local: 'condominio_vertical', cliente_nome: '   ', nome_predio: 'Torre A' }),
     'Torre A');
  eq('no condomínio o síndico NÃO vira o nome do lugar antes do prédio',
     ET3.tituloDaVisita({ tipo_local: 'condominio_vertical', nome_sindico: 'Maria', nome_predio: 'Ed. Sol' }),
     'Ed. Sol');
  eq('sem nada, não inventa', ET3.tituloDaVisita({}), 'Sem nome');

  // ── a tela ───────────────────────────────────────────────────────────────
  eq('a lista usa a função pura, não um ?? solto',
     /const clienteNome = tituloDaVisita\(\{/.test(ger3), true);
  eq('CRÍTICO: `tipo_local` entrou na consulta — sem ele a regra da residência nunca dispararia',
     /nome_predio,\s*\n\s*tipo_local,/.test(ger3), true);
  eq('o botão "Proposta enviada" só aparece em falta_proposta — antes não há o que enviar, depois o ciclo já encerrou (R64)',
     /\{et === "falta_proposta" && \(/.test(ger3), true);
  eq('CRÍTICO: usa a MESMA RPC da tela da visita — um segundo caminho de escrita divergiria dela na primeira mudança de regra',
     /supabase\.rpc\("registrar_envio_proposta" as any/.test(ger3), true);
  eq('o clique no botão não navega junto com o card',
     /onClick=\{\(e\) => \{ e\.stopPropagation\(\); marcarEnviada\.mutate\(v\.id\); \}\}/.test(ger3), true);
  eq('não dá para clicar duas vezes enquanto grava',
     /disabled=\{marcarEnviada\.isPending\}/.test(ger3), true);
  eq('a lista se atualiza sozinha depois de enviar',
     /queryClient\.invalidateQueries\(\{ queryKey: \["gerencial-visitas"\] \}\)/.test(ger3), true);

  const produto23 = fs48.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R78 está documentado', /\*\*R78\*\*/.test(produto23), true);
}

// ── R79: revisão de design — o modo claro em todas as telas ────────────────
// A revisão de 2026-08-23 achou 91 defeitos confirmados. A RAIZ de boa parte
// deles estava aqui: o bloco [data-theme="light"] redefinia 14 de ~35 tokens,
// e os outros ~21 seguiam com o valor do ESCURO no claro. Como quase todo
// componente shadcn pinta por esses tokens, o efeito aparecia em telas que
// nunca escreveram cor nenhuma — borda de input invisível, painel de Select
// escuro sobre página clara, TabsList azul-marinho dentro de card branco.
{
  const fs49 = require('fs');
  const css7 = fs49.readFileSync('src/styles.css', 'utf8');

  const bloco = (sel) => {
    const i = css7.indexOf(sel + ' {');
    if (i < 0) return null;
    const j = css7.indexOf('\n}', i);
    const corpo = css7.slice(i, j);
    const m = {};
    for (const par of corpo.matchAll(/(--[\w-]+):\s*([^;]+);/g)) m[par[1]] = par[2].trim();
    return m;
  };
  const raiz = bloco(':root');
  const claro = bloco('[data-theme="light"]');

  eq('os dois blocos de tema existem', !!raiz && !!claro, true);

  // `--radius` é geometria, não cor: não tem par de tema por natureza.
  const SEM_TEMA = ['--radius'];
  const semPar = Object.keys(raiz).filter((t) => !SEM_TEMA.includes(t) && !(t in claro));
  eq('CRÍTICO: TODO token de cor do :root tem par no tema claro — foi a falta disso que deixou input sem borda, Select escuro na página clara e badge ilegível, em telas que não escreveram cor nenhuma',
     semPar, []);

  // os que mais doíam, um a um
  eq('--input tem contraste de verdade sobre card branco (era branco 6%: borda invisível)',
     claro['--input'], 'rgba(0,0,0,0.14)');
  eq('--popover é claro (era #161926: o painel do Select abria escuro sobre a página clara)',
     claro['--popover'], '#ffffff');
  eq('--muted é claro (era #11131D: TabsList virava barra azul-marinho no card branco)',
     claro['--muted'], '#eef0f4');
  eq('CRÍTICO: --accent-foreground não é o dourado do escuro (o anti-padrão nº 3: #F8C811 sobre fundo claro dá ~1.6:1)',
     claro['--accent-foreground'] === '#F8C811', false);
  eq('--destructive/--success/--info usam os tons ESCUROS das escalas, que são os legíveis sobre branco',
     [claro['--destructive'], claro['--success'], claro['--info']],
     ['#B1242E', '#047862', '#236FC7']);
  eq('--muted-foreground passa de 4.5:1 sobre branco (era #8A8FA8, ~3.2:1)',
     claro['--muted-foreground'], '#5a6172');
  eq('--border deixou de ser o dourado translúcido — a regra global * { border-color } espalhava aquilo por tudo',
     /rgba\(0,0,0/.test(claro['--border']), true);

  // `--primary` é FUNDO do botão da marca: dourado vivo com texto quase-preto
  // é o botão da casa, e escurecê-lo aqui apagaria a identidade.
  eq('--primary segue sendo o dourado da marca no claro (é fundo, não texto) com texto quase-preto',
     [claro['--primary'], claro['--primary-foreground']], ['#F8C811', '#08090E']);

  eq('CRÍTICO: o anel de foco sai do token, não de hex — #F8C811 fixo dava ~1.6:1 na página clara, e o anel de foco é justamente o que precisa ser visto',
     /outline: 2px solid var\(--gold-primary\);/.test(css7), true);
  eq('…e nenhum outline de foco em dourado fixo sobrou',
     /outline: 2px solid #F8C811/.test(css7), false);

  const produto24 = fs49.readFileSync('docs/PRODUTO.md', 'utf8');
  eq('R79 está documentado', /\*\*R79\*\*/.test(produto24), true);
}

// ── U68: o contexto do projeto viaja com o repo ────────────────────────────
// A memória do assistente é por CONTA e por MÁQUINA — na troca das duas
// (2026-08-24) ela evapora. CLAUDE.md carrega o método; ONBOARDING.md, a
// transição. Se um dos dois sumir, a próxima sessão nova volta à arqueologia.
{
  const fs50 = require('fs');
  eq('CLAUDE.md existe na raiz — é o que uma sessão nova lê sozinha', fs50.existsSync('CLAUDE.md'), true);
  const cl = fs50.readFileSync('CLAUDE.md', 'utf8');
  eq('CLAUDE.md ensina o ciclo completo (R → implementação → asserções → build → U → push)',
     ['docs/PRODUTO.md', 'verificar-logica.cjs', 'vite build', 'PLANO_UNIFICACAO'].every((t) => cl.includes(t)),
     true);
  eq('CLAUDE.md avisa que migration NUNCA se aplica daqui — o Davi roda no SQL Editor',
     /nunca aplica/i.test(cl) && /SQL Editor/.test(cl), true);
  eq('CLAUDE.md registra o baseline do tsc — sem ele, a primeira sessão nova "conserta" 85 erros que não são dela',
     /85 erros/.test(cl), true);
  eq('CLAUDE.md carrega as invariantes que só existiam na memória da conta',
     /quem conta é quem filtra/i.test(cl) && /encerra no ENVIO/i.test(cl) && /PGRST201/.test(cl), true);
  eq('ONBOARDING.md existe — o checklist da migração de máquina', fs50.existsSync('ONBOARDING.md'), true);
  const ob = fs50.readFileSync('ONBOARDING.md', 'utf8');
  eq('ONBOARDING avisa que a SERVICE key da pasta-mãe NUNCA entra no repo',
     /NUNCA entra no repo/.test(ob), true);
  eq('ONBOARDING avisa contra pasta sincronizada por nuvem (a causa do tsc travado na máquina antiga)',
     /nuvem/i.test(ob) && /iCloud/.test(ob), true);
  eq('o manual não afirma mais que tsc nunca completa — a nota foi corrigida com o baseline',
     /nunca completa\*\*/.test(fs50.readFileSync('docs/manual/desenvolvimento-e-verificacao.md', 'utf8')),
     false);
}

// ── U69: a limpeza dos dados operacionais + a saída da Lovable ─────────────
{
  const fs51 = require('fs');
  const CAMINHO = 'supabase/migrations/20260824110000_u69_limpeza_dados_operacionais.sql';
  eq('a migration da limpeza existe', fs51.existsSync(CAMINHO), true);
  const sql = fs51.readFileSync(CAMINHO, 'utf8');

  eq('CRÍTICO: ela avisa que é IRREVERSÍVEL e exige backup confirmado ANTES — não há undo de um wipe',
     /IRREVERSÍVEL/.test(sql) && /backup/i.test(sql), true);
  eq('apaga o financeiro DERIVADO antes de órfã-lo — cobrancas.chamado_id é SET NULL, e cobrança apontando para o nada é dinheiro sem origem na tela',
     sql.indexOf('DELETE FROM public.cobrancas;') < sql.indexOf('DELETE FROM public.chamados;'), true);
  eq('apaga chamados e visitas (no vocabulário do app, visita É atividade)',
     /DELETE FROM public\.chamados;/.test(sql) && /DELETE FROM public\.visitas_tecnicas;/.test(sql), true);
  eq('a seção do funil comercial é destacada como comentável — preservar propostas é decisão de 5 segundos, não de arqueologia',
     /comente/i.test(sql), true);
  eq('zera os contadores — "do zero" inclui a numeração voltar a CH-<ano>-0001',
     /DELETE FROM public\.chamado_contadores;/.test(sql), true);
  eq('CRÍTICO: a migration NÃO toca na fundação — nenhum DELETE em clientes/contratos/profiles/duplas/prospeccoes',
     /DELETE FROM public\.(clientes|cliente_contratos|profiles|duplas|prospeccoes)\b/.test(sql), false);

  // A asserção que TERIA pegado o erro da primeira execução (2026-08-24):
  // a conferência citava "public.contratos", que nunca existiu (a tabela é
  // cliente_contratos) — e a migration abortou no SQL Editor, na frente do
  // Davi, dentro da transação. Nome de tabela numa migration não é opinião:
  // TODO public.<x> citado tem de ter nascido em alguma migration anterior
  // (CREATE TABLE ou RENAME TO). Isto vale como proteção para qualquer
  // edição futura da U69 — e o mecanismo fica aqui para as próximas.
  {
    const path51 = require('path');
    const dir = 'supabase/migrations';
    const historico = fs51.readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => fs51.readFileSync(path51.join(dir, f), 'utf8'))
      .join('\n');
    const nascidas = new Set();
    for (const m of historico.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/gi)) nascidas.add(m[1]);
    for (const m of historico.matchAll(/RENAME TO (\w+)/gi)) nascidas.add(m[1]);
    const citadas = [...new Set([...sql.matchAll(/public\.(\w+)/g)].map((m) => m[1]))];
    const fantasmas = citadas.filter((t) => !nascidas.has(t));
    eq('CRÍTICO: toda tabela citada na U69 existe no histórico de migrations — "public.contratos" abortou a primeira execução',
       fantasmas, []);
  }
  eq('a conferência mostra a fundação DE PÉ, não só os alvos zerados — se clientes vier 0, a instrução é PARAR e restaurar',
     /fundacao/.test(sql) && /PARE e restaure/.test(sql), true);
  eq('CRÍTICO: avisa que U59/U61/U65 nunca mais rodam — num banco limpo, a idempotência por origem REIMPORTARIA tudo',
     /NUNCA MAIS RODE/.test(sql) && /U59/.test(sql) && /U65/.test(sql), true);

  // a saída da Lovable, documentada na ordem certa
  const ob2 = fs51.readFileSync('ONBOARDING.md', 'utf8');
  // 2026-08-24: o Davi decidiu MANTER a Lovable por enquanto. As três
  // asserções abaixo mudaram de alvo junto — o que elas guardam não é "a
  // saída está em andamento", é que o PLANO da saída continua completo e
  // com o passo perigoso em primeiro lugar, para o dia em que for usado.
  eq('CRÍTICO: o plano de saída da Lovable começa pela checagem de DONO do projeto Supabase — banco gerenciado pela plataforma pode morrer com a assinatura',
     /CONFIRME QUE O PROJETO SUPABASE É SEU/.test(ob2)
     && /pode ser destruído\s*\n?\s*no cancelamento/.test(ob2), true);
  eq('…e o ONBOARDING deixa explícito que isso NÃO é pré-requisito da migração de máquina — a Lovable fica',
     /A Lovable FICA, por enquanto/.test(ob2) && /NÃO é para agora/.test(ob2), true);
  eq('a faxina pós-Lovable (AGENTS.md, .lovable/, .env fora do repo) é passo EXPLÍCITO e posterior — não se "arruma" antes de sair',
     /pós-saída/.test(ob2) && /asserções\s+sobre isso devem ser invertidas juntas/.test(ob2), true);
  eq('CRÍTICO: o CLAUDE.md avisa para NÃO "arrumar" .env/AGENTS.md/.lovable enquanto a Lovable estiver ativa — foi assim que o app caiu duas vezes',
     /ficam como estão/.test(fs51.readFileSync('CLAUDE.md', 'utf8')), true);
}

// ── U70: o fim de linha é LF, e isso viaja no clone ────────────────────────
// 2026-08-25, primeira sessão em Windows. O Git for Windows instala com
// core.autocrlf=true: o checkout virou CRLF e ESTAS asserções começaram a
// falhar com o arquivo correto — várias delas casam regex com \n sobre o
// FONTE (a U41 do backfill foi a que caiu). O mesmo CRLF fazia
// routeTree.gen.ts aparecer modificado após todo build. Config de máquina
// conserta uma máquina; .gitattributes conserta todo mundo que clonar.
{
  const fs52 = require('fs');
  eq('.gitattributes existe — sem ele todo clone em Windows repete o bug do CRLF',
     fs52.existsSync('.gitattributes'), true);
  const ga = fs52.readFileSync('.gitattributes', 'utf8');
  eq('CRÍTICO: o .gitattributes força LF em todo arquivo de texto',
     /^\*\s+text=auto\s+eol=lf\s*$/m.test(ga), true);
  eq('CRÍTICO: .bat/.cmd continuam CRLF — forçá-los a LF quebra o android/gradlew.bat no Windows',
     /^\*\.bat\s+text\s+eol=crlf\s*$/m.test(ga) && /^\*\.cmd\s+text\s+eol=crlf\s*$/m.test(ga), true);
  eq('os binários versionados estão marcados binary — normalizar corromperia o template da proposta',
     ['docx', 'png', 'jpg', 'jar'].every((e) => new RegExp(`^\\*\\.${e}\\s+binary\\s*$`, 'm').test(ga)),
     true);
  eq('o .gitattributes explica POR QUE existe — senão a próxima faxina o apaga como ruído',
     /autocrlf/.test(ga) && /verificar-logica/.test(ga) && /routeTree/.test(ga), true);
  // O sintoma que custou a sessão: o SQL da U41 está correto, mas a regex
  // acima só casa com LF. Se este arquivo voltar a ter CRLF, a asserção
  // original volta a falhar — esta aqui denuncia a causa, não o sintoma.
  eq('CRÍTICO: a migration da U41 está em LF no disco — CRLF aqui derruba a asserção do backfill',
     !/\r\n/.test(fs52.readFileSync('supabase/migrations/20260822020000_u41_tipos_de_chamado.sql', 'utf8')),
     true);
}

// ── U71: equipes revisadas, multi-equipe e o LOCAL que pode não ser cliente ──
// (R80–R86). Este bloco exercita a lógica PURA da triagem com unidade real —
// o `carregar()` transpila o .ts, então o que roda aqui é o que roda em
// produção, e não uma regex sobre o fonte.
{
  const T = carregar('src/features/chamados/triagem.ts');
  const E = carregar('src/lib/equipes.ts');
  const fs53 = require('fs');

  // ── o vocabulário de equipes ─────────────────────────────────────────────
  eq('CRÍTICO (R81): audiovisual e business_ops saíram do vocabulário',
     E.EQUIPES.includes('audiovisual') || E.EQUIPES.includes('business_ops'), false);
  eq('R81: "outras" entrou, e tem rótulo', E.EQUIPES.includes('outras') && E.EQUIPE_LABEL.outras, 'Outras');
  eq('toda equipe do vocabulário tem cor (senão o chip nasce cinza de fallback, que significa DESCONHECIDO)',
     E.EQUIPES.every((e) => !!E.EQUIPE_CORES[e]), true);
  eq('toda cor de equipe tem par claro E escuro (anti-padrão nº 9 do DESIGN_SYSTEM)',
     E.EQUIPES.every((e) => !!E.EQUIPE_CORES[e].dark && !!E.EQUIPE_CORES[e].light), true);

  // ── pessoas: o primeiro nome resolve, e o ambíguo CALA ───────────────────
  const equipe1 = [
    { id: 'p-davi', nome: 'Davi Voos', equipe: 'ti' },
    { id: 'p-nick', nome: 'Nicholas Matos', equipe: 'ti' },
    { id: 'p-erik', nome: 'Erik Freitas', equipe: 'ti' },
    { id: 'p-gil', nome: 'Gilleno Souza', equipe: 'tecnica' },
  ];
  const idx1 = T.indicePrimeiroNome(equipe1);
  eq('R80: o primeiro nome resolve a pessoa', T.resolverPessoa('Nicholas', idx1), 'p-nick');
  eq('R80: o artigo na frente não derruba — "o Erik" resolve', T.resolverPessoa('o Erik', idx1), 'p-erik');
  eq('R80: "com o Nicholas" resolve', T.resolverPessoa('com o Nicholas', idx1), 'p-nick');
  // Dois nomes num campo que pede UM não é a mesma coisa que primeiro nome
  // ambíguo, e por isso a resposta é outra. Colisão de primeiro nome é
  // impossível de resolver: os dois Nicholas são candidatos legítimos e
  // escolher é chutar. Já "Erik e Nicholas" tem uma leitura natural — o
  // primeiro citado é quem faz —, que é exatamente o critério que o
  // `casarPessoa()` do importador do Notion já usa há tempo. Duas regras
  // diferentes para o mesmo sistema seria a incoerência.
  eq('dois nomes num campo de um: vence o PRIMEIRO citado, como no importador',
     T.resolverPessoa('Erik e Nicholas', idx1), 'p-erik');
  eq('…e o segundo não se perde: ele volta pela lista de apoios',
     T.resolverPessoas(['Erik', 'Nicholas'], idx1), ['p-erik', 'p-nick']);
  eq('R80: o nome completo resolve', T.resolverPessoa('Erik Freitas', idx1), 'p-erik');
  eq('R80: acento e caixa não atrapalham', T.resolverPessoa('DAVI', idx1), 'p-davi');
  eq('quem não existe devolve null (e não o primeiro da lista)', T.resolverPessoa('Fulano', idx1), null);

  // A regra que o importador do Notion NÃO tem, e que aqui é obrigatória.
  const doisNick = [
    { id: 'p-a', nome: 'Nicholas Matos', equipe: 'ti' },
    { id: 'p-b', nome: 'Nicholas Pereira', equipe: 'comercial' },
  ];
  const idx2 = T.indicePrimeiroNome(doisNick);
  eq('CRÍTICO (R80): primeiro nome AMBÍGUO não escolhe ninguém — pendurar na pessoa errada é pior que não pendurar',
     T.resolverPessoa('Nicholas', idx2), null);
  eq('…mas o nome COMPLETO continua resolvendo, mesmo com dois Nicholas',
     T.resolverPessoa('Nicholas Pereira', idx2), 'p-b');

  eq('a lista de apoios descarta o que não casou e não repete',
     T.resolverPessoas(['Nicholas', 'Fulano', 'Nicholas'], idx1), ['p-nick']);

  // ── equipes da atividade ─────────────────────────────────────────────────
  eq('R82: a equipe do assunto entra',
     T.equipesDaAtividade({ doAssunto: 'comercial' }), ['comercial']);
  eq('CRÍTICO (R83): a equipe de QUEM PARTICIPA se soma à do assunto — é assim que "o Nicholas participou" vira T.I. sem nome no código',
     T.equipesDaAtividade({ doAssunto: 'comercial', participantes: ['p-nick'], pessoas: equipe1 }),
     ['comercial', 'ti']);
  eq('a primeira da lista é a PRINCIPAL, e é o assunto que manda',
     T.equipesDaAtividade({ doAssunto: 'tecnica', participantes: ['p-nick'], pessoas: equipe1 })[0], 'tecnica');
  eq('sem repetição quando assunto e pessoa são da mesma equipe',
     T.equipesDaAtividade({ doAssunto: 'ti', participantes: ['p-nick', 'p-erik'], pessoas: equipe1 }), ['ti']);
  eq('atividade sem pista nenhuma cai em "outras", não em vazio (vazio some de todo filtro)',
     T.equipesDaAtividade({}), ['outras']);
  eq('equipe que não existe mais no vocabulário é ignorada',
     T.equipesDaAtividade({ doAssunto: 'audiovisual' }), ['outras']);

  // ── locais ───────────────────────────────────────────────────────────────
  const base = [
    { id: 'c-gv', nome: 'Green Village' },
    { id: 'c-m1', nome: 'Mirant Vila Madalena Residencial' },
    { id: 'c-m2', nome: 'Mirant Vila Madalena Studios' },
  ];
  const idxC = T.indiceClientes(base);
  eq('R84: nome exato casa com o cliente', T.casarLocal('Green Village', idxC), 'c-gv');
  eq('R84: contenção sem ambiguidade casa', T.casarLocal('Green Village Residencial', idxC), 'c-gv');
  eq('CRÍTICO (R84): contenção AMBÍGUA desiste — "Mirant" está em dois prédios, e escolher um pendura trabalho no errado',
     T.casarLocal('Mirant', idxC), null);
  eq('nome curto não casa por contenção (casaria com meio mundo)', T.casarLocal('Gre', idxC), null);

  const locais1 = T.resolverLocais({ nomes: ['Green Village'], setores: [], indiceClientes: idxC });
  eq('local que é cliente vira forma "cliente"', locais1[0].forma, 'cliente');
  eq('…com o id do cadastro', locais1[0].clienteId, 'c-gv');

  const locais2 = T.resolverLocais({ nomes: ['Edifício Aurora'], setores: [], indiceClientes: idxC });
  eq('CRÍTICO (R84): local que NÃO está na base vira PROSPECÇÃO, não some e não vira cliente (R21)',
     locais2[0].forma, 'prospeccao');
  eq('…guardando o nome como foi escrito', locais2[0].nome, 'Edifício Aurora');

  const locais3 = T.resolverLocais({
    nomes: ['Green Village'], setores: ['portaria_remota'], indiceClientes: idxC,
  });
  eq('R85: setor e prédio convivem na mesma atividade', locais3.length, 2);
  eq('R85: o setor vira UMA etiqueta', locais3.filter((l) => l.forma === 'setor').length, 1);
  eq('setor fora do vocabulário é ignorado',
     T.resolverLocais({ setores: ['inexistente'], indiceClientes: idxC }).length, 0);
  eq('sem limite de locais (R85) — dez entram os dez',
     T.resolverLocais({ nomes: Array.from({ length: 10 }, (_, i) => `Predio ${i}`), indiceClientes: idxC }).length, 10);
  eq('o mesmo local citado duas vezes entra uma só',
     T.resolverLocais({ nomes: ['Green Village', 'green village'], indiceClientes: idxC }).length, 1);

  // ── título sem local ─────────────────────────────────────────────────────
  eq('CRÍTICO (R86): o local sai do fim do título',
     T.tituloSemLocal('Portão social travando — Green Village', ['Green Village']),
     'Portão social travando');
  eq('R86: sai também quando vem na frente',
     T.tituloSemLocal('Green Village: portão social travando', ['Green Village']),
     'Portão social travando');
  eq('R86: título que não cita o local fica intacto',
     T.tituloSemLocal('Trocar a fechadura do portão', ['Green Village']),
     'Trocar a fechadura do portão');
  eq('CRÍTICO: não corta quando o que sobraria não descreve trabalho — título mutilado é pior que título com o prédio',
     T.tituloSemLocal('Visita — Green Village', ['Green Village']),
     'Visita — Green Village');
  eq('não corta por nome curto demais (cortaria palavra comum)',
     T.tituloSemLocal('Trocar o painel Sol da portaria', ['Sol']),
     'Trocar o painel Sol da portaria');

  // ── a função de IA carrega o vocabulário novo ────────────────────────────
  const ia = fs53.readFileSync('src/lib/chamado-rapido.functions.ts', 'utf8');
  eq('o schema da IA não oferece mais audiovisual/business_ops',
     /audiovisual|business_ops/.test(ia), false);
  eq('o schema da IA pede responsável, apoios, locais e setores',
     ['responsavel_citado', 'apoios_citados', 'locais_citados', 'setores_citados']
       .every((c) => ia.includes(c)), true);
  eq('CRÍTICO (R86): o prompt manda o local FORA do título — o exemplo antigo ensinava o contrário',
     /O LOCAL NÃO ENTRA NO TÍTULO/.test(ia), true);
  eq('R82: o prompt manda material visual e comunicação para o comercial',
     /comercial:[\s\S]{0,240}material visual e comunica/.test(ia), true);
  eq('R80: o prompt distingue responsável de apoio, com exemplos de linguagem de ajuda',
     /dar uma força/.test(ia) && /com apoio do/.test(ia), true);
  eq('a IA devolve MENÇÃO, nunca id — quem casa identidade é o triagem.ts',
     /_id"/.test(ia), false);

  // ── a migration ──────────────────────────────────────────────────────────
  const u71 = fs53.readFileSync('supabase/migrations/20260826120000_u71_equipes_e_locais.sql', 'utf8');
  eq('U71 troca o CHECK de equipe nas três tabelas',
     /chamados_equipe_check/.test(u71) && /profiles_equipe_check/.test(u71)
     && /demandas_equipe_check/.test(u71), true);
  eq('CRÍTICO: U71 MOVE quem estava nas equipes que saíram antes de apertar o CHECK — senão a migration aborta',
     /UPDATE public\.chamados SET equipe = 'comercial' WHERE equipe = 'audiovisual'/.test(u71)
     && /UPDATE public\.profiles SET equipe = 'outras'\s+WHERE equipe = 'business_ops'/.test(u71), true);
  eq('U71 cria chamado_equipes e chamado_locais',
     /CREATE TABLE IF NOT EXISTS public\.chamado_equipes/.test(u71)
     && /CREATE TABLE IF NOT EXISTS public\.chamado_locais/.test(u71), true);
  eq('CRÍTICO (R84): o banco garante UMA forma por linha de local — não confia na aplicação',
     /num_nonnulls\(cliente_id, prospeccao_id, setor\) = 1/.test(u71), true);
  eq('CRÍTICO: a RLS passa a enxergar o cliente vinculado por chamado_locais — sem isto o card nasce com o local em branco',
     /FUNCTION public\.pode_ver_cliente[\s\S]{0,2000}FROM public\.chamado_locais l/.test(u71), true);
  eq('CRÍTICO: quem cria prospecção consegue LER de volta (pode_ver_prospeccao)',
     /FUNCTION public\.pode_ver_prospeccao/.test(u71)
     && /CREATE POLICY "prospeccoes_select"[\s\S]{0,160}pode_ver_prospeccao/.test(u71), true);
  eq('achar_ou_criar_prospeccao é SECURITY DEFINER — a busca de duplicata não pode depender do que o técnico enxerga',
     /FUNCTION public\.achar_ou_criar_prospeccao[\s\S]{0,200}SECURITY DEFINER/.test(u71), true);
  eq('U71 só derruba chamado_clientes DEPOIS de conferir que tudo atravessou',
     /RAISE EXCEPTION[\s\S]{0,160}nada foi derrubado[\s\S]{0,200}DROP TABLE public\.chamado_clientes/.test(u71), true);
  eq('U71 termina com SELECTs de conferência e traz o DESFAZER',
     /esperado 0/.test(u71) && /DESFAZER/.test(u71), true);

  const produto5 = fs53.readFileSync('docs/PRODUTO.md', 'utf8');
  for (const r of ['R80', 'R81', 'R82', 'R83', 'R84', 'R85', 'R86']) {
    eq(`${r} está documentado`, new RegExp(`\\*\\*${r}\\*\\*`).test(produto5), true);
  }
}

// ── U72: arrasto que grava, ordenar com direção, autosave e cor por hierarquia
//    (R87–R91) ────────────────────────────────────────────────────────────────
{
  const fs54 = require('fs');
  const D = carregar('src/lib/degrade.ts');
  const LN3 = carregar('src/features/home/lentes.ts');
  const EQ3 = carregar('src/lib/equipes.ts');
  const CS4 = carregar('src/lib/chamado-status.ts');
  const PAL = carregar('src/lib/paleta.ts');

  // ── cor: o degradê e a tinta em cima dele ────────────────────────────────
  eq('o degradê parte de 3 paradas, no ângulo do dourado original',
     D.degradeDaCor('#F8C811').startsWith('linear-gradient(135deg, '), true);
  eq('a parada do meio é a cor pedida (o degradê não desloca a matiz)',
     D.degradeDaCor('#F8C811').includes(', #F8C811, '), true);
  eq('clarear(0) e escurecer(0) devolvem a própria cor',
     [D.clarear('#4F94E9', 0), D.escurecer('#4F94E9', 0)], ['#4f94e9', '#4f94e9']);
  eq('clarear(1) é branco e escurecer(1) é preto',
     [D.clarear('#4F94E9', 1), D.escurecer('#4F94E9', 1)], ['#ffffff', '#000000']);
  eq('hex inválido não explode — vira preto',
     D.hexParaRgb('não é cor'), [0, 0, 0]);
  eq('o degradê gerado a partir do amarelo bate com o dourado da marca a olho (paradas a menos de 12 de distância em cada canal)',
     (() => {
       const alvo = [[0xFC, 0xDE, 0x48], [0xE8, 0xB0, 0x0A]];
       const meu = [D.hexParaRgb(D.clarear('#F8C811', 0.22)), D.hexParaRgb(D.escurecer('#F8C811', 0.10))];
       return meu.every((c, i) => c.every((v, j) => Math.abs(v - alvo[i][j]) <= 12));
     })(), true);

  // A asserção que mais importa deste bloco: a tinta escolhida É LEGÍVEL sobre
  // o pé do degradê, para TODA cor que o sistema pode jogar num botão. Sem
  // isto, "colorir por hierarquia" viraria um botão ilegível por escala.
  const todasAsCores = [
    ...Object.values(PAL.PRISMA).map((c) => c.dark),
    ...Object.values(EQ3.EQUIPE_CORES).map((c) => c.dark),
    ...EQ3.EQUIPES.map((e) => EQ3.equipeCores(e).dark),
  ];
  eq('CRÍTICO: a tinta do botão passa de 4.5:1 sobre o PÉ do degradê, em toda cor do sistema',
     todasAsCores.every((hex) => D.contraste(D.escurecer(hex, 0.10), D.tintaSobreDegrade(hex)) >= 4.5),
     true);
  eq('sobre o dourado a tinta é o quase-preto da marca (nunca branco — §8.2)',
     D.tintaSobreDegrade('#F8C811'), '#08090E');
  eq('a escala de contraste está certa: preto×branco é 21',
     Math.round(D.contraste('#000000', '#ffffff')), 21);

  // ── ordenar com direção (R88) ────────────────────────────────────────────
  const ativ = (extra) => ({
    id: 'x' + (extra.criadoEm ?? '') + (extra.quando ?? ''), titulo: 't', numero: null,
    cliente: null, criadoEm: '2026-08-01T10:00:00', atualizadoEm: '2026-08-01T10:00:00',
    prioridadeRank: 2, prazoEstourado: false, quando: null, ...extra,
  });
  const cedo = ativ({ quando: '2026-09-01T10:00:00' });
  const tarde = ativ({ quando: '2026-09-20T10:00:00' });
  const semPrazo = ativ({ quando: null, criadoEm: '2026-07-01T10:00:00' });

  eq('prazo crescente: o que vence antes vem primeiro',
     LN3.ordenar([tarde, cedo], 'prazo', false).map((a) => a.quando), [cedo.quando, tarde.quando]);
  eq('prazo decrescente: o que vence depois vem primeiro',
     LN3.ordenar([cedo, tarde], 'prazo', true).map((a) => a.quando), [tarde.quando, cedo.quando]);
  eq('CRÍTICO (R88): sem prazo fica por último NOS DOIS SENTIDOS — "sem data" não é a maior data',
     [LN3.ordenar([semPrazo, cedo], 'prazo', false)[1].quando,
      LN3.ordenar([semPrazo, cedo], 'prazo', true)[1].quando],
     [null, null]);

  const atrasado = ativ({ quando: '2026-09-25T10:00:00', prazoEstourado: true });
  eq('no crescente o atrasado sobe, mesmo vencendo depois (é a fila de trabalho)',
     LN3.ordenar([cedo, atrasado], 'prazo', false)[0].prazoEstourado, true);
  eq('CRÍTICO: no DECRESCENTE o atrasado não é forçado ao topo — quem pede "vence por último primeiro" não quer o mais vencido na frente',
     LN3.ordenar([cedo, atrasado], 'prazo', true)[0].quando, atrasado.quando);

  const novo = ativ({ criadoEm: '2026-08-20T10:00:00' });
  const velho = ativ({ criadoEm: '2026-08-01T10:00:00' });
  eq('CRÍTICO: "recentes" SEM direção continua sendo o mais novo primeiro — os presets chamam assim e não podem inverter calados',
     LN3.ordenar([velho, novo], 'recentes').map((a) => a.criadoEm), [novo.criadoEm, velho.criadoEm]);
  eq('recebimento crescente (desc=true na chave "recentes") traz o pedido mais antigo primeiro',
     LN3.ordenar([novo, velho], 'recentes', true).map((a) => a.criadoEm), [velho.criadoEm, novo.criadoEm]);
  eq('a opção "Recebimento (crescente)" do menu aponta para esse par',
     LN3.ORDENACOES.find((o) => o.valor === 'recebimento:asc'),
     { valor: 'recebimento:asc', chave: 'recentes', desc: true,
       label: 'Recebimento (crescente)', nota: 'Pedido mais antigo primeiro' });
  eq('local decrescente inverte o alfabeto mas mantém "sem local" no fim',
     LN3.ordenar([ativ({ cliente: 'Amarilis' }), ativ({ cliente: null }), ativ({ cliente: 'Zebra' })], 'cliente', true)
       .map((a) => a.cliente), ['Zebra', 'Amarilis', null]);
  eq('prioridade decrescente traz a baixa primeiro',
     LN3.ordenar([ativ({ prioridadeRank: 0 }), ativ({ prioridadeRank: 3 })], 'prioridade', true)[0].prioridadeRank, 3);
  eq('ordenar não muta a lista recebida',
     (() => { const l = [tarde, cedo]; LN3.ordenar(l, 'prazo'); return l[0].quando; })(), tarde.quando);

  // ── o arrasto que grava (R89) ────────────────────────────────────────────
  const cd3 = fs54.readFileSync('src/features/chamados/data.ts', 'utf8');
  eq('CRÍTICO (R89): atualizarChamado pede as linhas afetadas — sem o .select() a recusa da RLS volta 204 SEM erro e o arrasto falha em silêncio',
     /export async function atualizarChamado[\s\S]{0,420}\.select\("id"\)/.test(cd3), true);
  eq('…e lista vazia vira erro tipado, para a tela distinguir "recusado" de "caiu a rede"',
     /class GravacaoRecusada/.test(cd3)
     && /if \(!data \|\| \(data as any\[\]\)\.length === 0\) throw new GravacaoRecusada\(\)/.test(cd3), true);

  const dash3 = fs54.readFileSync('src/routes/_authenticated/dashboard.tsx', 'utf8');
  eq('CRÍTICO (R89): o card anda ANTES da resposta do banco (atualização otimista)',
     /moverAtividade = useMutation\(\{[\s\S]{0,900}onMutate:[\s\S]{0,600}setQueriesData/.test(dash3), true);
  eq('…e volta para a coluna de origem se a gravação falhar',
     /onError:[\s\S]{0,300}for \(const \[chave, dado\] of ctx\?\.antes \?\? \[\]\) qc\.setQueryData/.test(dash3), true);
  eq('a recusa da RLS vira mensagem de permissão, não "não consegui mover"',
     /e instanceof GravacaoRecusada/.test(dash3), true);
  eq('soltar em "Sem status" explica em vez de não fazer nada',
     /"Sem status" não é um destino/.test(dash3), true);
  eq('a proposta comercial recusa com o motivo (o status dela mora na visita, não no chamado)',
     /A proposta comercial muda de etapa pelo fluxo da visita/.test(dash3), true);
  eq('o rótulo da natureza recusada vem de NATUREZA_LABEL — o ternário antigo chamava "comercial" de "De campo"',
     /NATUREZA_LABEL\[natureza\]/.test(dash3), true);

  const q3 = fs54.readFileSync('src/features/home/Quadro.tsx', 'utf8');
  eq('CRÍTICO (R89): o drop compara a coluna DESENHADA — comparar o status cru apagava o agendamento ao soltar na própria coluna',
     /colunaVisivel\(a\.coluna\) !== c\) onMover\(a, c\)/.test(q3), true);
  const ca3 = fs54.readFileSync('src/features/home/CardAtividade.tsx', 'utf8');
  eq('CRÍTICO: o card é div[role=button], não <button> — Firefox e Safari não iniciam o arrasto do ancestral a partir de um botão nativo',
     /role="button"/.test(ca3) && !/<button onClick=\{onClick\} className="elevavel"/.test(ca3), true);
  eq('…e continua acessível pelo teclado (Enter e Espaço)',
     /e\.key === "Enter" \|\| e\.key === " "/.test(ca3), true);

  // ── autosave (R90) ───────────────────────────────────────────────────────
  const hook = fs54.readFileSync('src/hooks/useRascunhoSalvo.ts', 'utf8');
  eq('R90: o rascunho grava sozinho depois de um tempo parado',
     /ESPERA_MS/.test(hook) && /setTimeout\(/.test(hook), true);
  eq('CRÍTICO (R90): campo FOCADO nunca é sobrescrito pelo servidor — sem esta guarda o refetch da própria gravação come as letras digitadas',
     /if \(focado\.current\) return;\s*\n\s*setValor\(valorServidor\);/.test(hook), true);
  eq('sair do campo grava na hora, sem esperar o tempo',
     /aoDesfocar = useCallback\(\(\) => \{[\s\S]{0,160}gravarAgora\(\)/.test(hook), true);
  eq('trocar de atividade grava o pendente ANTES de descartar o rascunho',
     /return \(\) => \{ gravarAgora\(\); \};/.test(hook), true);
  const pc6 = fs54.readFileSync('src/features/chamados/PainelChamado.tsx', 'utf8');
  eq('o painel usa o rascunho que se salva sozinho nos dois campos de texto',
     (pc6.match(/useRascunhoSalvo\(/g) ?? []).length >= 2, true);
  eq('CRÍTICO: o título ganhou selo de estado — com autosave não há mais clique que confirme, e ele era o único campo que gravava calado',
     /estado=\{estados\.titulo\}/.test(pc6), true);

  // ── cor por hierarquia (R87) ─────────────────────────────────────────────
  const ui3 = fs54.readFileSync('src/lib/ui.ts', 'utf8');
  eq('R87: existe um botão de seleção compartilhado, colorido pela coisa',
     /export const botaoSelecao/.test(ui3), true);
  eq('a tinta do botão sai do contraste medido, não de um valor fixo',
     /tintaSobreDegrade\(cor\.dark\)/.test(ui3), true);
  eq('sem cor própria, o dourado da marca segue valendo',
     /background: GOLD_GRAD, color: "#08090E"/.test(ui3), true);
  const di3 = fs54.readFileSync('src/features/chamados/DetalheInterno.tsx', 'utf8');
  // O dourado literal AINDA aparece no arquivo, nos botões de AÇÃO (salvar,
  // abrir) — e deve mesmo: ação continua sendo território da marca (§6.3). O
  // que mudou é só o botão de ESCOLHA, que é o `chip()`.
  eq('CRÍTICO (R87): o botão de escolha deixou de ser dourado para tudo — agora recebe a cor da coisa',
     /const chip = \(ativo: boolean, cor\?: Cores \| null\)[\s\S]{0,220}botaoSelecao\(ativo, isLight, cor/.test(di3),
     true);
  eq('…e cada um recebe a cor da SUA escala',
     /chip\(chamado\.status === s, \(\(\) => \{/.test(di3)
     && /chip\(chamado\.equipe === e, equipeCores\(e\)/.test(di3)
     && /chip\(chamado\.tipo === t, TIPO_CORES\[t\]/.test(di3), true);
  eq('a cor de status já era a hierarquia que o Davi descreveu: início azul, andamento amarelo, stand-by laranja',
     [CS4.chamadoStatusInfo('aberto').color,
      CS4.chamadoStatusInfo('em_andamento').color,
      CS4.chamadoStatusInfo('stand_by').color],
     [PAL.PRISMA.azul.dark, PAL.PRISMA.amarelo.dark, PAL.PRISMA.laranja.dark]);
  eq('toda equipe tem cor, inclusive a "outras" que a U71 criou',
     EQ3.EQUIPES.every((e) => !!EQ3.EQUIPE_CORES[e]), true);
  const tab3 = fs54.readFileSync('src/features/home/TabelaAtividades.tsx', 'utf8');
  eq('a coluna Equipe da tabela virou chip colorido, e plural (R83)',
     /a\.equipes\.length \?/.test(tab3) && /equipeCores\(e\)/.test(tab3), true);

  // ── o "+" e o diálogo (R91) ──────────────────────────────────────────────
  eq('R91: existe o botão "+" ao lado do alternador de quadro/lista',
     /aria-label="Criar uma nova atividade"/.test(dash3), true);
  eq('…e ele abre o diálogo de nova atividade',
     /<NovaAtividadeDialog aberto=\{novaAberta\}/.test(dash3), true);
  const nad = fs54.readFileSync('src/features/home/NovaAtividadeDialog.tsx', 'utf8');
  eq('CRÍTICO: o diálogo cria pela MESMA porta do resto (abrirChamado) — nada de um segundo caminho de escrita',
     /await abrirChamado\(\{/.test(nad) && !/\.from\("chamados"/.test(nad), true);
  eq('trocar de natureza limpa o tipo que a nova natureza não oferece (senão iria escondido para o banco)',
     /if \(tipo && !\(tiposDaNatureza\(natureza\) as string\[\]\)\.includes\(tipo\)\) setTipo\(""\)/.test(nad), true);
  eq('o diálogo diz que o local não vai no título (R86)',
     /O local vai na etiqueta, não no título/.test(nad), true);

  const produto6 = fs54.readFileSync('docs/PRODUTO.md', 'utf8');
  for (const r of ['R87', 'R88', 'R89', 'R90', 'R91']) {
    eq(`${r} está documentado`, new RegExp(`\\*\\*${r}\\*\\*`).test(produto6), true);
  }
}

console.log(`\n${ok} verificações passaram, ${falhas} falharam.`);
process.exit(falhas === 0 ? 0 : 1);
