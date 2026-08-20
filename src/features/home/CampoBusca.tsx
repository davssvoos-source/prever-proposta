// Campo de busca de atividades — adaptação do componente que o Davi mandou
// (Uiverse, por Gautammsharma): pílula clara com sombra difusa por baixo e o
// botão de lupa em bloco escuro à direita.
//
// O que mudou do original, e por quê:
// · a paleta verde (#F3FFF9 / #07372C / #beecdc) virou a da marca — o verde é
//   sucesso no nosso sistema (Shamrock), usá-lo num campo de busca diria algo
//   que não é verdade;
// · a "shadow__input" do original é uma div borrada por trás; aqui virou
//   `box-shadow` no próprio container, que faz o mesmo efeito sem um elemento
//   a mais e sem `filter: blur`, que força camada de composição;
// · o tema escuro ganhou tratamento próprio — o original é claro-only, e a
//   pílula branca sobre o fundo preto ficaria estridente demais.
//
// A busca é controlada de fora: o campo não guarda estado, para que a Home
// continue sendo dona dos filtros (o `Filtros.busca` de lentes.ts).

import { useEffect, useRef, type CSSProperties } from "react";
import { Search, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { SUPERNOVA, SOBRE_PRIMARIA } from "@/lib/paleta";

interface Props {
  valor: string;
  onMudar: (v: string) => void;
  autoFoco?: boolean;
  placeholder?: string;
}

export function CampoBusca({ valor, onMudar, autoFoco, placeholder = "Procurar atividade…" }: Props) {
  const { isLight } = useTheme();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFoco) ref.current?.focus();
  }, [autoFoco]);

  const container: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: 340,
    padding: "8px 8px 8px 18px",
    borderRadius: 999,
    boxSizing: "border-box",
    background: isLight ? "rgba(255,255,255,0.62)" : "rgba(20,20,27,0.55)",
    backdropFilter: "var(--vidro-blur)" as any,
    WebkitBackdropFilter: "var(--vidro-blur)" as any,
    border: isLight
      ? "1px solid rgba(255,255,255,0.72)"
      : "1px solid rgba(255,255,255,0.10)",
    // o "shadow__input" do original, feito com box-shadow em vez de uma div
    // borrada — mesmo halo, sem elemento extra nem camada de composição
    boxShadow: isLight
      ? "0 12px 34px rgba(200,136,6,0.16), 0 2px 6px rgba(0,0,0,0.05)"
      : "0 12px 34px rgba(248,200,17,0.10)",
  };

  const input: CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: 14,
    color: isLight ? "#0a0b0e" : "#ffffff",
  };

  const botao: CSSProperties = {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 14,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    // o bloco escuro do original vira o dourado da marca com texto escuro,
    // que é o par de contraste que o sistema já usa em toda ação
    background: `linear-gradient(135deg, ${SUPERNOVA[300]}, ${SUPERNOVA[400]}, ${SUPERNOVA[500]})`,
    color: SOBRE_PRIMARIA,
    transition: "filter .15s",
  };

  return (
    <div style={container}>
      <input
        ref={ref}
        type="text"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onMudar(""); }}
        placeholder={placeholder}
        aria-label="Procurar atividade"
        style={input}
      />
      {valor ? (
        <button
          onClick={() => { onMudar(""); ref.current?.focus(); }}
          aria-label="Limpar busca"
          style={{
            ...botao,
            background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
            color: isLight ? "#4a5060" : "rgba(255,255,255,0.75)",
          }}
        >
          <X size={17} />
        </button>
      ) : (
        <span style={{ ...botao, cursor: "default" }} aria-hidden>
          <Search size={17} />
        </span>
      )}
    </div>
  );
}
