// Novo contrato — Etapa U2 da unificação.
// Dois caminhos: enviar o PDF e deixar a I.A preencher (a pessoa confere antes
// de gravar), ou preencher à mão. A I.A NUNCA ativa o contrato sozinha: nasce
// como rascunho, porque é dele que sai a decisão de cobrar ou não.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileUp, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, GOLD_GLOW, card } from "@/lib/ui";
import { useClientes, acharClientePorDocumento } from "@/features/clientes/data";
import { extrairContrato } from "@/lib/contrato.functions";
import {
  criarContrato, adicionarCobertura, adicionarPrecos, subirPdfContrato,
  MODALIDADE_LABEL, MODALIDADE_REGRA, TIPO_COBRANCA_LABEL,
  type ModalidadeContrato, type TipoCobranca,
} from "@/features/contratos/data";

export const Route = createFileRoute("/_authenticated/contratos/novo")({
  component: NovoContratoPage,
});

function NovoContratoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: clientes = [] } = useClientes();
  const extrair = useServerFn(extrairContrato);

  const [clienteId, setClienteId] = useState("");
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [modalidade, setModalidade] = useState<ModalidadeContrato>("manutencao");
  const [tipoCobranca, setTipoCobranca] = useState<TipoCobranca>("mensal_fixo");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [valorMensal, setValorMensal] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [franquia, setFranquia] = useState("");
  const [incluiPecas, setIncluiPecas] = useState(false);
  const [incluiMo, setIncluiMo] = useState(true);
  const [incluiDeslocamento, setIncluiDeslocamento] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  // resultado da leitura por I.A, aguardando conferência
  const [arquivoPath, setArquivoPath] = useState<string | null>(null);
  const [arquivoNome, setArquivoNome] = useState("");
  const [confianca, setConfianca] = useState<number | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [precos, setPrecos] = useState<any[]>([]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = { ...card(isLight), padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 };
  const SEC: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.16em",
    textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: FONT, fontWeight: 400, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const chip = (ativo: boolean): CSSProperties => ({
    padding: "9px 14px", borderRadius: 12,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
    background: ativo ? GOLD_GRAD : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 12, cursor: "pointer",
  });

  const clienteEscolhido = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clientes, clienteId],
  );

  /** Envia o PDF, chama a I.A e preenche o formulário para conferência. */
  const lerPdf = useMutation({
    mutationFn: async (arquivo: File) => {
      if (!clienteId) throw new Error("Escolha o cliente antes de enviar o PDF.");
      const caminho = await subirPdfContrato(arquivo, clienteId);
      const r = await extrair({ data: { storagePath: caminho } });
      if (!r.ok || !r.contrato) throw new Error(r.erro ?? "Não consegui ler o contrato.");
      return { caminho, ...r.contrato };
    },
    onSuccess: (c) => {
      setArquivoPath(c.caminho);
      setConfianca(c.confianca);
      setAlertas(c.alertas ?? []);
      setEquipamentos(c.equipamentos ?? []);
      setPrecos(c.precos ?? []);
      if (c.numero) setNumero(c.numero);
      if (c.titulo) setTitulo(c.titulo);
      if (c.modalidade) setModalidade(c.modalidade);
      if (c.tipo_cobranca) setTipoCobranca(c.tipo_cobranca);
      if (c.vigencia_inicio) setInicio(c.vigencia_inicio);
      if (c.vigencia_fim) setFim(c.vigencia_fim);
      if (c.valor_mensal != null) setValorMensal(String(c.valor_mensal));
      if (c.dia_vencimento != null) setDiaVencimento(String(c.dia_vencimento));
      if (c.franquia_visitas_mes != null) setFranquia(String(c.franquia_visitas_mes));
      setIncluiPecas(!!c.inclui_pecas);
      setIncluiMo(c.inclui_mao_de_obra !== false);
      setIncluiDeslocamento(!!c.inclui_deslocamento);
      // o documento do contrato pode revelar que o cliente escolhido é outro
      if (c.cliente_documento) {
        const equivalente = acharClientePorDocumento(clientes, c.cliente_documento);
        if (equivalente && equivalente.id !== clienteId) {
          toast.warning(`O CNPJ do contrato é de "${equivalente.nome}". Confira o cliente escolhido.`);
        }
      }
      toast.success("Contrato lido. Confira os campos antes de salvar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Escolha o cliente.");
      const id = await criarContrato({
        cliente_id: clienteId,
        numero: numero.trim() || null,
        titulo: titulo.trim() || null,
        modalidade,
        tipo_cobranca: tipoCobranca,
        // sempre rascunho: ativar é ato consciente, porque contrato ativo
        // passa a decidir o que é cobrado
        status: "rascunho",
        vigencia_inicio: inicio || null,
        vigencia_fim: fim || null,
        valor_mensal: valorMensal ? Number(valorMensal.replace(",", ".")) : null,
        dia_vencimento: diaVencimento ? Number(diaVencimento) : null,
        franquia_visitas_mes: franquia ? Number(franquia) : null,
        inclui_pecas: incluiPecas,
        inclui_mao_de_obra: incluiMo,
        inclui_deslocamento: incluiDeslocamento,
        observacoes: observacoes.trim() || null,
        arquivo_path: arquivoPath,
        confianca_extracao: confianca,
        extraido_em: confianca != null ? new Date().toISOString() : null,
      });
      if (equipamentos.length > 0) {
        await adicionarCobertura(
          id,
          equipamentos.map((e) => ({
            descricao: e.descricao || null,
            marca: e.marca || null,
            modelo: e.modelo || null,
            numero_serie: e.numero_serie || null,
            tag_patrimonio: e.tag_patrimonio || null,
            local: e.local || null,
            quantidade: Number(e.quantidade) || 1,
            cobertura: e.cobertura ?? "integral",
          })),
        );
      }
      if (precos.length > 0) {
        await adicionarPrecos(
          id,
          precos.map((p) => ({
            descricao: p.descricao,
            unidade: p.unidade || null,
            valor_unitario: Number(p.valor_unitario) || 0,
          })),
        );
      }
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["contratos"] });
      toast.success("Contrato salvo como rascunho.");
      navigate({ to: "/contratos/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Novo contrato</div>
      </div>

      <div style={CARD}>
        <span style={SEC}>Cliente</span>
        <select style={INPUT} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Escolher cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        {clienteEscolhido && !clienteEscolhido.documento && (
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: gold }}>
            Este cliente ainda não tem CNPJ cadastrado — o fechamento imprime o CNPJ.
          </span>
        )}
      </div>

      {/* Leitura por I.A */}
      <div style={CARD}>
        <span style={SEC}>Ler o PDF do contrato</span>
        <label
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "24px 16px", borderRadius: 14,
            cursor: clienteId && !lerPdf.isPending ? "pointer" : "not-allowed",
            opacity: clienteId ? 1 : 0.55,
            border: isLight ? "1.5px dashed rgba(0,0,0,0.18)" : "1.5px dashed rgba(248,200,17,0.28)",
          }}
        >
          {lerPdf.isPending ? <Sparkles size={24} color={gold} /> : <FileUp size={24} color={gold} />}
          <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, textAlign: "center" }}>
            {lerPdf.isPending ? "Lendo o contrato…" : arquivoNome || "Escolher o PDF do contrato"}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, textAlign: "center" }}>
            {clienteId
              ? "A I.A preenche os campos abaixo; nada é gravado sem sua conferência."
              : "Escolha o cliente primeiro."}
          </span>
          <input
            type="file"
            accept="application/pdf"
            disabled={!clienteId || lerPdf.isPending}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setArquivoNome(f.name);
              lerPdf.mutate(f);
            }}
          />
        </label>

        {confianca != null && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontFamily: FONT, fontSize: 12,
            color: confianca >= 0.8 ? (isLight ? "#047862" : "#2DD2A5") : gold,
          }}>
            <Sparkles size={14} />
            Confiança da leitura: {Math.round(confianca * 100)}%
            {equipamentos.length > 0 && ` · ${equipamentos.length} equipamento(s)`}
            {precos.length > 0 && ` · ${precos.length} preço(s)`}
          </div>
        )}
        {alertas.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <TriangleAlert size={16} color={gold} style={{ marginTop: 2, flexShrink: 0 }} />
            <ul style={{ margin: 0, paddingLeft: 16, fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, lineHeight: 1.6 }}>
              {alertas.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Dados do contrato */}
      <div style={CARD}>
        <span style={SEC}>Contrato</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Número</label>
            <input style={INPUT} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Objeto / título</label>
            <input style={INPUT} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={LABEL}>Modalidade</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(MODALIDADE_LABEL) as ModalidadeContrato[]).map((m) => (
              <button key={m} type="button" style={chip(modalidade === m)} onClick={() => setModalidade(m)}>
                {MODALIDADE_LABEL[m]}
              </button>
            ))}
          </div>
          <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
            {MODALIDADE_REGRA[modalidade]}
          </span>
        </div>
        <div>
          <label style={LABEL}>Forma de cobrança</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(TIPO_COBRANCA_LABEL) as TipoCobranca[]).map((t) => (
              <button key={t} type="button" style={chip(tipoCobranca === t)} onClick={() => setTipoCobranca(t)}>
                {TIPO_COBRANCA_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Início da vigência</label>
            <input style={INPUT} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Fim (vazio = aberta)</label>
            <input style={INPUT} type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Valor mensal</label>
            <input style={INPUT} value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
          <div>
            <label style={LABEL}>Vencimento</label>
            <input style={INPUT} value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} inputMode="numeric" placeholder="dia" />
          </div>
          <div>
            <label style={LABEL}>Visitas/mês</label>
            <input style={INPUT} value={franquia} onChange={(e) => setFranquia(e.target.value)} inputMode="numeric" placeholder="franquia" />
          </div>
        </div>
      </div>

      {/* Cobertura geral */}
      <div style={CARD}>
        <span style={SEC}>O que a mensalidade já cobre</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={chip(incluiMo)} onClick={() => setIncluiMo((v) => !v)}>
            Mão de obra
          </button>
          <button type="button" style={chip(incluiPecas)} onClick={() => setIncluiPecas((v) => !v)}>
            Peças
          </button>
          <button type="button" style={chip(incluiDeslocamento)} onClick={() => setIncluiDeslocamento((v) => !v)}>
            Deslocamento
          </button>
        </div>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
          É a regra geral. Equipamento com tratamento diferente entra na aba de cobertura, depois de salvar.
        </span>
        <div>
          <label style={LABEL}>Observações</label>
          <textarea
            style={{ ...INPUT, height: 88, padding: "12px 14px", resize: "vertical" }}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Combinações que não estão no papel, contatos, particularidades…"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => salvar.mutate()}
        disabled={salvar.isPending || !clienteId}
        style={{
          height: 52, borderRadius: 26, border: "none", background: GOLD_GRAD, color: "#08090E",
          fontFamily: FONT, fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase",
          cursor: salvar.isPending || !clienteId ? "default" : "pointer",
          opacity: salvar.isPending || !clienteId ? 0.6 : 1, boxShadow: GOLD_GLOW,
        }}
      >
        {salvar.isPending ? "Salvando…" : "Salvar como rascunho"}
      </button>
    </div>
  );
}
