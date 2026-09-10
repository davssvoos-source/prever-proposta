// SELETOR DE OPÇÃO — um botão que mostra a escolha atual e, ao clicar, abre a
// lista para escolher outra (R135, U95).
//
// Davi, 03/09/2026: "agrupe as opções de cada item, então por exemplo STATUS
// deve ser uma opção que ao clicar abre a lista de seleção. (Tudo de acordo
// com o nosso DESIGN SYSTEM). Faça isso com todas as opções."
//
// Até aqui a tela da atividade mostrava CADA opção como um botão numa fileira
// (R87): cinco status, sete equipes, seis tipos — dezoito botões coloridos na
// tela para dizer três coisas. Aqui a fileira vira UM botão, pintado pela cor
// da coisa escolhida (a regra da R87 não morre: a cor continua dizendo O QUÊ,
// só que num botão só), e a lista abre num popover do design system — o mesmo
// vidro e a mesma mecânica de posicionamento do MenuFiltro da Início, com a
// cor de cada opção como um ponto ao lado do nome.
//
// É um `<button>` de verdade com `aria-haspopup`/`aria-expanded`, e a lista é
// um `listbox` com `option`s: teclado (setas, Enter, Esc) funciona.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, botaoSelecao } from "@/lib/ui";

export interface CorDaOpcao {
  dark: string;
  light: string;
  bg: string;
  border: string;
}

export interface OpcaoDoSeletor {
  valor: string;
  rotulo: string;
  /** a cor da coisa (status, tipo, equipe…); sem cor, o dourado da marca */
  cor?: CorDaOpcao | null;
  nota?: string;
}

interface Props {
  valor: string | null;
  opcoes: OpcaoDoSeletor[];
  aoMudar: (valor: string | null) => void;
  /** texto quando nada está escolhido — e, se dado, a opção de limpar */
  vazio?: string;
  desabilitado?: boolean;
  id?: string;
  larguraMenu?: number;
  /** ocupa a largura toda do campo (o padrão no formulário) */
  cheio?: boolean;
  /**
   * R183 (U104): o botão PEQUENO do cabeçalho do Configurador rápido — 30px,
   * pílula, 12px. A mesma cor, o mesmo popover; só o corpo encolhe.
   */
  compacto?: boolean;
}

export function SeletorDeOpcao({
  valor, opcoes, aoMudar, vazio, desabilitado = false, id, larguraMenu = 260, cheio = true, compacto = false,
}: Props) {
  const { isLight } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [marcada, setMarcada] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const atual = opcoes.find((o) => o.valor === valor) ?? null;
  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";

  const MARGEM = 12;

  /**
   * ONDE O MENU É DESENHADO (R243) — e por que isto é um CONSERTO, não gosto.
   *
   * Davi, 10/09/2026: "Estes botões não estão funcionando, corrija-os nesta e
   * em todas as páginas em que eles aparecem." No pop-up da atividade, clicar
   * numa opção não fazia nada.
   *
   * O menu ia para o `<body>` por portal. Um diálogo do Radix é MODAL: ele põe
   * `pointer-events: none` no `<body>` e devolve `auto` só para a árvore do
   * diálogo (react-remove-scroll). O menu, irmão dessa árvore, ficava INERTE —
   * o clique atravessava para o véu, que fecha a janela. Ou seja: no pop-up o
   * seletor abria e não escolhia, e na página funcionava. O mesmo vale para
   * qualquer diálogo do sistema (o "+" da Início, o configurador).
   *
   * A correção é desenhar o menu DENTRO do diálogo quando há um. Isso muda a
   * conta da posição: a caixa do diálogo tem `transform` (o Radix centra com
   * translate), e um `position: fixed` dentro de um ancestral transformado
   * passa a ser medido a partir DELE, não da janela. Então as coordenadas saem
   * relativas ao container, e o limite de "não vazar" passa a ser a caixa do
   * diálogo — que também é o que impede o menu de ser cortado pelo
   * `overflow: hidden` dele.
   */
  const alvoDoPortal = useCallback((): HTMLElement => {
    const dialogo = botaoRef.current?.closest('[role="dialog"]') as HTMLElement | null;
    return dialogo ?? document.body;
  }, []);
  const alvoRef = useRef<HTMLElement | null>(null);

  const posicionar = useCallback(() => {
    const r = botaoRef.current?.getBoundingClientRect();
    if (!r) return;
    const alvo = alvoRef.current ?? document.body;
    const caixa = alvo === document.body ? null : alvo.getBoundingClientRect();
    const lim = caixa
      ? { esq: caixa.left, dir: caixa.right, topo: caixa.top, base: caixa.bottom }
      : { esq: 0, dir: window.innerWidth, topo: 0, base: window.innerHeight };
    const largura = Math.max(larguraMenu, Math.min(r.width, 420));
    let left = r.left;
    if (left + largura > lim.dir - MARGEM) left = Math.max(lim.esq + MARGEM, lim.dir - MARGEM - largura);
    const abaixo = lim.base - r.bottom - MARGEM;
    const acima = r.top - lim.topo - MARGEM;
    const paraCima = abaixo < 180 && acima > abaixo;
    const maxH = Math.max(140, Math.min(320, paraCima ? acima : abaixo));
    const top = paraCima ? r.top - 6 - maxH : r.bottom + 6;
    // Relativas ao container: dentro do diálogo, `fixed` mede a partir da
    // caixa de PADDING dele — e getBoundingClientRect devolve a de BORDA.
    // MEDIDO: sem descontar `clientLeft/clientTop` o menu saía 1px fora (a
    // borda do diálogo), e sairia mais em qualquer caixa de borda grossa.
    const bordaE = alvo === document.body ? 0 : alvo.clientLeft;
    const bordaT = alvo === document.body ? 0 : alvo.clientTop;
    setPos({
      left: left - (caixa?.left ?? 0) - bordaE,
      top: top - (caixa?.top ?? 0) - bordaT,
      maxH,
    });
  }, [larguraMenu]);

  useLayoutEffect(() => {
    if (!aberto) return;
    alvoRef.current = alvoDoPortal();   // decidido ao ABRIR, não a cada render
    posicionar();
  }, [aberto, posicionar, alvoDoPortal]);

  useEffect(() => {
    if (!aberto) return;
    setMarcada(Math.max(0, opcoes.findIndex((o) => o.valor === valor)));
    const fora = (e: Event) => {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo) || menuRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const acompanhar = () => posicionar();
    const t = setTimeout(() => document.addEventListener("pointerdown", fora), 60);
    window.addEventListener("resize", acompanhar);
    window.addEventListener("scroll", acompanhar, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", acompanhar);
      window.removeEventListener("scroll", acompanhar, true);
    };
  }, [aberto, posicionar, opcoes, valor]);

  function escolher(v: string | null) {
    aoMudar(v);
    setAberto(false);
    botaoRef.current?.focus();
  }

  function teclado(e: React.KeyboardEvent) {
    if (desabilitado) return;
    if (e.key === "Escape") { setAberto(false); return; }
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); setAberto(true); return;
    }
    if (!aberto) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setMarcada((m) => Math.min(opcoes.length - 1, m + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setMarcada((m) => Math.max(0, m - 1)); }
    if (e.key === "Enter") { e.preventDefault(); const o = opcoes[marcada]; if (o) escolher(o.valor); }
  }

  // O botão fechado é o `botaoSelecao` da R87 — ativo quando há escolha,
  // pintado pela cor da coisa escolhida; sem escolha, o véu neutro.
  const estiloBotao: CSSProperties = {
    ...botaoSelecao(!!atual, isLight, atual?.cor ?? null),
    ...(compacto
      ? { minHeight: 30, padding: "0 9px 0 11px", borderRadius: 999, fontSize: 12, fontWeight: 600 }
      // R243: 44 → 36. Davi, 10/09/2026: "Diminua um pouco a altura dos botões
      // de Status, Tipo e Impacto." Continua acima do piso de toque de 40px? Não
      // — e é decisão consciente: estes três são de DESKTOP (a ficha da
      // atividade), e no celular a ficha desce para uma coluna com o mesmo
      // botão, onde 36px ainda é alvo confortável para o polegar em pílula larga.
      : { minHeight: 36, padding: "0 11px 0 13px", borderRadius: 10, fontSize: 13 }),
    display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: compacto ? 5 : 8,
    width: cheio && !compacto ? "100%" : undefined, boxSizing: "border-box",
    textAlign: "left",
    cursor: desabilitado ? "default" : "pointer",
    opacity: desabilitado ? 0.6 : 1,
  };

  return (
    <>
      <button
        ref={botaoRef}
        id={id}
        type="button"
        disabled={desabilitado}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => !desabilitado && setAberto((a) => !a)}
        onKeyDown={teclado}
        style={estiloBotao}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {atual ? atual.rotulo : (vazio ?? "— escolher —")}
        </span>
        <ChevronDown
          size={compacto ? 13 : 15}
          style={{ flexShrink: 0, opacity: 0.85, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {aberto && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-activedescendant={opcoes[marcada] ? `${id ?? "seletor"}-${opcoes[marcada].valor}` : undefined}
          className="rolagem-fina"
          style={{
            position: "fixed", left: pos.left, top: pos.top, zIndex: 200,
            // o diálogo do Radix apaga o ponteiro de tudo o que está fora dele;
            // dentro, isto é redundante e barato — fora, é a garantia
            pointerEvents: "auto",
            width: Math.max(larguraMenu, Math.min(botaoRef.current?.getBoundingClientRect().width ?? 0, 420)),
            maxHeight: pos.maxH, overflowY: "auto", overscrollBehavior: "contain",
            borderRadius: 14, padding: 6,
            background: isLight ? "rgba(255,255,255,0.92)" : "rgba(20,20,27,0.92)",
            backdropFilter: "var(--vidro-blur)" as any,
            WebkitBackdropFilter: "var(--vidro-blur)" as any,
            border: isLight ? "1px solid rgba(255,255,255,0.72)" : "1px solid rgba(255,255,255,0.12)",
            boxShadow: isLight ? "0 12px 32px rgba(0,0,0,0.12)" : "0 12px 32px rgba(0,0,0,0.32)",
          }}
        >
          {vazio !== undefined && (
            <button
              type="button"
              role="option"
              aria-selected={valor === null}
              onClick={() => escolher(null)}
              className="hover-suave"
              style={{
                width: "100%", minHeight: 38, padding: "0 10px", borderRadius: 9,
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center",
                fontFamily: FONT, fontWeight: 600, fontSize: 12, color: textSecondary, textAlign: "left",
              }}
            >
              {vazio}
            </button>
          )}
          {opcoes.map((o, i) => {
            const escolhida = o.valor === valor;
            const cor = o.cor ? (isLight ? o.cor.light : o.cor.dark) : (isLight ? "#A06108" : "#F8C811");
            return (
              <button
                key={o.valor}
                id={`${id ?? "seletor"}-${o.valor}`}
                type="button"
                role="option"
                aria-selected={escolhida}
                onClick={() => escolher(o.valor)}
                onMouseEnter={() => setMarcada(i)}
                className="hover-suave"
                style={{
                  width: "100%", minHeight: 42, padding: "6px 10px", borderRadius: 9,
                  background: i === marcada
                    ? (isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)")
                    : "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 9, textAlign: "left",
                }}
              >
                {/* o PONTO na cor da coisa — a identidade da opção antes do nome */}
                <span style={{
                  width: 10, height: 10, borderRadius: 5, flexShrink: 0,
                  background: cor, boxShadow: `0 0 0 3px ${o.cor ? o.cor.bg : "rgba(248,200,17,0.14)"}`,
                }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block", fontFamily: FONT, fontWeight: escolhida ? 700 : 500,
                    fontSize: 13, color: textPrimary,
                  }}>
                    {o.rotulo}
                  </span>
                  {o.nota && (
                    <span style={{ display: "block", fontFamily: FONT, fontSize: 11, color: textSecondary, marginTop: 1 }}>
                      {o.nota}
                    </span>
                  )}
                </span>
                {escolhida && <Check size={14} color={cor} strokeWidth={3} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>,
        alvoRef.current ?? document.body,
      )}
    </>
  );
}
