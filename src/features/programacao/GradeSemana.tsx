// A GRADE: semana × equipe de campo (desktop) — U79.
//
// Recebe `LinhaDaGrade[]` PRONTO e desenha. Não filtra, não soma, não ordena e
// não decide quem aparece: `linhasDaGrade` já resolveu isso, inclusive as duas
// metades que a tela antiga não tinha — as equipes ÓRFÃS (têm bloco na semana e
// não têm escala) e as DESCONHECIDAS (têm bloco e nem estão na lista de
// equipes). É a doutrina do balde nulo: o que existe não pode sumir do total,
// e era exatamente por não a ter que a tela antiga anunciava "3 atendimentos no
// dia" com "Nada programado neste dia" logo abaixo.
//
// ── O CABEÇALHO DA LINHA É ONDE A DIVERGÊNCIA MORA ────────────────────────
// `divergenciaDeEquipe` (modelo.ts:1614) diz por que: "divergência que só se
// mostra é divergência que se aprende a ignorar — por isso a contagem vai para
// o CABEÇALHO da semana (um número no topo é constrangedor) e não para dentro
// do card (um ícone entre trinta é decoração)".
//
// E `ocultos` NÃO fica ao lado de `divergencias` como se os dois somassem:
// `divergencias` é uma afirmação sobre a agenda, `ocultos` é uma afirmação
// sobre o que ESTE usuário não pode ler — muda com quem olha. Ele vive no
// `title`, onde é explicação e não acusação.

import { type CSSProperties, type DragEvent } from "react";
import { AlertTriangle, EyeOff } from "lucide-react";
import { PRISMA } from "@/lib/paleta";
import { FONT, card } from "@/lib/ui";
import {
  dataDoDia, duracaoTexto, pctTexto,
  type ItemDaGrade, type LinhaDaGrade, type SeloDoCiclo,
} from "./modelo";
import { CelulaDoDia, janelaDoDesenho } from "./CelulaDaGrade";

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "qua 03" — rótulo de coluna. Formatação, e por isso mora na tela. */
export function rotuloDoDia(dia: string): string {
  const d = dataDoDia(dia);
  if (!d) return dia;
  return `${DIA_CURTO[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

export interface RotulosDaEquipe {
  nome: (duplaId: string) => string;
  sub: (duplaId: string) => string | null;
  /** o selo de escala herdada, já em português (`rotuloDaOrigem`) */
  origem: (linha: LinhaDaGrade) => string | null;
}

interface PropsCabecalho {
  linha: LinhaDaGrade;
  isLight: boolean;
  rotulos: RotulosDaEquipe;
  compacto?: boolean;
}

/**
 * O cabeçalho de uma equipe: nome, composição, o chip de ocupação da SEMANA e
 * os dois contadores.
 *
 * O CHIP É SEMPRE DA SEMANA, inclusive no celular, e é por isso que
 * `linhasDaGrade` recebe `semana` e `dias` como parâmetros SEPARADOS. "68% da
 * semana" continua sendo 68% quando a tela mostra um dia só — é a mesma linha,
 * com menos colunas desenhadas.
 *
 * `pct: null` sai como "—" e nunca como 0%: "esta equipe não tem escala nesta
 * semana" é uma pergunta ao gestor, e "tem escala e nada marcado" é o selo
 * "disponível". Os dois zeros são diferentes.
 */
export function CabecalhoDaLinha({ linha, isLight, rotulos, compacto }: PropsCabecalho) {
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  const sub = rotulos.sub(linha.duplaId);
  const origem = rotulos.origem(linha);
  const o = linha.ocupacao;

  const chip: CSSProperties = {
    padding: "3px 8px", borderRadius: 999, flexShrink: 0,
    fontFamily: FONT, fontWeight: 700, fontSize: 9,
    letterSpacing: "0.06em", textTransform: "uppercase",
    color: isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
    background: PRISMA.amarelo.bg,
    border: `1px solid ${PRISMA.amarelo.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{
        fontFamily: FONT, fontWeight: 700, fontSize: compacto ? 12 : 12.5, color: textPrimary,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {rotulos.nome(linha.duplaId)}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={chip}
          title={
            o.comEscala
              ? `${duracaoTexto(o.minutos)} de ${duracaoTexto(o.base)} na semana. A base é por EQUIPE e não por pessoa: a equipe sai junta, no mesmo carro, então três pessoas não fazem três serviços ao mesmo tempo — o chip mede o tempo do carro.`
              : "Esta equipe não tem escala nesta semana: não há denominador, e por isso o percentual é “—” e não 0%."
          }
        >
          {pctTexto(o.pct)} · {duracaoTexto(o.minutos)}
        </span>
        {linha.divergencias > 0 && (
          <span
            title="O bloco diz uma equipe e a escala da semana põe o responsável em outra. Acontece quando a escala muda depois de o bloco ser marcado — e não é consertado sozinho, porque escrita de cadastro não reescreve registro (U76)."
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
              fontFamily: FONT, fontWeight: 600, fontSize: 10, color: laranja,
            }}
          >
            <AlertTriangle size={11} />
            {linha.divergencias} divergência{linha.divergencias > 1 ? "s" : ""}
          </span>
        )}
        {linha.ocultos > 0 && (
          <span
            title="Blocos cujo chamado você não pode ler. Eles contam na ocupação de propósito — se sumissem, o chip mostraria 40% onde há 90% — mas o que está neles não é seu para saber."
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
              fontFamily: FONT, fontWeight: 500, fontSize: 10, color: textSecondary,
            }}
          >
            <EyeOff size={11} />
            {linha.ocultos}
          </span>
        )}
      </div>
      {sub && (
        <span style={{
          fontFamily: FONT, fontSize: 10.5, color: textSecondary,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {sub}
        </span>
      )}
      {origem && (
        <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, opacity: 0.85 }}>
          {origem}
        </span>
      )}
    </div>
  );
}

interface Props {
  linhas: LinhaDaGrade[];
  dias: string[];
  isLight: boolean;
  rotulos: RotulosDaEquipe;
  /** o dia aberto na régua — a coluna dele ganha destaque */
  diaAberto: string;
  /** false ⇒ linha colapsada: os blocos viram segmentos sem rótulo */
  mostrarRotulos: (linha: LinhaDaGrade) => boolean;
  /**
   * O ciclo financeiro por bloco (U80). Só REPASSADO — o `CabecalhoDaLinha`
   * NÃO ganha contador: aquele cabeçalho é por EQUIPE/semana (ocupação,
   * divergências, ocultos) e o ciclo é por CHAMADO. Somar dois eixos no mesmo
   * cabeçalho é o defeito que o comentário do topo deste arquivo já descreve
   * para `divergencias` × `ocultos`. O agregado do ciclo vai na linha de
   * resumo do dia, no route.
   */
  selos?: Map<string, SeloDoCiclo>;
  onAbrirItem: (item: ItemDaGrade) => void;
  onNovoNaCelula: (dia: string, duplaId: string) => void;
  /** ausente = grade só de leitura */
  arrasto?: {
    alvo: { duplaId: string; dia: string } | null;
    aoComecar: (item: ItemDaGrade) => void;
    aoTerminar: () => void;
    aoPassarPorCima: (duplaId: string, dia: string, e: DragEvent) => void;
    aoSairDeCima: (duplaId: string, dia: string, e: DragEvent) => void;
    aoSoltar: (duplaId: string, dia: string, e: DragEvent) => void;
  };
}

export function GradeSemana({
  linhas, dias, isLight, rotulos, diaAberto, mostrarRotulos, selos,
  onAbrirItem, onNovoNaCelula, arrasto,
}: Props) {
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const janela = janelaDoDesenho(linhas);
  const fundo = isLight ? "#ffffff" : "#141416";
  const linhaFina = isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)";
  // A primeira coluna gruda: com seis equipes e sete dias o trilho rola de
  // lado, e uma grade que rola perdendo o nome da equipe é uma grade ilegível.
  const colunaFixa: CSSProperties = {
    position: "sticky", left: 0, zIndex: 2, background: fundo,
    borderRight: linhaFina, padding: "10px 12px", minWidth: 190, maxWidth: 190,
  };
  const grade: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `190px repeat(${dias.length}, minmax(150px, 1fr))`,
    minWidth: 190 + dias.length * 150,
  };

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
    <div className="trilho-x sangra-x">
      {/* `clip` e NÃO `hidden`, e a diferença é a coluna fixa funcionar ou não:
          `overflow: hidden` CRIA um scroll container, e `position: sticky`
          resolve contra o container mais próximo. Com `hidden` aqui, o sticky
          da primeira coluna passava a se ancorar nesta div — cujo scrollLeft é
          sempre 0 —, então ela "grudava" onde já estava e rolava para fora
          junto com o resto, escondendo o nome da equipe. Que é exatamente o
          defeito que a coluna fixa existe para não ter. `clip` recorta o
          cantinho arredondado do card sem criar container, e o sticky volta a
          se ancorar no `.trilho-x`, que é quem rola de verdade. */}
      <div style={{ ...card(isLight), overflow: "clip", minWidth: "max-content" }}>
        <div style={grade}>
          {/* cabeçalho das colunas */}
          <div style={{ ...colunaFixa, borderBottom: linhaFina }} />
          {dias.map((d) => (
            <div
              key={d}
              style={{
                padding: "10px 8px", textAlign: "center", borderBottom: linhaFina,
                background: d === diaAberto
                  ? (isLight ? "rgba(200,136,6,0.06)" : "rgba(248,200,17,0.05)")
                  : "transparent",
              }}
            >
              <span style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: d === diaAberto ? gold : textSecondary,
              }}>
                {rotuloDoDia(d)}
              </span>
            </div>
          ))}

          {/* uma linha por equipe */}
          {linhas.map((l) => {
            const detalhada = mostrarRotulos(l);
            return (
              <div key={l.duplaId} style={{ display: "contents" }}>
                <div style={{ ...colunaFixa, borderTop: linhaFina, display: "flex", alignItems: "center" }}>
                  <CabecalhoDaLinha linha={l} isLight={isLight} rotulos={rotulos} />
                </div>
                {l.celulas.map((c) => (
                  <div
                    key={c.dia}
                    style={{
                      borderTop: linhaFina,
                      borderLeft: linhaFina,
                      padding: 6,
                      background: c.dia === diaAberto
                        ? (isLight ? "rgba(200,136,6,0.035)" : "rgba(248,200,17,0.03)")
                        : "transparent",
                    }}
                  >
                    <CelulaDoDia
                      celula={c}
                      isLight={isLight}
                      eixo
                      mostrarRotulos={detalhada}
                      selos={selos}
                      janela={janela}
                      alvo={!!arrasto && arrasto.alvo?.duplaId === l.duplaId && arrasto.alvo?.dia === c.dia}
                      onAbrir={onAbrirItem}
                      onVazio={onNovoNaCelula}
                      arrastavel={!!arrasto}
                      aoComecarArrasto={arrasto?.aoComecar}
                      aoTerminarArrasto={arrasto?.aoTerminar}
                      aoPassarPorCima={arrasto ? (e) => arrasto.aoPassarPorCima(l.duplaId, c.dia, e) : undefined}
                      aoSairDeCima={arrasto ? (e) => arrasto.aoSairDeCima(l.duplaId, c.dia, e) : undefined}
                      aoSoltar={arrasto ? (e) => arrasto.aoSoltar(l.duplaId, c.dia, e) : undefined}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
