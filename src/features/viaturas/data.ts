// As VIATURAS — a camada de dados. Consultas e as três portas (R266–R274).
//
// Toda ESCRITA de viagem passa pelas funções do banco (U134): iniciar,
// encerrar, corrigir. Aqui não há INSERT em `viagens_viatura` de propósito —
// a regra da transição (assumir fecha uma e abre outra) mora no banco, num
// lugar só. O cadastro das viaturas e o ajuste da sede escrevem pela tabela,
// que a policy reserva à gestão.
//
// REGRA 5 (ordem de deploy): até a U134 rodar, as tabelas não existem. As
// consultas devolvem lista vazia quando o erro é "tabela não existe"
// (`faltaMigrationDasViaturas`), e a tela diz que precisa da migration em vez
// de mostrar um erro do driver.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  faltaMigrationDasViaturas,
  type LocalDeReferencia, type Viagem, type Viatura,
} from "./modelo";

const CAMPOS_VIATURA = "id, codigo, placa, apelido, ativa, desativada_em";
const CAMPOS_VIAGEM =
  "id, viatura_id, tecnico_id, chamado_id, saida_em, chegada_em, "
  + "encerramento, encerrada_por, corrigida_por, corrigida_em, observacao";
const CAMPOS_REFERENCIA = "id, codigo, nome, endereco, latitude, longitude";

/** Lista vazia quando a migration ainda não rodou; qualquer outro erro sobe. */
function ouVazio<T>(error: unknown, data: T[] | null): T[] {
  if (error && faltaMigrationDasViaturas(error)) return [];
  if (error) throw error;
  return data ?? [];
}

// ── Leitura ─────────────────────────────────────────────────────────────────

export function useViaturas() {
  return useQuery({
    queryKey: ["viaturas"],
    staleTime: 60_000,
    queryFn: async (): Promise<Viatura[]> => {
      const { data, error } = await (supabase as any).from("viaturas").select(CAMPOS_VIATURA).order("apelido");
      return ouVazio<Viatura>(error, data as Viatura[] | null);
    },
  });
}

/** Uma viatura pelo código da etiqueta — `null` quando não existe (a tela diz "etiqueta desconhecida"). */
export function useViaturaPorCodigo(codigo: string | undefined) {
  return useQuery({
    queryKey: ["viatura", codigo],
    enabled: !!codigo,
    queryFn: async (): Promise<Viatura | null> => {
      const { data, error } = await (supabase as any)
        .from("viaturas").select(CAMPOS_VIATURA).eq("codigo", (codigo ?? "").toLowerCase()).maybeSingle();
      if (error && faltaMigrationDasViaturas(error)) return null;
      if (error) throw error;
      return (data as Viatura | null) ?? null;
    },
  });
}

/**
 * TODAS as viagens abertas — são poucas (uma por carro, no máximo), e é o que
 * a tela da etiqueta precisa para dizer "em uso por Nicholas" e a Início do
 * técnico para a faixa "Você está com a Fiorino". Realtime não entra aqui: o
 * técnico bipa e a própria mutação invalida.
 */
export function useViagensAbertas() {
  return useQuery({
    queryKey: ["viagens", "abertas"],
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Viagem[]> => {
      const { data, error } = await (supabase as any)
        .from("viagens_viatura").select(CAMPOS_VIAGEM).is("chegada_em", null).order("saida_em");
      return ouVazio<Viagem>(error, data as Viagem[] | null);
    },
  });
}

/**
 * As viagens de uma COMPETÊNCIA ("AAAA-MM"), com um mês de folga de cada lado —
 * a folha filtra pelo dia LOCAL da saída, e a virada do mês em UTC não coincide
 * com a de São Paulo.
 */
export function useViagensDaCompetencia(competencia: string, opcoes: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["viagens", "competencia", competencia],
    enabled: opcoes.enabled ?? true,
    staleTime: 30_000,
    queryFn: async (): Promise<Viagem[]> => {
      const [ano, mes] = competencia.split("-").map(Number);
      const de = new Date(ano, mes - 2, 1).toISOString();
      const ate = new Date(ano, mes + 1, 1).toISOString();
      const { data, error } = await (supabase as any)
        .from("viagens_viatura").select(CAMPOS_VIAGEM)
        .gte("saida_em", de).lt("saida_em", ate)
        .order("saida_em", { ascending: false });
      return ouVazio<Viagem>(error, data as Viagem[] | null);
    },
  });
}

/** As últimas viagens de UMA viatura — o "último registro" da tela da etiqueta. */
export function useUltimasViagensDaViatura(viaturaId: string | undefined) {
  return useQuery({
    queryKey: ["viagens", "viatura", viaturaId],
    enabled: !!viaturaId,
    staleTime: 15_000,
    queryFn: async (): Promise<Viagem[]> => {
      const { data, error } = await (supabase as any)
        .from("viagens_viatura").select(CAMPOS_VIAGEM)
        .eq("viatura_id", viaturaId as string).not("chegada_em", "is", null)
        .order("chegada_em", { ascending: false }).limit(5);
      return ouVazio<Viagem>(error, data as Viagem[] | null);
    },
  });
}

export function useLocaisDeReferencia() {
  return useQuery({
    queryKey: ["locais-de-referencia"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LocalDeReferencia[]> => {
      const { data, error } = await (supabase as any).from("locais_de_referencia").select(CAMPOS_REFERENCIA).order("nome");
      return ouVazio<LocalDeReferencia>(error, data as LocalDeReferencia[] | null);
    },
  });
}

// ── As portas (R266/R269/R276) ──────────────────────────────────────────────

export interface RespostaDeInicio { viagem_id: string; assumida_de: string | null }
export interface RespostaDeEncerramento { minutos: number }

/**
 * A porta recusa com frases em português (USING ERRCODE): P0005 é "o carro está
 * com outra pessoa" — a tela lê o código e oferece assumir; o resto vai como
 * mensagem para a pessoa.
 */
export class RecusaDaViatura extends Error {
  codigo: string | null;
  constructor(e: { code?: string; message?: string } | null) {
    super(e?.message ?? "Não foi possível registrar a viagem.");
    this.name = "RecusaDaViatura";
    this.codigo = e?.code ?? null;
  }
}

export async function iniciarViagem(entrada: { codigo: string; chamadoId: string | null; assumir: boolean }): Promise<RespostaDeInicio> {
  const { data, error } = await (supabase as any).rpc("viatura_iniciar_viagem", {
    _codigo: entrada.codigo, _chamado_id: entrada.chamadoId, _assumir: entrada.assumir,
  });
  if (error) throw new RecusaDaViatura(error);
  const linha = Array.isArray(data) ? data[0] : data;
  return linha as RespostaDeInicio;
}

export async function encerrarViagem(entrada: { viagemId: string }): Promise<RespostaDeEncerramento> {
  const { data, error } = await (supabase as any).rpc("viatura_encerrar_viagem", {
    _viagem_id: entrada.viagemId,
  });
  if (error) throw new RecusaDaViatura(error);
  const linha = Array.isArray(data) ? data[0] : data;
  return linha as RespostaDeEncerramento;
}

export async function corrigirViagem(entrada: {
  viagemId: string; chegadaEm?: string | null; observacao?: string | null;
}): Promise<void> {
  const { error } = await (supabase as any).rpc("viatura_corrigir_viagem", {
    _viagem_id: entrada.viagemId,
    _chegada_em: entrada.chegadaEm ?? null,
    _observacao: entrada.observacao ?? null,
  });
  if (error) throw new RecusaDaViatura(error);
}

/** Toda escrita invalida viagens e viaturas — a folha e a faixa leem as duas. */
function useInvalidarViaturas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["viagens"] });
    qc.invalidateQueries({ queryKey: ["viaturas"] });
    qc.invalidateQueries({ queryKey: ["viatura"] });
  };
}

export function useIniciarViagem() {
  const invalidar = useInvalidarViaturas();
  return useMutation({ mutationFn: iniciarViagem, onSuccess: invalidar });
}

export function useEncerrarViagem() {
  const invalidar = useInvalidarViaturas();
  return useMutation({ mutationFn: encerrarViagem, onSuccess: invalidar });
}

export function useCorrigirViagem() {
  const invalidar = useInvalidarViaturas();
  return useMutation({ mutationFn: corrigirViagem, onSuccess: invalidar });
}

// ── O cadastro (R271) — escreve pela tabela; a policy reserva à gestão ─────

export async function salvarViatura(v: { id?: string; codigo: string; placa: string; apelido: string }): Promise<void> {
  const linha = { codigo: v.codigo.trim().toLowerCase(), placa: v.placa.trim().toUpperCase(), apelido: v.apelido.trim(), updated_at: new Date().toISOString() };
  const q = v.id
    ? (supabase as any).from("viaturas").update(linha).eq("id", v.id).select("id")
    : (supabase as any).from("viaturas").insert(linha).select("id");
  const { data, error } = await q;
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("Já existe uma viatura ativa com essa placa ou esse código de etiqueta.");
    throw error;
  }
  if (!data || (data as unknown[]).length === 0) throw new Error("Só a gestão cadastra viaturas.");
}

/** R271: remover = desativar quando já rodou. Apagar de verdade só quem nunca teve viagem. */
export async function desativarViatura(id: string, ativa: boolean): Promise<void> {
  const { data, error } = await (supabase as any).from("viaturas")
    .update({ ativa, desativada_em: ativa ? null : new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).select("id");
  if (error) throw error;
  if (!data || (data as unknown[]).length === 0) throw new Error("Só a gestão altera viaturas.");
}

export async function excluirViatura(id: string): Promise<void> {
  const { error } = await (supabase as any).from("viaturas").delete().eq("id", id);
  if (error) {
    // 23503: a FK RESTRICT — ela já rodou, então o gesto certo é desativar
    if ((error as { code?: string }).code === "23503") throw new Error("Esta viatura já tem viagens registradas — desative-a em vez de apagar.");
    throw error;
  }
}

export async function salvarLocalDeReferencia(l: { id: string; endereco: string | null; latitude: number | null; longitude: number | null }): Promise<void> {
  const { data, error } = await (supabase as any).from("locais_de_referencia")
    .update({ endereco: l.endereco, latitude: l.latitude, longitude: l.longitude, updated_at: new Date().toISOString() })
    .eq("id", l.id).select("id");
  if (error) throw error;
  if (!data || (data as unknown[]).length === 0) throw new Error("Só a gestão ajusta a sede.");
}

export function useSalvarViatura() {
  const invalidar = useInvalidarViaturas();
  return useMutation({ mutationFn: salvarViatura, onSuccess: invalidar });
}
export function useDesativarViatura() {
  const invalidar = useInvalidarViaturas();
  return useMutation({ mutationFn: (e: { id: string; ativa: boolean }) => desativarViatura(e.id, e.ativa), onSuccess: invalidar });
}
export function useExcluirViatura() {
  const invalidar = useInvalidarViaturas();
  return useMutation({ mutationFn: excluirViatura, onSuccess: invalidar });
}
export function useSalvarLocalDeReferencia() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: salvarLocalDeReferencia, onSuccess: () => qc.invalidateQueries({ queryKey: ["locais-de-referencia"] }) });
}

// ── Regra 5, a pergunta direta: a U134 já rodou? ─────────────────────────────

/**
 * `true` quando a tabela responde, `false` quando o erro é "não existe". As
 * telas usam isto para dizer "precisa da migration" em vez de mostrar lista
 * vazia — a mentira mais cara de uma tela (lição da U86).
 */
export function useViaturasProntas() {
  return useQuery({
    queryKey: ["viaturas", "pronta"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { error } = await (supabase as any).from("viaturas").select("id").limit(1);
      if (error && faltaMigrationDasViaturas(error)) return false;
      if (error) throw error;
      return true;
    },
  });
}

/** Título e cliente das atividades vinculadas às viagens da folha — o "destino" da linha. */
export function useTitulosDeChamados(ids: readonly string[]) {
  const chave = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["viagens", "titulos", chave.join("|")],
    enabled: chave.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await (supabase as any)
        .from("chamados").select("id, titulo, cliente:clientes!cliente_id(nome)").in("id", chave);
      if (error) throw error;
      const m: Record<string, string> = {};
      for (const c of (data as { id: string; titulo: string | null; cliente: { nome: string } | null }[]) ?? []) {
        m[c.id] = c.cliente?.nome ? `${c.cliente.nome} · ${c.titulo ?? ""}`.replace(/ · $/, "") : (c.titulo ?? "atividade");
      }
      return m;
    },
  });
}
