// Wizard do bloco Alarme — fluxo por ZONAS (Intelbras).
// Etapa 1: tecnologia (Com fio AMT 4010 / Sem fio AMT 8000).
// Etapa 2: montagem das zonas (tipo de sensor + qtd + cabeamento/TX) com BOM ao vivo.
// A central, o expansor de zonas (XEZ 4008 a cada 8 zonas), o cabo (EQ302) e o
// XAR 4000 (Residência/Galpão) são calculados automaticamente pelo alarmeEngine.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Cable, Wifi, Eye, Radar, Signal, DoorClosed, DoorOpen, Square,
  X, Plus, Minus, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CaboGauge } from "./CaboGauge";
import {
  computeAlarme,
  ALARME_LABELS,
  SENSOR_INFO,
  MAX_SENSORES_POR_ZONA,
  type AlarmeConfig,
  type AlarmeRamo,
  type AlarmeSensorTipo,
  type AlarmeZona,
  type CalcRow,
} from "./alarmeEngine";

interface Props {
  isLight: boolean;
  salvando?: boolean;
  /** Residência/Galpão: adiciona XAR 4000 Smart à central com fio. */
  residenciaOuGalpao?: boolean;
  /** Projeto de Portaria Remota: a central (AMT 4010 + GPRS + bateria) já vem
   *  no bloco CENT — o Alarme COM FIO não adiciona outra. */
  portariaRemota?: boolean;
  onVoltar: () => void;
  onConcluir: (config: AlarmeConfig, itens: CalcRow[]) => void;
}

const GOLD_GRAD = "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)";
const DARK_CARD = "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)";

// Tipos de sensor exibidos por ramo (ordem da spec)
const SENSORES_CAB: { tipo: AlarmeSensorTipo; Icon: typeof Eye }[] = [
  { tipo: "ivp_int", Icon: Eye },
  { tipo: "ivp_ext", Icon: Radar },
  { tipo: "iva40", Icon: Signal },
  { tipo: "iva80", Icon: Signal },
  { tipo: "porta_int", Icon: DoorClosed },
  { tipo: "porta_ext", Icon: DoorOpen },
  { tipo: "janela_int", Icon: Square },
  { tipo: "janela_ext", Icon: Square },
];
const SENSORES_SF: { tipo: AlarmeSensorTipo; Icon: typeof Eye }[] = [
  { tipo: "sf_ivp_int", Icon: Eye },
  { tipo: "sf_ivp_ext", Icon: Radar },
  { tipo: "sf_iva40", Icon: Signal },
  { tipo: "sf_abertura", Icon: DoorClosed },
];

export function AlarmeWizard({
  isLight,
  salvando = false,
  residenciaOuGalpao = false,
  portariaRemota = false,
  onVoltar,
  onConcluir,
}: Props) {
  const [step, setStep] = useState<"tecnologia" | "zonas">("tecnologia");
  const [ramo, setRamo] = useState<AlarmeRamo | null>(null);
  const [zonas, setZonas] = useState<AlarmeZona[]>([]);
  const [repetidores, setRepetidores] = useState(0);

  // Zona em configuração (antes de "Adicionar zona")
  const [tipoSel, setTipoSel] = useState<AlarmeSensorTipo | null>(null);
  const [qtdSel, setQtdSel] = useState(1);
  const [metrosSel, setMetrosSel] = useState(0);
  const [txSel, setTxSel] = useState(false);

  const config: AlarmeConfig = {
    ramo: ramo ?? "CAB",
    zonas,
    repetidores,
    residenciaOuGalpao,
    portariaRemota,
  };
  const result = computeAlarme(config);
  const bomCodes = result.itens.map((i) => i.cod_eq);

  // Nomes/modelos do catálogo (fallback: ALARME_LABELS)
  const { data: eqNomes = {} } = useQuery({
    queryKey: ["alarme_bom_nomes", [...bomCodes].sort().join(",")],
    enabled: bomCodes.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipamentos")
        .select("code,nome,modelo")
        .in("code", bomCodes);
      const map: Record<string, string> = {};
      for (const e of (data as any[]) ?? []) map[e.code] = e.modelo || e.nome;
      return map;
    },
  });
  const nomeEq = (cod: string) =>
    eqNomes[cod] ?? (ALARME_LABELS[cod] ? `${ALARME_LABELS[cod].nome} ${ALARME_LABELS[cod].modelo}` : cod);

  // ── Estilos (padrão do app) ────────────────────────────────────────────────
  const PAGE: React.CSSProperties = {
    padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 16,
    color: isLight ? "#0a0b0e" : "#fff",
  };
  const HEADER: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 };
  const BACK_BTN: React.CSSProperties = {
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12, width: 40, height: 40, display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", color: isLight ? "#0a0b0e" : "#fff",
  };
  const QUESTION: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14,
    letterSpacing: "0.06em", color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)",
    textTransform: "uppercase", margin: "4px 2px 8px",
  };
  const LIST_CARD: React.CSSProperties = {
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,215,0,0.15)",
    borderRadius: 14,
    boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
  };
  const CIRCLE_BTN: React.CSSProperties = {
    width: 40, height: 40, borderRadius: "50%",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.28)",
    background: isLight ? "#ffffff" : "#16161d",
    color: isLight ? "#0a0b0e" : "#fff",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  };

  // Indicador de passos (2 etapas)
  function StepDots() {
    const passos = ["Tecnologia", "Zonas e sensores"];
    const atual = step === "tecnologia" ? 0 : 1;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, overflowX: "auto" }}>
        {passos.map((p, i) => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span
              style={{
                width: 26, height: 26, borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: i <= atual ? "#F59E0B" : isLight ? "#f0f1f4" : "rgba(255,255,255,0.06)",
                color: i <= atual ? "#0A0A0A" : isLight ? "#8a909e" : "rgba(200,200,200,0.4)",
                fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat', sans-serif",
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: 12,
                fontWeight: i === atual ? 700 : 400,
                color: i === atual ? (isLight ? "#0a0b0e" : "#fff") : isLight ? "#8a909e" : "rgba(200,200,200,0.5)",
              }}
            >
              {p}
            </span>
            {i < passos.length - 1 && (
              <span style={{ width: 24, height: 1, background: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)" }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Etapa 1 — Tecnologia ───────────────────────────────────────────────────
  if (step === "tecnologia") {
    return (
      <div style={PAGE}>
        <div style={HEADER}>
          <button style={BACK_BTN} onClick={onVoltar}><ArrowLeft size={18} /></button>
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16 }}>Alarme</div>
        </div>
        <StepDots />

        <div style={QUESTION}>SISTEMA DE ALARME?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {([
            { val: "CAB", label: "Com fio", Icon: Cable },
            { val: "SF", label: "Sem fio", Icon: Wifi },
          ] as { val: AlarmeRamo; label: string; Icon: typeof Cable }[]).map(({ val, label, Icon }) => (
            <button
              key={val}
              onClick={() => {
                if (val !== ramo) {
                  // Trocou de tecnologia: sensores são incompatíveis — zera o escopo
                  setTipoSel(null);
                  setZonas([]);
                  setRepetidores(0);
                  setTxSel(false);
                  setMetrosSel(0);
                  setQtdSel(1);
                }
                setRamo(val);
                setStep("zonas");
              }}
              style={{
                height: 64, borderRadius: 16, border: "none",
                background: GOLD_GRAD, color: "#0A0A0A",
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: 15,
                letterSpacing: "0.04em", cursor: "pointer",
                boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Icon size={18} color="#0A0A0A" />
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", fontFamily: "'Montserrat', sans-serif" }}>
          Com fio: central AMT 4010 · Sem fio: central AMT 8000
        </div>
      </div>
    );
  }

  // ── Etapa 2 — Zonas e sensores ─────────────────────────────────────────────
  const isCab = ramo === "CAB";
  const sensores = isCab ? SENSORES_CAB : SENSORES_SF;
  const infoSel = tipoSel ? SENSOR_INFO[tipoSel] : null;

  const adicionarZona = () => {
    if (!tipoSel) return;
    setZonas((prev) => [
      ...prev,
      { tipo: tipoSel, qtd: qtdSel, metros: isCab && !txSel ? metrosSel : 0, tx: isCab && txSel },
    ]);
    setMetrosSel(0);
  };
  const removerZona = (idx: number) => setZonas((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div style={PAGE}>
      <div style={HEADER}>
        <button style={BACK_BTN} onClick={() => setStep("tecnologia")}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Montserrat'", fontWeight: 600, fontSize: 16 }}>Alarme</div>
          <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)" }}>
            {isCab ? "Com fio — AMT 4010" : "Sem fio — AMT 8000"}
          </div>
        </div>
      </div>
      <StepDots />

      {/* Tipo de sensor */}
      <div>
        <div style={QUESTION}>Tipo de sensor</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {sensores.map(({ tipo, Icon }) => {
            const selected = tipoSel === tipo;
            const info = SENSOR_INFO[tipo];
            return (
              <button
                key={tipo}
                onClick={() => setTipoSel(tipo)}
                style={{
                  minHeight: 56, borderRadius: 14, padding: "10px 8px",
                  border: selected ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
                  background: selected ? GOLD_GRAD : isLight ? "#f5f6f8" : DARK_CARD,
                  color: selected ? "#0A0A0A" : isLight ? "#0a0b0e" : "#fff",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
                  lineHeight: 1.25, cursor: "pointer",
                  boxShadow: selected ? "0 4px 14px rgba(255,192,0,0.35)" : undefined,
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <Icon size={16} />
                <span>
                  {info.label}
                  {info.par ? " (par)" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sensores na zona */}
      <div style={{ ...LIST_CARD, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>
            {infoSel?.par ? "Pares na zona" : "Sensores na zona"}
          </div>
          <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", marginTop: 2 }}>
            Zona = ambiente · até {MAX_SENSORES_POR_ZONA} {infoSel?.par ? "pares" : "sensores"} por zona
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button style={CIRCLE_BTN} onClick={() => setQtdSel((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
          <span style={{ minWidth: 24, textAlign: "center", fontSize: 20, fontWeight: 800, fontFamily: "'Montserrat', sans-serif" }}>{qtdSel}</span>
          <button
            style={{ ...CIRCLE_BTN, border: "none", background: "#F59E0B", color: "#0A0A0A", boxShadow: "0 2px 12px rgba(245,158,11,0.35)" }}
            onClick={() => setQtdSel((q) => Math.min(MAX_SENSORES_POR_ZONA, q + 1))}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Com fio: cabo ou transmissor TX */}
      {isCab && (
        <>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                display: "flex", position: "relative", width: 260, height: 48, borderRadius: 999,
                background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  position: "absolute", top: 4, bottom: 4, width: "calc(50% - 4px)",
                  left: !txSel ? 4 : "calc(50%)",
                  borderRadius: 999, background: GOLD_GRAD,
                  boxShadow: "0 2px 10px rgba(255,192,0,0.4)", transition: "left 0.2s ease",
                }}
              />
              {([[false, "Com cabo"], [true, "TX sem fio"]] as [boolean, string][]).map(([val, label]) => (
                <button
                  key={label}
                  onClick={() => setTxSel(val)}
                  style={{
                    flex: 1, zIndex: 1, background: "none", border: "none", cursor: "pointer",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: txSel === val ? "#0A0A0A" : isLight ? "#4a5060" : "rgba(255,255,255,0.6)",
                    transition: "color 0.2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {txSel ? (
            <div style={{ fontSize: 12, textAlign: "center", color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)", fontFamily: "'Montserrat', sans-serif" }}>
              Sensor distante sem cabeamento — 1 transmissor TX 4020 Smart por sensor.
            </div>
          ) : (
            <CaboGauge value={metrosSel} onChange={setMetrosSel} isLight={isLight} />
          )}
        </>
      )}

      {/* Adicionar zona */}
      <button
        onClick={adicionarZona}
        disabled={!tipoSel}
        style={{
          width: "100%", height: 60, borderRadius: 999, border: "none",
          background: GOLD_GRAD, cursor: tipoSel ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          boxShadow: "0 6px 20px rgba(255,192,0,0.35)", opacity: tipoSel ? 1 : 0.5,
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
          {zonas.length}
        </span>
        <span style={{ color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>
          Adicionar zona
        </span>
      </button>

      {/* Zonas do projeto */}
      {zonas.length > 0 && (
        <div>
          <div style={QUESTION}>Zonas do projeto ({zonas.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {zonas.map((z, idx) => {
              const info = SENSOR_INFO[z.tipo];
              return (
                <div key={idx} style={{ ...LIST_CARD, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                  <ShieldCheck size={16} color={isLight ? "#b87800" : "#FFC000"} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      Zona {String(idx + 1).padStart(2, "0")} · {info.label}
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)" }}>
                      {z.qtd} {info.par ? (z.qtd === 1 ? "par" : "pares") : (z.qtd === 1 ? "sensor" : "sensores")}
                      {isCab ? (z.tx ? " · TX sem fio" : ` · ${z.metros} m`) : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => removerZona(idx)}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: "rgba(239,68,68,0.12)", color: "#EF4444",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sem fio: repetidor de sinal */}
      {!isCab && (
        <div style={{ ...LIST_CARD, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>
              Repetidor de sinal REP 8000
            </div>
            <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", marginTop: 2 }}>
              Sensores sem fio têm alcance limitado — avalie a distância no local.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button style={CIRCLE_BTN} onClick={() => setRepetidores((r) => Math.max(0, r - 1))}><Minus size={16} /></button>
            <span style={{ minWidth: 24, textAlign: "center", fontSize: 20, fontWeight: 800, fontFamily: "'Montserrat', sans-serif" }}>{repetidores}</span>
            <button
              style={{ ...CIRCLE_BTN, border: "none", background: "#F59E0B", color: "#0A0A0A", boxShadow: "0 2px 12px rgba(245,158,11,0.35)" }}
              onClick={() => setRepetidores((r) => r + 1)}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Equipamentos (BOM ao vivo) */}
      <div>
        <div style={QUESTION}>Equipamentos</div>
        {isCab && portariaRemota && (
          <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", fontFamily: "'Montserrat', sans-serif", margin: "-4px 2px 8px" }}>
            Central, GPRS e bateria já inclusos na Central de Portaria Remota — não duplicados aqui.
          </div>
        )}
        {result.itens.length === 0 ? (
          <div
            style={{
              textAlign: "center", padding: "20px 16px", borderRadius: 14,
              border: isLight ? "1px dashed rgba(0,0,0,0.15)" : "1px dashed rgba(255,255,255,0.12)",
              color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)", fontSize: 13,
            }}
          >
            Adicione zonas para ver os equipamentos do escopo.
          </div>
        ) : (
          <div style={{ ...LIST_CARD, display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px" }}>
            {result.itens.map((it) => (
              <div key={it.cod_eq} style={{ fontSize: 13, color: isLight ? "#4a5060" : "#D1D5DB" }}>
                {it.qtd}× {nomeEq(it.cod_eq)}
              </div>
            ))}
            {isCab && result.totalMetros > 0 && (
              <div
                style={{
                  fontSize: 13, color: isLight ? "#4a5060" : "#D1D5DB",
                  borderTop: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.08)",
                  paddingTop: 6, marginTop: 2,
                }}
              >
                Cabeamento total: {result.totalMetros} m
              </div>
            )}
          </div>
        )}
      </div>

      {/* Concluir */}
      <button
        onClick={() => ramo && onConcluir({ ...config, ramo }, result.itens)}
        disabled={zonas.length === 0 || salvando}
        style={{
          width: "100%", padding: "16px 0",
          background: "#F59E0B", border: "none", borderRadius: 999,
          color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1,
          cursor: zonas.length === 0 || salvando ? "not-allowed" : "pointer",
          opacity: zonas.length === 0 || salvando ? 0.5 : 1,
          boxShadow: "0 6px 20px rgba(245,158,11,0.35)",
          textTransform: "uppercase",
        }}
      >
        {salvando ? "Salvando..." : "Concluir bloco"}
      </button>
    </div>
  );
}
