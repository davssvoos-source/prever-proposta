import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Loader2, CheckCircle2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeAutoItemsForBloco, isServicoCode } from "@/features/orcamento/blockAutoItems";
import { MARKUP_VENDA } from "@/features/comercial/regrasComerciais";
import type { CftvCamera } from "@/lib/blocos";

// ── Tipos calculados para os itens automáticos do bloco ──────────────────────
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
  cftvCameras?: CftvCamera[] | null;
  perimetro?: number;
  esquinas?: number;
  isLight: boolean;
  onConcluir?: () => void;
  hideSubtotal?: boolean;
  hideConcluir?: boolean;
  /** Resumo da visita: lista ultra-compacta, só nome+modelo, sem valores,
   *  sem editar qtd/remover e sem adicionar item manual. */
  readOnly?: boolean;
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
  // Fundo sólido (sem transparência) para legibilidade sobre o background animado
  background: isLight ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,215,0,0.18)",
  borderRadius: 12,
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  gap: 10,
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
  cftvCameras,
  perimetro,
  esquinas,
  isLight,
  onConcluir,
  hideSubtotal = false,
  hideConcluir = false,
  readOnly = false,
}: Props) {
  const qc = useQueryClient();
  const [seeded, setSeeded] = useState(false);

  // Item manual: busca por nome ou modelo no catálogo de equipamentos
  const [buscaPor, setBuscaPor] = useState<"nome" | "modelo">("nome");
  const [busca, setBusca] = useState("");
  const [novoQtd, setNovoQtd] = useState<number>(1);

  // 1) Semeia auto items apenas 1x por bloco; itens manuais não bloqueiam o seed.
  useEffect(() => {
    let ativo = true;
    (async () => {
      // já existe algum item automático? Se sim, preserva inclusive removidos pelo usuário.
      const { data: existentes } = await supabase
        .from("visita_bloco_itens" as any)
        .select("id")
        .eq("visita_bloco_id", visitaBlocoId)
        .eq("origem", "auto")
        .limit(1);
      if (!ativo) return;
      if (existentes && existentes.length > 0) {
        setSeeded(true);
        return;
      }
      const itens = computeAutoItemsForBloco({
        codigo,
        tipoBloco: tipoBloco as any,
        tecnologia,
        qtdDome,
        qtdBullet,
        cftvCameras,
        perimetro,
        esquinas,
      });
      if (itens.length > 0) {
        const rows = itens.map((it) => ({
          visita_bloco_id: visitaBlocoId,
          cod_eq: it.cod_eq,
          qtd: it.qtd,
          origem: "auto" as const,
          observacao: it.observacao ?? null,
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
          preco: +(Number(e.custo || 0) * Number(e.markup || MARKUP_VENDA)).toFixed(2),
        };
      }
      return map;
    },
    enabled: codes.length > 0,
  });

  // 3b) Serviços mensais (códigos SV*) — nome/preço vêm da tabela `servicos`
  const svCodes = useMemo(() => codes.filter((c) => isServicoCode(c)), [codes]);
  const { data: svMap = {} } = useQuery({
    queryKey: ["servicos_by_code", svCodes.sort().join(",")],
    queryFn: async () => {
      if (svCodes.length === 0) return {};
      const { data, error } = await supabase
        .from("servicos")
        .select("code,nome,preco_unitario_mensal")
        .in("code", svCodes);
      if (error) throw error;
      const map: Record<string, { nome: string; preco: number }> = {};
      for (const s of (data as any[]) ?? []) {
        map[s.code] = { nome: s.nome, preco: Number(s.preco_unitario_mensal || 0) };
      }
      return map;
    },
    enabled: svCodes.length > 0,
  });

  // Invalida TODAS as telas que leem itens deste bloco: o editor, o preview da
  // lista de blocos (chave própria) e a guarita do projeto (pré-envio). Sem isto,
  // um item manual sumia da lista/preview por ficar em cache com chave diferente.
  function invalidarItens() {
    qc.invalidateQueries({ queryKey: ["visita_bloco_itens", visitaBlocoId] });
    qc.invalidateQueries({ queryKey: ["visita_bloco_itens_preview"] });
    qc.invalidateQueries({ queryKey: ["visita_guarita"] });
  }

  const atualizarMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<VbiRow> }) => {
      const { error } = await supabase.from("visita_bloco_itens" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarItens(),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  // Resultados da busca do item manual (nome ou modelo, conforme o switch)
  const buscaLimpa = busca.trim();
  const { data: resultadosBusca = [], isFetching: buscando } = useQuery({
    queryKey: ["equip_busca", buscaPor, buscaLimpa],
    enabled: buscaLimpa.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("code,nome,modelo")
        .ilike(buscaPor, `%${buscaLimpa}%`)
        .order("nome")
        .limit(8);
      if (error) throw error;
      return (((data as any[]) ?? []) as { code: string | null; nome: string; modelo: string | null }[])
        .filter((e) => !!e.code);
    },
  });

  const adicionarMut = useMutation({
    mutationFn: async (eq: { code: string; nome: string }) => {
      const { error } = await supabase.from("visita_bloco_itens" as any).insert({
        visita_bloco_id: visitaBlocoId,
        cod_eq: eq.code,
        qtd: Math.max(1, novoQtd || 1),
        origem: "manual",
        observacao: eq.nome || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBusca("");
      setNovoQtd(1);
      invalidarItens();
      toast.success("Item adicionado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const visiveis = itens.filter((i) => !i.removido);
  // Serviços mensais (SV*) ficam fora da lista de equipamentos e do subtotal
  const equipVisiveis = visiveis.filter((i) => !isServicoCode(i.cod_eq));
  const mensaisVisiveis = visiveis.filter((i) => isServicoCode(i.cod_eq));
  const total = equipVisiveis.reduce((s, i) => s + (eqMap[i.cod_eq]?.preco ?? 0) * i.qtd, 0);
  const totalMensal = mensaisVisiveis.reduce(
    (s, i) => s + (svMap[i.cod_eq]?.preco ?? 0) * i.qtd,
    0,
  );

  if (!seeded || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, gap: 10 }}>
        <Loader2 className="animate-spin" size={20} />
        <span style={{ color: isLight ? "#4a5060" : "rgba(255,255,255,0.7)" }}>Calculando equipamentos…</span>
      </div>
    );
  }

  // ── Resumo (read-only): lista compacta, só nome+modelo, sem valores/edição ──
  if (readOnly) {
    const linha = (nome: string, modelo: string | null | undefined, qtd: number, key: string, idx: number) => (
      <div
        key={key}
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 12,
          padding: "3px 0",
          borderTop: idx > 0 ? (isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)") : "none",
        }}
      >
        <span style={{ fontWeight: 700, color: isLight ? "#0a0b0e" : "#fff", flexShrink: 0 }}>{qtd}×</span>
        <span style={{ color: isLight ? "#0a0b0e" : "#fff", flex: 1, minWidth: 0 }}>
          {nome}
          {modelo && <span style={{ color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)" }}> — {modelo}</span>}
        </span>
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {equipVisiveis.length === 0 ? (
          <div style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", padding: "2px 0" }}>
            Nenhum equipamento
          </div>
        ) : (
          equipVisiveis.map((it, idx) => {
            const eq = eqMap[it.cod_eq];
            return linha(eq?.nome || it.observacao || it.cod_eq, eq?.modelo, it.qtd, it.id, idx);
          })
        )}
        {mensaisVisiveis.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: isLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)", marginTop: 6 }}>
              MENSALIDADES
            </div>
            {mensaisVisiveis.map((it, idx) => {
              const sv = svMap[it.cod_eq];
              return linha(sv?.nome || it.observacao || it.cod_eq, null, it.qtd, it.id, idx);
            })}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
        color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
      }}>
        EQUIPAMENTOS DESTE BLOCO ({equipVisiveis.length})
      </div>

      {equipVisiveis.length === 0 && (
        <div style={{
          padding: 16, textAlign: "center", borderRadius: 12,
          background: isLight ? "#f5f6f8" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
          color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", fontSize: 13,
        }}>
          Nenhum equipamento — adicione um manualmente abaixo.
        </div>
      )}

      {equipVisiveis.map((it) => {
        const eq = eqMap[it.cod_eq];
        const nome = eq?.nome || it.observacao || it.cod_eq;
        const sub = [eq?.modelo, it.origem === "manual" ? "MANUAL" : null].filter(Boolean).join(" · ");
        return (
          <div key={it.id} style={CARD(isLight)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>
                {nome}
              </div>
              {sub && (
                <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", marginTop: 2 }}>
                  {sub}
                </div>
              )}
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

      {/* Mensalidades (serviços SV — ex.: I.A por câmera) */}
      {mensaisVisiveis.length > 0 && (
        <>
          <div style={{
            marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
            color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
          }}>
            MENSALIDADES ({mensaisVisiveis.length})
          </div>
          {mensaisVisiveis.map((it) => {
            const sv = svMap[it.cod_eq];
            const nome = sv?.nome || it.observacao || it.cod_eq;
            const preco = sv?.preco ?? 0;
            return (
              <div key={it.id} style={CARD(isLight)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>
                    {nome}
                  </div>
                  <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", marginTop: 2 }}>
                    Serviço mensal{it.origem === "manual" ? " · MANUAL" : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "#b87800", marginTop: 2 }}>
                    R$ {(preco * it.qtd).toFixed(2)}/mês
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
          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: isLight ? "rgba(180,120,0,0.10)" : "rgba(255,215,0,0.08)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#b87800" }}>TOTAL MENSAL</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: isLight ? "#0a0b0e" : "#fff" }}>
              R$ {totalMensal.toFixed(2)}/mês
            </span>
          </div>
        </>
      )}

      {/* Add manual — busca por nome ou modelo */}
      <div style={{ ...CARD(isLight), flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#b87800" }}>
          ADICIONAR ITEM MANUAL
        </div>

        {/* Switch: buscar por nome | modelo */}
        <div style={{
          display: "flex", borderRadius: 10, overflow: "hidden",
          border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
        }}>
          {([["nome", "Nome"], ["modelo", "Modelo"]] as const).map(([val, label]) => {
            const ativo = buscaPor === val;
            return (
              <button
                key={val}
                onClick={() => setBuscaPor(val)}
                style={{
                  flex: 1, padding: "8px 0", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                  background: ativo
                    ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                    : "transparent",
                  color: ativo ? "#0A0A0A" : isLight ? "#4a5060" : "rgba(255,255,255,0.6)",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={buscaPor === "nome" ? "Buscar por nome (ex.: Leitora Facial)" : "Buscar por modelo (ex.: DS-KAB6)"}
          style={{
            padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)",
            background: isLight ? "#fff" : "#191921", color: isLight ? "#0a0b0e" : "#fff",
            fontSize: 13,
          }}
        />

        {/* Quantidade a adicionar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)" }}>Quantidade</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button style={CIRCLE_BTN} onClick={() => setNovoQtd((q) => Math.max(1, q - 1))}><Minus size={14} /></button>
            <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>{novoQtd}</span>
            <button style={CIRCLE_BTN} onClick={() => setNovoQtd((q) => q + 1)}><Plus size={14} /></button>
          </div>
        </div>

        {/* Resultados da busca — toque para adicionar */}
        {buscaLimpa.length >= 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {buscando && resultadosBusca.length === 0 ? (
              <div style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", textAlign: "center", padding: 8 }}>
                Buscando…
              </div>
            ) : resultadosBusca.length === 0 ? (
              <div style={{ fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.5)", textAlign: "center", padding: 8 }}>
                Nenhum equipamento encontrado.
              </div>
            ) : (
              resultadosBusca.map((eq) => (
                <button
                  key={eq.code}
                  onClick={() => adicionarMut.mutate({ code: eq.code!, nome: eq.nome })}
                  disabled={adicionarMut.isPending}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,215,0,0.20)",
                    background: isLight ? "#f5f6f8" : "#1d1d25",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? "#0a0b0e" : "#fff" }}>
                      {eq.nome}
                    </div>
                    {eq.modelo && (
                      <div style={{ fontSize: 11, color: isLight ? "#4a5060" : "rgba(255,255,255,0.6)", marginTop: 1 }}>
                        {eq.modelo}
                      </div>
                    )}
                  </div>
                  <PlusCircle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {!hideSubtotal && (
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
      )}

      {!hideConcluir && onConcluir && (
        <button
          onClick={onConcluir}
          style={{
            marginTop: 8, width: "100%", padding: "16px 0",
            background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", border: "none", borderRadius: 999,
            color: "#0A0A0A", fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <CheckCircle2 size={18} /> CONCLUIR BLOCO
        </button>
      )}
    </div>
  );
}

