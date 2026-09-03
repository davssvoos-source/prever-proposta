// /gerencial/usuarios — só redireciona (R131, U94).
//
// A gestão de usuários virou a aba Usuários do painel Administrativo
// (`features/administrativo/Usuarios.tsx`). A rota fica para os links antigos
// não morrerem: ela leva à aba, e o porteiro é o do destino — um redirect não
// tem conteúdo próprio para guardar (mesma regra de /painel/comercial, R32).

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/gerencial/usuarios")({
  beforeLoad: () => {
    throw redirect({ to: "/painel/administrativo", search: { aba: "usuarios" } as any });
  },
  component: () => null,
});
