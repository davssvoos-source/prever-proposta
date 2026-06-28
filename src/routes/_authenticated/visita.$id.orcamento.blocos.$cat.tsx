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
  cftv: ["CAM", "NVR", "CFTV"],
  alarme: ["ALA", "ALM"],
  cerca: ["CER"],
  central: ["CENT", "RACK"],
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

function blocoMatchSegments(code: string, segments: string[]): boolean {
  const partes = code.toUpperCase().split("-");
  return segments.every((s) => partes.includes(s.toUpperCase()));
}

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

function PedestresConfigurador({
  blocos,
  onSave,
}: {
  blocos: Bloco[];
  onSave: (qtds: Record<string, number>) => void;
}) {
  type Material = "metal" | "vidro";
  type Abertura = "motorizada" | "mola" | "nenhum";
  type Controle = "pad" | "e" | "es";

  const [eclusa, setEclusa] = useState<boolean | null>(null);
  const [material, setMaterial] = useState<Material | null>(null);
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const [controle, setControle] = useState<Controle | null>(null);
  const [qtdBloco, setQtdBloco] = useState(1);

  useEffect(() => {
    setAbertura(null);
    setControle(null);
    if (material === "vidro" && abertura === "motorizada") setAbertura(null);
  }, [material]);
  useEffect(() => {
    setControle(null);
  }, [eclusa]);

  const segments: string[] = ["PED"];
  if (eclusa !== null) segments.push(eclusa ? "2P" : "1P");
  if (material !== null) segments.push(material === "metal" ? "MET" : "VID");
  if (material === "metal" && abertura === "motorizada") segments.push("MOT");
  if (abertura === "mola") segments.push("MOL");
  if (eclusa && controle) segments.push(controle === "pad" ? "PAD" : controle === "e" ? "E" : "ES");

  const configCompleta =
    eclusa !== null && material !== null && abertura !== null && (!eclusa || controle !== null);

  const blocoEncontrado = configCompleta
    ? blocos.find((b) => blocoMatchSegments(b.code, segments)) ?? null
    : null;

  const blocosAlt =
    configCompleta && !blocoEncontrado
      ? blocos.filter((b) => b.code.toUpperCase().startsWith("PED"))
      : [];

  return (
    <div>
      <div style={CARD}>
        <div style={LBL}>Eclusa (2 portas)?</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnStyle(eclusa === false)} onClick={() => setEclusa(false)}>
            🚪 Não — 1 porta
          </button>
          <button style={btnStyle(eclusa === true)} onClick={() => setEclusa(true)}>
            🔄 Sim — 2 portas
          </button>
        </div>
      </div>

      {eclusa !== null && (
        <div style={CARD}>
          <div style={LBL}>Material da porta</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnStyle(material === "metal")} onClick={() => setMaterial("metal")}>
              ⚙️ Metal
            </button>
            <button style={btnStyle(material === "vidro")} onClick={() => setMaterial("vidro")}>
              🪟 Vidro
            </button>
          </div>
        </div>
      )}

      {material !== null && (
        <div style={CARD}>
          <div style={LBL}>Tipo de abertura</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={btnStyle(abertura === "motorizada", material === "vidro")}
              onClick={() => material !== "vidro" && setAbertura("motorizada")}
              disabled={material === "vidro"}
            >
              ⚡ Motorizada
            </button>
            <button style={btnStyle(abertura === "mola")} onClick={() => setAbertura("mola")}>
              🔩 Mola Aérea
            </button>
            <button style={btnStyle(abertura === "nenhum")} onClick={() => setAbertura("nenhum")}>
              🚫 Nenhum
            </button>
          </div>
          {material === "vidro" && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              ⓘ Porta de vidro não suporta motorização
            </div>
          )}
        </div>
      )}

      {eclusa === true && abertura !== null && (
        <div style={CARD}>
          <div style={LBL}>Nível de controle da eclusa</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {([
              { id: "pad", title: "PAD — Controle Padrão", desc: "3 faciais: entrada, saída e eclusa" },
              { id: "e", title: "E — Somente Entrada", desc: "Facial apenas no acesso de entrada" },
              { id: "es", title: "ES — Reforçado (Entrada + Saída)", desc: "Facial na entrada e na saída" },
            ] as const).map((opt) => (
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
              {blocoEncontrado.code}
            </span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#fff", fontSize: 14 }}>
              {blocoEncontrado.name}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {blocoEncontrado.hh} HH
            </span>
          </div>
          {blocoEncontrado.descricao && (
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
                marginBottom: 14,
              }}
            >
              {blocoEncontrado.descricao}
            </div>
          )}

          <div style={{ ...LBL, marginTop: 8 }}>Equipamentos inclusos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {(blocoEncontrado.blocos_itens ?? []).map((it) => (
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
                  {it.qty * qtdBloco}
                  {it.variavel ? " (V)" : ""}
                </span>
              </div>
            ))}
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
            onClick={() => onSave({ [blocoEncontrado.id]: qtdBloco })}
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
      )}

      {configCompleta && !blocoEncontrado && blocosAlt.length > 0 && (
        <div style={CARD}>
          <div style={LBL}>Nenhum bloco exato — escolha manualmente</div>
          {blocosAlt.map((b) => (
            <button
              key={b.id}
              onClick={() => onSave({ [b.id]: qtdBloco })}
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
      )}

      {configCompleta && !blocoEncontrado && blocosAlt.length === 0 && (
        <div style={{ ...CARD, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📭</div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Nenhum bloco PED cadastrado. Cadastre na área de administração.
          </div>
        </div>
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
        <div style={{ fontSize: 38, marginBottom: 10 }}>📭</div>
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
        .select("blocos_selecionados")
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

  const saveMutation = useMutation({
    mutationFn: async (qtds: Record<string, number>) => {
      const { data: current } = await supabase
        .from("visita_orcamentos")
        .select("blocos_selecionados")
        .eq("visita_id", id)
        .maybeSingle();
      const existing =
        (current?.blocos_selecionados ?? {}) as Record<string, Record<string, number>>;
      const merged = { ...existing, [cat]: qtds };
      const { error } = await supabase.from("visita_orcamentos").upsert(
        {
          visita_id: id,
          blocos_selecionados: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "visita_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      toast.success(`${CAT_LABELS[cat]} salvo ✓`);
      const idx = CAT_ORDER.indexOf(cat);
      const nextCat = CAT_ORDER[idx + 1];
      if (nextCat) {
        navigate({ to: "/visita/$id/orcamento/blocos/$cat", params: { id, cat: nextCat } });
      } else {
        navigate({ to: "/visita/$id", params: { id } });
        toast.success("Orçamento concluído! ✅");
      }
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
