// Chamados — dados e mutações. Etapa U7 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §12 e docs/PRODUTO.md §9.
//
// Este arquivo substitui features/os/data.ts e features/demandas/data.ts:
// depois da fusão existe uma tabela só (`chamados`), com `natureza` decidindo
// se o registro é de campo (técnico se desloca, assina, gera cobrança) ou
// interno (o antigo quadro de demandas — sprint, equipe, apoio).
//
// As consultas usam `as any` porque src/integrations/supabase/types.ts está
// desatualizado desde a Etapa 1 do sistema de OS (ver PLANO_UNIFICACAO §12).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  ChamadoPrioridade,
  ChamadoSprint,
  ChamadoStatus,
  ChamadoTipo,
  Natureza,
} from "@/lib/chamado-status";
import type { Equipe } from "@/lib/equipes";

export interface Chamado {
  id: string;
  numero: string | null;
  /** Número que circulou antes da fusão (OS-… / DEM-…) — só para busca. */
  numero_legado: string | null;
  natureza: Natureza;
  equipe: Equipe;
  tipo: ChamadoTipo;
  status: ChamadoStatus;
  prioridade: ChamadoPrioridade;
  sprint: ChamadoSprint | null;

  titulo: string;
  descricao_problema: string | null;
  cliente_id: string | null;
  /** U31: nome do cliente como veio do Notion, quando não casou com o QAP */
  cliente_origem_nome?: string | null;
  cliente_sistema_id: string | null;
  visita_id: string | null;

  responsavel_id: string | null;
  prazo_limite: string | null;
  data_hora_agendada: string | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  concluida_em: string | null;

  diagnostico: string | null;
  servico_executado: string | null;
  pecas_texto: string | null;
  assinatura_nome: string | null;
  assinatura_url: string | null;

  aberto_por: string | null;
  fechado_por: string | null;
  fechada_em: string | null;
  motivo_cancelamento: string | null;

  origem: string;
  origem_id: string | null;
  /** Contrato congelado na abertura — decide cobertura na análise financeira. */
  contrato_id: string | null;
  numero_externo: string | null;
  tipo_servico: "instalacao" | "manutencao" | null;
  faturamento_status: string;
  created_at: string;
  updated_at: string | null;

  cliente?: { id: string; nome: string; endereco: string | null; telefone_sindico: string | null } | null;
  sistema?: { nome: string; tipo: string } | null;
}

const CAMPOS =
  "id, numero, numero_legado, natureza, equipe, tipo, status, prioridade, sprint, " +
  "titulo, descricao_problema, cliente_id, cliente_sistema_id, visita_id, " +
  "responsavel_id, prazo_limite, data_hora_agendada, iniciada_em, finalizada_em, concluida_em, " +
  "diagnostico, servico_executado, pecas_texto, assinatura_nome, assinatura_url, " +
  "aberto_por, fechado_por, fechada_em, motivo_cancelamento, " +
  "origem, origem_id, contrato_id, numero_externo, tipo_servico, faturamento_status, cliente_origem_nome, " +
  "created_at, updated_at, " +
  "cliente:clientes(id, nome, endereco, telefone_sindico), " +
  "sistema:cliente_sistemas(nome, tipo)";

/** Lista completa — a RLS já limita o técnico aos chamados dele. */
export function useChamados() {
  return useQuery({
    queryKey: ["chamados"],
    queryFn: async (): Promise<Chamado[]> => {
      const { data, error } = await supabase
        .from("chamados" as any)
        .select(CAMPOS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Chamado[];
    },
  });
}

/** Só os de campo ou só os internos — para as telas que ainda separam. */
export function useChamadosPorNatureza(natureza: Natureza) {
  return useQuery({
    queryKey: ["chamados", natureza],
    queryFn: async (): Promise<Chamado[]> => {
      const { data, error } = await supabase
        .from("chamados" as any)
        .select(CAMPOS)
        .eq("natureza", natureza)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Chamado[];
    },
  });
}

export function useChamado(id: string | undefined) {
  return useQuery({
    queryKey: ["chamado", id],
    enabled: !!id,
    queryFn: async (): Promise<Chamado | null> => {
      const { data, error } = await supabase
        .from("chamados" as any)
        .select(CAMPOS)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/** Histórico do cliente — campo e interno na mesma lista. */
export function useChamadosDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["chamados-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<Chamado[]> => {
      const { data, error } = await supabase
        .from("chamados" as any)
        .select(CAMPOS)
        .eq("cliente_id", clienteId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) ?? []) as Chamado[];
    },
  });
}

// ── Escrita ────────────────────────────────────────────────────────────────

export interface NovoChamadoInput {
  natureza: Natureza;
  titulo: string;
  /** Vazio = deixa o banco classificar (trigger chamado_preencher). */
  tipo?: ChamadoTipo | null;
  descricao_problema?: string | null;
  cliente_id?: string | null;
  cliente_sistema_id?: string | null;
  visita_id?: string | null;
  equipe?: Equipe;
  prioridade?: ChamadoPrioridade;
  responsavel_id?: string | null;
  data_hora_agendada?: string | null;
  sprint?: ChamadoSprint | null;
  /** Sobrescreve o prazo calculado pelo SLA (campo) ou a data combinada (interno). */
  prazo_limite?: string | null;
}

/**
 * Abre o chamado. Número, prazo pelo SLA e classificação sugerida ficam a
 * cargo do banco (trigger chamado_preencher). A policy de insert exige que
 * quem registra assine em aberto_por.
 */
export async function abrirChamado(input: NovoChamadoInput): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const status: ChamadoStatus =
    input.natureza === "campo" && input.responsavel_id && input.data_hora_agendada
      ? "agendado"
      : "aberto";
  const { data, error } = await supabase
    .from("chamados" as any)
    .insert({
      prioridade: "normal",
      equipe: input.natureza === "campo" ? "tecnica" : undefined,
      ...input,
      status,
      aberto_por: u.user?.id ?? null,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export type ChamadoPatch = Partial<
  Pick<
    Chamado,
    | "titulo" | "descricao_problema" | "prioridade" | "prazo_limite" | "status"
    | "responsavel_id" | "data_hora_agendada" | "iniciada_em" | "finalizada_em"
    | "concluida_em" | "diagnostico" | "servico_executado" | "pecas_texto"
    | "assinatura_nome" | "assinatura_url" | "fechado_por" | "fechada_em"
    | "motivo_cancelamento" | "cliente_id" | "cliente_sistema_id"
    | "equipe" | "sprint" | "tipo"
  >
>;

export async function atualizarChamado(id: string, patch: ChamadoPatch): Promise<void> {
  const { error } = await supabase.from("chamados" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function excluirChamado(id: string): Promise<void> {
  const { error } = await supabase.from("chamados" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Começa a trabalhar — vale para os dois modos. */
export async function iniciarChamado(id: string): Promise<void> {
  await atualizarChamado(id, { status: "em_andamento", iniciada_em: new Date().toISOString() });
}

/**
 * Campo: o técnico encerra o atendimento e o chamado JÁ FICA CONCLUÍDO (U13 —
 * "executado e concluído é a mesma coisa"). Não existe mais um estado em que o
 * trabalho está feito e o registro está aberto.
 *
 * `finalizada_em` continua sendo o carimbo de quando o técnico entregou, que é
 * o que o motor de cobrança e os alertas leem; `concluida_em` é o do
 * encerramento. Aqui os dois coincidem, e é isso mesmo.
 */
export async function executarChamado(
  id: string,
  dados: { diagnostico: string; servico_executado: string; pecas_texto?: string | null },
): Promise<void> {
  const agora = new Date().toISOString();
  await atualizarChamado(id, {
    ...dados,
    status: "concluido",
    finalizada_em: agora,
    concluida_em: agora,
    fechada_em: agora,
  });
}

/** Conferência do gestor (campo) ou conclusão direta (interno). */
export async function concluirChamado(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const agora = new Date().toISOString();
  await atualizarChamado(id, {
    status: "concluido",
    concluida_em: agora,
    fechada_em: agora,
    fechado_por: u.user?.id ?? null,
  });
}

/** Volta um chamado concluído/executado para atendimento. */
export async function reabrirChamado(id: string): Promise<void> {
  await atualizarChamado(id, {
    status: "em_andamento",
    concluida_em: null,
    fechada_em: null,
    fechado_por: null,
  });
}

export async function cancelarChamado(id: string, motivo: string): Promise<void> {
  await atualizarChamado(id, { status: "cancelado", motivo_cancelamento: motivo });
}

// ── Feed / linha do tempo ───────────────────────────────────────────────────

export interface ChamadoEvento {
  id: string;
  chamado_id: string;
  tipo: string;
  descricao: string | null;
  user_id: string | null;
  created_at: string;
}

export function useChamadoEventos(chamadoId: string | undefined, ordem: "asc" | "desc" = "desc") {
  return useQuery({
    queryKey: ["chamado-eventos", chamadoId, ordem],
    enabled: !!chamadoId,
    queryFn: async (): Promise<ChamadoEvento[]> => {
      const { data, error } = await supabase
        .from("chamado_eventos" as any)
        .select("id, chamado_id, tipo, descricao, user_id, created_at")
        .eq("chamado_id", chamadoId as string)
        .order("created_at", { ascending: ordem === "asc" });
      if (error) throw error;
      return ((data as any[]) ?? []) as ChamadoEvento[];
    },
  });
}

/**
 * Comentário do feed. A policy só aceita tipo 'comentario' com user_id do
 * próprio autor — os outros eventos da linha do tempo nascem de trigger.
 */
export async function comentarChamado(chamadoId: string, texto: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("chamado_eventos" as any).insert({
    chamado_id: chamadoId,
    tipo: "comentario",
    descricao: texto,
    user_id: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

// ── Apoio ───────────────────────────────────────────────────────────────────

export function useChamadoApoios(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-apoios", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("chamado_apoios" as any)
        .select("profile_id")
        .eq("chamado_id", chamadoId as string);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => r.profile_id as string);
    },
  });
}

export async function adicionarApoio(chamadoId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("chamado_apoios" as any)
    .insert({ chamado_id: chamadoId, profile_id: profileId } as any);
  if (error) throw error;
}

export async function removerApoio(chamadoId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from("chamado_apoios" as any)
    .delete()
    .eq("chamado_id", chamadoId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

// ── Clientes extras (R54, U45) ───────────────────────────────────────────────
//
// Uma atividade pode ser de mais de um cliente. `cliente_id` (em `chamados`)
// continua sendo o cliente PRINCIPAL — cobrança, matching e relatório
// continuam lendo só ele, sem saber que isto existe. `chamado_clientes`
// guarda os EXTRAS: clientes além do principal. Por isso a lista "clientes
// deste chamado", em qualquer tela, é sempre `[cliente_id, ...extras]` — ver
// `mexerClienteChamado` abaixo, que decide pra qual das duas tabelas
// escrever conforme o slot principal está livre ou não.

export function useChamadoClientesExtra(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-clientes-extra", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("chamado_clientes" as any)
        .select("cliente_id")
        .eq("chamado_id", chamadoId as string);
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => r.cliente_id as string);
    },
  });
}

/**
 * Adiciona um cliente à atividade. Se o slot principal (`cliente_id`) está
 * livre, o cliente novo VIRA o principal — é uma gravação a menos, e mantém
 * quem só lê `cliente_id` funcionando sem precisar saber que a lista existe.
 * Só quando o principal já está ocupado é que o cliente novo vai para
 * `chamado_clientes`.
 */
export async function adicionarClienteChamado(
  chamadoId: string, clienteIdAtual: string | null, clienteId: string,
): Promise<void> {
  if (!clienteIdAtual) {
    await atualizarChamado(chamadoId, { cliente_id: clienteId });
    return;
  }
  const { error } = await supabase
    .from("chamado_clientes" as any)
    .insert({ chamado_id: chamadoId, cliente_id: clienteId } as any);
  if (error) throw error;
}

/**
 * Remove um cliente da atividade. Remover o PRINCIPAL só limpa o slot (não
 * promove um extra a principal — ver o cabeçalho da U45 em
 * supabase/migrations: ficar com extras e sem principal é um estado válido,
 * e a promoção automática seria uma decisão silenciosa sobre QUAL extra vira
 * principal, que ninguém pediu).
 */
export async function removerClienteChamado(
  chamadoId: string, clienteIdAtual: string | null, clienteId: string,
): Promise<void> {
  if (clienteId === clienteIdAtual) {
    await atualizarChamado(chamadoId, { cliente_id: null });
    return;
  }
  const { error } = await supabase
    .from("chamado_clientes" as any)
    .delete()
    .eq("chamado_id", chamadoId)
    .eq("cliente_id", clienteId);
  if (error) throw error;
}

/**
 * Grupo de clientes (R54): "portaria_remota"/"monitoramento_alarmes" hoje —
 * o mesmo vocabulário de `servicos_prestados` (U36). Adicionar um grupo é só
 * repetir `adicionarClienteChamado` para cada cliente que ainda não está na
 * atividade, então no máximo 1 UPDATE (o primeiro, se o slot principal
 * estava livre) + 1 INSERT em lote (o resto) — não N idas ao banco por
 * grupo grande.
 */
export async function adicionarGrupoDeClientes(
  chamadoId: string, clienteIdAtual: string | null, jaNaAtividade: string[], idsDoGrupo: string[],
): Promise<void> {
  const presentes = new Set([clienteIdAtual, ...jaNaAtividade].filter(Boolean) as string[]);
  const faltando = idsDoGrupo.filter((id) => !presentes.has(id));
  if (faltando.length === 0) return;

  let restante = faltando;
  let principalNovo = clienteIdAtual;
  if (!principalNovo) {
    [principalNovo, ...restante] = faltando;
    await atualizarChamado(chamadoId, { cliente_id: principalNovo });
  }
  if (restante.length === 0) return;
  const { error } = await supabase
    .from("chamado_clientes" as any)
    .insert(restante.map((cliente_id) => ({ chamado_id: chamadoId, cliente_id })) as any);
  if (error) throw error;
}

// ── Equipamentos envolvidos ─────────────────────────────────────────────────

export interface ChamadoEquipamento {
  id: string;
  chamado_id: string;
  cliente_equipamento_id: string | null;
  equipamento_id: string | null;
  descricao: string | null;
  numero_serie: string | null;
  tag_patrimonio: string | null;
  quantidade: number;
  observacao: string | null;
}

export function useChamadoEquipamentos(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-equipamentos", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<ChamadoEquipamento[]> => {
      const { data, error } = await supabase
        .from("chamado_equipamentos" as any)
        .select(
          "id, chamado_id, cliente_equipamento_id, equipamento_id, descricao, numero_serie, " +
            "tag_patrimonio, quantidade, observacao",
        )
        .eq("chamado_id", chamadoId as string)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) ?? []) as ChamadoEquipamento[];
    },
  });
}

export async function adicionarEquipamentoChamado(
  chamadoId: string,
  item: Partial<Omit<ChamadoEquipamento, "id" | "chamado_id">>,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("chamado_equipamentos" as any).insert({
    chamado_id: chamadoId,
    ...item,
    created_by: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export async function removerEquipamentoChamado(id: string): Promise<void> {
  const { error } = await supabase.from("chamado_equipamentos" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Fotos e assinatura (chamado de campo) ──────────────────────────────────

export interface ChamadoFoto {
  id: string;
  etapa: "antes" | "depois" | "outra";
  url: string;
  storage_path: string | null;
  legenda: string | null;
  created_at: string;
}

export function useChamadoFotos(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ["chamado-fotos", chamadoId],
    enabled: !!chamadoId,
    queryFn: async (): Promise<(ChamadoFoto & { signedUrl: string | null })[]> => {
      const { data, error } = await supabase
        .from("chamado_fotos" as any)
        .select("id, etapa, url, storage_path, legenda, created_at")
        .eq("chamado_id", chamadoId as string)
        .order("created_at");
      if (error) throw error;
      const fotos = ((data as any[]) ?? []) as ChamadoFoto[];
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

async function subirArquivo(chamadoId: string, arquivo: Blob, nome: string): Promise<string> {
  const path = `${chamadoId}/${Date.now()}-${nome}`;
  const { error } = await supabase.storage.from("fotos-os").upload(path, arquivo, { upsert: false });
  if (error) throw error;
  return path;
}

export async function anexarFoto(
  chamadoId: string,
  arquivo: File,
  etapa: "antes" | "depois" | "outra",
  legenda?: string | null,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const ext = arquivo.name.split(".").pop() || "jpg";
  const path = await subirArquivo(chamadoId, arquivo, `${etapa}.${ext}`);
  const { error } = await supabase.from("chamado_fotos" as any).insert({
    chamado_id: chamadoId,
    etapa,
    url: path,          // bucket privado: a URL de exibição é assinada na leitura
    storage_path: path,
    legenda: legenda ?? null,
    created_by: u.user?.id ?? null,
  } as any);
  if (error) throw error;
}

export async function excluirFoto(id: string, storagePath: string | null): Promise<void> {
  if (storagePath) {
    await supabase.storage.from("fotos-os").remove([storagePath]);
  }
  const { error } = await supabase.from("chamado_fotos" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Salva a assinatura (dataURL do canvas) e guarda o caminho no storage. */
export async function salvarAssinatura(chamadoId: string, dataUrl: string, nome: string): Promise<void> {
  const resp = await fetch(dataUrl);
  const blob = await resp.blob();
  const path = await subirArquivo(chamadoId, blob, "assinatura.png");
  await atualizarChamado(chamadoId, { assinatura_url: path, assinatura_nome: nome });
}

/** URL assinada da imagem da assinatura, para exibir/imprimir. */
export function useAssinaturaUrl(storagePath: string | null | undefined) {
  return useQuery({
    queryKey: ["chamado-assinatura", storagePath],
    enabled: !!storagePath,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.storage
        .from("fotos-os")
        .createSignedUrl(storagePath as string, 3600);
      return data?.signedUrl ?? null;
    },
  });
}

/** Prazos de SLA por prioridade (tabela de configuração). */
export function useSla() {
  return useQuery({
    queryKey: ["chamado-sla"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number | null>> => {
      const { data, error } = await supabase.from("chamado_sla" as any).select("prioridade, horas_prazo");
      if (error) throw error;
      const mapa: Record<string, number | null> = {};
      for (const r of ((data as any[]) ?? [])) mapa[r.prioridade as string] = r.horas_prazo ?? null;
      return mapa;
    },
  });
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

/** Equipe do usuário logado — decide qual recorte do quadro ele abre. */
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

/**
 * O ÚNICO canal de realtime de chamados do app. Antes desta versão ele existia
 * e não era usado por ninguém: /chamados tinha escrito um canal inline próprio,
 * e a Home estava prestes a abrir um terceiro na mesma tabela.
 *
 * Dois cuidados que não são opcionais:
 *
 * 1. DEBOUNCE. A policy `chamados_select` entrega TODO chamado com
 *    natureza='interno' a qualquer autenticado — são os 537 vindos do Notion
 *    mais o fluxo diário de todas as equipes. Sem agrupar, o técnico em campo
 *    refaz as consultas a cada edição de qualquer demanda da empresa.
 *
 * 2. `chamado_compra` NÃO ENTRA AQUI. Só `public.chamados` foi adicionada à
 *    publicação do realtime (na U7); uma inscrição em tabela fora da publicação
 *    não dá erro — ela conecta, fica viva e nunca dispara, que é pior do que
 *    não existir. Como toda decisão de compra também mexe no chamado pai
 *    (decidir_pedido_compra atualiza o status), o evento de `chamados` já
 *    cobre a compra.
 */
export function useChamadosRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let pendente: ReturnType<typeof setTimeout> | null = null;
    const invalidar = () => {
      if (pendente) clearTimeout(pendente);
      pendente = setTimeout(() => {
        for (const k of [["chamados"], ["home-chamados"], ["chamado-compra"], ["home-compras-situacao"]]) {
          qc.invalidateQueries({ queryKey: k });
        }
      }, 1200);
    };
    const canal = supabase
      .channel("chamados-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, invalidar)
      .subscribe();
    return () => {
      if (pendente) clearTimeout(pendente);
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}
