// A GRADE DO SOBREAVISO: pessoa × dias do mês (desktop) — U86.
//
// Recebe `GradeDoMes` PRONTA e desenha. Não filtra, não soma, não decide quem
// aparece e não sabe o que é feriado: `gradeDoMes()` já resolveu tudo isso, e é
// lá que a asserção mora.
//
// ── A COLUNA FIXA, E A ARMADILHA QUE ELA TRAZ ─────────────────────────────
// 190px de nome + 31 colunas de 36px = ~1306px de trilho — mais estreito, aliás,
// do que os ~1240px+ que a grade da programação já põe no ar com 7 cartões de
// 150px. A primeira coluna é `position: sticky; left: 0`, senão rolar de lado
// perde o NOME da pessoa e a grade fica ilegível.
//
// E o card usa `overflow: "clip"`, NUNCA `hidden`. `overflow: hidden` CRIA um
// scroll container, e `position: sticky` resolve contra o container mais
// próximo: com `hidden` aqui, o sticky se ancoraria nesta div — cujo scrollLeft
// é sempre 0 — e a coluna "grudaria" onde já está, rolando para fora junto com
// o resto. `clip` recorta o canto arredondado sem criar container, e o sticky
// volta a se ancorar no `.trilho-x`, que é quem rola de verdade. É a mesma
// cicatriz de `GradeSemana.tsx:207-219`.
//
// CUIDADO COM O PRIMO ERRADO: `routes/_authenticated/gerencial.permissoes.tsx`
// é a tela mais parecida em FORMA (matriz com cabeçalho fixo) e ela tem
// `sticky top: 0` e NÃO tem `left: 0`. Quem for construir a próxima matriz vai
// copiar aquela, e vai perder a coluna fixa sem notar.
//
// ── UMA LAVAGEM SÓ PARA "NÃO É DIA ÚTIL" ──────────────────────────────────
// Fim de semana e feriado valem o MESMO: 24h. Duas cores diferentes
// afirmariam uma distinção que a regra não faz. O que os distingue é o NOME no
// `title` — e cor nenhuma transporta "Corpus Christi".

import { type CSSProperties } from "react";
import { FONT, card } from "@/lib/ui";
import { ERRO, AVISO, SUCESSO, PRIMARIA } from "@/lib/paleta";
import { CelulaHoras } from "./CelulaHoras";
import {
  VEREDITO_LABEL,
  type GradeDoMes, type VereditoDoDia,
} from "./modelo";

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Par claro/escuro obrigatório (DESIGN_SYSTEM.md §8, anti-padrão nº 9). */
function corDoVeredito(v: VereditoDoDia, isLight: boolean): string {
  if (v === "vazio") return isLight ? "#8b909c" : "rgba(255,255,255,0.35)";
  if (v === "curto") return isLight ? ERRO.light : ERRO.dark;
  if (v === "sobra") return isLight ? AVISO.light : AVISO.dark;
  return isLight ? SUCESSO.light : SUCESSO.dark;
}

interface Props {
  grade: GradeDoMes;
  isLight: boolean;
  /** Ausente = grade só de leitura (quem não é gestor). */
  aoDefinir?: (dia: string, pessoaId: string, horas: number | null) => void;
  /** Destaca a coluna do dia aberto — o mesmo gesto da grade da programação. */
  diaAberto?: string | null;
  aoAbrirDia?: (dia: string) => void;
}

export function GradeMes({ grade, isLight, aoDefinir, diaAberto, aoAbrirDia }: Props) {
  const textPrimary = isLight ? "#12141c" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const fundo = isLight ? "#ffffff" : "#141416";
  const linhaFina = isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)";
  // A lavagem de "não é dia útil" — uma só, para sábado, domingo e feriado.
  const lavagem = isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)";
  const n = grade.colunas.length;

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
          Ninguém pode ser escalado e ninguém tem horas neste mês.
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

  return (
    <div className="trilho-x sangra-x">
      <div style={{ ...card(isLight), overflow: "clip", minWidth: "max-content" }}>
        <div style={gradeEstilo}>
          {/* ── cabeçalho: dia da semana + número ── */}
          <div style={{ ...colunaFixa, borderBottom: linhaFina }}>
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
          {grade.linhas.map((l) => (
            <div key={l.pessoa.id} style={{ display: "contents" }}>
              <div
                style={{
                  ...colunaFixa, borderBottom: linhaFina,
                  // Quem saiu da empresa continua no histórico, esmaecido. É o
                  // ON DELETE RESTRICT da FK contado em pixels.
                  opacity: l.pessoa.historico ? 0.55 : 1,
                }}
                title={l.pessoa.historico
                  ? "não pode ser escalado (inativo ou convite pendente) — continua aqui porque tem horas neste mês"
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
              {l.celulas.map((cel, i) => (
                <div
                  key={cel.dia}
                  style={{
                    borderBottom: linhaFina, background: fundoDaColuna(i),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0,
                  }}
                >
                  {aoDefinir && !l.pessoa.historico ? (
                    // ESTADO LOCAL, GRAVA NO BLUR/ENTER. A célula NÃO é um
                    // input controlado pelo servidor — ver o cabeçalho de
                    // CelulaHoras.tsx, que é onde a cicatriz está escrita.
                    <CelulaHoras
                      horas={cel.horas}
                      ariaLabel={`${l.pessoa.nome} em ${cel.dia}`}
                      title={grade.colunas[i].rotulo ?? undefined}
                      aoDefinir={(h) => aoDefinir(cel.dia, l.pessoa.id, h)}
                      estilo={{
                        width: "100%", height: 30, border: "none", background: "transparent",
                        textAlign: "center", fontFamily: FONT, fontSize: 12, fontWeight: 600,
                        color: textPrimary, outline: "none",
                        colorScheme: isLight ? "light" : "dark",
                      }}
                    />
                  ) : (
                    <span style={{ fontFamily: FONT, fontSize: 12, color: textPrimary, padding: "6px 0" }}>
                      {cel.horas ?? ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* ── A FAIXA DE COBERTURA — a linha que valida o plano inteiro ──
              14 em dia útil, 24 em fim de semana e feriado, DERIVADO do
              calendário. Ela não depende de nenhum atendimento registrado. */}
          <div style={{ ...colunaFixa, borderTop: linhaFina }}>
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
