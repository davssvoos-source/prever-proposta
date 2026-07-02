import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCircle2, Trash2, Camera, Image as ImageIcon, ChevronDown, Pencil, DoorOpen, RefreshCw, DoorClosed, Video, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
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
import { BlocoItensEditor } from "@/features/orcamento/BlocoItensEditor";


export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/blocos/$cat")({
  component: BlocosWizardPage,
});

// ─── Tipos internos do wizard ────────────────────────────────────────────────

type WizardStep =
  | "eclusa"
  | "b1_tipo" | "b1_entrada" | "b1_saida" | "b1_abertura" | "b1_folhas" | "b1_tamanho" | "b1_peso"
  | "b2_tipo" | "b2_entrada" | "b2_saida" | "b2_abertura" | "b2_folhas" | "b2_tamanho" | "b2_peso"
  | "tecnologia"
  | "cftv_qtd"
  | "cerca_perimetro" | "cerca_esquinas"
  | "resumo";

interface WizardState {
  step: WizardStep;
  eclusa: boolean | null;
  b1: Partial<BarreiraConfig>;
  b2: Partial<BarreiraConfig>;
  tecnologia: string | null;
  qtdDome: number;
  qtdBullet: number;
  perimetro: number;
  esquinas: number;
}

// ─── Light palette ───────────────────────────────────────────────────────────
const L = {
  card: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
  cardSolid: "#ffffff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderMd: "1px solid rgba(0,0,0,0.10)",
  shadow: "0 1px 6px rgba(0,0,0,0.07)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.05)",
  text: "#0a0b0e",
  textSub: "#4a5060",
  gold: "#b87800",
  goldBg: "rgba(180,120,0,0.10)",
  goldBorder: "1px solid rgba(180,120,0,0.22)",
};

// ─── Steps por barreira ─────────────────────────────────────────────────────
const B1_STEPS: WizardStep[] = ["b1_tipo", "b1_entrada", "b1_saida", "b1_abertura", "b1_folhas", "b1_tamanho", "b1_peso"];
const B2_STEPS: WizardStep[] = ["b2_tipo", "b2_entrada", "b2_saida", "b2_abertura", "b2_folhas", "b2_tamanho", "b2_peso"];

function BarreiraHeader({
  label,
  done,
  isLight,
  collapsible,
  collapsed,
  onToggle,
}: {
  label: string;
  done: boolean;
  isLight: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: collapsed ? 0 : 20, cursor: collapsible ? "pointer" : "default",
      }}
    >
      <span style={{
        display: "flex", alignItems: "center", gap: 10,
        color: done ? "#22C55E" : isLight ? L.gold : "#FFD700",
        fontSize: 13, fontWeight: 700, letterSpacing: 1,
      }}>
        <DoorOpen size={20} color={done ? "#22C55E" : "#F59E0B"} />
        {label} {done ? "✓" : ""}
      </span>
      {collapsible && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
        }}>
          <ChevronDown size={16} color={isLight ? L.text : "#FFFFFF"} />
        </div>
      )}
    </div>
  );
}


// ─── Step Indicator ────────────────────────────────────────────────────────

function getStepLabel(step: WizardStep): string {
  switch (step) {
    case "eclusa": return "Eclusa";
    case "b1_tipo": return "Tipo B1";
    case "b1_entrada": return "Entrada B1";
    case "b1_saida": return "Saída B1";
    case "b1_abertura": return "Abertura B1";
    case "b1_folhas": return "Folhas B1";
    case "b1_tamanho": return "Tamanho B1";
    case "b1_peso": return "Peso B1";
    case "b2_tipo": return "Tipo B2";
    case "b2_entrada": return "Entrada B2";
    case "b2_saida": return "Saída B2";
    case "b2_abertura": return "Abertura B2";
    case "b2_folhas": return "Folhas B2";
    case "b2_tamanho": return "Tamanho B2";
    case "b2_peso": return "Peso B2";
    case "tecnologia": return "Tecnologia";
    case "cftv_qtd": return "Qtd de câmeras";
    case "cerca_perimetro": return "Perímetro";
    case "cerca_esquinas": return "Esquinas";
    case "resumo": return "Resumo";
    default: return step;
  }
}

function barreiraSteps(b: Partial<BarreiraConfig>, prefix: "b1" | "b2", tipoBloco: TipoBloco): WizardStep[] {
  const s: WizardStep[] = [`${prefix}_tipo` as WizardStep];
  if (!b.tipo) return s;
  s.push(`${prefix}_entrada` as WizardStep, `${prefix}_saida` as WizardStep);
  if (tipoBloco === "PED" && b.tipo === "PORP") s.push(`${prefix}_abertura` as WizardStep);
  if (tipoBloco === "VEI" && b.tipo === "PORV") {
    s.push(`${prefix}_abertura` as WizardStep);
    if (b.abertura === "PIVO") s.push(`${prefix}_folhas` as WizardStep, `${prefix}_tamanho` as WizardStep);
    if (b.abertura === "BASC") s.push(`${prefix}_tamanho` as WizardStep);
    if (b.abertura === "DESL") s.push(`${prefix}_peso` as WizardStep);
  }
  return s;
}

function getStepSequence(w: WizardState, tipo: TipoBloco): WizardStep[] {
  if (tipo === "CFTV") return ["tecnologia", "cftv_qtd", "resumo"];
  if (tipo === "AL") return ["tecnologia", "resumo"];
  if (tipo === "CER") return ["cerca_perimetro", "cerca_esquinas", "resumo"];

  const steps: WizardStep[] = ["eclusa"];
  steps.push(...barreiraSteps(w.b1, "b1", tipo));
  if (w.eclusa) steps.push(...barreiraSteps(w.b2, "b2", tipo));
  steps.push("resumo");
  return steps;
}

interface StepIndicatorProps {
  steps: WizardStep[];
  currentStep: WizardStep;
  isLight: boolean;
}

function WizardStepIndicator({ steps, currentStep, isLight }: StepIndicatorProps) {
  if (!steps.length) return null;

  const currentIndex = steps.indexOf(currentStep);

  return (
    <div style={{ marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content", paddingBottom: 4 }}>
        {steps.map((step, i) => {
          const isCurrent = step === currentStep;
          const isCompleted = currentIndex > i;
          const isFuture = !isCurrent && !isCompleted;
          const isLast = i === steps.length - 1;

          const goldSolid = "#F59E0B";
          const goldText = isLight ? "#b87800" : "#FFC000";
          const futureCircleBg = isLight ? "#f0f1f4" : "rgba(255,255,255,0.06)";
          const futureBorder = isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)";
          const futureText = isLight ? "#8a909e" : "rgba(200,200,200,0.4)";
          const completedLabel = goldText;
          const currentLabel = isLight ? "#0a0b0e" : "#fff";
          const lineColor = isCompleted
            ? (isLight ? "rgba(180,120,0,0.4)" : "rgba(255,192,0,0.4)")
            : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)");

          return (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: isCurrent || isCompleted ? goldSolid : futureCircleBg,
                    border: isCurrent || isCompleted ? `1.5px solid ${goldSolid}` : futureBorder,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: isCurrent || isCompleted ? "#fff" : futureText,
                    flexShrink: 0,
                    transition: "all 0.2s ease",
                  }}
                >
                  {isCompleted ? <Check size={12} /> : (i + 1)}
                </div>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 400,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    color: isCompleted ? completedLabel : isCurrent ? currentLabel : futureText,
                    opacity: isFuture ? 0.55 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {getStepLabel(step)}
                </span>
              </div>
              {!isLast && (
                <div style={{ width: 16, height: 1, background: lineColor, flexShrink: 0, margin: "0 2px" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Macro Step Indicator (Eclusa → Externa → Interna) ─────────────────────

function MacroStepIndicator({
  step,
  tipo,
  eclusa,
  isLight,
}: {
  step: WizardStep;
  tipo: TipoBloco;
  eclusa: boolean | null;
  isLight: boolean;
}) {
  const isB1 = B1_STEPS.includes(step);
  const isB2 = B2_STEPS.includes(step);
  const isResumo = step === "resumo";
  const isEclusa = step === "eclusa";

  const externaLabel = tipo === "VEI" ? "Barreira Externa" : "Porta Externa";
  const internaLabel = tipo === "VEI" ? "Barreira Interna" : "Porta Interna";

  const macros = [
    { label: "Eclusa", current: isEclusa, completed: !isEclusa },
    { label: externaLabel, current: isB1, completed: isB2 || isResumo },
    { label: internaLabel, current: isB2, completed: isResumo && !!eclusa },
  ];

  const goldSolid = "#F59E0B";
  const goldText = isLight ? "#b87800" : "#FFC000";
  const futureCircleBg = isLight ? "#f0f1f4" : "rgba(255,255,255,0.06)";
  const futureBorder = isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)";
  const futureText = isLight ? "#8a909e" : "rgba(200,200,200,0.4)";
  const currentLabel = isLight ? "#0a0b0e" : "#fff";

  return (
    <div style={{ marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content", paddingBottom: 4 }}>
        {macros.map((m, i) => {
          const isLast = i === macros.length - 1;
          const active = m.current || m.completed;
          const lineColor = m.completed
            ? (isLight ? "rgba(180,120,0,0.4)" : "rgba(255,192,0,0.4)")
            : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)");
          return (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: active ? goldSolid : futureCircleBg,
                  border: active ? `1.5px solid ${goldSolid}` : futureBorder,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: active ? "#fff" : futureText,
                  flexShrink: 0, transition: "all 0.2s ease",
                }}>
                  {m.completed ? <Check size={12} /> : (i + 1)}
                </div>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 11, whiteSpace: "nowrap",
                  color: m.completed ? goldText : m.current ? currentLabel : futureText,
                  opacity: !active ? 0.55 : 1, transition: "all 0.2s ease",
                }}>
                  {m.label}
                </span>
              </div>
              {!isLast && (
                <div style={{ width: 16, height: 1, background: lineColor, flexShrink: 0, margin: "0 2px" }} />
              )}
            </div>
          );
        })}
      </div>
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
  const { isLight } = useTheme();
  const { id: visitaId, cat: catSlug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tipoBloco = (CAT_SLUG_TO_TIPO[catSlug] ?? "PED") as TipoBloco;
  const catNome = CAT_NOMES[tipoBloco] ?? catSlug;

  const PAGE: React.CSSProperties = {
    padding: "12px 16px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    color: isLight ? L.text : "#fff",
  };
  const HEADER: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 };
  const BACK_BTN: React.CSSProperties = {
    background: isLight ? L.cardSolid : "rgba(255,255,255,0.06)",
    border: isLight ? L.borderMd : "1px solid rgba(255,255,255,0.10)",
    boxShadow: isLight ? L.shadowSm : undefined,
    borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", color: isLight ? L.text : "#fff",
  };
  const QUESTION: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14, letterSpacing: "0.06em",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)",
    textTransform: "uppercase", margin: "4px 2px 8px",
  };

  function optionStyle(selected = false): React.CSSProperties {
    if (isLight) {
      if (selected) {
        return {
          width: "100%", background: "rgba(180,120,0,0.08)", border: "2px solid #b87800",
          boxShadow: "0 0 0 3px rgba(180,120,0,0.10)", borderRadius: 14, padding: "16px 18px",
          textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, color: L.text,
        };
      }
      return {
        width: "100%", background: L.cardSolid, border: L.borderMd, boxShadow: L.shadowSm,
        borderRadius: 14, padding: "16px 18px", textAlign: "left", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 4, color: L.text,
      };
    }
    return {
      width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.18)",
      borderRadius: 14, padding: "16px 18px", textAlign: "left", cursor: "pointer",
      display: "flex", flexDirection: "column", gap: 4, color: "#fff",
    };
  }

  const { data: orcamentoRow } = useQuery({
    queryKey: ["orcamento", visitaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("visita_orcamentos")
        .select("sistema_proposto")
        .eq("visita_id", visitaId)
        .maybeSingle();
      return data;
    },
  });
  const portaria: "PR" | "PP" =
    ((orcamentoRow as any)?.sistema_proposto === "PP") ? "PP" : "PR";

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

  const [wizard, setWizard] = useState<WizardState | null>(null);
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

  const [blocoSalvoId, setBlocoSalvoId] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState<BlocoConfig | null>(null);

  const salvarMutation = useMutation({
    mutationFn: async (config: BlocoConfig) => {
      const fotosUrls: string[] = [];
      for (const foto of fotos) {
        const ext = foto.file.name.split(".").pop() || "jpg";
        const path = `${visitaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("blocos-fotos")
          .upload(path, foto.file, { contentType: foto.file.type });
        if (!uploadError) fotosUrls.push(path);
      }

      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .insert({
          visita_id: visitaId,
          codigo_bloco: gerarCodigoBloco(config),
          nome_descritivo: gerarDescricaoBloco(config),
          tipo_bloco: config.tipoBloco,
          qtd_barreiras: ["CFTV", "AL", "CER"].includes(config.tipoBloco) ? null : config.eclusa ? "2B" : "1B",
          eclusa: config.eclusa,
          b1_tipo: config.b1?.tipo ?? null,
          b1_entrada: config.b1?.entrada ?? null,
          b1_saida: config.b1?.saida ?? null,
          b1_material: null,
          b1_motor: null,
          b1_abertura: config.b1?.abertura ?? null,
          b1_folhas: config.b1?.folhas ?? null,
          b1_tamanho: config.b1?.tamanho ?? null,
          b1_peso: config.b1?.peso ?? null,
          b2_tipo: config.b2?.tipo ?? null,
          b2_entrada: config.b2?.entrada ?? null,
          b2_saida: config.b2?.saida ?? null,
          b2_material: null,
          b2_motor: null,
          b2_abertura: config.b2?.abertura ?? null,
          b2_folhas: config.b2?.folhas ?? null,
          b2_tamanho: config.b2?.tamanho ?? null,
          b2_peso: config.b2?.peso ?? null,
          tecnologia: config.tecnologia ?? null,
          qtd_dome: config.qtdDome ?? null,
          qtd_bullet: config.qtdBullet ?? null,
          hh_padrao: 10,
          quantidade: 1,
          ordem: blocosAdicionados.length,
          fotos_urls: fotosUrls,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: (data as any).id as string, config };
    },
    onSuccess: ({ id, config }) => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      toast.success("Bloco adicionado — configure os equipamentos");
      setFotos([]);
      setBlocoSalvoId(id);
      setSavedConfig(config);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar bloco"),
  });


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

  function iniciarWizard() {
    const primeiroStep: WizardStep =
      tipoBloco === "CFTV" || tipoBloco === "AL" ? "tecnologia"
      : tipoBloco === "CER" ? "cerca_perimetro"
      : "eclusa";
    setWizard({
      step: primeiroStep,
      eclusa: tipoBloco === "CER" ? false : null,
      b1: {}, b2: {},
      tecnologia: null,
      qtdDome: 0, qtdBullet: 0,
      perimetro: 0, esquinas: 0,
    });
  }

  useEffect(() => {
    if (!isLoading && blocosAdicionados.length === 0 && !wizard) iniciarWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, blocosAdicionados.length]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const b2Ref = useRef<HTMLDivElement>(null);
  const [b1Collapsed, setB1Collapsed] = useState(false);
  useEffect(() => {
    if (wizard) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [wizard?.step]);

  const B1_ORDER: WizardStep[] = B1_STEPS;
  const B2_ORDER: WizardStep[] = B2_STEPS;

  function limparStep(step: WizardStep, w: WizardState) {
    const barreira = step.startsWith("b1") ? w.b1 : w.b2;
    const key = step.replace(/^b[12]_/, "") as keyof BarreiraConfig;
    (barreira as any)[key] = undefined;
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

  // ─── Próximo step após uma resposta de barreira ─────────────────────────
  function nextStepBarreira(prefix: "b1" | "b2", b: Partial<BarreiraConfig>, current: WizardStep, eclusa: boolean | null): WizardStep {
    const p = prefix;
    if (current === `${p}_tipo`) return `${p}_entrada` as WizardStep;
    if (current === `${p}_entrada`) return `${p}_saida` as WizardStep;
    if (current === `${p}_saida`) {
      if (tipoBloco === "PED" && b.tipo === "PORP") return `${p}_abertura` as WizardStep;
      if (tipoBloco === "VEI" && b.tipo === "PORV") return `${p}_abertura` as WizardStep;
      return proximoAposBarreira(p, eclusa);
    }
    if (current === `${p}_abertura`) {
      if (tipoBloco === "PED") return proximoAposBarreira(p, eclusa);
      if (tipoBloco === "VEI") {
        if (b.abertura === "PIVO") return `${p}_folhas` as WizardStep;
        if (b.abertura === "BASC") return `${p}_tamanho` as WizardStep;
        if (b.abertura === "DESL") return `${p}_peso` as WizardStep;
      }
      return proximoAposBarreira(p, eclusa);
    }
    if (current === `${p}_folhas`) return `${p}_tamanho` as WizardStep;
    if (current === `${p}_tamanho`) return proximoAposBarreira(p, eclusa);
    if (current === `${p}_peso`) return proximoAposBarreira(p, eclusa);
    return proximoAposBarreira(p, eclusa);
  }

  function selecionar(valor: string) {
    if (!wizard) return;
    const w: WizardState = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };
    const prev = w.step;

    if (w.step === "eclusa") { w.eclusa = valor === "SIM"; w.step = "b1_tipo"; }
    else if (w.step === "tecnologia") {
      w.tecnologia = valor;
      w.step = tipoBloco === "CFTV" ? "cftv_qtd" : "resumo";
    }
    else if (w.step.startsWith("b1_") || w.step.startsWith("b2_")) {
      const prefix = w.step.startsWith("b1_") ? "b1" : "b2";
      const barreira = prefix === "b1" ? w.b1 : w.b2;
      const key = w.step.replace(/^b[12]_/, "") as keyof BarreiraConfig;
      if (key === "tipo") {
        if (prefix === "b1") w.b1 = { tipo: valor } as Partial<BarreiraConfig>;
        else w.b2 = { tipo: valor } as Partial<BarreiraConfig>;
      } else {
        (barreira as any)[key] = valor;
      }
      w.step = nextStepBarreira(prefix as "b1"|"b2", prefix === "b1" ? w.b1 : w.b2, w.step, w.eclusa);
    }

    const crossingB1ToB2 = prev.startsWith("b1") && w.step === "b2_tipo";
    const crossingToResumo =
      (prev.startsWith("b1") && w.step === "resumo") ||
      (prev.startsWith("b2") && w.step === "resumo");

    if (crossingB1ToB2) {
      setB1Collapsed(true);
      setTimeout(() => {
        setWizard(w);
        setTimeout(() => { b2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
      }, 300);
    } else if (crossingToResumo) {
      setTimeout(() => setWizard(w), 400);
    } else {
      setWizard(w);
    }
  }

  function avancarCftvQtd() {
    if (!wizard) return;
    setWizard({ ...wizard, step: "resumo" });
  }

  function voltarPasso() {
    if (!wizard) {
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
      return;
    }
    const w: WizardState = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };
    const s = w.step;

    if (s === "eclusa" || s === "tecnologia" || s === "cerca_perimetro") { setWizard(null); return; }

    if (s === "cerca_esquinas") { w.step = "cerca_perimetro"; setWizard(w); return; }
    if (s === "resumo" && tipoBloco === "CER") { w.step = "cerca_esquinas"; setWizard(w); return; }

    if (s === "cftv_qtd") { w.step = "tecnologia"; setWizard(w); return; }

    if (s === "resumo" && tipoBloco === "CFTV") { w.step = "cftv_qtd"; setWizard(w); return; }
    if (s === "resumo" && tipoBloco === "AL") { w.step = "tecnologia"; setWizard(w); return; }

    // Barreiras: voltar step-a-step conforme sequência efetiva
    const seq = getStepSequence(w, tipoBloco);
    const idx = seq.indexOf(s);
    if (idx > 0) { w.step = seq[idx - 1]; setWizard(w); return; }
    setWizard(null);
  }

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
          { valor: "NAO", label: "Não" },
          { valor: "SIM", label: "Sim" },
        ];
      case "b1_tipo":
      case "b2_tipo":
        return tipoBloco === "PED"
          ? [{ valor: "CAT", label: "Catraca" }, { valor: "PORP", label: "Porta" }]
          : [{ valor: "CAN", label: "Cancela" }, { valor: "PORV", label: "Portão Veicular" }];
      case "b1_entrada": return entrada(b1.tipo);
      case "b2_entrada": return entrada(b2.tipo);
      case "b1_saida": return saida(b1.tipo);
      case "b2_saida": return saida(b2.tipo);
      case "b1_abertura":
      case "b2_abertura": {
        const b = step.startsWith("b1") ? b1 : b2;
        if (tipoBloco === "PED" && b.tipo === "PORP") return [...OPCOES.aberturaPed].map((v) => ({ valor: v, label: LABELS[v] }));
        if (tipoBloco === "VEI" && b.tipo === "PORV") return [...OPCOES.aberturaVei].map((v) => ({ valor: v, label: LABELS[v] }));
        return [];
      }
      case "b1_folhas":
      case "b2_folhas":
        return [...OPCOES.folhasPivo].map((v) => ({ valor: v, label: LABELS[v] }));
      case "b1_tamanho":
      case "b2_tamanho": {
        const b = step.startsWith("b1") ? b1 : b2;
        if (b.abertura === "PIVO") return [...OPCOES.tamanhoPivo].map((v) => ({ valor: v, label: LABELS[v] }));
        if (b.abertura === "BASC") return [...OPCOES.tamanhoBasc].map((v) => ({ valor: v, label: LABELS[v] }));
        return [];
      }
      case "b1_peso":
      case "b2_peso":
        return [...OPCOES.pesoDesl].map((v) => ({ valor: v, label: LABELS[v] }));
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
    if (s === "b1_tipo" || s === "b2_tipo") return "";
    if (s === "b1_entrada" || s === "b2_entrada") return "ENTRADA";
    if (s === "b1_saida" || s === "b2_saida") return "SAÍDA";
    if (s === "b1_abertura" || s === "b2_abertura") return "TIPO DE ABERTURA?";
    if (s === "b1_folhas" || s === "b2_folhas") return "QUANTIDADE DE FOLHAS?";
    if (s === "b1_tamanho" || s === "b2_tamanho") {
      const b = s.startsWith("b1") ? wizard.b1 : wizard.b2;
      if (b.abertura === "PIVO") return "TAMANHO DA FOLHA";
      if (b.abertura === "BASC") return "TAMANHO DO ACIONAMENTO";
      return "TAMANHO";
    }
    if (s === "b1_peso" || s === "b2_peso") return "PESO DO PORTÃO";
    if (s === "tecnologia") return tipoBloco === "CFTV" ? "TIPO DE TECNOLOGIA?" : "TIPO DE SISTEMA?";
    return "";
  }

  function getRespostaDada(step: WizardStep): string | null {
    if (!wizard) return null;
    const w = wizard;
    const map: Partial<Record<WizardStep, string | undefined>> = {
      b1_tipo: w.b1.tipo, b1_entrada: w.b1.entrada, b1_saida: w.b1.saida,
      b1_abertura: w.b1.abertura, b1_folhas: w.b1.folhas, b1_tamanho: w.b1.tamanho, b1_peso: w.b1.peso,
      b2_tipo: w.b2.tipo, b2_entrada: w.b2.entrada, b2_saida: w.b2.saida,
      b2_abertura: w.b2.abertura, b2_folhas: w.b2.folhas, b2_tamanho: w.b2.tamanho, b2_peso: w.b2.peso,
    };
    return map[step] ?? null;
  }

  function buildConfig(): BlocoConfig {
    return {
      tipoBloco,
      eclusa: !!wizard?.eclusa,
      b1: wizard?.b1 as BarreiraConfig,
      b2: wizard?.eclusa ? (wizard?.b2 as BarreiraConfig) : undefined,
      tecnologia: wizard?.tecnologia ?? undefined,
      qtdDome: wizard?.qtdDome,
      qtdBullet: wizard?.qtdBullet,
      portaria,
    };
  }

  // ─── UI +/- para CFTV ─────────────────────────────────────────────────────
  function CftvCounter({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "24px 0" }}>
        <Video size={64} color={isLight ? L.gold : "#F59E0B"} strokeWidth={1.5} />
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", color: isLight ? L.textSub : "rgba(255,255,255,0.75)", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={() => onChange(Math.max(0, value - 1))}
            style={{
              width: 56, height: 56, borderRadius: "50%",
              border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.28)",
              background: isLight ? L.cardSolid : "rgba(255,255,255,0.04)",
              color: isLight ? L.text : "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Minus size={22} />
          </button>
          <div
            style={{
              minWidth: 84, textAlign: "center", fontSize: 42, fontWeight: 800,
              color: isLight ? L.text : "#fff", fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {value}
          </div>
          <button
            onClick={() => onChange(Math.min(64, value + 1))}
            style={{
              width: 56, height: 56, borderRadius: "50%",
              border: "none", background: "#F59E0B", color: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(245,158,11,0.35)",
            }}
          >
            <Plus size={22} />
          </button>
        </div>
      </div>
    );
  }

  // Auto-salva o bloco assim que entramos na tela de resumo (unificada com editor de itens).
  const autoSaveGuardRef = useRef(false);
  useEffect(() => {
    if (!wizard || wizard.step !== "resumo") return;
    if (blocoSalvoId) return;
    if (autoSaveGuardRef.current) return;
    if (salvarMutation.isPending) return;
    autoSaveGuardRef.current = true;
    salvarMutation.mutate(buildConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard?.step, blocoSalvoId]);



  // ─── RENDER: Wizard ───────────────────────────────────────────────────────
  if (wizard) {
    const opcoes = getOpcoes();


    // CFTV: tela unificada de quantidade (Dome + Bullet)
    if (wizard.step === "cftv_qtd") {
      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />
          <CftvCounter
            label="Quantidade de Câmeras Dome"
            value={wizard.qtdDome}
            onChange={(n) => setWizard({ ...wizard, qtdDome: n })}
          />
          <CftvCounter
            label="Quantidade de Câmeras Bullet"
            value={wizard.qtdBullet}
            onChange={(n) => setWizard({ ...wizard, qtdBullet: n })}
          />
          <button
            onClick={avancarCftvQtd}
            style={{
              width: "100%", padding: "16px 0",
              background: "#F59E0B", border: "none", borderRadius: 999,
              color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
            }}
          >
            CONTINUAR
          </button>
        </div>
      );
    }

    if (wizard.step === "resumo") {
      const config = buildConfig();

      const concluir = () => {
        setBlocoSalvoId(null);
        setSavedConfig(null);
        autoSaveGuardRef.current = false;
        setWizard(null);
      };

      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
              <div style={{ fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>Configuração concluída</div>
            </div>
            <CheckCircle2 size={22} color="#22C55E" />
          </div>

          {(tipoBloco === "PED" || tipoBloco === "VEI") ? (<MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} isLight={isLight} />) : (<WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />)}

          {/* Editor de equipamentos (auto-semeado após salvar) */}
          {blocoSalvoId && savedConfig ? (
            <BlocoItensEditor
              visitaBlocoId={blocoSalvoId}
              codigo={gerarCodigoBloco(savedConfig)}
              tipoBloco={savedConfig.tipoBloco}
              tecnologia={savedConfig.tecnologia ?? null}
              qtdDome={savedConfig.qtdDome}
              qtdBullet={savedConfig.qtdBullet}
              isLight={isLight}
              hideSubtotal
              hideConcluir
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, gap: 10, color: isLight ? L.textSub : "rgba(255,255,255,0.7)" }}>
              <span>Preparando equipamentos…</span>
            </div>
          )}

          {/* FOTOS DO LOCAL */}
          <div>
            <div style={{
              color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", marginBottom: 10,
            }}>
              FOTOS DO LOCAL {fotos.length > 0 ? `(${fotos.length})` : ""}
            </div>

            {fotos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {fotos.map((foto, idx) => (
                  <div key={idx} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden" }}>
                    <img src={foto.localUrl} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <button onClick={() => removerFoto(idx)} style={{
                      position: "absolute", top: 6, right: 6, width: 24, height: 24,
                      background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%",
                      color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setShowOpcoes(true)} style={{
              width: "100%", padding: "14px 0", background: "transparent",
              border: `2px dashed ${isLight ? "rgba(180,120,0,0.44)" : "rgba(245,158,11,0.44)"}`,
              borderRadius: 14, color: isLight ? L.gold : "#F59E0B",
              fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Camera size={18} color={isLight ? L.gold : "#F59E0B"} />
              {fotos.length === 0 ? "ADICIONAR FOTOS" : "ADICIONAR MAIS FOTOS"}
            </button>
          </div>

          {/* Botão CONCLUIR BLOCO (inline, ao final do scroll) */}
          <button
            onClick={concluir}
            disabled={!blocoSalvoId}
            style={{
              width: "100%", marginTop: 24, marginBottom: 32,
              padding: "16px", background: "#F59E0B", border: "none", borderRadius: 999,
              color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 6px 20px rgba(245,158,11,0.35)",
              opacity: blocoSalvoId ? 1 : 0.6,
              textTransform: "uppercase",
            }}
          >
            <CheckCircle2 size={18} /> CONCLUIR BLOCO
          </button>

          <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleArquivos} />
          <input ref={inputCameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleArquivos} />

          {showOpcoes && (
            <>
              <div onClick={() => setShowOpcoes(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
              <div style={{
                position: "fixed", bottom: 0, left: 0, right: 0,
                background: isLight ? L.cardSolid : "#1C1A0F",
                border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.2)",
                borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
                zIndex: 50, display: "flex", flexDirection: "column", gap: 12,
                boxShadow: isLight ? L.shadow : undefined,
              }}>
                <div style={{ color: isLight ? L.text : "#fff", fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>
                  Adicionar fotos
                </div>
                <button onClick={() => inputCameraRef.current?.click()} style={{
                  width: "100%", padding: 16,
                  background: isLight ? L.goldBg : "rgba(255,215,0,0.08)",
                  border: isLight ? L.goldBorder : "1px solid rgba(255,215,0,0.2)",
                  borderRadius: 14, color: isLight ? L.gold : "#FFD700",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}>
                  <Camera size={20} color={isLight ? L.gold : "#FFD700"} /> Tirar foto
                </button>
                <button onClick={() => inputGaleriaRef.current?.click()} style={{
                  width: "100%", padding: 16,
                  background: isLight ? L.goldBg : "rgba(255,215,0,0.08)",
                  border: isLight ? L.goldBorder : "1px solid rgba(255,215,0,0.2)",
                  borderRadius: 14, color: isLight ? L.gold : "#FFD700",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}>
                  <ImageIcon size={20} color={isLight ? L.gold : "#FFD700"} /> Escolher da galeria
                </button>
                <button onClick={() => setShowOpcoes(false)} style={{
                  width: "100%", padding: 14, background: "transparent",
                  border: isLight ? L.borderMd : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14, color: "#6B7280", fontSize: 14, cursor: "pointer",
                }}>Cancelar</button>
              </div>
            </>
          )}
        </div>
      );
    }


    // Telas de barreira (B1 / B2)
    const isB1Step = B1_STEPS.includes(wizard.step);
    const isB2Step = B2_STEPS.includes(wizard.step);

    if (isB1Step || isB2Step) {
      const b1Done = isB2Step;
      const showB2 = b1Done;

      const stepsRespondidosB1 = (() => {
        if (isB1Step) {
          const idx = B1_STEPS.indexOf(wizard.step);
          return B1_STEPS.slice(0, idx).filter((s) => getRespostaDada(s) !== null);
        }
        return B1_STEPS.filter((s) => getRespostaDada(s) !== null);
      })();
      const stepsRespondidosB2 = (() => {
        if (!isB2Step) return [];
        const idx = B2_STEPS.indexOf(wizard.step);
        return B2_STEPS.slice(0, idx).filter((s) => getRespostaDada(s) !== null);
      })();

      const ConfirmedAnswer = ({ step }: { step: WizardStep }) => {
        const resposta = getRespostaDada(step);
        if (!resposta) return null;
        const todasOpcoes = getOpcoes(step);
        const opcaoSel = todasOpcoes.find((o) => o.valor === resposta);
        return (
          <div style={{ marginBottom: 16 }}>
            <p style={{
              color: isLight ? "rgba(0,0,0,0.40)" : "rgba(255,255,255,0.4)",
              fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: "0 0 6px", textTransform: "uppercase",
            }}>
              {getLabelPergunta(step)}
            </p>
            <button onClick={() => handleEditStep(step)} style={{
              background: "none", border: "none", padding: "4px 0", cursor: "pointer",
              textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: isLight ? L.text : "#FFFFFF", fontSize: 15, fontWeight: 700 }}>
                {opcaoSel?.label ?? LABELS[resposta] ?? resposta}
              </span>
              <Pencil size={12} color="#4B5563" />
            </button>
          </div>
        );
      };

      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>

          {(tipoBloco === "PED" || tipoBloco === "VEI") ? (<MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} isLight={isLight} />) : (<WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />)}

          <div style={{ marginBottom: 24 }}>
            <BarreiraHeader
              label={tipoBloco === "VEI" ? "Barreira Externa" : "Porta Externa"}
              done={b1Done}
              isLight={isLight}
              collapsible={b1Done}
              collapsed={b1Collapsed}
              onToggle={() => setB1Collapsed((p) => !p)}
            />


            {!b1Collapsed && (
              <div>
                {stepsRespondidosB1.map((step) => (<ConfirmedAnswer key={step} step={step} />))}

                {isB1Step && (
                  <div ref={bottomRef}>
                    {getLabelPergunta() && <div style={QUESTION}>{getLabelPergunta()}</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {opcoes.map((op) => (
                        <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
                          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {(wizard.step === "b1_tipo" || wizard.step === "b2_tipo") && op.valor === "CAT" && <RefreshCw size={18} color="#F59E0B" />}
                            {(wizard.step === "b1_tipo" || wizard.step === "b2_tipo") && op.valor === "PORP" && <DoorClosed size={18} color="#F59E0B" />}
                            <span style={{ fontSize: 15, fontWeight: 600, color: isLight ? L.text : undefined }}>{op.label}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {showB2 && (
            <div ref={b2Ref}>
              <BarreiraHeader label={tipoBloco === "VEI" ? "Barreira Interna" : "Porta Interna"} done={false} isLight={isLight} />

              {stepsRespondidosB2.map((step) => (<ConfirmedAnswer key={step} step={step} />))}

              {isB2Step && (
                <div ref={bottomRef}>
                  {getLabelPergunta() && <div style={QUESTION}>{getLabelPergunta()}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {opcoes.map((op) => (
                      <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {(wizard.step === "b1_tipo" || wizard.step === "b2_tipo") && op.valor === "CAT" && <RefreshCw size={18} color="#F59E0B" />}
                          {(wizard.step === "b1_tipo" || wizard.step === "b2_tipo") && op.valor === "PORP" && <DoorClosed size={18} color="#F59E0B" />}
                          <span style={{ fontSize: 15, fontWeight: 600, color: isLight ? L.text : undefined }}>{op.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Eclusa / Tecnologia / outros steps simples
    return (
      <div style={PAGE}>
        <div style={HEADER}>
          <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
        </div>

        {wizard && ((tipoBloco === "PED" || tipoBloco === "VEI") ? (
          <MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} isLight={isLight} />
        ) : (
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />
        ))}


        {getLabelPergunta() && <div style={QUESTION}>{getLabelPergunta()}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opcoes.map((op) => (
            <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: isLight ? L.text : undefined }}>{op.label}</span>
              </span>
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
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 400, fontSize: 18, color: isLight ? L.text : "#fff" }}>
            Configurar blocos
          </div>
          <div style={{ fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>{catNome}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isLoading ? (
          <div style={{ color: isLight ? L.textSub : "rgba(255,255,255,0.5)", fontSize: 13 }}>Carregando...</div>
        ) : blocosAdicionados.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "32px 16px",
            border: isLight ? "1px dashed rgba(0,0,0,0.15)" : "1px dashed rgba(255,255,255,0.12)",
            borderRadius: 14, color: isLight ? L.textSub : "rgba(255,255,255,0.45)",
          }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Nenhum bloco adicionado ainda.</div>
            <div style={{ fontSize: 11 }}>Toque em "Adicionar bloco" para configurar.</div>
          </div>
        ) : (
          blocosAdicionados.map((bloco: any) => (
            <div key={bloco.id} style={{
              background: isLight ? L.cardSolid : "rgba(255,255,255,0.04)",
              border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.15)",
              boxShadow: isLight ? L.shadowSm : undefined,
              borderRadius: 14, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: isLight ? L.text : "#fff", marginBottom: 2 }}>
                  {bloco.nome_descritivo}
                </div>
                <div style={{
                  fontFamily: "monospace", fontSize: 10,
                  color: isLight ? L.gold : "rgba(255,215,0,0.55)", wordBreak: "break-all",
                }}>{bloco.codigo_bloco}</div>
              </div>
              <button
                onClick={() => removerMutation.mutate(bloco.id)}
                disabled={removerMutation.isPending}
                style={{
                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10, width: 36, height: 36,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#EF4444", cursor: "pointer",
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <button onClick={iniciarWizard} style={{
        marginTop: 8, padding: "16px 0",
        background: isLight ? L.goldBg : "linear-gradient(135deg, #FFD700, #FFB300)",
        border: isLight ? L.goldBorder : "none", borderRadius: 14,
        color: isLight ? L.gold : "#0A0A0A", fontSize: 14, fontWeight: 800,
        cursor: "pointer", letterSpacing: 1, boxShadow: isLight ? L.shadowSm : undefined,
      }}>+ ADICIONAR</button>
    </div>
  );
}
