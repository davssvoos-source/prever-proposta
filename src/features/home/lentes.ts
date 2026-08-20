// Lentes da Home — presets ("padrões de kanban") e filtros.
//
// A invariante da tela, e ela não se negocia: **preset filtra e destaca
// colunas; NUNCA reagrupa.** O eixo do quadro é sempre o status. Sem essa
// regra o botão vira um segundo seletor de visualização escondido, e o usuário
// perde a referência espacial que é justamente o que faz um quadro valer a pena.
//
// Preset vale nas duas visões: em lista ele filtra e ordena; em quadro ele
// filtra, ordena e coloca o foco em algumas colunas. Preset é filtro salvo;
// visão é apresentação. Ortogonais de propósito.

import type { Atividade, ColunaQuadro } from "@/features/atividades/modelo";
import { mesmoDia } from "@/features/atividades/modelo";

export type Cargo = "tecnico" | "sac" | "comercial" | "admin";
export type Vinculo = "responsavel" | "apoio" | "autor" | "todos";
export type Periodo = "hoje" | "semana" | "mes" | null;
export type Ordenacao = "prazo" | "recentes" | "prioridade" | "atualizacao";

export interface ContextoLente {
  agora: Date;
  minhaEquipe: string | null;
}

export interface Preset {
  chave: string;
  label: string;
  papeis: Cargo[];
  /** Colunas que o preset destaca. Vazio = todas com o mesmo peso. */
  foco: ColunaQuadro[];
  ordem: Ordenacao;
  aplica: (a: Atividade, ctx: ContextoLente) => boolean;
  /** Vínculo que o preset assume, se assumir algum. */
  vinculo?: Vinculo[];
}

const eMeu = (a: Atividade) => a.souResponsavel || a.souApoio || a.souAutor;

export const PRESETS: Preset[] = [
  {
    chave: "meu_dia",
    label: "Meu dia",
    papeis: ["tecnico", "sac", "comercial", "admin"],
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
  {
    chave: "tudo_meu",
    label: "Tudo meu",
    papeis: ["tecnico", "sac", "comercial", "admin"],
    foco: [],
    ordem: "prazo",
    vinculo: ["responsavel", "apoio", "autor"],
    aplica: (a) => a.emAberto && eMeu(a),
  },
  {
    chave: "sprint_mes",
    label: "Sprint deste mês",
    papeis: ["tecnico", "sac", "comercial", "admin"],
    foco: [],
    ordem: "prazo",
    // "este mês" passa a significar o mês corrente para TODAS as origens —
    // se fosse só sprint='este_mes', o preset esconderia campo e visita, que
    // não têm sprint, e quebraria a promessa de "todas as atividades".
    aplica: (a, { agora }) => {
      if (!a.emAberto) return false;
      if (a.sprint === "este_mes") return true;
      const q = a.quando ? new Date(a.quando) : null;
      if (q) return q.getFullYear() === agora.getFullYear() && q.getMonth() === agora.getMonth();
      // pedido de compra não tem sprint nem data: enquanto vivo, é do mês
      return !!a.compra;
    },
  },
  {
    chave: "stand_by",
    label: "Stand-by",
    papeis: ["tecnico", "sac", "comercial", "admin"],
    foco: ["stand_by", "aguardando_aprovacao"],
    ordem: "atualizacao",
    aplica: (a) => a.emAberto && (a.coluna === "stand_by" || a.coluna === "aguardando_aprovacao"),
  },
  {
    chave: "atrasados",
    label: "Atrasados",
    papeis: ["tecnico", "sac", "comercial", "admin"],
    foco: [],
    ordem: "prazo",
    // espelha o que alertas_chamados() já notifica: prazo estourado ou parado
    aplica: (a, { agora }) =>
      a.emAberto && (
        a.prazoEstourado
        || ((a.coluna === "em_andamento" || a.coluna === "stand_by")
            && agora.getTime() - new Date(a.atualizadoEm).getTime() > 5 * 864e5)
      ),
  },
  {
    chave: "a_conferir",
    label: "A conferir",
    papeis: ["sac", "comercial", "admin"],
    foco: ["executado"],
    ordem: "atualizacao",
    aplica: (a) => a.coluna === "executado" && a.emAberto,
  },
  {
    chave: "sem_dono",
    label: "Sem responsável",
    papeis: ["sac", "admin"],
    foco: ["aberto"],
    ordem: "recentes",
    aplica: (a) => a.emAberto && !a.responsavelId,
  },
  {
    chave: "minha_equipe",
    label: "Minha equipe",
    papeis: ["tecnico", "sac", "admin"],
    foco: [],
    ordem: "prazo",
    aplica: (a, { minhaEquipe }) => a.emAberto && !!minhaEquipe && a.equipe === minhaEquipe,
  },
];

/**
 * Quais presets cada perfil vê, e em que ordem — os três primeiros cabem na
 * tela sem rolar, então a ordem importa mais que o catálogo.
 */
const ORDEM_POR_CARGO: Record<Cargo, string[]> = {
  tecnico:   ["meu_dia", "tudo_meu", "atrasados", "stand_by", "sprint_mes", "minha_equipe"],
  sac:       ["meu_dia", "sem_dono", "a_conferir", "stand_by", "atrasados", "sprint_mes", "minha_equipe"],
  comercial: ["meu_dia", "a_conferir", "atrasados", "stand_by", "tudo_meu", "sprint_mes"],
  admin:     ["meu_dia", "sem_dono", "a_conferir", "stand_by", "atrasados", "sprint_mes", "tudo_meu", "minha_equipe"],
};

export function presetsDoCargo(cargo: Cargo | null): Preset[] {
  if (!cargo) return [];
  const ordem = ORDEM_POR_CARGO[cargo];
  return ordem
    .map((k) => PRESETS.find((p) => p.chave === k))
    .filter((p): p is Preset => !!p && p.papeis.includes(cargo));
}

export function presetPadrao(cargo: Cargo | null): string | null {
  if (cargo === "tecnico") return "meu_dia";
  return null; // gestor abre vendo tudo; o recorte é escolha dele
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export interface Filtros {
  preset: string | null;
  vinculos: Vinculo[];      // vazio = todos
  periodo: Periodo;
  pessoa: string;           // "todos" | uid
  situacao: "abertos" | "encerrados" | "todos";
  busca: string;
}

export const FILTROS_INICIAIS: Filtros = {
  preset: null,
  vinculos: [],
  periodo: null,
  pessoa: "todos",
  situacao: "abertos",
  busca: "",
};

export function semData(a: Atividade): boolean {
  return !a.quando;
}

function dentroDoPeriodo(a: Atividade, p: Periodo, agora: Date): boolean {
  if (!p) return true;
  // Item sem data NÃO passa quando há período escolhido — deixá-lo passar
  // fazia "Hoje" devolver a base inteira, porque a maioria dos chamados
  // internos não tem prazo. Mas ele também não some calado: a tela conta
  // quantos ficaram de fora e oferece tirar o filtro (ver `semData`).
  if (!a.quando) return false;
  const d = new Date(a.quando);
  if (p === "hoje") return mesmoDia(a.quando, agora);
  if (p === "semana") {
    const ini = new Date(agora); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - ini.getDay());
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23, 59, 59, 999);
    return d >= ini && d <= fim;
  }
  return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
}

function casaVinculo(a: Atividade, v: Vinculo[]): boolean {
  if (v.length === 0 || v.includes("todos")) return true;
  return (v.includes("responsavel") && a.souResponsavel)
    || (v.includes("apoio") && a.souApoio)
    || (v.includes("autor") && a.souAutor);
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
    if (f.situacao === "abertos" && !a.emAberto) return false;
    if (f.situacao === "encerrados" && a.emAberto) return false;
    if (preset && !preset.aplica(a, ctx)) return false;
    if (!casaVinculo(a, vinculos)) return false;
    if (f.pessoa !== "todos" && a.responsavelId !== f.pessoa) return false;
    if (!dentroDoPeriodo(a, f.periodo, ctx.agora)) return false;
    if (!termo) return true;
    return normalizar(`${a.numero ?? ""} ${a.titulo} ${a.cliente ?? ""}`).includes(termo);
  });
}

export function ordenar(lista: Atividade[], modo: Ordenacao): Atividade[] {
  const l = [...lista];
  switch (modo) {
    case "prazo":
      return l.sort((a, b) => {
        if (a.prazoEstourado !== b.prazoEstourado) return a.prazoEstourado ? -1 : 1;
        const qa = a.quando ? new Date(a.quando).getTime() : Infinity;
        const qb = b.quando ? new Date(b.quando).getTime() : Infinity;
        if (qa !== qb) return qa - qb;
        return a.criadoEm < b.criadoEm ? 1 : -1;
      });
    case "prioridade":
      return l.sort((a, b) => a.prioridadeRank - b.prioridadeRank || (a.criadoEm < b.criadoEm ? 1 : -1));
    case "atualizacao":
      return l.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? -1 : 1)); // mais parado primeiro
    default:
      return l.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
  }
}

export function ordemDoPreset(chave: string | null): Ordenacao {
  return PRESETS.find((p) => p.chave === chave)?.ordem ?? "prazo";
}

export function focoDoPreset(chave: string | null): ColunaQuadro[] {
  return PRESETS.find((p) => p.chave === chave)?.foco ?? [];
}
