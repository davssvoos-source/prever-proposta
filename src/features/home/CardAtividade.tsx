// O card de atividade — o mesmo nas duas visões, para que trocar de lista para
// quadro não mude o que se lê, só como se arruma.
//
// Piso de tipografia: 11px. O app trava o zoom (`maximum-scale=1` em
// __root.tsx), então texto pequeno demais não tem conserto do lado do usuário —
// e quem lê isto está no sol, com luva, brilho reduzido pelo calor.
//
// COR DE FUNDO = PRAZO (2026-08-20). O card inteiro responde "quando vence?"
// antes de a pessoa ler uma palavra: amarelo esta semana, azul dali em diante,
// vermelho em atraso. As três cores saem do PRISMA, a paleta do degradê.

import type { CSSProperties } from "react";
import { Building2, CalendarClock, AlertTriangle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { AvatarPilha, type PessoaAvatar } from "@/components/AvatarPilha";
import {
  BOLA_LABEL, ALERTA_LABEL, faixaPrazo,
  type Atividade, type Cores, type FaixaPrazo,
} from "@/features/atividades/modelo";

export const PISO_TIPO = 11;

/**
 * Chip de rótulo. `sobreFaixa` troca o véu colorido por um cinza translúcido:
 * num card amarelo, um chip amarelo some, e um chip azul briga. A cor da
 * categoria sobrevive no TEXTO, que é onde ela precisa estar — o fundo do chip
 * volta a ser só um suporte de leitura.
 */
export function chipStyle(c: Cores, isLight: boolean, sobreFaixa = false): CSSProperties {
  return {
    padding: "3px 9px",
    borderRadius: 999,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: PISO_TIPO,
    letterSpacing: "0.04em",
    color: isLight ? c.light : c.dark,
    background: sobreFaixa
      ? (isLight ? "rgba(255,255,255,0.62)" : "rgba(0,0,0,0.24)")
      : c.bg,
    whiteSpace: "nowrap",
  };
}

/**
 * A pintura de cada faixa. O véu do tema claro é mais forte no amarelo e mais
 * fraco no vermelho e no azul de propósito: sobre branco, amarelo em 8% não
 * aparece, e vermelho em 16% vira alarme. O `glow` é uma sombra na própria cor
 * — é o que faz as três faixas se lerem de longe, varrendo o quadro.
 */
const FAIXA: Record<Exclude<FaixaPrazo, null>, {
  rgb: string; bgDark: number; bgLight: number; brDark: number; brLight: number;
}> = {
  // As três cores são LITERALMENTE as pontas e o meio do degradê (v6), não
  // aproximações dele: PRISMA.vermelho, PRISMA.amarelo e PRISMA.azul. O
  // vermelho é o mesmo dos botões do sistema.
  atraso:      { rgb: "241,120,129", bgDark: 0.16, bgLight: 0.075, brDark: 0.34, brLight: 0.22 },
  // o amarelo — 40% do degradê, o principal, e a faixa que decide o dia
  esta_semana: { rgb: "248,200,17",  bgDark: 0.15, bgLight: 0.20,  brDark: 0.32, brLight: 0.34 },
  // o azul da ponta fria: presente, mas sem pressa
  adiante:     { rgb: "79,148,233",  bgDark: 0.17, bgLight: 0.10,  brDark: 0.34, brLight: 0.22 },
};

interface Props {
  a: Atividade;
  onClick: () => void;
  /** No quadro a coluna já diz o status; repetir o chip é ruído. */
  mostrarStatus?: boolean;
  /** Perfis para a pilha de avatares dos participantes. */
  pessoas?: Record<string, PessoaAvatar>;
}

export function CardAtividade({ a, onClick, mostrarStatus = true, pessoas }: Props) {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.58)";
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  const ambar = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;

  const faixa = faixaPrazo(a);
  const f = faixa ? FAIXA[faixa] : null;

  // v4 neo-minimalista: superfície sólida, canto redondo, sombra leve. Sobre
  // ela, quando há prazo, o véu da faixa + um halo na mesma cor.
  const CARD: CSSProperties = {
    ...card(isLight),
    ...(f ? {
      background: `rgba(${f.rgb},${isLight ? f.bgLight : f.bgDark})`,
      border: `1px solid rgba(${f.rgb},${isLight ? f.brLight : f.brDark})`,
      boxShadow: isLight
        ? `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(${f.rgb},0.16)`
        : `0 1px 2px rgba(0,0,0,0.50), 0 8px 26px rgba(${f.rgb},0.14)`,
    } : {}),
    borderRadius: 16,
    padding: "12px 14px",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    display: "block",
    // alvo confortável mesmo com luva
    minHeight: 76,
  };

  const emFaixa = !!f;

  return (
    <button onClick={onClick} className="elevavel" style={CARD}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 14, lineHeight: 1.35,
            color: textPrimary, textWrap: "pretty" as any,
            display: "flex", alignItems: "baseline", gap: 7,
          }}>
            <span aria-hidden style={{
              width: 7, height: 7, borderRadius: 4, flexShrink: 0,
              background: isLight ? a.statusCor.light : a.statusCor.dark,
              transform: "translateY(-1px)",
            }} />
            <span style={{ minWidth: 0 }}>{a.titulo}</span>
          </div>
        </div>
        {mostrarStatus && (
          <span style={{ ...chipStyle(a.statusCor, isLight, emFaixa), flexShrink: 0 }}>
            {a.statusLabel}
          </span>
        )}
      </div>

      {/* O que a coluna apagou: por que este item está aqui, e com quem está a bola */}
      {(a.rotuloNativo || a.bolaCom) && (
        <div style={{
          fontFamily: FONT, fontWeight: 400, fontSize: PISO_TIPO,
          color: textSecondary, marginTop: 7, lineHeight: 1.4,
        }}>
          {a.rotuloNativo}
          {a.rotuloNativo && a.bolaCom ? " · " : ""}
          {a.bolaCom && <span style={{ color: ambar }}>{BOLA_LABEL[a.bolaCom]}</span>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
        {/* categoria com cor própria — o "strategic color" das referências */}
        {a.tipoLabel && a.tipoCor && (
          <span style={chipStyle(a.tipoCor, isLight, emFaixa)}>{a.tipoLabel}</span>
        )}
        {a.fonte === "visita" && (
          <span style={chipStyle(PRISMA.azulClaro, isLight, emFaixa)}>Visita técnica</span>
        )}
        {a.cliente && (
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT, fontSize: PISO_TIPO, color: textSecondary,
            minWidth: 0, maxWidth: "100%",
          }}>
            <Building2 size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.cliente}
            </span>
          </span>
        )}

        {a.prioridadeLabel && a.prioridadeCor && (
          <span style={chipStyle(a.prioridadeCor, isLight, emFaixa)}>{a.prioridadeLabel}</span>
        )}

        {a.compra && (
          <span style={chipStyle(PRISMA.pessego, isLight, emFaixa)}>
            {a.compra.situacaoLabel}
          </span>
        )}

        {a.alerta && (
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: FONT, fontWeight: 600, fontSize: PISO_TIPO,
            color: a.alerta === "reagendar" ? vermelho : ambar,
          }}>
            <AlertTriangle size={12} /> {ALERTA_LABEL[a.alerta]}
          </span>
        )}

      </div>

      {(a.participantes.length > 0 || a.prazoTexto) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
          {pessoas && <AvatarPilha ids={a.participantes} pessoas={pessoas} />}
          {a.prazoTexto && (
            <span style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
              fontFamily: FONT, fontWeight: 400, fontSize: PISO_TIPO,
              color: a.prazoEstourado ? vermelho : textSecondary,
            }}>
              <CalendarClock size={12} /> {a.prazoTexto}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
