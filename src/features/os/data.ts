// Ordens de Serviço — dados e mutações. Etapa 3 do sistema de OS.
// Ver docs/SISTEMA_OS.md §4.3 e §5.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OsPrioridade, OsStatus, OsTipo } from "@/lib/os-status";

export interface OrdemServico {
  id: string;
  numero: string | null;
  tipo: OsTipo;
  cliente_id: string;
  cliente_sistema_id: string | null;
  visita_id: string | null;
  titulo: string;
  descricao_problema: string | null;
  prioridade: OsPrioridade;
  prazo_limite: string | null;
  status: OsStatus;
  tecnico_id: string | null;
  data_hora_agendada: string | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  diagnostico: string | null;
  servico_executado: string | null;
  pecas_texto: string | null;
  assinatura_nome: string | null;
  assinatura_url: string | null;
  aberto_por: string | null;
  fechado_por: string | null;
  fechada_em: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  cliente?: { nome: string; endereco: string | null; telefone_sindico: string | null } | null;
  sistema?: { nome: string; tipo: string } | null;
}

const CAMPOS =
  "id, numero, tipo, cliente_id, cliente_sistema_id, visita_id, titulo, descricao_problema, " +
  "prioridade, prazo_limite, status, tecnico_id, data_hora_agendada, iniciada_em, finalizada_em, " +
  "diagnostico, servico_executado, pecas_texto, assinatura_nome, assinatura_url, aberto_por, " +
  "fechado_por, fechada_em, motivo_cancelamento, created_at, " +
  "cliente:clientes(nome, endereco, telefone_sindico), " +
  "sistema:cliente_sistemas(nome, tipo)";

/** Lista de OS — a RLS já limita o técnico às dele. */
export function useOrdens() {
  return useQuery({
    queryKey: ["ordens-servico"],
    queryFn: async (): Promise<OrdemServico[]> => {
      const { data, error } = await supabase
        .from("ordens_servico" as any)
        .select(CAMPOS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as OrdemServico[];
    },
  });
}

export function useOrdem(id: string | undefined) {
  return useQuery({
    queryKey: ["ordem-servico", id],
    enabled: !!id,
    queryFn: async (): Promise<OrdemServico | null> => {
      const { data, error } = await supabase
        .from("ordens_servico" as any)
        .select(CAMPOS)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/** OS de um cliente — usado na ficha do cliente. */
export function useOrdensDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["ordens-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<OrdemServico[]> => {
      const { data, error } = await supabase
        .from("ordens_servico" as any)
        .select(CAMPOS)
        .eq("cliente_id", clienteId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as OrdemServico[];
    },
  });
}

export interface EventoOs {
  id: string;
  tipo: string;
  descricao: string | null;
  user_id: string | null;
  created_at: string;
}

export function useEventosOs(osId: string | undefined) {
  return useQuery({
    queryKey: ["os-eventos", osId],
    enabled: !!osId,
    queryFn: async (): Promise<EventoOs[]> => {
      const { data, error } = await supabase
        .from("os_eventos" as any)
        .select("id, tipo, descricao, user_id, created_at")
        .eq("os_id", osId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as EventoOs[];
    },
  });
}

export interface FotoOs {
  id: string;
  etapa: "antes" | "depois" | "outra";
  url: string;
  storage_path: string | null;
  legenda: string | null;
  created_at: string;
}

export function useFotosOs(osId: string | undefined) {
  return useQuery({
    queryKey: ["os-fotos", osId],
    enabled: !!osId,
    queryFn: async (): Promise<(FotoOs & { signedUrl: string | null })[]> => {
      const { data, error } = await supabase
        .from("os_fotos" as any)
        .select("id, etapa, url, storage_path, legenda, created_at")
        .eq("os_id", osId as string)
        .order("created_at");
      if (error) throw error;
      const fotos = ((data as any[]) ?? []) as FotoOs[];
      // bucket é privado: precisa de URL assinada para exibir
      return Promise.all(
        fotos.map(async (f) => {
          if (!f.storage_path) return { ...f, signedUrl: f.url };
          const { data: s } = await supabase.storage.from("fotos-os").createSignedUrl(f.storage_path, 3600);
          return { ...f, signedUrl: s?.signedUrl ?? null };
        }),
      );
    },
  });
}

/** Prazos de SLA por prioridade (tabela de configuração). */
export function useSla() {
  return useQuery({
    queryKey: ["os-sla"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number | null>> => {
      const { data, error } = await supabase.from("os_sla" as any).select("prioridade, horas_prazo");
      if (error) throw error;
      const mapa: Record<string, number | null> = {};
      for (const r of ((data as any[]) ?? [])) mapa[r.prioridade as string] = r.horas_prazo ?? null;
      return mapa;
    },
  });
}

// ── Escrita ────────────────────────────────────────────────────────────────

export interface NovaOsInput {
  tipo: OsTipo;
  cliente_id: string;
  cliente_sistema_id?: string | null;
  visita_id?: string | null;
  titulo: string;
  descricao_problema?: string | null;
  prioridade: OsPrioridade;
  tecnico_id?: string | null;
  data_hora_agendada?: string | null;
  /** Sobrescreve o prazo calculado pelo SLA. */
  prazo_limite?: string | null;
}

/** Abre a OS. Número e prazo (pelo SLA) são preenchidos pelo banco. */
export async function abrirOs(input: NovaOsInput): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const status: OsStatus = input.tecnico_id && input.data_hora_agendada ? "agendada" : "aberta";
  const { data, error } = await supabase
    .from("ordens_servico" as any)
    .insert({ ...input, status, aberto_por: u.user?.id ?? null } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export type OsPatch = Partial<
  Pick<
    OrdemServico,
    | "titulo" | "descricao_problema" | "prioridade" | "prazo_limite" | "status"
    | "tecnico_id" | "data_hora_agendada" | "iniciada_em" | "finalizada_em"
    | "diagnostico" | "servico_executado" | "pecas_texto"
    | "assinatura_nome" | "assinatura_url" | "fechado_por" | "fechada_em"
    | "motivo_cancelamento" | "cliente_sistema_id"
  >
>;

export async function atualizarOs(id: string, patch: OsPatch): Promise<void> {
  const { error } = await supabase.from("ordens_servico" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

/** Técnico inicia o atendimento. */
export async function iniciarAtendimento(id: string): Promise<void> {
  await atualizarOs(id, { status: "em_atendimento", iniciada_em: new Date().toISOString() });
}

/** Técnico conclui: exige diagnóstico/serviço e assinatura de quem recebeu. */
export async function concluirAtendimento(
  id: string,
  dados: { diagnostico: string; servico_executado: string; pecas_texto?: string | null },
): Promise<void> {
  await atualizarOs(id, {
    ...dados,
    status: "executada",
    finalizada_em: new Date().toISOString(),
  });
}

/** Gestor confere e fecha. */
export async function fecharOs(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  await atualizarOs(id, {
    status: "fechada",
    fechada_em: new Date().toISOString(),
    fechado_por: u.user?.id ?? null,
  });
}

/** Gestor reabre uma OS executada/fechada (volta para atendimento). */
export async function reabrirOs(id: string): Promise<void> {
  await atualizarOs(id, { status: "em_atendimento", fechada_em: null, fechado_por: null });
}

export async function cancelarOs(id: string, motivo: string): Promise<void> {
  await atualizarOs(id, { status: "cancelada", motivo_cancelamento: motivo });
}

// ── Fotos e assinatura ─────────────────────────────────────────────────────

async function subirArquivo(osId: string, arquivo: Blob, nome: string): Promise<string> {
  const path = `${osId}/${Date.now()}-${nome}`;
  const { error } = await supabase.storage.from("fotos-os").upload(path, arquivo, { upsert: false });
  if (error) throw error;
  return path;
}

export async function anexarFotoOs(
  osId: string,
  arquivo: File,
  etapa: "antes" | "depois" | "outra",
  legenda?: string | null,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const ext = arquivo.name.split(".").pop() || "jpg";
  const path = await subirArquivo(osId, arquivo, `${etapa}.${ext}`);
  const { error } = await supabase.from("os_fotos" as any).insert({
    os_id: osId,
    etapa,
    url: path,          // bucket privado: a URL de exibição é assinada na leitura
    storage_path: path,
    legenda: legenda ?? null,
    created_by: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export async function excluirFotoOs(id: string, storagePath: string | null): Promise<void> {
  if (storagePath) {
    await supabase.storage.from("fotos-os").remove([storagePath]);
  }
  const { error } = await supabase.from("os_fotos" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Salva a assinatura (dataURL do canvas) e devolve o caminho no storage. */
export async function salvarAssinatura(osId: string, dataUrl: string, nome: string): Promise<void> {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const path = await subirArquivo(osId, blob, "assinatura.png");
  await atualizarOs(osId, { assinatura_url: path, assinatura_nome: nome });
}

/** URL assinada da imagem da assinatura, para exibir/imprimir. */
export function useAssinaturaUrl(storagePath: string | null | undefined) {
  return useQuery({
    queryKey: ["os-assinatura", storagePath],
    enabled: !!storagePath,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.storage
        .from("fotos-os")
        .createSignedUrl(storagePath as string, 3600);
      return data?.signedUrl ?? null;
    },
  });
}
