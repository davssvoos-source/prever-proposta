// Painel Administrativo — R27, reorganizado pela R131 (U94), pela R193 (U106)
// e pela R298 (15/09/2026).
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
// conteúdo: a lista de usuários e a matriz de acessos moram aqui — as rotas
// antigas `/gerencial/usuarios` e `/gerencial/permissoes` só redirecionam para
// a aba. O atalho de Contratos SAIU: a lista morreu, e o contrato se cadastra
// e se abre na ficha do cliente.
//
// ── O QUE MUDOU NA R298 (Davi, 15/09/2026) ────────────────────────────────
// "Remova as KPIs da tela Administrativo. Lembre-se de que a tela
// Administrativo é usado no Desktop por mim, usuário Adm, e o layout deve ser
// otimizado para que as informações fiquem espalhadas de maneira estratégica e
// eficiente."
//
// SAÍRAM: os três números de estrutura (usuários ativos, esperando aprovação,
// ativos sem cargo) — eram vitrine, e o que contavam já está nos rótulos das
// seções da aba Usuários ("Usuários Ativos (N)", "Solicitações de acesso (N)");
// o subtítulo "Gente, acesso, catálogo e integrações. Contratos e cobranças
// vivem na ficha de cada cliente." — o que ele dizia continua valendo (R132:
// contrato e cobrança se abrem na ficha do cliente) e fica registrado aqui,
// para quem lê o código; os cards "Ir para"; e o atalho Fechamentos, que foi
// para a Gestão Técnica (R299) — é a mesa do Vinicius, não a do admin.
//
// FICOU uma barra de ferramentas na régua da casa (DS §6.26: pílula de 40 e
// raio 11, gap 8): à esquerda as duas abas da mesa (Usuários · Permissões); à
// direita, encostados por `marginLeft: auto`, os atalhos (APIs, Viaturas,
// Equipamentos). O conteúdo da aba ocupa a largura toda — as duas colunas da
// R193 (1.45fr | 1fr) deixaram de caber: a matriz ganhou a quinta coluna
// (Gestor, R304) e a lista de usuários é densa; lado a lado, uma rolava dentro
// da outra.
//
// ── NÃO tem números de dinheiro na entrada ────────────────────────────────
// Fechamento é tela com valor em reais, e a R13 diz que o SAC não vê valores;
// um número grande na porta do painel vazaria por cima da regra que a tela de
// dentro respeita. Desde a R298 não há número nenhum na porta.
//
// A aba mora na URL (`?aba=`), como a prospecção no Comercial (R38): é por ela
// que os endereços antigos chegam (gerencial.usuarios → ?aba=usuarios) e o
// link para uma aba é compartilhável.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Car, Package, Plug, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado, usePermissoes } from "@/features/gerencial/permissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, pilulaDaBarra } from "@/lib/ui";
import { cinzas } from "@/lib/paleta";
import { GestaoDeUsuarios } from "@/features/administrativo/Usuarios";
import { MatrizDePermissoes } from "@/features/administrativo/Permissoes";
import { Integracoes } from "@/features/administrativo/Integracoes";
import { PainelDeViaturas } from "@/features/viaturas/PainelDeViaturas";

// R271 (U134): a aba Viaturas — cadastro dos carros, a sede e a folha
const ABAS = ["usuarios", "permissoes", "apis", "viaturas"] as const;
type Aba = (typeof ABAS)[number];

const ABA_LABEL: Record<Aba, string> = {
  usuarios: "Usuários",
  permissoes: "Permissões",
  apis: "APIs",
  viaturas: "Viaturas",
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

function PainelAdministrativo() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  // O cargo REAL de `profiles`, não o perfil de interface: useUserCargo()
  // devolve "admin" também para o gestor e para o comercial (R304 — eles
  // recebem a BARRA do admin, filtrada pela matriz). Convidar, aprovar e
  // editar a matriz são portas que o banco tranca com `cargo = 'admin'`; a
  // tela tem de trancar pelo mesmo critério, senão o gestor veria botões que
  // só devolvem "Acesso negado".
  const { podeVer, cargo: cargoReal, carregando } = usePermissoes();
  const busca = Route.useSearch();
  const aba: Aba = busca.aba ?? "usuarios";
  const isAdmin = cargoReal === "admin";

  // a escala de cinza do tema (R186) — texto e texto secundário saem daqui
  const cz = cinzas(isLight);
  const textPrimary = cz.texto;
  const textSecondary = cz.textoSecundario;

  const irParaAba = (a: Aba) =>
    navigate({ to: "/painel/administrativo", search: { aba: a } as any, replace: true });

  /**
   * Os atalhos para as telas que continuam sendo telas. Equipamentos obedece a
   * matriz — atalho para porta trancada é armadilha: quem não pode, não vê.
   * R198 (U109): era "Catálogo" (/admin), que o Davi mandou excluir; o catálogo
   * agora é "Equipamentos cadastrados". R298/R299: Fechamentos saiu daqui e
   * foi para a Gestão Técnica.
   */
  const atalhos = [
    { label: "Equipamentos", icon: Package, para: "/equipamentos", mostrar: podeVer("equipamentos") !== false },
  ].filter((a) => a.mostrar);

  // a pílula da barra (DS §6.26) — a medida mora em ui.ts, não aqui
  const pilula = (ativa: boolean): CSSProperties => pilulaDaBarra(isLight, textPrimary, ativa);
  // a casca do conteúdo: o card do design system com o padding nos quatro
  // lados declarado por eixo (anti-padrão nº 10: nunca o atalho `padding`)
  const CASCA: CSSProperties = { ...card(isLight), paddingInline: 16, paddingBlock: 16, minWidth: 0 };

  return (
    <div className="sangra-x" style={{ paddingTop: 18, paddingBottom: 140, display: "flex", flexDirection: "column", gap: 16, color: textPrimary }}>
      <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>
        Administrativo
      </h1>

      {/* A BARRA DE FERRAMENTAS (R298, DS §6.26). O recorte fica com o conteúdo,
        * à esquerda: as duas abas da mesa do admin. As ferramentas vão à
        * direita por `marginLeft: auto`: APIs e Viaturas trocam o conteúdo da
        * página (continuam sendo `?aba=`, por onde os endereços antigos chegam);
        * Equipamentos navega para a tela própria. A pílula ativa é a única
        * dourada — é ela que diz onde se está, por isso não há botão de voltar.
        * O hover é só CSS e só nas inativas — a classe .pilula-da-barra vive
        * em styles.css (borda e tinta douradas, sem degradê, dentro de @media
        * hover); a ativa já tem o degradê. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          id="adm-usuarios"
          onClick={() => irParaAba("usuarios")}
          aria-pressed={aba === "usuarios"}
          className={aba === "usuarios" ? undefined : "pilula-da-barra"}
          style={pilula(aba === "usuarios")}
        >
          <Users size={17} aria-hidden /> {ABA_LABEL.usuarios}
        </button>
        <button
          id="adm-permissoes"
          onClick={() => irParaAba("permissoes")}
          aria-pressed={aba === "permissoes"}
          className={aba === "permissoes" ? undefined : "pilula-da-barra"}
          style={pilula(aba === "permissoes")}
        >
          <ShieldCheck size={17} aria-hidden /> {ABA_LABEL.permissoes}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => irParaAba("apis")}
            aria-pressed={aba === "apis"}
            className={aba === "apis" ? undefined : "pilula-da-barra"}
            style={pilula(aba === "apis")}
          >
            <Plug size={17} aria-hidden /> {ABA_LABEL.apis}
          </button>
          <button
            onClick={() => irParaAba("viaturas")}
            aria-pressed={aba === "viaturas"}
            className={aba === "viaturas" ? undefined : "pilula-da-barra"}
            style={pilula(aba === "viaturas")}
          >
            <Car size={17} aria-hidden /> {ABA_LABEL.viaturas}
          </button>
          {atalhos.map(({ label, icon: Icon, para }) => (
            <button
              key={label}
              onClick={() => navigate({ to: para as any })}
              className="pilula-da-barra"
              style={pilula(false)}
            >
              <Icon size={17} aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {aba === "apis" ? (
        <div style={CASCA}>
          <Integracoes />
        </div>
      ) : aba === "viaturas" ? (
        <PainelDeViaturas />
      ) : carregando ? null : !isAdmin ? (
        // As duas seções mexem em cargo e em matriz — é regra de CARGO, não de
        // matriz (a rota antiga já trancava assim), senão uma linha errada na
        // própria matriz tornaria a correção impossível pelo app. Enquanto o
        // cargo não chegou, nada: dizer "editados pelo administrador" AO admin
        // por meio segundo seria mentir para depois se corrigir.
        <div style={{ ...CASCA, fontFamily: FONT, fontSize: 12.5, color: textSecondary, lineHeight: 1.5 }}>
          Usuários e permissões são editados pelo administrador.
        </div>
      ) : aba === "permissoes" ? (
        // R298: cada aba ocupa a largura toda; o rótulo da seção é a própria
        // pílula ativa da barra (aria-labelledby aponta para ela)
        <section aria-labelledby="adm-permissoes" style={CASCA}>
          <MatrizDePermissoes />
        </section>
      ) : (
        <section aria-labelledby="adm-usuarios" style={CASCA}>
          <GestaoDeUsuarios />
        </section>
      )}
    </div>
  );
}
