// PRAZO **OU** DIA AGENDADO — a escolha, num controle só (R232, U120).
//
// Davi, 08/09/2026: "os itens PRAZO / AGENDAR PARA devem ter design estratégico
// de acordo com o design system, quero que fique mais claro que é um ou outro."
//
// Antes: dois campos de data empilhados, cada um com o próprio rótulo, e um
// deles ficava cinza quando o outro tinha valor. O "ou" existia na lógica e na
// legenda — não no desenho. Aqui a pergunta é UMA ("quando?"), a escolha são
// dois botões de seleção (`botaoSelecao`, o mesmo par que o tipo de demanda e o
// impacto já usam nesta casa) e o campo de data é UM: o que a pessoa vê é o que
// a regra diz. Clicar no botão aceso volta para "sem data".
//
// A cor não é decoração: o botão "Tem prazo" acende no AMARELO do prazo e
// "Agendar" no AZUL — as mesmas amostras que o card usa para a mesma coisa
// (R136: dentro da semana amarelo; R225: agendada não tem prazo).
//
// A REGRA é pura e mora no modelo (`modoDeQuando`/`parDeQuando`, R232): as duas
// telas que oferecem a escolha chamam as mesmas funções, e este componente só
// desenha. Ele é CONTROLADO em aaaa-mm-dd (o valor do <input type="date">);
// quem grava converte — a página com `dataParaPrazo`, o "+" no insert.

import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, botaoSelecao } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { modoDeQuando, parDeQuando, type ModoDeQuando } from "@/features/atividades/modelo";

const OPCOES: { modo: ModoDeQuando; rotulo: string; ajuda: string; cor: typeof PRISMA.amarelo; frase: string }[] = [
  {
    modo: "prazo", rotulo: "Tem prazo", cor: PRISMA.amarelo,
    ajuda: "A atividade vence num dia",
    frase: "Vence nesse dia — a cor do card segue o prazo.",
  },
  {
    modo: "agenda", rotulo: "Agendar", cor: PRISMA.azul,
    ajuda: "Dia marcado, sem prazo — vai para a coluna Agendado",
    frase: "Vai para a coluna Agendado e não tem prazo.",
  },
];

/** Hoje em aaaa-mm-dd, no fuso de quem está olhando — o palpite do campo. */
function hojeISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function CampoQuando({
  prazo, agendado, aoMudar, idBase = "quando", desabilitado = false, compacto = false,
  estiloEntrada, nota,
}: {
  /** aaaa-mm-dd, ou "" */
  prazo: string;
  /** aaaa-mm-dd, ou "" */
  agendado: string;
  aoMudar: (v: { prazo: string; agendado: string }) => void;
  idBase?: string;
  desabilitado?: boolean;
  compacto?: boolean;
  /** o estilo de campo da tela que hospeda (INPUT da página, `entrada` do "+") */
  estiloEntrada?: CSSProperties;
  /** um aviso extra da tela — ex.: "Re-agendado 2x" */
  nota?: string | null;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const modo = modoDeQuando(prazo, agendado);
  const escolhida = OPCOES.find((o) => o.modo === modo) ?? null;
  const valor = modo === "prazo" ? prazo : modo === "agenda" ? agendado : "";

  function escolher(m: ModoDeQuando) {
    if (desabilitado) return;
    // clicar no botão ACESO desmarca — é como se volta para "sem data"
    if (modo === m) { aoMudar(parDeQuando(null, "")); return; }
    aoMudar(parDeQuando(m, valor || hojeISO()));
  }

  const entrada: CSSProperties = estiloEntrada ?? {
    width: "100%", boxSizing: "border-box", height: compacto ? 36 : 44,
    borderRadius: 12, padding: "0 12px",
    background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
    fontFamily: FONT, fontWeight: 400, fontSize: 13.5, outline: "none",
    colorScheme: isLight ? "light" : "dark",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {OPCOES.map((o) => (
          <button
            key={o.modo}
            type="button"
            aria-pressed={modo === o.modo}
            title={o.ajuda}
            disabled={desabilitado}
            onClick={() => escolher(o.modo)}
            style={{
              ...botaoSelecao(modo === o.modo, isLight, o.cor),
              boxShadow: "none",
              padding: compacto ? "6px 11px" : "9px 13px",
              borderRadius: compacto ? 9 : 10,
              fontSize: compacto ? 11.5 : 12,
              cursor: desabilitado ? "default" : "pointer",
            }}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {escolhida && (
        <>
          <input
            id={`${idBase}-${escolhida.modo}`}
            type="date"
            aria-label={escolhida.modo === "prazo" ? "Prazo" : "Agendar para"}
            disabled={desabilitado}
            value={valor}
            onChange={(e) => aoMudar(parDeQuando(escolhida.modo, e.target.value))}
            style={{ ...entrada, height: compacto ? 36 : (entrada.height as number | undefined) }}
          />
          <span style={{
            fontFamily: FONT, fontSize: compacto ? 10.5 : 11, color: c.textoSecundario, lineHeight: 1.4,
          }}>
            {escolhida.frase}{nota ? ` · ${nota}` : ""}
          </span>
        </>
      )}
      {!escolhida && (
        <span style={{ fontFamily: FONT, fontSize: compacto ? 10.5 : 11, color: c.textoSecundario, lineHeight: 1.4 }}>
          Sem data{nota ? ` · ${nota}` : ""}
        </span>
      )}
    </div>
  );
}
