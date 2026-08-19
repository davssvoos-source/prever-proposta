// Indicadores da operação de campo — Etapa 5 do sistema de OS, portada na U7.
// Indicadores da operação técnica: fila por status, cumprimento de prazo,
// tempo médio de atendimento, carga por técnico e clientes que mais chamam.
// Paleta de dataviz conforme DESIGN_SYSTEM.md §9 (validada para daltonismo,
// ordem fixa, máx. 8 séries + "Outros" neutro).

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza } from "@/features/chamados/data";
import { chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, STATUS_ORDEM } from "@/lib/chamado-status";

export const Route = createFileRoute("/_authenticated/chamados/indicadores")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase
      .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
    if (!["admin", "comercial", "sac"].includes((perfil as any)?.cargo ?? "")) {
      throw redirect({ to: "/chamados" });
    }
  },
  component: PainelOsPage,
});

// Paleta categórica validada (DESIGN_SYSTEM.md §9) — ordem fixa, nunca ciclada
const CORES_DARK = ["#3987e5", "#008300", "#d55181", "#c98500", "#199e70", "#d95926", "#9085e9", "#e66767"];
const CORES_LIGHT = ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"];
const OUTROS_DARK = "#6b7280";
const OUTROS_LIGHT = "#9ca3af";

function PainelOsPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  // SLA, carga por técnico e tempo de atendimento são da operação de campo
  const { data: ordens = [], isLoading } = useChamadosPorNatureza("campo");
  const { data: tecnicos = [] } = useTecnicos();

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";
  const superficie = isLight ? "#ffffff" : "#101016";
  const cores = isLight ? CORES_LIGHT : CORES_DARK;

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 16, padding: "16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SEC: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const tooltipStyle = {
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10, fontFamily: "'Montserrat', sans-serif", fontSize: 12,
    color: textPrimary,
  } as CSSProperties;

  const m = useMemo(() => {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const abertos = ordens.filter((o) => chamadoEmAberto(o.status));
    const atrasados = ordens.filter((o) => situacaoPrazo(o.prazo_limite, o.status) === "estourado");
    const fechadasMes = ordens.filter(
      (o) => o.fechada_em && new Date(o.fechada_em) >= inicioMes,
    );

    // tempo médio de atendimento: da abertura à conclusão, nas concluídas
    const concluidas = ordens.filter((o) => o.finalizada_em);
    const horas = concluidas.map(
      (o) => (new Date(o.finalizada_em as string).getTime() - new Date(o.created_at).getTime()) / 3_600_000,
    );
    const tempoMedio = horas.length ? horas.reduce((s, h) => s + h, 0) / horas.length : null;

    // cumprimento de prazo entre as que tinham prazo e foram concluídas
    const comPrazo = concluidas.filter((o) => o.prazo_limite);
    const noPrazo = comPrazo.filter(
      (o) => new Date(o.finalizada_em as string) <= new Date(o.prazo_limite as string),
    ).length;
    const pctPrazo = comPrazo.length ? Math.round((noPrazo / comPrazo.length) * 100) : null;

    // fila por status (só o que está em aberto)
    const porStatus = STATUS_ORDEM
      .filter((s) => chamadoEmAberto(s))
      .map((s) => ({ nome: chamadoStatusInfo(s).label, valor: abertos.filter((o) => o.status === s).length }))
      .filter((f) => f.valor > 0);

    // carga por técnico (em aberto)
    const nomeTecnico = new Map((tecnicos as any[]).map((t) => [t.id, t.nome as string]));
    const porTecnicoMapa = new Map<string, number>();
    for (const o of abertos) {
      const chave = o.responsavel_id ? nomeTecnico.get(o.responsavel_id) ?? "Técnico" : "Sem técnico";
      porTecnicoMapa.set(chave, (porTecnicoMapa.get(chave) ?? 0) + 1);
    }
    const porTecnico = Array.from(porTecnicoMapa, ([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);

    // clientes que mais chamaram (todos os chamados)
    const porClienteMapa = new Map<string, number>();
    for (const o of ordens) {
      const chave = o.cliente?.nome ?? "cliente";
      porClienteMapa.set(chave, (porClienteMapa.get(chave) ?? 0) + 1);
    }
    const porCliente = Array.from(porClienteMapa, ([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    return {
      total: ordens.length,
      abertos: abertos.length,
      atrasados: atrasados.length,
      fechadasMes: fechadasMes.length,
      tempoMedio,
      pctPrazo,
      comPrazo: comPrazo.length,
      porStatus,
      porTecnico,
      porCliente,
    };
  }, [ordens, tecnicos]);

  // máx. 8 fatias; o excedente vira "Outros" neutro (nunca uma 9ª cor gerada)
  const fatias = useMemo(() => {
    if (m.porStatus.length <= 8) return m.porStatus;
    const top = m.porStatus.slice(0, 7);
    const resto = m.porStatus.slice(7).reduce((s, f) => s + f.valor, 0);
    return [...top, { nome: "Outros", valor: resto }];
  }, [m.porStatus]);

  const corFatia = (i: number, nome: string) =>
    nome === "Outros" ? (isLight ? OUTROS_LIGHT : OUTROS_DARK) : cores[i % 8];

  const tiles = [
    { label: "Em aberto", valor: String(m.abertos), Icon: Clock, cor: gold },
    {
      label: "Prazo estourado",
      valor: String(m.atrasados),
      Icon: AlertTriangle,
      cor: m.atrasados > 0 ? (isLight ? "#b91c1c" : "#F87171") : textSecondary,
    },
    {
      label: "Tempo médio",
      valor: m.tempoMedio == null ? "—" : m.tempoMedio < 24 ? `${Math.round(m.tempoMedio)}h` : `${(m.tempoMedio / 24).toFixed(1)}d`,
      Icon: Timer,
      cor: isLight ? "#1d4ed8" : "#60A5FA",
    },
    { label: "Fechados no mês", valor: String(m.fechadasMes), Icon: CheckCircle2, cor: isLight ? "#047857" : "#34D399" },
  ];

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/chamados" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 18 }}>Painel de chamados</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            {m.total} chamado{m.total === 1 ? "" : "s"} no histórico
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
          Calculando indicadores…
        </div>
      ) : m.total === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "28px 16px" }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary }}>
            Nenhum chamado registrado ainda — os indicadores aparecem aqui conforme a operação andar.
          </span>
        </div>
      ) : (
        <>
          {/* Indicadores */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {tiles.map((t) => (
              <div key={t.label} style={CARD}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <t.Icon size={13} color={t.cor} />
                  <span style={{ ...SEC, fontSize: 9 }}>{t.label}</span>
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 22,
                    color: t.cor, fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.valor}
                </div>
              </div>
            ))}
          </div>

          {/* Cumprimento de prazo */}
          {m.pctPrazo != null && (
            <div style={CARD}>
              <span style={SEC}>Cumprimento de prazo</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 26,
                    color: m.pctPrazo >= 80 ? (isLight ? "#047857" : "#34D399") : m.pctPrazo >= 50 ? gold : (isLight ? "#b91c1c" : "#F87171"),
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m.pctPrazo}%
                </span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
                  dos {m.comPrazo} chamados com prazo foram concluídos dentro dele
                </span>
              </div>
              <div
                style={{
                  height: 8, borderRadius: 4, marginTop: 12, overflow: "hidden",
                  background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)",
                }}
              >
                <div
                  style={{
                    width: `${m.pctPrazo}%`, height: "100%",
                    background: m.pctPrazo >= 80
                      ? "linear-gradient(90deg,#34D399,#059669)"
                      : m.pctPrazo >= 50
                        ? "linear-gradient(90deg,#FFD700,#FF9F00)"
                        : "linear-gradient(90deg,#F87171,#b91c1c)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Fila por status */}
          {fatias.length >= 2 && (
            <div style={CARD}>
              <span style={SEC}>Fila por status</span>
              <div style={{ position: "relative", width: "100%", height: 210, marginTop: 6 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fatias} dataKey="valor" nameKey="nome"
                      innerRadius={58} outerRadius={90}
                      stroke={superficie} strokeWidth={2} isAnimationActive={false}
                    >
                      {fatias.map((f, i) => (
                        <Cell key={f.nome} fill={corFatia(i, f.nome)} />
                      ))}
                    </Pie>
                    <RTooltip
                      formatter={(v: number, nome: string) => [
                        `${v} · ${m.abertos > 0 ? Math.round((v / m.abertos) * 100) : 0}%`,
                        nome,
                      ]}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: textPrimary }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", pointerEvents: "none",
                  }}
                >
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>
                    {m.abertos}
                  </span>
                  <span style={{ ...SEC, fontSize: 9, color: textSecondary }}>em aberto</span>
                </div>
              </div>
              {/* legenda: identidade nunca só pela cor */}
              <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                {fatias.map((f, i) => (
                  <div key={f.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: corFatia(i, f.nome) }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>{f.nome}</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700, color: gold, fontVariantNumeric: "tabular-nums" }}>
                      {f.valor}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carga por técnico */}
          {m.porTecnico.length > 0 && (
            <div style={CARD}>
              <span style={SEC}>Chamados em aberto por técnico</span>
              <div style={{ width: "100%", height: Math.max(140, m.porTecnico.length * 42), marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.porTecnico} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid
                      horizontal={false}
                      stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}
                    />
                    <XAxis
                      type="number" allowDecimals={false}
                      tick={{ fill: textSecondary, fontSize: 11, fontFamily: "Montserrat" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      type="category" dataKey="nome" width={110}
                      tick={{ fill: textPrimary, fontSize: 11, fontFamily: "Montserrat" }}
                      axisLine={false} tickLine={false}
                    />
                    <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: textPrimary }} />
                    <Bar dataKey="valor" name="Em aberto" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                      {m.porTecnico.map((t, i) => (
                        <Cell key={t.nome} fill={t.nome === "Sem técnico" ? (isLight ? OUTROS_LIGHT : OUTROS_DARK) : cores[i % 8]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Clientes que mais chamam */}
          {m.porCliente.length > 0 && (
            <div style={CARD}>
              <span style={SEC}>Clientes com mais chamados</span>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                {m.porCliente.map((c, i) => (
                  <div
                    key={c.nome}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                      borderTop: i === 0 ? "none" : isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>
                      {c.nome}
                    </span>
                    <div
                      style={{
                        width: 90, height: 6, borderRadius: 3, overflow: "hidden", flexShrink: 0,
                        background: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          width: `${(c.valor / m.porCliente[0].valor) * 100}%`, height: "100%",
                          background: cores[i % 8],
                        }}
                      />
                    </div>
                    <span
                      style={{
                        minWidth: 22, textAlign: "right", flexShrink: 0,
                        fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 700,
                        color: gold, fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {c.valor}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
