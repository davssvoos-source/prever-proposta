// Painel Comercial — R27.
//
// O domínio da proposta: visita técnica → aprovação interna → proposta →
// resposta do cliente. Os números são o funil, e o funil aqui é honesto sobre
// uma coisa que a R4 já dizia e a R21 reforçou: **visita aprovada não é
// cliente**. Aprovar a visita é ato nosso; quem aceita a proposta é o cliente,
// e quem vira cliente de verdade é decidido no QAP.
//
// Por isso o funil termina em "aceitas" e não em "clientes novos": o número de
// clientes é do ERP, não nosso. Contá-lo aqui seria inventar um dado.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { FileText, MapPinned, History, Target, ClipboardList, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useUserCargo, useVisitasGerencial } from "@/features/gerencial/data";
import { useProspeccoes } from "@/features/prospeccao/data";
import { PainelBase, type AtalhoPainel, type NumeroPainel } from "@/features/paineis/PainelBase";

export const Route = createFileRoute("/_authenticated/painel/comercial")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.comercial");
    if (!ok) throw redirect({ to: destinoNegado("painel.comercial") as any });
  },
  component: PainelComercial,
});

const ATALHOS: AtalhoPainel[] = [
  { label: "Visitas e propostas", descricao: "A lista completa, com o funil e os filtros",
    icon: ClipboardList, para: "/gerencial", tela: "gerencial" },
  { label: "Nova visita", descricao: "Monta a visita técnica que origina a proposta",
    icon: Plus, para: "/gerencial/nova", tela: "gerencial.nova" },
  { label: "Prospecção", descricao: "Prédios orçados que ainda não são clientes",
    icon: Target, para: "/prospeccao", tela: "prospeccao" },
  { label: "Mapa", descricao: "Onde estão as visitas, no mapa",
    icon: MapPinned, para: "/mapa", tela: "mapa" },
  { label: "Histórico", descricao: "O que já passou pelo comercial",
    icon: History, para: "/historico", tela: "historico" },
];

function PainelComercial() {
  const { data: cargo } = useUserCargo();
  const { data: visitas = [] } = useVisitasGerencial();
  const { data: prospeccoes = [] } = useProspeccoes();

  const numeros = useMemo<NumeroPainel[]>(() => {
    const v = visitas as any[];
    const enviadas = v.filter((x) => x.proposta_enviada_em).length;
    const aceitas = v.filter((x) => x.proposta_resultado === "aceita").length;
    const aguardando = v.filter(
      (x) => x.proposta_enviada_em && !x.proposta_resultado,
    ).length;
    const emProspeccao = prospeccoes.filter((p) => p.situacao === "em_prospeccao").length;
    return [
      // frio → quente conforme avança no funil; "aceitas" no amarelo, que é a
      // cor do desfecho que a casa persegue
      { rotulo: "Visitas registradas", valor: v.length, tom: 8, para: "/gerencial" },
      { rotulo: "Propostas enviadas", valor: enviadas, tom: 6, para: "/gerencial" },
      { rotulo: "Aguardando resposta", valor: aguardando, tom: 5, para: "/gerencial" },
      { rotulo: "Aceitas", valor: aceitas, tom: 4, para: "/gerencial" },
      { rotulo: "Em prospecção", valor: emProspeccao, tom: 7, para: "/prospeccao" },
    ];
  }, [visitas, prospeccoes]);

  return (
    <PainelBase
      titulo="Painel Comercial"
      subtitulo="Da visita à resposta do cliente — o funil da proposta"
      numeros={numeros}
      atalhos={ATALHOS}
      isAdmin={cargo === "admin"}
    />
  );
}
