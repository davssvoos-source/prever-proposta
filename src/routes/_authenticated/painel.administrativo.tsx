// Painel Administrativo — R27.
//
// O domínio de quem cuida da casa: gente, permissão, contrato e dinheiro. É o
// painel mais restrito dos três — por padrão nenhum papel da matriz o abre, o
// que na prática o deixa só com o admin (que passa por regra de sistema, sem
// linha na matriz).
//
// NÃO tem números de faturamento na entrada. Contrato e fechamento são telas
// com valor em reais, e a R13 diz que o SAC não vê valores; um número grande na
// porta do painel vazaria por cima da regra que as telas de dentro respeitam.
// Aqui os números são de ESTRUTURA — quantas pessoas, quantas esperando
// aprovação —, que é o que o painel precisa responder de relance.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, FileText, Package, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useUserCargo } from "@/features/gerencial/data";
import { PainelBase, type AtalhoPainel, type NumeroPainel } from "@/features/paineis/PainelBase";

export const Route = createFileRoute("/_authenticated/painel/administrativo")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.administrativo");
    if (!ok) throw redirect({ to: destinoNegado("painel.administrativo") as any });
  },
  component: PainelAdministrativo,
});

const ATALHOS: AtalhoPainel[] = [
  { label: "Usuários", descricao: "Quem tem conta, cargo e equipe",
    icon: Users, para: "/gerencial/usuarios", tela: null, soAdmin: true },
  { label: "Permissões", descricao: "Quais telas cada papel abre",
    icon: ShieldCheck, para: "/gerencial/permissoes", tela: null, soAdmin: true },
  { label: "Contratos", descricao: "Cobertura e preços por cliente",
    icon: FileText, para: "/contratos", tela: "contratos" },
  { label: "Fechamentos", descricao: "O que foi apurado no período",
    icon: CircleDollarSign, para: "/fechamentos", tela: "fechamentos" },
  { label: "Catálogo", descricao: "Equipamentos e preços de referência",
    icon: Package, para: "/admin", tela: null, soAdmin: true },
];

/** Estrutura do time — sem valores, pelo motivo no cabeçalho do arquivo. */
function useNumerosDaCasa() {
  return useQuery({
    queryKey: ["painel-admin-numeros"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, ativo, status, cargo");
      if (error) return { ativos: 0, pendentes: 0, semCargo: 0 };
      const p = (data as any[]) ?? [];
      return {
        ativos: p.filter((x) => x.ativo).length,
        pendentes: p.filter((x) => x.status === "pendente_aprovacao").length,
        semCargo: p.filter((x) => x.ativo && !x.cargo).length,
      };
    },
  });
}

function PainelAdministrativo() {
  const { data: cargo } = useUserCargo();
  const { data: casa } = useNumerosDaCasa();

  const numeros = useMemo<NumeroPainel[]>(() => [
    { rotulo: "Usuários ativos", valor: casa?.ativos ?? 0, tom: 8, para: "/gerencial/usuarios" },
    // pendente de aprovação é o que trava alguém de trabalhar — vai no quente
    { rotulo: "Esperando aprovação", valor: casa?.pendentes ?? 0, tom: 2, para: "/gerencial/usuarios" },
    { rotulo: "Ativos sem cargo", valor: casa?.semCargo ?? 0, tom: 5, para: "/gerencial/usuarios" },
  ], [casa]);

  return (
    <PainelBase
      titulo="Painel Administrativo"
      subtitulo="Gente, permissão, contrato e apuração"
      numeros={numeros}
      atalhos={ATALHOS}
      isAdmin={cargo === "admin"}
    />
  );
}
