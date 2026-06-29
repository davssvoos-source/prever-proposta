import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/blocos/$cat")({
  component: BlocosCatPage,
});

const CAT_PREFIXES: Record<string, string[]> = {
  pedestres: ["PED"],
  veiculos: ["VEI"],
  cftv: ["CFTV"],
  alarme: ["ALARM"],
  cerca: ["CERCA"],
  central: ["CENT"],
};
const CAT_LABELS: Record<string, string> = {
  pedestres: "Acesso de Pedestres",
  veiculos: "Acesso de Veículos",
  cftv: "CFTV",
  alarme: "Alarme",
  cerca: "Cerca Elétrica",
  central: "Central de Comando",
};
const CAT_ORDER = ["pedestres", "veiculos", "cftv", "alarme", "cerca", "central"];

type BlocoItem = { id: string; nome: string; modelo: string; qty: number; variavel: boolean };
type Bloco = {
  id: string;
  code: string;
  name: string;
  hh: number;
  descricao: string | null;
  blocos_itens: BlocoItem[];
};

const CARD: React.CSSProperties = {
  background: "rgba(8,8,12,0.22)",
  backdropFilter: "blur(12px) saturate(130%)",
  border: "1px solid rgba(255,192,0,0.10)",
  borderRadius: 18,
  padding: "18px 16px",
  marginBottom: 16,
};
const LBL: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: 300,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontSize: 10,
  color: "rgba(255,192,0,0.65)",
  marginBottom: 12,
};
const btnStyle = (active: boolean, disabled = false): React.CSSProperties => ({
  flex: 1,
  padding: "12px 8px",
  borderRadius: 12,
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "'Montserrat', sans-serif",
  fontWeight: active ? 500 : 300,
  fontSize: 13,
  background: active ? "rgba(255,192,0,0.18)" : "rgba(255,255,255,0.04)",
  border: active ? "1px solid rgba(255,192,0,0.55)" : "1px solid rgba(255,255,255,0.08)",
  color: active ? "#FFC000" : "rgba(255,255,255,0.6)",
  transition: "all 0.18s",
  opacity: disabled ? 0.35 : 1,
});

function BlocoDetailCard({
  bloco,
  qtdBloco,
  setQtdBloco,
  savedItens,
  onSave,
}: {
  bloco: Bloco;
  qtdBloco: number;
  setQtdBloco: (n: number) => void;
  savedItens: Record<string, number>;
  onSave: (customItemQtds: Record<string, number>) => void;
}) {
  const [customItemQtds, setCustomItemQtds] = useState<Record<string, number>>({});

  useEffect(() => {
    const defaults: Record<string, number> = {};
    for (const item of bloco.blocos_itens ?? []) {
      defaults[item.id] = savedItens[item.id] ?? item.qty ?? 0;
    }
    setCustomItemQtds(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloco.id]);

  return (
    <div style={{ ...CARD, border: "1px solid rgba(255,192,0,0.45)", background: "rgba(255,192,0,0.06)" }}>
      <div style={LBL}>Bloco identificado</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 11,
            color: "#FFC000",
            background: "rgba(255,192,0,0.15)",
            padding: "3px 8px",
            borderRadius: 6,
          }}
        >
          {bloco.code}
        </span>
        <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#fff", fontSize: 14 }}>{bloco.name}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{bloco.hh} HH</span>
      </div>
      {bloco.descricao && (
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            marginBottom: 14,
          }}
        >
          {bloco.descricao}
        </div>
      )}

      <div style={{ ...LBL, marginTop: 8 }}>Equipamentos inclusos</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {(bloco.blocos_itens ?? []).map((it) => {
          const q = customItemQtds[it.id] ?? it.qty ?? 0;
          return (
            <div
              key={it.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                {it.nome}
                {it.modelo ? ` · ${it.modelo}` : ""}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() =>
                    setCustomItemQtds((prev) => ({
                      ...prev,
                      [it.id]: Math.max(0, (prev[it.id] ?? it.qty ?? 0) - 1),
                    }))
                  }
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: "rgba(255,192,0,0.15)",
                    border: "1px solid rgba(255,192,0,0.35)",
                    color: "#FFC000",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Minus size={13} />
                </button>
                <span style={{ minWidth: 22, textAlign: "center", color: "#FFC000", fontWeight: 600 }}>{q}</span>
                <button
                  onClick={() =>
                    setCustomItemQtds((prev) => ({
                      ...prev,
                      [it.id]: (prev[it.id] ?? it.qty ?? 0) + 1,
                    }))
                  }
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: "rgba(255,192,0,0.15)",
                    border: "1px solid rgba(255,192,0,0.35)",
                    color: "#FFC000",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={LBL}>Quantidade deste bloco</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <button
          onClick={() => setQtdBloco(Math.max(1, qtdBloco - 1))}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,192,0,0.15)",
            border: "1px solid rgba(255,192,0,0.35)",
            color: "#FFC000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Minus size={18} />
        </button>
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 400,
            fontSize: 26,
            color: "#FFC000",
            minWidth: 40,
            textAlign: "center",
          }}
        >
          {qtdBloco}
        </span>
        <button
          onClick={() => setQtdBloco(qtdBloco + 1)}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,192,0,0.15)",
            border: "1px solid rgba(255,192,0,0.35)",
            color: "#FFC000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Plus size={18} />
        </button>
      </div>

      <button
        onClick={() => onSave(customItemQtds)}
        style={{
          marginTop: 18,
          width: "100%",
          padding: 14,
          borderRadius: 14,
          background: "linear-gradient(135deg,#FFD700,#FFC000)",
          border: "none",
          color: "#08090E",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Salvar e continuar →
      </button>
    </div>
  );
}


function FallbackList({
  blocos,
  onPick,
  prefixLabel,
}: {
  blocos: Bloco[];
  onPick: (id: string) => void;
  prefixLabel: string;
}) {
  return (
    <div style={CARD}>
      <div style={LBL}>Combinação não disponível — escolha manualmente</div>
      <div
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          marginBottom: 10,
        }}
      >
        Mostrando todos os blocos {prefixLabel} cadastrados:
      </div>
      {blocos.map((b) => (
        <button
          key={b.id}
          onClick={() => onPick(b.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 8,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ color: "#FFC000", fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500 }}>
            {b.code}
          </span>
          <span style={{ color: "#fff", fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>{b.name}</span>
        </button>
      ))}
    </div>
  );
}

function PedestresConfigurador({
  blocos,
  savedItensVariaveis,
  onSave,
}: {
  blocos: Bloco[];
  savedItensVariaveis: Record<string, Record<string, number>>;
  onSave: (qtds: Record<string, number>, itensVariaveis: Record<string, Record<string, number>>) => void;
}) {
  type NP = "1P" | "2P";
  type Material = "MET" | "VID";
  type Controle = "E" | "ES" | "PAD";

  const [nP, setNP] = useState<NP | null>(null);
  const [qtdPortas, setQtdPortas] = useState<number | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [controle, setControle] = useState<Controle | null>(null);
  const [qtdBloco, setQtdBloco] = useState(1);


  // Eclusa (2P) só disponível em metal
  useEffect(() => {
    if (nP === "2P" && material === "VID") setMaterial(null);
    setControle(null);
  }, [nP]);
  useEffect(() => {
    setControle(null);
  }, [material]);

  const configCompleta = nP !== null && material !== null && controle !== null;
  const expectedCode = configCompleta ? `PED-${nP}-${controle}-${material}-PR` : null;
  const blocoEncontrado = expectedCode ? blocos.find((b) => b.code === expectedCode) ?? null : null;

  return (
    <div>
      <div style={CARD}>
        <div style={LBL}>ECLUSA?</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnStyle(nP === "1P")} onClick={() => { setNP("1P"); setQtdPortas(null); }}>
            Não
          </button>
          <button style={btnStyle(nP === "2P")} onClick={() => setNP("2P")}>
            Sim
          </button>
        </div>
      </div>

      {nP === "2P" && (
        <div style={CARD}>
          <div style={LBL}>QUANTIDADE DE PORTAS</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                style={{ ...btnStyle(qtdPortas === n), minWidth: 56 }}
                onClick={() => setQtdPortas(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {nP !== null && (
        <div style={CARD}>
          <div style={LBL}>Material da porta</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnStyle(material === "MET")} onClick={() => setMaterial("MET")}>
              Metal
            </button>
            <button
              style={btnStyle(material === "VID", nP === "2P")}
              onClick={() => nP !== "2P" && setMaterial("VID")}
              disabled={nP === "2P"}
            >
              Vidro
            </button>
          </div>
          {nP === "2P" && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Eclusa só disponível em metal
            </div>
          )}
        </div>
      )}

      {material !== null && (
        <div style={CARD}>
          <div style={LBL}>Nível de controle</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {([
              { id: "E", title: "E — Entrada", desc: "Facial apenas no acesso de entrada" },
              { id: "ES", title: "ES — Entrada + Saída", desc: "Facial na entrada e na saída" },
              ...(nP === "2P"
                ? [{ id: "PAD", title: "PAD — Controle Padrão (3 pontos)", desc: "3 faciais: entrada, saída e eclusa" }]
                : []),
            ] as { id: Controle; title: string; desc: string }[]).map((opt) => (
              <button
                key={opt.id}
                style={{ ...btnStyle(controle === opt.id), textAlign: "left", padding: 14 }}
                onClick={() => setControle(opt.id)}
              >
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2 }}>{opt.title}</div>
                <div style={{ fontWeight: 300, fontSize: 11, opacity: 0.7 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {configCompleta && blocoEncontrado && (
        <BlocoDetailCard
          bloco={blocoEncontrado}
          qtdBloco={qtdBloco}
          setQtdBloco={setQtdBloco}
          savedItens={savedItensVariaveis[blocoEncontrado.id] ?? {}}
          onSave={(customItemQtds) =>
            onSave({ [blocoEncontrado.id]: qtdBloco }, { [blocoEncontrado.id]: customItemQtds })
          }
        />
      )}

      {configCompleta && !blocoEncontrado && (
        <FallbackList
          blocos={blocos}
          prefixLabel="PED"
          onPick={(bid) => onSave({ [bid]: qtdBloco }, {})}
        />
      )}
    </div>
  );
}


function VeiculosConfigurador({
  blocos,
  savedItensVariaveis,
  onSave,
}: {
  blocos: Bloco[];
  savedItensVariaveis: Record<string, Record<string, number>>;
  onSave: (qtds: Record<string, number>, itensVariaveis: Record<string, Record<string, number>>) => void;
}) {
  type Pistas = "1P" | "2P";
  type Acesso = "CTRL" | "TAG";
  type AcessoSai = "CTRL" | "FAC";
  type Motor = "BASC" | "DESL" | "PIVO";
  type Porteiro = "PP" | "PR";

  const [pistas, setPistas] = useState<Pistas | null>(null);
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [ctrlSai, setCtrlSai] = useState<AcessoSai | null>(null);
  const [motorEnt, setMotorEnt] = useState<Motor | null>(null);
  const [motorSai, setMotorSai] = useState<Motor | null>(null);
  const [porteiro, setPorteiro] = useState<Porteiro | null>(null);
  const [qtdBloco, setQtdBloco] = useState(1);

  // Reset dependents when pistas muda
  useEffect(() => {
    setAcesso(null);
    setCtrlSai(null);
    setMotorEnt(null);
    setMotorSai(null);
    setPorteiro(null);
  }, [pistas]);

  const configCompleta1P =
    pistas === "1P" && acesso !== null && motorEnt !== null && porteiro !== null;
  const configCompleta2P =
    pistas === "2P" &&
    acesso !== null &&
    ctrlSai !== null &&
    motorEnt !== null &&
    motorSai !== null &&
    porteiro !== null;
  const configCompleta = configCompleta1P || configCompleta2P;

  const expectedCode = configCompleta1P
    ? `VEI-1P-${acesso}-${motorEnt}-${porteiro}`
    : configCompleta2P
    ? `VEI-2P-${acesso}-${ctrlSai}-${motorEnt}-${motorSai}-${porteiro}`
    : null;

  const blocoEncontrado = expectedCode ? blocos.find((b) => b.code === expectedCode) ?? null : null;

  const motorOpts: { id: Motor; label: string }[] = [
    { id: "BASC", label: "Basculante" },
    { id: "DESL", label: "Deslizante" },
    { id: "PIVO", label: "Pivotante" },
  ];

  return (
    <div>
      <div style={CARD}>
        <div style={LBL}>Quantas pistas?</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnStyle(pistas === "1P")} onClick={() => setPistas("1P")}>
            1 pista
          </button>
          <button style={btnStyle(pistas === "2P")} onClick={() => setPistas("2P")}>
            2 pistas
          </button>
        </div>
      </div>

      {pistas !== null && (
        <div style={CARD}>
          <div style={LBL}>{pistas === "2P" ? "Controle de entrada" : "Tipo de acesso"}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnStyle(acesso === "CTRL")} onClick={() => setAcesso("CTRL")}>
              Controle simples
            </button>
            <button style={btnStyle(acesso === "TAG")} onClick={() => setAcesso("TAG")}>
              Tag / Facial
            </button>
          </div>
        </div>
      )}

      {pistas === "2P" && acesso !== null && (
        <div style={CARD}>
          <div style={LBL}>Controle de saída</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnStyle(ctrlSai === "CTRL")} onClick={() => setCtrlSai("CTRL")}>
              Controle
            </button>
            <button style={btnStyle(ctrlSai === "FAC")} onClick={() => setCtrlSai("FAC")}>
              Facial
            </button>
          </div>
        </div>
      )}

      {((pistas === "1P" && acesso !== null) ||
        (pistas === "2P" && ctrlSai !== null)) && (
        <div style={CARD}>
          <div style={LBL}>{pistas === "2P" ? "Motor portão de entrada" : "Tipo de motor/portão"}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {motorOpts.map((m) => (
              <button key={m.id} style={btnStyle(motorEnt === m.id)} onClick={() => setMotorEnt(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {pistas === "2P" && motorEnt !== null && (
        <div style={CARD}>
          <div style={LBL}>Motor portão de saída</div>
          <div style={{ display: "flex", gap: 10 }}>
            {motorOpts.map((m) => (
              <button key={m.id} style={btnStyle(motorSai === m.id)} onClick={() => setMotorSai(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {((pistas === "1P" && motorEnt !== null) ||
        (pistas === "2P" && motorSai !== null)) && (
        <div style={CARD}>
          <div style={LBL}>Portaria</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnStyle(porteiro === "PP")} onClick={() => setPorteiro("PP")}>
              Presencial
            </button>
            <button style={btnStyle(porteiro === "PR")} onClick={() => setPorteiro("PR")}>
              Remota
            </button>
          </div>
        </div>
      )}

      {configCompleta && blocoEncontrado && (
        <BlocoDetailCard
          bloco={blocoEncontrado}
          qtdBloco={qtdBloco}
          setQtdBloco={setQtdBloco}
          savedItens={savedItensVariaveis[blocoEncontrado.id] ?? {}}
          onSave={(customItemQtds) =>
            onSave({ [blocoEncontrado.id]: qtdBloco }, { [blocoEncontrado.id]: customItemQtds })
          }
        />
      )}

      {configCompleta && !blocoEncontrado && (
        <FallbackList
          blocos={blocos}
          prefixLabel="VEI"
          onPick={(bid) => onSave({ [bid]: qtdBloco }, {})}
        />
      )}
    </div>
  );
}

function BlocoGenericList({
  blocos,
  savedQtds,
  onSave,
}: {
  blocos: Bloco[];
  savedQtds: Record<string, number>;
  onSave: (qtds: Record<string, number>) => void;
}) {
  const [qtds, setQtds] = useState<Record<string, number>>(savedQtds);
  useEffect(() => {
    setQtds(savedQtds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inc = (id: string) => setQtds((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  const dec = (id: string) =>
    setQtds((p) => {
      const next = Math.max(0, (p[id] ?? 0) - 1);
      const copy = { ...p };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  if (blocos.length === 0)
    return (
      <div style={{ ...CARD, textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}></div>
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Nenhum bloco cadastrado para esta categoria.
        </div>
      </div>
    );

  return (
    <div>
      {blocos.map((b) => {
        const q = qtds[b.id] ?? 0;
        return (
          <div
            key={b.id}
            style={{
              ...CARD,
              marginBottom: 10,
              background: q > 0 ? "rgba(255,192,0,0.06)" : "rgba(8,8,12,0.22)",
              border: q > 0 ? "1px solid rgba(255,192,0,0.35)" : "1px solid rgba(255,192,0,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: 10,
                      color: "#FFC000",
                      background: "rgba(255,192,0,0.10)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {b.code}
                  </span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, color: "#fff" }}>{b.name}</span>
                </div>
                {b.descricao && (
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                      marginBottom: 4,
                    }}
                  >
                    {b.descricao}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {b.hh} HH
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => dec(b.id)}
                  disabled={q === 0}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: q > 0 ? "rgba(255,192,0,0.15)" : "rgba(255,255,255,0.05)",
                    border: q > 0 ? "1px solid rgba(255,192,0,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    color: q > 0 ? "#FFC000" : "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: q > 0 ? "pointer" : "default",
                  }}
                >
                  <Minus size={16} />
                </button>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 400,
                    fontSize: 18,
                    color: q > 0 ? "#FFC000" : "rgba(255,255,255,0.3)",
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {q}
                </span>
                <button
                  onClick={() => inc(b.id)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "rgba(255,192,0,0.15)",
                    border: "1px solid rgba(255,192,0,0.35)",
                    color: "#FFC000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            {q > 0 && (b.blocos_itens ?? []).length > 0 && (
              <div
                style={{
                  borderTop: "1px solid rgba(255,192,0,0.15)",
                  paddingTop: 10,
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {b.blocos_itens.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    <span>
                      {it.nome} · {it.modelo}
                    </span>
                    <span style={{ color: "#FFC000" }}>
                      {it.qty * q}
                      {it.variavel ? " (V)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() => onSave(qtds)}
        style={{
          width: "100%",
          height: 56,
          borderRadius: 28,
          background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
          border: "none",
          color: "#08090E",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          cursor: "pointer",
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 4px 24px rgba(255,192,0,0.35)",
        }}
      >
        Salvar e continuar
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function BlocosCatPage() {
  const { id, cat } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const prefixes = CAT_PREFIXES[cat] ?? [];

  const { data: todosBlocos, isLoading } = useQuery({
    queryKey: ["blocos-com-itens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocos").select("*, blocos_itens(*)").order("code");
      if (error) throw error;
      return (data ?? []) as unknown as Bloco[];
    },
  });

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visita_orcamentos")
        .select("blocos_selecionados, itens_variaveis")
        .eq("visita_id", id)
        .maybeSingle();
      return data;
    },
  });

  const blocos = (todosBlocos ?? []).filter((b) =>
    prefixes.some((p) => b.code.toUpperCase().startsWith(p)),
  );

  const savedQtds =
    ((orcamento?.blocos_selecionados as Record<string, Record<string, number>> | null)?.[cat]) ?? {};

  const savedItensVariaveis =
    (orcamento?.itens_variaveis as Record<string, Record<string, number>> | null) ?? {};

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      qtds: Record<string, number>;
      itensVariaveisPorBloco: Record<string, Record<string, number>>;
    }) => {
      const { data: current } = await supabase
        .from("visita_orcamentos")
        .select("blocos_selecionados, itens_variaveis")
        .eq("visita_id", id)
        .maybeSingle();
      const existingBlocos =
        (current?.blocos_selecionados ?? {}) as Record<string, Record<string, number>>;
      const merged = { ...existingBlocos, [cat]: payload.qtds };

      const existingItens =
        (current?.itens_variaveis ?? {}) as Record<string, Record<string, number>>;
      const mergedItens = { ...existingItens, ...payload.itensVariaveisPorBloco };

      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          blocos_selecionados: merged,
          itens_variaveis: mergedItens,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visita_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      toast.success(`${CAT_LABELS[cat]} salvo`);
      window.location.href = `/visita/${id}/orcamento/categorias`;
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div style={{ padding: "12px 14px 140px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento/categorias", params: { id } })}
          style={{
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
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 17,
              color: "#fff",
            }}
          >
            {CAT_LABELS[cat] ?? cat}
          </div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
            }}
          >
            Passo 3 — Configure os blocos
          </div>
        </div>
      </div>

      {isLoading ? (
        <div
          style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Montserrat', sans-serif",
            padding: 40,
          }}
        >
          Carregando blocos...
        </div>
      ) : cat === "pedestres" ? (
        <PedestresConfigurador blocos={blocos} onSave={(qtds) => saveMutation.mutate(qtds)} />
      ) : cat === "veiculos" ? (
        <VeiculosConfigurador blocos={blocos} onSave={(qtds) => saveMutation.mutate(qtds)} />
      ) : (
        <BlocoGenericList
          blocos={blocos}
          savedQtds={savedQtds}
          onSave={(qtds) => saveMutation.mutate(qtds)}
        />
      )}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento/categorias", params: { id } })}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ← Voltar às categorias sem salvar
        </button>
      </div>
    </div>
  );
}
