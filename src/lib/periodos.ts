// Períodos de fechamento — Etapa U4 da unificação.
// Portado de ~/Documents/gestor-os/src/lib/periodos.ts.
//
// A referência semanal usa ANO ISO, não o ano do calendário: 31/12/2025 cai na
// semana 1 de 2026, e usar o ano civil criaria duas referências "2025-S01" —
// uma em janeiro e outra em dezembro — colidindo no índice único do fechamento.

/** Segunda-feira da semana ISO da data. */
export function inicioSemana(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dia = r.getDay(); // 0 = domingo
  const desloca = dia === 0 ? -6 : 1 - dia;
  r.setDate(r.getDate() + desloca);
  return r;
}

/** Domingo da semana ISO da data, no fim do dia. */
export function fimSemana(d: Date): Date {
  const r = inicioSemana(d);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

/** Número e ano da semana ISO-8601 (a semana 1 é a que contém a 1ª quinta). */
export function semanaIso(d: Date): { ano: number; semana: number } {
  const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // joga para a quinta-feira da mesma semana: é ela que define o ano ISO
  alvo.setDate(alvo.getDate() + 3 - ((alvo.getDay() + 6) % 7));
  const ano = alvo.getFullYear();
  const primeiraQuinta = new Date(ano, 0, 4);
  primeiraQuinta.setDate(primeiraQuinta.getDate() + 3 - ((primeiraQuinta.getDay() + 6) % 7));
  const semana = 1 + Math.round((alvo.getTime() - primeiraQuinta.getTime()) / (7 * 86_400_000));
  return { ano, semana };
}

/** Referência do fechamento semanal: "2026-S08". */
export function referenciaSemanal(d: Date): string {
  const { ano, semana } = semanaIso(d);
  return `${ano}-S${String(semana).padStart(2, "0")}`;
}

/** Competência mensal: "2026-08". */
export function competencia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function inicioMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function fimMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Janela do período, pronta para filtrar cobranças. */
export function janela(tipo: "semanal" | "mensal", base: Date): { inicio: Date; fim: Date; referencia: string } {
  return tipo === "semanal"
    ? { inicio: inicioSemana(base), fim: fimSemana(base), referencia: referenciaSemanal(base) }
    : { inicio: inicioMes(base), fim: fimMes(base), referencia: competencia(base) };
}

/** "2026-08" → "agosto/2026"; "2026-S08" → "semana 8 de 2026". */
export function rotuloReferencia(referencia: string): string {
  const mensal = referencia.match(/^(\d{4})-(\d{2})$/);
  if (mensal) {
    const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${nomes[Number(mensal[2]) - 1]}/${mensal[1]}`;
  }
  const semanal = referencia.match(/^(\d{4})-S(\d{2})$/);
  if (semanal) return `semana ${Number(semanal[2])} de ${semanal[1]}`;
  return referencia;
}

/** AAAA-MM-DD no fuso local — toISOString() jogaria para o dia anterior. */
export function dataIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Parcelamento (regra do gestor-os) ───────────────────────────────────────

/**
 * Divide em centavos e joga o resto na PRIMEIRA parcela.
 * Trabalhar em reais com float faz 3 × 33,33 dar 99,99 — e o cliente paga a
 * menos para sempre. Em centavos o total fecha exato, sempre.
 */
export function parcelar(valorTotal: number, parcelas: number): number[] {
  const n = Math.max(1, Math.floor(parcelas));
  const centavos = Math.round(valorTotal * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos - base * n;
  return Array.from({ length: n }, (_, i) => ((i === 0 ? base + resto : base)) / 100);
}

/** Parcelamento padrão da Prever: instalação em até 60x, manutenção em 12x. */
export const PARCELAS_MAXIMAS = { instalacao: 60, manutencao: 12 } as const;
