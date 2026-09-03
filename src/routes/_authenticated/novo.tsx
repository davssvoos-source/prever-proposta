// /novo — só redireciona para /gerencial/nova (o cadastro de visita técnica).
//
// É o endereço antigo do "novo orçamento", de quando o app era só o automador
// de propostas. Fica vivo para favorito e link colado; a guarda é a do
// destino (/gerencial gateia /gerencial/nova pela chave "gerencial.nova").
// Registrado na revisão de 03/09/2026 (docs/REVISAO_2026-09-03.md).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/novo")({
  beforeLoad: () => {
    throw redirect({ to: "/gerencial/nova" });
  },
  component: () => null,
});
