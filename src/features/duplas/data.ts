// Equipes de campo (R56/U47, R96–R98/U76–U77) — consultas e gravações.
// A lógica pura (herança da escala, quem é de qual equipe naquela semana,
// série do gráfico) mora em ./modelo.ts.
//
// `as any` nas consultas pela mesma razão do resto do app: o
// src/integrations/supabase/types.ts está desatualizado desde a Etapa 1 (ver
// o cabeçalho de features/chamados/data.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { montarEscala, type Dupla, type Escala, type LinhaDeEscala } from "./modelo";

// membro_a/membro_b saíram na U77. A constante é escrita à mão porque `*`
// traria colunas de auditoria que ninguém usa — e porque nomear as colunas é o
// que faz uma coluna nova só chegar ao cliente quando alguém decide.
const CAMPOS = "id, nome, veiculo, ativa";

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

/**
 * A escala INTEIRA, de uma vez.
 *
 * Parece exagero e não é: é uma linha por pessoa por semana DECIDIDA — com dez
 * técnicos e uma escala lançada por semana, são ~520 linhas por ano. Trazer
 * tudo faz o gráfico das 12 semanas, o filtro da programação e o pop-up de
 * escala saírem de UMA consulta, resolvidos pelas funções puras de modelo.ts;
 * qualquer recorte por semana viraria uma consulta por semana mostrada, que é
 * o N+1 que o painel não pode pagar.
 *
 * As duas tabelas vêm juntas porque a herança precisa das DUAS: as linhas
 * dizem quem estava em quê, e `duplas_escala_semanas` diz quais semanas foram
 * decididas — sem ela não dá para distinguir "ainda não decidimos" (herda) de
 * "esta equipe não sai nesta semana" (vazia de propósito).
 */
export function useEscala() {
  return useQuery({
    queryKey: ["duplas-escala"],
    queryFn: async (): Promise<Escala> => {
      const [semanas, linhas] = await Promise.all([
        supabase.from("duplas_escala_semanas" as any).select("semana"),
        supabase.from("duplas_escala" as any).select("semana, dupla_id, pessoa_id, ordem"),
      ]);
      if (semanas.error) throw semanas.error;
      if (linhas.error) throw linhas.error;
      return montarEscala(
        ((semanas.data as any[]) ?? []).map((s) => s.semana as string),
        (linhas.data as any[] as LinhaDeEscala[]) ?? [],
      );
    },
    staleTime: 60_000,
  });
}

export interface EntradaDupla {
  nome: string;
  veiculo: string | null;
}

/**
 * Cria, edita e desativa — uma mutação só, porque as três invalidam
 * exatamente as mesmas consultas e são acionadas do mesmo pop-up.
 *
 * DESATIVAR, NÃO APAGAR. Desde a U76 a justificativa finalmente é verdadeira:
 * a escala guarda quem saiu com quem em cada semana, então a equipe desfeita
 * continua explicando o gráfico do passado. Desativar tira do FUTURO — o
 * gatilho `trg_duplas_ao_desativar` solta as pessoas das semanas seguintes,
 * e a semana em curso fica, porque já tem dias vividos.
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
      // desativar apaga a escala das semanas futuras (gatilho no banco), então
      // a escala em memória fica velha junto com a lista
      qc.invalidateQueries({ queryKey: ["duplas-escala"] });
      // a programação filtra por equipe e o painel desenha o gráfico por
      // equipe: as duas precisam repintar quando a composição muda
      qc.invalidateQueries({ queryKey: ["chamados"] });
    },
  });
}

/**
 * Lança a escala de UMA equipe numa semana.
 *
 * Vai pela RPC `escala_definir` e não por INSERT/DELETE daqui, e isso não é
 * preferência: a ordem das três operações é que faz a coisa funcionar. Abrir a
 * semana DEPOIS do delete não apaga nada, e inserir ANTES de abrir faz a
 * herança trazer de volta quem acabou de sair. A função no banco resolve as
 * três numa transação — e é a mesma porta para qualquer caminho de escrita.
 *
 * `mover` chega como false na primeira tentativa: o banco recusa roubar quem
 * já está em outra equipe naquela semana e devolve o nome dela, a tela
 * pergunta, e só então repete com true. Mover em silêncio seria pior que
 * atritar.
 */
export function useSalvarEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      duplaId: string;
      semana: string;
      membros: string[];
      mover?: boolean;
    }) => {
      const { error } = await supabase.rpc("escala_definir" as any, {
        _dupla: v.duplaId,
        _semana: v.semana,
        _membros: v.membros,
        _mover: v.mover ?? false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duplas-escala"] });
      // o apoio automático é recalculado por gatilho quando o chamado muda de
      // responsável ou de semana — lançar escala NÃO reescreve chamado (é
      // deliberado, ver reconciliar_apoios_abertos). Mesmo assim o gráfico e a
      // programação leem a escala, e precisam repintar.
      qc.invalidateQueries({ queryKey: ["chamados"] });
    },
  });
}
