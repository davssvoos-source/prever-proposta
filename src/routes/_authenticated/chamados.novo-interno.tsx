// Nova atividade INTERNA — o formulário em página inteira do trabalho que não
// sai da mesa. A classificação (tipo) é sugerida pelo título enquanto se
// digita; quem grava de verdade é o banco, no trigger.
//
// U96 (R137–R142): o pop-up da Início (NovaAtividadeDialog) passou a ser o
// caminho principal; esta página é a versão longa que a triagem /chamados/novo
// ainda abre. Ela perdeu o que a estrutura das atividades tirou do sistema —
// Equipe (R139: é a do responsável), Sprint (R141: é cálculo) e o pedido de
// compra (R140) — e ganhou o impacto operacional (R142), só em corretiva e
// operacional.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useClientes } from "@/features/clientes/data";
import { abrirChamado, usePessoas, equipeDaPessoa } from "@/features/chamados/data";
import {
  sugerirTipoChamado, tiposDaNatureza, TIPO_LABEL, dataParaPrazo,
  IMPACTO_ORDEM, IMPACTO_LABEL, temImpacto,
  type ChamadoTipo, type ImpactoOperacional,
} from "@/lib/chamado-status";
import { EQUIPE_LABEL } from "@/lib/equipes";
import { card } from "@/lib/ui";

export const Route = createFileRoute("/_authenticated/chamados/novo-interno")({
  // a triagem (/chamados/novo) chega aqui com o trilho já escolhido:
  // ?equipe=ti | ?equipe=patrimonio&tipo=operacional. A `equipe` da URL só
  // serve de rótulo — a equipe gravada é a do responsável (R139).
  validateSearch: (s: Record<string, unknown>) => ({
    equipe: typeof s.equipe === "string" ? s.equipe : undefined,
    tipo: typeof s.tipo === "string" ? s.tipo : undefined,
  }),
  component: NovaChamadoPage,
});

function NovaChamadoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const busca = Route.useSearch();
  const { data: clientes = [] } = useClientes();
  const { data: pessoas = [] } = usePessoas();

  const tipoInicial = (tiposDaNatureza("interno") as string[]).includes(busca.tipo ?? "")
    ? (busca.tipo as ChamadoTipo)
    : "";

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prazo_limite, setPrazo] = useState("");
  const [impacto, setImpacto] = useState<ImpactoOperacional | "">("");
  const [tipo, setTipo] = useState<ChamadoTipo | "">(tipoInicial);

  // pré-carrega o responsável com quem está registrando
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const eu = pessoas.find((p) => p.id === data.user?.id);
      if (eu) setResponsavelId((v) => v || eu.id);
    });
  }, [pessoas]);

  const sugestao = useMemo(
    () => (titulo.trim() ? sugerirTipoChamado(titulo, descricao) : null),
    [titulo, descricao],
  );

  // sem tipo escolhido, vale a sugestão — é o que o banco vai gravar
  const tipoEfetivo = tipo || sugestao;
  const equipeDoResponsavel = equipeDaPessoa(pessoas, responsavelId || null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = {
    ...card(isLight),
    padding: "18px 16px",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const TEXTAREA: CSSProperties = { ...INPUT, height: 110, padding: "12px 14px", resize: "vertical" };

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "9px 14px", borderRadius: 12,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
    background: ativo
      ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12,
    cursor: "pointer",
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título da atividade.");
      return abrirChamado({
        natureza: "interno",
        titulo: titulo.trim(),
        descricao_problema: descricao.trim() || null,
        // R139: a coluna recebe a equipe do responsável; ninguém escolhe
        equipe: equipeDoResponsavel ?? "outras",
        responsavel_id: responsavelId || null,
        cliente_id: clienteId || null,
        prazo_limite: dataParaPrazo(prazo_limite),
        // vazio = deixa o banco sugerir (mesma heurística da pré-visualização)
        tipo: (tipo || null) as ChamadoTipo | null,
        impacto_operacional: temImpacto(tipoEfetivo) && impacto ? impacto : null,
      });
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      toast.success("Atividade registrada.");
      navigate({ to: "/chamados/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 20 }}>
          Nova atividade
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
          <label style={LABEL}>Tipo de demanda</label>
          {sugestao && !tipo && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
              fontFamily: "var(--fonte)", fontSize: 11.5, color: gold,
            }}>
              <Sparkles size={13} />
              Sugestão pelo título: <strong>{TIPO_LABEL[sugestao]}</strong> — toque para trocar.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tiposDaNatureza("interno").map((t) => (
              <button
                key={t}
                type="button"
                style={chip(tipoEfetivo === t)}
                onClick={() => setTipo(tipo === t ? "" : t)}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* R142: impacto só em corretiva e operacional */}
        {temImpacto(tipoEfetivo) && (
          <div>
            <label style={LABEL}>Impacto operacional</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {IMPACTO_ORDEM.map((i) => (
                <button key={i} type="button" style={chip(impacto === i)} onClick={() => setImpacto(impacto === i ? "" : i)}>
                  {IMPACTO_LABEL[i]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={CARD}>
        <div>
          <label style={LABEL}>Responsável</label>
          <select style={INPUT} value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Sem responsável (alguém assume depois)</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          {/* R139: a equipe é a do responsável — mostrada, não escolhida */}
          <span style={{ display: "block", marginTop: 6, fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
            Equipe: {equipeDoResponsavel ? EQUIPE_LABEL[equipeDoResponsavel] : "a do responsável, pelo cadastro"}
            {busca.equipe && !equipeDoResponsavel ? ` (trilho: ${EQUIPE_LABEL[busca.equipe as keyof typeof EQUIPE_LABEL] ?? busca.equipe})` : ""}
          </span>
        </div>
        <div>
          <label style={LABEL}>Cliente (opcional)</label>
          <select style={INPUT} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Interno — Prever, sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={LABEL}>Prazo (opcional)</label>
          <input style={INPUT} type="date" value={prazo_limite} onChange={(e) => setPrazo(e.target.value)} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => criar.mutate()}
        disabled={criar.isPending || !titulo.trim()}
        style={{
          height: 52, borderRadius: 26, border: "none",
          background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
          color: "#08090E",
          fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 13,
          letterSpacing: "0.14em", textTransform: "uppercase",
          cursor: criar.isPending || !titulo.trim() ? "default" : "pointer",
          opacity: criar.isPending || !titulo.trim() ? 0.6 : 1,
          boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
        }}
      >
        {criar.isPending ? "Registrando…" : "Registrar atividade"}
      </button>
    </div>
  );
}
