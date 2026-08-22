import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  cargo: z.enum(["admin", "comercial", "sac", "tecnico"]).default("tecnico"),
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
    const meta = { nome: data.nome, cargo: data.cargo };

    // ── R59: CADASTRAR NÃO DEPENDE DO E-MAIL SAIR ──────────────────────────
    // Davi, 2026-08-22: "a partir do momento que eu (admin) crio um usuário no
    // painel de usuários, eu cadastro o email e o nome, mesmo que o usuário
    // nunca tenha acessado o sistema, o nosso sistema já deve tratar como um
    // novo usuário."
    //
    // `inviteUserByEmail` faz DUAS coisas — cria a conta E dispara o convite —
    // e falha inteira se o envio falhar (SMTP não configurado, cota do
    // provedor estourada, domínio recusado). Antes, essa falha deixava o
    // cadastro em NADA: sem auth.users, sem profile, sem linha em convites. O
    // admin preenchia o formulário, via um erro e o técnico continuava
    // inexistente para o sistema — não dava para pô-lo numa dupla nem numa
    // programação.
    //
    // Agora o envio é a parte OPCIONAL: se ele falhar, `createUser` cria a
    // conta assim mesmo. O profile nasce igual (trigger on_auth_user_created
    // lê estes mesmos metadados), então a pessoa aparece em usePessoas() e
    // useTecnicos() na hora, e entra depois por "esqueci minha senha".
    let userId: string | null = null;
    let emailEnviado = true;

    const { data: convidado, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: meta,
        redirectTo: `${siteUrl}/auth`,
      });

    if (inviteErr) {
      // "já existe" não é falha de envio — é cadastro repetido, e aí o certo
      // é dizer isso em vez de criar uma segunda conta com o mesmo e-mail
      if (/already|registered|exists/i.test(inviteErr.message)) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
      const { data: criado, error: criarErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: false,
        user_metadata: meta,
      });
      // só agora é erro de verdade: nem o convite nem a criação direta deram
      if (criarErr) throw new Error(criarErr.message);
      userId = criado.user?.id ?? null;
      emailEnviado = false;
    } else {
      userId = convidado.user?.id ?? null;
    }

    const { error: insertErr } = await supabaseAdmin.from("convites").insert({
      email: data.email,
      nome: data.nome,
      cargo: data.cargo,
      created_by: context.userId,
      status: "pendente",
    });
    if (insertErr) throw new Error(insertErr.message);

    // `emailEnviado` volta para a tela avisar que a conta existe mas o convite
    // não saiu — sem isso o admin acharia que a pessoa recebeu um e-mail que
    // nunca chegou, e ficaria esperando.
    return { success: true, user_id: userId, emailEnviado };
  });
