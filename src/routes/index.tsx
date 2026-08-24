import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      {/* texto secundário pelo token do tema (par claro/escuro garantido),
          não pelo --muted-foreground do shadcn */}
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando...</div>
    </div>
  );
}
