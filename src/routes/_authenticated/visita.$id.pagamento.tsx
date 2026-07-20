// Formas de Pagamento — resumo financeiro do projeto aprovado:
// custo/venda, fornecimento por Locação (mensalidade + implantação em 12x)
// ou Comodato (24/36/48/60 meses) e mensalidades de serviços (I.As, totens,
// portaria remota, software operante, app, monitoramento, link).
// Regras: src/features/comercial/regrasComerciais.ts

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, KeyRound, Handshake, CalendarClock, FileText, X, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { isServicoCode } from "@/features/orcamento/blockAutoItems";
import {
  MARKUP_VENDA,
  VALOR_HORA_HOMEM,
  HH_PADRAO_BLOCO,
  IMPLANTACAO_PARCELAS,
  LOCACAO_PRAZO_MESES,
  mensalidadeLocacao,
  mensalidadesComodato,
} from "@/features/comercial/regrasComerciais";
import { computeLinhasMensais, totalMensalServicos } from "@/features/comercial/mensalidadesProjeto";
import { gerarPropostaDocx, FORMAS_PAGAMENTO, type FormaPagamentoOpcao } from "@/features/proposta/gerarProposta";

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

// Subcategorias de insumos (cabeamento/tubulação): vendidos na implantação da
// locação, fora da base da mensalidade — evita cobrança dupla.
const SUBCATS_INSUMO = new Set(["cabeamento", "tubulacao"]);

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Paleta categórica validada (skill dataviz — ordem fixa, nunca ciclada;
// CVD ΔE ≥ 8 e piso de visão normal ≥ 15 nos dois modos). Máx. 8 fatias;
// excedente vira "Outros" (neutro, com rótulo — nunca um 9º matiz gerado).
const PIE_CORES_DARK = ["#3987e5", "#008300", "#d55181", "#c98500", "#199e70", "#d95926", "#9085e9", "#e66767"];
const PIE_CORES_LIGHT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];
const PIE_OUTROS_DARK = "#6b7280";
const PIE_OUTROS_LIGHT = "#9ca3af";

function PagamentoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isLight } = useTheme();

  const { data: visita } = useQuery({
    queryKey: ["visita_pagamento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("nome_predio, titulo, status, tipo_local, servicos_propostos")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento_pagamento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_orcamentos")
        .select("*")
        .eq("visita_id", id)
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
  const { data: itensAll = [] } = useQuery({
    queryKey: ["visita_bloco_itens_pagamento", blocoIds.sort().join(",")],
    enabled: blocoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_bloco_itens" as any)
        .select("visita_bloco_id, cod_eq, qtd, removido")
        .in("visita_bloco_id", blocoIds);
      if (error) throw error;
      return ((data as any[]) ?? []).filter((r) => !r.removido);
    },
  });

  const itensEq = itensAll.filter((r: any) => !isServicoCode(r.cod_eq));
  const itensSv = itensAll.filter((r: any) => isServicoCode(r.cod_eq));

  const codes = Array.from(new Set(itensEq.map((i: any) => i.cod_eq)));
  const { data: eqInfo = {} } = useQuery({
    queryKey: ["equipamentos_custo_pagamento", codes.sort().join(",")],
    enabled: codes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("code,custo,subcat")
        .in("code", codes);
      if (error) throw error;
      const map: Record<string, { custo: number; subcat: string | null }> = {};
      for (const e of (data as any[]) ?? []) map[e.code] = { custo: Number(e.custo || 0), subcat: e.subcat ?? null };
      return map;
    },
  });

  const svCodes = Array.from(new Set(itensSv.map((i: any) => i.cod_eq)));
  const { data: svInfo = {} } = useQuery({
    queryKey: ["servicos_pagamento", svCodes.sort().join(",")],
    enabled: svCodes.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("code,nome,preco_unitario_mensal")
        .in("code", svCodes);
      if (error) throw error;
      const map: Record<string, { nome: string; preco: number }> = {};
      for (const s of (data as any[]) ?? []) map[s.code] = { nome: s.nome, preco: Number(s.preco_unitario_mensal || 0) };
      return map;
    },
  });

  // ── Custos e venda ──────────────────────────────────────────────────────────
  // Blocos TOT ficam FORA da base de venda/locação/comodato: o totem é sempre
  // locação própria (24 meses) com mensalidade tabelada que já embute o hardware.
  const totIds = new Set((blocos as any[]).filter((b) => b.tipo_bloco === "TOT").map((b) => b.id));
  const custoPorBloco: Record<string, number> = {};
  let custoInsumos = 0;
  let custoTotal = 0;
  for (const it of itensEq as any[]) {
    const info = eqInfo[it.cod_eq];
    const linha = (info?.custo ?? 0) * Number(it.qtd || 0);
    custoPorBloco[it.visita_bloco_id] = (custoPorBloco[it.visita_bloco_id] ?? 0) + linha;
    if (totIds.has(it.visita_bloco_id)) continue; // totem: fora da base financeira
    custoTotal += linha;
    if (info?.subcat && SUBCATS_INSUMO.has(info.subcat)) custoInsumos += linha;
  }
  const vendaTotal = custoTotal * MARKUP_VENDA;

  // ── Locação (24m): mensalidade sobre a venda dos equipamentos (sem insumos);
  //    implantação (insumos + mão de obra) cobrada à parte em 12x ─────────────
  const vendaInsumos = custoInsumos * MARKUP_VENDA;
  const vendaEquipSemInsumos = vendaTotal - vendaInsumos;
  const locacaoMensal = mensalidadeLocacao(vendaEquipSemInsumos);

  const nBlocos = blocos.length;
  const maoDeObra = nBlocos * HH_PADRAO_BLOCO * VALOR_HORA_HOMEM;
  const implantacaoTotal = vendaInsumos + maoDeObra;
  const implantacaoParcela = implantacaoTotal / IMPLANTACAO_PARCELAS;

  // ── Comodato (cascata sobre a mensalidade de locação) ───────────────────────
  const comodato = mensalidadesComodato(locacaoMensal);

  // ── Mensalidades de serviços (módulo compartilhado com a proposta) ─────────
  const tipoLocal = ((visita as any)?.tipo_local as string | null)?.trim().toLowerCase() ?? "";
  const svAgg: Record<string, number> = {};
  for (const it of itensSv as any[]) svAgg[it.cod_eq] = (svAgg[it.cod_eq] ?? 0) + Number(it.qtd || 0);
  const linhasMensais = computeLinhasMensais({
    blocos: blocos as any[],
    svAgg,
    svInfo,
    tipoLocal,
    sistemaProposto: (orcamento as any)?.sistema_proposto ?? null,
    qtdApartamentos: Number((orcamento as any)?.qtd_apartamentos || 0),
    servicosOfertados: ((orcamento as any)?.servicos_ofertados as string[]) ?? [],
    linkPrever: (orcamento as any)?.link_internet_fornecimento === "prever",
    appAcessos: (orcamento as any)?.app_prever_acessos === true,
  });
  const totalServicosMensais = totalMensalServicos(linhasMensais);

  const nomeLocal = visita?.nome_predio || visita?.titulo || "Visita";

  // ── Dashboard: distribuição do custo entre os blocos (donut) ────────────────
  const custoTodosBlocos = Object.values(custoPorBloco).reduce((s, v) => s + v, 0);
  const fatias = (() => {
    const counters: Record<string, number> = {};
    const todas = (blocos as any[])
      .map((bloco) => {
        const tipo = bloco.tipo_bloco;
        counters[tipo] = (counters[tipo] || 0) + 1;
        const base = TIPOS_NOMES[tipo] || tipo;
        const nomeUsuario = (bloco.nome_acesso as string | null)?.trim();
        const label = nomeUsuario
          ? nomeUsuario
          : TIPOS_UNICOS.has(tipo)
            ? base
            : `${base} ${String(counters[tipo]).padStart(2, "0")}`;
        return { nome: label, valor: custoPorBloco[bloco.id] ?? 0 };
      })
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    if (todas.length <= 8) return todas;
    const top = todas.slice(0, 7);
    const resto = todas.slice(7).reduce((s, f) => s + f.valor, 0);
    return [...top, { nome: "Outros", valor: resto }];
  })();
  const pieCores = isLight ? PIE_CORES_LIGHT : PIE_CORES_DARK;
  const pieOutros = isLight ? PIE_OUTROS_LIGHT : PIE_OUTROS_DARK;
  const corFatia = (i: number, nome: string) => (nome === "Outros" ? pieOutros : pieCores[i % 8]);
  const pieSurface = isLight ? "#ffffff" : "#101016";

  // ── Geração da proposta (.docx) ─────────────────────────────────────────────
  const [modalAberto, setModalAberto] = useState(false);
  const [formaEscolhida, setFormaEscolhida] = useState<FormaPagamentoOpcao | "">("");
  const [numeroProposta, setNumeroProposta] = useState("");
  const [gerando, setGerando] = useState(false);

  const valorDaForma = (f: FormaPagamentoOpcao): string => {
    if (f === "locacao_24") return `${fmtBRL(locacaoMensal)}/mês + implantação ${IMPLANTACAO_PARCELAS}× ${fmtBRL(implantacaoParcela)}`;
    if (f === "compra_vista") return fmtBRL(vendaTotal);
    const prazo = Number(f.replace("comodato_", "")) as 24 | 36 | 48 | 60;
    return `${fmtBRL(comodato[prazo])}/mês`;
  };

  const gerar = async () => {
    if (!formaEscolhida) {
      toast.error("Selecione a forma de pagamento desejada.");
      return;
    }
    const num = numeroProposta.trim();
    if (!/^\d{4}_\d{2}_\d{2}$/.test(num)) {
      toast.error("Número da proposta inválido — use o formato XXXX_YY_ZZ (ex.: 0148_25_01).");
      return;
    }
    setGerando(true);
    try {
      await gerarPropostaDocx({ visitaId: id, forma: formaEscolhida, numeroProposta: num });
      toast.success("Proposta gerada — o download foi iniciado.");
      setModalAberto(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar a proposta");
    } finally {
      setGerando(false);
    }
  };

  // ── Estilos ─────────────────────────────────────────────────────────────────
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
  };
  const LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)", marginBottom: 10,
  };
  const SEC_TITLE: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const linhaRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    gap: 10, padding: "7px 0",
    borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
  };
  const linhaLabel: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600, minWidth: 0,
  };
  const linhaValor: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 700,
    color: isLight ? "#b87800" : "#FFC000", flexShrink: 0,
  };
  const obsStyle: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontSize: 11,
    color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)",
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
          <div style={{ ...LABEL, color: "rgba(10,11,14,0.65)" }}>Valor de venda ({MARKUP_VENDA}×)</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 20, color: "#0A0A0A" }}>
            {fmtBRL(vendaTotal)}
          </div>
        </div>
      </div>

      {/* Dashboard: distribuição do custo entre os blocos */}
      {fatias.length >= 2 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <PieChartIcon size={16} color={isLight ? "#b87800" : "#FFC000"} />
            <span style={SEC_TITLE}>Distribuição do custo entre os blocos</span>
          </div>
          <div style={{ position: "relative", width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={0}
                  stroke={pieSurface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {fatias.map((f, i) => (
                    <Cell key={f.nome} fill={corFatia(i, f.nome)} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(valor: number, nome: string) => [
                    `${fmtBRL(valor)} · ${custoTodosBlocos > 0 ? Math.round((valor / custoTodosBlocos) * 100) : 0}%`,
                    nome,
                  ]}
                  contentStyle={{
                    background: isLight ? "#ffffff" : "#16161d",
                    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 10,
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 12,
                    color: isLight ? "#0a0b0e" : "#fff",
                  }}
                  itemStyle={{ color: isLight ? "#0a0b0e" : "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Número central do donut */}
            <div
              style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", pointerEvents: "none",
              }}
            >
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 15 }}>
                {fmtBRL(custoTodosBlocos)}
              </span>
              <span style={{ ...obsStyle, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                custo total
              </span>
            </div>
          </div>
          {/* Legenda: identidade nunca só pela cor — chip + nome + % + valor */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
            {fatias.map((f, i) => (
              <div key={f.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span
                  style={{
                    width: 10, height: 10, borderRadius: 3, flexShrink: 0,
                    background: corFatia(i, f.nome),
                  }}
                />
                <span style={{ ...linhaLabel, fontSize: 12, flex: 1, minWidth: 0 }}>{f.nome}</span>
                <span style={{ ...obsStyle, fontSize: 11 }}>
                  {custoTodosBlocos > 0 ? Math.round((f.valor / custoTodosBlocos) * 100) : 0}%
                </span>
                <span style={{ ...linhaValor, fontSize: 12 }}>{fmtBRL(f.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custo por bloco */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Layers size={16} color={isLight ? "#b87800" : "#FFC000"} />
          <span style={SEC_TITLE}>Custo por bloco</span>
        </div>
        {blocos.length === 0 ? (
          <div style={{ fontSize: 13, color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)", paddingTop: 8 }}>
            Nenhum bloco no escopo.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            {(() => {
              const counters: Record<string, number> = {};
              return (blocos as any[]).map((bloco) => {
                const tipo = bloco.tipo_bloco;
                counters[tipo] = (counters[tipo] || 0) + 1;
                const base = TIPOS_NOMES[tipo] || tipo;
                const nomeUsuario = (bloco.nome_acesso as string | null)?.trim();
                const label = nomeUsuario
                  ? nomeUsuario
                  : TIPOS_UNICOS.has(tipo)
                    ? base
                    : `${base} ${String(counters[tipo]).padStart(2, "0")}`;
                return (
                  <div key={bloco.id} style={linhaRow}>
                    <span style={linhaLabel}>{label}</span>
                    <span style={linhaValor}>{fmtBRL(custoPorBloco[bloco.id] ?? 0)}</span>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Fornecimento — Locação */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <KeyRound size={16} color={isLight ? "#b87800" : "#FFC000"} />
          <span style={SEC_TITLE}>Locação — contrato {LOCACAO_PRAZO_MESES} meses</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          <div style={linhaRow}>
            <span style={linhaLabel}>Mensalidade dos equipamentos</span>
            <span style={{ ...linhaValor, fontSize: 16 }}>{fmtBRL(locacaoMensal)}/mês</span>
          </div>
          <div style={{ ...obsStyle, padding: "2px 0 6px" }}>
            Base: venda dos equipamentos sem insumos ({fmtBRL(vendaEquipSemInsumos)}) ÷ 12
          </div>
          <div style={linhaRow}>
            <span style={linhaLabel}>Implantação ({IMPLANTACAO_PARCELAS}x)</span>
            <span style={linhaValor}>{IMPLANTACAO_PARCELAS}× {fmtBRL(implantacaoParcela)}</span>
          </div>
          <div style={{ ...obsStyle, padding: "2px 0" }}>
            Insumos (cabeamento/tubulação): {fmtBRL(vendaInsumos)} + mão de obra: {fmtBRL(maoDeObra)}{" "}
            ({nBlocos} bloco{nBlocos === 1 ? "" : "s"} × {HH_PADRAO_BLOCO} HH × {fmtBRL(VALOR_HORA_HOMEM)}) ={" "}
            {fmtBRL(implantacaoTotal)}
          </div>
        </div>
      </div>

      {/* Fornecimento — Comodato */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Handshake size={16} color={isLight ? "#b87800" : "#FFC000"} />
          <span style={SEC_TITLE}>Comodato — sem implantação</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          {( [60, 48, 36, 24] as const ).map((prazo) => (
            <div key={prazo} style={linhaRow}>
              <span style={linhaLabel}>Contrato {prazo} meses</span>
              <span style={linhaValor}>{fmtBRL(comodato[prazo])}/mês</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mensalidades de serviços */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <CalendarClock size={16} color={isLight ? "#b87800" : "#FFC000"} />
          <span style={SEC_TITLE}>Mensalidades de serviços</span>
        </div>
        {linhasMensais.length === 0 ? (
          <div style={{ fontSize: 13, color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)", paddingTop: 8 }}>
            Nenhum serviço mensal neste projeto.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            {linhasMensais.map((l, i) => (
              <div key={i} style={{ ...linhaRow, flexDirection: "column", alignItems: "stretch", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <span style={linhaLabel}>{l.label}</span>
                  <span style={linhaValor}>
                    {l.valor === null ? "sob consulta" : l.valor === 0 ? "incluso" : `${fmtBRL(l.valor)}/mês`}
                  </span>
                </div>
                {l.obs && <div style={obsStyle}>{l.obs}</div>}
              </div>
            ))}
            <div style={{ ...linhaRow, borderTop: isLight ? "2px solid rgba(0,0,0,0.10)" : "2px solid rgba(255,255,255,0.12)" }}>
              <span style={{ ...linhaLabel, fontWeight: 700 }}>Total mensal de serviços</span>
              <span style={{ ...linhaValor, fontSize: 16 }}>{fmtBRL(totalServicosMensais)}/mês</span>
            </div>
          </div>
        )}
      </div>

      {/* Gerar proposta comercial (.docx) */}
      <button
        onClick={() => setModalAberto(true)}
        style={{
          width: "100%",
          height: 56,
          borderRadius: 28,
          background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
          border: "none",
          color: "#08090E",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
        }}
      >
        <FileText size={18} />
        Gerar Proposta
      </button>

      {/* Popup: forma de pagamento + número da proposta */}
      {modalAberto && (
        <>
          <div
            onClick={() => !gerando && setModalAberto(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", zIndex: 90 }}
          />
          <div
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(440px, 92vw)",
              maxHeight: "86vh",
              overflowY: "auto",
              zIndex: 100,
              borderRadius: 18,
              padding: "20px 18px",
              background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,215,0,0.16)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 16 }}>
                Gerar Proposta Comercial
              </span>
              <button
                onClick={() => !gerando && setModalAberto(false)}
                style={{
                  width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
                  color: isLight ? "#0a0b0e" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ ...LABEL, marginBottom: 8 }}>Qual a forma de pagamento desejada?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {FORMAS_PAGAMENTO.map(({ valor, label }) => {
                const selected = formaEscolhida === valor;
                return (
                  <button
                    key={valor}
                    onClick={() => setFormaEscolhida(valor)}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: selected
                        ? "none"
                        : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
                      background: selected
                        ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                        : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
                      color: selected ? "#08090E" : isLight ? "#0a0b0e" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13 }}>{label}</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, opacity: selected ? 0.75 : 0.6 }}>
                      {valorDaForma(valor)}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ ...LABEL, marginBottom: 8 }}>Número da proposta</div>
            <input
              value={numeroProposta}
              onChange={(e) => setNumeroProposta(e.target.value)}
              placeholder="XXXX_YY_ZZ  (ex.: 0148_25_01)"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 14,
                border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                background: isLight ? "#ffffff" : "#16161d",
                color: isLight ? "#0a0b0e" : "#fff",
                outline: "none",
                marginBottom: 18,
              }}
            />

            <button
              onClick={gerar}
              disabled={gerando}
              style={{
                width: "100%",
                height: 52,
                borderRadius: 26,
                background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
                border: "none",
                color: "#08090E",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: gerando ? "wait" : "pointer",
                opacity: gerando ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <FileText size={16} />
              {gerando ? "Gerando proposta…" : "Gerar documento (.docx)"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
