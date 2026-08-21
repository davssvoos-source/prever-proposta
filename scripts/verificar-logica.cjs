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
eq('proposta com o cliente → Aguardando aprovação',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aguardando' })).coluna,
   'aguardando_aprovacao');
eq('e a bola é do cliente, não nossa',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aguardando' })).bolaCom,
   'cliente');
eq('enviada com resultado nulo não fica sem destino',
   A.colunaDaVisita(visita('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z' })).coluna,
   'aguardando_aprovacao');
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

// invariante do modelo: campo não carrega equipe nem sprint
const interno = A.atividadeDoChamado(chamado('aberto', { natureza: 'interno', equipe: 'ti', sprint: 'este_mes' }), ctxVazio);
const campo = A.atividadeDoChamado(chamado('aberto', { natureza: 'campo', equipe: 'tecnica', sprint: 'este_mes' }), ctxVazio);
eq('interno mantém equipe', interno.equipe, 'ti');
eq('campo NÃO carrega equipe (equipe é NOT NULL no banco: a nulidade é do modelo)', campo.equipe, null);
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
eq('proposta com o cliente continua em aberto',
   vAtiv('aprovada', { proposta_enviada_em: '2026-02-01T00:00:00Z', proposta_resultado: 'aguardando' }).emAberto, true);
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

// o período tem que filtrar de verdade: deixar item sem data passar fazia
// "Hoje" devolver a base inteira, porque interno em geral não tem prazo
const L = carregar('src/features/home/lentes.ts');
const semPrazo = A.atividadeDoChamado(chamado('aberto'), ctxVazio);
eq('item sem data é reconhecido como tal', L.semData(semPrazo), true);
eq('e o período o esconde (a tela avisa quantos)',
   L.aplicarLentes([semPrazo], { ...L.FILTROS_INICIAIS, periodo: 'hoje' },
                   { agora: new Date(2026, 2, 10), minhaEquipe: null }, (x) => x).length, 0);
eq('sem período escolhido ele aparece',
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
eq('sem matriz, técnico não abre a lista de chamados',
   TL.podeAbrir('chamados', 'tecnico', undefined), false);
eq('matriz vazia é o mesmo que sem matriz',
   TL.podeAbrir('chamados', 'tecnico', {}), false);

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
  eq('o mapa tem 67 distritos (a área atendida)', M.DISTRITOS.length, 67);
  const nomes = M.DISTRITOS.map(([n]) => n);
  for (const b of ['Marsilac', 'Parelheiros', 'Grajaú',
                   'Perus', 'Anhanguera', 'Tremembé', 'Jaçanã',
                   'Itaquera', 'Cidade Tiradentes', 'São Miguel Paulista']) {
    eq(`${b} está FORA do recorte`, nomes.includes(b), false);
  }
  for (const b of ['Moema', 'Itaim Bibi', 'Santana', 'Morumbi', 'Mooca',
                   'Cidade Dutra', 'Pinheiros', 'Vila Mariana']) {
    eq(`${b} está no mapa`, nomes.includes(b), true);
  }
  eq('todo distrito tem path fechado',
     M.DISTRITOS.every(([, d]) => d.startsWith('M') && d.endsWith('Z')), true);

  // o teste de pertencimento decide quem aparece no mapa e quem vira "fora de
  // São Paulo" no rodapé — errar aqui erra o número que a pessoa lê
  eq('a Sé está na cidade', M.dentroDaCidade(-23.5505, -46.6333), true);
  eq('Moema está na cidade', M.dentroDaCidade(-23.6017, -46.6653), true);
  eq('Santana está na cidade', M.dentroDaCidade(-23.5010, -46.6250), true);
  eq('Itaquera ficou fora do recorte', M.dentroDaCidade(-23.5405, -46.4568), false);
  eq('Cidade Dutra (cliente mais ao sul) está na área', M.dentroDaCidade(-23.7333, -46.7021), true);
  eq('Osasco NÃO está na cidade', M.dentroDaCidade(-23.5325, -46.7917), false);
  eq('Guarulhos NÃO está na cidade', M.dentroDaCidade(-23.4538, -46.5333), false);
  eq('Campinas NÃO está na cidade', M.dentroDaCidade(-22.9099, -47.0626), false);
  eq('Marsilac (área cortada) conta como fora', M.dentroDaCidade(-23.9200, -46.7100), false);
  eq('Grajaú (cortado) conta como fora', M.dentroDaCidade(-23.7885, -46.6900), false);
  eq('Perus (cortado) conta como fora', M.dentroDaCidade(-23.4103, -46.7500), false);

  // a projeção precisa pôr o norte em cima
  const se = M.projetar(-23.5505, -46.6333);
  const santana = M.projetar(-23.5010, -46.6250);
  eq('Santana projeta ACIMA da Sé (norte é para cima)', santana.y < se.y, true);
  eq('a Sé cai dentro do quadro',
     se.x > 0 && se.x < M.MAPA_SP.largura && se.y > 0 && se.y < M.MAPA_SP.altura, true);

  // O TESTE QUE MAIS IMPORTA no recorte do mapa: nenhum cliente da capital
  // pode ter ficado de fora. O recorte foi validado assim antes de aplicar, e
  // fica travado aqui — mexer nos distritos sem refazer esta conta é o jeito
  // de sumir com cliente do mapa sem ninguém perceber.
  {
    const sqlU24 = fs3.readFileSync('supabase/migrations/20260820150000_u24_base_clientes.sql', 'utf8');
    const re = /\('([^']+)', '[^']+', '[^']*', '([^']+)', '[A-Z]{2}', '[\d-]+', '[^']*', (-?[\d.]+), (-?[\d.]+)\)/g;
    const capital = [...sqlU24.matchAll(re)]
      .filter((m) => m[2] === 'São Paulo')
      .map((m) => ({ nome: m[1], lat: +m[3], lng: +m[4] }));
    eq('a planilha tem clientes na capital para conferir', capital.length > 100, true);
    const perdidos = capital.filter((c) => !M.dentroDaCidade(c.lat, c.lng)).map((c) => c.nome);
    eq('NENHUM cliente da capital ficou fora do recorte do mapa', perdidos, []);
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

console.log(`\n${ok} verificações passaram, ${falhas} falharam.`);
process.exit(falhas === 0 ? 0 : 1);
