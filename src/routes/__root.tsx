import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TelaDeErro } from "@/components/TelaDeErro";
import { codigoDeErro } from "@/lib/erros";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * 404. Fabrica um erro com `status` para a taxonomia classificar como ROTA —
 * assim o endereço inexistente também sai com código (PRV-<área>-ROTA-HTTP404),
 * e "a página X não abre" vira uma informação em vez de um relato.
 */
function NotFoundComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <TelaDeErro
      erro={Object.assign(new Error(`Rota não encontrada: ${pathname}`), { status: 404 })}
      pathname={pathname}
    />
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // o código vai junto para o relatório e para o console: quando o Davi
    // mandar o print, o mesmo código está dos dois lados
    const codigo = codigoDeErro(error, pathname);
    console.error(`[${codigo}]`, error);
    reportLovableError(error, { boundary: "tanstack_root_error_component", codigo, pathname });
  }, [error, pathname]);

  return (
    <TelaDeErro
      erro={error}
      pathname={pathname}
      aoTentarDeNovo={() => { router.invalidate(); reset(); }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Prever Orçamentos — Segurança Eletrônica" },
      {
        name: "description",
        content: "Gerador de orçamentos do Grupo Prever para sistemas de segurança eletrônica.",
      },
      { name: "theme-color", content: "#08090E" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        // v6: Montserrat em quatro pesos e só quatro — Thin 100 para numeral
        // grande, Regular 400 para corpo, SemiBold 600 para título e chip,
        // Bold 700 para micro-rótulo em caixa alta. `display=swap` para o
        // texto aparecer na fonte do sistema enquanto a webfont carrega, em
        // vez de a tela ficar em branco no 4G de obra.
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@100;400;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
