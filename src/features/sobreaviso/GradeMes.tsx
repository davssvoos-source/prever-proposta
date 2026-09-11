// O CALENDÁRIO DO PLANTÃO: pessoa × dias, com a BARRA de sobreaviso por cima
// (U86; redesenhado na R254/U129).
//
// Recebe `GradeDoMes` e os TRECHOS já montados e desenha. Não filtra, não soma,
// não decide quem aparece e não sabe o que é feriado: `gradeDeDias()` e
// `trechosDaEscala()` já resolveram tudo isso, e é lá que a asserção mora.
//
// ── A BARRA (R254) ────────────────────────────────────────────────────────
// Davi, 11/09/2026: "Quando um usuário tem a semana com plantão, no calendário,
// crie uma barra com bordas arredondadas, a barra pode ter um amarelo degrade
// do nosso padrão, um pouco fosco ou até opacidade reduzida para não ficar
// cansativo aos olhos do usuário."
//
// Ela é UM elemento por trecho contíguo, posicionado no MESMO grid por
// `gridColumn: <início> / span <n>` — e não uma camada absoluta por cima. As
// colunas são `1fr`: uma camada absoluta teria de RE-DERIVAR larguras que só
// existem depois do layout e sairia do prumo no primeiro resize ou rolagem do
// trilho. Pondo no grid, quem faz a aritmética é o navegador.
//
// Por isso TODO item desta grade declara `gridRow` explícito: misturar itens
// posicionados com itens em colocação automática é o caminho curto para uma
// barra aparecer uma linha abaixo da pessoa dela.
//
// A barra NÃO é o fundo da célula, de propósito: o fundo carrega a lavagem de
// "não é dia útil", que é o único portador dessa informação (o nome do feriado
// só existe no `title`). A barra é uma faixa de 22px dentro da linha de 34px, e
// a lavagem continua aparecendo em volta dela.
//
// ── OS DOIS GESTOS SOBRE A BARRA (R254) ───────────────────────────────────
// · clicar → SELECIONA o trecho inteiro; Delete/Backspace apaga a barra;
// · com o "Remover dia" ligado → passar o cursor PRÉ-VISUALIZA (o dia esmaece)
//   e clicar tira só aquele dia.
// Quando um dia do meio sai, a barra se parte em duas sozinha — não há "quebrar
// a barra", há recalcular os trechos, e cada metade nasce com as duas pontas
// arredondadas. Barra e números saem da MESMA lista de células: não têm como se
// contradizer.
//
// ── A COLUNA FIXA, E A ARMADILHA QUE ELA TRAZ ─────────────────────────────
// A primeira coluna é `position: sticky; left: 0`, senão rolar de lado perde o
// NOME da pessoa. E o card usa `overflow: "clip"`, NUNCA `hidden`: `hidden`
// cria um scroll container e o `sticky` passaria a se ancorar nesta div — cujo
// scrollLeft é sempre 0 —, grudando a coluna no lugar errado. É a mesma
// cicatriz de `GradeSemana.tsx:207-219`.

import { useEffect, useRef, type CSSProperties } from "react";
import { FONT, card, barraDePlantao, barraSelecionada } from "@/lib/ui";
import { ERRO, AVISO, SUCESSO, PRIMARIA } from "@/lib/paleta";
import { CelulaHoras } from "./CelulaHoras";
import {
  VEREDITO_LABEL,
  type GradeDoMes, type TrechoDaEscala, type VereditoDoDia,
} from "./modelo";

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** A altura da faixa colorida dentro da linha — sobra lavagem em volta. */
const ALTURA_BARRA = 22;

/** Par claro/escuro obrigatório (DESIGN_SYSTEM.md §8, anti-padrão nº 9). */
function corDoVeredito(v: VereditoDoDia, isLight: boolean): string {
  if (v === "vazio") return isLight ? "#8b909c" : "rgba(255,255,255,0.35)";
  if (v === "curto") return isLight ? ERRO.light : ERRO.dark;
  if (v === "sobra") return isLight ? AVISO.light : AVISO.dark;
  return isLight ? SUCESSO.light : SUCESSO.dark;
}

export interface DiaSelecionado {
  pessoaId: string;
  dia: string;
}

interface Props {
  grade: GradeDoMes;
  /** Os trechos contínuos, já resolvidos pelo modelo (R254). */
  trechos: TrechoDaEscala[];
  isLight: boolean;
  /** Ausente = grade só de leitura (quem não é gestor). */
  aoDefinir?: (dia: string, pessoaId: string, horas: number | null) => void | Promise<unknown>;
  /** Destaca a coluna do dia aberto — o mesmo gesto da grade da programação. */
  diaAberto?: string | null;
  aoAbrirDia?: (dia: string) => void;
  /** R254: a barra selecionada (âncora); o trecho é derivado dela a cada render. */
  selecao?: DiaSelecionado | null;
  aoSelecionar?: (s: DiaSelecionado | null) => void;
  /** R254: Delete/Backspace com uma barra selecionada. */
  aoRemoverTrecho?: (t: TrechoDaEscala) => void;
  /** R254: o modo "Remover dia" — o clique tira um dia em vez de selecionar. */
  removendoDia?: boolean;
}

export function GradeMes({
  grade, trechos, isLight, aoDefinir, diaAberto, aoAbrirDia,
  selecao, aoSelecionar, aoRemoverTrecho, removendoDia = false,
}: Props) {
  const textPrimary = isLight ? "#141414" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const fundo = isLight ? "#ffffff" : "#141414";
  const linhaFina = isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)";
  // A lavagem de "não é dia útil" — uma só, para sábado, domingo e feriado.
  const lavagem = isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)";
  const n = grade.colunas.length;
  const caixaRef = useRef<HTMLDivElement>(null);

  const trechoSelecionado = selecao
    ? trechos.find((t) => t.pessoaId === selecao.pessoaId && t.dias.includes(selecao.dia)) ?? null
    : null;

  // A ÂNCORA SOBREVIVE, O TRECHO É DERIVADO. Se o dia âncora perder as horas
  // (foi removido, ou a semana trocou de dono), a seleção se desfaz sozinha —
  // em vez de apontar para uma barra que não existe mais.
  useEffect(() => {
    if (selecao && !trechoSelecionado) aoSelecionar?.(null);
  }, [selecao, trechoSelecionado, aoSelecionar]);

  const colunaFixa: CSSProperties = {
    position: "sticky", left: 0, zIndex: 2, background: fundo,
    borderRight: linhaFina, padding: "8px 12px", minWidth: 190, maxWidth: 190,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  };
  const gradeEstilo: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `190px repeat(${n}, minmax(36px, 1fr))`,
    minWidth: 190 + n * 36,
  };

  if (grade.linhas.length === 0) {
    return (
      <div style={{ ...card(isLight), padding: "26px 16px", textAlign: "center" }}>
        <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
          Ninguém da equipe Técnica pode ser escalado, e ninguém tem horas neste período.
        </span>
      </div>
    );
  }

  const fundoDaColuna = (i: number): string => {
    const c = grade.colunas[i];
    if (diaAberto && c.dia === diaAberto) {
      return isLight ? "rgba(200,136,6,0.10)" : "rgba(248,200,17,0.08)";
    }
    return c.util ? "transparent" : lavagem;
  };

  /** A linha do grid de cada pessoa: 1 é o cabeçalho. */
  const linhaDe = (indice: number) => 2 + indice;

  return (
    <div
      className="trilho-x sangra-x"
      ref={caixaRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        // Digitar numa célula não pode apagar a barra: o Delete de dentro de um
        // campo de texto é do campo.
        const alvo = e.target as HTMLElement | null;
        if (alvo && (alvo.tagName === "INPUT" || alvo.isContentEditable)) return;
        if (!trechoSelecionado || !aoRemoverTrecho) return;
        e.preventDefault();
        aoRemoverTrecho(trechoSelecionado);
      }}
      style={{ outline: "none" }}
    >
      <div style={{ ...card(isLight), overflow: "clip", minWidth: "max-content" }}>
        <div style={gradeEstilo}>
          {/* ── cabeçalho: dia da semana + número ── */}
          <div style={{ ...colunaFixa, gridRow: 1, gridColumn: 1, borderBottom: linhaFina }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: textSecondary }}>
              Pessoa
            </span>
            <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary }}>total</span>
          </div>
          {grade.colunas.map((c, i) => (
            <div
              key={c.dia}
              title={c.rotulo ?? undefined}
              onClick={aoAbrirDia ? () => aoAbrirDia(c.dia) : undefined}
              style={{
                gridRow: 1, gridColumn: 2 + i,
                padding: "6px 2px", textAlign: "center", borderBottom: linhaFina,
                background: fundoDaColuna(i),
                cursor: aoAbrirDia ? "pointer" : "default",
              }}
            >
              <div style={{ fontFamily: FONT, fontSize: 9, color: textSecondary, lineHeight: 1.2 }}>
                {DIA_CURTO[c.diaDaSemana]}
              </div>
              <div
                style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 700, lineHeight: 1.3,
                  color: c.feriado ? (isLight ? PRIMARIA.light : PRIMARIA.dark) : textPrimary,
                }}
              >
                {c.numero}
              </div>
              {/* O ponto do feriado. Ele NÃO substitui o `title`: o ponto diz
                  "tem nome", o texto diz QUAL. */}
              {c.rotulo ? (
                <div
                  aria-hidden
                  style={{
                    width: 4, height: 4, borderRadius: 999, margin: "1px auto 0",
                    background: isLight ? PRIMARIA.light : PRIMARIA.dark,
                  }}
                />
              ) : null}
            </div>
          ))}

          {/* ── uma linha por pessoa ── */}
          {grade.linhas.map((l, indice) => {
            const meus = trechos.filter((t) => t.pessoaId === l.pessoa.id);
            const cobertoPorBarra = new Set<string>();
            for (const t of meus) for (const d of t.dias) cobertoPorBarra.add(d);
            const selecionadoAqui = trechoSelecionado?.pessoaId === l.pessoa.id
              ? trechoSelecionado : null;
            return (
              <div key={l.pessoa.id} style={{ display: "contents" }}>
                <div
                  style={{
                    ...colunaFixa, gridRow: linhaDe(indice), gridColumn: 1, borderBottom: linhaFina,
                    // Quem saiu da empresa (ou não é da equipe técnica) continua
                    // no histórico, esmaecido. É o ON DELETE RESTRICT da FK
                    // contado em pixels.
                    opacity: l.pessoa.historico ? 0.55 : 1,
                  }}
                  title={l.pessoa.historico
                    ? "não pode ser escalado (fora da equipe técnica, inativo ou convite pendente) — continua aqui porque tem horas neste período"
                    : undefined}
                >
                  <span
                    style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 600, color: textPrimary,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {l.pessoa.nome}
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: textSecondary }}>
                    {l.total}h
                  </span>
                </div>

                {/* as células: só desenham o número quando NÃO há barra por cima
                    (a barra o desenha) ou quando a barra está selecionada — aí a
                    caixa de digitar aparece por cima dela */}
                {l.celulas.map((cel, i) => {
                  const naBarra = cobertoPorBarra.has(cel.dia);
                  const editavel = !!aoDefinir && !l.pessoa.historico;
                  // R256: com a ferramenta de REMOVER DIA ligada não há caixa
                  // de digitar em lugar nenhum — o clique ali apaga, e uma
                  // setinha de somar/subtrair ao lado de um clique que deleta é
                  // a tela oferecendo duas coisas opostas no mesmo pixel.
                  const mostraCaixa = editavel && !removendoDia
                    && (!naBarra || (!!selecionadoAqui && selecionadoAqui.dias.includes(cel.dia)));
                  return (
                    <div
                      key={cel.dia}
                      style={{
                        gridRow: linhaDe(indice), gridColumn: 2 + i,
                        borderBottom: linhaFina, background: fundoDaColuna(i),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: 0, minHeight: 34,
                      }}
                    >
                      {mostraCaixa ? (
                        // ESTADO LOCAL, GRAVA NO BLUR/ENTER. A célula NÃO é um
                        // input controlado pelo servidor — ver o cabeçalho de
                        // CelulaHoras.tsx, que é onde a cicatriz está escrita.
                        <CelulaHoras
                          horas={cel.horas}
                          ariaLabel={`${l.pessoa.nome} em ${cel.dia}`}
                          title={grade.colunas[i].rotulo ?? undefined}
                          aoDefinir={(h) => aoDefinir!(cel.dia, l.pessoa.id, h)}
                          estilo={{
                            width: "100%", height: 30, border: "none", background: "transparent",
                            textAlign: "center", fontFamily: FONT, fontSize: 12, fontWeight: 600,
                            color: textPrimary, outline: "none", position: "relative", zIndex: 1,
                            colorScheme: isLight ? "light" : "dark",
                          }}
                        />
                      ) : !naBarra ? (
                        <span style={{ fontFamily: FONT, fontSize: 12, color: textPrimary, padding: "6px 0" }}>
                          {cel.horas ?? ""}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {/* ── a barra: um elemento por trecho contíguo ── */}
                {meus.map((t) => {
                  const selecionado = selecionadoAqui === t;
                  const quantos = t.fim - t.inicio + 1;
                  return (
                    <div
                      key={`${t.pessoaId}-${t.inicio}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Sobreaviso de ${l.pessoa.nome}, ${t.dias.length} dia(s), ${t.horas} h`}
                      aria-pressed={selecionado}
                      title={removendoDia
                        ? "Clique num dia para tirar o sobreaviso dele"
                        : `${l.pessoa.nome} · ${t.horas} h · clique para selecionar (Delete apaga)`}
                      onClick={(e) => { e.stopPropagation(); if (!removendoDia) aoSelecionar?.({ pessoaId: t.pessoaId, dia: t.dias[0] }); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          aoSelecionar?.({ pessoaId: t.pessoaId, dia: t.dias[0] });
                        }
                      }}
                      style={{
                        gridRow: linhaDe(indice),
                        gridColumn: `${2 + t.inicio} / span ${quantos}`,
                        alignSelf: "center",
                        height: ALTURA_BARRA,
                        // ponta RETA quando o plantão continua fora da janela —
                        // arredondar ali afirmaria que ele acabou aqui
                        borderRadius: `${t.abertoAntes ? 0 : 999}px ${t.abertoDepois ? 0 : 999}px ${t.abertoDepois ? 0 : 999}px ${t.abertoAntes ? 0 : 999}px`,
                        marginLeft: t.abertoAntes ? 0 : 3,
                        marginRight: t.abertoDepois ? 0 : 3,
                        ...barraDePlantao(isLight),
                        ...(selecionado ? barraSelecionada(isLight) : null),
                        cursor: removendoDia ? "crosshair" : "pointer",
                        display: "grid",
                        gridTemplateColumns: `repeat(${quantos}, 1fr)`,
                        alignItems: "center",
                        overflow: "hidden",
                      }}
                    >
                      {t.dias.map((d, k) => {
                        const horas = l.celulas[t.inicio + k]?.horas ?? null;
                        const escondido = !!selecionadoAqui && selecionadoAqui.dias.includes(d);
                        return (
                          <span
                            key={d}
                            className={removendoDia ? "dia-removivel" : undefined}
                            title={removendoDia ? `Tirar o sobreaviso de ${l.pessoa.nome} em ${d.slice(8, 10)}/${d.slice(5, 7)}` : undefined}
                            onClick={removendoDia && aoDefinir
                              ? (e) => { e.stopPropagation(); void aoDefinir(d, l.pessoa.id, null); }
                              : undefined}
                            style={{
                              textAlign: "center", fontFamily: FONT, fontSize: 12, fontWeight: 600,
                              lineHeight: `${ALTURA_BARRA}px`, cursor: removendoDia ? "crosshair" : "inherit",
                              // com a caixa de digitar por cima, o número da
                              // barra sai de cena para não duplicar
                              opacity: escondido ? 0 : 1,
                            }}
                          >
                            {horas ?? ""}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* ── A FAIXA DE COBERTURA — a linha que valida o plano inteiro ──
              14 em dia útil, 24 em fim de semana e feriado, DERIVADO do
              calendário. Ela não depende de nenhum atendimento registrado. */}
          <div style={{ ...colunaFixa, gridRow: 2 + grade.linhas.length, gridColumn: 1, borderTop: linhaFina }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: textSecondary }}>
              Cobertura
            </span>
            <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
              {grade.censo.ok}/{n} ok
            </span>
          </div>
          {grade.colunas.map((c, i) => (
            <div
              key={`cob-${c.dia}`}
              title={`${c.somado}h de ${c.cobertura}h — ${VEREDITO_LABEL[c.veredito]}${c.rotulo ? ` · ${c.rotulo}` : ""}`}
              style={{
                gridRow: 2 + grade.linhas.length, gridColumn: 2 + i,
                borderTop: linhaFina, background: fundoDaColuna(i),
                textAlign: "center", padding: "6px 0",
                fontFamily: FONT, fontSize: 11, fontWeight: 700,
                color: corDoVeredito(c.veredito, isLight),
              }}
            >
              {c.somado}/{c.cobertura}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
