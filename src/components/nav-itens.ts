// Itens de navegação por papel — a fonte única que a sidebar (desktop) e a
// barra inferior (celular) consomem. Antes cada uma teria a sua lista, e a
// primeira mudança de menu faria as duas divergirem.

import { Building2, Calendar, Gauge, Home, LayoutGrid, User, type LucideIcon } from "lucide-react";

export interface ItemNav {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Chave em `permissoes_tela` (src/lib/telas.ts). Sem chave = sempre visível. */
  tela: string | null;
  /**
   * Só no menu lateral (desktop). A barra inferior do celular tem 5 vagas e o
   * caminho móvel continua sendo Gerencial → Clientes — que já existia.
   */
  soDesktop?: boolean;
}

/**
 * Barras por perfil (PRODUTO.md §4):
 *  admin/comercial → gestão completa
 *  sac             → coordena chamados e agenda visita; sem financeiro
 *  técnico (R7)    → 3 itens; os chamados dele vivem na Início
 *
 * A matriz de permissões (U11) filtra por cima disto: item cuja tela está
 * bloqueada some da navegação.
 */
export function itensDoCargo(cargo: string | null | undefined): ItemNav[] {
  if (cargo === "admin" || cargo === "comercial") {
    return [
      { to: "/dashboard", label: "Início", icon: Home, tela: "dashboard" },
      { to: "/calendario", label: "Calendário", icon: Calendar, tela: "calendario" },
      // R31: "Chamados" saiu do menu — a lista morreu, a Início entrega a fila.
      // A vaga que sobrou no celular devolveu Clientes à barra.
      { to: "/clientes", label: "Clientes", icon: Building2, tela: "clientes" },
      // R27: os painéis. No celular só o Operacional — o painel do dia a dia.
      // R32: o Comercial É a lista de visitas e propostas — o item aponta
      // direto para ela, sem painel-índice no meio.
      { to: "/painel/operacional", label: "Operacional", icon: Gauge, tela: "painel.operacional" },
      { to: "/gerencial", label: "Comercial", icon: LayoutGrid, tela: "gerencial", soDesktop: true },
      { to: "/painel/administrativo", label: "Administrativo", icon: Building2, tela: "painel.administrativo", soDesktop: true },
      { to: "/perfil", label: "Perfil", icon: User, tela: "perfil" },
    ];
  }
  if (cargo === "sac") {
    return [
      { to: "/dashboard", label: "Início", icon: Home, tela: "dashboard" },
      { to: "/calendario", label: "Calendário", icon: Calendar, tela: "calendario" },
      // R31: sem "Chamados" — e a vaga do celular voltou para Clientes, que
      // só tinha saído da barra porque ela estava cheia.
      { to: "/clientes", label: "Clientes", icon: Building2, tela: "clientes" },
      // o SAC coordena: o Operacional é o painel dele. O Comercial (R32: a
      // própria lista de visitas) entra no desktop porque ele agenda a visita
      // de proposta (R24 tipo 1).
      { to: "/painel/operacional", label: "Operacional", icon: Gauge, tela: "painel.operacional" },
      { to: "/gerencial", label: "Comercial", icon: LayoutGrid, tela: "gerencial", soDesktop: true },
      { to: "/perfil", label: "Perfil", icon: User, tela: "perfil" },
    ];
  }
  return [
    { to: "/dashboard", label: "Início", icon: Home, tela: "dashboard" },
    { to: "/calendario", label: "Agenda", icon: Calendar, tela: "calendario" },
    { to: "/perfil", label: "Perfil", icon: User, tela: "perfil" },
  ];
}
