import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ChevronRight } from "lucide-react";
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

function BlocosCatPage() {
  const { id, cat } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const prefixes = CAT_PREFIXES[cat] ?? [];

  const { data: todosOsBlocos, isLoading } = useQuery({
    queryKey: ["blocos-com-itens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocos")
        .select("*, blocos_itens(*)")
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as Bloco[];
    },
  });

  const blocos = (todosOsBlocos ?? []).filter((b) =>
    prefixes.some((p) => b.code.toUpperCase().startsWith(p)),
  );

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

  const [qtds, setQtds] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!orcamento?.blocos_selecionados) return;
    const saved = (orcamento.blocos_selecionados as Record<string, Record<string, number>>)[cat];
    if (saved) setQtds(saved);
  }, [orcamento, cat]);

  const increment = (blocoId: string) =>
    setQtds((p) => ({ ...p, [blocoId]: (p[blocoId] ?? 0) + 1 }));

  const decrement = (blocoId: string) =>
    setQtds((p) => {
      const next = Math.max(0, (p[blocoId] ?? 0) - 1);
      const copy = { ...p };
      if (next === 0) delete copy[blocoId];
      else copy[blocoId] = next;
      return copy;
    });

  const saveMutation = useMutation({
    mutationFn: async (goNext: boolean) => {
      const { data: current } = await supabase
        .from("visita_orcamentos")
        .select("blocos_selecionados")
        .eq("visita_id", id)
        .maybeSingle();
      const existing =
        ((current?.blocos_selecionados ?? {}) as Record<string, Record<string, number>>) ?? {};
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
      return goNext;
    },
    onSuccess: (goNext) => {
      qc.invalidateQueries({ queryKey: ["orcamento", id] });
      toast.success("Blocos salvos");
      if (goNext) {
        const idx = CAT_ORDER.indexOf(cat);
        const nextCat = CAT_ORDER[idx + 1];
        if (nextCat) {
          navigate({
            to: "/visita/$id/orcamento/blocos/$cat",
            params: { id, cat: nextCat },
          });
        } else {
          navigate({ to: "/visita/$id", params: { id } });
          toast.success("Orçamento concluído! ✅");
        }
      } else {
        navigate({ to: "/visita/$id/orcamento/categorias", params: { id } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalSelecionados = Object.values(qtds).reduce((a, b) => a + b, 0);
  const isLast = CAT_ORDER.indexOf(cat) === CAT_ORDER.length - 1;

  const LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: "rgba(255,192,0,0.65)",
  };

  return (
    <div style={{ padding: "12px 14px 140px" }}>
      {/* Header */}
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
            Passo 3 de 3 — Selecione os blocos
          </div>
        </div>
        {totalSelecionados > 0 && (
          <div
            style={{
              background: "rgba(255,192,0,0.15)",
              border: "1px solid rgba(255,192,0,0.35)",
              borderRadius: 12,
              padding: "6px 10px",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 11,
              color: "#FFC000",
            }}
          >
            {totalSelecionados} bloco{totalSelecionados !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {isLoading && (
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
      )}

      {!isLoading && blocos.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            background: "rgba(8,8,12,0.22)",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 10 }}>📭</div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Nenhum bloco cadastrado para esta categoria.
          </div>
        </div>
      )}

      {blocos.map((bloco) => {
        const qty = qtds[bloco.id] ?? 0;
        return (
          <div
            key={bloco.id}
            style={{
              borderRadius: 18,
              padding: 16,
              marginBottom: 10,
              backdropFilter: "blur(12px) saturate(130%)",
              transition: "border 0.2s, background 0.2s",
              border:
                qty > 0
                  ? "1px solid rgba(255,192,0,0.35)"
                  : "1px solid rgba(255,192,0,0.08)",
              background: qty > 0 ? "rgba(255,192,0,0.06)" : "rgba(8,8,12,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: qty > 0 ? 14 : 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 500,
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      color: "#FFC000",
                      background: "rgba(255,192,0,0.10)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {bloco.code}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 400,
                      fontSize: 14,
                      color: "#fff",
                    }}
                  >
                    {bloco.name}
                  </span>
                </div>
                {bloco.descricao && (
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                      marginBottom: 4,
                    }}
                  >
                    {bloco.descricao}
                  </div>
                )}
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {bloco.hh} HH
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => decrement(bloco.id)}
                  disabled={qty === 0}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background:
                      qty > 0 ? "rgba(255,192,0,0.15)" : "rgba(255,255,255,0.05)",
                    border:
                      qty > 0
                        ? "1px solid rgba(255,192,0,0.35)"
                        : "1px solid rgba(255,255,255,0.08)",
                    color: qty > 0 ? "#FFC000" : "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: qty > 0 ? "pointer" : "default",
                  }}
                >
                  <Minus size={16} />
                </button>
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 400,
                    fontSize: 18,
                    color: qty > 0 ? "#FFC000" : "rgba(255,255,255,0.35)",
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {qty}
                </span>
                <button
                  onClick={() => increment(bloco.id)}
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

            {qty > 0 && bloco.blocos_itens && bloco.blocos_itens.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid rgba(255,192,0,0.15)",
                  paddingTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ ...LABEL, marginBottom: 6 }}>Itens inclusos</div>
                {bloco.blocos_itens.map((it) => (
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
                      {it.qty * qty}
                      {it.variavel ? " (V)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Botões rodapé */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => saveMutation.mutate(true)}
          disabled={saveMutation.isPending}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 28,
            background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
            border: "none",
            color: "#08090E",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 24px rgba(255,192,0,0.35)",
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending
            ? "Salvando..."
            : isLast
              ? "Concluir orçamento"
              : "Salvar e próxima categoria"}
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => saveMutation.mutate(false)}
          disabled={saveMutation.isPending}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          Salvar e voltar às categorias
        </button>
      </div>
    </div>
  );
}
