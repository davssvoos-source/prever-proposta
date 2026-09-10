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
    // o MESMO relógio da assinatura — sem isto a função respondia com dois
    // relógios diferentes e o resultado mudava sozinho na virada do dia
    prazoEstourado: !agendada && situacaoPrazo(m.prazoLimite, m.status, agora) === "estourado",
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

// ═══════════════════════════════════════════════════════════════════════════
// A RESPOSTA QUE FICA NO CHAT (R240)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Davi, 09/09/2026: "quando um usuário manda uma mensagem no chat que vai
 * diretamente para os comentários daquela atividade, a mensagem também deve
 * ficar no chat, se juntando com a mensagem que ele respondeu, sendo caixas de
 * mensagem diferentes no mesmo campo (fundo colorido) dentro do chat."
 *
 * Por que faltava: a resposta é um COMENTÁRIO na atividade (R216) que menciona
 * QUEM MENCIONOU — então ela cai no chat da outra pessoa e nunca no de quem
 * respondeu, porque `minhas_mencoes` devolve o que menciona quem chama. O que
 * a traz de volta é a ligação `responde_a` (U123).
 */
export interface RespostaDoChat {
  id: string;
  chamadoId: string;
  /** o comentário respondido — o `eventoId` de uma menção ou de outra resposta */
  respondeA: string | null;
  autorId: string | null;
  texto: string;
  criadoEm: string;
}

/** A linha que `respostas_do_chat()` devolve (U123). */
export interface LinhaDeResposta {
  id: string;
  chamado_id: string;
  responde_a: string | null;
  autor_id: string | null;
  texto: string | null;
  criado_em: string;
}

export function respostaDaLinha(l: LinhaDeResposta): RespostaDoChat {
  return {
    id: l.id,
    chamadoId: l.chamado_id,
    respondeA: l.responde_a ?? null,
    autorId: l.autor_id ?? null,
    texto: l.texto ?? "",
    criadoEm: l.criado_em,
  };
}

/**
 * A conversa de uma menção: a resposta dela, a resposta da resposta, e assim
 * por diante — ACHATADAS em ordem cronológica. O campo colorido é um só e o
 * que muda é a caixa dentro dele, então não há por que indentar.
 */
export function respostasDaMencao(eventoId: string | null, respostas: readonly RespostaDoChat[]): RespostaDoChat[] {
  if (!eventoId) return [];
  const porPai = new Map<string, RespostaDoChat[]>();
  for (const r of respostas) {
    if (!r.respondeA) continue;
    porPai.set(r.respondeA, [...(porPai.get(r.respondeA) ?? []), r]);
  }
  const saida: RespostaDoChat[] = [];
  const vistos = new Set<string>();
  const fila: string[] = [eventoId];
  while (fila.length > 0) {
    for (const r of porPai.get(fila.shift() as string) ?? []) {
      if (vistos.has(r.id)) continue;   // a FK e o gatilho impedem ciclo; custa nada
      vistos.add(r.id);
      saida.push(r);
      fila.push(r.id);
    }
  }
  return saida.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

export type ItemDoChat =
  | { tipo: "mencao"; chave: string; criadoEm: string; ultimoEm: string; mencao: Mencao; respostas: RespostaDoChat[] }
  | { tipo: "todos"; chave: string; criadoEm: string; ultimoEm: string; mensagem: MensagemParaTodos };

/**
 * Menções (cada uma com as suas respostas) e mensagens para todos, numa
 * conversa só, da MAIS ANTIGA para a mais nova — a última fica embaixo, junto
 * do campo de escrever, que é como um chat de celular lê.
 *
 * O que ORDENA é o último instante da conversa (R240): responder põe aquele
 * campo no fim da lista, onde quem acabou de responder está olhando — se ele
 * ficasse no lugar antigo, a pessoa mandaria a resposta e não veria nada
 * acontecer. Empate de instante: menção antes da mensagem.
 *
 * Uma menção que JÁ É resposta de outra (alguém respondeu à minha resposta
 * mencionando-me) não abre campo próprio: ela é uma caixa dentro do campo da
 * conversa a que pertence.
 */
export function linhaDoTempo(
  mencoes: readonly Mencao[],
  mensagens: readonly MensagemParaTodos[],
  respostas: readonly RespostaDoChat[] = [],
): ItemDoChat[] {
  const idsDeResposta = new Set(respostas.map((r) => r.id));
  const raizes = mencoes.filter((m) => !(m.eventoId && idsDeResposta.has(m.eventoId)));
  const itens: ItemDoChat[] = [
    ...raizes.map((m): ItemDoChat => {
      const minhas = respostasDaMencao(m.eventoId, respostas);
      return {
        tipo: "mencao", chave: chaveDaMencao(m), criadoEm: m.criadoEm,
        ultimoEm: minhas.reduce((ate, r) => (r.criadoEm > ate ? r.criadoEm : ate), m.criadoEm),
        mencao: m, respostas: minhas,
      };
    }),
    ...mensagens.map((m): ItemDoChat => ({
      tipo: "todos", chave: `t:${m.id}`, criadoEm: m.criadoEm, ultimoEm: m.criadoEm, mensagem: m,
    })),
  ];
  return itens.sort((a, b) => {
    const d = a.ultimoEm.localeCompare(b.ultimoEm);
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
  /** R240: o comentário que está sendo respondido — null em menção de campo */
  eventoId: string | null;
}

export type DestinoDoEnvio =
  | { destino: "comentario"; chamadoId: string; texto: string; respondeA: string | null }
  | { destino: "todos"; texto: string };

/** Uma atividade que o chat conhece — o que `rotearEnvio` precisa saber dela. */
export interface ConhecidaDoChat {
  chamadoId: string;
  numero: string | null;
  /** o comentário daquela atividade que está no chat (null em menção de campo) */
  eventoId?: string | null;
  criadoEm?: string;
}

/**
 * A que mensagem uma resposta se junta quando não há alvo explícito (R240): ao
 * comentário MAIS RECENTE daquela atividade no chat. É o caso do `#Código`
 * digitado à mão. Sem nenhum comentário (a menção era num campo da atividade),
 * a resposta vira comentário solto — vai para a atividade e não para o chat.
 */
export function mensagemMaisNova(chamadoId: string, conhecidas: readonly ConhecidaDoChat[]): string | null {
  let melhor: { id: string; em: string } | null = null;
  for (const c of conhecidas) {
    if (c.chamadoId !== chamadoId || !c.eventoId) continue;
    const em = c.criadoEm ?? "";
    if (!melhor || em > melhor.em) melhor = { id: c.eventoId, em };
  }
  return melhor?.id ?? null;
}

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
  conhecidas: readonly ConhecidaDoChat[],
): DestinoDoEnvio | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  if (respostaPara) {
    const corpo = respostaComMencao(respostaPara.autorNome, respostaPara.autorId, t);
    if (!corpo) return null;
    return {
      destino: "comentario", chamadoId: respostaPara.chamadoId, texto: corpo,
      // R240: a ligação com a mensagem respondida — é o que a traz de volta ao chat
      respondeA: respostaPara.eventoId ?? mensagemMaisNova(respostaPara.chamadoId, conhecidas),
    };
  }
  const m = t.match(/^#(\S+)\s*/);
  if (m) {
    const codigo = m[1].toLowerCase();
    const alvo = conhecidas.find((c) => (hashtagDaAtividade(c.numero) ?? "").slice(1).toLowerCase() === codigo);
    if (alvo) {
      const resto = t.slice(m[0].length).trim();
      return resto
        ? { destino: "comentario", chamadoId: alvo.chamadoId, texto: resto, respondeA: mensagemMaisNova(alvo.chamadoId, conhecidas) }
        : null;
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
