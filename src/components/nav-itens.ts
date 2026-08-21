// Itens de navegação por papel — a fonte única que a sidebar (desktop) e a
// barra inferior (celular) consomem. Antes cada uma teria a sua lista, e a
// primeira mudança de menu faria as duas divergirem.

import { Building2, Calendar, Gauge, Home, LayoutGrid, Target, User, Wrench, type LucideIcon } from "lucide-react";

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
 *  sac             → gestor de chamados, sem gerencial e sem financeiro
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
      { to: "/chamados", label: "Chamados", icon: Wrench, tela: "chamados" },
      { to: "/clientes", label: "Clientes", icon: Building2, tela: "clientes", soDesktop: true },
      { to: "/prospeccao", label: "Prospecção", icon: Target, tela: "prospeccao", soDesktop: true },
      // R27: "Gerencial" virou três painéis. No desktop cada um é um item; no
      // celular a barra tem 5 vagas e já estão tomadas, então lá vale só o
      // Operacional, que é o painel do dia a dia de quem coordena.
      { to: "/painel/operacional", label: "Operacional", icon: Gauge, tela: "painel.operacional" },
      { to: "/painel/comercial", label: "Comercial", icon: LayoutGrid, tela: "painel.comercial", soDesktop: true },
      { to: "/painel/administrativo", label: "Administrativo", icon: Building2, tela: "painel.administrativo", soDesktop: true },
      { to: "/perfil", label: "Perfil", icon: User, tela: "perfil" },
    ];
  }
  if (cargo === "sac") {
    return [
      { to: "/dashboard", label: "Início", icon: Home, tela: "dashboard" },
      { to: "/calendario", label: "Calendário", icon: Calendar, tela: "calendario" },
      { to: "/chamados", label: "Chamados", icon: Wrench, tela: "chamados" },
      // Clientes volta a ser só desktop no SAC: com o Painel Operacional na
      // barra, a vaga acabou — e o painel TEM atalho para Clientes, então o
      // caminho no celular continua existindo, com um toque a mais.
      { to: "/clientes", label: "Clientes", icon: Building2, tela: "clientes", soDesktop: true },
      { to: "/prospeccao", label: "Prospecção", icon: Target, tela: "prospeccao", soDesktop: true },
      // o SAC coordena: o Operacional é o painel dele. O Comercial entra no
      // desktop porque ele agenda a visita de proposta (R24 tipo 1).
      { to: "/painel/operacional", label: "Operacional", icon: Gauge, tela: "painel.operacional" },
      { to: "/painel/comercial", label: "Comercial", icon: LayoutGrid, tela: "painel.comercial", soDesktop: true },
      { to: "/perfil", label: "Perfil", icon: User, tela: "perfil" },
    ];
  }
  return [
    { to: "/dashboard", label: "Início", icon: Home, tela: "dashboard" },
    { to: "/calendario", label: "Agenda", icon: Calendar, tela: "calendario" },
    { to: "/perfil", label: "Perfil", icon: User, tela: "perfil" },
  ];
}
