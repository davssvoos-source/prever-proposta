// A cor de cada cliente — tirada do degradê da casa (ESPECTRO, paleta v7).
//
// A escolha é por HASH do id, não por sorteio: sorteio trocaria a cor a cada
// render, e a cor é como se reconhece o mesmo cliente no mapa E na lista — o
// ponto do mapa e o ponto do card usam esta mesma função, de propósito.
// (Mesma decisão dos avatares sem foto, pelo mesmo motivo.)
//
// R71: a bolinha deixou de ser cor CHAPADA e passou a ser o DEGRADÊ da casa,
// como o resto do sistema (Davi: "aplique o gradiente nas bolinhas"). Por
// isso o hash agora devolve o PASSO da rampa, não a cor pronta: a peça i vai
// de ESPECTRO[i] a ESPECTRO[i+1], e para desenhar isso é preciso o índice.
//
// O passo é `% PECAS_ESPECTRO` (8), não `% 9`: a rampa tem nove amostras
// justamente para servir oito peças — a nona é o fim da última. Um passo 8
// não teria par seguinte.

import { espectro, gradienteBarra, PECAS_ESPECTRO } from "@/lib/paleta";

/** O passo do cliente na rampa (0…7) — estável para o mesmo id. */
export function passoDoCliente(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % PECAS_ESPECTRO;
}

/** A cor SÓLIDA do cliente — o início do degradê dele. */
export function corDoCliente(id: string, isLight: boolean): string {
  return espectro(passoDoCliente(id), isLight);
}

/**
 * A bolinha do cliente em CSS: o degradê do passo dele, com a costura da
 * rampa tratada por `gradienteBarra` — o mesmo caminho das barras da Início.
 * (No mapa, que é SVG, quem desenha é `paradasBarra`; ver MapaClientes.)
 */
export function gradienteDoCliente(id: string, isLight: boolean): string {
  const passo = passoDoCliente(id);
  return gradienteBarra(espectro(passo, isLight), espectro(passo + 1, isLight), isLight);
}
