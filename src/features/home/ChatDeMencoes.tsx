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
import { useMinhasMencoes, useMensagensDoChat, useCanalDoChat, enviarMensagemParaTodos } from "./chat-data";
import {
  CHAVE_LIDO_ATE_CHAT, CHAVE_POSICAO_CHAT, PRISMA_DA_MENSAGEM, ROTULO_DA_ORIGEM,
  contarNaoLidasDoChat, corDaMencao, dataHoraCurta, ehComentario, hashtagDaAtividade,
  lerPosicaoGuardada, linhaDoTempo, paragrafoComMencao, posicaoDentroDaTela, rotearEnvio,
  type CorDaMensagem, type ItemDoChat, type Mencao, type MensagemParaTodos, type Ponto, type RespostaPara,
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
  const itens = useMemo(() => linhaDoTempo(mencoes, mensagens), [mencoes, mensagens]);

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

  const abrir = () => { setAberto(true); marcarVisto(); };
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
              aoResponder={(r) => setRespostaPara(r)}
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
      />
    </section>
  );
}

// ── o rodapé: o chip #Código e o campo fixo ────────────────────────────────

function Rodape({ c, isLight, pessoasMencao, conhecidas, respostaPara, limparResposta }: {
  c: ReturnType<typeof cinzas>;
  isLight: boolean;
  pessoasMencao: PessoaParaMencao[];
  conhecidas: readonly Mencao[];
  respostaPara: RespostaPara | null;
  limparResposta: () => void;
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
        // R216/R223: a resposta vira COMENTÁRIO na atividade
        await comentarChamado(destino.chamadoId, destino.texto);
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
          placeholder={resposta ? "Sua resposta… (Enter envia)" : "Escreva para todos… (#código responde numa atividade)"}
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

// ── uma mensagem da conversa ────────────────────────────────────────────────

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
  const autorNome = autor?.nome ?? "Alguém";
  const cor = corDaMencao(m);
  const comentario = ehComentario(m);
  const pendente = !m.respondida && comentario;
  const tom = tomDaCor(cor, isLight, c.texto);

  return (
    <article style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span title={autorNome} style={{ flexShrink: 0, marginTop: 2 }}>
        {m.autorId
          ? <AvatarCirculo id={m.autorId} nome={autorNome} pessoa={autor} tamanho={28} />
          : <span style={{ width: 28, height: 28, borderRadius: "50%", background: c.elevada, display: "inline-block" }} />}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {/* título da atividade (abre o pop-up) · data/hora — sem código (R222) */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => aoAbrir(m.chamadoId)}
            title={`Abrir a atividade (menção em ${ROTULO_DA_ORIGEM[m.origem]})`}
            style={{
              background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0,
              fontFamily: FONT, fontWeight: 600, fontSize: 12, color: c.texto, lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {m.titulo}
          </button>
          <span style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario, flexShrink: 0 }}>{dataHoraCurta(m.criadoEm)}</span>
          {pendente && (
            // R222: "chamar a atenção para mensagens novas/não respondidas"
            <span title="Você ainda não respondeu" aria-label="não respondida" style={{ width: 7, height: 7, borderRadius: 4, background: tom, flexShrink: 0, alignSelf: "center" }} />
          )}
        </div>

        {/* a bolha, na cor do prazo; em menção de campo, ela é o botão que abre a atividade */}
        <div
          role={comentario ? undefined : "button"}
          tabIndex={comentario ? undefined : 0}
          onClick={comentario ? undefined : () => aoAbrir(m.chamadoId)}
          onKeyDown={comentario ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoAbrir(m.chamadoId); } }}
          title={comentario ? undefined : "Abrir a atividade"}
          style={{
            ...estiloDaBolha(cor, isLight, c),
            borderRadius: "4px 14px 14px 14px", padding: "8px 11px",
            boxShadow: pendente ? `inset 3px 0 0 ${tom}` : undefined,
            cursor: comentario ? "default" : "pointer",
            color: c.texto,
          }}
        >
          {comentario ? (
            <TextoComChecklist texto={m.texto} estilo={{ fontSize: 13, color: c.texto, lineHeight: 1.5, gap: 2 }} />
          ) : (
            <p style={{ margin: 0, fontFamily: FONT, fontSize: 13, color: c.texto, lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ flex: 1, minWidth: 0 }}><LinhaRica texto={paragrafoComMencao(m.texto, euId)} /></span>
              <ExternalLink size={12} color={c.textoSecundario} style={{ flexShrink: 0, marginTop: 3 }} />
            </p>
          )}
        </div>

        {/* R216/R217: responder e reagir — só em COMENTÁRIO, abaixo do conteúdo */}
        {comentario && m.eventoId && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => aoResponder({ chamadoId: m.chamadoId, numero: m.numero, autorId: m.autorId, autorNome: autor?.nome ?? null })}
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
      </div>
    </article>
  );
}

// ── o recado para todos (R223): bolha neutra, sem título; o meu fica à direita ──

function Recado({ m, euId, pessoasPorId }: { m: MensagemParaTodos; euId: string | null; pessoasPorId: Pessoas }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const autor = pessoasPorId[m.autorId];
  const nome = autor?.nome ?? "Alguém";
  const meu = !!euId && m.autorId === euId;
  return (
    <article style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: meu ? "row-reverse" : "row" }}>
      <span title={nome} style={{ flexShrink: 0, marginTop: 2 }}>
        <AvatarCirculo id={m.autorId} nome={nome} pessoa={autor} tamanho={28} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: meu ? "flex-end" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: c.texto }}>{meu ? "Você" : nome}</span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>· para todos · {dataHoraCurta(m.criadoEm)}</span>
        </div>
        <div style={{
          background: meu ? c.elevada : c.superficie, border: `1px solid ${c.divisoria}`,
          borderRadius: meu ? "14px 4px 14px 14px" : "4px 14px 14px 14px", padding: "8px 11px", maxWidth: "100%",
        }}>
          <TextoComChecklist texto={m.texto} estilo={{ fontSize: 13, color: c.texto, lineHeight: 1.5, gap: 2 }} />
        </div>
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
