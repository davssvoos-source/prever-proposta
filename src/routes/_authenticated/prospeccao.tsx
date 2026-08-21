// /prospeccao — só um REDIRECT (R38).
//
// A Prospecção deixou de ser página própria: virou a primeira ABA do Painel
// Comercial (/gerencial?aba=prospeccao). Prospecção é o começo do funil —
// prospecto vira proposta vira cliente —, e ter uma porta separada obrigava a
// escolher entre duas telas antes de começar a trabalhar, sendo que o trabalho
// atravessa as duas.
//
// A rota fica viva só para o endereço antigo não quebrar: favorito, histórico
// do navegador e link colado em conversa caem na aba certa. A permissão é a da
// página de destino ("gerencial") — guardar um redirect seria guardar parede,
// e o destino já tem porteiro.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prospeccao")({
  beforeLoad: () => {
    throw redirect({ to: "/gerencial", search: { aba: "prospeccao" } });
  },
  component: () => null,
});
