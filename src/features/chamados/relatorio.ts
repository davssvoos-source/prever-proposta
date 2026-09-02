// Relatório de atendimento (PDF) de uma Ordem de Serviço — Etapa 4 do sistema
// de OS. Gerado no cliente com jsPDF (já usado no projeto), com a identidade
// visual da Prever: faixa dourada, títulos em caixa alta espaçada, texto
// escuro. Inclui fotos antes/depois e a assinatura de quem recebeu o serviço.

import { supabase } from "@/integrations/supabase/client";
import { slug } from "@/lib/format";
import {
  PRIORIDADE_LABEL, TIPO_LABEL, chamadoStatusInfo,
  type ChamadoPrioridade, type ChamadoTipo,
} from "@/lib/chamado-status";

const OURO: [number, number, number] = [255, 192, 0];
const ESCURO: [number, number, number] = [10, 11, 14];
const CINZA: [number, number, number] = [110, 116, 128];
const LINHA: [number, number, number] = [222, 226, 232];

const MARGEM = 15;
const LARGURA = 210; // A4 retrato em mm
const ALTURA = 297;
const UTIL = LARGURA - MARGEM * 2;

interface ImagemPronta {
  dataUrl: string;
  largura: number;
  altura: number;
  /** Formato declarado ao jsPDF — deduzido do próprio dataURL. */
  formato: "JPEG" | "PNG" | "WEBP";
}

function formatoDoDataUrl(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

/** Baixa a imagem do storage e devolve dataURL + dimensões (para não distorcer). */
async function carregarImagem(path: string | null | undefined): Promise<ImagemPronta | null> {
  if (!path) return null;
  try {
    const { data } = await supabase.storage.from("fotos-os").createSignedUrl(path, 3600);
    if (!data?.signedUrl) return null;
    const resp = await fetch(data.signedUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const largura = bitmap.width;
    const altura = bitmap.height;
    bitmap.close();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result as string);
      leitor.onerror = reject;
      leitor.readAsDataURL(blob);
    });
    return { dataUrl, largura, altura, formato: formatoDoDataUrl(dataUrl) };
  } catch {
    return null;
  }
}

const fmtDataHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

export interface DadosRelatorioOs {
  numero: string | null;
  tipo: string;
  status: string;
  prioridade: string;
  titulo: string;
  descricao_problema: string | null;
  diagnostico: string | null;
  servico_executado: string | null;
  pecas_texto: string | null;
  created_at: string;
  data_hora_agendada: string | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  assinatura_nome: string | null;
  assinatura_url: string | null;
  cliente?: { nome: string; endereco: string | null; telefone_sindico: string | null } | null;
  sistema?: { nome: string; tipo: string } | null;
}

export interface RelatorioOsOpts {
  os: DadosRelatorioOs;
  tecnicoNome: string | null;
  fotos: { etapa: "antes" | "depois" | "outra"; storage_path: string | null; legenda: string | null }[];
  /**
   * Movimentação de equipamento registrada na OS (Etapa U3). É o que o
   * responsável assina junto com o serviço — e o que o SIGMA imprimia no
   * recibo. Sem valores: o recibo é do cliente, o financeiro é interno.
   */
  pecas?: {
    direcao: string;
    descricao: string;
    numero_serie: string | null;
    tag_patrimonio: string | null;
    quantidade: number;
  }[];
}

/** Gera e baixa o PDF do relatório de atendimento. */
export async function gerarRelatorioOs({ os, tecnicoNome, fotos, pecas = [] }: RelatorioOsOpts): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = 0;

  const novaPagina = () => {
    doc.addPage();
    y = MARGEM;
    faixaTopo(false);
  };

  /** Garante espaço para o próximo bloco; quebra a página se faltar. */
  const espaco = (altura: number) => {
    if (y + altura > ALTURA - 22) novaPagina();
  };

  function faixaTopo(primeira: boolean) {
    doc.setFillColor(...ESCURO);
    doc.rect(0, 0, LARGURA, primeira ? 30 : 14, "F");
    doc.setFillColor(...OURO);
    doc.rect(0, primeira ? 30 : 14, LARGURA, 1.6, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    if (primeira) {
      doc.setFontSize(9);
      doc.text("G R U P O   P R E V E R", MARGEM, 12);
      doc.setFontSize(16);
      doc.text("RELATÓRIO DE ATENDIMENTO", MARGEM, 22);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...OURO);
      doc.text(os.numero ?? "—", LARGURA - MARGEM, 22, { align: "right" });
      y = 40;
    } else {
      doc.setFontSize(8);
      doc.text(`RELATÓRIO DE ATENDIMENTO · ${os.numero ?? ""}`, MARGEM, 9);
      y = 22;
    }
  }

  function tituloSecao(texto: string) {
    espaco(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...OURO);
    doc.text(texto.toUpperCase(), MARGEM, y);
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, y + 1.8, LARGURA - MARGEM, y + 1.8);
    y += 7;
  }

  function linhaCampo(rotulo: string, valor: string) {
    const texto = valor || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const linhas = doc.splitTextToSize(texto, UTIL - 46) as string[];
    espaco(linhas.length * 4.6 + 2);
    doc.setTextColor(...CINZA);
    doc.text(rotulo, MARGEM, y);
    doc.setTextColor(...ESCURO);
    doc.text(linhas, MARGEM + 44, y);
    y += Math.max(5.2, linhas.length * 4.6 + 0.8);
  }

  function paragrafo(texto: string | null) {
    const conteudo = (texto ?? "").trim() || "—";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ESCURO);
    const linhas = doc.splitTextToSize(conteudo, UTIL) as string[];
    for (const linha of linhas) {
      espaco(5.4);
      doc.text(linha, MARGEM, y);
      y += 4.8;
    }
    y += 3;
  }

  // ── Página 1 ──────────────────────────────────────────────────────────────
  faixaTopo(true);

  const info = chamadoStatusInfo(os.status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...ESCURO);
  const tituloLinhas = doc.splitTextToSize(os.titulo, UTIL) as string[];
  doc.text(tituloLinhas, MARGEM, y);
  y += tituloLinhas.length * 5.6 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CINZA);
  doc.text(
    `${TIPO_LABEL[os.tipo as ChamadoTipo] ?? os.tipo} · Prioridade ${
      PRIORIDADE_LABEL[os.prioridade as ChamadoPrioridade] ?? os.prioridade
    } · ${info.label}`,
    MARGEM,
    y,
  );
  y += 8;

  tituloSecao("Cliente");
  linhaCampo("Cliente", os.cliente?.nome ?? "—");
  linhaCampo("Endereço", os.cliente?.endereco ?? "—");
  if (os.cliente?.telefone_sindico) linhaCampo("Contato", os.cliente.telefone_sindico);
  if (os.sistema?.nome) linhaCampo("Sistema atendido", os.sistema.nome);

  tituloSecao("Atendimento");
  linhaCampo("Abertura", fmtDataHora(os.created_at));
  if (os.data_hora_agendada) linhaCampo("Agendamento", fmtDataHora(os.data_hora_agendada));
  linhaCampo("Início", fmtDataHora(os.iniciada_em));
  linhaCampo("Conclusão", fmtDataHora(os.finalizada_em));
  linhaCampo("Técnico responsável", tecnicoNome ?? "—");

  if (os.descricao_problema?.trim()) {
    tituloSecao("Problema relatado");
    paragrafo(os.descricao_problema);
  }

  tituloSecao("Diagnóstico");
  paragrafo(os.diagnostico);

  tituloSecao("Serviço executado");
  paragrafo(os.servico_executado);

  // Movimentação de equipamento (U3). O rótulo diz a direção, porque o que foi
  // RETIRADO do local é justamente o que o responsável precisa conferir antes
  // de assinar.
  if (pecas.length > 0) {
    tituloSecao("Equipamento instalado / retirado");
    const rotulo: Record<string, string> = {
      instalado: "Instalado", retirado: "Retirado", substituido: "Substituído",
    };
    for (const p of pecas) {
      const qtd = Number(p.quantidade) !== 1 ? `${p.quantidade}× ` : "";
      const ident = [
        p.numero_serie ? `série ${p.numero_serie}` : "",
        p.tag_patrimonio ? `TAG ${p.tag_patrimonio}` : "",
      ].filter(Boolean).join(", ");
      paragrafo(
        `• ${rotulo[p.direcao] ?? p.direcao}: ${qtd}${p.descricao}${ident ? ` (${ident})` : ""}`,
      );
    }
  } else if (os.pecas_texto?.trim()) {
    // atendimentos anteriores à U3 continuam saindo com a anotação de texto
    tituloSecao("Peças e materiais aplicados");
    paragrafo(os.pecas_texto);
  }

  // ── Fotos ─────────────────────────────────────────────────────────────────
  const antes = fotos.filter((f) => f.etapa === "antes");
  const depois = fotos.filter((f) => f.etapa === "depois");
  const outras = fotos.filter((f) => f.etapa === "outra");

  async function grade(titulo: string, lista: typeof fotos) {
    if (lista.length === 0) return;
    const imagens = (await Promise.all(lista.map((f) => carregarImagem(f.storage_path)))).filter(
      (i): i is ImagemPronta => !!i,
    );
    if (imagens.length === 0) return;

    tituloSecao(titulo);
    const colunas = 2;
    const larguraCel = (UTIL - 5) / colunas;
    let coluna = 0;
    let alturaLinha = 0;

    for (const img of imagens) {
      const escala = larguraCel / img.largura;
      const alturaImg = Math.min(img.altura * escala, 62);
      const larguraImg = (alturaImg / img.altura) * img.largura;

      if (coluna === 0) {
        espaco(alturaImg + 4);
        alturaLinha = alturaImg;
      }
      const x = MARGEM + coluna * (larguraCel + 5);
      try {
        doc.addImage(img.dataUrl, img.formato, x, y, larguraImg, alturaImg);
      } catch {
        // formato não suportado: ignora a imagem em vez de quebrar o relatório
      }
      alturaLinha = Math.max(alturaLinha, alturaImg);
      coluna++;
      if (coluna === colunas) {
        y += alturaLinha + 4;
        coluna = 0;
        alturaLinha = 0;
      }
    }
    if (coluna !== 0) y += alturaLinha + 4;
  }

  await grade("Registro fotográfico — antes", antes);
  await grade("Registro fotográfico — depois", depois);
  await grade("Outras fotos", outras);

  // ── Assinatura ────────────────────────────────────────────────────────────
  const assinatura = await carregarImagem(os.assinatura_url);
  if (assinatura || os.assinatura_nome) {
    tituloSecao("Aceite do serviço");
    if (assinatura) {
      const larguraAss = 70;
      const alturaAss = Math.min((assinatura.altura / assinatura.largura) * larguraAss, 32);
      espaco(alturaAss + 14);
      try {
        doc.addImage(assinatura.dataUrl, assinatura.formato, MARGEM, y, larguraAss, alturaAss);
      } catch {
        /* segue sem a imagem */
      }
      y += alturaAss + 2;
    } else {
      espaco(16);
      y += 10;
    }
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, y, MARGEM + 70, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...ESCURO);
    doc.text(os.assinatura_nome ?? "—", MARGEM, y);
    doc.setTextColor(...CINZA);
    doc.setFontSize(7.5);
    doc.text("Assinatura de quem acompanhou o atendimento", MARGEM, y + 4);
    y += 10;
  }

  // ── Rodapé em todas as páginas ────────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, ALTURA - 16, LARGURA - MARGEM, ALTURA - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text("Prever Serviços Especializados · (11) 2344-6611 · contato@grupoprever.com.br", MARGEM, ALTURA - 11);
    doc.text(`${p}/${paginas}`, LARGURA - MARGEM, ALTURA - 11, { align: "right" });
  }

  // `slug` mora em src/lib/format.ts desde a U86 — era a MESMA função em três
  // arquivos, e só esta cópia tratava acento. O separador continua `_` para o
  // nome do arquivo não mudar: ele já circula por e-mail.
  const nome = `${slug(os.numero ?? "OS", "_")}-${slug(os.cliente?.nome ?? "Cliente", "_")}.pdf`;
  doc.save(nome);
}
