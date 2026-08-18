// Fechamentos de período — Etapa U5 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §3.2 e §5.2.
//
// Fecha o ciclo do Vinicius: programar → executar → conferir → fechar → mandar
// para o financeiro. O CSV e o PDF daqui são a entrega final — o que hoje sai
// do gestor-os e vai por e-mail.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatarDocumento } from "@/lib/normalizar";
import { rotuloReferencia, parcelar, dataIso, competencia } from "@/lib/periodos";
import { moeda, type Cobranca } from "@/features/os/cobranca";

export type TipoFechamento = "semanal" | "mensal";

export interface Fechamento {
  id: string;
  tipo: TipoFechamento;
  referencia: string;
  inicio: string;
  fim: string;
  total: number;
  status: "aberto" | "fechado";
  observacoes: string | null;
  fechado_em: string | null;
  created_at: string;
}

const CAMPOS =
  "id, tipo, referencia, inicio, fim, total, status, observacoes, fechado_em, created_at";

export function useFechamentos() {
  return useQuery({
    queryKey: ["fechamentos"],
    queryFn: async (): Promise<Fechamento[]> => {
      const { data, error } = await supabase
        .from("fechamentos" as any)
        .select(CAMPOS)
        .order("inicio", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Fechamento[];
    },
  });
}

export function useFechamento(id: string | undefined) {
  return useQuery({
    queryKey: ["fechamento", id],
    enabled: !!id,
    queryFn: async (): Promise<Fechamento | null> => {
      const { data, error } = await supabase
        .from("fechamentos" as any)
        .select(CAMPOS)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export function useCobrancasDoFechamento(fechamentoId: string | undefined) {
  return useQuery({
    queryKey: ["fechamento-cobrancas", fechamentoId],
    enabled: !!fechamentoId,
    queryFn: async (): Promise<Cobranca[]> => {
      const { data, error } = await supabase
        .from("cobrancas" as any)
        .select(
          "id, cliente_id, os_id, descricao, quantidade, valor_unitario, valor, competencia, " +
            "data_referencia, tipo_servico, status, fechamento_id, created_at, " +
            "cliente:clientes(id, nome, documento)",
        )
        .eq("fechamento_id", fechamentoId as string)
        .order("data_referencia");
      if (error) throw error;
      return ((data as any[]) ?? []) as Cobranca[];
    },
  });
}

// ── Ações (RPC) ─────────────────────────────────────────────────────────────

export async function montarFechamento(
  tipo: TipoFechamento,
  dataBase?: string,
): Promise<{ id: string; referencia: string; itens: number; total: number }> {
  const { data, error } = await supabase.rpc("montar_fechamento" as any, {
    _tipo: tipo,
    _data_base: dataBase ?? null,
  } as any);
  if (error) throw new Error(error.message);
  const l = Array.isArray(data) ? data[0] : data;
  return {
    id: (l as any)?.fechamento_id as string,
    referencia: (l as any)?.referencia as string,
    itens: Number((l as any)?.itens ?? 0),
    total: Number((l as any)?.total ?? 0),
  };
}

export async function fecharPeriodo(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("fechar_periodo" as any, { _fechamento_id: id } as any);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function reabrirPeriodo(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("reabrir_periodo" as any, { _fechamento_id: id } as any);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function excluirFechamento(id: string): Promise<number> {
  const { data, error } = await supabase.rpc("excluir_fechamento" as any, { _fechamento_id: id } as any);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * Lançamento avulso — mensalidade, acerto, parcela de instalação. Parcelado, o
 * valor é dividido em CENTAVOS com o resto na primeira: 3 × 33,33 daria 99,99
 * e o cliente pagaria a menos para sempre.
 */
export async function lancarCobrancaAvulsa(dados: {
  clienteId: string;
  descricao: string;
  valorTotal: number;
  parcelas: number;
  tipoServico: "instalacao" | "manutencao";
  dataBase: Date;
}): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  const valores = parcelar(dados.valorTotal, dados.parcelas);
  const linhas = valores.map((valor, i) => {
    const d = new Date(dados.dataBase);
    d.setMonth(d.getMonth() + i);
    return {
      cliente_id: dados.clienteId,
      descricao:
        dados.parcelas > 1
          ? `${dados.descricao} (${i + 1}/${dados.parcelas})`
          : dados.descricao,
      quantidade: 1,
      valor_unitario: valor,
      valor,
      competencia: competencia(d),
      data_referencia: dataIso(d),
      tipo_servico: dados.tipoServico,
      status: "aberta",
      criada_por: u.user?.id ?? null,
    };
  });
  const { error } = await supabase.from("cobrancas" as any).insert(linhas as any);
  if (error) throw new Error(error.message);
  return linhas.length;
}

// ── Consolidação para relatório ─────────────────────────────────────────────

export interface GrupoCliente {
  clienteId: string;
  nome: string;
  documento: string | null;
  itens: Cobranca[];
  subtotal: number;
}

export interface SecaoFechamento {
  titulo: string;
  grupos: GrupoCliente[];
  total: number;
}

/**
 * Instalações separadas de manutenções, agrupadas por cliente com subtotal —
 * o layout do PDF do gestor-os, preservado porque é o que o financeiro já
 * sabe ler.
 */
export function consolidar(cobrancas: Cobranca[]): { secoes: SecaoFechamento[]; total: number } {
  const monta = (titulo: string, tipo: "instalacao" | "manutencao"): SecaoFechamento => {
    const doTipo = cobrancas.filter((c) => c.tipo_servico === tipo && c.status !== "cancelada");
    const porCliente = new Map<string, GrupoCliente>();
    for (const c of doTipo) {
      let g = porCliente.get(c.cliente_id);
      if (!g) {
        g = {
          clienteId: c.cliente_id,
          nome: c.cliente?.nome ?? "Cliente",
          documento: c.cliente?.documento ?? null,
          itens: [],
          subtotal: 0,
        };
        porCliente.set(c.cliente_id, g);
      }
      g.itens.push(c);
      g.subtotal += Number(c.valor);
    }
    const grupos = Array.from(porCliente.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    return { titulo, grupos, total: grupos.reduce((s, g) => s + g.subtotal, 0) };
  };

  const secoes = [
    monta("Instalações (contratos)", "instalacao"),
    monta("Manutenções e chamados", "manutencao"),
  ].filter((s) => s.grupos.length > 0);
  return { secoes, total: secoes.reduce((s, x) => s + x.total, 0) };
}

// ── CSV ─────────────────────────────────────────────────────────────────────

/** `;` e BOM: é o que o Excel em português abre sem pedir importação. */
export function csvFechamento(f: Fechamento, cobrancas: Cobranca[]): string {
  const cab = ["Data", "Cliente", "CNPJ/CPF", "Tipo", "Descrição", "Qtd", "Valor unit.", "Valor", "Competência"];
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (v: number) => String(Number(v).toFixed(2)).replace(".", ",");
  const linhas = cobrancas
    .filter((c) => c.status !== "cancelada")
    .map((c) =>
      [
        c.data_referencia.split("-").reverse().join("/"),
        c.cliente?.nome ?? "",
        formatarDocumento(c.cliente?.documento),
        c.tipo_servico === "instalacao" ? "Instalação" : "Manutenção",
        c.descricao,
        String(c.quantidade),
        num(c.valor_unitario),
        num(c.valor),
        c.competencia,
      ].map(esc).join(";"),
    );
  const total = cobrancas
    .filter((c) => c.status !== "cancelada")
    .reduce((s, c) => s + Number(c.valor), 0);
  return (
    "\uFEFF" +
    [
      `Fechamento ${f.tipo} ${rotuloReferencia(f.referencia)};;;;;;;;`,
      cab.join(";"),
      ...linhas,
      `;;;;;;TOTAL;${num(total)};`,
    ].join("\r\n")
  );
}

export function baixarArquivo(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

/**
 * Relatório do período. Mantém o layout que o financeiro já conhece:
 * instalações e manutenções em seções separadas, clientes com CNPJ e subtotal,
 * total geral no fim.
 */
export async function gerarPdfFechamento(f: Fechamento, cobrancas: Cobranca[]): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 15;
  const DIR = 195;
  let y = 0;

  const quebra = (altura = 8) => {
    if (y + altura > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // faixa escura com dourado, no padrão do relatório de atendimento
  doc.setFillColor(10, 11, 14);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 192, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("GRUPO PREVER", L, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Fechamento ${f.tipo} · ${rotuloReferencia(f.referencia)}` +
      ` · ${f.inicio.split("-").reverse().join("/")} a ${f.fim.split("-").reverse().join("/")}`,
    L,
    19,
  );
  y = 36;

  const { secoes, total } = consolidar(cobrancas);

  if (secoes.length === 0) {
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.text("Nenhuma cobrança neste período.", L, y);
  }

  for (const secao of secoes) {
    quebra(16);
    doc.setFillColor(245, 246, 248);
    doc.rect(L - 3, y - 5, DIR - L + 6, 8, "F");
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(secao.titulo.toUpperCase(), L, y);
    doc.text(moeda(secao.total), DIR, y, { align: "right" });
    y += 11;

    for (const g of secao.grupos) {
      quebra(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      doc.text(g.nome, L, y);
      if (g.documento) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(formatarDocumento(g.documento), L + 90, y);
      }
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      for (const it of g.itens) {
        quebra(6);
        const data = it.data_referencia.split("-").reverse().join("/");
        const desc = doc.splitTextToSize(`${data}  ${it.descricao}`, 130)[0];
        doc.text(desc, L + 3, y);
        doc.text(moeda(Number(it.valor)), DIR, y, { align: "right" });
        y += 4.6;
      }

      quebra(8);
      doc.setDrawColor(220, 220, 220);
      doc.line(L + 3, y, DIR, y);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 20);
      doc.text("Subtotal", L + 3, y);
      doc.text(moeda(g.subtotal), DIR, y, { align: "right" });
      y += 9;
    }
  }

  quebra(16);
  doc.setFillColor(10, 11, 14);
  doc.rect(L - 3, y - 5, DIR - L + 6, 10, "F");
  doc.setTextColor(255, 192, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL DO PERÍODO", L, y + 1);
  doc.text(moeda(total), DIR, y + 1, { align: "right" });

  doc.save(`fechamento-${f.tipo}-${f.referencia}.pdf`);
}
