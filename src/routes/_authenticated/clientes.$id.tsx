// Ficha do cliente — dados, contatos e histórico. Etapa 1 do sistema de OS;
// inventário na Etapa 2, chamados na Etapa 3, contratos na U2, plantão na U92.
//
// ── R146 (U96): A FICHA É TELA DE COMPUTADOR, EM DUAS COLUNAS ──────────────
// Davi, 2026-09-03: "Faça uma reestruturação na tela de configuração do
// cliente, lembre-se que ela será acessada sempre por computador, então adapte
// a tela para um layout otimizado para desktop/notebook." E: "deverá ter um
// campo para preencher o nome, WhatsApp e e-mail do síndico e do zelador;
// deverá ter também o tipo de local […] vamos adicionar a foto da fachada de
// cada cliente, crie o botão para adicionar a foto da fachada na página de
// configuração do cliente".
//
// Então a mesma grade da página da atividade (.detalhe-grid, R135): a coluna
// LARGA é o histórico — inventário, contratos, chamados, plantão, visitas —, a
// coluna ESTREITA é a identidade: a fachada, o tipo de local, o endereço, os
// serviços prestados, síndico e zelador (WhatsApp clicável) e as observações.
// No celular empilha, como sempre. O modo de edição continua sendo o
// ClienteForm, em largura inteira.
//
// Os campos de síndico e zelador JÁ EXISTIAM no banco desde a Etapa 1
// (nome/telefone/email ×2); o que faltava era chamar o telefone de WhatsApp e
// fazê-lo abrir o WhatsApp. A foto também existia como coluna órfã
// (`foto_fachada_url`) — ver features/clientes/data.ts.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Camera, FileText, MapPin, Pencil, Phone, Mail, Users, CalendarDays, Wrench, X, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente, useVeFinanceiro } from "@/features/gerencial/data";
import { TIPO_LABEL, whatsappLink } from "@/features/gerencial/constants";
import { getStatusInfo } from "@/lib/visita-status";
import { visitaRouteFor } from "@/lib/visita-route";
import { card } from "@/lib/ui";
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
  useFachadaUrl,
  atualizarCliente,
  subirFachada,
  removerFachada,
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

/**
 * Quantos chamados a ficha mostra antes do "ver todos". Antes eram 8, cortados
 * em SILÊNCIO (`slice(0, 8)` sem aviso) — uma lista cortada calada lê-se como o
 * histórico inteiro. Agora o teto é declarado, e há um botão para abrir tudo.
 */
const TETO_CHAMADOS = 12;

function ClienteDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: veFinanceiro = false } = useVeFinanceiro();
  const { data: cliente, isLoading } = useCliente(id);
  const { data: visitas = [] } = useVisitasDoCliente(id);
  // R143: inclui as atividades de GRUPO a que este cliente pertence, e as em
  // que ele é local extra — não só as em que é o cliente principal
  const { data: ordens = [] } = useChamadosDoCliente(id, cliente?.servicos_prestados);
  const plantao = useAtendimentosDoCliente(id);
  const { data: contratos = [] } = useContratosDoCliente(id);
  const { data: fotoUrl } = useFachadaUrl(cliente?.foto_fachada_url);
  const [editando, setEditando] = useState(false);
  const [todosOsChamados, setTodosOsChamados] = useState(false);
  const [fotoPronta, setFotoPronta] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // card() de lib/ui — a superfície da casa; a cópia v3 que morava aqui
  // destoava das telas irmãs (a página da atividade já usa card()).
  const CARD: CSSProperties = {
    ...card(isLight),
    padding: "16px 16px",
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
  const botaoLeve: CSSProperties = {
    height: 34, padding: "0 12px", borderRadius: 10,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, cursor: "pointer", flexShrink: 0,
    fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
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

  // R146: a foto da fachada — sobe para o bucket privado e grava o caminho
  const trocarFoto = useMutation({
    mutationFn: async (arquivo: File) => {
      if (!cliente) throw new Error("Cliente ainda não carregou.");
      return subirFachada(cliente, arquivo);
    },
    onSuccess: () => {
      setFotoPronta(false);
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["fachada-url"] });
      toast.success("Foto da fachada atualizada.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui enviar a foto. O bucket clientes-fachadas existe? (migration U96)"),
  });
  const apagarFoto = useMutation({
    mutationFn: async () => {
      if (!cliente) throw new Error("Cliente ainda não carregou.");
      return removerFachada(cliente);
    },
    onSuccess: () => {
      setFotoPronta(false);
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["fachada-url"] });
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

  // Residência e galpão não têm síndico nem zelador: é proprietário e
  // encarregado(a) — o mesmo vocabulário do formulário da proposta (R147).
  const semSindico = cliente.tipo_local === "residencia" || cliente.tipo_local === "empresa";
  const rotuloContato1 = semSindico ? "Proprietário" : "Síndico";
  const rotuloContato2 = semSindico ? "Encarregado(a)" : "Zelador(a)";

  /** Um bloco de contato: nome, WhatsApp (abre o WhatsApp) e e-mail (abre o e-mail). */
  function Contato({ rotulo, nome, whatsapp, email }: { rotulo: string; nome: string | null; whatsapp: string | null; email: string | null }) {
    if (!nome && !whatsapp && !email) return null;
    const linkStyle: CSSProperties = { ...linhaValor, color: gold, textDecoration: "none" };
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ ...linha, borderTop: "none", paddingTop: 10 }}>
          <span style={{ ...linhaLabel, display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={13} color={gold} /> {rotulo}
          </span>
          <span style={linhaValor}>{nome ?? "—"}</span>
        </div>
        <div style={linha}>
          <span style={{ ...linhaLabel, display: "flex", alignItems: "center", gap: 6, fontWeight: 400, color: textSecondary }}>
            <Phone size={12} color={gold} /> WhatsApp
          </span>
          {whatsapp
            ? <a href={whatsappLink(whatsapp)} target="_blank" rel="noopener noreferrer" style={linkStyle}>{whatsapp}</a>
            : <span style={linhaValor}>—</span>}
        </div>
        <div style={linha}>
          <span style={{ ...linhaLabel, display: "flex", alignItems: "center", gap: 6, fontWeight: 400, color: textSecondary }}>
            <Mail size={12} color={gold} /> E-mail
          </span>
          {email
            ? <a href={`mailto:${email}`} style={linkStyle}>{email}</a>
            : <span style={linhaValor}>—</span>}
        </div>
      </div>
    );
  }

  const chamadosVisiveis = todosOsChamados ? ordens : ordens.slice(0, TETO_CHAMADOS);

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
            {editando
              ? cliente.nome
              : `${ordens.length} atividade${ordens.length === 1 ? "" : "s"} · ${visitas.length} visita${visitas.length === 1 ? "" : "s"} no histórico`}
          </div>
        </div>
        {!editando && isGerente && (
          <button
            onClick={() => setEditando(true)}
            style={{ ...botaoLeve, height: 40, padding: "0 14px", borderRadius: 12, fontSize: 12 }}
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
        <div className="detalhe-grid">
          {/* ══ COLUNA LARGA — o histórico ═══════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
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
                    style={{ ...botaoLeve, marginLeft: "auto", height: 30, padding: "0 10px" }}
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

            {/* Atividades do cliente — Etapa 3, completadas na U96 (R143): as
                dele, as em que ele é local extra e as do GRUPO a que pertence. */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wrench size={15} color={gold} />
                <span style={SEC_LABEL}>Atividades</span>
                <span style={{ flex: 1 }} />
                {isGerente && (
                  <button onClick={() => navigate({ to: "/chamados/novo" })} style={botaoLeve}>
                    Abrir
                  </button>
                )}
              </div>
              {ordens.length === 0 ? (
                <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                  Nenhuma atividade registrada para este cliente.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {chamadosVisiveis.map((o) => {
                    const info = chamadoStatusInfo(o.status);
                    const corSt = isLight ? info.colorLight : info.color;
                    // veio pelo grupo ou como local extra — a ficha diz, para a
                    // pessoa não estranhar uma atividade "de outro cliente" aqui
                    const indireta = o.cliente_id !== id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => navigate({ to: "/chamados/$id", params: { id: o.id } })}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                          background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                          borderLeft: `3px solid ${corSt}`,
                          color: textPrimary,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600 }}>
                            {o.titulo}
                          </div>
                          <div style={{ fontFamily: "var(--fonte)", fontSize: 10, color: textSecondary }}>
                            {o.numero ?? "—"} · {new Date(o.created_at).toLocaleDateString("pt-BR")}
                            {indireta ? " · pelo grupo de clientes ou como local extra" : ""}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: "3px 8px", borderRadius: 12, flexShrink: 0,
                            background: info.bg, border: `1px solid ${info.border}`, color: corSt,
                            fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                          }}
                        >
                          {info.labelUpper}
                        </span>
                      </button>
                    );
                  })}
                  {ordens.length > TETO_CHAMADOS && (
                    /* O TETO É DECLARADO — a lição da seção de plantão. */
                    <button
                      onClick={() => setTodosOsChamados((v) => !v)}
                      style={{
                        alignSelf: "flex-start", background: "transparent", border: "none", padding: 0,
                        cursor: "pointer", color: gold, fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5,
                      }}
                    >
                      {todosOsChamados
                        ? "Mostrar só as mais recentes"
                        : `Mostrando ${TETO_CHAMADOS} de ${ordens.length} · ver todas`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Plantão — o pedaço que faltava no histórico (R123, U92).
                FECHADO POR `isGerente`, e não deixado aberto: a policy de
                `atendimentos_plantao` é "dono OU gestor", então para o técnico
                a lista viria PARCIAL — só os atendimentos dele — parecendo o
                histórico inteiro do cliente. Uma lista que mostra um pedaço com
                cara de tudo é pior que uma seção ausente. */}
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
          </div>

          {/* ══ COLUNA ESTREITA — a identidade ═══════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {/* Identificação, com a FACHADA no topo (R146) */}
            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <div style={{ position: "relative", minHeight: fotoUrl ? 190 : 0 }}>
                {fotoUrl && (
                  <img
                    src={fotoUrl}
                    alt={`Fachada de ${cliente.nome}`}
                    onLoad={() => setFotoPronta(true)}
                    style={{
                      width: "100%", height: 190, objectFit: "cover", display: "block",
                      opacity: fotoPronta ? 1 : 0, transition: "opacity .45s ease",
                    }}
                  />
                )}
                {isGerente && (
                  <div style={{
                    position: fotoUrl ? "absolute" : "static", right: 10, bottom: 10,
                    display: "flex", gap: 6, padding: fotoUrl ? 0 : "14px 16px 0",
                  }}>
                    <input
                      ref={fotoRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) trocarFoto.mutate(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <button
                      onClick={() => fotoRef.current?.click()}
                      disabled={trocarFoto.isPending}
                      style={{
                        ...botaoLeve,
                        background: fotoUrl ? (isLight ? "rgba(255,255,255,0.88)" : "rgba(8,8,12,0.72)") : botaoLeve.background,
                        cursor: trocarFoto.isPending ? "wait" : "pointer",
                      }}
                    >
                      <Camera size={13} color={gold} />
                      {trocarFoto.isPending ? "Enviando…" : fotoUrl ? "Trocar foto" : "Adicionar foto da fachada"}
                    </button>
                    {fotoUrl && (
                      <button
                        onClick={() => { if (confirm("Remover a foto da fachada?")) apagarFoto.mutate(); }}
                        aria-label="Remover foto da fachada"
                        title="Remover foto da fachada"
                        style={{
                          ...botaoLeve, width: 34, padding: 0, justifyContent: "center",
                          background: isLight ? "rgba(255,255,255,0.88)" : "rgba(8,8,12,0.72)",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: 16 }}>
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
                      {/* R146: o tipo de local — Cond. Vertical, Cond. Horizontal,
                          Galpão ou Residência — sempre visível; sem ele, o aviso */}
                      <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: cliente.tipo_local ? textSecondary : (isLight ? "#AD4700" : "#FA842D") }}>
                        {cliente.tipo_local ? (TIPO_LABEL[cliente.tipo_local] ?? cliente.tipo_local) : "tipo de local não informado"}
                      </span>
                    </div>

                    {/* SERVIÇO PRESTADO (R41) — etiquetas que também são o
                        controle. A gravação manda o ARRAY inteiro. */}
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
                  {(cliente.cidade || cliente.uf) && (
                    <div style={linha}>
                      <span style={linhaLabel}>Cidade</span>
                      <span style={linhaValor}>{[cliente.cidade, cliente.uf].filter(Boolean).join(" / ")}</span>
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
            </div>

            {/* Contatos (R146): síndico e zelador — nome, WhatsApp e e-mail */}
            <div style={CARD}>
              <span style={SEC_LABEL}>Contatos</span>
              {!cliente.nome_sindico && !cliente.telefone_sindico && !cliente.email_sindico
                && !cliente.nome_zelador && !cliente.telefone_zelador && !cliente.email_zelador ? (
                <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                  Nenhum contato cadastrado{isGerente ? " — use Editar para preencher." : "."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Contato rotulo={rotuloContato1} nome={cliente.nome_sindico} whatsapp={cliente.telefone_sindico} email={cliente.email_sindico} />
                  <Contato rotulo={rotuloContato2} nome={cliente.nome_zelador} whatsapp={cliente.telefone_zelador} email={cliente.email_zelador} />
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
          </div>
        </div>
      )}
    </div>
  );
}
