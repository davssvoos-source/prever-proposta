// A cor de cada cliente — tirada do degradê da casa (ESPECTRO, paleta v7).
//
// A escolha é por HASH do id, não por sorteio: sorteio trocaria a cor a cada
// render, e a cor é como se reconhece o mesmo cliente no mapa E na lista — o
// ponto do mapa e o ponto do card usam esta mesma função, de propósito.
// (Mesma decisão dos avatares sem foto, pelo mesmo motivo.)

import { espectro } from "@/lib/paleta";

export function corDoCliente(id: string, isLight: boolean): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return espectro(Math.abs(h) % 9, isLight);
}
