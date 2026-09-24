// Painel Comercial (/gerencial) — R32, revisado de ponta a ponta na R64.
//
// UMA LISTA SÓ. O ciclo comercial inteiro mora aqui: visita técnica pendente
// → visita feita (aguardando aprovação interna → aprovada) → PROPOSTA
// ENVIADA a quem a solicitou — e no envio o ciclo ENCERRA. Este sistema não
// mapeia aceite/recusa do cliente (decisão explícita, R38/R64): o funil
// termina em "Enviadas".
//
// O QUE SAIU NA R64 (2026-08-22, Davi: "3 botões redundantes... remova"):
// · a aba "Visitas e propostas" — aba única é botão para lugar nenhum;
// · a aba "Prospecção" — a lista de prospecção saiu da interface (a tabela
//   `prospeccoes` continua no banco; o trabalho de prospecção vive nos
//   chamados de natureza comercial, na Início);
// · o botão "Histórico" — levava a outra página com a mesma lista de
//   visitas; /historico virou redirect para a Início (R165, U99).
//
// A leitura por etapa é derivada em features/comercial/etapas.ts (pura,
// coberta por asserção): o chip de cada linha, a coluna do quadro e o funil
// contam todos da MESMA função — não têm como discordar entre si.
//
// R302 (2026-09-15, Davi): o card "Funil comercial" virou um DASHBOARD de
// quatro peças (features/comercial/DashboardComercial.tsx, contas em
// metricas.ts); os chips por etapa saíram ("desnecessários") e entrou UM
// filtro de Tipo de serviço, que vale para a página inteira — dashboard,
// lista e quadro (R8); o botão "Clientes" saiu (Clientes tem menu próprio).

import { guardaDeTela } from "@/features/gerencial/permissoes";
import { createFileRoute, useNavigate, Outlet, useRouterState, useLocation, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, KanbanSquare, List as ListIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { visitaRouteFor } from "@/lib/visita-route";
import { FONT, GOLD_GRAD, card, botaoDaBarra, pilulaDaBarra } from "@/lib/ui";
// R302: ETAPA_CORES, ETAPA_ICONE e os ícones de etapa saíram daqui com os
// chips — quem pinta etapa agora é só CartaoDaVisita/QuadroComercial.
import { funilComercial, ETAPA_ORDEM } from "@/features/comercial/etapas";
import { CartaoDaVisita } from "@/features/comercial/CartaoDaVisita";
import { QuadroComercial } from "@/features/comercial/QuadroComercial";
import { DashboardComercial } from "@/features/comercial/DashboardComercial";
import { filtrarPorServico } from "@/features/comercial/metricas";
import { SERVICOS_PROPOSTOS } from "@/features/visitas/servicosPropostos";
import { MenuFiltro } from "@/features/home/MenuFiltro";
import { TelaDeErro } from "@/components/TelaDeErro";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/gerencial")({
  // Esta página É o Painel Comercial (R32). O SAC entra — ele agenda a visita
  // de proposta (R24). Cada rota filha tem a permissão dela: /gerencial/
  // permissoes e /gerencial/usuarios têm guarda própria de admin.
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const p = location.pathname;
    if (p.startsWith("/gerencial/permissoes") || p.startsWith("/gerencial/usuarios")) return;
    const chave = p.startsWith("/gerencial/nova") ? "gerencial.nova" : "gerencial";
    const { ok } = await guardaDeTela(chave);
    if (!ok) throw redirect({ to: "/dashboard" });
  },
  component: GerencialPage,
});

/**
 * R252: lista × quadro é PREFERÊNCIA de quem olha (R175) — mora no navegador,
 * como a da Início. Chave própria: as duas telas têm eixos diferentes.
 */
const CHAVE_VISAO_COMERCIAL = "prever-comercial-visao";

function GerencialPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const location = useLocation();
  const { isLight } = useTheme();

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // R302: o filtro de TIPO DE SERVIÇO — as chaves de servicosPropostos.ts
  // marcadas no MenuFiltro. Vazio é o padrão: a promessa da tela continua
  // sendo a lista INTEIRA. Estado local: é pergunta do momento, não
  // preferência de quem olha.
  const [servicos, setServicos] = useState<string[]>([]);
  // R252: o modo de visualização — lista (o de sempre) ou quadro por etapa
  const [visao, setVisao] = useState<"lista" | "quadro">(() => {
    try { return localStorage.getItem(CHAVE_VISAO_COMERCIAL) === "quadro" ? "quadro" : "lista"; } catch { return "lista"; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_VISAO_COMERCIAL, visao); } catch { /* modo privado */ }
  }, [visao]);

  const { data: visitasRaw = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["gerencial-visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select(`
            id,
            status,
            data_hora_agendada,
            endereco,
            servicos_solicitados,
            servicos_propostos,
            created_at,
            cliente_id,
            tecnico_id,
            titulo,
            nome_sindico,
            nome_predio,
            tipo_local,
            proposta_enviada_em,
            valor_anual_recorrente,
            valor_implantacao,
            clientes (nome, email)
          `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // R241: esta lista NÃO é a de responsáveis — é o de-para id → nome para
  // escrever no card quem atende a visita, e por isso inclui todo mundo
  // (uma visita antiga pode estar num perfil que hoje não é de campo). A chave
  // era `tecnicos-ativos`, a MESMA de useTecnicos(): quem montasse primeiro
  // ganhava o cache, e a lista de responsáveis da tela de agendar herdaria
  // comercial e SAC. Duas perguntas diferentes, duas chaves.
  const { data: tecnicos = [] } = useQuery({
    queryKey: ["perfis-ativos-nomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Marcar a proposta como enviada — o passo que ENCERRA o ciclo (R64).
   *
   * Usa a MESMA RPC da tela da visita (`registrar_envio_proposta`), e não um
   * update direto: ela é quem carimba a data e dispara a sincronização da
   * capa do chamado (U38). Um segundo caminho de escrita passaria a divergir
   * dela na primeira mudança de regra.
   */
  const marcarEnviada = useMutation({
    mutationFn: async (visitaId: string) => {
      const { error } = await supabase.rpc("registrar_envio_proposta" as any, {
        _visita_id: visitaId,
      } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      toast.success("Proposta enviada — o ciclo termina aqui.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin = linha em user_roles OU profiles.cargo === 'admin' (padrão do app).
  // Checar só user_roles escondia o botão de excluir de admins cadastrados via cargo.
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-gerencial"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const [{ data: roles }, { data: perfil }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("cargo").eq("id", u.user.id).maybeSingle(),
      ]);
      return (roles ?? []).some((r) => r.role === "admin") || (perfil as any)?.cargo === "admin";
    },
    staleTime: 60_000,
  });

  const handleDelete = async (visitaId: string) => {
    setIsDeleting(true);
    try {
      const { data: blocos } = await supabase.from("visita_blocos").select("id").eq("visita_id", visitaId);
      const blocoIds = (blocos ?? []).map((b) => b.id);
      if (blocoIds.length) {
        await supabase.from("visita_bloco_itens").delete().in("visita_bloco_id", blocoIds);
      }
      await supabase.from("visita_blocos").delete().eq("visita_id", visitaId);
      await supabase.from("fotos_visita").delete().eq("visita_id", visitaId);
      await supabase.from("visita_orcamentos").delete().eq("visita_id", visitaId);
      const { error } = await supabase.from("visitas_tecnicas").delete().eq("id", visitaId);
      if (error) throw error;
      toast.success("Proposta excluída com sucesso");
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ["gerencial-visitas"] });
    } catch (e: any) {
      toast.error("Erro ao excluir proposta", { description: e?.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const tecMap = useMemo(() => new Map(tecnicos.map((t) => [t.id, t.nome])), [tecnicos]);

  const visitas = visitasRaw as any[];
  // R302/R8: o filtro de Tipo de serviço recorta a página INTEIRA — o
  // dashboard, o funil do subtítulo, a lista e o quadro leem `exibidas`.
  const exibidas = useMemo(() => filtrarPorServico(visitas, servicos), [visitas, servicos]);
  const funil = useMemo(() => funilComercial(exibidas), [exibidas]);
  // um relógio só para todas as contas do render — os baldes do gráfico e
  // os KPIs precisam concordar sobre que semana é esta
  const agora = useMemo(() => new Date(), [visitasRaw]);

  if (pathname !== "/gerencial") {
    return <Outlet />;
  }

  return (
    <>
      {/* .sangra-x — a MESMA régua de margem da Início e de Clientes: colada
          na sidebar à esquerda, na borda da janela à direita. Era a única
          tela do domínio sem ela. */}
      <div className="sangra-x" style={{ paddingTop: 18, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 16, color: textPrimary }}>

        {/* Cabeçalho — título 22/700 (§3 "Título de página"), subtítulo 12.
            Só o DOMÍNIO COMERCIAL (R32): "Histórico" saiu (R64), "Mapa" saiu
            (R192) e "Clientes" saiu (R302) — Clientes tem item de menu próprio. */}
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 22,
            letterSpacing: "-0.01em", margin: 0,
          }}>
            Painel Comercial
          </h1>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, marginTop: 2 }}>
            {funil.visitas} proposta{funil.visitas !== 1 ? "s" : ""} · o ciclo encerra no envio
          </div>
        </div>

        {/* R302 — o DASHBOARD no lugar do card do funil: propostas enviadas
            por período (12 semanas ou 12 meses), rosca por tipo de serviço,
            o funil (R64, acaba no envio) e quatro KPIs. Lê as propostas JÁ
            filtradas: o filtro de Tipo de serviço vale para a página inteira.
            No celular ficam o funil (que o telefone já tinha) e os KPIs — os
            MESMOS painéis do desktop, empilhados; barras e rosca são
            `.so-desktop`. */}
        {!isError && (
          <DashboardComercial propostas={exibidas} agora={agora} carregando={isLoading} />
        )}

        {/* A barra de ferramentas (DS §6.26): o recorte à esquerda — o filtro
            de Tipo de serviço (R302), no lugar dos chips por etapa — e a
            ferramenta à direita: lista × quadro (R252, preferência de quem
            olha, gravada no navegador). */}
        <div className="trilho-x" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <MenuFiltro
            rotulo="Tipo de serviço"
            multi
            larguraMenu={280}
            opcoes={SERVICOS_PROPOSTOS.map((s) => ({ valor: s.key, label: s.label }))}
            selecionados={servicos}
            onMudar={setServicos}
          />
          <div style={{ flex: 1, minWidth: 8 }} />
          <button
            type="button"
            onClick={() => setVisao((atual) => (atual === "lista" ? "quadro" : "lista"))}
            title={visao === "lista" ? "Ver como quadro por etapa" : "Ver como lista"}
            aria-label={visao === "lista" ? "Ver como quadro por etapa" : "Ver como lista"}
            style={botaoDaBarra(isLight, gold)}
          >
            {visao === "lista" ? <KanbanSquare size={17} color={gold} /> : <ListIcon size={17} color={gold} />}
          </button>
        </div>

        {/* A lista — erro, carregando e vazio são três telas diferentes */}
        {isError ? (
          <TelaDeErro erro={error} pathname={pathname} aoTentarDeNovo={() => { void refetch(); }} />
        ) : isLoading ? (
          <div style={{ ...card(isLight), borderRadius: 16, paddingBlock: 28, paddingInline: 16, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
            Carregando propostas…
          </div>
        ) : exibidas.length === 0 ? (
          <div style={{ ...card(isLight), borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingBlock: 36, paddingInline: 20 }}>
            <FileText size={28} color={gold} />
            <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
              {visitas.length === 0
                ? "Nenhuma proposta cadastrada ainda"
                : servicos.length > 1
                  ? "Nenhuma proposta com esses tipos de serviço"
                  : "Nenhuma proposta com esse tipo de serviço"}
            </span>
            {visitas.length === 0 ? (
              <button
                onClick={() => navigate({ to: "/gerencial/nova" })}
                style={{
                  marginTop: 8, minHeight: 44, background: GOLD_GRAD,
                  border: "none", borderRadius: 22, paddingInline: 24,
                  color: "#0E0E0E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + Criar primeira proposta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setServicos([])}
                style={{ ...pilulaDaBarra(isLight, textPrimary), marginTop: 4 }}
              >
                Limpar filtro e ver a lista inteira
              </button>
            )}
          </div>
        ) : visao === "quadro" ? (
          <QuadroComercial
            visitas={exibidas}
            // R302: o quadro mostra sempre o ciclo inteiro — o recorte por
            // uma etapa saiu com os chips; o filtro da página é por serviço
            colunas={ETAPA_ORDEM}
            tecMap={tecMap}
            isAdmin={isAdmin}
            marcando={marcarEnviada.isPending}
            onAbrir={(v) => navigate({ ...visitaRouteFor(v.status as any, v.id), state: { from: location.pathname } } as any)}
            onMarcarEnviada={(id) => marcarEnviada.mutate(id)}
            onExcluir={(id) => setDeletingId(id)}
          />
        ) : (
          // A lista — todas as etapas juntas, cada linha dizendo a sua. O MESMO
          // componente do quadro, noutro formato (R252).
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {exibidas.map((v) => (
              <CartaoDaVisita
                key={v.id}
                v={v}
                formato="linha"
                tecnicoNome={v.tecnico_id ? tecMap.get(v.tecnico_id) : null}
                isAdmin={isAdmin}
                marcando={marcarEnviada.isPending}
                onAbrir={() => navigate({ ...visitaRouteFor(v.status, v.id), state: { from: location.pathname } } as any)}
                onMarcarEnviada={() => marcarEnviada.mutate(v.id)}
                onExcluir={() => setDeletingId(v.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && !isDeleting && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e não pode ser desfeita. Todos os dados desta visita técnica serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (deletingId) handleDelete(deletingId);
              }}
              className="rounded-full bg-[#E64D58] font-bold text-white hover:bg-[#DC2626]"
            >
              {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FAB — Nova Proposta */}
      <button
        onClick={() => navigate({ to: "/gerencial/nova" })}
        style={{
          position: "fixed",
          bottom: 100,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: GOLD_GRAD,
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(248,200,17,0.55), 0 0 40px rgba(248,200,17,0.25)",
          zIndex: 50,
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 6px 28px rgba(248,200,17,0.7), 0 0 50px rgba(248,200,17,0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(248,200,17,0.55), 0 0 40px rgba(248,200,17,0.25)";
        }}
        aria-label="Nova Proposta"
      >
        <Plus size={28} color="#0E0E0E" strokeWidth={2.5} />
      </button>
    </>
  );
}
