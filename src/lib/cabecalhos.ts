// OS CABEÇALHOS DE SEGURANÇA (S10).
//
// Esta pendência tem história: foi tentada duas vezes em 20/08/2026 e derrubou
// o app duas vezes. A primeira versão usava `script-src 'self'`, que bloqueia o
// <script> inline com o estado de hidratação do TanStack Start — tela preta. A
// segunda foi em Report-Only e coincidiu com o app fora do ar, sem a causa
// provada. O próprio documento fecha com a lição: "eu inverti a ordem e o app
// caiu".
//
// A ordem que ele prescreve, e que este arquivo segue:
//   1. um jeito de EXERCITAR o caminho antes de publicar;
//   2. os cabeçalhos que NÃO dependem do conteúdo (baratos, quase sem como
//      quebrar);
//   3. a CSP por último, em Report-Only, com nonce por request.
//
// Este arquivo é o passo 1 e o passo 2. A lógica saiu de `src/server.ts` — que
// só roda em produção e por isso não tinha como ser exercitado — e virou função
// PURA, que o verificador chama direto, com Response de 200, 304 e 500. **A
// CSP não entra aqui**: ela é o passo 3 e precisa do nonce por request, que
// mexe no `__root.tsx`.

/**
 * Os quatro que não olham o conteúdo da página.
 *
 * `permissions-policy` merece leitura: `geolocation=(self)` é PERMISSÃO, não
 * bloqueio — a chegada por localização da viatura (R273/R274) lê a posição do
 * técnico, e um `geolocation=()` seco mataria a sugestão de "você chegou" sem
 * erro nenhum na tela. Câmera e microfone o sistema não usa; pagamento também
 * não.
 */
export const CABECALHOS_DE_SEGURANCA: Readonly<Record<string, string>> = Object.freeze({
  // não adivinhe o tipo do arquivo pelo conteúdo: é assim que um .txt vira script
  "x-content-type-options": "nosniff",
  // manda a origem para fora, nunca o caminho (o caminho carrega id de cliente)
  "referrer-policy": "strict-origin-when-cross-origin",
  // o app não é para viver dentro de iframe de terceiro
  "x-frame-options": "SAMEORIGIN",
  // o que o navegador pode pedir em nome desta página
  "permissions-policy": "camera=(), microphone=(), payment=(), geolocation=(self)",
});

/** Um ano, que é o mínimo que vale a pena para HSTS. */
export const HSTS = "max-age=31536000; includeSubDomains";

/**
 * O HSTS só entra quando a conversa JÁ é HTTPS.
 *
 * Não é purismo: o servidor Windows da empresa serve HTTP puro
 * (`deploy/windows/instalar.ps1`), e mandar HSTS de lá seria ou ignorado pelo
 * navegador (no melhor caso) ou uma trava no host errado (no pior). Quando o
 * domínio próprio subir com TLS (R280), este teste passa a dar `true` sozinho.
 */
export function querHsts(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Devolve a MESMA resposta com os cabeçalhos somados.
 *
 * As duas armadilhas que este código existe para não cair:
 *
 * 1. **Headers de Response podem ser imutáveis.** Uma resposta que veio de
 *    `fetch` tem o guard travado, e `.headers.set()` levanta erro. Por isso se
 *    reconstrói a resposta em vez de mutar a que chegou.
 *
 * 2. **204 e 304 não podem ter corpo.** `new Response(body, …)` com status 304
 *    levanta `TypeError`. O 304 é o caso comum aqui (o navegador revalidando um
 *    asset), então errar nisso derrubaria o app em toda segunda visita — que é
 *    exatamente a classe de erro que já derrubou esta pendência duas vezes.
 */
export function comCabecalhosDeSeguranca(resposta: Response, url: string): Response {
  const cabecalhos = new Headers(resposta.headers);
  for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) {
    if (!cabecalhos.has(nome)) cabecalhos.set(nome, valor);
  }
  if (querHsts(url) && !cabecalhos.has("strict-transport-security")) {
    cabecalhos.set("strict-transport-security", HSTS);
  }

  const semCorpo = resposta.status === 204 || resposta.status === 304 || resposta.status === 205;
  return new Response(semCorpo ? null : resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: cabecalhos,
  });
}
