// Nova demanda interna — Etapa U1 da unificação.
// A classificação (tipo) é sugerida pelo título enquanto se digita; quem grava
// de verdade é o banco, no trigger. Ver docs/PLANO_UNIFICACAO.md §6, automação 1.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useClientes } from "@/features/clientes/data";
import { criarDemanda, usePessoas } from "@/features/demandas/data";
import {
  sugerirTipoDemanda, SPRINT_ORDEM, SPRINT_LABEL, TIPOS_DEMANDA, TIPO_DEMANDA_LABEL,
  type DemandaSprint, type DemandaTipo,
} from "@/lib/demanda-status";
import { EQUIPES, EQUIPE_LABEL, type Equipe } from "@/lib/equipes";

export const Route = createFileRoute("/_authenticated/demandas/nova")({
  component: NovaDemandaPage,
});

function NovaDemandaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: clientes = [] } = useClientes();
  const { data: pessoas = [] } = usePessoas();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [equipe, setEquipe] = useState<Equipe>("ti");
  const [responsavelId, setResponsavelId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [sprint, setSprint] = useState<DemandaSprint>("este_mes");
  const [tipo, setTipo] = useState<DemandaTipo | "">("");

  // pré-carrega equipe e responsável com quem está registrando
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const eu = pessoas.find((p) => p.id === data.user?.id);
      if (eu) {
        setResponsavelId((v) => v || eu.id);
        if (eu.equipe) setEquipe((v) => (v === "ti" ? (eu.equipe as Equipe) : v));
      }
    });
  }, [pessoas]);

  const sugestao = useMemo(
    () => (titulo.trim() ? sugerirTipoDemanda(titulo, descricao) : null),
    [titulo, descricao],
  );
  const tipoEfetivo = tipo || sugestao;

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18, padding: "18px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const TEXTAREA: CSSProperties = { ...INPUT, height: 110, padding: "12px 14px", resize: "vertical" };

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "9px 14px", borderRadius: 12,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
    background: ativo
      ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
    cursor: "pointer",
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título da demanda.");
      return criarDemanda({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        equipe,
        responsavel_id: responsavelId || null,
        cliente_id: clienteId || null,
        prazo: prazo || null,
        sprint,
        // vazio = deixa o banco sugerir (mesma heurística da pré-visualização)
        tipo: (tipo || null) as DemandaTipo | null,
      });
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Demanda registrada.");
      navigate({ to: "/demandas/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 20 }}>
          Nova demanda
        </div>
      </div>

      <div style={CARD}>
        <div>
          <label style={LABEL}>Título</label>
          <input
            style={INPUT}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Revisar cadastro de moradores do Bloco C"
            autoFocus
          />
        </div>
        <div>
          <label style={LABEL}>Descrição</label>
          <textarea
            style={TEXTAREA}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Contexto, o que precisa ser feito, links…"
          />
        </div>

        {/* Classificação sugerida */}
        <div>
          <label style={LABEL}>Classificação</label>
          {sugestao && !tipo && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
              fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: gold,
            }}>
              <Sparkles size={13} />
              Sugestão pelo título: <strong>{TIPO_DEMANDA_LABEL[sugestao]}</strong> — toque para trocar.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIPOS_DEMANDA.map((t) => (
              <button
                key={t}
                type="button"
                style={chip(tipoEfetivo === t)}
                onClick={() => setTipo(tipo === t ? "" : t)}
              >
                {TIPO_DEMANDA_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={CARD}>
        <div>
          <label style={LABEL}>Equipe</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EQUIPES.map((e) => (
              <button key={e} type="button" style={chip(equipe === e)} onClick={() => setEquipe(e)}>
                {EQUIPE_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LABEL}>Responsável</label>
          <select style={INPUT} value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Sem responsável (alguém assume depois)</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={LABEL}>Cliente (opcional)</label>
          <select style={INPUT} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Demanda interna, sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Prazo</label>
            <input style={INPUT} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Sprint</label>
            <select
              style={INPUT}
              value={sprint}
              onChange={(e) => setSprint(e.target.value as DemandaSprint)}
            >
              {SPRINT_ORDEM.map((s) => (
                <option key={s} value={s}>{SPRINT_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => criar.mutate()}
        disabled={criar.isPending || !titulo.trim()}
        style={{
          height: 52, borderRadius: 26, border: "none",
          background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
          color: "#08090E",
          fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
          letterSpacing: "0.14em", textTransform: "uppercase",
          cursor: criar.isPending || !titulo.trim() ? "default" : "pointer",
          opacity: criar.isPending || !titulo.trim() ? 0.6 : 1,
          boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
        }}
      >
        {criar.isPending ? "Registrando…" : "Registrar demanda"}
      </button>
    </div>
  );
}
