// Demandas internas — o quadro. Etapa U1 da unificação (substitui o Notion).
// Rotas filhas (/demandas/nova, /demandas/$id, /demandas/importar) entram pelo Outlet.
// Ver docs/PLANO_UNIFICACAO.md §5.1.

import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CalendarClock, Download, KanbanSquare, Plus, Search, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente } from "@/features/gerencial/data";
import {
  useDemandas, useDemandasRealtime, usePessoas, mapaDePessoas, type Demanda,
} from "@/features/demandas/data";
import {
  demandaStatusInfo, demandaEmAberto, situacaoPrazoDemanda, textoPrazoDemanda,
  SPRINT_ORDEM, SPRINT_LABEL, TIPO_DEMANDA_LABEL, TIPO_DEMANDA_CORES,
  type DemandaSprint, type DemandaTipo,
} from "@/lib/demanda-status";
import { EQUIPES, EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";

export const Route = createFileRoute("/_authenticated/demandas")({
  component: DemandasPage,
});

function DemandasPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: demandas = [], isLoading } = useDemandas();
  const { data: pessoas = [] } = usePessoas();
  const [busca, setBusca] = useState("");
  const [sprint, setSprint] = useState<DemandaSprint | "todos">("este_mes");
  const [equipe, setEquipe] = useState<Equipe | "todas">("todas");
  const [soMinhas, setSoMinhas] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useDemandasRealtime();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

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

  const abertas = useMemo(() => demandas.filter((d) => demandaEmAberto(d.status)), [demandas]);
  const contagem = useMemo(() => ({
    abertas: abertas.length,
    minhas: abertas.filter((d) => d.responsavel_id === userId).length,
    atrasadas: abertas.filter((d) => situacaoPrazoDemanda(d.prazo, d.status) === "atrasada").length,
    semDono: abertas.filter((d) => !d.responsavel_id).length,
  }), [abertas, userId]);

  const lista = useMemo(() => {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const termo = norm(busca.trim());
    return demandas.filter((d) => {
      if (sprint !== "todos" && d.sprint !== sprint) return false;
      if (equipe !== "todas" && d.equipe !== equipe) return false;
      if (soMinhas && d.responsavel_id !== userId) return false;
      if (!termo) return true;
      const resp = d.responsavel_id ? pessoasPorId[d.responsavel_id]?.nome ?? "" : "";
      return norm(
        `${d.numero ?? ""} ${d.titulo} ${d.descricao ?? ""} ${d.cliente?.nome ?? ""} ${resp}`,
      ).includes(termo);
    });
  }, [demandas, sprint, equipe, soMinhas, busca, userId, pessoasPorId]);

  // dentro do sprint, o que tem prazo mais apertado sobe
  const ordenada = useMemo(() => {
    const peso = (d: Demanda) => {
      if (!demandaEmAberto(d.status)) return 4;
      const s = situacaoPrazoDemanda(d.prazo, d.status);
      if (s === "atrasada") return 0;
      if (s === "hoje" || s === "amanha") return 1;
      if (s === "no_prazo") return 2;
      return 3;
    };
    return [...lista].sort((a, b) => {
      const pa = peso(a), pb = peso(b);
      if (pa !== pb) return pa - pb;
      if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
      if (a.prazo) return -1;
      if (b.prazo) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [lista]);

  if (pathname !== "/demandas") return <Outlet />;

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
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 20 }}>Demandas</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            {contagem.abertas} em aberto
            {contagem.atrasadas > 0 && ` · ${contagem.atrasadas} atrasada${contagem.atrasadas > 1 ? "s" : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {isGerente && (
            <button
              onClick={() => navigate({ to: "/demandas/importar" })}
              title="Importar do Notion"
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: isLight ? "#ffffff" : "#191921",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Download size={17} color={gold} />
            </button>
          )}
          <button
            onClick={() => navigate({ to: "/demandas/nova" })}
            style={{
              height: 42, padding: "0 16px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
              color: "#08090E", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12,
              cursor: "pointer", boxShadow: "0 4px 14px rgba(255,192,0,0.30)",
            }}
          >
            <Plus size={16} />
            Nova
          </button>
        </div>
      </div>

      {/* Busca */}
      <div style={{ position: "relative" }}>
        <Search size={16} color={textSecondary} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título, cliente ou responsável"
          style={{
            width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, padding: "0 14px 0 38px",
            background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
            border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
            outline: "none", colorScheme: isLight ? "light" : "dark",
          }}
        />
      </div>

      {/* Sprint */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {SPRINT_ORDEM.map((s) => {
          const n = demandas.filter((d) => d.sprint === s && demandaEmAberto(d.status)).length;
          return (
            <button key={s} style={chip(sprint === s)} onClick={() => setSprint(s)}>
              {SPRINT_LABEL[s]} ({n})
            </button>
          );
        })}
        <button style={chip(sprint === "todos")} onClick={() => setSprint("todos")}>
          Tudo ({demandas.length})
        </button>
      </div>

      {/* Equipe + meus */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <button style={chip(soMinhas)} onClick={() => setSoMinhas((v) => !v)}>
          Minhas ({contagem.minhas})
        </button>
        <button style={chip(equipe === "todas")} onClick={() => setEquipe("todas")}>
          Todas as equipes
        </button>
        {EQUIPES.map((e) => {
          const n = demandas.filter((d) => d.equipe === e && demandaEmAberto(d.status)).length;
          if (n === 0 && equipe !== e) return null;
          return (
            <button key={e} style={chip(equipe === e)} onClick={() => setEquipe(e)}>
              {EQUIPE_LABEL[e]} ({n})
            </button>
          );
        })}
      </div>

      {/* Aviso de demandas sem dono — a automação de segunda cobra isso */}
      {contagem.semDono > 0 && sprint !== "todos" && (
        <button
          onClick={() => { setSprint("todos"); setSoMinhas(false); setEquipe("todas"); }}
          style={{
            ...CARD,
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left",
            borderColor: isLight ? "rgba(180,120,0,0.30)" : "rgba(255,192,0,0.28)",
          }}
        >
          <UserX size={18} color={gold} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, color: textPrimary }}>
            {contagem.semDono} demanda{contagem.semDono > 1 ? "s" : ""} sem responsável — alguém precisa assumir.
          </span>
        </button>
      )}

      {/* Lista */}
      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
          Carregando demandas…
        </div>
      ) : ordenada.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <KanbanSquare size={28} color={gold} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, fontWeight: 600 }}>
            {demandas.length === 0 ? "Nenhuma demanda ainda" : "Nada neste filtro"}
          </span>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary, textAlign: "center" }}>
            {demandas.length === 0
              ? "Registre a primeira demanda ou importe o quadro do Notion."
              : "Troque o sprint ou a equipe para ver outras."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ordenada.map((d) => {
            const st = demandaStatusInfo(d.status);
            const sp = situacaoPrazoDemanda(d.prazo, d.status);
            const eqc = equipeCores(d.equipe);
            const tipoCor = d.tipo ? TIPO_DEMANDA_CORES[d.tipo as DemandaTipo] : null;
            const resp = d.responsavel_id ? pessoasPorId[d.responsavel_id] : null;
            const corPrazo = sp === "atrasada"
              ? (isLight ? "#b91c1c" : "#F87171")
              : sp === "hoje" || sp === "amanha"
                ? (isLight ? "#b45309" : "#c98500")
                : textSecondary;
            return (
              <button
                key={d.id}
                onClick={() => navigate({ to: "/demandas/$id", params: { id: d.id } })}
                style={{ ...CARD, display: "block", width: "100%", textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14,
                      color: textPrimary, lineHeight: 1.35,
                    }}>
                      {d.titulo}
                    </div>
                    <div style={{
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11.5,
                      color: textSecondary, marginTop: 3,
                    }}>
                      {d.numero}
                      {d.cliente?.nome ? ` · ${d.cliente.nome}` : ""}
                      {resp ? ` · ${resp.nome}` : " · sem responsável"}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: "4px 9px", borderRadius: 999,
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9.5,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isLight ? st.colorLight : st.color,
                    background: st.bg, border: `1px solid ${st.border}`,
                  }}>
                    {st.label}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 999,
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9.5,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: isLight ? eqc.light : eqc.dark,
                    background: eqc.bg, border: `1px solid ${eqc.border}`,
                  }}>
                    {EQUIPE_LABEL[d.equipe] ?? d.equipe}
                  </span>
                  {tipoCor && (
                    <span style={{
                      padding: "3px 8px", borderRadius: 999,
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9.5,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: isLight ? tipoCor.light : tipoCor.dark,
                      background: tipoCor.bg, border: `1px solid ${tipoCor.border}`,
                    }}>
                      {TIPO_DEMANDA_LABEL[d.tipo as DemandaTipo]}
                    </span>
                  )}
                  {demandaEmAberto(d.status) && (
                    <span style={{
                      display: "flex", alignItems: "center", gap: 4, marginLeft: "auto",
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 11,
                      color: corPrazo,
                    }}>
                      <CalendarClock size={12} />
                      {textoPrazoDemanda(d.prazo)}
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
