import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CARGOS_DE_CAMPO, ordenarResponsaveis } from "@/features/gerencial/tecnicos";
import { geocodificarEndereco, type RespostaDaGeocodificacao } from "@/lib/geocodificar.functions";

/**
 * A ÚNICA GEOCODIFICAÇÃO DO SISTEMA — U84.
 *
 * Ela era uma das QUATRO: esta, mais três cópias inline (NovaVisitaDialog,
 * gerencial.nova, visita.$id). As três foram apagadas; esta virou uma casca
 * fina sobre `geocodificarEndereco` (src/lib/geocodificar.functions.ts), que
 * roda no SERVIDOR.
 *
 * POR QUE SAIU DO NAVEGADOR: a política do Nominatim pede User-Agent
 * identificável, e o navegador não deixa um `fetch` definir esse cabeçalho —
 * ele é proibido pela especificação. Enquanto a chamada morasse aqui, cumprir a
 * política era literalmente impossível, e o repositório estava em violação
 * havia meses, de quatro lugares ao mesmo tempo. Do lado do servidor o
 * cabeçalho vale, e o ritmo mínimo entre chamadas tem onde morar.
 *
 * O RETORNO TRAZ O MOTIVO (P43, U140). Era `{ lat, lng } | null`, e aquele
 * `null` colapsava "o serviço respondeu e não achou" com "não consegui
 * perguntar" e com "o serviço me recusou". As quatro telas diziam a mesma
 * frase nos três casos — e a frase tinha de hesitar nos três, porque uma
 * dela que afirmasse "o endereço não existe" durante um bloqueio seria a
 * única do sistema a instruir a pessoa a MARTELAR o serviço que acabou de
 * recusá-la (o bloqueio do Nominatim é por IP e cai sobre a operação
 * inteira). Agora o motivo chega, e cada caso tem uma frase que diz uma
 * coisa só — ver `avisoDoEndereco`, em lib/endereco.ts.
 *
 * O sucesso é um SUPERCONJUNTO: traz também o bairro/cidade/UF que o mapa
 * devolveu, para quem quiser CONFERIR o que foi achado em vez de confiar. As
 * QUATRO telas que chamam isto imprimem esses campos, e há censo de árvore
 * sobre as quatro.
 *
 * O RETORNO É O TIPO EXPORTADO PELO SERVIDOR, e não uma cópia da forma escrita
 * à mão aqui. Duas declarações da mesma forma divergem em silêncio: acrescentar
 * um campo no servidor deixaria esta assinatura mentindo, e o `tsc` não diria
 * nada porque as duas continuariam compatíveis.
 */
export async function geocode(endereco: string): Promise<RespostaDaGeocodificacao> {
  try {
    return await geocodificarEndereco({ data: { q: endereco } });
  } catch {
    // A função de servidor pode não estar publicada (janela de deploy) ou a
    // rede pode ter caído. Nos dois casos não foi possível PERGUNTAR, que é
    // exatamente `servico_falhou` — e não "o endereço não existe".
    return { ok: false, motivo: "servico_falhou" };
  }
}

/** Perfis atribuíveis como técnico responsável — só quem tem cargo de técnico. */
/**
 * Quem pode ser responsável por trabalho técnico (R241): o técnico e o ADMIN.
 * A lista é UMA — a visita, o chamado de campo, a grade da programação, o
 * painel Operacional e as duplas bebem dela. Ver features/gerencial/tecnicos.ts.
 */
export async function fetchTecnicos() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, cargo, avatar_url, telefone, ativo")
    .eq("ativo", true)
    .in("cargo", CARGOS_DE_CAMPO as unknown as string[])
    .order("nome");
  if (error) throw error;
  return ordenarResponsaveis(data ?? []);
}
export type Tecnico = Awaited<ReturnType<typeof fetchTecnicos>>[number];

export async function fetchVisitasGerencial() {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .select("*, cliente:clientes(id, nome, tipo_empreendimento, telefone)")
    .order("data_hora_agendada", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export type Visita = Awaited<ReturnType<typeof fetchVisitasGerencial>>[number];

export function useTecnicos() {
  return useQuery({ queryKey: ["tecnicos-ativos"], queryFn: fetchTecnicos });
}

export function useVisitasGerencial() {
  return useQuery({ queryKey: ["visitas-gerencial"], queryFn: fetchVisitasGerencial });
}

/** Gestor OPERACIONAL: admin, comercial e SAC (PRODUTO.md R1/R13). */
export function useIsGerente() {
  return useQuery({
    queryKey: ["is-gerente"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("cargo").eq("id", u.user.id).maybeSingle(),
      ]);
      // R304: o GESTOR é gestor — espelho do is_gestor() do banco (U154).
      const gestores = ["admin", "comercial", "sac", "gestor"];
      const roleStrs = (roles ?? []).map((r) => r.role as string);
      if (roleStrs.some((r) => gestores.includes(r))) return true;
      return gestores.includes(profile?.cargo ?? "");
    },
    staleTime: 60_000,
  });
}

/**
 * Quem enxerga VALORES (contratos, cobranças, fechamentos): admin e comercial.
 * O SAC é gestor mas não vê dinheiro — espelho do pode_ver_financeiro() do
 * banco (U6a). A RLS já bloqueia os dados; este hook esconde a interface.
 */
export async function consultarVeFinanceiro(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    supabase.from("profiles").select("cargo").eq("id", u.user.id).maybeSingle(),
  ]);
  // R304: o GESTOR vê valores — é ele quem lança a cobrança do chamado
  // (R125/R300). Espelho do pode_ver_financeiro() do banco (U154).
  const financeiro = ["admin", "comercial", "gestor"];
  const roleStrs = (roles ?? []).map((r) => r.role as string);
  if (roleStrs.some((r) => financeiro.includes(r))) return true;
  return financeiro.includes(profile?.cargo ?? "");
}

/**
 * O mesmo recorte como hook. A função solta acima existe para o `beforeLoad`
 * das rotas que mostram dinheiro (R164: /visita/$id/pagamento) — `beforeLoad`
 * roda fora do React, e a guarda de valores tinha de ser a MESMA pergunta que a
 * interface faz, não uma lista de cargos copiada.
 */
export function useVeFinanceiro() {
  return useQuery({
    queryKey: ["ve-financeiro"],
    queryFn: consultarVeFinanceiro,
    staleTime: 60_000,
  });
}

/**
 * Perfil de interface: "admin" (admin/comercial — telas de gestão completas),
 * "sac" (gestor de chamados, sem gerencial/financeiro) ou "tecnico" (3 abas).
 */
export function useUserCargo() {
  return useQuery({
    queryKey: ["user-cargo"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return "tecnico" as const;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("cargo").eq("id", u.user.id).maybeSingle(),
      ]);
      const roleStrs = (roles ?? []).map((r) => r.role as string);
      const c = profile?.cargo ?? "";
      if (roleStrs.includes("admin") || roleStrs.includes("comercial")) return "admin" as const;
      if (c === "admin" || c === "comercial") return "admin" as const;
      // R304: o GESTOR recebe a INTERFACE do admin (barra completa, painéis) —
      // o que ele não abre, a matriz de permissões fecha por cima. Não é
      // admin no BANCO: convidar, aprovar e alterar permissões continuam
      // exigindo cargo = 'admin' lá.
      if (roleStrs.includes("gestor") || c === "gestor") return "admin" as const;
      if (roleStrs.includes("sac") || c === "sac") return "sac" as const;
      // R244/R263 (U132): o OPERACIONAL tem barra própria (Início, Calendário,
      // Clientes, Perfil) e NÃO é técnico. Este balde devolvia "tecnico" para
      // ele — o Nicholas e o Erik viam a barra de TRÊS itens do técnico desde a
      // R244, sem Clientes, e na U132 ganhariam o interruptor do técnico na
      // Agenda. A Início já distinguia (useSessao); aqui faltava.
      if (c === "operacional") return "operacional" as const;
      return "tecnico" as const;
    },
    staleTime: 60_000,
  });
}
