import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Bloco = {
  id: string;
  code: string;
  name: string;
  layer: number;
  hh: number;
  descricao: string | null;
  obs: string | null;
};

export type BlocoItem = {
  id: string;
  bloco_id: string;
  seq: number;
  nome: string;
  marca: string | null;
  modelo: string;
  qty: number;
  variavel: boolean;
};

export type Equipamento = {
  id: string;
  code: string | null;
  nome: string;
  modelo: string;
  un: string;
  custo: number;
  markup: number;
  marca: string | null;
  cat: string | null;
};

export type Servico = {
  id: string;
  code: string;
  nome: string;
  cat: string | null;
  preco_unitario_mensal: number;
  ativo_padrao: boolean;
  ordem: number;
};

export type ProjetoBloco = {
  id: string;
  projeto_id: string;
  bloco_id: string;
  ativo: boolean;
  quantidade: number;
};

export type ProjetoItemVar = {
  id: string;
  projeto_id: string;
  bloco_item_id: string;
  quantidade: number;
};

export type ProjetoServico = {
  id: string;
  projeto_id: string;
  servico_id: string;
  ativo: boolean;
  quantidade: number;
};

export function useCatalogos() {
  return useQuery({
    queryKey: ["catalogos"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [b, bi, eq, sv] = await Promise.all([
        supabase.from("blocos").select("*").order("layer").order("code"),
        supabase.from("blocos_itens").select("*").order("seq"),
        supabase.from("equipamentos").select("*"),
        supabase.from("servicos").select("*").order("ordem"),
      ]);
      if (b.error) throw b.error;
      if (bi.error) throw bi.error;
      if (eq.error) throw eq.error;
      if (sv.error) throw sv.error;
      return {
        blocos: b.data as Bloco[],
        blocos_itens: bi.data as BlocoItem[],
        equipamentos: eq.data as Equipamento[],
        servicos: sv.data as Servico[],
      };
    },
  });
}

export function useProjetoBlocos(projetoId: string) {
  return useQuery({
    queryKey: ["projeto_blocos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_blocos")
        .select("*")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data as ProjetoBloco[];
    },
  });
}

export function useProjetoItensVar(projetoId: string) {
  return useQuery({
    queryKey: ["projeto_itens_var", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_itens_variaveis")
        .select("*")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data as ProjetoItemVar[];
    },
  });
}

export function useProjetoServicos(projetoId: string) {
  return useQuery({
    queryKey: ["projeto_servicos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_servicos")
        .select("*")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data as ProjetoServico[];
    },
  });
}
