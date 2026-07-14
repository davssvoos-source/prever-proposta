import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Pencil, Building2, User, Bot, Eye, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { codigoFromDbRow } from "@/lib/blocos";
import { computeAutoItemsForBloco } from "@/features/orcamento/blockAutoItems";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/")({
  component: OrcamentoPasso1,
});

const PORTARIA_OPCOES = [
  { label: "Portaria Presencial", Icon: User },
  { label: "Portaria Remota", Icon: Building2 },
  { label: "Portaria Autônoma", Icon: Bot },
];

const SISTEMA_PROPOSTO_OPCOES = [
  { val: "PP" as const, label: "Portaria Presencial", Icon: User },
  { val: "PR" as const, label: "Portaria Remota", Icon: Building2 },
  { val: "PA" as const, label: "Portaria Autônoma", Icon: Bot },
];

// Residência/Galpão: 1ª tela alternativa — só o serviço proposto
const SERVICO_SIMPLES_OPCOES = [
  { val: "monitoramento_24h" as const, label: "Monitoramento 24h", Icon: Eye },
  { val: "implantacao_sistema" as const, label: "Implantação de Sistema", Icon: Wrench },
];

function OrcamentoPasso1() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visita_orcamentos")
        .select("*")
        .eq("visita_id", id)
        .maybeSingle();
      return data;
    },
  });

  // Serviços ofertados pelo admin (para default de PR/PP) + tipo de local (define o fluxo)
  const { data: visita } = useQuery({
    queryKey: ["visita_servicos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("servicos_ofertados, tipo_local")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  // Residência/Galpão: sem qtd de apartamentos, sistema ou airbnb — só serviço proposto
  const tipoLocal = (visita as any)?.tipo_local as string | null | undefined;
  const fluxoSimples = tipoLocal === "residencia" || tipoLocal === "empresa";

  const [qtd, setQtd] = useState<number | "">("");
  const [sistema, setSistema] = useState("");
  const [sistemaProposto, setSistemaProposto] = useState<"PR" | "PP" | "PA" | "">("");
  const [airbnb, setAirbnb] = useState<string>("");
  const [servicoSimples, setServicoSimples] = useState<"monitoramento_24h" | "implantacao_sistema" | "">("");
  const [ready, setReady] = useState(false);
  const [erroVisible, setErroVisible] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    if (orcamento !== undefined && visita !== undefined) {
      setQtd((orcamento as any)?.qtd_apartamentos ?? "");
      setSistema((orcamento as any)?.sistema_atual ?? "");
      const salvo = (orcamento as any)?.sistema_proposto as "PR" | "PP" | "PA" | null | undefined;
      if (salvo === "PR" || salvo === "PP" || salvo === "PA") {
        setSistemaProposto(salvo);
      } else {
        // pré-preenche pelo que o admin cadastrou na criação
        const svc: string[] = ((visita as any)?.servicos_ofertados ?? []) as string[];
        const isRemota = Array.isArray(svc) && svc.some((s) =>
          /portaria_remota|portaria_virtual|monitoramento/i.test(String(s)),
        );
        setSistemaProposto(isRemota ? "PR" : "PP");
      }
      setAirbnb((orcamento as any)?.airbnb ?? "");
      const svcSalvo = (orcamento as any)?.servico_proposto;
      if (svcSalvo === "monitoramento_24h" || svcSalvo === "implantacao_sistema") {
        setServicoSimples(svcSalvo);
      }
      setReady(true);
    }
  }, [orcamento, visita, ready]);

  // Residência/Galpão: salva só o serviço proposto e segue para as categorias
  const saveServicoMutation = useMutation({
    mutationFn: async () => {
      if (!servicoSimples) throw new Error("Selecione o SERVIÇO PROPOSTO.");
      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          servico_proposto: servicoSimples,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "visita_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setErroVisible(null);
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      window.location.href = `/visita/${id}/orcamento/categorias`;
    },
    onError: (e: Error) => {
      setErroVisible(e.message);
      toast.error(e.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!qtd || Number(qtd) <= 0) throw new Error("Informe a quantidade de apartamentos.");
      if (sistemaProposto !== "PR" && sistemaProposto !== "PP" && sistemaProposto !== "PA") {
        throw new Error("Selecione o SISTEMA PROPOSTO.");
      }

      const anterior = (orcamento as any)?.sistema_proposto as "PR" | "PP" | "PA" | null | undefined;

      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          qtd_apartamentos: Number(qtd),
          sistema_atual: sistema,
          sistema_proposto: sistemaProposto,
          airbnb: airbnb || null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "visita_id" },
      );
      if (error) throw error;

      // Se mudou PR↔PP (ou primeira definição diferente do default), regenera códigos dos blocos existentes
      if (anterior && anterior !== sistemaProposto) {
        const { data: blocos } = await supabase
          .from("visita_blocos" as any)
          .select("*")
          .eq("visita_id", id);
        for (const row of ((blocos as any[]) ?? [])) {
          const novo = codigoFromDbRow(row, sistemaProposto);
          if (novo !== row.codigo_bloco) {
            await supabase
              .from("visita_blocos" as any)
              .update({ codigo_bloco: novo })
              .eq("id", row.id);
            // limpa itens auto (recalcula ao reabrir o editor)
            await supabase
              .from("visita_bloco_itens" as any)
              .delete()
              .eq("visita_bloco_id", row.id)
              .eq("origem", "auto");
          }
        }
      }

      // Gestão idempotente do bloco "Central de Portaria Remota" (CENT-PR)
      if (sistemaProposto === "PR") {
        // Garante 1 bloco CENT (idempotente — índice único no banco previne duplicata)
        const { data: existente } = await supabase
          .from("visita_blocos" as any)
          .select("id")
          .eq("visita_id", id)
          .eq("tipo_bloco", "CENT")
          .maybeSingle();
        if (!existente) {
          const { data: novo, error: insErr } = await supabase
            .from("visita_blocos" as any)
            .insert({
              visita_id: id,
              codigo_bloco: "CENT-PR",
              nome_descritivo: "Central de Portaria Remota",
              tipo_bloco: "CENT",
              eclusa: false,
              hh_padrao: 10,
              quantidade: 1,
              ordem: 999,
            })
            .select("id")
            .single();
          // Ignora violação de unicidade (23505) — outro save concorrente já criou
          if (insErr && (insErr as any).code !== "23505") throw insErr;
          const novoId = (novo as any)?.id as string | undefined;
          if (novoId) {
            // Semeia a lista COMPLETA da Central de Portaria Remota (fonte única: computeCentral).
            // Antes seedava só EQ028 (item errado), o que ainda bloqueava o BlocoItensEditor
            // de semear a lista real — por isso o resumo mostrava um único item incorreto.
            const itensCent = computeAutoItemsForBloco({
              codigo: "CENT-PR",
              tipoBloco: "CENT" as any,
            }).filter((it) => it.qtd > 0);
            if (itensCent.length > 0) {
              await supabase.from("visita_bloco_itens" as any).insert(
                itensCent.map((it) => ({
                  visita_bloco_id: novoId,
                  cod_eq: it.cod_eq,
                  qtd: it.qtd,
                  origem: "auto",
                  observacao: it.observacao ?? null,
                })),
              );
            }
          }

        }
      } else if (anterior === "PR") {
        // Remover CENT criado automaticamente ao trocar para Presencial/Autônoma
        const { data: cent } = await supabase
          .from("visita_blocos" as any)
          .select("id, fotos_urls")
          .eq("visita_id", id)
          .eq("tipo_bloco", "CENT")
          .maybeSingle();
        if (cent) {
          // Verifica edições manuais (itens manuais ou fotos)
          const { count: manualCount } = await supabase
            .from("visita_bloco_itens" as any)
            .select("id", { count: "exact", head: true })
            .eq("visita_bloco_id", (cent as any).id)
            .eq("origem", "manual");
          const temFotos = Array.isArray((cent as any).fotos_urls) && (cent as any).fotos_urls.length > 0;
          const temEdicoes = (manualCount ?? 0) > 0 || temFotos;
          const ok = !temEdicoes || window.confirm(
            "A Central de Portaria Remota possui edições manuais. Deseja remover mesmo assim?"
          );
          if (ok) {
            await supabase.from("visita_blocos" as any).delete().eq("id", (cent as any).id);
          }
        }
      }

    },
    onSuccess: () => {
      setErroVisible(null);
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      window.location.href = `/visita/${id}/orcamento/categorias`;
    },
    onError: (e: Error) => {
      setErroVisible(e.message);
      toast.error(e.message);
    },
  });

  const CARD: React.CSSProperties = isLight
    ? {
        background: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 18,
        padding: "18px 16px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      }
    : {
        background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
        padding: "18px 16px",
      };

  const LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,192,0,0.65)",
    marginBottom: 10,
  };

  const sliderValue = Math.min(Number(qtd) || 0, 100);
  const inputMax = 100;

  const HEADER_BTN: React.CSSProperties = {
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: isLight ? "#0a0b0e" : "#fff",
    boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
  };
  const TITULO: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    fontSize: 18,
    color: isLight ? "#0a0b0e" : "#fff",
    letterSpacing: "0.02em",
  };
  const CTA: React.CSSProperties = {
    width: "100%",
    height: 56,
    borderRadius: 28,
    background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
    border: "none",
    color: "#08090E",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
  };

  // Aguarda saber o tipo de local para decidir qual 1ª tela mostrar
  if (visita === undefined) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
        Carregando…
      </div>
    );
  }

  // ── Residência / Galpão: 1ª tela simplificada (só SERVIÇO PROPOSTO) ────────
  if (fluxoSimples) {
    return (
      <div style={{ padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate({ to: "/visita/$id", params: { id } })} style={HEADER_BTN}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={TITULO}>Proposta</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[true, false, false].map((active, i) => (
              <div
                key={i}
                style={{
                  width: 20,
                  height: 4,
                  borderRadius: 2,
                  background: active
                    ? isLight ? "#b87800" : "#FFC000"
                    : isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Serviço proposto */}
        <div style={CARD}>
          <div style={LABEL}>Serviço proposto</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SERVICO_SIMPLES_OPCOES.map(({ val, label, Icon }) => {
              const selected = servicoSimples === val;
              return (
                <button
                  key={val}
                  onClick={() => setServicoSimples(val)}
                  style={{
                    height: 60,
                    borderRadius: 14,
                    border: selected
                      ? "none"
                      : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
                    background: selected
                      ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                      : isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                    color: selected ? "#08090E" : isLight ? "#0a0b0e" : "#fff",
                    boxShadow: selected ? "0 6px 20px rgba(255,192,0,0.35)" : undefined,
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {erroVisible && (
          <p style={{ color: "#ff4d4f", fontFamily: "'Montserrat', sans-serif", fontSize: 12, textAlign: "center", marginBottom: 8 }}>
            {erroVisible}
          </p>
        )}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => saveServicoMutation.mutate()}
            disabled={saveServicoMutation.isPending}
            style={{ ...CTA, opacity: saveServicoMutation.isPending ? 0.7 : 1 }}
          >
            {saveServicoMutation.isPending ? "Salvando..." : "Próxima etapa"}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 14px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id", params: { id } })}
          style={{
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: isLight ? "#0a0b0e" : "#fff",
            boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
              fontSize: 18,
              color: isLight ? "#0a0b0e" : "#fff",
              letterSpacing: "0.02em",
            }}
          >
            Estrutura
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[true, false, false].map((active, i) => (
            <div
              key={i}
              style={{
                width: 20,
                height: 4,
                borderRadius: 2,
                background: active
                  ? isLight ? "#b87800" : "#FFC000"
                  : isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Qtd Apartamentos */}
      <div style={CARD}>
        <div style={LABEL}>Quantidade de apartamentos</div>
        {/* Número editável acima da barra */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, gap: 6 }}>
          <input
            type="number"
            min={0}
            value={qtd === "" ? 0 : qtd}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              setQtd(v);
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: isLight ? "#0a0b0e" : "#FFFFFF",
              fontWeight: 700,
              fontSize: 36,
              textAlign: "center",
              width: 120,
              fontFamily: "'Montserrat', sans-serif",
              appearance: "none",
              MozAppearance: "textfield",
            }}
          />
          <Pencil size={14} style={{ opacity: 0.3, color: isLight ? "#0a0b0e" : "#FFFFFF", flexShrink: 0 }} />
        </div>
        {/* Barra slider customizada */}
        <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.18)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              height: 4,
              borderRadius: 2,
              width: `${(sliderValue / inputMax) * 100}%`,
              background: isLight
                ? "linear-gradient(90deg, #b87800, #d49a00)"
                : "linear-gradient(90deg, #FFC000, #FFD84D)",
              transition: "width 0.05s",
            }}
          />
          <input
            type="range"
            min={0}
            max={inputMax}
            step={1}
            value={sliderValue}
            onChange={(e) => setQtd(Number(e.target.value))}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              width: "100%",
              opacity: 0,
              height: 28,
              cursor: "pointer",
              zIndex: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${(sliderValue / inputMax) * 100}% - 11px)`,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: isLight ? "#ffffff" : "#FFFFFF",
              boxShadow: isLight
                ? "0 1px 6px rgba(0,0,0,0.18)"
                : "0 0 10px rgba(255,255,255,0.70), 0 0 20px rgba(255,255,255,0.30)",
              pointerEvents: "none",
              zIndex: 1,
              transition: "left 0.05s",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.4)" }}>0</span>
          <span style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.4)" }}>100+</span>
        </div>
      </div>

      {/* Sistema Atual */}
      <div style={CARD}>
        <div style={LABEL}>Sistema atual do condomínio</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {PORTARIA_OPCOES.map(({ label, Icon }) => {
            const selected = sistema === label;
            return (
              <button
                key={label}
                onClick={() => setSistema(label)}
                style={{
                  height: 68,
                  borderRadius: 12,
                  border: isLight
                    ? selected ? "none" : "1px solid rgba(0,0,0,0.12)"
                    : selected ? "none" : "1px solid rgba(255,255,255,0.12)",
                  background: selected
                    ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                    : (isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)"),
                  color: selected ? "#08090E" : (isLight ? "#0a0b0e" : "#fff"),
                  boxShadow: selected ? "0 6px 20px rgba(255,192,0,0.35)" : undefined,
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 4px",
                  lineHeight: 1.15,
                  textAlign: "center",
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sistema Proposto (PR/PP/PA) */}
      <div style={CARD}>
        <div style={LABEL}>Sistema proposto</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {SISTEMA_PROPOSTO_OPCOES.map(({ val, label, Icon }) => {
            const selected = sistemaProposto === val;
            return (
              <button
                key={val}
                onClick={() => setSistemaProposto(val)}
                style={{
                  height: 68,
                  borderRadius: 12,
                  border: isLight
                    ? selected ? "none" : "1px solid rgba(0,0,0,0.12)"
                    : selected ? "none" : "1px solid rgba(255,255,255,0.12)",
                  background: selected
                    ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                    : (isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)"),
                  color: selected ? "#08090E" : (isLight ? "#0a0b0e" : "#fff"),
                  boxShadow: selected ? "0 6px 20px rgba(255,192,0,0.35)" : undefined,
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 4px",
                  lineHeight: 1.15,
                  textAlign: "center",
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>


      {/* Airbnb */}
      <div style={CARD}>
        <div style={LABEL}>O condomínio possui Airbnb?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {["Não", "Pouco", "Razoável", "Muito"].map((opt) => {
            const selected = airbnb === opt;
            return (
              <button
                key={opt}
                onClick={() => setAirbnb(opt)}
                style={{
                  height: 44,
                  borderRadius: 12,
                  border: isLight
                    ? selected
                      ? "none"
                      : "1px solid rgba(0,0,0,0.12)"
                    : selected
                      ? "none"
                      : "1px solid rgba(255,255,255,0.12)",
                  background: selected
                    ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                    : isLight
                      ? "#f5f6f8"
                      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                  color: selected ? "#08090E" : isLight ? "#0a0b0e" : "#fff",
                  boxShadow: selected ? "0 6px 20px rgba(255,192,0,0.35)" : undefined,
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão próxima etapa */}
      {erroVisible && (
        <p style={{ color: '#ff4d4f', fontFamily: "'Montserrat', sans-serif", fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
          {erroVisible}
        </p>
      )}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 28,
            background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
            border: "none",
            color: isLight ? "#ffffff" : "#08090E",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: isLight
              ? "0 4px 16px rgba(180,120,0,0.30)"
              : "0 4px 24px rgba(255,192,0,0.35)",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? "Salvando..." : "Próxima etapa"}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
