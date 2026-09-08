// Copiar para a área de transferência — o padrão seguro de TelaDeErro.tsx:68.
//
// `navigator.clipboard?.writeText` COM o optional chaining: em contexto não
// seguro (http), em iframe sem permissão ou em navegador antigo,
// `navigator.clipboard` é `undefined`, e um TypeError no clique seria a pior
// resposta possível para "copiar". Devolve `false` em vez de lançar: quem chama
// decide a frase ("selecione o texto e copie à mão").
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
