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
//   visitas; /historico continua existindo por URL, sem porta daqui.
//
// A leitura por etapa é derivada em features/comercial/etapas.ts (pura,
// coberta por asserção): o filtro por chip, o chip de cada linha e o funil
// contam todos da MESMA função — não têm como discordar entre si.

import { guardaDeTela, usePermissoes } from "@/features/gerencial/permissoes";
import { createFileRoute, useNavigate, Outlet, useRouterState, useLocation, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Clock, XCircle, FileText, FileClock, Send, CalendarDays, MapPin, User,
  Trash2, Building2, ChevronRight, MapPinned,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { visitaRouteFor } from "@/lib/visita-route";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import {
  etapaDaVisita, contagemPorEtapa, funilComercial, tituloDaVisita,
  ETAPA_ORDEM, ETAPA_LABEL, ETAPA_CORES, type EtapaComercial,
} from "@/features/comercial/etapas";
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

/** Ícone por etapa — status nunca é só cor (design system §2.4). */
const ETAPA_ICONE: Record<EtapaComercial, React.ElementType> = {
  visita_pendente: Clock,
  aguardando_aprovacao: FileClock,
  falta_proposta: FileText,
  enviada: Send,
  cancelada: XCircle,
};

function GerencialPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const location = useLocation();
  const { isLight } = useTheme();

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // filtro por etapa — chips com contagem, o mesmo padrão de Clientes (R41).
  // "todas" é o padrão: a promessa da tela é a lista INTEIRA numa tabela só.
  const [etapa, setEtapa] = useState<"todas" | EtapaComercial>("todas");

  const { data: visitasRaw = [], isLoading } = useQuery({
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
            created_at,
            cliente_id,
            tecnico_id,
            titulo,
            nome_sindico,
            nome_predio,
            tipo_local,
            proposta_enviada_em,
            clientes (nome, email)
          `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos-ativos"],
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
  const { podeVer } = usePermissoes();
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
  const contagem = useMemo(() => contagemPorEtapa(visitas), [visitas]);
  const funil = useMemo(() => funilComercial(visitas), [visitas]);
  const exibidas = useMemo(
    () => (etapa === "todas" ? visitas : visitas.filter((v) => etapaDaVisita(v) === etapa)),
    [visitas, etapa],
  );

  const chipFiltro = (ativo: boolean): CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo ? GOLD_GRAD : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  if (pathname !== "/gerencial") {
    return <Outlet />;
  }

  return (
    <>
      {/* .sangra-x — a MESMA régua de margem da Início e de Clientes: colada
          na sidebar à esquerda, na borda da janela à direita. Era a única
          tela do domínio sem ela. */}
      <div className="sangra-x" style={{ paddingTop: 18, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 16, color: textPrimary }}>

        {/* Cabeçalho — título 22/600 (§3 "Título de página"), subtítulo 12 */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontFamily: FONT, fontWeight: 600, fontSize: 22,
              letterSpacing: "-0.01em", margin: 0,
            }}>
              Painel Comercial
            </h1>
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, marginTop: 2 }}>
              {funil.visitas} proposta{funil.visitas !== 1 ? "s" : ""} · o ciclo encerra no envio
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Só o DOMÍNIO COMERCIAL (R32). "Histórico" saiu (R64): levava a
                outra página com a mesma lista de visitas — era a terceira
                porta para o que esta tela já mostra. */}
            {[
              { label: "Mapa", Icon: MapPinned, to: "/mapa" as const, tela: "mapa" },
              { label: "Clientes", Icon: Building2, to: "/clientes" as const, tela: "clientes" },
            ]
              // atalho que leva a uma tela bloqueada é armadilha: some junto
              .filter((a) => podeVer(a.tela) !== false)
              .map(({ label, Icon, to }) => (
                <button
                  key={label}
                  onClick={() => navigate({ to })}
                  style={{
                    minHeight: 40,
                    background: isLight ? "#ffffff" : "#191921",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: textPrimary,
                    boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                    fontFamily: FONT,
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={16} color={gold} />
                  {label}
                </button>
              ))}
          </div>
        </div>

        {/* Funil — TRÊS estágios, e acaba no envio (R64). "Aceitas/Recusadas"
            saíram: este sistema não mapeia o resultado no cliente, e mostrar
            estágio que nenhum fluxo preenche é fingir um dado que não existe. */}
        <div style={{ ...card(isLight), borderRadius: 16, padding: "16px 18px" }}>
          <div style={{
            fontFamily: FONT, fontSize: 10.5, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: gold, marginBottom: 12,
          }}>
            Funil comercial
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Visitas", value: funil.visitas, cor: gold },
              { label: "Aprovadas", value: funil.aprovadas, cor: isLight ? "#1d4ed8" : "#60A5FA" },
              { label: "Enviadas", value: funil.enviadas, cor: isLight ? "#047862" : "#2DD2A5" },
            ].map((f, i) => (
              <div key={f.label} style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                {i > 0 && <ChevronRight size={16} color={textSecondary} style={{ marginBottom: 6, flexShrink: 0 }} />}
                <div style={{ minWidth: 74 }}>
                  <div style={{
                    fontFamily: FONT, fontSize: 24, fontWeight: 700,
                    color: f.cor, fontVariantNumeric: "tabular-nums",
                  }}>
                    {f.value}
                  </div>
                  <div style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 400,
                    color: textSecondary, letterSpacing: "0.08em",
                    textTransform: "uppercase", marginTop: 2,
                  }}>
                    {f.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 400, color: textSecondary, marginTop: 12, lineHeight: 1.5 }}>
            Aprovação é interna. O ciclo encerra no envio da proposta a quem a solicitou — o aceite do cliente não é mapeado aqui.
          </div>
        </div>

        {/* Filtro por etapa — chips com contagem (o padrão de Clientes).
            Não é aba: o padrão é "Todas", a lista única que a tela promete. */}
        <div className="trilho-x" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={chipFiltro(etapa === "todas")} onClick={() => setEtapa("todas")}>
            {`Todas · ${funil.visitas}`}
          </button>
          {ETAPA_ORDEM.map((e) => (
            <button key={e} style={chipFiltro(etapa === e)} onClick={() => setEtapa(e)}>
              {`${ETAPA_LABEL[e]} · ${contagem[e]}`}
            </button>
          ))}
        </div>

        {/* A lista — todas as etapas juntas, cada linha dizendo a sua */}
        {isLoading ? (
          <div style={{ ...card(isLight), borderRadius: 16, padding: "28px 16px", textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
            Carregando propostas…
          </div>
        ) : exibidas.length === 0 ? (
          <div style={{ ...card(isLight), borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "36px 20px" }}>
            <FileText size={28} color={gold} />
            <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
              {visitas.length === 0 ? "Nenhuma proposta cadastrada ainda" : "Nada nesta etapa"}
            </span>
            {visitas.length === 0 ? (
              <button
                onClick={() => navigate({ to: "/gerencial/nova" })}
                style={{
                  marginTop: 8, minHeight: 44, background: GOLD_GRAD,
                  border: "none", borderRadius: 22, padding: "0 24px",
                  color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + Criar primeira proposta
              </button>
            ) : (
              <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
                Escolha outra etapa acima, ou "Todas" para a lista inteira.
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {exibidas.map((v) => {
              const et = etapaDaVisita(v);
              const cor = ETAPA_CORES[et];
              const Icone = ETAPA_ICONE[et];
              const dataVisita = v.data_hora_agendada
                ? new Date(v.data_hora_agendada).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                : "Sem data";
              // R78: o nome do lugar, com "Residência" na frente quando é
              // casa de pessoa física — a regra mora em etapas.ts
              const clienteNome = tituloDaVisita({
                tipo_local: v.tipo_local,
                cliente_nome: v.clientes?.nome,
                nome_predio: v.nome_predio,
                nome_sindico: v.nome_sindico,
                titulo: v.titulo,
              });
              const tecnicoNome = v.tecnico_id ? tecMap.get(v.tecnico_id) : null;
              const enviadaEm = v.proposta_enviada_em
                ? new Date(v.proposta_enviada_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                : null;

              return (
                <div
                  key={v.id}
                  className="elevavel"
                  onClick={() => navigate({ ...visitaRouteFor(v.status, v.id), state: { from: location.pathname } } as any)}
                  style={{
                    ...card(isLight), borderRadius: 16, padding: "14px 18px",
                    cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontFamily: FONT, fontWeight: 600, fontSize: 14,
                      marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {clienteNome}
                    </div>
                    <div style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 400, color: textSecondary,
                      lineHeight: 1.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
                    }}>
                      <CalendarDays size={12} style={{ opacity: 0.7 }} />
                      <span>{dataVisita}</span>
                      {v.endereco ? (<><span style={{ opacity: 0.4 }}>·</span><MapPin size={12} style={{ opacity: 0.7 }} /><span>{v.endereco}</span></>) : null}
                      {tecnicoNome ? (<><span style={{ opacity: 0.4 }}>·</span><User size={12} style={{ opacity: 0.7 }} /><span>{tecnicoNome}</span></>) : null}
                      {/* o carimbo que encerra o ciclo merece a linha de meta */}
                      {enviadaEm ? (<><span style={{ opacity: 0.4 }}>·</span><Send size={12} style={{ opacity: 0.7 }} /><span>Enviada em {enviadaEm}</span></>) : null}
                    </div>
                  </div>

                  {/* chip de etapa — véu 12% + borda 30% + ícone (§2.4) */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                    padding: "5px 11px", borderRadius: 999,
                    background: cor.bg, border: `1px solid ${cor.border}`,
                    color: isLight ? cor.light : cor.dark,
                    fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
                    letterSpacing: "0.05em", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>
                    <Icone size={13} />
                    {ETAPA_LABEL[et]}
                  </span>

                  {/* R78 — marcar como enviada, direto do card.
                      Só aparece na etapa "falta_proposta": antes dela não há
                      proposta aprovada para enviar, e depois o ciclo já
                      encerrou (R64). Chama a MESMA RPC que a tela da visita
                      (`registrar_envio_proposta`) — um segundo caminho de
                      escrita divergiria dela na primeira mudança de regra.
                      `stopPropagation` porque o card inteiro navega. */}
                  {et === "falta_proposta" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); marcarEnviada.mutate(v.id); }}
                      disabled={marcarEnviada.isPending}
                      title="Marcar a proposta como enviada — encerra o ciclo"
                      style={{
                        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                        height: 34, padding: "0 13px", borderRadius: 17, border: "none",
                        background: GOLD_GRAD, color: "#08090E",
                        fontFamily: FONT, fontWeight: 700, fontSize: 11.5,
                        letterSpacing: "0.03em", whiteSpace: "nowrap",
                        cursor: marcarEnviada.isPending ? "default" : "pointer",
                        opacity: marcarEnviada.isPending ? 0.6 : 1,
                      }}
                    >
                      <Send size={13} />
                      Proposta enviada
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(v.id); }}
                      aria-label="Excluir proposta"
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        width: 34, height: 34, borderRadius: 10, border: "none",
                        background: "rgba(230,77,88,0.10)", cursor: "pointer",
                      }}
                    >
                      <Trash2 size={15} color={isLight ? "#B1242E" : "#F17881"} />
                    </button>
                  )}
                </div>
              );
            })}
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
        <Plus size={28} color="#08090E" strokeWidth={2.5} />
      </button>
    </>
  );
}
