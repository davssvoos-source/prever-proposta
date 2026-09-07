// EQUIPAMENTOS CADASTRADOS — o catálogo do sistema (R198, U109).
//
// Davi, 04/09/2026: "Crie uma tela com 'Equipamentos cadastrados' contendo
// todas as variações de modelos de equipamentos que foram cadastrados nessa
// rodada de acesso ao QAP, e aí essa tela será o nosso catalogo, pois nela
// iremos inserir valores, que será o passo que faremos em seguida."
//
// Uma linha por VARIAÇÃO — almoxarifado + nome + modelo + fabricante (R196) —,
// com a contagem de itens físicos que existem dela. Não é a lista de
// equipamentos: essa mora na ficha de cada cliente.
//
// A COLUNA DE VALOR NÃO EXISTE AINDA, e é de propósito. Valor tem regra nesta
// casa (R13: o SAC não vê dinheiro; R164: valor é de admin e comercial) e a
// RLS do Postgres tranca LINHA, não COLUNA — uma coluna de preço na tabela que
// o técnico precisa ler vazaria preço. O valor entra na próxima migration, em
// tabela própria atrás de `pode_ver_financeiro`, e ganha uma coluna aqui.
//
// A TELA "CATÁLOGO" (/admin) SAIU (R198, pedido do Davi): a rota redireciona
// para cá. Com ela saíram as abas de Blocos e Serviços de referência — os
// blocos já viviam no banco (R166) e os serviços passam a ser editados por
// SQL até esta tela ganhar a seção deles.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useMemo, useState, type CSSProperties } from "react";
import { Boxes, Package, Search, TriangleAlert } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { normalizarTexto } from "@/lib/normalizar";
import { useCatalogoDoPatrimonio, useTotaisDoPatrimonio, type VariacaoDoCatalogo } from "@/features/equipamentos/data";

export const Route = createFileRoute("/_authenticated/equipamentos")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("equipamentos");
    if (!ok) throw redirect({ to: destinoNegado("equipamentos") as any });
  },
  component: EquipamentosPage,
});

function EquipamentosPage() {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const [busca, setBusca] = useState("");

  const { data: catalogo, isLoading, isError } = useCatalogoDoPatrimonio();
  const { data: totais } = useTotaisDoPatrimonio();

  const variacoes = catalogo?.variacoes ?? [];
  const faltaMigration = catalogo?.faltaMigration ?? false;

  const filtradas = useMemo(() => {
    const termo = normalizarTexto(busca);
    if (!termo) return variacoes;
    return variacoes.filter((v) =>
      normalizarTexto(`${v.almoxarifado} ${v.nome} ${v.modelo ?? ""} ${v.fabricante ?? ""}`).includes(termo),
    );
  }, [variacoes, busca]);

  /** agrupado por almoxarifado — é como o QAP organiza, e como se procura */
  const grupos = useMemo(() => {
    const m = new Map<string, VariacaoDoCatalogo[]>();
    for (const v of filtradas) {
      const arr = m.get(v.almoxarifado) ?? [];
      arr.push(v);
      m.set(v.almoxarifado, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [filtradas]);

  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };
  const numero = (rotulo: string, valor: number | string) => (
    <div key={rotulo} style={{ ...card(isLight), borderRadius: 16, padding: "14px 12px", minWidth: 0, textAlign: "center" }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: c.texto, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {valor}
      </div>
      <div style={{
        fontFamily: FONT, fontWeight: 600, fontSize: 9, letterSpacing: "0.05em",
        textTransform: "uppercase", color: c.textoSecundario, marginTop: 6, lineHeight: 1.3,
      }}>
        {rotulo}
      </div>
    </div>
  );

  return (
    <div className="sangra-x" style={{ paddingTop: 14, paddingBottom: 40, color: c.texto, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <Boxes size={20} color={gold} style={{ marginTop: 3, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>
            Equipamentos cadastrados
          </h1>
          <div style={{ fontFamily: FONT, fontSize: 12, color: c.textoSecundario, marginTop: 2 }}>
            O catálogo: uma linha por variação de equipamento — almoxarifado, nome, modelo e fabricante.
            Os equipamentos de cada prédio ficam na ficha do cliente.
          </div>
        </div>
      </div>

      {/* os números — o retrato do que foi importado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {numero("Variações no catálogo", variacoes.length)}
        {numero("Itens no patrimônio", totais?.itens ?? 0)}
        {numero("Sem identificação", totais?.semIdentificacao ?? 0)}
        {numero("Sem local vinculado", totais?.semVinculo ?? 0)}
      </div>

      <div style={{ position: "relative", maxWidth: 420 }}>
        <Search size={15} color={c.textoSecundario} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, modelo, fabricante…"
          aria-label="Buscar no catálogo de equipamentos"
          style={{
            width: "100%", boxSizing: "border-box", minHeight: 40,
            padding: "0 12px 0 34px", borderRadius: 12,
            background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
            fontFamily: FONT, fontWeight: 400, fontSize: 13.5, outline: "none",
          }}
        />
      </div>

      {/* R166/U109: a tela diz a verdade sobre o que ainda não existe */}
      {faltaMigration && (
        <div style={{ ...card(isLight), borderRadius: 16, padding: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <TriangleAlert size={16} color={gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: c.texto, lineHeight: 1.55 }}>
            A estrutura do patrimônio ainda não existe no banco. Rode a migration{" "}
            <strong>U109</strong> (<code>20260918090000_u109_patrimonio_do_qap.sql</code>) no SQL Editor do
            Supabase; os equipamentos do QAP entram depois, pela <strong>U110</strong>.
          </div>
        </div>
      )}

      {isError && !faltaMigration && (
        <div style={{ ...card(isLight), borderRadius: 16, padding: 16, fontFamily: FONT, fontSize: 12.5, color: c.texto }}>
          Não deu para ler o catálogo agora. Recarregue a página; se insistir, o código do erro aparece no
          rodapé do app.
        </div>
      )}

      {isLoading ? (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario }}>Carregando o catálogo…</div>
      ) : !faltaMigration && variacoes.length === 0 ? (
        <div style={{ ...card(isLight), borderRadius: 16, padding: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Package size={18} color={c.textoSecundario} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario, lineHeight: 1.55 }}>
            Nenhuma variação cadastrada ainda. O catálogo nasce da importação do QAP
            (Patrimônio &gt; Local/Uso): cada combinação de almoxarifado, nome, modelo e fabricante
            entra aqui uma vez, e os itens físicos vão para a ficha de cada cliente.
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: c.textoSecundario }}>
          Nada no catálogo com “{busca}”.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {grupos.map(([almoxarifado, itens]) => (
            <section key={almoxarifado} aria-labelledby={`almox-${normalizarTexto(almoxarifado).replace(/\s/g, "-")}`}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 8px 2px" }}>
                <h2 id={`almox-${normalizarTexto(almoxarifado).replace(/\s/g, "-")}`} style={MICRO}>
                  {almoxarifado}
                </h2>
                <span style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>
                  {itens.length} variaç{itens.length === 1 ? "ão" : "ões"}
                </span>
              </div>
              <div style={{ ...card(isLight), borderRadius: 16, overflow: "hidden" }}>
                {itens.map((v, i) => (
                  <div
                    key={v.id}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
                      padding: "11px 14px",
                      borderTop: i === 0 ? "none" : `1px solid ${c.divisoria}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: c.texto }}>
                        {v.nome}
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario, marginTop: 1 }}>
                        {[v.modelo, v.fabricante].filter(Boolean).join(" · ") || "sem modelo nem fabricante"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: c.texto, fontVariantNumeric: "tabular-nums" }}>
                        {v.quantidade}
                      </div>
                      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: c.textoSecundario }}>
                        {v.quantidade === 1 ? "item" : "itens"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
