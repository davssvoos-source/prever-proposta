// O CHAT da Início (R215–R217, U117; R222–R223, U119): o botão circular fixo
// no canto inferior direito e a conversa que ele abre.
//
// Davi, 2026-09-08 (v0.0.2): "O chat deve ter um tamanho fixo em proporção
// 9:16. Cada mensagem deve conter apenas a foto de perfil do autor, o título da
// atividade, a data/hora e abaixo o conteúdo. O fundo de cada mensagem deve ter
// uma opacidade reduzida na cor estratégica por prazo. Os botões de responder
// (ícone) e reagir (emoji) devem ficar abaixo do conteúdo. Não deve aparecer o
// código do chamado na mensagem. O design deve remeter a um celular com chat
// de texto. Reduza o amarelo […] o amarelo degradê só no botão de enviar.
// Qualquer mensagem que não seja uma resposta a nada vai para todos […] o
// badge de não lidas deve ser um círculo VERMELHO com fonte branca no canto
// superior esquerdo do botão. Uma alça na parte superior para arrastar e
// reposicionar o chat livremente; um botão recolher no canto superior direito
// que volta para o botão flutuante e, ao reabrir, restaura a posição. O campo
// de texto fica fixo embaixo; ao clicar em responder, o botão insere
// '#Código-Da-Atividade' na cor do prazo no campo de texto."
//
// COMO LÊ: uma conversa de celular — a mais antiga em cima, a mais nova
// embaixo, junto do campo de escrever. Cada mensagem: avatar de quem escreveu,
// o TÍTULO da atividade (ou o nome de quem escreveu, quando é recado para
// todos), a data/hora, e a bolha com o conteúdo pintada na cor estratégica do
// prazo daquela atividade (a MESMA régua do card, R136 — `corDaMencao`).
// Menção em COMENTÁRIO: responder (ícone) e reagir (emoji) embaixo da bolha.
// Menção em descrição/diagnóstico/solução: a bolha é o botão que abre o
// pop-up da atividade — não se responde a um campo. Recado para todos: bolha
// neutra, sem título.
//
// O AMARELO ficou só no botão de enviar (e no botão flutuante, que é a ação da
// tela). Título, hora e conteúdo são tons de branco no escuro e de preto no
// claro (`cinzas(isLight)`).
//
// SUBCOMPONENTES DE MÓDULO (lição do PainelChamado): o texto do campo não pode
// sumir quando a lista atualiza por trás.
//
// R240 (U123, 09/09/2026) — o CAMPO e as CAIXAS. Davi: "No chat, as mensagens
// devem conter o titulo junto com o fundo colorido. Além disso, quando um
// usuário manda uma mensagem no chat que vai diretamente para os comentários
// daquela atividade, a mensagem também deve ficar no chat, se juntando com a
// mensagem que ele respondeu, sendo caixas de mensagem diferentes no mesmo
// campo (fundo colorido) dentro do chat."
//
// Então cada conversa é UM CAMPO na cor do prazo, e dentro dele: o título da
// atividade (o botão que abre o pop-up) e uma CAIXA por mensagem — a menção e
// cada resposta, com foto, nome e hora. A resposta chega pela ligação
// `responde_a` (U123); sem ela, a resposta virava comentário na atividade e
// desaparecia do chat de quem respondeu.

import {
  useEffect, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as PointerEventReact, type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, GripHorizontal, MessageCircle, Reply, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { AvatarCirculo } from "@/components/PessoaComFoto";
import { TextoComChecklist, LinhaRica } from "@/components/TextoComChecklist";
import { TextareaComMencoes, type PessoaParaMencao } from "@/components/EditorDeDescricao";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { usePessoas, mapaDePessoas, comentarChamado } from "@/features/chamados/data";
import { useReacoesDeEventos, SEM_REACOES } from "@/features/chamados/reacoes";
import { FileiraDeReacoes } from "@/features/chamados/FileiraDeReacoes";
import { useMinhasMencoes, useMensagensDoChat, useRespostasDoChat, useCanalDoChat, enviarMensagemParaTodos } from "./chat-data";
import {
  CHAVE_LIDO_ATE_CHAT, CHAVE_POSICAO_CHAT, PRISMA_DA_MENSAGEM, ROTULO_DA_ORIGEM,
  contarNaoLidasDoChat, corDaMencao, dataHoraCurta, ehComentario, hashtagDaAtividade,
  atividadesRecentes, lerPosicaoGuardada, linhaDoTempo, paragrafoComMencao, posicaoDentroDaTela, rotearEnvio,
  type CorDaMensagem, type ItemDoChat, type Mencao, type MensagemParaTodos, type Ponto,
  type AtividadeRecente, type RespostaDoChat, type RespostaPara,
} from "./chat";

type Pessoas = Record<string, { nome: string; avatar_url: string | null }>;

function lerDoNavegador(chave: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(chave); } catch { return null; }
}
function guardarNoNavegador(chave: string, valor: string) {
  try { window.localStorage.setItem(chave, valor); } catch { /* modo privado */ }
}

/** A cor da bolha: a amostra do PRISMA da cor estratégica, ou a superfície neutra. */
function estiloDaBolha(cor: CorDaMensagem, isLight: boolean, c: ReturnType<typeof cinzas>): CSSProperties {
  if (!cor) return { background: c.superficie, border: `1px solid ${c.divisoria}` };
  const p = PRISMA[PRISMA_DA_MENSAGEM[cor]];
  return { background: p.bg, border: `1px solid ${p.border}` };
}
function tomDaCor(cor: CorDaMensagem, isLight: boolean, fallback: string): string {
  if (!cor) return fallback;
  const p = PRISMA[PRISMA_DA_MENSAGEM[cor]];
  return isLight ? p.light : p.dark;
}

export function ChatDeMencoes({ aoAbrirAtividade }: { aoAbrirAtividade: (chamadoId: string) => void }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const [aberto, setAberto] = useState(false);
  // a resposta armada (o chip #Código): é a MENSAGEM que a arma, o rodapé a lê
  const [respostaPara, setRespostaPara] = useState<RespostaPara | null>(null);
  // R249: cada clique em "Responder aqui" é um PEDIDO de foco para a caixa —
  // contador, não booleano, para o segundo clique também disparar
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const [euId, setEuId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEuId(data.user?.id ?? null));
  }, []);

  // ── os dados ──────────────────────────────────────────────────────────────
  const { notificacoes, marcarLida } = useNotificacoes();
  const mencoesQ = useMinhasMencoes(true);
  const mensagensQ = useMensagensDoChat(true);
  useCanalDoChat(true);
  const mencoes = mencoesQ.data?.mencoes ?? [];
  const mensagens = mensagensQ.data?.mensagens ?? [];
  const faltaMigration = !!(mencoesQ.data?.faltaMigration || mensagensQ.data?.faltaMigration);
  const { data: pessoas } = usePessoas();
  const pessoasPorId = useMemo<Pessoas>(() => mapaDePessoas(pessoas) as Pessoas, [pessoas]);
  const pessoasMencao = useMemo<PessoaParaMencao[]>(
    () => (pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url })),
    [pessoas],
  );
  const eventoIds = useMemo(() => mencoes.map((m) => m.eventoId).filter((x): x is string => !!x), [mencoes]);
  const { data: reacoes = SEM_REACOES } = useReacoesDeEventos(eventoIds);
  // R240: as respostas das atividades que estão no chat — ordenadas para a
  // chave da query não mudar a cada render
  const chamadoIds = useMemo(
    () => Array.from(new Set(mencoes.map((m) => m.chamadoId))).sort(),
    [mencoes],
  );
  const respostasQ = useRespostasDoChat(chamadoIds, true);
  const respostas = respostasQ.data?.respostas ?? [];
  const faltaRespostas = !!respostasQ.data?.faltaMigration;
  const itens = useMemo(() => linhaDoTempo(mencoes, mensagens, respostas), [mencoes, mensagens, respostas]);
  // R245: as conversas mais recentes, uma por atividade — é o que o "#" oferece
  const recentes = useMemo(() => atividadesRecentes(itens), [itens]);

  // ── o selo: menções não lidas + recados que chegaram depois da última abertura ──
  const [lidoAte, setLidoAte] = useState<string | null>(() => lerDoNavegador(CHAVE_LIDO_ATE_CHAT));
  const naoLidas = aberto ? 0 : contarNaoLidasDoChat(notificacoes, mensagens, lidoAte, euId);
  function marcarVisto() {
    const agora = new Date().toISOString();
    setLidoAte(agora);
    guardarNoNavegador(CHAVE_LIDO_ATE_CHAT, agora);
  }
  // abrir o chat é ler as menções (o sino também as apaga)
  useEffect(() => {
    if (!aberto) return;
    for (const n of notificacoes) if (n.tipo === "mencao" && !n.lida) marcarLida(n.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, notificacoes.length]);

  // ── a posição: a alça arrasta, o navegador lembra ─────────────────────────
  const [pos, setPos] = useState<Ponto | null>(() => lerPosicaoGuardada(lerDoNavegador(CHAVE_POSICAO_CHAT)));
  const posRef = useRef<Ponto | null>(pos);
  posRef.current = pos;
  const painelRef = useRef<HTMLElement>(null);
  const arrasto = useRef<{ dx: number; dy: number } | null>(null);
  function iniciarArrasto(e: PointerEventReact<HTMLElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = painelRef.current?.getBoundingClientRect();
    if (!r) return;
    arrasto.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moverArrasto(e: PointerEventReact<HTMLElement>) {
    const a = arrasto.current;
    const r = painelRef.current?.getBoundingClientRect();
    if (!a || !r) return;
    setPos(posicaoDentroDaTela(
      { x: e.clientX - a.dx, y: e.clientY - a.dy },
      { w: r.width, h: r.height },
      { w: window.innerWidth, h: window.innerHeight },
    ));
  }
  function soltarArrasto() {
    if (!arrasto.current) return;
    arrasto.current = null;
    if (posRef.current) guardarNoNavegador(CHAVE_POSICAO_CHAT, JSON.stringify(posRef.current));
  }

  // ── a conversa rola para o fim ao abrir e a cada mensagem nova ────────────
  const corpoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const el = corpoRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [aberto, itens.length]);

  // R258 (Davi, 11/09/2026): "Ao abrir o chat, adicione o mecanismo de FOCUS,
  // onde o cursor vai direto pra caixa de texto." Reusa o MESMO contador do
  // "Responder aqui" (R249) — um pedido de foco é um pedido de foco, e dois
  // caminhos para a mesma coisa acabariam divergindo.
  const abrir = () => { setAberto(true); marcarVisto(); setPedidoDeFoco((n) => n + 1); };
  const recolher = () => { setAberto(false); marcarVisto(); };
  const abrirAtividade = (chamadoId: string) => {
    recolher();
    aoAbrirAtividade(chamadoId);
  };

  if (!aberto) {
    return (
      <button
        type="button"
        className="fab-chat"
        onClick={abrir}
        aria-label={naoLidas > 0 ? `Abrir o chat — ${naoLidas} nova${naoLidas === 1 ? "" : "s"}` : "Abrir o chat"}
        title="Chat: menções e recados"
        style={{
          ...goldButton(), width: 54, height: 54, borderRadius: 999, padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isLight ? "0 6px 18px rgba(0,0,0,0.18)" : "0 6px 18px rgba(0,0,0,0.55)",
        }}
      >
        <MessageCircle size={22} />
        {naoLidas > 0 && (
          // R222: círculo VERMELHO, fonte branca, canto SUPERIOR ESQUERDO
          <span
            aria-hidden
            style={{
              position: "absolute", top: -4, left: -4, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999,
              background: isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark, color: "#ffffff",
              fontFamily: FONT, fontWeight: 700, fontSize: 11,
              display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${c.pagina}`,
            }}
          >
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>
    );
  }

  return (
    <section
      ref={painelRef}
      className="fab-chat-painel"
      aria-label="Chat"
      style={{
        ...card(isLight), borderRadius: 18, padding: 0, display: "flex", flexDirection: "column",
        overflow: "hidden", color: c.texto,
        ...(pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : {}),
      }}
    >
      {/* a ALÇA: segurar e arrastar move o chat; o botão da direita recolhe */}
      <header
        className="fab-chat-alca"
        onPointerDown={iniciarArrasto}
        onPointerMove={moverArrasto}
        onPointerUp={soltarArrasto}
        onPointerCancel={soltarArrasto}
        title="Segure e arraste para mover o chat"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 10px 12px", borderBottom: `1px solid ${c.divisoria}`, background: c.superficie }}
      >
        <GripHorizontal size={16} color={c.textoSecundario} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: c.texto }}>Chat</span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>menções e recados para todos</span>
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={recolher}
          aria-label="Recolher o chat"
          title="Recolher"
          style={{
            width: 30, height: 30, borderRadius: 10, cursor: "pointer",
            background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronDown size={16} />
        </button>
      </header>

      {/* a CONVERSA — fundo da página, bolhas por cima: o contraste do celular */}
      <div
        ref={corpoRef}
        className="rolagem-fina"
        style={{ overflowY: "auto", minHeight: 0, flex: 1, padding: "12px 10px", background: c.pagina, display: "flex", flexDirection: "column", gap: 12 }}
      >
        {faltaMigration && (
          <Aviso c={c}>
            Parte do chat precisa da migration <strong>U119</strong> — até ela rodar, os recados para todos e a cor
            das mensagens não aparecem. As menções continuam chegando.
          </Aviso>
        )}
        {faltaRespostas && (
          <Aviso c={c}>
            As respostas enviadas por aqui precisam da migration <strong>U123</strong> — até ela rodar, a resposta
            vai para os comentários da atividade, mas não volta para o chat.
          </Aviso>
        )}
        {mencoesQ.isLoading && mensagensQ.isLoading ? (
          <Aviso c={c}>Carregando a conversa…</Aviso>
        ) : itens.length === 0 ? (
          <Aviso c={c}>
            Nada por aqui ainda. Quando alguém escrever <strong>@seu nome</strong> numa atividade, ou mandar um recado
            para todos, aparece nesta conversa.
          </Aviso>
        ) : (
          itens.map((it) => (
            <Mensagem
              key={it.chave}
              item={it}
              euId={euId}
              pessoasPorId={pessoasPorId}
              reacoes={reacoes.reacoes}
              faltaReacoes={reacoes.faltaMigration}
              aoAbrir={abrirAtividade}
              aoResponder={(r) => { setRespostaPara(r); setPedidoDeFoco((n) => n + 1); }}
            />
          ))
        )}
      </div>

      <Rodape
        c={c}
        isLight={isLight}
        pessoasMencao={pessoasMencao}
        conhecidas={mencoes}
        respostaPara={respostaPara}
        limparResposta={() => setRespostaPara(null)}
        recentes={recentes}
        pessoasPorId={pessoasPorId}
        armarResposta={(r) => setRespostaPara(r)}
        pedidoDeFoco={pedidoDeFoco}
      />
    </section>
  );
}

// ── o rodapé: o chip #Código e o campo fixo ────────────────────────────────

function Rodape({ c, isLight, pessoasMencao, conhecidas, respostaPara, limparResposta, recentes, pessoasPorId, armarResposta, pedidoDeFoco }: {
  c: ReturnType<typeof cinzas>;
  isLight: boolean;
  pessoasMencao: PessoaParaMencao[];
  conhecidas: readonly Mencao[];
  respostaPara: RespostaPara | null;
  limparResposta: () => void;
  /** R245: as atividades recentes do chat — a lista do "#" */
  recentes: readonly AtividadeRecente[];
  pessoasPorId: Pessoas;
  /** R245: escolher no "#" é o mesmo gesto do botão Responder */
  armarResposta: (r: RespostaPara) => void;
  /** R249: sobe a cada "Responder aqui" — a caixa ganha o cursor */
  pedidoDeFoco: number;
}) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  // a resposta armada é ESTADO DO PAI (a mensagem a arma); o texto é daqui —
  // assim a lista pode atualizar por trás sem apagar o que se digita
  const resposta = respostaPara;
  const alvo = resposta ? conhecidas.find((m) => m.chamadoId === resposta.chamadoId) ?? null : null;
  const corDoAlvo = alvo ? corDaMencao(alvo) : null;
  const chip = resposta ? (hashtagDaAtividade(resposta.numero) ?? alvo?.titulo ?? "atividade") : null;

  const enviar = useMutation({
    mutationFn: async () => {
      const destino = rotearEnvio(texto, resposta, conhecidas);
      if (!destino) throw new Error("Escreva alguma coisa antes de enviar.");
      if (destino.destino === "comentario") {
        // R216/R223: a resposta vira COMENTÁRIO na atividade — e R240: com a
        // ligação para a mensagem respondida, que é o que a traz de volta ao chat
        await comentarChamado(destino.chamadoId, destino.texto, destino.respondeA);
        return { para: "atividade" as const, chamadoId: destino.chamadoId };
      }
      await enviarMensagemParaTodos(destino.texto);
      return { para: "todos" as const, chamadoId: null };
    },
    onSuccess: (r) => {
      setTexto("");
      limparResposta();
      if (r.para === "atividade") {
        qc.invalidateQueries({ queryKey: ["chamado-eventos", r.chamadoId] });
        qc.invalidateQueries({ queryKey: ["minhas-mencoes"] });
        qc.invalidateQueries({ queryKey: ["respostas-chat"] });   // R240: a resposta aparece no campo
        toast.success("Resposta enviada na atividade.");
      } else {
        qc.invalidateQueries({ queryKey: ["mensagens-chat"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeEnviar = texto.trim().length > 0 && !enviar.isPending;

  return (
    <footer style={{ borderTop: `1px solid ${c.divisoria}`, background: c.superficie, padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      {resposta && (
        // R223: o #Código-Da-Atividade na COR DO PRAZO — é para onde a mensagem vai
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            title={alvo ? `Responder em: ${alvo.titulo}` : "Responder na atividade"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
              ...estiloDaBolha(corDoAlvo, isLight, c),
              color: tomDaCor(corDoAlvo, isLight, c.texto),
              fontFamily: FONT, fontWeight: 700, fontSize: 12, maxWidth: "100%", minWidth: 0,
            }}
          >
            <Reply size={12} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip}</span>
          </span>
          <button
            type="button"
            onClick={limparResposta}
            aria-label="Cancelar a resposta"
            title="Cancelar a resposta"
            style={{ width: 24, height: 24, borderRadius: 8, border: `1px solid ${c.divisoria}`, background: c.campo, color: c.texto, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: 8, alignItems: "end" }}>
        <TextareaComMencoes
          valor={texto}
          aoMudar={setTexto}
          pessoas={pessoasMencao}
          rows={1}
          focarEm={pedidoDeFoco}
          placeholder={resposta ? "Sua resposta… (Enter envia)" : "Escreva para todos… (# escolhe uma atividade)"}
          // R245: o "#" abre as atividades recentes (só o nome); escolher uma
          // ARMA a resposta — o chip #Código aparece acima, e a mensagem vai
          // para a atividade como resposta (R223/R240)
          atividades={recentes.map((a) => ({ id: a.chamadoId, titulo: a.titulo, numero: a.numero }))}
          aoEscolherAtividade={(a) => {
            const r = recentes.find((x) => x.chamadoId === a.id);
            if (!r) return;
            armarResposta({
              chamadoId: r.chamadoId, numero: r.numero,
              autorId: r.autorId, autorNome: r.autorId ? (pessoasPorId[r.autorId]?.nome ?? null) : null,
              eventoId: r.eventoId,
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && podeEnviar) {
              e.preventDefault();
              enviar.mutate();
            }
          }}
          estilo={{
            width: "100%", boxSizing: "border-box", borderRadius: 14, padding: "10px 12px", minHeight: 40, maxHeight: 120,
            background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
            fontFamily: FONT, fontSize: 13, lineHeight: 1.45, outline: "none", resize: "none",
          }}
        />
        {/* o ÚNICO degradê amarelo da conversa (R222) */}
        <button
          type="button"
          onClick={() => enviar.mutate()}
          disabled={!podeEnviar}
          aria-label="Enviar"
          title="Enviar"
          style={{
            ...goldButton(), width: 40, height: 40, borderRadius: 999, padding: 0, boxShadow: "none",
            display: "flex", alignItems: "center", justifyContent: "center", opacity: podeEnviar ? 1 : 0.55,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </footer>
  );
}

// ── uma conversa: UM campo na cor do prazo, N caixas de mensagem (R240) ─────

/**
 * A caixa de uma mensagem DENTRO do campo — o que separa uma fala da outra.
 *
 * Um poço escuro no escuro, um cartão branco no claro: nos dois casos a cor do
 * campo continua lendo em volta da caixa, que é o que o Davi pediu. MEDIDO: a
 * caixa contra o campo dá 1,12 no escuro e 1,25 no claro — dois tons escuros
 * não produzem razão maior (o piso de 0,05 da fórmula domina), e é por isso que
 * no sistema inteiro quem separa superfície de superfície é a BORDA. Aqui ela
 * vem TINGIDA da cor do campo (`borda`), então amarra a caixa ao campo em vez
 * de brigar com ele. O texto dentro fica com 15:1 no claro e 17:1 no escuro.
 */
function estiloDaCaixa(isLight: boolean, c: ReturnType<typeof cinzas>, borda?: string): CSSProperties {
  return {
    background: isLight ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.30)",
    border: `1px solid ${borda ?? c.divisoria}`,
    borderRadius: 10, padding: "6px 9px",
    display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0,
  };
}

function CaixaDeMensagem({ autorId, nome, pessoa, quando, borda, aoClicar, dica, children }: {
  autorId: string | null;
  nome: string;
  pessoa?: { nome: string; avatar_url: string | null };
  quando: string;
  /** a borda da caixa, tingida da cor do campo */
  borda?: string;
  /** menção num campo da atividade: a caixa inteira é o botão que abre o pop-up */
  aoClicar?: () => void;
  dica?: string;
  children: ReactNode;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const clicavel = !!aoClicar;
  return (
    <div
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={aoClicar}
      onKeyDown={clicavel ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoClicar?.(); } } : undefined}
      title={dica}
      style={{ ...estiloDaCaixa(isLight, c, borda), cursor: clicavel ? "pointer" : "default" }}
    >
      <span title={nome} style={{ flexShrink: 0, marginTop: 1 }}>
        {autorId
          ? <AvatarCirculo id={autorId} nome={nome} pessoa={pessoa} tamanho={22} />
          : <span style={{ width: 22, height: 22, borderRadius: "50%", background: c.elevada, display: "inline-block" }} />}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 11.5, color: c.texto,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {nome}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 10.5, color: c.textoSecundario, flexShrink: 0 }}>{quando}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Mensagem({ item, euId, pessoasPorId, reacoes, faltaReacoes, aoAbrir, aoResponder }: {
  item: ItemDoChat;
  euId: string | null;
  pessoasPorId: Pessoas;
  reacoes: readonly { evento_id: string; profile_id: string; emoji: string }[];
  faltaReacoes: boolean;
  aoAbrir: (chamadoId: string) => void;
  aoResponder: (r: RespostaPara) => void;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  if (item.tipo === "todos") {
    return <Recado m={item.mensagem} euId={euId} pessoasPorId={pessoasPorId} />;
  }
  const m = item.mencao;
  const autor = m.autorId ? pessoasPorId[m.autorId] : undefined;
  const cor = corDaMencao(m);
  const comentario = ehComentario(m);
  // R240: ter resposta no campo já é ter respondido — o ponto de atenção sai
  const pendente = comentario && !m.respondida && item.respostas.length === 0;
  const tom = tomDaCor(cor, isLight, c.texto);
  const nomeDe = (id: string | null): string =>
    (id && id === euId) ? "Você" : ((id ? pessoasPorId[id]?.nome : null) ?? "Alguém");
  const bordaDaCaixa = cor ? PRISMA[PRISMA_DA_MENSAGEM[cor]].border : c.divisoria;
  const textoDaCaixa: CSSProperties = { fontSize: 13, color: c.texto, lineHeight: 1.5, gap: 2 } as CSSProperties;

  return (
    <article
      style={{
        ...estiloDaBolha(cor, isLight, c),
        borderRadius: 14, padding: 8, minWidth: 0,
        display: "flex", flexDirection: "column", gap: 6,
        boxShadow: pendente ? `inset 3px 0 0 ${tom}` : undefined,
      }}
    >
      {/* R240: o TÍTULO mora DENTRO do campo colorido — é o assunto das caixas */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, padding: "0 2px" }}>
        <button
          type="button"
          onClick={() => aoAbrir(m.chamadoId)}
          title={`Abrir a atividade (menção em ${ROTULO_DA_ORIGEM[m.origem]})`}
          style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
            flex: 1, minWidth: 0,
            fontFamily: FONT, fontWeight: 600, fontSize: 12, color: c.texto, lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {m.titulo}
        </button>
        {pendente && (
          // R222: "chamar a atenção para mensagens novas/não respondidas"
          <span title="Você ainda não respondeu" aria-label="não respondida" style={{ width: 7, height: 7, borderRadius: 4, background: tom, flexShrink: 0 }} />
        )}
      </div>

      {/* a MENÇÃO — em campo da atividade, a caixa é o botão que abre o pop-up */}
      <CaixaDeMensagem
        autorId={m.autorId}
        nome={nomeDe(m.autorId)}
        pessoa={autor}
        quando={dataHoraCurta(m.criadoEm)}
        borda={bordaDaCaixa}
        aoClicar={comentario ? undefined : () => aoAbrir(m.chamadoId)}
        dica={comentario ? undefined : "Abrir a atividade"}
      >
        {comentario ? (
          <TextoComChecklist texto={m.texto} estilo={textoDaCaixa} />
        ) : (
          <p style={{ margin: 0, fontFamily: FONT, fontSize: 13, color: c.texto, lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ flex: 1, minWidth: 0 }}><LinhaRica texto={paragrafoComMencao(m.texto, euId)} /></span>
            <ExternalLink size={12} color={c.textoSecundario} style={{ flexShrink: 0, marginTop: 3 }} />
          </p>
        )}
      </CaixaDeMensagem>

      {/* R240: as RESPOSTAS — caixas diferentes, o mesmo campo */}
      {item.respostas.map((r: RespostaDoChat) => (
        <CaixaDeMensagem
          key={r.id}
          autorId={r.autorId}
          nome={nomeDe(r.autorId)}
          pessoa={r.autorId ? pessoasPorId[r.autorId] : undefined}
          quando={dataHoraCurta(r.criadoEm)}
          borda={bordaDaCaixa}
        >
          <TextoComChecklist texto={r.texto} estilo={textoDaCaixa} />
        </CaixaDeMensagem>
      ))}

      {/* R216/R217: responder e reagir — só em COMENTÁRIO, no pé do campo */}
      {comentario && m.eventoId && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "0 2px" }}>
          <button
            type="button"
            onClick={() => aoResponder({
              chamadoId: m.chamadoId, numero: m.numero,
              autorId: m.autorId, autorNome: autor?.nome ?? null,
              eventoId: m.eventoId,   // R240: a resposta se junta a ESTA mensagem
            })}
            aria-label="Responder aqui"
            title="Responder aqui"
            style={{
              width: 28, height: 28, borderRadius: 9, cursor: "pointer",
              background: c.superficie, border: `1px solid ${c.divisoria}`, color: c.texto,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Reply size={14} />
          </button>
          <FileiraDeReacoes chamadoId={m.chamadoId} eventoId={m.eventoId} reacoes={reacoes} faltaMigration={faltaReacoes} euId={euId} />
        </div>
      )}
    </article>
  );
}

// ── o recado para todos (R223): campo neutro; o meu encosta à direita ───────

function Recado({ m, euId, pessoasPorId }: { m: MensagemParaTodos; euId: string | null; pessoasPorId: Pessoas }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const autor = pessoasPorId[m.autorId];
  const nome = autor?.nome ?? "Alguém";
  const meu = !!euId && m.autorId === euId;
  return (
    <article style={{ display: "flex", justifyContent: meu ? "flex-end" : "flex-start", minWidth: 0 }}>
      <div style={{
        background: meu ? c.elevada : c.superficie, border: `1px solid ${c.divisoria}`,
        borderRadius: 14, padding: 8, maxWidth: "94%", minWidth: 0,
        display: "flex", flexDirection: "column", gap: 6,
      }}>
        {/* R240: o cabeçalho mora DENTRO do campo, como na menção — lá é o
            título da atividade, aqui é para quem o recado vai */}
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: c.textoSecundario, padding: "0 2px" }}>
          Para todos
        </span>
        <CaixaDeMensagem
          autorId={m.autorId}
          nome={meu ? "Você" : nome}
          pessoa={autor}
          quando={dataHoraCurta(m.criadoEm)}
        >
          <TextoComChecklist texto={m.texto} estilo={{ fontSize: 13, color: c.texto, lineHeight: 1.5, gap: 2 } as CSSProperties} />
        </CaixaDeMensagem>
      </div>
    </article>
  );
}

function Aviso({ c, children }: { c: ReturnType<typeof cinzas>; children: ReactNode }) {
  return (
    <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5, padding: "4px 6px" }}>
      {children}
    </span>
  );
}
