// /contratos — o TRONCO das rotas de contrato (R132, U94).
//
// Davi, 03/09/2026: "a página 'Contratos' na verdade não precisa existir. Os
// contratos estarão na página de cada cliente." A LISTA que morava aqui morreu:
// o contrato se vê, se cadastra e se abre a partir da ficha do cliente
// (`/clientes/$id`, seção Contratos), que já era o único lugar em que ele fazia
// sentido — contrato é atributo do cliente, não uma coleção à parte.
//
// O que fica é a ESTRUTURA: `/contratos/novo` e `/contratos/$id` são filhas
// desta rota e entram pelo Outlet, e a guarda de tela (`contratos`) continua
// valendo para as duas — contrato é dado financeiro, a RLS já barra, mas
// mandar o técnico para uma tela permanentemente vazia seria pior do que não
// mostrar a tela. O endereço EXATO `/contratos` redireciona para a base de
// clientes, que é onde os contratos vivem (mesma solução do tronco `/chamados`
// depois da R31).

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";

export const Route = createFileRoute("/_authenticated/contratos")({
  beforeLoad: async ({ location }) => {
    const { ok } = await guardaDeTela("contratos");
    if (!ok) throw redirect({ to: destinoNegado("contratos") as any });
    // R132: a lista morreu — o endereço exato leva à base de clientes
    if (location.pathname.replace(/\/+$/, "") === "/contratos") {
      throw redirect({ to: "/clientes" });
    }
  },
  component: () => <Outlet />,
});
