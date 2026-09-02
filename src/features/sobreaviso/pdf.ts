// Sobreaviso — o PDF A4 PAISAGEM (R116, U86).
//
// ── OS TRÊS PRECEDENTES NÃO SÃO UM PADRÃO SÓ, E ISSO IMPORTA ───────────────
// O repositório já gera PDF em três lugares, e eles NÃO concordam:
//   · features/chamados/relatorio.ts  — unidade `mm`, layout manual
//   · features/financeiro/fechamentos.ts — unidade `mm`, layout manual
//   · features/projeto/ExportarTab.tsx — unidade `pt`, `autoTable`
// Nenhum dos três passa `orientation`, e `relatorio.ts:18` chuma
// `const LARGURA = 210; // A4 retrato em mm` — ESSA CONSTANTE É A SUPOSIÇÃO DE
// RETRATO, escrita à mão. Copiá-la para cá seria escrever 297 chumbado, que é o
// mesmo erro com outro número.
//
// A ESCOLHA, e ela não inventa um quarto jeito:
//   · `mm` — dois dos três, e é a unidade da faixa dourada que o Davi conhece;
//   · `autoTable` — o único viável para 31 colunas (o layout manual exigiria
//     recalcular quebra de página a cada mês de 31 dias);
//   · `orientation: "landscape"` — é o que é NOVO aqui, e é uma linha;
//   · `LARGURA` DERIVADA de `doc.internal.pageSize.getWidth()`, nunca chumbada.
//     Assim a faixa e o rodapé acompanham a orientação sozinhos, e o próximo
//     PDF que virar paisagem não redescobre isto.
//
// A FAIXA DE COBERTURA É A ÚLTIMA LINHA DA TABELA. Ela é o que valida o plano
// inteiro sem um único atendimento registrado: 14 em dia útil, 24 em fim de
// semana e feriado, derivado do CALENDÁRIO e não da soma que o app fez.

import { slug } from "@/lib/format";
import { rotuloDaCompetencia, type GradeDoMes } from "./modelo";
import { ANO_CONFERIDO_ATE, conferido } from "@/lib/feriados";

const OURO: [number, number, number] = [255, 192, 0];
const ESCURO: [number, number, number] = [10, 11, 14];
const CINZA: [number, number, number] = [110, 116, 128];

// ── SÓ WinAnsi CHEGA VIVO NA PÁGINA ────────────────────────────────────────
// jsPDF com a fonte padrão (helvetica) DESCARTA EM SILÊNCIO todo caractere
// acima de U+00FF. Medido nos bytes do PDF gerado com o mesmo par de
// bibliotecas que o app importa: `-` (U+002D) e `·` (U+00B7) saem; `—`
// (U+2014), `–`, `•` e `…` viram NADA — e os acentos saem certos, porque são
// WinAnsi de um byte.
//
// A meia-risca era o símbolo do PIOR caso ("sem ninguém"): a legenda do rodapé
// explicava um símbolo que a página nunca imprimia, e a célula do dia
// descoberto saía vazia. O conserto é troca de caractere, não mecanismo novo.
//
// O DEFEITO É DE CLASSE E É PRÉ-EXISTENTE: nenhum dos quatro PDFs do sistema
// embute fonte, e `features/chamados/relatorio.ts` usa `—` como placeholder de
// OS sem número e `•` na lista de peças — os dois somem hoje. Está declarado em
// PENDENCIAS_TECNICAS.md; a asserção do verificador varre ESTE arquivo.
/** O símbolo do veredito, para caber numa coluna de 6mm. WinAnsi, sempre. */
const MARCA: Record<string, string> = {
  vazio: "-",
  curto: "!",
  ok: "ok",
  sobra: "+",
};

export async function gerarPdfSobreaviso(grade: GradeDoMes): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  // PAISAGEM. É a única linha nova em relação aos três precedentes.
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  // DERIVADA, e não `297`. Chumbar a largura é a suposição de retrato ao
  // contrário — ela quebra no dia em que alguém trocar o formato.
  const LARGURA = doc.internal.pageSize.getWidth();
  const ALTURA = doc.internal.pageSize.getHeight();
  const MARGEM = 10;

  const ano = Number(grade.competencia.slice(0, 4));

  // ── faixa escura com dourado, o mesmo cabeçalho do fechamento ────────────
  doc.setFillColor(...ESCURO);
  doc.rect(0, 0, LARGURA, 22, "F");
  doc.setTextColor(...OURO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("GRUPO PREVER", MARGEM, 11);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Escala de sobreaviso · ${rotuloDaCompetencia(grade.competencia)}`, MARGEM, 17.5);
  doc.setFontSize(8);
  doc.text(
    `Total do mês: ${grade.total} h  ·  ${grade.linhas.length} pessoa(s)`,
    LARGURA - MARGEM,
    11,
    { align: "right" },
  );
  // A HONESTIDADE DO CALENDÁRIO VAI IMPRESSA. Um PDF circula por e-mail e
  // sobrevive à tela; se o ano não foi conferido contra o decreto, quem receber
  // a folha precisa saber disso na folha, não na tela de onde ela saiu.
  doc.text(
    conferido(ano)
      ? `Calendário de feriados conferido até ${ANO_CONFERIDO_ATE}`
      : `ATENÇÃO: o calendário de feriados NÃO foi conferido para ${ano} (conferido até ${ANO_CONFERIDO_ATE}) · os dias marcados como úteis podem estar errados`,
    LARGURA - MARGEM,
    17.5,
    { align: "right" },
  );

  const cabecalho = [
    "Pessoa",
    ...grade.colunas.map((c) => String(c.numero)),
    "Total",
  ];

  const corpo: (string | number)[][] = grade.linhas.map((l) => [
    // "(saiu)" é PREFIXO e não sufixo: a coluna 0 tem 38mm com `overflow:
    // hidden` (corte seco), então o que está no fim é o primeiro a cair — e o
    // marcador sumia justamente nos nomes compridos. Na tela quem carrega essa
    // informação é a opacidade; no PDF é só esta palavra.
    l.pessoa.historico ? `(saiu) ${l.pessoa.nome}` : l.pessoa.nome,
    ...l.celulas.map((c) => (c.horas === null ? "" : String(c.horas))),
    String(l.total),
  ]);

  // A FAIXA DE COBERTURA — a última linha, e é ela que valida o plano.
  corpo.push([
    "Cobertura esperada",
    ...grade.colunas.map((c) => String(c.cobertura)),
    String(grade.colunas.reduce((s, c) => s + c.cobertura, 0)),
  ]);
  corpo.push([
    "Somado / veredito",
    ...grade.colunas.map((c) => `${c.somado}${MARCA[c.veredito] === "ok" ? "" : MARCA[c.veredito]}`),
    String(grade.total),
  ]);

  // As colunas dos dias NÃO ÚTEIS ganham fundo, e é a MESMA lavagem para fim
  // de semana e feriado — os dois valem 24h. O que os distingue é a legenda de
  // feriados no rodapé, porque cor nenhuma transporta "Corpus Christi".
  const naoUteis = new Set(
    grade.colunas.map((c, i) => (c.util ? -1 : i + 1)).filter((i) => i > 0),
  );

  autoTable(doc, {
    head: [cabecalho],
    body: corpo,
    startY: 27,
    margin: { left: MARGEM, right: MARGEM, bottom: 16 },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 0.9, halign: "center", overflow: "hidden" },
    headStyles: { fillColor: ESCURO, textColor: OURO, fontSize: 6.5, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", cellWidth: 38, fontSize: 7 } },
    didParseCell: (d: any) => {
      if (d.section === "body" && d.column.index === 0) d.cell.styles.halign = "left";
      if (naoUteis.has(d.column.index)) {
        d.cell.styles.fillColor = d.section === "head" ? ESCURO : [238, 240, 244];
      }
      // as duas últimas linhas do corpo são a faixa de cobertura
      if (d.section === "body" && d.row.index >= corpo.length - 2) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [248, 249, 251];
      }
    },
  });

  // ── legenda dos dias não úteis, com o NOME ───────────────────────────────
  const nomeados = grade.colunas.filter((c) => c.rotulo);
  let y = (doc as any).lastAutoTable?.finalY ?? 27;
  if (nomeados.length > 0) {
    y += 5;
    if (y > ALTURA - 20) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    const linhas = doc.splitTextToSize(
      "Dias com nome: " + nomeados.map((c) => `${c.numero}: ${c.rotulo}`).join("  ·  "),
      LARGURA - MARGEM * 2,
    );
    doc.text(linhas, MARGEM, y);
    y += linhas.length * 3.2;
  }

  // ── rodapé em todas as páginas ───────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(222, 226, 232);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, ALTURA - 11, LARGURA - MARGEM, ALTURA - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(
      "Prever Serviços Especializados · (11) 2344-6611 · contato@grupoprever.com.br"
      + "  ·  ! = falta cobertura   + = mais de um plantonista   - = sem ninguém",
      MARGEM,
      ALTURA - 6,
    );
    doc.text(`${p}/${paginas}`, LARGURA - MARGEM, ALTURA - 6, { align: "right" });
  }

  doc.save(`sobreaviso-${slug(grade.competencia)}.pdf`);
}
