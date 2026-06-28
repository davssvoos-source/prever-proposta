import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  cargo: z.enum(["admin", "comercial", "tecnico"]).default("tecnico"),
});

export const enviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Só admins podem convidar
    const { data: perfil, error: perfilErr } = await context.supabase
      .from("profiles")
      .select("cargo")
      .eq("id", context.userId)
      .single();
    if (perfilErr) throw new Error("Não foi possível verificar permissões");
    if (perfil?.cargo !== "admin") throw new Error("Acesso negado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const siteUrl = process.env.SITE_URL ?? "https://prever.lovable.app";
    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { nome: data.nome, cargo: data.cargo },
        redirectTo: `${siteUrl}/auth`,
      });
    if (inviteErr) throw new Error(inviteErr.message);

    const { error: insertErr } = await supabaseAdmin.from("convites").insert({
      email: data.email,
      nome: data.nome,
      cargo: data.cargo,
      created_by: context.userId,
      status: "pendente",
    });
    if (insertErr) throw new Error(insertErr.message);

    return { success: true, user_id: invited.user?.id ?? null };
  });
