// Ficha do cliente — dados, contatos e histórico de visitas. Etapa 1 do
// sistema de OS. O inventário de equipamentos entra na Etapa 2 e as ordens de
// serviço na Etapa 3, ambos nesta mesma tela.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, FileText, MapPin, Pencil, Phone, Mail, Users, CalendarDays, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente } from "@/features/gerencial/data";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import { getStatusInfo } from "@/lib/visita-status";
import { visitaRouteFor } from "@/lib/visita-route";
import { ClienteForm } from "@/features/clientes/ClienteForm";
import { InventarioCliente } from "@/features/clientes/InventarioCliente";
import { useOrdensDoCliente } from "@/features/os/data";
import { osStatusInfo } from "@/lib/os-status";
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
  const { data: cliente, isLoading } = useCliente(id);
  const { data: visitas = [] } = useVisitasDoCliente(id);
  const { data: ordens = [] } = useOrdensDoCliente(id);
  const { data: contratos = [] } = useContratosDoCliente(id);
  const [editando, setEditando] = useState(false);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "16px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SEC_LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const linha: CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0",
    borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
  };
  const linhaLabel: CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 };
  const linhaValor: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 400,
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
      <div style={{ padding: "24px 0", color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
        Carregando cliente…
      </div>
    );
  }
  if (!cliente) {
    return (
      <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: 12, color: textPrimary }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14 }}>Cliente não encontrado.</span>
        <button
          onClick={voltar}
          style={{
            alignSelf: "flex-start", height: 44, padding: "0 18px", borderRadius: 22, border: "none",
            background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", color: "#08090E",
            fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer",
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
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {editando ? "Editar cliente" : cliente.nome}
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
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
              fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
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
                  background: isLight ? "rgba(184,120,0,0.10)" : "rgba(255,192,0,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Building2 size={20} color={gold} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 16 }}>{cliente.nome}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "3px 9px", borderRadius: 12,
                      background: cor.bg, border: `1px solid ${cor.border}`,
                      color: isLight ? cor.light : cor.dark,
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}
                  >
                    {SITUACAO_LABEL[cliente.situacao] ?? cliente.situacao}
                  </span>
                  {cliente.tipo_local && (
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                      {TIPO_LABEL[cliente.tipo_local] ?? cliente.tipo_local}
                    </span>
                  )}
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
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
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
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 300, color: textPrimary, marginTop: 8, whiteSpace: "pre-wrap" }}>
                {cliente.observacoes}
              </div>
            </div>
          )}

          {/* Inventário (as-built) — Etapa 2 */}
          <InventarioCliente clienteId={id} podeEditar={true} />

          {/* Contratos — Etapa U2. Só quem enxerga financeiro: a RLS já barra,
              mas mostrar um card vazio ao técnico só confundiria. */}
          {isGerente && (
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={15} color={gold} />
                <span style={SEC_LABEL}>Contratos</span>
                <button
                  onClick={() => navigate({ to: "/contratos/novo" })}
                  style={{
                    marginLeft: "auto", padding: "6px 10px", borderRadius: 10, cursor: "pointer",
                    background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.04)",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                    color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11,
                  }}
                >
                  Novo
                </button>
              </div>
              {contratos.length === 0 ? (
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, fontWeight: 300, color: textSecondary, marginTop: 8 }}>
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
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textPrimary }}>
                            {MODALIDADE_LABEL[c.modalidade]}
                            {c.numero ? ` · nº ${c.numero}` : ""}
                            {vigente && (
                              <span style={{ color: gold, fontSize: 11, fontWeight: 600 }}> · vigente</span>
                            )}
                          </div>
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                            {c.vigencia_fim
                              ? `até ${c.vigencia_fim.split("-").reverse().join("/")}`
                              : "vigência aberta"}
                            {c.valor_mensal != null &&
                              ` · ${c.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês`}
                          </div>
                        </div>
                        <span style={{
                          flexShrink: 0, padding: "3px 8px", borderRadius: 999,
                          fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9,
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
                  onClick={() => navigate({ to: "/os/nova" })}
                  style={{
                    height: 34, padding: "0 12px", borderRadius: 10,
                    background: isLight ? "#ffffff" : "#191921",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                    color: textPrimary, cursor: "pointer", flexShrink: 0,
                    fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600,
                  }}
                >
                  Abrir
                </button>
              )}
            </div>
            {ordens.length === 0 ? (
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                Nenhum chamado registrado para este cliente.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {ordens.slice(0, 8).map((o) => {
                  const info = osStatusInfo(o.status);
                  const cor = isLight ? info.colorLight : info.color;
                  return (
                    <button
                      key={o.id}
                      onClick={() => navigate({ to: "/os/$id", params: { id: o.id } })}
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
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600 }}>
                          {o.titulo}
                        </div>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: textSecondary }}>
                          {o.numero ?? "—"} · {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "3px 8px", borderRadius: 12, flexShrink: 0,
                          background: info.bg, border: `1px solid ${info.border}`, color: cor,
                          fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
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

          {/* Histórico de visitas */}
          <div style={CARD}>
            <span style={SEC_LABEL}>Histórico de visitas</span>
            {visitas.length === 0 ? (
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary, paddingTop: 10 }}>
                Nenhuma visita técnica registrada para este cliente.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {visitas.map((v: any) => {
                  const info = getStatusInfo(v.status);
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
                        borderLeft: `3px solid ${info.color}`,
                        color: textPrimary,
                      }}
                    >
                      <CalendarDays size={14} color={textSecondary} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 12 }}>
                        {quando
                          ? new Date(quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : "sem data"}
                      </span>
                      <span
                        style={{
                          padding: "3px 8px", borderRadius: 12, flexShrink: 0,
                          background: info.bg, border: `1px solid ${info.border}`,
                          color: info.color,
                          fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
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
