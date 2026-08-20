// Movimentação de equipamento na OS — Etapa U3 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §4.1 e §5.2.
//
// Sucede o campo de texto `pecas_texto`: o que o técnico registra aqui serve a
// DOIS consumidores — a decisão de cobrança (U4) e o relatório de movimentação
// que o Gilleno lança no QAP (U6). Por isso o número de série importa.
//
// O veredito financeiro NÃO vive aqui: mora em chamado_pecas_analise, com RLS
// própria, para o técnico não enxergar o que vai ser cobrado.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DirecaoPeca = "instalado" | "retirado" | "substituido";
export type TipoPeca = "peca" | "mao_de_obra" | "deslocamento" | "servico" | "outro";

export const DIRECAO_LABEL: Record<DirecaoPeca, string> = {
  instalado: "Instalado",
  retirado: "Retirado",
  substituido: "Substituído",
};

export const DIRECAO_CORES: Record<DirecaoPeca, { dark: string; light: string; bg: string; border: string }> = {
  instalado:   { dark: "#2DD2A5", light: "#047862", bg: "rgba(45,210,165,0.12)",  border: "rgba(45,210,165,0.30)" },
  retirado:    { dark: "#F17881", light: "#B1242E", bg: "rgba(241,120,129,0.12)", border: "rgba(241,120,129,0.30)" },
  substituido: { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
};

export const TIPO_PECA_LABEL: Record<TipoPeca, string> = {
  peca: "Peça",
  mao_de_obra: "Mão de obra",
  deslocamento: "Deslocamento",
  servico: "Serviço",
  outro: "Outro",
};

export interface ChamadoPeca {
  id: string;
  chamado_id: string;
  direcao: DirecaoPeca;
  tipo: TipoPeca;
  equipamento_id: string | null;
  cliente_equipamento_id: string | null;
  unidade_id: string | null;
  descricao: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  tag_patrimonio: string | null;
  quantidade: number;
  valor_unitario_informado: number | null;
  observacao: string | null;
  created_at: string;
}

const CAMPOS =
  "id, chamado_id, direcao, tipo, equipamento_id, cliente_equipamento_id, unidade_id, descricao, " +
  "marca, modelo, numero_serie, tag_patrimonio, quantidade, valor_unitario_informado, " +
  "observacao, created_at";

export function usePecas(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-pecas", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<ChamadoPeca[]> => {
      const { data, error } = await supabase
        .from("chamado_pecas" as any)
        .select(CAMPOS)
        .eq("chamado_id", chamadoId as string)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) ?? []) as ChamadoPeca[];
    },
  });
}

export type PecaNova = Partial<Omit<ChamadoPeca, "id" | "chamado_id" | "created_at">> & { descricao: string };

export async function registrarPeca(chamadoId: string, item: PecaNova): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("chamado_pecas" as any)
    .insert({ ...item, chamado_id: chamadoId, created_by: u.user?.id ?? null } as any);
  if (error) throw error;
}

export async function atualizarPeca(id: string, patch: Partial<ChamadoPeca>): Promise<void> {
  const { error } = await supabase.from("chamado_pecas" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function removerPeca(id: string): Promise<void> {
  const { error } = await supabase.from("chamado_pecas" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Unidades físicas do cliente (a Unidade do QAP) ──────────────────────────

export interface Unidade {
  id: string;
  cliente_equipamento_id: string;
  numero_serie: string | null;
  tag_patrimonio: string | null;
  imei: string | null;
  codigo_barras: string | null;
  qap_unidade_id: string | null;
  estado: "instalado" | "retirado" | "em_manutencao";
  instalado_em: string | null;
  retirado_em: string | null;
}

const CAMPOS_UNIDADE =
  "id, cliente_equipamento_id, numero_serie, tag_patrimonio, imei, codigo_barras, " +
  "qap_unidade_id, estado, instalado_em, retirado_em";

/** Unidades serializadas de um cliente — o as-built item a item. */
export function useUnidadesDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["unidades-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<Unidade[]> => {
      // as unidades penduram no equipamento, que pendura no sistema do cliente
      const { data: sistemas, error: erroS } = await supabase
        .from("cliente_sistemas" as any)
        .select("id")
        .eq("cliente_id", clienteId as string);
      if (erroS) throw erroS;
      const sistemaIds = ((sistemas as any[]) ?? []).map((s) => s.id as string);
      if (sistemaIds.length === 0) return [];

      const { data: equipamentos, error: erroE } = await supabase
        .from("cliente_equipamentos" as any)
        .select("id")
        .in("cliente_sistema_id", sistemaIds);
      if (erroE) throw erroE;
      const equipIds = ((equipamentos as any[]) ?? []).map((e) => e.id as string);
      if (equipIds.length === 0) return [];

      const { data, error } = await supabase
        .from("cliente_equipamento_unidades" as any)
        .select(CAMPOS_UNIDADE)
        .in("cliente_equipamento_id", equipIds)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) ?? []) as Unidade[];
    },
  });
}

/**
 * Procura uma unidade pelo número de série ou código de barras.
 * É o lookup do técnico em campo — e, na fase 2 do QAP (§8, item 4), o mesmo
 * papel passa a ser feito pela API do ERP.
 */
export async function acharUnidadePorSerie(termo: string): Promise<Unidade | null> {
  const t = termo.trim();
  if (!t) return null;
  const { data, error } = await supabase
    .from("cliente_equipamento_unidades" as any)
    .select(CAMPOS_UNIDADE)
    .or(`numero_serie.ilike.${t},codigo_barras.ilike.${t},tag_patrimonio.ilike.${t}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

/**
 * Relatório de movimentação para o Gilleno lançar no QAP (fase 1 da §8).
 * CSV com `;` e BOM, como o fechamento do gestor-os — é o que o Excel pt-BR
 * abre sem pedir importação.
 */
export interface LinhaMovimentacao {
  data: string;
  cliente: string;
  os: string;
  direcao: string;
  descricao: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  tag: string;
  quantidade: number;
}

export function csvMovimentacao(linhas: LinhaMovimentacao[]): string {
  const cab = ["Data", "Cliente", "OS", "Movimento", "Equipamento", "Marca", "Modelo", "Nº série", "TAG", "Qtd"];
  const escapar = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = linhas.map((l) =>
    [l.data, l.cliente, l.os, l.direcao, l.descricao, l.marca, l.modelo, l.numero_serie, l.tag, l.quantidade]
      .map(escapar)
      .join(";"),
  );
  return "\uFEFF" + [cab.join(";"), ...corpo].join("\r\n");
}
