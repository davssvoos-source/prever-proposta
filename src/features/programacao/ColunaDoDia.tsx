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

import { Copy, Share2 } from "lucide-react";
import { whatsappTextoLink } from "@/features/gerencial/constants";
import { FONT, card } from "@/lib/ui";
import { type ItemDaGrade, type LinhaDaGrade, type SeloDoCiclo } from "./modelo";
import { CelulaDoDia } from "./CelulaDaGrade";
import { CabecalhoDaLinha, rotuloDoDia, type RotulosDaEquipe } from "./GradeSemana";

/**
 * COMPARTILHAR O DIA (R105) — os DOIS botões, e são dois de propósito.
 *
 * COPIAR é o caminho confiável: a área de transferência aguenta o dia inteiro.
 * O `wa.me` é a conveniência, e ele vira uma URL — um dia de seis equipes com
 * descrição longa pode passar de alguns KB (ver o docblock de
 * `whatsappTextoLink`). Se o link falhar num dia grande, o copiar continua
 * inteiro.
 *
 * `navigator.clipboard?.writeText` COM o optional chaining: é o padrão seguro
 * de `TelaDeErro.tsx:68`. `navigator.clipboard` é `undefined` em contexto não
 * seguro (http), e as duas ocorrências em `visita.$id*.tsx` que omitem o `?.`
 * são bug latente — não se copia o bug junto.
 *
 * O componente NÃO MONTA TEXTO. Ele recebe `texto` pronto de `textoDoDia`
 * (lógica pura, com asserção): a tela não monta string de regra.
 */
export function BotoesDeCompartilhar({
  texto, isLight, compacto, aoCopiar,
}: {
  texto: string;
  isLight: boolean;
  compacto?: boolean;
  /** o aviso ("Programação copiada.") é da tela que chamou, não daqui */
  aoCopiar?: () => void;
}) {
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const estilo = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: compacto ? "6px 10px" : "8px 12px",
    minHeight: compacto ? 32 : 36,
    borderRadius: 10, cursor: "pointer",
    background: isLight ? "#ffffff" : "rgba(255,255,255,0.05)",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, fontFamily: FONT, fontWeight: 600,
    fontSize: compacto ? 10.5 : 11.5,
  } as const;

  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      <button
        type="button"
        style={estilo}
        title="Copiar a programação deste dia"
        onClick={() => {
          navigator.clipboard?.writeText(texto);
          aoCopiar?.();
        }}
      >
        <Copy size={13} /> Copiar o dia
      </button>
      <a
        href={whatsappTextoLink(texto)}
        target="_blank"
        rel="noreferrer"
        style={{ ...estilo, textDecoration: "none" }}
        title="Abrir o WhatsApp com a programação deste dia"
      >
        <Share2 size={13} /> WhatsApp
      </a>
    </div>
  );
}

interface Props {
  linhas: LinhaDaGrade[];
  dia: string;
  isLight: boolean;
  rotulos: RotulosDaEquipe;
  mostrarRotulos: (linha: LinhaDaGrade) => boolean;
  selos?: Map<string, SeloDoCiclo>;
  /**
   * O texto do dia, já montado por `textoDoDia`. `null` = sem botão — é como o
   * não-gestor vê a coluna, e a razão está no docblock de `textoDoDia`: o dia
   * dele viraria um texto cheio de "Outro atendimento", honesto e inútil.
   */
  textoParaCompartilhar?: string | null;
  aoCopiar?: () => void;
  onAbrirItem: (item: ItemDaGrade) => void;
  onNovoNaCelula: (dia: string, duplaId: string) => void;
}

export function ColunaDoDia({
  linhas, dia, isLight, rotulos, mostrarRotulos, selos,
  textoParaCompartilhar, aoCopiar, onAbrirItem, onNovoNaCelula,
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
      {/* O SEGUNDO PONTO DE ENTRADA do compartilhar, e ele é o que importa:
          aqui é onde a pessoa EM CAMPO está. O primeiro fica na linha de
          resumo do dia, no route, que é a identidade do dia aberto. */}
      {textoParaCompartilhar && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <BotoesDeCompartilhar
            texto={textoParaCompartilhar}
            isLight={isLight}
            compacto
            aoCopiar={aoCopiar}
          />
        </div>
      )}
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
              selos={selos}
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
