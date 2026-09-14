import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { comCabecalhosDeSeguranca } from "./lib/cabecalhos";

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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // S10: os cabeçalhos entram no ÚNICO ponto por onde tudo passa — página,
    // asset, 304 de revalidação e a página de erro. Pôr em cada `return`
    // seria esquecer um. A CSP NÃO está aqui: é o passo 3 da pendência e
    // precisa de nonce por request (ver src/lib/cabecalhos.ts).
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return comCabecalhosDeSeguranca(
        await normalizeCatastrophicSsrResponse(response),
        request.url,
      );
    } catch (error) {
      console.error(error);
      return comCabecalhosDeSeguranca(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request.url,
      );
    }
  },
};
