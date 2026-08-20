// Conferência e cobrança do atendimento — Etapa U4 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §3.2 e §5.2.
//
// Tudo que cria ou muda dinheiro passa por RPC: aprovar, faturar e ajustar são
// transações do banco, não sequências de chamadas do navegador. Duas
// aprovações simultâneas cobrariam duas vezes se isso fosse feito aqui.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ResultadoItem = "coberto" | "faturavel" | "nao_identificado" | "revisar";

export const RESULTADO_LABEL: Record<ResultadoItem, string> = {
  coberto: "Coberto",
  faturavel: "Faturável",
  nao_identificado: "Não identificado",
  revisar: "Revisar",
};

export const RESULTADO_CORES: Record<ResultadoItem, { dark: string; light: string; bg: string; border: string }> = {
  coberto:          { dark: "#2DD2A5", light: "#047862", bg: "rgba(45,210,165,0.12)",  border: "rgba(45,210,165,0.30)" },
  faturavel:        { dark: "#F8C811", light: "#A06108", bg: "rgba(248,200,17,0.12)",   border: "rgba(248,200,17,0.30)" },
  nao_identificado: { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
  revisar:          { dark: "#F17881", light: "#B1242E", bg: "rgba(241,120,129,0.12)", border: "rgba(241,120,129,0.30)" },
};

export type FaturamentoStatus =
  | "a_analisar" | "em_conferencia" | "aprovada" | "faturada" | "sem_cobranca";

export const FATURAMENTO_LABEL: Record<FaturamentoStatus, string> = {
  a_analisar: "A analisar",
  em_conferencia: "Em conferência",
  aprovada: "Cobrança aprovada",
  faturada: "Faturada",
  sem_cobranca: "Sem cobrança",
};

export interface AnaliseItem {
  peca_id: string;
  chamado_id: string;
  resultado: ResultadoItem;
  cobertura_item_id: string | null;
  valor_calculado: number | null;
  confianca: number | null;
  justificativa: string | null;
  ajustado_manualmente: boolean;
  analisado_em: string;
}

export function useAnaliseChamado(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-analise", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<AnaliseItem[]> => {
      const { data, error } = await supabase
        .from("chamado_pecas_analise" as any)
        .select(
          "peca_id, chamado_id, resultado, cobertura_item_id, valor_calculado, confianca, " +
            "justificativa, ajustado_manualmente, analisado_em",
        )
        .eq("chamado_id", chamadoId as string);
      // técnico não enxerga análise: lista vazia é resposta válida, não erro
      if (error) return [];
      return ((data as any[]) ?? []) as AnaliseItem[];
    },
  });
}

export interface Cobranca {
  id: string;
  cliente_id: string;
  chamado_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor: number;
  competencia: string;
  data_referencia: string;
  tipo_servico: "instalacao" | "manutencao";
  status: "aberta" | "fechada" | "faturada" | "cancelada";
  fechamento_id: string | null;
  created_at: string;
  cliente?: { id: string; nome: string; documento: string | null } | null;
}

const CAMPOS_COBRANCA =
  "id, cliente_id, chamado_id, descricao, quantidade, valor_unitario, valor, competencia, " +
  "data_referencia, tipo_servico, status, fechamento_id, created_at, " +
  "cliente:clientes(id, nome, documento)";

export function useCobrancasDoChamado(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["cobrancas-chamado", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<Cobranca[]> => {
      const { data, error } = await supabase
        .from("cobrancas" as any)
        .select(CAMPOS_COBRANCA)
        .eq("chamado_id", chamadoId as string)
        .order("created_at");
      if (error) return [];
      return ((data as any[]) ?? []) as Cobranca[];
    },
  });
}

/** Cobranças ainda em aberto — a base do fechamento da U5. */
export function useCobrancasAbertas() {
  return useQuery({
    queryKey: ["cobrancas-abertas"],
    queryFn: async (): Promise<Cobranca[]> => {
      const { data, error } = await supabase
        .from("cobrancas" as any)
        .select(CAMPOS_COBRANCA)
        .eq("status", "aberta")
        .order("data_referencia");
      if (error) throw error;
      return ((data as any[]) ?? []) as Cobranca[];
    },
  });
}

// ── Ações (todas por RPC) ───────────────────────────────────────────────────

export async function aprovarCobranca(chamadoId: string): Promise<{ itens: number; total: number }> {
  const { data, error } = await supabase.rpc("aprovar_chamado_financeiro" as any, { _chamado_id: chamadoId } as any);
  if (error) throw new Error(error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  return { itens: Number((linha as any)?.itens ?? 0), total: Number((linha as any)?.total ?? 0) };
}

export async function marcarFaturada(chamadoId: string): Promise<number> {
  const { data, error } = await supabase.rpc("marcar_chamado_faturado" as any, { _chamado_id: chamadoId } as any);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function ajustarItem(
  pecaId: string,
  resultado: ResultadoItem,
  valor: number | null,
): Promise<void> {
  const { error } = await supabase.rpc("ajustar_item_cobranca" as any, {
    _peca_id: pecaId,
    _resultado: resultado,
    _valor: valor,
  } as any);
  if (error) throw new Error(error.message);
}

/** Soma faturável de uma análise, respeitando a quantidade de cada item. */
export function totalFaturavel(
  analise: AnaliseItem[],
  quantidades: Record<string, number>,
): number {
  const soma = analise
    .filter((a) => a.resultado === "faturavel")
    .reduce((s, a) => s + Number(a.valor_calculado ?? 0) * (quantidades[a.peca_id] ?? 1), 0);
  return Math.round((soma + Number.EPSILON) * 100) / 100;
}

export const moeda = (v: number | null | undefined): string =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
