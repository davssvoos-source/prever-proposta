// Ficha do cliente — dados, contatos e histórico de visitas. Etapa 1 do
// sistema de OS. O inventário de equipamentos entra na Etapa 2 e as ordens de
// serviço na Etapa 3, ambos nesta mesma tela.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileText, MapPin, Pencil, Phone, Mail, Users, CalendarDays, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente, useVeFinanceiro } from "@/features/gerencial/data";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import { getStatusInfo } from "@/lib/visita-status";
import { visitaRouteFor } from "@/lib/visita-route";
import { ClienteForm } from "@/features/clientes/ClienteForm";
import { InventarioCliente } from "@/features/clientes/InventarioCliente";
import { useChamadosDoCliente } from "@/features/chamados/data";
import { useAtendimentosDoCliente, TETO_DA_LISTA as TETO_PLANTAO } from "@/features/plantao/data";
import { diaCurto, horaCurta, TIPO_LABEL as PLANTAO_TIPO_LABEL } from "@/features/plantao/modelo";
import { chamadoStatusInfo } from "@/lib/chamado-status";
import {
  useContratosDoCliente, contratoVigente,
  MODALIDADE_LABEL, STATUS_CONTRATO_LABEL, STATUS_CONTRATO_CORES,
} from "@/features/contratos/data";
import {
  useCliente,
  useVisitasDoCliente,
  atualizarCliente,
  SITUACAO_LABEL,
  SITUACAO_CORES,
  SERVICO_ORDEM,
  SERVICO_LABEL,
  SERVICO_CORES,
  temServico,
  type ClientePatch,
} from "@/features/clientes/data";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetalhePage,
});

function ClienteDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: veFinanceiro = false } = useVeFinanceiro();
  const { data: cliente, isLoading } = useCliente(id);
  const { data: visitas = [] } = useVisitasDoCliente(id);
  const { data: ordens = [] } = useChamadosDoCliente(id);
  const plantao = useAtendimentosDoCliente(id);
  const { data: contratos = [] } = useContratosDoCliente(id);
  const [editando, setEditando] = useState(false);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 18,
    padding: "16px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SEC_LABEL: CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const linha: CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0",
    borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
  };
  const linhaLabel: CSSProperties = { fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 };
  const linhaValor: CSSProperties = {
    fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 400,
    color: textSecondary, textAlign: "right", minWidth: 0, wordBreak: "break-word",
  };

  const salvar = useMutation({
    mutationFn: (patch: ClientePatch) => atualizarCliente(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setEditando(false);
      toast.success("Cliente atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voltar = () => navigate({ to: "/clientes" });

  if (isLoading) {
    return (
      <div style={{ padding: "24px 0", color: textSecondary, fontFamily: "var(--fonte)", fontSize: 13 }}>
        Carregando cliente…
      </div>
    );
  }
  if (!cliente) {
    return (
      <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: 12, color: textPrimary }}>
        <span style={{ fontFamily: "var(--fonte)", fontSize: 14 }}>Cliente não encontrado.</span>
        <button
          onClick={voltar}
          style={{
            alignSelf: "flex-start", height: 44, padding: "0 18px", borderRadius: 22, border: "none",
            background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)", color: "#08090E",
            fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}
        >
          Voltar para clientes
        </button>
      </div>
    );
  }

  const cor = SITUACAO_CORES[cliente.situacao] ?? SITUACAO_CORES.ativo;

  const contatos: { icone: typeof Phone; rotulo: string; valor: string | null }[] = [
    { icone: Users, rotulo: "Síndico", valor: cliente.nome_sindico },
    { icone: Phone, rotulo: "Telefone do síndico", valor: cliente.telefone_sindico },
    { icone: Mail, rotulo: "E-mail do síndico", valor: cliente.email_sindico },
    { icone: Users, rotulo: "Zelador", valor: cliente.nome_zelador },
    { icone: Phone, rotulo: "Telefone do zelador", valor: cliente.telefone_zelador },
    { icone: Mail, rotulo: "E-mail do zelador", valor: cliente.email_zelador },
  ].filter((c) => !!c.valor);

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={editando ? () => setEditando(false) : voltar}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          {editando ? <X size={18} /> : <ArrowLeft size={18} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {editando ? "Editar cliente" : cliente.nome}
          </div>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            {editando ? cliente.nome : `${visitas.length} visita${visitas.length === 1 ? "" : "s"} no histórico`}
          </div>
        </div>
        {!editando && isGerente && (
          <button
            onClick={() => setEditando(true)}
            style={{
              height: 40, padding: "0 14px", borderRadius: 12,
              background: isLight ? "#ffffff" : "#191921",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              color: textPrimary, display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12,
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <Pencil size={14} color={gold} />
            Editar
          </button>
        )}
      </div>

      {editando ? (
        <ClienteForm
          inicial={cliente}
          salvando={salvar.isPending}
          onSubmit={(patch) => salvar.mutate(patch)}
          onCancelar={() => setEditando(false)}
          rotuloAcao="Salvar alterações"
        />
      ) : (
        <>
          {/* Identificação */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: isLight ? "rgba(160,97,8,0.10)" : "rgba(248,200,17,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Building2 size={20} color={gold} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 16 }}>{cliente.nome}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "3px 9px", borderRadius: 12,
                      background: cor.bg, border: `1px solid ${cor.border}`,
                      color: isLight ? cor.light : cor.dark,
                      fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}
                  >
                    {SITUACAO_LABEL[cliente.situacao] ?? cliente.situacao}
                  </span>
                  {cliente.tipo_local && (
                    <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                      {TIPO_LABEL[cliente.tipo_local] ?? cliente.tipo_local}
                    </span>
                  )}
                </div>

                {/* SERVIÇO PRESTADO (R41) — etiquetas que também são o
                    controle. Um botão por serviço: aceso = presta, apagado =
                    não presta. Sem modo de edição à parte, porque a pergunta
                    "este prédio tem portaria?" costuma vir junto com a
                    resposta, e um formulário no meio atrapalharia.
                    A gravação manda o ARRAY inteiro, não um "adicione isto":
                    é o estado completo, e assim dois cliques rápidos não
                    disputam a mesma coluna. */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                  <span style={{
                    fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9,
                    letterSpacing: "0.10em", textTransform: "uppercase", color: textSecondary,
                  }}>
                    Serviço prestado
                  </span>
                  {SERVICO_ORDEM.map((s) => {
                    const tem = temServico(cliente, s);
                    const cs = SERVICO_CORES[s];
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          const atuais = (cliente.servicos_prestados ?? []) as string[];
                          const novos = tem
                            ? atuais.filter((x) => x !== s)
                            : [...atuais, s];
                          salvar.mutate({ servicos_prestados: novos });
                        }}
                        disabled={salvar.isPending}
                        aria-pressed={tem}
                        title={tem ? `Remover ${SERVICO_LABEL[s]}` : `Marcar ${SERVICO_LABEL[s]}`}
                        style={{
                          padding: "4px 11px", borderRadius: 999, cursor: "pointer",
                          background: tem ? cs.bg : "transparent",
                          border: tem
                            ? `1px solid ${cs.border}`
                            : isLight ? "1px dashed rgba(0,0,0,0.20)" : "1px dashed rgba(255,255,255,0.20)",
                          color: tem ? (isLight ? cs.light : cs.dark) : textSecondary,
                          fontFamily: "var(--fonte)", fontWeight: tem ? 700 : 500, fontSize: 10,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {SERVICO_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
              <div style={{ ...linha, borderTop: "none" }}>
                <span style={linhaLabel}>Endereço</span>
                <span style={linhaValor}>{cliente.endereco ?? "—"}</span>
              </div>
              {cliente.complemento && (
                <div style={linha}>
                  <span style={linhaLabel}>Complemento</span>
                  <span style={linhaValor}>{cliente.complemento}</span>
                </div>
              )}
              {cliente.qtd_apartamentos != null && (
                <div style={linha}>
                  <span style={linhaLabel}>Apartamentos / unidades</span>
                  <span style={linhaValor}>{cliente.qtd_apartamentos}</span>
                </div>
              )}
              {cliente.qtd_acessos != null && (
                <div style={linha}>
                  <span style={linhaLabel}>Acessos controlados</span>
                  <span style={linhaValor}>{cliente.qtd_acessos}</span>
                </div>
              )}
              {cliente.latitude != null && cliente.longitude != null && (
                <div style={linha}>
                  <span style={linhaLabel}>Coordenadas</span>
                  <span style={{ ...linhaValor, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    <MapPin size={12} color={gold} />
                    {cliente.latitude.toFixed(5)}, {cliente.longitude.toFixed(5)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Contatos */}
          <div style={CARD}>
            <span style={SEC_LABEL}>Contatos</span>
            {contatos.length === 0 ? (
              <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                Nenhum contato cadastrado.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                {contatos.map((c, i) => (
                  <div key={i} style={i === 0 ? { ...linha, borderTop: "none" } : linha}>
                    <span style={{ ...linhaLabel, display: "flex", alignItems: "center", gap: 6 }}>
                      <c.icone size={13} color={gold} />
                      {c.rotulo}
                    </span>
                    <span style={linhaValor}>{c.valor}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          {cliente.observacoes && (
            <div style={CARD}>
              <span style={SEC_LABEL}>Observações</span>
              <div style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 400, color: textPrimary, marginTop: 8, whiteSpace: "pre-wrap" }}>
                {cliente.observacoes}
              </div>
            </div>
          )}

          {/* Inventário (as-built) — Etapa 2 */}
          <InventarioCliente clienteId={id} podeEditar={true} />

          {/* Contratos — Etapa U2. Só quem enxerga financeiro (admin/comercial):
              a RLS já barra, e o card seria eternamente vazio para SAC/técnico. */}
          {veFinanceiro && (
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={15} color={gold} />
                <span style={SEC_LABEL}>Contratos</span>
                <button
                  onClick={() => navigate({ to: "/contratos/novo", search: { cliente: id } as any })}
                  style={{
                    marginLeft: "auto", padding: "6px 10px", borderRadius: 10, cursor: "pointer",
                    background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.04)",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11,
                  }}
                >
                  Novo
                </button>
              </div>
              {contratos.length === 0 ? (
                <div style={{ fontFamily: "var(--fonte)", fontSize: 12.5, fontWeight: 400, color: textSecondary, marginTop: 8 }}>
                  Nenhum contrato cadastrado. Sem contrato vigente, todo atendimento
                  deste cliente é faturável — mão de obra e equipamento.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {contratos.map((c) => {
                    const stc = STATUS_CONTRATO_CORES[c.status];
                    const vigente = contratoVigente(contratos)?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate({ to: "/contratos/$id", params: { id: c.id } })}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                          padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                          background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                          border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                            {MODALIDADE_LABEL[c.modalidade]}
                            {c.numero ? ` · nº ${c.numero}` : ""}
                            {vigente && (
                              <span style={{ color: gold, fontSize: 11, fontWeight: 600 }}> · vigente</span>
                            )}
                          </div>
                          <div style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                            {c.vigencia_fim
                              ? `até ${c.vigencia_fim.split("-").reverse().join("/")}`
                              : "vigência aberta"}
                            {c.valor_mensal != null &&
                              ` · ${c.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês`}
                          </div>
                        </div>
                        <span style={{
                          flexShrink: 0, padding: "3px 8px", borderRadius: 999,
                          fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                          color: isLight ? stc.light : stc.dark, background: stc.bg,
                          border: `1px solid ${stc.border}`,
                        }}>
                          {STATUS_CONTRATO_LABEL[c.status]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Chamados do cliente — Etapa 3 */}
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Wrench size={15} color={gold} />
              <span style={SEC_LABEL}>Chamados</span>
              <span style={{ flex: 1 }} />
              {isGerente && (
                <button
                  onClick={() => navigate({ to: "/chamados/novo" })}
                  style={{
                    height: 34, padding: "0 12px", borderRadius: 10,
                    background: isLight ? "#ffffff" : "#191921",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                    color: textPrimary, cursor: "pointer", flexShrink: 0,
                    fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 600,
                  }}
                >
                  Abrir
                </button>
              )}
            </div>
            {ordens.length === 0 ? (
              <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                Nenhum chamado registrado para este cliente.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {ordens.slice(0, 8).map((o) => {
                  const info = chamadoStatusInfo(o.status);
                  const cor = isLight ? info.colorLight : info.color;
                  return (
                    <button
                      key={o.id}
                      onClick={() => navigate({ to: "/chamados/$id", params: { id: o.id } })}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                        background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                        border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                        borderLeft: `3px solid ${cor}`,
                        color: textPrimary,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600 }}>
                          {o.titulo}
                        </div>
                        <div style={{ fontFamily: "var(--fonte)", fontSize: 10, color: textSecondary }}>
                          {o.numero ?? "—"} · {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "3px 8px", borderRadius: 12, flexShrink: 0,
                          background: info.bg, border: `1px solid ${info.border}`, color: cor,
                          fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                        }}
                      >
                        {info.labelUpper}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Plantão — o pedaço que faltava no histórico (R123, U92).
              A ficha mostrava contratos, chamados e visitas; o plantão nasceu
              na U87 e nunca chegou aqui. Um cliente atendido às 3h da manhã
              não tinha esse fato em lugar nenhum da própria ficha.

              FECHADO POR `isGerente`, e não deixado aberto: a policy de
              `atendimentos_plantao` é "dono OU gestor", então para o técnico
              a lista viria PARCIAL — só os atendimentos dele — parecendo o
              histórico inteiro do cliente. Uma lista que mostra um pedaço com
              cara de tudo é pior que uma seção ausente. É a mesma razão pela
              qual Contratos é fechado por `veFinanceiro`. */}
          {isGerente && (
            <div style={CARD}>
              <span style={SEC_LABEL}>Plantão</span>
              {plantao.isError ? (
                /* Erro NÃO vira "nenhum atendimento" — a lição da U86. */
                <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: isLight ? "#B42318" : "#FF6B6B", paddingTop: 10 }}>
                  Não foi possível ler os atendimentos de plantão: {(plantao.error as Error)?.message}
                </div>
              ) : plantao.isLoading ? (
                <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                  Carregando…
                </div>
              ) : (plantao.data ?? []).length === 0 ? (
                <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                  Nenhum atendimento de plantão registrado para este cliente.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {(plantao.data ?? []).map((a) => (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 12,
                      background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                      border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <span style={{
                        fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 700,
                        color: gold, fontVariantNumeric: "tabular-nums", flexShrink: 0,
                      }}>
                        {diaCurto(a.dia)} · {horaCurta(a.hora)}
                      </span>
                      <span style={{
                        fontFamily: "var(--fonte)", fontSize: 12.5, color: textPrimary,
                        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {a.descricao}
                      </span>
                      <span style={{
                        fontFamily: "var(--fonte)", fontSize: 10, fontWeight: 700, flexShrink: 0,
                        letterSpacing: "0.08em", textTransform: "uppercase", color: textSecondary,
                      }}>
                        {PLANTAO_TIPO_LABEL[a.tipo as "remoto" | "presencial"] ?? a.tipo}
                      </span>
                    </div>
                  ))}
                  {(plantao.data ?? []).length === TETO_PLANTAO && (
                    /* O TETO É DECLARADO: uma lista cortada em silêncio
                       lê-se como o histórico inteiro. */
                    <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                      Mostrando os {TETO_PLANTAO} mais recentes.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Histórico de visitas */}
          <div style={CARD}>
            <span style={SEC_LABEL}>Histórico de visitas</span>
            {visitas.length === 0 ? (
              <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                Nenhuma visita técnica registrada para este cliente.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {visitas.map((v: any) => {
                  const info = getStatusInfo(v.status);
                  // mesmo par por tema do bloco de chamados acima: no claro o
                  // #F8C811 do bucket PENDENTE some sobre o branco da linha
                  const corVisita = isLight ? info.colorLight : info.color;
                  const quando = v.data_hora_agendada ?? v.created_at;
                  return (
                    <button
                      key={v.id}
                      onClick={() => navigate(visitaRouteFor(v.status, v.id) as any)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                        background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                        border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                        borderLeft: `3px solid ${corVisita}`,
                        color: textPrimary,
                      }}
                    >
                      <CalendarDays size={14} color={textSecondary} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--fonte)", fontSize: 12 }}>
                        {quando
                          ? new Date(quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "sem data"}
                      </span>
                      <span
                        style={{
                          padding: "3px 8px", borderRadius: 12, flexShrink: 0,
                          background: info.bg, border: `1px solid ${info.border}`,
                          color: corVisita,
                          fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                        }}
                      >
                        {info.labelUpper}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
