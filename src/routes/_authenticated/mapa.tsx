// DESATIVADA em 2026-09-04 pela R192 — Davi, na revisão manual: excluir a
// tela /mapa e o botão "Mapa" da aba Comercial. A tela era um mapa Leaflet das
// visitas técnicas; o mapa que continua no sistema é o de CLIENTES (dentro de
// /clientes, features/clientes/MapaClientes.tsx), que é outra coisa e não tem
// chave própria na matriz.
//
// O arquivo continua existindo em vez de ser apagado pelo mesmo motivo da
// historico.tsx (R165) e da clientes.novo (R21): o routeTree é GERADO no
// build, e um link antigo guardado por alguém cai aqui — redirecionar para o
// Painel Comercial é o mesmo efeito, sem 404 e sem janela de deploy própria.
// A chave "mapa" saiu do catálogo (src/lib/telas.ts) e a U106 apaga as linhas
// dela em permissoes_tela; o prefixo de erro MAP (erros.ts) saiu junto — não
// há mais tela onde um erro MAP possa nascer.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mapa")({
  beforeLoad: () => {
    throw redirect({ to: "/gerencial" });
  },
  component: () => null,
});
