import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VisitaForm } from "@/features/gerencial/VisitaForm";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/gerencial/visita/$id/editar")({
  component: EditarVisitaPage,
});

function EditarVisitaPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["visita-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Link
        to="/gerencial"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#FFC000]"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Editar Visita</h1>
        <p className="text-sm text-muted-foreground">{data?.nome_predio ?? data?.titulo ?? ""}</p>
      </header>
      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <VisitaForm initial={data} />
      )}
    </div>
  );
}
