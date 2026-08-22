// /prospeccao — só um REDIRECT.
//
// A história em duas etapas: a Prospecção deixou de ser página própria na
// R38 (virou aba do Painel Comercial) e a ABA saiu na R64 — o Davi pediu o
// Painel Comercial como lista ÚNICA do ciclo de propostas, sem abas. A
// lista de prospecção saiu da interface; a tabela `prospeccoes` continua no
// banco, e o trabalho de prospecção vive nos chamados de natureza comercial
// (tipo "prospeccao"), na Início.
//
// A rota fica viva só para o endereço antigo não quebrar: favorito,
// histórico do navegador e link colado em conversa caem no Painel
// Comercial. A permissão é a da página de destino ("gerencial") — guardar
// um redirect seria guardar parede, e o destino já tem porteiro.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prospeccao")({
  beforeLoad: () => {
    throw redirect({ to: "/gerencial" });
  },
  component: () => null,
});
