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
import {
  AlertTriangle, ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Plus, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza, atualizarChamado, type Chamado } from "@/features/chamados/data";
import { useDuplas, useEscala } from "@/features/duplas/data";
import {
  composicaoDaDupla, duplaDaPessoaNaSemana, montarEscala, rotuloDaComposicao,
} from "@/features/duplas/modelo";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { referenciaSemanal } from "@/lib/periodos";
import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo,
  PRIORIDADE_LABEL, PRIORIDADE_CORES, TIPO_LABEL, TIPOS_DEMANDA_CAMPO,
  type ChamadoPrioridade, type ChamadoTipo,
} from "@/lib/chamado-status";

export const Route = createFileRoute("/_authenticated/chamados/programacao")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("chamados.programacao");
    if (!ok) throw redirect({ to: destinoNegado("chamados.programacao") as any });
  },
  component: ProgramacaoPage,
});

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES_NOME = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** AAAA-MM-DD no fuso local — comparar Date direto erra na virada do dia. */
function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ModoDeVisao = "semanal" | "mensal";

/** Os dois seletores de filtro (dupla, tipo) falam a mesma língua visual. */
const SELETOR_FILTRO = (isLight: boolean, textPrimary: string): CSSProperties => ({
  height: 38, borderRadius: 999, padding: "0 13px", cursor: "pointer",
  background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
  color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 12,
  outline: "none", colorScheme: isLight ? "light" : "dark",
});

function ProgramacaoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  // programação é sobre deslocamento: só chamado de campo entra aqui
  const { data: ordens = [], isLoading } = useChamadosPorNatureza("campo");
  const { data: tecnicos = [] } = useTecnicos();
  const { data: duplas = [] } = useDuplas();
  const { data: escala = montarEscala([], []) } = useEscala();

  const [dia, setDia] = useState(() => new Date());
  const [modo, setModo] = useState<ModoDeVisao>("semanal");
  const [duplaFiltro, setDuplaFiltro] = useState<string>("todas");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | ChamadoTipo>("todos");
  const [agendando, setAgendando] = useState<Chamado | null>(null);
  const [novaData, setNovaData] = useState("");
  const [novoTecnico, setNovoTecnico] = useState("");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const CARD: CSSProperties = { ...card(isLight), padding: "14px 16px" };

  const nomePorTecnico = useMemo(
    () => Object.fromEntries((tecnicos as any[]).map((t) => [t.id, t.nome ?? "—"])) as Record<string, string>,
    [tecnicos],
  );
  const nomeDeTecnico = (id: string) => nomePorTecnico[id] ?? "Técnico";

  /**
   * A semana do dia aberto. É o eixo de tudo que fala de equipe nesta tela:
   * desde a U76 "quem sai com quem" é pergunta com data, e a resposta de agosto
   * não vale para o que foi feito em junho.
   */
  const semanaDoDia = useMemo(() => referenciaSemanal(dia), [dia]);

  /** As equipes que TÊM composição na semana aberta — as que o filtro oferece. */
  const equipesDaSemana = useMemo(
    () => duplas
      .map((d) => ({ dupla: d, membros: composicaoDaDupla(d.id, semanaDoDia, escala) }))
      .filter((x) => x.membros.length > 0),
    [duplas, semanaDoDia, escala],
  );

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

  /**
   * A grade do mês (R57): sempre 6 linhas de 7 dias, começando no domingo da
   * semana em que o dia 1º cai. Seis linhas FIXAS, não "as que couberem" — um
   * mês que ocupa 5 linhas e outro que ocupa 6 fariam a página inteira pular
   * de altura ao trocar de mês, e o que está embaixo (a agenda) andaria junto.
   * Os dias de fora do mês aparecem apagados, como em qualquer calendário.
   */
  const gradeDoMes = useMemo(() => {
    const primeiro = new Date(dia.getFullYear(), dia.getMonth(), 1);
    const base = new Date(primeiro);
    base.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [dia]);

  const emAberto = useMemo(() => ordens.filter((o) => chamadoEmAberto(o.status)), [ordens]);

  /**
   * Os dois filtros novos (R57), aplicados JUNTOS a tudo que a tela mostra —
   * agenda do dia, fila sem data e a carga de cada dia do seletor. Se a carga
   * ignorasse o filtro, o número embaixo do dia prometeria atendimentos que a
   * agenda daquele dia não mostraria.
   *
   * A EQUIPE VEM DO RESPONSÁVEL (ver features/duplas/modelo.ts): filtrar por
   * equipe é ficar com os chamados de quem está nela. "Sem equipe" é opção
   * própria — é justamente a fatia que o gestor precisa achar para distribuir.
   *
   * Cada chamado é resolvido pela semana DELE, e não pela semana aberta na
   * tela: a régua de dias vai de domingo a sábado e atravessa a virada da
   * semana ISO, então o domingo da régua pertence à semana anterior. Chamado
   * ainda sem data usa a semana aberta — é o único palpite honesto, porque ele
   * não tem semana própria.
   */
  const equipeDoChamado = (o: { responsavel_id: string | null; data_hora_agendada: string | null }) =>
    duplaDaPessoaNaSemana(
      o.responsavel_id,
      o.data_hora_agendada ? referenciaSemanal(new Date(o.data_hora_agendada)) : semanaDoDia,
      escala,
    );

  const abertas = useMemo(() => emAberto.filter((o) => {
    if (tipoFiltro !== "todos" && o.tipo !== tipoFiltro) return false;
    if (duplaFiltro === "todas") return true;
    const d = equipeDoChamado(o);
    return duplaFiltro === "sem_equipe" ? !d : d === duplaFiltro;
  }), [emAberto, tipoFiltro, duplaFiltro, semanaDoDia, escala]);

  const filtrando = tipoFiltro !== "todos" || duplaFiltro !== "todas";

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

  /**
   * A agenda do dia agrupada pela EQUIPE DAQUELE DIA, caindo para o técnico
   * quando ele não está em nenhuma (R57). Agrupar por equipe evita a leitura
   * errada de duas linhas separadas ("Breno 3", "André 2") para um trabalho
   * que as duas pessoas fizeram JUNTAS: são 5 atendimentos da equipe, não 3 de
   * um e 2 do outro.
   *
   * A composição é a da SEMANA do dia aberto, não a de hoje — é o que faz
   * abrir a agenda de junho mostrar quem realmente saiu em junho. Itera
   * a lista inteira de equipes (não só as ativas) porque equipe desfeita continua
   * explicando as semanas em que saiu; quem não tem composição na semana
   * simplesmente não rende grupo.
   */
  const porGrupo = useMemo(() => {
    const grupos: { id: string; nome: string; sub: string | null; ordens: Chamado[] }[] = [];
    const jaListados = new Set<string>();

    for (const d of duplas) {
      const membros = composicaoDaDupla(d.id, semanaDoDia, escala);
      if (membros.length === 0) continue;
      const lista = doDia.filter((o) => o.responsavel_id && membros.includes(o.responsavel_id));
      if (lista.length === 0) continue;
      lista.forEach((o) => jaListados.add(o.id));
      grupos.push({
        id: d.id,
        nome: rotuloDaComposicao(d, membros, nomeDeTecnico),
        sub: membros.map(nomeDeTecnico).join(" · "),
        ordens: lista,
      });
    }

    // técnico com atendimento no dia mas fora de qualquer equipe naquela semana
    for (const t of tecnicos as any[]) {
      const lista = doDia.filter((o) => o.responsavel_id === t.id && !jaListados.has(o.id));
      if (lista.length === 0) continue;
      lista.forEach((o) => jaListados.add(o.id));
      grupos.push({ id: t.id, nome: t.nome ?? "—", sub: "Sem equipe", ordens: lista });
    }

    const semDono = doDia.filter((o) => !o.responsavel_id);
    if (semDono.length > 0) {
      grupos.push({ id: "sem-dono", nome: "Sem técnico definido", sub: null, ordens: semDono });
    }
    return grupos;
  }, [doDia, tecnicos, duplas, semanaDoDia, escala, nomePorTecnico]);

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
          onClick={() => navigate({ to: "/dashboard" })}
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
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>
            Programação da equipe técnica de campo
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {doDia.length} atendimento(s) no dia · {semData.length} sem data
            {filtrando && " · filtrado"}
          </div>
        </div>
        {/* "+" para abrir atividade nova já como chamado de CAMPO (R57) — o
            /chamados/novo genérico obrigaria a escolher a natureza de novo,
            e quem está nesta tela já está programando campo. */}
        <button
          onClick={() => navigate({ to: "/chamados/novo-campo" })}
          aria-label="Nova atividade para técnico de campo"
          title="Nova atividade para técnico de campo"
          style={{
            width: 40, height: 40, borderRadius: 12, border: "none", background: GOLD_GRAD,
            color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
          }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* ── Modo de visão + filtros (R57) ───────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {/* switch mensal/semanal: dois botões num trilho, o ativo em dourado —
            o mesmo vocabulário de "selecionado" dos chips do resto do app */}
        <div style={{
          display: "flex", padding: 3, borderRadius: 999, gap: 3, flexShrink: 0,
          background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
        }}>
          {(["semanal", "mensal"] as ModoDeVisao[]).map((m) => (
            <button
              key={m}
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              style={{
                padding: "7px 15px", borderRadius: 999, border: "none", cursor: "pointer",
                background: modo === m ? GOLD_GRAD : "transparent",
                color: modo === m ? "#08090E" : textSecondary,
                fontFamily: FONT, fontWeight: 700, fontSize: 11.5,
                letterSpacing: "0.04em", textTransform: "capitalize",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <select
          value={duplaFiltro}
          onChange={(e) => setDuplaFiltro(e.target.value)}
          aria-label="Filtrar por equipe de campo"
          style={{ ...SELETOR_FILTRO(isLight, textPrimary), minWidth: 150 }}
        >
          <option value="todas">Todas as equipes</option>
          {equipesDaSemana.map(({ dupla, membros }) => (
            <option key={dupla.id} value={dupla.id}>
              {rotuloDaComposicao(dupla, membros, nomeDeTecnico)}
            </option>
          ))}
          <option value="sem_equipe">Sem equipe</option>
        </select>

        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as "todos" | ChamadoTipo)}
          aria-label="Filtrar por tipo de demanda"
          style={{ ...SELETOR_FILTRO(isLight, textPrimary), minWidth: 175 }}
        >
          <option value="todos">Todos os tipos</option>
          {TIPOS_DEMANDA_CAMPO.map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>

        {filtrando && (
          <button
            onClick={() => { setDuplaFiltro("todas"); setTipoFiltro("todos"); }}
            style={{
              padding: "8px 13px", borderRadius: 999, cursor: "pointer",
              background: "transparent", color: textSecondary,
              border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
              fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Seletor de dia — tira semanal, tira mensal (R57). Os dois escolhem o
          MESMO `dia`: trocar de modo é trocar a lente, não a tela. A agenda
          abaixo continua sendo a do dia escolhido nos dois casos. */}
      {modo === "semanal" ? (
        <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => { const d = new Date(dia); d.setDate(d.getDate() - 7); setDia(d); }}
            aria-label="Semana anterior"
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
            aria-label="Próxima semana"
            style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setDia(new Date(dia.getFullYear(), dia.getMonth() - 1, 1))}
              aria-label="Mês anterior"
              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{
              flex: 1, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 13.5,
              color: textPrimary, textTransform: "capitalize",
            }}>
              {MES_NOME[dia.getMonth()]} de {dia.getFullYear()}
            </span>
            <button
              onClick={() => setDia(new Date(dia.getFullYear(), dia.getMonth() + 1, 1))}
              aria-label="Próximo mês"
              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {DIA_CURTO.map((d) => (
              <span key={d} style={{
                textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 9,
                letterSpacing: "0.08em", textTransform: "uppercase", color: textSecondary,
                paddingBottom: 2,
              }}>
                {d}
              </span>
            ))}
            {gradeDoMes.map((d) => {
              const k = chaveDia(d);
              const ativo = k === chaveDia(dia);
              const carga = cargaPorDia[k] ?? 0;
              const hoje = k === chaveDia(new Date());
              const doMes = d.getMonth() === dia.getMonth();
              return (
                <button
                  key={k}
                  onClick={() => setDia(d)}
                  aria-current={ativo ? "date" : undefined}
                  style={{
                    minHeight: 46, padding: "5px 2px", borderRadius: 10, cursor: "pointer",
                    border: ativo ? "none" : hoje
                      ? `1px solid ${gold}`
                      : isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                    background: ativo ? GOLD_GRAD : "transparent",
                    color: ativo ? "#08090E" : textPrimary,
                    // dia de outro mês fica apagado, mas continua clicável —
                    // é como se navega para o fim/começo do mês vizinho
                    opacity: doMes || ativo ? 1 : 0.35,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: doMes ? 700 : 400 }}>
                    {d.getDate()}
                  </span>
                  <span style={{
                    fontFamily: FONT, fontSize: 9, fontWeight: 700,
                    color: ativo ? "#08090E" : carga > 0 ? gold : "transparent",
                  }}>
                    {carga > 0 ? carga : "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda do dia, por dupla (R57) — técnico fora de dupla vira grupo
          próprio, e o que não tem responsável fica na cesta "sem técnico" */}
      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Carregando…
        </div>
      ) : porGrupo.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "26px 16px" }}>
          <CalendarClock size={26} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>
            {filtrando ? "Nada programado neste dia com esse filtro" : "Nada programado neste dia"}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
            {filtrando
              ? "Limpe os filtros acima para ver o dia inteiro."
              : "Use a fila abaixo para distribuir os chamados que ainda não têm data."}
          </span>
        </div>
      ) : (
        porGrupo.map((g) => (
          <div key={g.id} style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {g.id === "sem-dono" && <UserX size={15} color={gold} />}
              <span style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
                textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
              }}>
                {g.nome}
              </span>
              {g.sub && (
                <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
                  {g.sub}
                </span>
              )}
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
