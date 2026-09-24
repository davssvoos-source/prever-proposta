// O TICKET DA PROPOSTA — os dois valores que a R306 manda gravar (U158).
//
// Davi, 23/09/2026: "o valor anual recorrente, ou seja, quanto o cliente paga
// por ano, e também o valor da implantação, que é o investimento inicial de
// equipamentos e instalação, guardados separadamente."
//
// A conta é a MESMA que a tela de pagamento e gerarProposta.ts já fazem para
// montar o PDF — aqui ela só é reunida numa função pura, para a tela gravar
// os dois números no momento em que gera a proposta e para o verificador
// prender a aritmética. Nada aqui lê o banco.

/** A forma de pagamento escolhida (o vocabulário de gerarProposta.ts). */
export type FormaDaProposta = "locacao_24" | "compra_vista" | "comodato_24" | "comodato_36" | "comodato_48" | "comodato_60";

export type PrazoDeComodato = 24 | 36 | 48 | 60;

export interface EntradaDosValores {
  forma: FormaDaProposta;
  /** os serviços mensais (I.As, totens, links…) — existem em toda forma */
  totalServicosMensais: number;
  /** a mensalidade da locação própria (24 meses) */
  locacaoMensal: number;
  /** a cascata do comodato, por prazo */
  comodato: Record<PrazoDeComodato, number>;
  /** locação: insumos + mão de obra, cobrada à parte */
  implantacaoTotal: number;
  /** compra: equipamentos + mão de obra */
  compraTotal: number;
}

export interface ValoresDaProposta {
  /** 12 × o total mensal da forma escolhida */
  anualRecorrente: number;
  /** o investimento inicial — zero no comodato (está diluído na mensalidade) */
  implantacao: number;
}

const centavos = (v: number): number => Math.round(v * 100) / 100;

/** A parcela mensal que a FORMA acrescenta aos serviços: locação, comodato ou nada (compra). */
export function mensalidadeDaForma(e: Pick<EntradaDosValores, "forma" | "locacaoMensal" | "comodato">): number {
  if (e.forma === "locacao_24") return e.locacaoMensal;
  if (e.forma === "compra_vista") return 0;
  const prazo = Number(e.forma.replace("comodato_", "")) as PrazoDeComodato;
  return e.comodato[prazo] ?? 0;
}

/** O investimento inicial da FORMA: insumos + mão de obra na locação, tudo na compra, nada no comodato. */
export function implantacaoDaForma(e: Pick<EntradaDosValores, "forma" | "implantacaoTotal" | "compraTotal">): number {
  if (e.forma === "locacao_24") return e.implantacaoTotal;
  if (e.forma === "compra_vista") return e.compraTotal;
  return 0;
}

/** Os dois números da R306, arredondados a centavos. */
export function valoresDaProposta(e: EntradaDosValores): ValoresDaProposta {
  const mensal = e.totalServicosMensais + mensalidadeDaForma(e);
  return {
    anualRecorrente: centavos(12 * mensal),
    implantacao: centavos(implantacaoDaForma(e)),
  };
}
