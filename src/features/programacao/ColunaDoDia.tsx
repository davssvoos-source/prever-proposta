// A COLUNA DO DIA (celular) — U79.
//
// ESTA TELA NÃO É UMA SEGUNDA TELA: é UMA COLUNA da grade do desktop.
// `linhasDaGrade` é chamada UMA VEZ, com os `dias` da SEMANA INTEIRA, e o
// celular faz `linha.celulas.find(c => c.dia === dia)`. Uma chamada, um
// `LinhaDaGrade[]`, e o viewport escolhe quantas colunas do MESMO objeto viram
// pixel.
//
// POR QUE NÃO CHAMAR O MODELO COM `dias = [dia]`, que seria o óbvio:
//   · `divergencias` e `ocultos` são REDUZIDOS sobre `celulas` (modelo.ts:1854).
//     Com um dia só, o cabeçalho diria "1 divergência" ao lado de um chip de
//     ocupação que é sempre da SEMANA. Dois escopos no mesmo cabeçalho é "quem
//     conta é quem filtra" quebrado do jeito mais difícil de enxergar: cada
//     número está certo sozinho.
//   · `blocosForaDaGrade` MORREria. Com um dia só, o guarda dos dois lados
//     devolve `naoMostrados` = os blocos dos outros quatro dias, toda vez. A
//     saída seria desligá-lo no celular — e um guarda que só vale num viewport
//     não é guarda.
//   · O custo de calcular cinco células para desenhar uma é `.filter()` sobre
//     um array já em memória. Zero consulta a mais.
//
// ── O QUE O CELULAR NÃO TEM, E POR QUÊ ────────────────────────────────────
// · EIXO DE TEMPO. Em 390px, 8h de eixo dão 8px por 15 minutos, e um serviço de
//   30 min é uma lasca de 16px que não se lê nem se toca. Os cartões empilham na
//   MESMA ordem (`celulaDaGrade` entrega ordenado por `de`) com o horário
//   escrito.
// · ARRASTAR. HTML5 DnD não dispara em toque — o repo diz isso com as próprias
//   palavras (Quadro.tsx:24-25: "no celular o quadro segue só de leitura, e
//   mover é pela página do chamado"). O gesto do celular é TOCAR → o mesmo
//   formulário. E o formulário é o gesto PRIMÁRIO nos dois viewports: o arrasto
//   só sabe exprimir (equipe, dia), e o formulário exprime os cinco campos.
// · COLUNAS LADO A LADO. Quatro equipes viram quatro cartões empilhados, na
//   MESMA ordem das quatro linhas do desktop.

import { FONT, card } from "@/lib/ui";
import { type ItemDaGrade, type LinhaDaGrade } from "./modelo";
import { CelulaDoDia } from "./CelulaDaGrade";
import { CabecalhoDaLinha, rotuloDoDia, type RotulosDaEquipe } from "./GradeSemana";

interface Props {
  linhas: LinhaDaGrade[];
  dia: string;
  isLight: boolean;
  rotulos: RotulosDaEquipe;
  mostrarRotulos: (linha: LinhaDaGrade) => boolean;
  onAbrirItem: (item: ItemDaGrade) => void;
  onNovoNaCelula: (dia: string, duplaId: string) => void;
}

export function ColunaDoDia({
  linhas, dia, isLight, rotulos, mostrarRotulos, onAbrirItem, onNovoNaCelula,
}: Props) {
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";

  if (linhas.length === 0) {
    return (
      <div style={{ ...card(isLight), padding: "26px 16px", textAlign: "center" }}>
        <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
          Nenhuma equipe tem escala nesta semana, e não há bloco marcado nela.
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {linhas.map((l) => {
        // A célula do dia aberto SEMPRE existe: a tela une `diasDaGrade` com o
        // dia escolhido antes de chamar `linhasDaGrade` (sem essa união, abrir
        // um sábado vazio pela régua — que é o gesto de marcar o primeiro bloco
        // nele — devolveria `undefined` para toda linha).
        const celula = l.celulas.find((c) => c.dia === dia);
        if (!celula) return null;
        return (
          <div key={l.duplaId} style={{ ...card(isLight), padding: "13px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <CabecalhoDaLinha linha={l} isLight={isLight} rotulos={rotulos} compacto />
            <CelulaDoDia
              celula={celula}
              isLight={isLight}
              eixo={false}
              mostrarRotulos={mostrarRotulos(l)}
              janela={{ de: 0, ate: 1440 }}
              alvo={false}
              onAbrir={onAbrirItem}
            />
            {celula.comEscala && mostrarRotulos(l) && (
              <button
                onClick={() => onNovoNaCelula(dia, l.duplaId)}
                style={{
                  height: 40, borderRadius: 12, cursor: "pointer",
                  background: "transparent", color: textSecondary,
                  border: isLight ? "1px dashed rgba(0,0,0,0.16)" : "1px dashed rgba(255,255,255,0.16)",
                  fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
                }}
              >
                + marcar em {rotuloDoDia(dia)}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
