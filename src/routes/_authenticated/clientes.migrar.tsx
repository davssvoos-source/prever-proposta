// DESATIVADA em 2026-08-21 pela R21 — consolidar cadastros — criava, reescrevia e apagava cliente (R21).
//
// O arquivo continua existindo em vez de ser apagado porque o routeTree é
// GERADO no build: remover a rota do disco exigiria regenerar e commitar o
// routeTree, e um deploy com os dois fora de sincronia derruba o app inteiro.
// Redirecionar é o mesmo efeito para quem usa, sem esse risco.
//
// A trava de verdade não é esta: é a policy. A U27 removeu
// `clientes_insert_gestor`, então nem um INSERT pelo console do navegador
// passa. Isto aqui só evita a tela órfã.
//
// Quando o Sincronizar existir (U28), este arquivo pode ser apagado junto com
// a regeneração do routeTree, numa janela de deploy própria.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clientes/migrar")({
  beforeLoad: () => {
    throw redirect({ to: "/clientes" });
  },
  component: () => null,
});
