// O painel superior da Início (desktop) — U18, sobre o desenho anotado do Davi.
//
//   [ Prazos futuros ][ Meta do mês ][ 4 indicadores ][ Notificações ]
//
// Todos minimalistas, todos nas cartelas de dataviz (paleta.ts → DATAVIZ), que
// existem separadas das escalas de status de propósito: gráfico fala de DADOS,
// chip de status fala de ESTADO — misturar os vocabulários faria o quadro e os
// gráficos parecerem discordar um do outro.
//
// DEMANDA NO TEMPO: as últimas 4 semanas (quantos foram concluídos em cada
// uma) e as próximas 4 (quantos têm prazo em cada uma). Minimalista por ordem
// expressa: título, o primeiro dia de cada semana e a quantidade — nada mais.
// As cores contam a história: o passado esfria do azul para o verde (feito),
// o futuro esquenta do vermelho (semana atual) para o amarelo (adiante).
// Os concluídos vêm de consulta própria: a Home poda encerrados com mais de
// 7 dias, e as barras do passado precisam de 4 semanas inteiras.
//
// META DO MÊS: rosca com o % das prioridades do sprint `este_mes` concluídas.
// Consulta o banco à parte de propósito — a Home poda encerrados com mais de
// 7 dias, e uma meta mensal que esquece o começo do mês estaria sempre errada
// na última semana.
//
// (A caixa de notificações que morava aqui virou o sino da sidebar na U20;
// o quarto painel é a criação rápida por IA — CriarRapido.tsx.)

import { useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { inicioSemana, dataIso } from "@/lib/periodos";
import { DATAVIZ, SUPERNOVA } from "@/lib/paleta";
import type { Atividade } from "@/features/atividades/modelo";

const ALTURA = 252;
const MAX_PECAS = 7;

const MICRO: CSSProperties = {
  fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
  letterSpacing: "0.10em", textTransform: "uppercase",
};

function useCoresBase() {
  const { isLight } = useTheme();
  return {
    isLight,
    textPrimary: isLight ? "#0a0b0e" : "#ffffff",
    textSecondary: isLight ? "#4a5060" : "rgba(255,255,255,0.55)",
    gold: isLight ? SUPERNOVA[700] : SUPERNOVA[400],
    tile: isLight ? "#f7f7f5" : "rgba(255,255,255,0.03)",
  };
}

// ── Demanda no tempo ────────────────────────────────────────────────────────

interface PropsDemanda {
  atividades: Atividade[];
}

/** Concluídos por semana nas últimas 4 — consulta própria (ver cabeçalho). */
function useConcluidosPorSemana() {
  const inicioJanela = useMemo(() => {
    const base = inicioSemana(new Date());
    base.setDate(base.getDate() - 28);
    return dataIso(base);
  }, []);
  return useQuery({
    queryKey: ["home-concluidos-semana", inicioJanela],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("chamados" as any)
        .select("concluida_em")
        .eq("status", "concluido")
        .gte("concluida_em", inicioJanela);
      const m: Record<string, number> = {};
      if (error) return m;
      for (const r of ((data as any[]) ?? [])) {
        if (!r.concluida_em) continue;
        const k = dataIso(inicioSemana(new Date(r.concluida_em)));
        m[k] = (m[k] ?? 0) + 1;
      }
      return m;
    },
  });
}

// o passado esfria (azul → verde: feito); o futuro esquenta a partir de agora
// (vermelho na semana atual → amarelo adiante). Cartelas do Davi.
const CORES_PASSADO = {
  dark: ["#547792", "#457B9D", "#6EE7C2", "#2DD2A5"],
  light: ["#1A3263", "#457B9D", "#059676", "#047862"],
};
const CORES_FUTURO = {
  dark: ["#E63946", "#EA9A35", "#FAB95B", "#F4D35E"],
  light: ["#8B1E2D", "#A63E17", "#C85917", "#E4B028"],
};

export function GraficoDemanda({ atividades }: PropsDemanda) {
  const { isLight, textPrimary, textSecondary, gold } = useCoresBase();
  const { data: concluidos } = useConcluidosPorSemana();

  const barras = useMemo(() => {
    const base = inicioSemana(new Date());
    const lista: { chave: string; rotulo: string; valor: number; cor: string; atual: boolean }[] = [];

    // futuro por prazo, contado das atividades em aberto
    const futuros: Record<string, number> = {};
    for (const a of atividades) {
      if (!a.emAberto || !a.prazoLimite) continue;
      const k = dataIso(inicioSemana(new Date(a.prazoLimite)));
      futuros[k] = (futuros[k] ?? 0) + 1;
    }

    for (let i = -4; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i * 7);
      const chave = dataIso(d);
      const passado = i < 0;
      const cores = passado ? CORES_PASSADO : CORES_FUTURO;
      const idx = passado ? i + 4 : i;
      lista.push({
        chave,
        rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: passado ? (concluidos?.[chave] ?? 0) : (futuros[chave] ?? 0),
        cor: isLight ? cores.light[idx] : cores.dark[idx],
        atual: i === 0,
      });
    }
    return lista;
  }, [atividades, concluidos, isLight]);

  const maximo = Math.max(1, ...barras.map((b) => b.valor));

  return (
    <div style={{ ...card(isLight), flex: 2, minWidth: 430, height: ALTURA, padding: "14px 18px 12px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <span style={{ ...MICRO, color: gold }}>Demanda no tempo</span>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 10, paddingTop: 12 }}>
        {barras.map((b) => (
          <div key={b.chave} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 13, color: b.cor,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {b.valor}
            </span>
            <div style={{
              width: "100%",
              maxWidth: 40,
              height: b.valor === 0 ? 3 : Math.max(8, Math.round((b.valor / maximo) * 128)),
              borderRadius: 8,
              background: b.cor,
              opacity: b.valor === 0 ? 0.28 : 1,
              transition: "height .4s ease",
            }} />
            <span style={{
              fontFamily: FONT,
              fontWeight: b.atual ? 700 : 300,
              fontSize: 10,
              color: b.atual ? textPrimary : textSecondary,
              whiteSpace: "nowrap",
            }}>
              {b.rotulo}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Meta do mês ─────────────────────────────────────────────────────────────

export function useMetaDoMes(userId: string | null) {
  // mês corrente na chave: na virada, a consulta renova sozinha
  const mes = new Date().toISOString().slice(0, 7);
  return useQuery({
    queryKey: ["home-meta-mes", userId, mes],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ total: number; feitas: number }> => {
      const { data, error } = await supabase
        .from("chamados" as any)
        .select("status")
        .eq("natureza", "interno")
        .eq("sprint", "este_mes")
        .eq("responsavel_id", userId as string);
      if (error) return { total: 0, feitas: 0 };
      const linhas = ((data as any[]) ?? []).filter((r) => r.status !== "cancelado");
      return {
        total: linhas.length,
        feitas: linhas.filter((r) => r.status === "concluido").length,
      };
    },
  });
}

export function GraficoMeta({ userId }: { userId: string | null }) {
  const { isLight, textPrimary, textSecondary, gold } = useCoresBase();
  const { data } = useMetaDoMes(userId);

  const total = data?.total ?? 0;
  const feitas = data?.feitas ?? 0;
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const mesNome = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const arco = isLight ? DATAVIZ.ambar.light : DATAVIZ.ambar.dark;
  const cheio = isLight ? DATAVIZ.azul.light : DATAVIZ.azul.dark;

  return (
    <div style={{ ...card(isLight), width: 224, flexShrink: 0, height: ALTURA, padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, alignSelf: "stretch" }}>
        <span style={{ ...MICRO, color: gold }}>Meta do mês</span>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11, color: textSecondary }}>{mesNome}</span>
      </div>

      {total === 0 ? (
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary,
          textAlign: "center", lineHeight: 1.5,
        }}>
          Sem prioridades no sprint deste mês.
        </div>
      ) : (
        <>
          <svg width={140} height={140} viewBox="0 0 140 140" style={{ marginTop: 8 }}>
            <circle
              cx="70" cy="70" r={R} fill="none" strokeWidth="11"
              stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)"}
            />
            <circle
              cx="70" cy="70" r={R} fill="none" strokeWidth="11"
              stroke={pct >= 100 ? cheio : arco}
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
            <text x="70" y="68" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="27" fill={textPrimary}>
              {pct}%
            </text>
            <text x="70" y="87" textAnchor="middle" fontFamily={FONT} fontWeight="300" fontSize="11"
              fill={isLight ? "#4a5060" : "rgba(255,255,255,0.55)"}>
              {feitas} de {total}
            </text>
          </svg>
        </>
      )}
    </div>
  );
}

// ── Os quatro indicadores ───────────────────────────────────────────────────

export function PainelKpis({ atividades, userId }: { atividades: Atividade[]; userId: string | null }) {
  const { isLight, textSecondary } = useCoresBase();
  const { data: meta } = useMetaDoMes(userId);

  const urgentes = atividades.filter(
    (a) => a.emAberto && a.tipo === "corretiva" && a.prioridade === "urgente",
  ).length;
  const atrasadas = atividades.filter((a) => a.emAberto && a.prazoEstourado).length;

  const tema = (p: { dark: string; light: string }) => (isLight ? p.light : p.dark);
  const kpis = [
    { rotulo: "Concluídas no mês", valor: meta?.feitas ?? 0, cor: tema(DATAVIZ.azul) },
    { rotulo: "Faltam no mês", valor: (meta?.total ?? 0) - (meta?.feitas ?? 0), cor: tema(DATAVIZ.ambar) },
    { rotulo: "Corretivas urgentes", valor: urgentes, cor: tema(DATAVIZ.alerta) },
    // a quarta ficou por minha conta: atrasado em aberto é o que pega fogo —
    // é o número que decide o começo do dia de quem coordena
    { rotulo: "Atrasadas em aberto", valor: atrasadas, cor: tema(DATAVIZ.vinho) },
  ];

  return (
    <div style={{ width: 268, flexShrink: 0, height: ALTURA, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, boxSizing: "border-box" }}>
      {kpis.map((k) => (
        <div key={k.rotulo} style={{
          ...card(isLight),
          padding: "10px 12px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 6,
          boxSizing: "border-box",
        }}>
          {/* a cor mora no NÚMERO — a bolinha saiu */}
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40, color: k.cor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {k.valor}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: textSecondary, lineHeight: 1.3, textAlign: "center" }}>
            {k.rotulo}
          </div>
        </div>
      ))}
    </div>
  );
}
