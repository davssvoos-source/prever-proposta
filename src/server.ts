import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Cabeçalhos de segurança — aplicados em TODA resposta, aqui, porque este é o
 * único ponto por onde todo request passa.
 *
 * ── POR QUE A CSP ESTÁ EM MODO RELATÓRIO ────────────────────────────────────
 * A primeira versão aplicou `Content-Security-Policy` com `script-src 'self'`
 * e DERRUBOU O APP: tela preta, nada carregava. Motivo: este é um app SSR e o
 * TanStack Start injeta o estado de hidratação num <script> INLINE (o
 * `<Scripts />` do __root.tsx). Sem `'unsafe-inline'` e sem nonce, o navegador
 * bloqueia esse script — o HTML chega, mas o React nunca hidrata.
 *
 * As duas saídas de verdade são (a) nonce por request, que exige o SSR
 * carimbar o mesmo valor no cabeçalho e na tag, e (b) hash dos scripts, que
 * muda a cada build. Nenhuma das duas se resolve no meio de uma correção
 * urgente, e app no ar vale mais do que CSP no ar.
 *
 * Então: `Content-Security-Policy-Report-Only`. O navegador AVALIA a política e
 * grita no console a cada violação, mas não bloqueia nada. Isso deixa a lista
 * exata do que precisa de nonce visível antes de a política valer de verdade —
 * que é como uma CSP deveria ter sido introduzida desde o começo.
 *
 * Os demais cabeçalhos continuam valendo de verdade: eles não dependem do
 * conteúdo da página e nenhum deles quebrou nada.
 *
 * `frame-ancestors` permite o preview do Lovable: o editor renderiza o app num
 * iframe, e `'none'` (a primeira versão) apagaria a tela lá também.
 */
const SUPABASE = "https://jtyautqmftpwzinvhfck.supabase.co";
const CSP_RELATORIO = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self' https://*.lovable.app https://lovable.dev",
  // 'unsafe-inline' aqui é o RETRATO do que existe hoje, não uma aprovação:
  // é o que a política precisaria permitir para o app funcionar sem nonce.
  // Quando o nonce entrar, esta entrada sai e a CSP deixa de ser relatório.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${SUPABASE} https://*.tile.openstreetmap.org`,
  [
    "connect-src 'self'",
    SUPABASE,
    "wss://jtyautqmftpwzinvhfck.supabase.co",
    "https://cep.awesomeapi.com.br",
    "https://brasilapi.com.br",
    "https://viacep.com.br",
    "https://nominatim.openstreetmap.org",
  ].join(" "),
].join("; ");

const CABECALHOS: Record<string, string> = {
  // relatório, não bloqueio — ver o comentário acima
  "content-security-policy-report-only": CSP_RELATORIO,
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  // SAMEORIGIN e não DENY: o preview do Lovable roda em iframe
  "x-frame-options": "SAMEORIGIN",
  "permissions-policy": "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

/** Aplica os cabeçalhos sem sobrescrever o que a resposta já definiu. */
function comSeguranca(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CABECALHOS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return comSeguranca(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return comSeguranca(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
