import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Check, CheckCircle2, Trash2, Camera, Image as ImageIcon, ChevronDown, Pencil, DoorOpen,
  RefreshCw, DoorClosed, Video, Minus, Plus,
  ScanFace, Nfc, Circle, Tag, Radio, Fingerprint, Settings2, Zap, Users,
  X, CheckCircle, Wifi, Cable, ArrowLeftRight, ArrowUpDown, Layers, Ruler, Weight, Signal, Eye,
  type LucideIcon,
} from "lucide-react";

// Mapa de ícones para as opções de seleção (todas as etapas)
const OPT_ICON: Record<string, LucideIcon> = {
  FAC: ScanFace,
  BOTAPR: Nfc,
  BOTANA: Circle,
  TAG: Tag,
  CTRL: Radio,
  DIG: Fingerprint,
  CAT: RefreshCw,
  PORP: DoorClosed,
  PORV: DoorClosed,
  MOT: Settings2,
  MOL: Zap,
  PORTAR: Users,
  CAN: Minus,
  NAO: X,
  SIM: CheckCircle,
  IP: Wifi,
  ANAL: Cable,
  CAB: Cable,
  SF: Wifi,
  LAC: Signal,
  FOT: Eye,
  LPR: ScanFace,
  NAD: Circle,
  BASC: DoorOpen,
  DESL: ArrowLeftRight,
  PIVO: RefreshCw,
  "1F": Layers,
  "2F": Layers,
  "200CM": Ruler,
  "350CM": Ruler,
  "450CM": Ruler,
  "15M": Ruler,
  "2M": Ruler,
  "25M": Ruler,
  "3M": Ruler,
  "800KG": Weight,
  "1300KG": Weight,
  "1500KG": Weight,
  ELEV: ArrowUpDown,
  "1EL": Layers,
  "2EL": Layers,
  "3EL": Layers,
  "4EL": Layers,
  PCF: DoorClosed,
  NPCF: X,
  MOL45: Weight,
  MOL65: Weight,
  MOL85: Weight,
};

function OptionIcon({ valor }: { valor: string }) {
  const Ico = OPT_ICON[valor] ?? Circle;
  return <Ico size={16} color="#F59E0B" />;
}
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import {
  LABELS,
  OPCOES,
  type BlocoConfig,
  type BarreiraConfig,
  type TipoBloco,
  type CftvCamera,
  gerarCodigoBloco,
  gerarDescricaoBloco,
  CAT_SLUG_TO_TIPO,
  CAT_NOMES,
} from "@/lib/blocos";

// Opções de I.A integrada por câmera (CFTV) + conexão ao Smart Sampa
const CFTV_IA_OPCOES = [
  "Leitura de Placas",
  "Detecção de movimento",
  "Detecção de ausência",
  "Detecção de presença",
  "Smart Sampa",
];
import { BlocoItensEditor } from "@/features/orcamento/BlocoItensEditor";
import { computeAutoItemsFromConfig, isServicoCode } from "@/features/orcamento/blockAutoItems";
import { AlarmeWizard } from "@/features/orcamento/AlarmeWizard";
import type { AlarmeConfig, CalcRow as AlarmeCalcRow } from "@/features/orcamento/alarmeEngine";
import { ElevadoresWizard, type ElevadorItemCalc } from "@/features/orcamento/ElevadoresWizard";
import { TotemWizard, type TotemConfig, type TotemItemCalc } from "@/features/orcamento/TotemWizard";
import { reconcileGuaritaProjeto } from "@/features/orcamento/guarita";
import { reconcileDimensionamentoProjeto } from "@/features/orcamento/dimensionamento";
import { CaboGauge } from "@/features/orcamento/CaboGauge";


export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/blocos/$cat")({
  component: BlocosWizardPage,
});

// ─── Tipos internos do wizard ────────────────────────────────────────────────

type WizardStep =
  | "nome_acesso"
  | "eclusa"
  | "b1_tipo" | "b1_entrada" | "b1_saida" | "b1_abertura" | "b1_folhas" | "b1_tamanho" | "b1_peso"
  | "b2_tipo" | "b2_entrada" | "b2_saida" | "b2_abertura" | "b2_folhas" | "b2_tamanho" | "b2_peso"
  | "tecnologia"
  | "cftv_qtd"
  | "cerca_perimetro" | "cerca_esquinas"
  | "resumo";

interface WizardState {
  step: WizardStep;
  nomeAcesso: string;
  eclusa: boolean | null;
  b1: Partial<BarreiraConfig>;
  b2: Partial<BarreiraConfig>;
  tecnologia: string | null;
  qtdDome: number;
  qtdBullet: number;
  cftvCameras: CftvCamera[];
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
    case "nome_acesso": return "Nome";
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
  // Elevador (PED): sem entrada/saída — qtd de elevadores (tamanho) + porta corta-fogo (abertura)
  if (tipoBloco === "PED" && b.tipo === "ELEV") {
    s.push(`${prefix}_tamanho` as WizardStep, `${prefix}_abertura` as WizardStep);
    return s;
  }
  s.push(`${prefix}_entrada` as WizardStep, `${prefix}_saida` as WizardStep);
  if (tipoBloco === "PED" && b.tipo === "PORP") {
    s.push(`${prefix}_abertura` as WizardStep);
    // Mola aérea: pergunta do peso da porta
    if (b.abertura === "MOL") s.push(`${prefix}_peso` as WizardStep);
  }
  if (tipoBloco === "VEI" && b.tipo === "PORV") {
    s.push(`${prefix}_abertura` as WizardStep);
    if (b.abertura === "PIVO") s.push(`${prefix}_folhas` as WizardStep, `${prefix}_tamanho` as WizardStep);
    if (b.abertura === "BASC") s.push(`${prefix}_tamanho` as WizardStep);
    // DESL: peso não é perguntado — sempre 1500KG (fixado ao selecionar)
  }
  return s;
}

function getStepSequence(w: WizardState, tipo: TipoBloco): WizardStep[] {
  if (tipo === "CFTV") return ["tecnologia", "cftv_qtd", "resumo"];
  if (tipo === "AL") return ["tecnologia", "resumo"];
  if (tipo === "CER") return ["cerca_perimetro", "cerca_esquinas", "resumo"];

  const steps: WizardStep[] = ["nome_acesso", "eclusa"];
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
          const futureCircleBg = isLight ? "#f0f1f4" : "#191921";
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

// Nome da barreira conforme o tipo selecionado (Catraca/Porta/Cancela/Portão)
function nomeBarreira(tipo: TipoBloco, prefix: "Externa" | "Interna", tipoSel?: string): string {
  if (tipo === "PED") {
    if (tipoSel === "CAT") return `Catraca ${prefix}`;
    if (tipoSel === "PORP") return `Porta ${prefix}`;
    return `Porta ${prefix}`;
  }
  if (tipo === "VEI") {
    if (tipoSel === "CAN") return `Cancela ${prefix}`;
    if (tipoSel === "PORV") return `Portão ${prefix}`;
    return `Barreira ${prefix}`;
  }
  return prefix;
}

function MacroStepIndicator({
  step,
  tipo,
  eclusa,
  b1Tipo,
  b2Tipo,
  isLight,
}: {
  step: WizardStep;
  tipo: TipoBloco;
  eclusa: boolean | null;
  b1Tipo?: string;
  b2Tipo?: string;
  isLight: boolean;
}) {
  const isB1 = B1_STEPS.includes(step);
  const isB2 = B2_STEPS.includes(step);
  const isResumo = step === "resumo";
  const isEclusa = step === "eclusa";

  const externaLabel = nomeBarreira(tipo, "Externa", b1Tipo);
  const internaLabel = nomeBarreira(tipo, "Interna", b2Tipo);

  const eclusaDenied = !isEclusa && eclusa === false;

  const macros = [
    { label: "Eclusa", current: isEclusa, completed: !isEclusa, denied: eclusaDenied },
    { label: externaLabel, current: isB1, completed: isB2 || isResumo, denied: false },
    { label: internaLabel, current: isB2, completed: isResumo && !!eclusa, denied: false, hidden: eclusa === false },
  ];

  const goldSolid = "#F59E0B";
  const redSolid = "#EF4444";
  const goldText = isLight ? "#b87800" : "#FFC000";
  const futureCircleBg = isLight ? "#f0f1f4" : "#191921";
  const futureBorder = isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)";
  const futureText = isLight ? "#8a909e" : "rgba(200,200,200,0.4)";
  const currentLabel = isLight ? "#0a0b0e" : "#fff";

  const visibleMacros = macros.filter((m) => !m.hidden);

  return (
    <div style={{ marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content", paddingBottom: 4 }}>
        {visibleMacros.map((m, i) => {
          const isLast = i === visibleMacros.length - 1;
          const active = m.current || m.completed;
          const bg = m.denied ? redSolid : active ? goldSolid : futureCircleBg;
          const border = m.denied
            ? `1.5px solid ${redSolid}`
            : active ? `1.5px solid ${goldSolid}` : futureBorder;
          const lineColor = m.completed
            ? (m.denied ? "rgba(239,68,68,0.45)" : (isLight ? "rgba(180,120,0,0.4)" : "rgba(255,192,0,0.4)"))
            : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)");
          return (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: bg,
                  border,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: active || m.denied ? "#fff" : futureText,
                  flexShrink: 0, transition: "all 0.2s ease",
                }}>
                  {m.denied ? <X size={12} /> : m.completed ? <Check size={12} /> : (i + 1)}
                </div>
                <span style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 11, whiteSpace: "nowrap",
                  color: m.denied ? redSolid : m.completed ? goldText : m.current ? currentLabel : futureText,
                  opacity: !active && !m.denied ? 0.55 : 1, transition: "all 0.2s ease",
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
    background: isLight ? L.cardSolid : "#191921",
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
      width: "100%", background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)", border: "1px solid rgba(255,215,0,0.18)",
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
  // Tipo de local: Residência/Galpão (fluxo simples) não têm sistema de portaria
  const { data: visitaRow } = useQuery({
    queryKey: ["visita_tipo_local", visitaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("tipo_local")
        .eq("id", visitaId)
        .maybeSingle();
      return data;
    },
  });
  const tipoLocal = ((visitaRow as any)?.tipo_local as string | null | undefined)?.trim().toLowerCase();
  const semPortaria = tipoLocal === "residencia" || tipoLocal === "empresa";
  const sistemaPropostoRaw = (orcamentoRow as any)?.sistema_proposto;
  // Sufixos permitidos por tipo de local:
  //  • Residência: SOMENTE SM (nunca tem portaria — ignora sistema_proposto).
  //  • Galpão (empresa): PR/PP/PA quando definido; senão SM.
  //  • Condomínios: PR/PP/PA; default PR.
  const portaria: "PR" | "PP" | "PA" | "SM" =
    tipoLocal === "residencia" ? "SM"
    : sistemaPropostoRaw === "PP" ? "PP"
    : sistemaPropostoRaw === "PA" ? "PA"
    : sistemaPropostoRaw === "PR" ? "PR"
    : semPortaria ? "SM"
    : "PR";

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

  // Itens de todos os blocos exibidos, para preview no card da lista
  const blocoIdsAdicionados = blocosAdicionados.map((b: any) => b.id).filter(Boolean);
  const { data: itensPorBloco = {} } = useQuery({
    queryKey: ["visita_bloco_itens_preview", blocoIdsAdicionados.sort().join(",")],
    enabled: blocoIdsAdicionados.length > 0,
    queryFn: async () => {
      const { data: itensRows, error } = await supabase
        .from("visita_bloco_itens" as any)
        .select("visita_bloco_id, cod_eq, qtd, removido, observacao")
        .in("visita_bloco_id", blocoIdsAdicionados);
      if (error) throw error;
      const rows = ((itensRows as any[]) ?? []).filter((r) => !r.removido && Number(r.qtd) > 0);
      const codes = Array.from(new Set(rows.map((r) => r.cod_eq)));
      let eqMap: Record<string, { nome: string; modelo: string | null }> = {};
      if (codes.length > 0) {
        const { data: eqRows } = await supabase
          .from("equipamentos")
          .select("code,nome,modelo")
          .in("code", codes);
        for (const e of (eqRows as any[]) ?? []) {
          eqMap[e.code] = { nome: e.nome, modelo: e.modelo };
        }
      }
      const grouped: Record<string, { qtd: number; label: string }[]> = {};
      for (const r of rows) {
        const eq = eqMap[r.cod_eq];
        const label = eq?.modelo || eq?.nome || r.observacao || r.cod_eq;
        if (!grouped[r.visita_bloco_id]) grouped[r.visita_bloco_id] = [];
        grouped[r.visita_bloco_id].push({ qtd: Number(r.qtd), label });
      }
      return grouped;
    },
  });


  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [fotos, setFotos] = useState<{ localUrl: string; file: File }[]>([]);
  const [showOpcoes, setShowOpcoes] = useState(false);

  // ── CFTV: câmera em configuração (antes de ser adicionada ao escopo) ──────
  const [camTipo, setCamTipo] = useState<"dome" | "bullet">("dome");
  const [camMetros, setCamMetros] = useState(0);
  const [camIA, setCamIA] = useState<string[]>([]);

  // BOM ao vivo (somatória de todas as câmeras já adicionadas neste fluxo)
  const cftvCams = wizard?.cftvCameras ?? [];
  const cftvBomAll =
    tipoBloco === "CFTV" && wizard
      ? computeAutoItemsFromConfig({
          tipoBloco: "CFTV",
          eclusa: false,
          tecnologia: wizard.tecnologia ?? "IP",
          qtdDome: cftvCams.filter((c) => c.tipo === "dome").length,
          qtdBullet: cftvCams.filter((c) => c.tipo === "bullet").length,
          cftvCameras: cftvCams,
          portaria,
        }).filter((it) => it.qtd > 0)
      : [];
  // Hardware (equipamentos) × serviços mensais (SV*)
  const cftvBom = cftvBomAll.filter((it) => !isServicoCode(it.cod_eq));
  const cftvBomMensal = cftvBomAll.filter((it) => isServicoCode(it.cod_eq));
  const cftvBomCodes = cftvBom.map((it) => it.cod_eq);
  const { data: cftvEqNomes = {} } = useQuery({
    queryKey: ["cftv_bom_nomes", [...cftvBomCodes].sort().join(",")],
    enabled: cftvBomCodes.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipamentos")
        .select("code,nome,modelo")
        .in("code", cftvBomCodes);
      const map: Record<string, string> = {};
      for (const e of (data as any[]) ?? []) map[e.code] = e.modelo || e.nome;
      return map;
    },
  });
  const cftvSvCodes = cftvBomMensal.map((it) => it.cod_eq);
  const { data: cftvSvInfo = {} } = useQuery({
    queryKey: ["cftv_bom_servicos", [...cftvSvCodes].sort().join(",")],
    enabled: cftvSvCodes.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("servicos")
        .select("code,nome,preco_unitario_mensal")
        .in("code", cftvSvCodes);
      const map: Record<string, { nome: string; preco: number }> = {};
      for (const s of (data as any[]) ?? []) {
        map[s.code] = { nome: s.nome, preco: Number(s.preco_unitario_mensal || 0) };
      }
      return map;
    },
  });
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

  // Referência para bloquear auto-save quando abrimos um bloco existente para edição
  // (declarado adiante como autoSaveGuardRef)
  function abrirBlocoParaEditar(bloco: any) {
    // Câmeras CFTV: restaura do JSON salvo ou sintetiza a partir das quantidades (blocos antigos)
    const camerasSalvas: CftvCamera[] | undefined = (bloco.alarme_config as any)?.cftv_cameras;
    const cftvCameras: CftvCamera[] =
      bloco.tipo_bloco === "CFTV"
        ? Array.isArray(camerasSalvas)
          ? camerasSalvas
          : [
              ...Array.from({ length: bloco.qtd_dome ?? 0 }, () => ({ tipo: "dome" as const, metros: 0, ia: [] as string[] })),
              ...Array.from({ length: bloco.qtd_bullet ?? 0 }, () => ({ tipo: "bullet" as const, metros: 0, ia: [] as string[] })),
            ]
        : [];
    const cfg: BlocoConfig = {
      tipoBloco: bloco.tipo_bloco as TipoBloco,
      eclusa: !!bloco.eclusa,
      b1: bloco.b1_tipo
        ? {
            tipo: bloco.b1_tipo,
            entrada: bloco.b1_entrada,
            saida: bloco.b1_saida,
            abertura: bloco.b1_abertura ?? undefined,
            folhas: bloco.b1_folhas ?? undefined,
            tamanho: bloco.b1_tamanho ?? undefined,
            peso: bloco.b1_peso ?? undefined,
          }
        : undefined,
      b2: bloco.b2_tipo
        ? {
            tipo: bloco.b2_tipo,
            entrada: bloco.b2_entrada,
            saida: bloco.b2_saida,
            abertura: bloco.b2_abertura ?? undefined,
            folhas: bloco.b2_folhas ?? undefined,
            tamanho: bloco.b2_tamanho ?? undefined,
            peso: bloco.b2_peso ?? undefined,
          }
        : undefined,
      tecnologia: bloco.tecnologia ?? undefined,
      qtdDome: bloco.qtd_dome ?? undefined,
      qtdBullet: bloco.qtd_bullet ?? undefined,
      cftvCameras: bloco.tipo_bloco === "CFTV" ? cftvCameras : undefined,
      perimetro: bloco.perimetro ?? undefined,
      esquinas: bloco.esquinas ?? undefined,
      portaria,
    };
    setBlocoSalvoId(bloco.id);
    setSavedConfig(cfg);
    autoSaveGuardRef.current = JSON.stringify(cfg);
    setWizard({
      step: "resumo",
      nomeAcesso: bloco.nome_acesso ?? "",
      eclusa: !!bloco.eclusa,
      b1: (cfg.b1 as Partial<BarreiraConfig>) ?? {},
      b2: (cfg.b2 as Partial<BarreiraConfig>) ?? {},
      tecnologia: bloco.tecnologia ?? null,
      qtdDome: bloco.qtd_dome ?? 0,
      qtdBullet: bloco.qtd_bullet ?? 0,
      cftvCameras,
      perimetro: bloco.perimetro ?? 0,
      esquinas: bloco.esquinas ?? 0,
    });
  }


  const salvarMutation = useMutation({
    mutationFn: async (config: BlocoConfig) => {
      const fotosUrls: string[] = [];
      const currentBlocoId = blocoSalvoId;
      if (!currentBlocoId) {
        for (const foto of fotos) {
          const ext = foto.file.name.split(".").pop() || "jpg";
          const path = `${visitaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("blocos-fotos")
            .upload(path, foto.file, { contentType: foto.file.type });
          if (!uploadError) fotosUrls.push(path);
        }
      }

      const payload = {
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
        perimetro: config.perimetro ?? null,
        esquinas: config.esquinas ?? null,
        nome_acesso: wizard?.nomeAcesso?.trim() || null,
        hh_padrao: 10,
        quantidade: 1,
        ...(config.tipoBloco === "CFTV"
          ? { alarme_config: { cftv_cameras: config.cftvCameras ?? [] } }
          : {}),
        ...(currentBlocoId ? {} : { ordem: blocosAdicionados.length, fotos_urls: fotosUrls }),
      };

      let blocoId = currentBlocoId;
      if (currentBlocoId) {
        const { error } = await supabase
          .from("visita_blocos" as any)
          .update(payload)
          .eq("id", currentBlocoId);
        if (error) throw error;
        const { error: delAutoError } = await supabase
          .from("visita_bloco_itens" as any)
          .delete()
          .eq("visita_bloco_id", currentBlocoId)
          .eq("origem", "auto");
        if (delAutoError) throw delAutoError;
      } else {
        const { data, error } = await supabase
          .from("visita_blocos" as any)
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        blocoId = (data as any).id as string;
      }

      if (!blocoId) throw new Error("Bloco não identificado para salvar equipamentos");

      const itensAuto = computeAutoItemsFromConfig(config).filter((it) => it.qtd > 0);
      if (itensAuto.length > 0) {
        const rows = itensAuto.map((it) => ({
          visita_bloco_id: blocoId,
          cod_eq: it.cod_eq,
          qtd: it.qtd,
          origem: "auto" as const,
          observacao: it.observacao ?? null,
        }));
        const { error: itensError } = await supabase.from("visita_bloco_itens" as any).insert(rows);
        if (itensError) throw itensError;
      }

      // Regras por projeto: guarita/receptores primeiro (inserem consumidores),
      // depois o dimensionamento (switches/fontes/nobreak/baterias na CENT)
      await reconcileGuaritaProjeto(visitaId);
      await reconcileDimensionamentoProjeto(visitaId);

      return { id: blocoId, config };
    },
    onSuccess: ({ id, config }) => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_bloco_itens"] });
      queryClient.invalidateQueries({ queryKey: ["visita_bloco_itens_preview"] });
      toast.success(blocoSalvoId ? "Bloco atualizado" : "Bloco adicionado — configure os equipamentos");
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
      // Removeu um bloco → recalcula guarita e dimensionamento do projeto
      await reconcileGuaritaProjeto(visitaId);
      await reconcileDimensionamentoProjeto(visitaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_bloco_itens"] });
      queryClient.invalidateQueries({ queryKey: ["visita_bloco_itens_preview"] });
    },
  });

  // ── Alarme: salva o bloco + insere itens calculados direto ───────────
  const salvarAlarmeMutation = useMutation({
    mutationFn: async ({ config, itens }: { config: AlarmeConfig; itens: AlarmeCalcRow[] }) => {
      const codigo = `AL-${config.ramo}`;
      const desc = config.ramo === "CAB"
        ? "Alarme de Intrusão — AMT 4010 Smart (com fio)"
        : "Alarme de Intrusão — AMT 8000 (sem fio)";
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .insert({
          visita_id: visitaId,
          codigo_bloco: codigo,
          nome_descritivo: desc,
          tipo_bloco: "AL",
          eclusa: false,
          tecnologia: config.ramo,
          alarme_config: config as any,
          hh_padrao: 10,
          quantidade: 1,
          ordem: blocosAdicionados.length,
          fotos_urls: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      const blocoId = (data as any).id as string;

      if (itens.length > 0) {
        const rows = itens.map((it) => ({
          visita_bloco_id: blocoId,
          cod_eq: it.cod_eq,
          qtd: it.qtd,
          origem: "auto" as const,
          observacao: it.regra ?? null,
        }));
        const { error: insErr } = await supabase.from("visita_bloco_itens" as any).insert(rows);
        if (insErr) throw insErr;
      }
      await reconcileDimensionamentoProjeto(visitaId);
      return blocoId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      toast.success("Alarme adicionado à proposta");
      setWizard(null);
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar alarme"),
  });

  // ── Elevadores: salva o bloco + insere itens do kit ───────────────────
  const salvarElevadoresMutation = useMutation({
    mutationFn: async ({ qtdKits, itens }: { qtdKits: number; itens: ElevadorItemCalc[] }) => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .insert({
          visita_id: visitaId,
          codigo_bloco: `ELV-${qtdKits}KIT`,
          nome_descritivo: `Elevadores — ${qtdKits} Kit${qtdKits === 1 ? "" : "s"} Antena`,
          tipo_bloco: "ELV",
          eclusa: false,
          hh_padrao: 10,
          quantidade: qtdKits,
          ordem: blocosAdicionados.length,
          fotos_urls: [],
        })
        .select("id")
        .single();
      if (error) throw error;
      const blocoId = (data as any).id as string;

      // Cabeamento do elevador: 0,8 m de cabo por apartamento (caixa de 300 m)
      const { data: orcCabo } = await supabase
        .from("visita_orcamentos")
        .select("qtd_apartamentos")
        .eq("visita_id", visitaId)
        .maybeSingle();
      const aptos = Number((orcCabo as any)?.qtd_apartamentos || 0);
      const metrosElev = Math.round(aptos * 0.8);
      const caixasElev = Math.ceil(metrosElev / 300);
      const rowsElev = [
        ...itens.map((it) => ({
          visita_bloco_id: blocoId,
          cod_eq: it.cod_eq,
          qtd: it.qtd,
          origem: "auto" as const,
          observacao: it.regra ?? null,
        })),
        ...(caixasElev > 0
          ? [{
              visita_bloco_id: blocoId,
              cod_eq: "EQ302",
              qtd: caixasElev,
              origem: "auto" as const,
              observacao: `Cabo de rede — ${metrosElev} m (0,8 m por apartamento × ${aptos} aptos)`,
            }]
          : []),
      ];
      if (rowsElev.length > 0) {
        const { error: insErr } = await supabase.from("visita_bloco_itens" as any).insert(rowsElev);
        if (insErr) throw insErr;
      }
      await reconcileDimensionamentoProjeto(visitaId);
      return blocoId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      toast.success("Elevadores adicionados à proposta");
      setWizard(null);
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar Elevadores"),
  });

  // ── Totem Inteligente: salva o bloco + insere itens de cada totem ─────
  const salvarTotemMutation = useMutation({
    mutationFn: async ({ totens, itens }: { totens: TotemConfig[]; itens: TotemItemCalc[] }) => {
      const n = totens.length;
      const totalCam = totens.reduce((s, t) => s + t.cameras, 0);
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .insert({
          visita_id: visitaId,
          codigo_bloco: `TOT-${n}x${totalCam}CAM`,
          nome_descritivo: `Totem Inteligente — ${n} totem${n === 1 ? "" : "s"} · ${totalCam} câmeras`,
          tipo_bloco: "TOT",
          eclusa: false,
          hh_padrao: 8,
          quantidade: n,
          ordem: blocosAdicionados.length,
          fotos_urls: [],
          // Config por totem (câmeras, Smart Sampa, I.As) — usada no cálculo de mensalidades
          alarme_config: {
            totem_totens: totens.map((t) => ({
              cameras: t.cameras,
              smart_sampa: t.smartSampa,
              cameras_ia: t.camerasIA,
            })),
          },
        })
        .select("id")
        .single();
      if (error) throw error;
      const blocoId = (data as any).id as string;

      if (itens.length > 0) {
        const rows = itens.map((it) => ({
          visita_bloco_id: blocoId,
          cod_eq: it.cod_eq,
          qtd: it.qtd,
          origem: "auto" as const,
          observacao: it.regra ?? null,
        }));
        const { error: insErr } = await supabase.from("visita_bloco_itens" as any).insert(rows);
        if (insErr) throw insErr;
      }
      await reconcileDimensionamentoProjeto(visitaId);
      return blocoId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visita_blocos", visitaId] });
      queryClient.invalidateQueries({ queryKey: ["visita_blocos_count", visitaId] });
      toast.success("Totem Inteligente adicionado à proposta");
      setWizard(null);
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar Totem Inteligente"),
  });

  function iniciarWizard(overrides?: Partial<WizardState>) {
    const primeiroStep: WizardStep =
      tipoBloco === "PED" || tipoBloco === "VEI" ? "nome_acesso"
      : tipoBloco === "CFTV" || tipoBloco === "AL" ? "tecnologia"
      : tipoBloco === "CER" ? "cerca_perimetro"
      : "eclusa";
    setWizard({
      step: primeiroStep,
      nomeAcesso: "",
      eclusa: tipoBloco === "CER" ? false : null,
      b1: {}, b2: {},
      tecnologia: null,
      qtdDome: 0, qtdBullet: 0,
      cftvCameras: [],
      perimetro: 0, esquinas: 0,
      ...overrides,
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
    if (current === `${p}_tipo`) {
      // Elevador: pula entrada/saída — vai direto para a qtd de elevadores
      if (b.tipo === "ELEV") return `${p}_tamanho` as WizardStep;
      return `${p}_entrada` as WizardStep;
    }
    if (current === `${p}_entrada`) return `${p}_saida` as WizardStep;
    if (current === `${p}_saida`) {
      if (tipoBloco === "PED" && b.tipo === "PORP") return `${p}_abertura` as WizardStep;
      if (tipoBloco === "VEI" && b.tipo === "PORV") return `${p}_abertura` as WizardStep;
      return proximoAposBarreira(p, eclusa);
    }
    if (current === `${p}_abertura`) {
      // Elevador: abertura = porta corta-fogo → último passo da barreira
      if (b.tipo === "ELEV") return proximoAposBarreira(p, eclusa);
      if (tipoBloco === "PED") {
        // Mola aérea: pergunta o peso da porta
        if (b.abertura === "MOL") return `${p}_peso` as WizardStep;
        return proximoAposBarreira(p, eclusa);
      }
      if (tipoBloco === "VEI") {
        if (b.abertura === "PIVO") return `${p}_folhas` as WizardStep;
        if (b.abertura === "BASC") return `${p}_tamanho` as WizardStep;
        // DESL: peso fixo 1500KG (setado em selecionar) — barreira concluída
      }
      return proximoAposBarreira(p, eclusa);
    }
    if (current === `${p}_folhas`) return `${p}_tamanho` as WizardStep;
    if (current === `${p}_tamanho`) {
      // Elevador: da qtd de elevadores segue para a porta corta-fogo
      if (b.tipo === "ELEV") return `${p}_abertura` as WizardStep;
      return proximoAposBarreira(p, eclusa);
    }
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
        // Portão deslizante: só trabalhamos com motor de 1500 kg — peso fixado sem perguntar
        if (key === "abertura" && valor === "DESL" && tipoBloco === "VEI") {
          (barreira as any).peso = "1500KG";
        }
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
    if (wizard.cftvCameras.length === 0) {
      toast.error("Adicione pelo menos uma câmera ao escopo.");
      return;
    }
    setWizard({
      ...wizard,
      qtdDome: wizard.cftvCameras.filter((c) => c.tipo === "dome").length,
      qtdBullet: wizard.cftvCameras.filter((c) => c.tipo === "bullet").length,
      step: "resumo",
    });
  }

  function voltarPasso() {
    if (!wizard) {
      navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
      return;
    }
    const w: WizardState = { ...wizard, b1: { ...wizard.b1 }, b2: { ...wizard.b2 } };
    const s = w.step;

    if (s === "nome_acesso" || s === "eclusa" || s === "tecnologia" || s === "cerca_perimetro") {
      if (s === "eclusa" && (tipoBloco === "PED" || tipoBloco === "VEI")) { w.step = "nome_acesso"; setWizard(w); return; }
      setWizard(null); return;
    }

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
          ? [
              { valor: "CAT", label: "Catraca" },
              { valor: "PORP", label: "Porta" },
              { valor: "ELEV", label: "Elevador" },
            ]
          : [{ valor: "CAN", label: "Cancela" }, { valor: "PORV", label: "Portão Veicular" }];
      case "b1_entrada": return entrada(b1.tipo);
      case "b2_entrada": return entrada(b2.tipo);
      case "b1_saida": return saida(b1.tipo);
      case "b2_saida": return saida(b2.tipo);
      case "b1_abertura":
      case "b2_abertura": {
        const b = step.startsWith("b1") ? b1 : b2;
        // Elevador: abertura = porta corta-fogo (Sim/Não)
        if (b.tipo === "ELEV") {
          return [
            { valor: "PCF", label: "Sim" },
            { valor: "NPCF", label: "Não" },
          ];
        }
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
        // Elevador: tamanho = quantidade de elevadores
        if (b.tipo === "ELEV") return [...OPCOES.qtdElevadores].map((v) => ({ valor: v, label: LABELS[v] }));
        if (b.abertura === "PIVO") return [...OPCOES.tamanhoPivo].map((v) => ({ valor: v, label: LABELS[v] }));
        if (b.abertura === "BASC") return [...OPCOES.tamanhoBasc].map((v) => ({ valor: v, label: LABELS[v] }));
        return [];
      }
      case "b1_peso":
      case "b2_peso": {
        const b = step.startsWith("b1") ? b1 : b2;
        // PED + Mola Aérea: peso da porta define o modelo da mola
        if (b.tipo === "PORP" && b.abertura === "MOL") {
          return [...OPCOES.pesoMola].map((v) => ({ valor: v, label: LABELS[v] }));
        }
        return [];
      }
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
    if (s === "b1_abertura" || s === "b2_abertura") {
      const b = s.startsWith("b1") ? wizard.b1 : wizard.b2;
      if (b.tipo === "ELEV") return "CONTÉM PORTA CORTA-FOGO?";
      return "TIPO DE ABERTURA?";
    }
    if (s === "b1_folhas" || s === "b2_folhas") return "QUANTIDADE DE FOLHAS?";
    if (s === "b1_tamanho" || s === "b2_tamanho") {
      const b = s.startsWith("b1") ? wizard.b1 : wizard.b2;
      if (b.tipo === "ELEV") return "QUANTIDADE DE ELEVADORES";
      if (b.abertura === "PIVO") return "TAMANHO DA FOLHA";
      if (b.abertura === "BASC") return "TAMANHO DO ACIONAMENTO";
      return "TAMANHO";
    }
    if (s === "b1_peso" || s === "b2_peso") {
      const b = s.startsWith("b1") ? wizard.b1 : wizard.b2;
      if (b.tipo === "PORP" && b.abertura === "MOL") return "QUAL O PESO DA PORTA?";
      return "PESO DO PORTÃO";
    }
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
      cftvCameras: tipoBloco === "CFTV" ? wizard?.cftvCameras ?? [] : undefined,
      perimetro: wizard?.perimetro,
      esquinas: wizard?.esquinas,
      portaria,
    };
  }

  // Auto-salva o bloco assim que entramos na tela de resumo (unificada com editor de itens).
  const autoSaveGuardRef = useRef<string | null>(null);
  useEffect(() => {
    if (!wizard || wizard.step !== "resumo") return;
    if (salvarMutation.isPending) return;
    const config = buildConfig();
    const configKey = JSON.stringify(config);
    if (blocoSalvoId && savedConfig && JSON.stringify(savedConfig) === configKey) return;
    if (autoSaveGuardRef.current === configKey) return;
    autoSaveGuardRef.current = configKey;
    salvarMutation.mutate(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard?.step, wizard, blocoSalvoId, savedConfig]);



  // ─── RENDER: Wizard ───────────────────────────────────────────────────────
  if (wizard) {
    // Alarme de Intrusão: wizard próprio (10 etapas + resumo lateral)
    if (tipoBloco === "AL") {
      return (
        <AlarmeWizard
          isLight={isLight}
          salvando={salvarAlarmeMutation.isPending}
          residenciaOuGalpao={semPortaria}
          portariaRemota={portaria === "PR"}
          onVoltar={() => {
            setWizard(null);
            navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
          }}
          onConcluir={(config, itens) => salvarAlarmeMutation.mutate({ config, itens })}
        />
      );
    }

    // Elevadores: wizard próprio (Kit Antena)
    if (tipoBloco === "ELV") {
      return (
        <ElevadoresWizard
          isLight={isLight}
          salvando={salvarElevadoresMutation.isPending}
          onVoltar={() => {
            setWizard(null);
            navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
          }}
          onConcluir={(qtdKits, itens) => salvarElevadoresMutation.mutate({ qtdKits, itens })}
        />
      );
    }

    // Totem Inteligente: wizard próprio (lista dinâmica de totens)
    if (tipoBloco === "TOT") {
      return (
        <TotemWizard
          isLight={isLight}
          salvando={salvarTotemMutation.isPending}
          onVoltar={() => {
            setWizard(null);
            navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } });
          }}
          onConcluir={(totens, itens) => salvarTotemMutation.mutate({ totens, itens })}
        />
      );
    }


    const opcoes = getOpcoes();

    // Nome do acesso (PED / VEI) — primeira etapa
    if (wizard.step === "nome_acesso") {
      const nome = wizard.nomeAcesso ?? "";
      const podeAvancar = nome.trim().length > 0;
      const avancar = () => {
        if (!podeAvancar) return;
        setWizard({ ...wizard, nomeAcesso: nome.trim(), step: "eclusa" });
      };
      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>
          <MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} b1Tipo={wizard.b1.tipo} b2Tipo={wizard.b2.tipo} isLight={isLight} />

          <div>
            <div style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: isLight ? L.gold : "#FFC000", marginBottom: 10,
            }}>
              Nome do acesso
            </div>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setWizard({ ...wizard, nomeAcesso: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") avancar(); }}
              placeholder="Ex: Entrada Principal, Portão Lateral..."
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 10,
                border: isLight ? "1px solid rgba(180,120,0,0.35)" : "1px solid rgba(255,192,0,0.35)",
                background: isLight ? "#ffffff" : "#1a1a1a",
                color: isLight ? L.text : "#fff",
                fontSize: 15,
                outline: "none",
                boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "0 0 0 1px rgba(255,192,0,0.15) inset",
              }}
            />
          </div>

          <button
            onClick={avancar}
            disabled={!podeAvancar}
            style={{
              marginTop: 8, width: "100%", padding: "16px 0",
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", border: "none", borderRadius: 999,
              color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: podeAvancar ? "pointer" : "not-allowed",
              opacity: podeAvancar ? 1 : 0.5,
            }}
          >
            CONTINUAR
          </button>
        </div>
      );
    }

    // CFTV: configuração de câmeras (switch dome/bullet + gauge de cabeamento + IA)
    if (wizard.step === "cftv_qtd") {
      const GOLD_GRAD = "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)";
      const totalCams = wizard.cftvCameras.length;
      const totalMetros = wizard.cftvCameras.reduce((s, c) => s + (c.metros || 0), 0);

      const adicionarCamera = () => {
        setWizard({
          ...wizard,
          cftvCameras: [...wizard.cftvCameras, { tipo: camTipo, metros: camMetros, ia: camIA }],
        });
        setCamMetros(0);
        setCamIA([]);
      };
      const removerCamera = (idx: number) => {
        setWizard({ ...wizard, cftvCameras: wizard.cftvCameras.filter((_, i) => i !== idx) });
      };
      const toggleIA = (opt: string) => {
        setCamIA((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
      };

      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />

          {/* Switch Dome ⟷ Bullet */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                display: "flex", position: "relative", width: 220, height: 48,
                borderRadius: 999,
                background: isLight ? "rgba(0,0,0,0.06)" : "#191921",
                border: isLight ? L.borderMd : "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  position: "absolute", top: 4, bottom: 4, width: "calc(50% - 4px)",
                  left: camTipo === "dome" ? 4 : "calc(50%)",
                  borderRadius: 999, background: GOLD_GRAD,
                  boxShadow: "0 2px 10px rgba(255,192,0,0.4)",
                  transition: "left 0.2s ease",
                }}
              />
              {(["dome", "bullet"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCamTipo(t)}
                  style={{
                    flex: 1, zIndex: 1, background: "none", border: "none", cursor: "pointer",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: camTipo === t ? "#0A0A0A" : isLight ? L.textSub : "rgba(255,255,255,0.6)",
                    transition: "color 0.2s",
                  }}
                >
                  {t === "dome" ? "Dome" : "Bullet"}
                </button>
              ))}
            </div>
          </div>

          {/* Gauge semicircular de cabeamento */}
          <CaboGauge value={camMetros} onChange={setCamMetros} isLight={isLight} />

          {/* Botão adicionar câmera (mostra o total no escopo) */}
          <button
            onClick={adicionarCamera}
            style={{
              width: "100%", height: 60, borderRadius: 999, border: "none",
              background: GOLD_GRAD, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
            }}
          >
            <span
              style={{
                width: 38, height: 38, borderRadius: "50%", background: "#0A0A0A",
                color: "#FFC000", fontSize: 17, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Montserrat', sans-serif", flexShrink: 0,
              }}
            >
              {totalCams}
            </span>
            <span style={{ color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>
              Adicionar câmera
            </span>
          </button>

          {/* I.A integrada para câmera */}
          <div>
            <div style={QUESTION}>I.A integrada para câmera</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {CFTV_IA_OPCOES.map((opt) => {
                const selected = camIA.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleIA(opt)}
                    style={{
                      minHeight: 52, borderRadius: 14, padding: "10px 8px",
                      border: selected ? "none" : isLight ? L.borderMd : "1px solid rgba(255,215,0,0.25)",
                      background: selected ? GOLD_GRAD : isLight ? L.cardSolid : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                      color: selected ? "#0A0A0A" : isLight ? L.text : "#fff",
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12,
                      lineHeight: 1.25, textAlign: "center", cursor: "pointer",
                      boxShadow: selected ? "0 4px 14px rgba(255,192,0,0.35)" : isLight ? L.shadowSm : undefined,
                      transition: "all 0.15s",
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Câmeras já adicionadas */}
          {totalCams > 0 && (
            <div>
              <div style={QUESTION}>Câmeras no escopo ({totalCams})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {wizard.cftvCameras.map((cam, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      borderRadius: 12,
                      background: isLight ? L.cardSolid : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                      border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.15)",
                      boxShadow: isLight ? L.shadowSm : undefined,
                    }}
                  >
                    <Video size={16} color={isLight ? L.gold : "#FFC000"} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? L.text : "#fff" }}>
                        {cam.tipo === "dome" ? "Dome" : "Bullet"} · {cam.metros} m
                      </div>
                      {cam.ia.length > 0 && (
                        <div style={{ fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {cam.ia.join(" · ")}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removerCamera(idx)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: "rgba(239,68,68,0.12)", color: "#EF4444",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de equipamentos (somatória das câmeras) */}
          <div>
            <div style={QUESTION}>Equipamentos</div>
            {cftvBom.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "20px 16px", borderRadius: 14,
                border: isLight ? "1px dashed rgba(0,0,0,0.15)" : "1px dashed rgba(255,255,255,0.12)",
                color: isLight ? L.textSub : "rgba(255,255,255,0.45)", fontSize: 13,
              }}>
                Adicione câmeras para ver os equipamentos do escopo.
              </div>
            ) : (
              <div style={{
                display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px",
                borderRadius: 14,
                background: isLight ? L.cardSolid : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.15)",
                boxShadow: isLight ? L.shadowSm : undefined,
              }}>
                {cftvBom.map((it) => (
                  <div key={it.cod_eq} style={{ fontSize: 13, color: isLight ? "#4a5060" : "#D1D5DB" }}>
                    {it.qtd}× {cftvEqNomes[it.cod_eq] ?? it.observacao ?? it.cod_eq}
                  </div>
                ))}
                {totalMetros > 0 && (
                  <div style={{
                    fontSize: 13, color: isLight ? "#4a5060" : "#D1D5DB",
                    borderTop: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.08)",
                    paddingTop: 6, marginTop: 2,
                  }}>
                    Cabeamento total: {totalMetros} m
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mensalidades (I.A por câmera) */}
          {cftvBomMensal.length > 0 && (
            <div>
              <div style={QUESTION}>Mensalidades</div>
              <div style={{
                display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px",
                borderRadius: 14,
                background: isLight ? L.cardSolid : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.15)",
                boxShadow: isLight ? L.shadowSm : undefined,
              }}>
                {cftvBomMensal.map((it) => {
                  const sv = cftvSvInfo[it.cod_eq];
                  const nome = sv?.nome ?? it.observacao ?? it.cod_eq;
                  return (
                    <div key={it.cod_eq} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, color: isLight ? "#4a5060" : "#D1D5DB" }}>
                      <span>{it.qtd}× {nome}</span>
                      {sv && <span style={{ flexShrink: 0, color: isLight ? L.gold : "#FFC000" }}>R$ {(sv.preco * it.qtd).toFixed(2)}/mês</span>}
                    </div>
                  );
                })}
                {Object.keys(cftvSvInfo).length > 0 && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700,
                    color: isLight ? L.text : "#fff",
                    borderTop: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.08)",
                    paddingTop: 6, marginTop: 2,
                  }}>
                    <span>Total mensal</span>
                    <span>
                      R$ {cftvBomMensal.reduce((s, it) => s + (cftvSvInfo[it.cod_eq]?.preco ?? 0) * it.qtd, 0).toFixed(2)}/mês
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={avancarCftvQtd}
            disabled={totalCams === 0}
            style={{
              width: "100%", padding: "16px 0",
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", border: "none", borderRadius: 999,
              color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1,
              cursor: totalCams === 0 ? "not-allowed" : "pointer",
              opacity: totalCams === 0 ? 0.5 : 1,
            }}
          >
            CONTINUAR
          </button>
        </div>
      );
    }

    // Cerca Elétrica: perímetro (slider 0–500, editável acima de 500)
    if (wizard.step === "cerca_perimetro") {
      const P = wizard.perimetro || 0;
      const atMax = P >= 500;
      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />
          <div style={QUESTION}>METRAGEM DO PERÍMETRO</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "24px 0" }}>
            {atMax ? (
              <input
                type="number"
                min={0}
                value={P}
                onChange={(e) => setWizard({ ...wizard, perimetro: Math.max(0, parseInt(e.target.value) || 0) })}
                style={{
                  width: 200, textAlign: "center", fontSize: 42, fontWeight: 800,
                  fontFamily: "'Montserrat', sans-serif",
                  background: "transparent", border: "none", outline: "none",
                  color: isLight ? L.text : "#fff",
                  borderBottom: `2px solid ${isLight ? L.gold : "#F59E0B"}`,
                }}
              />
            ) : (
              <div
                onClick={() => setWizard({ ...wizard, perimetro: 500 })}
                style={{
                  minWidth: 180, textAlign: "center", fontSize: 42, fontWeight: 800,
                  color: isLight ? L.text : "#fff", fontFamily: "'Montserrat', sans-serif",
                  cursor: "pointer",
                }}
              >
                {P} <span style={{ fontSize: 18, fontWeight: 600, color: isLight ? L.textSub : "rgba(255,255,255,0.6)" }}>m</span>
              </div>
            )}
            <input
              type="range"
              min={0}
              max={500}
              value={Math.min(P, 500)}
              onChange={(e) => setWizard({ ...wizard, perimetro: parseInt(e.target.value) })}
              style={{ width: "100%", accentColor: "#F59E0B" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>
              <span>0 m</span>
              <span>500 m {atMax ? "· toque no número para digitar mais" : ""}</span>
            </div>
          </div>
          <button
            onClick={() => setWizard({ ...wizard, step: "cerca_esquinas" })}
            disabled={P <= 0}
            style={{
              width: "100%", padding: "16px 0",
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", border: "none", borderRadius: 999,
              color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
              opacity: P <= 0 ? 0.5 : 1,
            }}
          >
            CONTINUAR
          </button>
        </div>
      );
    }

    // Cerca Elétrica: quantidade de esquinas (0–10)
    if (wizard.step === "cerca_esquinas") {
      const E = wizard.esquinas || 0;
      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />
          <div style={QUESTION}>QUANTIDADE DE ESQUINAS</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <button
                onClick={() => setWizard({ ...wizard, esquinas: Math.max(0, E - 1) })}
                style={{
                  width: 56, height: 56, borderRadius: "50%",
                  border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.28)",
                  background: isLight ? L.cardSolid : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                  color: isLight ? L.text : "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Minus size={22} />
              </button>
              <div style={{
                minWidth: 84, textAlign: "center", fontSize: 42, fontWeight: 800,
                color: isLight ? L.text : "#fff", fontFamily: "'Montserrat', sans-serif",
              }}>
                {E}
              </div>
              <button
                onClick={() => setWizard({ ...wizard, esquinas: Math.min(10, E + 1) })}
                style={{
                  width: 56, height: 56, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 12px rgba(255,192,0,0.35)",
                }}
              >
                <Plus size={22} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>0 a 10</div>
          </div>
          <button
            onClick={() => setWizard({ ...wizard, step: "resumo" })}
            style={{
              width: "100%", padding: "16px 0",
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", border: "none", borderRadius: 999,
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
        autoSaveGuardRef.current = null;
        setWizard(null);
      };

      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
              <div style={{ fontSize: 11, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>Configuração concluída</div>
            </div>
            <CheckCircle2 size={22} color="#22C55E" />
          </div>

          {(tipoBloco === "PED" || tipoBloco === "VEI") ? (<MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} b1Tipo={wizard.b1.tipo} b2Tipo={wizard.b2.tipo} isLight={isLight} />) : (<WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />)}

          {/* Editor de equipamentos (auto-semeado após salvar) */}
          {blocoSalvoId && savedConfig ? (
            <BlocoItensEditor
              visitaBlocoId={blocoSalvoId}
              codigo={gerarCodigoBloco(savedConfig)}
              tipoBloco={savedConfig.tipoBloco}
              tecnologia={savedConfig.tecnologia ?? null}
              qtdDome={savedConfig.qtdDome}
              qtdBullet={savedConfig.qtdBullet}
              cftvCameras={savedConfig.cftvCameras}
              perimetro={savedConfig.perimetro}
              esquinas={savedConfig.esquinas}
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
              padding: "16px", background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", border: "none", borderRadius: 999,
              color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
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
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>

          {(tipoBloco === "PED" || tipoBloco === "VEI") ? (<MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} b1Tipo={wizard.b1.tipo} b2Tipo={wizard.b2.tipo} isLight={isLight} />) : (<WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />)}

          <div style={{ marginBottom: 24 }}>
            <BarreiraHeader
              label={nomeBarreira(tipoBloco, "Externa", wizard.b1.tipo)}
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
                            <OptionIcon valor={op.valor} />
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
              <BarreiraHeader label={nomeBarreira(tipoBloco, "Interna", wizard.b2.tipo)} done={false} isLight={isLight} />

              {stepsRespondidosB2.map((step) => (<ConfirmedAnswer key={step} step={step} />))}

              {isB2Step && (
                <div ref={bottomRef}>
                  {getLabelPergunta() && <div style={QUESTION}>{getLabelPergunta()}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {opcoes.map((op) => (
                      <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
                        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <OptionIcon valor={op.valor} />
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

    // CFTV: tipo de tecnologia — botões lado a lado (fundo dourado, texto preto)
    if (wizard.step === "tecnologia" && tipoBloco === "CFTV") {
      return (
        <div style={PAGE}>
          <div style={HEADER}>
            <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
            <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
          </div>
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />

          <div style={QUESTION}>TIPO DE TECNOLOGIA?</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { valor: "IP", label: "IP", Icon: Wifi },
              { valor: "ANAL", label: "Analógico", Icon: Cable },
            ].map(({ valor, label, Icon }) => (
              <button
                key={valor}
                onClick={() => selecionar(valor)}
                style={{
                  height: 64, borderRadius: 16, border: "none",
                  background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
                  color: "#0A0A0A", fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 800, fontSize: 15, letterSpacing: "0.04em",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <Icon size={18} color="#0A0A0A" />
                {label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Eclusa / Tecnologia / outros steps simples
    return (
      <div style={PAGE}>
        <div style={HEADER}>
          <button style={BACK_BTN} onClick={voltarPasso}><ArrowLeft size={18} /></button>
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16, color: isLight ? L.text : undefined }}>{catNome}</div>
        </div>

        {wizard && ((tipoBloco === "PED" || tipoBloco === "VEI") ? (
          <MacroStepIndicator step={wizard.step} tipo={tipoBloco} eclusa={wizard.eclusa} b1Tipo={wizard.b1.tipo} b2Tipo={wizard.b2.tipo} isLight={isLight} />
        ) : (
          <WizardStepIndicator steps={getStepSequence(wizard, tipoBloco)} currentStep={wizard.step} isLight={isLight} />
        ))}


        {getLabelPergunta() && <div style={QUESTION}>{getLabelPergunta()}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opcoes.map((op) => (
            <button key={op.valor} style={optionStyle()} onClick={() => selecionar(op.valor)}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <OptionIcon valor={op.valor} />
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
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 18, color: isLight ? L.text : "#fff" }}>
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
          blocosAdicionados.map((bloco: any) => {
            const itens = (itensPorBloco as Record<string, { qtd: number; label: string }[]>)[bloco.id] ?? [];
            const titulo = bloco.nome_acesso?.trim() || bloco.nome_descritivo;
            return (
              <div
                key={bloco.id}
                onClick={() => abrirBlocoParaEditar(bloco)}
                style={{
                  background: isLight ? L.cardSolid : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                  border: isLight ? L.borderMd : "1px solid rgba(255,215,0,0.15)",
                  boxShadow: isLight ? L.shadowSm : undefined,
                  borderRadius: 14, padding: "14px 16px",
                  display: "flex", flexDirection: "column", gap: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: isLight ? L.text : "#fff" }}>
                    {titulo}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removerMutation.mutate(bloco.id); }}
                    disabled={removerMutation.isPending}
                    style={{
                      background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 10, width: 36, height: 36,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#EF4444", cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ height: 1, background: "rgba(255,215,0,0.15)" }} />
                {itens.length === 0 ? (
                  <div style={{ fontSize: 13, color: isLight ? L.textSub : "rgba(255,255,255,0.5)" }}>
                    Nenhum equipamento configurado
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {itens.map((it, i) => (
                      <div key={i} style={{ fontSize: 13, color: isLight ? "#4a5060" : "#D1D5DB" }}>
                        {it.qtd}× {it.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button onClick={() => iniciarWizard()} style={{
        marginTop: 8, padding: "16px 0",
        background: isLight ? L.goldBg : "linear-gradient(135deg, #FFD700, #FFB300)",
        border: isLight ? L.goldBorder : "none", borderRadius: 14,
        color: isLight ? L.gold : "#0A0A0A", fontSize: 14, fontWeight: 800,
        cursor: "pointer", letterSpacing: 1, boxShadow: isLight ? L.shadowSm : undefined,
      }}>+ ADICIONAR</button>
    </div>
  );
}
