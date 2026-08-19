// Chamados — a lista unificada dos quatro trilhos (R8/R9): OS de campo,
// demandas internas (T.I, Patrimônio, SAC, Monitoramento…) e visitas técnicas
// de proposta, numa fila só. É a aba 3 do SAC; admin e comercial também usam.
// Ver docs/PRODUTO.md §3 e §4.1.
//
// Cada card leva para a página do trilho correspondente — esta tela agrega,
// não substitui: OS continua em /os/$id, demanda em /demandas/$id, visita no
// fluxo dela.

import { createFileRoute, useNavigate, redirect, useLocation, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp, BarChart3, Building2, CalendarClock, CheckCircle2, ClipboardList,
  FileText, Inbox, Search, Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { normalizarTexto } from "@/lib/normalizar";
import { visitaRouteFor } from "@/lib/visita-route";
import { getStatusInfo, isPendenteBucket, isAguardandoAprovacaoBucket } from "@/lib/visita-status";
import { osStatusInfo, osEmAberto, situacaoPrazo, textoPrazo, OS_PRIORIDADE_CORES, OS_PRIORIDADE_LABEL, type OsPrioridade } from "@/lib/os-status";
import { demandaStatusInfo, demandaEmAberto, textoPrazoDemanda } from "@/lib/demanda-status";
import { EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import { useDemandas, usePessoas, mapaDePessoas } from "@/features/demandas/data";

export const Route = createFileRoute("/_authenticated/chamados")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase
      .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
    if (!["admin", "comercial", "sac"].includes(perfil?.cargo ?? "")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: ChamadosPage,
});

// ── Modelo unificado do card ────────────────────────────────────────────────

type Trilho = "campo" | "demanda" | "proposta";

interface CardChamado {
  id: string;
  trilho: Trilho;
  /** equipe da demanda (só trilho demanda) — vira filtro */
  equipe: string | null;
  titulo: string;
  numero: string | null;
  cliente: string | null;
  responsavelId: string | null;
  emAberto: boolean;
  statusLabel: string;
  statusCor: { dark: string; light: string; bg: string; border: string };
  /** OS: prioridade para ordenar (urgente=0 … baixa=3; demais trilhos 4) */
  prioridadeRank: number;
  prioridadeLabel: string | null;
  prioridadeCor: { dark: string; light: string; bg: string; border: string } | null;
  /** instante de referência para "prazo": OS prazo_limite, demanda prazo, visita agendamento */
  prazoTexto: string | null;
  prazoEstourado: boolean;
  criadoEm: string;
  atualizadoEm: string;
  navegar: () => void;
}

type Situacao = "abertos" | "encerrados" | "todos";
type Ordenacao = "recentes" | "prazo" | "prioridade" | "cliente" | "atualizacao";

const ORDENACOES: { key: Ordenacao; label: string }[] = [
  { key: "recentes", label: "Mais recentes" },
  { key: "prazo", label: "Prazo mais apertado" },
  { key: "prioridade", label: "Prioridade" },
  { key: "cliente", label: "Cliente A→Z" },
  { key: "atualizacao", label: "Última atualização" },
];

function ChamadosPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { isLight } = useTheme();

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("abertos");
  const [trilho, setTrilho] = useState<string>("todos"); // todos | campo | proposta | eq:<equipe>
  const [responsavel, setResponsavel] = useState("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  const [menuOrdenar, setMenuOrdenar] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOrdenar) return;
    const h = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOrdenar(false);
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", h), 100);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", h); };
  }, [menuOrdenar]);

  // ── Fontes: os três registros (a RLS de gestor enxerga tudo) ──────────────
  const { data: ordens = [] } = useQuery({
    queryKey: ["chamados-os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico" as any)
        .select("id, numero, titulo, status, tipo, prioridade, prazo_limite, data_hora_agendada, tecnico_id, created_at, updated_at, cliente:clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  const { data: demandas = [] } = useDemandas();
  const { data: visitas = [] } = useQuery({
    queryKey: ["chamados-visitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, status, titulo, nome_predio, tecnico_id, data_hora_agendada, created_at, clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  const { data: pessoas = [] } = usePessoas();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

  // realtime dos três trilhos num canal só
  useEffect(() => {
    const canal = supabase
      .channel("chamados-unificado")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_servico" }, () =>
        qc.invalidateQueries({ queryKey: ["chamados-os"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "demandas" }, () =>
        qc.invalidateQueries({ queryKey: ["demandas"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas_tecnicas" }, () =>
        qc.invalidateQueries({ queryKey: ["chamados-visitas"] }))
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [qc]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";
  const CARD: CSSProperties = { ...card(isLight), padding: "14px 16px" };
  const PRI_RANK: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

  // ── Normalização para o modelo unificado ──────────────────────────────────
  const cards = useMemo<CardChamado[]>(() => {
    const lista: CardChamado[] = [];

    for (const o of ordens) {
      const st = osStatusInfo(o.status);
      const pr = OS_PRIORIDADE_CORES[o.prioridade as OsPrioridade] ?? null;
      lista.push({
        id: `os-${o.id}`,
        trilho: "campo",
        equipe: null,
        titulo: o.titulo,
        numero: o.numero,
        cliente: o.cliente?.nome ?? null,
        responsavelId: o.tecnico_id ?? null,
        emAberto: osEmAberto(o.status),
        statusLabel: st.label,
        statusCor: { dark: st.color, light: st.colorLight, bg: st.bg, border: st.border },
        prioridadeRank: PRI_RANK[o.prioridade] ?? 4,
        prioridadeLabel: OS_PRIORIDADE_LABEL[o.prioridade as OsPrioridade] ?? null,
        prioridadeCor: pr,
        prazoTexto: o.prazo_limite && osEmAberto(o.status) ? textoPrazo(o.prazo_limite) : null,
        prazoEstourado: situacaoPrazo(o.prazo_limite, o.status) === "estourado",
        criadoEm: o.created_at,
        atualizadoEm: o.updated_at ?? o.created_at,
        navegar: () => navigate({ to: "/os/$id", params: { id: o.id } }),
      });
    }

    for (const d of demandas) {
      const st = demandaStatusInfo(d.status);
      const aberto = demandaEmAberto(d.status);
      lista.push({
        id: `dem-${d.id}`,
        trilho: "demanda",
        equipe: d.equipe,
        titulo: d.titulo,
        numero: d.numero,
        cliente: d.cliente?.nome ?? null,
        responsavelId: d.responsavel_id,
        emAberto: aberto,
        statusLabel: st.label,
        statusCor: { dark: st.color, light: st.colorLight, bg: st.bg, border: st.border },
        prioridadeRank: 4,
        prioridadeLabel: null,
        prioridadeCor: null,
        prazoTexto: d.prazo && aberto ? textoPrazoDemanda(d.prazo) : null,
        prazoEstourado: aberto && !!d.prazo && d.prazo < new Date().toISOString().slice(0, 10),
        criadoEm: d.created_at,
        atualizadoEm: d.updated_at ?? d.created_at,
        navegar: () => navigate({ to: "/demandas/$id", params: { id: d.id } }),
      });
    }

    for (const v of visitas) {
      const info = getStatusInfo(v.status);
      const aberto = isPendenteBucket(v.status) || isAguardandoAprovacaoBucket(v.status);
      lista.push({
        id: `vis-${v.id}`,
        trilho: "proposta",
        equipe: null,
        titulo: v.nome_predio ?? v.titulo ?? v.clientes?.nome ?? "Visita técnica",
        numero: null,
        cliente: v.clientes?.nome ?? v.nome_predio ?? null,
        responsavelId: v.tecnico_id ?? null,
        emAberto: aberto,
        statusLabel: info.label,
        statusCor: { dark: info.color, light: info.color, bg: info.bg, border: info.border },
        prioridadeRank: 4,
        prioridadeLabel: null,
        prioridadeCor: null,
        prazoTexto:
          v.data_hora_agendada && aberto
            ? new Date(v.data_hora_agendada).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
            : null,
        prazoEstourado: false,
        criadoEm: v.created_at,
        atualizadoEm: v.created_at,
        navegar: () =>
          navigate({ ...visitaRouteFor(v.status, v.id), state: { from: location.pathname } } as any),
      });
    }
    return lista;
  }, [ordens, demandas, visitas, navigate, location.pathname]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const equipesComItens = useMemo(() => {
    const s = new Set<string>();
    for (const c of cards) if (c.trilho === "demanda" && c.equipe) s.add(c.equipe);
    return Array.from(s);
  }, [cards]);

  const filtrados = useMemo(() => {
    const termo = normalizarTexto(busca);
    return cards.filter((c) => {
      if (situacao === "abertos" && !c.emAberto) return false;
      if (situacao === "encerrados" && c.emAberto) return false;
      if (trilho === "campo" && c.trilho !== "campo") return false;
      if (trilho === "proposta" && c.trilho !== "proposta") return false;
      if (trilho.startsWith("eq:") && !(c.trilho === "demanda" && c.equipe === trilho.slice(3))) return false;
      if (responsavel !== "todos" && c.responsavelId !== responsavel) return false;
      if (!termo) return true;
      const resp = c.responsavelId ? pessoasPorId[c.responsavelId]?.nome ?? "" : "";
      return normalizarTexto(`${c.numero ?? ""} ${c.titulo} ${c.cliente ?? ""} ${resp}`).includes(termo);
    });
  }, [cards, situacao, trilho, responsavel, busca, pessoasPorId]);

  const ordenados = useMemo(() => {
    const l = [...filtrados];
    switch (ordenacao) {
      case "prazo":
        // estourados primeiro, depois quem tem prazo, sem prazo por último
        return l.sort((a, b) => {
          if (a.prazoEstourado !== b.prazoEstourado) return a.prazoEstourado ? -1 : 1;
          if (!!a.prazoTexto !== !!b.prazoTexto) return a.prazoTexto ? -1 : 1;
          return a.criadoEm < b.criadoEm ? -1 : 1;
        });
      case "prioridade":
        return l.sort((a, b) => a.prioridadeRank - b.prioridadeRank || (a.criadoEm < b.criadoEm ? 1 : -1));
      case "cliente":
        return l.sort((a, b) => (a.cliente ?? "…").localeCompare(b.cliente ?? "…", "pt-BR"));
      case "atualizacao":
        return l.sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
      default:
        return l.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
    }
  }, [filtrados, ordenacao]);

  const contagens = useMemo(() => ({
    abertos: cards.filter((c) => c.emAberto).length,
    campo: cards.filter((c) => c.trilho === "campo" && c.emAberto).length,
    proposta: cards.filter((c) => c.trilho === "proposta" && c.emAberto).length,
  }), [cards]);

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "8px 14px", borderRadius: 999,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo ? GOLD_GRAD : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });

  const TRILHO_ICONE: Record<Trilho, typeof Wrench> = {
    campo: Wrench,
    demanda: ClipboardList,
    proposta: FileText,
  };

  // rota filha (/chamados/novo) entra pelo Outlet
  if (pathname !== "/chamados") return <Outlet />;

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Chamados</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {contagens.abertos} em aberto · {contagens.campo} de campo · {contagens.proposta} proposta(s)
          </div>
        </div>
        {/* Painel (aba 1 do SAC, R8) */}
        <button
          onClick={() => navigate({ to: "/chamados/painel" })}
          title="Painel de chamados"
          style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <BarChart3 size={17} color={gold} />
        </button>
        {/* Abertura unificada (R9): uma porta, quatro trilhos */}
        <button
          onClick={() => navigate({ to: "/chamados/novo" })}
          style={{
            height: 42, padding: "0 14px", borderRadius: 12, border: "none", flexShrink: 0,
            background: GOLD_GRAD, color: "#08090E",
            display: "flex", alignItems: "center", gap: 6,
            fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(255,192,0,0.30)",
          }}
        >
          Abrir
        </button>
        {/* Ordenação — o "ícone para ordenar" da R8 */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMenuOrdenar((v) => !v)}
            title="Ordenar"
            style={{
              height: 42, padding: "0 13px", borderRadius: 12,
              background: isLight ? "#ffffff" : "#191921",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              color: textPrimary, display: "flex", alignItems: "center", gap: 7,
              cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
            }}
          >
            <ArrowDownUp size={15} color={gold} />
            {ORDENACOES.find((o) => o.key === ordenacao)?.label}
          </button>
          {menuOrdenar && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, minWidth: 200,
                background: isLight ? "#ffffff" : "rgba(14,14,20,0.97)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14, overflow: "hidden",
                boxShadow: isLight ? "0 10px 30px rgba(0,0,0,0.12)" : "0 12px 40px rgba(0,0,0,0.5)",
              }}
            >
              {ORDENACOES.map((o, i) => (
                <button
                  key={o.key}
                  onClick={() => { setOrdenacao(o.key); setMenuOrdenar(false); }}
                  style={{
                    width: "100%", padding: "12px 14px", textAlign: "left",
                    background: ordenacao === o.key ? (isLight ? "rgba(180,120,0,0.10)" : "rgba(255,192,0,0.10)") : "transparent",
                    border: "none",
                    borderBottom: i < ORDENACOES.length - 1
                      ? (isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.07)")
                      : "none",
                    color: textPrimary, fontFamily: FONT, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {ordenacao === o.key && <CheckCircle2 size={14} color={gold} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: "relative" }}>
        <Search size={16} color={textSecondary} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número, título, cliente ou responsável"
          style={{
            width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, padding: "0 14px 0 38px",
            background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
            border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, fontFamily: FONT, fontWeight: 300, fontSize: 14,
            outline: "none", colorScheme: isLight ? "light" : "dark",
          }}
        />
      </div>

      {/* Situação */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <button style={chip(situacao === "abertos")} onClick={() => setSituacao("abertos")}>
          Em aberto ({contagens.abertos})
        </button>
        <button style={chip(situacao === "encerrados")} onClick={() => setSituacao("encerrados")}>
          Encerrados
        </button>
        <button style={chip(situacao === "todos")} onClick={() => setSituacao("todos")}>
          Todos ({cards.length})
        </button>
      </div>

      {/* Trilho */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <button style={chip(trilho === "todos")} onClick={() => setTrilho("todos")}>Todos os trilhos</button>
        <button style={chip(trilho === "campo")} onClick={() => setTrilho("campo")}>
          Campo ({contagens.campo})
        </button>
        <button style={chip(trilho === "proposta")} onClick={() => setTrilho("proposta")}>
          Propostas ({contagens.proposta})
        </button>
        {equipesComItens.map((e) => {
          const n = cards.filter((c) => c.trilho === "demanda" && c.equipe === e && c.emAberto).length;
          return (
            <button key={e} style={chip(trilho === `eq:${e}`)} onClick={() => setTrilho(`eq:${e}`)}>
              {EQUIPE_LABEL[e as Equipe] ?? e} ({n})
            </button>
          );
        })}
      </div>

      {/* Responsável */}
      <select
        value={responsavel}
        onChange={(e) => setResponsavel(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 12px",
          background: isLight ? "#ffffff" : "#16161d",
          border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
          color: textPrimary, fontFamily: FONT, fontSize: 13.5,
          outline: "none", colorScheme: isLight ? "light" : "dark",
        }}
      >
        <option value="todos">Todos os responsáveis</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>

      {/* Lista */}
      {ordenados.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <Inbox size={28} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>Nada por aqui</span>
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
            Troque a situação, o trilho ou a busca para ver outros chamados.
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ordenados.slice(0, 200).map((c) => {
            const Icone = TRILHO_ICONE[c.trilho];
            const eqc = c.equipe ? equipeCores(c.equipe) : null;
            const resp = c.responsavelId ? pessoasPorId[c.responsavelId]?.nome ?? null : null;
            return (
              <button
                key={c.id}
                onClick={c.navegar}
                style={{ ...CARD, display: "block", width: "100%", textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Icone size={16} color={gold} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>
                      {c.titulo}
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary, marginTop: 3 }}>
                      {c.numero ? `${c.numero} · ` : ""}
                      {c.trilho === "campo" ? "Campo" : c.trilho === "proposta" ? "Proposta" : (EQUIPE_LABEL[c.equipe as Equipe] ?? "Demanda")}
                      {resp ? ` · ${resp}` : " · sem responsável"}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: "4px 9px", borderRadius: 999,
                    fontFamily: FONT, fontWeight: 600, fontSize: 9.5,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isLight ? c.statusCor.light : c.statusCor.dark,
                    background: c.statusCor.bg, border: `1px solid ${c.statusCor.border}`,
                  }}>
                    {c.statusLabel}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  {c.cliente && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontFamily: FONT, fontSize: 11, color: textSecondary,
                    }}>
                      <Building2 size={11} /> {c.cliente}
                    </span>
                  )}
                  {c.prioridadeLabel && c.prioridadeCor && (
                    <span style={{
                      padding: "2.5px 8px", borderRadius: 999,
                      fontFamily: FONT, fontWeight: 600, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: isLight ? c.prioridadeCor.light : c.prioridadeCor.dark,
                      background: c.prioridadeCor.bg, border: `1px solid ${c.prioridadeCor.border}`,
                    }}>
                      {c.prioridadeLabel}
                    </span>
                  )}
                  {eqc && c.equipe && (
                    <span style={{
                      padding: "2.5px 8px", borderRadius: 999,
                      fontFamily: FONT, fontWeight: 600, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: isLight ? eqc.light : eqc.dark, background: eqc.bg, border: `1px solid ${eqc.border}`,
                    }}>
                      {EQUIPE_LABEL[c.equipe as Equipe] ?? c.equipe}
                    </span>
                  )}
                  {c.prazoTexto && (
                    <span style={{
                      marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
                      fontFamily: FONT, fontWeight: 500, fontSize: 11,
                      color: c.prazoEstourado ? (isLight ? "#b91c1c" : "#F87171") : textSecondary,
                    }}>
                      <CalendarClock size={12} /> {c.prazoTexto}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {ordenados.length > 200 && (
            <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
              Mostrando 200 de {ordenados.length} — refine a busca ou os filtros.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
