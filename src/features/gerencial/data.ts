import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export async function geocode(endereco: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(endereco)}`;
    const r = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    const arr = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
  } catch {
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
