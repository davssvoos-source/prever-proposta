// Contratos do cliente — dados e mutações. Etapa U2 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §4.1.
//
// É a peça que decide, mais tarde (U4), se o que foi feito na OS é coberto ou
// faturável. A RLS destas tabelas passa por pode_ver_financeiro(): técnico que
// acessa a OS NÃO enxerga valor nem vigência.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ModalidadeContrato = "locacao" | "manutencao" | "comodato" | "venda";
export type TipoCobranca = "mensal_fixo" | "por_chamado" | "misto";
export type StatusContrato = "rascunho" | "ativo" | "encerrado";
export type Cobertura = "integral" | "parcial" | "nao_coberto";

export const MODALIDADE_LABEL: Record<ModalidadeContrato, string> = {
  locacao: "Locação",
  manutencao: "Manutenção",
  comodato: "Comodato",
  venda: "Venda",
};

/** O que cada modalidade significa na hora de cobrar — a regra do Vinicius. */
export const MODALIDADE_REGRA: Record<ModalidadeContrato, string> = {
  locacao: "Equipamento é da Prever: troca e manutenção não são cobradas.",
  manutencao: "Mão de obra coberta; equipamento entra no boleto do mês.",
  comodato: "Equipamento cedido: confira o contrato antes de cobrar peça.",
  venda: "Equipamento é do cliente: peça e mão de obra seguem a regra do contrato.",
};

export const TIPO_COBRANCA_LABEL: Record<TipoCobranca, string> = {
  mensal_fixo: "Mensalidade fixa",
  por_chamado: "Por chamado",
  misto: "Misto",
};

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

export const STATUS_CONTRATO_CORES: Record<StatusContrato, { dark: string; light: string; bg: string; border: string }> = {
  rascunho:  { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
  ativo:     { dark: "#34D399", light: "#047857", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.30)" },
  encerrado: { dark: "#F87171", light: "#b91c1c", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
};

export const COBERTURA_LABEL: Record<Cobertura, string> = {
  integral: "Integral",
  parcial: "Parcial",
  nao_coberto: "Não coberto",
};

export interface Contrato {
  id: string;
  cliente_id: string;
  numero: string | null;
  titulo: string | null;
  modalidade: ModalidadeContrato;
  tipo_cobranca: TipoCobranca;
  status: StatusContrato;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  valor_mensal: number | null;
  dia_vencimento: number | null;
  franquia_visitas_mes: number | null;
  inclui_pecas: boolean;
  inclui_mao_de_obra: boolean;
  inclui_deslocamento: boolean;
  origem_proposta_id: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
  confianca_extracao: number | null;
  extraido_em: string | null;
  observacoes: string | null;
  created_at: string;
  cliente?: { id: string; nome: string; documento: string | null } | null;
}

const CAMPOS =
  "id, cliente_id, numero, titulo, modalidade, tipo_cobranca, status, vigencia_inicio, " +
  "vigencia_fim, valor_mensal, dia_vencimento, franquia_visitas_mes, inclui_pecas, " +
  "inclui_mao_de_obra, inclui_deslocamento, origem_proposta_id, arquivo_url, arquivo_path, " +
  "confianca_extracao, extraido_em, observacoes, created_at, " +
  "cliente:clientes(id, nome, documento)";

export function useContratos() {
  return useQuery({
    queryKey: ["contratos"],
    queryFn: async (): Promise<Contrato[]> => {
      const { data, error } = await supabase
        .from("cliente_contratos" as any)
        .select(CAMPOS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Contrato[];
    },
  });
}

export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: ["contrato", id],
    enabled: !!id,
    queryFn: async (): Promise<Contrato | null> => {
      const { data, error } = await supabase
        .from("cliente_contratos" as any)
        .select(CAMPOS)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export function useContratosDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["contratos-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<Contrato[]> => {
      const { data, error } = await supabase
        .from("cliente_contratos" as any)
        .select(CAMPOS)
        .eq("cliente_id", clienteId as string)
        .order("vigencia_inicio", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Contrato[];
    },
  });
}

export type ContratoPatch = Partial<Omit<Contrato, "id" | "created_at" | "cliente">>;

export async function criarContrato(patch: ContratoPatch): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("cliente_contratos" as any)
    .insert({ ...patch, created_by: u.user?.id ?? null } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export async function atualizarContrato(id: string, patch: ContratoPatch): Promise<void> {
  const { error } = await supabase
    .from("cliente_contratos" as any)
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
}

export async function excluirContrato(id: string): Promise<void> {
  const { error } = await supabase.from("cliente_contratos" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Cobertura por equipamento ───────────────────────────────────────────────

export interface CoberturaItem {
  id: string;
  contrato_id: string;
  cliente_equipamento_id: string | null;
  descricao: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  tag_patrimonio: string | null;
  local: string | null;
  quantidade: number;
  cobertura: Cobertura;
  inclui_pecas: boolean | null;
  inclui_mao_de_obra: boolean | null;
}

const CAMPOS_COBERTURA =
  "id, contrato_id, cliente_equipamento_id, descricao, marca, modelo, numero_serie, " +
  "tag_patrimonio, local, quantidade, cobertura, inclui_pecas, inclui_mao_de_obra";

export function useCoberturaContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["contrato-cobertura", contratoId],
    enabled: !!contratoId,
    queryFn: async (): Promise<CoberturaItem[]> => {
      const { data, error } = await supabase
        .from("contrato_cobertura_itens" as any)
        .select(CAMPOS_COBERTURA)
        .eq("contrato_id", contratoId as string)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) ?? []) as CoberturaItem[];
    },
  });
}

export async function adicionarCobertura(
  contratoId: string,
  itens: Array<Partial<Omit<CoberturaItem, "id" | "contrato_id">>>,
): Promise<void> {
  if (itens.length === 0) return;
  const { error } = await supabase
    .from("contrato_cobertura_itens" as any)
    .insert(itens.map((i) => ({ ...i, contrato_id: contratoId })) as any);
  if (error) throw error;
}

export async function atualizarCobertura(
  id: string,
  patch: Partial<Omit<CoberturaItem, "id" | "contrato_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("contrato_cobertura_itens" as any)
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
}

export async function removerCobertura(id: string): Promise<void> {
  const { error } = await supabase.from("contrato_cobertura_itens" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Preços do contrato ──────────────────────────────────────────────────────

export interface PrecoContrato {
  id: string;
  contrato_id: string;
  descricao: string;
  unidade: string | null;
  valor_unitario: number;
}

export function usePrecosContrato(contratoId: string | undefined) {
  return useQuery({
    queryKey: ["contrato-precos", contratoId],
    enabled: !!contratoId,
    queryFn: async (): Promise<PrecoContrato[]> => {
      const { data, error } = await supabase
        .from("contrato_precos" as any)
        .select("id, contrato_id, descricao, unidade, valor_unitario")
        .eq("contrato_id", contratoId as string)
        .order("descricao");
      if (error) throw error;
      return ((data as any[]) ?? []) as PrecoContrato[];
    },
  });
}

export async function adicionarPrecos(
  contratoId: string,
  precos: Array<{ descricao: string; unidade?: string | null; valor_unitario: number }>,
): Promise<void> {
  if (precos.length === 0) return;
  // chave_busca é coluna gerada: descrições equivalentes colidem de propósito
  const { error } = await supabase
    .from("contrato_precos" as any)
    .upsert(
      precos.map((p) => ({ ...p, contrato_id: contratoId })) as any,
      { onConflict: "contrato_id,chave_busca", ignoreDuplicates: false },
    );
  if (error) throw error;
}

export async function removerPreco(id: string): Promise<void> {
  const { error } = await supabase.from("contrato_precos" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Contrato que vale hoje — mesma regra do contrato_vigente() do banco. */
export function contratoVigente(contratos: Contrato[], data: Date = new Date()): Contrato | null {
  const hoje = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  const validos = contratos.filter(
    (c) =>
      c.status === "ativo" &&
      (!c.vigencia_inicio || c.vigencia_inicio <= hoje) &&
      (!c.vigencia_fim || c.vigencia_fim >= hoje),
  );
  if (validos.length === 0) return null;
  return validos.sort((a, b) => (b.vigencia_inicio ?? "").localeCompare(a.vigencia_inicio ?? ""))[0];
}

/** Dias até o fim da vigência — negativo se já venceu, null se aberta. */
export function diasParaVencer(contrato: Contrato, hoje: Date = new Date()): number | null {
  if (!contrato.vigencia_fim) return null;
  const [a, m, d] = contrato.vigencia_fim.split("-").map(Number);
  const fim = new Date(a, (m ?? 1) - 1, d ?? 1);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((fim.getTime() - base.getTime()) / 86_400_000);
}

/** Envia o PDF ao bucket privado e devolve o caminho para a leitura por I.A. */
export async function subirPdfContrato(arquivo: File, clienteId: string): Promise<string> {
  const nome = arquivo.name.replace(/[^\w.\-]+/g, "_");
  const caminho = `${clienteId}/${Date.now()}-${nome}`;
  const { error } = await supabase.storage.from("contratos").upload(caminho, arquivo, {
    contentType: arquivo.type || "application/pdf",
    upsert: false,
  });
  if (error) throw error;
  return caminho;
}

export async function urlAssinadaContrato(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage.from("contratos").createSignedUrl(caminho, 60 * 60);
  return data?.signedUrl ?? null;
}
