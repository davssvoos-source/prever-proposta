// O TÍTULO DA ATIVIDADE, EDITÁVEL NO LUGAR (R324).
//
// Davi, 24/09/2026: "ao clicar no titulo deve ser possível alterá-lo. Quando o
// usuário clica no titulo já fica o cursor de texto para ele escrever".
//
// É um <textarea> vestido de título (22/700, R195): o clique cai direto no texto
// e o navegador põe o cursor exatamente onde a pessoa tocou — nada de lápis nem
// de "modo edição". Uma linha lógica (Enter grava, Esc desfaz), mas a altura
// acompanha o texto, porque título longo quebra em duas linhas como o <h1> quebrava.
// Grava ao sair (blur); vazio ou igual não grava (`tituloParaSalvar`). Sem
// permissão, é o <h1> de sempre.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cinzas } from "@/lib/paleta";
import { TITULO_MAXIMO, tituloParaSalvar } from "@/features/chamados/titulo";

const ESTILO_TITULO: CSSProperties = {
  margin: 0, fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 22,
  lineHeight: 1.25, textWrap: "balance" as CSSProperties["textWrap"],
};

export function TituloEditavel({ valor, podeEditar, aoSalvar }: {
  valor: string | null | undefined;
  podeEditar: boolean;
  aoSalvar: (novo: string) => void;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const [texto, setTexto] = useState(valor ?? "");
  const [focado, setFocado] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // o que chega de fora (outra aba, realtime) só entra quando ninguém está digitando
  useEffect(() => { if (!focado) setTexto(valor ?? ""); }, [valor, focado]);

  // a altura acompanha o texto — uma linha, ou duas quando o título é longo
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [texto, podeEditar]);

  if (!podeEditar) return <h1 style={ESTILO_TITULO}>{valor}</h1>;

  const gravar = () => {
    const novo = tituloParaSalvar(texto, valor);
    if (novo) aoSalvar(novo);
    else setTexto(valor ?? "");
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={texto}
      maxLength={TITULO_MAXIMO}
      aria-label="Título da atividade"
      title="Clique para editar o título"
      spellCheck
      onChange={(e) => setTexto(e.target.value.replace(/\n/g, " "))}
      onFocus={() => setFocado(true)}
      onBlur={() => { setFocado(false); gravar(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { e.preventDefault(); setTexto(valor ?? ""); requestAnimationFrame(() => ref.current?.blur()); }
      }}
      style={{
        ...ESTILO_TITULO,
        display: "block", width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden",
        color: c.texto, background: focado ? c.campo : "transparent",
        border: "none", outline: "none", borderRadius: 8,
        // o anel não mexe no layout (sombra, não borda) e é neutro (R79: nada de dourado fixo)
        boxShadow: focado ? `0 0 0 1px ${c.divisoria}` : "none",
        paddingInline: 6, paddingBlock: 2, marginInline: -6,
        cursor: "text",
      }}
    />
  );
}
