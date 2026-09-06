// DESATIVADA em 2026-09-04 pela R167 — Davi (Q17): "Não conheço essa tela,
// pode deletar ela". Era a importação do quadro do Notion (U1/U31): ler o
// CSV, mostrar a prévia e gravar em lotes. O Notion já foi importado; a tela
// não tinha mais o que fazer.
//
// O que NÃO saiu: a lógica de leitura do export (features/chamados/
// importar-notion.ts — datas em português, status, células com vários
// valores, apelidos de cliente), que o verificador continua testando contra
// o arquivo real. É biblioteca, não tela; sai numa leva de limpeza própria,
// quando o corte do Notion for definitivo (Fase G).
//
// O arquivo continua existindo em vez de ser apagado pelo mesmo motivo da
// clientes.novo (R21): o routeTree é GERADO no build — redirecionar é o mesmo
// efeito para quem guardou o link, sem janela de deploy própria. A chave
// "chamados.importar" saiu do catálogo (src/lib/telas.ts) e a U99 apaga as
// linhas dela em permissoes_tela.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chamados/importar")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
