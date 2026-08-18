// Normalização de texto e documentos — Etapa U0 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §4.2.
//
// GÊMEO EXATO das funções SQL public.normalizar_texto() e
// public.somente_digitos() (migration 20260818120000_u0_fundacoes_unificacao).
// As duas precisam concordar: o banco usa as versões SQL em índice único e em
// coluna gerada (tecnico_aliases.nome_normalizado), e o app usa estas para
// procurar ANTES de gravar. Se divergirem, a busca não acha o que o índice já
// considera duplicado — e o insert falha com erro de constraint.
//
// A base do matching de equipamentos da U4 (normalizarChave do gestor-os) sai
// daqui.

/** Minúsculas, sem acento, espaços colapsados. Vazio vira "". */
export function normalizarTexto(t: string | null | undefined): string {
  return (t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chave de busca para casar descrições — normaliza e ainda remove pontuação,
 * porque "Câmera Bullet 4MP" e "camera-bullet 4mp" são o mesmo equipamento.
 * (normalizarChave do gestor-os, src/lib/pdf.ts.)
 */
export function normalizarChave(t: string | null | undefined): string {
  return normalizarTexto(t).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Só os dígitos — "11.222.333/0001-44" → "11222333000144". */
export function somenteDigitos(t: string | null | undefined): string {
  return (t ?? "").replace(/\D/g, "");
}

// ── CNPJ / CPF ──────────────────────────────────────────────────────────────
// O documento é a chave de reconciliação do financeiro e do de-para com o QAP:
// vale validar na digitação, porque um dígito errado só aparece no fechamento.

/** Formata para exibição conforme o tamanho (11 = CPF, 14 = CNPJ). */
export function formatarDocumento(t: string | null | undefined): string {
  const d = somenteDigitos(t);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return t ?? "";
}

/** Máscara progressiva, para usar no onChange do campo. */
export function mascararDocumento(t: string): string {
  const d = somenteDigitos(t).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

function digitosVerificadoresOk(base: string, pesos: number[]): boolean {
  const soma = pesos.reduce((acc, p, i) => acc + Number(base[i]) * p, 0);
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(base[pesos.length]);
}

export function validarCpf(t: string): boolean {
  const d = somenteDigitos(t);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  return (
    digitosVerificadoresOk(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    digitosVerificadoresOk(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  );
}

export function validarCnpj(t: string): boolean {
  const d = somenteDigitos(t);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  return (
    digitosVerificadoresOk(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
    digitosVerificadoresOk(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  );
}

/** CPF ou CNPJ válido. Campo vazio é válido: documento é opcional. */
export function validarDocumento(t: string | null | undefined): boolean {
  const d = somenteDigitos(t);
  if (!d) return true;
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}
