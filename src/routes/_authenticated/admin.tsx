// DESATIVADA em 2026-09-04 pela R198 — Davi, na rodada de importação do QAP:
// "Exclua a atual tela de Catálogo." O catálogo do sistema passou a ser
// "Equipamentos cadastrados" (/equipamentos), que nasce das variações
// importadas do QAP e é onde os valores entram no passo seguinte.
//
// O arquivo continua existindo em vez de ser apagado pelo mesmo motivo da
// mapa.tsx (R192) e da historico.tsx (R165): o routeTree é GERADO no build, e
// um link antigo guardado por alguém cai aqui — redirecionar é o mesmo efeito,
// sem 404 e sem janela de deploy própria. A chave "admin" saiu do catálogo de
// telas (src/lib/telas.ts) e a U109 apaga as linhas dela em permissoes_tela;
// o prefixo de erro ADM saiu junto (não há mais tela onde um erro ADM nasça) e
// deu lugar ao EQP.
//
// O QUE SAIU COM ELA, e onde foi parar:
//   · Equipamentos (custo/markup da tabela `equipamentos`) — a tabela CONTINUA
//     no banco e o wizard da proposta continua lendo dela; o que não existe
//     mais é a tela que a editava. O catálogo novo assume esse papel quando
//     receber os valores (o passo seguinte do Davi).
//   · Blocos de referência — já eram do banco desde a R166 (Q16).
//   · Serviços de referência — sem tela por enquanto; editar por SQL até
//     /equipamentos ganhar a seção. Está dito no diário da U109 e no resumo
//     que foi ao Davi, para não virar surpresa.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/equipamentos" });
  },
  component: () => null,
});
