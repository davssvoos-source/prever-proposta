// EQUIPAMENTOS NO LOCAL — o patrimônio do QAP na ficha do cliente (R199, U109).
//
// Davi, 04/09/2026: "Cada cliente, na página do cliente terão os equipamentos
// listados, e posteriormente iremos associar cada equipamento a um bloco do
// condomínio… Antes ainda vamos cadastrar os sistemas implantados em cada
// cliente, para depois vinculá-los aos equipamentos."
//
// POR QUE ESTE BLOCO NÃO É O `InventarioCliente`. O inventário as-built (logo
// acima na ficha) é sistema → equipamento, e nasce do escopo aprovado de uma
// visita. Este bloco é o PATRIMÔNIO: o que o QAP diz que está fisicamente no
// prédio, item a item, com identificação e data de envio. Os dois vão se
// encontrar no passo seguinte, quando cada item ganhar o `cliente_sistema_id`
// do bloco onde está — e é por isso que este bloco mostra "sem bloco" em vez
// de esconder a coluna: o vínculo que falta é trabalho a fazer, não detalhe.

import { useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { normalizarTexto } from "@/lib/normalizar";
import { useEquipamentosDoCliente } from "@/features/equipamentos/data";

/** dd/mm/aaaa a partir do date do banco (aaaa-mm-dd), sem passar por fuso. */
function dataCurta(iso: string | null): string {
  if (!iso) return "sem data";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function EquipamentosDoCliente({ clienteId }: { clienteId: string }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const [busca, setBusca] = useState("");
  const { data, isLoading } = useEquipamentosDoCliente(clienteId);

  const itens = data?.itens ?? [];
  const filtrados = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return itens;
    return itens.filter((i) =>
      normalizarTexto(
        `${i.catalogo?.nome ?? ""} ${i.catalogo?.modelo ?? ""} ${i.catalogo?.fabricante ?? ""} ${i.identificacao ?? ""} ${i.catalogo?.almoxarifado ?? ""}`,
      ).includes(termo),
    );
  }, [itens, busca]);

  // sem a U109 o bloco não aparece: prometer uma lista que o banco ainda não
  // sabe responder é pior que não mostrar nada
  if (data?.faltaMigration) return null;
  if (isLoading) return null;
  if (itens.length === 0) return null;

  return (
    <div style={{ ...card(isLight), borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Boxes size={15} color={gold} />
        <span style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em",
          textTransform: "uppercase", color: gold,
        }}>
          Equipamentos no local
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario }}>
          {itens.length} {itens.length === 1 ? "item" : "itens"} · do patrimônio do QAP
        </span>
        {itens.length > 8 && (
          <div style={{ position: "relative", marginLeft: "auto", minWidth: 180 }}>
            <Search size={13} color={c.textoSecundario} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar equipamento…"
              aria-label="Buscar equipamento no local"
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

      {filtrados.length === 0 ? (
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario }}>
          Nenhum equipamento com “{busca}”.
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtrados.map((i, idx) => (
            <div
              key={i.id}
              style={{
                display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
                padding: "9px 0",
                borderTop: idx === 0 ? "none" : `1px solid ${c.divisoria}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: c.texto }}>
                  {i.catalogo?.nome ?? "Equipamento"}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario, marginTop: 1 }}>
                  {[i.catalogo?.modelo, i.catalogo?.fabricante, i.catalogo?.almoxarifado].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {/* R197: identificação pode faltar — e o espaço dela existe */}
                <div style={{
                  fontFamily: i.identificacao ? "ui-monospace, Menlo, monospace" : FONT,
                  fontSize: 11.5, fontWeight: 600,
                  color: i.identificacao ? c.texto : c.textoSecundario,
                }}>
                  {i.identificacao ?? "sem identificação"}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>
                  {dataCurta(i.enviado_em)}
                  {!i.cliente_sistema_id && " · sem bloco"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
