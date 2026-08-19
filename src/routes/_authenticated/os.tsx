// Chamados (ordens de serviço) — lista. Etapa 3 do sistema de OS.
// Técnico vê os seus (garantido pela RLS); gestor vê todos e abre novos.
// Rotas filhas (/os/nova, /os/$id) entram pelo Outlet.

import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Building2, CalendarClock, ClipboardList, Clock, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente } from "@/features/gerencial/data";
import { useOrdens } from "@/features/os/data";
import {
  osStatusInfo, osEmAberto, situacaoPrazo, textoPrazo,
  OS_TIPO_LABEL, OS_PRIORIDADE_LABEL, OS_PRIORIDADE_CORES,
  type OsPrioridade, type OsStatus,
} from "@/lib/os-status";

export const Route = createFileRoute("/_authenticated/os")({
  component: OsListaPage,
});

type Filtro = "abertos" | "meus" | "atrasados" | "todos" | OsStatus;

function OsListaPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: ordens = [], isLoading } = useOrdens();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // realtime: a lista acompanha abertura/execução/fechamento sem recarregar
  useEffect(() => {
    const canal = supabase
      .channel("os-realtime-lista")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens_servico" }, () => {
        qc.invalidateQueries({ queryKey: ["ordens-servico"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [qc]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };

  const contagem = useMemo(() => ({
    abertos: ordens.filter((o) => osEmAberto(o.status)).length,
    meus: ordens.filter((o) => o.tecnico_id === userId && osEmAberto(o.status)).length,
    atrasados: ordens.filter((o) => situacaoPrazo(o.prazo_limite, o.status) === "estourado").length,
    executados: ordens.filter((o) => o.status === "executada").length,
    todos: ordens.length,
  }), [ordens, userId]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ordens.filter((o) => {
      if (filtro === "abertos" && !osEmAberto(o.status)) return false;
      if (filtro === "meus" && !(o.tecnico_id === userId && osEmAberto(o.status))) return false;
      if (filtro === "atrasados" && situacaoPrazo(o.prazo_limite, o.status) !== "estourado") return false;
      if (filtro === "executada" && o.status !== "executada") return false;
      if (!termo) return true;
      const alvo = `${o.numero ?? ""} ${o.titulo} ${o.cliente?.nome ?? ""}`
        .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return alvo.includes(termo);
    });
  }, [ordens, filtro, busca, userId]);

  if (pathname !== "/os") return <Outlet />;

  const chip = (ativo: boolean, cor?: string): CSSProperties => ({
    padding: "8px 14px", borderRadius: 999,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo
      ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
      : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : cor ?? textPrimary,
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 20 }}>Chamados</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            {contagem.abertos} em aberto
            {contagem.atrasados > 0 && ` · ${contagem.atrasados} com prazo estourado`}
          </div>
        </div>
        {isGerente && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => navigate({ to: "/os/painel" })}
              title="Painel de indicadores"
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: isLight ? "#ffffff" : "#191921",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <BarChart3 size={17} color={gold} />
            </button>
            <button
              onClick={() => navigate({ to: "/chamados" })}
              title="Todos os chamados (os quatro trilhos)"
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: isLight ? "#ffffff" : "#191921",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ClipboardList size={17} color={gold} />
            </button>
            <button
              onClick={() => navigate({ to: "/os/programacao" })}
              title="Programação da equipe"
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: isLight ? "#ffffff" : "#191921",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <CalendarClock size={17} color={gold} />
            </button>
            <button
              onClick={() => navigate({ to: "/os/nova" })}
              style={{
                height: 42, padding: "0 16px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
                color: "#08090E", display: "flex", alignItems: "center", gap: 6,
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12,
                cursor: "pointer", boxShadow: "0 4px 14px rgba(255,192,0,0.30)",
              }}
            >
              <Plus size={16} />
              Abrir chamado
            </button>
          </div>
        )}
      </div>

      {/* Busca */}
      <div style={{ position: "relative" }}>
        <Search size={16} color={textSecondary} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por número, cliente ou assunto"
          style={{
            width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, padding: "0 14px 0 38px",
            background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
            border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
            outline: "none", colorScheme: isLight ? "light" : "dark",
          }}
        />
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <button style={chip(filtro === "abertos")} onClick={() => setFiltro("abertos")}>
          Em aberto ({contagem.abertos})
        </button>
        <button style={chip(filtro === "meus")} onClick={() => setFiltro("meus")}>
          Meus ({contagem.meus})
        </button>
        {contagem.atrasados > 0 && (
          <button
            style={chip(filtro === "atrasados", isLight ? "#b91c1c" : "#F87171")}
            onClick={() => setFiltro("atrasados")}
          >
            Atrasados ({contagem.atrasados})
          </button>
        )}
        {isGerente && (
          <button style={chip(filtro === "executada")} onClick={() => setFiltro("executada")}>
            A conferir ({contagem.executados})
          </button>
        )}
        <button style={chip(filtro === "todos")} onClick={() => setFiltro("todos")}>
          Todos ({contagem.todos})
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
          Carregando chamados…
        </div>
      ) : lista.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <ClipboardList size={28} color={gold} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 600 }}>
            {ordens.length === 0 ? "Nenhum chamado ainda" : "Nenhum chamado neste filtro"}
          </span>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary, textAlign: "center" }}>
            {ordens.length === 0
              ? isGerente
                ? "Abra o primeiro chamado para o técnico atender."
                : "Quando um chamado for atribuído a você, ele aparece aqui."
              : "Troque o filtro para ver os demais."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((o) => {
            const info = osStatusInfo(o.status);
            const cor = isLight ? info.colorLight : info.color;
            const prio = OS_PRIORIDADE_CORES[o.prioridade as OsPrioridade] ?? OS_PRIORIDADE_CORES.normal;
            const prazo = situacaoPrazo(o.prazo_limite, o.status);
            return (
              <button
                key={o.id}
                onClick={() => navigate({ to: "/os/$id", params: { id: o.id } })}
                style={{
                  ...CARD, textAlign: "left", cursor: "pointer", color: textPrimary,
                  borderLeft: `3px solid ${cor}`,
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 11, color: gold, letterSpacing: "0.06em" }}>
                    {o.numero ?? "—"}
                  </span>
                  <span
                    style={{
                      padding: "3px 8px", borderRadius: 12,
                      background: info.bg, border: `1px solid ${info.border}`, color: cor,
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}
                  >
                    {info.labelUpper}
                  </span>
                  {o.prioridade !== "normal" && (
                    <span
                      style={{
                        padding: "3px 8px", borderRadius: 12,
                        background: prio.bg, border: `1px solid ${prio.border}`,
                        color: isLight ? prio.light : prio.dark,
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}
                    >
                      {OS_PRIORIDADE_LABEL[o.prioridade as OsPrioridade] ?? o.prioridade}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: textSecondary }}>
                    {OS_TIPO_LABEL[o.tipo] ?? o.tipo}
                  </span>
                </div>

                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14 }}>{o.titulo}</div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Building2 size={12} color={textSecondary} style={{ flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
                    {o.cliente?.nome ?? "cliente"}
                    {o.sistema?.nome ? ` · ${o.sistema.nome}` : ""}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {o.data_hora_agendada && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                      <Clock size={11} />
                      {new Date(o.data_hora_agendada).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  )}
                  {(prazo === "estourado" || prazo === "proximo") && (
                    <span
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600,
                        color: prazo === "estourado" ? (isLight ? "#b91c1c" : "#F87171") : (isLight ? "#b45309" : "#FFC000"),
                      }}
                    >
                      <AlertTriangle size={11} />
                      {textoPrazo(o.prazo_limite)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
