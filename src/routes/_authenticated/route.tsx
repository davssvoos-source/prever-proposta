import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AnimatedBackground } from "@/components/AnimatedBackground";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <>
      <AnimatedBackground />
      <div className="min-h-screen" style={{ position: "relative", zIndex: 1 }}>
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 pt-4" style={{ paddingBottom: 120 }}>
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </>
  );
}
