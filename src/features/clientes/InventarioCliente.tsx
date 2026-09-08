// SISTEMAS INSTALADOS na ficha do cliente — os blocos e o vínculo por arrasto
// (R200, R202, R206; U111/U112/U114).
//
// Davi, 2026-09-07: "Cada página de cliente deverá ter um campo para os
// sistemas instalados. Os sistemas instalados consistem em blocos com
// equipamentos vinculados a estes blocos. […] o usuário vincula o equipamento
// ao sistema instalado (ambos no mesmo cliente)."
//
// E, sobre o gesto (R206): "a minha ideia são dois campos um ao lado do outro,
// um com bloco e sub-itens sendo os equipamentos já vinculados a aquele bloco,
// e o outro campo são os equipamentos sem bloco vinculado, e aí só de arrastar
// o equipamento ao bloco, o sistema já vincula. Eu quero que fique muito claro
// e intuitivo os campos."
//
// O MODELO, em uma linha: um SISTEMA INSTALADO é um BLOCO do cliente
// (`cliente_sistemas` — tipo e NOME, R202), criado aqui; o EQUIPAMENTO é o
// item do QAP (`equipamentos_patrimonio`, importado na U110) e o vínculo é a
// coluna `cliente_sistema_id` dele.
//
// A TELA são dois painéis lado a lado (`.painel-vinculo`; no celular empilham):
//   · BLOCOS (esquerda, este arquivo) — cada bloco é uma ZONA DE SOLTAR, com os
//     equipamentos vinculados como sub-itens (que também se arrastam, para
//     outro bloco ou de volta para "Sem bloco").
//   · SEM BLOCO (direita, EquipamentosDoCliente) — o que ainda não está em
//     bloco nenhum; arrasta-se de lá para o bloco. Também é zona de soltar
//     (soltar ali desvincula).
// O estado do arrasto (`arrastando`) e a MUTAÇÃO vivem aqui, uma vez, porque as
// duas zonas precisam concordar sobre o que está no ar e o que muda ao cair.
//
// O QUE NÃO EXISTE AQUI: a estrutura por perguntas (R202 — é do orçamento), o
// "+ Equipamento" manual (U111 — equipamento é o do QAP). O que veio
// dimensionado da proposta (`cliente_equipamentos`) fica visível dentro do
// bloco como "Previsto no orçamento", recolhido.
//
// OS SUBCOMPONENTES SÃO DE MÓDULO (o mesmo motivo do PainelChamado): declarados
// dentro do pai ganhariam identidade nova a cada render e o modal remontaria.

import { useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, ChevronDown, ChevronRight, Download, GripVertical, Plus, Trash2, Unlink, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, etiqueta, botaoSelecao, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { useEquipamentosDoCliente, vincularAoSistema, type ItemDePatrimonio } from "@/features/equipamentos/data";
import {
  useInventario,
  useVisitasComEscopo,
  derivarInventarioDaVisita,
  criarSistema,
  excluirSistema,
  atualizarEquipamentoInstalado,
  excluirEquipamentoInstalado,
  nomeEquipamento,
  TIPO_SISTEMA_LABEL,
  TIPOS_SISTEMA_OFERECIDOS,
  NOMES_SUGERIDOS,
  ESTADO_LABEL,
  ESTADO_CORES,
  ORIGEM_LABEL,
  type EstadoEquipamento,
  type TipoSistema,
} from "./inventario";
import {
  CabecalhoDoPainel, EquipamentosDoCliente, LinhaDoPatrimonio, estiloDoPainel, useInvalidarPatrimonioDoCliente,
} from "./EquipamentosDoCliente";
import {
  TIPO_ARRASTO, agruparPorSistema, arrastoEhNosso, fraseDoVinculo, idsQueMudam, lerArrasto, serializarArrasto,
} from "./vinculo";

const VAZIO: ItemDePatrimonio[] = [];

export function InventarioCliente({ clienteId, podeEditar }: { clienteId: string; podeEditar: boolean }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  const qc = useQueryClient();
  const invalidarPatrimonio = useInvalidarPatrimonioDoCliente(clienteId);

  const { data: sistemas = [], isLoading } = useInventario(clienteId);
  const { data: visitasEscopo = [] } = useVisitasComEscopo(clienteId);
  const { data: patrimonio, isLoading: carregandoPatrimonio } = useEquipamentosDoCliente(clienteId);

  const todos = patrimonio?.itens ?? VAZIO;
  // R200/R206: os equipamentos do QAP, separados em "dentro de qual bloco" e "sem bloco"
  const { porSistema, semSistema } = useMemo(() => agruparPorSistema(todos), [todos]);
  const vinculados = todos.length - semSistema.length;

  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [arrastando, setArrastando] = useState<string[] | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { tipo: "importar" } | { tipo: "sistema" }>(null);

  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em",
    textTransform: "uppercase", color: gold,
  };
  const btnSec: CSSProperties = {
    height: 32, padding: "0 12px", borderRadius: 10,
    background: c.campo, border: `1px solid ${c.divisoria}`,
    color: c.texto, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
  };
  const btnIcone: CSSProperties = {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0, cursor: "pointer",
    background: "transparent", border: `1px solid ${c.divisoria}`, color: c.textoSecundario,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-visitas-escopo", clienteId] });
    invalidarPatrimonio();
  };

  // ── o VÍNCULO — uma mutação para as duas zonas de soltar ──────────────────
  const vincular = useMutation({
    mutationFn: ({ ids, sistemaId }: { ids: string[]; sistemaId: string | null }) => vincularAoSistema(ids, sistemaId),
    onSuccess: (_d, { ids, sistemaId }) => {
      invalidar();
      toast.success(fraseDoVinculo(ids.length, sistemas.find((s) => s.id === sistemaId)?.nome ?? null));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  /** vincula (sistemaId) ou desvincula (null) — só o que de fato muda de lugar */
  const aoVincular = (ids: string[], sistemaId: string | null) => {
    const mudam = idsQueMudam(todos, ids, sistemaId);
    if (mudam.length === 0) return;
    vincular.mutate({ ids: mudam, sistemaId });
  };
  const terminarArrasto = () => { setArrastando(null); setAlvo(null); };

  const importar = useMutation({
    mutationFn: (visitaId: string) => derivarInventarioDaVisita(clienteId, visitaId),
    onSuccess: (r) => {
      invalidar();
      setModal(null);
      toast.success(
        r.sistemas === 0
          ? "Nada novo para importar — os blocos desta visita já estão na ficha."
          : `${r.sistemas} bloco(s) criado(s) a partir da proposta, com ${r.equipamentos} item(ns) previsto(s).`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerSistema = useMutation({
    mutationFn: (id: string) => excluirSistema(id),
    onSuccess: () => { invalidar(); toast.success("Bloco removido. Os equipamentos dele voltaram para “Sem bloco”."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarPrevisto = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { estado?: EstadoEquipamento } }) =>
      atualizarEquipamentoInstalado(id, patch),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });
  const removerPrevisto = useMutation({
    mutationFn: (id: string) => excluirEquipamentoInstalado(id),
    onSuccess: () => { invalidar(); toast.success("Item previsto removido."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeImportar = visitasEscopo.some((v) => v.qtdBlocosNovos > 0);
  const haArrasto = !!arrastando;

  return (
    <div style={{ ...card(isLight), borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── cabeçalho do card ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Boxes size={16} color={gold} />
        <span style={MICRO}>Sistemas instalados</span>
        {(sistemas.length > 0 || todos.length > 0) && (
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario }}>
            {sistemas.length} bloco{sistemas.length === 1 ? "" : "s"}
            {todos.length > 0 && ` · ${vinculados} de ${todos.length} equipamentos do QAP vinculados`}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {podeEditar && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {podeImportar && (
              <button style={btnSec} onClick={() => setModal({ tipo: "importar" })}>
                <Download size={14} color={gold} />
                Importar do escopo
              </button>
            )}
            <button
              style={{ ...goldButton(), boxShadow: "none", height: 32, padding: "0 12px", borderRadius: 10, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              onClick={() => setModal({ tipo: "sistema" })}
            >
              <Plus size={14} />
              Bloco
            </button>
          </div>
        )}
      </div>
      {podeEditar && sistemas.length > 0 && semSistema.length > 0 && (
        <p style={{ margin: 0, fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5 }}>
          Arraste um equipamento de <strong style={{ color: c.texto }}>Sem bloco</strong> para o bloco certo — o vínculo
          grava na hora. Para tirar, arraste-o de volta.
        </p>
      )}

      {/* ── os dois painéis ───────────────────────────────────────────────── */}
      <div className="painel-vinculo">
        {/* BLOCOS — cada um é uma zona de soltar */}
        <section aria-label="Blocos do local" style={estiloDoPainel(isLight, "nenhum")}>
          <CabecalhoDoPainel
            icone={<Boxes size={15} />}
            titulo="Blocos"
            contagem={sistemas.length > 0 ? `${sistemas.length}` : undefined}
          />
          {isLoading ? (
            <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario }}>Carregando os sistemas…</span>
          ) : sistemas.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: FONT, fontSize: 13, color: c.texto }}>Nenhum sistema instalado ainda.</span>
              <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5 }}>
                Cada bloco é um sistema do local — a eclusa de pedestres, a eclusa veicular, o CFTV, a cerca elétrica, a central de portaria remota.
                {podeEditar ? <> Crie o primeiro com <strong>+ Bloco</strong>{podeImportar ? " ou importe os blocos da proposta aprovada" : ""}; depois arraste para ele os equipamentos que vieram do QAP{todos.length > 0 ? ` (${todos.length} esperando)` : ""}.</> : null}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sistemas.map((s) => {
                const recolhido = recolhidos.has(s.id);
                const doQap = porSistema.get(s.id) ?? VAZIO;
                const previstos = s.equipamentos;
                // o bloco de onde o arrasto saiu não é destino
                const podeReceber = haArrasto && podeEditar && idsQueMudam(todos, arrastando!, s.id).length > 0;
                const emCima = alvo === s.id && podeReceber;
                return (
                  <div
                    key={s.id}
                    onDragOver={(e: DragEvent<HTMLDivElement>) => {
                      if (!podeEditar || !arrastoEhNosso(e.dataTransfer.types)) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (alvo !== s.id) setAlvo(s.id);
                    }}
                    onDragLeave={(e: DragEvent<HTMLDivElement>) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                      setAlvo((a) => (a === s.id ? null : a));
                    }}
                    onDrop={(e: DragEvent<HTMLDivElement>) => {
                      if (!podeEditar) return;
                      e.preventDefault();
                      const ids = lerArrasto(e.dataTransfer.getData(TIPO_ARRASTO) || e.dataTransfer.getData("text/plain"));
                      aoVincular(ids.length > 0 ? ids : (arrastando ?? []), s.id);
                      terminarArrasto();
                    }}
                    style={{
                      borderRadius: 14, overflow: "hidden", background: emCima ? PRISMA.amarelo.bg : c.campo,
                      border: emCima ? `1.5px solid ${gold}` : podeReceber ? `1.5px dashed ${gold}` : `1px solid ${c.divisoria}`,
                      transition: "border-color .15s ease, background-color .15s ease",
                    }}
                  >
                    {/* cabeçalho do bloco: recolher · nome/tipo/código · contagem · excluir */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                      <button
                        type="button"
                        onClick={() => setRecolhidos((prev) => {
                          const n = new Set(prev);
                          if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
                          return n;
                        })}
                        aria-expanded={!recolhido}
                        aria-label={recolhido ? `Mostrar os equipamentos de ${s.nome}` : `Recolher ${s.nome}`}
                        style={{
                          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
                          background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: c.texto,
                        }}
                      >
                        {recolhido ? <ChevronRight size={16} color={c.textoSecundario} /> : <ChevronDown size={16} color={c.textoSecundario} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nome}</div>
                          <div style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario, marginTop: 1 }}>
                            {TIPO_SISTEMA_LABEL[s.tipo] ?? s.tipo}
                            {s.descricao && s.descricao !== s.codigo_bloco ? ` · ${s.descricao}` : ""}
                            {s.origem_visita_bloco_id ? " · do escopo aprovado" : ""}
                          </div>
                          {/* R202: o código só existe em bloco que veio do orçamento — é
                              informação, não se edita por aqui */}
                          {s.codigo_bloco && (
                            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, color: gold, marginTop: 2, wordBreak: "break-all" }}>
                              {s.codigo_bloco}
                            </div>
                          )}
                        </div>
                      </button>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, fontVariantNumeric: "tabular-nums", color: c.texto }}>{doQap.length}</div>
                        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: c.textoSecundario }}>
                          {doQap.length === 1 ? "equipamento" : "equipamentos"}
                        </div>
                      </div>
                      {podeEditar && (
                        <button
                          type="button"
                          title="Excluir bloco"
                          aria-label={`Excluir o bloco ${s.nome}`}
                          onClick={() => {
                            const aviso = doQap.length > 0
                              ? `Excluir o bloco "${s.nome}"? Os ${doQap.length} equipamentos dele voltam para “Sem bloco”.`
                              : `Excluir o bloco "${s.nome}"?`;
                            if (confirm(aviso)) removerSistema.mutate(s.id);
                          }}
                          style={{ ...btnIcone, color: vermelho }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {!recolhido && (
                      <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* ── os SUB-ITENS: os equipamentos do QAP vinculados (R200/R206) ── */}
                        {doQap.length === 0 ? (
                          <div style={{
                            padding: "14px 12px", borderRadius: 10, textAlign: "center",
                            border: `1.5px dashed ${emCima ? gold : c.divisoria}`,
                            fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario,
                          }}>
                            {podeEditar ? "Solte aqui os equipamentos deste bloco" : "Nenhum equipamento vinculado."}
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", borderRadius: 10, background: c.superficie, padding: "0 6px" }}>
                            {doQap.map((i, idx) => (
                              <div
                                key={i.id}
                                draggable={podeEditar}
                                onDragStart={(e: DragEvent<HTMLDivElement>) => {
                                  e.dataTransfer.setData(TIPO_ARRASTO, serializarArrasto([i.id]));
                                  e.dataTransfer.setData("text/plain", serializarArrasto([i.id]));
                                  e.dataTransfer.effectAllowed = "move";
                                  setArrastando([i.id]);
                                }}
                                onDragEnd={terminarArrasto}
                                title={podeEditar ? "Arraste para outro bloco, ou para “Sem bloco” para desvincular" : undefined}
                                style={{ cursor: podeEditar ? "grab" : "default", opacity: arrastando?.includes(i.id) ? 0.45 : 1 }}
                              >
                                <LinhaDoPatrimonio
                                  item={i}
                                  primeira={idx === 0}
                                  esquerda={podeEditar ? <GripVertical size={14} color={c.textoSecundario} style={{ flexShrink: 0 }} aria-hidden /> : undefined}
                                  direita={podeEditar ? (
                                    <button
                                      type="button"
                                      title="Desvincular — volta para “Sem bloco”"
                                      aria-label={`Desvincular ${i.catalogo?.nome ?? "equipamento"}`}
                                      disabled={vincular.isPending}
                                      onClick={() => aoVincular([i.id], null)}
                                      style={btnIcone}
                                    >
                                      <Unlink size={13} />
                                    </button>
                                  ) : undefined}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── o que foi VENDIDO: o dimensionado da proposta, recolhido ── */}
                        {previstos.length > 0 && (
                          <details style={{ borderRadius: 10, border: `1px solid ${c.divisoria}`, padding: "6px 10px" }}>
                            <summary style={{ ...MICRO, fontSize: 9.5, color: c.textoSecundario, cursor: "pointer", listStyle: "none" }}>
                              Previsto no orçamento · {previstos.length} {previstos.length === 1 ? "item" : "itens"}
                            </summary>
                            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                              {previstos.map((e, idx) => {
                                const cor = ESTADO_CORES[e.estado] ?? ESTADO_CORES.ativo;
                                return (
                                  <div
                                    key={e.id}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                                      borderTop: idx === 0 ? "none" : `1px solid ${c.divisoria}`,
                                    }}
                                  >
                                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, minWidth: 28, color: c.texto, fontVariantNumeric: "tabular-nums" }}>
                                      {Number(e.qtd)}×
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: c.texto }}>{nomeEquipamento(e)}</div>
                                      <div style={{ fontFamily: FONT, fontSize: 10.5, color: c.textoSecundario }}>
                                        {[e.cod_eq, e.equipamento?.marca, e.equipamento?.modelo].filter(Boolean).join(" · ")}
                                        {e.origem !== "implantacao" ? ` · ${ORIGEM_LABEL[e.origem]}` : ""}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        podeEditar &&
                                        mudarPrevisto.mutate({ id: e.id, patch: { estado: e.estado === "ativo" ? "removido" : "ativo" } })
                                      }
                                      title={podeEditar ? "Alternar entre ativo e removido" : undefined}
                                      style={{
                                        padding: "3px 8px", borderRadius: 12, flexShrink: 0, border: "none",
                                        ...etiqueta(cor),
                                        fontFamily: FONT, fontWeight: 700, fontSize: 9,
                                        letterSpacing: "0.06em", textTransform: "uppercase",
                                        cursor: podeEditar ? "pointer" : "default",
                                      }}
                                    >
                                      {ESTADO_LABEL[e.estado] ?? e.estado}
                                    </button>
                                    {podeEditar && (
                                      <button
                                        onClick={() => removerPrevisto.mutate(e.id)}
                                        aria-label={`Remover ${nomeEquipamento(e)} do previsto`}
                                        style={{ ...btnIcone, border: "none", color: vermelho }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SEM BLOCO — arrasta-se daqui; soltar aqui desvincula */}
        <EquipamentosDoCliente
          itens={semSistema}
          total={todos.length}
          sistemas={sistemas}
          podeEditar={podeEditar}
          faltaMigration={!!patrimonio?.faltaMigration}
          carregando={carregandoPatrimonio}
          arrastando={arrastando}
          aoIniciarArrasto={setArrastando}
          aoTerminarArrasto={terminarArrasto}
          aoVincular={aoVincular}
          vinculando={vincular.isPending}
        />
      </div>

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
    </div>
  );
}

// ── Modais ───────────────────────────────────────────────────

/** A casca de modal da ficha do cliente — a mesma nos dois modais desta seção. */
export function useModalEstilos() {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  return {
    isLight,
    textPrimary: c.texto,
    textSecondary: c.textoSecundario,
    gold: isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark,
    backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.60)", zIndex: 90 } as CSSProperties,
    painel: {
      position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
      width: "min(460px, 92vw)", maxHeight: "86vh", overflowY: "auto", zIndex: 100,
      borderRadius: 18, padding: "20px 18px",
      background: c.superficie, border: `1px solid ${c.divisoria}`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
      color: c.texto,
    } as CSSProperties,
    titulo: { fontFamily: FONT, fontWeight: 700, fontSize: 16 } as CSSProperties,
    label: {
      fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em", textTransform: "uppercase",
      color: c.textoSecundario, marginBottom: 6, display: "block",
    } as CSSProperties,
    input: {
      width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, padding: "0 13px",
      background: c.campo, border: `1px solid ${c.divisoria}`,
      color: c.texto, fontFamily: FONT, fontWeight: 400, fontSize: 14,
      outline: "none", colorScheme: isLight ? "light" : "dark",
    } as CSSProperties,
    cta: {
      ...goldButton(), boxShadow: "none", width: "100%", height: 44, borderRadius: 14,
      fontFamily: FONT, fontWeight: 700, fontSize: 13,
    } as CSSProperties,
  };
}

export function BotaoFechar({ onClick }: { onClick: () => void }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  return (
    <button
      onClick={onClick}
      aria-label="Fechar"
      style={{
        width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
        background: c.campo, color: c.texto,
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
  const c = cinzas(s.isLight);
  return (
    <>
      <div style={s.backdrop} onClick={() => !importando && onFechar()} />
      <div style={s.painel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={s.titulo}>Importar blocos da proposta aprovada</span>
          <BotaoFechar onClick={onFechar} />
        </div>
        <p style={{ fontFamily: FONT, fontSize: 12.5, color: s.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
          Cada bloco do orçamento aprovado vira um sistema instalado, com o que foi dimensionado
          como "previsto". Os equipamentos de verdade vêm do QAP e são vinculados depois. Blocos
          já importados são ignorados.
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
                background: c.campo, border: `1px solid ${c.divisoria}`, color: s.textPrimary,
                cursor: importando ? "wait" : v.qtdBlocosNovos === 0 ? "default" : "pointer",
                opacity: v.qtdBlocosNovos === 0 ? 0.55 : 1,
              }}
            >
              <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13 }}>
                {v.data ? new Date(v.data).toLocaleDateString("pt-BR") : "sem data"} · {v.nome}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 11.5, color: s.textSecondary }}>
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

/**
 * NOVO BLOCO (R202): tipo + nome, e pronto. Os nomes sugeridos são os que o
 * Davi usou para o Paineiras — um clique preenche; digitar outro também vale.
 * Nenhuma pergunta de estrutura: isso é do orçamento.
 */
function ModalSistema({
  clienteId, onFechar, onCriado,
}: {
  clienteId: string;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const s = useModalEstilos();
  const c = cinzas(s.isLight);
  const [tipo, setTipo] = useState<TipoSistema>("PED");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const sugestoes = NOMES_SUGERIDOS[tipo] ?? [];

  const criar = useMutation({
    mutationFn: () =>
      criarSistema({
        cliente_id: clienteId,
        tipo,
        nome: nome.trim() || TIPO_SISTEMA_LABEL[tipo],
        descricao: descricao.trim() || null,
      }),
    onSuccess: () => { toast.success("Bloco criado. Agora arraste para ele os equipamentos do QAP."); onCriado(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div style={s.backdrop} onClick={() => !criar.isPending && onFechar()} />
      <div style={s.painel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={s.titulo}>Novo bloco</span>
          <BotaoFechar onClick={onFechar} />
        </div>
        <p style={{ fontFamily: FONT, fontSize: 12.5, color: s.textSecondary, lineHeight: 1.5, margin: "0 0 14px" }}>
          Um bloco é um sistema instalado no local — a eclusa de pedestres, a porta de carga, o CFTV,
          a central de portaria remota. Só o nome: os equipamentos do QAP são vinculados a ele depois.
        </p>

        <label style={s.label}>Tipo</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {TIPOS_SISTEMA_OFERECIDOS.map((t) => {
            const ativo = tipo === t;
            return (
              <button
                key={t}
                onClick={() => setTipo(t)}
                aria-pressed={ativo}
                style={{
                  ...botaoSelecao(ativo, s.isLight, null), boxShadow: "none",
                  padding: "7px 12px", borderRadius: 10, fontSize: 11.5,
                }}
              >
                {TIPO_SISTEMA_LABEL[t]}
              </button>
            );
          })}
        </div>

        <label style={s.label}>Nome do bloco</label>
        <input
          style={{ ...s.input, marginBottom: sugestoes.length ? 8 : 14 }}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={TIPO_SISTEMA_LABEL[tipo]}
        />
        {sugestoes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {sugestoes.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNome(n)}
                style={{
                  padding: "4px 10px", borderRadius: 999, cursor: "pointer",
                  background: nome === n ? c.elevada : "transparent", border: `1px dashed ${c.divisoria}`,
                  color: s.textPrimary, fontFamily: FONT, fontSize: 11.5, fontWeight: 600,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        <label style={s.label}>Descrição (opcional)</label>
        <input
          style={{ ...s.input, marginBottom: 18 }}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: entrada social, garagem do subsolo"
        />

        <button style={{ ...s.cta, opacity: criar.isPending ? 0.7 : 1 }} disabled={criar.isPending} onClick={() => criar.mutate()}>
          {criar.isPending ? "Criando…" : "Criar bloco"}
        </button>
      </div>
    </>
  );
}
