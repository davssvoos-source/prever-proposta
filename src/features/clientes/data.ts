// Cadastro de clientes (registro mestre) — Etapa 1 do sistema de OS.
// A tabela `clientes` deixou de ser uma linha descartável por visita e passou a
// ser o registro corporativo: endereço, contatos, situação do contrato e a
// origem dos dados que antes viviam embutidos em cada visita_tecnica.
// Ver docs/SISTEMA_OS.md §4.1.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SituacaoCliente = "prospecto" | "ativo" | "inativo";

export const SITUACAO_LABEL: Record<SituacaoCliente, string> = {
  prospecto: "Prospecto",
  ativo: "Ativo",
  inativo: "Inativo",
};

/** Cores por situação — claro/escuro, no padrão de status do design system. */
export const SITUACAO_CORES: Record<SituacaoCliente, { dark: string; light: string; bg: string; border: string }> = {
  prospecto: { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)" },
  ativo:     { dark: "#34D399", light: "#047857", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.30)" },
  inativo:   { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
};

export interface Cliente {
  id: string;
  nome: string;
  nome_predio: string | null;
  tipo_local: string | null;
  tipo_empreendimento: string | null;
  endereco: string | null;
  complemento: string | null;
  latitude: number | null;
  longitude: number | null;
  email: string | null;
  telefone: string | null;
  nome_sindico: string | null;
  telefone_sindico: string | null;
  email_sindico: string | null;
  nome_zelador: string | null;
  telefone_zelador: string | null;
  email_zelador: string | null;
  foto_fachada_url: string | null;
  qtd_apartamentos: number | null;
  qtd_acessos: number | null;
  observacoes: string | null;
  situacao: SituacaoCliente;
  created_at: string;
}

const CAMPOS =
  "id, nome, nome_predio, tipo_local, tipo_empreendimento, endereco, complemento, latitude, longitude, " +
  "email, telefone, nome_sindico, telefone_sindico, email_sindico, nome_zelador, telefone_zelador, " +
  "email_zelador, foto_fachada_url, qtd_apartamentos, qtd_acessos, observacoes, situacao, created_at";

export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select(CAMPOS)
    .order("nome");
  if (error) throw error;
  return ((data as any[]) ?? []) as Cliente[];
}

export function useClientes() {
  return useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ["cliente", id],
    enabled: !!id,
    queryFn: async (): Promise<Cliente | null> => {
      const { data, error } = await supabase
        .from("clientes")
        .select(CAMPOS)
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/** Visitas técnicas do cliente — histórico exibido na ficha. */
export function useVisitasDoCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-visitas", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, status, data_hora_agendada, created_at, titulo, nome_predio, tecnico_id")
        .eq("cliente_id", clienteId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

/** Campos editáveis pelo formulário de cliente. */
export type ClientePatch = Partial<Omit<Cliente, "id" | "created_at">>;

export async function criarCliente(patch: ClientePatch): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...patch, created_by: u.user?.id ?? null } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export async function atualizarCliente(id: string, patch: ClientePatch): Promise<void> {
  const { error } = await supabase.from("clientes").update(patch as any).eq("id", id);
  if (error) throw error;
}

// ── Consolidação assistida (tela /clientes/migrar) ──────────────────────────
// Antes da Etapa 1 o app criava um cliente novo a cada visita, com o nome do
// síndico e sem endereço. Aqui as visitas são agrupadas pelo local para o
// gestor revisar e consolidar um cliente por prédio.

const normalizar = (s: string | null) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Chave de agrupamento: nome do prédio E endereço, quando os dois existem.
 * O endereço entra de propósito — nomes como "Edifício Central" ou
 * "Residencial Bela Vista" se repetem em endereços diferentes, e fundir dois
 * condomínios distintos num cliente só não tem desfazer pela interface.
 * Separar demais é recuperável (consolida de novo); fundir não é.
 */
export function chaveLocal(nomePredio: string | null, endereco: string | null): string {
  const n = normalizar(nomePredio);
  const e = normalizar(endereco);
  return n && e ? `${n}|${e}` : n || e;
}

export interface GrupoConsolidacao {
  chave: string;
  /** Nome proposto para o cliente (do prédio, ou do endereço). */
  nome: string;
  endereco: string | null;
  complemento: string | null;
  tipoLocal: string | null;
  latitude: number | null;
  longitude: number | null;
  nomeSindico: string | null;
  telefoneSindico: string | null;
  emailSindico: string | null;
  nomeZelador: string | null;
  telefoneZelador: string | null;
  emailZelador: string | null;
  fotoFachadaUrl: string | null;
  /** Situação sugerida: ativo quando o grupo tem visita aprovada. */
  situacaoSugerida: SituacaoCliente;
  visitaIds: string[];
  /** Clientes já referenciados pelas visitas do grupo (candidatos a fundir). */
  clienteIds: string[];
  /** true quando o grupo já aponta para um único cliente com endereço. */
  jaConsolidado: boolean;
}

export function useGruposConsolidacao() {
  return useQuery({
    queryKey: ["clientes-consolidacao"],
    queryFn: async (): Promise<GrupoConsolidacao[]> => {
      const [{ data: visitasRaw, error: errV }, { data: clientesRaw, error: errC }] = await Promise.all([
        supabase
          .from("visitas_tecnicas")
          .select(
            "id, cliente_id, status, created_at, nome_predio, titulo, tipo_local, endereco, complemento, " +
              "latitude, longitude, nome_sindico, telefone_sindico, email_sindico, nome_zelador, " +
              "telefone_zelador, email_zelador, foto_fachada_url",
          )
          .order("created_at", { ascending: false }),
        supabase.from("clientes").select("id, endereco"),
      ]);
      if (errV) throw errV;
      if (errC) throw errC;

      const comEndereco = new Set(
        ((clientesRaw as any[]) ?? []).filter((c) => !!c.endereco).map((c) => c.id as string),
      );
      const visitas = ((visitasRaw as any[]) ?? []).filter(
        (v) => chaveLocal(v.nome_predio ?? v.titulo, v.endereco) !== "",
      );

      const mapa = new Map<string, GrupoConsolidacao>();
      for (const v of visitas) {
        const chave = chaveLocal(v.nome_predio ?? v.titulo, v.endereco);
        // as visitas vêm da mais recente para a mais antiga: a primeira do
        // grupo é a fonte dos dados propostos
        let g = mapa.get(chave);
        if (!g) {
          g = {
            chave,
            nome: (v.nome_predio ?? v.titulo ?? v.endereco ?? "").trim(),
            endereco: v.endereco ?? null,
            complemento: v.complemento ?? null,
            tipoLocal: v.tipo_local ?? null,
            latitude: v.latitude ?? null,
            longitude: v.longitude ?? null,
            nomeSindico: v.nome_sindico ?? null,
            telefoneSindico: v.telefone_sindico ?? null,
            emailSindico: v.email_sindico ?? null,
            nomeZelador: v.nome_zelador ?? null,
            telefoneZelador: v.telefone_zelador ?? null,
            emailZelador: v.email_zelador ?? null,
            fotoFachadaUrl: v.foto_fachada_url ?? null,
            situacaoSugerida: "prospecto",
            visitaIds: [],
            clienteIds: [],
            jaConsolidado: false,
          };
          mapa.set(chave, g);
        }
        g.visitaIds.push(v.id as string);
        if (v.cliente_id && !g.clienteIds.includes(v.cliente_id)) g.clienteIds.push(v.cliente_id);
        if (String(v.status ?? "").toLowerCase() === "aprovada") g.situacaoSugerida = "ativo";
        // completa lacunas com dados de visitas mais antigas
        g.endereco ??= v.endereco ?? null;
        g.complemento ??= v.complemento ?? null;
        g.tipoLocal ??= v.tipo_local ?? null;
        g.latitude ??= v.latitude ?? null;
        g.longitude ??= v.longitude ?? null;
        g.nomeSindico ??= v.nome_sindico ?? null;
        g.telefoneSindico ??= v.telefone_sindico ?? null;
        g.emailSindico ??= v.email_sindico ?? null;
        g.nomeZelador ??= v.nome_zelador ?? null;
        g.telefoneZelador ??= v.telefone_zelador ?? null;
        g.emailZelador ??= v.email_zelador ?? null;
        g.fotoFachadaUrl ??= v.foto_fachada_url ?? null;
      }

      const grupos = Array.from(mapa.values());
      for (const g of grupos) {
        g.jaConsolidado = g.clienteIds.length === 1 && comEndereco.has(g.clienteIds[0]);
      }
      // pendentes primeiro, depois por nome
      return grupos.sort((a, b) =>
        a.jaConsolidado === b.jaConsolidado
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : a.jaConsolidado
            ? 1
            : -1,
      );
    },
  });
}

/**
 * Consolida um grupo num único cliente: reaproveita um dos cadastros já
 * referenciados pelas visitas do grupo (ou cria um novo), grava nele os dados
 * propostos, aponta todas as visitas do grupo para ele e descarta os cadastros
 * que ficaram sem nenhuma visita.
 *
 * Só serve de destino um cadastro cujas visitas estejam TODAS neste grupo: um
 * cliente compartilhado por dois grupos seria renomeado a cada consolidação,
 * levando as visitas do outro grupo com ele.
 */
export async function consolidarGrupo(g: GrupoConsolidacao): Promise<string> {
  const patch: ClientePatch = {
    nome: g.nome,
    nome_predio: g.nome,
    tipo_local: g.tipoLocal,
    endereco: g.endereco,
    complemento: g.complemento,
    latitude: g.latitude,
    longitude: g.longitude,
    nome_sindico: g.nomeSindico,
    telefone_sindico: g.telefoneSindico,
    email_sindico: g.emailSindico,
    nome_zelador: g.nomeZelador,
    telefone_zelador: g.telefoneZelador,
    email_zelador: g.emailZelador,
    foto_fachada_url: g.fotoFachadaUrl,
    situacao: g.situacaoSugerida,
  };

  // 1) destino: um cadastro do grupo que não seja compartilhado com outro
  //    grupo. Sem candidato limpo, cria um novo em vez de sequestrar o alheio.
  let destinoId: string | null = null;
  if (g.clienteIds.length > 0) {
    const { data: refs, error: errRefs } = await supabase
      .from("visitas_tecnicas")
      .select("id, cliente_id")
      .in("cliente_id", g.clienteIds);
    if (errRefs) throw errRefs;
    const doGrupo = new Set(g.visitaIds);
    const compartilhados = new Set(
      ((refs as any[]) ?? [])
        .filter((r) => !doGrupo.has(r.id as string))
        .map((r) => r.cliente_id as string),
    );
    destinoId = g.clienteIds.find((id) => !compartilhados.has(id)) ?? null;
  }
  if (destinoId) {
    await atualizarCliente(destinoId, patch);
  } else {
    destinoId = await criarCliente(patch);
  }

  // 2) todas as visitas do grupo passam a apontar para ele
  const { error: errV } = await supabase
    .from("visitas_tecnicas")
    .update({ cliente_id: destinoId } as any)
    .in("id", g.visitaIds);
  if (errV) throw errV;

  // 3) cadastros duplicados que ficaram sem nenhuma visita são descartados
  const sobrando = g.clienteIds.filter((id) => id !== destinoId);
  for (const id of sobrando) {
    const { count } = await supabase
      .from("visitas_tecnicas")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", id);
    if ((count ?? 0) === 0) {
      // erro aqui não é silenciável: a RLS filtra o DELETE sem reclamar e os
      // duplicados ficariam para sempre no aviso da lista de clientes
      const { error: errDel } = await supabase.from("clientes").delete().eq("id", id);
      if (errDel) throw errDel;
    }
  }
  return destinoId;
}

/** Cadastros vazios: sem endereço e sem nenhuma visita — só descartar. */
export function useClientesOrfaos() {
  return useQuery({
    queryKey: ["clientes-orfaos"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const [{ data: cli, error: errC }, { data: vis, error: errV }] = await Promise.all([
        supabase.from("clientes").select("id, nome, endereco"),
        supabase.from("visitas_tecnicas").select("cliente_id").not("cliente_id", "is", null),
      ]);
      if (errC) throw errC;
      if (errV) throw errV;
      const usados = new Set(((vis as any[]) ?? []).map((v) => v.cliente_id as string));
      return ((cli as any[]) ?? [])
        .filter((c) => !c.endereco && !usados.has(c.id))
        .map((c) => ({ id: c.id as string, nome: c.nome as string }));
    },
  });
}

export async function descartarCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

/** Procura um cadastro com o mesmo nome/endereço — evita duplicar na criação. */
export function acharClienteEquivalente(
  clientes: Cliente[],
  nome: string,
  endereco: string,
): Cliente | null {
  const alvo = chaveLocal(nome, endereco);
  if (!alvo) return null;
  return clientes.find((c) => chaveLocal(c.nome_predio || c.nome, c.endereco) === alvo) ?? null;
}
