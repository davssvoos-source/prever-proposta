// /painel/comercial — só um REDIRECT (R32).
//
// O Painel Comercial fundiu com "Visitas e propostas": a lista com o funil em
// cima (/gerencial) é a página do domínio. O painel-índice que morava aqui
// duplicava os números dela e obrigava um clique a mais para chegar ao
// trabalho — porta e sala viraram a mesma coisa.
//
// A rota fica viva só para o endereço antigo não quebrar: favorito, histórico
// do navegador e link colado em conversa caem no lugar certo. A permissão é a
// da página de destino ("gerencial") — guardar um redirect seria guardar
// parede, e o destino já tem porteiro.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/painel/comercial")({
  beforeLoad: () => {
    throw redirect({ to: "/gerencial" });
  },
  component: () => null,
});
