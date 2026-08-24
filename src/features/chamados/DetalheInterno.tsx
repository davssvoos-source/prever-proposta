// Chamado INTERNO — o corpo da tela quando natureza = 'interno'.
// Edição, feed de comentários, apoio e equipamentos envolvidos: é o que era o
// quadro do Notion. Extraído de /demandas/$id na Etapa U7 — quem monta a
// página é /chamados/$id. Ver docs/PLANO_UNIFICACAO.md §5.1.

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CalendarClock, ExternalLink, MessageSquare, Plus, Send, Trash2,
  UserPlus, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { card } from "@/lib/ui";
import { TextoComChecklist } from "@/components/TextoComChecklist";
import { useIsGerente, useVeFinanceiro } from "@/features/gerencial/data";
import {
  useChamado, useChamadoEventos, useChamadoApoios, useChamadoEquipamentos,
  usePessoas, mapaDePessoas, atualizarChamado, comentarChamado, excluirChamado,
  adicionarApoio, removerApoio, adicionarEquipamentoChamado, removerEquipamentoChamado,
  type ChamadoPatch,
} from "@/features/chamados/data";
import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo,
  SPRINT_ORDEM, SPRINT_LABEL, prazoParaData, dataParaPrazo,
  statusDaNatureza, tiposDaNatureza, TIPO_LABEL,
  type ChamadoSprint, type ChamadoStatus, type ChamadoTipo,
} from "@/lib/chamado-status";
import { EQUIPES, EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import {
  useCompra, salvarCompra, decidirCompra, proximasSituacoes,
  SITUACAO_LABEL, SITUACAO_CORES, SITUACOES_DE_DECISAO, moedaBR,
  type SituacaoCompra,
} from "@/features/chamados/compra";
import { tempoRelativo } from "@/hooks/useNotificacoes";

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
  const [addApoio, setAddApoio] = useState(false);
  const [motivoRecusaCompra, setMotivoRecusaCompra] = useState("");
  const [pedindoRecusa, setPedindoRecusa] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

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

  const mudarApoio = useMutation({
    mutationFn: async ({ profileId, entrar }: { profileId: string; entrar: boolean }) =>
      entrar ? adicionarApoio(id, profileId) : removerApoio(id, profileId),
    onSuccess: () => {
      setAddApoio(false);
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
      toast.success("Chamado excluída.");
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
        Chamado não encontrada.
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
    apoios.includes(userId ?? "");

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "8px 12px", borderRadius: 10,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
    background: ativo
      ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5,
    cursor: podeEditar ? "pointer" : "default", opacity: podeEditar ? 1 : 0.6,
  });

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

      {/* Status */}
      <div style={CARD}>
        <span style={SEC}>Status</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {statusDaNatureza("interno").map((s) => (
            <button
              key={s}
              type="button"
              disabled={!podeEditar || salvar.isPending}
              style={chip(chamado.status === s)}
              onClick={() => salvar.mutate({ status: s as ChamadoStatus })}
            >
              {chamadoStatusInfo(s).label}
            </button>
          ))}
        </div>
        {chamado.concluida_em && (
          <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary }}>
            Concluído {tempoRelativo(chamado.concluida_em)}.
          </div>
        )}
      </div>

      {/* Atribuição */}
      <div style={CARD}>
        <span style={SEC}>Atribuição</span>
        <div>
          <label style={LABEL}>Responsável</label>
          <select
            style={INPUT}
            disabled={!podeEditar}
            value={chamado.responsavel_id ?? ""}
            onChange={(e) => salvar.mutate({ responsavel_id: e.target.value || null })}
          >
            <option value="">Sem responsável</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={LABEL}>Apoio</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {apoios.length === 0 && !addApoio && (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                ninguém ainda
              </span>
            )}
            {apoios.map((pid) => (
              <span
                key={pid}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 999,
                  background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.05)",
                  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
                  fontFamily: "var(--fonte)", fontSize: 12, color: textPrimary,
                }}
              >
                {pessoasPorId[pid]?.nome ?? "—"}
                {(podeEditar || pid === userId) && (
                  <button
                    onClick={() => mudarApoio.mutate({ profileId: pid, entrar: false })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 0, display: "flex" }}
                    title="Remover apoio"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
            ))}
            {addApoio ? (
              <select
                style={{ ...INPUT, width: "auto", minWidth: 180 }}
                autoFocus
                defaultValue=""
                onChange={(e) => e.target.value && mudarApoio.mutate({ profileId: e.target.value, entrar: true })}
              >
                <option value="">Escolher pessoa…</option>
                {pessoas
                  .filter((p) => !apoios.includes(p.id) && p.id !== chamado.responsavel_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
              </select>
            ) : (
              <button
                onClick={() => setAddApoio(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 10px", borderRadius: 999, cursor: "pointer",
                  background: "none",
                  border: isLight ? "1px dashed rgba(0,0,0,0.20)" : "1px dashed rgba(255,255,255,0.20)",
                  color: gold, fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600,
                }}
              >
                <UserPlus size={13} /> Adicionar
              </button>
            )}
          </div>
        </div>

        <div>
          <label style={LABEL}>Equipe</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EQUIPES.map((e) => (
              <button
                key={e}
                type="button"
                disabled={!podeEditar}
                style={chip(chamado.equipe === e)}
                onClick={() => salvar.mutate({ equipe: e as Equipe })}
              >
                {EQUIPE_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Planejamento */}
      <div style={CARD}>
        <span style={SEC}>Planejamento</span>
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
            {chamado.prazo_limite && chamadoEmAberto(chamado.status) && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 6,
                fontFamily: "var(--fonte)", fontSize: 11,
                color: sp === "atrasada" ? (isLight ? "#B1242E" : "#F17881") : textSecondary,
              }}>
                <CalendarClock size={12} /> {textoPrazo(chamado.prazo_limite)}
              </div>
            )}
          </div>
          <div>
            <label style={LABEL}>Sprint</label>
            <select
              style={INPUT}
              disabled={!podeEditar}
              value={chamado.sprint}
              onChange={(e) => salvar.mutate({ sprint: e.target.value as ChamadoSprint })}
            >
              {SPRINT_ORDEM.map((s) => (
                <option key={s} value={s}>{SPRINT_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label style={LABEL}>Classificação</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tiposDaNatureza("interno").map((t) => (
              <button
                key={t}
                type="button"
                disabled={!podeEditar}
                style={chip(chamado.tipo === t)}
                onClick={() => salvar.mutate({ tipo: t as ChamadoTipo })}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        {chamado.cliente && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: "var(--fonte)", fontSize: 12.5, color: textSecondary,
          }}>
            <Building2 size={14} color={gold} /> {chamado.cliente.nome}
          </div>
        )}
        <span style={{
          alignSelf: "flex-start", padding: "3px 8px", borderRadius: 999,
          fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9.5,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: isLight ? eqc.light : eqc.dark, background: eqc.bg, border: `1px solid ${eqc.border}`,
        }}>
          {EQUIPE_LABEL[chamado.equipe] ?? chamado.equipe}
        </span>
      </div>

      {/* Descrição — itens de checklist (`- [ ] item`, escritos pela barra de
          ferramentas do painel de propriedades) viram caixa de marcar de
          verdade aqui; o resto do texto continua em pre-wrap normal. */}
      {chamado.descricao_problema && (
        <div style={CARD}>
          <span style={SEC}>Descrição</span>
          <TextoComChecklist
            texto={chamado.descricao_problema}
            estilo={{ color: textPrimary }}
            aoMudar={podeEditar
              ? (v) => salvar.mutate({ descricao_problema: v })
              : undefined}
          />
        </div>
      )}

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
              <div style={{
                marginTop: 10, fontFamily: "var(--fonte)", fontSize: 12.5, color: textPrimary,
              }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 44px", gap: 8 }}>
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

      {/* Feed */}
      <div style={CARD}>
        <span style={SEC}>Comentários</span>
        {comentarios.length === 0 && (
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            Ninguém comentou ainda.
          </span>
        )}
        {comentarios.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 10 }}>
            <MessageSquare size={15} color={gold} style={{ marginTop: 3, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5, color: textPrimary,
              }}>
                {c.user_id ? pessoasPorId[c.user_id]?.nome ?? "—" : "—"}
                <span style={{ fontWeight: 400, color: textSecondary }}> · {tempoRelativo(c.created_at)}</span>
              </div>
              <div style={{
                fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                color: textPrimary, lineHeight: 1.55, whiteSpace: "pre-wrap", marginTop: 2,
              }}>
                {c.descricao}
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", gap: 8 }}>
          <input
            style={INPUT}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && comentario.trim()) enviarComentario.mutate();
            }}
            placeholder="Escrever um comentário…"
          />
          <button
            onClick={() => enviarComentario.mutate()}
            disabled={!comentario.trim() || enviarComentario.isPending}
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
              <span style={{
                width: 6, height: 6, borderRadius: 3, background: gold, flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12,
                color: textSecondary, flex: 1,
              }}>
                {e.descricao}
                {e.user_id ? ` — ${pessoasPorId[e.user_id]?.nome ?? ""}` : ""}
              </span>
              <span style={{
                fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 10.5,
                color: textSecondary, flexShrink: 0,
              }}>
                {tempoRelativo(e.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {isGerente && (
        <button
          onClick={() => {
            if (confirm(`Excluir a chamado ${chamado.numero}? Não tem desfazer.`)) excluir.mutate();
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
  );
}
