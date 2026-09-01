// O CARTÃO DO BLOCO e a CÉLULA (uma equipe, um dia) — U79.
//
// ESTES DOIS COMPONENTES NÃO CALCULAM NADA. Tudo o que eles desenham já vem
// resolvido em `ItemDaGrade` e `CelulaDaGrade` (features/programacao/modelo.ts):
// o rótulo (que é regra — chamado, OS de fora ou "Outro atendimento"), a janela
// `de`/`ate` já com o deslocamento descontado, o ordinal, o "é retorno", o
// "é emergencial", o "se move" e a divergência. O que sobra aqui é pixel.
//
// ── A ÚNICA DIFERENÇA ENTRE O DESKTOP E O CELULAR MORA NESTE ARQUIVO ───────
// `eixo = true` posiciona os itens por `top`/`height` num eixo de tempo;
// `eixo = false` empilha os MESMOS itens, na MESMA ordem (`celulaDaGrade` já os
// entrega ordenados por `de`), com o horário escrito. A conta que decide isso é
// aritmética, não gosto: em 390px de largura, 8h de eixo dão 8px por 15 minutos,
// e um serviço de 30 min vira uma lasca de 16px que não se lê nem se toca.
//
// ── O MODO COLAPSADO, E POR QUE ELE DESENHA OS BLOCOS ─────────────────────
// `mostrarRotulos = false` é a linha de uma equipe que este usuário não pode
// ler (para quem não é gestor, `chamadoOculto` é verdadeiro na maioria dos
// cartões e a grade viraria um muro de "Outro atendimento"). A saída óbvia
// seria colapsar a linha numa barra de ocupação SEM cartões — e
// `blocosForaDaGrade` PROÍBE isso: bloco ativo da semana que não aparece em
// célula nenhuma conta como `naoMostrados`, e o guarda tem de ser sempre zero.
// Então a linha colapsada DESENHA os blocos, como segmentos posicionados pela
// mesma janela, com o rótulo só no `title`. O guarda que parecia obstáculo
// produziu a renderização certa: é o mesmo eixo, sem os rótulos.

import { type CSSProperties, type DragEvent } from "react";
import { Check, Lock } from "lucide-react";
import { PRISMA } from "@/lib/paleta";
import { FONT } from "@/lib/ui";
import { TIPO_CORES, type ChamadoTipo } from "@/lib/chamado-status";
import {
  CAMPO_ABRE_MIN,
  CAMPO_FECHA_MIN,
  duracaoTexto,
  horaTexto,
  minutosDoBloco,
  type CelulaDaGrade as Celula,
  type ItemDaGrade,
  type LinhaDaGrade,
  type SeloDoCiclo,
} from "./modelo";

/**
 * O SELO DO CICLO FINANCEIRO (R103/U80) — a palavra, e ela é escolhida com
 * cuidado. "Lançado" JAMAIS vira "Cobrado", "A receber" ou "Faturado": o selo
 * afirma que HOUVE lançamento e nunca que há valor a receber, e as duas coisas
 * são diferentes por escolha declarada (o predicado conta a cobrança viva, e
 * cancelar libera).
 */
export const SELO_LABEL: Record<SeloDoCiclo, string> = {
  cancelado: "Cancelado",
  fora_do_sistema: "OS de fora",
  sem_os: "Sem OS",
  a_conferir: "A conferir",
  lancado: "Lançado",
  nada_a_cobrar: "Nada a cobrar",
};

/**
 * A COR DO SELO É SEPARADA DE `coresDoItem`, E ISSO NÃO É ARRUMAÇÃO.
 *
 * A cor do CARTÃO já está gasta: `coresDoItem` gasta fundo, borda e a borda
 * esquerda de 3px com emergencial → oculto → `TIPO_CORES`, que é a mesma cor
 * que o chamado tem no kanban, na lista e no painel. O ciclo financeiro é um
 * EIXO ORTOGONAL — dois eixos na mesma cor é como se perde os dois. Por isso o
 * selo é uma marca À PARTE, e `coresDoItem` não é tocada.
 */
export const SELO_CORES: Record<SeloDoCiclo, keyof typeof PRISMA> = {
  cancelado: "neutro",
  fora_do_sistema: "neutro",
  sem_os: "laranja",
  a_conferir: "amarelo",
  lancado: "verde",
  nada_a_cobrar: "neutro",
};

/** Altura do eixo do dia, em pixels. A escala se ajusta; a altura não. */
export const ALTURA_EIXO = 340;

/**
 * A JANELA DE DESENHO da grade inteira — GEOMETRIA, não regra.
 *
 * Começa em 09:00 e termina em 17:00 (`CAMPO_ABRE_MIN`/`CAMPO_FECHA_MIN`), que
 * é o eixo do dia; ABRE para fora quando algum bloco vaza. Vazar é legítimo e
 * previsto: o docblock de `CAMPO_FECHA_MIN` diz com todas as letras que ela é o
 * eixo do desenho e NÃO um teto — um corretiva+urgente das 07:00, ou um bloco
 * das 16:00 com 8h, são aceitos pela porta. Cortar o desenho neles seria a
 * grade escondendo trabalho que existe.
 *
 * A janela é calculada uma vez para a GRADE INTEIRA, e não por linha: colunas
 * com escalas diferentes não se comparam, e comparar é o que a grade serve para
 * fazer.
 */
export function janelaDoDesenho(linhas: LinhaDaGrade[]): { de: number; ate: number } {
  let de = CAMPO_ABRE_MIN;
  let ate = CAMPO_FECHA_MIN;
  for (const l of linhas) {
    for (const c of l.celulas) {
      for (const i of c.itens) {
        if (i.de < de) de = i.de;
        if (i.ate > ate) ate = i.ate;
      }
    }
  }
  return { de, ate: Math.max(ate, de + 60) };
}

/** As marcas de hora cheia dentro da janela — o "papel pautado" do eixo. */
export function horasDoEixo(janela: { de: number; ate: number }): number[] {
  const marcas: number[] = [];
  for (let m = Math.ceil(janela.de / 60) * 60; m <= janela.ate; m += 60) marcas.push(m);
  return marcas;
}

/**
 * A cor do cartão sai do TIPO do chamado, que é a mesma cor que ele tem no
 * kanban, na lista e no painel (`TIPO_CORES`, lib/chamado-status.ts) — nenhum
 * hex solto e nenhuma paleta paralela para a grade. Duas exceções, e as duas
 * são regra e não decoração: o EMERGENCIAL (corretiva + urgente, a isenção da
 * jornada da R100) sai em vermelho, e o que este usuário não pode ler sai em
 * neutro, junto com o rótulo "Outro atendimento".
 */
function coresDoItem(item: ItemDaGrade) {
  if (item.emergencial) return PRISMA.vermelho;
  if (item.oculto) return PRISMA.neutro;
  const tipo = item.chamado?.tipo as ChamadoTipo | undefined;
  if (tipo && TIPO_CORES[tipo]) return TIPO_CORES[tipo];
  return item.chamado ? PRISMA.azul : PRISMA.neutro;
}

interface PropsCartao {
  item: ItemDaGrade;
  isLight: boolean;
  /** posicionado no eixo (desktop) ou empilhado (celular) */
  eixo: boolean;
  /** false = linha colapsada: segmento sem texto, rótulo no title */
  mostrarRotulos: boolean;
  /**
   * O ciclo financeiro deste cartão, já resolvido por `selosDaGrade`.
   * `undefined` = nada é pintado — e "não sei" nunca é "não tem".
   */
  selo?: SeloDoCiclo;
  estilo?: CSSProperties;
  onAbrir?: (item: ItemDaGrade) => void;
  /** só o desktop arrasta — HTML5 DnD não dispara em toque (Quadro.tsx:24) */
  arrastavel?: boolean;
  aoComecarArrasto?: (item: ItemDaGrade) => void;
  aoTerminarArrasto?: () => void;
}

/**
 * O cartão de um bloco.
 *
 * `div role="button"` E NÃO `<button>` (U72). O cartão fica dentro de um
 * wrapper `draggable`, e Firefox e Safari não iniciam o arrasto do ancestral
 * quando o gesto começa sobre um `<button>` nativo — o mousedown é consumido
 * pelo controle. Era por isso que o arrasto "não pegava" fora do Chromium. O
 * papel, o foco e o Enter/Espaço ficam mantidos à mão, que é o preço de
 * continuar acessível sem o elemento nativo.
 */
export function CartaoDoBloco({
  item, isLight, eixo, mostrarRotulos, selo, estilo, onAbrir,
  arrastavel, aoComecarArrasto, aoTerminarArrasto,
}: PropsCartao) {
  const cor = coresDoItem(item);
  const cumprido = !item.seMove;
  const horario = `${horaTexto(item.de)}–${horaTexto(item.ate)}`;
  /**
   * O SELO ENTRA NA LEGENDA, QUE JÁ É `title` E `aria-label` — canal gratuito
   * e acessível. A legenda visível de baixo já carrega seis elementos (Check,
   * horário, duração, "2ª ida", "emergencial", Lock), e a sétima palavra
   * quebraria a linha: com `overflow: hidden` e 0,708 px/min, um bloco de 30
   * min tem 21 px e JÁ corta a segunda linha em silêncio. Então o que aparece
   * no eixo é um PONTO de 6 px, e a palavra vem por aqui.
   */
  const legenda = `${horario} · ${duracaoTexto(minutosDoBloco(item.bloco))} · ${item.rotulo}`
    + (selo ? ` · ${SELO_LABEL[selo]}` : "");
  const corSelo = selo ? PRISMA[SELO_CORES[selo]] : null;
  const podeArrastar = !!arrastavel && item.seMove;

  const cartao = (
    <div
      role="button"
      tabIndex={0}
      title={legenda}
      aria-label={legenda}
      onClick={() => onAbrir?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir?.(item); }
      }}
      style={{
        boxSizing: "border-box",
        position: "relative", // a âncora do ponto do selo (canto superior direito)
        width: "100%",
        height: eixo ? "100%" : undefined,
        minHeight: eixo ? 14 : 44,
        overflow: "hidden",
        borderRadius: mostrarRotulos ? 9 : 5,
        padding: mostrarRotulos ? (eixo ? "4px 6px" : "8px 10px") : 0,
        cursor: onAbrir ? "pointer" : "default",
        background: cor.bg,
        border: `1px solid ${cor.border}`,
        borderLeft: `3px solid ${isLight ? cor.light : cor.dark}`,
        color: isLight ? cor.light : cor.dark,
        opacity: cumprido ? 0.72 : 1,
        display: "flex", flexDirection: "column", gap: 2,
        textAlign: "left",
      }}
    >
      {/* O PONTO. Posição absoluta: custa ZERO linha de conteúdo e sobrevive
          aos 21 px de um bloco de 30 min, que é onde toda a aritmética desta
          tela aperta. Ele aparece inclusive na linha COLAPSADA — ali o cartão
          já é só um segmento, e o ponto continua sendo a única coisa que cabe.
          `aria-hidden` porque a palavra já está no `aria-label` do cartão: o
          leitor de tela ouviria duas vezes. */}
      {corSelo && (
        <span
          aria-hidden
          style={{
            position: "absolute", top: 3, right: 3,
            width: 6, height: 6, borderRadius: 3,
            background: isLight ? corSelo.light : corSelo.dark,
            boxShadow: `0 0 0 1.5px ${cor.bg}`,
          }}
        />
      )}
      {mostrarRotulos && (
        <>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: eixo ? 10 : 12,
            lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            paddingRight: corSelo ? 8 : 0,
          }}>
            {item.rotulo}
          </span>
          <span style={{
            display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
            fontFamily: FONT, fontWeight: 500, fontSize: eixo ? 9 : 10.5, opacity: 0.9,
          }}>
            {cumprido && <Check size={eixo ? 9 : 11} />}
            {horario}
            <span style={{ opacity: 0.75 }}>· {duracaoTexto(minutosDoBloco(item.bloco))}</span>
            {/* "retorno" é DERIVADO da ordem dos blocos (R99) — nenhum valor
                novo em chamados.status, nenhuma coluna. O chip é a decisão
                inteira do satélite virando uma palavra. */}
            {item.retorno && (
              <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                · {item.ordinal}ª ida
              </span>
            )}
            {item.emergencial && (
              <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                · emergencial
              </span>
            )}
            {cumprido && <Lock size={eixo ? 9 : 10} style={{ opacity: 0.7 }} />}
          </span>
          {/* NO CELULAR CABE A PALAVRA. `minHeight: 44` e padding de 8×10 dão
              espaço que os 21 px do eixo não dão — mesmo componente, dois
              pesos, como já acontece com todo o resto desta tela. No desktop
              (`eixo`) o selo é só o ponto lá em cima, mais a palavra no
              `title`/`aria-label`. */}
          {!eixo && selo && corSelo && (
            <span style={{
              alignSelf: "flex-start", marginTop: 1,
              padding: "2px 7px", borderRadius: 999,
              fontFamily: FONT, fontWeight: 700, fontSize: 9,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: isLight ? corSelo.light : corSelo.dark,
              background: corSelo.bg,
              border: `1px solid ${corSelo.border}`,
            }}>
              {SELO_LABEL[selo]}
            </span>
          )}
        </>
      )}
    </div>
  );

  if (!podeArrastar) return <div style={estilo}>{cartao}</div>;
  return (
    <div
      draggable
      onDragStart={(e) => {
        aoComecarArrasto?.(item);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.bloco.id);
      }}
      onDragEnd={() => aoTerminarArrasto?.()}
      style={{ ...estilo, cursor: "grab" }}
    >
      {cartao}
    </div>
  );
}

interface PropsCelula {
  celula: Celula;
  isLight: boolean;
  eixo: boolean;
  mostrarRotulos: boolean;
  /**
   * `bloco.id → selo`, vindo pronto de `selosDaGrade`. Ausente (ou Map vazio,
   * que é o caso de quem não é gestor) significa "nenhum selo" — e é
   * exatamente a grade que existia antes desta entrega.
   */
  selos?: Map<string, SeloDoCiclo>;
  janela: { de: number; ate: number };
  alvo: boolean;
  onAbrir?: (item: ItemDaGrade) => void;
  onVazio?: (dia: string, duplaId: string) => void;
  arrastavel?: boolean;
  aoComecarArrasto?: (item: ItemDaGrade) => void;
  aoTerminarArrasto?: () => void;
  aoPassarPorCima?: (e: DragEvent) => void;
  aoSairDeCima?: (e: DragEvent) => void;
  aoSoltar?: (e: DragEvent) => void;
}

/**
 * Uma equipe, um dia. O átomo da grade e a coluna do celular são o MESMO
 * componente com `eixo` diferente — é o que impede as duas telas de calcular
 * coisas parecidas.
 *
 * OS DOIS ZEROS SÃO DIFERENTES, e a célula é onde isso finalmente aparece:
 *   · `disponivel` (tem escala, nada marcado) → o selo "disponível";
 *   · `!comEscala` → "sem escala nesta semana", e NENHUM selo.
 * O modelo insiste nessa distinção desde o cabeçalho dele; misturar as duas
 * ofereceria uma equipe que não existe naquela semana.
 */
export function CelulaDoDia({
  celula, isLight, eixo, mostrarRotulos, selos, janela, alvo,
  onAbrir, onVazio, arrastavel, aoComecarArrasto, aoTerminarArrasto,
  aoPassarPorCima, aoSairDeCima, aoSoltar,
}: PropsCelula) {
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const verde = isLight ? "#047862" : "#2DD2A5";
  const escala = ALTURA_EIXO / (janela.ate - janela.de);

  const realce: CSSProperties = alvo
    ? {
        background: isLight ? "rgba(200,136,6,0.07)" : "rgba(248,200,17,0.06)",
        outline: `1.5px solid ${isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark}`,
        outlineOffset: 2,
      }
    : {};

  const vazio = celula.itens.length === 0;

  const conteudo = eixo ? (
    <div style={{ position: "relative", height: ALTURA_EIXO }}>
      {horasDoEixo(janela).map((m) => (
        <div
          key={m}
          aria-hidden
          style={{
            position: "absolute", left: 0, right: 0,
            top: (m - janela.de) * escala, height: 1,
            background: isLight ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.055)",
          }}
        />
      ))}
      {vazio && celula.comEscala && mostrarRotulos && (
        <span style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontFamily: FONT, fontWeight: 700, fontSize: 9,
          letterSpacing: "0.10em", textTransform: "uppercase", color: verde, opacity: 0.85,
        }}>
          disponível
        </span>
      )}
      {vazio && !celula.comEscala && mostrarRotulos && (
        <span style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 6px",
          fontFamily: FONT, fontSize: 10, color: textSecondary, opacity: 0.8,
        }}>
          sem escala nesta semana
        </span>
      )}
      {celula.itens.map((item) => (
        <CartaoDoBloco
          key={item.bloco.id}
          item={item}
          isLight={isLight}
          eixo
          mostrarRotulos={mostrarRotulos}
          selo={selos?.get(item.bloco.id)}
          onAbrir={mostrarRotulos ? onAbrir : undefined}
          arrastavel={arrastavel && mostrarRotulos}
          aoComecarArrasto={aoComecarArrasto}
          aoTerminarArrasto={aoTerminarArrasto}
          estilo={{
            position: "absolute",
            left: 2, right: 2,
            top: (item.de - janela.de) * escala,
            height: Math.max(12, (item.ate - item.de) * escala),
          }}
        />
      ))}
    </div>
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {vazio && celula.comEscala && (
        <span style={{
          padding: "10px 12px", borderRadius: 10, textAlign: "center",
          background: isLight ? "rgba(4,120,98,0.07)" : "rgba(45,210,165,0.08)",
          border: `1px solid ${isLight ? "rgba(4,120,98,0.22)" : "rgba(45,210,165,0.22)"}`,
          fontFamily: FONT, fontWeight: 700, fontSize: 10,
          letterSpacing: "0.10em", textTransform: "uppercase", color: verde,
        }}>
          disponível
        </span>
      )}
      {vazio && !celula.comEscala && (
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
          sem escala nesta semana
        </span>
      )}
      {celula.itens.map((item) => (
        <CartaoDoBloco
          key={item.bloco.id}
          item={item}
          isLight={isLight}
          eixo={false}
          mostrarRotulos={mostrarRotulos}
          selo={selos?.get(item.bloco.id)}
          onAbrir={mostrarRotulos ? onAbrir : undefined}
        />
      ))}
    </div>
  );

  return (
    <div
      onDragOver={aoPassarPorCima}
      onDragLeave={aoSairDeCima}
      onDrop={aoSoltar}
      onDoubleClick={
        onVazio && celula.comEscala
          ? () => onVazio(celula.dia, celula.duplaId)
          : undefined
      }
      style={{
        minWidth: 0, borderRadius: 10, padding: 2,
        background: "transparent",
        ...realce,
      }}
    >
      {conteudo}
    </div>
  );
}
