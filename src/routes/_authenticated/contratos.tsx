// Contratos do cliente — lista. Etapa U2 da unificação.
// Rotas filhas (/contratos/novo, /contratos/$id) entram pelo Outlet.
// Ver docs/PLANO_UNIFICACAO.md §4.1.

import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { createFileRoute, useNavigate, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { FileText, Plus, Search, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, GOLD_GLOW, card } from "@/lib/ui";
import { normalizarTexto, formatarDocumento } from "@/lib/normalizar";
import {
  useContratos, diasParaVencer,
  MODALIDADE_LABEL, STATUS_CONTRATO_LABEL, STATUS_CONTRATO_CORES,
  type StatusContrato,
} from "@/features/contratos/data";

export const Route = createFileRoute("/_authenticated/contratos")({
  // Contrato é dado financeiro: a RLS já barra, mas mandar o técnico para uma
  // tela permanentemente vazia seria pior do que não mostrar a tela.
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("contratos");
    if (!ok) throw redirect({ to: destinoNegado("contratos") as any });
  },
  component: ContratosPage,
});

function ContratosPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: contratos = [], isLoading } = useContratos();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusContrato | "todos">("ativo");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const CARD: CSSProperties = { ...card(isLight), padding: "14px 16px" };

  const vencendo = useMemo(
    () =>
      contratos.filter((c) => {
        if (c.status !== "ativo") return false;
        const d = diasParaVencer(c);
        return d !== null && d <= 60;
      }),
    [contratos],
  );

  const lista = useMemo(() => {
    const termo = normalizarTexto(busca);
    return contratos.filter((c) => {
      if (filtro !== "todos" && c.status !== filtro) return false;
      if (!termo) return true;
      return normalizarTexto(
        `${c.cliente?.nome ?? ""} ${c.numero ?? ""} ${c.titulo ?? ""}`,
      ).includes(termo);
    });
  }, [contratos, filtro, busca]);

  if (pathname !== "/contratos") return <Outlet />;

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "8px 14px", borderRadius: 999,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo ? GOLD_GRAD : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Contratos</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {contratos.filter((c) => c.status === "ativo").length} ativo(s)
            {vencendo.length > 0 && ` · ${vencendo.length} vencendo em 60 dias`}
          </div>
        </div>
        <button
          onClick={() => navigate({ to: "/contratos/novo" })}
          style={{
            height: 42, padding: "0 16px", borderRadius: 12, border: "none",
            background: GOLD_GRAD, color: "#08090E", display: "flex", alignItems: "center", gap: 6,
            fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer", boxShadow: GOLD_GLOW,
          }}
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={16} color={textSecondary} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou número"
          style={{
            width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, padding: "0 14px 0 38px",
            background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
            border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, fontFamily: FONT, fontWeight: 400, fontSize: 14,
            outline: "none", colorScheme: isLight ? "light" : "dark",
          }}
        />
      </div>

      <div className="trilho-x" style={{ display: "flex", gap: 8, paddingBottom: 2 }}>
        {(["ativo", "rascunho", "encerrado", "todos"] as const).map((f) => (
          <button key={f} style={chip(filtro === f)} onClick={() => setFiltro(f)}>
            {f === "todos"
              ? `Todos (${contratos.length})`
              : `${STATUS_CONTRATO_LABEL[f]} (${contratos.filter((c) => c.status === f).length})`}
          </button>
        ))}
      </div>

      {vencendo.length > 0 && filtro !== "todos" && (
        <div style={{ ...CARD, display: "flex", gap: 10, alignItems: "center",
          borderColor: isLight ? "rgba(160,97,8,0.30)" : "rgba(248,200,17,0.28)" }}>
          <TriangleAlert size={18} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 12.5 }}>
            {vencendo.length} contrato(s) vencem nos próximos 60 dias.
          </span>
        </div>
      )}

      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Carregando contratos…
        </div>
      ) : lista.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <FileText size={28} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
            {contratos.length === 0 ? "Nenhum contrato cadastrado" : "Nada neste filtro"}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
            {contratos.length === 0
              ? "Cadastre o primeiro contrato ou envie o PDF para a leitura automática."
              : "Troque o filtro para ver os outros."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((c) => {
            const st = STATUS_CONTRATO_CORES[c.status];
            const dias = diasParaVencer(c);
            return (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/contratos/$id", params: { id: c.id } })}
                style={{ ...CARD, display: "block", width: "100%", textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>
                      {c.cliente?.nome ?? "Cliente removido"}
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, marginTop: 3 }}>
                      {MODALIDADE_LABEL[c.modalidade]}
                      {c.numero ? ` · nº ${c.numero}` : ""}
                      {c.cliente?.documento ? ` · ${formatarDocumento(c.cliente.documento)}` : ""}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: "4px 9px", borderRadius: 999,
                    fontFamily: FONT, fontWeight: 600, fontSize: 9.5,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isLight ? st.light : st.dark, background: st.bg, border: `1px solid ${st.border}`,
                  }}>
                    {STATUS_CONTRATO_LABEL[c.status]}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap",
                  fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
                  {c.valor_mensal != null && (
                    <span>
                      {c.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês
                    </span>
                  )}
                  <span>
                    {c.vigencia_fim
                      ? dias != null && dias < 0
                        ? `venceu há ${Math.abs(dias)} dias`
                        : `vence em ${dias} dias`
                      : "vigência aberta"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
