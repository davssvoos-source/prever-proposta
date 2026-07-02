// Edge function: notify-upcoming-visits
// Roda a cada 5 minutos via pg_cron. Cria uma notificação para o técnico
// responsável de cada visita pendente cuja data_hora_agendada está a ~2h de agora.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = Date.now();
    const from = new Date(now + 115 * 60 * 1000).toISOString(); // +1h55
    const to = new Date(now + 125 * 60 * 1000).toISOString();   // +2h05

    const { data: visitas, error } = await supabase
      .from("visitas_tecnicas")
      .select("id, tecnico_id, endereco, nome_predio, titulo, data_hora_agendada")
      .eq("status", "pendente")
      .gte("data_hora_agendada", from)
      .lte("data_hora_agendada", to);

    if (error) throw error;

    const criadas: string[] = [];
    for (const v of visitas ?? []) {
      if (!v.tecnico_id) continue;

      // evita duplicar se já enviamos lembrete nas últimas 3h para essa visita
      const { data: existente } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("visita_id", v.id)
        .eq("tipo", "lembrete_visita")
        .gte("created_at", new Date(now - 3 * 60 * 60 * 1000).toISOString())
        .limit(1);
      if (existente && existente.length > 0) continue;

      const local =
        v.endereco || v.nome_predio || v.titulo || "endereço não informado";

      const { error: insErr } = await supabase.from("notificacoes").insert({
        user_id: v.tecnico_id,
        tipo: "lembrete_visita",
        titulo: "Visita em 2 horas",
        corpo: `Você tem uma visita técnica em 2 horas no endereço ${local}.`,
        visita_id: v.id,
        lida: false,
      });
      if (!insErr) criadas.push(v.id);
    }

    return new Response(
      JSON.stringify({ ok: true, encontradas: visitas?.length ?? 0, criadas: criadas.length }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
