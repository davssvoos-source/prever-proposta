// A FOTO GUARDADA — como se grava e como se lê (R278).
//
// Os três buckets de foto (`blocos-fotos`, `visita-fotos`, `fotos-visitas`)
// deixaram de ser públicos na S1, em 20/08/2026. Duas telas continuaram
// chamando `getPublicUrl` neles e GRAVANDO a URL morta em
// `visitas_tecnicas.foto_fachada_url`: a de pré-envio da proposta e a de Nova
// Visita Técnica. Não era defeito de render — era dado ruim persistido em toda
// proposta e toda visita criadas desde aquele dia, e ninguém viu porque uma
// imagem que não carrega parece "o usuário não subiu foto".
//
// A regra, daqui em diante: guarda-se o ENDEREÇO DENTRO DO STORAGE
// (`bucket/caminho`), nunca uma URL. Quem mostra assina na hora.
//
// A leitura aceita as três formas que existem no banco hoje:
//   1. `blocos-fotos/fachadas/abc.jpg`  — o certo, daqui para a frente
//   2. `https://…/object/public/visita-fotos/visitas/123.jpg` — as mortas
//   3. `fachadas/abc.jpg` — caminho nu, sem bucket (assume `blocos-fotos`)
// e é por isso que as linhas velhas voltam a mostrar a foto sem migration: a
// URL morta carrega o caminho dentro dela.

import { supabase } from "@/integrations/supabase/client";

export const BUCKETS_DE_FOTO = ["blocos-fotos", "visita-fotos", "fotos-visitas", "fotos-os"] as const;
export type BucketDeFoto = (typeof BUCKETS_DE_FOTO)[number];

export interface EnderecoNoStorage {
  bucket: string;
  caminho: string;
}

/** `bucket/caminho` — o que se grava no banco. */
export function enderecoDeFoto(bucket: BucketDeFoto, caminho: string): string {
  return `${bucket}/${caminho}`;
}

/**
 * Lê as três formas e devolve onde a foto mora. `null` quando não dá para
 * saber — e null aqui significa "não mostre imagem", nunca "mostre quebrada".
 */
export function lerEndereco(guardado: string | null | undefined): EnderecoNoStorage | null {
  const s = (guardado ?? "").trim();
  if (!s) return null;

  // 2. URL do storage (pública ou assinada), viva ou morta
  if (s.startsWith("http")) {
    const m = s.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
    return m ? { bucket: m[1], caminho: m[2] } : null;
  }

  // 1. bucket/caminho
  const barra = s.indexOf("/");
  if (barra > 0) {
    const talvez = s.slice(0, barra);
    if ((BUCKETS_DE_FOTO as readonly string[]).includes(talvez)) {
      return { bucket: talvez, caminho: s.slice(barra + 1) };
    }
  }

  // 3. caminho nu — o único escritor que existiu foi a tela de pré-envio
  return { bucket: "blocos-fotos", caminho: s };
}

/** A URL que a tela pode usar por uma hora. `null` quando o storage recusa. */
export async function assinarFoto(
  guardado: string | null | undefined,
  segundos = 3600,
): Promise<string | null> {
  const end = lerEndereco(guardado);
  if (!end) return null;
  const { data, error } = await supabase.storage.from(end.bucket).createSignedUrl(end.caminho, segundos);
  if (error) return null;
  return data?.signedUrl ?? null;
}
