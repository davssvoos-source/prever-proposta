// O CHAT DE MENÇÕES da Início (R215–R217, U117): o botão circular fixo no canto
// inferior direito e o painel que ele abre.
//
// Davi, 2026-09-08: "Adicione um botão circular de Chat, na tela Início, este
// botão deve estar localizado no canto inferior direito e deve ter localização
// fixa com o scroll da tela. O botão deve expandir um campo de chat, onde
// aparecerá todas as menções a aquele usuário […] o titulo será a atividade que
// eu comentei, onde ao clicar abre um popup da atividade no meio da tela. Mas
// caso seja uma menção na descrição de uma atividade, deve aparecer o paragrafo
// da menção no chat. […] deve ter um botão de responder aqui, que ele responde
// no próprio chat, sem abrir o pop up […] no chat deve dar para reagir se for
// comentário, reagindo no comentário da atividade."
//
// CADA CARD é uma menção: quem mencionou (avatar + nome + quando), o título da
// atividade (clicável → o pai abre o Configurador rápido CENTRALIZADO), o texto
// — o comentário inteiro, ou o parágrafo da descrição que traz a menção —, a
// fileira de reações (só em comentário, R217) e "Responder aqui" (R216: a
// resposta vira comentário na atividade, mencionando quem mencionou).
//
// POSIÇÃO: `.fab-chat` / `.fab-chat-painel` em styles.css — no celular acima da
// BottomNav, no desktop no canto. O painel não é modal: abrir a atividade
// fecha o chat primeiro (o Dialog do painel é modal).
//
// SUBCOMPONENTES DE MÓDULO (lição do PainelChamado): o texto da resposta não
// pode sumir quando a lista atualiza por trás.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AtSign, MessageCircle, Reply, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { AvatarCirculo } from "@/components/PessoaComFoto";
import { TextoComChecklist, LinhaRica } from "@/components/TextoComChecklist";
import { TextareaComMencoes, type PessoaParaMencao } from "@/components/EditorDeDescricao";
import { useNotificacoes, tempoRelativo } from "@/hooks/useNotificacoes";
import { usePessoas, mapaDePessoas, comentarChamado } from "@/features/chamados/data";
import { useReacoesDeEventos, SEM_REACOES } from "@/features/chamados/reacoes";
import { FileiraDeReacoes } from "@/features/chamados/FileiraDeReacoes";
import { useMinhasMencoes } from "./chat-data";
import { chaveDaMencao, contarMencoesNaoLidas, paragrafoComMencao, respostaComMencao, type Mencao } from "./chat";

export function ChatDeMencoes({ aoAbrirAtividade }: { aoAbrirAtividade: (chamadoId: string) => void }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const [aberto, setAberto] = useState(false);
  const [euId, setEuId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEuId(data.user?.id ?? null));
  }, []);

  const { notificacoes } = useNotificacoes();
  const naoLidas = contarMencoesNaoLidas(notificacoes);
  const { data, isLoading } = useMinhasMencoes(aberto);
  const mencoes = data?.mencoes ?? [];
  const { data: pessoas } = usePessoas();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);
  const pessoasMencao = useMemo<PessoaParaMencao[]>(
    () => (pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url })),
    [pessoas],
  );
  const eventoIds = useMemo(() => mencoes.map((m) => m.eventoId).filter((x): x is string => !!x), [mencoes]);
  const { data: reacoes = SEM_REACOES } = useReacoesDeEventos(eventoIds);

  const abrirAtividade = (chamadoId: string) => {
    setAberto(false);
    aoAbrirAtividade(chamadoId);
  };

  if (!aberto) {
    return (
      <button
        type="button"
        className="fab-chat"
        onClick={() => setAberto(true)}
        aria-label={naoLidas > 0 ? `Abrir o chat de menções — ${naoLidas} nova${naoLidas === 1 ? "" : "s"}` : "Abrir o chat de menções"}
        title="Menções a você"
        style={{
          ...goldButton(), width: 54, height: 54, borderRadius: 999, padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isLight ? "0 6px 18px rgba(0,0,0,0.18)" : "0 6px 18px rgba(0,0,0,0.55)",
        }}
      >
        <MessageCircle size={22} />
        {naoLidas > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999,
              background: c.texto, color: c.superficie, fontFamily: FONT, fontWeight: 700, fontSize: 11,
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
      className="fab-chat-painel"
      aria-label="Chat de menções"
      style={{ ...card(isLight), borderRadius: 18, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", color: c.texto }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${c.divisoria}` }}>
        <AtSign size={15} color={gold} />
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em", textTransform: "uppercase", color: gold }}>Menções</span>
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario }}>
          {mencoes.length > 0 ? `${mencoes.length}${naoLidas > 0 ? ` · ${naoLidas} nova${naoLidas === 1 ? "" : "s"}` : ""}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar o chat"
          style={{
            width: 30, height: 30, borderRadius: 10, cursor: "pointer",
            background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div className="rolagem-fina" style={{ overflowY: "auto", minHeight: 0, flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {data?.faltaMigration ? (
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5 }}>
            O chat de menções precisa da migration <strong>U117</strong>. Até ela rodar, nada aparece aqui — as menções
            continuam chegando pelo sino.
          </span>
        ) : isLoading ? (
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario }}>Carregando as menções…</span>
        ) : mencoes.length === 0 ? (
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5 }}>
            Ninguém mencionou você ainda. Quando alguém escrever <strong>@seu nome</strong> num comentário ou na
            descrição de uma atividade, aparece aqui.
          </span>
        ) : (
          mencoes.map((m) => (
            <CardDeMencao
              key={chaveDaMencao(m)}
              m={m}
              euId={euId}
              pessoasPorId={pessoasPorId}
              pessoasMencao={pessoasMencao}
              reacoes={reacoes.reacoes}
              faltaReacoes={reacoes.faltaMigration}
              aoAbrir={() => abrirAtividade(m.chamadoId)}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ── um card por menção ──────────────────────────────────────────────────────

function CardDeMencao({ m, euId, pessoasPorId, pessoasMencao, reacoes, faltaReacoes, aoAbrir }: {
  m: Mencao;
  euId: string | null;
  pessoasPorId: Record<string, { nome: string; avatar_url: string | null }>;
  pessoasMencao: PessoaParaMencao[];
  reacoes: readonly { evento_id: string; profile_id: string; emoji: string }[];
  faltaReacoes: boolean;
  aoAbrir: () => void;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const qc = useQueryClient();
  const [respondendo, setRespondendo] = useState(false);
  const [texto, setTexto] = useState("");
  const autor = m.autorId ? pessoasPorId[m.autorId] : undefined;
  const autorNome = autor?.nome ?? null;

  // R216: a resposta vira COMENTÁRIO na atividade, mencionando quem mencionou
  const responder = useMutation({
    mutationFn: async () => {
      const t = respostaComMencao(autorNome, m.autorId, texto);
      if (!t) throw new Error("Escreva alguma coisa antes de enviar.");
      await comentarChamado(m.chamadoId, t);
    },
    onSuccess: () => {
      setTexto("");
      setRespondendo(false);
      qc.invalidateQueries({ queryKey: ["chamado-eventos", m.chamadoId] });
      qc.invalidateQueries({ queryKey: ["minhas-mencoes"] });
      toast.success(`Resposta enviada para ${m.numero ?? m.titulo}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const botaoLeve: CSSProperties = {
    height: 28, padding: "0 10px", borderRadius: 9, cursor: "pointer",
    background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
    fontFamily: FONT, fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5,
  };

  return (
    <article style={{ borderRadius: 14, background: c.campo, border: `1px solid ${c.divisoria}`, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {m.autorId ? (
          <AvatarCirculo id={m.autorId} nome={autorNome ?? "Alguém"} pessoa={autor} tamanho={22} />
        ) : (
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: c.elevada, display: "inline-block" }} />
        )}
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: c.texto, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {autorNome ?? "Alguém"}
          <span style={{ fontWeight: 400, color: c.textoSecundario }}> · {tempoRelativo(m.criadoEm)}</span>
        </span>
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: c.textoSecundario, flexShrink: 0 }}>
          {m.origem === "comentario" ? "comentário" : "descrição"}
        </span>
      </div>

      {/* o título é a atividade — clicar abre o Configurador rápido no meio da tela */}
      <button
        type="button"
        onClick={aoAbrir}
        title="Abrir a atividade"
        style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
          fontFamily: FONT, fontWeight: 700, fontSize: 13, color: gold, lineHeight: 1.35,
        }}
      >
        {m.numero ? `${m.numero} · ` : ""}{m.titulo}
      </button>

      {m.origem === "comentario" ? (
        <TextoComChecklist texto={m.texto} estilo={{ fontSize: 13, color: c.texto, lineHeight: 1.5, gap: 2 }} />
      ) : (
        <p style={{ margin: 0, fontFamily: FONT, fontSize: 13, color: c.texto, lineHeight: 1.5 }}>
          <LinhaRica texto={paragrafoComMencao(m.texto, euId)} />
        </p>
      )}

      {/* R217: reagir só faz sentido em COMENTÁRIO — reage no comentário da atividade */}
      {m.origem === "comentario" && m.eventoId && (
        <FileiraDeReacoes chamadoId={m.chamadoId} eventoId={m.eventoId} reacoes={reacoes} faltaMigration={faltaReacoes} euId={euId} />
      )}

      {respondendo ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <TextareaComMencoes
            valor={texto}
            aoMudar={setTexto}
            pessoas={pessoasMencao}
            rows={2}
            placeholder={autorNome ? `Responder a ${autorNome}…` : "Sua resposta…"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && texto.trim() && !responder.isPending) {
                e.preventDefault();
                responder.mutate();
              }
            }}
            estilo={{
              width: "100%", boxSizing: "border-box", borderRadius: 10, padding: "8px 10px",
              background: c.superficie, border: `1px solid ${c.divisoria}`, color: c.texto,
              fontFamily: FONT, fontSize: 13, outline: "none", resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setRespondendo(false); setTexto(""); }} style={botaoLeve}>Cancelar</button>
            <button
              type="button"
              onClick={() => responder.mutate()}
              disabled={responder.isPending || !texto.trim()}
              style={{ ...goldButton(), boxShadow: "none", height: 28, padding: "0 12px", borderRadius: 9, fontSize: 11.5, opacity: texto.trim() ? 1 : 0.6 }}
            >
              {responder.isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setRespondendo(true)} style={botaoLeve}>
            <Reply size={13} color={gold} /> Responder aqui
          </button>
        </div>
      )}
    </article>
  );
}
