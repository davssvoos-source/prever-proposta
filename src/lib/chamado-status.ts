/**
 * Fonte única da verdade do CHAMADO — Etapa U7 da unificação.
 * Substitui os-status.ts (campo) e demanda-status.ts (interno): depois da
 * fusão existe um conceito só, com dois modos de execução.
 *
 * Ciclo do campo:   aguardando início → agendado → em andamento → concluído
 * Ciclo do interno: aguardando início → em andamento → (stand-by | aguardando aprovação) → concluído
 * Cancelado sai de qualquer ponto, com motivo.
 *
 * "Executado" NÃO existe mais (U13): era um concluído que esperava conferência,
 * e conferência nunca dependeu do status — quem manda nela é
 * `faturamento_status`, que a U0 deixou de fora do ciclo justamente para isso.
 * "Stand-by" vale para os dois lados: chamado de campo parado esperando
 * material é exatamente esse estado.
 */

export type ChamadoStatus =
  | "aberto"
  | "agendado"
  | "em_andamento"
  | "stand_by"
  | "aguardando_aprovacao"
  | "concluido"
  | "cancelado";

/** Como o chamado é executado — define ciclo, telas e regras. */
export type Natureza = "campo" | "interno";

export type ChamadoTipo =
  | "corretiva"
  | "preventiva"
  | "operacional"
  | "implantacao"
  | "melhoria"
  | "pedido_compra";

export type ChamadoPrioridade = "baixa" | "normal" | "alta" | "urgente";
export type ChamadoSprint = "este_mes" | "mes_que_vem" | "mes_passado" | "backlog";

import { PRISMA, type CorPrisma } from "@/lib/paleta";

export interface StatusInfo {
  label: string;
  labelUpper: string;
  color: string;
  colorLight: string;
  bg: string;
  border: string;
}

// A cor de cada estado sai do PRISMA — a paleta do degradê (paleta.ts). Duas
// amarrações foram pedidas de nome: EM ANDAMENTO é o azul, MELHORIA é o rosa.
// O resto segue a lógica da rampa, do quente ao frio: o que espera você é
// amarelo (a principal), o que trava é laranja, o que já rodou é azul.
const STATUS: Record<ChamadoStatus, StatusInfo> = {
  aberto: {
    // O valor gravado continua 'aberto' (está no CHECK chamados_status_check,
    // em triggers e em policies). Só o que a pessoa lê mudou.
    // Amarelo porque é o principal: a fila que espera alguém é o que a tela
    // existe para mostrar.
    label: "Aguardando início", labelUpper: "AGUARDANDO INÍCIO",
    color: PRISMA.amarelo.dark, colorLight: PRISMA.amarelo.light,
    bg: PRISMA.amarelo.bg, border: PRISMA.amarelo.border,
  },
  agendado: {
    label: "Agendado", labelUpper: "AGENDADO",
    color: PRISMA.azulClaro.dark, colorLight: PRISMA.azulClaro.light,
    bg: PRISMA.azulClaro.bg, border: PRISMA.azulClaro.border,
  },
  em_andamento: {
    label: "Em andamento", labelUpper: "EM ANDAMENTO",
    color: PRISMA.azul.dark, colorLight: PRISMA.azul.light,
    bg: PRISMA.azul.bg, border: PRISMA.azul.border,
  },
  stand_by: {
    label: "Stand-by", labelUpper: "STAND-BY",
    color: PRISMA.laranja.dark, colorLight: PRISMA.laranja.light,
    bg: PRISMA.laranja.bg, border: PRISMA.laranja.border,
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação", labelUpper: "AGUARDANDO APROVAÇÃO",
    color: PRISMA.pessego.dark, colorLight: PRISMA.pessego.light,
    bg: PRISMA.pessego.bg, border: PRISMA.pessego.border,
  },
  concluido: {
    label: "Concluído", labelUpper: "CONCLUÍDO",
    color: PRISMA.azulEscuro.dark, colorLight: PRISMA.azulEscuro.light,
    bg: PRISMA.azulEscuro.bg, border: PRISMA.azulEscuro.border,
  },
  cancelado: {
    // cinza, não vermelho: o vermelho do prisma agora é ATRASO, e um chip
    // vermelho num quadro onde vermelho já quer dizer outra coisa mente.
    label: "Cancelado", labelUpper: "CANCELADO",
    color: PRISMA.neutro.dark, colorLight: PRISMA.neutro.light,
    bg: PRISMA.neutro.bg, border: PRISMA.neutro.border,
  },
};

const FALLBACK: StatusInfo = {
  label: "—", labelUpper: "—",
  color: "#9ca3af", colorLight: "#6b7280",
  bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)",
};

export function chamadoStatusInfo(status: string | null | undefined): StatusInfo {
  return STATUS[(status ?? "") as ChamadoStatus] ?? FALLBACK;
}

export const STATUS_ORDEM: ChamadoStatus[] = [
  "aberto", "agendado", "em_andamento", "stand_by",
  "aguardando_aprovacao", "concluido", "cancelado",
];

/** Status que ainda pedem ação de alguém. */
export function chamadoEmAberto(status: string | null | undefined): boolean {
  return ["aberto", "agendado", "em_andamento", "stand_by", "aguardando_aprovacao"]
    .includes(status ?? "");
}

/**
 * Quais status fazem sentido em cada natureza. "Agendado" pressupõe
 * deslocamento com hora marcada — não cabe no chamado interno.
 */
export function statusDaNatureza(natureza: Natureza): ChamadoStatus[] {
  return natureza === "campo"
    ? ["aberto", "agendado", "em_andamento", "stand_by", "concluido", "cancelado"]
    : ["aberto", "em_andamento", "stand_by", "aguardando_aprovacao", "concluido", "cancelado"];
}

export const NATUREZA_LABEL: Record<Natureza, string> = {
  campo: "Campo",
  interno: "Interno",
};

// ── Tipos ───────────────────────────────────────────────────────────────────

export const TIPO_LABEL: Record<ChamadoTipo, string> = {
  corretiva: "Corretiva",
  preventiva: "Preventiva",
  operacional: "Operacional",
  implantacao: "Implantação",
  melhoria: "Melhoria",
  pedido_compra: "Pedido de compra",
};

/** Tipos que fazem sentido em cada natureza (o seletor usa isto). */
export function tiposDaNatureza(natureza: Natureza): ChamadoTipo[] {
  return natureza === "campo"
    ? ["corretiva", "preventiva", "operacional", "implantacao"]
    : ["melhoria", "corretiva", "preventiva", "operacional", "implantacao", "pedido_compra"];
}

export const TIPOS: ChamadoTipo[] = [
  "corretiva", "preventiva", "operacional", "implantacao", "melhoria", "pedido_compra",
];

export const TIPO_CORES: Record<ChamadoTipo, CorPrisma> = {
  corretiva:     PRISMA.vermelho,   // o que quebrou
  preventiva:    PRISMA.amarelo,    // o que se antecipa
  operacional:   PRISMA.neutro,     // o dia a dia, sem tensão
  implantacao:   PRISMA.azulEscuro, // obra nova, de fôlego longo
  melhoria:      PRISMA.rosa,       // amarração pedida pelo Davi
  pedido_compra: PRISMA.pessego,    // dinheiro, mas sem urgência própria
};

// ── Prioridade ──────────────────────────────────────────────────────────────

export const PRIORIDADE_LABEL: Record<ChamadoPrioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

// Prioridade sobe a rampa do frio ao quente — é a única escala do sistema em
// que a ordem das cores carrega ordem de verdade, então ela percorre o
// espectro em linha reta: azul, azul claro, laranja, vermelho.
export const PRIORIDADE_CORES: Record<ChamadoPrioridade, CorPrisma> = {
  baixa:   PRISMA.neutro,
  normal:  PRISMA.azul,
  alta:    PRISMA.laranja,
  urgente: PRISMA.vermelho,
};

// ── Sprint (organiza a fila do trabalho interno) ────────────────────────────

export const SPRINT_ORDEM: ChamadoSprint[] = ["este_mes", "mes_que_vem", "mes_passado", "backlog"];

export const SPRINT_LABEL: Record<ChamadoSprint, string> = {
  este_mes: "Este mês",
  mes_que_vem: "Mês que vem",
  mes_passado: "Mês passado",
  backlog: "Backlog",
};

// ── Prazo ───────────────────────────────────────────────────────────────────
// Depois da fusão existe um campo só: prazo_limite (timestamptz). No campo ele
// nasce do SLA da prioridade; no interno é a data combinada, gravada às 23:59.

export type SituacaoPrazo = "sem_prazo" | "no_prazo" | "proximo" | "estourado" | "encerrado";

export function situacaoPrazo(
  prazoLimite: string | null | undefined,
  status: string | null | undefined,
  agora: Date = new Date(),
): SituacaoPrazo {
  if (!chamadoEmAberto(status)) return "encerrado";
  if (!prazoLimite) return "sem_prazo";
  const restanteMs = new Date(prazoLimite).getTime() - agora.getTime();
  if (restanteMs < 0) return "estourado";
  if (restanteMs < 24 * 60 * 60 * 1000) return "proximo";
  return "no_prazo";
}

export const PRAZO_LABEL: Record<SituacaoPrazo, string> = {
  sem_prazo: "sem prazo",
  no_prazo: "no prazo",
  proximo: "prazo próximo",
  estourado: "prazo estourado",
  encerrado: "",
};

/** Texto curto de quanto falta (ou passou) do prazo. */
export function textoPrazo(prazoLimite: string | null | undefined, agora: Date = new Date()): string {
  if (!prazoLimite) return "sem prazo";
  const ms = new Date(prazoLimite).getTime() - agora.getTime();
  const abs = Math.abs(ms);
  const horas = Math.floor(abs / 3_600_000);
  const dias = Math.floor(horas / 24);
  const parte = dias >= 1 ? `${dias}d` : `${Math.max(1, horas)}h`;
  return ms >= 0 ? `faltam ${parte}` : `${parte} em atraso`;
}

/** `prazo_limite` (timestamptz) → `AAAA-MM-DD` local, para o input de data. */
export function prazoParaData(prazoLimite: string | null | undefined): string {
  if (!prazoLimite) return "";
  const d = new Date(prazoLimite);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `AAAA-MM-DD` do input → fim daquele dia, que é como o banco guarda. */
export function dataParaPrazo(data: string | null | undefined): string | null {
  if (!data) return null;
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1, 23, 59, 59).toISOString();
}

// ── Classificação sugerida ──────────────────────────────────────────────────

/**
 * Espelho em TS de public.sugerir_tipo_demanda() — pré-visualiza a
 * classificação enquanto a pessoa digita. Quem decide é o banco, no trigger:
 * os dois PRECISAM concordar, inclusive no colapso de espaços (senão uma
 * quebra de linha no texto faz a tela prometer um tipo e o registro nascer
 * com outro).
 */
export function sugerirTipoChamado(titulo: string, descricao?: string | null): ChamadoTipo {
  const t = `${titulo ?? ""} ${descricao ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/(compra|comprar|cotacao|cotar|aquisicao|adquirir|fornecedor|pedido de material)/.test(t))
    return "pedido_compra";
  if (/(nao funciona|nao esta funcionando|parou|caiu|travand|travou|quebrad|defeito|falha|falhou|erro|bug|corrig|conserto|reparo|urgente|sem sinal|sem acesso|offline)/.test(t))
    return "corretiva";
  if (/(preventiv|revisao|inspec|limpeza|checagem|vistoria|rotina de manutencao|manutencao programada)/.test(t))
    return "preventiva";
  if (/(implanta|instala|nova unidade|novo sistema|migra|migracao|deploy|homologa|ativacao|start)/.test(t))
    return "implantacao";
  if (/(melhor|otimiz|aprimor|refator|upgrade|atualiz|padroniz|automatiz|redesenh|nova funcionalidade|criar tela)/.test(t))
    return "melhoria";
  return "operacional";
}
