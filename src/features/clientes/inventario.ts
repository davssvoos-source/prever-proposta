// Inventário do cliente (as-built) — Etapa 2 do sistema de OS.
// Sistemas instalados por cliente e os equipamentos de cada um, derivados do
// escopo aprovado de uma visita ou registrados em campo pelos técnicos.
// Ver docs/SISTEMA_OS.md §4.2.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isServicoCode } from "@/features/orcamento/blockAutoItems";

export type TipoSistema = "PED" | "VEI" | "CFTV" | "AL" | "CER" | "CENT" | "ELV" | "TOT" | "OUTRO";
export type EstadoEquipamento = "ativo" | "substituido" | "removido";
export type OrigemEquipamento = "implantacao" | "campo" | "manual";

/** Nomes dos tipos de sistema — mesma taxonomia dos blocos do orçamento. */
export const TIPO_SISTEMA_LABEL: Record<TipoSistema, string> = {
  PED: "Eclusa de Pedestres",
  VEI: "Eclusa Veicular",
  CFTV: "CFTV",
  AL: "Alarme",
  CER: "Cerca Elétrica",
  CENT: "Central de Portaria Remota",
  ELV: "Elevadores",
  TOT: "Totem de Monitoramento",
  OUTRO: "Outro sistema",
};

export const TIPOS_SISTEMA = Object.keys(TIPO_SISTEMA_LABEL) as TipoSistema[];

export const ESTADO_LABEL: Record<EstadoEquipamento, string> = {
  ativo: "Ativo",
  substituido: "Substituído",
  removido: "Removido",
};

export const ESTADO_CORES: Record<EstadoEquipamento, { dark: string; light: string; bg: string; border: string }> = {
  ativo:       { dark: "#34D399", light: "#047857", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.30)" },
  substituido: { dark: "#60A5FA", light: "#1d4ed8", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.30)" },
  removido:    { dark: "#9ca3af", light: "#6b7280", bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.25)" },
};

export const ORIGEM_LABEL: Record<OrigemEquipamento, string> = {
  implantacao: "Implantação",
  campo: "Registrado em campo",
  manual: "Cadastro manual",
};

export interface EquipamentoInstalado {
  id: string;
  cliente_sistema_id: string;
  equipamento_id: string | null;
  cod_eq: string | null;
  nome_snapshot: string | null;
  qtd: number;
  estado: EstadoEquipamento;
  origem: OrigemEquipamento;
  instalado_em: string | null;
  observacao: string | null;
  /** Dados vivos do catálogo (join) — podem divergir do snapshot. */
  equipamento?: { nome: string; marca: string | null; modelo: string | null } | null;
}

export interface SistemaInstalado {
  id: string;
  cliente_id: string;
  tipo: TipoSistema;
  nome: string;
  descricao: string | null;
  origem_visita_bloco_id: string | null;
  ativo: boolean;
  ordem: number | null;
  equipamentos: EquipamentoInstalado[];
}

/** Sistemas do cliente com seus equipamentos. */
export function useInventario(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-inventario", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<SistemaInstalado[]> => {
      const { data: sistemas, error: errS } = await supabase
        .from("cliente_sistemas" as any)
        .select("id, cliente_id, tipo, nome, descricao, origem_visita_bloco_id, ativo, ordem")
        .eq("cliente_id", clienteId as string)
        .order("ordem", { ascending: true, nullsFirst: false })
        .order("nome");
      if (errS) throw errS;
      const lista = ((sistemas as any[]) ?? []) as SistemaInstalado[];
      if (lista.length === 0) return [];

      const { data: itens, error: errI } = await supabase
        .from("cliente_equipamentos" as any)
        .select(
          "id, cliente_sistema_id, equipamento_id, cod_eq, nome_snapshot, qtd, estado, origem, " +
            "instalado_em, observacao, equipamento:equipamentos(nome, marca, modelo)",
        )
        .in("cliente_sistema_id", lista.map((s) => s.id));
      if (errI) throw errI;

      const porSistema = new Map<string, EquipamentoInstalado[]>();
      for (const it of ((itens as any[]) ?? []) as EquipamentoInstalado[]) {
        const arr = porSistema.get(it.cliente_sistema_id) ?? [];
        arr.push(it);
        porSistema.set(it.cliente_sistema_id, arr);
      }
      for (const s of lista) {
        s.equipamentos = (porSistema.get(s.id) ?? []).sort((a, b) =>
          nomeEquipamento(a).localeCompare(nomeEquipamento(b), "pt-BR"),
        );
      }
      return lista;
    },
  });
}

/** Nome de exibição: catálogo vivo quando existe, senão o snapshot. */
export function nomeEquipamento(e: EquipamentoInstalado): string {
  return e.equipamento?.nome ?? e.nome_snapshot ?? e.cod_eq ?? "Equipamento";
}

// ── Escrita ────────────────────────────────────────────────────────────────

export async function criarSistema(input: {
  cliente_id: string;
  tipo: TipoSistema;
  nome: string;
  descricao?: string | null;
}): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("cliente_sistemas" as any)
    .insert({ ...input, created_by: u.user?.id ?? null } as any)
    .select("id")
    .single();
  if (error) throw error;
  return (data as any).id as string;
}

export async function atualizarSistema(
  id: string,
  patch: { tipo?: TipoSistema; nome?: string; descricao?: string | null; ativo?: boolean },
): Promise<void> {
  const { error } = await supabase.from("cliente_sistemas" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function excluirSistema(id: string): Promise<void> {
  const { error } = await supabase.from("cliente_sistemas" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function criarEquipamentoInstalado(input: {
  cliente_sistema_id: string;
  equipamento_id?: string | null;
  cod_eq?: string | null;
  nome_snapshot?: string | null;
  qtd: number;
  estado?: EstadoEquipamento;
  origem?: OrigemEquipamento;
  instalado_em?: string | null;
  observacao?: string | null;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("cliente_equipamentos" as any)
    .insert({ ...input, created_by: u.user?.id ?? null } as any);
  if (error) throw error;
}

export async function atualizarEquipamentoInstalado(
  id: string,
  patch: { qtd?: number; estado?: EstadoEquipamento; observacao?: string | null; instalado_em?: string | null },
): Promise<void> {
  const { error } = await supabase.from("cliente_equipamentos" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function excluirEquipamentoInstalado(id: string): Promise<void> {
  const { error } = await supabase.from("cliente_equipamentos" as any).delete().eq("id", id);
  if (error) throw error;
}

// ── Catálogo (para adicionar equipamento manualmente) ──────────────────────

export interface ItemCatalogo {
  id: string;
  code: string | null;
  nome: string;
  marca: string | null;
  modelo: string | null;
}

export function useCatalogoEquipamentos(termo: string) {
  const busca = termo.trim();
  return useQuery({
    queryKey: ["catalogo-equipamentos", busca],
    enabled: busca.length >= 2,
    queryFn: async (): Promise<ItemCatalogo[]> => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("id, code, nome, marca, modelo")
        .or(`nome.ilike.%${busca}%,code.ilike.%${busca}%,modelo.ilike.%${busca}%`)
        .order("nome")
        .limit(20);
      if (error) throw error;
      return ((data as any[]) ?? []) as ItemCatalogo[];
    },
  });
}

// ── Derivação do escopo aprovado ───────────────────────────────────────────

export interface VisitaComEscopo {
  id: string;
  status: string | null;
  data: string | null;
  nome: string;
  qtdBlocos: number;
  /** Blocos desta visita que ainda não foram importados para o inventário. */
  qtdBlocosNovos: number;
}

const TIPOS_UNICOS = new Set(["CENT"]);

/** Nome do bloco na convenção do app: nome dado pelo técnico ou tipo + contador. */
function nomearBlocos(blocos: { tipo_bloco: string; nome_acesso: string | null }[]): string[] {
  const contador: Record<string, number> = {};
  return blocos.map((b) => {
    const tipo = b.tipo_bloco;
    contador[tipo] = (contador[tipo] || 0) + 1;
    const base = TIPO_SISTEMA_LABEL[(tipo as TipoSistema)] ?? tipo;
    const dado = b.nome_acesso?.trim();
    if (dado) return dado;
    return TIPOS_UNICOS.has(tipo) ? base : `${base} ${String(contador[tipo]).padStart(2, "0")}`;
  });
}

/** Visitas aprovadas do cliente que têm escopo para virar inventário. */
export function useVisitasComEscopo(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-visitas-escopo", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<VisitaComEscopo[]> => {
      const { data: visitas, error: errV } = await supabase
        .from("visitas_tecnicas")
        .select("id, status, data_hora_agendada, created_at, titulo, nome_predio")
        .eq("cliente_id", clienteId as string)
        .order("created_at", { ascending: false });
      if (errV) throw errV;
      const lista = ((visitas as any[]) ?? []).filter(
        (v) => String(v.status ?? "").toLowerCase() === "aprovada",
      );
      if (lista.length === 0) return [];

      const { data: blocos, error: errB } = await supabase
        .from("visita_blocos" as any)
        .select("id, visita_id")
        .in("visita_id", lista.map((v) => v.id));
      if (errB) throw errB;

      const todosBlocos = ((blocos as any[]) ?? []);
      const { data: jaImportados, error: errS } = todosBlocos.length
        ? await supabase
            .from("cliente_sistemas" as any)
            .select("origem_visita_bloco_id")
            .in("origem_visita_bloco_id", todosBlocos.map((b) => b.id))
        : { data: [] as any[], error: null };
      if (errS) throw errS;
      const importados = new Set(
        ((jaImportados as any[]) ?? []).map((s) => s.origem_visita_bloco_id as string),
      );

      return lista.map((v) => {
        const meus = todosBlocos.filter((b) => b.visita_id === v.id);
        return {
          id: v.id as string,
          status: v.status ?? null,
          data: (v.data_hora_agendada ?? v.created_at) as string | null,
          nome: (v.nome_predio ?? v.titulo ?? "Visita") as string,
          qtdBlocos: meus.length,
          qtdBlocosNovos: meus.filter((b) => !importados.has(b.id as string)).length,
        };
      });
    },
  });
}

/**
 * Cria o inventário do cliente a partir do escopo de uma visita aprovada:
 * cada bloco vira um sistema instalado e cada item de equipamento (não
 * removido e não serviço SV*) vira um equipamento instalado, com origem
 * "implantacao". Blocos já importados são ignorados — o índice único em
 * origem_visita_bloco_id garante isso mesmo em corrida.
 *
 * Retorna quantos sistemas e equipamentos foram criados.
 */
export async function derivarInventarioDaVisita(
  clienteId: string,
  visitaId: string,
): Promise<{ sistemas: number; equipamentos: number }> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id ?? null;

  const { data: blocosRaw, error: errB } = await supabase
    .from("visita_blocos" as any)
    .select("id, tipo_bloco, nome_acesso, nome_descritivo, codigo_bloco, ordem")
    .eq("visita_id", visitaId)
    .order("ordem");
  if (errB) throw errB;
  const blocos = ((blocosRaw as any[]) ?? []);
  if (blocos.length === 0) return { sistemas: 0, equipamentos: 0 };

  // blocos já importados não entram de novo
  const { data: jaRaw, error: errJa } = await supabase
    .from("cliente_sistemas" as any)
    .select("origem_visita_bloco_id")
    .in("origem_visita_bloco_id", blocos.map((b) => b.id));
  if (errJa) throw errJa;
  const importados = new Set(((jaRaw as any[]) ?? []).map((s) => s.origem_visita_bloco_id as string));

  // nomes seguem a convenção do app, calculada sobre TODOS os blocos da visita
  // (para o contador 01/02 continuar coerente mesmo importando parcialmente)
  const nomes = nomearBlocos(blocos);

  const { data: itensRaw, error: errI } = await supabase
    .from("visita_bloco_itens" as any)
    .select("visita_bloco_id, cod_eq, qtd, removido, observacao")
    .in("visita_bloco_id", blocos.map((b) => b.id));
  if (errI) throw errI;
  const itens = ((itensRaw as any[]) ?? []).filter(
    (i) => !i.removido && !isServicoCode(String(i.cod_eq ?? "")),
  );

  // catálogo: FK + snapshot de nome
  const codigos = Array.from(new Set(itens.map((i) => String(i.cod_eq))));
  const catalogo: Record<string, { id: string; nome: string }> = {};
  if (codigos.length > 0) {
    const { data: eqRaw, error: errE } = await supabase
      .from("equipamentos")
      .select("id, code, nome")
      .in("code", codigos);
    if (errE) throw errE;
    for (const e of ((eqRaw as any[]) ?? [])) {
      catalogo[e.code as string] = { id: e.id as string, nome: e.nome as string };
    }
  }

  let nSistemas = 0;
  let nEquipamentos = 0;

  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    if (importados.has(b.id as string)) continue;

    const tipo = (TIPOS_SISTEMA as string[]).includes(b.tipo_bloco) ? (b.tipo_bloco as TipoSistema) : "OUTRO";
    const { data: sistemaRow, error: errS } = await supabase
      .from("cliente_sistemas" as any)
      .insert({
        cliente_id: clienteId,
        tipo,
        nome: nomes[i],
        descricao: (b.nome_descritivo as string | null) || (b.codigo_bloco as string | null),
        origem_visita_bloco_id: b.id,
        ordem: b.ordem ?? i,
        created_by: userId,
      } as any)
      .select("id")
      .single();
    if (errS) throw errS;
    nSistemas++;

    const doBloco = itens.filter((it) => it.visita_bloco_id === b.id);
    if (doBloco.length === 0) continue;

    const linhas = doBloco.map((it) => {
      const cod = String(it.cod_eq);
      return {
        cliente_sistema_id: (sistemaRow as any).id as string,
        equipamento_id: catalogo[cod]?.id ?? null,
        cod_eq: cod,
        nome_snapshot: catalogo[cod]?.nome ?? cod,
        qtd: Number(it.qtd || 0),
        estado: "ativo",
        origem: "implantacao",
        observacao: (it.observacao as string | null) ?? null,
        created_by: userId,
      };
    });
    const { error: errIns } = await supabase.from("cliente_equipamentos" as any).insert(linhas as any);
    if (errIns) throw errIns;
    nEquipamentos += linhas.length;
  }

  return { sistemas: nSistemas, equipamentos: nEquipamentos };
}
