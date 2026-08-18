// Detalhe da demanda — edição, feed de comentários, apoio e equipamentos.
// Etapa U1 da unificação. Ver docs/PLANO_UNIFICACAO.md §5.1.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CalendarClock, MessageSquare, Plus, Send, Trash2, UserPlus, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente } from "@/features/gerencial/data";
import {
  useDemanda, useDemandaEventos, useDemandaApoios, useDemandaEquipamentos,
  usePessoas, mapaDePessoas, atualizarDemanda, comentarDemanda, excluirDemanda,
  adicionarApoio, removerApoio, adicionarEquipamentoDemanda, removerEquipamentoDemanda,
  type DemandaPatch,
} from "@/features/demandas/data";
import {
  demandaStatusInfo, demandaEmAberto, situacaoPrazoDemanda, textoPrazoDemanda,
  DEMANDA_STATUS_ORDEM, SPRINT_ORDEM, SPRINT_LABEL,
  TIPOS_DEMANDA, TIPO_DEMANDA_LABEL,
  type DemandaSprint, type DemandaStatus, type DemandaTipo,
} from "@/lib/demanda-status";
import { EQUIPES, EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import { tempoRelativo } from "@/hooks/useNotificacoes";

export const Route = createFileRoute("/_authenticated/demandas/$id")({
  component: DemandaDetalhePage,
});

function DemandaDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: demanda, isLoading } = useDemanda(id);
  const { data: eventos = [] } = useDemandaEventos(id);
  const { data: apoios = [] } = useDemandaApoios(id);
  const { data: equipamentos = [] } = useDemandaEquipamentos(id);
  const { data: pessoas = [] } = usePessoas();

  const [comentario, setComentario] = useState("");
  const [novoEquip, setNovoEquip] = useState("");
  const [novaSerie, setNovaSerie] = useState("");
  const [addApoio, setAddApoio] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18, padding: "16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 12px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };

  const salvar = useMutation({
    mutationFn: async (patch: DemandaPatch) => atualizarDemanda(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demanda", id] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demanda-eventos", id] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Não foi possível salvar. Confira se você é responsável ou gestor."),
  });

  const enviarComentario = useMutation({
    mutationFn: async () => {
      const t = comentario.trim();
      if (!t) throw new Error("Escreva alguma coisa antes de enviar.");
      await comentarDemanda(id, t);
    },
    onSuccess: () => {
      setComentario("");
      qc.invalidateQueries({ queryKey: ["demanda-eventos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarApoio = useMutation({
    mutationFn: async ({ profileId, entrar }: { profileId: string; entrar: boolean }) =>
      entrar ? adicionarApoio(id, profileId) : removerApoio(id, profileId),
    onSuccess: () => {
      setAddApoio(false);
      qc.invalidateQueries({ queryKey: ["demanda-apoios", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar o apoio."),
  });

  const mexerEquip = useMutation({
    mutationFn: async (acao: { tipo: "add" } | { tipo: "del"; equipId: string }) => {
      if (acao.tipo === "del") return removerEquipamentoDemanda(acao.equipId);
      if (!novoEquip.trim()) throw new Error("Descreva o equipamento.");
      await adicionarEquipamentoDemanda(id, {
        descricao: novoEquip.trim(),
        numero_serie: novaSerie.trim() || null,
      });
    },
    onSuccess: () => {
      setNovoEquip("");
      setNovaSerie("");
      qc.invalidateQueries({ queryKey: ["demanda-equipamentos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => excluirDemanda(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Demanda excluída.");
      navigate({ to: "/demandas" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir."),
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "'Montserrat', sans-serif" }}>
        Carregando…
      </div>
    );
  }
  if (!demanda) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "'Montserrat', sans-serif" }}>
        Demanda não encontrada.
      </div>
    );
  }

  const st = demandaStatusInfo(demanda.status);
  const eqc = equipeCores(demanda.equipe);
  const sp = situacaoPrazoDemanda(demanda.prazo, demanda.status);
  const comentarios = eventos.filter((e) => e.tipo === "comentario");
  const timeline = eventos.filter((e) => e.tipo !== "comentario");
  const podeEditar =
    isGerente ||
    demanda.responsavel_id === userId ||
    demanda.criada_por === userId ||
    !demanda.responsavel_id ||
    apoios.includes(userId ?? "");

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "8px 12px", borderRadius: 10,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
    background: ativo
      ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11.5,
    cursor: podeEditar ? "pointer" : "default", opacity: podeEditar ? 1 : 0.6,
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/demandas" })}
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
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 18, lineHeight: 1.3 }}>
            {demanda.titulo}
          </div>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11.5,
            color: textSecondary, marginTop: 3,
          }}>
            {demanda.numero} · aberta {tempoRelativo(demanda.created_at)}
            {demanda.origem === "notion" && " · importada do Notion"}
          </div>
        </div>
        <span style={{
          flexShrink: 0, padding: "5px 10px", borderRadius: 999,
          fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9.5,
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
          {DEMANDA_STATUS_ORDEM.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!podeEditar || salvar.isPending}
              style={chip(demanda.status === s)}
              onClick={() => salvar.mutate({ status: s as DemandaStatus })}
            >
              {demandaStatusInfo(s).label}
            </button>
          ))}
        </div>
        {demanda.concluida_em && (
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: textSecondary }}>
            Concluída {tempoRelativo(demanda.concluida_em)}.
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
            value={demanda.responsavel_id ?? ""}
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
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
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
                  fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textPrimary,
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
                  .filter((p) => !apoios.includes(p.id) && p.id !== demanda.responsavel_id)
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
                  color: gold, fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600,
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
                style={chip(demanda.equipe === e)}
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
              value={demanda.prazo ?? ""}
              onChange={(e) => salvar.mutate({ prazo: e.target.value || null })}
            />
            {demanda.prazo && demandaEmAberto(demanda.status) && (
              <div style={{
                display: "flex", alignItems: "center", gap: 5, marginTop: 6,
                fontFamily: "'Montserrat', sans-serif", fontSize: 11,
                color: sp === "atrasada" ? (isLight ? "#b91c1c" : "#F87171") : textSecondary,
              }}>
                <CalendarClock size={12} /> {textoPrazoDemanda(demanda.prazo)}
              </div>
            )}
          </div>
          <div>
            <label style={LABEL}>Sprint</label>
            <select
              style={INPUT}
              disabled={!podeEditar}
              value={demanda.sprint}
              onChange={(e) => salvar.mutate({ sprint: e.target.value as DemandaSprint })}
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
            {TIPOS_DEMANDA.map((t) => (
              <button
                key={t}
                type="button"
                disabled={!podeEditar}
                style={chip(demanda.tipo === t)}
                onClick={() => salvar.mutate({ tipo: t as DemandaTipo })}
              >
                {TIPO_DEMANDA_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        {demanda.cliente && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, color: textSecondary,
          }}>
            <Building2 size={14} color={gold} /> {demanda.cliente.nome}
          </div>
        )}
        <span style={{
          alignSelf: "flex-start", padding: "3px 8px", borderRadius: 999,
          fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9.5,
          letterSpacing: "0.06em", textTransform: "uppercase",
          color: isLight ? eqc.light : eqc.dark, background: eqc.bg, border: `1px solid ${eqc.border}`,
        }}>
          {EQUIPE_LABEL[demanda.equipe] ?? demanda.equipe}
        </span>
      </div>

      {/* Descrição */}
      {demanda.descricao && (
        <div style={CARD}>
          <span style={SEC}>Descrição</span>
          <div style={{
            fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13.5,
            color: textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap",
          }}>
            {demanda.descricao}
          </div>
        </div>
      )}

      {/* Equipamentos envolvidos — a lacuna do Notion */}
      <div style={CARD}>
        <span style={SEC}>Equipamentos envolvidos</span>
        {equipamentos.length === 0 && (
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
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
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textPrimary }}>
                {eq.descricao ?? "Equipamento"}
              </div>
              {eq.numero_serie && (
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
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
                background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
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
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            Ninguém comentou ainda.
          </span>
        )}
        {comentarios.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 10 }}>
            <MessageSquare size={15} color={gold} style={{ marginTop: 3, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11.5, color: textPrimary,
              }}>
                {c.user_id ? pessoasPorId[c.user_id]?.nome ?? "—" : "—"}
                <span style={{ fontWeight: 300, color: textSecondary }}> · {tempoRelativo(c.created_at)}</span>
              </div>
              <div style={{
                fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13,
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
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
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
                fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12,
                color: textSecondary, flex: 1,
              }}>
                {e.descricao}
                {e.user_id ? ` — ${pessoasPorId[e.user_id]?.nome ?? ""}` : ""}
              </span>
              <span style={{
                fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 10.5,
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
            if (confirm(`Excluir a demanda ${demanda.numero}? Não tem desfazer.`)) excluir.mutate();
          }}
          style={{
            height: 46, borderRadius: 23,
            background: "none",
            border: isLight ? "1px solid rgba(185,28,28,0.30)" : "1px solid rgba(248,113,113,0.30)",
            color: isLight ? "#b91c1c" : "#F87171",
            fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Excluir demanda
        </button>
      )}
    </div>
  );
}
