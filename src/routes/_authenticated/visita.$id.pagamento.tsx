// Formas de Pagamento — primeira etapa: resumo financeiro do projeto aprovado
// (custo total, custo por bloco, valor de venda). Configuração de formas de
// pagamento propriamente dita vem em cima disto nos próximos passos.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { isServicoCode } from "@/features/orcamento/blockAutoItems";
import { MARKUP_VENDA } from "@/features/comercial/regrasComerciais";

export const Route = createFileRoute("/_authenticated/visita/$id/pagamento")({
  component: PagamentoPage,
});

const TIPOS_NOMES: Record<string, string> = {
  PED: "Eclusa de Pedestres",
  VEI: "Eclusa Veicular",
  CFTV: "CFTV",
  AL: "Alarme",
  CER: "Cerca Elétrica",
  CENT: "Central de Portaria Remota",
  ELV: "Elevadores",
  TOT: "Totem Inteligente",
};
const TIPOS_UNICOS = new Set(["CENT"]);

const MULTIPLICADOR_VENDA = MARKUP_VENDA;

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PagamentoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isLight } = useTheme();

  const { data: visita } = useQuery({
    queryKey: ["visita_pagamento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("nome_predio, titulo, status")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: blocos = [] } = useQuery({
    queryKey: ["visita_blocos_pagamento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("*")
        .eq("visita_id", id)
        .order("ordem");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const blocoIds = blocos.map((b: any) => b.id);
  const { data: itens = [] } = useQuery({
    queryKey: ["visita_bloco_itens_pagamento", blocoIds.sort().join(",")],
    enabled: blocoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_bloco_itens" as any)
        .select("visita_bloco_id, cod_eq, qtd, removido")
        .in("visita_bloco_id", blocoIds);
      if (error) throw error;
      return ((data as any[]) ?? []).filter((r) => !r.removido && !isServicoCode(r.cod_eq));
    },
  });

  const codes = Array.from(new Set(itens.map((i: any) => i.cod_eq)));
  const { data: custoMap = {} } = useQuery({
    queryKey: ["equipamentos_custo_pagamento", codes.sort().join(",")],
    enabled: codes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("code,custo")
        .in("code", codes);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const e of (data as any[]) ?? []) map[e.code] = Number(e.custo || 0);
      return map;
    },
  });

  // Custo por bloco = soma(qtd × custo) dos itens (equipamentos, sem serviços mensais)
  const custoPorBloco: Record<string, number> = {};
  for (const it of itens as any[]) {
    const custoUnit = custoMap[it.cod_eq] ?? 0;
    custoPorBloco[it.visita_bloco_id] = (custoPorBloco[it.visita_bloco_id] ?? 0) + custoUnit * Number(it.qtd || 0);
  }
  const custoTotal = Object.values(custoPorBloco).reduce((s, v) => s + v, 0);
  const vendaTotal = custoTotal * MULTIPLICADOR_VENDA;

  const nomeLocal = visita?.nome_predio || visita?.titulo || "Visita";

  const PAGE: React.CSSProperties = {
    padding: "12px 16px 48px", display: "flex", flexDirection: "column", gap: 16,
    color: isLight ? "#0a0b0e" : "#fff",
  };
  const HEADER: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
  const BACK_BTN: React.CSSProperties = {
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", color: isLight ? "#0a0b0e" : "#fff",
  };
  const CARD: React.CSSProperties = {
    background: isLight ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,215,0,0.12)",
    borderRadius: 16, padding: "16px 18px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : undefined,
  };
  const LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)", marginBottom: 10,
  };

  return (
    <div style={PAGE}>
      <div style={HEADER}>
        <button style={BACK_BTN} onClick={() => navigate({ to: "/visita/$id", params: { id } })}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 18 }}>
            Formas de Pagamento
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nomeLocal}
          </div>
        </div>
      </div>

      {/* Custo total + Venda total */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={CARD}>
          <div style={LABEL}>Custo total do projeto</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 20 }}>
            {fmtBRL(custoTotal)}
          </div>
        </div>
        <div
          style={{
            ...CARD,
            background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
            border: "none",
            boxShadow: "0 6px 20px rgba(255,192,0,0.30)",
          }}
        >
          <div style={{ ...LABEL, color: "rgba(10,11,14,0.65)" }}>Valor de venda ({MULTIPLICADOR_VENDA}×)</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 20, color: "#0A0A0A" }}>
            {fmtBRL(vendaTotal)}
          </div>
        </div>
      </div>

      {/* Custo por bloco */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Layers size={16} color={isLight ? "#b87800" : "#FFC000"} />
          <span style={LABEL0(isLight)}>Custo por bloco</span>
        </div>
        {blocos.length === 0 ? (
          <div style={{ fontSize: 13, color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)" }}>
            Nenhum bloco no escopo.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const counters: Record<string, number> = {};
              return blocos.map((bloco: any) => {
                const tipo = bloco.tipo_bloco;
                counters[tipo] = (counters[tipo] || 0) + 1;
                const base = TIPOS_NOMES[tipo] || tipo;
                const nomeUsuario = (bloco.nome_acesso as string | null)?.trim();
                const label = nomeUsuario
                  ? nomeUsuario
                  : TIPOS_UNICOS.has(tipo)
                  ? base
                  : `${base} ${String(counters[tipo]).padStart(2, "0")}`;
                const custo = custoPorBloco[bloco.id] ?? 0;
                return (
                  <div
                    key={bloco.id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0",
                      borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 700, color: isLight ? "#b87800" : "#FFC000" }}>
                      {fmtBRL(custo)}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function LABEL0(isLight: boolean): React.CSSProperties {
  return {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
}
