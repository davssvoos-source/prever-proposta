// QUEM RESPONDE POR TRABALHO TÉCNICO (R241, U124) — lógica pura.
//
// Davi, 09/09/2026: "Gostaria também que você habilite os usuários Admin para
// fazer a visita técnica, eles devem aparecer na lista de técnicos disponíveis
// para agendar a visita como responsável."
//
// Até aqui "técnico" era literalmente `cargo = 'tecnico'`, e a consequência não
// era só a lista da visita: a GRADE da programação, o painel Operacional e as
// duplas montam as suas colunas a partir da mesma lista. Se um admin pudesse
// receber visita sem entrar nela, a visita dele existiria no banco e não
// apareceria em nenhuma agenda — o pior tipo de defeito, o que faz a tela
// mentir em silêncio. Por isso a lista é UMA, e mora aqui.
//
// O admin entra; comercial e SAC não. Eles montam e agendam a visita (permissão
// `gerencial.nova`), o que é outro papel — quem VAI ao prédio é o técnico, e
// agora também o admin, que na Prever é quem faz a visita quando a equipe está
// cheia.

/**
 * Os cargos que podem ser responsáveis por uma visita ou um chamado de campo.
 * R244: o OPERACIONAL entra — é para ele que o Nicholas e o Erik vão, e eles
 * são justamente quem hoje responde por visita e chamado. A ordem da lista é a
 * ordem em que aparecem para escolher: quem vai ao prédio todo dia primeiro.
 */
export const CARGOS_DE_CAMPO = ["tecnico", "operacional", "admin"] as const;
export type CargoDeCampo = (typeof CARGOS_DE_CAMPO)[number];

/** `cargo` pode responder por trabalho técnico? */
export function ehCargoDeCampo(cargo: string | null | undefined): boolean {
  return !!cargo && (CARGOS_DE_CAMPO as readonly string[]).includes(cargo);
}

/**
 * O rótulo na lista de responsáveis: o nome e, para quem não é do cargo
 * técnico, o cargo entre parênteses. Sem isso, um admin no meio dos técnicos
 * parece um técnico que ninguém conhece.
 */
export function rotuloDoResponsavel(p: { nome?: string | null; cargo?: string | null }): string {
  const nome = (p.nome ?? "").trim() || "—";
  return p.cargo && p.cargo !== "tecnico" ? `${nome} (${p.cargo})` : nome;
}

/**
 * Ordena a lista: técnicos primeiro, cada grupo em ordem alfabética. Quem vai
 * ao prédio todo dia aparece antes de quem vai por exceção.
 */
export function ordenarResponsaveis<T extends { nome?: string | null; cargo?: string | null }>(pessoas: readonly T[]): T[] {
  const posicao = (cargo?: string | null) => {
    const i = (CARGOS_DE_CAMPO as readonly string[]).indexOf(cargo ?? "");
    return i < 0 ? CARGOS_DE_CAMPO.length : i;   // desconhecido vai para o fim
  };
  return [...pessoas].sort((a, b) => {
    const d = posicao(a.cargo) - posicao(b.cargo);
    if (d !== 0) return d;
    return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR");
  });
}
