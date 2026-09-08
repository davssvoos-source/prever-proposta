// EQUIPAMENTOS REMOVIDOS e INSTALADOS pela atividade — dois painéis e um
// arrasto (R226, U119; R236, U120). Só quando o cliente da atividade é UM.
//
// Davi, 08/09/2026 (U119): "O campo 'Equipamentos envolvidos' deve virar
// 'Equipamentos Removidos' — deve listar os blocos do cliente, ao expandir o
// bloco aparecem os equipamentos e o botão remover; o equipamento passa a ser
// 'Retirado do cliente' — e 'Equipamentos Instalados' […] escolher para qual
// bloco ele foi instalado."
//
// Davi, 08/09/2026 (v0.0.3): "Pense sempre em uma organização visual que torne
// o uso das ferramentas mais intuitivo. Por isso o esquema de arrastar
// equipamentos nos campos de equipamentos instalados/removidos, enfim a gente
// deve otimizar o sistema para o usuário conseguir usar com praticidade no dia
// a dia."
//
// ── O QUE MUDOU NA v0.0.3 ──────────────────────────────────────────────────
// Era um par de botões ("Remover equipamento…", "Instalar equipamento…") que
// abriam painéis embaixo, um de cada vez: para trocar uma câmera a pessoa
// abria um, procurava, clicava, fechava, abria o outro, buscava, escolhia o
// bloco. Agora são DOIS PAINÉIS lado a lado — o patrimônio do cliente à
// esquerda (por bloco) e o que está fora dele à direita — e o gesto é o mesmo
// da ficha do cliente (R206): **arrastar**.
//
//   · do cliente  →  para "Fora do cliente"  = RETIRADA ("retirado do cliente")
//   · de fora     →  para um BLOCO           = INSTALAÇÃO naquele bloco
//
// Arrastar DENTRO do painel do cliente (de um bloco para outro) NÃO é aceito de
// propósito: mudar de bloco não é trabalho de campo desta atividade, é
// cadastro — e o lugar dele é a ficha do cliente. Aceitar aqui gravaria uma
// "instalação" que nunca aconteceu.
//
// A ESCRITA continua sendo uma RPC só (`mover_equipamento`, U119), validada no
// banco, com o estado ANTERIOR guardado em `equipamento_movimentos` — que é o
// que faz o desfazer existir. A tela não dá UPDATE em patrimônio.

import { useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Inbox, Layers, PackageMinus, PackagePlus, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { useInventario } from "@/features/clientes/inventario";
import {
  CabecalhoDoPainel, ROLAGEM_DO_PAINEL, estiloDoPainel,
} from "@/features/clientes/EquipamentosDoCliente";
import { TIPO_ARRASTO, arrastoEhNosso, lerArrasto, serializarArrasto } from "@/features/clientes/vinculo";
import {
  blocosParaArrastar, desfazerMovimento, moverEquipamento, rotuloDoEquipamento,
  useEquipamentosDaAtividade, useEquipamentosDoClienteDaAtividade, useEquipamentosLivres,
  type EquipamentoDoCliente, type EquipamentoLivre, type MovimentoDeEquipamento,
} from "./equipamentos-atividade";

/** De onde o item saiu — é o que decide se o drop é retirada, instalação ou nada. */
type Origem = "cliente" | "fora";

interface Props {
  chamadoId: string;
  clienteId: string;
  podeEditar: boolean;
  /** o card e o micro-rótulo da página — a MESMA casca dos outros blocos */
  estiloCard: CSSProperties;
  estiloSecao: CSSProperties;
}

export function EquipamentosDaAtividade({ chamadoId, clienteId, podeEditar, estiloCard, estiloSecao }: Props) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const qc = useQueryClient();
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const [busca, setBusca] = useState("");
  /** o que está na mão agora: os ids e de qual painel saíram */
  const [arrasto, setArrasto] = useState<{ origem: Origem; ids: string[] } | null>(null);

  const mov = useEquipamentosDaAtividade(chamadoId);
  const doCliente = useEquipamentosDoClienteDaAtividade(chamadoId, true);
  const livres = useEquipamentosLivres(busca, true);
  const { data: sistemas = [] } = useInventario(clienteId);

  const movimentos = mov.data?.itens ?? [];
  const faltaMigration = !!(mov.data?.faltaMigration || doCliente.data?.faltaMigration || livres.data?.faltaMigration);
  const blocos = useMemo(
    () => blocosParaArrastar(sistemas.filter((s) => s.ativo !== false), doCliente.data?.itens ?? []),
    [sistemas, doCliente.data],
  );

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["equipamentos-atividade", chamadoId] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente-atividade", chamadoId] });
    qc.invalidateQueries({ queryKey: ["equipamentos-livres"] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
  }

  const mover = useMutation({
    mutationFn: async (a: { ids: string[]; tipo: "retirada" | "instalacao"; sistemaId?: string | null }) => {
      for (const id of a.ids) {
        await moverEquipamento({ patrimonioId: id, chamadoId, tipo: a.tipo, sistemaId: a.sistemaId ?? null });
      }
      return a;
    },
    onSuccess: (a) => {
      recarregar();
      const n = a.ids.length;
      toast.success(a.tipo === "retirada"
        ? `${n === 1 ? "Equipamento retirado" : `${n} equipamentos retirados`} do cliente.`
        : `${n === 1 ? "Equipamento instalado" : `${n} equipamentos instalados`}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desfazer = useMutation({
    mutationFn: (m: MovimentoDeEquipamento) => desfazerMovimento(m.movimento_id),
    onSuccess: () => { recarregar(); toast.success("Movimento desfeito."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ocupado = mover.isPending || desfazer.isPending;
  const podeSoltar = podeEditar && !faltaMigration && !ocupado;

  // ── o gesto ───────────────────────────────────────────────────────────────
  function iniciar(e: DragEvent<HTMLDivElement>, origem: Origem, id: string) {
    e.dataTransfer.setData(TIPO_ARRASTO, serializarArrasto([id]));
    e.dataTransfer.setData("text/plain", serializarArrasto([id]));
    e.dataTransfer.effectAllowed = "move";
    setArrasto({ origem, ids: [id] });
  }
  function terminar() { setArrasto(null); }
  function idsSoltos(e: DragEvent<HTMLElement>): string[] {
    const ids = lerArrasto(e.dataTransfer.getData(TIPO_ARRASTO) || e.dataTransfer.getData("text/plain"));
    return ids.length > 0 ? ids : (arrasto?.ids ?? []);
  }

  const linha: CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10,
    background: c.campo, border: `1px solid ${c.divisoria}`, minWidth: 0,
  };
  const nota: CSSProperties = { fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario, lineHeight: 1.45 };

  return (
    <div style={estiloCard}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={estiloSecao}>Equipamentos</span>
        <span style={nota}>
          Arraste um equipamento do cliente para <strong style={{ fontWeight: 600 }}>Fora do cliente</strong> para
          retirar; arraste de lá para um <strong style={{ fontWeight: 600 }}>bloco</strong> para instalar.
        </span>
      </div>

      {faltaMigration ? (
        <span style={nota}>
          Os equipamentos da atividade precisam da migration <strong>U119</strong>. Até ela rodar, nada aparece aqui.
        </span>
      ) : (
        <div className="painel-vinculo">
          {/* ══ NO CLIENTE — por bloco; cada bloco é uma zona de soltar ═════ */}
          <section aria-label="Equipamentos no cliente, por bloco" style={estiloDoPainel(isLight, "nenhum")}>
            <CabecalhoDoPainel
              icone={<Layers size={15} />}
              titulo="No cliente"
              contagem={`${doCliente.data?.itens.length ?? 0} ${(doCliente.data?.itens.length ?? 0) === 1 ? "item" : "itens"}`}
            />
            {doCliente.isLoading ? (
              <span style={nota}>Carregando os blocos…</span>
            ) : blocos.length === 0 ? (
              <span style={nota}>Este cliente não tem bloco cadastrado — crie na ficha do cliente.</span>
            ) : (
              <div className="rolagem-fina" style={{ ...ROLAGEM_DO_PAINEL, display: "flex", flexDirection: "column", gap: 8 }}>
                {blocos.map((b) => (
                  <ZonaDoBloco
                    key={b.sistemaId ?? "__sem"}
                    nome={b.nome}
                    itens={b.itens}
                    // R236: só o que vem de FORA instala; de bloco para bloco é cadastro (ficha)
                    aceita={podeSoltar && !!b.sistemaId && arrasto?.origem === "fora"}
                    aoSoltar={(ids) => mover.mutate({ ids, tipo: "instalacao", sistemaId: b.sistemaId })}
                    idsSoltos={idsSoltos}
                    arrastando={arrasto?.ids ?? null}
                    aoIniciar={(e, id) => iniciar(e, "cliente", id)}
                    aoTerminar={terminar}
                    podeArrastar={podeSoltar}
                    linha={linha}
                    nota={nota}
                    c={c}
                    gold={gold}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ══ FORA DO CLIENTE — a zona de soltar da RETIRADA ══════════════ */}
          <PainelFora
            itens={livres.data?.itens ?? []}
            carregando={livres.isLoading}
            busca={busca}
            aoBuscar={setBusca}
            aceita={podeSoltar && arrasto?.origem === "cliente"}
            aoSoltar={(ids) => mover.mutate({ ids, tipo: "retirada" })}
            idsSoltos={idsSoltos}
            arrastando={arrasto?.ids ?? null}
            aoIniciar={(e, id) => iniciar(e, "fora", id)}
            aoTerminar={terminar}
            podeArrastar={podeSoltar}
            linha={linha}
            nota={nota}
            c={c}
          />
        </div>
      )}

      {/* ══ O QUE ESTA ATIVIDADE FEZ — com desfazer para o clique errado ══ */}
      {movimentos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 4 }}>
          <span style={{ ...estiloSecao, fontSize: 9.5 }}>Nesta atividade</span>
          <div className="atividade-equip-lista">
            {movimentos.map((m) => {
              const cor = m.tipo === "retirada"
                ? (isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark)
                : (isLight ? PRISMA.verde.light : PRISMA.verde.dark);
              return (
                <div key={m.movimento_id} style={linha}>
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
                      {m.tipo === "retirada" ? "Retirado do cliente" : `Instalado em ${m.sistema_nome ?? "sem bloco"}`}
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
  );
}

// ── um bloco do cliente: cabeçalho que aceita o drop + os itens arrastáveis ──

function ZonaDoBloco({
  nome, itens, aceita, aoSoltar, idsSoltos, arrastando, aoIniciar, aoTerminar, podeArrastar, linha, nota, c, gold,
}: {
  nome: string;
  itens: EquipamentoDoCliente[];
  aceita: boolean;
  aoSoltar: (ids: string[]) => void;
  idsSoltos: (e: DragEvent<HTMLElement>) => string[];
  arrastando: string[] | null;
  aoIniciar: (e: DragEvent<HTMLDivElement>, id: string) => void;
  aoTerminar: () => void;
  podeArrastar: boolean;
  linha: CSSProperties;
  nota: CSSProperties;
  c: ReturnType<typeof cinzas>;
  gold: string;
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
        display: "flex", flexDirection: "column", gap: 5,
        padding: 8, borderRadius: 12,
        border: sobre ? `1.5px solid ${gold}` : aceita ? `1.5px dashed ${gold}` : `1px solid ${c.divisoria}`,
        background: sobre ? PRISMA.amarelo.bg : "transparent",
        transition: "border-color .15s ease, background-color .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{
          fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: c.texto,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {nome}
        </span>
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: c.textoSecundario, flexShrink: 0 }}>
          {itens.length}
        </span>
      </div>
      {itens.length === 0 && <span style={{ ...nota, fontSize: 11 }}>vazio</span>}
      {itens.map((i) => (
        <div
          key={i.patrimonio_id}
          draggable={podeArrastar}
          onDragStart={(e) => aoIniciar(e, i.patrimonio_id)}
          onDragEnd={aoTerminar}
          title={podeArrastar ? "Arraste para “Fora do cliente” para retirar" : undefined}
          style={{
            ...linha, padding: "6px 9px",
            cursor: podeArrastar ? "grab" : "default",
            opacity: arrastando?.includes(i.patrimonio_id) ? 0.45 : 1,
          }}
        >
          {podeArrastar && <GripVertical size={13} color={c.textoSecundario} style={{ flexShrink: 0 }} aria-hidden />}
          <span style={{
            fontFamily: FONT, fontSize: 12, color: c.texto, flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {rotuloDoEquipamento(i)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── o painel de fora: busca, lista arrastável, e a zona de soltar da retirada ──

function PainelFora({
  itens, carregando, busca, aoBuscar, aceita, aoSoltar, idsSoltos, arrastando, aoIniciar, aoTerminar, podeArrastar, linha, nota, c,
}: {
  itens: EquipamentoLivre[];
  carregando: boolean;
  busca: string;
  aoBuscar: (v: string) => void;
  aceita: boolean;
  aoSoltar: (ids: string[]) => void;
  idsSoltos: (e: DragEvent<HTMLElement>) => string[];
  arrastando: string[] | null;
  aoIniciar: (e: DragEvent<HTMLDivElement>, id: string) => void;
  aoTerminar: () => void;
  podeArrastar: boolean;
  linha: CSSProperties;
  nota: CSSProperties;
  c: ReturnType<typeof cinzas>;
}) {
  const { isLight } = useTheme();
  const [sobre, setSobre] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const onde = (i: EquipamentoLivre): string =>
    i.pessoa_nome ? `Com ${i.pessoa_nome}` : i.situacao === "retirado" ? "Retirado de cliente" : (i.local_qap || "Sem local");

  const miolo: ReactNode = carregando ? (
    <span style={nota}>Buscando…</span>
  ) : itens.length === 0 ? (
    <span style={nota}>
      {busca.trim() ? `Nenhum equipamento fora de cliente com “${busca.trim()}”.` : "Nenhum equipamento fora de cliente."}
    </span>
  ) : (
    <div className="rolagem-fina" style={{ ...ROLAGEM_DO_PAINEL, display: "flex", flexDirection: "column", gap: 5 }}>
      {itens.map((i) => (
        <div
          key={i.patrimonio_id}
          draggable={podeArrastar}
          onDragStart={(e) => aoIniciar(e, i.patrimonio_id)}
          onDragEnd={aoTerminar}
          title={podeArrastar ? "Arraste para um bloco para instalar" : undefined}
          style={{
            ...linha,
            cursor: podeArrastar ? "grab" : "default",
            opacity: arrastando?.includes(i.patrimonio_id) ? 0.45 : 1,
          }}
        >
          {podeArrastar && <GripVertical size={13} color={c.textoSecundario} style={{ flexShrink: 0 }} aria-hidden />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: FONT, fontSize: 12, color: c.texto,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {rotuloDoEquipamento(i)}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 10.5, color: c.textoSecundario }}>{onde(i)}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section
      aria-label="Equipamentos fora do cliente"
      onDragOver={(e: DragEvent<HTMLElement>) => {
        if (!aceita || !arrastoEhNosso(e.dataTransfer.types)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!sobre) setSobre(true);
      }}
      onDragLeave={(e: DragEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setSobre(false);
      }}
      onDrop={(e: DragEvent<HTMLElement>) => {
        if (!aceita) return;
        e.preventDefault();
        setSobre(false);
        const ids = idsSoltos(e);
        if (ids.length > 0) aoSoltar(ids);
        aoTerminar();
      }}
      style={estiloDoPainel(isLight, sobre ? "ativo" : aceita ? "possivel" : "nenhum")}
    >
      <CabecalhoDoPainel
        icone={<Inbox size={15} />}
        titulo="Fora do cliente"
        contagem={itens.length > 0 ? `${itens.length}` : undefined}
        direita={(
          <div style={{ position: "relative", minWidth: 180 }}>
            <Search size={13} color={c.textoSecundario} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              ref={campo}
              value={busca}
              onChange={(e) => aoBuscar(e.target.value)}
              placeholder="Buscar por nº, nome, modelo…"
              aria-label="Buscar equipamento fora do cliente"
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 28,
                padding: "0 10px 0 28px", borderRadius: 999,
                background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
                fontFamily: FONT, fontSize: 12, outline: "none",
              }}
            />
          </div>
        )}
      />
      {aceita && <span style={{ ...nota, fontSize: 11 }}>Solte aqui para retirar do cliente.</span>}
      {miolo}
    </section>
  );
}
