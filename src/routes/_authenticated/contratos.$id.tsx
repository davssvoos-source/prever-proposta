// Detalhe do contrato — vigência, cobertura por equipamento e tabela de preços.
// Etapa U2 da unificação. Ver docs/PLANO_UNIFICACAO.md §4.1.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { formatarDocumento } from "@/lib/normalizar";
import {
  useContrato, useCoberturaContrato, usePrecosContrato, diasParaVencer,
  atualizarContrato, excluirContrato, atualizarCobertura, removerCobertura,
  adicionarCobertura, adicionarPrecos, removerPreco, urlAssinadaContrato,
  MODALIDADE_LABEL, MODALIDADE_REGRA, TIPO_COBRANCA_LABEL, COBERTURA_LABEL,
  STATUS_CONTRATO_LABEL, STATUS_CONTRATO_CORES,
  type Cobertura, type ContratoPatch, type ModalidadeContrato,
  type StatusContrato, type TipoCobranca,
} from "@/features/contratos/data";

export const Route = createFileRoute("/_authenticated/contratos/$id")({
  component: ContratoDetalhePage,
});

function ContratoDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: contrato, isLoading } = useContrato(id);
  const { data: cobertura = [] } = useCoberturaContrato(id);
  const { data: precos = [] } = usePrecosContrato(id);

  const [novoEquip, setNovoEquip] = useState("");
  const [novaSerie, setNovaSerie] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novoValor, setNovoValor] = useState("");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = { ...card(isLight), padding: "16px", display: "flex", flexDirection: "column", gap: 12 };
  const SEC: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.16em",
    textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 12px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: FONT, fontWeight: 300, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const chip = (ativo: boolean): CSSProperties => ({
    padding: "8px 12px", borderRadius: 10,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
    background: ativo ? GOLD_GRAD : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 11.5, cursor: "pointer",
  });

  const salvar = useMutation({
    mutationFn: async (patch: ContratoPatch) => atualizarContrato(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contrato", id] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const mexerCobertura = useMutation({
    mutationFn: async (
      acao:
        | { tipo: "add" }
        | { tipo: "del"; itemId: string }
        | { tipo: "cobertura"; itemId: string; valor: Cobertura },
    ) => {
      if (acao.tipo === "del") return removerCobertura(acao.itemId);
      if (acao.tipo === "cobertura") return atualizarCobertura(acao.itemId, { cobertura: acao.valor });
      if (!novoEquip.trim()) throw new Error("Descreva o equipamento.");
      await adicionarCobertura(id, [
        { descricao: novoEquip.trim(), numero_serie: novaSerie.trim() || null, cobertura: "integral", quantidade: 1 },
      ]);
    },
    onSuccess: () => {
      setNovoEquip("");
      setNovaSerie("");
      qc.invalidateQueries({ queryKey: ["contrato-cobertura", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mexerPreco = useMutation({
    mutationFn: async (acao: { tipo: "add" } | { tipo: "del"; precoId: string }) => {
      if (acao.tipo === "del") return removerPreco(acao.precoId);
      const valor = Number(novoValor.replace(",", "."));
      if (!novoPreco.trim() || !Number.isFinite(valor)) throw new Error("Informe descrição e valor.");
      await adicionarPrecos(id, [{ descricao: novoPreco.trim(), valor_unitario: valor }]);
    },
    onSuccess: () => {
      setNovoPreco("");
      setNovoValor("");
      qc.invalidateQueries({ queryKey: ["contrato-precos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => excluirContrato(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contratos"] });
      toast.success("Contrato excluído.");
      navigate({ to: "/contratos" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir."),
  });

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: FONT }}>Carregando…</div>;
  }
  if (!contrato) {
    return <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: FONT }}>Contrato não encontrado.</div>;
  }

  const st = STATUS_CONTRATO_CORES[contrato.status];
  const dias = diasParaVencer(contrato);
  const podeAtivar = contrato.status !== "ativo" && !!contrato.vigencia_inicio;

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/contratos" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, lineHeight: 1.3 }}>
            {contrato.cliente?.nome ?? "Cliente removido"}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary, marginTop: 3 }}>
            {MODALIDADE_LABEL[contrato.modalidade]}
            {contrato.numero ? ` · nº ${contrato.numero}` : ""}
            {contrato.cliente?.documento ? ` · ${formatarDocumento(contrato.cliente.documento)}` : ""}
          </div>
        </div>
        <span style={{
          flexShrink: 0, padding: "5px 10px", borderRadius: 999,
          fontFamily: FONT, fontWeight: 600, fontSize: 9.5,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: isLight ? st.light : st.dark, background: st.bg, border: `1px solid ${st.border}`,
        }}>
          {STATUS_CONTRATO_LABEL[contrato.status]}
        </span>
      </div>

      {/* Situação */}
      <div style={CARD}>
        <span style={SEC}>Situação</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["rascunho", "ativo", "encerrado"] as StatusContrato[]).map((s) => (
            <button
              key={s}
              type="button"
              style={chip(contrato.status === s)}
              onClick={() => {
                if (s === "ativo" && !contrato.vigencia_inicio) {
                  toast.error("Defina o início da vigência antes de ativar — é ele que decide o que está coberto.");
                  return;
                }
                salvar.mutate({ status: s });
              }}
            >
              {STATUS_CONTRATO_LABEL[s]}
            </button>
          ))}
        </div>
        {contrato.status === "rascunho" && (
          <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: gold, lineHeight: 1.5 }}>
            Rascunho não vale para nada ainda: só o contrato <strong>ativo</strong> entra na decisão de cobrar.
            {podeAtivar ? "" : " Preencha o início da vigência para poder ativar."}
          </span>
        )}
        {contrato.status === "ativo" && dias != null && dias <= 60 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <TriangleAlert size={16} color={gold} />
            <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
              {dias < 0 ? `Vigência venceu há ${Math.abs(dias)} dias.` : `Vence em ${dias} dias.`}
            </span>
          </div>
        )}
        {contrato.confianca_extracao != null && (
          <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary }}>
            Preenchido por leitura de PDF · confiança {Math.round(contrato.confianca_extracao * 100)}%
          </span>
        )}
        {contrato.arquivo_path && (
          <button
            onClick={async () => {
              const url = await urlAssinadaContrato(contrato.arquivo_path as string);
              if (url) window.open(url, "_blank");
              else toast.error("Não consegui abrir o arquivo.");
            }}
            style={{
              alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6,
              padding: "8px 12px", borderRadius: 10, cursor: "pointer",
              background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
              color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 12,
            }}
          >
            <FileText size={14} color={gold} /> Abrir PDF do contrato
          </button>
        )}
      </div>

      {/* Condições */}
      <div style={CARD}>
        <span style={SEC}>Condições</span>
        <div>
          <label style={LABEL}>Modalidade</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(MODALIDADE_LABEL) as ModalidadeContrato[]).map((m) => (
              <button key={m} type="button" style={chip(contrato.modalidade === m)} onClick={() => salvar.mutate({ modalidade: m })}>
                {MODALIDADE_LABEL[m]}
              </button>
            ))}
          </div>
          <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary }}>
            {MODALIDADE_REGRA[contrato.modalidade]}
          </span>
        </div>
        <div>
          <label style={LABEL}>Forma de cobrança</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(TIPO_COBRANCA_LABEL) as TipoCobranca[]).map((t) => (
              <button key={t} type="button" style={chip(contrato.tipo_cobranca === t)} onClick={() => salvar.mutate({ tipo_cobranca: t })}>
                {TIPO_COBRANCA_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Início</label>
            <input style={INPUT} type="date" defaultValue={contrato.vigencia_inicio ?? ""}
              onBlur={(e) => salvar.mutate({ vigencia_inicio: e.target.value || null })} />
          </div>
          <div>
            <label style={LABEL}>Fim (vazio = aberta)</label>
            <input style={INPUT} type="date" defaultValue={contrato.vigencia_fim ?? ""}
              onBlur={(e) => salvar.mutate({ vigencia_fim: e.target.value || null })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Valor mensal</label>
            <input style={INPUT} defaultValue={contrato.valor_mensal ?? ""} inputMode="decimal"
              onBlur={(e) => salvar.mutate({ valor_mensal: e.target.value ? Number(e.target.value.replace(",", ".")) : null })} />
          </div>
          <div>
            <label style={LABEL}>Vencimento</label>
            <input style={INPUT} defaultValue={contrato.dia_vencimento ?? ""} inputMode="numeric"
              onBlur={(e) => salvar.mutate({ dia_vencimento: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div>
            <label style={LABEL}>Visitas/mês</label>
            <input style={INPUT} defaultValue={contrato.franquia_visitas_mes ?? ""} inputMode="numeric"
              onBlur={(e) => salvar.mutate({ franquia_visitas_mes: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
        <div>
          <label style={LABEL}>A mensalidade já cobre</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" style={chip(contrato.inclui_mao_de_obra)} onClick={() => salvar.mutate({ inclui_mao_de_obra: !contrato.inclui_mao_de_obra })}>
              Mão de obra
            </button>
            <button type="button" style={chip(contrato.inclui_pecas)} onClick={() => salvar.mutate({ inclui_pecas: !contrato.inclui_pecas })}>
              Peças
            </button>
            <button type="button" style={chip(contrato.inclui_deslocamento)} onClick={() => salvar.mutate({ inclui_deslocamento: !contrato.inclui_deslocamento })}>
              Deslocamento
            </button>
          </div>
        </div>
      </div>

      {/* Cobertura por equipamento */}
      <div style={CARD}>
        <span style={SEC}>Cobertura por equipamento</span>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
          Só o que foge da regra geral precisa entrar aqui. O que não estiver listado segue as condições acima.
        </span>
        {cobertura.map((it) => (
          <div
            key={it.id}
            style={{
              padding: "10px 12px", borderRadius: 12,
              background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
              border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column", gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontSize: 13 }}>
                  {[it.marca, it.modelo].filter(Boolean).join(" ") || it.descricao || "Equipamento"}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                  {it.numero_serie ? `Série ${it.numero_serie}` : ""}
                  {it.tag_patrimonio ? ` · TAG ${it.tag_patrimonio}` : ""}
                  {it.local ? ` · ${it.local}` : ""}
                </div>
              </div>
              <button
                onClick={() => mexerCobertura.mutate({ tipo: "del", itemId: it.id })}
                style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(Object.keys(COBERTURA_LABEL) as Cobertura[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ ...chip(it.cobertura === c), fontSize: 10.5, padding: "6px 10px" }}
                  onClick={() => mexerCobertura.mutate({ tipo: "cobertura", itemId: it.id, valor: c })}
                >
                  {COBERTURA_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 44px", gap: 8 }}>
          <input style={INPUT} value={novoEquip} onChange={(e) => setNovoEquip(e.target.value)} placeholder="Equipamento" />
          <input style={INPUT} value={novaSerie} onChange={(e) => setNovaSerie(e.target.value)} placeholder="Nº série" />
          <button
            onClick={() => mexerCobertura.mutate({ tipo: "add" })}
            disabled={!novoEquip.trim()}
            style={{
              height: 44, borderRadius: 12, border: "none", background: GOLD_GRAD, color: "#08090E",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: novoEquip.trim() ? "pointer" : "default", opacity: novoEquip.trim() ? 1 : 0.5,
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Preços do contrato */}
      <div style={CARD}>
        <span style={SEC}>Preços deste contrato</span>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
          Vencem a tabela padrão do catálogo. Sem preço aqui nem no catálogo, o item vai para conferência — nunca é cobrado a zero.
        </span>
        {precos.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontFamily: FONT, fontSize: 13 }}>
              {p.descricao}
              {p.unidade ? <span style={{ color: textSecondary }}> / {p.unidade}</span> : null}
            </span>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
              {Number(p.valor_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            <button
              onClick={() => mexerPreco.mutate({ tipo: "del", precoId: p.id })}
              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex" }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 44px", gap: 8 }}>
          <input style={INPUT} value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} placeholder="Hora técnica, visita, km…" />
          <input style={INPUT} value={novoValor} onChange={(e) => setNovoValor(e.target.value)} inputMode="decimal" placeholder="0,00" />
          <button
            onClick={() => mexerPreco.mutate({ tipo: "add" })}
            disabled={!novoPreco.trim() || !novoValor.trim()}
            style={{
              height: 44, borderRadius: 12, border: "none", background: GOLD_GRAD, color: "#08090E",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: novoPreco.trim() && novoValor.trim() ? "pointer" : "default",
              opacity: novoPreco.trim() && novoValor.trim() ? 1 : 0.5,
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <button
        onClick={() => {
          if (confirm("Excluir este contrato? Não tem desfazer.")) excluir.mutate();
        }}
        style={{
          height: 46, borderRadius: 23, background: "none",
          border: isLight ? "1px solid rgba(185,28,28,0.30)" : "1px solid rgba(248,113,113,0.30)",
          color: isLight ? "#b91c1c" : "#F87171",
          fontFamily: FONT, fontWeight: 600, fontSize: 12.5, cursor: "pointer",
        }}
      >
        Excluir contrato
      </button>
    </div>
  );
}
