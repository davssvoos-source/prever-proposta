// O CHAT DE MENÇÕES da Início — a lógica pura (R215–R217, U117).
//
// Davi, 2026-09-08: "Adicione um botão circular de Chat, na tela Início, este
// botão deve estar localizado no canto inferior direito e deve ter localização
// fixa com o scroll da tela. O botão deve expandir um campo de chat, onde
// aparecerá todas as menções a aquele usuário […] Se eu menciono o Nicholas em
// uma atividade, se for um comentário que eu fiz no chat vai aparecer pra ele o
// meu comentário e o titulo será a atividade que eu comentei […] Mas caso seja
// uma menção na descrição de uma atividade, deve aparecer o paragrafo da
// menção no chat. […] deve ter um botão de responder aqui […] Além disso no
// chat deve dar para reagir se for comentário, reagindo no comentário da
// atividade."
//
// Nada aqui toca DOM nem banco: é o recorte do parágrafo, a forma da resposta,
// a agregação das reações e a contagem do selo. A tela (ChatDeMencoes) só
// pinta; o dado vem de minhas_mencoes() (migration U117) e de chamado_reacoes.

import { tokenDeMencao } from "@/lib/texto-rico";

export type OrigemDaMencao = "comentario" | "descricao";

export interface Mencao {
  origem: OrigemDaMencao;
  chamadoId: string;
  numero: string | null;
  titulo: string;
  /** o comentário (null quando a menção está na descrição) */
  eventoId: string | null;
  autorId: string | null;
  /** o texto inteiro — do comentário, ou a descrição da atividade */
  texto: string;
  criadoEm: string;
}

/** A linha que a função minhas_mencoes() devolve (colunas do banco). */
export interface LinhaDeMencao {
  origem: string;
  chamado_id: string;
  numero: string | null;
  titulo: string | null;
  evento_id: string | null;
  autor_id: string | null;
  texto: string | null;
  criado_em: string;
}

export function mencaoDaLinha(l: LinhaDeMencao): Mencao {
  return {
    origem: l.origem === "descricao" ? "descricao" : "comentario",
    chamadoId: l.chamado_id,
    numero: l.numero ?? null,
    titulo: l.titulo ?? "Atividade",
    eventoId: l.evento_id ?? null,
    autorId: l.autor_id ?? null,
    texto: l.texto ?? "",
    criadoEm: l.criado_em,
  };
}

/** Uma chave estável por menção — comentário pelo id dele; descrição pela atividade. */
export function chaveDaMencao(m: Mencao): string {
  return m.eventoId ? `c:${m.eventoId}` : `d:${m.chamadoId}`;
}

/**
 * O PARÁGRAFO com a menção (R215): a linha do texto que contém o token
 * `(user:<meu id>)` — a mesma unidade do editor (uma linha = um bloco,
 * texto-rico.ts). Sem a linha (o texto mudou desde a menção), a primeira
 * linha não vazia; sem nada, a string vazia.
 */
export function paragrafoComMencao(texto: string | null | undefined, meuId: string | null | undefined): string {
  const linhas = (texto ?? "").split("\n");
  if (meuId) {
    const alvo = `(user:${meuId.toLowerCase()})`;
    const achada = linhas.find((l) => l.toLowerCase().includes(alvo));
    if (achada !== undefined) return achada.trim();
  }
  return (linhas.find((l) => l.trim().length > 0) ?? "").trim();
}

/**
 * A RESPOSTA pelo chat vira COMENTÁRIO na atividade (R216), mencionando quem
 * mencionou — assim o gatilho da U95 avisa a pessoa certa, sem SQL novo. Sem
 * autor conhecido (menção na descrição de quem saiu), vai o texto puro.
 */
export function respostaComMencao(autorNome: string | null | undefined, autorId: string | null | undefined, texto: string): string {
  const t = texto.trim();
  if (!t) return "";
  if (autorId && autorNome) return `${tokenDeMencao(autorNome, autorId)} ${t}`;
  return t;
}

/** A LISTA FECHADA de emojis (R217) — a MESMA do CHECK em chamado_reacoes (U117). */
export const EMOJIS_REACAO = ["👍", "❤️", "😂", "😮", "😢", "🙏", "✅", "👀"] as const;
export type EmojiReacao = (typeof EMOJIS_REACAO)[number];

export interface ReacaoMinima {
  evento_id: string;
  profile_id: string;
  emoji: string;
}

export interface ReacaoAgrupada {
  emoji: string;
  total: number;
  /** eu já reagi com este emoji */
  eu: boolean;
}

/** As reações de UM comentário, na ordem da lista, só as que existem. */
export function agruparReacoes(reacoes: readonly ReacaoMinima[], eventoId: string, euId: string | null | undefined): ReacaoAgrupada[] {
  const doEvento = reacoes.filter((r) => r.evento_id === eventoId);
  return EMOJIS_REACAO
    .map((emoji) => {
      const dele = doEvento.filter((r) => r.emoji === emoji);
      return { emoji, total: dele.length, eu: !!euId && dele.some((r) => r.profile_id === euId) };
    })
    .filter((g) => g.total > 0);
}

/** O selo do botão: as notificações de menção ainda não lidas (o sino da U95). */
export function contarMencoesNaoLidas(notificacoes: readonly { tipo: string; lida: boolean }[]): number {
  return notificacoes.filter((n) => n.tipo === "mencao" && !n.lida).length;
}
