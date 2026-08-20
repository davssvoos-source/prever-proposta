// Painel de chamados — a aba 1 do SAC (R8): dashboards e infos dos quatro
// trilhos, com filtros por técnico, tipo, cliente e trilho aplicados a TUDO
// (números, gráfico e lista). Ver docs/PRODUTO.md §4.1.
//
// Herda o acesso do pai /chamados (admin, comercial e SAC).
// /chamados/indicadores continua existindo como mergulho da operação de campo
// (SLA, carga por técnico); este aqui é a visão gerencial do TODO.
// Paleta de dataviz conforme DESIGN_SYSTEM.md §9.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { ArrowLeft, AlertTriangle, CalendarDays, CalendarRange, CalendarCheck, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { chamadoEmAberto, situacaoPrazo, TIPO_LABEL, type ChamadoTipo } from "@/lib/chamado-status";
import { isPendenteBucket, isAguardandoAprovacaoBucket } from "@/lib/visita-status";
import { EQUIPE_LABEL, type Equipe } from "@/lib/equipes";
import { useChamados, usePessoas } from "@/features/chamados/data";

export const Route = createFileRoute("/_authenticated/chamados/painel")({
  component: PainelChamadosPage,
});

// Paleta categórica validada (§9) — ordem fixa, nunca ciclada
const CORES_DARK = ["#3987e5", "#008300", "#d55181", "#E2791D", "#199e70", "#d95926", "#9085e9", "#e66767"];
const CORES_LIGHT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];

/** Item já normalizado para os números do painel. */
interface Item {
  trilho: "campo" | "demanda" | "proposta";
  equipe: string | null;
  tipo: string;       // corretiva | preventiva | operacional | implantacao | melhoria | pedido_compra | visita
  cliente: string | null;
  responsavelId: string | null;
  emAberto: boolean;
  atrasado: boolean;
  criadoEm: string;
}

function PainelChamadosPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();

  const [trilho, setTrilho] = useState<string>("todos");
  const [tecnico, setTecnico] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [cliente, setCliente] = useState<string>("todos");

  // mesmos queryKeys da lista: cache compartilhado entre as abas do SAC
  const { data: chamados = [], isLoading: l1 } = useChamados();
  const { data: visitas = [], isLoading: l3 } = useQuery({
    queryKey: ["chamados-visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, status, titulo, nome_predio, tecnico_id, data_hora_agendada, created_at, clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  const { data: pessoas = [] } = usePessoas();

  const isLoading = l1 || l3;
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const cores = isLight ? CORES_LIGHT : CORES_DARK;
  const CARD: CSSProperties = { ...card(isLight), padding: "16px" };
  const SEC: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.16em",
    textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const SELECT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 12px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontSize: 13,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const tooltipStyle = {
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10, fontFamily: FONT, fontSize: 12, color: textPrimary,
  } as CSSProperties;

  // ── Normalização ──────────────────────────────────────────────────────────
  const itens = useMemo<Item[]>(() => {
    const l: Item[] = [];
    for (const c of chamados) {
      const interno = c.natureza === "interno";
      l.push({
        trilho: interno ? "demanda" : "campo",
        equipe: interno ? c.equipe : null,
        tipo: c.tipo ?? (interno ? "operacional" : "corretiva"),
        cliente: c.cliente?.nome ?? null,
        responsavelId: c.responsavel_id,
        emAberto: chamadoEmAberto(c.status),
        atrasado: situacaoPrazo(c.prazo_limite, c.status) === "estourado",
        criadoEm: c.created_at,
      });
    }
    for (const v of visitas) {
      l.push({
        trilho: "proposta",
        equipe: null,
        tipo: "visita",
        cliente: v.clientes?.nome ?? v.nome_predio ?? null,
        responsavelId: v.tecnico_id ?? null,
        emAberto: isPendenteBucket(v.status) || isAguardandoAprovacaoBucket(v.status),
        atrasado: false,
        criadoEm: v.created_at,
      });
    }
    return l;
  }, [chamados, visitas]);

  // ── Filtros — aplicados a TUDO ────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (trilho === "campo" && i.trilho !== "campo") return false;
      if (trilho === "proposta" && i.trilho !== "proposta") return false;
      if (trilho.startsWith("eq:") && !(i.trilho === "demanda" && i.equipe === trilho.slice(3))) return false;
      if (tecnico !== "todos" && i.responsavelId !== tecnico) return false;
      if (tipo !== "todos" && i.tipo !== tipo) return false;
      if (cliente !== "todos" && i.cliente !== cliente) return false;
      return true;
    });
  }, [itens, trilho, tecnico, tipo, cliente]);

  // ── Números ───────────────────────────────────────────────────────────────
  const numeros = useMemo(() => {
    const agora = new Date();
    const iniSemana = new Date(agora); iniSemana.setDate(agora.getDate() - agora.getDay()); iniSemana.setHours(0, 0, 0, 0);
    const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const iniAno = new Date(agora.getFullYear(), 0, 1);
    const desde = (d: Date) => filtrados.filter((i) => new Date(i.criadoEm) >= d).length;
    return {
      abertos: filtrados.filter((i) => i.emAberto).length,
      atrasados: filtrados.filter((i) => i.atrasado).length,
      semana: desde(iniSemana),
      mes: desde(iniMes),
      ano: desde(iniAno),
    };
  }, [filtrados]);

  // ── Gráfico de manutenções: chamados de campo por mês, quebrado por tipo ──
  const grafico = useMemo(() => {
    const agora = new Date();
    const meses: { chave: string; rotulo: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      meses.push({
        chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      });
    }
    const tiposCampo: ChamadoTipo[] = ["corretiva", "preventiva", "operacional", "implantacao"];
    const base = meses.map((m) => {
      const linha: Record<string, string | number> = { mes: m.rotulo };
      for (const t of tiposCampo) linha[t] = 0;
      return { chave: m.chave, linha };
    });
    const porChave = new Map(base.map((b) => [b.chave, b.linha]));
    for (const i of filtrados) {
      if (i.trilho !== "campo") continue;
      // mês LOCAL, não o do ISO/UTC: chamado aberto 21h30 do dia 31 (-03)
      // pertence ao mês em que foi aberto aqui, não ao seguinte
      const d = new Date(i.criadoEm);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const linha = porChave.get(chave);
      if (!linha) continue;
      const t = (tiposCampo as string[]).includes(i.tipo) ? i.tipo : "corretiva";
      linha[t] = (linha[t] as number) + 1;
    }
    const dados = base.map((b) => b.linha);
    const total = dados.reduce(
      (s, l) => s + tiposCampo.reduce((x, t) => x + (l[t] as number), 0), 0,
    );
    return { dados, tiposCampo, total };
  }, [filtrados]);

  const equipesComItens = useMemo(() => {
    const s = new Set<string>();
    for (const i of itens) if (i.trilho === "demanda" && i.equipe) s.add(i.equipe);
    return Array.from(s);
  }, [itens]);

  const clientesComItens = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens) if (i.cliente) m.set(i.cliente, (m.get(i.cliente) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([nome]) => nome);
  }, [itens]);

  // tipos disponíveis para o filtro: os de campo + os de demanda + visita
  const tiposFiltro: { valor: string; rotulo: string }[] = [
    { valor: "todos", rotulo: "Todos os tipos" },
    ...(["corretiva", "preventiva", "operacional", "implantacao"] as ChamadoTipo[]).map((t) => ({
      valor: t, rotulo: TIPO_LABEL[t],
    })),
    { valor: "melhoria", rotulo: TIPO_LABEL.melhoria },
    { valor: "pedido_compra", rotulo: TIPO_LABEL.pedido_compra as string },
    { valor: "visita", rotulo: "Visita (proposta)" },
  ];

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "7px 13px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo
      ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 11.5, whiteSpace: "nowrap",
  });

  const tiles = [
    { label: "Esta semana", valor: numeros.semana, Icon: CalendarDays },
    { label: "Este mês", valor: numeros.mes, Icon: CalendarRange },
    { label: "Este ano", valor: numeros.ano, Icon: CalendarCheck },
  ];

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/chamados" })}
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18 }}>Painel de chamados</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            Os quatro trilhos — filtros valem para tudo
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="trilho-x" style={{ display: "flex", gap: 8, paddingBottom: 2 }}>
        <button style={chip(trilho === "todos")} onClick={() => setTrilho("todos")}>Todos os trilhos</button>
        <button style={chip(trilho === "campo")} onClick={() => setTrilho("campo")}>Campo</button>
        <button style={chip(trilho === "proposta")} onClick={() => setTrilho("proposta")}>Propostas</button>
        {equipesComItens.map((e) => (
          <button key={e} style={chip(trilho === `eq:${e}`)} onClick={() => setTrilho(`eq:${e}`)}>
            {EQUIPE_LABEL[e as Equipe] ?? e}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select style={SELECT} value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
          <option value="todos">Todos os técnicos</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select style={SELECT} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {tiposFiltro.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </div>
      <select style={SELECT} value={cliente} onChange={(e) => setCliente(e.target.value)}>
        <option value="todos">Todos os clientes</option>
        {clientesComItens.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Calculando…
        </div>
      ) : (
        <>
          {/* Em aberto AGORA — o número que o SAC olha o dia todo */}
          <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <span style={SEC}>Em aberto agora</span>
              <div style={{
                fontFamily: FONT, fontWeight: 800, fontSize: 40, lineHeight: 1.1,
                color: gold, fontVariantNumeric: "tabular-nums",
              }}>
                {numeros.abertos}
              </div>
            </div>
            {numeros.atrasados > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end",
                  color: isLight ? "#B1242E" : "#F17881",
                }}>
                  <AlertTriangle size={15} />
                  <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, fontVariantNumeric: "tabular-nums" }}>
                    {numeros.atrasados}
                  </span>
                </div>
                <span style={{ ...SEC, fontSize: 9, color: textSecondary }}>atrasados</span>
              </div>
            )}
          </div>

          {/* Totais por período (criados no período, com os filtros) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {tiles.map((t) => (
              <div key={t.label} style={{ ...CARD, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <t.Icon size={12} color={gold} />
                  <span style={{ ...SEC, fontSize: 8.5 }}>{t.label}</span>
                </div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>
                  {t.valor}
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico de quantidade de manutenções (R8) — campo, por mês e tipo */}
          <div style={CARD}>
            <span style={SEC}>Manutenções de campo — últimos 12 meses</span>
            {grafico.total === 0 ? (
              <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, marginTop: 10 }}>
                Nenhum chamado de campo no período (com os filtros atuais).
              </div>
            ) : (
              <div style={{ width: "100%", height: 240, marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grafico.dados} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"} />
                    <XAxis dataKey="mes" tick={{ fill: textSecondary, fontSize: 10.5, fontFamily: "Montserrat" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: textSecondary, fontSize: 10.5, fontFamily: "Montserrat" }} axisLine={false} tickLine={false} />
                    <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                    <Legend
                      formatter={(v: string) => (
                        <span style={{ fontFamily: FONT, fontSize: 11, color: textPrimary }}>
                          {TIPO_LABEL[v as ChamadoTipo] ?? v}
                        </span>
                      )}
                    />
                    {grafico.tiposCampo.map((t, i) => (
                      <Bar
                        key={t} dataKey={t} stackId="campo"
                        name={TIPO_LABEL[t]}
                        fill={cores[i % 8]}
                        isAnimationActive={false}
                        radius={i === grafico.tiposCampo.length - 1 ? [4, 4, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Em aberto, resumido — a lista completa é a aba Chamados */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={SEC}>Em aberto ({numeros.abertos})</span>
              <button
                onClick={() => navigate({ to: "/chamados" })}
                style={{
                  marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                  color: gold, fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
                }}
              >
                Ver lista completa →
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
              {filtrados.filter((i) => i.emAberto).slice(0, 12).map((i, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                    borderTop: idx === 0 ? "none" : isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Clock size={12} color={i.atrasado ? (isLight ? "#B1242E" : "#F17881") : textSecondary} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {i.cliente ?? "Interno"}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, flexShrink: 0 }}>
                    {i.trilho === "campo"
                      ? TIPO_LABEL[i.tipo as ChamadoTipo] ?? i.tipo
                      : i.trilho === "proposta"
                        ? "Proposta"
                        : TIPO_LABEL[i.tipo as ChamadoTipo] ?? i.tipo}
                  </span>
                </div>
              ))}
              {numeros.abertos > 12 && (
                <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, paddingTop: 8 }}>
                  …e mais {numeros.abertos - 12} na lista completa.
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
