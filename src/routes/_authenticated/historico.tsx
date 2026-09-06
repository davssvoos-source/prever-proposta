// DESATIVADA em 2026-09-04 pela R165 — Davi (Q14): "Pode sumir, já que o
// início já mostra isso". A tela listava as visitas do técnico logado sob o
// nome "Visitas"; a Início já as mostra como cards, com os mesmos filtros.
//
// O arquivo continua existindo em vez de ser apagado pelo mesmo motivo da
// clientes.novo (R21): o routeTree é GERADO no build, e um link antigo
// guardado por alguém cai aqui — redirecionar para a Início é o mesmo efeito,
// sem 404 e sem janela de deploy própria. A chave "historico" saiu do
// catálogo (src/lib/telas.ts) e a U99 apaga as linhas dela em
// permissoes_tela; o prefixo de erro HIS (erros.ts) fica, por ser histórico
// de log.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/historico")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
