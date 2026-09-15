// DESATIVADA em 15/09/2026 pela R301 — Davi: "Remova o botão 'Ver todos os
// chamados', e remova também a tela da página Todos os Chamados, pois na
// verdade, na tela 'Operacional Técnica' já deverão aparecer TODOS os
// chamados, então o botão levaria a uma tela com as mesmas informações."
//
// Era o "Painel de chamados" da R8 (a aba 1 do SAC): os quatro trilhos com
// filtros por técnico, tipo, cliente e trilho. O que ela mostrava de
// específico — o trilho de DEMANDA (atividades internas) e o de PROPOSTA ao
// lado do de CAMPO — vive hoje na Início (todas as atividades, R221) e no
// Painel Comercial (as propostas, R32/R302). O de campo é a Operacional
// Técnica inteira. Fecha a pergunta "Dois painéis ainda…" da revisão de
// 03/09/2026, cujo veredito "fica" a R301 reverteu.
//
// A chave "chamados.painel" saiu do catálogo (src/lib/telas.ts) e a U153
// apaga as linhas dela em permissoes_tela. O arquivo continua existindo em
// vez de ser apagado pelo mesmo motivo da chamados.importar (R167): o
// routeTree é GERADO no build — redirecionar é o mesmo efeito para quem
// guardou o link, sem janela de deploy própria.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chamados/painel")({
  beforeLoad: () => {
    throw redirect({ to: "/painel/operacional" });
  },
  component: () => null,
});
