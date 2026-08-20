// Atividade — o registro unificado que a Home e a lista de chamados leem.
//
// A Home precisa mostrar "todas as atividades possíveis que envolvam o usuário",
// e essas atividades vêm de tabelas que NÃO falam o mesmo idioma de status:
//
//   chamados            aberto · agendado · em_andamento · stand_by ·
//                       aguardando_aprovacao · executado · concluido · cancelado
//   visitas_tecnicas    pendente · em_andamento · aguardando_aprovacao ·
//                       aprovada · reprovada  (+ legados; o CHECK foi derrubado)
//   chamado_compra      solicitado · em_cotacao · aprovado · comprado ·
//                       recebido · recusado
//
// O quadro é por STATUS DO CHAMADO — decisão do Davi. Então visita e compra
// precisam de tradução, e a tradução é `colunaDaAtividade()`: função total,
// com precedência ordenada, que NUNCA descarta um item em silêncio.
//
// Este arquivo é o dono do vocabulário. Ordem e rótulo das colunas vêm daqui e
// de lib/chamado-status; visibilidade, colapso e teto de render são estado da
// tela e não entram aqui — senão o módulo limpo começa a carregar estado de UI.

import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo,
  TIPO_LABEL, TIPO_CORES, PRIORIDADE_LABEL, PRIORIDADE_CORES, STATUS_ORDEM,
  type ChamadoStatus, type ChamadoPrioridade, type ChamadoTipo, type Natureza,
} from "@/lib/chamado-status";
import { fimSemana } from "@/lib/periodos";
import { getStatusInfo, statusBucket } from "@/lib/visita-status";
import { SITUACAO_LABEL, type SituacaoCompra } from "@/features/chamados/compra";

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
export type BolaCom = "voce" | "gestor" | "comercial" | "cliente" | "financeiro" | null;

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
  cliente: string | null;

  responsavelId: string | null;
  /** Quem está na atividade: responsável + apoios (ids de perfil, sem repetição). */
  participantes: string[];
  souResponsavel: boolean;
  souApoio: boolean;
  souAutor: boolean;

  prioridade: ChamadoPrioridade | null;
  prioridadeRank: number;     // urgente 0 … baixa 3; visita e interno = 4
  prioridadeLabel: string | null;
  prioridadeCor: Cores | null;

  equipe: string | null;      // zerado fora do interno — invariante do modelo
  sprint: string | null;      // idem

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

  compra: { situacao: SituacaoCompra; situacaoLabel: string } | null;
  /** Marcador âmbar: o que está esquisito neste registro, se algo estiver. */
  alerta: "sem_responsavel" | "sem_acesso_ficha" | "status_desconhecido" | "reagendar" | null;
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
  equipe: string | null;
  sprint: string | null;
  prazo_limite: string | null;
  data_hora_agendada: string | null;
  responsavel_id: string | null;
  aberto_por: string | null;
  created_at: string;
  updated_at: string | null;
  faturamento_status?: string | null;
  cliente?: { nome: string } | null;
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
}

export interface FichaCompra {
  situacao: SituacaoCompra;
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
 *   1. terminal (concluído/cancelado) manda, mesmo em pedido de compra — protege
 *      contra descompasso entre o chamado e a ficha da compra;
 *   2. pedido de compra com ficha → a situação da compra decide;
 *   3. identidade do status;
 *   4. valor fora do CHECK → "sem_status", nunca sumir.
 */
export function colunaDoChamado(
  c: BrutoChamado,
  ficha: FichaCompra | null | undefined,
  ehPedidoCompra: boolean,
): Traduzido {
  const st = c.status ?? "";

  if (st === "concluido") return { coluna: "concluido", rotuloNativo: null, bolaCom: null, alerta: null };
  if (st === "cancelado") return { coluna: "cancelado", rotuloNativo: null, bolaCom: null, alerta: null };

  if (ehPedidoCompra) {
    if (!ficha) {
      // A U9 garante ficha para 100% dos pedidos (trigger de insert, trigger de
      // update do tipo, e backfill). Se ela não veio, a causa é ACESSO, não
      // dado: chamados_select entrega todo chamado interno a qualquer
      // autenticado, mas chamado_compra_select passa por pode_acessar_chamado.
      return {
        coluna: STATUS_VALIDOS.has(st) ? (st as ChamadoStatus) : "sem_status",
        rotuloNativo: null, bolaCom: null, alerta: "sem_acesso_ficha",
      };
    }
    switch (ficha.situacao) {
      case "solicitado":
        // O chamado em aguardando_aprovacao é o único sinal de que alguém pôs
        // o gasto em mesa — a compra não tem situação para isso.
        return st === "aguardando_aprovacao"
          ? { coluna: "aguardando_aprovacao", rotuloNativo: "Compra esperando decisão", bolaCom: "financeiro", alerta: null }
          : { coluna: "aberto", rotuloNativo: "Pedido a cotar", bolaCom: null, alerta: null };
      case "em_cotacao":
        return st === "aguardando_aprovacao"
          ? { coluna: "aguardando_aprovacao", rotuloNativo: "Compra esperando decisão", bolaCom: "financeiro", alerta: null }
          : { coluna: "em_andamento", rotuloNativo: "Em cotação", bolaCom: null, alerta: null };
      case "aprovado":
        return { coluna: "em_andamento", rotuloNativo: "Aprovado — falta comprar", bolaCom: null, alerta: null };
      case "comprado":
        return { coluna: "stand_by", rotuloNativo: "Comprado — aguardando entrega", bolaCom: null, alerta: null };
      case "recebido":
        return { coluna: "concluido", rotuloNativo: "Recebido", bolaCom: null, alerta: null };
      case "recusado":
        return { coluna: "cancelado", rotuloNativo: "Compra recusada", bolaCom: null, alerta: null };
    }
  }

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
    if (v.proposta_resultado === "aceita")
      return { coluna: "concluido", rotuloNativo: "Proposta aceita", bolaCom: null, alerta: null };
    if (v.proposta_resultado === "recusada")
      return { coluna: "cancelado", rotuloNativo: "Proposta recusada", bolaCom: null, alerta: null };
    if (v.proposta_enviada_em)
      return { coluna: "aguardando_aprovacao", rotuloNativo: "Proposta com o cliente", bolaCom: "cliente", alerta: null };
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
  fichas: Map<string, FichaCompra>;
  /** chamado_id → perfis de apoio — alimenta a pilha de avatares do card. */
  apoiosDoChamado?: Map<string, string[]>;
}

export function atividadeDoChamado(c: BrutoChamado, ctx: ContextoMontagem): Atividade {
  const ehCompra = c.tipo === "pedido_compra";
  const t = colunaDoChamado(c, ctx.fichas.get(c.id), ehCompra);
  const interno = c.natureza === "interno";
  const info = chamadoStatusInfo(c.status);
  const pri = (c.prioridade ?? null) as ChamadoPrioridade | null;
  const tipo = (c.tipo ?? null) as ChamadoTipo | null;
  const ficha = ctx.fichas.get(c.id);

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
    cliente: c.cliente?.nome ?? null,
    responsavelId: c.responsavel_id,
    participantes: Array.from(new Set([
      ...(c.responsavel_id ? [c.responsavel_id] : []),
      ...(ctx.apoiosDoChamado?.get(c.id) ?? []),
    ])),
    souResponsavel: !!ctx.userId && c.responsavel_id === ctx.userId,
    souApoio: ctx.apoios.has(c.id),
    souAutor: !!ctx.userId && c.aberto_por === ctx.userId,
    prioridade: interno ? null : pri,
    // no interno a fila é pelo prazo combinado, não por prioridade
    prioridadeRank: interno ? 4 : PRI_RANK[c.prioridade ?? ""] ?? 4,
    prioridadeLabel: interno || !pri ? null : PRIORIDADE_LABEL[pri] ?? null,
    prioridadeCor: interno || !pri ? null : PRIORIDADE_CORES[pri] ?? null,
    // a invariante mora aqui, não na tela: campo não tem equipe nem sprint
    equipe: interno ? c.equipe : null,
    sprint: interno ? c.sprint : null,
    prazoLimite: c.prazo_limite,
    prazoTexto: c.prazo_limite && chamadoEmAberto(c.status) ? textoPrazo(c.prazo_limite) : null,
    prazoEstourado: situacaoPrazo(c.prazo_limite, c.status) === "estourado",
    agendadaEm: c.data_hora_agendada,
    quando: c.data_hora_agendada ?? c.prazo_limite ?? null,
    // status fora do vocabulário conta como aberto: a coluna "Sem status"
    // seria inalcançável se o filtro padrão o cortasse
    emAberto: t.coluna === "sem_status" ? true : chamadoEmAberto(c.status),
    aConferir: c.natureza === "campo" && c.status === "concluido"
      && (c as any).faturamento_status === "a_analisar",
    criadoEm: c.created_at,
    atualizadoEm: c.updated_at ?? c.created_at,
    compra: ficha ? { situacao: ficha.situacao, situacaoLabel: SITUACAO_LABEL[ficha.situacao] } : null,
    alerta: t.alerta,
  };
}

export function atividadeDaVisita(v: BrutoVisita, ctx: ContextoMontagem): Atividade {
  const t = colunaDaVisita(v);
  const info = getStatusInfo(v.status as any);
  const bucket = statusBucket(v.status as any);

  return {
    id: `vis-${v.id}`,
    registroId: v.id,
    fonte: "visita",
    coluna: t.coluna,
    rotuloNativo: t.rotuloNativo,
    bolaCom: t.bolaCom,
    natureza: null,
    tipo: null,
    tipoLabel: "Visita técnica",
    tipoCor: null,
    statusCru: v.status,
    statusLabel: info.label,
    // colorLight existe desde a U10; sem ele o chip some no tema claro
    statusCor: { dark: info.color, light: info.colorLight, bg: info.bg, border: info.border },
    titulo: v.nome_predio ?? v.titulo ?? v.clientes?.nome ?? "Visita técnica",
    numero: null,
    cliente: v.clientes?.nome ?? v.nome_predio ?? null,
    responsavelId: v.tecnico_id,
    participantes: v.tecnico_id ? [v.tecnico_id] : [],
    souResponsavel: !!ctx.userId && v.tecnico_id === ctx.userId,
    souApoio: false,
    souAutor: false,
    prioridade: null,
    prioridadeRank: 4,
    prioridadeLabel: null,
    prioridadeCor: null,
    equipe: null,
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
    compra: null,
    alerta: t.alerta,
  };
}

// ── Leitura ─────────────────────────────────────────────────────────────────

export const BOLA_LABEL: Record<Exclude<BolaCom, null>, string> = {
  voce: "com você",
  gestor: "com o gestor",
  comercial: "com o comercial",
  cliente: "com o cliente",
  financeiro: "com o financeiro",
};

export const ALERTA_LABEL: Record<Exclude<Atividade["alerta"], null>, string> = {
  sem_responsavel: "sem responsável",
  sem_acesso_ficha: "ficha da compra sem acesso",
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
