// SEM BLOCO — o painel da direita do vínculo por arrasto (R200, R206; U111/U114).
//
// Davi, 2026-09-07: "dois campos um ao lado do outro, um com bloco e sub-itens
// sendo os equipamentos já vinculados a aquele bloco, e o outro campo são os
// equipamentos sem bloco vinculado, e aí só de arrastar o equipamento ao bloco,
// o sistema já vincula. Eu quero que fique muito claro e intuitivo os campos."
//
// Este arquivo é o painel "Sem bloco": os equipamentos do QAP que ainda não
// estão em bloco nenhum. Cada linha se ARRASTA para um bloco (o painel da
// esquerda, em InventarioCliente); marcar várias e arrastar uma leva todas. O
// painel também é ZONA DE SOLTAR: um equipamento arrastado de dentro de um
// bloco cai aqui e volta a ficar sem bloco. Quem não arrasta (teclado, toque)
// tem o seletor de bloco que aparece quando há seleção — o mesmo destino, sem
// o gesto.
//
// Quem manda no dado é o pai: o painel recebe a lista, avisa "comecei/terminei
// a arrastar" e pede "vincule estes ids a este bloco". Assim as duas zonas de
// soltar (os blocos e este painel) conversam pelo mesmo estado, e a mutação —
// com a conferência de "mesmo cliente" — existe UMA vez.
//
// `LinhaDoPatrimonio` e `SeletorDeSistema` continuam exportados: o mesmo
// equipamento tem a mesma cara dentro do bloco e fora dele.

import { useEffect, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, GripVertical, Inbox, Link2, Search, Square } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { normalizarTexto } from "@/lib/normalizar";
import { SeletorDeOpcao } from "@/components/SeletorDeOpcao";
import type { ItemDePatrimonio } from "@/features/equipamentos/data";
import { TIPO_SISTEMA_LABEL, type SistemaInstalado } from "./inventario";
import { TIPO_ARRASTO, arrastoEhNosso, idsParaArrastar, lerArrasto, serializarArrasto, textoDoItem } from "./vinculo";

/** dd/mm/aaaa a partir do date do banco (aaaa-mm-dd), sem passar por fuso. */
export function dataCurta(iso: string | null): string {
  if (!iso) return "sem data";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Invalida o que lê o patrimônio deste cliente — a ficha e o catálogo. */
export function useInvalidarPatrimonioDoCliente(clienteId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
    qc.invalidateQueries({ queryKey: ["catalogo-patrimonio"] });
    qc.invalidateQueries({ queryKey: ["patrimonio-totais"] });
  };
}

/**
 * O seletor de bloco — o caminho SEM arrasto (teclado, toque). Compacto,
 * pintado só quando há escolha; `vazio` é a frase de convite.
 */
export function SeletorDeSistema({ sistemas, valor, aoMudar, desabilitado, vazio }: {
  sistemas: SistemaInstalado[];
  valor: string | null;
  aoMudar: (sistemaId: string | null) => void;
  desabilitado?: boolean;
  vazio?: string;
}) {
  return (
    <SeletorDeOpcao
      compacto
      valor={valor}
      vazio={vazio ?? (valor ? "Desvincular" : "— vincular a um sistema —")}
      desabilitado={desabilitado || sistemas.length === 0}
      larguraMenu={300}
      opcoes={sistemas.map((s) => ({ valor: s.id, rotulo: s.nome, nota: TIPO_SISTEMA_LABEL[s.tipo] ?? s.tipo }))}
      aoMudar={aoMudar}
    />
  );
}

/** Uma linha de equipamento do QAP: nome, modelo/fabricante/almoxarifado, identificação e data. */
export function LinhaDoPatrimonio({ item, esquerda, direita, primeira }: {
  item: ItemDePatrimonio;
  /** o que entra ANTES do texto (a caixa de seleção e a alça de arrasto) */
  esquerda?: ReactNode;
  /** o que entra DEPOIS (o botão de desvincular, dentro do bloco) */
  direita?: ReactNode;
  primeira?: boolean;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 6px",
      borderTop: primeira ? "none" : `1px solid ${c.divisoria}`,
    }}>
      {esquerda}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: c.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.catalogo?.nome ?? "Equipamento"}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[item.catalogo?.modelo, item.catalogo?.fabricante, item.catalogo?.almoxarifado].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 0 }}>
        {/* R197: identificação pode faltar — e o espaço dela existe */}
        <div style={{
          fontFamily: item.identificacao ? "ui-monospace, Menlo, monospace" : FONT,
          fontSize: 11, fontWeight: 600,
          color: item.identificacao ? c.texto : c.textoSecundario,
        }}>
          {item.identificacao ?? "sem identificação"}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 10.5, color: c.textoSecundario }}>
          {dataCurta(item.enviado_em)}
        </div>
      </div>
      {direita}
    </div>
  );
}

/**
 * A moldura de um PAINEL do vínculo (Blocos | Sem bloco) — a mesma nos dois.
 * `destaque`: "nenhum" em repouso; "possivel" enquanto algo é arrastado e pode
 * cair aqui (tracejado dourado); "ativo" com o arrasto em cima (sólido + tinta).
 *
 * R208: o painel tem TETO de altura e a lista rola POR DENTRO (`ROLAGEM_DO_PAINEL`
 * no filho que lista) — cabeçalho e barra ficam parados, e a página não cresce
 * com 60 câmeras. Davi: "os campos de bloco e equipamentos com scroll interno,
 * não deve ser scroll da tela inteira."
 */
export const ALTURA_MAXIMA_DO_PAINEL = "min(64vh, 720px)";
/** o estilo do filho que rola dentro do painel — sempre com a classe `rolagem-fina` */
export const ROLAGEM_DO_PAINEL: CSSProperties = { overflowY: "auto", minHeight: 0, flex: 1, paddingRight: 2 };

export function estiloDoPainel(isLight: boolean, destaque: "nenhum" | "possivel" | "ativo"): CSSProperties {
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  return {
    display: "flex", flexDirection: "column", gap: 10, minHeight: 180, minWidth: 0,
    maxHeight: ALTURA_MAXIMA_DO_PAINEL, boxSizing: "border-box",
    padding: 12, borderRadius: 14,
    border: destaque === "ativo" ? `1.5px solid ${gold}` : destaque === "possivel" ? `1.5px dashed ${gold}` : `1px solid ${c.divisoria}`,
    background: destaque === "ativo" ? PRISMA.amarelo.bg : "transparent",
    transition: "border-color .15s ease, background-color .15s ease",
  };
}

/** O micro-rótulo de um painel: ícone dourado, título 10,5/700 caixa alta e a contagem em 11,5 secundário. */
export function CabecalhoDoPainel({ icone, titulo, contagem, direita }: { icone: ReactNode; titulo: string; contagem?: string; direita?: ReactNode }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 28, flexWrap: "wrap" }}>
      <span style={{ color: gold, display: "flex" }}>{icone}</span>
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em", textTransform: "uppercase", color: gold }}>{titulo}</span>
      {contagem && <span style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario }}>{contagem}</span>}
      <span style={{ flex: 1 }} />
      {direita}
    </div>
  );
}

export interface PainelSemBlocoProps {
  /** os equipamentos do QAP SEM bloco (a lista deste painel) */
  itens: ItemDePatrimonio[];
  /** todos os equipamentos do QAP do cliente, para dizer "5 de 14" */
  total: number;
  sistemas: SistemaInstalado[];
  podeEditar: boolean;
  faltaMigration: boolean;
  carregando: boolean;
  /** ids em arrasto agora (de qualquer painel), ou null */
  arrastando: string[] | null;
  aoIniciarArrasto: (ids: string[]) => void;
  aoTerminarArrasto: () => void;
  /** vincula (sistemaId) ou desvincula (null); o pai confere o que de fato muda */
  aoVincular: (ids: string[], sistemaId: string | null) => void;
  vinculando: boolean;
}

export function EquipamentosDoCliente({
  itens, total, sistemas, podeEditar, faltaMigration, carregando,
  arrastando, aoIniciarArrasto, aoTerminarArrasto, aoVincular, vinculando,
}: PainelSemBlocoProps) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;

  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [sobre, setSobre] = useState(false);

  const filtrados = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return itens;
    return itens.filter((i) => normalizarTexto(textoDoItem(i)).includes(termo));
  }, [itens, busca]);

  // a seleção não pode apontar para item que já saiu daqui (foi vinculado)
  const idsAqui = useMemo(() => new Set(itens.map((i) => i.id)), [itens]);
  useEffect(() => {
    setSelecionados((prev) => {
      const n = new Set([...prev].filter((id) => idsAqui.has(id)));
      return n.size === prev.size ? prev : n;
    });
  }, [idsAqui]);

  const podeArrastar = podeEditar && sistemas.length > 0;
  // um arrasto vindo de DENTRO de um bloco pode cair aqui (desvincular)
  const arrastoDeBloco = !!arrastando && arrastando.some((id) => !idsAqui.has(id));
  const destaque = podeEditar && arrastoDeBloco ? (sobre ? "ativo" : "possivel") : "nenhum";

  const alternar = (id: string) => setSelecionados((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const todosFiltradosMarcados = filtrados.length > 0 && filtrados.every((i) => selecionados.has(i.id));
  const caixa = (marcada: boolean, aoClicar: () => void, rotulo: string) => (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={marcada}
      aria-label={rotulo}
      style={{ background: "transparent", border: "none", padding: 2, cursor: "pointer", color: marcada ? gold : c.textoSecundario, display: "flex", flexShrink: 0 }}
    >
      {marcada ? <CheckSquare size={16} /> : <Square size={16} />}
    </button>
  );

  const nota: CSSProperties = { fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5 };

  const conteudo = (() => {
    if (faltaMigration) {
      return <span style={nota}>Os equipamentos do QAP aparecem aqui depois que a migration <strong>U109</strong> rodar.</span>;
    }
    if (carregando) return <span style={nota}>Carregando os equipamentos…</span>;
    if (total === 0) {
      return (
        <span style={nota}>
          Nenhum equipamento do QAP importado para este cliente. A importação casa o local do QAP com o nome do
          cliente — se o prédio tem equipamento lá, o nome pode estar diferente.
        </span>
      );
    }
    if (itens.length === 0) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link2 size={15} color={verde} />
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.texto }}>
            Todos os <strong>{total}</strong> equipamentos do QAP deste cliente estão em um sistema instalado.
          </span>
        </div>
      );
    }
    return (
      <>
        {sistemas.length === 0 ? (
          <span style={nota}>
            Este cliente ainda não tem sistema instalado. Crie o primeiro bloco em <strong>+ Bloco</strong> e
            arraste os equipamentos para ele.
          </span>
        ) : podeEditar && (
          /* A BARRA DO GESTO: o que fazer, e o caminho sem arrasto quando há seleção */
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "7px 10px", borderRadius: 12, background: c.campo, border: `1px solid ${c.divisoria}`,
          }}>
            {caixa(todosFiltradosMarcados, () => setSelecionados(
              todosFiltradosMarcados ? new Set() : new Set(filtrados.map((i) => i.id)),
            ), todosFiltradosMarcados ? "Desmarcar todos" : "Marcar todos os listados")}
            <span style={{ fontFamily: FONT, fontSize: 12, color: c.texto, minWidth: 0, lineHeight: 1.4 }}>
              {selecionados.size === 0
                ? "Arraste um equipamento para o bloco — ou marque vários e arraste juntos."
                : `${selecionados.size} selecionado${selecionados.size === 1 ? "" : "s"} — arraste um deles para o bloco`}
            </span>
            <span style={{ flex: 1 }} />
            {selecionados.size > 0 && (
              <SeletorDeSistema
                sistemas={sistemas}
                valor={null}
                vazio="ou escolha o bloco…"
                desabilitado={vinculando}
                aoMudar={(sid) => { if (sid) aoVincular([...selecionados], sid); }}
              />
            )}
          </div>
        )}

        {filtrados.length === 0 ? (
          <span style={nota}>Nenhum equipamento com “{busca}”.</span>
        ) : (
          /* R208: só a LISTA rola; cabeçalho e barra ficam parados */
          <div className="rolagem-fina" style={{ ...ROLAGEM_DO_PAINEL, display: "flex", flexDirection: "column" }}>
            {filtrados.map((i, idx) => {
              const emArrasto = !!arrastando?.includes(i.id);
              return (
                <div
                  key={i.id}
                  draggable={podeArrastar}
                  onDragStart={(e: DragEvent<HTMLDivElement>) => {
                    const ids = idsParaArrastar(i.id, selecionados);
                    e.dataTransfer.setData(TIPO_ARRASTO, serializarArrasto(ids));
                    e.dataTransfer.setData("text/plain", serializarArrasto(ids));
                    e.dataTransfer.effectAllowed = "move";
                    aoIniciarArrasto(ids);
                  }}
                  onDragEnd={aoTerminarArrasto}
                  title={podeArrastar ? "Arraste para um bloco" : undefined}
                  style={{ cursor: podeArrastar ? "grab" : "default", opacity: emArrasto ? 0.45 : 1, borderRadius: 10 }}
                >
                  <LinhaDoPatrimonio
                    item={i}
                    primeira={idx === 0}
                    esquerda={podeArrastar ? (
                      <>
                        {caixa(selecionados.has(i.id), () => alternar(i.id), `Selecionar ${i.catalogo?.nome ?? "equipamento"}`)}
                        <GripVertical size={14} color={c.textoSecundario} style={{ flexShrink: 0 }} aria-hidden />
                      </>
                    ) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  })();

  return (
    <section
      aria-label="Equipamentos sem bloco"
      onDragOver={(e: DragEvent<HTMLElement>) => {
        if (!podeEditar || !arrastoEhNosso(e.dataTransfer.types)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!sobre) setSobre(true);
      }}
      onDragLeave={(e: DragEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setSobre(false);
      }}
      onDrop={(e: DragEvent<HTMLElement>) => {
        if (!podeEditar) return;
        e.preventDefault();
        setSobre(false);
        const ids = lerArrasto(e.dataTransfer.getData(TIPO_ARRASTO) || e.dataTransfer.getData("text/plain"));
        aoVincular(ids.length > 0 ? ids : (arrastando ?? []), null);
        aoTerminarArrasto();
      }}
      style={estiloDoPainel(isLight, destaque)}
    >
      <CabecalhoDoPainel
        icone={<Inbox size={15} />}
        titulo="Sem bloco"
        contagem={total > 0 ? `${itens.length} de ${total}` : undefined}
        direita={itens.length > 8 ? (
          <div style={{ position: "relative", minWidth: 170 }}>
            <Search size={13} color={c.textoSecundario} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar…"
              aria-label="Filtrar equipamentos sem bloco"
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 28,
                padding: "0 10px 0 28px", borderRadius: 999,
                background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
                fontFamily: FONT, fontWeight: 400, fontSize: 12, outline: "none",
              }}
            />
          </div>
        ) : undefined}
      />
      {destaque === "ativo" ? (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120,
          border: `1.5px dashed ${gold}`, borderRadius: 12, fontFamily: FONT, fontWeight: 600, fontSize: 13, color: c.texto,
        }}>
          Solte para tirar do bloco
        </div>
      ) : conteudo}
    </section>
  );
}
