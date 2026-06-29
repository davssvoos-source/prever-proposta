import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/visita/$id/orcamento')({
  component: OrcamentoLayout,
})

function OrcamentoLayout() {
  return <Outlet />
}
