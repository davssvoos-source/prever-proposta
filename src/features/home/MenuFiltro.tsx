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
// · alvo de 44px por opção; o app trava o zoom e isto se usa no celular também.
//
// O POPOVER VAI EM PORTAL PARA O BODY, e isso não é preferência. A regra
// `#root, main, header, nav { position: relative; z-index: 1 }` (styles.css)
// faz do <main> um CONTEXTO DE EMPILHAMENTO: qualquer z-index aqui dentro só
// compete com irmãos daqui, e para a página o menu inteiro vale 1. A BottomNav
// é `fixed; z-index: 50` e irmã do <main>, então pintava por cima — no celular,
// tocar na última opção acertava a barra e NAVEGAVA PARA OUTRA TELA. Subir o
// z-index não resolveria: o problema nunca foi o valor.
//
// Estando em portal, a posição passa a ser calculada do retângulo do botão, e
// aí dá para fazer o que faltava: virar para cima quando não há espaço embaixo,
// e limitar a altura ao que sobra na janela.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PRISMA } from "@/lib/paleta";
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
  /**
   * Botão quadrado só com ícone, sem texto (2026-08-22) — para quando o
   * rótulo já é óbvio pelo contexto (o ícone de ordenar ao lado do de
   * kanban/lista, por exemplo) e a pílula de texto só ocuparia espaço. O
   * menu que abre é o MESMO — muda só a casca do botão fechado.
   */
  icone?: LucideIcon;
}

export function MenuFiltro({
  rotulo, opcoes, selecionados, multi = false, onMudar, vazio, larguraMenu = 240, icone: Icone,
}: Props) {
  const { isLight } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const MARGEM = 12;

  const posicionar = useCallback(() => {
    const r = botaoRef.current?.getBoundingClientRect();
    if (!r) return;
    const jl = window.innerWidth;
    const jt = window.innerHeight;

    // horizontal: alinha pela esquerda; se estourar, encosta pela direita
    let left = r.left;
    if (left + larguraMenu > jl - MARGEM) left = Math.max(MARGEM, jl - MARGEM - larguraMenu);

    // vertical: prefere abaixo, vira para cima quando não cabe, e a altura é
    // sempre o que de fato sobra — antes o menu nascia com metade fora da tela
    const abaixo = jt - r.bottom - MARGEM;
    const acima = r.top - MARGEM;
    const paraCima = abaixo < 180 && acima > abaixo;
    const maxH = Math.max(140, Math.min(320, paraCima ? acima : abaixo));
    const top = paraCima ? r.top - 6 - maxH : r.bottom + 6;

    setPos({ left, top, maxH });
  }, [larguraMenu]);

  // useLayoutEffect: posiciona antes de pintar, senão o menu aparece e pula
  useLayoutEffect(() => { if (aberto) posicionar(); }, [aberto, posicionar]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (caixaRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      // devolve o foco ao botão: sem isto, quem navega por teclado perde a
      // posição e o próximo Tab recomeça do topo da página
      botaoRef.current?.focus();
    };
    // a página rolando por baixo de um menu ancorado em coordenadas fixas o
    // deixaria "solto" longe do botão
    const acompanhar = () => posicionar();
    // o timeout evita que o mesmo toque que abriu já feche
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 60);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", acompanhar);
    window.addEventListener("scroll", acompanhar, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", acompanhar);
      window.removeEventListener("scroll", acompanhar, true);
    };
  }, [aberto, posicionar]);

  function abrir() {
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

  // mesma medida dos outros botões quadrados da barra (visão lista/quadro) —
  // um ícone que muda de tamanho ao lado dos outros pareceria desalinhado
  const BOTAO_ICONE: CSSProperties = {
    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo ? GOLD_GRAD : isLight ? "#ffffff" : "#191921",
    color: ativo ? "#08090E" : textPrimary,
    cursor: "pointer",
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
      {Icone ? (
        <button
          ref={botaoRef}
          onClick={abrir}
          aria-label={ativo ? `${rotulo}: ${resumo}` : rotulo}
          title={ativo ? `${rotulo}: ${resumo}` : rotulo}
          style={BOTAO_ICONE}
        >
          <Icone size={17} />
        </button>
      ) : (
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
      )}

      {aberto && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="rolagem-fina"
          style={{
            // fixed + portal no body: fora do contexto de empilhamento do
            // <main>, é isto que faz o menu ficar ACIMA da BottomNav
            position: "fixed",
            left: pos.left,
            top: pos.top,
            zIndex: 200,
            width: larguraMenu,
            maxHeight: pos.maxH,
            overflowY: "auto",
            overscrollBehavior: "contain",
            borderRadius: 14,
            padding: 6,
            // vidro mais opaco que os cards: menu precisa de leitura perfeita
            background: isLight ? "rgba(255,255,255,0.88)" : "rgba(20,20,27,0.88)",
            backdropFilter: "var(--vidro-blur)" as any,
            WebkitBackdropFilter: "var(--vidro-blur)" as any,
            border: isLight ? "1px solid rgba(255,255,255,0.72)" : "1px solid rgba(255,255,255,0.12)",
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
                className="hover-suave"
                role="option"
                aria-selected={marcada}
                onClick={() => alternar(o.valor)}
                style={{
                  width: "100%", minHeight: 44, padding: "6px 10px", borderRadius: 9,
                  background: marcada
                    ? isLight ? "rgba(160,97,8,0.10)" : "rgba(248,200,17,0.09)"
                    : "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: multi ? 5 : 9, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: marcada ? (isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark) : "transparent",
                  border: marcada
                    ? "none"
                    : isLight ? "1.5px solid rgba(0,0,0,0.25)" : "1.5px solid rgba(255,255,255,0.28)",
                }}>
                  {marcada && <Check size={12} color={isLight ? "#ffffff" : "#08090E"} strokeWidth={3} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block", fontFamily: FONT, fontWeight: marcada ? 600 : 400,
                    fontSize: 13, color: textPrimary,
                  }}>
                    {o.label}
                  </span>
                  {o.nota && (
                    <span style={{
                      display: "block", fontFamily: FONT, fontWeight: 400, fontSize: 11,
                      color: textSecondary, marginTop: 1, lineHeight: 1.3,
                    }}>
                      {o.nota}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
