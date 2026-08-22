// Lógica pura do editor de estrutura de bloco (R63/U52) — separada de
// EditorBlocoCliente.tsx pelo mesmo motivo de sempre neste projeto: fica
// testável sem React e sem montar nada (ver blockAutoItems.ts, metricas.ts).

import type { BarreiraConfig, BlocoConfig, TipoBloco } from "@/lib/blocos";

/** Um ponto de partida razoável por tipo — o formulário nunca abre vazio. */
export function configPadrao(tipo: TipoBloco): BlocoConfig {
  switch (tipo) {
    case "PED":
      return { tipoBloco: "PED", eclusa: false, b1: { tipo: "PORP", entrada: "FAC", saida: "FAC" }, portaria: "PR" };
    case "VEI":
      return { tipoBloco: "VEI", eclusa: false, b1: { tipo: "PORV", entrada: "TAG", saida: "TAG" }, portaria: "PR" };
    case "CFTV":
      return { tipoBloco: "CFTV", eclusa: false, tecnologia: "IP", qtdDome: 0, qtdBullet: 0 };
    case "AL":
      return { tipoBloco: "AL", eclusa: false, tecnologia: "CAB" };
    case "CER":
      return { tipoBloco: "CER", eclusa: false, perimetro: 0, esquinas: 0 };
    case "CENT":
      return { tipoBloco: "CENT", eclusa: false, portaria: "PR" };
    default:
      // TIPOS_COM_ESTRUTURA (inventario.ts) já barra ELV/TOT antes de chegar
      // aqui — este ramo existe só pro TypeScript aceitar a função total
      return { tipoBloco: "PED", eclusa: false, b1: { tipo: "PORP", entrada: "FAC", saida: "FAC" }, portaria: "PR" };
  }
}

/**
 * Um bloco está pronto pra gerar código quando toda barreira TEM tipo, e
 * (exceto elevador) tem entrada e saída. Sem isto, salvar cedo demais grava
 * um `codigo_bloco` com buraco (ex.: "PED-1B-PORP-undefined-FAC-PR").
 */
export function barreiraCompleta(b: BarreiraConfig | undefined): boolean {
  if (!b?.tipo) return false;
  if (b.tipo === "ELEV") return !!b.tamanho && !!b.abertura;
  return !!b.entrada && !!b.saida;
}

export function configValida(c: BlocoConfig): boolean {
  if (c.tipoBloco === "CFTV") return !!c.tecnologia;
  if (c.tipoBloco === "AL") return !!c.tecnologia;
  if (c.tipoBloco === "CER") return true; // 0/0 é um valor válido, só ainda não medido
  if (c.tipoBloco === "CENT") return !!c.portaria;
  if (!barreiraCompleta(c.b1)) return false;
  if (c.eclusa && !barreiraCompleta(c.b2)) return false;
  return true;
}
