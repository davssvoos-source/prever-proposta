// Painel Operacional — R27.
//
// O domínio de quem toca o trabalho acontecer: chamados abertos, quem está com
// o quê, a agenda das duplas e o que estourou prazo. É o painel do SAC e dos
// gestores, que segundo a R26 administram cronograma e agendamento.
//
// Os números aqui são de FILA, não de faturamento: o que decide o começo do
// dia de quem coordena. "Sem responsável" tem destaque de propósito — é a
// única linha que representa trabalho que ninguém pegou, e a fila aberta é
// deliberada no produto (o chamado sem dono é de todos).

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays, ClipboardList, Gauge, Users, Wrench, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useUserCargo } from "@/features/gerencial/data";
import { useChamados } from "@/features/chamados/data";
import { chamadoEmAberto, situacaoPrazo } from "@/lib/chamado-status";
import { PainelBase, type AtalhoPainel, type NumeroPainel } from "@/features/paineis/PainelBase";

export const Route = createFileRoute("/_authenticated/painel/operacional")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.operacional");
    if (!ok) throw redirect({ to: destinoNegado("painel.operacional") as any });
  },
  component: PainelOperacional,
});

const ATALHOS: AtalhoPainel[] = [
  { label: "Chamados", descricao: "A fila inteira, com filtros e ordenação",
    icon: Wrench, para: "/chamados", tela: "chamados" },
  { label: "Calendário", descricao: "Agenda de todos — visitas e chamados com data",
    icon: CalendarDays, para: "/calendario", tela: "calendario" },
  { label: "Programação das duplas", descricao: "Quem sai com quem, e para onde",
    icon: Users, para: "/chamados/programacao", tela: "chamados.programacao" },
  { label: "Indicadores de campo", descricao: "SLA, carga por técnico, tempo médio",
    icon: Gauge, para: "/chamados/indicadores", tela: "chamados.indicadores" },
  { label: "Painel de chamados", descricao: "Dashboards e a série de manutenções",
    icon: ClipboardList, para: "/chamados/painel", tela: "chamados.painel" },
  { label: "Clientes", descricao: "A base vinda do QAP, com equipamentos por posto",
    icon: Building2, para: "/clientes", tela: "clientes" },
];

function PainelOperacional() {
  const { data: cargo } = useUserCargo();
  const { data: chamados = [] } = useChamados();

  const numeros = useMemo<NumeroPainel[]>(() => {
    const abertos = chamados.filter((c: any) => chamadoEmAberto(c.status));
    const semDono = abertos.filter((c: any) => !c.responsavel_id).length;
    const atrasados = abertos.filter(
      (c: any) => situacaoPrazo(c.prazo_limite, c.status) === "estourado",
    ).length;
    const urgentes = abertos.filter((c: any) => c.prioridade === "urgente").length;
    return [
      // as posições no espectro vão do frio ao quente conforme a urgência —
      // a mesma leitura dos cards da Início
      { rotulo: "Chamados em aberto", valor: abertos.length, tom: 8, para: "/chamados" },
      { rotulo: "Sem responsável", valor: semDono, tom: 5, para: "/chamados" },
      { rotulo: "Prazo estourado", valor: atrasados, tom: 0, para: "/chamados" },
      { rotulo: "Urgentes", valor: urgentes, tom: 2, para: "/chamados" },
    ];
  }, [chamados]);

  return (
    <PainelBase
      titulo="Painel Operacional"
      subtitulo="A fila de campo: o que está aberto, com quem está e o que venceu"
      numeros={numeros}
      atalhos={ATALHOS}
      isAdmin={cargo === "admin"}
    />
  );
}
