// Wizard completo do módulo Alarme de Intrusão.
// Renderizado pela rota visita.$id.orcamento.blocos.$cat quando cat === "alarme".
// Calcula o BOM em tempo real via alarmeEngine e, ao concluir, chama onConcluir(config, itens).

import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Info, Cable, Wifi, Plus, Minus, Trash2, AlertTriangle,
  ShieldCheck, PanelRightOpen,
} from "lucide-react";
import {
  computeAlarme, ALARME_LABELS, GRUPO_CODIGO,
  type AlarmeConfig, type AlarmeRamo, type AlarmePerimetro, type CalcRow,
} from "./alarmeEngine";

type StepId =
  | "ramo" | "aberturas" | "ambientes" | "perimetro" | "operacao"
  | "sirenes" | "comunicacao" | "automacoes" | "alcance" | "revisao";

interface Props {
  isLight: boolean;
  onVoltar: () => void;
  onConcluir: (config: AlarmeConfig, itens: CalcRow[]) => Promise<void> | void;
  salvando?: boolean;
}

const STEP_TITLE: Record<StepId, string> = {
  ramo: "Estrutura",
  aberturas: "Aberturas",
  ambientes: "Ambientes",
  perimetro: "Perímetro",
  operacao: "Operação",
  sirenes: "Sirenes",
  comunicacao: "Comunicação",
  automacoes: "Automações",
  alcance: "Alcance",
  revisao: "Revisão",
};

function stepsFor(ramo: AlarmeRamo | null): StepId[] {
  if (!ramo) return ["ramo"];
  if (ramo === "CAB") {
    return ["ramo", "aberturas", "ambientes", "perimetro", "operacao", "sirenes", "comunicacao", "automacoes", "revisao"];
  }
  return ["ramo", "aberturas", "ambientes", "operacao", "sirenes", "comunicacao", "automacoes", "alcance", "revisao"];
}

// ── Componentes auxiliares ────────────────────────────────────────────────

function NumberField({
  label, value, onChange, min = 0, max = 999, hint, isLight,
}: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; hint?: string; isLight: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", borderRadius: 12,
      background: isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
      border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.15)",
      gap: 12,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))}
          style={circleBtn(isLight)} aria-label="-"><Minus size={14} /></button>
        <span style={{ minWidth: 28, textAlign: "center", fontWeight: 800, fontSize: 15 }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          style={circleBtn(isLight)} aria-label="+"><Plus size={14} /></button>
      </div>
    </div>
  );
}

const circleBtn = (isLight: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: "50%",
  border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.2)",
  background: "transparent", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: isLight ? "#0a0b0e" : "#fff",
});

function ToggleField({
  label, value, onChange, hint, isLight,
}: { label: string; value: boolean; onChange: (b: boolean) => void; hint?: string; isLight: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 14px", borderRadius: 12,
      background: isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
      border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.15)",
      gap: 12,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { v: false, label: "Não" }, { v: true, label: "Sim" },
        ].map((opt) => (
          <button key={String(opt.v)} onClick={() => onChange(opt.v)}
            style={{
              padding: "8px 14px", borderRadius: 999, cursor: "pointer",
              border: value === opt.v ? "2px solid #b87800" : (isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.15)"),
              background: value === opt.v ? "rgba(180,120,0,0.10)" : "transparent",
              color: isLight ? "#0a0b0e" : "#fff", fontSize: 12, fontWeight: 700,
            }}>{opt.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── Cálculo formatação ───────────────────────────────────────────────────

function agrupar(itens: CalcRow[]) {
  const grupos: Record<string, CalcRow[]> = { central: [], sensores: [], comunicacao: [], automacao: [] };
  for (const it of itens) {
    const g = GRUPO_CODIGO[it.cod_eq] ?? "central";
    grupos[g].push(it);
  }
  return grupos;
}

const GRUPO_LABEL = {
  central: "Central e acessórios",
  sensores: "Sensores",
  comunicacao: "Comunicação",
  automacao: "Automação",
};

// ── Componente principal ─────────────────────────────────────────────────

export function AlarmeWizard({ isLight, onVoltar, onConcluir, salvando = false }: Props) {
  const [cfg, setCfg] = useState<AlarmeConfig>({ ramo: "CAB" });
  const [ramoSel, setRamoSel] = useState<AlarmeRamo | null>(null);
  const [step, setStep] = useState<StepId>("ramo");
  const [resumoOpen, setResumoOpen] = useState(false);

  const steps = stepsFor(ramoSel);
  const idx = steps.indexOf(step);

  const result = useMemo(() => computeAlarme(cfg), [cfg]);
  const temErro = result.alertas.some((a) => a.tipo === "error");

  function avancar() {
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }
  function voltar() {
    if (idx > 0) setStep(steps[idx - 1]);
    else onVoltar();
  }

  function upd<K extends keyof AlarmeConfig>(k: K, v: AlarmeConfig[K]) {
    setCfg((c) => ({ ...c, [k]: v }));
  }
  function addPerimetro() {
    const list = cfg.perimetros ?? [];
    upd("perimetros", [...list, { distancia: 100, feixes: 4 }] as AlarmePerimetro[]);
  }
  function updPerimetro(i: number, patch: Partial<AlarmePerimetro>) {
    const list = [...(cfg.perimetros ?? [])];
    list[i] = { ...list[i], ...patch };
    upd("perimetros", list);
  }
  function delPerimetro(i: number) {
    const list = [...(cfg.perimetros ?? [])];
    list.splice(i, 1);
    upd("perimetros", list);
  }

  // ── Estilos base ────────────────────────────────────────────────────
  const gold = "#F59E0B";
  const cardStyle: React.CSSProperties = {
    background: isLight ? "linear-gradient(135deg,#fff 0%,#f5f6f8 100%)" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.14)",
    borderRadius: 16, padding: 16,
  };
  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, letterSpacing: "0.16em",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)", marginBottom: 10,
  };

  // ── Painel resumo ───────────────────────────────────────────────────
  const grupos = agrupar(result.itens);
  const totalUnid = result.itens.reduce((s, i) => s + i.qtd, 0);
  const contadorLabel = ramoSel === "CAB"
    ? `Zonas: ${result.zonas_cabeadas + result.zonas_sem_fio}/64`
    : ramoSel === "SF" ? `Dispositivos: ${result.dispositivos_sf}/64` : "";

  const Resumo = (
    <div style={{ ...cardStyle, position: "sticky", top: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={18} color={gold} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", color: isLight ? "#0a0b0e" : "#fff" }}>
            RESUMO
          </span>
        </div>
        {contadorLabel && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: gold,
            padding: "3px 8px", borderRadius: 999, background: "rgba(245,158,11,0.12)",
          }}>{contadorLabel}</span>
        )}
      </div>

      {result.alertas.map((a, i) => (
        <div key={i} style={{
          padding: "8px 10px", borderRadius: 10, marginBottom: 8,
          background: a.tipo === "error" ? "rgba(220,38,38,0.10)" : "rgba(234,179,8,0.12)",
          border: `1px solid ${a.tipo === "error" ? "rgba(220,38,38,0.35)" : "rgba(234,179,8,0.35)"}`,
          color: a.tipo === "error" ? "#dc2626" : "#a16207",
          fontSize: 11, display: "flex", gap: 6, alignItems: "flex-start",
        }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{a.msg}</span>
        </div>
      ))}

      {result.itens.length === 0 && (
        <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)", padding: "12px 0" }}>
          Nenhum item — responda as perguntas ao lado.
        </div>
      )}

      {(["central", "sensores", "comunicacao", "automacao"] as const).map((g) => {
        const lista = grupos[g];
        if (!lista || lista.length === 0) return null;
        return (
          <div key={g} style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: "0.14em",
              color: gold, marginBottom: 4, textTransform: "uppercase",
            }}>{GRUPO_LABEL[g]}</div>
            {lista.map((it) => {
              const meta = ALARME_LABELS[it.cod_eq];
              return (
                <div key={it.cod_eq} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  padding: "6px 0", borderBottom: isLight ? "1px dashed rgba(0,0,0,0.06)" : "1px dashed rgba(255,255,255,0.06)",
                  gap: 8,
                }} title={it.regra || ""}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>
                      {meta?.nome ?? it.cod_eq}
                    </div>
                    <div style={{ fontSize: 10, color: isLight ? "#6b7280" : "rgba(255,255,255,0.5)" }}>
                      {meta?.modelo ?? ""}
                      {it.auto && (
                        <span style={{
                          marginLeft: 6, padding: "1px 5px", borderRadius: 4,
                          background: "rgba(180,120,0,0.15)", color: gold, fontWeight: 800, fontSize: 9,
                        }}>AUTO</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: gold }}>{it.qtd}</div>
                </div>
              );
            })}
          </div>
        );
      })}

      {result.itens.length > 0 && (
        <div style={{
          marginTop: 8, padding: "10px 12px", borderRadius: 10,
          background: "rgba(180,120,0,0.10)",
          display: "flex", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: gold }}>ITENS</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: isLight ? "#0a0b0e" : "#fff" }}>{totalUnid} un.</span>
        </div>
      )}
    </div>
  );

  // ── Corpo por step ──────────────────────────────────────────────────
  function renderStep() {
    switch (step) {
      case "ramo":
        return (
          <div style={cardStyle}>
            <div style={secLabel}>ESTRUTURA DO PROJETO</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: isLight ? "#0a0b0e" : "#fff" }}>
              Qual a estrutura do projeto?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(["CAB", "SF"] as AlarmeRamo[]).map((r) => {
                const sel = ramoSel === r;
                return (
                  <button key={r}
                    onClick={() => {
                      setRamoSel(r);
                      setCfg({ ramo: r, sirenes: 1, sirenes_sf: 1, ivp_externo_modelo: "ALM_IVP7001" });
                    }}
                    style={{
                      padding: 18, borderRadius: 14, cursor: "pointer", textAlign: "left",
                      border: sel ? "2px solid #b87800" : (isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.14)"),
                      background: sel ? "rgba(180,120,0,0.08)" : (isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)"),
                      color: isLight ? "#0a0b0e" : "#fff",
                    }}>
                    {r === "CAB" ? <Cable size={24} color={gold} /> : <Wifi size={24} color={gold} />}
                    <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>
                      {r === "CAB" ? "COM FIO" : "SEM FIO"}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: isLight ? "#6b7280" : "rgba(255,255,255,0.6)" }}>
                      {r === "CAB" ? "AMT 4010 Smart" : "AMT 8000"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "aberturas":
        return cfg.ramo === "CAB" ? (
          <div style={cardStyle}>
            <div style={secLabel}>PORTAS, JANELAS E PORTÕES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <NumberField isLight={isLight}
                label="Portas/janelas comuns" hint="XAS Sobrepor · vendido em pacote de 5"
                value={cfg.aberturas_comuns ?? 0} onChange={(v) => upd("aberturas_comuns", v)} />
              <NumberField isLight={isLight}
                label="Portões de aço pedestre" hint="XAS Porta de Aço Mini"
                value={cfg.portao_mini ?? 0} onChange={(v) => upd("portao_mini", v)} />
              <NumberField isLight={isLight}
                label="Portões de aço veicular" hint="XAS Porta de Aço Normal"
                value={cfg.portao_normal ?? 0} onChange={(v) => upd("portao_normal", v)} />
              <NumberField isLight={isLight}
                label="Aberturas sem cabeamento" hint="XAS 4010 Smart · requer receptor XAR 4000 (auto)"
                value={cfg.aberturas_sf ?? 0} onChange={(v) => upd("aberturas_sf", v)} />
            </div>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={secLabel}>ABERTURAS A PROTEGER</div>
            <NumberField isLight={isLight}
              label="Aberturas (portas, janelas, portões)" hint="XAS 8000"
              value={cfg.aberturas ?? 0} onChange={(v) => upd("aberturas", v)} />
          </div>
        );

      case "ambientes":
        return cfg.ramo === "CAB" ? (
          <div style={cardStyle}>
            <div style={secLabel}>AMBIENTES (SENSORES DE PRESENÇA)</div>
            <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)", marginBottom: 10 }}>
              Regra: 1 sensor por ambiente.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <NumberField isLight={isLight} label="Ambientes internos" hint="IVP 5001 PET"
                value={cfg.ivp_interno ?? 0} onChange={(v) => upd("ivp_interno", v)} />
              <NumberField isLight={isLight} label="Ambientes críticos (menos falso alarme)"
                hint="IVP 5311 MW PET" value={cfg.ivp_interno_mw ?? 0}
                onChange={(v) => upd("ivp_interno_mw", v)} />
              <div style={{
                padding: 12, borderRadius: 12,
                background: isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.15)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: isLight ? "#0a0b0e" : "#fff" }}>
                  Áreas externas
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[
                    { v: "ALM_IVP7001", label: "IVP 7001" },
                    { v: "ALM_IVP3000", label: "IVP 3000" },
                  ].map((o) => (
                    <button key={o.v} onClick={() => upd("ivp_externo_modelo", o.v as any)}
                      style={{
                        padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 700,
                        border: cfg.ivp_externo_modelo === o.v ? "2px solid #b87800" : "1px solid rgba(0,0,0,0.12)",
                        background: cfg.ivp_externo_modelo === o.v ? "rgba(180,120,0,0.1)" : "transparent",
                        color: isLight ? "#0a0b0e" : "#fff",
                      }}>{o.label}</button>
                  ))}
                </div>
                <NumberField isLight={isLight} label="Quantidade" value={cfg.ivp_externo_qtd ?? 0}
                  onChange={(v) => upd("ivp_externo_qtd", v)} />
              </div>
            </div>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={secLabel}>AMBIENTES (SENSORES DE PRESENÇA)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <NumberField isLight={isLight} label="Ambientes internos" hint="IVP 8000 PET"
                value={cfg.ivp_interno_sf ?? 0} onChange={(v) => upd("ivp_interno_sf", v)} />
              <NumberField isLight={isLight} label="Ambientes c/ verificação por foto"
                hint="IVP 8000 PET CAM · 2 fotos por disparo"
                value={cfg.ivp_cam_sf ?? 0} onChange={(v) => upd("ivp_cam_sf", v)} />
              <NumberField isLight={isLight} label="Áreas externas" hint="IVP 8000 EX"
                value={cfg.ivp_externo_sf ?? 0} onChange={(v) => upd("ivp_externo_sf", v)} />
            </div>
          </div>
        );

      case "perimetro":
        return (
          <div style={cardStyle}>
            <div style={secLabel}>PROTEÇÃO DE PERÍMETRO</div>
            <ToggleField isLight={isLight}
              label="O projeto tem proteção de perímetro?" value={!!cfg.perimetro_enable}
              onChange={(v) => upd("perimetro_enable", v)} />
            {cfg.perimetro_enable && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {(cfg.perimetros ?? []).map((p, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 12,
                    background: isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                    border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,215,0,0.15)",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: gold }}>VÃO {i + 1}</span>
                      <button onClick={() => delPerimetro(i)}
                        style={{ ...circleBtn(isLight), borderColor: "rgba(220,38,38,0.35)", color: "#dc2626" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <label style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.6)" }}>
                      Distância (m)
                      <input type="number" min={0} value={p.distancia}
                        onChange={(e) => updPerimetro(i, { distancia: Math.max(0, +e.target.value || 0) })}
                        style={{
                          display: "block", width: "100%", marginTop: 4,
                          padding: "10px 12px", borderRadius: 10,
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: isLight ? "#fff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                          color: isLight ? "#0a0b0e" : "#fff", fontSize: 14, fontWeight: 700,
                        }} />
                    </label>
                    <div>
                      <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.6)", marginBottom: 6 }}>
                        Nº de feixes
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[2, 4, 6, 8].map((f) => (
                          <button key={f} onClick={() => updPerimetro(i, { feixes: f as 2 | 4 | 6 | 8 })}
                            style={{
                              padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontSize: 11, fontWeight: 700,
                              border: p.feixes === f ? "2px solid #b87800" : "1px solid rgba(0,0,0,0.12)",
                              background: p.feixes === f ? "rgba(180,120,0,0.1)" : "transparent",
                              color: isLight ? "#0a0b0e" : "#fff",
                            }}>{f} feixes</button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addPerimetro}
                  style={{
                    padding: "12px 0", borderRadius: 12, cursor: "pointer",
                    border: "2px dashed rgba(180,120,0,0.4)", background: "transparent",
                    color: gold, fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                  <Plus size={14} /> ADICIONAR VÃO
                </button>
              </div>
            )}
          </div>
        );

      case "operacao":
        return cfg.ramo === "CAB" ? (
          <div style={cardStyle}>
            <div style={secLabel}>OPERAÇÃO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <NumberField isLight={isLight}
                label="Pontos adicionais de operação" hint="XAT 4000 · 1 teclado já vem com a central (máx. 4 total)"
                max={3} value={cfg.teclados_extras ?? 0} onChange={(v) => upd("teclados_extras", v)} />
              <NumberField isLight={isLight}
                label="Controles remotos" hint="Aciona receptor XAR 4000 automaticamente"
                value={cfg.controles ?? 0} onChange={(v) => upd("controles", v)} />
            </div>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={secLabel}>OPERAÇÃO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <NumberField isLight={isLight}
                label="Teclados adicionais" hint="XAT 8000 · 1 já incluso automaticamente (máx. 16)"
                max={15} value={cfg.teclados_extras_sf ?? 0} onChange={(v) => upd("teclados_extras_sf", v)} />
              <NumberField isLight={isLight}
                label="Usuários com controle remoto" hint="XAC 8000 · 1 por usuário (máx. 98)"
                max={98} value={cfg.usuarios_controle ?? 0} onChange={(v) => upd("usuarios_controle", v)} />
            </div>
          </div>
        );

      case "sirenes":
        return cfg.ramo === "CAB" ? (
          <div style={cardStyle}>
            <div style={secLabel}>SIRENES</div>
            <NumberField isLight={isLight}
              label="Sirenes 12V Morey" hint="Máx. 2 (limite da saída da central)"
              max={2} value={cfg.sirenes ?? 1} onChange={(v) => upd("sirenes", v)} />
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={secLabel}>SIRENES</div>
            <NumberField isLight={isLight}
              label="Sirenes XSS 8000" hint="Máx. 16"
              max={16} value={cfg.sirenes_sf ?? 1} onChange={(v) => upd("sirenes_sf", v)} />
          </div>
        );

      case "comunicacao":
        return cfg.ramo === "CAB" ? (
          <div style={cardStyle}>
            <div style={secLabel}>COMUNICAÇÃO</div>
            <ToggleField isLight={isLight}
              label="Cliente vai monitorar por app/internet?"
              hint="XEG 4000 Smart · sem ele, apenas linha telefônica"
              value={!!cfg.monitoramento_app} onChange={(v) => upd("monitoramento_app", v)} />
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={secLabel}>COMUNICAÇÃO</div>
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 10,
              background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.28)",
              color: isLight ? "#1e40af" : "#93c5fd", fontSize: 11,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Ethernet e Wi-Fi já são nativos da AMT 8000 — app incluso sem módulo extra.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ToggleField isLight={isLight} label="Redundância via chip GSM?" hint="XAG 8000"
                value={!!cfg.redundancia_gsm} onChange={(v) => upd("redundancia_gsm", v)} />
              <ToggleField isLight={isLight} label="Reporte por linha telefônica fixa?" hint="FXO 8000"
                value={!!cfg.linha_telefonica} onChange={(v) => upd("linha_telefonica", v)} />
            </div>
          </div>
        );

      case "automacoes":
        return cfg.ramo === "CAB" ? (
          <div style={cardStyle}>
            <div style={secLabel}>AUTOMAÇÕES</div>
            <NumberField isLight={isLight}
              label="Acionamentos automáticos"
              hint="Portão, holofote, fechadura... Central tem 3 PGMs; acima disso adiciona XEP 4004 (máx. 19)"
              max={19} value={cfg.automacoes ?? 0} onChange={(v) => upd("automacoes", v)} />
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={secLabel}>AUTOMAÇÕES</div>
            <NumberField isLight={isLight}
              label="Acionamentos automáticos" hint="PGM 8000 · máx. 16"
              max={16} value={cfg.automacoes_sf ?? 0} onChange={(v) => upd("automacoes_sf", v)} />
          </div>
        );

      case "alcance":
        return (
          <div style={cardStyle}>
            <div style={secLabel}>ALCANCE</div>
            <div style={{ fontSize: 12, color: isLight ? "#6b7280" : "rgba(255,255,255,0.6)", marginBottom: 8 }}>
              Maior distância aproximada entre a central e um dispositivo
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { v: 100, label: "Até 100 m" },
                { v: 300, label: "100–300 m" },
                { v: 600, label: "300–600 m" },
                { v: 1000, label: "+600 m" },
              ].map((o) => (
                <button key={o.v} onClick={() => upd("distancia_faixa", o.v as any)}
                  style={{
                    padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: cfg.distancia_faixa === o.v ? "2px solid #b87800" : "1px solid rgba(0,0,0,0.12)",
                    background: cfg.distancia_faixa === o.v ? "rgba(180,120,0,0.1)" : "transparent",
                    color: isLight ? "#0a0b0e" : "#fff",
                  }}>{o.label}</button>
              ))}
            </div>
            <ToggleField isLight={isLight}
              label="Imóvel com 2+ pavimentos ou muitas paredes/lajes?"
              value={!!cfg.muitos_obstaculos} onChange={(v) => upd("muitos_obstaculos", v)} />
            <div style={{ marginTop: 12 }}>
              <NumberField isLight={isLight}
                label="Repetidores REP 8000" hint="Não podem ser ligados em cascata — alcance máx 1,2 km"
                max={4} value={cfg.repetidores ?? 0} onChange={(v) => upd("repetidores", v)} />
            </div>
          </div>
        );

      case "revisao":
        return (
          <div style={cardStyle}>
            <div style={secLabel}>REVISÃO FINAL</div>
            <div style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.7)", marginBottom: 12 }}>
              Confira a lista de equipamentos. Ao concluir, todos serão adicionados à proposta.
              Você poderá ajustar quantidades depois no editor do bloco.
            </div>
            {result.itens.length === 0 && (
              <div style={{
                padding: 16, borderRadius: 10, textAlign: "center", fontSize: 12,
                background: isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)",
              }}>
                Nenhum item calculado — volte e responda as etapas.
              </div>
            )}
            {result.itens.map((it) => {
              const meta = ALARME_LABELS[it.cod_eq];
              return (
                <div key={it.cod_eq} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  padding: "10px 0", borderBottom: isLight ? "1px dashed rgba(0,0,0,0.08)" : "1px dashed rgba(255,255,255,0.08)",
                  gap: 12,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? "#0a0b0e" : "#fff" }}>
                      {meta?.nome ?? it.cod_eq}
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? "#6b7280" : "rgba(255,255,255,0.55)", marginTop: 2 }}>
                      {meta?.modelo ?? ""} · {it.cod_eq}
                      {it.auto && (
                        <span style={{
                          marginLeft: 6, padding: "1px 5px", borderRadius: 4,
                          background: "rgba(180,120,0,0.15)", color: gold, fontWeight: 800, fontSize: 9,
                        }}>AUTO</span>
                      )}
                    </div>
                    {it.regra && (
                      <div style={{ fontSize: 10, color: isLight ? "#8a909e" : "rgba(255,255,255,0.4)", marginTop: 2, fontStyle: "italic" }}>
                        {it.regra}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: gold }}>×{it.qtd}</div>
                </div>
              );
            })}
          </div>
        );
    }
  }

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
            Alarme de Intrusão
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

      {/* Stepper compacto */}
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

      {/* Layout: conteúdo + resumo lateral (desktop) */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr", maxWidth: "100%" }}>
        {renderStep()}
        {/* Resumo inline em desktop (>= 900px) */}
        <div className="alarme-resumo-desktop" style={{ display: "none" }}>{Resumo}</div>
      </div>

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
            disabled={step === "ramo" && !ramoSel}
            style={{
              flex: 2, padding: "14px 0", borderRadius: 999, border: "none",
              background: gold, color: "#0A0A0A", fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
              cursor: "pointer", opacity: step === "ramo" && !ramoSel ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            AVANÇAR <ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={() => onConcluir(cfg, result.itens)}
            disabled={temErro || salvando || result.itens.length === 0}
            style={{
              flex: 2, padding: "14px 0", borderRadius: 999, border: "none",
              background: temErro ? "#9ca3af" : gold, color: "#0A0A0A",
              fontWeight: 800, fontSize: 12, letterSpacing: "0.14em",
              cursor: temErro || salvando ? "not-allowed" : "pointer",
              opacity: salvando ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            <Check size={14} /> {salvando ? "SALVANDO…" : "ADICIONAR À PROPOSTA"}
          </button>
        )}
      </div>

      {/* Drawer do resumo (mobile) */}
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
              <button onClick={() => setResumoOpen(false)} style={circleBtn(isLight)}>×</button>
            </div>
            {Resumo}
          </div>
        </>
      )}
    </div>
  );
}
