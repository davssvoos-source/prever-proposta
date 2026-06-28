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

export function useTecnicos() {
  return useQuery({
    queryKey: ["tecnicos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, cargo, avatar_url, telefone, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVisitasGerencial() {
  return useQuery({
    queryKey: ["visitas-gerencial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("*, cliente:clientes(id, nome, tipo_empreendimento, telefone)")
        .order("data_hora_agendada", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

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
      const roleStrs = (roles ?? []).map((r) => r.role as string);
      if (roleStrs.includes("admin") || roleStrs.includes("comercial")) return true;
      const c = profile?.cargo ?? "";
      return c === "admin" || c === "comercial";
    },
    staleTime: 60_000,
  });
}
