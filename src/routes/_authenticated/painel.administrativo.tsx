// Painel Administrativo — R27, reorganizado pela R131 (U94).
//
// O domínio de quem cuida da casa: gente, acesso, catálogo e integrações. É o
// painel mais restrito dos três — por padrão nenhum papel da matriz o abre, o
// que na prática o deixa só com o admin (que passa por regra de sistema, sem
// linha na matriz).
//
// ── O QUE MUDOU NA R131 (Davi, 03/09/2026) ────────────────────────────────
// "Os usuários podem ser listados diretamente nesta página e as permissões
// estarem junto. A parte de configuração de APIs pode ter um botão na página
// Administrativa. O Catálogo já faz mais sentido manter." E: "a página
// 'Contratos' na verdade não precisa existir — os contratos estarão na página
// de cada cliente" (R132).
//
// Então a página deixou de ser uma porta com cinco atalhos e passou a TER o
// conteúdo: três abas (Usuários · Permissões · APIs), com a lista de usuários e
// a matriz de acessos morando aqui — as rotas antigas `/gerencial/usuarios` e
// `/gerencial/permissoes` só redirecionam para a aba. Catálogo e Fechamentos
// continuam sendo telas próprias (têm trabalho demais para virar aba) e ficam
// como atalhos no topo. O atalho de Contratos SAIU: a lista morreu, e o
// contrato se cadastra e se abre na ficha do cliente.
//
// ── NÃO tem números de dinheiro na entrada ────────────────────────────────
// Fechamento é tela com valor em reais, e a R13 diz que o SAC não vê valores;
// um número grande na porta do painel vazaria por cima da regra que a tela de
// dentro respeita. Aqui os números são de ESTRUTURA — quantas pessoas, quantas
// esperando aprovação —, que é o que o painel precisa responder de relance.
//
// A aba mora na URL (`?aba=`), como a prospecção no Comercial (R38): o número
// "3 esperando aprovação" é um link para a aba certa, e o link é compartilhável.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Package, Plug, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado, usePermissoes } from "@/features/gerencial/permissoes";
import { useUserCargo } from "@/features/gerencial/data";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, espectroTexto } from "@/lib/paleta";
import { GestaoDeUsuarios } from "@/features/administrativo/Usuarios";
import { MatrizDePermissoes } from "@/features/administrativo/Permissoes";
import { Integracoes } from "@/features/administrativo/Integracoes";

const ABAS = ["usuarios", "permissoes", "apis"] as const;
type Aba = (typeof ABAS)[number];

const ABA_LABEL: Record<Aba, string> = {
  usuarios: "Usuários",
  permissoes: "Permissões",
  apis: "APIs",
};

export const Route = createFileRoute("/_authenticated/painel/administrativo")({
  validateSearch: (s: Record<string, unknown>) => ({
    aba: ABAS.includes(s.aba as Aba) ? (s.aba as Aba) : undefined,
  }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("painel.administrativo");
    if (!ok) throw redirect({ to: destinoNegado("painel.administrativo") as any });
  },
  component: PainelAdministrativo,
});

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
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: cargo } = useUserCargo();
  const { podeVer } = usePermissoes();
  const { data: casa } = useNumerosDaCasa();
  const busca = Route.useSearch();
  const aba: Aba = busca.aba ?? "usuarios";
  const isAdmin = cargo === "admin";

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const irParaAba = (a: Aba) =>
    navigate({ to: "/painel/administrativo", search: { aba: a } as any, replace: true });

  const numeros = useMemo(() => [
    { rotulo: "Usuários ativos", valor: casa?.ativos ?? 0, tom: 8 },
    // pendente de aprovação é o que trava alguém de trabalhar — vai no quente
    { rotulo: "Esperando aprovação", valor: casa?.pendentes ?? 0, tom: 2 },
    { rotulo: "Ativos sem cargo", valor: casa?.semCargo ?? 0, tom: 5 },
  ], [casa]);

  /**
   * Os atalhos para as telas que continuam sendo telas. Catálogo é só do
   * admin (a rota /admin exige o papel); Fechamentos obedece a matriz.
   * Atalho para porta trancada é armadilha — quem não pode, não vê.
   */
  const atalhos = [
    { label: "Catálogo", descricao: "Equipamentos, blocos e serviços de referência", icon: Package, para: "/admin", mostrar: isAdmin },
    { label: "Fechamentos", descricao: "O que foi apurado no período, para o financeiro", icon: CircleDollarSign, para: "/fechamentos", mostrar: podeVer("fechamentos") !== false },
  ].filter((a) => a.mostrar);

  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };
  const botaoAba = (ativa: boolean): CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    height: 34, padding: "0 14px", borderRadius: 17, cursor: "pointer",
    border: ativa ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativa ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)" : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativa ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
  });

  return (
    <div className="sangra-x" style={{ paddingTop: 18, paddingBottom: 140, display: "flex", flexDirection: "column", gap: 16, color: textPrimary }}>
      <div>
        <h1 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>
          Administrativo
        </h1>
        <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, marginTop: 2 }}>
          Gente, acesso, catálogo e integrações. Contratos e cobranças vivem na ficha de cada cliente.
        </div>
      </div>

      {/* Os números de estrutura — cada um leva à aba de usuários */}
      <div className="painel-numeros">
        {numeros.map((n) => {
          const cor = espectroTexto(n.tom, isLight);
          return (
            <button
              key={n.rotulo}
              className="elevavel"
              onClick={() => irParaAba("usuarios")}
              style={{
                ...card(isLight), borderRadius: 16, padding: "14px 12px",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                boxSizing: "border-box", minHeight: 96, border: "none", width: "100%", cursor: "pointer",
              }}
            >
              <div style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 34, color: cor,
                textShadow: `0 0 14px ${cor}59`, fontVariantNumeric: "tabular-nums", lineHeight: 1,
              }}>
                {n.valor}
              </div>
              <div style={{
                fontFamily: FONT, fontWeight: 500, fontSize: 9, letterSpacing: "0.05em",
                textTransform: "uppercase", color: textSecondary, lineHeight: 1.3, textAlign: "center", marginTop: 6,
              }}>
                {n.rotulo}
              </div>
            </button>
          );
        })}
      </div>

      {/* Atalhos para as telas que continuam sendo telas */}
      {atalhos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={MICRO}>Ir para</span>
          <div className="painel-atalhos">
            {atalhos.map(({ label, descricao, icon: Icon, para }) => (
              <button
                key={label}
                className="elevavel"
                onClick={() => navigate({ to: para as any })}
                style={{
                  ...card(isLight), borderRadius: 16, padding: "14px 16px",
                  display: "flex", alignItems: "flex-start", gap: 12,
                  textAlign: "left", cursor: "pointer", color: textPrimary, border: "none", width: "100%",
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: gold,
                }}>
                  <Icon size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT, fontWeight: 600, fontSize: 13.5 }}>{label}</span>
                  <span style={{ display: "block", fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, marginTop: 2, lineHeight: 1.4 }}>
                    {descricao}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* As abas — o conteúdo mora AQUI (R131) */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {ABAS.map((a) => {
          const Icon = a === "usuarios" ? Users : a === "permissoes" ? ShieldCheck : Plug;
          return (
            <button key={a} onClick={() => irParaAba(a)} aria-pressed={aba === a} style={botaoAba(aba === a)}>
              <Icon size={13} />
              {ABA_LABEL[a]}
            </button>
          );
        })}
      </div>

      <div style={{ ...card(isLight), borderRadius: 18, padding: 16 }}>
        {aba === "apis" ? (
          <Integracoes />
        ) : !isAdmin ? (
          // As duas seções mexem em cargo e em matriz — é regra de CARGO, não de
          // matriz (a rota antiga já trancava assim), senão uma linha errada na
          // própria matriz tornaria a correção impossível pelo app.
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
            Usuários e permissões são editados pelo administrador.
          </div>
        ) : aba === "usuarios" ? (
          <GestaoDeUsuarios />
        ) : (
          <MatrizDePermissoes />
        )}
      </div>
    </div>
  );
}
