// REDIRECIONA desde 15/09/2026 (R299): "Sobreaviso" virou "Gestão Técnica" —
// a mesa do gestor da equipe de campo, em /gestao-tecnica. Davi: "Vamos
// alterar a tela 'Sobreaviso' para 'Gestão Técnica'".
//
// A BUSCA VIAJA JUNTO. `?mes=`, `?dia=` e `?visao=` são o estado desta tela
// (R253), e o link com eles é exatamente o que o gestor manda do desktop para
// o celular de quem está de plantão — um redirect que os perdesse abriria o
// mês corrente em vez do dia pedido, e a pessoa juraria que o link estava
// errado. A validação da busca continua na rota de destino, que é quem a lê.
//
// A CHAVE DE PERMISSÃO continua sendo `sobreaviso` (src/lib/telas.ts): é o que
// está gravado em permissoes_tela, e renomear apagaria o que o admin
// configurou. O arquivo continua existindo em vez de ser apagado pelo mesmo
// motivo da clientes.novo (R21): o routeTree é GERADO no build — redirecionar
// é o mesmo efeito para quem guardou o link, sem janela de deploy própria.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sobreaviso")({
  validateSearch: (s: Record<string, unknown>) => s,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/gestao-tecnica", search: search as any });
  },
  component: () => null,
});
