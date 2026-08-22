// Duplas de campo (R56/U47) — consultas e gravações.
// A lógica pura (quem é de qual dupla, série do gráfico) mora em ./modelo.ts.
//
// `as any` nas consultas pela mesma razão do resto do app: o
// src/integrations/supabase/types.ts está desatualizado desde a Etapa 1 (ver
// o cabeçalho de features/chamados/data.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Dupla } from "./modelo";

const CAMPOS = "id, nome, membro_a, membro_b, ativa";

export function useDuplas() {
  return useQuery({
    queryKey: ["duplas"],
    queryFn: async (): Promise<Dupla[]> => {
      const { data, error } = await supabase
        .from("duplas" as any)
        .select(CAMPOS)
        .order("nome");
      if (error) throw error;
      return (data as any[] as Dupla[]) ?? [];
    },
    staleTime: 60_000,
  });
}

export interface EntradaDupla {
  nome: string;
  membro_a: string;
  membro_b: string | null;
}

/**
 * Cria, edita e desativa — uma mutação só, porque as três invalidam
 * exatamente as mesmas consultas e são acionadas do mesmo pop-up.
 *
 * DESATIVAR, NÃO APAGAR: a dupla desfeita ainda explica o histórico. Apagar
 * faria o gráfico das semanas passadas perder a linha dela — o trabalho
 * aconteceu, e a série tem que continuar contando.
 */
export function useSalvarDupla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      acao:
        | { tipo: "criar"; dados: EntradaDupla }
        | { tipo: "editar"; id: string; dados: EntradaDupla }
        | { tipo: "desativar"; id: string }
        | { tipo: "reativar"; id: string },
    ) => {
      if (acao.tipo === "criar") {
        const { error } = await supabase.from("duplas" as any).insert(acao.dados as any);
        if (error) throw error;
        return;
      }
      const patch = acao.tipo === "editar"
        ? acao.dados
        : { ativa: acao.tipo === "reativar" };
      const { error } = await supabase
        .from("duplas" as any)
        .update(patch as any)
        .eq("id", acao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duplas"] });
      // a programação filtra por dupla e o painel desenha o gráfico por dupla:
      // as duas precisam repintar quando a composição muda
      qc.invalidateQueries({ queryKey: ["chamados"] });
    },
  });
}
