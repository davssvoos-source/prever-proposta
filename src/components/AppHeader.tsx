import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { data: perfil } = useQuery({
    queryKey: ["meu-perfil-header"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const initials = (nome: string) =>
    (nome ?? "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();

  return (
    <header className="header-glass">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/dashboard" className="flex items-center" aria-label="Grupo Prever">
          <img
            src="/logo-prever.svg"
            alt="Grupo Prever"
            style={{
              height: 38,
              width: "auto",
              display: "block",
              filter:
                "drop-shadow(0 0 6px rgba(255,192,0,0.55)) drop-shadow(0 0 14px rgba(255,192,0,0.25))",
            }}
          />
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {perfil && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {perfil.avatar_url ? (
                <img
                  src={perfil.avatar_url}
                  alt={perfil.nome ?? "Avatar"}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    flexShrink: 0,
                    objectFit: "cover",
                    border: "1.5px solid rgba(255,192,0,0.5)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg, #FFD700, #FFC000)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "#08090E",
                  }}
                >
                  {initials(perfil.nome ?? "")}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
                    fontSize: 12,
                    color: "#F0F2F5",
                  }}
                >
                  {(perfil.nome ?? "").split(" ")[0]}
                </span>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    color: "rgba(255,192,0,0.75)",
                    textTransform: "capitalize",
                    letterSpacing: "0.06em",
                  }}
                >
                  {perfil.cargo ?? ""}
                </span>
              </div>
            </div>
          )}

          <Button
            size="icon"
            variant="ghost"
            aria-label="Notificações"
            className="rounded-full hover:bg-[rgba(255,192,0,0.08)]"
          >
            <Bell className="h-5 w-5" style={{ color: "#FFC000" }} />
          </Button>
        </div>
      </div>
    </header>
  );
}
