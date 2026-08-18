// Demandas internas — dados e mutações. Etapa U1 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §4.1 e §5.1.
//
// Substitui o quadro do Notion: sprint com virada automática, equipe,
// responsável + apoio, prazo do próprio responsável, feed de comentários e
// equipamentos envolvidos (a lacuna que o Notion tinha).
//
// As consultas usam `as any` porque src/integrations/supabase/types.ts está
// desatualizado desde a Etapa 1 do sistema de OS (ver PLANO_UNIFICACAO §12).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DemandaSprint, DemandaStatus, DemandaTipo } from "@/lib/demanda-status";
import type { Equipe } from "@/lib/equipes";

export interface Demanda {
  id: string;
  numero: string | null;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  equipe: Equipe;
  responsavel_id: string | null;
  prazo: string | null;
  sprint: DemandaSprint;
  tipo: DemandaTipo | null;
  status: DemandaStatus;
  iniciada_em: string | null;
  concluida_em: string | null;
  criada_por: string | null;
  origem: string;
  origem_id: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { id: string; nome: string } | null;
}

const CAMPOS =
  "id, numero, titulo, descricao, cliente_id, equipe, responsavel_id, prazo, sprint, tipo, " +
  "status, iniciada_em, concluida_em, criada_por, origem, origem_id, created_at, updated_at, " +
  "cliente:clientes(id, nome)";

export function useDemandas() {
  return useQuery({
    queryKey: ["demandas"],
    queryFn: async (): Promise<Demanda[]> => {
      const { data, error } = await supabase
        .from("demandas" as any)
        .select(CAMPOS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Demanda[];
    },
  });
}

export function useDemanda(id: string | undefined) {
  return useQuery({
    queryKey: ["demanda", id],
    enabled: !!id,
    queryFn: async (): Promise<Demanda | null> => {
      const { data, error } = await supabase
        .from("demandas" as any)
        .select(CAMPOS)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/** Demandas de um cliente — histórico exibido na ficha. */
export function useDemandasDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["demandas-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<Demanda[]> => {
      const { data, error } = await supabase
        .from("demandas" as any)
        .select(CAMPOS)
        .eq("cliente_id", clienteId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Demanda[];
    },
  });
}

export type DemandaPatch = Partial<
  Pick<
    Demanda,
    | "titulo" | "descricao" | "cliente_id" | "equipe" | "responsavel_id"
    | "prazo" | "sprint" | "tipo" | "status"
  >
>;

/**
 * A policy demandas_insert exige criada_por = auth.uid(): quem registra assina.
 * Número e classificação sugerida ficam a cargo do banco (trigger).
 */
export async function criarDemanda(patch: DemandaPatch): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("demandas" as any)
    .insert({ ...patch, criada_por: u.user?.id ?? null } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export async function atualizarDemanda(id: string, patch: DemandaPatch): Promise<void> {
  const { error } = await supabase.from("demandas" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function excluirDemanda(id: string): Promise<void> {
  const { error } = await supabase.from("demandas" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Feed / linha do tempo ───────────────────────────────────────────────────

export interface DemandaEvento {
  id: string;
  demanda_id: string;
  tipo: string;
  descricao: string | null;
  user_id: string | null;
  created_at: string;
}

export function useDemandaEventos(demandaId: string | undefined) {
  return useQuery({
    queryKey: ["demanda-eventos", demandaId],
    enabled: !!demandaId,
    queryFn: async (): Promise<DemandaEvento[]> => {
      const { data, error } = await supabase
        .from("demanda_eventos" as any)
        .select("id, demanda_id, tipo, descricao, user_id, created_at")
        .eq("demanda_id", demandaId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data as any[]) ?? []) as DemandaEvento[];
    },
  });
}

/**
 * Comentário do feed. A policy só aceita tipo 'comentario' com user_id do
 * próprio autor — os outros eventos da linha do tempo nascem de trigger.
 */
export async function comentarDemanda(demandaId: string, texto: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("demanda_eventos" as any).insert({
    demanda_id: demandaId,
    tipo: "comentario",
    descricao: texto,
    user_id: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

// ── Apoio ───────────────────────────────────────────────────────────────────

export function useDemandaApoios(demandaId: string | undefined) {
  return useQuery({
    queryKey: ["demanda-apoios", demandaId],
    enabled: !!demandaId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("demanda_apoios" as any)
        .select("profile_id")
        .eq("demanda_id", demandaId as string);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => r.profile_id as string);
    },
  });
}

export async function adicionarApoio(demandaId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("demanda_apoios" as any)
    .insert({ demanda_id: demandaId, profile_id: profileId } as any);
  if (error) throw error;
}

export async function removerApoio(demandaId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("demanda_apoios" as any)
    .delete()
    .eq("demanda_id", demandaId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

// ── Equipamentos envolvidos ─────────────────────────────────────────────────

export interface DemandaEquipamento {
  id: string;
  demanda_id: string;
  cliente_equipamento_id: string | null;
  equipamento_id: string | null;
  descricao: string | null;
  numero_serie: string | null;
  tag_patrimonio: string | null;
  quantidade: number;
  observacao: string | null;
}

export function useDemandaEquipamentos(demandaId: string | undefined) {
  return useQuery({
    queryKey: ["demanda-equipamentos", demandaId],
    enabled: !!demandaId,
    queryFn: async (): Promise<DemandaEquipamento[]> => {
      const { data, error } = await supabase
        .from("demanda_equipamentos" as any)
        .select(
          "id, demanda_id, cliente_equipamento_id, equipamento_id, descricao, numero_serie, " +
            "tag_patrimonio, quantidade, observacao",
        )
        .eq("demanda_id", demandaId as string)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) ?? []) as DemandaEquipamento[];
    },
  });
}

export async function adicionarEquipamentoDemanda(
  demandaId: string,
  item: Partial<Omit<DemandaEquipamento, "id" | "demanda_id">>,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("demanda_equipamentos" as any).insert({
    demanda_id: demandaId,
    ...item,
    created_by: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export async function removerEquipamentoDemanda(id: string): Promise<void> {
  const { error } = await supabase.from("demanda_equipamentos" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Pessoas (responsável, apoio) ────────────────────────────────────────────

export interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  equipe: string | null;
  avatar_url: string | null;
}

/**
 * Todos os perfis ativos — responsável e apoio saem daqui. Não dá para usar
 * join do PostgREST: responsavel_id aponta para auth.users, não para profiles.
 */
export function usePessoas() {
  return useQuery({
    queryKey: ["pessoas-ativas"],
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, cargo, equipe, avatar_url")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return ((data as any[]) ?? []) as Pessoa[];
    },
    staleTime: 60_000,
  });
}

/**
 * Equipe do usuário logado. Serve para decidir quem enxerga o quadro de
 * demandas: técnico de campo não precisa dele, quem tem equipe precisa.
 */
export function useMinhaEquipe() {
  return useQuery({
    queryKey: ["minha-equipe"],
    queryFn: async (): Promise<string | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("equipe")
        .eq("id", u.user.id)
        .maybeSingle();
      return ((data as any)?.equipe as string | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function mapaDePessoas(pessoas: Pessoa[] | undefined): Record<string, Pessoa> {
  const m: Record<string, Pessoa> = {};
  for (const p of pessoas ?? []) m[p.id] = p;
  return m;
}

// ── Realtime ────────────────────────────────────────────────────────────────

/** Mantém o quadro vivo enquanto o time trabalha (padrão de /os). */
export function useDemandasRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const canal = supabase
      .channel("demandas-quadro")
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () => {
        qc.invalidateQueries({ queryKey: ["demandas"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [qc]);
}
