// /gerencial/permissoes — só redireciona (R131, U94).
//
// A matriz de acessos por papel virou a aba Permissões do painel
// Administrativo (`features/administrativo/Permissoes.tsx`), ao lado da lista
// de usuários — "as permissões estarem junto" (Davi, 03/09/2026). A rota fica
// para os links antigos não morrerem; o porteiro é o do destino.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/gerencial/permissoes")({
  beforeLoad: () => {
    throw redirect({ to: "/painel/administrativo", search: { aba: "permissoes" } as any });
  },
  component: () => null,
});
