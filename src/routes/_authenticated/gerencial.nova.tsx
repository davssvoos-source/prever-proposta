// A rota da Nova Visita Técnica — só a CASCA (R214, U117).
//
// O formulário inteiro mora em features/gerencial/NovaVisitaTecnica.tsx e é o
// MESMO que o "+" da Início embute quando o tipo de demanda é Proposta
// Comercial. Aqui só a moldura de página: concluir ou voltar leva ao Painel
// Comercial.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NovaVisitaTecnica } from "@/features/gerencial/NovaVisitaTecnica";

export const Route = createFileRoute("/_authenticated/gerencial/nova")({
  component: NovaVisitaPage,
});

function NovaVisitaPage() {
  const navigate = useNavigate();
  const voltar = () => navigate({ to: "/gerencial" });
  return <NovaVisitaTecnica aoConcluir={voltar} aoVoltar={voltar} />;
}
