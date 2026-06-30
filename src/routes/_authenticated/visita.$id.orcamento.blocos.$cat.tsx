import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Trash2, Camera, Image as ImageIcon, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
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

// ─── Tipos internos do wizard ────────────────────────────────────────────────

type WizardStep =
  | "eclusa"
  | "b1_tipo" | "b1_entrada" | "b1_saida" | "b1_material" | "b1_motor" | "b1_abertura" | "b1_folhas"
  | "b2_tipo" | "b2_entrada" | "b2_saida" | "b2_material" | "b2_motor" | "b2_abertura" | "b2_folhas"
  | "tecnologia"
  | "resumo";

interface WizardState {
  step: WizardStep;
  eclusa: boolean | null;
  b1: Partial<BarreiraConfig>;
  b2: Partial<BarreiraConfig>;
  tecnologia: string | null;
}

// ─── Estilos compartilhados ──────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  padding: "12px 14px 120px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  color: "#fff",
};

const HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
};

const BACK_BTN: React.CSSProperties = {
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

const QUESTION: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: "0.06em",
  color: "rgba(255,255,255,0.85)",
  textTransform: "uppercase",
  margin: "4px 2px 8px",
};

function optionStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,215,0,0.18)",
    borderRadius: 14,
    padding: "16px 18px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    color: "#fff",
  };
}

// ─── Steps por barreira ─────────────────────────────────────────────────────
const B1_STEPS: WizardStep[] = ["b1_tipo", "b1_entrada", "b1_saida", "b1_material", "b1_motor", "b1_abertura", "b1_folhas"];
const B2_STEPS: WizardStep[] = ["b2_tipo", "b2_entrada", "b2_saida", "b2_material", "b2_motor", "b2_abertura", "b2_folhas"];

function BarreiraIndicador({ numero }: { numero: "01" | "02" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid #FFD700",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#FFD700", fontSize: 14, fontWeight: 800 }}>{numero}</span>
      </div>
      <span style={{ color: "#FFD700", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
        {numero === "01" ? "BARREIRA 1" : "BARREIRA 2"}
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function proximoAposBarreira(prefix: "b1" | "b2", eclusa: boolean | null): WizardStep {
  if (prefix === "b1" && eclusa) return "b2_tipo";
  return "resumo";
}

// ─── Componente ──────────────────────────────────────────────────────────────

function BlocosWizardPage() {
  const { id: visitaId, cat: catSlug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tipoBloco = (CAT_SLUG_TO_TIPO[catSlug] ?? "PED") as TipoBloco;
  const catNome = CAT_NOMES[tipoBloco] ?? catSlug;

  // ── Blocos já adicionados ───────────────────────────────────────────────
  const { data: blocosAdicionados = [], isLoading } = useQuery({
    queryKey: ["visita_blocos", visitaId, tipoBloco],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("*")
        .eq("visita_id", visitaId)
        .eq("tipo_bloco", tipoBloco)
        .order("ordem");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // ── Estado do wizard ────────────────────────────────────────────────────
  const [wizard, setWizard] = useState<WizardState | null>(null);

  // ── Estado de fotos (tela de resumo) ────────────────────────────────────
  const [fotos, setFotos] = useState<{ localUrl: string; file: File }[]>([]);
  const [showOpcoes, setShowOpcoes] = useState(false);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);

  function handleArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const novas = files.map((file) => ({ file, localUrl: URL.createObjectURL(file) }));
    setFotos((prev) => [...prev, ...novas]);
    setShowOpcoes(false);
    e.target.value = "";
  }
  function removerFoto(index: number) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Salvar bloco ────────────────────────────────────────────────────────
  const salvarMutation = useMutation({
    mutationFn: async (config: BlocoConfig) => {
      // Upload das fotos
      const fotosUrls: string[] = [];
      for (const foto of fotos) {
        const ext = foto.file.name.split(".").pop() || "jpg";
        const path = `${visitaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("blocos-fotos")
          .upload(path, foto.file, { contentType: foto.file.type });
        if (!uploadError) {
          fotosUrls.push(path);
        }
      }

      const { error } = await supabase.from("visita_blocos" as any).insert({
        visita_id: visitaId,
        codigo_bloco: gerarCodigoBloco(config),
        nome_descritivo: gerarDescricaoBloco(config),
        tipo_bloco: config.tipoBloco,
        qtd_barreiras: ["CFTV", "AL", "CER"].includes(config.tipoBloco)
          ? null
          : config.eclusa
            ? "2B"
            : "1B",
        eclusa: config.eclusa,
        b1_tipo: config.b1?.tipo ?? null,
        b1_entrada: config.b1?.entrada ?? null,
        b1_saida: config.b1?.saida ?? null,
        b1_material: config.b1?.material ?? null,
        b1_motor: config.b1?.motor ?? null,
        b1_abertura: config.b1?.abertura ?? null,
        b1_folhas: config.b1?.folhas ?? null,
        b2_tipo: config.b2?.tipo ?? null,
        b2_entrada: config.b2?.entrada ?? null,
        b2_saida: config.b2?.saida ?? null,
        b2_material: config.b2?.material ?? null,
        b2_motor: config.b2?.motor ?? null,
        b2_abertura: config.b2?.abertura ?? null,
        b2_folhas: config.b2?.folhas ?? null,
        tecnologia: config.tecnologia ?? null,
        hh_padrao: 10,
        quantidade: 1,
        ordem: blocosAdicionados.length,
        fotos_urls: fotosUrls,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      toast.success("Bloco adicionado");
      setFotos([]);
      setWizard(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar bloco"),
  });

  // ── Remover bloco ───────────────────────────────────────────────────────
  const removerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visita_blocos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
    },
  });

  // ── Iniciar wizard ──────────────────────────────────────────────────────
  function iniciarWizard() {
    const primeiroStep: WizardStep =
      tipoBloco === "CFTV" || tipoBloco === "AL"
        ? "tecnologia"
        : tipoBloco === "CER"
          ? "resumo"
          : "eclusa";
    setWizard({
      step: primeiroStep,
      eclusa: tipoBloco === "CER" ? false : null,
      b1: {},
      b2: {},
      tecnologia: null,
    });
  }

  // Auto-iniciar wizard quando não há blocos
  useEffect(() => {
    if (!isLoading && blocosAdicionados.length === 0 && !wizard) {
      iniciarWizard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, blocosAdicionados.length]);

  // Scroll suave ao revelar nova pergunta
  const bottomRef = useRef<HTMLDivElement>(null);
  const b2Ref = useRef<HTMLDivElement>(null);
  const [b1Collapsed, setB1Collapsed] = useState(false);
  useEffect(() => {
    if (wizard) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [wizard?.step]);

  // ── Edit step inline (toque em resposta confirmada) ─────────────────────
  const B1_ORDER: WizardStep[] = ["b1_tipo", "b1_entrada", "b1_saida", "b1_material", "b1_motor", "b1_abertura", "b1_folhas"];
  const B2_ORDER: WizardStep[] = ["b2_tipo", "b2_entrada", "b2_saida", "b2_material", "b2_motor", "b2_abertura", "b2_folhas"];

  function limparStep(step: WizardStep, w: WizardState) {
    switch (step) {
      case "b1_tipo":     w.b1.tipo     = undefined; break;
      case "b1_entrada":  w.b1.entrada  = undefined; break;
      case "b1_saida":    w.b1.saida    = undefined; break;
      case "b1_material": w.b1.material = undefined; break;
      case "b1_motor":    w.b1.motor    = undefined; break;
      case "b1_abertura": w.b1.abertura = undefined; break;
      case "b1_folhas":   w.b1.folhas   = undefined; break;
      case "b2_tipo":     w.b2.tipo     = undefined; break;
      case "b2_entrada":  w.b2.entrada  = undefined; break;
      case "b2_saida":    w.b2.saida    = undefined; break;
      case "b2_material": w.b2.material = undefined; break;
      case "b2_motor":    w.b2.motor    = undefined; break;
      case "b2_abertura": w.b2.abertura = undefined; break;
      case "b2_folhas":   w.b2.folhas   = undefined; break;
    }
  }

  function handleEditStep(step: WizardStep) {
    if (!wizard) return;
    const w: WizardState = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };
    if (B1_ORDER.includes(step)) {
      const idx = B1_ORDER.indexOf(step);
      B1_ORDER.slice(idx + 1).forEach((s) => limparStep(s, w));
      B2_ORDER.forEach((s) => limparStep(s, w));
      setB1Collapsed(false);
      w.step = step;
    } else if (B2_ORDER.includes(step)) {
      const idx = B2_ORDER.indexOf(step);
      B2_ORDER.slice(idx + 1).forEach((s) => limparStep(s, w));
      w.step = step;
    }
    setWizard(w);
  }



  // ── Selecionar opção ────────────────────────────────────────────────────
  function selecionar(valor: string) {
    if (!wizard) return;
    const w: WizardState = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };

    switch (w.step) {
      case "eclusa":
        w.eclusa = valor === "SIM";
        w.step = "b1_tipo";
        break;

      // ── B1 ─────────────────────────────────────────────────────────────
      case "b1_tipo":
        w.b1 = { tipo: valor } as Partial<BarreiraConfig>;
        w.step = "b1_entrada";
        break;
      case "b1_entrada":
        w.b1.entrada = valor;
        w.step = "b1_saida";
        break;
      case "b1_saida":
        w.b1.saida = valor;
        if (w.b1.tipo === "PORP") w.step = "b1_material";
        else if (w.b1.tipo === "PORV") w.step = "b1_motor";
        else w.step = proximoAposBarreira("b1", w.eclusa);
        break;
      case "b1_material":
        w.b1.material = valor;
        if (valor === "VID") w.step = "b1_abertura";
        else w.step = "b1_motor";
        break;
      case "b1_motor":
        w.b1.motor = valor === "SIM";
        if (tipoBloco === "PED") {
          if (valor === "SIM") {
            w.b1.abertura = "MOT";
            w.step = proximoAposBarreira("b1", w.eclusa);
          } else {
            w.step = "b1_abertura";
          }
        } else {
          if (valor === "SIM") {
            w.step = "b1_abertura";
          } else {
            w.b1.abertura = undefined;
            w.b1.folhas = undefined;
            w.step = proximoAposBarreira("b1", w.eclusa);
          }
        }
        break;
      case "b1_abertura":
        w.b1.abertura = valor;
        if (w.b1.tipo === "PORV") {
          if (valor === "PIVO") w.step = "b1_folhas";
          else {
            w.b1.folhas = "1F";
            w.step = proximoAposBarreira("b1", w.eclusa);
          }
        } else {
          w.step = proximoAposBarreira("b1", w.eclusa);
        }
        break;
      case "b1_folhas":
        w.b1.folhas = valor;
        w.step = proximoAposBarreira("b1", w.eclusa);
        break;

      // ── B2 ─────────────────────────────────────────────────────────────
      case "b2_tipo":
        w.b2 = { tipo: valor } as Partial<BarreiraConfig>;
        w.step = "b2_entrada";
        break;
      case "b2_entrada":
        w.b2.entrada = valor;
        w.step = "b2_saida";
        break;
      case "b2_saida":
        w.b2.saida = valor;
        if (w.b2.tipo === "PORP") w.step = "b2_material";
        else if (w.b2.tipo === "PORV") w.step = "b2_motor";
        else w.step = "resumo";
        break;
      case "b2_material":
        w.b2.material = valor;
        w.step = valor === "VID" ? "b2_abertura" : "b2_motor";
        break;
      case "b2_motor":
        w.b2.motor = valor === "SIM";
        if (tipoBloco === "PED") {
          if (valor === "SIM") {
            w.b2.abertura = "MOT";
            w.step = "resumo";
          } else {
            w.step = "b2_abertura";
          }
        } else {
          if (valor === "SIM") {
            w.step = "b2_abertura";
          } else {
            w.b2.abertura = undefined;
            w.b2.folhas = undefined;
            w.step = "resumo";
          }
        }
        break;
      case "b2_abertura":
        w.b2.abertura = valor;
        if (w.b2.tipo === "PORV") {
          if (valor === "PIVO") w.step = "b2_folhas";
          else {
            w.b2.folhas = "1F";
            w.step = "resumo";
          }
        } else {
          w.step = "resumo";
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

    const crossingBarreira =
      (wizard.step.startsWith("b1") && (w.step === "b2_tipo" || w.step === "resumo")) ||
      (wizard.step.startsWith("b2") && w.step === "resumo");
    if (crossingBarreira) {
      setTimeout(() => setWizard(w), 400);
    } else {
      setWizard(w);
    }
  }

  // ── Voltar passo ────────────────────────────────────────────────────────
  function voltarPasso() {
    if (!wizard) {
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
      return;
    }
    const w: WizardState = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };
    const s = w.step;

    if (s === "eclusa" || s === "tecnologia") {
      setWizard(null);
      return;
    }
    if (s === "resumo" && tipoBloco === "CER") {
      setWizard(null);
      return;
    }

    if (s === "b1_tipo") { w.step = "eclusa"; setWizard(w); return; }
    if (s === "b1_entrada") { w.step = "b1_tipo"; setWizard(w); return; }
    if (s === "b1_saida") { w.step = "b1_entrada"; setWizard(w); return; }
    if (s === "b1_material") { w.step = "b1_saida"; setWizard(w); return; }
    if (s === "b1_motor") {
      w.step = tipoBloco === "PED" ? "b1_material" : "b1_saida";
      setWizard(w); return;
    }
    if (s === "b1_abertura") {
      w.step = w.b1.material === "VID" ? "b1_material" : "b1_motor";
      setWizard(w); return;
    }
    if (s === "b1_folhas") { w.step = "b1_abertura"; setWizard(w); return; }

    if (s === "b2_tipo") {
      const b1 = w.b1;
      if (b1.tipo === "CAT" || b1.tipo === "CAN") w.step = "b1_saida";
      else if (b1.tipo === "PORP") {
        if (b1.motor === true) w.step = "b1_motor";
        else w.step = "b1_abertura";
      } else if (b1.tipo === "PORV") {
        if (b1.motor === false) w.step = "b1_motor";
        else if (b1.abertura === "PIVO") w.step = "b1_folhas";
        else w.step = "b1_abertura";
      }
      setWizard(w); return;
    }
    if (s === "b2_entrada") { w.step = "b2_tipo"; setWizard(w); return; }
    if (s === "b2_saida") { w.step = "b2_entrada"; setWizard(w); return; }
    if (s === "b2_material") { w.step = "b2_saida"; setWizard(w); return; }
    if (s === "b2_motor") {
      w.step = tipoBloco === "PED" ? "b2_material" : "b2_saida";
      setWizard(w); return;
    }
    if (s === "b2_abertura") {
      w.step = w.b2.material === "VID" ? "b2_material" : "b2_motor";
      setWizard(w); return;
    }
    if (s === "b2_folhas") { w.step = "b2_abertura"; setWizard(w); return; }

    if (s === "resumo") {
      if (tipoBloco === "CFTV" || tipoBloco === "AL") { w.step = "tecnologia"; setWizard(w); return; }
      const lastB = w.eclusa ? w.b2 : w.b1;
      const prefix = (w.eclusa ? "b2" : "b1") as "b1" | "b2";
      if (lastB.tipo === "CAT" || lastB.tipo === "CAN") w.step = `${prefix}_saida` as WizardStep;
      else if (lastB.tipo === "PORP") {
        if (lastB.motor === true) w.step = `${prefix}_motor` as WizardStep;
        else w.step = `${prefix}_abertura` as WizardStep;
      } else if (lastB.tipo === "PORV") {
        if (lastB.motor === false) w.step = `${prefix}_motor` as WizardStep;
        else if (lastB.abertura === "PIVO") w.step = `${prefix}_folhas` as WizardStep;
        else w.step = `${prefix}_abertura` as WizardStep;
      }
      setWizard(w);
    }
  }

  // ── Opções do step atual ────────────────────────────────────────────────
  function getOpcoes(stepOverride?: WizardStep): { valor: string; label: string; descricao?: string }[] {
    if (!wizard) return [];
    const { b1, b2 } = wizard;
    const step = stepOverride ?? wizard.step;

    const entrada = (tipo?: string) => {
      const lista =
        tipo === "CAT" ? OPCOES.entradaCat :
        tipo === "PORP" ? OPCOES.entradaPorp :
        tipo === "CAN" ? OPCOES.entradaCan :
        tipo === "PORV" ? OPCOES.entradaPorv : [];
      return [...lista].map((v) => ({ valor: v, label: LABELS[v] }));
    };
    const saida = (tipo?: string) => {
      const lista =
        tipo === "CAT" ? OPCOES.saidaCat :
        tipo === "PORP" ? OPCOES.saidaPorp :
        tipo === "CAN" ? OPCOES.saidaCan :
        tipo === "PORV" ? OPCOES.saidaPorv : [];
      return [...lista].map((v) => ({ valor: v, label: LABELS[v] }));
    };

    switch (step) {
      case "eclusa":
        return [
          { valor: "NAO", label: "Não", descricao: "Acesso simples — 1 barreira" },
          { valor: "SIM", label: "Sim", descricao: "Eclusa — 2 barreiras em sequência" },
        ];
      case "b1_tipo":
      case "b2_tipo":
        return tipoBloco === "PED"
          ? [
              { valor: "CAT", label: "Catraca", descricao: "Barreira giratória para pedestres" },
              { valor: "PORP", label: "Porta de Pedestres", descricao: "Porta com controle de acesso" },
            ]
          : [
              { valor: "CAN", label: "Cancela", descricao: "Barra articulada de passagem rápida" },
              { valor: "PORV", label: "Portão Veicular", descricao: "Portão completo para veículos" },
            ];
      case "b1_entrada": return entrada(b1.tipo);
      case "b2_entrada": return entrada(b2.tipo);
      case "b1_saida": return saida(b1.tipo);
      case "b2_saida": return saida(b2.tipo);
      case "b1_material":
      case "b2_material":
        return [...OPCOES.materialPorp].map((v) => ({ valor: v, label: LABELS[v] }));
      case "b1_motor":
      case "b2_motor":
        return [
          { valor: "SIM", label: "Sim" },
          { valor: "NAO", label: "Não" },
        ];
      case "b1_abertura": {
        if (b1.tipo === "PORP") return [...OPCOES.aberturaSemMotor].map((v) => ({ valor: v, label: LABELS[v] }));
        if (b1.tipo === "PORV") return [...OPCOES.aberturaVei].map((v) => ({
          valor: v, label: LABELS[v],
          descricao: v === "PIVO" ? "Pode ter 1 ou 2 folhas" : "Sempre 1 folha",
        }));
        return [];
      }
      case "b2_abertura": {
        if (b2.tipo === "PORP") return [...OPCOES.aberturaSemMotor].map((v) => ({ valor: v, label: LABELS[v] }));
        if (b2.tipo === "PORV") return [...OPCOES.aberturaVei].map((v) => ({
          valor: v, label: LABELS[v],
          descricao: v === "PIVO" ? "Pode ter 1 ou 2 folhas" : "Sempre 1 folha",
        }));
        return [];
      }
      case "b1_folhas":
      case "b2_folhas":
        return [...OPCOES.folhasPivo].map((v) => ({ valor: v, label: LABELS[v] }));
      case "tecnologia":
        return tipoBloco === "CFTV"
          ? [...OPCOES.tecCftv].map((v) => ({ valor: v, label: LABELS[v] }))
          : [...OPCOES.tecAl].map((v) => ({ valor: v, label: LABELS[v] }));
      default: return [];
    }
  }

  function getLabelPergunta(stepOverride?: WizardStep): string {
    if (!wizard) return "";
    const s = stepOverride ?? wizard.step;
    if (s === "eclusa") return "É UMA ECLUSA?";
    if (s === "b1_tipo" || s === "b2_tipo") return "TIPO DE BARREIRA?";
    if (s === "b1_entrada" || s === "b2_entrada") return "ENTRADA";
    if (s === "b1_saida" || s === "b2_saida") return "SAÍDA";
    if (s === "b1_material" || s === "b2_material") return "TIPO DE MATERIAL?";
    if (s === "b1_motor" || s === "b2_motor") return "FORNECER MOTOR?";
    if (s === "b1_abertura" || s === "b2_abertura") return "TIPO DE ABERTURA?";
    if (s === "b1_folhas" || s === "b2_folhas") return "QUANTIDADE DE FOLHAS?";
    if (s === "tecnologia") return tipoBloco === "CFTV" ? "TIPO DE TECNOLOGIA?" : "TIPO DE SISTEMA?";
    return "";
  }

  function getRespostaDada(step: WizardStep): string | null {
    if (!wizard) return null;
    const w = wizard;
    const map: Partial<Record<WizardStep, string | undefined>> = {
      b1_tipo: w.b1.tipo,
      b1_entrada: w.b1.entrada,
      b1_saida: w.b1.saida,
      b1_material: w.b1.material,
      b1_motor: w.b1.motor === true ? "SIM" : w.b1.motor === false ? "NAO" : undefined,
      b1_abertura: w.b1.abertura,
      b1_folhas: w.b1.folhas,
      b2_tipo: w.b2.tipo,
      b2_entrada: w.b2.entrada,
      b2_saida: w.b2.saida,
      b2_material: w.b2.material,
      b2_motor: w.b2.motor === true ? "SIM" : w.b2.motor === false ? "NAO" : undefined,
      b2_abertura: w.b2.abertura,
      b2_folhas: w.b2.folhas,
    };
    const v = map[step];
    return v ?? null;
  }

  function buildConfig(): BlocoConfig {
    return {
      tipoBloco,
      eclusa: !!wizard?.eclusa,
      b1: wizard?.b1 as BarreiraConfig,
      b2: wizard?.eclusa ? (wizard?.b2 as BarreiraConfig) : undefined,
      tecnologia: wizard?.tecnologia ?? undefined,
    };
  }

  // ─── RENDER: Wizard ───────────────────────────────────────────────────────
  if (wizard) {
    const opcoes = getOpcoes();

    if (wizard.step === "resumo") {
      const config = buildConfig();
      const descricao = gerarDescricaoBloco(config);
      const codigo = gerarCodigoBloco(config);

      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16 }}>
                {catNome}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                Configuração concluída
              </div>
            </div>
            <CheckCircle2 size={22} color="#22C55E" />
          </div>

          <div
            style={{
              background: "rgba(255,215,0,0.06)",
              border: "1px solid rgba(255,215,0,0.25)",
              borderRadius: 16,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "rgba(255,215,0,0.7)",
                fontWeight: 700,
              }}
            >
              BLOCO IDENTIFICADO
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{catNome}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
              {descricao}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "monospace",
                fontSize: 11,
                color: "rgba(255,215,0,0.65)",
                wordBreak: "break-all",
              }}
            >
              {codigo}
            </div>
          </div>

          {/* ── SEÇÃO DE FOTOS ─────────────────────────────────────── */}
          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.18em",
                marginBottom: 10,
              }}
            >
              FOTOS DO LOCAL {fotos.length > 0 ? `(${fotos.length})` : ""}
            </div>

            {fotos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {fotos.map((foto, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={foto.localUrl}
                      alt={`Foto ${idx + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <button
                      onClick={() => removerFoto(idx)}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 24,
                        height: 24,
                        background: "rgba(0,0,0,0.7)",
                        border: "none",
                        borderRadius: "50%",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowOpcoes(true)}
              style={{
                width: "100%",
                padding: "14px 0",
                background: "transparent",
                border: "1.5px dashed rgba(255,215,0,0.4)",
                borderRadius: 14,
                color: "#FFD700",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Camera size={18} color="#FFD700" />
              {fotos.length === 0 ? "ADICIONAR FOTOS" : "ADICIONAR MAIS FOTOS"}
            </button>
          </div>

          <button
            onClick={() => salvarMutation.mutate(config)}
            disabled={salvarMutation.isPending}
            style={{
              width: "100%",
              padding: "18px 0",
              background: "linear-gradient(135deg, #FFD700, #FFB300)",
              border: "none",
              borderRadius: 16,
              color: "#0A0A0A",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              letterSpacing: 1,
            }}
          >
            {salvarMutation.isPending ? "ADICIONANDO..." : "ADICIONAR BLOCO"}
          </button>

          {/* Inputs ocultos */}
          <input
            ref={inputGaleriaRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleArquivos}
          />
          <input
            ref={inputCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleArquivos}
          />

          {/* Bottom sheet */}
          {showOpcoes && (
            <>
              <div
                onClick={() => setShowOpcoes(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }}
              />
              <div
                style={{
                  position: "fixed",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "#1C1A0F",
                  border: "1px solid rgba(255,215,0,0.2)",
                  borderRadius: "20px 20px 0 0",
                  padding: "24px 20px 40px",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 4,
                    textAlign: "center",
                  }}
                >
                  Adicionar fotos
                </div>
                <button
                  onClick={() => inputCameraRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: 16,
                    background: "rgba(255,215,0,0.08)",
                    border: "1px solid rgba(255,215,0,0.2)",
                    borderRadius: 14,
                    color: "#FFD700",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Camera size={20} color="#FFD700" />
                  Tirar foto
                </button>
                <button
                  onClick={() => inputGaleriaRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: 16,
                    background: "rgba(255,215,0,0.08)",
                    border: "1px solid rgba(255,215,0,0.2)",
                    borderRadius: 14,
                    color: "#FFD700",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <ImageIcon size={20} color="#FFD700" />
                  Escolher da galeria
                </button>
                <button
                  onClick={() => setShowOpcoes(false)}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14,
                    color: "#6B7280",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    // Telas de barreira (B1 / B2): perguntas reveladas progressivamente
    const isB1 = B1_STEPS.includes(wizard.step);
    const isB2 = B2_STEPS.includes(wizard.step);

    if (isB1 || isB2) {
      const currentSteps = isB1 ? B1_STEPS : B2_STEPS;
      const barrNum = isB1 ? "01" : "02";
      const currentIdx = currentSteps.indexOf(wizard.step);
      const stepsRespondidos = currentSteps
        .slice(0, currentIdx)
        .filter((s) => getRespostaDada(s) !== null);

      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16 }}>{catNome}</div>
          </div>

          <BarreiraIndicador numero={barrNum} />

          {stepsRespondidos.map((step) => {
            const resposta = getRespostaDada(step)!;
            const todasOpcoes = getOpcoes(step);
            const opcaoSel = todasOpcoes.find((o) => o.valor === resposta);
            return (
              <div key={step} style={{ marginBottom: 16 }}>
                <p
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 2,
                    margin: "0 0 8px",
                    textTransform: "uppercase",
                  }}
                >
                  {getLabelPergunta(step)}
                </p>
                <div
                  style={{
                    background: "rgba(255,215,0,0.08)",
                    border: "1.5px solid #FFD700",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFD700", flexShrink: 0 }} />
                  <span style={{ color: "#FFD700", fontSize: 15, fontWeight: 700 }}>
                    {opcaoSel?.label ?? resposta}
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={bottomRef}>
            <div style={QUESTION}>{getLabelPergunta()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {opcoes.map((op) => (
                <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{op.label}</span>
                  {op.descricao && (
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{op.descricao}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={PAGE}>
        <div style={HEADER}>
          <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16 }}>{catNome}</div>
        </div>

        <div style={QUESTION}>{getLabelPergunta()}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opcoes.map((op) => (
            <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{op.label}</span>
              {op.descricao && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{op.descricao}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── RENDER: Lista de blocos ──────────────────────────────────────────────
  return (
    <div style={PAGE}>
      <div style={HEADER}>
        <button
          style={BACK_BTN}
          onClick={() => navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } })}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 18 }}>
            Configurar blocos
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{catNome}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isLoading ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Carregando...</div>
        ) : blocosAdicionados.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              border: "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 14,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 4 }}>Nenhum bloco adicionado ainda.</div>
            <div style={{ fontSize: 11 }}>Toque em "Adicionar bloco" para configurar.</div>
          </div>
        ) : (
          blocosAdicionados.map((bloco: any) => (
            <div
              key={bloco.id}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,215,0,0.15)",
                borderRadius: 14,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                  {bloco.nome_descritivo}
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "rgba(255,215,0,0.55)",
                    wordBreak: "break-all",
                  }}
                >
                  {bloco.codigo_bloco}
                </div>
              </div>
              <button
                onClick={() => removerMutation.mutate(bloco.id)}
                disabled={removerMutation.isPending}
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#EF4444",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <button
        onClick={iniciarWizard}
        style={{
          marginTop: 8,
          padding: "16px 0",
          background: "linear-gradient(135deg, #FFD700, #FFB300)",
          border: "none",
          borderRadius: 14,
          color: "#0A0A0A",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: 1,
        }}
      >
        + ADICIONAR
      </button>
    </div>
  );
}
