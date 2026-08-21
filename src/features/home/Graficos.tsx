// O painel superior da Início (desktop) — U18, sobre o desenho anotado do Davi.
//
//   [ Prazos futuros ][ Meta do mês ][ 4 indicadores ][ Notificações ]
//
// Todos minimalistas, todos no ESPECTRO (paleta.ts) — a rampa de 8 cores
// derivada da paleta do Davi, normalizada em luminosidade e croma. Ela existe
// separada das escalas de status de propósito: gráfico fala de DADOS, chip de
// status fala de ESTADO — misturar os vocabulários faria o quadro e os
// gráficos parecerem discordar um do outro.
//
// DEMANDA NO TEMPO: as últimas 4 semanas (quantos foram concluídos em cada
// uma) e as próximas 4 (quantos têm prazo em cada uma). Minimalista por ordem
// expressa: título, o primeiro dia de cada semana e a quantidade — nada mais.
//
// O fundo dos painéis é a superfície normal do sistema — a mesma dos tiles de
// indicador ao lado. Cheguei a pôr o degradê da imagem borrado por trás do
// vidro; o Davi mandou tirar (2026-08-20): com quatro caixas coloridas em
// sequência, o painel virou o assunto da tela, e o assunto é o quadro embaixo.
// O degradê vive nos DADOS — nas barras, no arco — não atrás deles.
//
// As cores são o ESPECTRO (paleta.ts) — v7, ancorada nos amarelos da marca — e o
// degradê ATRAVESSA as barras: cada uma vai da sua cor à da seguinte, então o
// pé direito de uma emenda no pé esquerdo da próxima e as oito lêem como uma
// rampa só. Barras quase coladas, com brilho especular e granulado
// (.textura) — material, não plástico.
//
// A rampa das barras é a do degradê INVERTIDA (pedido do Davi, 2026-08-20):
// vermelho no passado, amarelo na semana corrente, azul no futuro. Além de ser
// o que ele pediu, conserta uma contradição que eu tinha deixado na tela — os
// cards dizem "adiante = azul" e as barras diziam "adiante = vermelho".
//
// O NÚMERO da barra usa ESPECTRO_TEXTO, não a cor da barra: a rampa clara é
// de preenchimento (≥3:1) e texto de 13px exige 4.5:1.
//
// META DO MÊS: rosca com o % das prioridades do sprint `este_mes` concluídas.
//
// TUDO AQUI CONTA DAS ATIVIDADES QUE CHEGAM POR PROPRIEDADE (U33). Antes, as
// barras do passado e a meta vinham de consultas próprias que traziam números
// prontos — e número pronto não tem como ser recortado pelos filtros do
// quadro. O resultado era um painel que dizia "42" enquanto o quadro embaixo,
// filtrado, mostrava 6: duas telas contando histórias diferentes sobre a mesma
// operação. Agora quem monta o recorte é a Início, e estes componentes só
// pintam o que recebem.
//
// Quem chama precisa passar um conjunto AMPLO o bastante: a Home poda
// encerrados com mais de 7 dias, e quatro semanas de barras — mais a meta do
// mês — precisam do histórico. É o que `useHistoricoAmplo` traz.
//
// (A caixa de notificações que morava aqui virou o sino da sidebar na U20;
// o quarto painel é a criação rápida por IA — CriarRapido.tsx.)

import { useMemo, type CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { inicioSemana, dataIso } from "@/lib/periodos";
import { PRISMA, ESPECTRO, ESPECTRO_STOPS, ESPECTRO_TEXTO, gradienteBarra } from "@/lib/paleta";
import type { Atividade } from "@/features/atividades/modelo";
// as contas moram em metricas.ts: puras, testáveis, longe da pintura
import { concluidosPorSemana, metaDoMes } from "@/features/home/metricas";

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
    // um amarelo só na Início: o do degradê. O dourado da marca fica nos
    // botões e no logotipo, onde ele é gradiente e lê como coisa própria.
    gold: isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
    tile: isLight ? "#f7f7f5" : "rgba(255,255,255,0.03)",
  };
}

// ── Demanda no tempo ────────────────────────────────────────────────────────

interface PropsDemanda {
  atividades: Atividade[];
}

export function GraficoDemanda({ atividades }: PropsDemanda) {
  const { isLight, textPrimary, textSecondary, gold } = useCoresBase();
  const concluidos = useMemo(() => concluidosPorSemana(atividades), [atividades]);

  // invertida: o passado é quente, o futuro é frio — a mesma leitura da faixa
  // de prazo nos cards, onde "adiante" é azul
  const rampa = useMemo(() => [...(isLight ? ESPECTRO.light : ESPECTRO.dark)].reverse(), [isLight]);
  const rampaTexto = useMemo(() => [...(isLight ? ESPECTRO_TEXTO.light : ESPECTRO_TEXTO.dark)].reverse(), [isLight]);

  const barras = useMemo(() => {
    const base = inicioSemana(new Date());
    const lista: { chave: string; rotulo: string; valor: number; cor: string;
                   corFim: string; corTexto: string; atual: boolean }[] = [];

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
      const idx = i + 4;                       // 0..7 ao longo do espectro
      lista.push({
        chave,
        rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: passado ? (concluidos[chave] ?? 0) : (futuros[chave] ?? 0),
        // a barra vai da SUA cor à da próxima: o degradê não quebra na emenda
        cor: rampa[idx],
        corFim: rampa[idx + 1],
        corTexto: rampaTexto[idx],
        atual: i === 0,
      });
    }
    return lista;
  }, [atividades, concluidos, rampa, rampaTexto]);

  const maximo = Math.max(1, ...barras.map((b) => b.valor));

  return (
    <div className="elevavel" style={{ ...card(isLight), flex: 2, minWidth: 430, height: ALTURA, padding: "14px 18px 12px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <span style={{ ...MICRO, color: gold }}>Demanda no tempo</span>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end", gap: 3, paddingTop: 12 }}>
        {barras.map((b) => (
          <div key={b.chave} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 13, color: b.corTexto,
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {b.valor}
            </span>
            <div
              className="barra-demanda textura"
              title={`${b.valor} atividade${b.valor === 1 ? "" : "s"} · semana de ${b.rotulo}`}
              style={{
                width: "100%",
                height: b.valor === 0 ? 3 : Math.max(10, Math.round((b.valor / maximo) * 124)),
                borderRadius: 7,
                background: gradienteBarra(b.cor, b.corFim, isLight),
                opacity: b.valor === 0 ? (isLight ? 0.55 : 0.3) : 1,
              }} />
            <span style={{
              fontFamily: FONT,
              fontWeight: b.atual ? 700 : 400,
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

export function GraficoMeta({ atividades }: { atividades: Atividade[] }) {
  const { isLight, textPrimary, textSecondary, gold } = useCoresBase();
  const { total, feitas } = useMemo(() => metaDoMes(atividades), [atividades]);

  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  // rosca maior, centrada e sem texto auxiliar: só a porcentagem
  const R = 68;
  const CIRC = 2 * Math.PI * R;
  const mesNome = new Date().toLocaleDateString("pt-BR", { month: "long" });
  // as paradas do degradê da casa na ordem ORIGINAL (identidade) — só as
  // barras rodam invertidas, porque lá a rampa é eixo do tempo
  const paradas = (isLight ? ESPECTRO_STOPS.light : ESPECTRO_STOPS.dark)
    .map((p) => { const [cor, pos] = p.split(" "); return { cor, pos }; });

  return (
    <div className="elevavel" style={{ ...card(isLight), width: 224, flexShrink: 0, height: ALTURA, padding: "14px 16px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ ...MICRO, color: gold }}>Meta do mês</span>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>{mesNome}</span>
      </div>

      {total === 0 ? (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary,
          textAlign: "center", lineHeight: 1.5,
        }}>
          Sem prioridades no sprint deste mês.
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          {/* sem .ruido: sobre uma linha curva de 14px o granulado serrilhou
              a borda em vez de dar textura — pedido do Davi para tirar. O
              acabamento aqui é o halo do próprio arco (feDropShadow). */}
          <div className="rosca-meta" style={{ position: "relative", borderRadius: "50%", lineHeight: 0 }}>
            <svg width={176} height={176} viewBox="0 0 176 176">
              <defs>
                {/* o mesmo espectro das barras, agora percorrendo o arco */}
                <linearGradient id="grad-meta" x1="0" y1="1" x2="1" y2="0">
                  {paradas.map((p, i) => (
                    <stop key={`${p.cor}-${i}`} offset={p.pos} stopColor={p.cor} />
                  ))}
                </linearGradient>
                {/* glow: o arco derrama a própria cor no fundo, de leve */}
                <filter id="glow-meta" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="0" stdDeviation="7"
                    floodColor={isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark}
                    floodOpacity={isLight ? 0.30 : 0.55} />
                </filter>
              </defs>
              <circle
                cx="88" cy="88" r={R} fill="none" strokeWidth="14"
                stroke={isLight ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.06)"}
              />
              <circle
                cx="88" cy="88" r={R} fill="none" strokeWidth="14"
                stroke="url(#grad-meta)"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
                transform="rotate(-90 88 88)"
                filter="url(#glow-meta)"
                style={{ transition: "stroke-dasharray .6s ease" }}
              />
              <text
                x="88" y="88" textAnchor="middle" dominantBaseline="central"
                fontFamily={FONT} fontWeight="100" fontSize="52"
                fill={textPrimary}
                style={{ letterSpacing: "-0.02em" } as any}
              >
                {pct}%
              </text>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Os quatro indicadores ───────────────────────────────────────────────────

export function PainelKpis({ atividades }: { atividades: Atividade[] }) {
  const { isLight, textSecondary } = useCoresBase();
  const meta = useMemo(() => metaDoMes(atividades), [atividades]);

  const urgentes = atividades.filter(
    (a) => a.emAberto && a.tipo === "corretiva" && a.prioridade === "urgente",
  ).length;
  const atrasadas = atividades.filter((a) => a.emAberto && a.prazoEstourado).length;

  // As quatro cores são as MESMAS do fundo dos cards, e de propósito: quem vê
  // "3" em vermelho aqui procura os três cards vermelhos no quadro abaixo e os
  // acha. Azul = feito, amarelo = a fazer, laranja/vermelho = o que arde.
  const cor = (c: { dark: string; light: string }) => (isLight ? c.light : c.dark);
  const kpis = [
    { rotulo: "Concluídas no mês", valor: meta.feitas, cor: cor(PRISMA.azul) },
    { rotulo: "Faltam no mês", valor: meta.total - meta.feitas, cor: cor(PRISMA.amarelo) },
    { rotulo: "Corretivas urgentes", valor: urgentes, cor: cor(PRISMA.laranja) },
    // a quarta ficou por minha conta: atrasado em aberto é o que pega fogo —
    // é o número que decide o começo do dia de quem coordena
    { rotulo: "Atrasadas em aberto", valor: atrasadas, cor: cor(PRISMA.vermelho) },
  ];

  return (
    <div style={{ width: 268, flexShrink: 0, height: ALTURA, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, boxSizing: "border-box" }}>
      {kpis.map((k) => (
        <div key={k.rotulo} className="elevavel kpi-tile ruido" style={{
          ...card(isLight),
          padding: "10px 12px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 6,
          boxSizing: "border-box",
        }}>
          {/* a cor mora no NÚMERO — a bolinha saiu */}
          <div className="kpi-num" style={{
            // Montserrat Bold com glow levíssimo (pedido do Davi). O halo é a
            // PRÓPRIA cor do número em alfa baixo (~35%): cada indicador
            // brilha no seu tom em vez de todos ganharem o mesmo véu branco.
            fontFamily: FONT, fontWeight: 700, fontSize: 40, color: k.cor,
            textShadow: `0 0 14px ${k.cor}59`,
            fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {k.valor}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: textSecondary, lineHeight: 1.3, textAlign: "center" }}>
            {k.rotulo}
          </div>
        </div>
      ))}
    </div>
  );
}
