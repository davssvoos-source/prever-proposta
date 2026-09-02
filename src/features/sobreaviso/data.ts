// Sobreaviso — a camada de dados (R116, U86).
//
// A LÓGICA PURA MORA EM ./modelo.ts E NÃO SE REPETE AQUI. Este arquivo não
// calcula cobertura, não decide o que fazer com célula preenchida e não sabe o
// que é feriado: ele busca linhas, monta o corpo das RPCs e invalida cache.
//
// ── DUAS PORTAS DE ESCRITA, E ELAS NÃO SE MISTURAM ─────────────────────────
//  1. A CÉLULA SOLTA — `upsert` / `delete` direto na tabela, guardada pela
//     policy `sobreaviso_write`. É o caminho da R90 ("tudo salva sozinho"),
//     acionado a cada digitação. Ele NÃO passa por RPC de propósito: 186
//     auto-saves não têm atomicidade que valha a pena, não têm recusa para
//     mostrar e não têm contagem para exibir — só têm latência.
//  2. O GESTO EM MASSA — `sobreaviso_aplicar_padrao` e `sobreaviso_limpar`,
//     em DUAS FASES. Esses têm tudo o que a célula solta não tem.
// Misturar as duas faria a tela ter de decidir, a cada tecla, se aquilo era
// uma decisão ou um rascunho.
//
// ── A JANELA É DE TRÊS MESES, E O NÚMERO É MEDIDO ──────────────────────────
// A semana padrão tem OITO dias de calendário, e 12 das 52 segundas de um ano
// têm o oitavo dia no mês seguinte — todo mês contém exatamente uma segunda
// nos seus últimos sete dias, então são 12 por ano, para sempre. Ler só o mês
// aberto faria a PRÉVIA do gesto destrutivo dizer "inserir" numa célula que já
// existe do outro lado da fronteira, em 23% das aplicações. O recorte é
// `janelaDaCompetencia()`, no modelo puro, onde ele pode ser exercitado.
//
// `as any` nas consultas pela mesma razão do resto do app: o
// src/integrations/supabase/types.ts está desatualizado (baseline do tsc) e
// não conhece `public.sobreaviso`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  janelaDaCompetencia,
  type CelulaDoPadrao,
  type LinhaSobreaviso,
  type PessoaCandidata,
} from "./modelo";

/**
 * As colunas, escritas à mão e não `*`, pelo mesmo motivo de
 * `programacao/data.ts`: nomear é o que faz uma coluna nova só chegar ao
 * cliente quando alguém decide.
 */
const CAMPOS = "dia, pessoa_id, horas, origem";

/**
 * TODO PROFILE, sem filtro de cargo.
 *
 * Quem decide o recorte é `pessoasDaGrade()`, no modelo puro, onde ele é
 * exercitado por asserção. Filtrar aqui por `cargo = 'tecnico'` (como faz
 * `fetchTecnicos`) tiraria da escala o coordenador que atende às 2h da manhã, e
 * o filtro ficaria escondido numa camada que ninguém testa.
 */
export async function fetchPessoasDoSobreaviso(): Promise<PessoaCandidata[]> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, nome, ativo, status, cargo")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as PessoaCandidata[];
}

export function usePessoasDoSobreaviso() {
  return useQuery({
    queryKey: ["sobreaviso", "pessoas"],
    queryFn: fetchPessoasDoSobreaviso,
    staleTime: 5 * 60_000,
  });
}

export async function fetchSobreaviso(competencia: string): Promise<LinhaSobreaviso[]> {
  const { de, ate } = janelaDaCompetencia(competencia);
  const { data, error } = await (supabase as any)
    .from("sobreaviso")
    .select(CAMPOS)
    .gte("dia", de)
    .lte("dia", ate)
    .order("dia");
  if (error) throw error;
  return (data ?? []) as LinhaSobreaviso[];
}

/**
 * A escala da competência mais um mês de cada lado.
 *
 * `staleTime` de 30s, como a grade da programação: é um quadro COMPARTILHADO
 * sem canal de realtime, e o foco de janela só ajuda se o dado envelhecer
 * rápido o bastante para o refetch acontecer.
 */
export function useSobreaviso(competencia: string) {
  return useQuery({
    queryKey: ["sobreaviso", "janela", competencia],
    queryFn: () => fetchSobreaviso(competencia),
    staleTime: 30_000,
  });
}

/** Toda escrita invalida a janela inteira — a semana atravessa o mês. */
function invalidarTudo(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ["sobreaviso"] });
}

// ── PORTA 1: A CÉLULA SOLTA (R90) ───────────────────────────────────────────

/**
 * Grava (ou apaga) UMA célula.
 *
 * `horas === null` ou `0` é DELETE, e não `UPDATE ... SET horas = 0`: célula
 * vazia é AUSÊNCIA de linha. O CHECK do banco recusaria o 0 de qualquer jeito
 * — esta camada não repete a regra, ela usa o gesto que o desenho já escolheu.
 */
export function useDefinirCelula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { dia: string; pessoa_id: string; horas: number | null }) => {
      if (v.horas === null || v.horas <= 0) {
        const { error } = await (supabase as any)
          .from("sobreaviso")
          .delete()
          .eq("dia", v.dia)
          .eq("pessoa_id", v.pessoa_id);
        if (error) throw error;
        return { apagou: true as const };
      }
      const { error } = await (supabase as any)
        .from("sobreaviso")
        .upsert(
          { dia: v.dia, pessoa_id: v.pessoa_id, horas: v.horas, origem: "manual" },
          { onConflict: "dia,pessoa_id" },
        );
      if (error) throw error;
      return { apagou: false as const };
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

// ── PORTA 2: O GESTO EM MASSA, EM DUAS FASES ────────────────────────────────

export interface LinhaDaPrevia {
  dia: string;
  antes: number | null;
  depois: number;
  acao: "inserir" | "igual" | "somar" | "trocar";
  aplicado: boolean;
}

/**
 * Chama a RPC. Com `confirmar = false` e qualquer célula em `trocar`, o banco
 * NÃO escreve e devolve as oito linhas para a tela mostrar. A prévia e a
 * escrita saem da MESMA função e do MESMO snapshot — é por isso que elas não
 * podem discordar, e é por isso que a confirmação não é uma promessa do app.
 */
export async function aplicarPadrao(
  pessoa_id: string,
  segunda: string,
  celulas: CelulaDoPadrao[],
  confirmar: boolean,
): Promise<LinhaDaPrevia[]> {
  const { data, error } = await (supabase as any).rpc("sobreaviso_aplicar_padrao", {
    _pessoa: pessoa_id,
    _segunda: segunda,
    _horas: celulas.map((c) => c.horas),
    _absorve: celulas.map((c) => c.absorve),
    _confirmar: confirmar,
  });
  if (error) throw error;
  return (data ?? []) as LinhaDaPrevia[];
}

export function useAplicarPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      pessoa_id: string; segunda: string; celulas: CelulaDoPadrao[]; confirmar: boolean;
    }) => aplicarPadrao(v.pessoa_id, v.segunda, v.celulas, v.confirmar),
    // Invalida SEMPRE, inclusive na fase 1: quando nada colide, a fase 1 já
    // escreve (não há o que perder), e um cache não invalidado deixaria a grade
    // mostrando o estado anterior com a mutação já gravada.
    onSuccess: () => invalidarTudo(qc),
  });
}

export interface LinhaDaLimpeza {
  dia: string;
  horas: number;
  origem: string;
  apagado: boolean;
}

/**
 * Limpar é ASSIMÉTRICO em relação a aplicar, e é decisão: aqui `confirmar` não
 * tem caminho livre, porque limpar sempre perde. A primeira chamada devolve o
 * que morreria e não apaga nada.
 *
 * `_so_padrao` NÃO É PASSADO, e a omissão é o conserto: a RPC o declara com
 * `DEFAULT true` e a tela só tinha um caminho, o `true`. O ramo `false` — que
 * apaga também o digitado à mão — existia no cliente e no texto do modal sem
 * nenhum botão que o alcançasse: código morto documentando um botão que não
 * existe, e a frase mais assustadora da tela sendo escrita para ninguém ler.
 * Regra 8: o ramo saiu daqui. O parâmetro continua na RPC (o PORTÃO da
 * migration o exercita) para o dia em que o botão nascer.
 */
export async function limparSobreaviso(
  pessoa_id: string,
  de: string,
  ate: string,
  confirmar: boolean,
): Promise<LinhaDaLimpeza[]> {
  const { data, error } = await (supabase as any).rpc("sobreaviso_limpar", {
    _pessoa: pessoa_id,
    _de: de,
    _ate: ate,
    _confirmar: confirmar,
  });
  if (error) throw error;
  return (data ?? []) as LinhaDaLimpeza[];
}

export function useLimpar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      pessoa_id: string; de: string; ate: string; confirmar: boolean;
    }) => limparSobreaviso(v.pessoa_id, v.de, v.ate, v.confirmar),
    onSuccess: () => invalidarTudo(qc),
  });
}

// NÃO existe aqui um `sqlstateDoErro` como o de `programacao/data.ts`: as
// mutações rejeitam com o erro CRU, e a tela mostra `e.message` — que já vem em
// português, palavra por palavra, das duas RPCs. Uma casca que traduzisse o
// SQLSTATE para uma frase genérica apagaria a única coisa que o usuário podia
// usar, e é a mesma razão pela qual a agenda de campo tem a dela.
