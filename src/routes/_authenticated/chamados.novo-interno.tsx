// Novo chamado INTERNO — o formulário do trabalho que não sai da mesa.
// A classificação (tipo) é sugerida pelo título enquanto se digita; quem grava
// de verdade é o banco, no trigger. Quando o tipo é pedido de compra, os campos
// da compra entram junto (Q6). Ver docs/PLANO_UNIFICACAO.md §6 e §12.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useClientes } from "@/features/clientes/data";
import { abrirChamado, usePessoas } from "@/features/chamados/data";
import {
  sugerirTipoChamado, SPRINT_ORDEM, SPRINT_LABEL, tiposDaNatureza, TIPO_LABEL, dataParaPrazo,
  type ChamadoSprint, type ChamadoTipo,
} from "@/lib/chamado-status";
import { EQUIPES, EQUIPE_LABEL, type Equipe } from "@/lib/equipes";
import { salvarCompra } from "@/features/chamados/compra";

export const Route = createFileRoute("/_authenticated/chamados/novo-interno")({
  // a triagem (/chamados/novo) chega aqui com o trilho já escolhido:
  // ?equipe=ti | ?equipe=patrimonio&tipo=pedido_compra
  validateSearch: (s: Record<string, unknown>) => ({
    equipe: typeof s.equipe === "string" ? s.equipe : undefined,
    tipo: typeof s.tipo === "string" ? s.tipo : undefined,
  }),
  component: NovaChamadoPage,
});

function NovaChamadoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const busca = Route.useSearch();
  const { data: clientes = [] } = useClientes();
  const { data: pessoas = [] } = usePessoas();

  const equipeInicial = (EQUIPES as string[]).includes(busca.equipe ?? "")
    ? (busca.equipe as Equipe)
    : null;
  const tipoInicial = (tiposDaNatureza("interno") as string[]).includes(busca.tipo ?? "")
    ? (busca.tipo as ChamadoTipo)
    : "";

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [equipe, setEquipe] = useState<Equipe>(equipeInicial ?? "ti");
  const [responsavelId, setResponsavelId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [prazo_limite, setPrazo] = useState("");
  const [sprint, setSprint] = useState<ChamadoSprint>("este_mes");
  const [tipo, setTipo] = useState<ChamadoTipo | "">(tipoInicial);
  // Pedido de compra (Q6): quem pede geralmente já sabe o que quer e de quem.
  // O resto da ficha (cotação, aprovação, recebimento) vive na página do chamado.
  const [qtd, setQtd] = useState("1");
  const [fornecedor, setFornecedor] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [linkProduto, setLinkProduto] = useState("");

  // pré-carrega equipe e responsável com quem está registrando — sem
  // atropelar o trilho que a triagem já escolheu
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const eu = pessoas.find((p) => p.id === data.user?.id);
      if (eu) {
        setResponsavelId((v) => v || eu.id);
        if (eu.equipe && !equipeInicial) {
          setEquipe((v) => (v === "ti" ? (eu.equipe as Equipe) : v));
        }
      }
    });
  }, [pessoas, equipeInicial]);

  const sugestao = useMemo(
    () => (titulo.trim() ? sugerirTipoChamado(titulo, descricao) : null),
    [titulo, descricao],
  );

  // sem tipo escolhido, vale a sugestão — é o que o banco vai gravar
  const tipoEfetivo = tipo || sugestao;
  const ehCompra = tipoEfetivo === "pedido_compra";

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 18, padding: "18px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const TEXTAREA: CSSProperties = { ...INPUT, height: 110, padding: "12px 14px", resize: "vertical" };

  const chip = (ativo: boolean): CSSProperties => ({
    padding: "9px 14px", borderRadius: 12,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
    background: ativo
      ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12,
    cursor: "pointer",
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título do chamado.");
      const novoId = await abrirChamado({
        natureza: "interno",
        titulo: titulo.trim(),
        descricao_problema: descricao.trim() || null,
        equipe,
        responsavel_id: responsavelId || null,
        cliente_id: clienteId || null,
        prazo_limite: dataParaPrazo(prazo_limite),
        sprint,
        // vazio = deixa o banco sugerir (mesma heurística da pré-visualização)
        tipo: (tipo || null) as ChamadoTipo | null,
      });
      // a ficha de compra nasce por trigger; aqui só preenchemos o que o
      // solicitante já informou
      if (ehCompra) {
        await salvarCompra(novoId, {
          quantidade: Number(qtd) > 0 ? Number(qtd) : 1,
          fornecedor_sugerido: fornecedor.trim() || null,
          valor_estimado: valorEstimado === "" ? null : Number(valorEstimado),
          link_produto: linkProduto.trim() || null,
        });
      }
      return novoId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      toast.success("Chamado registrado.");
      navigate({ to: "/chamados/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/chamados" })}
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
        <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 20 }}>
          Nova demanda
        </div>
      </div>

      <div style={CARD}>
        <div>
          <label style={LABEL}>Título</label>
          <input
            style={INPUT}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Revisar cadastro de moradores do Bloco C"
            autoFocus
          />
        </div>
        <div>
          <label style={LABEL}>Descrição</label>
          <textarea
            style={TEXTAREA}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Contexto, o que precisa ser feito, links…"
          />
        </div>

        {/* Classificação sugerida */}
        <div>
          <label style={LABEL}>Classificação</label>
          {sugestao && !tipo && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
              fontFamily: "var(--fonte)", fontSize: 11.5, color: gold,
            }}>
              <Sparkles size={13} />
              Sugestão pelo título: <strong>{TIPO_LABEL[sugestao]}</strong> — toque para trocar.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tiposDaNatureza("interno").map((t) => (
              <button
                key={t}
                type="button"
                style={chip(tipoEfetivo === t)}
                onClick={() => setTipo(tipo === t ? "" : t)}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pedido de compra (Q6): o que dá para responder já na abertura. Cotação,
          aprovação e recebimento acontecem depois, na página do chamado. */}
      {ehCompra && (
        <div style={CARD}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={LABEL}>Quantidade</label>
              <input
                style={INPUT} type="number" min="1" step="1"
                value={qtd} onChange={(e) => setQtd(e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL}>Valor estimado (R$)</label>
              <input
                style={INPUT} type="number" min="0" step="0.01" placeholder="opcional"
                value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={LABEL}>Fornecedor sugerido</label>
            <input
              style={INPUT} placeholder="De quem costumamos comprar isso?"
              value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={LABEL}>Link do produto</label>
            <input
              style={INPUT} placeholder="https://…"
              value={linkProduto} onChange={(e) => setLinkProduto(e.target.value)}
            />
          </div>
        </div>
      )}

      <div style={CARD}>
        <div>
          <label style={LABEL}>Equipe</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EQUIPES.map((e) => (
              <button key={e} type="button" style={chip(equipe === e)} onClick={() => setEquipe(e)}>
                {EQUIPE_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={LABEL}>Responsável</label>
          <select style={INPUT} value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Sem responsável (alguém assume depois)</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={LABEL}>Cliente (opcional)</label>
          <select style={INPUT} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Chamado interna, sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Prazo</label>
            <input style={INPUT} type="date" value={prazo_limite} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Sprint</label>
            <select
              style={INPUT}
              value={sprint}
              onChange={(e) => setSprint(e.target.value as ChamadoSprint)}
            >
              {SPRINT_ORDEM.map((s) => (
                <option key={s} value={s}>{SPRINT_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => criar.mutate()}
        disabled={criar.isPending || !titulo.trim()}
        style={{
          height: 52, borderRadius: 26, border: "none",
          background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
          color: "#08090E",
          fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 13,
          letterSpacing: "0.14em", textTransform: "uppercase",
          cursor: criar.isPending || !titulo.trim() ? "default" : "pointer",
          opacity: criar.isPending || !titulo.trim() ? 0.6 : 1,
          boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
        }}
      >
        {criar.isPending ? "Registrando…" : "Registrar demanda"}
      </button>
    </div>
  );
}
