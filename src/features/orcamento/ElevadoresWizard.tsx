// Wizard do módulo "Elevadores".
// Passo único: usuário escolhe a quantidade de Kits Antena p/ Elevador.
// Cada kit expande em 7 equipamentos automáticos (com badge AUTO).
// Ao concluir, chama onConcluir(qtdKits, itens) para persistir na proposta.

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Minus, Plus, PanelRightOpen,
  ShieldCheck, Building2,
} from "lucide-react";

export interface KitItem {
  cod_eq: string;
  nome: string;
  marca: string;
  modelo: string;
  qtdPorKit: number;
}

export const KIT_ANTENA: KitItem[] = [
  { cod_eq: "ELV_KIT_SWITCH",   nome: "Switch POE 4P p/ elevadores",       marca: "Intelbras", modelo: "POE SF 500 HI-POE", qtdPorKit: 1 },
  { cod_eq: "ELV_KIT_ROTEADOR", nome: "Roteador Wi-Fi p/ elevadores",      marca: "Intelbras", modelo: "W4-300S",           qtdPorKit: 2 },
  { cod_eq: "ELV_KIT_ANTENA",   nome: "Antena Transmissora p/ elevadores", marca: "Intelbras", modelo: "Wom 5a",            qtdPorKit: 1 },
  { cod_eq: "ELV_KIT_SUPORTE",  nome: "Suporte p/ IVA p/ elevadores",      marca: "ConfiSeg",  modelo: "40 cm",             qtdPorKit: 2 },
  { cod_eq: "ELV_KIT_TELEFONE", nome: "Telefone IP POE p/ elevadores",     marca: "Intelbras", modelo: "TDMI 400 IP POE",   qtdPorKit: 1 },
  { cod_eq: "ELV_KIT_CAMERA",   nome: "Câmera IP Dome p/ elevadores",      marca: "Intelbras", modelo: "VIP 1230 D G4",     qtdPorKit: 1 },
  { cod_eq: "ELV_KIT_FILTRO",   nome: "Filtro de Linha p/ elevadores",     marca: "Intelbras", modelo: "5 Tomadas",         qtdPorKit: 1 },
];

export interface ElevadorItemCalc {
  cod_eq: string;
  qtd: number;
  regra: string;
}

export function computeElevadores(qtdKits: number, overrides?: Record<string, number>): ElevadorItemCalc[] {
  return KIT_ANTENA.map((k) => ({
    cod_eq: k.cod_eq,
    qtd: overrides?.[k.cod_eq] ?? qtdKits * k.qtdPorKit,
    regra: `incluído pelo Kit Antena (${k.qtdPorKit}× por kit × ${qtdKits} kit${qtdKits === 1 ? "" : "s"})`,
  }));
}

interface Props {
  isLight: boolean;
  onVoltar: () => void;
  onConcluir: (qtdKits: number, itens: ElevadorItemCalc[]) => Promise<void> | void;
  salvando?: boolean;
}

type StepId = "kits" | "revisao";
const STEP_TITLE: Record<StepId, string> = { kits: "Kits", revisao: "Revisão" };

export function ElevadoresWizard({ isLight, onVoltar, onConcluir, salvando = false }: Props) {
  const [qtdKits, setQtdKits] = useState(1);
  const [step, setStep] = useState<StepId>("kits");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [resumoOpen, setResumoOpen] = useState(false);

  const gold = "#F59E0B";
  const goldDark = "#b87800";
  const steps: StepId[] = ["kits", "revisao"];
  const idx = steps.indexOf(step);

  const itens = useMemo(
    () => computeElevadores(qtdKits, step === "revisao" ? overrides : undefined),
    [qtdKits, overrides, step],
  );
  const totalUnid = itens.reduce((s, i) => s + i.qtd, 0);

  const cardStyle: React.CSSProperties = {
    background: isLight ? "linear-gradient(135deg,#fff 0%,#f5f6f8 100%)" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.14)",
    borderRadius: 16, padding: 16,
  };
  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, letterSpacing: "0.16em",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)", marginBottom: 10,
  };
  const circle = (): React.CSSProperties => ({
    width: 44, height: 44, borderRadius: "50%",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.18)",
    background: isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    color: isLight ? "#0a0b0e" : "#fff",
  });
  const circlePrimary = (): React.CSSProperties => ({
    width: 44, height: 44, borderRadius: "50%", border: "none",
    background: gold, color: "#fff", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 12px rgba(255,192,0,0.35)",
  });

  const Resumo = (
    <div style={{ ...cardStyle, position: "sticky", top: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={18} color={gold} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", color: isLight ? "#0a0b0e" : "#fff" }}>
            RESUMO
          </span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: gold,
          padding: "3px 8px", borderRadius: 999, background: "rgba(245,158,11,0.12)",
        }}>{qtdKits} Kit{qtdKits === 1 ? "" : "s"}</span>
      </div>

      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: "0.14em",
        color: gold, marginBottom: 6, textTransform: "uppercase",
      }}>
        Elevadores — {qtdKits} Kit{qtdKits === 1 ? "" : "s"} Antena
      </div>
      {itens.map((it) => {
        const meta = KIT_ANTENA.find((k) => k.cod_eq === it.cod_eq)!;
        return (
          <div key={it.cod_eq} style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            padding: "6px 0", borderBottom: isLight ? "1px dashed rgba(0,0,0,0.06)" : "1px dashed rgba(255,255,255,0.06)",
            gap: 8,
          }} title={it.regra}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>
                {meta.nome}
              </div>
              <div style={{ fontSize: 10, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)" }}>
                {meta.marca} · {meta.modelo}
                <span style={{
                  marginLeft: 6, padding: "1px 5px", borderRadius: 4,
                  background: "rgba(180,120,0,0.15)", color: gold, fontWeight: 800, fontSize: 9,
                }}>AUTO</span>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: gold }}>{it.qtd}</div>
          </div>
        );
      })}
      <div style={{
        marginTop: 8, padding: "10px 12px", borderRadius: 10,
        background: "rgba(180,120,0,0.10)",
        display: "flex", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: gold }}>ITENS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: isLight ? "#0a0b0e" : "#fff" }}>{totalUnid} un.</span>
      </div>
    </div>
  );

  function renderStep() {
    if (step === "kits") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <div style={secLabel}>ADICIONAR KIT ANTENA</div>
            <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "rgba(255,255,255,0.6)", marginBottom: 20 }}>
              1 kit corresponde a 1 elevador. Todos os equipamentos abaixo são incluídos automaticamente.
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "12px 0" }}>
              <Building2 size={56} color={gold} strokeWidth={1.5} />
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <button style={circle()} onClick={() => setQtdKits((n) => Math.max(1, n - 1))} aria-label="-">
                  <Minus size={20} />
                </button>
                <div style={{
                  minWidth: 84, textAlign: "center", fontSize: 42, fontWeight: 800,
                  color: isLight ? "#0a0b0e" : "#fff", fontFamily: "'Montserrat', sans-serif",
                }}>{qtdKits}</div>
                <button style={circlePrimary()} onClick={() => setQtdKits((n) => Math.min(50, n + 1))} aria-label="+">
                  <Plus size={20} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)" }}>
                {qtdKits === 1 ? "1 elevador" : `${qtdKits} elevadores`}
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setAccordionOpen((v) => !v)}
              style={{
                width: "100%", padding: "14px 16px", background: "transparent", border: "none",
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                color: isLight ? "#0a0b0e" : "#fff",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em" }}>
                O QUE COMPÕE CADA KIT
              </span>
              <ChevronDown size={16}
                style={{ transition: "transform 0.2s", transform: accordionOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {accordionOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                {KIT_ANTENA.map((k) => (
                  <div key={k.cod_eq} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "8px 0",
                    borderBottom: isLight ? "1px dashed rgba(0,0,0,0.08)" : "1px dashed rgba(255,255,255,0.08)",
                    gap: 8,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? "#0a0b0e" : "#fff" }}>
                        {k.nome}
                      </div>
                      <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)" }}>
                        {k.marca} · {k.modelo}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: gold, whiteSpace: "nowrap" }}>
                      ×{k.qtdPorKit}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // revisao
    const subTotal = itens.reduce((s, i) => s + i.qtd, 0);
    return (
      <div style={cardStyle}>
        <div style={secLabel}>REVISÃO DO BLOCO</div>
        <div style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.65)", marginBottom: 12 }}>
          Ajuste as quantidades item a item para casos excepcionais. O padrão é <b>{qtdKits}× o kit</b>.
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {itens.map((it) => {
            const meta = KIT_ANTENA.find((k) => k.cod_eq === it.cod_eq)!;
            return (
              <div key={it.cod_eq} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 0",
                borderBottom: isLight ? "1px dashed rgba(0,0,0,0.08)" : "1px dashed rgba(255,255,255,0.08)",
                gap: 12,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? "#0a0b0e" : "#fff" }}>
                    {meta.nome}
                  </div>
                  <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)" }}>
                    {meta.marca} · {meta.modelo} · {meta.cod_eq}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() =>
                      setOverrides((o) => ({ ...o, [it.cod_eq]: Math.max(0, (o[it.cod_eq] ?? qtdKits * meta.qtdPorKit) - 1) }))
                    }
                    style={{
                      width: 30, height: 30, borderRadius: "50%",
                      border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.2)",
                      background: "transparent", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isLight ? "#0a0b0e" : "#fff",
                    }}
                    aria-label="-"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={it.qtd}
                    onChange={(e) => setOverrides((o) => ({ ...o, [it.cod_eq]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{
                      width: 50, textAlign: "center", padding: "4px 6px",
                      border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8, background: isLight ? "#fff" : "#16161d",
                      color: isLight ? "#0a0b0e" : "#fff", fontWeight: 700, fontSize: 13,
                    }}
                  />
                  <button
                    onClick={() =>
                      setOverrides((o) => ({ ...o, [it.cod_eq]: (o[it.cod_eq] ?? qtdKits * meta.qtdPorKit) + 1 }))
                    }
                    style={{
                      width: 30, height: 30, borderRadius: "50%", border: "none",
                      background: gold, color: "#fff", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label="+"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 12, padding: "10px 12px", borderRadius: 10,
          background: "rgba(180,120,0,0.10)",
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: goldDark }}>TOTAL DE ITENS</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: isLight ? "#0a0b0e" : "#fff" }}>{subTotal} un.</span>
        </div>
      </div>
    );
  }

  function voltar() {
    if (idx > 0) setStep(steps[idx - 1]);
    else onVoltar();
  }
  function avancar() {
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  const podeConcluir = qtdKits >= 1 && itens.some((i) => i.qtd > 0);

  return (
    <div style={{ padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 16, color: isLight ? "#0a0b0e" : "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={voltar}
          style={{
            background: isLight ? "#fff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12, width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: isLight ? "#0a0b0e" : "#fff",
          }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 16 }}>
            Elevadores
          </div>
          <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)" }}>
            {STEP_TITLE[step]} · {idx + 1}/{steps.length}
          </div>
        </div>
        <button onClick={() => setResumoOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", borderRadius: 999,
            background: "rgba(180,120,0,0.10)", border: "1px solid rgba(180,120,0,0.28)",
            color: gold, fontWeight: 700, fontSize: 11, cursor: "pointer",
          }}>
          <PanelRightOpen size={14} /> RESUMO
        </button>
      </div>

      {/* Stepper */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 4, minWidth: "max-content" }}>
          {steps.map((s, i) => {
            const cur = s === step, done = i < idx;
            return (
              <div key={s} onClick={() => (done || cur ? setStep(s) : undefined)}
                style={{
                  cursor: done || cur ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
                  borderRadius: 999,
                  background: cur ? "rgba(180,120,0,0.14)" : "transparent",
                  border: cur ? "1px solid rgba(180,120,0,0.35)" : "1px solid transparent",
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: cur || done ? gold : (isLight ? "#e5e7eb" : "#191921"),
                  color: cur || done ? "#fff" : (isLight ? "#6b7280" : "rgba(255,255,255,0.4)"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800,
                }}>{done ? <Check size={10} /> : i + 1}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: cur ? (isLight ? "#0a0b0e" : "#fff") : (isLight ? "#6b7280" : "rgba(255,255,255,0.5)"),
                }}>{STEP_TITLE[s]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {renderStep()}

      {/* Navegação */}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={voltar}
          style={{
            flex: 1, padding: "14px 0", borderRadius: 999,
            background: "transparent",
            border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.15)",
            color: isLight ? "#0a0b0e" : "#fff", fontWeight: 800, fontSize: 12, letterSpacing: "0.14em", cursor: "pointer",
          }}>
          VOLTAR
        </button>
        {step !== "revisao" ? (
          <button onClick={avancar}
            disabled={qtdKits < 1}
            style={{
              flex: 2, padding: "14px 0", borderRadius: 999, border: "none",
              background: gold, color: "#0A0A0A", fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
              cursor: "pointer", opacity: qtdKits < 1 ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            AVANÇAR <ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={() => onConcluir(qtdKits, itens.filter((i) => i.qtd > 0))}
            disabled={!podeConcluir || salvando}
            style={{
              flex: 2, padding: "14px 0", borderRadius: 999, border: "none",
              background: !podeConcluir ? "#9ca3af" : gold, color: "#0A0A0A",
              fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
              cursor: !podeConcluir || salvando ? "not-allowed" : "pointer",
              opacity: salvando ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            <Check size={14} /> {salvando ? "SALVANDO…" : "ADICIONAR À PROPOSTA"}
          </button>
        )}
      </div>

      {/* Drawer resumo (mobile) */}
      {resumoOpen && (
        <>
          <div onClick={() => setResumoOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40 }} />
          <div style={{
            position: "fixed", right: 0, top: 0, bottom: 0, width: "min(360px, 92vw)",
            background: isLight ? "#f5f6f8" : "#0a0b0e", zIndex: 50,
            padding: 16, overflowY: "auto",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.14em", color: isLight ? "#0a0b0e" : "#fff" }}>
                RESUMO DO ORÇAMENTO
              </span>
              <button onClick={() => setResumoOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.2)",
                  background: "transparent", cursor: "pointer",
                  color: isLight ? "#0a0b0e" : "#fff",
                }}>×</button>
            </div>
            {Resumo}
          </div>
        </>
      )}
    </div>
  );
}
