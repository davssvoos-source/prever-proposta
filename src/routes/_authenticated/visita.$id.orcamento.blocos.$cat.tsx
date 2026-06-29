import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LABELS,
  OPCOES,
  type BlocoConfig,
  type BarreiraConfig,
  type TipoBloco,
  gerarCodigoBloco,
  gerarDescricaoBloco,
  CAT_SLUG_TO_TIPO,
  CAT_NOMES,
} from "@/lib/blocos";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/blocos/$cat")({
  component: BlocosWizardPage,
});

// ─── Tipos internos do wizard ─────────────────────────────────────────────────

type WizardStep =
  | "eclusa"
  | "b1_tipo" | "b1_entrada" | "b1_saida" | "b1_material" | "b1_abertura" | "b1_folhas"
  | "b2_tipo" | "b2_entrada" | "b2_saida" | "b2_material" | "b2_abertura" | "b2_folhas"
  | "tecnologia"
  | "resumo";

interface WizardState {
  step: WizardStep;
  eclusa: boolean;
  b1: Partial<BarreiraConfig>;
  b2: Partial<BarreiraConfig>;
  tecnologia: string | null;
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  padding: "12px 14px 120px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  fontFamily: "'Montserrat', sans-serif",
  color: "#fff",
};

const BACK_BTN_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#fff",
};

// ─── Componente principal ─────────────────────────────────────────────────────

function BlocosWizardPage() {
  const { id: visitaId, cat: catSlug } = Route.useParams();
  const cat: TipoBloco = CAT_SLUG_TO_TIPO[catSlug] ?? "PED";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: blocosAdicionados = [], isLoading } = useQuery({
    queryKey: ["visita_blocos", visitaId, cat],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("*")
        .eq("visita_id", visitaId)
        .eq("tipo_bloco", cat)
        .order("ordem");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const [wizard, setWizard] = useState<WizardState | null>(null);

  const salvarBlocoMutation = useMutation({
    mutationFn: async (config: BlocoConfig) => {
      const codigo = gerarCodigoBloco(config);
      const nome = gerarDescricaoBloco(config);
      const { error } = await supabase.from("visita_blocos" as any).insert({
        visita_id: visitaId,
        codigo_bloco: codigo,
        nome_descritivo: nome,
        tipo_bloco: config.tipoBloco,
        qtd_barreiras: ["CFTV", "AL", "CER", "CENT"].includes(config.tipoBloco)
          ? null
          : config.eclusa ? "2B" : "1B",
        eclusa: config.eclusa,
        b1_tipo: config.b1?.tipo ?? null,
        b1_entrada: config.b1?.entrada ?? null,
        b1_saida: config.b1?.saida ?? null,
        b1_material: config.b1?.material ?? null,
        b1_abertura: config.b1?.abertura ?? null,
        b1_folhas: config.b1?.folhas ?? null,
        b2_tipo: config.b2?.tipo ?? null,
        b2_entrada: config.b2?.entrada ?? null,
        b2_saida: config.b2?.saida ?? null,
        b2_material: config.b2?.material ?? null,
        b2_abertura: config.b2?.abertura ?? null,
        b2_folhas: config.b2?.folhas ?? null,
        tecnologia: config.tecnologia ?? null,
        hh_padrao: 10,
        quantidade: 1,
        ordem: blocosAdicionados.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      setWizard(null);
    },
  });

  const removerBlocoMutation = useMutation({
    mutationFn: async (blocoId: string) => {
      const { error } = await supabase.from("visita_blocos" as any).delete().eq("id", blocoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
    },
  });

  function iniciarWizard() {
    const primeiroStep: WizardStep =
      cat === "CFTV" || cat === "AL" ? "tecnologia" :
      cat === "CER" ? "resumo" :
      "eclusa";
    setWizard({
      step: primeiroStep,
      eclusa: false,
      b1: {},
      b2: {},
      tecnologia: null,
    });
  }

  function selecionar(valor: string) {
    if (!wizard) return;
    const w: WizardState = {
      ...wizard,
      b1: { ...wizard.b1 },
      b2: { ...wizard.b2 },
    };

    switch (w.step) {
      case "eclusa":
        w.eclusa = valor === "SIM";
        w.step = "b1_tipo";
        break;

      case "b1_tipo":
        w.b1 = { tipo: valor };
        w.step = "b1_entrada";
        break;
      case "b1_entrada":
        w.b1.entrada = valor;
        w.step = "b1_saida";
        break;
      case "b1_saida":
        w.b1.saida = valor;
        if (w.b1.tipo === "PORP") w.step = "b1_material";
        else if (w.b1.tipo === "PORV") w.step = "b1_abertura";
        else w.step = w.eclusa ? "b2_tipo" : "resumo";
        break;
      case "b1_material":
        w.b1.material = valor;
        w.step = "b1_abertura";
        break;
      case "b1_abertura":
        w.b1.abertura = valor;
        if (w.b1.tipo === "PORP") {
          w.step = w.eclusa ? "b2_tipo" : "resumo";
        } else if (w.b1.tipo === "PORV") {
          if (valor === "PIVO") {
            w.step = "b1_folhas";
          } else {
            w.b1.folhas = "1F";
            w.step = w.eclusa ? "b2_tipo" : "resumo";
          }
        }
        break;
      case "b1_folhas":
        w.b1.folhas = valor;
        w.step = w.eclusa ? "b2_tipo" : "resumo";
        break;

      case "b2_tipo":
        w.b2 = { tipo: valor };
        w.step = "b2_entrada";
        break;
      case "b2_entrada":
        w.b2.entrada = valor;
        w.step = "b2_saida";
        break;
      case "b2_saida":
        w.b2.saida = valor;
        if (w.b2.tipo === "PORP") w.step = "b2_material";
        else if (w.b2.tipo === "PORV") w.step = "b2_abertura";
        else w.step = "resumo";
        break;
      case "b2_material":
        w.b2.material = valor;
        w.step = "b2_abertura";
        break;
      case "b2_abertura":
        w.b2.abertura = valor;
        if (w.b2.tipo === "PORP") {
          w.step = "resumo";
        } else if (w.b2.tipo === "PORV") {
          if (valor === "PIVO") {
            w.step = "b2_folhas";
          } else {
            w.b2.folhas = "1F";
            w.step = "resumo";
          }
        }
        break;
      case "b2_folhas":
        w.b2.folhas = valor;
        w.step = "resumo";
        break;

      case "tecnologia":
        w.tecnologia = valor;
        w.step = "resumo";
        break;
    }
    setWizard(w);
  }

  function voltarPasso() {
    if (!wizard) return;
    const w = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };
    const step = w.step;

    if (step === "eclusa" || step === "tecnologia") { setWizard(null); return; }
    if (step === "b1_tipo") { w.step = "eclusa"; setWizard(w); return; }
    if (step === "b1_entrada") { w.step = "b1_tipo"; setWizard(w); return; }
    if (step === "b1_saida") { w.step = "b1_entrada"; setWizard(w); return; }
    if (step === "b1_material") { w.step = "b1_saida"; setWizard(w); return; }
    if (step === "b1_abertura") {
      w.step = w.b1.tipo === "PORP" ? "b1_material" : "b1_saida"; setWizard(w); return;
    }
    if (step === "b1_folhas") { w.step = "b1_abertura"; setWizard(w); return; }
    if (step === "b2_tipo") {
      if (w.b1.tipo === "PORP") w.step = "b1_abertura";
      else if (w.b1.tipo === "PORV") w.step = w.b1.folhas ? "b1_folhas" : "b1_abertura";
      else w.step = "b1_saida";
      setWizard(w); return;
    }
    if (step === "b2_entrada") { w.step = "b2_tipo"; setWizard(w); return; }
    if (step === "b2_saida") { w.step = "b2_entrada"; setWizard(w); return; }
    if (step === "b2_material") { w.step = "b2_saida"; setWizard(w); return; }
    if (step === "b2_abertura") {
      w.step = w.b2.tipo === "PORP" ? "b2_material" : "b2_saida"; setWizard(w); return;
    }
    if (step === "b2_folhas") { w.step = "b2_abertura"; setWizard(w); return; }
    if (step === "resumo") {
      if (cat === "CFTV" || cat === "AL") { w.step = "tecnologia"; setWizard(w); return; }
      if (cat === "CER") { setWizard(null); return; }
      const lastB = w.eclusa ? w.b2 : w.b1;
      const prefix = w.eclusa ? "b2" : "b1";
      if (lastB.tipo === "PORP") w.step = `${prefix}_abertura` as WizardStep;
      else if (lastB.tipo === "PORV") {
        w.step = lastB.abertura === "PIVO"
          ? (`${prefix}_folhas` as WizardStep)
          : (`${prefix}_abertura` as WizardStep);
      } else {
        w.step = `${prefix}_saida` as WizardStep;
      }
      setWizard(w);
    }
  }

  function buildConfig(): BlocoConfig {
    return {
      tipoBloco: cat,
      eclusa: wizard?.eclusa ?? false,
      b1: wizard?.b1 as BarreiraConfig,
      b2: wizard?.eclusa ? (wizard?.b2 as BarreiraConfig) : undefined,
      tecnologia: wizard?.tecnologia ?? undefined,
    };
  }

  function getOpcoes(): { valor: string; label: string; descricao?: string }[] {
    if (!wizard) return [];
    const { step, b1, b2 } = wizard;

    switch (step) {
      case "eclusa":
        return [
          { valor: "NAO", label: "Não", descricao: "Acesso simples — 1 barreira" },
          { valor: "SIM", label: "Sim", descricao: "Eclusa — 2 barreiras em sequência" },
        ];
      case "b1_tipo":
      case "b2_tipo":
        if (cat === "PED") return [
          { valor: "CAT", label: "Catraca", descricao: "Barreira giratória para pedestres" },
          { valor: "PORP", label: "Porta de Pedestres", descricao: "Porta com controle de acesso" },
        ];
        if (cat === "VEI") return [
          { valor: "CAN", label: "Cancela", descricao: "Barra articulada de passagem rápida" },
          { valor: "PORV", label: "Portão Veicular", descricao: "Portão completo para veículos" },
        ];
        return [];
      case "b1_entrada":
      case "b2_entrada": {
        const tipo = (step === "b1_entrada" ? b1.tipo : b2.tipo) as string | undefined;
        const lista =
          tipo === "CAT" ? OPCOES.entradaCat :
          tipo === "PORP" ? OPCOES.entradaPorp :
          tipo === "CAN" ? OPCOES.entradaCan :
          tipo === "PORV" ? OPCOES.entradaPorv : [];
        return (lista as readonly string[]).map(v => ({ valor: v, label: LABELS[v] }));
      }
      case "b1_saida":
      case "b2_saida": {
        const tipo = (step === "b1_saida" ? b1.tipo : b2.tipo) as string | undefined;
        const lista =
          tipo === "CAT" ? OPCOES.saidaCat :
          tipo === "PORP" ? OPCOES.saidaPorp :
          tipo === "CAN" ? OPCOES.saidaCan :
          tipo === "PORV" ? OPCOES.saidaPorv : [];
        return (lista as readonly string[]).map(v => ({ valor: v, label: LABELS[v] }));
      }
      case "b1_material":
      case "b2_material":
        return OPCOES.materialPorp.map(v => ({ valor: v, label: LABELS[v] }));
      case "b1_abertura":
      case "b2_abertura": {
        const b = step === "b1_abertura" ? b1 : b2;
        if (b.tipo === "PORP") {
          const lista = b.material === "VID" ? OPCOES.aberturaVid : OPCOES.aberturaMet;
          return (lista as readonly string[]).map(v => ({ valor: v, label: LABELS[v] }));
        }
        if (b.tipo === "PORV") return OPCOES.aberturaVei.map(v => ({
          valor: v,
          label: LABELS[v],
          descricao:
            v === "BASC" ? "Sempre 1 folha" :
            v === "DESL" ? "Sempre 1 folha" :
            "Pode ser 1 ou 2 folhas",
        }));
        return [];
      }
      case "b1_folhas":
      case "b2_folhas":
        return OPCOES.folhasPivo.map(v => ({ valor: v, label: LABELS[v] }));
      case "tecnologia":
        if (cat === "CFTV") return OPCOES.tecCftv.map(v => ({ valor: v, label: LABELS[v] }));
        if (cat === "AL") return OPCOES.tecAl.map(v => ({ valor: v, label: LABELS[v] }));
        return [];
      default:
        return [];
    }
  }

  function getLabelPergunta(): string {
    if (!wizard) return "";
    const barrNr = wizard.step.startsWith("b2") ? " — BARREIRA 2" :
                   wizard.step.startsWith("b1") ? " — BARREIRA 1" : "";
    switch (wizard.step) {
      case "eclusa": return "É UMA ECLUSA?";
      case "b1_tipo":
      case "b2_tipo": return `TIPO DE BARREIRA?${barrNr}`;
      case "b1_entrada":
      case "b2_entrada": return `DISPOSITIVO DE ENTRADA?${barrNr}`;
      case "b1_saida":
      case "b2_saida": return `DISPOSITIVO DE SAÍDA?${barrNr}`;
      case "b1_material":
      case "b2_material": return `TIPO DE MATERIAL?${barrNr}`;
      case "b1_abertura":
      case "b2_abertura": return `TIPO DE ABERTURA?${barrNr}`;
      case "b1_folhas":
      case "b2_folhas": return `QUANTIDADE DE FOLHAS?${barrNr}`;
      case "tecnologia": return cat === "CFTV" ? "TIPO DE TECNOLOGIA?" : "TIPO DE SISTEMA?";
      default: return "";
    }
  }

  // ─── Render: Wizard ──────────────────────────────────────────────────────
  if (wizard) {
    const config = buildConfig();

    // Tela RESUMO
    if (wizard.step === "resumo") {
      const codigo = gerarCodigoBloco(config);
      const descricao = gerarDescricaoBloco(config);
      return (
        <div style={PAGE_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={voltarPasso} style={BACK_BTN_STYLE}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              {CAT_NOMES[cat]} › Configuração concluída
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,215,0,0.06)",
              border: "1px solid rgba(255,215,0,0.30)",
              borderRadius: 18,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={22} color="#FFD700" />
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: "#FFD700" }}>
                BLOCO IDENTIFICADO
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{CAT_NOMES[cat]}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
              {descricao}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
              {codigo}
            </div>
          </div>

          <button
            onClick={() => salvarBlocoMutation.mutate(config)}
            disabled={salvarBlocoMutation.isPending}
            style={{
              width: "100%",
              padding: "18px 0",
              background: "linear-gradient(135deg, #B8860B, #FFD700)",
              border: "none",
              borderRadius: 16,
              color: "#000",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: 1.2,
            }}
          >
            {salvarBlocoMutation.isPending ? "ADICIONANDO..." : "ADICIONAR BLOCO"}
          </button>
        </div>
      );
    }

    // Telas de pergunta
    const opcoes = getOpcoes();
    return (
      <div style={PAGE_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={voltarPasso} style={BACK_BTN_STYLE}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{CAT_NOMES[cat]}</div>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: "#FFD700", letterSpacing: 1, marginTop: 6 }}>
          {getLabelPergunta()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opcoes.map(op => (
            <button
              key={op.valor}
              onClick={() => selecionar(op.valor)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,215,0,0.18)",
                borderRadius: 14,
                padding: "18px 20px",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 500 }}>{op.label}</div>
              {op.descricao && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{op.descricao}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Lista de blocos da categoria ───────────────────────────────
  return (
    <div style={PAGE_STYLE}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } })}
          style={BACK_BTN_STYLE}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Configurar blocos</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{CAT_NOMES[cat]}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {isLoading ? (
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>Carregando...</div>
        ) : blocosAdicionados.length === 0 ? (
          <div
            style={{
              border: "1px dashed rgba(255,255,255,0.15)",
              borderRadius: 14,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              Nenhum bloco adicionado ainda.
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
              Toque em "Adicionar bloco" para configurar.
            </div>
          </div>
        ) : (
          blocosAdicionados.map((bloco: any) => (
            <div
              key={bloco.id}
              style={{
                background: "rgba(8,8,12,0.35)",
                border: "1px solid rgba(255,215,0,0.15)",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} color="#22C55E" />
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 }}>
                    {bloco.eclusa ? "Eclusa" : bloco.qtd_barreiras ? "Barreira Única" : "Sistema"}
                    {bloco.b1_tipo ? ` — ${LABELS[bloco.b1_tipo] ?? bloco.b1_tipo}` : ""}
                    {bloco.tecnologia ? ` — ${LABELS[bloco.tecnologia] ?? bloco.tecnologia}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "#fff", lineHeight: 1.4 }}>
                  {bloco.nome_descritivo}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  HH: {bloco.hh_padrao}h
                </div>
              </div>
              <button
                onClick={() => removerBlocoMutation.mutate(bloco.id)}
                disabled={removerBlocoMutation.isPending}
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  color: "#EF4444",
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Trash2 size={12} /> Remover
              </button>
            </div>
          ))
        )}
      </div>

      <button
        onClick={iniciarWizard}
        style={{
          width: "100%",
          padding: "18px 0",
          background: "linear-gradient(135deg, #B8860B, #FFD700)",
          border: "none",
          borderRadius: 16,
          color: "#000",
          fontSize: 15,
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: 1.2,
          marginTop: 8,
        }}
      >
        + ADICIONAR BLOCO
      </button>
    </div>
  );
}
