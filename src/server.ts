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
 * Por que importam neste app: a sessão do Supabase vive no localStorage, então
 * qualquer XSS vira roubo de sessão. A CSP é a segunda linha de defesa para o
 * dia em que escapar um dado for esquecido em algum lugar.
 *
 * As diretivas foram escolhidas contra o que o app REALMENTE usa:
 * - connect-src: Supabase (REST/Auth/Storage/Realtime, daí o wss:) e as APIs
 *   de CEP/geocodificação usadas pelo cadastro de cliente;
 * - img-src: blob:/data: para as fotos que o técnico tira antes do upload, e
 *   o Storage do Supabase; tile.openstreetmap.org para o /mapa de visitas;
 * - style-src: 'unsafe-inline' é INEVITÁVEL — o app inteiro é estilo inline
 *   (decisão de design do projeto) e o Google Fonts injeta <style>;
 * - script-src: 'unsafe-inline' fica de fora de propósito; é justamente o que
 *   transforma um XSS refletido em execução.
 *
 * `frame-ancestors 'none'` mata clickjacking; `X-Content-Type-Options` mata
 * MIME sniffing; `Referrer-Policy` impede o id do cliente vazar na URL de
 * saída; `Permissions-Policy` desliga o que o app não usa.
 */
const SUPABASE = "https://jtyautqmftpwzinvhfck.supabase.co";
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
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
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "cross-origin-opener-policy": "same-origin",
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
