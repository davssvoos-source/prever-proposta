// O texto da descrição e do comentário, em BLOCOS e em SEGMENTOS — a lógica
// pura do editor (R135, U95).
//
// ── POR QUE CONTINUA MARKDOWN EM TEXTO PURO ────────────────────────────────
// `descricao_problema` e `chamado_eventos.descricao` são TEXTO no banco e são
// lidos como texto em meia dúzia de telas (DetalheCampo, a prévia da importação
// do Notion, o relatório em PDF). O Davi pediu (03/09/2026) que a caixa de
// texto tenha "ferramentas com UI personalizado" — que uma lista de seleção não
// apareça como "[ ]" e sim como uma caixa do design system. Isso é problema de
// APRESENTAÇÃO, não de armazenamento: o editor mostra blocos e caixas de
// marcar, e grava exatamente a mesma sintaxe que `edicao-texto.ts` sempre
// escreveu (`- [ ] item`, `- item`, `**negrito**`). Nenhuma tela que lê o texto
// hoje muda.
//
// ── A MENÇÃO É UM TOKEN, E O TOKEN CARREGA O ID ───────────────────────────
// `@[Davi Voos](user:8f3a…)`. O nome vai junto para o texto continuar legível
// onde ele é mostrado cru; o id vai junto porque é ele que o banco usa para
// avisar a pessoa (gatilho da U95) — casar por nome traria homônimo e
// quebraria quando alguém mudasse o cadastro. É a sintaxe de link do Markdown
// com um prefixo, de propósito: quem conhece `[texto](url)` reconhece.
//
// PURO DE PROPÓSITO: só string entra, só string/estrutura sai. É o que permite
// travar cada regra com asserção, e é o componente (EditorDeDescricao.tsx) que
// fala com o DOM.

import { ehLinhaChecklist, checklistMarcado, checklistTexto } from "./edicao-texto";

// ═══════════════════════════════════════════════════════════════════════════
// BLOCOS — uma linha do texto é um bloco
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDeBloco = "paragrafo" | "checklist" | "lista";

export interface Bloco {
  tipo: TipoDeBloco;
  /** o texto SEM o marcador da linha (`- [ ] `, `- `) */
  texto: string;
  /** só vale para checklist */
  marcado: boolean;
}

const RE_LISTA = /^- (.*)$/;

/** A leitura de UMA linha — a mesma sintaxe que a barra de ferramentas escreve. */
export function linhaParaBloco(linha: string): Bloco {
  if (ehLinhaChecklist(linha)) {
    return { tipo: "checklist", texto: checklistTexto(linha), marcado: checklistMarcado(linha) };
  }
  const m = linha.match(RE_LISTA);
  if (m) return { tipo: "lista", texto: m[1], marcado: false };
  return { tipo: "paragrafo", texto: linha, marcado: false };
}

/** A escrita de UM bloco — a inversa exata de `linhaParaBloco`. */
export function blocoParaLinha(b: Bloco): string {
  switch (b.tipo) {
    case "checklist": return `- [${b.marcado ? "x" : " "}] ${b.texto}`;
    case "lista": return `- ${b.texto}`;
    default: return b.texto;
  }
}

/**
 * Texto → blocos. O texto vazio vira UM parágrafo vazio, e não zero blocos:
 * um editor sem linha nenhuma não tem onde o cursor entrar.
 */
export function textoParaBlocos(texto: string): Bloco[] {
  return (texto ?? "").split("\n").map(linhaParaBloco);
}

export function blocosParaTexto(blocos: Bloco[]): string {
  return blocos.map(blocoParaLinha).join("\n");
}

/**
 * Troca o tipo do bloco. Pedir o tipo que ele JÁ tem devolve ao parágrafo —
 * é o comportamento de todo botão de formatação de linha (clicar "lista"
 * numa lista desfaz a lista). Virar checklist nasce desmarcado.
 */
export function alternarTipo(b: Bloco, tipo: TipoDeBloco): Bloco {
  if (b.tipo === tipo) return { tipo: "paragrafo", texto: b.texto, marcado: false };
  return { tipo, texto: b.texto, marcado: false };
}

/**
 * ENTER no meio de um bloco: o que está antes do cursor fica, o que está
 * depois vai para um bloco novo. O bloco novo HERDA o tipo (lista continua
 * lista) — exceto quando o bloco estava vazio: Enter numa linha de lista
 * vazia é o gesto universal de "sair da lista", e vira parágrafo.
 */
export function dividirBloco(b: Bloco, cursor: number): { antes: Bloco; depois: Bloco } {
  const pos = Math.max(0, Math.min(cursor, b.texto.length));
  if (b.tipo !== "paragrafo" && b.texto.trim() === "") {
    return {
      antes: { tipo: "paragrafo", texto: "", marcado: false },
      depois: { tipo: "paragrafo", texto: "", marcado: false },
    };
  }
  return {
    antes: { ...b, texto: b.texto.slice(0, pos) },
    depois: { tipo: b.tipo, texto: b.texto.slice(pos), marcado: false },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEGMENTOS — o que há DENTRO de uma linha: negrito, itálico, menção
// ═══════════════════════════════════════════════════════════════════════════

export type Segmento =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrito"; texto: string }
  | { tipo: "italico"; texto: string }
  | { tipo: "mencao"; texto: string; userId: string };

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const RE_MENCAO_G = new RegExp(`@\\[([^\\]\\n]+)\\]\\(user:(${UUID})\\)`, "g");
const RE_INLINE = new RegExp(
  `(@\\[[^\\]\\n]+\\]\\(user:${UUID}\\))|(\\*\\*[^*\\n]+\\*\\*)|(\\*[^*\\n]+\\*)`,
  "g",
);

/** O token que o editor INSERE ao escolher uma pessoa no "@". */
export function tokenDeMencao(nome: string, userId: string): string {
  // colchete no nome quebraria o próprio token; troca por parêntese
  const limpo = nome.replace(/[[\]]/g, "(").trim() || "alguém";
  return `@[${limpo}](user:${userId})`;
}

/** Os ids mencionados, sem repetir, na ordem em que aparecem. */
export function extrairMencoes(texto: string): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const m of (texto ?? "").matchAll(RE_MENCAO_G)) {
    const id = m[2].toLowerCase();
    if (!vistos.has(id)) { vistos.add(id); saida.push(id); }
  }
  return saida;
}

/**
 * Quebra uma linha em segmentos para a tela pintar: menção vira chip,
 * `**x**` vira negrito, `*x*` vira itálico, o resto é texto. Uma menção é
 * indivisível — o regex casa o token inteiro antes de olhar asteriscos, então
 * `**@[Ana](user:…)**` sai como negrito contendo o texto cru do token, e isso
 * é aceitável: negrito em cima de menção não é caso que a barra produza.
 */
export function segmentar(linha: string): Segmento[] {
  const saida: Segmento[] = [];
  let ultimo = 0;
  for (const m of (linha ?? "").matchAll(RE_INLINE)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) saida.push({ tipo: "texto", texto: linha.slice(ultimo, inicio) });
    if (m[1]) {
      const t = m[1].match(new RegExp(`^@\\[([^\\]\\n]+)\\]\\(user:(${UUID})\\)$`));
      if (t) saida.push({ tipo: "mencao", texto: t[1], userId: t[2].toLowerCase() });
    } else if (m[2]) {
      saida.push({ tipo: "negrito", texto: m[2].slice(2, -2) });
    } else if (m[3]) {
      saida.push({ tipo: "italico", texto: m[3].slice(1, -1) });
    }
    ultimo = inicio + m[0].length;
  }
  if (ultimo < (linha ?? "").length) saida.push({ tipo: "texto", texto: linha.slice(ultimo) });
  return saida;
}

// ═══════════════════════════════════════════════════════════════════════════
// O "@" — detectar a menção em digitação e completá-la
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Há um "@" sendo digitado logo antes do cursor? Devolve o que já foi
 * digitado depois dele (o filtro da lista) e onde o "@" começa. `null` quando
 * não há menção em curso — um "@" colado a outra palavra ("e-mail@x") não
 * conta, porque tem de vir no começo do texto ou depois de espaço.
 */
export function mencaoEmCurso(texto: string, cursor: number): { inicio: number; consulta: string } | null {
  const ate = (texto ?? "").slice(0, Math.max(0, cursor));
  const m = ate.match(/(?:^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { inicio: ate.length - m[0].trimStart().length, consulta: m[1] };
}

/**
 * Substitui o "@consulta" em curso pelo token da pessoa escolhida, com um
 * espaço depois para a digitação continuar. Devolve o texto novo e onde o
 * cursor deve ficar.
 */
export function completarMencao(
  texto: string, cursor: number, nome: string, userId: string,
): { texto: string; cursor: number } {
  const em = mencaoEmCurso(texto, cursor);
  const token = tokenDeMencao(nome, userId) + " ";
  if (!em) {
    const novo = texto.slice(0, cursor) + token + texto.slice(cursor);
    return { texto: novo, cursor: cursor + token.length };
  }
  const novo = texto.slice(0, em.inicio) + token + texto.slice(cursor);
  return { texto: novo, cursor: em.inicio + token.length };
}

/** Filtra pessoas pelo que foi digitado depois do "@" — sem acento, sem caixa. */
export function filtrarPessoasParaMencao<T extends { nome: string }>(pessoas: T[], consulta: string, teto = 6): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(consulta.trim());
  const lista = q ? pessoas.filter((p) => norm(p.nome).includes(q)) : pessoas;
  return lista.slice(0, teto);
}
