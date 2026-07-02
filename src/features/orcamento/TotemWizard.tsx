// Wizard do módulo "Totem Inteligente".
// Lista dinâmica de totens; cada um define sua qtd de câmeras (2, 3 ou 4 — padrão 3).
// Composição por totem: 1 Switch SF800Q+, 1 Fonte 12V 5A, 1 Poste 2,6m + N câmeras VIP 1230B G4.
// Ao concluir, chama onConcluir(totens, itens) para persistir na proposta.

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Minus, Plus, PanelRightOpen,
  ShieldCheck, Cctv, Trash2,
} from "lucide-react";

export interface TotemBaseItem {
  cod_eq: string;
  nome: string;
  marca: string;
  modelo: string;
  qtdPorTotem: number | "cameras"; // "cameras" = usa a qtd escolhida
}

export const TOTEM_BASE: TotemBaseItem[] = [
  { cod_eq: "TOT_SWITCH", nome: "Switch 8P p/ Totem",             marca: "Intelbras", modelo: "SF800Q+",      qtdPorTotem: 1 },
  { cod_eq: "TOT_FONTE",  nome: "Fonte 12V 5A p/ Totem",          marca: "MCM",       modelo: "12V 5A",       qtdPorTotem: 1 },
  { cod_eq: "TOT_CAMERA", nome: "Câmera IP Bullet p/ Totem",      marca: "Intelbras", modelo: "VIP 1230B G4", qtdPorTotem: "cameras" },
  { cod_eq: "TOT_POSTE",  nome: "Poste de Monitoramento 2,6 m",   marca: "Prever",    modelo: "2,6 m",        qtdPorTotem: 1 },
];

export interface TotemConfig {
  id: string;
  cameras: 2 | 3 | 4;
}

export interface TotemItemCalc {
  cod_eq: string;
  qtd: number;
  regra: string;
}

export function computeTotens(totens: TotemConfig[], overrides?: Record<string, number>): TotemItemCalc[] {
  const nTotens = totens.length;
  const totalCameras = totens.reduce((s, t) => s + t.cameras, 0);
  return TOTEM_BASE.map((b) => {
    const base = b.qtdPorTotem === "cameras" ? totalCameras : nTotens * b.qtdPorTotem;
    return {
      cod_eq: b.cod_eq,
      qtd: overrides?.[b.cod_eq] ?? base,
      regra:
        b.qtdPorTotem === "cameras"
          ? `incluído pelo Totem Inteligente (${totalCameras} câmera${totalCameras === 1 ? "" : "s"} no total)`
          : `incluído pelo Totem Inteligente (1× por totem × ${nTotens} totem${nTotens === 1 ? "" : "s"})`,
    };
  });
}

interface Props {
  isLight: boolean;
  onVoltar: () => void;
  onConcluir: (totens: TotemConfig[], itens: TotemItemCalc[]) => Promise<void> | void;
  salvando?: boolean;
}

type StepId = "totens" | "revisao";
const STEP_TITLE: Record<StepId, string> = { totens: "Totens", revisao: "Revisão" };

let _uid = 0;
const newId = () => `t_${Date.now()}_${++_uid}`;

export function TotemWizard({ isLight, onVoltar, onConcluir, salvando = false }: Props) {
  const [totens, setTotens] = useState<TotemConfig[]>([{ id: newId(), cameras: 3 }]);
  const [step, setStep] = useState<StepId>("totens");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [resumoOpen, setResumoOpen] = useState(false);

  const gold = "#F59E0B";
  const goldDark = "#b87800";
  const steps: StepId[] = ["totens", "revisao"];
  const idx = steps.indexOf(step);

  const itens = useMemo(
    () => computeTotens(totens, step === "revisao" ? overrides : undefined),
    [totens, overrides, step],
  );
  const totalUnid = itens.reduce((s, i) => s + i.qtd, 0);
  const nTotens = totens.length;

  const cardStyle: React.CSSProperties = {
    background: isLight ? "linear-gradient(135deg,#fff 0%,#f5f6f8 100%)" : "rgba(255,255,255,0.04)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.14)",
    borderRadius: 16, padding: 16,
  };
  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, letterSpacing: "0.16em",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)", marginBottom: 10,
  };

  function addTotem() {
    setTotens((t) => [...t, { id: newId(), cameras: 3 }]);
  }
  function removeTotem(id: string) {
    setTotens((t) => (t.length <= 1 ? t : t.filter((x) => x.id !== id)));
  }
  function setCameras(id: string, n: 2 | 3 | 4) {
    setTotens((t) => t.map((x) => (x.id === id ? { ...x, cameras: n } : x)));
  }

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
        }}>{nTotens} Totem{nTotens === 1 ? "" : "s"}</span>
      </div>

      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: "0.14em",
        color: gold, marginBottom: 6, textTransform: "uppercase",
      }}>
        Totem Inteligente — {nTotens} totem{nTotens === 1 ? "" : "s"}
      </div>
      {itens.map((it) => {
        const meta = TOTEM_BASE.find((k) => k.cod_eq === it.cod_eq)!;
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
    if (step === "totens") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={secLabel}>TOTENS DO PROJETO</div>
              <span style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)" }}>
                {nTotens} totem{nTotens === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "rgba(255,255,255,0.6)", marginBottom: 16 }}>
              Adicione um totem por poste. A quantidade de câmeras pode variar entre 2, 3 ou 4 (padrão 3).
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {totens.map((t, i) => (
                <div key={t.id} style={{
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 12, padding: 12,
                  background: isLight ? "#fff" : "rgba(255,255,255,0.02)",
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <Cctv size={22} color={gold} />
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? "#0a0b0e" : "#fff" }}>
                      Totem {i + 1}
                    </div>
                    <div style={{ fontSize: 10, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)" }}>
                      Poste 2,6 m + switch + fonte + câmeras
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)", marginRight: 4 }}>
                      Câmeras:
                    </span>
                    {[2, 3, 4].map((n) => {
                      const sel = t.cameras === n;
                      return (
                        <button
                          key={n}
                          onClick={() => setCameras(t.id, n as 2 | 3 | 4)}
                          style={{
                            width: 34, height: 34, borderRadius: "50%",
                            border: sel ? `2px solid ${gold}` : (isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.18)"),
                            background: sel ? gold : "transparent",
                            color: sel ? "#fff" : (isLight ? "#0a0b0e" : "#fff"),
                            fontWeight: 800, fontSize: 13, cursor: "pointer",
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => removeTotem(t.id)}
                    disabled={nTotens <= 1}
                    style={{
                      width: 34, height: 34, borderRadius: "50%",
                      border: isLight ? "1px solid rgba(220,38,38,0.35)" : "1px solid rgba(220,38,38,0.4)",
                      background: "transparent", cursor: nTotens <= 1 ? "not-allowed" : "pointer",
                      color: "#dc2626", opacity: nTotens <= 1 ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    aria-label="Remover totem"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addTotem}
              style={{
                marginTop: 14, width: "100%", padding: "12px", borderRadius: 12,
                border: `1px dashed ${gold}`, background: "rgba(245,158,11,0.08)",
                color: goldDark, fontWeight: 700, fontSize: 12, letterSpacing: "0.10em",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Plus size={14} /> ADICIONAR TOTEM
            </button>
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
                O QUE COMPÕE CADA TOTEM
              </span>
              <ChevronDown size={16}
                style={{ transition: "transform 0.2s", transform: accordionOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {accordionOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                {TOTEM_BASE.map((k) => (
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
                      {k.qtdPorTotem === "cameras" ? "2 a 4" : `×${k.qtdPorTotem}`}
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
          Ajuste as quantidades item a item para casos excepcionais. O padrão é <b>{nTotens} totem{nTotens === 1 ? "" : "s"}</b>{" "}
          ({totens.map((t, i) => `T${i + 1}=${t.cameras}cam`).join(", ")}).
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {itens.map((it) => {
            const meta = TOTEM_BASE.find((k) => k.cod_eq === it.cod_eq)!;
            const base =
              meta.qtdPorTotem === "cameras"
                ? totens.reduce((s, t) => s + t.cameras, 0)
                : nTotens * (meta.qtdPorTotem as number);
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
                      setOverrides((o) => ({ ...o, [it.cod_eq]: Math.max(0, (o[it.cod_eq] ?? base) - 1) }))
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
                      borderRadius: 8, background: isLight ? "#fff" : "rgba(255,255,255,0.04)",
                      color: isLight ? "#0a0b0e" : "#fff", fontWeight: 700, fontSize: 13,
                    }}
                  />
                  <button
                    onClick={() =>
                      setOverrides((o) => ({ ...o, [it.cod_eq]: (o[it.cod_eq] ?? base) + 1 }))
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

  const podeConcluir = nTotens >= 1 && itens.some((i) => i.qtd > 0);

  return (
    <div style={{ padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 16, color: isLight ? "#0a0b0e" : "#fff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={voltar}
          style={{
            background: isLight ? "#fff" : "rgba(255,255,255,0.06)",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12, width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: isLight ? "#0a0b0e" : "#fff",
          }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 16 }}>
            Totem Inteligente
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
                  background: cur || done ? gold : (isLight ? "#e5e7eb" : "rgba(255,255,255,0.08)"),
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
            disabled={nTotens < 1}
            style={{
              flex: 2, padding: "14px 0", borderRadius: 999, border: "none",
              background: gold, color: "#0A0A0A", fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
              cursor: "pointer", opacity: nTotens < 1 ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            AVANÇAR <ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={() => onConcluir(totens, itens.filter((i) => i.qtd > 0))}
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
