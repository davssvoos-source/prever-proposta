// O card de atividade — o mesmo nas duas visões, para que trocar de lista para
// quadro não mude o que se lê, só como se arruma.
//
// Piso de tipografia: 11px. O app trava o zoom (`maximum-scale=1` em
// __root.tsx), então texto pequeno demais não tem conserto do lado do usuário —
// e quem lê isto está no sol, com luva, brilho reduzido pelo calor.
//
// COR ESTRATÉGICA SÓ NA BORDA (R136, 2026-09-03 — revoga a v2026-08-20 desta
// mesma tela, que pintava o FUNDO inteiro). Davi, sobre a página Início: "os
// cards devem ter o fundo escuro no tema escuro e claro no tema claro, com
// SOMENTE a borda na cor estratégica (vermelho, amarelo, azul ou verde), e as
// bordas deverão ser da cor mais clara para a mais escura em degradê, além de
// ter um glow levíssimo no contorno". O fundo volta a ser a superfície neutra
// de `card()`; é a BORDA que responde "quando vence?" — vermelho em atraso,
// amarelo esta semana, azul dali em diante — e ganhou um quarto estado: verde
// quando a coluna é "concluído", o mesmo tom oficial de "terminado com
// sucesso" que o resto do app já usa (PRISMA.verde). Sem faixa de prazo e sem
// conclusão, a borda fica neutra.

import type { CSSProperties } from "react";
import { Building2, CalendarClock, AlertTriangle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, degradeDeBorda } from "@/lib/paleta";
import { AvatarPilha, type PessoaAvatar } from "@/components/AvatarPilha";
import {
  BOLA_LABEL, ALERTA_LABEL, faixaPrazo,
  type Atividade, type Cores, type FaixaPrazo,
} from "@/features/atividades/modelo";

export const PISO_TIPO = 11;

/**
 * Chip de rótulo — cor própria sempre, texto sobre o véu (`bg`) da categoria.
 * Até a R136 o fundo do card podia levar um véu colorido de prazo, e um chip
 * da mesma cor sumia nele ali dentro; o card agora é sempre a superfície
 * neutra (R136), então o chip não precisa mais fingir cinza para não brigar
 * com o fundo.
 */
export function chipStyle(c: Cores, isLight: boolean): CSSProperties {
  return {
    padding: "3px 9px",
    borderRadius: 999,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: PISO_TIPO,
    letterSpacing: "0.04em",
    color: isLight ? c.light : c.dark,
    background: c.bg,
    whiteSpace: "nowrap",
  };
}

/**
 * Quantas etiquetas de LOCAL cabem antes do "+N" (R84/R85, U71).
 *
 * Dois é o teto porque a coluna do quadro tem 260px e a fileira ainda carrega
 * tipo e prioridade. Com três nomes de condomínio a fileira quebra em duas
 * linhas e o card cresce, desalinhando a coluna inteira. O `title` continua
 * listando todos.
 */
const LOCAIS_NO_CARD = 2;

/**
 * A cor estratégica de cada card — sempre uma amostra literal do PRISMA:
 * vermelho, amarelo e azul são as pontas e o meio do degradê da marca (v6); o
 * quarto estado, verde, é o tom oficial de "terminado com sucesso" que 17+
 * telas do app já usam (ver o comentário de PRISMA.verde em paleta.ts). Nunca
 * duas fontes ao mesmo tempo — prazo vence conclusão, e as duas vencem o
 * neutro.
 */
type CorEstrategica = "atraso" | "esta_semana" | "adiante" | "concluido";

const PRISMA_DA_COR: Record<CorEstrategica, keyof typeof PRISMA> = {
  atraso: "vermelho",
  esta_semana: "amarelo",
  adiante: "azul",
  concluido: "verde",
};

function corEstrategicaDe(a: Atividade, faixa: FaixaPrazo): CorEstrategica | null {
  if (faixa) return faixa;
  return a.coluna === "concluido" ? "concluido" : null;
}

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
  const corChave = corEstrategicaDe(a, faixa);
  const p = corChave ? PRISMA[PRISMA_DA_COR[corChave]] : null;
  const corBase = p ? (isLight ? p.light : p.dark) : null;

  // v5 (R136): o fundo é sempre a superfície neutra de `card()` — escura no
  // tema escuro, clara no tema claro. Só a BORDA carrega a cor estratégica, em
  // degradê claro→escuro (`degradeDeBorda`), com um glow levíssimo por fora
  // (blur largo, o `bg` do próprio PRISMA — já é um véu de 14%, não precisou
  // de um número novo). O truque de duas camadas de `background` (uma sólida
  // em padding-box, o degradê em border-box) é o único jeito de um `border`
  // ter gradiente em CSS puro — por isso não dá para só espalhar
  // `card(isLight)` quando há cor: o `background` sólido dele tomaria o lugar
  // das duas camadas.
  const cardBase = card(isLight);
  const CARD: CSSProperties = corBase && p
    ? {
        backgroundImage: `linear-gradient(${cardBase.background}, ${cardBase.background}), ${degradeDeBorda(corBase)}`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        border: "1.5px solid transparent",
        borderRadius: 16,
        boxShadow: `${cardBase.boxShadow}, 0 0 16px ${p.bg}`,
        padding: "12px 14px",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        display: "block",
        minHeight: 76,
      }
    : {
        ...cardBase,
        borderRadius: 16,
        padding: "12px 14px",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        display: "block",
        minHeight: 76,
      };

  // `div role="button"` e NÃO `<button>` (U72). O card do quadro fica dentro
  // de um wrapper `draggable`, e Firefox e Safari não iniciam o arrasto do
  // ancestral quando o gesto começa sobre um `<button>` nativo — o mousedown
  // é consumido pelo controle. Era por isso que o arrasto "não pegava" fora do
  // Chromium. O papel, o foco e o Enter/Espaço ficam mantidos à mão, que é o
  // preço de continuar acessível sem o elemento nativo.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
      }}
      className="elevavel"
      style={CARD}
    >
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
          <span style={{ ...chipStyle(a.statusCor, isLight), flexShrink: 0 }}>
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
          <span style={chipStyle(a.tipoCor, isLight)}>{a.tipoLabel}</span>
        )}
        {/* A etiqueta "Visita técnica" que existia aqui saiu (2026-08-22,
            Davi): era redundante com o chip de tipo logo acima — toda visita
            tem natureza comercial e tipoLabel "Proposta comercial" (R29), e
            dois chips dizendo a mesma coisa com palavras diferentes só
            ocupava espaço sem acrescentar informação. */}
        {/* ETIQUETA DE LOCAL — chip, não texto solto (2026-08-22: era
            "cliente"; virou local, ver o comentário em atividadeDaVisita).
            Era texto secundário e sumia no meio dos chips coloridos ao lado.
            No quadro, "de qual prédio é isto?" é a segunda pergunta depois de
            "o que é isto?" — e a resposta precisa ter o mesmo peso visual das
            outras etiquetas para ser encontrada varrendo a coluna. O chip usa
            sempre um cinza translúcido próprio (não `chipStyle`): a cor aqui
            identifica categoria e prioridade, e um terceiro tom colorido
            brigaria com as duas sem acrescentar significado. */}
        {/* U71: virou LISTA. Davi, 2026-08-26: "cada card deve conter do(s)
            local(is) referente(s) a aquela atividade". O teto de LOCAIS_NO_CARD
            existe porque a coluna tem 260px — uma atividade de dez prédios
            empurraria prazo e avatares para fora da tela. O excedente vira
            "+N", como a pilha de avatares já faz, e o `title` da fileira lista
            todos: o card resume, o detalhe detalha. */}
        {a.locais.slice(0, LOCAIS_NO_CARD).map((local) => (
          <span
            key={local}
            title={a.locais.join(" · ")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 9px", borderRadius: 999,
              fontFamily: FONT, fontWeight: 600, fontSize: PISO_TIPO,
              letterSpacing: "0.04em", color: textPrimary,
              background: isLight ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.09)",
              minWidth: 0, maxWidth: "100%",
            }}
          >
            <Building2 size={11} style={{ flexShrink: 0, opacity: 0.75 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {local}
            </span>
          </span>
        ))}
        {a.locais.length > LOCAIS_NO_CARD && (
          <span
            title={a.locais.join(" · ")}
            style={{
              display: "inline-flex", alignItems: "center",
              padding: "3px 8px", borderRadius: 999,
              fontFamily: FONT, fontWeight: 700, fontSize: PISO_TIPO,
              letterSpacing: "0.04em", color: textPrimary,
              background: isLight ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.09)",
              flexShrink: 0,
            }}
          >
            +{a.locais.length - LOCAIS_NO_CARD}
          </span>
        )}

        {a.prioridadeLabel && a.prioridadeCor && (
          <span style={chipStyle(a.prioridadeCor, isLight)}>{a.prioridadeLabel}</span>
        )}

        {a.compra && (
          <span style={chipStyle(PRISMA.pessego, isLight)}>
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
    </div>
  );
}
