// Os dois gráficos da faixa superior da Início (desktop). Etapa U17.
//
// 1. ENTREGAS POR SEMANA — barras onde cada "pedaço" arredondado É um chamado
//    (a referência é o dashboard Nixtio que o Davi escolheu: segmentos soltos
//    empilhados, não uma barra contínua). Semana atual + 4 seguintes, semanas
//    começando na segunda (mesma régua de lib/periodos, a do financeiro).
//    Entram as atividades EM ABERTO que têm prazo; o pedaço usa a cor do
//    status, e vermelho quando o prazo já estourou. Clicar abre o chamado.
//
// 2. META DO MÊS — rosca com o % das prioridades do mês já concluídas. O
//    "mapeamento da reunião de alinhamento" já existe no sistema: é o sprint
//    `este_mes` dos chamados internos (o quadro que veio do Notion). A rosca é
//    PESSOAL — conta o que é do usuário logado — e consulta o banco à parte,
//    de propósito: a Home poda encerrados com mais de 7 dias, e uma meta
//    mensal que esquece o que foi concluído no início do mês estaria sempre
//    errada na última semana.

import { useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { inicioSemana, dataIso } from "@/lib/periodos";
import { SUPERNOVA, SHAMROCK, MAHOGANY } from "@/lib/paleta";
import type { Atividade } from "@/features/atividades/modelo";

const ALTURA_CARD = 216;
const MAX_PECAS = 10;

const MICRO: CSSProperties = {
  fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
  letterSpacing: "0.10em", textTransform: "uppercase",
};

// ── 1. Entregas por semana ──────────────────────────────────────────────────

interface PropsSemanas {
  atividades: Atividade[];
  onAbrir: (a: Atividade) => void;
}

export function GraficoSemanas({ atividades, onAbrir }: PropsSemanas) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? SUPERNOVA[700] : SUPERNOVA[400];

  const semanas = useMemo(() => {
    const base = inicioSemana(new Date());
    const chaves: { chave: string; inicio: Date }[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i * 7);
      chaves.push({ chave: dataIso(d), inicio: d });
    }
    const porSemana = new Map<string, Atividade[]>(chaves.map((c) => [c.chave, []]));
    for (const a of atividades) {
      if (!a.emAberto || !a.prazoLimite) continue;
      const k = dataIso(inicioSemana(new Date(a.prazoLimite)));
      porSemana.get(k)?.push(a);
    }
    for (const lista of porSemana.values()) {
      lista.sort((x, y) => (x.prazoLimite! < y.prazoLimite! ? -1 : 1));
    }
    return chaves.map((c, i) => ({
      ...c,
      itens: porSemana.get(c.chave) ?? [],
      rotulo: i === 0
        ? "Esta sem."
        : c.inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));
  }, [atividades]);

  return (
    <div style={{ ...card(isLight), flex: 1, minWidth: 0, height: ALTURA_CARD, padding: "14px 18px 12px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...MICRO, color: gold }}>Entregas por semana</span>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11, color: textSecondary }}>
          chamados com prazo · próximas 5 semanas
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 18, paddingTop: 10 }}>
        {semanas.map((s) => {
          const visiveis = s.itens.slice(0, MAX_PECAS);
          const excedente = s.itens.length - visiveis.length;
          return (
            <div key={s.chave} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <span style={{
                fontFamily: FONT, fontWeight: 600, fontSize: 11.5, color: textPrimary,
                fontVariantNumeric: "tabular-nums",
              }}>
                {s.itens.length === 0 ? "—" : s.itens.length}
              </span>
              <div style={{ display: "flex", flexDirection: "column-reverse", gap: 3, width: "100%", maxWidth: 46 }}>
                {excedente > 0 && (
                  <span style={{
                    fontFamily: FONT, fontWeight: 600, fontSize: 9.5, color: textSecondary,
                    textAlign: "center", order: 1,
                  }}>
                    +{excedente}
                  </span>
                )}
                {visiveis.map((a) => {
                  const cor = a.prazoEstourado
                    ? (isLight ? MAHOGANY[600] : MAHOGANY[400])
                    : (isLight ? a.statusCor.light : a.statusCor.dark);
                  return (
                    // cada pedaço é UM chamado — clicável, com o resumo no hover
                    <button
                      key={a.id}
                      onClick={() => onAbrir(a)}
                      title={`${a.numero ?? ""} ${a.titulo}${a.prazoTexto ? ` · ${a.prazoTexto}` : ""}`}
                      style={{
                        height: 11, width: "100%", borderRadius: 6, border: "none",
                        background: cor, cursor: "pointer", padding: 0,
                        opacity: 0.92,
                      }}
                    />
                  );
                })}
              </div>
              <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 10.5, color: textSecondary, whiteSpace: "nowrap" }}>
                {s.rotulo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 2. Meta do mês ──────────────────────────────────────────────────────────

function useMetaDoMes(userId: string | null) {
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
  const { isLight } = useTheme();
  const { data } = useMetaDoMes(userId);
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? SUPERNOVA[700] : SUPERNOVA[400];
  const verde = isLight ? SHAMROCK[600] : SHAMROCK[400];

  const total = data?.total ?? 0;
  const feitas = data?.feitas ?? 0;
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  // rosca em SVG puro: círculo de trilho + arco de progresso com ponta redonda
  const R = 56;
  const CIRC = 2 * Math.PI * R;
  const mesNome = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div style={{ ...card(isLight), width: 300, flexShrink: 0, height: ALTURA_CARD, padding: "14px 18px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...MICRO, color: gold }}>Meta do mês</span>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11, color: textSecondary }}>
          {mesNome}
        </span>
      </div>

      {total === 0 ? (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT, fontWeight: 300, fontSize: 12, color: textSecondary,
          textAlign: "center", padding: "0 12px", lineHeight: 1.5,
        }}>
          Sem prioridades mapeadas no sprint deste mês.
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16 }}>
          <svg width={132} height={132} viewBox="0 0 132 132" style={{ flexShrink: 0 }}>
            <circle
              cx="66" cy="66" r={R} fill="none" strokeWidth="12"
              stroke={isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)"}
            />
            <circle
              cx="66" cy="66" r={R} fill="none" strokeWidth="12"
              stroke={pct >= 100 ? verde : gold}
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
              transform="rotate(-90 66 66)"
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
            <text
              x="66" y="63" textAnchor="middle"
              fontFamily={FONT} fontWeight="700" fontSize="26"
              fill={textPrimary} style={{ fontVariantNumeric: "tabular-nums" } as any}
            >
              {pct}%
            </text>
            <text
              x="66" y="82" textAnchor="middle"
              fontFamily={FONT} fontWeight="300" fontSize="11"
              fill={isLight ? "#4a5060" : "rgba(255,255,255,0.55)"}
            >
              {feitas} de {total}
            </text>
          </svg>
          <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary, lineHeight: 1.55 }}>
            Prioridades do alinhamento mensal (sprint <b style={{ color: textPrimary, fontWeight: 600 }}>Este mês</b>) que você já concluiu.
          </div>
        </div>
      )}
    </div>
  );
}
