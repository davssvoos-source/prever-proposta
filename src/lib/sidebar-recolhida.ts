// Estado de "sidebar recolhida" — um singleton fora do React, não Context.
//
// Três consumidores independentes precisam do MESMO valor sem prop-drilling:
// SideNav (a própria largura), o wrapper do layout autenticado (o --rail que
// empurra o <main>) e o popover de notificações (a posição do painel). Um
// Context exigiria envolver a árvore lá em cima só para isso; um módulo com
// useSyncExternalStore resolve com menos código e sem re-render de quem não
// assina.
//
// Persiste em localStorage: preferência de layout é do tipo que a pessoa só
// define uma vez e espera que fique.

import { useSyncExternalStore } from "react";

const CHAVE = "prever:sidebar-recolhida";

function lerInicial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    // Safari em modo privado lança em storage cheio/bloqueado — degrada para
    // "sempre expandida" em vez de quebrar a página
    return false;
  }
}

let recolhida = lerInicial();
const ouvintes = new Set<() => void>();

export function alternarSidebar(): void {
  recolhida = !recolhida;
  try {
    window.localStorage.setItem(CHAVE, recolhida ? "1" : "0");
  } catch {
    // idem — perder a persistência não é motivo para quebrar o toggle
  }
  ouvintes.forEach((f) => f());
}

function inscrever(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function instantaneo(): boolean {
  return recolhida;
}

/** false no servidor: a sidebar nasce expandida até o cliente ler o localStorage. */
function instantaneoServidor(): boolean {
  return false;
}

export function useSidebarRecolhida(): boolean {
  return useSyncExternalStore(inscrever, instantaneo, instantaneoServidor);
}

/** As duas larguras — em px, sem unidade, para composição em cálculos e em CSS. */
export const LARGURA_RAIL = 232;
export const LARGURA_RAIL_RECOLHIDA = 72;
