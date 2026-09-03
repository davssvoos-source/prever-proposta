// Chamado INTERNO — o corpo da tela quando natureza = 'interno'.
// Edição, feed de comentários, apoio e equipamentos envolvidos: é o que era o
// quadro do Notion. Extraído de /demandas/$id na Etapa U7 — quem monta a
// página é /chamados/$id. Ver docs/PLANO_UNIFICACAO.md §5.1.
//
// ── R135 (U95): A TELA DO COMPUTADOR, EM DUAS COLUNAS ──────────────────────
// Davi, 03/09/2026, sobre esta tela ("Croqui demonstrativo para projeto de
// Portaria Remota"): "agrupe as opções de cada item — STATUS deve ser uma
// opção que ao clicar abre a lista de seleção. Faça isso com todas as opções.
// Vamos aproveitar que a tela do desktop é grande, organize os itens e a maior
// caixa deverá ser um espaço grande para texto."
//
// Então: a coluna LARGA é o texto — a descrição num editor de blocos (caixa de
// marcar de verdade, menção com "@") e a conversa embaixo; a coluna ESTREITA
// são as propriedades, cada uma num SELETOR que abre a lista (não mais uma
// fileira de cinco a sete botões por propriedade), pintado pela cor da coisa
// escolhida (a R87 continua valendo — no botão único). Responsável e apoio
// mostram o rosto. Quem escreveu um comentário pode apagá-lo. No celular as
// duas colunas empilham (classe .detalhe-grid) — mas o técnico de campo não
// vive nesta tela: o fluxo dele é o do chamado de campo (DetalheCampo).

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CalendarClock, ExternalLink, Plus, Send, Trash2, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { card, botaoSelecao } from "@/lib/ui";
import { TextoComChecklist } from "@/components/TextoComChecklist";
import { SeletorDeOpcao, type OpcaoDoSeletor } from "@/components/SeletorDeOpcao";
import { EditorDeDescricao, TextareaComMencoes, type PessoaParaMencao } from "@/components/EditorDeDescricao";
import { CampoComBusca, type OpcaoBusca } from "@/components/CampoComBusca";
import { AvatarCirculo } from "@/components/PessoaComFoto";
import { useIsGerente, useVeFinanceiro } from "@/features/gerencial/data";
import {
  useChamado, useChamadoEventos, useChamadoApoios, useChamadoEquipamentos,
  usePessoas, mapaDePessoas, atualizarChamado, comentarChamado, excluirComentario, excluirChamado,
  adicionarApoio, removerApoio, adicionarEquipamentoChamado, removerEquipamentoChamado,
  type ChamadoPatch,
} from "@/features/chamados/data";
import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo,
  SPRINT_ORDEM, SPRINT_LABEL, prazoParaData, dataParaPrazo,
  statusDaNatureza, tiposDaNatureza, TIPO_LABEL, TIPO_CORES,
  PRIORIDADE_LABEL, PRIORIDADE_CORES,
  type ChamadoPrioridade, type ChamadoSprint, type ChamadoStatus, type ChamadoTipo,
} from "@/lib/chamado-status";
import type { Cores } from "@/features/atividades/modelo";
import { especieDoApoio } from "@/features/programacao/modelo";
import { EQUIPES, EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import {
  useCompra, salvarCompra, decidirCompra, proximasSituacoes,
  SITUACAO_LABEL, SITUACAO_CORES, SITUACOES_DE_DECISAO, moedaBR,
  type SituacaoCompra,
} from "@/features/chamados/compra";
import { tempoRelativo } from "@/hooks/useNotificacoes";

const PRIORIDADES: ChamadoPrioridade[] = ["baixa", "normal", "alta", "urgente"];

export function DetalheInterno({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: chamado, isLoading } = useChamado(id);
  const { data: eventos = [] } = useChamadoEventos(id, "asc");
  const { data: apoios = [] } = useChamadoApoios(id);
  const { data: equipamentos = [] } = useChamadoEquipamentos(id);
  const { data: pessoas = [] } = usePessoas();
  // R6/Q6: pedido de compra tem ficha própria — só carrega quando é o caso
  const ehCompra = chamado?.tipo === "pedido_compra";
  const { data: compra } = useCompra(id, ehCompra);
  const { data: veFinanceiro = false } = useVeFinanceiro();

  const [comentario, setComentario] = useState("");
  const [novoEquip, setNovoEquip] = useState("");
  const [novaSerie, setNovaSerie] = useState("");
  const [motivoRecusaCompra, setMotivoRecusaCompra] = useState("");
  const [pedindoRecusa, setPedindoRecusa] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);
  const pessoasOrdenadas = useMemo(
    () => [...(pessoas as any[])].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [pessoas],
  );
  const opcoesPessoas: OpcaoBusca[] = useMemo(
    () => pessoasOrdenadas.map((p) => ({
      valor: p.id, rotulo: p.nome, secundario: p.equipe ? EQUIPE_LABEL[p.equipe as Equipe] : undefined,
    })),
    [pessoasOrdenadas],
  );
  const pessoasMencao: PessoaParaMencao[] = useMemo(
    () => pessoasOrdenadas.map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url ?? null })),
    [pessoasOrdenadas],
  );
  const nomeDe = (pid: string) => pessoasPorId[pid]?.nome ?? "Alguém";

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // card() de lib/ui: a superfície da casa nos dois temas — aqui havia uma
  // cópia v3 que já divergia do resto das telas do grupo.
  const CARD: CSSProperties = {
    ...card(isLight),
    padding: "16px",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 12px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };

  const salvar = useMutation({
    mutationFn: async (patch: ChamadoPatch) => atualizarChamado(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamado", id] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["chamado-eventos", id] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Não foi possível salvar. Confira se você é responsável ou gestor."),
  });

  const salvarFichaCompra = useMutation({
    mutationFn: async (patch: Parameters<typeof salvarCompra>[1]) => salvarCompra(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chamado-compra", id] }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar o pedido."),
  });

  const andarCompra = useMutation({
    mutationFn: async ({ situacao, motivo }: { situacao: SituacaoCompra; motivo?: string }) =>
      decidirCompra(id, situacao, motivo),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["chamado-compra", id] });
      qc.invalidateQueries({ queryKey: ["chamado", id] });
      qc.invalidateQueries({ queryKey: ["chamado-eventos", id] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      setPedindoRecusa(false);
      setMotivoRecusaCompra("");
      toast.success(`Pedido marcado como "${SITUACAO_LABEL[v.situacao]}".`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível mover o pedido."),
  });

  const enviarComentario = useMutation({
    mutationFn: async () => {
      const t = comentario.trim();
      if (!t) throw new Error("Escreva alguma coisa antes de enviar.");
      await comentarChamado(id, t);
    },
    onSuccess: () => {
      setComentario("");
      qc.invalidateQueries({ queryKey: ["chamado-eventos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // R135: quem escreveu apaga. A policy decide no banco; aqui só se pede.
  const apagarComentario = useMutation({
    mutationFn: async (eventoId: string) => excluirComentario(eventoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chamado-eventos", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarApoio = useMutation({
    mutationFn: async ({ profileId, entrar }: { profileId: string; entrar: boolean }) =>
      entrar ? adicionarApoio(id, profileId) : removerApoio(id, profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamado-apoios", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar o apoio."),
  });

  const mexerEquip = useMutation({
    mutationFn: async (acao: { tipo: "add" } | { tipo: "del"; equipId: string }) => {
      if (acao.tipo === "del") return removerEquipamentoChamado(acao.equipId);
      if (!novoEquip.trim()) throw new Error("Descreva o equipamento.");
      await adicionarEquipamentoChamado(id, {
        descricao: novoEquip.trim(),
        numero_serie: novaSerie.trim() || null,
      });
    },
    onSuccess: () => {
      setNovoEquip("");
      setNovaSerie("");
      qc.invalidateQueries({ queryKey: ["chamado-equipamentos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => excluirChamado(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      toast.success("Chamado excluído.");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir."),
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "var(--fonte)" }}>
        Carregando…
      </div>
    );
  }
  if (!chamado) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "var(--fonte)" }}>
        Chamado não encontrado.
      </div>
    );
  }

  const st = chamadoStatusInfo(chamado.status);
  const eqc = equipeCores(chamado.equipe);
  const sp = situacaoPrazo(chamado.prazo_limite, chamado.status);
  const comentarios = eventos.filter((e) => e.tipo === "comentario");
  const timeline = eventos.filter((e) => e.tipo !== "comentario");
  const podeEditar =
    isGerente ||
    chamado.responsavel_id === userId ||
    chamado.aberto_por === userId ||
    !chamado.responsavel_id ||
    // U81: `apoios` virou lista de LINHAS (profile_id, origem, congelado_em) —
    // antes era um array de ids. Este predicado continua sendo o gêmeo
    // DESATUALIZADO de `pode_editar_chamado`: ele não aplica
    // `apoioValeComoVinculo`, ao contrário da grade (programacao/modelo.ts:724).
    // Está em docs/PENDENCIAS_TECNICAS.md; alargar aqui seria mudar autorização
    // de carona numa entrega que prometeu não tocar em nenhuma.
    apoios.some((a) => a.profile_id === (userId ?? ""));

  /**
   * O botão de opção COLORIDO PELA COISA (R87, U72) — hoje só nos passos do
   * pedido de compra; as propriedades da atividade viraram seletores (R135),
   * que usam o mesmo `botaoSelecao` por dentro.
   */
  const chip = (ativo: boolean, cor?: Cores | null): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, cor as any),
    padding: "8px 12px", borderRadius: 10, fontSize: 11.5,
    cursor: podeEditar ? "pointer" : "default", opacity: podeEditar ? 1 : 0.6,
  });

  // ── as opções de cada seletor, com a cor da coisa (R87 no botão único) ───
  const opcoesStatus: OpcaoDoSeletor[] = statusDaNatureza("interno").map((s) => {
    const i = chamadoStatusInfo(s);
    return { valor: s, rotulo: i.label, cor: { dark: i.color, light: i.colorLight, bg: i.bg, border: i.border } };
  });
  const opcoesTipo: OpcaoDoSeletor[] = tiposDaNatureza("interno").map((t) => ({
    valor: t, rotulo: TIPO_LABEL[t], cor: TIPO_CORES[t] ?? null,
  }));
  const opcoesPrioridade: OpcaoDoSeletor[] = PRIORIDADES.map((p) => ({
    valor: p, rotulo: PRIORIDADE_LABEL[p], cor: PRIORIDADE_CORES[p] ?? null,
  }));
  const opcoesEquipe: OpcaoDoSeletor[] = EQUIPES.map((e) => ({
    valor: e, rotulo: EQUIPE_LABEL[e], cor: equipeCores(e),
  }));
  const opcoesSprint: OpcaoDoSeletor[] = SPRINT_ORDEM.map((s) => ({ valor: s, rotulo: SPRINT_LABEL[s] }));

  const chipPessoa: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 8px 4px 5px", borderRadius: 999,
    background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)",
    fontFamily: "var(--fonte)", fontSize: 12.5, fontWeight: 600, color: textPrimary,
  };

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18, lineHeight: 1.3 }}>
            {chamado.titulo}
          </div>
          <div style={{
            fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11.5,
            color: textSecondary, marginTop: 3,
          }}>
            {chamado.numero} · aberto {tempoRelativo(chamado.created_at)}
            {chamado.origem === "notion" && " · importada do Notion"}
          </div>
        </div>
        <span style={{
          flexShrink: 0, padding: "5px 10px", borderRadius: 999,
          fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9.5,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: isLight ? st.colorLight : st.color,
          background: st.bg, border: `1px solid ${st.border}`,
        }}>
          {st.label}
        </span>
      </div>

      <div className="detalhe-grid">
        {/* ══ COLUNA LARGA — o texto e a conversa ═══════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* Descrição — o editor de blocos (R135): caixa de marcar de verdade,
              ponto de lista, negrito/itálico, menção com "@". Grava sozinho. */}
          <div style={CARD}>
            <span style={SEC}>Descrição</span>
            <EditorDeDescricao
              valor={chamado.descricao_problema ?? ""}
              chaveReset={id}
              pessoas={pessoasMencao}
              somenteLeitura={!podeEditar}
              minAltura={320}
              placeholder="O que precisa ser feito, o que já se sabe… Digite @ para mencionar alguém."
              aoSalvar={(v) => salvar.mutate({ descricao_problema: v || null })}
            />
          </div>

          {/* Pedido de compra (R6/Q6) — o que é, quanto custa, de quem, quem liberou */}
          {ehCompra && compra && (() => {
            const cor = SITUACAO_CORES[compra.situacao];
            const passos = proximasSituacoes(compra.situacao);
            const podeAndar = (p: SituacaoCompra) =>
              !SITUACOES_DE_DECISAO.includes(p) || veFinanceiro;
            const editavel = podeEditar && !["recebido", "recusado"].includes(compra.situacao);
            return (
              <div style={CARD}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ ...SEC, marginBottom: 0 }}>Pedido de compra</span>
                  <span style={{
                    padding: "3px 9px", borderRadius: 999,
                    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9.5,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isLight ? cor.light : cor.dark,
                    background: cor.bg, border: `1px solid ${cor.border}`,
                  }}>
                    {SITUACAO_LABEL[compra.situacao]}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "var(--fonte)", fontSize: 10.5, color: textSecondary }}>
                      Quantidade
                    </span>
                    <input
                      type="number" min="0" step="1" defaultValue={compra.quantidade}
                      disabled={!editavel}
                      onBlur={(e) => {
                        const q = Number(e.target.value);
                        if (q > 0 && q !== compra.quantidade) salvarFichaCompra.mutate({ quantidade: q });
                      }}
                      style={INPUT}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "var(--fonte)", fontSize: 10.5, color: textSecondary }}>
                      Valor estimado (R$)
                    </span>
                    <input
                      type="number" min="0" step="0.01"
                      defaultValue={compra.valor_estimado ?? ""}
                      disabled={!editavel}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== compra.valor_estimado) salvarFichaCompra.mutate({ valor_estimado: v });
                      }}
                      style={INPUT}
                    />
                  </label>
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 10.5, color: textSecondary }}>
                    Fornecedor sugerido
                  </span>
                  <input
                    defaultValue={compra.fornecedor_sugerido ?? ""}
                    placeholder="De quem costumamos comprar isso?"
                    disabled={!editavel}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== compra.fornecedor_sugerido) salvarFichaCompra.mutate({ fornecedor_sugerido: v });
                    }}
                    style={INPUT}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 10.5, color: textSecondary }}>
                    Link do produto
                  </span>
                  <input
                    defaultValue={compra.link_produto ?? ""}
                    placeholder="https://…"
                    disabled={!editavel}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== compra.link_produto) salvarFichaCompra.mutate({ link_produto: v });
                    }}
                    style={INPUT}
                  />
                </label>

                {compra.link_produto && (
                  <a
                    href={compra.link_produto} target="_blank" rel="noopener noreferrer"
                    style={{
                      marginTop: 6, fontFamily: "var(--fonte)", fontSize: 11.5,
                      color: gold, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    Abrir o produto <ExternalLink size={11} />
                  </a>
                )}

                {compra.valor_final != null && (
                  <div style={{ marginTop: 10, fontFamily: "var(--fonte)", fontSize: 12.5, color: textPrimary }}>
                    Valor pago: <strong>{moedaBR(compra.valor_final)}</strong>
                  </div>
                )}

                {compra.situacao === "recusado" && compra.motivo_recusa && (
                  <div style={{
                    marginTop: 10, padding: "9px 11px", borderRadius: 10,
                    background: SITUACAO_CORES.recusado.bg,
                    border: `1px solid ${SITUACAO_CORES.recusado.border}`,
                    fontFamily: "var(--fonte)", fontSize: 12,
                    color: isLight ? SITUACAO_CORES.recusado.light : SITUACAO_CORES.recusado.dark,
                    lineHeight: 1.5,
                  }}>
                    Motivo: {compra.motivo_recusa}
                  </div>
                )}

                {/* Próximo passo. Aprovar e recusar só aparecem para quem responde
                    pelo dinheiro — o banco recusa de qualquer jeito, mas botão que
                    sempre dá erro é armadilha. */}
                {passos.length > 0 && podeEditar && !pedindoRecusa && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {passos.filter(podeAndar).map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          p === "recusado"
                            ? setPedindoRecusa(true)
                            : andarCompra.mutate({ situacao: p })
                        }
                        disabled={andarCompra.isPending}
                        style={chip(false)}
                      >
                        {p === "solicitado" ? "Reabrir" : SITUACAO_LABEL[p]}
                      </button>
                    ))}
                  </div>
                )}

                {pedindoRecusa && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      value={motivoRecusaCompra}
                      onChange={(e) => setMotivoRecusaCompra(e.target.value)}
                      placeholder="Por que a compra não foi autorizada?"
                      rows={2}
                      style={{ ...INPUT, height: "auto", padding: "10px 12px", resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => andarCompra.mutate({
                          situacao: "recusado",
                          motivo: motivoRecusaCompra.trim() || undefined,
                        })}
                        disabled={andarCompra.isPending}
                        style={chip(false)}
                      >
                        Registrar recusa
                      </button>
                      <button
                        onClick={() => { setPedindoRecusa(false); setMotivoRecusaCompra(""); }}
                        style={chip(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Feed — a conversa sobre a atividade. Quem escreveu apaga (R135). */}
          <div style={CARD}>
            <span style={SEC}>Comentários</span>
            {comentarios.length === 0 && (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                Ninguém comentou ainda.
              </span>
            )}
            {comentarios.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10 }}>
                <span style={{ marginTop: 2, flexShrink: 0 }}>
                  {c.user_id ? (
                    <AvatarCirculo id={c.user_id} nome={nomeDe(c.user_id)} pessoa={pessoasPorId[c.user_id]} tamanho={26} />
                  ) : (
                    <span style={{ width: 26, height: 26, borderRadius: "50%", display: "inline-block", background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }} />
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5, color: textPrimary }}>
                      {c.user_id ? nomeDe(c.user_id) : "—"}
                      <span style={{ fontWeight: 400, color: textSecondary }}> · {tempoRelativo(c.created_at)}</span>
                    </span>
                    {c.user_id && c.user_id === userId && (
                      <button
                        onClick={() => { if (confirm("Apagar este comentário?")) apagarComentario.mutate(c.id); }}
                        disabled={apagarComentario.isPending}
                        title="Apagar meu comentário"
                        aria-label="Apagar meu comentário"
                        style={{
                          marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                          color: textSecondary, display: "flex", padding: 2,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <TextoComChecklist
                    texto={c.descricao ?? ""}
                    estilo={{ fontSize: 13, color: textPrimary, lineHeight: 1.55, marginTop: 2 }}
                  />
                </div>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", gap: 8, alignItems: "start" }}>
              <TextareaComMencoes
                valor={comentario}
                aoMudar={setComentario}
                pessoas={pessoasMencao}
                rows={2}
                placeholder="Escrever um comentário… (@ menciona, Enter envia)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && comentario.trim() && !enviarComentario.isPending) {
                    e.preventDefault();
                    enviarComentario.mutate();
                  }
                }}
                estilo={{ ...INPUT, height: "auto", minHeight: 44, padding: "11px 12px", resize: "vertical", lineHeight: 1.5 }}
              />
              <button
                onClick={() => enviarComentario.mutate()}
                disabled={!comentario.trim() || enviarComentario.isPending}
                aria-label="Enviar comentário"
                style={{
                  height: 44, borderRadius: 12, border: "none",
                  background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                  color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: comentario.trim() ? "pointer" : "default", opacity: comentario.trim() ? 1 : 0.5,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Linha do tempo */}
          {timeline.length > 0 && (
            <div style={CARD}>
              <span style={SEC}>Linha do tempo</span>
              {timeline.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: gold, flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12, color: textSecondary, flex: 1 }}>
                    {e.descricao}
                    {e.user_id ? ` — ${pessoasPorId[e.user_id]?.nome ?? ""}` : ""}
                  </span>
                  <span style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 10.5, color: textSecondary, flexShrink: 0 }}>
                    {tempoRelativo(e.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ COLUNA ESTREITA — as propriedades, cada uma num seletor ═══════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={CARD}>
            <span style={SEC}>Propriedades</span>
            <div>
              <label style={LABEL}>Status</label>
              <SeletorDeOpcao
                id="det-status"
                valor={chamado.status ?? null}
                opcoes={opcoesStatus}
                desabilitado={!podeEditar || salvar.isPending}
                aoMudar={(v) => v && salvar.mutate({ status: v as ChamadoStatus })}
              />
              {chamado.concluida_em && (
                <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, marginTop: 6 }}>
                  Concluído {tempoRelativo(chamado.concluida_em)}.
                </div>
              )}
            </div>
            <div>
              <label style={LABEL}>Classificação</label>
              <SeletorDeOpcao
                id="det-tipo"
                valor={chamado.tipo ?? null}
                opcoes={opcoesTipo}
                vazio="— sem tipo —"
                desabilitado={!podeEditar}
                aoMudar={(v) => salvar.mutate({ tipo: v as any })}
              />
            </div>
            <div>
              <label style={LABEL}>Prioridade</label>
              <SeletorDeOpcao
                id="det-prioridade"
                valor={chamado.prioridade ?? null}
                opcoes={opcoesPrioridade}
                vazio="— sem prioridade —"
                desabilitado={!podeEditar}
                aoMudar={(v) => salvar.mutate({ prioridade: v as any })}
              />
            </div>
            <div>
              <label style={LABEL}>Equipe</label>
              <SeletorDeOpcao
                id="det-equipe"
                valor={chamado.equipe ?? null}
                opcoes={opcoesEquipe}
                desabilitado={!podeEditar}
                aoMudar={(v) => v && salvar.mutate({ equipe: v as Equipe })}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={LABEL}>Prazo</label>
                <input
                  style={INPUT}
                  type="date"
                  disabled={!podeEditar}
                  value={prazoParaData(chamado.prazo_limite)}
                  onChange={(e) => salvar.mutate({ prazo_limite: dataParaPrazo(e.target.value) })}
                />
              </div>
              <div>
                <label style={LABEL}>Sprint</label>
                <SeletorDeOpcao
                  id="det-sprint"
                  valor={chamado.sprint ?? null}
                  opcoes={opcoesSprint}
                  vazio="— sem sprint —"
                  desabilitado={!podeEditar}
                  aoMudar={(v) => salvar.mutate({ sprint: (v ?? null) as ChamadoSprint | null })}
                />
              </div>
            </div>
            {chamado.prazo_limite && chamadoEmAberto(chamado.status) && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "var(--fonte)", fontSize: 11,
                color: sp === "estourado" ? (isLight ? "#B1242E" : "#F17881") : textSecondary,
              }}>
                <CalendarClock size={12} /> {textoPrazo(chamado.prazo_limite)}
              </div>
            )}
          </div>

          <div style={CARD}>
            <span style={SEC}>Pessoas</span>
            <div>
              <label style={LABEL}>Responsável</label>
              <CampoComBusca
                id="det-responsavel"
                opcoes={opcoesPessoas}
                valor={chamado.responsavel_id ?? null}
                vazio="— sem responsável —"
                aoMudar={(v) => { if (podeEditar) salvar.mutate({ responsavel_id: v }); }}
                iconeEsquerda={(esc) => esc
                  ? <AvatarCirculo id={esc.valor} nome={esc.rotulo} pessoa={pessoasPorId[esc.valor]} tamanho={18} />
                  : null}
              />
            </div>
            <div>
              <label style={LABEL}>Apoio</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {apoios.map(({ profile_id: pid, origem, congelado_em }) => (
                  <span
                    key={pid}
                    // U81: borda mais forte quando a linha é REGISTRO (alguém
                    // carimbou "feito" no bloco daquela semana). Em chamado
                    // interno ela nunca aparece hoje — fica porque o campo é o
                    // mesmo componente conceitual do painel.
                    title={especieDoApoio({ origem, congelado_em }) === "registro"
                      ? "Esteve num atendimento que já aconteceu — o sistema não troca mais este nome sozinho."
                      : undefined}
                    style={{
                      ...chipPessoa,
                      border: especieDoApoio({ origem, congelado_em }) === "registro"
                        ? (isLight ? "1px solid rgba(0,0,0,0.28)" : "1px solid rgba(255,255,255,0.32)")
                        : "1px solid transparent",
                    }}
                  >
                    <AvatarCirculo id={pid} nome={nomeDe(pid)} pessoa={pessoasPorId[pid]} tamanho={18} />
                    {nomeDe(pid)}
                    {(podeEditar || pid === userId) && (
                      <button
                        onClick={() => mudarApoio.mutate({ profileId: pid, entrar: false })}
                        aria-label={`Remover ${nomeDe(pid)} do apoio`}
                        title="Remover apoio"
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 2, display: "flex" }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                ))}
                {podeEditar && (
                  <div style={{ minWidth: 160, flex: 1 }}>
                    <CampoComBusca
                      id="det-apoio"
                      compacto
                      limpavel={false}
                      placeholder="+ adicionar apoio"
                      opcoes={opcoesPessoas.filter(
                        (o) => o.valor !== chamado.responsavel_id
                          && !apoios.some((a) => a.profile_id === o.valor),
                      )}
                      valor={null}
                      aoMudar={(v) => { if (v) mudarApoio.mutate({ profileId: v, entrar: true }); }}
                    />
                  </div>
                )}
                {apoios.length === 0 && !podeEditar && (
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>ninguém ainda</span>
                )}
              </div>
            </div>
            <span style={{
              alignSelf: "flex-start", padding: "3px 8px", borderRadius: 999,
              fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9.5,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: isLight ? eqc.light : eqc.dark, background: eqc.bg, border: `1px solid ${eqc.border}`,
            }}>
              {EQUIPE_LABEL[chamado.equipe] ?? chamado.equipe}
            </span>
          </div>

          {chamado.cliente && (
            <div style={CARD}>
              <span style={SEC}>Cliente</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                <Building2 size={14} color={gold} /> {chamado.cliente.nome}
              </div>
            </div>
          )}

          {/* Equipamentos envolvidos — a lacuna do Notion */}
          <div style={CARD}>
            <span style={SEC}>Equipamentos envolvidos</span>
            {equipamentos.length === 0 && (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                Nenhum equipamento vinculado.
              </span>
            )}
            {equipamentos.map((eq) => (
              <div
                key={eq.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 12,
                  background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                  border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Wrench size={14} color={gold} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                    {eq.descricao ?? "Equipamento"}
                  </div>
                  {eq.numero_serie && (
                    <div style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                      Série {eq.numero_serie}
                    </div>
                  )}
                </div>
                {podeEditar && (
                  <button
                    onClick={() => mexerEquip.mutate({ tipo: "del", equipId: eq.id })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex" }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {podeEditar && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 44px", gap: 8 }}>
                <input
                  style={INPUT}
                  value={novoEquip}
                  onChange={(e) => setNovoEquip(e.target.value)}
                  placeholder="Equipamento"
                />
                <input
                  style={INPUT}
                  value={novaSerie}
                  onChange={(e) => setNovaSerie(e.target.value)}
                  placeholder="Nº série"
                />
                <button
                  onClick={() => mexerEquip.mutate({ tipo: "add" })}
                  disabled={!novoEquip.trim()}
                  style={{
                    height: 44, borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                    color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: novoEquip.trim() ? "pointer" : "default", opacity: novoEquip.trim() ? 1 : 0.5,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>

          {isGerente && (
            <button
              onClick={() => {
                if (confirm(`Excluir o chamado ${chamado.numero}? Não tem desfazer.`)) excluir.mutate();
              }}
              style={{
                height: 46, borderRadius: 23,
                background: "none",
                border: isLight ? "1px solid rgba(177,36,46,0.30)" : "1px solid rgba(241,120,129,0.30)",
                color: isLight ? "#B1242E" : "#F17881",
                fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Excluir chamado
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
