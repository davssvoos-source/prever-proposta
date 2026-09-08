// EQUIPAMENTOS DA ATIVIDADE — Blocos | Sem bloco, arrastar para o bloco,
// remover do cliente (R226, U119; R236, U120; R237, U121; R239, U122).
// Só cliente ÚNICO.
//
// Davi, 08/09/2026 (R237): "Em uma atividade, o usuário só pode movimentar um
// equipamento para dentro de um bloco ou então clicar em remover um equipamento
// do cliente. Os equipamentos que vão para o cliente vão sempre
// OBRIGATORIAMENTE pelo QAP, e o sistema lê isso a partir do sincronismo. […]
// Sempre que um usuário remove um equipamento do cliente, no painel
// administrativo no catálogo de equipamentos fica uma lista de equipamentos
// removidos e um checklist."
//
// ── O MODELO ───────────────────────────────────────────────────────────────
// O que está no cliente chegou pelo QAP, e chega "sem bloco". Aqui existem
// exatamente dois gestos, os mesmos da ficha do cliente (R206):
//
//   · ARRASTAR um equipamento para um BLOCO — dizer onde ele foi instalado.
//     De "Sem bloco" para um bloco, ou de um bloco para outro. Fica registrado
//     na atividade como "instalado em <bloco>".
//   · REMOVER do cliente — um clique no item. Ele sai do cliente ("retirado")
//     e vai para a lista de removidos do Administrativo › Catálogo.
//
// Nada ENTRA no cliente por esta tela. A v0.0.3 tinha um painel "Fora do
// cliente" de onde se instalava — isso era um equipamento entrando por aqui, e
// saiu (P65). O banco recusa também (U121): a RPC exige que o item já seja do
// cliente.
//
// ── RECOLHIDO POR PADRÃO (R239, U122) ──────────────────────────────────────
// Davi, 08/09/2026: "o campo de EQUIPAMENTOS na tela de configuração da
// atividade, por padrão deve vir recolhido, com um botão na extremidade
// direita que expande o campo." Faz sentido no dia a dia: a maioria das
// atividades não mexe em equipamento, e um cliente do QAP traz 134 itens —
// eles empurravam a conversa para 2000px abaixo. Recolhido, o resumo diz o que
// tem lá dentro (e quantos movimentos esta atividade já fez).
//
// E UM SCROLL SÓ (R239): os painéis não rolam por dentro (era a terceira barra
// de rolagem da tela). Quem rola é a página — ou o diálogo. A lista "Sem
// bloco" mostra os primeiros 24 e tem "mostrar todos" e filtro, porque 134
// itens abertos de uma vez são uma página inteira de nada.
//
// A ESCRITA continua sendo uma RPC só (`mover_equipamento`), com o estado
// ANTERIOR guardado em `equipamento_movimentos` — que é o que faz o desfazer
// existir. A tela não dá UPDATE em patrimônio. O visual é o dos painéis da
// ficha (estiloDoPainel, CabecalhoDoPainel, .painel-vinculo): mesma casca,
// mesmo gesto — quem aprendeu na ficha já sabe usar aqui.

import { useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, GripVertical, Inbox, Layers, PackageMinus, PackagePlus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { useInventario } from "@/features/clientes/inventario";
import { CabecalhoDoPainel, estiloDoPainel } from "@/features/clientes/EquipamentosDoCliente";
import { TIPO_ARRASTO, arrastoEhNosso, lerArrasto, serializarArrasto } from "@/features/clientes/vinculo";
import {
  desfazerMovimento, moverEquipamento, repartirEquipamentos, rotuloDoEquipamento,
  useEquipamentosDaAtividade, useEquipamentosDoClienteDaAtividade,
  type EquipamentoDoCliente, type MovimentoDeEquipamento,
} from "./equipamentos-atividade";

interface Props {
  chamadoId: string;
  clienteId: string;
  podeEditar: boolean;
  /** o card e o micro-rótulo da página — a MESMA casca dos outros blocos */
  estiloCard: CSSProperties;
  estiloSecao: CSSProperties;
}

/** o que está na mão: o item e de qual bloco saiu (null = "Sem bloco") */
interface Arrasto { id: string; deSistema: string | null }

/** quantos itens de "Sem bloco" aparecem antes do "mostrar todos" */
const PRIMEIROS = 24;

export function EquipamentosDaAtividade({ chamadoId, clienteId, podeEditar, estiloCard, estiloSecao }: Props) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const qc = useQueryClient();
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const [aberto, setAberto] = useState(false);   // R239: recolhido por padrão
  const [todos, setTodos] = useState(false);
  const [busca, setBusca] = useState("");
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);

  const mov = useEquipamentosDaAtividade(chamadoId);
  const doCliente = useEquipamentosDoClienteDaAtividade(chamadoId, true);
  const { data: sistemas = [] } = useInventario(clienteId);

  const movimentos = mov.data?.itens ?? [];
  const faltaMigration = !!(mov.data?.faltaMigration || doCliente.data?.faltaMigration);
  const { blocos, semBloco } = useMemo(
    () => repartirEquipamentos(sistemas.filter((s) => s.ativo !== false), doCliente.data?.itens ?? []),
    [sistemas, doCliente.data],
  );
  const semBlocoFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? semBloco.filter((i) => rotuloDoEquipamento(i).toLowerCase().includes(q)) : semBloco;
  }, [semBloco, busca]);
  const emBlocos = (doCliente.data?.itens.length ?? 0) - semBloco.length;
  const aMostrar = todos || busca.trim() ? semBlocoFiltrado : semBlocoFiltrado.slice(0, PRIMEIROS);

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["equipamentos-atividade", chamadoId] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente-atividade", chamadoId] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
  }

  const instalar = useMutation({
    mutationFn: async (a: { id: string; sistemaId: string }) =>
      moverEquipamento({ patrimonioId: a.id, chamadoId, tipo: "instalacao", sistemaId: a.sistemaId }),
    onSuccess: (_r, a) => {
      recarregar();
      const bloco = blocos.find((b) => b.sistemaId === a.sistemaId)?.nome ?? "bloco";
      toast.success(`Instalado em ${bloco}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => moverEquipamento({ patrimonioId: id, chamadoId, tipo: "retirada" }),
    onSuccess: () => { recarregar(); toast.success("Retirado do cliente — está na lista de removidos do Administrativo. Dá para desfazer em “Nesta atividade”."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const desfazer = useMutation({
    mutationFn: (m: MovimentoDeEquipamento) => desfazerMovimento(m.movimento_id),
    onSuccess: () => { recarregar(); toast.success("Movimento desfeito."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ocupado = instalar.isPending || remover.isPending || desfazer.isPending;
  const podeMexer = podeEditar && !faltaMigration && !ocupado;

  // ── o gesto ───────────────────────────────────────────────────────────────
  function iniciar(e: DragEvent<HTMLDivElement>, item: EquipamentoDoCliente) {
    e.dataTransfer.setData(TIPO_ARRASTO, serializarArrasto([item.patrimonio_id]));
    e.dataTransfer.setData("text/plain", serializarArrasto([item.patrimonio_id]));
    e.dataTransfer.effectAllowed = "move";
    setArrasto({ id: item.patrimonio_id, deSistema: item.sistema_id ?? null });
  }
  function terminar() { setArrasto(null); }
  function idsSoltos(e: DragEvent<HTMLElement>): string[] {
    const ids = lerArrasto(e.dataTransfer.getData(TIPO_ARRASTO) || e.dataTransfer.getData("text/plain"));
    return ids.length > 0 ? ids : (arrasto ? [arrasto.id] : []);
  }

  const nota: CSSProperties = { fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario, lineHeight: 1.45 };
  const estiloItem: CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 9px", borderRadius: 10,
    background: c.campo, border: `1px solid ${c.divisoria}`, minWidth: 0,
  };
  /** o painel da ficha, SEM o teto de altura: aqui quem rola é a página (R239) */
  const painel: CSSProperties = { ...estiloDoPainel(isLight, "nenhum"), maxHeight: "none", gap: 12 };
  const botaoFino: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px",
    borderRadius: 999, cursor: "pointer", flexShrink: 0,
    background: "transparent", border: `1px solid ${c.divisoria}`, color: c.texto,
    fontFamily: FONT, fontWeight: 600, fontSize: 11,
  };

  /** Um equipamento: arrastável, com o "remover" no fim da linha (R237: um clique). */
  const Item = (i: EquipamentoDoCliente) => (
    <div
      key={i.patrimonio_id}
      draggable={podeMexer}
      onDragStart={(e) => iniciar(e, i)}
      onDragEnd={terminar}
      title={podeMexer ? "Arraste para o bloco onde foi instalado" : undefined}
      style={{ ...estiloItem, cursor: podeMexer ? "grab" : "default", opacity: arrasto?.id === i.patrimonio_id ? 0.45 : 1 }}
    >
      {podeMexer && <GripVertical size={13} color={c.textoSecundario} style={{ flexShrink: 0 }} aria-hidden />}
      <span style={{
        fontFamily: FONT, fontSize: 12, color: c.texto, flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {rotuloDoEquipamento(i)}
      </span>
      {podeMexer && (
        <button
          type="button"
          onClick={() => remover.mutate(i.patrimonio_id)}
          title="Remover do cliente — vai para a lista de removidos do Administrativo"
          aria-label={`Remover ${rotuloDoEquipamento(i)} do cliente`}
          style={{
            height: 24, padding: "0 8px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
            background: "transparent", border: `1px solid ${c.divisoria}`, color: c.textoSecundario,
            fontFamily: FONT, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
          }}
        >
          remover
        </button>
      )}
    </div>
  );

  // ── o resumo do recolhido: o que tem lá dentro, em uma linha ──────────────
  const resumo = faltaMigration
    ? "precisa da migration U119"
    : doCliente.isLoading
      ? "carregando…"
      : [
          `${semBloco.length} sem bloco`,
          `${emBlocos} em ${blocos.length} ${blocos.length === 1 ? "bloco" : "blocos"}`,
          movimentos.length > 0 ? `${movimentos.length} ${movimentos.length === 1 ? "movimento" : "movimentos"} nesta atividade` : null,
        ].filter(Boolean).join(" · ");

  return (
    <div style={estiloCard}>
      {/* ══ O CABEÇALHO — e o botão da extremidade direita que abre (R239) ══ */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={estiloSecao}>Equipamentos</span>
        <span style={{ ...nota, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {resumo}
        </span>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="equipamentos-da-atividade"
          title={aberto ? "Recolher os equipamentos" : "Abrir os equipamentos"}
          style={botaoFino}
        >
          {aberto ? "Recolher" : "Abrir"}
          <ChevronDown size={13} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform .15s ease" }} />
        </button>
      </div>

      {aberto && (
        <div id="equipamentos-da-atividade" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={nota}>
            Arraste o que chegou <strong style={{ fontWeight: 600 }}>sem bloco</strong> para o bloco onde foi
            instalado. <strong style={{ fontWeight: 600 }}>Remover</strong> tira do cliente. Equipamento novo entra
            só pelo QAP.
          </span>

          {faltaMigration ? (
            <span style={nota}>
              Os equipamentos da atividade precisam da migration <strong>U119</strong>. Até ela rodar, nada aparece aqui.
            </span>
          ) : (
            <div className="painel-vinculo">
              {/* ══ BLOCOS DO CLIENTE — cada bloco é uma zona de soltar ═════ */}
              <section aria-label="Blocos do cliente" style={painel}>
                <CabecalhoDoPainel
                  icone={<Layers size={15} />}
                  titulo="Blocos do cliente"
                  contagem={`${emBlocos} em ${blocos.length} ${blocos.length === 1 ? "bloco" : "blocos"}`}
                />
                {doCliente.isLoading ? (
                  <span style={nota}>Carregando os blocos…</span>
                ) : blocos.length === 0 ? (
                  <span style={nota}>Este cliente não tem bloco cadastrado — crie na ficha do cliente.</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {blocos.map((b) => (
                      <ZonaDoBloco
                        key={b.sistemaId}
                        nome={b.nome}
                        // só aceita o que NÃO está neste bloco — de "Sem bloco" ou de outro bloco
                        aceita={podeMexer && !!arrasto && arrasto.deSistema !== b.sistemaId}
                        aoSoltar={(ids) => ids.forEach((id) => instalar.mutate({ id, sistemaId: b.sistemaId }))}
                        idsSoltos={idsSoltos}
                        aoTerminar={terminar}
                        c={c}
                        gold={gold}
                        contagem={b.itens.length}
                      >
                        {b.itens.length === 0 && <span style={{ ...nota, fontSize: 11 }}>vazio</span>}
                        {b.itens.map(Item)}
                      </ZonaDoBloco>
                    ))}
                  </div>
                )}
              </section>

              {/* ══ SEM BLOCO — o que o QAP trouxe e ainda não foi posto ══ */}
              <section aria-label="Equipamentos sem bloco" style={painel}>
                <CabecalhoDoPainel
                  icone={<Inbox size={15} />}
                  titulo="Sem bloco"
                  contagem={semBloco.length > 0 ? `${semBloco.length} · chegaram pelo QAP` : undefined}
                  direita={semBloco.length > 8 ? (
                    <div style={{ position: "relative", minWidth: 170 }}>
                      <Search size={13} color={c.textoSecundario} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                      <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Filtrar…"
                        aria-label="Filtrar equipamentos sem bloco"
                        style={{
                          width: "100%", boxSizing: "border-box", minHeight: 28,
                          padding: "0 12px 0 28px", borderRadius: 999,
                          background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
                          fontFamily: FONT, fontSize: 12, outline: "none",
                        }}
                      />
                    </div>
                  ) : undefined}
                />
                {doCliente.isLoading ? (
                  <span style={nota}>Carregando…</span>
                ) : semBloco.length === 0 ? (
                  <span style={nota}>Tudo o que o QAP trouxe já está num bloco.</span>
                ) : (
                  <>
                    <span style={{ ...nota, fontSize: 11 }}>Arraste para um bloco à esquerda para dizer onde foi instalado.</span>
                    {aMostrar.length === 0 ? (
                      <span style={nota}>Nenhum equipamento com “{busca.trim()}”.</span>
                    ) : (
                      <div className="atividade-equip-grade">{aMostrar.map(Item)}</div>
                    )}
                    {!todos && !busca.trim() && semBloco.length > PRIMEIROS && (
                      <button type="button" onClick={() => setTodos(true)} style={{ ...botaoFino, alignSelf: "flex-start" }}>
                        Mostrar todos ({semBloco.length})
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          {/* ══ O QUE ESTA ATIVIDADE FEZ — com desfazer para o clique errado ══ */}
          {movimentos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ ...estiloSecao, fontSize: 9.5 }}>Nesta atividade</span>
              <div className="atividade-equip-lista">
                {movimentos.map((m) => {
                  const cor = m.tipo === "retirada"
                    ? (isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark)
                    : (isLight ? PRISMA.verde.light : PRISMA.verde.dark);
                  return (
                    <div key={m.movimento_id} style={{ ...estiloItem, padding: "8px 8px 8px 10px" }}>
                      {m.tipo === "retirada"
                        ? <PackageMinus size={14} color={cor} style={{ flexShrink: 0 }} />
                        : <PackagePlus size={14} color={cor} style={{ flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: FONT, fontSize: 12.5, color: c.texto,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {rotuloDoEquipamento(m)}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>
                          {m.tipo === "retirada"
                            ? "Removido do cliente → lista de removidos (Administrativo)"
                            : `Instalado em ${m.sistema_nome ?? "bloco"}`}
                        </div>
                      </div>
                      {podeEditar && (
                        <button
                          type="button"
                          onClick={() => desfazer.mutate(m)}
                          disabled={ocupado}
                          title="Desfazer este movimento"
                          aria-label={`Desfazer: ${rotuloDoEquipamento(m)}`}
                          style={{
                            width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: ocupado ? "wait" : "pointer",
                            border: `1px solid ${c.divisoria}`, background: c.superficie, color: c.textoSecundario,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── um bloco do cliente: zona de soltar + os itens dele ──────────────────────

function ZonaDoBloco({ nome, contagem, aceita, aoSoltar, idsSoltos, aoTerminar, c, gold, children }: {
  nome: string;
  contagem: number;
  aceita: boolean;
  aoSoltar: (ids: string[]) => void;
  idsSoltos: (e: DragEvent<HTMLElement>) => string[];
  aoTerminar: () => void;
  c: ReturnType<typeof cinzas>;
  gold: string;
  children: ReactNode;
}) {
  const [sobre, setSobre] = useState(false);
  return (
    <div
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        if (!aceita || !arrastoEhNosso(e.dataTransfer.types)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!sobre) setSobre(true);
      }}
      onDragLeave={(e: DragEvent<HTMLDivElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setSobre(false);
      }}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        if (!aceita) return;
        e.preventDefault();
        setSobre(false);
        const ids = idsSoltos(e);
        if (ids.length > 0) aoSoltar(ids);
        aoTerminar();
      }}
      style={{
        display: "flex", flexDirection: "column", gap: 8,
        padding: 8, borderRadius: 12,
        border: sobre ? `1.5px solid ${gold}` : aceita ? `1.5px dashed ${gold}` : `1px solid ${c.divisoria}`,
        background: sobre ? PRISMA.amarelo.bg : "transparent",
        transition: "border-color .15s ease, background-color .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: c.texto,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {nome}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: c.textoSecundario, flexShrink: 0 }}>
          {contagem}
        </span>
      </div>
      {children}
    </div>
  );
}
