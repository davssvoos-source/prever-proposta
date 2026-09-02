import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { geocodificarEndereco, type EnderecoResolvido } from "@/lib/geocodificar.functions";

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
 * O CONTRATO DE QUEM CHAMA NÃO MUDOU: `{ lat, lng } | null`, com o `null`
 * significando "não achei ou não deu". O retorno é um SUPERCONJUNTO — traz
 * também o bairro/cidade/UF que o mapa devolveu, para quem quiser CONFERIR o
 * que foi achado em vez de confiar. As QUATRO telas que chamam isto imprimem
 * esses campos, e há censo de árvore sobre as quatro.
 *
 * O QUE ELA AINDA APAGA, E ESTÁ DECLARADO EM P43: o servidor distingue
 * `nao_encontrado` de `servico_falhou`, e este `null` colapsa os dois. Enquanto
 * colapsar, nenhuma das quatro telas pode afirmar que o endereço não existe —
 * o bloqueio do Nominatim é por IP e cai sobre a operação inteira.
 *
 * O RETORNO É O TIPO EXPORTADO PELO SERVIDOR, e não uma cópia da forma escrita
 * à mão aqui. Duas declarações da mesma forma divergem em silêncio: acrescentar
 * um campo no servidor deixaria esta assinatura mentindo, e o `tsc` não diria
 * nada porque as duas continuariam compatíveis.
 */
export async function geocode(endereco: string): Promise<EnderecoResolvido | null> {
  try {
    const r = await geocodificarEndereco({ data: { q: endereco } });
    return r.ok ? r.endereco : null;
  } catch {
    // A função de servidor pode não estar publicada (janela de deploy) ou a
    // rede pode ter caído. Nos dois casos o resultado é o mesmo que já era:
    // não há coordenada, e quem chamou já sabe tratar `null`.
    return null;
  }
}

/** Perfis atribuíveis como técnico responsável — só quem tem cargo de técnico. */
export async function fetchTecnicos() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, cargo, avatar_url, telefone, ativo")
    .eq("ativo", true)
    .eq("cargo", "tecnico")
    .order("nome");
  if (error) throw error;
  return data ?? [];
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
      const gestores = ["admin", "comercial", "sac"];
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
export function useVeFinanceiro() {
  return useQuery({
    queryKey: ["ve-financeiro"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("cargo").eq("id", u.user.id).maybeSingle(),
      ]);
      const financeiro = ["admin", "comercial"];
      const roleStrs = (roles ?? []).map((r) => r.role as string);
      if (roleStrs.some((r) => financeiro.includes(r))) return true;
      return financeiro.includes(profile?.cargo ?? "");
    },
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
      if (roleStrs.includes("sac") || c === "sac") return "sac" as const;
      return "tecnico" as const;
    },
    staleTime: 60_000,
  });
}
