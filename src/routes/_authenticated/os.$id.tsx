// Chamado — tela única por status (padrão de visita.$id.tsx): decide as ações
// pelo status e pelo papel. Aqui o técnico executa (fotos antes/depois,
// diagnóstico, peças, assinatura) e o gestor confere e fecha.
// Etapa 3 do sistema de OS.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, ArrowLeft, Building2, Camera, CheckCircle2, ClipboardList, Clock,
  CheckSquare, FileDown, History, ListChecks, MapPin, Phone, PlayCircle, Plus, Receipt,
  Sparkles, Square, Trash2, User, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente, useTecnicos } from "@/features/gerencial/data";
import { AssinaturaCanvas } from "@/features/os/AssinaturaCanvas";
import {
  useOrdem, useEventosOs, useFotosOs, useAssinaturaUrl,
  iniciarAtendimento, concluirAtendimento, fecharOs, reabrirOs, cancelarOs,
  atualizarOs, anexarFotoOs, excluirFotoOs, salvarAssinatura,
} from "@/features/os/data";
import { gerarRelatorioOs } from "@/features/os/relatorioOs";
import {
  useOsPecas, registrarPeca, removerPeca,
  DIRECAO_LABEL, DIRECAO_CORES, type DirecaoPeca,
} from "@/features/os/pecas";
import {
  useAnaliseOs, useCobrancasDaOs, aprovarCobranca, marcarFaturada, ajustarItem,
  totalFaturavel, moeda, RESULTADO_LABEL, RESULTADO_CORES, FATURAMENTO_LABEL,
  type ResultadoItem, type FaturamentoStatus,
} from "@/features/os/cobranca";
import { analisarCobrancaOs } from "@/lib/cobranca.functions";
import { useChecklist, marcarItemChecklist } from "@/features/os/checklist";
import { derivarInventarioDaVisita } from "@/features/clientes/inventario";
import {
  osStatusInfo, situacaoPrazo, textoPrazo,
  OS_TIPO_LABEL, OS_PRIORIDADE_LABEL, OS_PRIORIDADE_CORES,
  type OsPrioridade,
} from "@/lib/os-status";

export const Route = createFileRoute("/_authenticated/os/$id")({
  component: OsDetalhePage,
});

function OsDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: os, isLoading } = useOrdem(id);
  const { data: eventos = [] } = useEventosOs(id);
  const { data: fotos = [] } = useFotosOs(id);
  const { data: checklist = [] } = useChecklist(id);
  const { data: tecnicos = [] } = useTecnicos();
  const { data: assinaturaUrl } = useAssinaturaUrl(os?.assinatura_url);
  const [userId, setUserId] = useState<string | null>(null);

  const [diagnostico, setDiagnostico] = useState("");
  const [servico, setServico] = useState("");
  const [assinanteNome, setAssinanteNome] = useState("");
  const [assinaturaData, setAssinaturaData] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  // movimentação de equipamento — Etapa U3
  const { data: pecasOs = [] } = useOsPecas(id);
  const [novaDirecao, setNovaDirecao] = useState<DirecaoPeca>("instalado");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaSerie, setNovaSerie] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");
  // conferência de cobrança — Etapa U4
  const { data: analise = [] } = useAnaliseOs(id);
  const { data: cobrancasOs = [] } = useCobrancasDaOs(id);
  const analisarFn = useServerFn(analisarCobrancaOs);
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [novoResultado, setNovoResultado] = useState<ResultadoItem>("revisar");
  const [novoValor, setNovoValor] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!os) return;
    setDiagnostico(os.diagnostico ?? "");
    setServico(os.servico_executado ?? "");
    setAssinanteNome(os.assinatura_nome ?? "");
  }, [os?.id, os?.diagnostico, os?.servico_executado, os?.assinatura_nome]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18, padding: "16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const CTA: CSSProperties = {
    width: "100%", height: 54, borderRadius: 27, border: "none",
    background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", color: "#08090E",
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
    letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
  };
  const btnSec: CSSProperties = {
    height: 44, padding: "0 16px", borderRadius: 22,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8,
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12,
  };
  const linha: CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0",
    borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["ordem-servico", id] });
    qc.invalidateQueries({ queryKey: ["ordens-servico"] });
    qc.invalidateQueries({ queryKey: ["os-eventos", id] });
    qc.invalidateQueries({ queryKey: ["os-fotos", id] });
  };

  const iniciar = useMutation({
    mutationFn: () => iniciarAtendimento(id),
    onSuccess: () => { invalidar(); toast.success("Atendimento iniciado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarRascunho = useMutation({
    // pecas_texto virou legado na U3: as peças têm tabela própria e não são
    // mais sobrescritas por este rascunho
    mutationFn: () => atualizarOs(id, { diagnostico, servico_executado: servico }),
    onSuccess: () => { invalidar(); toast.success("Anotações salvas."); },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Movimentação de equipamento do atendimento — Etapa U3. */
  const mexerPeca = useMutation({
    mutationFn: async (acao: { tipo: "add" } | { tipo: "del"; pecaId: string }) => {
      if (acao.tipo === "del") return removerPeca(acao.pecaId);
      const descricao = novaDescricao.trim();
      if (!descricao) throw new Error("Descreva o equipamento ou material.");
      const qtd = Number(novaQtd.replace(",", "."));
      await registrarPeca(id, {
        descricao,
        direcao: novaDirecao,
        numero_serie: novaSerie.trim() || null,
        quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
      });
    },
    onSuccess: () => {
      setNovaDescricao("");
      setNovaSerie("");
      setNovaQtd("1");
      qc.invalidateQueries({ queryKey: ["os-pecas", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Análise de cobertura — Etapa U4. Nada é cobrado por ela; só classifica. */
  const invalidarCobranca = () => {
    qc.invalidateQueries({ queryKey: ["os-analise", id] });
    qc.invalidateQueries({ queryKey: ["cobrancas-os", id] });
    qc.invalidateQueries({ queryKey: ["ordem-servico", id] });
  };

  const analisar = useMutation({
    mutationFn: async () => {
      const r = await analisarFn({ data: { osId: id } });
      if (!r.ok || !r.resumo) throw new Error(r.erro ?? "Não consegui analisar.");
      return r.resumo;
    },
    onSuccess: (r) => {
      invalidarCobranca();
      if (r.aviso) toast.warning(r.aviso);
      toast.success(
        r.revisar > 0
          ? `${r.faturaveis} faturável(is), ${r.cobertos} coberto(s) e ${r.revisar} para conferir.`
          : `${r.faturaveis} item(ns) faturável(is) — ${moeda(r.valorFaturavel)}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ajustar = useMutation({
    mutationFn: async ({ pecaId }: { pecaId: string }) => {
      const v = novoValor.trim() ? Number(novoValor.replace(",", ".")) : null;
      if (novoResultado === "faturavel" && (v == null || !Number.isFinite(v) || v <= 0)) {
        throw new Error("Item faturável precisa de valor. Sem preço, deixe em revisão.");
      }
      await ajustarItem(pecaId, novoResultado, novoResultado === "coberto" ? null : v);
    },
    onSuccess: () => {
      setItemEditando(null);
      invalidarCobranca();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aprovar = useMutation({
    mutationFn: () => aprovarCobranca(id),
    onSuccess: (r) => {
      invalidarCobranca();
      toast.success(
        r.itens === 0
          ? "Conferência concluída: nada a cobrar neste atendimento."
          : `${r.itens} cobrança(s) geradas — ${moeda(r.total)}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const faturar = useMutation({
    mutationFn: () => marcarFaturada(id),
    onSuccess: (n) => {
      invalidarCobranca();
      toast.success(`${n} cobrança(s) marcadas como faturadas.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const concluir = useMutation({
    mutationFn: async () => {
      if (!diagnostico.trim()) throw new Error("Descreva o diagnóstico do problema.");
      if (!servico.trim()) throw new Error("Descreva o serviço executado.");
      if (!os?.assinatura_url) {
        if (!assinaturaData) throw new Error("Colete a assinatura de quem acompanhou o serviço.");
        if (!assinanteNome.trim()) throw new Error("Informe o nome de quem assinou.");
        await salvarAssinatura(id, assinaturaData, assinanteNome.trim());
      }
      await concluirAtendimento(id, {
        diagnostico: diagnostico.trim(),
        servico_executado: servico.trim(),
      });
    },
    onSuccess: () => { invalidar(); toast.success("Chamado concluído — enviado para conferência."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fechar = useMutation({
    mutationFn: async () => {
      await fecharOs(id);
      // Implantação concluída alimenta o inventário do cliente (as-built):
      // é o que fecha o ciclo proposta → implantação → corretiva/preventiva.
      if (os?.tipo === "implantacao" && os.visita_id) {
        return derivarInventarioDaVisita(os.cliente_id, os.visita_id);
      }
      return null;
    },
    onSuccess: (derivado) => {
      invalidar();
      if (derivado && derivado.sistemas > 0) {
        qc.invalidateQueries({ queryKey: ["cliente-inventario", os?.cliente_id] });
        toast.success(
          `Chamado fechado. Inventário do cliente atualizado: ${derivado.sistemas} sistema(s), ${derivado.equipamentos} equipamento(s).`,
        );
      } else {
        toast.success("Chamado fechado.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarItem = useMutation({
    mutationFn: ({ itemId, concluido }: { itemId: string; concluido: boolean }) =>
      marcarItemChecklist(itemId, concluido),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-checklist", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: () => reabrirOs(id),
    onSuccess: () => { invalidar(); toast.success("Chamado reaberto."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: () => {
      if (!motivoCancel.trim()) throw new Error("Informe o motivo do cancelamento.");
      return cancelarOs(id, motivoCancel.trim());
    },
    onSuccess: () => { invalidar(); setCancelando(false); toast.success("Chamado cancelado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const trocarTecnico = useMutation({
    mutationFn: (novo: string) => atualizarOs(id, { tecnico_id: novo || null }),
    onSuccess: () => { invalidar(); toast.success("Técnico atualizado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixarRelatorio = useMutation({
    mutationFn: async () => {
      if (!os) throw new Error("Chamado não carregado.");
      await gerarRelatorioOs({
        os,
        tecnicoNome: (tecnicos as any[]).find((t) => t.id === os.tecnico_id)?.nome ?? null,
        fotos: fotos.map((f) => ({ etapa: f.etapa, storage_path: f.storage_path, legenda: f.legenda })),
        pecas: pecasOs.map((p) => ({
          direcao: p.direcao,
          descricao: p.descricao,
          numero_serie: p.numero_serie,
          tag_patrimonio: p.tag_patrimonio,
          quantidade: Number(p.quantidade),
        })),
      });
    },
    onSuccess: () => toast.success("Relatório gerado — o download foi iniciado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const removerFoto = useMutation({
    mutationFn: ({ fotoId, path }: { fotoId: string; path: string | null }) => excluirFotoOs(fotoId, path),
    onSuccess: () => { invalidar(); toast.success("Foto removida."); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function enviarFoto(arquivo: File | undefined, etapa: "antes" | "depois") {
    if (!arquivo) return;
    setEnviandoFoto(true);
    try {
      await anexarFotoOs(id, arquivo, etapa);
      invalidar();
      toast.success(etapa === "antes" ? "Foto do problema anexada." : "Foto da solução anexada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a foto");
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: "24px 0", color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 13 }}>
        Carregando chamado…
      </div>
    );
  }
  if (!os) {
    return (
      <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: 12, color: textPrimary }}>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14 }}>Chamado não encontrado.</span>
        <button onClick={() => navigate({ to: "/os" })} style={{ ...btnSec, alignSelf: "flex-start" }}>
          Voltar para chamados
        </button>
      </div>
    );
  }

  const info = osStatusInfo(os.status);
  const corStatus = isLight ? info.colorLight : info.color;
  const prio = OS_PRIORIDADE_CORES[os.prioridade as OsPrioridade] ?? OS_PRIORIDADE_CORES.normal;
  const prazo = situacaoPrazo(os.prazo_limite, os.status);
  const souTecnico = !!userId && os.tecnico_id === userId;
  const podeExecutar = souTecnico || isGerente;
  const emExecucao = os.status === "em_atendimento";
  const fotosAntes = fotos.filter((f) => f.etapa === "antes");
  const fotosDepois = fotos.filter((f) => f.etapa === "depois");

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/os" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 12, color: gold, letterSpacing: "0.06em" }}>
            {os.numero ?? "—"} · {OS_TIPO_LABEL[os.tipo] ?? os.tipo}
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 17 }}>{os.titulo}</div>
        </div>
      </div>

      {/* Status + prazo */}
      <div style={{ ...CARD, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "4px 10px", borderRadius: 12,
              background: info.bg, border: `1px solid ${info.border}`, color: corStatus,
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {info.labelUpper}
          </span>
          <span
            style={{
              padding: "4px 10px", borderRadius: 12,
              background: prio.bg, border: `1px solid ${prio.border}`,
              color: isLight ? prio.light : prio.dark,
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {OS_PRIORIDADE_LABEL[os.prioridade as OsPrioridade] ?? os.prioridade}
          </span>
          {(prazo === "estourado" || prazo === "proximo") && (
            <span
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600,
                color: prazo === "estourado" ? (isLight ? "#b91c1c" : "#F87171") : (isLight ? "#b45309" : "#FFC000"),
              }}
            >
              <AlertTriangle size={13} />
              {textoPrazo(os.prazo_limite)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...linha, borderTop: "none" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>Cliente</span>
            <button
              onClick={() => navigate({ to: "/clientes/$id", params: { id: os.cliente_id } })}
              style={{
                background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "right",
                fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: gold, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <Building2 size={13} />
              {os.cliente?.nome ?? "—"}
            </button>
          </div>
          {os.cliente?.endereco && (
            <div style={linha}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>Endereço</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary, textAlign: "right" }}>
                <MapPin size={12} style={{ display: "inline", marginRight: 4 }} />
                {os.cliente.endereco}
              </span>
            </div>
          )}
          {os.cliente?.telefone_sindico && (
            <div style={linha}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>Contato</span>
              <a
                href={`tel:${os.cliente.telefone_sindico}`}
                style={{
                  fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: gold, fontWeight: 600,
                  textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <Phone size={12} />
                {os.cliente.telefone_sindico}
              </a>
            </div>
          )}
          {os.sistema?.nome && (
            <div style={linha}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>Sistema</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary }}>{os.sistema.nome}</span>
            </div>
          )}
          {os.data_hora_agendada && (
            <div style={linha}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>Agendado</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary }}>
                <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                {new Date(os.data_hora_agendada).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <div style={linha}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600 }}>Técnico</span>
            {isGerente && ["aberta", "agendada", "em_atendimento"].includes(os.status) ? (
              <select
                value={os.tecnico_id ?? ""}
                onChange={(e) => trocarTecnico.mutate(e.target.value)}
                style={{
                  ...INPUT, width: "auto", padding: "6px 10px", fontSize: 12,
                  textAlign: "right",
                }}
              >
                <option value="">Sem técnico</option>
                {tecnicos.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textSecondary }}>
                <User size={12} style={{ display: "inline", marginRight: 4 }} />
                {tecnicos.find((t: any) => t.id === os.tecnico_id)?.nome ?? "não atribuído"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Problema relatado */}
      {os.descricao_problema && (
        <div style={CARD}>
          <span style={SEC}>Problema relatado</span>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 300, whiteSpace: "pre-wrap" }}>
            {os.descricao_problema}
          </div>
        </div>
      )}

      {/* Cancelado */}
      {os.status === "cancelada" && os.motivo_cancelamento && (
        <div style={{ ...CARD, border: `1px solid ${isLight ? "rgba(185,28,28,0.35)" : "rgba(248,113,113,0.30)"}` }}>
          <span style={SEC}>Motivo do cancelamento</span>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 300 }}>
            {os.motivo_cancelamento}
          </div>
        </div>
      )}

      {/* Checklist (preventiva e implantação) */}
      {checklist.length > 0 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <ListChecks size={15} color={gold} />
            <span style={SEC}>Roteiro de verificação</span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 700,
                color: checklist.every((i) => i.concluido) ? (isLight ? "#047857" : "#34D399") : gold,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {checklist.filter((i) => i.concluido).length}/{checklist.length}
            </span>
          </div>
          {(() => {
            const grupos = Array.from(new Set(checklist.map((i) => i.grupo ?? "Geral")));
            return grupos.map((g) => (
              <div key={g} style={{ marginTop: 6 }}>
                <div style={{ ...LABEL, marginBottom: 4 }}>{g}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {checklist
                    .filter((i) => (i.grupo ?? "Geral") === g)
                    .map((i) => (
                      <button
                        key={i.id}
                        onClick={() => emExecucao && marcarItem.mutate({ itemId: i.id, concluido: !i.concluido })}
                        disabled={!emExecucao}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0",
                          background: "transparent", border: "none", textAlign: "left",
                          cursor: emExecucao ? "pointer" : "default", color: textPrimary,
                          borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {i.concluido ? (
                          <CheckSquare size={16} color={isLight ? "#047857" : "#34D399"} style={{ flexShrink: 0, marginTop: 1 }} />
                        ) : (
                          <Square size={16} color={textSecondary} style={{ flexShrink: 0, marginTop: 1 }} />
                        )}
                        <span
                          style={{
                            flex: 1, fontFamily: "'Montserrat', sans-serif", fontSize: 12.5,
                            opacity: i.concluido ? 0.6 : 1,
                            textDecoration: i.concluido ? "line-through" : "none",
                          }}
                        >
                          {i.item}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Iniciar atendimento */}
      {podeExecutar && ["aberta", "agendada"].includes(os.status) && (
        <button style={CTA} onClick={() => iniciar.mutate()} disabled={iniciar.isPending}>
          <PlayCircle size={18} />
          {iniciar.isPending ? "Iniciando…" : "Iniciar atendimento"}
        </button>
      )}

      {/* Execução */}
      {podeExecutar && ["em_atendimento", "executada", "fechada"].includes(os.status) && (
        <div style={CARD}>
          <span style={SEC}>Execução</span>

          {/* Fotos antes/depois */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([["antes", fotosAntes], ["depois", fotosDepois]] as const).map(([etapa, arr]) => (
              <div key={etapa}>
                <label style={LABEL}>{etapa === "antes" ? "Antes (problema)" : "Depois (solução)"}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {arr.map((f) => (
                    <div key={f.id} style={{ position: "relative" }}>
                      {f.signedUrl ? (
                        <img
                          src={f.signedUrl}
                          alt={f.legenda ?? etapa}
                          style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 10 }}
                        />
                      ) : (
                        <div style={{ width: 68, height: 68, borderRadius: 10, background: isLight ? "#e8eaee" : "#22222c" }} />
                      )}
                      {emExecucao && (
                        <button
                          onClick={() => removerFoto.mutate({ fotoId: f.id, path: f.storage_path })}
                          style={{
                            position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                            background: "#0a0b0e", color: "#fff", border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  {emExecucao && (
                    <label
                      style={{
                        width: 68, height: 68, borderRadius: 10, cursor: enviandoFoto ? "wait" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.04)",
                        border: isLight ? "1px dashed rgba(0,0,0,0.20)" : "1px dashed rgba(255,255,255,0.22)",
                      }}
                    >
                      <Camera size={18} color={gold} />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        disabled={enviandoFoto}
                        onChange={(e) => { void enviarFoto(e.target.files?.[0], etapa); e.currentTarget.value = ""; }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={LABEL}>Diagnóstico</label>
            <textarea
              style={{ ...INPUT, height: 88, resize: "vertical" }}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              disabled={!emExecucao}
              placeholder="O que estava causando o problema"
            />
          </div>
          <div>
            <label style={LABEL}>Serviço executado</label>
            <textarea
              style={{ ...INPUT, height: 88, resize: "vertical" }}
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              disabled={!emExecucao}
              placeholder="O que foi feito para resolver"
            />
          </div>
          {/* Equipamento instalado / retirado — Etapa U3.
              Substitui o campo de texto: o que entra aqui vira a decisão de
              cobrança (U4) e o relatório de movimentação do QAP (U6). */}
          <div>
            <label style={LABEL}>Equipamento instalado / retirado</label>
            {pecasOs.length === 0 && (
              <span style={{ display: "block", fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 300, color: textSecondary, marginBottom: 8 }}>
                Nada registrado ainda.
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: emExecucao ? 10 : 0 }}>
              {pecasOs.map((p) => {
                const dc = DIRECAO_CORES[p.direcao];
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 12px", borderRadius: 12,
                      background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                      border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{
                      flexShrink: 0, padding: "3px 8px", borderRadius: 999,
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: isLight ? dc.light : dc.dark, background: dc.bg, border: `1px solid ${dc.border}`,
                    }}>
                      {DIRECAO_LABEL[p.direcao]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textPrimary }}>
                        {Number(p.quantidade) !== 1 ? `${p.quantidade}× ` : ""}{p.descricao}
                      </div>
                      {(p.numero_serie || p.tag_patrimonio) && (
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                          {p.numero_serie ? `Série ${p.numero_serie}` : ""}
                          {p.tag_patrimonio ? `${p.numero_serie ? " · " : ""}TAG ${p.tag_patrimonio}` : ""}
                        </div>
                      )}
                    </div>
                    {emExecucao && (
                      <button
                        onClick={() => mexerPeca.mutate({ tipo: "del", pecaId: p.id })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {emExecucao && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(Object.keys(DIRECAO_LABEL) as DirecaoPeca[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNovaDirecao(d)}
                      style={{
                        padding: "7px 12px", borderRadius: 10, cursor: "pointer",
                        border: novaDirecao === d ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
                        background: novaDirecao === d
                          ? "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
                          : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
                        color: novaDirecao === d ? "#08090E" : textPrimary,
                        fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11.5,
                      }}
                    >
                      {DIRECAO_LABEL[d]}
                    </button>
                  ))}
                </div>
                <input
                  style={INPUT}
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Equipamento ou material"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 44px", gap: 8 }}>
                  <input
                    style={INPUT}
                    value={novaSerie}
                    onChange={(e) => setNovaSerie(e.target.value)}
                    placeholder="Nº de série (quando tiver)"
                  />
                  <input
                    style={INPUT}
                    value={novaQtd}
                    onChange={(e) => setNovaQtd(e.target.value)}
                    inputMode="decimal"
                    placeholder="Qtd"
                  />
                  <button
                    onClick={() => mexerPeca.mutate({ tipo: "add" })}
                    disabled={!novaDescricao.trim() || mexerPeca.isPending}
                    style={{
                      height: 46, borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
                      color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: novaDescricao.trim() ? "pointer" : "default",
                      opacity: novaDescricao.trim() ? 1 : 0.5,
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 300, color: textSecondary, lineHeight: 1.5 }}>
                  O número de série é o que permite conciliar com o patrimônio no ERP — registre sempre que o equipamento tiver.
                </span>
              </div>
            )}

            {/* histórico anterior à U3, quando existir */}
            {os.pecas_texto?.trim() && (
              <div style={{
                marginTop: 10, padding: "10px 12px", borderRadius: 12,
                background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.02)",
                border: isLight ? "1px dashed rgba(0,0,0,0.10)" : "1px dashed rgba(255,255,255,0.10)",
              }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: textSecondary, marginBottom: 4 }}>
                  Anotação anterior
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12.5, fontWeight: 300, color: textPrimary, whiteSpace: "pre-wrap" }}>
                  {os.pecas_texto}
                </div>
              </div>
            )}
          </div>

          {/* Assinatura */}
          {os.assinatura_url ? (
            <div>
              <label style={LABEL}>Assinatura de {os.assinatura_nome ?? "quem recebeu"}</label>
              {assinaturaUrl ? (
                <img
                  src={assinaturaUrl}
                  alt="Assinatura"
                  style={{ width: "100%", maxWidth: 320, borderRadius: 10, background: "#fff" }}
                />
              ) : (
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
                  carregando assinatura…
                </span>
              )}
            </div>
          ) : emExecucao ? (
            <div>
              <label style={LABEL}>Assinatura de quem acompanhou</label>
              <input
                style={{ ...INPUT, height: 46, marginBottom: 8 }}
                value={assinanteNome}
                onChange={(e) => setAssinanteNome(e.target.value)}
                placeholder="Nome de quem assina"
              />
              <AssinaturaCanvas onChange={setAssinaturaData} />
            </div>
          ) : null}

          {emExecucao && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={{ ...btnSec, flex: 1 }} onClick={() => salvarRascunho.mutate()} disabled={salvarRascunho.isPending}>
                {salvarRascunho.isPending ? "Salvando…" : "Salvar anotações"}
              </button>
              <button style={{ ...CTA, flex: 2, width: "auto" }} onClick={() => concluir.mutate()} disabled={concluir.isPending}>
                <CheckCircle2 size={18} />
                {concluir.isPending ? "Concluindo…" : "Concluir atendimento"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Relatório de atendimento (PDF) — a partir da execução */}
      {["executada", "fechada"].includes(os.status) && (
        <button
          style={{ ...btnSec, height: 50, borderRadius: 25 }}
          onClick={() => baixarRelatorio.mutate()}
          disabled={baixarRelatorio.isPending}
        >
          <FileDown size={16} color={gold} />
          {baixarRelatorio.isPending ? "Gerando relatório…" : "Baixar relatório de atendimento (PDF)"}
        </button>
      )}

      {/* Cobrança — Etapa U4. Só quem responde pelo financeiro enxerga; o
          técnico registra a peça e não participa da decisão de cobrar. */}
      {isGerente && ["executada", "fechada"].includes(os.status) && pecasOs.length > 0 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={15} color={gold} />
            <span style={SEC}>Cobrança</span>
            <span style={{
              marginLeft: "auto", padding: "3px 8px", borderRadius: 999,
              fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: textSecondary,
              background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.05)",
              border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
            }}>
              {FATURAMENTO_LABEL[(os as any).faturamento_status as FaturamentoStatus] ?? "—"}
            </span>
          </div>

          {!os.contrato_id && (
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: gold, lineHeight: 1.5 }}>
              Cliente sem contrato vigente na abertura: tudo neste atendimento é faturável.
            </span>
          )}

          {analise.length === 0 ? (
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 300, color: textSecondary, lineHeight: 1.5 }}>
              Ainda não analisado. A análise confere item a item contra o contrato — nada é cobrado sem a sua
              aprovação depois.
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pecasOs.map((p) => {
                const a = analise.find((x) => x.peca_id === p.id);
                if (!a) return null;
                const rc = RESULTADO_CORES[a.resultado];
                const editando = itemEditando === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "10px 12px", borderRadius: 12,
                      background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${a.resultado === "revisar" || a.resultado === "nao_identificado"
                        ? rc.border
                        : isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
                      display: "flex", flexDirection: "column", gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: textPrimary }}>
                          {Number(p.quantidade) !== 1 ? `${p.quantidade}× ` : ""}{p.descricao}
                        </div>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 300, color: textSecondary, marginTop: 2, lineHeight: 1.45 }}>
                          {a.justificativa}
                          {a.ajustado_manualmente && " · ajustado manualmente"}
                          {!a.ajustado_manualmente && a.confianca != null && ` · ${Math.round(a.confianca * 100)}% de confiança`}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 999,
                          fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 9,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                          color: isLight ? rc.light : rc.dark, background: rc.bg, border: `1px solid ${rc.border}`,
                        }}>
                          {RESULTADO_LABEL[a.resultado]}
                        </span>
                        {a.valor_calculado != null && (
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600 }}>
                            {moeda(Number(a.valor_calculado) * Number(p.quantidade))}
                          </span>
                        )}
                      </div>
                    </div>

                    {os.status === "executada" && (
                      editando ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {(Object.keys(RESULTADO_LABEL) as ResultadoItem[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => setNovoResultado(r)}
                              style={{
                                padding: "5px 9px", borderRadius: 8, cursor: "pointer",
                                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10.5,
                                border: novoResultado === r ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                                background: novoResultado === r ? "linear-gradient(135deg,#FFD700,#FFC000)" : "transparent",
                                color: novoResultado === r ? "#08090E" : textPrimary,
                              }}
                            >
                              {RESULTADO_LABEL[r]}
                            </button>
                          ))}
                          {novoResultado === "faturavel" && (
                            <input
                              value={novoValor}
                              onChange={(e) => setNovoValor(e.target.value)}
                              inputMode="decimal"
                              placeholder="valor unit."
                              style={{ ...INPUT, width: 110, padding: "6px 10px", fontSize: 12 }}
                            />
                          )}
                          <button
                            onClick={() => ajustar.mutate({ pecaId: p.id })}
                            style={{
                              padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
                              color: "#08090E", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10.5,
                            }}
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setItemEditando(null)}
                            style={{
                              padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                              background: "none", border: "none",
                              color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontSize: 10.5,
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setItemEditando(p.id);
                            setNovoResultado(a.resultado);
                            setNovoValor(a.valor_calculado != null ? String(a.valor_calculado) : "");
                          }}
                          style={{
                            alignSelf: "flex-start", padding: "4px 9px", borderRadius: 8, cursor: "pointer",
                            background: "none",
                            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                            color: textSecondary, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10.5,
                          }}
                        >
                          Ajustar
                        </button>
                      )
                    )}
                  </div>
                );
              })}

              {(() => {
                const emRevisao = analise.filter(
                  (a) => a.resultado === "revisar" || a.resultado === "nao_identificado",
                ).length;
                const total = totalFaturavel(
                  analise,
                  Object.fromEntries(pecasOs.map((p) => [p.id, Number(p.quantidade) || 1])),
                );
                return (
                  <>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "baseline",
                      paddingTop: 8,
                      borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
                        Total faturável
                      </span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 16, fontWeight: 700, color: gold }}>
                        {moeda(total)}
                      </span>
                    </div>
                    {emRevisao > 0 && (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <AlertTriangle size={15} color={gold} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
                          {emRevisao} item(ns) esperando decisão. A aprovação fica bloqueada até resolver — cobrança
                          indevida custa mais caro que uma conferência.
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {cobrancasOs.length > 0 && (
            <div style={{
              padding: "10px 12px", borderRadius: 12,
              background: isLight ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.28)",
            }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textPrimary }}>
                {cobrancasOs.length} cobrança(s) geradas ·{" "}
                <strong>{moeda(cobrancasOs.reduce((s, c) => s + Number(c.valor), 0))}</strong> na competência{" "}
                {cobrancasOs[0]?.competencia}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ ...btnSec, flex: 1 }}
              onClick={() => analisar.mutate()}
              disabled={analisar.isPending}
            >
              <Sparkles size={15} color={gold} />
              {analisar.isPending ? "Analisando…" : analise.length === 0 ? "Analisar cobrança" : "Reanalisar"}
            </button>
            {analise.length > 0 && os.status === "executada" && (
              <button
                style={{ ...btnSec, flex: 1, borderColor: gold, color: gold }}
                onClick={() => aprovar.mutate()}
                disabled={aprovar.isPending}
              >
                {aprovar.isPending ? "Aprovando…" : "Aprovar cobrança"}
              </button>
            )}
            {cobrancasOs.some((c) => c.status === "aberta" || c.status === "fechada") && (
              <button
                style={{ ...btnSec, flex: 1 }}
                onClick={() => faturar.mutate()}
                disabled={faturar.isPending}
              >
                Marcar faturada
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conferência do gestor */}
      {isGerente && os.status === "executada" && (
        <div style={{ ...CARD, border: `1px solid ${isLight ? "rgba(4,120,87,0.35)" : "rgba(52,211,153,0.30)"}` }}>
          <span style={SEC}>Conferência</span>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            Revise o diagnóstico, as fotos e a assinatura. Fechar encerra o chamado e avisa o técnico.
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ ...btnSec, flex: 1 }} onClick={() => reabrir.mutate()} disabled={reabrir.isPending}>
              Reabrir
            </button>
            <button
              style={{
                ...CTA, flex: 2, width: "auto",
                background: "linear-gradient(135deg,#34D399 0%,#10B981 40%,#059669 100%)",
                color: "#FFFFFF",
                boxShadow: "0 4px 20px rgba(16,185,129,0.45)",
              }}
              onClick={() => fechar.mutate()}
              disabled={fechar.isPending}
            >
              <CheckCircle2 size={18} />
              {fechar.isPending ? "Fechando…" : "Conferir e fechar"}
            </button>
          </div>
        </div>
      )}

      {/* Reabrir quando já fechada */}
      {isGerente && os.status === "fechada" && (
        <button style={btnSec} onClick={() => reabrir.mutate()} disabled={reabrir.isPending}>
          Reabrir chamado
        </button>
      )}

      {/* Cancelar */}
      {isGerente && ["aberta", "agendada", "em_atendimento"].includes(os.status) && (
        <div style={CARD}>
          {cancelando ? (
            <>
              <span style={SEC}>Cancelar chamado</span>
              <textarea
                style={{ ...INPUT, height: 70, resize: "vertical" }}
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
                placeholder="Motivo do cancelamento"
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...btnSec, flex: 1 }} onClick={() => setCancelando(false)}>Voltar</button>
                <button
                  style={{
                    ...btnSec, flex: 1,
                    color: isLight ? "#b91c1c" : "#F87171",
                    border: `1px solid ${isLight ? "rgba(185,28,28,0.35)" : "rgba(248,113,113,0.32)"}`,
                  }}
                  onClick={() => cancelar.mutate()}
                  disabled={cancelar.isPending}
                >
                  {cancelar.isPending ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
              </div>
            </>
          ) : (
            <button
              style={{ ...btnSec, color: isLight ? "#b91c1c" : "#F87171" }}
              onClick={() => setCancelando(true)}
            >
              <Trash2 size={14} />
              Cancelar chamado
            </button>
          )}
        </div>
      )}

      {/* Linha do tempo */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <History size={15} color={gold} />
          <span style={SEC}>Linha do tempo</span>
        </div>
        {eventos.length === 0 ? (
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            Sem movimentações registradas.
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eventos.map((ev, i) => (
              <div key={ev.id} style={i === 0 ? { ...linha, borderTop: "none" } : linha}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600 }}>
                  {ev.descricao ?? ev.tipo}
                </span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary, flexShrink: 0 }}>
                  {new Date(ev.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!podeExecutar && (
        <div style={{ ...CARD, alignItems: "center" }}>
          <ClipboardList size={20} color={textSecondary} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary, textAlign: "center" }}>
            Este chamado está atribuído a outro técnico — você está apenas visualizando.
          </span>
        </div>
      )}
    </div>
  );
}
