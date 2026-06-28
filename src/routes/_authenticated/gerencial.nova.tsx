import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { VisitaForm } from "@/features/gerencial/VisitaForm";

export const Route = createFileRoute("/_authenticated/gerencial/nova")({
  component: NovaVisitaPage,
});

function NovaVisitaPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/gerencial"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#FFC000]"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
      </div>
      <header>
        <h1 className="text-2xl font-bold">Nova Visita Técnica</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados em duas etapas.</p>
      </header>
      <VisitaForm />
    </div>
  );
}
