// OS FLUXOS DO TÉCNICO DE CAMPO E QUEM PARTICIPA DA ATIVIDADE — a lógica PURA
// das R307, R308 e R313–R316 (23/09/2026). A tela só lê daqui.
//
// Davi ditou os três fluxos (corretiva, preventiva, implantação) com os campos
// de cada um e quem preenche o quê; ditou que o apoio pode ser de qualquer
// cargo e que quem não é técnico vê a atividade no formato do tipo dela; e
// ditou que atividade com técnico participando é sempre agendada. Cada uma
// dessas frases vira uma função aqui, e cada função vira asserção.

// ── R313 / R315 / R316: os três fluxos de campo ─────────────────────────────

export type TipoDeCampo = "corretiva" | "preventiva" | "implantacao";

export interface FluxoDeCampo {
  tipo: TipoDeCampo;
  /** o rótulo do texto de abertura: o problema (corretiva), a descrição, a observação (implantação) */
  rotuloDaDescricao: string;
  /** Problema + Solução existem só na corretiva (R282) — e são compartilhados com o apoio (R307) */
  temProblemaESolucao: boolean;
  /** o roteiro de verificação por bloco (R315) */
  temRoteiro: boolean;
  /** rótulos das fotos; `antes` nulo = o fluxo só tem a foto de depois (a instalação) */
  fotos: { antes: string | null; depois: string };
  /** o painel de equipamentos removidos/inseridos (R313, R316) */
  temEquipamentos: boolean;
  /** para onde um equipamento sem bloco pode ir: qualquer bloco, ou só o bloco desta atividade */
  alvoDoArrasto: "qualquer-bloco" | "so-o-bloco-da-atividade";
  /** a assinatura de quem acompanhou é exigida para concluir */
  assinaturaObrigatoria: boolean;
  /** o bloco (sistema) na abertura: "quando-houver" = obrigatório se o cliente tem blocos; "sempre" = existente ou criado; "nao" = a preventiva pega todos */
  blocoNaAbertura: "quando-houver" | "sempre" | "nao";
}

export const FLUXOS_DE_CAMPO: Record<TipoDeCampo, FluxoDeCampo> = {
  corretiva: {
    tipo: "corretiva",
    rotuloDaDescricao: "Problema",
    temProblemaESolucao: true,
    temRoteiro: false,
    fotos: { antes: "Foto antes do serviço", depois: "Foto depois do serviço" },
    temEquipamentos: true,
    alvoDoArrasto: "qualquer-bloco",
    assinaturaObrigatoria: true,
    blocoNaAbertura: "quando-houver",
  },
  preventiva: {
    tipo: "preventiva",
    rotuloDaDescricao: "Descrição",
    temProblemaESolucao: false,
    temRoteiro: true,
    fotos: { antes: "Foto antes", depois: "Foto depois" },
    temEquipamentos: false,
    alvoDoArrasto: "qualquer-bloco",
    assinaturaObrigatoria: true,
    blocoNaAbertura: "nao",
  },
  implantacao: {
    tipo: "implantacao",
    rotuloDaDescricao: "Observação",
    temProblemaESolucao: false,
    temRoteiro: true,
    fotos: { antes: null, depois: "Foto da instalação" },
    temEquipamentos: true,
    alvoDoArrasto: "so-o-bloco-da-atividade",
    assinaturaObrigatoria: false,
    blocoNaAbertura: "sempre",
  },
};

/** O fluxo de um tipo; tipo desconhecido ou interno cai na corretiva (o mais completo). */
export function fluxoDeCampo(tipo: string | null | undefined): FluxoDeCampo {
  return FLUXOS_DE_CAMPO[(tipo ?? "") as TipoDeCampo] ?? FLUXOS_DE_CAMPO.corretiva;
}

/**
 * R313: "ao abrir um chamado, o SAC ou o gestor deverão indicar em que bloco".
 * Obrigatório na corretiva quando o cliente TEM blocos (sem bloco cadastrado
 * não há o que indicar — cadastra-se na ficha); sempre na implantação (R126: o
 * bloco nasce ali se não existe); nunca na preventiva (ela pega todos, R292).
 */
export function blocoObrigatorioNaAbertura(tipo: string | null | undefined, blocosDoCliente: number): boolean {
  const f = fluxoDeCampo(tipo);
  if (f.blocoNaAbertura === "sempre") return true;
  if (f.blocoNaAbertura === "quando-houver") return blocosDoCliente > 0;
  return false;
}

/** Os campos que TODO fluxo tem — "as que são padrão até aqui" (R316). */
export const CAMPOS_PADRAO_DE_CAMPO = [
  "cliente", "bloco", "técnico responsável", "apoio", "data agendada", "comentários", "linha do tempo",
] as const;

// ── R313: chegada, saída e tempo de trabalho ────────────────────────────────

export interface TempoDeTrabalho {
  minutos: number;
  /** "2 h 15 min" · "45 min" · "em curso há 1 h 05 min" */
  texto: string;
  emCurso: boolean;
}

function minutosEmTexto(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/**
 * Chegada é `iniciada_em` ("Iniciar atendimento"); saída é `finalizada_em`
 * (concluir). Sem chegada não há conta; com chegada e sem saída o trabalho está
 * em curso e o tempo corre até `agora`. Saída antes da chegada é dado sujo:
 * devolve zero, não negativo.
 */
export function tempoDeTrabalho(
  chegada: string | null | undefined,
  saida: string | null | undefined,
  agora: Date = new Date(),
): TempoDeTrabalho | null {
  if (!chegada) return null;
  const ini = new Date(chegada).getTime();
  if (Number.isNaN(ini)) return null;
  const fim = saida ? new Date(saida).getTime() : agora.getTime();
  if (Number.isNaN(fim)) return null;
  const minutos = Math.max(0, Math.round((fim - ini) / 60_000));
  const emCurso = !saida;
  return { minutos, emCurso, texto: emCurso ? `em curso há ${minutosEmTexto(minutos)}` : minutosEmTexto(minutos) };
}

// ── R313: o bloco da manutenção em primeiro ─────────────────────────────────

/** "sendo o bloco selecionado para aquela manutenção, a primeira opção da lista" — a ordem dos demais não muda. */
export function comOBlocoDaAtividadePrimeiro<T extends { sistemaId: string }>(
  blocos: readonly T[],
  sistemaDaAtividade: string | null | undefined,
): T[] {
  if (!sistemaDaAtividade) return [...blocos];
  const primeiro = blocos.filter((b) => b.sistemaId === sistemaDaAtividade);
  const resto = blocos.filter((b) => b.sistemaId !== sistemaDaAtividade);
  return [...primeiro, ...resto];
}

// ── R308: com técnico participando, só agenda ───────────────────────────────

/** "Todas as atividades que houverem pelo menos um usuário com cargo TÉCNICO participando, deverão ser agendadas". */
export function exigeAgenda(cargosDosParticipantes: readonly (string | null | undefined)[]): boolean {
  return cargosDosParticipantes.some((c) => c === "tecnico");
}

// ── R307: em que formato cada pessoa vê a atividade de campo ────────────────

export type LayoutDaAtividade = "campo" | "interno";

/** Quem gere confere fotos, assinatura e cobrança — continua na tela de campo. */
export const CARGOS_DE_GESTAO = ["admin", "gestor", "sac", "comercial"] as const;

/**
 * A natureza continua mandando (interno → interno). Na atividade de CAMPO: o
 * técnico e quem gere veem a tela de campo; o participante de outro cargo
 * (hoje, o operacional) vê o formato interno do tipo dela — com Problema e
 * Solução compartilhados (são as mesmas colunas) e os mesmos comentários. Quem
 * não participa e não gere (raro) vê a tela de campo, só leitura.
 */
export function layoutDaAtividade(a: {
  natureza: string | null | undefined;
  cargo: string | null | undefined;
  souParticipante: boolean;
}): LayoutDaAtividade {
  if (a.natureza !== "campo") return "interno";
  if (a.cargo === "tecnico") return "campo";
  if ((CARGOS_DE_GESTAO as readonly string[]).includes(a.cargo ?? "")) return "campo";
  return a.souParticipante ? "interno" : "campo";
}

/** Sou participante: responsável ou apoio (a mesma régua da Início, `souResponsavel || souApoio`). */
export function souParticipante(
  meuId: string | null | undefined,
  responsavelId: string | null | undefined,
  apoios: readonly { profile_id: string }[],
): boolean {
  if (!meuId) return false;
  return responsavelId === meuId || apoios.some((a) => a.profile_id === meuId);
}
