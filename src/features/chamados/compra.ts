// Pedido de compra — a ficha do chamado tipo `pedido_compra`. Etapa U9.
// Ver docs/PRODUTO.md §8 questão 6 e docs/PLANO_UNIFICACAO.md §12.
//
// O caminho:  solicitado → em cotação → aprovado → comprado → recebido
//                                └── recusado (com motivo)
//
// Cotar, comprar e receber é o dia a dia de quem executa (Patrimônio).
// Aprovar e recusar é ato de quem responde pelo dinheiro — o banco cobra isso
// na RPC, aqui a tela só esconde os botões de quem não pode.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SituacaoCompra =
  | "solicitado" | "em_cotacao" | "aprovado" | "comprado" | "recebido" | "recusado";

export interface ChamadoCompra {
  chamado_id: string;
  quantidade: number;
  unidade: string;
  fornecedor_sugerido: string | null;
  link_produto: string | null;
  valor_estimado: number | null;
  valor_final: number | null;
  justificativa: string | null;
  situacao: SituacaoCompra;
  decidido_por: string | null;
  decidido_em: string | null;
  motivo_recusa: string | null;
  comprado_em: string | null;
  recebido_em: string | null;
  updated_at: string;
}

export const SITUACAO_ORDEM: SituacaoCompra[] = [
  "solicitado", "em_cotacao", "aprovado", "comprado", "recebido", "recusado",
];

export const SITUACAO_LABEL: Record<SituacaoCompra, string> = {
  solicitado: "Solicitado",
  em_cotacao: "Em cotação",
  aprovado: "Aprovado",
  comprado: "Comprado",
  recebido: "Recebido",
  recusado: "Recusado",
};

export const SITUACAO_CORES: Record<SituacaoCompra, { dark: string; light: string; bg: string; border: string }> = {
  solicitado: { dark: "#FFC000", light: "#b87800", bg: "rgba(255,192,0,0.12)",   border: "rgba(255,192,0,0.30)" },
  em_cotacao: { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.30)" },
  aprovado:   { dark: "#2DD4BF", light: "#0f766e", bg: "rgba(45,212,191,0.12)",  border: "rgba(45,212,191,0.30)" },
  comprado:   { dark: "#A78BFA", light: "#6d28d9", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
  recebido:   { dark: "#34D399", light: "#047857", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.30)" },
  recusado:   { dark: "#F87171", light: "#b91c1c", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
};

/** Só admin e comercial liberam gasto — o resto do fluxo é de quem executa. */
export const SITUACOES_DE_DECISAO: SituacaoCompra[] = ["aprovado", "recusado"];

/**
 * Próximos passos possíveis a partir de onde o pedido está. Fora daqui a RPC
 * recusa — a tela só evita oferecer o que o banco vai negar.
 */
export function proximasSituacoes(atual: SituacaoCompra): SituacaoCompra[] {
  switch (atual) {
    case "solicitado": return ["em_cotacao", "aprovado", "recusado"];
    case "em_cotacao": return ["aprovado", "recusado"];
    case "aprovado":   return ["comprado", "recusado"];
    case "comprado":   return ["recebido"];
    case "recebido":   return [];
    case "recusado":   return ["solicitado"];
    default:           return [];
  }
}

const CAMPOS =
  "chamado_id, quantidade, unidade, fornecedor_sugerido, link_produto, valor_estimado, " +
  "valor_final, justificativa, situacao, decidido_por, decidido_em, motivo_recusa, " +
  "comprado_em, recebido_em, updated_at";

export function useCompra(chamadoId: string | undefined, ativo = true) {
  return useQuery({
    queryKey: ["chamado-compra", chamadoId],
    enabled: !!chamadoId && ativo,
    queryFn: async (): Promise<ChamadoCompra | null> => {
      const { data, error } = await supabase
        .from("chamado_compra" as any)
        .select(CAMPOS)
        .eq("chamado_id", chamadoId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export type CompraPatch = Partial<
  Pick<
    ChamadoCompra,
    "quantidade" | "unidade" | "fornecedor_sugerido" | "link_produto"
    | "valor_estimado" | "justificativa"
  >
>;

/**
 * A ficha nasce junto com o chamado (trigger chamado_criar_ficha_compra), mas
 * o upsert protege o caso de um pedido antigo que nunca a recebeu.
 */
export async function salvarCompra(chamadoId: string, patch: CompraPatch): Promise<void> {
  const { error } = await supabase
    .from("chamado_compra" as any)
    .upsert({ chamado_id: chamadoId, ...patch, updated_at: new Date().toISOString() } as any,
            { onConflict: "chamado_id" });
  if (error) throw error;
}

export async function decidirCompra(
  chamadoId: string,
  situacao: SituacaoCompra,
  motivo?: string | null,
  valor?: number | null,
): Promise<void> {
  const { error } = await supabase.rpc("decidir_pedido_compra" as any, {
    _chamado_id: chamadoId,
    _situacao: situacao,
    _motivo: motivo ?? null,
    _valor: valor ?? null,
  } as any);
  if (error) throw new Error(error.message);
}

export const moedaBR = (v: number | null | undefined): string =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
