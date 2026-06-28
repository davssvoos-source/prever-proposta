import { supabase } from "@/integrations/supabase/client";

export async function fetchVisitas() {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .select("*, cliente:clientes(id, nome, tipo_empreendimento, telefone)")
    .order("data_hora_agendada", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchVisita(id: string) {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .select("*, cliente:clientes(id, nome, tipo_empreendimento, contato_telefone)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProfiles(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, cargo, avatar_url")
    .in("id", userIds);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFotosVisita(visitaId: string) {
  const { data, error } = await supabase
    .from("fotos_visita")
    .select("*")
    .eq("visita_id", visitaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Generate signed URL from storage path for a private bucket */
export async function getSignedPhotoUrl(path: string) {
  const { data } = await supabase.storage
    .from("fotos-visitas")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}
