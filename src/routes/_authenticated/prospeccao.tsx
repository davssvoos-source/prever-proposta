// Prospecção — os prédios que orçamos e que ainda não são clientes (R22).
//
// Por que esta tela existe: cliente passou a ser espelho do QAP (R21), e
// "prospecto" não é cliente — é prédio que recebeu proposta e não fechou. Isso
// vivia misturado na lista de Clientes, com o filtro "Prospectos"; o Davi
// mandou separar para guardar a informação, que hoje se perderia no dia em que
// o Sincronizar passasse por cima.
//
// O que a tela mostra, por linha: o prédio, a situação no funil e o HISTÓRICO
// das propostas. As propostas não são tabela nova — são as visitas técnicas da
// prospecção, com as colunas `proposta_*` que a U8 já criou.
//
// Proposta para cliente EXISTENTE (ampliação, R23) NÃO aparece aqui: aquela
// fica vinculada ao cliente, e o aditivo mora no ERP.

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { Building2, MapPin, Search, Users, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import {
  useProspeccoes,
  usePropostasPorProspeccao,
  resumoDaProposta,
  SITUACAO_PROSPECCAO_LABEL,
  SITUACAO_PROSPECCAO_CORES,
  type SituacaoProspeccao,
} from "@/features/prospeccao/data";

export const Route = createFileRoute("/_authenticated/prospeccao")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { ok } = await guardaDeTela("prospeccao");
    if (!ok) throw redirect({ to: destinoNegado("prospeccao") as any });
  },
  component: ProspeccaoPage,
});

type Filtro = "todos" | SituacaoProspeccao;

function ProspeccaoPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: prospeccoes = [], isLoading } = useProspeccoes();
  const { data: propostas = {} } = usePropostasPorProspeccao();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const norm = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const lista = useMemo(() => {
    const termo = norm(busca.trim());
    return prospeccoes.filter((p) => {
      if (filtro !== "todos" && p.situacao !== filtro) return false;
      if (!termo) return true;
      return norm(`${p.nome} ${p.endereco ?? ""} ${p.cidade ?? ""} ${p.nome_sindico ?? ""}`)
        .includes(termo);
    });
  }, [prospeccoes, busca, filtro]);

  const contagem = useMemo(() => ({
    todos: prospeccoes.length,
    em_prospeccao: prospeccoes.filter((p) => p.situacao === "em_prospeccao").length,
    ganha: prospeccoes.filter((p) => p.situacao === "ganha").length,
    perdida: prospeccoes.filter((p) => p.situacao === "perdida").length,
  }), [prospeccoes]);

  const chipFiltro = (ativo: boolean): CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo
      ? `linear-gradient(135deg, #FCDE48, #F8C811, #E8B00A)`
      : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  });

  return (
    <div className="sangra-x" style={{ paddingTop: 18, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, letterSpacing: "-0.01em" }}>
            Prospecção
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
            Prédios e locais que orçamos — ainda não são clientes
          </div>
        </div>
      </div>

      {/* A distinção que a tela precisa deixar clara logo de cara, porque ela
          é a razão de a tela existir. */}
      <div style={{
        ...card(isLight), borderRadius: 16, padding: "12px 14px",
        border: `1px solid ${PRISMA.azulClaro.border}`,
        background: PRISMA.azulClaro.bg,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <FileText size={17} color={isLight ? PRISMA.azulClaro.light : PRISMA.azulClaro.dark} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12.5, lineHeight: 1.5, color: textPrimary }}>
          Prospecção não é cliente. Quem vira cliente entra pelo <strong>QAP</strong>, e
          aparece em Clientes depois do Sincronizar.
          <br />
          <span style={{ color: textSecondary, fontSize: 11.5 }}>
            Proposta para cliente que já temos (ampliação) fica no cadastro dele, não aqui.
          </span>
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="trilho-x" style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
          {([
            ["todos", `Todas · ${contagem.todos}`],
            ["em_prospeccao", `Em prospecção · ${contagem.em_prospeccao}`],
            ["ganha", `Ganhas · ${contagem.ganha}`],
            ["perdida", `Perdidas · ${contagem.perdida}`],
          ] as [Filtro, string][]).map(([valor, rotulo]) => (
            <button key={valor} style={chipFiltro(filtro === valor)} onClick={() => setFiltro(valor)}>
              {rotulo}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: "min(320px, 100%)" }}>
          <Search size={15} color={textSecondary}
            style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar prédio, endereço, síndico…"
            style={{
              width: "100%", boxSizing: "border-box", height: 42, borderRadius: 999,
              padding: "0 14px 0 36px",
              background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
              border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
              color: textPrimary, fontFamily: FONT, fontWeight: 400, fontSize: 13,
              outline: "none", colorScheme: isLight ? "light" : "dark",
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ ...card(isLight), borderRadius: 16, padding: "28px 16px", textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Carregando prospecções…
        </div>
      ) : lista.length === 0 ? (
        <div style={{ ...card(isLight), borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <Building2 size={28} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
            {prospeccoes.length === 0 ? "Nenhuma prospecção registrada" : "Nada encontrado"}
          </span>
          <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, textAlign: "center" }}>
            {prospeccoes.length === 0
              ? "A prospecção nasce quando se monta uma visita técnica para um prédio que ainda não é cliente."
              : "Ajuste a busca ou o filtro."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((p) => {
            const cor = SITUACAO_PROSPECCAO_CORES[p.situacao] ?? SITUACAO_PROSPECCAO_CORES.em_prospeccao;
            const doPredio = propostas[p.id] ?? [];
            const ultima = doPredio[0];
            return (
              <div key={p.id} className="elevavel" style={{
                ...card(isLight), borderRadius: 16, padding: "12px 14px",
                display: "flex", gap: 11, alignItems: "flex-start",
              }}>
                <span aria-hidden style={{
                  width: 10, height: 10, borderRadius: 6, flexShrink: 0, marginTop: 5,
                  background: isLight ? cor.light : cor.dark,
                  boxShadow: `0 0 8px ${isLight ? cor.light : cor.dark}66`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14 }}>{p.nome}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, background: cor.bg,
                      color: isLight ? cor.light : cor.dark,
                      fontFamily: FONT, fontWeight: 700, fontSize: 9,
                      letterSpacing: "0.07em", textTransform: "uppercase",
                    }}>
                      {SITUACAO_PROSPECCAO_LABEL[p.situacao] ?? p.situacao}
                    </span>
                    {p.cidade && p.cidade !== "São Paulo" && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 999,
                        background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                        fontFamily: FONT, fontWeight: 600, fontSize: 9,
                        letterSpacing: "0.07em", textTransform: "uppercase", color: textSecondary,
                      }}>
                        {p.cidade}
                      </span>
                    )}
                  </div>

                  {p.endereco && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                      <MapPin size={12} color={textSecondary} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {p.endereco}
                      </span>
                    </div>
                  )}

                  {/* O histórico — a razão de o Davi ter pedido a tela:
                      "informações sobre as propostas geradas, tudo registrado". */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <FileText size={12} color={textSecondary} style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 11.5, color: textSecondary }}>
                      {doPredio.length === 0
                        ? "nenhuma proposta gerada"
                        : `${doPredio.length} proposta${doPredio.length > 1 ? "s" : ""} · ${resumoDaProposta(ultima)}`}
                    </span>
                  </div>

                  {doPredio.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                      {doPredio.slice(0, 4).map((v) => (
                        <button
                          key={v.id}
                          onClick={() => navigate({ to: "/visita/$id", params: { id: v.id } })}
                          className="hover-suave"
                          style={{
                            padding: "3px 9px", borderRadius: 999, border: "none",
                            background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                            fontFamily: FONT, fontWeight: 500, fontSize: 10.5,
                            color: textSecondary, cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(v.created_at).toLocaleDateString("pt-BR")}
                          {v.proposta_resultado === "aceita" ? " · aceita"
                            : v.proposta_resultado === "recusada" ? " · recusada"
                            : v.proposta_enviada_em ? " · enviada" : ""}
                        </button>
                      ))}
                      {doPredio.length > 4 && (
                        <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, alignSelf: "center" }}>
                          +{doPredio.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {p.nome_sindico && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                      <Users size={11} color={textSecondary} />
                      <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
                        {p.nome_sindico}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
