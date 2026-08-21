// /chamados — só o TRONCO, sem página própria (R31).
//
// A lista que morava aqui morreu: a Início entrega a mesma fila em kanban e
// lista, pelo MESMO modelo (features/atividades) — eram duas telas para a
// mesma pergunta, e a segunda sempre um passo atrás da primeira.
//
// A rota continua existindo porque as filhas moram debaixo dela e seguem
// vivas: /chamados/$id (o detalhe que todo mundo abre pela Início),
// /chamados/novo* (abrir chamado), /chamados/painel, /chamados/programacao e
// /chamados/importar. Só o endereço exato redireciona — quem guardou o link
// antigo cai na Início, onde a fila mora agora.

import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chamados")({
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    if (location.pathname.replace(/\/$/, "") === "/chamados") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Outlet,
});
