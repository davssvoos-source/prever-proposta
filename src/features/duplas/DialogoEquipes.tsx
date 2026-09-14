// O pop-up de equipes de campo (R56/U47 → R96–R98/U76–U77 → R285/U142).
//
// Davi, 2026-08-22: "adicione um botão no painel operacional que leva para um
// pop up de um campo com as opções para cadastrar duplas de acordo com os
// usuários do sistema."
//
// ── O QUE MUDOU NA R285 (14/09/2026), E É A TELA INTEIRA ───────────────────
// Davi, apurando com o Vinicius: "isso é adaptado semanalmente, as vezes
// quinzenalmente, as vezes mensalmente, as vezes a dupla muda durante a
// semana… Ou seja, é dinâmico" — e: "sempre que ele atualizar uma equipe,
// alterna a partir do momento que ele fez a alteração".
//
// A SEMANA ERA O EIXO DESTA TELA. Saiu inteiro: o seletor, as setinhas, o
// "Hoje", a herança ("ninguém lançou escala para esta semana"), a origem
// ("escala desta semana × herdada de 2026-S32") e o modo "Escalar", que obrigava
// a redigitar a equipe inteira só para trocar uma pessoa.
//
// No lugar: a composição de AGORA, e dois gestos diretos — pôr alguém, tirar
// alguém. Cada gesto vale do instante em que acontece, e o que já passou fica
// como estava. É o que o Vinicius faz de verdade.
//
// ── A EQUIPE TEM LÍDER ─────────────────────────────────────────────────────
// "cada equipe terá um líder e qualquer quantia de ajudantes". O líder é quem a
// R126 propõe como responsável ao escolher a equipe; ele NÃO governa o apoio
// automático, que sempre foi "todos os OUTROS da equipe" e continua sendo.
// Equipe sem líder nomeado funciona igual — e é o estado de todas elas logo
// depois da U142, porque o backfill se recusou a inventar um.
//
// ── O POP-UP DE MOVER ──────────────────────────────────────────────────────
// "o sistema deve sugerir (pop up) a remoção do técnico da outra equipe em que
// ele já estava, e só poderá prosseguir se ele clicar em remover". A tela
// pergunta ANTES (pela função pura, que sabe de onde tirar), mas quem RECUSA é
// o banco: a restrição `equipe_membros_uma_equipe_por_vez` é o que impede duas
// pessoas mexendo ao mesmo tempo de gravar a mesma pessoa em duas equipes.

import { useMemo, useState, type CSSProperties } from "react";
import { Crown, Pencil, Plus, RotateCcw, UserMinus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { useTecnicos } from "@/features/gerencial/data";
import { usePessoas } from "@/features/chamados/data";
import {
  JA_EM_OUTRA_EQUIPE, useDefinirMembro, useDuplas, useMembrosDeEquipe,
  useSalvarDupla, useTirarMembro,
} from "./data";
import {
  desdeQuando, equipeAAbandonar, erroDaDupla, liderDaEquipe, membrosNoInstante,
  type Dupla, type MembroDaEquipe,
} from "./modelo";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

export function DialogoEquipes({ aberto, aoFechar }: Props) {
  const { isLight } = useTheme();
  const { data: duplas = [] } = useDuplas();
  // DUAS LISTAS, e a diferença apareceu na tela: `useTecnicos()` é QUEM PODE
  // ENTRAR (cargo de campo — e o operacional saiu dela na R294);
  // `usePessoas()` é QUEM ESTÁ e como se chama. Resolver nome pela primeira
  // fazia um membro de cargo operacional aparecer como "Técnico", sem nome —
  // e aí o gestor não consegue nem tirá-lo, porque não sabe quem é.
  const { data: tecnicos = [] } = useTecnicos();
  const { data: pessoas = [] } = usePessoas();
  const { data: membros = [] } = useMembrosDeEquipe();
  const salvar = useSalvarDupla();
  const definir = useDefinirMembro();
  const tirar = useTirarMembro();

  const [editandoCadastro, setEditandoCadastro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [adicionandoEm, setAdicionandoEm] = useState<string | null>(null);

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // O INSTANTE da tela. Fixo por render e não `new Date()` em cada chamada: com
  // um relógio por leitura, duas perguntas feitas no mesmo desenho poderiam cair
  // em lados diferentes de uma troca — e a tela mostraria a pessoa em duas
  // equipes por um quadro.
  const agora = useMemo(() => new Date(), [membros]);

  const nomePorId = useMemo(
    () => Object.fromEntries(
      [...(pessoas as any[]), ...(tecnicos as any[])].map((p) => [p.id, p.nome ?? "—"]),
    ) as Record<string, string>,
    [pessoas, tecnicos],
  );
  // "Alguém que saiu" e não "Técnico": quem está na composição e não está
  // mais em `profiles` ativos é alguém desligado, e dizer isso é mais útil
  // do que inventar um cargo para ele.
  const nomeDe = (id: string) => nomePorId[id] ?? "Alguém que saiu";
  /** O nome do MEMBRO: o que veio na linha vence, porque ele resolve quem foi desativado. */
  const nomeDoMembro = (m: MembroDaEquipe) => (m.nome ?? "").trim() || nomeDe(m.pessoaId);
  const nomeDaEquipe = (id: string) => duplas.find((d) => d.id === id)?.nome ?? "outra equipe";

  const ativas = duplas.filter((d) => d.ativa);
  const inativas = duplas.filter((d) => !d.ativa);

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

  /**
   * Pôr alguém numa equipe. Pergunta ANTES quando ela já está em outra — e a
   * pergunta diz de onde, porque "mover o Lucas?" sem dizer de onde faz o
   * gestor aceitar sem saber o que está desfazendo.
   *
   * O `catch` repete a pergunta a partir da MENSAGEM DA PORTA: entre o desenho
   * da tela e o clique, alguém pode ter movido a pessoa, e aí a função pura
   * (que olha a lista carregada) diria que está livre quando não está.
   */
  function porNaEquipe(equipeId: string, pessoaId: string, papel: "lider" | "ajudante") {
    const deOnde = equipeAAbandonar(membros, pessoaId, equipeId, agora);
    const mover = deOnde !== null;
    if (mover && !window.confirm(
      `${nomeDe(pessoaId)} está na equipe ${nomeDaEquipe(deOnde!)}.\n\n`
      + `Remover de lá e trazer para ${nomeDaEquipe(equipeId)}?`,
    )) return;

    definir.mutate(
      { equipeId, pessoaId, papel, mover },
      {
        onSuccess: (r) => {
          setAdicionandoEm(null);
          if (!r?.mudou) return;
          toast.success(
            r.moveu ? `${nomeDe(pessoaId)} passou para ${nomeDaEquipe(equipeId)}.`
              : r.trocouPapel ? `${nomeDe(pessoaId)} agora é ${papel === "lider" ? "líder" : "ajudante"}.`
                : `${nomeDe(pessoaId)} entrou em ${nomeDaEquipe(equipeId)}.`,
          );
        },
        onError: (e: Error) => {
          if (e.message?.includes(JA_EM_OUTRA_EQUIPE)) {
            const onde = e.message.split(JA_EM_OUTRA_EQUIPE)[1]?.trim() || "outra equipe";
            if (window.confirm(
              `${nomeDe(pessoaId)} está na equipe ${onde}.\n\nRemover de lá e trazer para ${nomeDaEquipe(equipeId)}?`,
            )) {
              definir.mutate({ equipeId, pessoaId, papel, mover: true }, {
                onSuccess: () => { setAdicionandoEm(null); toast.success(`${nomeDe(pessoaId)} passou de equipe.`); },
                onError: (e2: Error) => toast.error(e2.message),
              });
            }
            return;
          }
          toast.error(e.message);
        },
      },
    );
  }

  function tirarDaEquipe(pessoaId: string) {
    tirar.mutate(pessoaId, {
      onSuccess: () => toast.success(`${nomeDe(pessoaId)} saiu da equipe — o que já passou fica como estava.`),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  if (!aberto) return null;

  const rotulo: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const entrada: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 13px",
    background: isLight ? "#ffffff" : "#1b1b1b",
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
  const tituloDeSecao: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary,
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
              Quem está com quem agora. Toda troca vale deste instante em diante — o que já passou fica como estava.
            </div>
          </div>
          <button onClick={aoFechar} aria-label="Fechar" style={setinha}>
            <X size={15} />
          </button>
        </div>

        {/* ── as equipes ativas, com a composição de AGORA ────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...tituloDeSecao, color: gold }}>
            Equipes ativas ({ativas.length})
          </span>
          {ativas.length === 0 ? (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
              Nenhuma equipe cadastrada ainda.
            </span>
          ) : (
            ativas.map((d) => {
              const dentro = membrosNoInstante(membros, d.id, agora);
              const lider = liderDaEquipe(membros, d.id, agora);
              const adicionando = adicionandoEm === d.id;
              // TODOS os técnicos, menos quem já está NESTA equipe. Quem está em
              // OUTRA continua sendo oferecido de propósito: a R98 escondia essa
              // pessoa, e a R285 mandou oferecê-la com pergunta antes de mover.
              const oferecidos = (tecnicos as any[])
                .filter((t) => !dentro.some((m) => m.pessoaId === t.id))
                .map((t) => ({ id: t.id as string, nome: (t.nome ?? "—") as string }))
                .sort((a, b) => a.nome.localeCompare(b.nome));

              return (
                <div key={d.id} style={{
                  display: "flex", flexDirection: "column", gap: 9, padding: "9px 11px", borderRadius: 12,
                  background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: textPrimary }}>
                        {d.nome}
                        {d.veiculo && (
                          <span style={{ fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                            {" · "}{d.veiculo}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                        {dentro.length === 0 ? "sem ninguém agora"
                          : lider === null ? `${dentro.length} ${dentro.length === 1 ? "pessoa" : "pessoas"} · sem líder nomeado`
                            : `${dentro.length} ${dentro.length === 1 ? "pessoa" : "pessoas"} · líder ${nomeDe(lider)}`}
                      </div>
                    </div>
                    <button
                      onClick={() => setAdicionandoEm(adicionando ? null : d.id)}
                      aria-label={`Adicionar alguém em ${d.nome}`}
                      aria-expanded={adicionando}
                      title="Pôr alguém nesta equipe"
                      style={{ ...setinha, width: 30, height: 30, color: adicionando ? gold : textSecondary }}
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      onClick={() => carregarParaEdicao(d)}
                      aria-label={`Editar cadastro de ${d.nome}`}
                      title="Nome e veículo"
                      style={{ ...setinha, width: 30, height: 30 }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => salvar.mutate(
                        { tipo: "desativar", id: d.id },
                        {
                          onSuccess: () => toast.success("Equipe desfeita — o histórico dela continua de pé."),
                          onError: (e: Error) => toast.error(e.message),
                        },
                      )}
                      aria-label={`Desfazer ${d.nome}`}
                      title="Desfazer a equipe"
                      style={{ ...setinha, width: 30, height: 30 }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* quem está nela: o líder primeiro, com os dois gestos ao lado */}
                  {dentro.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {dentro.map((m) => (
                        <div key={m.pessoaId} style={{
                          display: "flex", alignItems: "center", gap: 8, minHeight: 38,
                          padding: "0 4px 0 9px", borderRadius: 10,
                          background: isLight ? "#ffffff" : "rgba(255,255,255,0.05)",
                        }}>
                          {m.papel === "lider" && (
                            <Crown size={13} color={gold} aria-label="líder" style={{ flexShrink: 0 }} />
                          )}
                          <span style={{
                            flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12.5,
                            fontWeight: m.papel === "lider" ? 700 : 400, color: textPrimary,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {nomeDoMembro(m)}
                            {m.ativo === false && (
                              // desativado e ainda na equipe: é vaga ocupada por
                              // quem não trabalha mais aqui, e o gestor precisa
                              // VER isso para tirar
                              <span style={{ color: textSecondary, fontWeight: 400 }}>
                                {" · "}desativado
                              </span>
                            )}
                          </span>
                          {/* "desde sempre" para o marco zero da U76 — a faixa
                              trazida do cadastro antigo começa no ano 1, e isso
                              quer dizer "nesta equipe desde antes de existir
                              registro", não uma data para mostrar */}
                          <span style={{
                            fontFamily: FONT, fontSize: 10.5, color: textSecondary, flexShrink: 0,
                          }}>
                            {desdeQuando(m.entrouEm)}
                          </span>
                          {m.papel !== "lider" && (
                            <button
                              onClick={() => porNaEquipe(d.id, m.pessoaId, "lider")}
                              aria-label={`Tornar ${nomeDoMembro(m)} líder de ${d.nome}`}
                              title="Tornar líder"
                              style={{ ...setinha, width: 32, height: 32, border: "none" }}
                            >
                              <Crown size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => tirarDaEquipe(m.pessoaId)}
                            aria-label={`Tirar ${nomeDoMembro(m)} de ${d.nome}`}
                            title="Tirar da equipe"
                            style={{ ...setinha, width: 32, height: 32, border: "none" }}
                          >
                            <UserMinus size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {adicionando && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <span style={rotulo}>Quem entra em {d.nome}</span>
                      {oferecidos.length === 0 ? (
                        <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>
                          Todos os técnicos já estão nesta equipe.
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {oferecidos.map((t) => {
                            const ocupado = equipeAAbandonar(membros, t.id, d.id, agora);
                            return (
                              <button
                                key={t.id}
                                onClick={() => porNaEquipe(d.id, t.id, "ajudante")}
                                disabled={definir.isPending}
                                title={ocupado ? `Hoje em ${nomeDaEquipe(ocupado)} — será perguntado antes de mover` : undefined}
                                style={{
                                  minHeight: 32, padding: "0 11px", borderRadius: 16, cursor: "pointer",
                                  fontFamily: FONT, fontSize: 12, fontWeight: 400,
                                  background: "transparent", color: textSecondary,
                                  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
                                  opacity: definir.isPending ? 0.6 : 1,
                                }}
                              >
                                {t.nome}
                                {ocupado && (
                                  <span style={{ color: gold, fontSize: 10.5 }}>
                                    {" · "}{nomeDaEquipe(ocupado)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <span style={{
                        fontFamily: FONT, fontSize: 11, color: textSecondary, lineHeight: 1.5,
                      }}>
                        Quem já está em outra equipe aparece com o nome dela — o sistema pergunta antes de mover.
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── cadastro da equipe: nome e veículo, sem composição ─────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={tituloDeSecao}>
            {editandoCadastro ? "Editar equipe" : "Nova equipe"}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div>
              <label htmlFor="equipe-nome" style={rotulo}>Nome da equipe</label>
              <input
                id="equipe-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Equipe 1, Zona Sul, Preventivas…"
                style={entrada}
              />
            </div>
            <div>
              <label htmlFor="equipe-veiculo" style={rotulo}>Veículo (opcional)</label>
              <input
                id="equipe-veiculo"
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
                  background: isLight ? "#f4f4f4" : "rgba(255,255,255,0.04)",
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
                color: "#0E0E0E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
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
            A composição não é cadastro: depois de criar a equipe, use o <strong style={{ color: gold, fontWeight: 600 }}>+</strong> dela para pôr gente.
          </span>
        </div>

        {/* ── desfeitas ──────────────────────────────────────────────────── */}
        {inativas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={tituloDeSecao}>Desfeitas ({inativas.length})</span>
            {inativas.map((d) => (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12,
                background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)", opacity: 0.6,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: textPrimary }}>
                    {d.nome}
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                    continua explicando os atendimentos em que saiu
                  </div>
                </div>
                <button
                  onClick={() => salvar.mutate(
                    { tipo: "reativar", id: d.id },
                    { onSuccess: () => toast.success("Equipe reativada — ponha gente nela pelo +."), onError: (e: Error) => toast.error(e.message) },
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
