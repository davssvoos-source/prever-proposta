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

// ─── Hook de notificações ───────────────────────────────────
function useNotificacoes() {
  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return data ?? [];
    },
    refetchInterval: 60000,
  });

  const marcarLidas = useMutation({
    mutationFn: async () => {
      await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  return { notifs, naoLidas: notifs.filter((n: any) => !n.lida).length, marcarLidas };
}

// ─── Hook de perfil ─────────────────────────────────────────
function usePerfil() {
  return useQuery({
    queryKey: ["perfil-header"],
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
}

// ─── Sino de notificações ───────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifs, naoLidas, marcarLidas } = useNotificacoes();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tipoIcon: Record<string, string> = {
    visita: "🗓️",
    aprovacao: "✅",
    sistema: "⚙️",
    info: "ℹ️",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen((p) => !p);
          if (!open && naoLidas > 0) marcarLidas.mutate();
        }}
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "rgba(255,255,255,0.75)",
        }}
      >
        <Bell size={18} />
        {naoLidas > 0 && (
          <div
            style={{
              position: "absolute",
              top: 7,
              right: 7,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#FFC000",
              boxShadow: "0 0 6px rgba(255,192,0,0.7)",
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 0,
            width: 300,
            zIndex: 100,
            background: "rgba(12,12,18,0.92)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13, color: "#fff" }}>
              Notificações
            </span>
            {naoLidas > 0 && (
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: "rgba(255,192,0,0.7)",
                  letterSpacing: "0.06em",
                }}
              >
                {naoLidas} nova{naoLidas > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div
                style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                Nenhuma notificação
              </div>
            ) : (
              notifs.map((n: any) => (
                <div
                  key={n.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: n.lida ? "transparent" : "rgba(255,192,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16, minWidth: 22 }}>{tipoIcon[n.tipo] ?? "ℹ️"}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: n.lida ? 300 : 500,
                          fontSize: 12,
                          color: n.lida ? "rgba(255,255,255,0.55)" : "#fff",
                          lineHeight: 1.4,
                        }}
                      >
                        {n.titulo}
                      </div>
                      {n.corpo && (
                        <div
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 300,
                            fontSize: 11,
                            color: "rgba(255,255,255,0.35)",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {n.corpo}
                        </div>
                      )}
                      <div
                        style={{
                          fontFamily: "'Montserrat', sans-serif",
                          fontWeight: 300,
                          fontSize: 10,
                          color: "rgba(255,192,0,0.45)",
                          marginTop: 5,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {new Date(n.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {!n.lida && (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#FFC000",
                          marginTop: 4,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
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

          <NotificationBell />
        </div>

        {/* CONTEÚDO */}
        <main
          className="mx-auto max-w-5xl"
          style={{ paddingTop: 76, paddingBottom: 110, paddingLeft: 16, paddingRight: 16 }}
        >
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </>
  );
}
