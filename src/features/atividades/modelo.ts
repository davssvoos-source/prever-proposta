// Atividade — o registro unificado que a Home e a lista de chamados leem.
//
// A Home precisa mostrar "todas as atividades possíveis que envolvam o usuário",
// e essas atividades vêm de tabelas que NÃO falam o mesmo idioma de status:
//
//   chamados            aberto · agendado · em_andamento · stand_by ·
//                       aguardando_aprovacao · executado · concluido · cancelado
//   visitas_tecnicas    pendente · em_andamento · aguardando_aprovacao ·
//                       aprovada · reprovada  (+ legados; o CHECK foi derrubado)
//
// O quadro é por STATUS DO CHAMADO — decisão do Davi. Então a visita precisa
// de tradução, e a tradução é `colunaDaVisita()`: função total, com
// precedência ordenada, que NUNCA descarta um item em silêncio. (A tradução
// do pedido de compra morava aqui também; saiu com a R140/U96.)
//
// Este arquivo é o dono do vocabulário. Ordem e rótulo das colunas vêm daqui e
// de lib/chamado-status; visibilidade, colapso e teto de render são estado da
// tela e não entram aqui — senão o módulo limpo começa a carregar estado de UI.

import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo, sprintDoPrazo,
  TIPO_LABEL, TIPO_CORES, PRIORIDADE_LABEL, PRIORIDADE_CORES, STATUS_ORDEM,
  IMPACTO_LABEL, IMPACTO_CORES, IMPACTO_RANK,
  type ChamadoStatus, type ChamadoPrioridade, type ChamadoTipo, type Natureza,
  type ImpactoOperacional,
} from "@/lib/chamado-status";
import { fimSemana } from "@/lib/periodos";
import { getStatusInfo, statusBucket } from "@/lib/visita-status";
import { equipesDePessoas } from "@/lib/equipes";

export type FonteAtividade = "chamado" | "visita";

/** Coluna do quadro. `sem_status` só existe para não sumir com item quebrado. */
export type ColunaQuadro = ChamadoStatus | "sem_status";

export interface Cores {
  dark: string;
  light: string;
  bg: string;
  border: string;
}

/**
 * Quem está segurando a atividade. A coluna "Aguardando aprovação" junta
 * esperas incomparáveis — visita esperando o comercial (minutos, quem decide
 * está na sala) e proposta esperando o cliente (semanas, fora do nosso
 * controle). Sem este campo a contagem da coluna soma peras com maçãs.
 */
export type BolaCom = "voce" | "gestor" | "comercial" | "cliente" | null;

export interface Atividade {
  id: string;                 // "ch-<uuid>" | "vis-<uuid>" — prefixo evita colisão
  registroId: string;         // o uuid puro, para navegar
  fonte: FonteAtividade;

  coluna: ColunaQuadro;
  /** Rótulo do card quando a tradução precisa explicar. Vazio = usa o do status. */
  rotuloNativo: string | null;
  bolaCom: BolaCom;

  natureza: Natureza | null;
  tipo: ChamadoTipo | null;
  tipoLabel: string | null;
  tipoCor: Cores | null;

  statusCru: string | null;
  statusLabel: string;
  statusCor: Cores;

  titulo: string;
  numero: string | null;
  /** O local PRINCIPAL. A tabela e a ordenação leem este campo. */
  cliente: string | null;
  /**
   * Todos os locais, o principal na frente (R84/R85, U71). Pode conter nome de
   * prédio, de prospecção e etiqueta de setor — do ponto de vista do card os
   * três são a mesma coisa: onde a atividade acontece.
   */
  locais: string[];

  responsavelId: string | null;
  /** Quem está na atividade: responsável + apoios (ids de perfil, sem repetição). */
  participantes: string[];
  souResponsavel: boolean;
  souApoio: boolean;
  souAutor: boolean;

  /** Só no CAMPO (o SLA é indexado por ela, R112). No interno é null. */
  prioridade: ChamadoPrioridade | null;
  /**
   * urgente 0 … baixa 3 no campo; crítico 0 … sem impacto 3 no interno (R142);
   * visita e quem não tem nem uma nem outra = 4. É a régua única de "quão
   * urgente" para quem ordena, seja qual for o vocabulário do registro.
   */
  prioridadeRank: number;
  prioridadeLabel: string | null;
  prioridadeCor: Cores | null;
  /** Só no INTERNO, e só nos tipos que têm (R142: corretiva e operacional). */
  impacto: ImpactoOperacional | null;
  impactoLabel: string | null;
  impactoCor: Cores | null;

  /**
   * R139 (U96): as equipes são as das PESSOAS da atividade — a do responsável
   * primeiro, depois a de cada apoio, sem repetir. Não há mais campo de equipe
   * para escolher. `equipe` é a primeira da lista (a do responsável), para as
   * telas que ainda leem uma só.
   */
  equipe: string | null;
  equipes: string[];
  /**
   * R141 (U96): DERIVADO do prazo (`sprintDoPrazo`, R40) — nunca mais lido do
   * banco. Só no interno, que é onde a meta do mês o consome.
   */
  sprint: string | null;

  prazoLimite: string | null;
  prazoTexto: string | null;
  prazoEstourado: boolean;
  agendadaEm: string | null;
  /** Eixo do filtro de período. null = a atividade NUNCA é escondida por período. */
  quando: string | null;

  emAberto: boolean;
  /**
   * Concluído mas ainda esperando a análise de cobrança. É a fila que o
   * "executado" carregava antes da U13 — e é mais fiel, porque um chamado sem
   * nada a cobrar sai dela sozinho.
   */
  aConferir: boolean;
  criadoEm: string;
  atualizadoEm: string;
  /**
   * Quando a atividade SAIU da fila — null enquanto está em aberto.
   *
   * Não é `finalizada_em`: essa é o carimbo do motor de cobrança (quando o
   * técnico entregou), não o do encerramento. A Home já calculava isto solto
   * para podar encerrados velhos, e o gráfico precisa do mesmo número para
   * contar "quantos foram concluídos naquela semana" — duas contas do mesmo
   * fato em lugares diferentes acabam discordando, então mora aqui.
   */
  encerradoEm: string | null;

  /** Marcador âmbar: o que está esquisito neste registro, se algo estiver. */
  alerta: "sem_responsavel" | "status_desconhecido" | "reagendar" | null;
}

// ── Faixa de prazo ──────────────────────────────────────────────────────────
// A regra de cor de fundo do card (pedido do Davi, 2026-08-20): o card inteiro
// diz QUANDO vence, antes de a pessoa ler qualquer palavra.
//
//   atraso        → vermelho
//   esta semana   → amarelo   (o principal — é o que decide o dia)
//   dali em diante→ azul      (existe, mas não é hoje)
//   sem prazo /
//   já encerrado  → nenhuma   (o card fica na superfície neutra)
//
// A data considerada é `prazoLimite` OU, quando não há, `agendadaEm`: a visita
// não tem prazo, tem hora marcada — e para quem olha a tela dá no mesmo.
// O corte é o FIM da semana corrente (domingo 23:59), não "sete dias a partir
// de agora": a semana é a unidade em que as pessoas planejam, e na quinta-feira
// "esta semana" precisa querer dizer dois dias, não sete.

export type FaixaPrazo = "atraso" | "esta_semana" | "adiante" | null;

export function faixaPrazo(a: Atividade, agora: Date = new Date()): FaixaPrazo {
  if (!a.emAberto) return null;
  if (a.prazoEstourado) return "atraso";
  const quando = a.prazoLimite ?? a.agendadaEm;
  if (!quando) return null;
  const t = new Date(quando).getTime();
  if (t < agora.getTime()) return "atraso";
  return t <= fimSemana(agora).getTime() ? "esta_semana" : "adiante";
}

const CINZA: Cores = {
  dark: "#9ca3af", light: "#6b7280",
  bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
};

const PRI_RANK: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

/**
 * As colunas do quadro. NÃO é mais STATUS_ORDEM inteiro — o quadro é a fila de
 * trabalho, e duas coisas não são fila:
 *
 * · `agendado` some como coluna e cai em "Aguardando início". Um chamado com
 *   hora marcada continua esperando para começar; separá-los rendia duas
 *   colunas dizendo a mesma coisa. A hora marcada segue no card.
 * · `cancelado` não tem coluna: trabalho cancelado não é trabalho. Continua
 *   alcançável pela visão de lista com a situação "Encerrados", e o quadro diz
 *   quantos ficaram de fora em vez de escondê-los calado.
 */
export const COLUNAS: ColunaQuadro[] = [
  "aberto", "em_andamento", "stand_by", "aguardando_aprovacao", "concluido",
];

/** Onde o card cai no quadro. `null` = não tem coluna (fica só na lista). */
export function colunaVisivel(c: ColunaQuadro): ColunaQuadro | null {
  if (c === "agendado") return "aberto";
  if (c === "cancelado") return null;
  return c;
}

export function colunaLabel(c: ColunaQuadro): string {
  return c === "sem_status" ? "Sem status" : chamadoStatusInfo(c).label;
}

export function colunaCores(c: ColunaQuadro): Cores {
  if (c === "sem_status") return CINZA;
  const i = chamadoStatusInfo(c);
  return { dark: i.color, light: i.colorLight, bg: i.bg, border: i.border };
}

// ── A tradução ──────────────────────────────────────────────────────────────

export interface BrutoChamado {
  id: string;
  numero: string | null;
  titulo: string;
  status: string | null;
  natureza: string | null;
  tipo: string | null;
  prioridade: string | null;
  /** R142 — chega null enquanto a migration U96 não rodou, e o modelo tolera. */
  impacto_operacional?: string | null;
  /** Ainda lido (é a coluna do banco), mas a etiqueta sai das pessoas (R139). */
  equipe: string | null;
  prazo_limite: string | null;
  data_hora_agendada: string | null;
  responsavel_id: string | null;
  aberto_por: string | null;
  created_at: string;
  updated_at: string | null;
  concluida_em?: string | null;
  fechada_em?: string | null;
  faturamento_status?: string | null;
  cliente?: { nome: string } | null;
  /** U31: o nome como veio do Notion, quando não casou com cliente do QAP */
  cliente_origem_nome?: string | null;
}

export interface BrutoVisita {
  id: string;
  status: string | null;
  titulo: string | null;
  nome_predio: string | null;
  tecnico_id: string | null;
  data_hora_agendada: string | null;
  created_at: string;
  proposta_enviada_em?: string | null;
  proposta_resultado?: string | null;
  clientes?: { nome: string } | null;
  /**
   * U29: a visita passou a ter um chamado-capa com o MESMO id. Estes campos
   * vêm dele por join, e são o que tira a proposta da condição de cidadã de
   * segunda classe no quadro — antes ela entrava sem número e sem prioridade,
   * aparecendo junto sem ser igual.
   */
  chamado?: { numero: string | null; prioridade: string | null } | null;
  prioridade?: string | null;
}

interface Traduzido {
  coluna: ColunaQuadro;
  rotuloNativo: string | null;
  bolaCom: BolaCom;
  alerta: Atividade["alerta"];
}

const STATUS_VALIDOS = new Set<string>(STATUS_ORDEM);

/**
 * Coluna de um CHAMADO. Precedência:
 *   1. terminal (concluído/cancelado) manda;
 *   2. identidade do status;
 *   3. valor fora do CHECK → "sem_status", nunca sumir.
 *
 * Até a U96 havia um passo entre 1 e 2: o pedido de compra com ficha, cuja
 * situação (cotação, aprovado, comprado…) decidia a coluna. Saiu com a R140.
 */
export function colunaDoChamado(c: BrutoChamado): Traduzido {
  const st = c.status ?? "";

  if (st === "concluido") return { coluna: "concluido", rotuloNativo: null, bolaCom: null, alerta: null };
  if (st === "cancelado") return { coluna: "cancelado", rotuloNativo: null, bolaCom: null, alerta: null };

  if (STATUS_VALIDOS.has(st)) {
    const col = st as ChamadoStatus;
    const bola: BolaCom =
      col === "aguardando_aprovacao" ? "gestor" : null;
    const semDono = col === "aberto" && !c.responsavel_id;
    return { coluna: col, rotuloNativo: null, bolaCom: bola, alerta: semDono ? "sem_responsavel" : null };
  }

  return { coluna: "sem_status", rotuloNativo: null, bolaCom: null, alerta: "status_desconhecido" };
}

/**
 * Coluna de uma VISITA. Usa o status CRU, não `statusBucket()` — o bucket
 * "pendente" colapsa três valores que caem em colunas diferentes.
 *
 * Onde esta tradução mente, sem suavizar:
 *  · "Aguardando aprovação" junta o aval interno do comercial com a espera pelo
 *    cliente. `bolaCom` devolve no card a diferença que a coluna apagou.
 *  · Visita aprovada sem proposta enviada cai em "Aguardando aprovação" com a
 *    bola no comercial. Não é aprovação de chamado: é o funil parado esperando
 *    alguém mandar a proposta. O rótulo nativo diz isso em letras, porque a
 *    coluna sozinha não distingue.
 *  · "Cancelado" para proposta recusada mistura negócio perdido com desistência
 *    nossa. Não inventei coluna "perdido": inventar quebraria a premissa.
 */
export function colunaDaVisita(v: BrutoVisita): Traduzido {
  const st = (v.status ?? "").toLowerCase();

  if (st === "aprovada") {
    // R38 (2026-08-22): o fluxo da proposta ACABA no envio — o resto
    // (o cliente aceita ou recusa) é combinado fora do app, e o app não
    // finge mais que está acompanhando. Por isso "enviada" já vale
    // "concluído": não existe mais um estado intermediário de "com o
    // cliente, aguardando". A distinção aceita/recusada só sobrevive para
    // visitas de ANTES desta mudança, que já tinham resultado gravado —
    // apagar essa leitura apagaria história real sem motivo.
    if (v.proposta_resultado === "recusada")
      return { coluna: "cancelado", rotuloNativo: "Proposta recusada", bolaCom: null, alerta: null };
    if (v.proposta_resultado === "aceita")
      return { coluna: "concluido", rotuloNativo: "Proposta aceita", bolaCom: null, alerta: null };
    if (v.proposta_enviada_em)
      return { coluna: "concluido", rotuloNativo: "Proposta enviada", bolaCom: null, alerta: null };
    return { coluna: "aguardando_aprovacao", rotuloNativo: "Aprovada — falta enviar proposta", bolaCom: "comercial", alerta: null };
  }

  if (st === "aguardando_aprovacao" || st === "concluida")
    return { coluna: "aguardando_aprovacao", rotuloNativo: "Visita aguardando o comercial", bolaCom: "comercial", alerta: null };

  if (st === "reprovada" || st === "cancelada")
    // Reprovada não é morte, é volta para a fila. Enterrar em Cancelado
    // esconderia trabalho real que alguém tem que reagendar.
    return { coluna: "aberto", rotuloNativo: "Reprovada — reagendar", bolaCom: "voce", alerta: "reagendar" };

  if (st === "em_andamento")
    return { coluna: "em_andamento", rotuloNativo: null, bolaCom: null, alerta: null };

  if (st === "pendente" || st === "agendada")
    return v.data_hora_agendada
      ? { coluna: "agendado", rotuloNativo: null, bolaCom: null, alerta: null }
      : { coluna: "aberto", rotuloNativo: "Falta marcar a data", bolaCom: null, alerta: null };

  // O CHECK de status da visita foi derrubado: hoje é texto livre.
  return { coluna: "sem_status", rotuloNativo: null, bolaCom: null, alerta: "status_desconhecido" };
}

// ── Montagem ────────────────────────────────────────────────────────────────

export interface ContextoMontagem {
  userId: string | null;
  apoios: Set<string>;          // ids de chamado onde EU sou apoio
  /** chamado_id → perfis de apoio — alimenta a pilha de avatares do card. */
  apoiosDoChamado?: Map<string, string[]>;
  /** chamado_id → rótulos de LOCAL além do principal (R84/R85, U71). */
  locaisDoChamado?: Map<string, string[]>;
  /**
   * perfil → equipe do cadastro (R139, U96). É daqui que saem as etiquetas de
   * equipe da atividade: a de cada pessoa que está nela. Sem o mapa, a
   * atividade fica sem equipe — nunca com a coluna antiga do banco.
   */
  equipeDePessoa?: Map<string, string | null>;
}

/**
 * Os rótulos de local do card: o principal primeiro, depois os demais, sem
 * repetir. Vazio quando não há local nenhum — atividade interna costuma não
 * ter, e um chip "Sem local" seria ruído em toda a coluna.
 */
export function rotulosDeLocal(
  principal: string | null,
  outros: string[],
): string[] {
  const fora: string[] = [];
  for (const r of [principal, ...outros]) {
    const t = (r ?? "").trim();
    if (t && !fora.includes(t)) fora.push(t);
  }
  return fora;
}

/**
 * As equipes de uma atividade a partir de quem está nela (R139). Wrapper fino
 * sobre `equipesDePessoas` de lib/equipes — mora ali porque é vocabulário de
 * equipe, não de atividade; fica exportado aqui porque é aqui que o verificador
 * e as telas procuram.
 */
export function equipesDaAtividade(
  participantes: readonly string[],
  equipeDePessoa: Map<string, string | null> | undefined,
): string[] {
  return equipesDePessoas(participantes, (id) => equipeDePessoa?.get(id));
}

export function atividadeDoChamado(c: BrutoChamado, ctx: ContextoMontagem): Atividade {
  const t = colunaDoChamado(c);
  const interno = c.natureza === "interno";
  const info = chamadoStatusInfo(c.status);
  const pri = (c.prioridade ?? null) as ChamadoPrioridade | null;
  const tipo = (c.tipo ?? null) as ChamadoTipo | null;
  // R142: o impacto só vale no interno, e só quando o valor é do vocabulário —
  // a coluna pode nem existir ainda (migration pendente), e aí é null.
  const imp = interno && c.impacto_operacional && c.impacto_operacional in IMPACTO_RANK
    ? (c.impacto_operacional as ImpactoOperacional)
    : null;
  // status fora do vocabulário conta como aberto: a coluna "Sem status" seria
  // inalcançável se o filtro padrão o cortasse
  const emAberto = t.coluna === "sem_status" ? true : chamadoEmAberto(c.status);
  const participantes = Array.from(new Set([
    ...(c.responsavel_id ? [c.responsavel_id] : []),
    ...(ctx.apoiosDoChamado?.get(c.id) ?? []),
  ]));
  const equipes = equipesDaAtividade(participantes, ctx.equipeDePessoa);

  return {
    id: `ch-${c.id}`,
    registroId: c.id,
    fonte: "chamado",
    coluna: t.coluna,
    rotuloNativo: t.rotuloNativo,
    bolaCom: t.bolaCom,
    natureza: (c.natureza ?? null) as Natureza | null,
    tipo,
    tipoLabel: tipo ? TIPO_LABEL[tipo] ?? null : null,
    tipoCor: tipo ? TIPO_CORES[tipo] ?? null : null,
    statusCru: c.status,
    statusLabel: info.label,
    statusCor: { dark: info.color, light: info.colorLight, bg: info.bg, border: info.border },
    titulo: c.titulo,
    numero: c.numero,
    // o vínculo real vence o texto: o nome do QAP é o canônico (é o que tem
    // endereço e contrato atrás). O texto do Notion é a rede de segurança das
    // atividades cujo nome não casou — sem ela a etiqueta sumiria (U31).
    cliente: c.cliente?.nome ?? c.cliente_origem_nome ?? null,
    // R84/R85: a atividade pode ter VÁRIOS locais, e um deles pode ser um setor
    // inteiro. `cliente` acima continua sendo o principal — a tabela e a
    // ordenação leem ele, e não vale quebrá-las por causa do card.
    locais: rotulosDeLocal(
      c.cliente?.nome ?? c.cliente_origem_nome ?? null,
      ctx.locaisDoChamado?.get(c.id) ?? [],
    ),
    responsavelId: c.responsavel_id,
    participantes,
    souResponsavel: !!ctx.userId && c.responsavel_id === ctx.userId,
    souApoio: ctx.apoios.has(c.id),
    souAutor: !!ctx.userId && c.aberto_por === ctx.userId,
    prioridade: interno ? null : pri,
    // uma régua só de urgência: prioridade no campo, impacto no interno
    // (R142). Quem não tem nenhuma das duas fica no fim (4).
    prioridadeRank: interno
      ? (imp ? IMPACTO_RANK[imp] : 4)
      : PRI_RANK[c.prioridade ?? ""] ?? 4,
    prioridadeLabel: interno || !pri ? null : PRIORIDADE_LABEL[pri] ?? null,
    prioridadeCor: interno || !pri ? null : PRIORIDADE_CORES[pri] ?? null,
    impacto: imp,
    impactoLabel: imp ? IMPACTO_LABEL[imp] : null,
    impactoCor: imp ? IMPACTO_CORES[imp] : null,
    // R139 (U96): a equipe vem das PESSOAS, não mais de `chamados.equipe` nem
    // de `chamado_equipes`. A coluna do banco continua sendo escrita (é a
    // equipe do responsável, para quem ainda a lê), mas o que o card e o filtro
    // mostram é o que está nas pessoas HOJE — troca o responsável, troca a
    // etiqueta, sem ninguém precisar lembrar de trocar um campo à parte.
    equipe: equipes[0] ?? null,
    equipes,
    // R141 (U96): o sprint SAI DO PRAZO, sempre — a coluna morreu.
    sprint: interno ? sprintDoPrazo(c.prazo_limite) : null,
    prazoLimite: c.prazo_limite,
    prazoTexto: c.prazo_limite && chamadoEmAberto(c.status) ? textoPrazo(c.prazo_limite) : null,
    prazoEstourado: situacaoPrazo(c.prazo_limite, c.status) === "estourado",
    agendadaEm: c.data_hora_agendada,
    quando: c.data_hora_agendada ?? c.prazo_limite ?? null,
    emAberto,
    aConferir: c.natureza === "campo" && c.status === "concluido"
      && (c as any).faturamento_status === "a_analisar",
    criadoEm: c.created_at,
    atualizadoEm: c.updated_at ?? c.created_at,
    encerradoEm: emAberto
      ? null
      : (c.concluida_em ?? c.fechada_em ?? c.updated_at ?? c.created_at),
    alerta: t.alerta,
  };
}

export function atividadeDaVisita(v: BrutoVisita, ctx: ContextoMontagem): Atividade {
  const t = colunaDaVisita(v);
  // a capa manda; a coluna da própria visita é o fallback de quem ainda não
  const info = getStatusInfo(v.status as any);
  const bucket = statusBucket(v.status as any);

  return {
    id: `vis-${v.id}`,
    registroId: v.id,
    fonte: "visita",
    coluna: t.coluna,
    rotuloNativo: t.rotuloNativo,
    bolaCom: t.bolaCom,
    // U29: a proposta é um chamado como os outros (R24) — natureza e tipo
    // próprios, não mais nulos por ser "outra coisa".
    natureza: "comercial",
    tipo: "prospeccao",
    tipoLabel: TIPO_LABEL.prospeccao,
    tipoCor: TIPO_CORES.prospeccao,
    statusCru: v.status,
    statusLabel: info.label,
    // colorLight existe desde a U10; sem ele o chip some no tema claro
    statusCor: { dark: info.color, light: info.colorLight, bg: info.bg, border: info.border },
    // Título FIXO — nunca o nome do prédio (2026-08-22, Davi). O card antigo
    // repetia o condomínio no título E na etiqueta de local, uma redundância
    // que também escondia o que a atividade realmente É: uma proposta.
    //
    // R147 (U96), Davi: "O Título da atividade no painel de atividades da tela
    // INICIO deverá ser sempre 'Proposta Comercial'. E o título da atividade de
    // uma visita técnica para fluxo de montagem de orçamentos deverá ser
    // 'Visita Técnica'." É UM registro com dois papéis: para o comercial, que
    // toca a proposta, o card é a proposta; para o TÉCNICO RESPONSÁVEL pela
    // visita, o trabalho dele é a visita — e é o que o card dele diz. Quem
    // decide é quem está olhando (`ctx.userId`), não uma segunda linha.
    titulo: !!ctx.userId && v.tecnico_id === ctx.userId ? "Visita Técnica" : "Proposta Comercial",
    // o número vem do chamado-capa (U29); null enquanto o join não trouxer
    numero: v.chamado?.numero ?? null,
    // LOCAL, não "cliente" (2026-08-22, Davi): o prédio da visita raramente é
    // cliente de verdade — é o prospecto que estamos tentando fechar (R22), e
    // rotular como "cliente" um prédio que ainda não fechou nada é a exata
    // confusão que a R21/R22 existem para evitar. `nome_predio` vem primeiro
    // SEMPRE, mesmo quando a visita já está vinculada a um cliente (R23,
    // ampliação): o texto descreve O LOCAL, não a relação comercial — o
    // vínculo com o cliente continua existindo em `cliente_id`, só não é o
    // que aparece aqui. `clientes?.nome` só entra como ÚLTIMO recurso, se a
    // visita não tiver nem prédio nem título próprio.
    cliente: v.nome_predio ?? v.titulo ?? v.clientes?.nome ?? null,
    // A visita tem UM local por definição (o CHECK `visitas_alvo_unico` da U27
    // garante que ela aponta para cliente OU prospecção, nunca os dois), então
    // a lista aqui é sempre de zero ou um. Ela existe para o card ter uma
    // forma só de desenhar local, venha de chamado ou de visita.
    locais: rotulosDeLocal(v.nome_predio ?? v.titulo ?? v.clientes?.nome ?? null, []),
    responsavelId: v.tecnico_id,
    participantes: v.tecnico_id ? [v.tecnico_id] : [],
    souResponsavel: !!ctx.userId && v.tecnico_id === ctx.userId,
    souApoio: false,
    souAutor: false,
    // SEM prioridade, de propósito (2026-08-22, Davi: "por enquanto não
    // aplicamos ao sistema"). A capa (U29) grava 'normal' por padrão só para
    // satisfazer a coluna NOT NULL do banco — nunca foi uma escolha real de
    // ninguém, e mostrar "Normal" como se fosse dava a entender o contrário.
    // O rank cai para 4 (o mais frio): a fila da proposta é pela data da
    // visita, não por urgência.
    prioridade: null,
    prioridadeRank: 4,
    prioridadeLabel: null,
    prioridadeCor: null,
    impacto: null,
    impactoLabel: null,
    impactoCor: null,
    // R139: a equipe da visita é a do técnico responsável por ela — a mesma
    // regra das pessoas que vale para o chamado. (Antes era null porque a
    // visita não tem coluna de equipe; agora a coluna não é mais a fonte.)
    equipe: equipesDaAtividade(v.tecnico_id ? [v.tecnico_id] : [], ctx.equipeDePessoa)[0] ?? null,
    equipes: equipesDaAtividade(v.tecnico_id ? [v.tecnico_id] : [], ctx.equipeDePessoa),
    sprint: null,
    prazoLimite: null,
    // a visita não tem prazo, tem hora marcada — sem isto o card não dizia
    // quando ela é, nem na Início nem em /chamados
    prazoTexto: v.data_hora_agendada
      ? new Date(v.data_hora_agendada).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })
      : null,
    prazoEstourado: !!v.data_hora_agendada
      && new Date(v.data_hora_agendada).getTime() < Date.now()
      && (bucket === "pendente"),
    agendadaEm: v.data_hora_agendada,
    quando: v.data_hora_agendada ?? null,
    // Derivado da COLUNA traduzida, não do bucket do status cru. Vindo do
    // bucket, 'aprovada' e 'reprovada' ficavam encerradas — e a proposta na
    // mão do cliente e a visita a reagendar, que este arquivo acabou de mandar
    // para colunas de trabalho vivo, sumiam da tela no filtro padrão.
    // `sem_status` fica em aberto de propósito: é a regra de nunca sumir calado.
    emAberto: t.coluna !== "concluido" && t.coluna !== "cancelado",
    aConferir: false,   // visita não gera cobrança de chamado
    criadoEm: v.created_at,
    atualizadoEm: v.created_at,
    // pela data do DESFECHO, não pela de criação: uma proposta enviada hoje
    // numa visita de três meses atrás sairia contada no mês errado.
    // `proposta_resultado_em` só existe em visitas antigas com aceite/recusa
    // registrado (R38 tirou o botão que o gravava); `proposta_enviada_em` é o
    // desfecho de VERDADE agora, já que o envio É o fim do fluxo — por isso
    // vem antes do `created_at` de último recurso.
    encerradoEm: (t.coluna !== "concluido" && t.coluna !== "cancelado")
      ? null
      : ((v as any).proposta_resultado_em ?? v.proposta_enviada_em ?? v.created_at),
    alerta: t.alerta,
  };
}

// ── Leitura ─────────────────────────────────────────────────────────────────

export const BOLA_LABEL: Record<Exclude<BolaCom, null>, string> = {
  voce: "com você",
  gestor: "com o gestor",
  comercial: "com o comercial",
  cliente: "com o cliente",
};

export const ALERTA_LABEL: Record<Exclude<Atividade["alerta"], null>, string> = {
  sem_responsavel: "sem responsável",
  status_desconhecido: "status desconhecido",
  reagendar: "reagendar",
};

/** Mesmo dia no fuso local — o banner e o filtro de período dependem disto. */
export function mesmoDia(iso: string | null | undefined, ref: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
}

/**
 * "Você tem X atividades hoje" — uma fórmula só, para todos os perfis, derivada
 * do MESMO array que alimenta lista e quadro. Sem consulta paralela não existe
 * a possibilidade de o banner discordar da tela.
 */
export function atividadesDeHoje(lista: Atividade[], agora: Date = new Date()): Atividade[] {
  return lista.filter((a) =>
    a.emAberto && (
      mesmoDia(a.agendadaEm, agora)
      || mesmoDia(a.prazoLimite, agora)
      || a.prazoEstourado
      || a.coluna === "em_andamento"
    ));
}
