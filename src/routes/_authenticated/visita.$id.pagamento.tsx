// Formas de Pagamento — resumo financeiro do projeto aprovado:
// custo/venda, fornecimento por Locação (mensalidade + implantação em 12x)
// ou Comodato (24/36/48/60 meses) e mensalidades de serviços (I.As, totens,
// portaria remota, software operante, app, monitoramento, link).
// Regras: src/features/comercial/regrasComerciais.ts

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, KeyRound, Handshake, CalendarClock } from "lucide-react";
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
  MONITORAMENTO_24H_MENSAL,
  valorPortariaRemota,
  mensalidadeTotem,
  SOFTWARE_OPERANTE_PR_MENSAL,
  SOFTWARE_OPERANTE_PRESENCIAL_MENSAL,
  APP_ACESSOS_PP_MENSAL,
  LINK_INTERNET_PREVER_MENSAL,
  IA_MENSALIDADES,
} from "@/features/comercial/regrasComerciais";

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
  const custoPorBloco: Record<string, number> = {};
  let custoInsumos = 0;
  for (const it of itensEq as any[]) {
    const info = eqInfo[it.cod_eq];
    const linha = (info?.custo ?? 0) * Number(it.qtd || 0);
    custoPorBloco[it.visita_bloco_id] = (custoPorBloco[it.visita_bloco_id] ?? 0) + linha;
    if (info?.subcat && SUBCATS_INSUMO.has(info.subcat)) custoInsumos += linha;
  }
  const custoTotal = Object.values(custoPorBloco).reduce((s, v) => s + v, 0);
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

  // ── Mensalidades de serviços ────────────────────────────────────────────────
  const tipoLocal = ((visita as any)?.tipo_local as string | null)?.trim().toLowerCase() ?? "";
  const isResidencia = tipoLocal === "residencia";
  const isGalpao = tipoLocal === "empresa";
  const sistemaProposto = (orcamento as any)?.sistema_proposto as string | null;
  const qtdApartamentos = Number((orcamento as any)?.qtd_apartamentos || 0);
  const servicosOfertados: string[] = ((orcamento as any)?.servicos_ofertados as string[]) ?? [];
  const linkPrever = (orcamento as any)?.link_internet_fornecimento === "prever";
  const appAcessos = (orcamento as any)?.app_prever_acessos === true;

  type LinhaMensal = { label: string; valor: number | null; obs?: string };
  const linhasMensais: LinhaMensal[] = [];

  // I.As / Smart Sampa por câmera (itens SV dos blocos)
  const svAgg: Record<string, number> = {};
  for (const it of itensSv as any[]) svAgg[it.cod_eq] = (svAgg[it.cod_eq] ?? 0) + Number(it.qtd || 0);
  for (const [code, qtd] of Object.entries(svAgg)) {
    if (qtd <= 0) continue;
    const sv = svInfo[code];
    const preco = sv?.preco ?? IA_MENSALIDADES[code] ?? 0;
    linhasMensais.push({ label: `${qtd}× ${sv?.nome ?? code}`, valor: preco * qtd });
  }

  // Totens (mensalidade por totem, com Smart Sampa por totem)
  for (const bloco of blocos as any[]) {
    if (bloco.tipo_bloco !== "TOT") continue;
    const cfg = (bloco.alarme_config as any)?.totem_totens as
      | { cameras: number; smart_sampa: boolean }[]
      | undefined;
    let valor = 0;
    let obs: string | undefined;
    if (Array.isArray(cfg) && cfg.length > 0) {
      valor = cfg.reduce((s, t) => s + mensalidadeTotem(Number(t.cameras || 0), !!t.smart_sampa), 0);
      obs = cfg.map((t, i) => `T${i + 1}: ${t.cameras}cam${t.smart_sampa ? "+SS" : ""}`).join(" · ");
    } else {
      // Bloco antigo sem config detalhada: estima pelo código TOT-{n}x{cam}CAM
      const m = String(bloco.codigo_bloco || "").match(/TOT-(\d+)x(\d+)CAM/i);
      const n = m ? Number(m[1]) : Number(bloco.quantidade || 1);
      const cams = m ? Number(m[2]) : 3 * n;
      const camPorTotem = n > 0 ? cams / n : 3;
      valor = n * mensalidadeTotem(camPorTotem, false);
      obs = "estimado (bloco salvo antes da config detalhada)";
    }
    linhasMensais.push({ label: "Totem de Monitoramento", valor, obs });
  }

  // Operação de Portaria Remota (por faixa de apartamentos)
  if (sistemaProposto === "PR") {
    const v24 = valorPortariaRemota(qtdApartamentos, "24h");
    const v12 = valorPortariaRemota(qtdApartamentos, "12h");
    linhasMensais.push({
      label: `Operação Portaria Remota 24H (${qtdApartamentos} aptos)`,
      valor: v24,
      obs: v24 === null ? "acima de 100 aptos — sob negociação" : v12 !== null ? `opção 12H: ${fmtBRL(v12)}` : undefined,
    });
    linhasMensais.push({ label: "Software operante (Portaria Remota)", valor: SOFTWARE_OPERANTE_PR_MENSAL });
    if (appAcessos) {
      linhasMensais.push({ label: "App Grupo Prever Acessos", valor: 0, obs: "incluso na operação de Portaria Remota" });
    }
  }

  // Portaria Presencial: software operante (se há controle de acesso) + app
  const temControleAcesso = (blocos as any[]).some((b) => b.tipo_bloco === "PED" || b.tipo_bloco === "VEI");
  if (sistemaProposto === "PP") {
    if (temControleAcesso) {
      linhasMensais.push({ label: "Software operante (Acesso c/ Portaria Presencial)", valor: SOFTWARE_OPERANTE_PRESENCIAL_MENSAL });
    }
    if (appAcessos && !isResidencia && !isGalpao) {
      linhasMensais.push({ label: "App Grupo Prever Acessos", valor: APP_ACESSOS_PP_MENSAL });
    }
  }

  // Monitoramento 24H (Residência / Galpão)
  if ((isResidencia || isGalpao) && servicosOfertados.includes("monitoramento_24h")) {
    linhasMensais.push({
      label: `Monitoramento 24H (${isGalpao ? "Galpão" : "Residência"})`,
      valor: MONITORAMENTO_24H_MENSAL[isGalpao ? "galpao" : "residencia"],
    });
  }

  // Link de internet fornecido pela Prever
  if (linkPrever) {
    linhasMensais.push({ label: "Link de internet (fornecido pela Prever)", valor: LINK_INTERNET_PREVER_MENSAL });
  }

  const totalMensalServicos = linhasMensais.reduce((s, l) => s + (l.valor ?? 0), 0);

  const nomeLocal = visita?.nome_predio || visita?.titulo || "Visita";

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
              <span style={{ ...linhaValor, fontSize: 16 }}>{fmtBRL(totalMensalServicos)}/mês</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
