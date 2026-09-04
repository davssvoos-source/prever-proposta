// O pop-up de equipes de campo (R56/U47 → R96–R98/U76–U77).
//
// Davi, 2026-08-22: "adicione um botão no painel operacional que leva para um
// pop up de um campo com as opções para cadastrar duplas de acordo com os
// usuários do sistema." As opções continuam vindo de `useTecnicos()` (profiles
// ativos com cargo 'tecnico') — quem não tem usuário não aparece aqui.
//
// O QUE MUDOU NA U77: a tela deixou de ter dois <select> ("Técnico" e
// "Parceiro") e passou a ter DUAS coisas separadas, porque são duas decisões
// de prazos diferentes:
//   · o CADASTRO da equipe (nome e veículo) — vale até alguém mudar;
//   · a ESCALA da semana (quem sai nela) — vale para aquela semana e só.
// Misturar as duas era o que fazia trocar a composição reescrever o passado.
//
// A semana é o eixo da tela inteira: o seletor no topo manda em tudo que
// aparece abaixo dele, e a tela diz sempre de ONDE veio o que está mostrando
// ("escala desta semana" × "herdada de 2026-S32").

import { useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { inicioSemana, referenciaSemanal } from "@/lib/periodos";
import { useTecnicos } from "@/features/gerencial/data";
import { useDuplas, useEscala, useSalvarDupla, useSalvarEscala } from "./data";
import {
  composicaoDaDupla, disponiveisNaSemana, erroDaDupla, erroDaEscala,
  montarEscala, origemDaEscala, rotuloDaComposicao, rotuloDaOrigem, type Dupla,
} from "./modelo";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

const ddmm = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function DialogoDuplas({ aberto, aoFechar }: Props) {
  const { isLight } = useTheme();
  const { data: duplas = [] } = useDuplas();
  const { data: tecnicos = [] } = useTecnicos();
  const { data: escala = montarEscala([], []) } = useEscala();
  const salvar = useSalvarDupla();
  const salvarEscala = useSalvarEscala();

  // a semana mostrada. `base` é uma data qualquer dentro dela — a segunda-feira
  // sai de inicioSemana() e a chave de referenciaSemanal(), os mesmos dois de
  // periodos.ts que o gráfico e os fechamentos usam.
  const [base, setBase] = useState(() => new Date());
  const segunda = useMemo(() => inicioSemana(base), [base]);
  const semana = useMemo(() => referenciaSemanal(base), [base]);
  const ehSemanaAtual = semana === referenciaSemanal(new Date());

  const [editandoCadastro, setEditandoCadastro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [editandoEscala, setEditandoEscala] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<string[]>([]);

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const nomePorId = useMemo(
    () => Object.fromEntries((tecnicos as any[]).map((t) => [t.id, t.nome ?? "—"])) as Record<string, string>,
    [tecnicos],
  );
  const nomeDe = (id: string) => nomePorId[id] ?? "Técnico";

  const ativas = duplas.filter((d) => d.ativa);
  const inativas = duplas.filter((d) => !d.ativa);
  const rotuloDe = (id: string) => {
    const d = duplas.find((x) => x.id === id);
    return d ? rotuloDaComposicao(d, composicaoDaDupla(id, semana, escala), nomeDe) : "outra equipe";
  };

  const origem = origemDaEscala(semana, escala);

  function limparCadastro() {
    setEditandoCadastro(null);
    setNome("");
    setVeiculo("");
  }

  function carregarParaEdicao(d: Dupla) {
    setEditandoCadastro(d.id);
    setNome(d.nome);
    setVeiculo(d.veiculo ?? "");
  }

  function submeterCadastro() {
    const erro = erroDaDupla({ nome });
    if (erro) { toast.error(erro); return; }
    const dados = { nome: nome.trim(), veiculo: veiculo.trim() || null };
    salvar.mutate(
      editandoCadastro ? { tipo: "editar", id: editandoCadastro, dados } : { tipo: "criar", dados },
      {
        onSuccess: () => {
          toast.success(editandoCadastro ? "Equipe atualizada." : "Equipe cadastrada.");
          limparCadastro();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function abrirEscala(d: Dupla) {
    setEditandoEscala(d.id);
    // parte da composição QUE VALE nesta semana — herdada inclusive. Editar a
    // partir do que a tela mostra é o único jeito de o gestor não precisar
    // redigitar a equipe inteira só para trocar uma pessoa.
    setRascunho(composicaoDaDupla(d.id, semana, escala));
  }

  function gravarEscala(duplaId: string, mover = false) {
    const erro = erroDaEscala({ duplaId, semana, membros: rascunho }, escala, nomeDe, rotuloDe);
    if (erro && !mover) { toast.error(erro); return; }
    salvarEscala.mutate(
      { duplaId, semana, membros: rascunho, mover },
      {
        onSuccess: () => {
          toast.success(`Escala de ${semana} lançada.`);
          setEditandoEscala(null);
        },
        onError: (e: Error) => {
          // o banco recusa roubar quem já está em outra equipe naquela semana
          // e devolve o nome dela. Perguntar é o certo: mover em silêncio
          // tiraria alguém de uma equipe sem que ninguém visse.
          if (/confirme a mudança para movê-lo/i.test(e.message)) {
            if (window.confirm(`${e.message}\n\nMover mesmo assim?`)) {
              gravarEscala(duplaId, true);
            }
            return;
          }
          toast.error(e.message);
        },
      },
    );
  }

  if (!aberto) return null;

  const rotulo: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const entrada: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 13px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const setinha: CSSProperties = {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: "pointer",
    background: "transparent", color: textSecondary,
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  const andar = (semanas: number) => {
    const d = new Date(segunda);
    d.setDate(d.getDate() + semanas * 7);
    setBase(d);
    setEditandoEscala(null);
  };

  return (
    <div
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Equipes de campo"
      style={{
        position: "fixed", inset: 0, zIndex: 100, padding: 20,
        background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...card(isLight), padding: 18, width: "100%", maxWidth: 560,
          maxHeight: "86vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Users size={17} color={gold} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: textPrimary }}>
              Equipes de campo
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
              Quem sai com quem, semana a semana. A equipe de um atendimento vem do técnico responsável.
            </div>
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            style={{ ...setinha, width: 32, height: 32 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── o seletor de semana: manda em tudo abaixo ──────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", borderRadius: 12,
          background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)",
        }}>
          <CalendarDays size={15} color={gold} style={{ flexShrink: 0 }} />
          <button onClick={() => andar(-1)} aria-label="Semana anterior" style={setinha}>
            <ChevronLeft size={15} />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: textPrimary }}>
              Semana de {ddmm(segunda)} · {semana}
            </div>
            <div style={{
              fontFamily: FONT, fontWeight: 400, fontSize: 11,
              color: origem.herdada ? gold : textSecondary,
            }}>
              {rotuloDaOrigem(origem.semanaOrigem, semana)}
            </div>
          </div>
          <button onClick={() => andar(1)} aria-label="Próxima semana" style={setinha}>
            <ChevronRight size={15} />
          </button>
          {!ehSemanaAtual && (
            <button
              onClick={() => { setBase(new Date()); setEditandoEscala(null); }}
              style={{
                ...setinha, width: "auto", padding: "0 10px",
                fontFamily: FONT, fontSize: 11, fontWeight: 600,
              }}
            >
              Hoje
            </button>
          )}
        </div>

        {origem.herdada && (
          <div style={{
            fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary,
            lineHeight: 1.5, padding: "0 2px",
          }}>
            Ninguém lançou escala para esta semana ainda — o que aparece abaixo é o
            que valia em <strong style={{ color: gold, fontWeight: 600 }}>{origem.semanaOrigem}</strong>.
            Salvar qualquer equipe fixa a semana inteira, e as anteriores não mudam.
          </div>
        )}

        {/* ── as equipes ativas, com a composição DESTA semana ───────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase", color: gold,
          }}>
            Equipes ativas ({ativas.length})
          </span>
          {ativas.length === 0 ? (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
              Nenhuma equipe cadastrada ainda.
            </span>
          ) : (
            ativas.map((d) => {
              const composicao = composicaoDaDupla(d.id, semana, escala);
              const editando = editandoEscala === d.id;
              const oferecidos = disponiveisNaSemana(
                (tecnicos as any[]).map((t) => ({ id: t.id as string, nome: (t.nome ?? "—") as string })),
                d.id, semana, escala,
              );
              return (
                <div key={d.id} style={{
                  display: "flex", flexDirection: "column", gap: 9, padding: "9px 11px", borderRadius: 12,
                  background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: textPrimary }}>
                        {rotuloDaComposicao(d, composicao, nomeDe)}
                        {d.veiculo && (
                          <span style={{ fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                            {" · "}{d.veiculo}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                        {composicao.length === 0
                          ? "não sai nesta semana"
                          : composicao.map(nomeDe).join(" · ")}
                      </div>
                    </div>
                    <button
                      onClick={() => (editando ? setEditandoEscala(null) : abrirEscala(d))}
                      aria-label={`Escalar ${rotuloDaComposicao(d, composicao, nomeDe)} na semana ${semana}`}
                      title="Quem sai nesta semana"
                      style={{
                        ...setinha, width: "auto", padding: "0 10px", height: 30,
                        fontFamily: FONT, fontSize: 11, fontWeight: 600,
                        color: editando ? gold : textSecondary,
                      }}
                    >
                      <Users size={13} style={{ marginRight: 5 }} />
                      Escalar
                    </button>
                    <button
                      onClick={() => carregarParaEdicao(d)}
                      aria-label={`Editar cadastro de ${rotuloDaComposicao(d, composicao, nomeDe)}`}
                      title="Nome e veículo"
                      style={{ ...setinha, width: 30, height: 30 }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => salvar.mutate(
                        { tipo: "desativar", id: d.id },
                        {
                          onSuccess: () => toast.success("Equipe desfeita — as semanas passadas continuam contando a história dela."),
                          onError: (e: Error) => toast.error(e.message),
                        },
                      )}
                      aria-label={`Desfazer ${rotuloDaComposicao(d, composicao, nomeDe)}`}
                      title="Desfazer a equipe"
                      style={{ ...setinha, width: 30, height: 30 }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {editando && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={rotulo}>Quem sai na semana de {ddmm(segunda)}</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {oferecidos.length === 0 ? (
                          <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
                            Todos os técnicos já estão em outra equipe nesta semana.
                          </span>
                        ) : oferecidos.map((t) => {
                          const dentro = rascunho.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => setRascunho((r) =>
                                dentro ? r.filter((x) => x !== t.id) : [...r, t.id])}
                              aria-pressed={dentro}
                              style={{
                                height: 32, padding: "0 11px", borderRadius: 16, cursor: "pointer",
                                fontFamily: FONT, fontSize: 12, fontWeight: dentro ? 700 : 400,
                                background: dentro ? GOLD_GRAD : "transparent",
                                color: dentro ? "#08090E" : textSecondary,
                                border: dentro ? "none"
                                  : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                              }}
                            >
                              {t.nome}
                            </button>
                          );
                        })}
                      </div>
                      {/* equipe sem ninguém é resposta legítima — "esta equipe
                          não sai nesta semana" — e por isso o botão não exige
                          seleção nenhuma para ficar clicável */}
                      <button
                        onClick={() => gravarEscala(d.id)}
                        disabled={salvarEscala.isPending}
                        style={{
                          height: 40, borderRadius: 20, border: "none", background: GOLD_GRAD,
                          color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 12.5,
                          cursor: salvarEscala.isPending ? "default" : "pointer",
                          opacity: salvarEscala.isPending ? 0.6 : 1,
                        }}
                      >
                        {salvarEscala.isPending
                          ? "Lançando…"
                          : rascunho.length === 0
                            ? "Não sai nesta semana"
                            : `Lançar ${rascunho.length} na semana ${semana}`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── cadastro da equipe: nome e veículo, sem composição ─────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase", color: textSecondary,
          }}>
            {editandoCadastro ? "Editar equipe" : "Nova equipe"}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div>
              <label htmlFor="dupla-nome" style={rotulo}>Nome da equipe</label>
              <input
                id="dupla-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Equipe 1, Zona Sul, Preventivas…"
                style={entrada}
              />
            </div>
            <div>
              <label htmlFor="dupla-veiculo" style={rotulo}>Veículo (opcional)</label>
              <input
                id="dupla-veiculo"
                value={veiculo}
                onChange={(e) => setVeiculo(e.target.value)}
                placeholder="Fiorino branca, BRA-2E19…"
                style={entrada}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            {editandoCadastro && (
              <button
                onClick={limparCadastro}
                style={{
                  flex: 1, height: 44, borderRadius: 22, cursor: "pointer",
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: textSecondary, fontFamily: FONT, fontSize: 13,
                }}
              >
                Cancelar edição
              </button>
            )}
            <button
              onClick={submeterCadastro}
              disabled={salvar.isPending}
              style={{
                flex: 2, height: 44, borderRadius: 22, border: "none", background: GOLD_GRAD,
                color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                cursor: salvar.isPending ? "default" : "pointer", opacity: salvar.isPending ? 0.6 : 1,
              }}
            >
              {editandoCadastro ? <Pencil size={15} /> : <Plus size={16} />}
              {salvar.isPending ? "Salvando…" : editandoCadastro ? "Salvar equipe" : "Cadastrar equipe"}
            </button>
          </div>
          <span style={{
            fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary, lineHeight: 1.5,
          }}>
            A composição não é cadastro: depois de criar a equipe, use <strong style={{ color: gold, fontWeight: 600 }}>Escalar</strong> para dizer quem sai em cada semana.
          </span>
        </div>

        {/* ── desfeitas ──────────────────────────────────────────────────── */}
        {inativas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em",
              textTransform: "uppercase", color: textSecondary,
            }}>
              Desfeitas ({inativas.length})
            </span>
            {inativas.map((d) => (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12,
                background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)", opacity: 0.6,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: textPrimary }}>
                    {rotuloDaComposicao(d, composicaoDaDupla(d.id, semana, escala), nomeDe)}
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                    continua explicando as semanas em que saiu
                  </div>
                </div>
                <button
                  onClick={() => salvar.mutate(
                    { tipo: "reativar", id: d.id },
                    { onSuccess: () => toast.success("Equipe reativada — escale-a na semana."), onError: (e: Error) => toast.error(e.message) },
                  )}
                  aria-label={`Reativar ${d.nome}`}
                  title="Reativar a equipe"
                  style={{ ...setinha, width: 30, height: 30 }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
