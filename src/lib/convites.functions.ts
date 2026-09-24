import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  // R304 (15/09/2026): entra o "gestor" — quem manda na equipe técnica de campo.
  // Literal de propósito: é validação de SERVIDOR (o mapa da tela não chega aqui).
  cargo: z.enum(["admin", "comercial", "sac", "tecnico", "operacional", "gestor"]).default("tecnico"),
});

/**
 * A URL pública do app, para o link do convite (`redirectTo`). Vem de SITE_URL
 * no servidor; sem ela, a publicação da Lovable. Um lugar só — enviar e
 * reenviar montam o link daqui; antes o mesmo fallback vivia duplicado nas
 * duas funções. (Conferir se a variável existe no servidor é da hospedagem.)
 */
function siteUrl() {
  return process.env.SITE_URL ?? "https://prever.lovable.app";
}

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
        redirectTo: `${siteUrl()}/auth`,
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

// ── R298: REENVIAR o convite pendente ──────────────────────────────────────
// Davi, 15/09/2026: "Adicione botão de reenviar convite na lista de convites
// pendentes". Reenviar NÃO é convidar de novo: `enviarConvite` insere outra
// linha em `convites` e trata "já existe" como erro — chamá-la de novo
// duplicaria o card ou falharia. Aqui é a MESMA linha, o MESMO e-mail e um
// novo disparo pelo GoTrue: `inviteUserByEmail` para uma conta que ainda não
// confirmou o e-mail reenvia o convite (é o caso de todo convite pendente,
// inclusive o que nasceu pelo `createUser` do R59); para conta já confirmada
// ele devolve "already registered" — e aí o certo é dizer que a pessoa já
// entrou, não inventar um segundo envio.
const reenvioSchema = z.object({ id: z.string().uuid() });

export const reenviarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reenvioSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Só admins podem reenviar — a mesma porta de `enviarConvite`
    const { data: perfil, error: perfilErr } = await context.supabase
      .from("profiles")
      .select("cargo")
      .eq("id", context.userId)
      .single();
    if (perfilErr) throw new Error("Não foi possível verificar permissões");
    if (perfil?.cargo !== "admin") throw new Error("Acesso negado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // a linha que já existe — nada é inserido em `convites`
    const { data: convite, error: conviteErr } = await supabaseAdmin
      .from("convites")
      .select("id, email, nome, cargo, status")
      .eq("id", data.id)
      .single();
    if (conviteErr || !convite) throw new Error("Convite não encontrado.");
    if (convite.status !== "pendente") {
      throw new Error("Este convite já foi cancelado ou aceito — não há o que reenviar.");
    }

    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(convite.email, {
      data: { nome: convite.nome, cargo: convite.cargo },
      redirectTo: `${siteUrl()}/auth`,
    });

    if (inviteErr) {
      if (/already|registered|exists|confirmed/i.test(inviteErr.message)) {
        // R310 (U160), Davi 23/09/2026: "Quando alguém clicar em 'Reenviar convite'
        // e o servidor responder que aquela pessoa já existe, o sistema marca o
        // convite como aceito e ele sai da lista." Não é erro: é o convite cumprido.
        const { error: aceitoErr } = await supabaseAdmin
          .from("convites")
          .update({ status: "aceito" })
          .eq("id", convite.id);
        if (aceitoErr) throw new Error(aceitoErr.message);
        return { success: true, aceito: true, email: convite.email };
      }
      // o texto do driver fica no log do servidor; a tela recebe a frase
      console.error("[reenviarConvite] inviteUserByEmail:", inviteErr.message);
      throw new Error('O e-mail não saiu. Tente de novo em alguns minutos ou peça para a pessoa entrar por "esqueci minha senha".');
    }

    return { success: true, aceito: false, email: convite.email };
  });
