// Cronograma da implantação — o PDF A4 PAISAGEM (R120, U89).
//
// ── HERDA A DECISÃO DA U86, NÃO REABRE ────────────────────────────────────
// O repositório tinha três PDFs que não concordavam (mm × pt, layout manual ×
// autoTable). A U86 escolheu por todos: `mm`, `autoTable`, e a LARGURA
// DERIVADA de `doc.internal.pageSize.getWidth()` em vez de chumbada. Este
// arquivo segue a mesma escolha — o `src/features/sobreaviso/pdf.ts` conta o
// porquê inteiro e não vale repetir aqui.
//
// ── SÓ WinAnsi CHEGA VIVO NA PÁGINA ───────────────────────────────────────
// jsPDF com helvetica DESCARTA EM SILÊNCIO todo caractere acima de U+00FF.
// Medido nos bytes do PDF na U86: `-` (U+002D) e `·` (U+00B7) saem; `—`, `–`,
// `•` e `…` viram NADA — e os acentos saem certos, porque são WinAnsi de um
// byte. Então NENHUMA travessão nem bolinha neste arquivo, em nenhuma string
// que vá para a folha. O verificador varre isto.
//
// ── A FASE É COR **E** DÍGITO ─────────────────────────────────────────────
// Cronograma de obra é impresso, e boa parte das impressoras da operação é
// monocromática. Uma legenda só por cor viraria quatro tons de cinza
// indistinguíveis. Então cada dia carrega o DÍGITO da fase além do fundo, e a
// legenda casa dígito com nome. A cor é conforto; o dígito é a informação.

import { slug } from "@/lib/format";
import {
  FASES, FASE_LABEL, calendarioDoPeriodo, semanasDoMes, rotuloDoMes,
  contarDiasUteis, contarDiasCorridos, periodoConferido,
  type Fase, type LinhaCronograma,
} from "./modelo";
import { ANO_CONFERIDO_DESDE, ANO_CONFERIDO_ATE, rotuloDoDia } from "@/lib/feriados";

const OURO: [number, number, number] = [255, 192, 0];
const ESCURO: [number, number, number] = [10, 11, 14];
const CINZA: [number, number, number] = [110, 116, 128];
const NAO_UTIL: [number, number, number] = [232, 234, 237];

/** Fundos claros o bastante para o texto preto sobreviver à impressão. */
const COR_DA_FASE: Record<Fase, [number, number, number]> = {
  infraestrutura: [255, 236, 179],
  instalacao: [255, 213, 110],
  configuracao: [187, 222, 251],
  acabamento: [200, 230, 201],
};

/** O dígito é 1..4, na ordem de execução. Legenda e célula usam o mesmo. */
export function digitoDaFase(fase: Fase): string {
  return String(FASES.indexOf(fase) + 1);
}

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export interface DadosDoCronograma {
  numero: string | null;
  titulo: string | null;
  cliente: string | null;
  endereco: string | null;
  inicio: string;
  fim: string;
  linhas: LinhaCronograma[];
}

const dataBr = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export async function gerarPdfCronograma(d: DadosDoCronograma): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const LARGURA = doc.internal.pageSize.getWidth();
  const ALTURA = doc.internal.pageSize.getHeight();
  const MARGEM = 10;

  // ── FAIXA DOURADA ──────────────────────────────────────────────────────
  doc.setFillColor(...ESCURO);
  doc.rect(0, 0, LARGURA, 22, "F");
  doc.setFillColor(...OURO);
  doc.rect(0, 22, LARGURA, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("CRONOGRAMA DE IMPLANTACAO", MARGEM, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 203, 210);
  const cabecalho = [
    d.numero ? `OS ${d.numero}` : null,
    d.cliente,
    `${dataBr(d.inicio)} a ${dataBr(d.fim)}`,
    `${contarDiasUteis(d.inicio, d.fim)} dias uteis de ${contarDiasCorridos(d.inicio, d.fim)} corridos`,
  ].filter(Boolean).join("   ·   ");
  doc.text(cabecalho, MARGEM, 17);

  let y = 30;

  if (d.titulo) {
    doc.setTextColor(...ESCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(d.titulo, LARGURA - MARGEM * 2)[0], MARGEM, y);
    y += 5;
  }
  if (d.endereco) {
    doc.setTextColor(...CINZA);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(d.endereco, LARGURA - MARGEM * 2)[0], MARGEM, y);
    y += 5;
  }

  // ── LEGENDA: dígito, cor, nome, e as datas planejadas de cada fase ──────
  y += 2;
  const porFase = new Map<Fase, LinhaCronograma>();
  for (const l of d.linhas) porFase.set(l.fase, l);

  const largura = (LARGURA - MARGEM * 2) / 4;
  for (let i = 0; i < FASES.length; i += 1) {
    const fase = FASES[i];
    const x = MARGEM + largura * i;
    doc.setFillColor(...COR_DA_FASE[fase]);
    doc.rect(x, y, 5, 5, "F");
    doc.setTextColor(...ESCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(digitoDaFase(fase), x + 1.7, y + 3.7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(FASE_LABEL[fase], x + 7, y + 2.4);
    const l = porFase.get(fase);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(l ? `${dataBr(l.inicio)} a ${dataBr(l.fim)}` : "sem data", x + 7, y + 5.6);
  }
  y += 11;

  // ── OS MESES ───────────────────────────────────────────────────────────
  const meses = calendarioDoPeriodo(d.inicio, d.fim, d.linhas);
  // Dois meses por linha da folha: em paisagem cabem confortavelmente, e uma
  // obra de seis meses sai em tres blocos em vez de seis paginas.
  const LARG_MES = (LARGURA - MARGEM * 2 - 8) / 2;

  // A altura que a coluna da esquerda alcancou, para a da direita nao a
  // atropelar. Variavel LOCAL, e nao um campo pendurado no objeto `doc`: o
  // `doc` atravessa a funcao inteira e um campo nele sobreviveria a lugares
  // que nada tem a ver com esta conta.
  let fimDaEsquerda = 0;

  for (let i = 0; i < meses.length; i += 1) {
    const mes = meses[i];
    const semanas = semanasDoMes(mes);
    const coluna = i % 2;
    const x = MARGEM + coluna * (LARG_MES + 8);

    // Antes de desenhar a coluna da esquerda, decide se o par cabe na pagina.
    if (coluna === 0) {
      const parceiro = meses[i + 1] ? semanasDoMes(meses[i + 1]).length : 0;
      const alto = 8 + Math.max(semanas.length, parceiro) * 8 + 8;
      if (y + alto > ALTURA - 16) {
        doc.addPage();
        y = MARGEM + 4;
      }
    }

    const yMes = y;
    doc.setTextColor(...ESCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(rotuloDoMes(mes.referencia), x, yMes);

    const corpo = semanas.map((semana) =>
      semana.map((dia) => {
        if (!dia) return "";
        const n = String(Number(dia.iso.slice(8, 10)));
        if (dia.fases.length === 0) return n;
        const digitos = dia.fases.map(digitoDaFase);
        const marca = digitos.length > 1
          ? `${digitos[0]}-${digitos[digitos.length - 1]}`
          : digitos[0];
        return `${n}\n${marca}`;
      }),
    );

    autoTable(doc, {
      startY: yMes + 2,
      margin: { left: x },
      tableWidth: LARG_MES,
      head: [DIAS_DA_SEMANA],
      body: corpo,
      theme: "grid",
      styles: {
        font: "helvetica", fontSize: 6.5, cellPadding: 1,
        halign: "center", valign: "middle", textColor: ESCURO,
        lineColor: [210, 213, 218], lineWidth: 0.1, minCellHeight: 7,
      },
      headStyles: {
        fillColor: [244, 245, 247], textColor: CINZA,
        fontStyle: "bold", fontSize: 6, minCellHeight: 5,
      },
      didParseCell: (dados: any) => {
        if (dados.section !== "body") return;
        const dia = semanas[dados.row.index]?.[dados.column.index];
        if (!dia) {
          dados.cell.styles.fillColor = [252, 252, 253];
          return;
        }
        if (dia.fase) {
          dados.cell.styles.fillColor = COR_DA_FASE[dia.fase];
          if (!dia.util) dados.cell.styles.textColor = CINZA;
        } else if (!dia.util) {
          dados.cell.styles.fillColor = NAO_UTIL;
          dados.cell.styles.textColor = CINZA;
        }
      },
    });

    // `?.` E FALLBACK, como o precedente da U86 (sobreaviso/pdf.ts:161).
    // `lastAutoTable` e propriedade que a biblioteca pendura no doc DEPOIS de
    // desenhar; ler `.finalY` de um undefined lanca TypeError e leva o PDF
    // inteiro junto. O fallback e uma estimativa da altura da grade, e ele so
    // e usado num caminho que nao deveria existir.
    const fim = ((doc as any).lastAutoTable?.finalY as number | undefined)
      ?? (yMes + 2 + 5 + semanas.length * 7);

    if (coluna === 0) {
      // A esquerda NAO avanca o cursor: a direita comeca na mesma altura.
      fimDaEsquerda = fim;
      // ... a nao ser que ela seja o ultimo mes, e entao nao ha direita.
      if (i === meses.length - 1) y = fim + 7;
    } else {
      y = Math.max(fim, fimDaEsquerda) + 7;
    }
  }

  // ── OS FERIADOS DO PERÍODO, NOMEADOS ───────────────────────────────────
  // A grade mostra que o dia esta fora; ela nao diz POR QUE. Um cliente que
  // recebe o cronograma e ve a obra parada numa quinta-feira pergunta, e a
  // resposta tem de estar na propria folha.
  const feriados: string[] = [];
  for (const mes of meses) {
    for (const dia of mes.dias) {
      if (dia.util) continue;
      const rotulo = rotuloDoDia(dia.iso);
      if (rotulo) feriados.push(`${dataBr(dia.iso)} ${rotulo}`);
    }
  }
  if (feriados.length > 0) {
    if (y + 6 + Math.ceil(feriados.length / 3) * 4 > ALTURA - 14) {
      doc.addPage();
      y = MARGEM + 4;
    }
    doc.setTextColor(...ESCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Feriados no periodo", MARGEM, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    const porLinha = 3;
    for (let i = 0; i < feriados.length; i += porLinha) {
      const linha = feriados.slice(i, i + porLinha);
      for (let j = 0; j < linha.length; j += 1) {
        doc.text(linha[j], MARGEM + j * ((LARGURA - MARGEM * 2) / porLinha), y);
      }
      y += 4;
    }
  }

  // ── RODAPÉ ─────────────────────────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...CINZA);
    const aviso = periodoConferido(d.inicio, d.fim)
      ? "Sabados, domingos e feriados nacionais e de Sao Paulo estao fora da contagem de dias uteis."
      : `Feriados conferidos a mao de ${ANO_CONFERIDO_DESDE} a ${ANO_CONFERIDO_ATE}. Fora dessa janela eles seguem calculados: confira as datas.`;
    doc.text(aviso, MARGEM, ALTURA - 6);
    doc.text(`${p}/${paginas}`, LARGURA - MARGEM, ALTURA - 6, { align: "right" });
  }

  const nome = slug(
    `cronograma-${d.numero ?? "obra"}-${d.cliente ?? ""}-${d.inicio}`,
  );
  doc.save(`${nome}.pdf`);
}
