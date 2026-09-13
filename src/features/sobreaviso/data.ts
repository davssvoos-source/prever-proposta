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
 * TODO PROFILE, sem filtro NENHUM na consulta.
 *
 * Quem decide o recorte é `pessoasDaGrade()`, no modelo puro, onde ele é
 * exercitado por asserção — inclusive o da R265 (só o CARGO técnico é
 * escalado). Filtrar aqui esconderia a regra numa camada que ninguém testa E
 * apagaria da grade quem tem horas gravadas e hoje está fora do recorte: o
 * histórico tem de continuar aparecendo, esmaecido.
 *
 * `cargo` é o campo que decide quem pode ser escalado (R265). `equipe`
 * continua vindo: a R254 decidiu por ela em 11/09 e o Davi reverteu em 12/09
 * — a coluna fica na consulta para o histórico da grade não perder o nome.
 */
export async function fetchPessoasDoSobreaviso(): Promise<PessoaCandidata[]> {
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, nome, ativo, status, cargo, equipe")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as PessoaCandidata[];
}

/** `enabled` (R263): o Perfil só consulta a escala quando quem abriu é técnico. */
export function usePessoasDoSobreaviso(opcoes: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["sobreaviso", "pessoas"],
    queryFn: fetchPessoasDoSobreaviso,
    staleTime: 5 * 60_000,
    enabled: opcoes.enabled ?? true,
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
export function useSobreaviso(competencia: string, opcoes: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["sobreaviso", "janela", competencia],
    queryFn: () => fetchSobreaviso(competencia),
    staleTime: 30_000,
    enabled: opcoes.enabled ?? true,
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
 * `_so_padrao` VOLTOU (R254), e o motivo é que o botão nasceu: apagar a BARRA
 * de alguém é dizer "esta semana não é mais dele", e deixar para trás o que ele
 * digitou à mão deixaria a barra na tela depois de mandar apagá-la. O comentário
 * que estava aqui — "o ramo saiu, volta quando o botão existir" — descrevia
 * exatamente este dia. Quem chama decide, e a prévia continua mostrando a coluna
 * `origem` de cada linha que morre.
 */
export async function limparSobreaviso(
  pessoa_id: string,
  de: string,
  ate: string,
  confirmar: boolean,
  so_padrao = true,
): Promise<LinhaDaLimpeza[]> {
  const { data, error } = await (supabase as any).rpc("sobreaviso_limpar", {
    _pessoa: pessoa_id,
    _de: de,
    _ate: ate,
    _so_padrao: so_padrao,
    _confirmar: confirmar,
  });
  if (error) throw error;
  return (data ?? []) as LinhaDaLimpeza[];
}

export function useLimpar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      pessoa_id: string; de: string; ate: string; confirmar: boolean; so_padrao?: boolean;
    }) => limparSobreaviso(v.pessoa_id, v.de, v.ate, v.confirmar, v.so_padrao ?? true),
    onSuccess: () => invalidarTudo(qc),
  });
}

// NÃO existe aqui um `sqlstateDoErro` como o de `programacao/data.ts`: as
// mutações rejeitam com o erro CRU, e a tela mostra `e.message` — que já vem em
// português, palavra por palavra, das duas RPCs. Uma casca que traduzisse o
// SQLSTATE para uma frase genérica apagaria a única coisa que o usuário podia
// usar, e é a mesma razão pela qual a agenda de campo tem a dela.

export interface LinhaDaTroca {
  pessoa_id: string;
  dia: string;
  antes: number | null;
  depois: number | null;
  /** de quem SAI: nada · saiu · reduziu — de quem ENTRA: inserir · igual · somar · trocar */
  acao: string;
}

/**
 * A TROCA DE PLANTONISTA (R254, migration U129) — numa transação só.
 *
 * Davi, 11/09/2026: "quando altera o usuário selecionado para fazer o plantão,
 * as horas zeram do usuário que estava e passa para o que colocou depois. Ou
 * seja não é cumulativo entre alternância do botão."
 *
 * NÃO É `limpar(A)` + `aplicar(B)`, e a diferença não é elegância:
 *  · seriam DUAS transações — uma falha no meio deixa a semana sem ninguém, e
 *    como o plantonista é DERIVADO de quem tem mais horas, o nome que a tela
 *    mostra muda com a falha;
 *  · `limpar` APAGA a célula inteira e nunca subtrai — na segunda da virada a
 *    célula de A pode valer 14 (8 da semana anterior + 6 desta), e o DELETE
 *    levaria junto horas que continuam sendo dela na semana passada;
 *  · `_confirmar = false` do aplicar NÃO é dry-run: ele já grava quando não há
 *    colisão, ou seja, "só para ver" escreveria B antes de A sair.
 *
 * `de_pessoa` nulo = ninguém sai (é só um lançamento). `para_pessoa` nulo =
 * ninguém entra (a semana é retirada de quem estava).
 */
export async function trocarPlantonista(
  de_pessoa: string | null,
  para_pessoa: string | null,
  segunda: string,
  celulas: CelulaDoPadrao[],
): Promise<LinhaDaTroca[]> {
  const { data, error } = await (supabase as any).rpc("sobreaviso_trocar_plantonista", {
    _de_pessoa: de_pessoa,
    _para_pessoa: para_pessoa,
    _segunda: segunda,
    _horas: celulas.map((c) => c.horas),
    _absorve: celulas.map((c) => c.absorve),
  });
  if (error) throw error;
  return (data ?? []) as LinhaDaTroca[];
}

export function useTrocarPlantonista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      de_pessoa: string | null; para_pessoa: string | null; segunda: string; celulas: CelulaDoPadrao[];
    }) => trocarPlantonista(v.de_pessoa, v.para_pessoa, v.segunda, v.celulas),
    onSuccess: () => invalidarTudo(qc),
  });
}

/**
 * REGRA 5 (ordem de deploy): enquanto a U129 não roda, a função não existe e o
 * PostgREST devolve PGRST202. A tela precisa dizer ISSO, e não "erro
 * desconhecido" — é o mesmo padrão do PGRST205 que a leitura já usa.
 */
export function faltaMigrationDaTroca(e: unknown): boolean {
  const c = (e as { code?: string } | null)?.code;
  const m = (e as { message?: string } | null)?.message ?? "";
  return c === "PGRST202" || /sobreaviso_trocar_plantonista/.test(m);
}
