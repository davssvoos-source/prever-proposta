// …/viatura/<codigo> — o endereço que a ETIQUETA NFC do carro carrega (R266).
// Bipar abre aqui; a tela decide sozinha se é hora de iniciar ou de encerrar.
// Não tem chave na matriz de propósito: é a porta de um gesto, não uma tela de
// menu — e quem não é técnico vê só o estado do carro (D11).

import { createFileRoute } from "@tanstack/react-router";
import { TelaDaViatura } from "@/features/viaturas/TelaDaViatura";

export const Route = createFileRoute("/_authenticated/viatura/$codigo")({
  component: ViaturaPage,
});

function ViaturaPage() {
  const { codigo } = Route.useParams();
  return <TelaDaViatura codigo={codigo} />;
}
