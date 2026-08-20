// Botão de filtro que abre uma caixa de seleção. Substitui as duas fileiras de
// chips soltos que a Home tinha — quinze alvos disputando a largura da tela,
// sem hierarquia e sem dizer o que estava ativo sem contar visualmente.
//
// Um botão por dimensão (Padrão · Vínculo · Período · Situação · Pessoa). O
// botão fechado JÁ MOSTRA a escolha: "Vínculo: Responsável +1" em vez de
// "Vínculo". Filtro cujo estado só se descobre abrindo é filtro que a pessoa
// esquece ligado e depois acha que o sistema perdeu dados.
//
// Regras de UI que valem a pena registrar porque são fáceis de errar:
// · fecha com clique fora, com Esc e ao escolher (quando é seleção única);
// · seleção múltipla NÃO fecha ao escolher — senão marcar três coisas custa
//   três aberturas;
// · o menu se ancora à direita quando está na metade direita da tela, senão
//   vaza para fora da janela;
// · alvo de 44px por opção; o app trava o zoom e isto se usa no celular também.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD } from "@/lib/ui";

export interface OpcaoFiltro {
  valor: string;
  label: string;
  /** Linha fina abaixo do rótulo, para explicar o que não é óbvio. */
  nota?: string;
}

interface Props {
  rotulo: string;
  opcoes: OpcaoFiltro[];
  /** Valores marcados. Em seleção única, zero ou um. */
  selecionados: string[];
  multi?: boolean;
  onMudar: (valores: string[]) => void;
  /** Texto do botão quando nada está escolhido. Padrão: o próprio rótulo. */
  vazio?: string;
  larguraMenu?: number;
}

export function MenuFiltro({
  rotulo, opcoes, selecionados, multi = false, onMudar, vazio, larguraMenu = 240,
}: Props) {
  const { isLight } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [aDireita, setADireita] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => {
      if (caixaRef.current?.contains(e.target as Node)) return;
      setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    // o timeout evita que o mesmo toque que abriu já feche
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 60);
    document.addEventListener("keydown", tecla);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  function abrir() {
    // decide o lado antes de mostrar, senão o menu aparece e pula
    const r = botaoRef.current?.getBoundingClientRect();
    if (r) setADireita(r.left + larguraMenu > window.innerWidth - 12);
    setAberto((a) => !a);
  }

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const ativo = selecionados.length > 0;

  const resumo = (() => {
    if (!ativo) return vazio ?? rotulo;
    const primeiro = opcoes.find((o) => o.valor === selecionados[0])?.label ?? selecionados[0];
    return selecionados.length > 1 ? `${primeiro} +${selecionados.length - 1}` : primeiro;
  })();

  const BOTAO: CSSProperties = {
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 11,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo ? GOLD_GRAD : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
    maxWidth: 220,
  };

  function alternar(valor: string) {
    if (multi) {
      onMudar(selecionados.includes(valor)
        ? selecionados.filter((v) => v !== valor)
        : [...selecionados, valor]);
    } else {
      onMudar(selecionados[0] === valor ? [] : [valor]);
      setAberto(false);
    }
  }

  return (
    <div ref={caixaRef} style={{ position: "relative", flexShrink: 0 }}>
      <button ref={botaoRef} onClick={abrir} style={BOTAO}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {ativo && <span style={{ opacity: 0.7 }}>{rotulo}: </span>}
          {resumo}
        </span>
        <ChevronDown
          size={14}
          style={{ flexShrink: 0, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {aberto && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(aDireita ? { right: 0 } : { left: 0 }),
            zIndex: 60,
            width: larguraMenu,
            maxHeight: 320,
            overflowY: "auto",
            overscrollBehavior: "contain",
            borderRadius: 14,
            padding: 6,
            background: isLight ? "#ffffff" : "#16161d",
            border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.32)",
          }}
        >
          {ativo && (
            <button
              onClick={() => { onMudar([]); if (!multi) setAberto(false); }}
              style={{
                width: "100%", minHeight: 38, padding: "0 10px", borderRadius: 9,
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center",
                fontFamily: FONT, fontWeight: 600, fontSize: 12, color: textSecondary,
              }}
            >
              Limpar
            </button>
          )}
          {opcoes.map((o) => {
            const marcada = selecionados.includes(o.valor);
            return (
              <button
                key={o.valor}
                role="option"
                aria-selected={marcada}
                onClick={() => alternar(o.valor)}
                style={{
                  width: "100%", minHeight: 44, padding: "6px 10px", borderRadius: 9,
                  background: marcada
                    ? isLight ? "rgba(184,120,0,0.10)" : "rgba(255,192,0,0.09)"
                    : "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: multi ? 5 : 9, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: marcada ? (isLight ? "#b87800" : "#FFC000") : "transparent",
                  border: marcada
                    ? "none"
                    : isLight ? "1.5px solid rgba(0,0,0,0.25)" : "1.5px solid rgba(255,255,255,0.28)",
                }}>
                  {marcada && <Check size={12} color={isLight ? "#ffffff" : "#08090E"} strokeWidth={3} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block", fontFamily: FONT, fontWeight: marcada ? 600 : 500,
                    fontSize: 13, color: textPrimary,
                  }}>
                    {o.label}
                  </span>
                  {o.nota && (
                    <span style={{
                      display: "block", fontFamily: FONT, fontWeight: 300, fontSize: 11,
                      color: textSecondary, marginTop: 1, lineHeight: 1.3,
                    }}>
                      {o.nota}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
