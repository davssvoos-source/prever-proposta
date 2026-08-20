// O painel superior da Início (desktop) — U18, sobre o desenho anotado do Davi.
//
//   [ Prazos futuros ][ Meta do mês ][ 4 indicadores ][ Notificações ]
//
// Todos minimalistas, todos nas cartelas de dataviz (paleta.ts → DATAVIZ), que
// existem separadas das escalas de status de propósito: gráfico fala de DADOS,
// chip de status fala de ESTADO — misturar os vocabulários faria o quadro e os
// gráficos parecerem discordar um do outro.
//
// PRAZOS FUTUROS: cada pedaço arredondado é UM chamado, com o título dentro —
// o "algo que indique qual task é". A cor é pressão de tempo, não status:
// vermelho = atrasado · âmbar = vence nesta semana · frio = adiante.
//
// META DO MÊS: rosca com o % das prioridades do sprint `este_mes` concluídas.
// Consulta o banco à parte de propósito — a Home poda encerrados com mais de
// 7 dias, e uma meta mensal que esquece o começo do mês estaria sempre errada
// na última semana.
//
// NOTIFICAÇÕES: o mesmo hook do sino (useNotificacoes), que já é realtime —
// a tabela está na publicação desde junho. Clicar marca como lida e abre o
// registro.

import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { inicioSemana, dataIso } from "@/lib/periodos";
import { DATAVIZ, SUPERNOVA } from "@/lib/paleta";
import { useNotificacoes, tempoRelativo } from "@/hooks/useNotificacoes";
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

// ── Prazos futuros ──────────────────────────────────────────────────────────

interface PropsSemanas {
  atividades: Atividade[];
  onAbrir: (a: Atividade) => void;
}

export function GraficoSemanas({ atividades, onAbrir }: PropsSemanas) {
  const { isLight, textPrimary, textSecondary, gold, tile } = useCoresBase();

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

  // a cor é pressão de tempo, não status
  const corDe = (a: Atividade, idxSemana: number): string => {
    if (a.prazoEstourado) return isLight ? DATAVIZ.alerta.light : DATAVIZ.alerta.dark;
    if (idxSemana === 0) return isLight ? DATAVIZ.ambar.light : DATAVIZ.ambar.dark;
    return isLight ? DATAVIZ.frio.light : DATAVIZ.frio.dark;
  };

  const legenda = [
    { rotulo: "atrasada", cor: isLight ? DATAVIZ.alerta.light : DATAVIZ.alerta.dark },
    { rotulo: "esta semana", cor: isLight ? DATAVIZ.ambar.light : DATAVIZ.ambar.dark },
    { rotulo: "adiante", cor: isLight ? DATAVIZ.frio.light : DATAVIZ.frio.dark },
  ];

  return (
    <div style={{ ...card(isLight), flex: 2, minWidth: 430, height: ALTURA, padding: "14px 18px 10px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...MICRO, color: gold }}>Prazos futuros</span>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11, color: textSecondary }}>
          cada pedaço é um chamado
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {legenda.map((l) => (
            <span key={l.rotulo} style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FONT, fontWeight: 300, fontSize: 9.5, color: textSecondary }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: l.cor }} />
              {l.rotulo}
            </span>
          ))}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 12, paddingTop: 8 }}>
        {semanas.map((s, i) => {
          const visiveis = s.itens.slice(0, MAX_PECAS);
          const excedente = s.itens.length - visiveis.length;
          return (
            <div key={s.chave} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              {excedente > 0 && (
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 9.5, color: textSecondary, textAlign: "center" }}>
                  +{excedente}
                </span>
              )}
              <div style={{ display: "flex", flexDirection: "column-reverse", gap: 4 }}>
                {visiveis.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onAbrir(a)}
                    title={`${a.numero ?? ""} ${a.titulo}${a.prazoTexto ? ` · ${a.prazoTexto}` : ""}`}
                    style={{
                      height: 21, width: "100%", borderRadius: 7,
                      border: "none", cursor: "pointer", padding: "0 8px",
                      background: tile,
                      borderLeft: `3px solid ${corDe(a, i)}`,
                      display: "flex", alignItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{
                      fontFamily: FONT, fontWeight: 500, fontSize: 10, color: textPrimary,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {a.titulo}
                    </span>
                  </button>
                ))}
              </div>
              <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 10, color: textSecondary, textAlign: "center", whiteSpace: "nowrap" }}>
                {s.rotulo} <b style={{ fontWeight: 600, color: textPrimary }}>{s.itens.length || "—"}</b>
              </span>
            </div>
          );
        })}
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
          <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 10.5, color: textSecondary, marginTop: "auto" }}>
            prioridades do alinhamento mensal
          </span>
        </>
      )}
    </div>
  );
}

// ── Os quatro indicadores ───────────────────────────────────────────────────

export function PainelKpis({ atividades, userId }: { atividades: Atividade[]; userId: string | null }) {
  const { isLight, textPrimary, textSecondary, gold, tile } = useCoresBase();
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
          padding: "12px 13px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxSizing: "border-box",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: k.cor }} />
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: textPrimary, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {k.valor}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase", color: textSecondary, marginTop: 5, lineHeight: 1.3 }}>
              {k.rotulo}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Notificações recentes ───────────────────────────────────────────────────

export function CaixaNotificacoes() {
  const { isLight, textPrimary, textSecondary, gold, tile } = useCoresBase();
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarLida } = useNotificacoes();
  const recentes = notificacoes.slice(0, 4);

  function abrirNotificacao(n: (typeof recentes)[number]) {
    if (!n.lida) marcarLida(n.id);
    if (n.chamado_id) navigate({ to: "/chamados/$id", params: { id: n.chamado_id } });
    else if (n.visita_id) navigate({ to: "/visita/$id", params: { id: n.visita_id } });
  }

  return (
    <div style={{ ...card(isLight), flex: 1, minWidth: 264, height: ALTURA, padding: "14px 14px 10px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ ...MICRO, color: gold }}>Notificações</span>
        {naoLidas > 0 && (
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, color: isLight ? DATAVIZ.ambar.light : DATAVIZ.ambar.dark }}>
            {naoLidas} nova{naoLidas > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {recentes.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary }}>
          Nada por enquanto.
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
          {recentes.map((n) => (
            <button
              key={n.id}
              onClick={() => abrirNotificacao(n)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 9px", borderRadius: 10, border: "none",
                background: tile, cursor: "pointer", textAlign: "left",
                minHeight: 40,
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: 4, flexShrink: 0,
                background: n.lida
                  ? (isLight ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.20)")
                  : (isLight ? DATAVIZ.ambar.light : DATAVIZ.ambar.dark),
              }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: "block", fontFamily: FONT, fontWeight: n.lida ? 500 : 600,
                  fontSize: 11.5, color: textPrimary,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {n.titulo}
                </span>
                {n.corpo && (
                  <span style={{
                    display: "block", fontFamily: FONT, fontWeight: 300, fontSize: 10,
                    color: textSecondary,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {n.corpo}
                  </span>
                )}
              </span>
              <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 9.5, color: textSecondary, flexShrink: 0 }}>
                {tempoRelativo(n.created_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
