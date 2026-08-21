// Consolidação assistida do cadastro de clientes — Etapa 1 do sistema de OS.
// Antes desta etapa o app criava um cliente novo a cada visita (com o nome do
// síndico e sem endereço). Aqui as visitas são agrupadas por prédio para o
// gestor revisar e consolidar um cliente por local. Nada é fundido sem clique.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, CheckCircle2, MapPin, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela } from "@/features/gerencial/permissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import {
  useGruposConsolidacao,
  useClientesOrfaos,
  consolidarGrupo,
  descartarCliente,
  SITUACAO_LABEL,
  type GrupoConsolidacao,
} from "@/features/clientes/data";

export const Route = createFileRoute("/_authenticated/clientes/migrar")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    // a matriz manda, não uma lista de cargos escrita na mão: a U24 liberou
    // Clientes para o SAC e a lista hardcoded o barrava em silêncio
    const { ok } = await guardaDeTela("clientes.migrar");
    if (!ok) throw redirect({ to: "/clientes" });
  },
  component: MigrarClientesPage,
});

function MigrarClientesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: grupos = [], isLoading } = useGruposConsolidacao();
  const { data: orfaos = [] } = useClientesOrfaos();
  const [processando, setProcessando] = useState<string | null>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const verde = isLight ? "#047862" : "#2DD2A5";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SEC_LABEL: CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ["clientes-consolidacao"] });
    qc.invalidateQueries({ queryKey: ["clientes-orfaos"] });
    qc.invalidateQueries({ queryKey: ["clientes"] });
    qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
    qc.invalidateQueries({ queryKey: ["cliente-visitas"] });
  };

  const consolidar = useMutation({
    mutationFn: (g: GrupoConsolidacao) => consolidarGrupo(g),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Cliente consolidado!");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setProcessando(null),
  });

  const descartar = useMutation({
    mutationFn: (id: string) => descartarCliente(id),
    onSuccess: () => {
      invalidarTudo();
      toast.success("Cadastro vazio descartado.");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setProcessando(null),
  });

  const pendentes = grupos.filter((g) => !g.jaConsolidado);
  const prontos = grupos.filter((g) => g.jaConsolidado);
  const nada = grupos.length === 0 && orfaos.length === 0;

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/clientes" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18 }}>
            Consolidar clientes
          </div>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            {pendentes.length} local{pendentes.length === 1 ? "" : "is"} a revisar
            {orfaos.length > 0 && ` · ${orfaos.length} cadastro${orfaos.length === 1 ? "" : "s"} vazio${orfaos.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {/* Explicação */}
      <div style={{ ...CARD, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Wand2 size={18} color={gold} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
          Cada grupo abaixo reúne as visitas de um mesmo prédio. Ao consolidar, os dados da visita mais
          recente formam o cadastro do cliente, todas as visitas do grupo passam a apontar para ele e os
          cadastros duplicados que ficarem sem uso são removidos. Revise o nome e o endereço antes —
          depois de consolidar, ajustes são feitos na ficha do cliente.
        </span>
      </div>

      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: "var(--fonte)", fontSize: 13 }}>
          Analisando visitas…
        </div>
      ) : nada ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <Building2 size={28} color={gold} />
          <span style={{ fontFamily: "var(--fonte)", fontSize: 14, fontWeight: 600 }}>
            Nenhuma visita para consolidar
          </span>
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, textAlign: "center" }}>
            Cadastre os clientes diretamente pela lista.
          </span>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <>
              <span style={SEC_LABEL}>A revisar</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendentes.map((g) => (
                  <div key={g.chave} style={CARD}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Building2 size={18} color={gold} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 14 }}>
                          {g.nome || "(sem nome)"}
                        </div>
                        {g.endereco && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                            <MapPin size={12} color={textSecondary} style={{ flexShrink: 0 }} />
                            <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                              {g.endereco}
                            </span>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                            {g.visitaIds.length} visita{g.visitaIds.length === 1 ? "" : "s"}
                          </span>
                          {g.clienteIds.length > 1 && (
                            <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: isLight ? "#A63E17" : "#F8C811" }}>
                              {g.clienteIds.length} cadastros duplicados
                            </span>
                          )}
                          {g.tipoLocal && (
                            <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                              {TIPO_LABEL[g.tipoLocal] ?? g.tipoLocal}
                            </span>
                          )}
                          <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                            será {SITUACAO_LABEL[g.situacaoSugerida].toLowerCase()}
                          </span>
                        </div>
                        {g.nomeSindico && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                            <Users size={11} color={textSecondary} style={{ flexShrink: 0 }} />
                            <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                              {g.nomeSindico}
                              {g.telefoneSindico ? ` · ${g.telefoneSindico}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setProcessando(g.chave);
                        consolidar.mutate(g);
                      }}
                      disabled={processando !== null}
                      style={{
                        width: "100%", height: 44, marginTop: 12, borderRadius: 22, border: "none",
                        background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                        color: "#08090E",
                        fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 12,
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        cursor: processando ? "wait" : "pointer",
                        opacity: processando !== null && processando !== g.chave ? 0.5 : 1,
                      }}
                    >
                      {processando === g.chave ? "Consolidando…" : "Consolidar este cliente"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {orfaos.length > 0 && (
            <>
              <span style={{ ...SEC_LABEL, marginTop: 6 }}>Cadastros vazios</span>
              <div style={{ ...CARD, padding: "12px 14px" }}>
                <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                  Sem endereço e sem nenhuma visita — sobraram do modelo antigo e podem ser descartados.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orfaos.map((o) => (
                  <div key={o.id} style={{ ...CARD, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    <Building2 size={16} color={textSecondary} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--fonte)", fontSize: 13 }}>
                      {o.nome}
                    </span>
                    <button
                      onClick={() => {
                        setProcessando(o.id);
                        descartar.mutate(o.id);
                      }}
                      disabled={processando !== null}
                      style={{
                        height: 34, padding: "0 12px", borderRadius: 10, flexShrink: 0,
                        background: isLight ? "#ffffff" : "#191921",
                        border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                        color: isLight ? "#B1242E" : "#F17881",
                        cursor: processando ? "wait" : "pointer",
                        fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 600,
                        opacity: processando !== null && processando !== o.id ? 0.5 : 1,
                      }}
                    >
                      {processando === o.id ? "Descartando…" : "Descartar"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {prontos.length > 0 && (
            <>
              <span style={{ ...SEC_LABEL, marginTop: 6 }}>Já consolidados</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prontos.map((g) => (
                  <div key={g.chave} style={{ ...CARD, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    <CheckCircle2 size={16} color={verde} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--fonte)", fontSize: 13 }}>
                      {g.nome}
                    </span>
                    <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary, flexShrink: 0 }}>
                      {g.visitaIds.length} visita{g.visitaIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
