// Inventário do cliente (as-built) na ficha — Etapa 2 do sistema de OS.
// Lista os sistemas instalados e os equipamentos de cada um, permite importar
// do escopo aprovado de uma visita e registrar/ajustar o que se encontra em
// campo. Ver docs/SISTEMA_OS.md §4.2.

import { useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Boxes, ChevronDown, ChevronRight, Download, Minus, Plus, Search, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useInventario,
  useVisitasComEscopo,
  useCatalogoEquipamentos,
  derivarInventarioDaVisita,
  criarSistema,
  excluirSistema,
  criarEquipamentoInstalado,
  atualizarEquipamentoInstalado,
  excluirEquipamentoInstalado,
  nomeEquipamento,
  TIPO_SISTEMA_LABEL,
  TIPOS_SISTEMA,
  ESTADO_LABEL,
  ESTADO_CORES,
  ORIGEM_LABEL,
  type EstadoEquipamento,
  type ItemCatalogo,
  type SistemaInstalado,
  type TipoSistema,
} from "./inventario";

export function InventarioCliente({ clienteId, podeEditar }: { clienteId: string; podeEditar: boolean }) {
  const { isLight } = useTheme();
  const qc = useQueryClient();
  const { data: sistemas = [], isLoading } = useInventario(clienteId);
  const { data: visitasEscopo = [] } = useVisitasComEscopo(clienteId);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<null | { tipo: "importar" } | { tipo: "sistema" } | { tipo: "equipamento"; sistema: SistemaInstalado }>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 18,
    padding: "16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SEC_LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 700, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const btnSec: CSSProperties = {
    height: 38, padding: "0 14px", borderRadius: 12,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-visitas-escopo", clienteId] });
  };

  const importar = useMutation({
    mutationFn: (visitaId: string) => derivarInventarioDaVisita(clienteId, visitaId),
    onSuccess: (r) => {
      invalidar();
      setModal(null);
      toast.success(
        r.sistemas === 0
          ? "Nada novo para importar — os blocos desta visita já estão no inventário."
          : `${r.sistemas} sistema(s) e ${r.equipamentos} equipamento(s) importados.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerSistema = useMutation({
    mutationFn: (id: string) => excluirSistema(id),
    onSuccess: () => { invalidar(); toast.success("Sistema removido do inventário."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarEquipamento = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { qtd?: number; estado?: EstadoEquipamento } }) =>
      atualizarEquipamentoInstalado(id, patch),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removerEquipamento = useMutation({
    mutationFn: (id: string) => excluirEquipamentoInstalado(id),
    onSuccess: () => { invalidar(); toast.success("Equipamento removido."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalEquipamentos = sistemas.reduce(
    (s, sis) => s + sis.equipamentos.filter((e) => e.estado === "ativo").reduce((n, e) => n + Number(e.qtd || 0), 0),
    0,
  );
  const podeImportar = visitasEscopo.some((v) => v.qtdBlocosNovos > 0);

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Boxes size={16} color={gold} />
        <span style={SEC_LABEL}>Sistemas instalados</span>
        <span style={{ flex: 1 }} />
        {podeEditar && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {podeImportar && (
              <button style={btnSec} onClick={() => setModal({ tipo: "importar" })}>
                <Download size={14} color={gold} />
                Importar do escopo
              </button>
            )}
            <button style={btnSec} onClick={() => setModal({ tipo: "sistema" })}>
              <Plus size={14} color={gold} />
              Sistema
            </button>
          </div>
        )}
      </div>

      {sistemas.length > 0 && (
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary, marginTop: 8 }}>
          {sistemas.length} sistema{sistemas.length === 1 ? "" : "s"} · {totalEquipamentos} equipamento{totalEquipamentos === 1 ? "" : "s"} ativo{totalEquipamentos === 1 ? "" : "s"}
        </div>
      )}

      {isLoading ? (
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary, paddingTop: 12 }}>
          Carregando inventário…
        </div>
      ) : sistemas.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 14 }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary }}>
            Nenhum equipamento registrado neste cliente.
          </span>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            {podeImportar
              ? "Importe do escopo aprovado de uma visita ou registre os sistemas manualmente."
              : "Registre os sistemas manualmente — é o que os chamados vão usar para saber o que existe no local."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {sistemas.map((s) => {
            const aberto = expandidos.has(s.id);
            const ativos = s.equipamentos.filter((e) => e.estado === "ativo").length;
            return (
              <div
                key={s.id}
                style={{
                  borderRadius: 14,
                  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                  background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() =>
                    setExpandidos((prev) => {
                      const n = new Set(prev);
                      if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
                      return n;
                    })
                  }
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", background: "transparent", border: "none",
                    cursor: "pointer", textAlign: "left", color: textPrimary,
                  }}
                >
                  {aberto ? <ChevronDown size={16} color={textSecondary} /> : <ChevronRight size={16} color={textSecondary} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>{s.nome}</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                      {TIPO_SISTEMA_LABEL[s.tipo] ?? s.tipo} · {ativos} item{ativos === 1 ? "" : "ns"}
                      {s.origem_visita_bloco_id ? " · do escopo aprovado" : ""}
                    </div>
                  </div>
                </button>

                {aberto && (
                  <div style={{ padding: "0 14px 14px" }}>
                    {s.equipamentos.length === 0 ? (
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary, padding: "6px 0" }}>
                        Sem equipamentos registrados neste sistema.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {s.equipamentos.map((e) => {
                          const cor = ESTADO_CORES[e.estado] ?? ESTADO_CORES.ativo;
                          return (
                            <div
                              key={e.id}
                              style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                                borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600 }}>
                                  {nomeEquipamento(e)}
                                </div>
                                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: textSecondary }}>
                                  {[e.cod_eq, e.equipamento?.marca, e.equipamento?.modelo].filter(Boolean).join(" · ")}
                                  {e.origem !== "implantacao" ? ` · ${ORIGEM_LABEL[e.origem]}` : ""}
                                </div>
                              </div>
                              {podeEditar ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                  <button
                                    onClick={() => mudarEquipamento.mutate({ id: e.id, patch: { qtd: Math.max(0, Number(e.qtd) - 1) } })}
                                    style={{
                                      width: 26, height: 26, borderRadius: 8, cursor: "pointer",
                                      background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.06)",
                                      border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
                                      color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span style={{ minWidth: 26, textAlign: "center", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12 }}>
                                    {Number(e.qtd)}
                                  </span>
                                  <button
                                    onClick={() => mudarEquipamento.mutate({ id: e.id, patch: { qtd: Number(e.qtd) + 1 } })}
                                    style={{
                                      width: 26, height: 26, borderRadius: 8, cursor: "pointer",
                                      background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.06)",
                                      border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
                                      color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                  {Number(e.qtd)}
                                </span>
                              )}
                              <button
                                onClick={() =>
                                  podeEditar &&
                                  mudarEquipamento.mutate({
                                    id: e.id,
                                    patch: { estado: e.estado === "ativo" ? "removido" : "ativo" },
                                  })
                                }
                                title={podeEditar ? "Alternar entre ativo e removido" : undefined}
                                style={{
                                  padding: "3px 8px", borderRadius: 12, flexShrink: 0,
                                  background: cor.bg, border: `1px solid ${cor.border}`,
                                  color: isLight ? cor.light : cor.dark,
                                  fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9,
                                  letterSpacing: "0.06em", textTransform: "uppercase",
                                  cursor: podeEditar ? "pointer" : "default",
                                }}
                              >
                                {ESTADO_LABEL[e.estado] ?? e.estado}
                              </button>
                              {podeEditar && (
                                <button
                                  onClick={() => removerEquipamento.mutate(e.id)}
                                  style={{
                                    width: 26, height: 26, borderRadius: 8, cursor: "pointer", flexShrink: 0,
                                    background: "transparent", border: "none",
                                    color: isLight ? "#B1242E" : "#F17881",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {podeEditar && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <button style={btnSec} onClick={() => setModal({ tipo: "equipamento", sistema: s })}>
                          <Plus size={14} color={gold} />
                          Equipamento
                        </button>
                        <button
                          style={{ ...btnSec, color: isLight ? "#B1242E" : "#F17881" }}
                          onClick={() => removerSistema.mutate(s.id)}
                        >
                          <Trash2 size={14} />
                          Excluir sistema
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal?.tipo === "importar" && (
        <ModalImportar
          visitas={visitasEscopo}
          importando={importar.isPending}
          onImportar={(visitaId) => importar.mutate(visitaId)}
          onFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "sistema" && (
        <ModalSistema
          clienteId={clienteId}
          onFechar={() => setModal(null)}
          onCriado={() => { invalidar(); setModal(null); }}
        />
      )}
      {modal?.tipo === "equipamento" && (
        <ModalEquipamento
          sistema={modal.sistema}
          onFechar={() => setModal(null)}
          onCriado={() => { invalidar(); setModal(null); }}
        />
      )}
    </div>
  );
}

// ── Modais ──────────────────────────────────────────────────────────────────

function useModalEstilos() {
  const { isLight } = useTheme();
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  return {
    isLight,
    textPrimary,
    textSecondary: isLight ? "#4a5060" : "rgba(255,255,255,0.55)",
    gold: isLight ? "#A06108" : "#F8C811",
    backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", zIndex: 90 } as CSSProperties,
    painel: {
      position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
      width: "min(440px, 92vw)", maxHeight: "86vh", overflowY: "auto", zIndex: 100,
      borderRadius: 18, padding: "20px 18px",
      background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
      border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(252,222,72,0.16)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      color: textPrimary,
    } as CSSProperties,
    titulo: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 16 } as CSSProperties,
    label: {
      fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10,
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)", marginBottom: 6, display: "block",
    } as CSSProperties,
    input: {
      width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
      background: isLight ? "#ffffff" : "#16161d",
      border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
      color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
      outline: "none", colorScheme: isLight ? "light" : "dark",
    } as CSSProperties,
    cta: {
      width: "100%", height: 50, borderRadius: 25, border: "none",
      background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)", color: "#08090E",
      fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
      letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
    } as CSSProperties,
  };
}

function BotaoFechar({ onClick }: { onClick: () => void }) {
  const { isLight } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
        background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
        color: isLight ? "#0a0b0e" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <X size={16} />
    </button>
  );
}

function ModalImportar({
  visitas, importando, onImportar, onFechar,
}: {
  visitas: { id: string; nome: string; data: string | null; qtdBlocos: number; qtdBlocosNovos: number }[];
  importando: boolean;
  onImportar: (visitaId: string) => void;
  onFechar: () => void;
}) {
  const s = useModalEstilos();
  return (
    <>
      <div style={s.backdrop} onClick={() => !importando && onFechar()} />
      <div style={s.painel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={s.titulo}>Importar do escopo aprovado</span>
          <BotaoFechar onClick={onFechar} />
        </div>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: s.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
          Cada bloco do orçamento aprovado vira um sistema instalado, com os equipamentos dimensionados.
          Blocos já importados são ignorados.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visitas.map((v) => (
            <button
              key={v.id}
              disabled={importando || v.qtdBlocosNovos === 0}
              onClick={() => onImportar(v.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                padding: "12px 14px", borderRadius: 12, textAlign: "left",
                background: s.isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                border: s.isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                color: s.textPrimary,
                cursor: importando ? "wait" : v.qtdBlocosNovos === 0 ? "default" : "pointer",
                opacity: v.qtdBlocosNovos === 0 ? 0.55 : 1,
              }}
            >
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>
                {v.data ? new Date(v.data).toLocaleDateString("pt-BR") : "sem data"} · {v.nome}
              </span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: s.textSecondary }}>
                {v.qtdBlocosNovos === 0
                  ? `${v.qtdBlocos} bloco(s) — já importados`
                  : `${v.qtdBlocosNovos} de ${v.qtdBlocos} bloco(s) a importar`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ModalSistema({
  clienteId, onFechar, onCriado,
}: {
  clienteId: string;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const s = useModalEstilos();
  const [tipo, setTipo] = useState<TipoSistema>("PED");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const criar = useMutation({
    mutationFn: () =>
      criarSistema({
        cliente_id: clienteId,
        tipo,
        nome: nome.trim() || TIPO_SISTEMA_LABEL[tipo],
        descricao: descricao.trim() || null,
      }),
    onSuccess: () => { toast.success("Sistema adicionado."); onCriado(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div style={s.backdrop} onClick={() => !criar.isPending && onFechar()} />
      <div style={s.painel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={s.titulo}>Novo sistema instalado</span>
          <BotaoFechar onClick={onFechar} />
        </div>

        <label style={s.label}>Tipo</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TIPOS_SISTEMA.map((t) => {
            const ativo = tipo === t;
            return (
              <button
                key={t}
                onClick={() => setTipo(t)}
                style={{
                  padding: "8px 12px", borderRadius: 10,
                  border: ativo ? "none" : s.isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
                  background: ativo
                    ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
                    : s.isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
                  color: ativo ? "#08090E" : s.textPrimary,
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, cursor: "pointer",
                }}
              >
                {TIPO_SISTEMA_LABEL[t]}
              </button>
            );
          })}
        </div>

        <label style={s.label}>Nome</label>
        <input
          style={{ ...s.input, marginBottom: 14 }}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={TIPO_SISTEMA_LABEL[tipo]}
        />

        <label style={s.label}>Descrição (opcional)</label>
        <input
          style={{ ...s.input, marginBottom: 18 }}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: entrada social, garagem do subsolo"
        />

        <button style={{ ...s.cta, opacity: criar.isPending ? 0.7 : 1 }} disabled={criar.isPending} onClick={() => criar.mutate()}>
          {criar.isPending ? "Adicionando…" : "Adicionar sistema"}
        </button>
      </div>
    </>
  );
}

function ModalEquipamento({
  sistema, onFechar, onCriado,
}: {
  sistema: SistemaInstalado;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const s = useModalEstilos();
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<ItemCatalogo | null>(null);
  const [nomeLivre, setNomeLivre] = useState("");
  const [qtd, setQtd] = useState("1");
  const { data: resultados = [], isFetching } = useCatalogoEquipamentos(busca);

  const criar = useMutation({
    mutationFn: () => {
      const n = Number(qtd);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Quantidade inválida.");
      if (!escolhido && !nomeLivre.trim()) throw new Error("Escolha um equipamento do catálogo ou informe o nome.");
      return criarEquipamentoInstalado({
        cliente_sistema_id: sistema.id,
        equipamento_id: escolhido?.id ?? null,
        cod_eq: escolhido?.code ?? null,
        nome_snapshot: escolhido?.nome ?? nomeLivre.trim(),
        qtd: n,
        estado: "ativo",
        origem: "campo",
      });
    },
    onSuccess: () => { toast.success("Equipamento registrado."); onCriado(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div style={s.backdrop} onClick={() => !criar.isPending && onFechar()} />
      <div style={s.painel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={s.titulo}>Equipamento</span>
          <BotaoFechar onClick={onFechar} />
        </div>
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: s.textSecondary, marginBottom: 14 }}>
          em {sistema.nome}
        </p>

        {escolhido ? (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, marginBottom: 14,
              background: s.isLight ? "#f5f6f8" : "rgba(255,255,255,0.04)",
              border: s.isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>{escolhido.nome}</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: s.textSecondary }}>
                {[escolhido.code, escolhido.marca, escolhido.modelo].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button
              onClick={() => setEscolhido(null)}
              style={{
                height: 32, padding: "0 12px", borderRadius: 10, flexShrink: 0,
                background: s.isLight ? "#ffffff" : "#191921",
                border: s.isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: s.textPrimary, cursor: "pointer",
                fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600,
              }}
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <label style={s.label}>Buscar no catálogo</label>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={15} color={s.textSecondary} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ ...s.input, paddingLeft: 36 }}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, código ou modelo"
              />
            </div>
            {busca.trim().length >= 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 220, overflowY: "auto" }}>
                {isFetching ? (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: s.textSecondary }}>Buscando…</span>
                ) : resultados.length === 0 ? (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: s.textSecondary }}>
                    Nada no catálogo — informe o nome abaixo para registrar como equipamento avulso.
                  </span>
                ) : (
                  resultados.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setEscolhido(r)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                        background: s.isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                        border: s.isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                        color: s.textPrimary,
                      }}
                    >
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12 }}>{r.nome}</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: s.textSecondary }}>
                        {[r.code, r.marca, r.modelo].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <label style={s.label}>Ou nome do equipamento (fora do catálogo)</label>
            <input
              style={{ ...s.input, marginBottom: 14 }}
              value={nomeLivre}
              onChange={(e) => setNomeLivre(e.target.value)}
              placeholder="Ex.: interfonia antiga do prédio"
            />
          </>
        )}

        <label style={s.label}>Quantidade</label>
        <input
          style={{ ...s.input, marginBottom: 18 }}
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          inputMode="numeric"
        />

        <button style={{ ...s.cta, opacity: criar.isPending ? 0.7 : 1 }} disabled={criar.isPending} onClick={() => criar.mutate()}>
          {criar.isPending ? "Registrando…" : "Registrar equipamento"}
        </button>
      </div>
    </>
  );
}
