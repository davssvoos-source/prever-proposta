// O painel de propriedades do chamado — entra pela direita, sobre a tela.
//
// POR QUE PAINEL E NÃO PÁGINA: quem varre a fila (ou o calendário) está
// comparando cartões. Sair da tela e voltar perde o filtro, a rolagem e a
// coluna onde a pessoa estava — e depois de três cartões conferidos, ela
// desiste de conferir o quarto. O painel mantém o que está atrás vivo: fecha
// e o lugar ainda está lá.
//
// SALVA CAMPO A CAMPO, sem botão de salvar. É o comportamento que a pessoa já
// conhece do Notion, de onde estas atividades vieram, e evita o pior desfecho
// de um formulário longo: preencher seis campos e perder tudo porque a sessão
// caiu no sétimo. Cada campo carrega o próprio estado — salvando, salvo, ou o
// erro com o código (PRV-...) para o defeito ser rastreável.
//
// A DATA DE CRIAÇÃO não é editável, por pedido do Davi e por bom senso: ela é
// o registro de quando a demanda chegou. Reescrevê-la apagaria a única âncora
// temporal confiável do chamado — a que a idade do backlog e a reincidência
// usam para contar.
//
// OS SUBCOMPONENTES SÃO DE MÓDULO, não funções internas. Declarados dentro do
// pai, eles ganhariam identidade nova a cada render: o React trataria como
// outro componente, desmontaria e remontaria — e o texto sendo digitado
// sumiria no meio da frase quando qualquer consulta de fundo voltasse.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { codigoDeErro } from "@/lib/erros";
import {
  useChamado, usePessoas, useChamadoApoios,
  atualizarChamado, adicionarApoio, removerApoio,
  type ChamadoPatch,
} from "@/features/chamados/data";
import { useClientes } from "@/features/clientes/data";
import {
  PRIORIDADE_LABEL, SPRINT_LABEL, TIPO_LABEL,
  chamadoStatusInfo, statusDaNatureza, tiposDaNatureza,
  prazoParaData, dataParaPrazo,
  type ChamadoPrioridade, type ChamadoSprint, type Natureza,
} from "@/lib/chamado-status";
import { EQUIPE_LABEL, type Equipe } from "@/lib/equipes";

export type EstadoCampo = "parado" | "salvando" | "salvo" | { erro: string };

// ── Peças de formulário ─────────────────────────────────────────────────────

/** Paleta e estilos que as peças compartilham. */
function useEstiloCampo() {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const campoBg = isLight ? "#ffffff" : "rgba(255,255,255,0.04)";
  const borda = isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)";
  return {
    isLight, textPrimary, textSecondary, campoBg, borda,
    verde: isLight ? "#047862" : "#2DD2A5",
    vermelho: isLight ? "#B1242E" : "#F17881",
    rotulo: {
      fontFamily: FONT, fontWeight: 700, fontSize: 9.5,
      letterSpacing: "0.12em", textTransform: "uppercase", color: textSecondary,
    } as CSSProperties,
    entrada: {
      width: "100%", boxSizing: "border-box",
      fontFamily: FONT, fontSize: 13, color: textPrimary,
      background: campoBg, border: borda, borderRadius: 10,
      padding: "9px 11px", outline: "none",
    } as CSSProperties,
  };
}

function Selo({ estado }: { estado?: EstadoCampo }) {
  const { textSecondary, verde, vermelho } = useEstiloCampo();
  if (estado === "salvando") return <Loader2 size={12} className="animate-spin" color={textSecondary} />;
  if (estado === "salvo") return <Check size={12} color={verde} />;
  if (estado && typeof estado === "object") {
    return (
      <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 9.5, color: vermelho }}>
        {estado.erro}
      </span>
    );
  }
  return null;
}

function Campo({ titulo, estado, children }: {
  titulo: string; estado?: EstadoCampo; children: ReactNode;
}) {
  const { rotulo } = useEstiloCampo();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 14 }}>
        <span style={rotulo}>{titulo}</span>
        <Selo estado={estado} />
      </span>
      {children}
    </label>
  );
}

/** Select que grava ao mudar. */
function Escolha({ titulo, estado, valor, opcoes, aoMudar, vazio }: {
  titulo: string; estado?: EstadoCampo; valor: string | null;
  opcoes: { v: string; t: string }[];
  aoMudar: (v: string | null) => void;
  vazio?: string;
}) {
  const { entrada } = useEstiloCampo();
  return (
    <Campo titulo={titulo} estado={estado}>
      <select
        value={valor ?? ""}
        onChange={(ev) => aoMudar(ev.target.value || null)}
        style={{ ...entrada, cursor: "pointer" }}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </Campo>
  );
}

/**
 * Texto que grava ao SAIR do campo. Gravar a cada tecla seria uma requisição
 * por letra e um cursor que pula quando a resposta chega.
 *
 * `chaveReset` (o id do chamado) sincroniza o rascunho quando o painel troca
 * de registro — sem isso, abrir outro cartão mostraria o texto do anterior.
 */
function Texto({ titulo, estado, valor, aoSalvar, linhas, chaveReset }: {
  titulo: string; estado?: EstadoCampo; valor: string;
  aoSalvar: (v: string) => void; linhas?: number; chaveReset?: string | null;
}) {
  const { entrada } = useEstiloCampo();
  const [v, setV] = useState(valor);
  useEffect(() => { setV(valor); }, [valor, chaveReset]);
  const comum = {
    value: v,
    onChange: (e: any) => setV(e.target.value),
    onBlur: () => { if (v !== valor) aoSalvar(v); },
  };
  return (
    <Campo titulo={titulo} estado={estado}>
      {linhas
        ? <textarea {...comum} rows={linhas} style={{ ...entrada, resize: "vertical" }} />
        : <input {...comum} style={entrada} />}
    </Campo>
  );
}

// ── O painel ────────────────────────────────────────────────────────────────

interface Props {
  chamadoId: string | null;
  aoFechar: () => void;
  /** leva para a página completa — onde ficam execução, fotos e assinatura */
  aoAbrirPagina: (id: string) => void;
}

export function PainelChamado({ chamadoId, aoFechar, aoAbrirPagina }: Props) {
  const est = useEstiloCampo();
  const { isLight } = useTheme();
  const qc = useQueryClient();
  const { data: chamado, isLoading } = useChamado(chamadoId ?? undefined);
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();
  const { data: apoios = [] } = useChamadoApoios(chamadoId ?? undefined);

  const [estados, setEstados] = useState<Record<string, EstadoCampo>>({});

  // troca de chamado zera os avisos: um "salvo" verde herdado do cartão
  // anterior diria que algo foi gravado neste, que não foi
  useEffect(() => { setEstados({}); }, [chamadoId]);

  const gold = isLight ? "#A06108" : "#F8C811";
  const superficie = isLight ? "#ffffff" : "#101016";

  const salvar = useMutation({
    mutationFn: async ({ patch }: { campo: string; patch: ChamadoPatch }) => {
      if (!chamadoId) throw new Error("sem chamado");
      await atualizarChamado(chamadoId, patch);
    },
    onMutate: ({ campo }) => setEstados((e) => ({ ...e, [campo]: "salvando" })),
    onSuccess: (_d, { campo }) => {
      setEstados((e) => ({ ...e, [campo]: "salvo" }));
      // o que está atrás precisa refletir na hora: mudar o responsável e ver o
      // cartão no lugar antigo faz duvidar de que salvou
      qc.invalidateQueries({ queryKey: ["chamado", chamadoId] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      setTimeout(() => setEstados((e) => (e[campo] === "salvo" ? { ...e, [campo]: "parado" } : e)), 1600);
    },
    onError: (err, { campo }) => {
      // o código do erro na tela: RLS negando aparece como PRV-INI-PERM-42501
      // e a pessoa sabe que é permissão, não campo mal preenchido
      setEstados((e) => ({ ...e, [campo]: { erro: codigoDeErro(err, "/dashboard") } }));
    },
  });

  const mexerApoio = useMutation({
    mutationFn: async ({ id, remover }: { id: string; remover: boolean }) => {
      if (!chamadoId) throw new Error("sem chamado");
      if (remover) await removerApoio(chamadoId, id);
      else await adicionarApoio(chamadoId, id);
    },
    onMutate: () => setEstados((e) => ({ ...e, apoio: "salvando" })),
    onSuccess: () => {
      setEstados((e) => ({ ...e, apoio: "salvo" }));
      qc.invalidateQueries({ queryKey: ["chamado-apoios", chamadoId] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
      setTimeout(() => setEstados((e) => (e.apoio === "salvo" ? { ...e, apoio: "parado" } : e)), 1600);
    },
    onError: (err) => setEstados((e) => ({ ...e, apoio: { erro: codigoDeErro(err, "/dashboard") } })),
  });

  const natureza = (chamado?.natureza ?? "campo") as Natureza;

  const pessoasOrdenadas = useMemo(
    () => [...(pessoas as any[])].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [pessoas],
  );
  const clientesOrdenados = useMemo(
    () => [...clientes].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [clientes],
  );
  const nomeDe = (id: string) => (pessoas as any[]).find((p) => p.id === id)?.nome ?? "Alguém";

  return (
    <Sheet open={!!chamadoId} onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <SheetContent
        side="right"
        className="p-0"
        style={{
          // Teto de 60% da tela, por decisão do Davi: o painel informa sobre um
          // item do quadro que continua atrás — cobrir tudo transformaria a
          // consulta rápida em troca de página, que é justamente o que ele
          // evita. O piso de 340px é o mínimo em que os campos ainda cabem no
          // celular, onde 60% seriam 230px e nenhum select seria legível.
          width: "min(60vw, 760px)",
          maxWidth: "60vw",
          minWidth: "min(340px, 100vw)",
          background: superficie,
          borderLeft: est.borda,
        }}
      >
        {isLoading || !chamado ? (
          <div style={{ padding: 24, fontFamily: FONT, fontSize: 13, color: est.textSecondary }}>
            {isLoading ? "Carregando…" : "Chamado não encontrado."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            {/* Cabeçalho fixo */}
            <div style={{
              padding: "18px 20px 14px", borderBottom: est.borda,
              display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {chamado.numero && (
                    <span style={{
                      fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11,
                      fontWeight: 600, color: gold,
                    }}>
                      {chamado.numero}
                    </span>
                  )}
                  <span style={{
                    fontFamily: FONT, fontSize: 10.5, fontWeight: 600,
                    color: chamadoStatusInfo(chamado.status).color,
                  }}>
                    {chamadoStatusInfo(chamado.status).label}
                  </span>
                </div>
                {/* a data de criação é INFORMAÇÃO, não campo (ver cabeçalho) */}
                <div style={{ fontFamily: FONT, fontSize: 11, color: est.textSecondary, marginTop: 4 }}>
                  Criado em{" "}
                  {new Date(chamado.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </div>
              </div>
              <button
                onClick={() => aoAbrirPagina(chamado.id)}
                title="Abrir a página completa"
                style={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                  border: est.borda, background: est.campoBg, color: est.textSecondary,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  marginRight: 26, // o X de fechar do Sheet mora no canto
                }}
              >
                <ExternalLink size={15} />
              </button>
            </div>

            {/* Campos */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              padding: "16px 20px 28px", display: "flex", flexDirection: "column", gap: 14,
            }}>
              <Texto
                titulo="Título" estado={estados.titulo} chaveReset={chamadoId}
                valor={chamado.titulo ?? ""}
                aoSalvar={(v) => salvar.mutate({ campo: "titulo", patch: { titulo: v } })}
              />

              <Escolha
                titulo="Cliente" estado={estados.cliente_id} valor={chamado.cliente_id ?? null}
                vazio="— sem cliente —"
                opcoes={clientesOrdenados.map((c) => ({ v: c.id, t: c.nome }))}
                aoMudar={(v) => salvar.mutate({ campo: "cliente_id", patch: { cliente_id: v } })}
              />
              {/* o nome que veio do Notion, quando não há vínculo (U31): sem
                  isto o campo pareceria vazio numa atividade que TEM cliente */}
              {!chamado.cliente_id && chamado.cliente_origem_nome && (
                <div style={{ fontFamily: FONT, fontSize: 11, color: est.textSecondary, marginTop: -8 }}>
                  No Notion estava como <strong style={{ color: est.textPrimary }}>
                    {chamado.cliente_origem_nome}
                  </strong> — escolha acima para vincular ao cadastro do QAP.
                </div>
              )}

              <Escolha
                titulo="Responsável" estado={estados.responsavel_id}
                valor={chamado.responsavel_id ?? null} vazio="— sem responsável —"
                opcoes={pessoasOrdenadas.map((p) => ({ v: p.id, t: p.nome }))}
                aoMudar={(v) => salvar.mutate({ campo: "responsavel_id", patch: { responsavel_id: v } })}
              />

              {/* APOIO — vários. Fica logo abaixo do responsável porque a
                  pergunta é a mesma ("quem toca isto?") com resposta plural. */}
              <Campo titulo="Apoio" estado={estados.apoio}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {apoios.map((id) => (
                    <span key={id} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 6px 4px 10px", borderRadius: 999,
                      background: isLight ? "rgba(0,0,0,0.055)" : "rgba(255,255,255,0.09)",
                      fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color: est.textPrimary,
                    }}>
                      {nomeDe(id)}
                      <button
                        onClick={() => mexerApoio.mutate({ id, remover: true })}
                        aria-label={`Remover ${nomeDe(id)} do apoio`}
                        style={{
                          border: "none", background: "transparent", cursor: "pointer",
                          color: est.textSecondary, display: "flex", padding: 2,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) mexerApoio.mutate({ id: e.target.value, remover: false }); }}
                    style={{
                      ...est.entrada, width: "auto", padding: "4px 8px", fontSize: 11.5,
                      borderRadius: 999, cursor: "pointer",
                    }}
                  >
                    <option value="">+ adicionar</option>
                    {pessoasOrdenadas
                      .filter((p) => p.id !== chamado.responsavel_id && !apoios.includes(p.id))
                      .map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </Campo>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Escolha
                  titulo="Tipo de demanda" estado={estados.tipo} valor={chamado.tipo ?? null}
                  vazio="— sem tipo —"
                  // os tipos seguem a natureza: oferecer "corretiva" num chamado
                  // interno criaria um registro que nenhuma tela sabe ler
                  opcoes={tiposDaNatureza(natureza).map((t) => ({ v: t, t: TIPO_LABEL[t] }))}
                  aoMudar={(v) => salvar.mutate({ campo: "tipo", patch: { tipo: v as any } })}
                />
                <Escolha
                  titulo="Status" estado={estados.status} valor={chamado.status ?? null}
                  opcoes={statusDaNatureza(natureza).map((s) => ({ v: s, t: chamadoStatusInfo(s).label }))}
                  aoMudar={(v) => salvar.mutate({ campo: "status", patch: { status: v as any } })}
                />
                <Escolha
                  titulo="Prioridade" estado={estados.prioridade} valor={chamado.prioridade ?? null}
                  vazio="— sem prioridade —"
                  opcoes={(["baixa", "normal", "alta", "urgente"] as ChamadoPrioridade[])
                    .map((p) => ({ v: p, t: PRIORIDADE_LABEL[p] }))}
                  aoMudar={(v) => salvar.mutate({ campo: "prioridade", patch: { prioridade: v as any } })}
                />
                <Escolha
                  titulo="Equipe" estado={estados.equipe} valor={chamado.equipe ?? null}
                  vazio="— sem equipe —"
                  opcoes={(Object.keys(EQUIPE_LABEL) as Equipe[])
                    .map((e) => ({ v: e, t: EQUIPE_LABEL[e] }))}
                  aoMudar={(v) => salvar.mutate({ campo: "equipe", patch: { equipe: v as any } })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Campo titulo="Prazo" estado={estados.prazo_limite}>
                  <input
                    type="date"
                    value={prazoParaData(chamado.prazo_limite)}
                    onChange={(e) => salvar.mutate({
                      campo: "prazo_limite",
                      patch: { prazo_limite: dataParaPrazo(e.target.value || null) },
                    })}
                    style={est.entrada}
                  />
                </Campo>
                <Escolha
                  titulo="Sprint" estado={estados.sprint} valor={chamado.sprint ?? null}
                  vazio="— sem sprint —"
                  opcoes={(Object.keys(SPRINT_LABEL) as ChamadoSprint[])
                    .map((s) => ({ v: s, t: SPRINT_LABEL[s] }))}
                  aoMudar={(v) => salvar.mutate({ campo: "sprint", patch: { sprint: v as any } })}
                />
              </div>

              {/* Agendamento só faz sentido em campo: é a hora de a dupla sair.
                  No chamado interno o que organiza é a sprint, acima. */}
              {natureza === "campo" && (
                <Campo titulo="Agendado para" estado={estados.data_hora_agendada}>
                  <input
                    type="datetime-local"
                    value={chamado.data_hora_agendada
                      ? paraEntradaLocal(chamado.data_hora_agendada) : ""}
                    onChange={(e) => salvar.mutate({
                      campo: "data_hora_agendada",
                      patch: {
                        data_hora_agendada: e.target.value
                          ? new Date(e.target.value).toISOString() : null,
                      },
                    })}
                    style={est.entrada}
                  />
                </Campo>
              )}

              <Texto
                titulo="Descrição" linhas={4} estado={estados.descricao_problema}
                chaveReset={chamadoId} valor={chamado.descricao_problema ?? ""}
                aoSalvar={(v) => salvar.mutate({
                  campo: "descricao_problema", patch: { descricao_problema: v || null },
                })}
              />

              {/* A proposta tem fluxo próprio (visita → orçamento → envio) e
                  este painel não o substitui: mexer no funil pelo atalho das
                  propriedades deixaria a visita e a capa contando histórias
                  diferentes. O caminho é a página da visita. */}
              {natureza === "comercial" && (
                <button
                  onClick={() => aoAbrirPagina(chamado.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "11px 16px", borderRadius: 12, border: est.borda,
                    background: est.campoBg, color: est.textPrimary, cursor: "pointer",
                    fontFamily: FONT, fontWeight: 600, fontSize: 12.5,
                  }}
                >
                  <ExternalLink size={14} /> Abrir o fluxo da proposta
                </button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * ISO → "AAAA-MM-DDTHH:MM" na hora LOCAL, que é o que o input espera.
 * `toISOString().slice(0,16)` devolveria UTC e mostraria a visita das 9h como
 * 12h — três horas de diferença que ninguém repara até alguém perder a hora.
 */
function paraEntradaLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
