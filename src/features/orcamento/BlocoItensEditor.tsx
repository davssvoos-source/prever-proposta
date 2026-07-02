import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Loader2, CheckCircle2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ── Tipos vindos da edge function `calcular` (ação itens_bloco) ──────────────
export interface CalcItem {
  cod_eq: string;
  nome: string;
  marca?: string;
  modelo?: string;
  qtd: number;
  preco: number;
  total_preco: number;
}

interface Props {
  visitaBlocoId: string;
  codigo: string;
  tipoBloco: string; // PED | VEI | CFTV | AL | CER | CENT
  tecnologia?: string | null;
  qtdDome?: number;
  qtdBullet?: number;
  isLight: boolean;
  onConcluir?: () => void;
  hideSubtotal?: boolean;
  hideConcluir?: boolean;
}


interface VbiRow {
  id: string;
  cod_eq: string;
  qtd: number;
  origem: "auto" | "manual";
  removido: boolean;
  observacao: string | null;
}

const CARD = (isLight: boolean): React.CSSProperties => ({
  background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,215,0,0.18)",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  alignItems: "center",
  gap: 12,
});

const CIRCLE_BTN: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "1px solid rgba(0,0,0,0.15)",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

export function BlocoItensEditor({
  visitaBlocoId,
  codigo,
  tipoBloco,
  tecnologia,
  qtdDome,
  qtdBullet,
  isLight,
  onConcluir,
  hideSubtotal = false,
  hideConcluir = false,
}: Props) {
  const qc = useQueryClient();
  const [seeded, setSeeded] = useState(false);

  const [novoCod, setNovoCod] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoQtd, setNovoQtd] = useState<number>(1);

  // 1) Semeia auto items (chama edge function `calcular`) apenas 1x
  useEffect(() => {
    let ativo = true;
    (async () => {
      // já semeado antes?
      const { data: existentes } = await supabase
        .from("visita_bloco_itens" as any)
        .select("id")
        .eq("visita_bloco_id", visitaBlocoId)
        .limit(1);
      if (!ativo) return;
      if (existentes && existentes.length > 0) {
        setSeeded(true);
        return;
      }
      // pede lista automática
      const body: any =
        tipoBloco === "CFTV"
          ? { action: "itens_bloco", tipo: "CFTV", tech: tecnologia, nDome: qtdDome ?? 0, nBullet: qtdBullet ?? 0 }
          : { action: "itens_bloco", codigo };
      const { data, error } = await supabase.functions.invoke("calcular", { body });
      if (!ativo) return;
      if (error) {
        toast.error("Não foi possível calcular equipamentos: " + error.message);
        setSeeded(true);
        return;
      }
      const itens: CalcItem[] = data?.itens ?? [];
      if (itens.length > 0) {
        const rows = itens.map((it) => ({
          visita_bloco_id: visitaBlocoId,
          cod_eq: it.cod_eq,
          qtd: it.qtd,
          origem: "auto" as const,
        }));
        const { error: insErr } = await supabase.from("visita_bloco_itens" as any).insert(rows);
        if (insErr) toast.error("Erro ao salvar itens: " + insErr.message);
      }
      setSeeded(true);
      qc.invalidateQueries({ queryKey: ["visita_bloco_itens", visitaBlocoId] });
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitaBlocoId]);

  // 2) Lê o que está persistido (auto + manual + removido)
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["visita_bloco_itens", visitaBlocoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_bloco_itens" as any)
        .select("*")
        .eq("visita_bloco_id", visitaBlocoId)
        .order("created_at");
      if (error) throw error;
      return ((data as unknown) as VbiRow[]) ?? [];
    },
    enabled: seeded,
  });

  // 3) Dados enriquecidos (nome/preço) — busca equipamentos por code
  const codes = useMemo(() => Array.from(new Set(itens.map((i) => i.cod_eq))), [itens]);
  const { data: eqMap = {} } = useQuery({
    queryKey: ["equipamentos_by_code", codes.sort().join(",")],
    queryFn: async () => {
      if (codes.length === 0) return {};
      const { data, error } = await supabase
        .from("equipamentos")
        .select("code,nome,marca,modelo,custo,markup")
        .in("code", codes);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const e of (data as any[]) ?? []) {
        map[e.code] = {
          nome: e.nome,
          marca: e.marca,
          modelo: e.modelo,
          preco: +(Number(e.custo || 0) * Number(e.markup || 1.389)).toFixed(2),
        };
      }
      return map;
    },
    enabled: codes.length > 0,
  });

  const atualizarMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VbiRow> }) => {
      const { error } = await supabase.from("visita_bloco_itens" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visita_bloco_itens", visitaBlocoId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const adicionarMut = useMutation({
    mutationFn: async () => {
      if (!novoCod.trim()) throw new Error("Informe o código do equipamento");
      const { error } = await supabase.from("visita_bloco_itens" as any).insert({
        visita_bloco_id: visitaBlocoId,
        cod_eq: novoCod.trim().toUpperCase(),
        qtd: Math.max(1, novoQtd || 1),
        origem: "manual",
        observacao: novoNome.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNovoCod("");
      setNovoNome("");
      setNovoQtd(1);
      qc.invalidateQueries({ queryKey: ["visita_bloco_itens", visitaBlocoId] });
      toast.success("Item adicionado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const visiveis = itens.filter((i) => !i.removido);
  const total = visiveis.reduce((s, i) => s + (eqMap[i.cod_eq]?.preco ?? 0) * i.qtd, 0);

  if (!seeded || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, gap: 10 }}>
        <Loader2 className="animate-spin" size={20} />
        <span style={{ color: isLight ? "#4a5060" : "rgba(255,255,255,0.7)" }}>Calculando equipamentos…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
        color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
      }}>
        EQUIPAMENTOS DESTE BLOCO ({visiveis.length})
      </div>

      {visiveis.length === 0 && (
        <div style={{
          padding: 16, textAlign: "center", borderRadius: 12,
          background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
          color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", fontSize: 13,
        }}>
          Nenhum equipamento — adicione um manualmente abaixo.
        </div>
      )}

      {visiveis.map((it) => {
        const eq = eqMap[it.cod_eq];
        const nome = eq?.nome || it.observacao || it.cod_eq;
        const preco = eq?.preco ?? 0;
        return (
          <div key={it.id} style={CARD(isLight)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>
                {nome}
              </div>
              <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", marginTop: 2 }}>
                {it.cod_eq}{eq?.modelo ? ` · ${eq.modelo}` : ""}{it.origem === "manual" ? " · MANUAL" : ""}
              </div>
              <div style={{ fontSize: 11, color: "#b87800", marginTop: 2 }}>
                R$ {(preco * it.qtd).toFixed(2)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                style={CIRCLE_BTN}
                onClick={() => atualizarMut.mutate({ id: it.id, patch: { qtd: Math.max(1, it.qtd - 1) } })}
                aria-label="Diminuir"
              >
                <Minus size={14} />
              </button>
              <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{it.qtd}</span>
              <button
                style={CIRCLE_BTN}
                onClick={() => atualizarMut.mutate({ id: it.id, patch: { qtd: it.qtd + 1 } })}
                aria-label="Aumentar"
              >
                <Plus size={14} />
              </button>
              <button
                style={{ ...CIRCLE_BTN, borderColor: "rgba(220,38,38,0.35)", color: "#dc2626", marginLeft: 4 }}
                onClick={() => atualizarMut.mutate({ id: it.id, patch: { removido: true } })}
                aria-label="Remover"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Add manual */}
      <div style={{ ...CARD(isLight), flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#b87800" }}>
          ADICIONAR ITEM MANUAL
        </div>
        <input
          value={novoCod}
          onChange={(e) => setNovoCod(e.target.value)}
          placeholder="Código (ex.: EQ092)"
          style={{
            padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)",
            background: isLight ? "#fff" : "rgba(255,255,255,0.05)", color: isLight ? "#0a0b0e" : "#fff",
            fontSize: 13,
          }}
        />
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Descrição (opcional)"
          style={{
            padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)",
            background: isLight ? "#fff" : "rgba(255,255,255,0.05)", color: isLight ? "#0a0b0e" : "#fff",
            fontSize: 13,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button style={CIRCLE_BTN} onClick={() => setNovoQtd((q) => Math.max(1, q - 1))}><Minus size={14} /></button>
            <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>{novoQtd}</span>
            <button style={CIRCLE_BTN} onClick={() => setNovoQtd((q) => q + 1)}><Plus size={14} /></button>
          </div>
          <button
            onClick={() => adicionarMut.mutate()}
            disabled={adicionarMut.isPending || !novoCod.trim()}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 10, border: "none",
              background: "#F59E0B", color: "#0A0A0A", fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: novoCod.trim() ? 1 : 0.5,
            }}
          >
            <PlusCircle size={16} /> ADICIONAR
          </button>
        </div>
      </div>

      <div style={{
        marginTop: 6, padding: "12px 14px", borderRadius: 12,
        background: isLight ? "rgba(180,120,0,0.10)" : "rgba(255,215,0,0.08)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#b87800" }}>SUBTOTAL</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: isLight ? "#0a0b0e" : "#fff" }}>
          R$ {total.toFixed(2)}
        </span>
      </div>

      <button
        onClick={onConcluir}
        style={{
          marginTop: 8, width: "100%", padding: "16px 0",
          background: "#F59E0B", border: "none", borderRadius: 999,
          color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <CheckCircle2 size={18} /> CONCLUIR BLOCO
      </button>
    </div>
  );
}
