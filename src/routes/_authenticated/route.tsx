import { createFileRoute, Outlet, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { BottomNav } from "@/components/BottomNav";
import { NotificationPanel } from "@/components/NotificationPanel";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

// ─── Hook de perfil ─────────────────────────────────────────
function usePerfil() {
  return useQuery({
    queryKey: ["perfil-header"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo, avatar_url, status")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { data: perfil } = usePerfil();

  const iniciais = perfil?.nome
    ? perfil.nome
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <>
      <AnimatedBackground />
      <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
        {/* HEADER */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(8,8,12,0.65)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => navigate({ to: "/perfil" })}
          >
            {perfil?.avatar_url ? (
              <img
                src={perfil.avatar_url}
                alt="avatar"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,192,0,0.45)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#FFD700,#FF9F00)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#08090E",
                  flexShrink: 0,
                  border: "2px solid rgba(255,192,0,0.3)",
                }}
              >
                {iniciais}
              </div>
            )}
            <div>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  color: "#fff",
                  lineHeight: 1.2,
                }}
              >
                {perfil?.nome ?? "Carregando..."}
              </div>
              {perfil?.cargo && (
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(255,192,0,0.6)",
                    lineHeight: 1.2,
                  }}
                >
                  {perfil.cargo}
                </div>
              )}
            </div>
          </div>

          <NotificationPanel />
        </div>

        {/* CONTEÚDO */}
        <main
          className="mx-auto max-w-5xl"
          style={{ paddingTop: 76, paddingBottom: 110, paddingLeft: 16, paddingRight: 16 }}
        >
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </>
  );
}

