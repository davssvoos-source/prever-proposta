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
import { SPRINTS_DO_MES } from "@/lib/chamado-status";

export type Cargo = "tecnico" | "sac" | "comercial" | "admin";
export type Vinculo = "responsavel" | "apoio" | "autor" | "todos";
export type Periodo = "hoje" | "semana" | "mes" | null;
export type Ordenacao = "prazo" | "recentes" | "prioridade" | "atualizacao" | "cliente";

/**
 * As ordenações que a pessoa pode escolher À MÃO, na Início.
 *
 * O Davi pediu prazo e cliente; prioridade entra como a sugestão — é a mais
 * natural para quem está triando o que atacar primeiro, e já existia pronta
 * dentro de `ordenar()` (os presets a usavam, só faltava expor). "Recentes" e
 * "atualização" continuam existindo só para os presets: são ordens de
 * propósito estreito ("Sem dono" quer o mais antigo primeiro na fila), não o
 * tipo de coisa que se escolhe olhando o quadro inteiro.
 */
export const ORDENACOES: { chave: Ordenacao; label: string }[] = [
  { chave: "prazo", label: "Prazo" },
  { chave: "cliente", label: "Cliente" },
  { chave: "prioridade", label: "Prioridade" },
];

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
      // os três baldes do mês (R40): "essa semana" também é deste mês, e
      // testar só `este_mes` esconderia justamente o que vence antes
      if (a.sprint && (SPRINTS_DO_MES as string[]).includes(a.sprint)) return true;
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
    foco: ["concluido"],
    ordem: "atualizacao",
    // A fila de conferência nunca dependeu do status: quem manda nela é
    // `faturamento_status`, deixado fora do ciclo lá na U0 exatamente por isso.
    // É mais fiel que "executado" era: chamado sem nada a cobrar sai sozinho.
    aplica: (a) => a.natureza === "campo" && a.aConferir,
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
  /**
   * A ordenação escolhida À MÃO — `null` significa "segue a do padrão
   * selecionado" (o comportamento de sempre: cada preset já embute uma ordem
   * que faz sentido para ele, "Atrasados" já vem por prazo, "Sem dono" já vem
   * por prioridade). Escolher aqui é o usuário sobrepondo essa escolha, e por
   * isso troca de PRESET some com a marca (ver dashboard.tsx) — senão a
   * ordenação de um padrão vazaria, sem querer, para o próximo escolhido.
   */
  ordenacao: Ordenacao | null;
}

export const FILTROS_INICIAIS: Filtros = {
  preset: null,
  vinculos: [],
  periodo: null,
  pessoa: "todos",
  situacao: "abertos",
  busca: "",
  ordenacao: null,
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

/**
 * O recorte dos PAINÉIS DO TOPO — só as dimensões de QUEM e O QUÊ, nunca as
 * de QUANDO ou de ESTADO.
 *
 * ── POR QUE ELE EXISTE (defeito real, pego em revisão antes de rodar) ──
 *
 * A primeira versão dos painéis dinâmicos usava `aplicarLentes` com
 * `periodo: null` e mais nada trocado. Parecia certo e estava errado: o
 * filtro que abre a tela é `situacao: "abertos"`, e `aplicarLentes` corta
 * `!a.emAberto` na primeira linha. Como `encerradoEm` só é preenchido em
 * atividade encerrada, o conjunto que chegava aos painéis **nunca continha um
 * encerrado**. As quatro barras do passado ficavam em zero, a rosca da meta
 * travava em 0% e o indicador "Concluídas no mês" mostrava 0 — para todo
 * mundo, no primeiro acesso, sem ninguém tocar em filtro. Antes da mudança
 * esses três números vinham de consulta própria e mostravam a verdade.
 *
 * E não adianta trocar `situacao` por outro valor: o gráfico é um eixo de
 * tempo com metade passado e metade futuro. O passado precisa dos ENCERRADOS
 * (`encerradoEm`), o futuro precisa dos ABERTOS com prazo. Qualquer recorte
 * por estado apaga uma das duas metades. Cada barra já se recorta sozinha.
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
    case "cliente":
      return l.sort((a, b) => {
        // sem cliente vai para o fim, nos dois sentidos: alfabético que
        // começa com dez traços não ajuda a achar "quem é do Pateo Klabin"
        if (!a.cliente && !b.cliente) return a.criadoEm < b.criadoEm ? 1 : -1;
        if (!a.cliente) return 1;
        if (!b.cliente) return -1;
        return a.cliente.localeCompare(b.cliente, "pt-BR", { numeric: true });
      });
    case "recentes":
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
