// Cadastro de clientes (registro mestre) — Etapa 1 do sistema de OS.
// A tabela `clientes` deixou de ser uma linha descartável por visita e passou a
// ser o registro corporativo: endereço, contatos, situação do contrato e a
// origem dos dados que antes viviam embutidos em cada visita_tecnica.
// Ver docs/SISTEMA_OS.md §4.1.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { somenteDigitos } from "@/lib/normalizar";
import { PRISMA } from "@/lib/paleta";

// R21/R22 (2026-08-21): 'prospecto' saiu. Prédio orçado que não fechou não é
// cliente — vive em `prospeccoes` (migration U27). Cliente vem do QAP, e o QAP
// só tem cliente de verdade.
export type SituacaoCliente = "ativo" | "inativo";

export const SITUACAO_LABEL: Record<SituacaoCliente, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

/**
 * Cores por situação — do PRISMA (v7): ativo é o amarelo principal (cliente é
 * o que a casa mais valoriza), prospecto é o azul de "ainda vem", inativo é
 * neutro. O verde-menta antigo era de fora da paleta.
 */
export const SITUACAO_CORES: Record<SituacaoCliente, { dark: string; light: string; bg: string; border: string }> = {
  ativo:   PRISMA.amarelo,
  inativo: PRISMA.neutro,
};

/**
 * O que a Prever presta em cada cliente (R41, U36).
 *
 * É um CONJUNTO, não uma escolha: o mesmo condomínio pode ter portaria remota
 * e monitoramento de alarmes. Guardar um só forçaria uma escolha falsa no
 * cadastro e faria o cliente sumir do filtro do outro serviço.
 */
export type ServicoCliente = "portaria_remota" | "monitoramento_alarmes";

export const SERVICO_ORDEM: ServicoCliente[] = ["portaria_remota", "monitoramento_alarmes"];

export const SERVICO_LABEL: Record<ServicoCliente, string> = {
  portaria_remota: "Portaria Remota",
  monitoramento_alarmes: "Monitoramento de Alarmes",
};

/** Cores do PRISMA — dois serviços, dois tons distinguíveis no claro e no escuro. */
export const SERVICO_CORES: Record<ServicoCliente, { dark: string; light: string; bg: string; border: string }> = {
  portaria_remota: PRISMA.azulClaro,
  monitoramento_alarmes: PRISMA.laranja,
};

/** true quando o cliente presta aquele serviço. Tolera a coluna ausente. */
export function temServico(c: { servicos_prestados?: string[] | null }, s: ServicoCliente): boolean {
  return (c.servicos_prestados ?? []).includes(s);
}

export interface Cliente {
  id: string;
  nome: string;
  nome_predio: string | null;
  /** U36: conjunto de serviços prestados. Vazio = nenhum registrado ainda. */
  servicos_prestados: string[] | null;
  tipo_local: string | null;
  tipo_empreendimento: string | null;
  /** CNPJ/CPF — chave do financeiro e do de-para com o QAP (Etapa U0). */
  documento: string | null;
  responsavel_financeiro: string | null;
  email_financeiro: string | null;
  /** Id do cliente no QAP ERP, quando conciliado. */
  qap_cliente_id: string | null;
  endereco: string | null;
  complemento: string | null;
  /** U24 — vindos da planilha oficial de clientes. */
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  posto_servico: string | null;
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
  "id, nome, nome_predio, tipo_local, tipo_empreendimento, endereco, complemento, cep, cidade, uf, posto_servico, latitude, longitude, " +
  "email, telefone, nome_sindico, telefone_sindico, email_sindico, nome_zelador, telefone_zelador, " +
  "email_zelador, foto_fachada_url, qtd_apartamentos, qtd_acessos, observacoes, situacao, created_at, " +
  "documento, responsavel_financeiro, email_financeiro, qap_cliente_id, servicos_prestados";

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
  /** Situação sugerida: ativo só com proposta ACEITA pelo cliente (R4). */
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
            "id, cliente_id, status, proposta_resultado, created_at, nome_predio, titulo, tipo_local, endereco, complemento, " +
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
        // R4: aprovar a visita é decisão nossa; quem faz do prospecto um
        // cliente é o aceite DELE. Antes daqui saía "ativo" cedo demais.
        if (String(v.proposta_resultado ?? "") === "aceita") g.situacaoSugerida = "ativo";
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
  // O que vem da VISITA só preenche o que está vazio no destino. Antes da U24
  // isso era indiferente (o cadastro era a própria visita); agora o destino
  // pode ser um cliente da planilha OFICIAL, com endereço conferido e
  // coordenada geocodificada — e uma consolidação sobrescrevia tudo com o
  // dado solto da visita, em silêncio.
  const preservar = <T,>(oficial: T | null | undefined, daVisita: T | null): T | null =>
    oficial ?? daVisita;

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
    // o destino pode ser um cliente da planilha oficial (U24): endereço
    // conferido, coordenada geocodificada, documento. O dado da visita só
    // entra onde o oficial está vazio — consolidar não pode degradar cadastro.
    const { data: atual } = await supabase
      .from("clientes")
      .select("endereco, complemento, latitude, longitude, tipo_local, nome_predio")
      .eq("id", destinoId)
      .maybeSingle();
    const o = (atual as any) ?? {};
    await atualizarCliente(destinoId, {
      ...patch,
      nome_predio:  preservar(o.nome_predio, patch.nome_predio ?? null),
      tipo_local:   preservar(o.tipo_local, patch.tipo_local ?? null),
      endereco:     preservar(o.endereco, patch.endereco ?? null),
      complemento:  preservar(o.complemento, patch.complemento ?? null),
      latitude:     preservar(o.latitude, patch.latitude ?? null),
      longitude:    preservar(o.longitude, patch.longitude ?? null),
    });
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

/**
 * Procura um cadastro pelo documento (CNPJ/CPF), ignorando máscara.
 * O banco tem índice único parcial sobre somente_digitos(documento): sem esta
 * checagem, o formulário só descobriria o duplicado ao levar erro de constraint
 * na hora de salvar. Reconciliação com o QAP (§8) usa a mesma chave.
 */
export function acharClientePorDocumento(clientes: Cliente[], documento: string): Cliente | null {
  const alvo = somenteDigitos(documento);
  if (!alvo) return null;
  return clientes.find((c) => somenteDigitos(c.documento) === alvo) ?? null;
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
