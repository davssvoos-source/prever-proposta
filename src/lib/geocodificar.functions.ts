// A GEOCODIFICAÇÃO — UMA, no servidor. U84 / R114.
//
// ── O SALDO DESTE ARQUIVO É NEGATIVO ──────────────────────────────────────
// Ele é código NOVO, e ainda assim a entrega APAGA mais do que acrescenta:
// existiam QUATRO cópias de Nominatim no repositório, todas no navegador, todas
// com a mesma consulta de texto livre, todas sem User-Agent identificável:
//
//   · src/features/gerencial/data.ts               (a exportada, `geocode`)
//   · src/features/visitas/NovaVisitaDialog.tsx    (cópia inline)
//   · src/routes/_authenticated/gerencial.nova.tsx (cópia inline, + `onBlur`)
//   · src/routes/_authenticated/visita.$id.tsx     (cópia inline, + `useEffect`)
//
// As três cópias inline foram APAGADAS. Sobrou uma porta, aqui.
//
// ── POR QUE ISSO NÃO É ARRUMAÇÃO, É O ABUSO QUE JÁ ESTAVA ACONTECENDO ─────
// A política de uso do Nominatim é explícita: no máximo ~1 requisição por
// segundo, User-Agent identificável, e nada de geocodificação em massa
// automática. O repositório violava as três:
//
//  · `visita.$id.tsx:549-555` geocodificava A CADA ABERTURA da ficha da visita,
//    dentro de um `useEffect`, e JOGAVA O RESULTADO FORA — nada era gravado, de
//    modo que a próxima abertura da MESMA visita geocodificava DE NOVO. Abrir
//    dez visitas era dez requisições, num laço que ninguém pediu;
//  · dois `onBlur` disparavam a requisição toda vez que o cursor saía do campo
//    de endereço. Corrigir um dígito do CEP e sair do campo era outra
//    requisição, e passar o Tab pelo formulário disparava sem digitar nada;
//  · nenhuma das quatro mandava User-Agent. Para o Nominatim isso já é motivo
//    de bloqueio por si só, e o bloqueio é por IP — ele cairia sobre a operação
//    inteira, de uma vez, sem aviso.
//
// ── A REGRA NOVA, EM UMA LINHA ────────────────────────────────────────────
// UM GESTO HUMANO EXPLÍCITO = NO MÁXIMO UMA REQUISIÇÃO. Não há `useEffect`, não
// há `onBlur`, não há laço, não há lote. Só botão.
//
// E ESTA ENTREGA NÃO GEOCODIFICA CLIENTE NENHUM: ela não varre a base, não
// preenche a coordenada que falta, não roda em lote. Um re-geocode da base é
// entrega própria, com dono e com ritmo — e a conferência 3 da migration U84
// (clientes COM coordenada / total) é a linha de base dele.

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { esperaMs } from "@/lib/ritmo";

/**
 * O User-Agent. A política do Nominatim pede uma aplicação identificável com um
 * contato válido — é assim que eles avisam antes de bloquear, em vez de
 * bloquear e pronto. Sem isto o serviço é livre para recusar de cara.
 */
const USER_AGENT = "Prever-Sistema/1.0 (davi@grupoprever.com.br)";

const TIMEOUT_MS = 4000;

/**
 * O RITMO — o intervalo mínimo entre duas chamadas deste ISOLATE.
 *
 * A conta mora em `@/lib/ritmo` (pura, e por isso assertível); aqui fica só o
 * `setTimeout` que dorme. Enquanto ela vivia colada a este `setTimeout`, ela
 * não tinha UMA asserção — o verificador é síncrono, e trocar o intervalo por
 * zero passava verde.
 *
 * É um freio HONESTO, e a honestidade é dizer o que ele não é. `ultimaChamada`
 * é estado de MÓDULO, logo é por ISOLATE — e o alvo de deploy é CLOUDFLARE
 * (`vite.config.ts`: nitro com cloudflare como target padrão). Em Workers o
 * isolate não é a exceção do escalonamento, é a unidade normal, criada e
 * reciclada livremente: dois isolates são dois freios independentes. Dizer
 * "duas instâncias" subestimava o alvo e faria o próximo leitor imaginar um
 * servidor.
 *
 * O que ele garante de verdade é que um clique repetido depressa, ou um laço
 * que alguém escreva amanhã, não vira RAJADA dentro do mesmo isolate. A defesa
 * REAL continua sendo estrutural e do lado de fora: não existe laço, efeito nem
 * lote chamando esta função.
 *
 * E ele NÃO é coberto pelo `TIMEOUT_MS`: o relógio é armado DEPOIS da espera,
 * então N cliques simultâneos fazem o N-ésimo esperar `(N−1) × INTERVALO` antes
 * de o timeout sequer começar a contar.
 */
const INTERVALO_MIN_MS = 1100;
let ultimaChamada = 0;

async function respeitarORitmo(): Promise<void> {
  const espera = esperaMs(ultimaChamada, Date.now(), INTERVALO_MIN_MS);
  ultimaChamada = Date.now() + espera;
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

/**
 * A CONSULTA: TEXTO LIVRE, E SÓ ELE.
 *
 * Os quatro formulários que chamam isto têm UM campo de endereço ("Rua, número,
 * bairro, cidade"), então é uma string que chega aqui e é uma string que vai
 * para o Nominatim. Não há segunda forma de consulta porque não há segundo
 * chamador: um `street`/`city`/`state`/`postalcode` opcional existiu neste
 * arquivo e foi APAGADO — nenhum chamador o preenchia, o ramo era inalcançável,
 * e código inerte acorda meses depois com quem não conhece os defeitos dele.
 *
 * E TEXTO LIVRE É COMO SE ERRA DE CIDADE: "Rua Conde de Linhares, 243" casa em
 * São Paulo E em Belo Horizonte, e o serviço escolhe uma por relevância, em
 * silêncio. A defesa que ESTA entrega tem contra isso não é a consulta
 * estruturada — é o `addressdetails=1` abaixo, que devolve bairro/cidade/UF
 * para um humano LER na tela e dizer "não é essa cidade". Separar o endereço em
 * campos seria mexer em quatro telas por um motivo que não é o desta entrega.
 */
const inputSchema = z.object({
  q: z.string().min(3).max(300),
});

export interface EnderecoResolvido {
  lat: number;
  lng: number;
  /**
   * O QUE O MAPA DEVOLVEU, e não o que foi perguntado. Estes quatro campos
   * existem para uma coisa: um humano LER e dizer "não é essa cidade". É a
   * única conferência que a coordenada tem — nada mais no sistema a reconfere,
   * porque todo rótulo impresso é o NOME DO PRÉDIO, que está certo. É por isso
   * que `addressdetails=1` vai na consulta.
   */
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  display_name: string;
}

export type RespostaDaGeocodificacao =
  | { ok: true; endereco: EnderecoResolvido }
  | { ok: false; motivo: "nao_encontrado" | "servico_falhou" };

export const geocodificarEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<RespostaDaGeocodificacao> => {
    const p = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      addressdetails: "1",
      // A operação é inteira brasileira. Restringir o país é grátis e mata de
      // uma vez a classe de erro "achou uma rua homônima em Portugal".
      countrycodes: "br",
      q: data.q,
    });

    try {
      await respeitarORitmo();
      const ctrl = new AbortController();
      // O RELÓGIO COBRE A LEITURA DO CORPO, e não só os cabeçalhos: um serviço
      // gratuito sob carga responde `200 OK` e para de mandar bytes, e um
      // `clearTimeout` disparado quando os cabeçalhos chegam deixaria
      // `r.json()` esperando para sempre. Por isso ele está no `finally`,
      // DEPOIS do `await r.json()` — é asserção de POSIÇÃO no verificador, não
      // de presença: um `grep` por `clearTimeout` fica verde nas duas versões.
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${p.toString()}`, {
          headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
          signal: ctrl.signal,
        });
        if (!r.ok) return { ok: false, motivo: "servico_falhou" };
        const arr = (await r.json()) as Array<{
          lat: string;
          lon: string;
          display_name?: string;
          address?: Record<string, string>;
        }>;
        if (!Array.isArray(arr) || arr.length === 0) return { ok: false, motivo: "nao_encontrado" };
        const a = arr[0];
        const lat = Number(a.lat);
        const lng = Number(a.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return { ok: false, motivo: "servico_falhou" };
        }
        const end = a.address ?? {};
        return {
          ok: true,
          endereco: {
            lat,
            lng,
            // O Nominatim chama o bairro de `suburb`, `neighbourhood` ou
            // `city_district` conforme a região; a cidade pode vir em `city`,
            // `town` ou `municipality`. Ler só uma das chaves devolveria `null`
            // para metade do Brasil, e um `null` aqui é uma conferência que o
            // humano não consegue fazer.
            bairro: end.suburb ?? end.neighbourhood ?? end.city_district ?? null,
            cidade: end.city ?? end.town ?? end.municipality ?? end.village ?? null,
            uf: end.state ?? null,
            display_name: a.display_name ?? "",
          },
        };
      } finally {
        clearTimeout(t);
      }
    } catch {
      // TODA falha degrada para o MESMO lugar: um motivo, e nenhum número.
      // Rede, timeout, JSON quebrado, cota estourada — quem chamou trata igual,
      // porque para quem chamou é igual: não há coordenada.
      return { ok: false, motivo: "servico_falhou" };
    }
  });
