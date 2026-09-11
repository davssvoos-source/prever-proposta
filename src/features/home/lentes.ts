// Lentes da Home — filtros, e o que sobrou de "preset" depois da U74.
//
// Até a U74 havia OITO "padrões" (Meu dia · Tudo meu · Sprint deste mês ·
// Stand-by · Atrasados · A conferir · Sem responsável · Minha equipe, R17) num
// seletor próprio na barra. Davi removeu o seletor e pediu só "Atrasados" de
// volta — como valor do filtro de Prazo, não como preset (`estaAtrasada`
// acima). Os outros seis não tinham para onde voltar e saíram.
//
// "Meu dia" sozinho SOBREVIVE, porque não é escolhido num menu: é o que o
// banner "Você tem X hoje" aplica ao ser tocado (R11), e o que abre sozinho
// para o técnico na primeira visita da sessão (`presetPadrao`). Por isso
// `PRESETS` continua existindo — com um item — e não virou um booleano solto:
// o mecanismo de aplicar/ordenar/focar coluna (`aplicarLentes`,
// `recorteDosPaineis`, `ordemDoPreset`, `focoDoPreset`) é o mesmo, só a
// VITRINE que sumiu.
//
// A invariante que continua valendo: **preset filtra e destaca colunas; NUNCA
// reagrupa.** O eixo do quadro é sempre o status.

import type { Atividade, ColunaQuadro } from "@/features/atividades/modelo";
import { mesmoDia } from "@/features/atividades/modelo";
import { sprintDoPrazo } from "@/lib/chamado-status";

export type Cargo = "tecnico" | "sac" | "comercial" | "admin" | "operacional";
export type Vinculo = "responsavel" | "apoio" | "autor" | "todos";
/**
 * R60 (2026-08-22, Davi): o antigo "Período" (hoje/semana/mês, por data crua)
 * virou "Prazo", com os MESMOS 3 baldes que `sprintDoPrazo` já usa no resto
 * do app (essa_semana engole o vencido — R40, "o que venceu e segue aberto é
 * trabalho para agora") mais "Hoje", que nenhum balde de sprint isola sozinho.
 *
 * "atrasados" entrou na U74 (R94): era um dos oito PADRÕES (o seletor
 * "Padrão" saiu da tela), e é o único que não cabia nos baldes de data — os
 * outros três são sobre QUANDO a atividade vence; atrasados é sobre se ela
 * JÁ deveria ter sido resolvida, o que inclui gente parada sem prazo formal
 * nenhum (ver `estaAtrasada`).
 */
export type Prazo = "hoje" | "essa_semana" | "semana_que_vem" | "este_mes" | "atrasados" | null;

/**
 * "Atrasada" no sentido do filtro de Prazo — não é só prazo vencido.
 *
 * Espelha o que `alertas_chamados()` já notifica (e o antigo preset
 * "Atrasados" já aplicava): prazo estourado, OU em andamento/stand-by parado
 * há mais de 5 dias sem nenhum movimento. Um chamado esquecido em andamento
 * é tão atraso quanto um prazo vencido — e geralmente NEM TEM prazo formal
 * registrado, o que é exatamente por que este teste nunca olha `a.quando`
 * (ao contrário dos outros baldes de Prazo, que excluem quem não tem data).
 */
export function estaAtrasada(a: Atividade, agora: Date): boolean {
  return a.prazoEstourado
    || ((a.coluna === "em_andamento" || a.coluna === "stand_by")
        && agora.getTime() - new Date(a.atualizadoEm).getTime() > 5 * 864e5);
}
export type Ordenacao = "prazo" | "recentes" | "prioridade" | "atualizacao" | "cliente";

/**
 * As ordenações que a pessoa pode escolher À MÃO, na Início (R88, U72).
 *
 * Davi, 2026-08-26: "o botão de ordenar deve ser mais bem montado — Prazo
 * Crescente / Decrescente ; Cliente ; Prioridade ; Data de recebimento
 * Crescente / Decrescente."
 *
 * O menu é de seleção única e o `MenuFiltro` só sabe de string, então a
 * direção viaja no próprio valor (`"prazo:desc"`), e não num segundo controle.
 * É o formato de menor atrito: os presets continuam guardando só a chave
 * (`ordem: Ordenacao`) e não precisaram mudar.
 *
 * "recentes" é `criadoEm` DECRESCENTE e já existia — é a "data de recebimento"
 * do pedido, vista do lado do mais novo. Aqui ela ganha o par crescente e um
 * nome que diz o que ela é; o rótulo velho ("Recentes") não dizia de qual data
 * estava falando. "atualizacao" continua fora do menu, como estava: é ordem de
 * propósito estreito dos presets, não escolha de quem olha o quadro.
 */
export interface OpcaoOrdenacao {
  /** O valor que viaja no menu — "chave" ou "chave:desc". */
  valor: string;
  chave: Ordenacao;
  desc: boolean;
  label: string;
  /** A linha fina do menu, dizendo o que a ordem faz de verdade. */
  nota: string;
}

// `desc` aqui significa "inverte a direção NATURAL desta chave", e não
// "decrescente" em abstrato. Cada chave tem um sentido próprio que já era o
// dela: prazo cresce (vence antes primeiro), prioridade cresce (urgente
// primeiro), cliente cresce (A→Z), e "recentes" nasce decrescente (mais novo
// primeiro). Por isso o rótulo que a pessoa lê e a flag não andam juntos em
// "Recebimento" — e por isso o `valor` do menu é uma etiqueta própria, em vez
// de a flag vazar para dentro dele.
export const ORDENACOES: OpcaoOrdenacao[] = [
  { valor: "prazo:asc",        chave: "prazo",      desc: false, label: "Prazo (crescente)",        nota: "Vence antes primeiro; atrasados no topo" },
  { valor: "prazo:desc",       chave: "prazo",      desc: true,  label: "Prazo (decrescente)",      nota: "Vence depois primeiro" },
  { valor: "local",            chave: "cliente",    desc: false, label: "Local",                    nota: "A → Z; sem local por último" },
  { valor: "prioridade",       chave: "prioridade", desc: false, label: "Prioridade",               nota: "Urgente primeiro" },
  { valor: "recebimento:asc",  chave: "recentes",   desc: true,  label: "Recebimento (crescente)",  nota: "Pedido mais antigo primeiro" },
  { valor: "recebimento:desc", chave: "recentes",   desc: false, label: "Recebimento (decrescente)", nota: "Pedido mais novo primeiro" },
];

/** "prazo:desc" → { chave: "prazo", desc: true }. Valor desconhecido = null. */
export function lerOrdenacao(valor: string | null): { chave: Ordenacao; desc: boolean } | null {
  if (!valor) return null;
  const o = ORDENACOES.find((x) => x.valor === valor);
  if (o) return { chave: o.chave, desc: o.desc };
  // Tolera a CHAVE CRUA: é o que os presets guardam e o que ficou no
  // sessionStorage de quem usava a Início antes desta mudança. Sem isto, a
  // primeira visita depois do deploy abriria com a ordenação zerada.
  const chave = valor.split(":")[0] as Ordenacao;
  return ORDENACOES.some((x) => x.chave === chave) ? { chave, desc: false } : null;
}

/** O valor de menu de um par — para o menu marcar a opção certa ao reabrir. */
export function valorDaOrdenacao(chave: Ordenacao, desc: boolean): string {
  return ORDENACOES.find((o) => o.chave === chave && o.desc === desc)?.valor ?? chave;
}

export interface ContextoLente {
  agora: Date;
}

export interface Preset {
  chave: string;
  label: string;
  /** Colunas que o preset destaca. Vazio = todas com o mesmo peso. */
  foco: ColunaQuadro[];
  ordem: Ordenacao;
  aplica: (a: Atividade, ctx: ContextoLente) => boolean;
  /** Vínculo que o preset assume, se assumir algum. */
  vinculo?: Vinculo[];
}

/**
 * O único preset que sobrou da U74 — ver o cabeçalho do arquivo. Continua
 * sendo um ARRAY (não um objeto solto) porque `aplicarLentes`/
 * `recorteDosPaineis` procuram por `f.preset` como chave, e assim nenhuma das
 * duas precisou mudar quando os outros sete saíram.
 */
export const PRESETS: Preset[] = [
  {
    chave: "meu_dia",
    label: "Meu dia",
    foco: [],
    ordem: "prazo",
    vinculo: ["responsavel", "apoio"],
    aplica: (a, { agora }) =>
      a.emAberto && (
        mesmoDia(a.agendadaEm, agora)
        || mesmoDia(a.prazoLimite, agora)
        || a.prazoEstourado
        || a.coluna === "em_andamento"
      ),
  },
];

export function presetPadrao(cargo: Cargo | null): string | null {
  if (cargo === "tecnico") return "meu_dia";
  return null; // gestor abre vendo tudo; o recorte é escolha dele
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export interface Filtros {
  preset: string | null;
  vinculos: Vinculo[];      // vazio = todos
  prazo: Prazo;
  pessoa: string;           // "todos" | uid
  /** R60: departamento (Equipe, lib/equipes.ts). "todas" | valor de Equipe.
   *  R139 (U96): casa com as equipes das PESSOAS da atividade (`a.equipes`),
   *  em qualquer natureza — não mais com a coluna do chamado interno. */
  equipe: string;
  /** R251: tipo de demanda. "todos" | ChamadoTipo (TIPOS_DE_DEMANDA). */
  tipo: string;
  busca: string;
  /**
   * A ordenação escolhida À MÃO — `null` significa "segue a do padrão
   * selecionado" (o comportamento de sempre: cada preset já embute uma ordem
   * que faz sentido para ele, "Atrasados" já vem por prazo, "Sem dono" já vem
   * por prioridade). Escolher aqui é o usuário sobrepondo essa escolha, e por
   * isso troca de PRESET some com a marca (ver dashboard.tsx) — senão a
   * ordenação de um padrão vazaria, sem querer, para o próximo escolhido.
   *
   * Desde a U72 guarda o VALOR de menu (`"prazo:desc"`), não a chave — a
   * direção precisava caber aqui e o `MenuFiltro` só sabe de string. Use
   * `lerOrdenacao()` para virar o par {chave, desc}; ele tolera as chaves
   * cruas que ficaram no sessionStorage de sessões anteriores.
   */
  ordenacao: string | null;
}

export const FILTROS_INICIAIS: Filtros = {
  preset: null,
  vinculos: [],
  prazo: null,
  pessoa: "todos",
  equipe: "todas",
  tipo: "todos",
  busca: "",
  ordenacao: null,
};

export function semData(a: Atividade): boolean {
  return !a.quando;
}

/**
 * R60: reaproveita `sprintDoPrazo` — o MESMO cálculo que já decide o sprint
 * de um chamado interno — em vez de reimplementar limite de semana/mês aqui.
 * Uma segunda régua de "o que é essa semana" divergindo da primeira é
 * exatamente o tipo de coisa que rende dois números discordando sem aviso.
 */
function dentroDoPrazo(a: Atividade, p: Prazo, agora: Date): boolean {
  if (!p) return true;
  // "atrasados" é a exceção à regra logo abaixo: ele PASSA mesmo sem
  // `a.quando` — um chamado parado em andamento sem prazo formal é
  // exatamente o caso que `estaAtrasada` existe para pegar.
  if (p === "atrasados") return estaAtrasada(a, agora);
  // Item sem data NÃO passa quando há prazo escolhido — deixá-lo passar
  // fazia "Hoje" devolver a base inteira, porque a maioria dos chamados
  // internos não tem prazo. Mas ele também não some calado: a tela conta
  // quantos ficaram de fora e oferece tirar o filtro (ver `semData`).
  if (!a.quando) return false;
  if (p === "hoje") return mesmoDia(a.quando, agora);
  return sprintDoPrazo(a.quando, agora) === p;
}

function casaVinculo(a: Atividade, v: Vinculo[]): boolean {
  if (v.length === 0 || v.includes("todos")) return true;
  return (v.includes("responsavel") && a.souResponsavel)
    || (v.includes("apoio") && a.souApoio)
    || (v.includes("autor") && a.souAutor);
}

/** R139 (U96): a equipe da atividade é a das PESSOAS nela — escolher "Técnica"
 *  traz toda atividade em que alguém da técnica é responsável ou apoio, seja
 *  de campo, interna ou proposta. (Até a U96 só o interno tinha equipe, e o
 *  filtro escondia campo/comercial por definição; isso acabou.) */
/**
 * R251 (Davi, 10/09/2026): "No Kanban e Lista, também adicione o filtro por
 * Tipo de Demanda." É a mesma classe de "QUEM/O QUÊ" da equipe — vale na lista
 * e também no recorte dos painéis. "todos" não filtra nada.
 *
 * A visita entra como `prospeccao` (R48/R29), então filtrar por Prospecção traz
 * as visitas junto com os chamados comerciais, que é o que a palavra promete.
 */
function casaTipo(a: Atividade, tipo: string): boolean {
  return tipo === "todos" || a.tipo === tipo;
}

/**
 * R250 (Davi, 10/09/2026): "adicione no mecanismo de busca os nomes dos
 * clientes, onde caso o usuário digite o nome do cliente apareça as atividades
 * daquele cliente (Além do mecanismo continuar funcionando por titulo da
 * atividade)."
 *
 * O nome do prédio já entrava pelo campo `cliente` — mas só o PRINCIPAL, e só
 * quando a atividade aponta para um cliente da base. Num chamado de SETOR, de
 * PROSPECÇÃO ou com vários prédios, o nome que a pessoa conhece mora em
 * `locais` (R84/R85, U71) e a busca não o via. Agora varre número, título e
 * TODOS os locais.
 */
function textoDaBusca(a: Atividade): string {
  return [a.numero ?? "", a.titulo, a.cliente ?? "", ...(a.locais ?? [])].join(" ");
}

function casaEquipe(a: Atividade, equipe: string): boolean {
  return equipe === "todas" || a.equipes.includes(equipe);
}

/**
 * Composição é sempre E, nunca união: "vínculo = apoio" + preset "Atrasados"
 * dá os atrasados onde sou apoio, não "atrasados ∪ meus apoios".
 *
 * O filtro manual ganha do preset campo a campo — mexer num filtro não apaga
 * o preset, ele fica aceso como "modificado".
 */
export function aplicarLentes(
  lista: Atividade[],
  f: Filtros,
  ctx: ContextoLente,
  normalizar: (s: string) => string,
): Atividade[] {
  const preset = f.preset ? PRESETS.find((p) => p.chave === f.preset) ?? null : null;
  const termo = normalizar(f.busca.trim());
  // o vínculo do preset só vale se o usuário não escolheu o dele
  const vinculos = f.vinculos.length ? f.vinculos : (preset?.vinculo ?? []);

  return lista.filter((a) => {
    // R180 (U103 — Davi, 04/09/2026: "as atividades concluídas devem aparecer
    // na tela INICIO sempre que os filtros estiverem vazios […] se o usuário
    // colocar um filtro em que as atividades concluídas não fazem parte do
    // grupo de filtro, aí sim podem sumir"). Até a U103 valia a R60 — a Início
    // só mostrava o que estava em aberto. Agora a CONCLUÍDA fica (é a coluna
    // Concluído do quadro, e a lista), e só sai quando um filtro a exclui por
    // natureza: o de PRAZO (é sobre trabalho que ainda vence) e o preset "meu
    // dia" (que já exige emAberto). Pessoa, equipe e busca não a excluem.
    // O CANCELADO continua fora: nunca teve coluna (é o "N cancelados — veja na
    // lista" do quadro) e a R60 não foi revista para ele.
    if (a.coluna === "cancelado") return false;
    if (!a.emAberto && f.prazo) return false;
    if (preset && !preset.aplica(a, ctx)) return false;
    if (!casaVinculo(a, vinculos)) return false;
    if (f.pessoa !== "todos" && a.responsavelId !== f.pessoa) return false;
    if (!casaEquipe(a, f.equipe)) return false;
    if (!casaTipo(a, f.tipo)) return false;
    if (!dentroDoPrazo(a, f.prazo, ctx.agora)) return false;
    if (!termo) return true;
    return normalizar(textoDaBusca(a)).includes(termo);
  });
}

/**
 * O recorte dos PAINÉIS DO TOPO — só as dimensões de QUEM e O QUÊ, nunca as
 * de QUANDO ou de ESTADO.
 *
 * ── POR QUE ELE EXISTE (defeito real, pego em revisão antes de rodar) ──
 *
 * A primeira versão dos painéis dinâmicos usava `aplicarLentes` com
 * `prazo: null` e mais nada trocado. Parecia certo e estava errado:
 * `aplicarLentes` corta `!a.emAberto` incondicionalmente (R60 — a Início só
 * mostra o que está em aberto). Como `encerradoEm` só é preenchido em
 * atividade encerrada, o conjunto que chegava aos painéis **nunca continha um
 * encerrado**. As quatro barras do passado ficavam em zero, a rosca da meta
 * travava em 0% e o indicador "Concluídas no mês" mostrava 0 — para todo
 * mundo, no primeiro acesso, sem ninguém tocar em filtro. Antes da mudança
 * esses três números vinham de consulta própria e mostravam a verdade.
 *
 * E não adianta filtrar por estado aqui de jeito nenhum: o gráfico é um eixo
 * de tempo com metade passado e metade futuro. O passado precisa dos
 * ENCERRADOS (`encerradoEm`), o futuro precisa dos ABERTOS com prazo.
 * Qualquer recorte por estado apaga uma das duas metades. Cada barra já se
 * recorta sozinha.
 *
 * O PRESET cai pela mesma razão: sete dos oito começam com `a.emAberto &&`, e
 * `meu_dia` — o padrão do técnico, aplicado sozinho na primeira carga — ainda
 * recorta por dia. Mas o VÍNCULO dele fica: é o que mantém "Tudo meu"
 * significando "meu" também no painel.
 */
export function recorteDosPaineis(
  lista: Atividade[],
  f: Filtros,
  normalizar: (s: string) => string,
): Atividade[] {
  const preset = f.preset ? PRESETS.find((p) => p.chave === f.preset) ?? null : null;
  const termo = normalizar(f.busca.trim());
  // mesma precedência de `aplicarLentes`: a escolha da pessoa vence a do preset
  const vinculos = f.vinculos.length ? f.vinculos : (preset?.vinculo ?? []);

  return lista.filter((a) => {
    if (!casaVinculo(a, vinculos)) return false;
    if (f.pessoa !== "todos" && a.responsavelId !== f.pessoa) return false;
    // equipe é "QUEM" (que time), não "QUANDO" — mesma classe que pessoa,
    // então vale aqui igual, ao contrário de prazo (ver o cabeçalho acima)
    if (!casaEquipe(a, f.equipe)) return false;
    if (!casaTipo(a, f.tipo)) return false;
    if (!termo) return true;
    return normalizar(textoDaBusca(a)).includes(termo);
  });
}

/**
 * Ordena a lista. `desc` inverte o sentido (R88, U72).
 *
 * DUAS REGRAS SOBREVIVEM À INVERSÃO, e é o que separa isto de um `.reverse()`:
 *
 * 1. **Vazio sempre por último, nos dois sentidos.** É a regra da casa (o caso
 *    `cliente` abaixo e a `TabelaAtividades` já a seguiam). Invertendo cru, uma
 *    lista "Prazo decrescente" começaria com dezenas de itens SEM prazo — e
 *    "sem data" não é a maior data, é a ausência dela.
 * 2. **O desempate por `criadoEm` não inverte.** Ele existe para a ordem ser
 *    estável e previsível entre itens empatados, não para ser um segundo eixo.
 *
 * O que a inversão MUDA de propósito: no crescente, atrasado vem sempre na
 * frente (é a fila de trabalho). No decrescente isso seria contraditório —
 * quem pede "prazo decrescente" quer o que vence por último no topo, e o
 * atrasado é justamente o que vence primeiro. Então o bloco de estourados só
 * vale no crescente.
 */
export function ordenar(lista: Atividade[], modo: Ordenacao, desc = false): Atividade[] {
  const l = [...lista];
  const s = desc ? -1 : 1;
  // desempate estável: o mais novo primeiro, independentemente do sentido
  const novoPrimeiro = (a: Atividade, b: Atividade) => (a.criadoEm < b.criadoEm ? 1 : -1);

  switch (modo) {
    case "prazo":
      return l.sort((a, b) => {
        const semA = !a.quando, semB = !b.quando;
        if (semA !== semB) return semA ? 1 : -1;   // vazio por último, sempre
        if (semA && semB) return novoPrimeiro(a, b);
        if (!desc && a.prazoEstourado !== b.prazoEstourado) return a.prazoEstourado ? -1 : 1;
        const qa = new Date(a.quando as string).getTime();
        const qb = new Date(b.quando as string).getTime();
        if (qa !== qb) return (qa - qb) * s;
        return novoPrimeiro(a, b);
      });
    case "prioridade":
      return l.sort((a, b) => (a.prioridadeRank - b.prioridadeRank) * s || novoPrimeiro(a, b));
    case "atualizacao":
      return l.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? -1 : 1) * s); // mais parado primeiro
    case "cliente":
      return l.sort((a, b) => {
        // sem cliente vai para o fim, nos dois sentidos: alfabético que
        // começa com dez traços não ajuda a achar "quem é do Pateo Klabin"
        if (!a.cliente && !b.cliente) return novoPrimeiro(a, b);
        if (!a.cliente) return 1;
        if (!b.cliente) return -1;
        return a.cliente.localeCompare(b.cliente, "pt-BR", { numeric: true }) * s;
      });
    case "recentes":
    default:
      // A direção NATURAL de "recentes" é o mais novo primeiro — é o que ela
      // sempre significou, e é o que os presets esperam ao chamar sem `desc`.
      return l.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1) * s);
  }
}

/**
 * R246 (Davi, 10/09/2026): "as atividades da coluna de Status Concluído devem
 * estar ordenadas por data de conclusão, sendo a mais recente no topo. Esta
 * ordem deve ser fixa independente da ordenação que o usuário selecionar."
 * Sem data de encerramento vai para o fim; empate desempata pelo mais novo.
 */
export function ordenarConcluidas(lista: readonly Atividade[]): Atividade[] {
  return [...lista].sort((a, b) => {
    const ea = a.encerradoEm ?? "";
    const eb = b.encerradoEm ?? "";
    if (ea !== eb) return ea < eb ? 1 : -1;
    return a.criadoEm < b.criadoEm ? 1 : -1;
  });
}

/**
 * R248 (Davi, 10/09/2026): "A coluna de Agendados deve ter ordenação fixa: As
 * mais próximas acima (Datas mais próximas do agendamento)."
 *
 * Ordena por INSTANTE, não por texto. `agendadaEm` chega em dois formatos — o
 * carimbo com fuso da visita (`data_hora_agendada`) e o fim do dia LOCAL do
 * chamado que só tem dia marcado (`fimDoDiaAgendado`, sem fuso) —, e comparar
 * as duas strings erra a ordem dentro do mesmo dia. Sem dia marcado vai para o
 * fim: o card está na coluna por status, não por agenda. Empate desempata pelo
 * mais antigo, que é quem espera há mais tempo.
 */
export function ordenarAgendados(lista: readonly Atividade[]): Atividade[] {
  const quando = (a: Atividade): number | null => {
    if (!a.agendadaEm) return null;
    const t = new Date(a.agendadaEm).getTime();
    return Number.isNaN(t) ? null : t;
  };
  return [...lista].sort((a, b) => {
    const ta = quando(a);
    const tb = quando(b);
    if (ta === null && tb === null) return a.criadoEm < b.criadoEm ? -1 : 1;
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (ta !== tb) return ta - tb;
    return a.criadoEm < b.criadoEm ? -1 : 1;
  });
}

/**
 * R248: a atividade "A seguir" — a PRIMEIRA da coluna Agendado que tem dia
 * marcado. Quem manda é a ordem da coluna, não o dono: a Início mostra as
 * atividades de todos (R221/R246) e o card já diz de quem é pela pilha de
 * avatares. A atrasada continua sendo a próxima — é ela que está em cima da
 * hora, e o realce troca de cor para dizer isso.
 *
 * Isto substitui o `proximaVisitaDe` como resposta à pergunta "o que vem
 * agora?" NO DESKTOP: o banner que morava acima dos filtros virou este card.
 */
export function aSeguirDe(lista: readonly Atividade[]): Atividade | null {
  return ordenarAgendados(lista).find((a) => !!a.agendadaEm) ?? null;
}

// ── A ordem das colunas do quadro (R181) ─────────────────────────────────────
//
// Davi, 04/09/2026: "a ordem das colunas deve ser editável pelo usuário, onde
// caso ele segure e arraste, ele altera a ordem das colunas e fica salvo
// daquele jeito somente para visualização daquele usuário." A ordem é
// PREFERÊNCIA de quem olha (localStorage), não regra do quadro — o eixo
// continua sendo o status, o que muda é a posição.
//
// As duas funções são puras e valem para qualquer lista de colunas: o quadro
// só as chama. `ordemDasColunas` TOLERA o que estiver salvo — coluna que não
// existe mais é ignorada, coluna nova que ainda não estava salva entra no fim,
// na posição padrão. Assim uma coluna que nasça amanhã (R168, "Agendados")
// aparece para quem já tinha reordenado, em vez de sumir.

/** A ordem efetiva: a salva, saneada contra a base; o que falta entra no fim. */
export function ordemDasColunas<T extends string>(salva: readonly string[] | null | undefined, base: readonly T[]): T[] {
  const validas = (salva ?? []).filter((c): c is T => (base as readonly string[]).includes(c));
  const semRepetir = validas.filter((c, i) => validas.indexOf(c) === i);
  return [...semRepetir, ...base.filter((c) => !semRepetir.includes(c))];
}

/** Move a coluna `de` para a posição da coluna `para` (as outras deslizam). */
export function moverColuna<T extends string>(ordem: readonly T[], de: T, para: T): T[] {
  if (de === para) return [...ordem];
  const iDe = ordem.indexOf(de), iPara = ordem.indexOf(para);
  if (iDe < 0 || iPara < 0) return [...ordem];
  const nova = ordem.filter((c) => c !== de);
  nova.splice(iPara, 0, de);
  return nova;
}

export function ordemDoPreset(chave: string | null): Ordenacao {
  return PRESETS.find((p) => p.chave === chave)?.ordem ?? "prazo";
}

export function focoDoPreset(chave: string | null): ColunaQuadro[] {
  return PRESETS.find((p) => p.chave === chave)?.foco ?? [];
}
