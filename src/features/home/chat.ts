// O CHAT da Início — a lógica pura (R215–R217, U117; R222–R223, U119).
//
// Davi, 2026-09-08 (U117): "Adicione um botão circular de Chat, na tela Início
// […] onde aparecerá todas as menções a aquele usuário […] deve ter um botão de
// responder aqui […] no chat deve dar para reagir se for comentário."
//
// Davi, 2026-09-08 (v0.0.2): "O chat deve ter um tamanho fixo em proporção
// 9:16. Cada mensagem deve conter apenas a foto de perfil do autor, o título da
// atividade, a data/hora e abaixo o conteúdo […] o fundo de cada mensagem deve
// ter uma opacidade reduzida na cor estratégica por prazo […] qualquer mensagem
// enviada no chat que não seja uma resposta a nada, deve ser enviada para todos
// os usuários […] ao clicar em responder, o botão insere '#Código-Da-Atividade'
// na cor do prazo no campo de texto."
//
// Nada aqui toca DOM nem banco: a cor da mensagem, o recorte do parágrafo, a
// forma da resposta, o roteamento do envio (para a atividade ou para todo
// mundo), a linha do tempo mesclada, a contagem do selo, a agregação das
// reações e a posição do painel dentro da tela. A tela (ChatDeMencoes) só
// pinta; o dado vem de minhas_mencoes() (U117, v2 na U119), de mensagens_chat
// (U119) e de chamado_reacoes (U117).

import { tokenDeMencao } from "@/lib/texto-rico";
import { chamadoEmAberto, situacaoPrazo } from "@/lib/chamado-status";
import { faixaPrazo, fimDoDiaAgendado, type Atividade, type FaixaPrazo } from "@/features/atividades/modelo";

export type OrigemDaMencao = "comentario" | "descricao" | "diagnostico" | "solucao";
const ORIGENS: readonly OrigemDaMencao[] = ["comentario", "descricao", "diagnostico", "solucao"];

export interface Mencao {
  origem: OrigemDaMencao;
  chamadoId: string;
  numero: string | null;
  titulo: string;
  /** o comentário (null quando a menção está na descrição/diagnóstico/solução) */
  eventoId: string | null;
  autorId: string | null;
  /** o texto inteiro — do comentário, ou do campo da atividade */
  texto: string;
  criadoEm: string;
  // ── v2 (U119): o que pinta a mensagem e o que a destaca ──
  status: string | null;
  prazoLimite: string | null;
  dataAgendada: string | null;
  dataHoraAgendada: string | null;
  /** eu já comentei nessa atividade DEPOIS desta menção */
  respondida: boolean;
}

/** A linha que a função minhas_mencoes() devolve (colunas do banco; as novas são opcionais até a U119 rodar). */
export interface LinhaDeMencao {
  origem: string;
  chamado_id: string;
  numero: string | null;
  titulo: string | null;
  evento_id: string | null;
  autor_id: string | null;
  texto: string | null;
  criado_em: string;
  status?: string | null;
  prazo_limite?: string | null;
  data_agendada?: string | null;
  data_hora_agendada?: string | null;
  respondida?: boolean | null;
}

export function mencaoDaLinha(l: LinhaDeMencao): Mencao {
  return {
    origem: (ORIGENS as readonly string[]).includes(l.origem) ? (l.origem as OrigemDaMencao) : "comentario",
    chamadoId: l.chamado_id,
    numero: l.numero ?? null,
    titulo: l.titulo ?? "Atividade",
    eventoId: l.evento_id ?? null,
    autorId: l.autor_id ?? null,
    texto: l.texto ?? "",
    criadoEm: l.criado_em,
    status: l.status ?? null,
    prazoLimite: l.prazo_limite ?? null,
    dataAgendada: l.data_agendada ?? null,
    dataHoraAgendada: l.data_hora_agendada ?? null,
    respondida: !!l.respondida,
  };
}

/** Uma chave estável por menção — comentário pelo id dele; os campos da atividade pela atividade + campo. */
export function chaveDaMencao(m: Mencao): string {
  if (m.eventoId) return `c:${m.eventoId}`;
  return `${m.origem === "descricao" ? "d" : m.origem === "diagnostico" ? "g" : "s"}:${m.chamadoId}`;
}

/** Só o COMENTÁRIO se responde e se reage (R216/R217); menção num campo da atividade abre o pop-up. */
export function ehComentario(m: Pick<Mencao, "origem" | "eventoId">): boolean {
  return m.origem === "comentario" && !!m.eventoId;
}

export const ROTULO_DA_ORIGEM: Record<OrigemDaMencao, string> = {
  comentario: "comentário",
  descricao: "descrição",
  diagnostico: "diagnóstico",
  solucao: "solução",
};

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

// ═══════════════════════════════════════════════════════════════════════════
// A COR DA MENSAGEM (R222) — a MESMA régua do card da Início (R136)
// ═══════════════════════════════════════════════════════════════════════════

/** As quatro cores estratégicas do card (R136) — atraso, esta semana, adiante, concluído — ou nenhuma. */
export type CorDaMensagem = FaixaPrazo | "concluido";

/**
 * Passa pela MESMA `faixaPrazo` do card (R136): atrasado é vermelho, concluído
 * é verde, mais de uma semana é azul, dentro da semana é amarelo. Agendada não
 * tem prazo (R225) — o que vence é o dia marcado. Cancelada, ou sem data
 * nenhuma, fica neutra.
 */
export function corDaMencao(
  m: Pick<Mencao, "status" | "prazoLimite" | "dataAgendada" | "dataHoraAgendada">,
  agora: Date = new Date(),
): CorDaMensagem {
  const emAberto = chamadoEmAberto(m.status);
  if (!emAberto) return m.status === "concluido" ? "concluido" : null;
  const agendadaEm = m.dataHoraAgendada ?? fimDoDiaAgendado(m.dataAgendada);
  const agendada = !!agendadaEm && (m.status === "aberto" || m.status === "agendado");
  const parcial = {
    emAberto,
    prazoEstourado: !agendada && situacaoPrazo(m.prazoLimite, m.status) === "estourado",
    prazoLimite: agendada ? null : m.prazoLimite,
    agendadaEm,
  } as Atividade;
  return faixaPrazo(parcial, agora);
}

// ═══════════════════════════════════════════════════════════════════════════
// A MENSAGEM PARA TODO MUNDO e a LINHA DO TEMPO (R223)
// ═══════════════════════════════════════════════════════════════════════════

export interface MensagemParaTodos {
  id: string;
  autorId: string;
  texto: string;
  criadoEm: string;
}

export interface LinhaDeMensagem {
  id: string;
  autor_id: string;
  texto: string | null;
  criado_em: string;
}

export function mensagemDaLinha(l: LinhaDeMensagem): MensagemParaTodos {
  return { id: l.id, autorId: l.autor_id, texto: l.texto ?? "", criadoEm: l.criado_em };
}

export type ItemDoChat =
  | { tipo: "mencao"; chave: string; criadoEm: string; mencao: Mencao }
  | { tipo: "todos"; chave: string; criadoEm: string; mensagem: MensagemParaTodos };

/**
 * Menções e mensagens para todos, numa conversa só, da MAIS ANTIGA para a mais
 * nova (a última fica embaixo, junto do campo de escrever — é assim que um
 * chat de celular lê). Empate de instante: menção antes da mensagem.
 */
export function linhaDoTempo(mencoes: readonly Mencao[], mensagens: readonly MensagemParaTodos[]): ItemDoChat[] {
  const itens: ItemDoChat[] = [
    ...mencoes.map((m): ItemDoChat => ({ tipo: "mencao", chave: chaveDaMencao(m), criadoEm: m.criadoEm, mencao: m })),
    ...mensagens.map((m): ItemDoChat => ({ tipo: "todos", chave: `t:${m.id}`, criadoEm: m.criadoEm, mensagem: m })),
  ];
  return itens.sort((a, b) => {
    const d = a.criadoEm.localeCompare(b.criadoEm);
    if (d !== 0) return d;
    return a.tipo === b.tipo ? 0 : a.tipo === "mencao" ? -1 : 1;
  });
}

/** O código que o botão Responder põe no campo (R223): `#` + o número da atividade. */
export function hashtagDaAtividade(numero: string | null | undefined): string | null {
  const n = (numero ?? "").trim().replace(/\s+/g, "");
  return n ? `#${n}` : null;
}

export interface RespostaPara {
  chamadoId: string;
  numero: string | null;
  autorId: string | null;
  autorNome: string | null;
}

export type DestinoDoEnvio =
  | { destino: "comentario"; chamadoId: string; texto: string }
  | { destino: "todos"; texto: string };

/**
 * Para onde vai o que a pessoa escreveu (R223):
 *  · com uma resposta armada (o chip #Código) → COMENTÁRIO naquela atividade,
 *    mencionando quem mencionou (R216);
 *  · texto que COMEÇA com `#Código` de uma atividade conhecida → comentário
 *    nela, sem o código;
 *  · qualquer outra coisa → para TODO MUNDO.
 * Vazio não vai a lugar nenhum (null).
 */
export function rotearEnvio(
  texto: string,
  respostaPara: RespostaPara | null,
  conhecidas: readonly { chamadoId: string; numero: string | null }[],
): DestinoDoEnvio | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (respostaPara) {
    const corpo = respostaComMencao(respostaPara.autorNome, respostaPara.autorId, t);
    return corpo ? { destino: "comentario", chamadoId: respostaPara.chamadoId, texto: corpo } : null;
  }
  const m = t.match(/^#(\S+)\s*/);
  if (m) {
    const codigo = m[1].toLowerCase();
    const alvo = conhecidas.find((c) => (hashtagDaAtividade(c.numero) ?? "").slice(1).toLowerCase() === codigo);
    if (alvo) {
      const resto = t.slice(m[0].length).trim();
      return resto ? { destino: "comentario", chamadoId: alvo.chamadoId, texto: resto } : null;
    }
  }
  return { destino: "todos", texto: t };
}

/** A amostra do PRISMA de cada cor da mensagem — a MESMA tabela do card (R136). */
export const PRISMA_DA_MENSAGEM: Record<Exclude<CorDaMensagem, null>, "vermelho" | "amarelo" | "azul" | "verde"> = {
  atraso: "vermelho", esta_semana: "amarelo", adiante: "azul", concluido: "verde",
};

/** "08/09 14:32" — a data/hora de cada mensagem (R222), no fuso de quem olha. */
export function dataHoraCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// O SELO e a POSIÇÃO DO PAINEL
// ═══════════════════════════════════════════════════════════════════════════

/** O selo do botão: as notificações de menção ainda não lidas (o sino da U95). */
export function contarMencoesNaoLidas(notificacoes: readonly { tipo: string; lida: boolean }[]): number {
  return notificacoes.filter((n) => n.tipo === "mencao" && !n.lida).length;
}

/**
 * O selo inteiro (R222): menções não lidas + mensagens para todos que chegaram
 * DEPOIS da última vez que abri o chat (`lidoAte`), sem contar as minhas.
 */
export function contarNaoLidasDoChat(
  notificacoes: readonly { tipo: string; lida: boolean }[],
  mensagens: readonly MensagemParaTodos[],
  lidoAte: string | null | undefined,
  euId: string | null | undefined,
): number {
  const novas = mensagens.filter((m) => m.autorId !== euId && (!lidoAte || m.criadoEm > lidoAte)).length;
  return contarMencoesNaoLidas(notificacoes) + novas;
}

/** Onde o painel fica quando a pessoa o arrasta (R222) — guardado no navegador. */
export const CHAVE_POSICAO_CHAT = "prever-chat-posicao";
/** Até quando as mensagens para todos já foram vistas. */
export const CHAVE_LIDO_ATE_CHAT = "prever-chat-lido-ate";

export interface Ponto { x: number; y: number }
export interface Tamanho { w: number; h: number }

/**
 * A alça deixa arrastar para qualquer lugar — mas o painel NUNCA sai da tela:
 * pelo menos `margem` px de cada borda. Tela menor que o painel: encosta em 0.
 */
export function posicaoDentroDaTela(pos: Ponto, painel: Tamanho, tela: Tamanho, margem = 8): Ponto {
  const maxX = Math.max(0, tela.w - painel.w - margem);
  const maxY = Math.max(0, tela.h - painel.h - margem);
  return {
    x: Math.round(Math.min(Math.max(margem, pos.x), Math.max(margem, maxX))),
    y: Math.round(Math.min(Math.max(margem, pos.y), Math.max(margem, maxY))),
  };
}

/** Lê a posição guardada; qualquer coisa fora do formato vira null (posição padrão). */
export function lerPosicaoGuardada(bruto: string | null | undefined): Ponto | null {
  if (!bruto) return null;
  try {
    const p = JSON.parse(bruto);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: Number(p.x), y: Number(p.y) };
  } catch { /* formato velho */ }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// REAÇÕES (R217)
// ═══════════════════════════════════════════════════════════════════════════

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
