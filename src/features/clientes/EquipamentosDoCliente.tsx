// EQUIPAMENTOS DO QAP na ficha do cliente — os que ainda não têm sistema (R200, U111).
//
// Davi, 2026-09-07: "Os sistemas instalados consistem em blocos com
// equipamentos vinculados a estes blocos. Então os blocos deverão ser criados
// diretamente no nosso app, enquanto os equipamentos de cada cliente são
// importados pelo QAP, e aí no nosso sistema, o usuário vincula o equipamento
// ao sistema instalado (ambos no mesmo cliente)."
//
// ESTE CARD É A FILA DE TRABALHO DO VÍNCULO: lista só o que ainda não está em
// bloco nenhum, com seleção múltipla e um seletor de sistema — 40 câmeras vão
// para o bloco de CFTV num gesto. O que já está vinculado aparece DENTRO do
// bloco, em `InventarioCliente`, com o mesmo seletor (para mover ou
// desvincular). Quando tudo está vinculado, o card vira uma linha de
// confirmação; quando o cliente não tem equipamento do QAP, não aparece.
//
// `LinhaDoPatrimonio` e `SeletorDeSistema` são exportados para o
// `InventarioCliente` desenhar o item vinculado com a MESMA linha — o mesmo
// equipamento não pode ter duas caras na mesma ficha.

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckSquare, Link2, Search, Square } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { normalizarTexto } from "@/lib/normalizar";
import { SeletorDeOpcao } from "@/components/SeletorDeOpcao";
import { useEquipamentosDoCliente, vincularAoSistema, type ItemDePatrimonio } from "@/features/equipamentos/data";
import { useInventario, TIPO_SISTEMA_LABEL, type SistemaInstalado } from "./inventario";

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
 * O seletor de sistema — o MESMO nos dois lugares (fila e bloco). Compacto,
 * pintado só quando há escolha; `vazio` é o gesto de desvincular.
 */
export function SeletorDeSistema({ sistemas, valor, aoMudar, desabilitado }: {
  sistemas: SistemaInstalado[];
  valor: string | null;
  aoMudar: (sistemaId: string | null) => void;
  desabilitado?: boolean;
}) {
  return (
    <SeletorDeOpcao
      compacto
      valor={valor}
      vazio={valor ? "Desvincular" : "— vincular a um sistema —"}
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
  /** o que entra ANTES do texto (a caixa de seleção, na fila) */
  esquerda?: ReactNode;
  /** o que entra DEPOIS (o seletor de sistema) */
  direita?: ReactNode;
  primeira?: boolean;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
      borderTop: primeira ? "none" : `1px solid ${c.divisoria}`,
    }}>
      {esquerda}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: c.texto }}>
          {item.catalogo?.nome ?? "Equipamento"}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario, marginTop: 1 }}>
          {[item.catalogo?.modelo, item.catalogo?.fabricante, item.catalogo?.almoxarifado].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 0 }}>
        {/* R197: identificação pode faltar — e o espaço dela existe */}
        <div style={{
          fontFamily: item.identificacao ? "ui-monospace, Menlo, monospace" : FONT,
          fontSize: 11.5, fontWeight: 600,
          color: item.identificacao ? c.texto : c.textoSecundario,
        }}>
          {item.identificacao ?? "sem identificação"}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>
          {dataCurta(item.enviado_em)}
        </div>
      </div>
      {direita}
    </div>
  );
}

export function EquipamentosDoCliente({ clienteId }: { clienteId: string }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;
  const invalidar = useInvalidarPatrimonioDoCliente(clienteId);

  const { data, isLoading } = useEquipamentosDoCliente(clienteId);
  const { data: sistemas = [] } = useInventario(clienteId);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<string | null>(null);

  const todos = data?.itens ?? [];
  // a FILA: só o que ainda não está em bloco nenhum (R200)
  const semSistema = useMemo(() => todos.filter((i) => !i.cliente_sistema_id), [todos]);
  const filtrados = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return semSistema;
    return semSistema.filter((i) => normalizarTexto(
      `${i.catalogo?.nome ?? ""} ${i.catalogo?.modelo ?? ""} ${i.catalogo?.fabricante ?? ""} ${i.identificacao ?? ""} ${i.catalogo?.almoxarifado ?? ""}`,
    ).includes(termo));
  }, [semSistema, busca]);

  const vincular = useMutation({
    mutationFn: ({ ids, sistemaId }: { ids: string[]; sistemaId: string | null }) => vincularAoSistema(ids, sistemaId),
    onSuccess: (_d, { ids, sistemaId }) => {
      invalidar();
      setSelecionados(new Set());
      const sis = sistemas.find((s) => s.id === sistemaId);
      toast.success(sis
        ? `${ids.length} equipamento${ids.length === 1 ? "" : "s"} vinculado${ids.length === 1 ? "" : "s"} a ${sis.nome}.`
        : "Vínculo desfeito.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // sem a U109 o bloco não aparece: prometer uma lista que o banco ainda não
  // sabe responder é pior que não mostrar nada
  if (data?.faltaMigration) return null;
  if (isLoading) return null;
  if (todos.length === 0) return null;

  const MICRO = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em",
    textTransform: "uppercase" as const, color: gold,
  };

  // tudo vinculado: uma linha de confirmação, não um card vazio
  if (semSistema.length === 0) {
    return (
      <div style={{ ...card(isLight), borderRadius: 18, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <Link2 size={15} color={verde} />
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.texto }}>
          Todos os <strong>{todos.length}</strong> equipamentos do QAP deste cliente estão em um sistema instalado.
        </span>
      </div>
    );
  }

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

  return (
    <div style={{ ...card(isLight), borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Boxes size={15} color={gold} />
        <span style={MICRO}>Equipamentos a vincular</span>
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario }}>
          {semSistema.length} de {todos.length} do QAP ainda sem sistema
        </span>
        {semSistema.length > 8 && (
          <div style={{ position: "relative", marginLeft: "auto", minWidth: 200 }}>
            <Search size={13} color={c.textoSecundario} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar equipamento…"
              aria-label="Filtrar equipamentos a vincular"
              style={{
                width: "100%", boxSizing: "border-box", minHeight: 32,
                padding: "0 10px 0 30px", borderRadius: 999,
                background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
                fontFamily: FONT, fontWeight: 400, fontSize: 12, outline: "none",
              }}
            />
          </div>
        )}
      </div>

      {sistemas.length === 0 ? (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.5 }}>
          Este cliente ainda não tem sistema instalado. Crie o primeiro bloco em <strong>Sistemas
          instalados</strong> (acima) e os equipamentos passam a poder ser vinculados a ele.
        </div>
      ) : (
        /* A BARRA DO VÍNCULO EM LOTE — o gesto principal deste card */
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "8px 10px", borderRadius: 12, background: c.campo, border: `1px solid ${c.divisoria}`,
        }}>
          {caixa(todosFiltradosMarcados, () => setSelecionados(
            todosFiltradosMarcados ? new Set() : new Set(filtrados.map((i) => i.id)),
          ), todosFiltradosMarcados ? "Desmarcar todos" : "Marcar todos os listados")}
          <span style={{ fontFamily: FONT, fontSize: 12, color: c.texto, minWidth: 0 }}>
            {selecionados.size === 0
              ? `Marque os equipamentos e escolha o sistema${busca ? " (só os listados)" : ""}`
              : `${selecionados.size} selecionado${selecionados.size === 1 ? "" : "s"}`}
          </span>
          <span style={{ flex: 1 }} />
          <SeletorDeSistema sistemas={sistemas} valor={destino} aoMudar={setDestino} />
          <button
            type="button"
            disabled={selecionados.size === 0 || !destino || vincular.isPending}
            onClick={() => destino && vincular.mutate({ ids: [...selecionados], sistemaId: destino })}
            style={{
              ...goldButton(), boxShadow: "none", height: 30, padding: "0 12px", borderRadius: 999,
              fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6,
              opacity: selecionados.size === 0 || !destino ? 0.5 : 1,
              cursor: selecionados.size === 0 || !destino ? "default" : "pointer",
            }}
          >
            <Link2 size={13} /> Vincular
          </button>
        </div>
      )}

      {filtrados.length === 0 ? (
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario }}>
          Nenhum equipamento com “{busca}”.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtrados.map((i, idx) => (
            <LinhaDoPatrimonio
              key={i.id}
              item={i}
              primeira={idx === 0}
              esquerda={sistemas.length > 0 ? caixa(selecionados.has(i.id), () => alternar(i.id), `Selecionar ${i.catalogo?.nome ?? "equipamento"}`) : undefined}
              direita={sistemas.length > 0 ? (
                <SeletorDeSistema
                  sistemas={sistemas}
                  valor={null}
                  desabilitado={vincular.isPending}
                  aoMudar={(sid) => sid && vincular.mutate({ ids: [i.id], sistemaId: sid })}
                />
              ) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
