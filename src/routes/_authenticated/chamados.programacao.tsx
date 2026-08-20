// Programação da equipe técnica — Etapa U3 da unificação.
// É a tela que o Vinicius usa hoje no SIGMA: quem vai onde, em que dia, e o
// que ainda está sem data. Ver docs/PLANO_UNIFICACAO.md §5.2.
//
// Desenhada para celular: em vez de uma grade semana × técnico (que não cabe
// na tela), um dia por vez, com a fila de quem ainda não foi agendado logo
// abaixo — que é a pergunta que ele realmente precisa responder.

import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza, atualizarChamado, type Chamado } from "@/features/chamados/data";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo,
  PRIORIDADE_LABEL, PRIORIDADE_CORES, type ChamadoPrioridade,
} from "@/lib/chamado-status";

export const Route = createFileRoute("/_authenticated/chamados/programacao")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("chamados.programacao");
    if (!ok) throw redirect({ to: destinoNegado("chamados.programacao") as any });
  },
  component: ProgramacaoPage,
});

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** AAAA-MM-DD no fuso local — comparar Date direto erra na virada do dia. */
function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ProgramacaoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  // programação é sobre deslocamento: só chamado de campo entra aqui
  const { data: ordens = [], isLoading } = useChamadosPorNatureza("campo");
  const { data: tecnicos = [] } = useTecnicos();

  const [dia, setDia] = useState(() => new Date());
  const [agendando, setAgendando] = useState<Chamado | null>(null);
  const [novaData, setNovaData] = useState("");
  const [novoTecnico, setNovoTecnico] = useState("");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const CARD: CSSProperties = { ...card(isLight), padding: "14px 16px" };

  // a semana começa no domingo do dia escolhido
  const semana = useMemo(() => {
    const base = new Date(dia);
    base.setDate(base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [dia]);

  const abertas = useMemo(() => ordens.filter((o) => chamadoEmAberto(o.status)), [ordens]);

  const doDia = useMemo(() => {
    const k = chaveDia(dia);
    return abertas.filter((o) => o.data_hora_agendada && chaveDia(new Date(o.data_hora_agendada)) === k);
  }, [abertas, dia]);

  const semData = useMemo(
    () =>
      abertas
        .filter((o) => !o.data_hora_agendada)
        .sort((a, b) => {
          const pa = situacaoPrazo(a.prazo_limite, a.status) === "estourado" ? 0 : 1;
          const pb = situacaoPrazo(b.prazo_limite, b.status) === "estourado" ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return (a.prazo_limite ?? "9").localeCompare(b.prazo_limite ?? "9");
        }),
    [abertas],
  );

  /** Quantas OS cada dia da semana já tem — o Vinicius equilibra por aqui. */
  const cargaPorDia = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of abertas) {
      if (!o.data_hora_agendada) continue;
      const k = chaveDia(new Date(o.data_hora_agendada));
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [abertas]);

  const porTecnico = useMemo(() => {
    const grupos: { id: string | null; nome: string; ordens: Chamado[] }[] = [];
    for (const t of tecnicos as any[]) {
      const lista = doDia.filter((o) => o.responsavel_id === t.id);
      if (lista.length > 0) grupos.push({ id: t.id, nome: t.nome ?? "—", ordens: lista });
    }
    const semDono = doDia.filter((o) => !o.responsavel_id);
    if (semDono.length > 0) grupos.push({ id: null, nome: "Sem técnico definido", ordens: semDono });
    return grupos;
  }, [doDia, tecnicos]);

  const programar = useMutation({
    mutationFn: async () => {
      if (!agendando) return;
      if (!novaData) throw new Error("Escolha a data do atendimento.");
      // meio-dia local evita o pulo de fuso que jogaria o agendamento para o
      // dia anterior no UTC
      const quando = new Date(`${novaData}T12:00:00`);
      await atualizarChamado(agendando.id, {
        data_hora_agendada: quando.toISOString(),
        responsavel_id: novoTecnico || null,
        // agendar é o que tira o chamado da fila de triagem
        status: agendando.status === "aberto" ? "agendado" : agendando.status,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      setAgendando(null);
      toast.success("Chamado programado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cartaoOs = (o: Chamado) => {
    const st = chamadoStatusInfo(o.status);
    const pr = PRIORIDADE_CORES[o.prioridade as ChamadoPrioridade];
    const atrasado = situacaoPrazo(o.prazo_limite, o.status) === "estourado";
    return (
      <div
        key={o.id}
        style={{
          padding: "10px 12px", borderRadius: 12,
          background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
          border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <button
          onClick={() => navigate({ to: "/chamados/$id", params: { id: o.id } })}
          style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
        >
          <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: textPrimary }}>
            {o.titulo}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 400, color: textSecondary, marginTop: 2 }}>
            {o.numero} · {o.cliente?.nome ?? "cliente"}
          </div>
        </button>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            padding: "3px 8px", borderRadius: 999,
            fontFamily: FONT, fontWeight: 600, fontSize: 9,
            letterSpacing: "0.06em", textTransform: "uppercase",
            color: isLight ? pr.light : pr.dark, background: pr.bg, border: `1px solid ${pr.border}`,
          }}>
            {PRIORIDADE_LABEL[o.prioridade as ChamadoPrioridade]}
          </span>
          <span style={{
            padding: "3px 8px", borderRadius: 999,
            fontFamily: FONT, fontWeight: 600, fontSize: 9,
            letterSpacing: "0.06em", textTransform: "uppercase",
            color: isLight ? st.colorLight : st.color, background: st.bg, border: `1px solid ${st.border}`,
          }}>
            {st.label}
          </span>
          {o.prazo_limite && (
            <span style={{
              marginLeft: "auto", fontFamily: FONT, fontSize: 10.5, fontWeight: 400,
              color: atrasado ? (isLight ? "#B1242E" : "#F17881") : textSecondary,
            }}>
              {textoPrazo(o.prazo_limite)}
            </span>
          )}
          <button
            onClick={() => {
              setAgendando(o);
              setNovaData(o.data_hora_agendada ? chaveDia(new Date(o.data_hora_agendada)) : chaveDia(dia));
              setNovoTecnico(o.responsavel_id ?? "");
            }}
            style={{
              padding: "5px 10px", borderRadius: 8, cursor: "pointer",
              background: isLight ? "#ffffff" : "rgba(255,255,255,0.05)",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
            }}
          >
            Programar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/chamados" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Programação</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {doDia.length} atendimento(s) no dia · {semData.length} sem data
          </div>
        </div>
      </div>

      {/* Semana */}
      <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => { const d = new Date(dia); d.setDate(d.getDate() - 7); setDia(d); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
        >
          <ChevronLeft size={18} />
        </button>
        {semana.map((d) => {
          const k = chaveDia(d);
          const ativo = k === chaveDia(dia);
          const carga = cargaPorDia[k] ?? 0;
          const hoje = k === chaveDia(new Date());
          return (
            <button
              key={k}
              onClick={() => setDia(d)}
              style={{
                flex: 1, padding: "7px 2px", borderRadius: 10, cursor: "pointer",
                border: ativo ? "none" : hoje
                  ? `1px solid ${gold}`
                  : isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                background: ativo ? GOLD_GRAD : "transparent",
                color: ativo ? "#08090E" : textPrimary,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}
            >
              <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 400, opacity: 0.75 }}>
                {DIA_CURTO[d.getDay()]}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>{d.getDate()}</span>
              <span style={{
                fontFamily: FONT, fontSize: 9, fontWeight: 600,
                color: ativo ? "#08090E" : carga > 0 ? gold : "transparent",
              }}>
                {carga > 0 ? carga : "·"}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => { const d = new Date(dia); d.setDate(d.getDate() + 7); setDia(d); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Agenda do dia, por técnico */}
      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Carregando…
        </div>
      ) : porTecnico.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "26px 16px" }}>
          <CalendarClock size={26} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>Nada programado neste dia</span>
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
            Use a fila abaixo para distribuir os chamados que ainda não têm data.
          </span>
        </div>
      ) : (
        porTecnico.map((g) => (
          <div key={g.id ?? "sem"} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {g.id === null && <UserX size={15} color={gold} />}
              <span style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
                textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
              }}>
                {g.nome}
              </span>
              <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                {g.ordens.length} atendimento(s)
              </span>
            </div>
            {g.ordens.map(cartaoOs)}
          </div>
        ))
      )}

      {/* Fila sem data */}
      {semData.length > 0 && (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={15} color={gold} />
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
              textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
            }}>
              Aguardando programação ({semData.length})
            </span>
          </div>
          {semData.map(cartaoOs)}
        </div>
      )}

      {/* Modal de programação */}
      {agendando && (
        <div
          onClick={() => setAgendando(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100, padding: 20,
            background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...card(isLight), padding: 18, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15 }}>{agendando.titulo}</div>
              <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, marginTop: 2 }}>
                {agendando.numero} · {agendando.cliente?.nome ?? "cliente"}
              </div>
            </div>
            <div>
              <label style={{
                fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
                textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
              }}>
                Data
              </label>
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
                  background: isLight ? "#ffffff" : "#16161d",
                  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                  color: textPrimary, fontFamily: FONT, fontSize: 14,
                  outline: "none", colorScheme: isLight ? "light" : "dark",
                }}
              />
            </div>
            <div>
              <label style={{
                fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
                textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
              }}>
                Técnico
              </label>
              <select
                value={novoTecnico}
                onChange={(e) => setNovoTecnico(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
                  background: isLight ? "#ffffff" : "#16161d",
                  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                  color: textPrimary, fontFamily: FONT, fontSize: 14,
                  outline: "none", colorScheme: isLight ? "light" : "dark",
                }}
              >
                <option value="">Definir depois</option>
                {(tecnicos as any[]).map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setAgendando(null)}
                style={{
                  flex: 1, height: 46, borderRadius: 23, cursor: "pointer",
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: textSecondary, fontFamily: FONT, fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => programar.mutate()}
                disabled={programar.isPending || !novaData}
                style={{
                  flex: 2, height: 46, borderRadius: 23, border: "none", background: GOLD_GRAD,
                  color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
                  cursor: programar.isPending || !novaData ? "default" : "pointer",
                  opacity: programar.isPending || !novaData ? 0.6 : 1,
                }}
              >
                {programar.isPending ? "Salvando…" : "Programar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
