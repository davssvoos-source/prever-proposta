import { createFileRoute, useNavigate, Outlet, useRouterState, useLocation, useRouter } from "@tanstack/react-router";
import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Copy, ExternalLink, Phone, MessageCircle,
  Check, X, Play, Square, ChevronDown, CheckCircle, XCircle,
  User, KeyRound, HardHat, Pencil,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SERVICOS_PROPOSTOS, SERVICO_PROPOSTO_LABEL } from "@/features/visitas/servicosPropostos";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { getStatusInfo } from "@/lib/visita-status";
import { Layers, Banknote, Wrench, Send } from "lucide-react";
import { abrirChamado } from "@/features/chamados/data";
import { montarChecklistImplantacao } from "@/features/chamados/checklist";
import { BlocoItensEditor } from "@/features/orcamento/BlocoItensEditor";

// Mesmos nomes usados no resumo de pré-envio, para o escopo ficar idêntico
// em qualquer tela onde apareça.
const TIPOS_NOMES: Record<string, string> = {
  PED: "Eclusa de Pedestres",
  VEI: "Eclusa Veicular",
  CFTV: "CFTV",
  AL: "Alarme",
  CER: "Cerca Elétrica",
  CENT: "Central de Portaria Remota",
  ELV: "Elevadores",
  TOT: "Totem Inteligente",
};
const TIPOS_UNICOS = new Set(["CENT"]);


export const Route = createFileRoute("/_authenticated/visita/$id")({
  component: VisitaDetail,
});

// ─── SlideToStart ─────────────────────────────────────────────────────────────
function SlideToStart({
  onConfirm,
  pending,
}: {
  onConfirm: () => void;
  pending: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideXRef = useRef(0);
  const dragging = useRef(false);
  const startClientX = useRef(0);
  const [slideX, setSlideX] = useState(0);
  const [completed, setCompleted] = useState(false);
  const KNOB = 56;

  const getMaxX = () =>
    trackRef.current ? trackRef.current.offsetWidth - KNOB - 8 : 200;

  const updateSlide = (clientX: number) => {
    const x = Math.max(0, Math.min(getMaxX(), clientX - startClientX.current));
    slideXRef.current = x;
    setSlideX(x);
  };

  const finalize = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const max = getMaxX();
    if (slideXRef.current >= max * 0.78) {
      slideXRef.current = max;
      setSlideX(max);
      setCompleted(true);
      onConfirm();
    } else {
      slideXRef.current = 0;
      setSlideX(0);
    }
  };

  const max = getMaxX();
  const progress = max > 0 ? slideX / max : 0;

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        width: "100%",
        height: 64,
        borderRadius: 32,
        background: "#101014",
        border: "1px solid rgba(248,200,17,0.22)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        overflow: "hidden",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: slideX + KNOB,
          background:
            "linear-gradient(135deg, rgba(252,222,72,0.35), rgba(255,160,0,0.30))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--fonte)",
          fontWeight: 400,
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.85)",
          opacity: 1 - progress * 1.2,
          pointerEvents: "none",
        }}
      >
        {completed ? "Iniciada" : pending ? "Iniciando…" : "Deslize para iniciar"}
      </div>
      <div
        onTouchStart={(e) => {
          if (completed || pending) return;
          dragging.current = true;
          startClientX.current = e.touches[0].clientX - slideXRef.current;
        }}
        onTouchMove={(e) => {
          if (!dragging.current) return;
          updateSlide(e.touches[0].clientX);
        }}
        onTouchEnd={finalize}
        onMouseDown={(e) => {
          if (completed || pending) return;
          dragging.current = true;
          startClientX.current = e.clientX - slideXRef.current;
          const move = (ev: MouseEvent) => updateSlide(ev.clientX);
          const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            finalize();
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: KNOB,
          height: KNOB,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FCDE48, #F8C811, #E8B00A)",
          boxShadow:
            "0 4px 18px rgba(248,200,17,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0A0A0A",
          cursor: completed || pending ? "default" : "grab",
          transform: `translateX(${slideX}px)`,
        }}
      >
        {completed ? <Check size={22} /> : <Play size={20} />}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}
function fmtDuracao(inicio: string, fim?: string | null) {
  const ms = (fim ? new Date(fim) : new Date()).getTime() - new Date(inicio).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}min`;
}
function initials(name: string) {
  return (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// Legado — proxy para o helper único (getStatusInfo). Mantido para minimizar
// diff em referências espalhadas neste arquivo.
const STATUS_LABELS: Record<string, { label: string; color: string }> = new Proxy({}, {
  get: (_t, key: string) => {
    const info = getStatusInfo(key);
    return info.bucket ? { label: info.label, color: info.color } : undefined;
  },
}) as unknown as Record<string, { label: string; color: string }>;

const CTA_GOLD = (pending: boolean): React.CSSProperties => ({
  width: "100%",
  height: 56,
  borderRadius: 28,
  background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
  color: "#0A0A0A",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--fonte)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  opacity: pending ? 0.7 : 1,
});

// Diferente do CTA_GOLD (sólido, texto escuro sobre o degradê), aqui o dourado
// É o texto e a borda — logo precisa do tom escuro da paleta no tema claro.
const CTA_GOLD_OUTLINE = (pending: boolean, isLight: boolean): React.CSSProperties => ({
  width: "100%",
  height: 56,
  borderRadius: 28,
  background: "transparent",
  color: isLight ? "#A06108" : "#F59E0B",
  border: `1.5px solid ${isLight ? "#A06108" : "#F59E0B"}`,
  cursor: "pointer",
  fontFamily: "var(--fonte)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  opacity: pending ? 0.7 : 1,
});


// ─── Componente principal ─────────────────────────────────────────────────────
function VisitaDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;
  const { isLight } = useTheme();


  const { data: meUser } = useQuery({
    queryKey: ["me-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = meUser?.id;

  const { data: mePerfil } = useQuery({
    queryKey: ["meu-perfil", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: visita, isLoading } = useQuery({
    queryKey: ["visita", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select(`
          id, status, data_hora_agendada, endereco, complemento,
          latitude, longitude, titulo, nome_sindico, nome_predio,
          nome_zelador, telefone_sindico, telefone_zelador, tipo_local,
          descricao_pedido, tecnico_id, cliente_id, prioridade,
          data_hora_inicio, data_hora_fim,
          aprovado_por, aprovado_em, motivo_reprovacao,
          proposta_enviada_em, proposta_resultado, proposta_resultado_em,
          proposta_motivo_recusa,
          servicos_solicitados, servicos_propostos,
          clientes (nome, email, telefone, tipo_empreendimento)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Escopo técnico (blocos do orçamento) — só existe depois que o técnico começa
  // a montar; atualiza sozinho a cada vez que a tela ganha foco/é revisitada.
  const { data: blocosEscopo = [] } = useQuery({
    queryKey: ["visita_blocos_resumo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("*")
        .eq("visita_id", id)
        .order("ordem");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: tecPerfil } = useQuery({
    queryKey: ["profile", visita?.tecnico_id],
    enabled: !!visita?.tecnico_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo")
        .eq("id", visita!.tecnico_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: aprovPerf } = useQuery({
    queryKey: ["profile", visita?.aprovado_por],
    enabled: !!visita?.aprovado_por,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", visita!.aprovado_por!)
        .maybeSingle();
      return data;
    },
  });

  const isAdminOrComercial =
    mePerfil?.cargo === "admin" || mePerfil?.cargo === "comercial";

  const { data: todosProfiles = [] } = useQuery({
    queryKey: ["tecnicos-lista"],
    enabled: isAdminOrComercial,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const atribuirMutation = useMutation({
    mutationFn: async (tecnicoId: string) => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({ tecnico_id: tecnicoId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      setEditandoTecnico(false);
      setNovoTecnicoId("");
      toast.success("Técnico atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const iniciarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({
          status: "em_andamento",
          data_hora_inicio: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      navigate({ to: "/visita/$id/orcamento", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Proposta aprovada → chamado de implantação, com checklist montado do
  // escopo. Reaproveita o chamado se já existir um para esta visita.
  const gerarImplantacao = useMutation({
    mutationFn: async () => {
      const clienteId = (visita as any)?.cliente_id as string | null;
      if (!clienteId) {
        throw new Error("Esta visita não está vinculada a um cliente. Vincule em Gerencial → Clientes antes de gerar o chamado.");
      }
      const { data: existente } = await supabase
        .from("chamados" as any)
        .select("id")
        .eq("visita_id", id)
        .eq("tipo", "implantacao")
        .maybeSingle();
      if (existente) return { chamadoId: (existente as any).id as string, nova: false };

      const local = (visita as any)?.nome_predio || (visita as any)?.titulo || "cliente";
      const chamadoId = await abrirChamado({
        natureza: "campo",
        tipo: "implantacao",
        cliente_id: clienteId,
        visita_id: id,
        titulo: `Implantação — ${local}`,
        descricao_problema: "Implantação do escopo aprovado na proposta desta visita técnica.",
        prioridade: "normal",
        responsavel_id: (visita as any)?.tecnico_id ?? null,
      });
      await montarChecklistImplantacao(chamadoId, id);
      return { chamadoId, nova: true };
    },
    onSuccess: ({ chamadoId, nova }) => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      toast.success(nova ? "Chamado de implantação criado." : "Esta visita já tem um chamado de implantação.");
      navigate({ to: "/chamados/$id", params: { id: chamadoId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({
          status: "concluida",
          data_hora_fim: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      toast.success("Visita finalizada! Aguardando aprovação.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aprovarMutation = useMutation({
    mutationFn: async ({ aprovar, motivo }: { aprovar: boolean; motivo?: string }) => {
      const patch = aprovar
        ? {
            status: "aprovada" as const,
            aprovado_por: userId,
            aprovado_em: new Date().toISOString(),
          }
        : {
            status: "reprovada" as const,
            motivo_reprovacao: motivo ?? "",
          };
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      // O técnico responsável é notificado pelo trigger notify_visita_status
      // no banco (insert client-side para outro usuário é bloqueado pela RLS).
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      toast.success(vars.aprovar ? "Visita aprovada!" : "Visita reprovada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // ── R38: o fluxo da proposta ACABA no envio (2026-08-22, Davi) ─────────────
  // Antes disto existia uma segunda etapa — "o cliente aceitou / recusou" —
  // com dois botões nesta tela. Ela saiu: o que o cliente decide depois de
  // receber a proposta acontece por telefone, WhatsApp, reunião — nunca
  // dentro do app — e não tem por que o app fingir que está acompanhando.
  // Enviar a proposta agora é o ÚLTIMO passo: a atividade fecha sozinha
  // (colunaDaVisita, em atividades/modelo.ts, manda a capa para "concluído"
  // assim que `proposta_enviada_em` é gravado — mesma tradução que o trigger
  // `sincronizar_chamado_da_visita` aplica no banco, U38).
  const enviarProposta = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("registrar_envio_proposta" as any, {
        _visita_id: id,
      } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      toast.success("Proposta enviada — o fluxo termina aqui. O resto acontece fora do app.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // A RPC `registrar_resultado_proposta` continua existindo no banco — não
  // por indecisão, mas porque visitas de ANTES desta mudança já têm resultado
  // registrado (proposta_resultado/_em), e apagar a LEITURA apagaria história
  // real (por isso os blocos "recusada"/"aceita" mais abaixo continuam
  // exibindo esses casos). O que não existe mais é a chamada: nada nesta tela
  // invoca a RPC de novo — o botão saiu junto com o estado que ele mexia.

  // ── A QUARTA CÓPIA DE NOMINATIM E O `useEffect` QUE A CHAMAVA: APAGADOS ──
  //
  // Era o pior abuso do repositório, e ele era invisível porque não produzia
  // nenhum efeito visível de erro. O efeito geocodificava o endereço A CADA
  // ABERTURA desta ficha e guardava o resultado em ESTADO DE COMPONENTE — que
  // morre quando a tela desmonta. Nada era gravado. Abrir a mesma visita dez
  // vezes eram dez requisições a um serviço público, para dez respostas
  // idênticas que eram jogadas fora dez vezes. Abrir cinco visitas seguidas
  // estourava o limite de ~1 req/s da política do Nominatim sem que ninguém
  // tivesse pedido nada — e o bloqueio deles é por IP, ou seja, cairia sobre a
  // operação inteira de uma vez.
  //
  // O MAPA NÃO PIOROU: ele já dependia de `visita.latitude/longitude` no caso
  // normal (`?? geoLat` era o segundo termo). O que ele perde é o desenho de um
  // pino para visitas ANTIGAS, criadas antes de a geocodificação passar a
  // gravar coordenada. Para essas o mapa simplesmente não aparece — que é a
  // resposta honesta: o sistema não sabe onde elas são. Cadastrar a coordenada
  // é gesto de quem edita a visita, com botão, uma requisição por clique.
  const lat = visita?.latitude ?? null;
  const lng = visita?.longitude ?? null;

  // `!= null`, e não teste de veracidade: latitude 0 é uma coordenada (o Golfo
  // da Guiné) e cairia como ausente num `&&`. É o mesmo padrão de `VisitaForm`.
  const mapUrl =
    lat != null && lng != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003}%2C${lat - 0.003}%2C${lng + 0.003}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;

  const [showReprovarForm, setShowReprovarForm] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [editandoTecnico, setEditandoTecnico] = useState(false);
  const [novoTecnicoId, setNovoTecnicoId] = useState("");
  const [editandoPropostos, setEditandoPropostos] = useState(false);
  const [propostosDraft, setPropostosDraft] = useState<string[]>([]);

  const propostosMutation = useMutation({
    mutationFn: async (vals: string[]) => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({ servicos_propostos: vals } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      setEditandoPropostos(false);
      toast.success("Serviços propostos atualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // ── computed (após todos os hooks) ──────────────────────────────────────────
  const status = visita?.status;
  // Residência/Galpão: não têm síndico/zelador — usa proprietário/encarregado(a),
  // mesma convenção da tela de criação (gerencial/nova).
  const tipoLocalNorm = ((visita as any)?.tipo_local as string | null | undefined)?.trim().toLowerCase();
  const isResidenciaOuGalpao = tipoLocalNorm === "residencia" || tipoLocalNorm === "empresa";
  const labelResponsavel1 = isResidenciaOuGalpao ? "Proprietário" : "Síndico";
  const labelResponsavel2 = isResidenciaOuGalpao ? "Encarregado(a)" : "Zelador(a)";
  const isTecnico = !!userId && userId === visita?.tecnico_id;
  const canApprove =
    mePerfil?.cargo === "admin" || mePerfil?.cargo === "comercial";
  const isAdmin = canApprove;
  const showIniciar   = status === "pendente";
  // "Continuar Orçamento" (editar escopo) fica disponível em qualquer estado já
  // iniciado, incluindo aguardando_aprovacao — antes sumia assim que o técnico
  // enviava para aprovação, sem dar como voltar e ajustar o escopo.
  const showContinuar = status === "em_andamento" || status === "aguardando_aprovacao";
  const showReagendar = status === "reprovada";
  // R4 — o pós-aprovação: proposta enviada e resposta do cliente
  const propostaEnviada = !!(visita as any)?.proposta_enviada_em;
  const resultadoProposta = ((visita as any)?.proposta_resultado ?? null) as
    | "aguardando" | "aceita" | "recusada" | null;

  const ACAO_SECUNDARIA: React.CSSProperties = {
    marginTop: 10, width: "100%", height: 52, borderRadius: 26,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: isLight ? "#1e2229" : "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13,
    cursor: "pointer",
  };

  const showAprovarBtn  = canApprove && status === "aguardando_aprovacao";
  const showReprovarBtn = canApprove && (status === "em_andamento" || status === "aprovada" || status === "aguardando_aprovacao");
  const sInfo = status ? STATUS_LABELS[status] : null;
  // O proxy legado descarta o `colorLight`, que existe exatamente para este
  // caso: o chip não tem fundo próprio, então no claro o tom de tema escuro
  // (ex.: #F8C811 de "Pendente") ficaria em 1.58:1 sobre a página.
  const chipColor = sInfo && status ? (isLight ? getStatusInfo(status).colorLight : sInfo.color) : undefined;


  const GLASS: React.CSSProperties = {
    background: isLight ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)" : "rgba(8,8,12,0.22)",
    backdropFilter: isLight ? "none" : "blur(24px) saturate(200%)",
    WebkitBackdropFilter: isLight ? "none" : "blur(24px) saturate(200%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 18,
    padding: "18px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SECTION_LABEL: React.CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: isLight ? "#A06108" : "rgba(248,200,17,0.65)",
    marginBottom: 10,
  };
  const BTN_GHOST: React.CSSProperties = {
    flex: 1,
    height: 40,
    borderRadius: 12,
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    color: isLight ? "#1e2229" : "#fff",
    boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "var(--fonte)",
    fontWeight: 400,
    fontSize: 12,
    textDecoration: "none",
  };
  const TXT_PRIMARY = isLight ? "#1e2229" : "#fff";
  const TXT_SECONDARY = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";

  // EARLY RETURN obrigatório (após todos os hooks) — delega às rotas filhas
  if (pathname !== `/visita/${id}`) {
    return <Outlet />;
  }

  if (isLoading || !visita) {

    return (
      <div style={{ padding: 24 }}>
        <div style={{ ...GLASS, textAlign: "center", color: isLight ? "#4a5060" : "rgba(200,200,200,0.5)" }}>
          Carregando visita…
        </div>
      </div>
    );
  }

  

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => {
            if (from && from !== location.pathname) {
              navigate({ to: from }); // objeto, nunca string pura
            } else if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              navigate({ to: "/dashboard" });
            }
          }}


          style={{
            background: isLight ? "rgba(0,0,0,0.05)" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: TXT_PRIMARY,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--fonte)",
              fontWeight: 600,
              fontSize: 16,
              color: TXT_PRIMARY,
            }}
          >
            Visita Técnica
          </div>
          {(visita.nome_predio ?? visita.titulo) && (
            <div
              style={{
                fontFamily: "var(--fonte)",
                fontWeight: 400,
                fontSize: 12,
                color: TXT_SECONDARY,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {visita.nome_predio ?? visita.titulo}
            </div>
          )}
        </div>
        {sInfo && (
          <div
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${chipColor}`,
              color: chipColor,
              fontFamily: "var(--fonte)",
              fontWeight: 400,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {sInfo.label}
          </div>
        )}
      </div>

      {/* Data e horário */}
      <div style={GLASS}>
        <div style={SECTION_LABEL}>Data e horário</div>
        <div
          style={{
            fontFamily: "var(--fonte)",
            fontWeight: 400,
            fontSize: 14,
            color: TXT_PRIMARY,
            textTransform: "capitalize",
          }}
        >
          {visita.data_hora_agendada ? fmtDateLong(visita.data_hora_agendada) : "Sem data agendada"}
        </div>
        {visita.data_hora_inicio && (
          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--fonte)",
              fontWeight: 400,
              fontSize: 12,
              color: TXT_SECONDARY,
              lineHeight: 1.7,
            }}
          >
            <div>Início: {fmtShort(visita.data_hora_inicio)}</div>
            {visita.data_hora_fim && <div>Fim: {fmtShort(visita.data_hora_fim)}</div>}
            <div>Duração: {fmtDuracao(visita.data_hora_inicio, visita.data_hora_fim)}</div>
          </div>
        )}
      </div>

      {/* Local */}
      <div style={{ ...GLASS, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 16px" }}>
          <div style={SECTION_LABEL}>Local</div>
          {visita.nome_predio && (
            <div
              style={{
                fontFamily: "var(--fonte)",
                fontWeight: 600,
                fontSize: 14,
                color: TXT_PRIMARY,
                marginBottom: 4,
              }}
            >
              {visita.nome_predio}
            </div>
          )}
          <div
            style={{
              fontFamily: "var(--fonte)",
              fontWeight: 400,
              fontSize: 13,
              color: TXT_SECONDARY,
            }}
          >
            {visita.endereco}
          </div>
          {visita.complemento && (
            <div
              style={{
                fontFamily: "var(--fonte)",
                fontWeight: 400,
                fontSize: 12,
                color: TXT_SECONDARY,
                marginTop: 4,
              }}
            >
              {visita.complemento}
            </div>
          )}
        </div>
        {mapUrl && (
          <iframe
            title="Mapa"
            src={mapUrl}
            style={{ width: "100%", height: 180, border: "none", display: "block" }}
            loading="lazy"
          />
        )}
        <div style={{ display: "flex", gap: 8, padding: "12px 16px" }}>
          <button
            style={BTN_GHOST}
            onClick={() => {
              navigator.clipboard.writeText(visita.endereco);
              toast.success("Endereço copiado");
            }}
          >
            <Copy size={14} /> Copiar
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visita.endereco)}`}
            target="_blank"
            rel="noreferrer"
            style={BTN_GHOST}
          >
            <ExternalLink size={14} /> Maps
          </a>
        </div>
      </div>


      {/* Síndico & Zelador */}
      {(visita.nome_sindico || visita.nome_zelador) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {visita.nome_sindico && (
            <div
              style={{
                background: isLight
                  ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
                  : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(252,222,72,0.15)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={SECTION_LABEL}>{labelResponsavel1}</div>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  <Pencil size={14} color={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.45)"} />
                </button>
              </div>
              <div
                style={{
                  fontFamily: "var(--fonte)",
                  fontWeight: 400,
                  fontSize: 14,
                  color: TXT_PRIMARY,
                  marginBottom: 10,
                }}
              >
                {visita.nome_sindico}
              </div>
              {visita.telefone_sindico && (
                <a
                  href={`https://wa.me/55${String(visita.telefone_sindico).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#25D366",
                    color: TXT_PRIMARY,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontFamily: "var(--fonte)",
                    fontWeight: 400,
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              )}
            </div>
          )}
          {visita.nome_zelador && (
            <div
              style={{
                background: isLight
                  ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
                  : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(252,222,72,0.15)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={SECTION_LABEL}>{labelResponsavel2}</div>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  <Pencil size={14} color={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.45)"} />
                </button>
              </div>
              <div
                style={{
                  fontFamily: "var(--fonte)",
                  fontWeight: 400,
                  fontSize: 14,
                  color: TXT_PRIMARY,
                  marginBottom: 10,
                }}
              >
                {visita.nome_zelador}
              </div>
              {visita.telefone_zelador && (
                <a
                  href={`https://wa.me/55${String(visita.telefone_zelador).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#25D366",
                    color: TXT_PRIMARY,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontFamily: "var(--fonte)",
                    fontWeight: 400,
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Técnico responsável */}
      {(tecPerfil || isAdmin) && (
        <div style={GLASS}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...SECTION_LABEL, display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
              <HardHat size={16} color={isLight ? "#A06108" : "#F59E0B"} />
              Técnico responsável
            </div>
            {isAdmin && !editandoTecnico && (
              <button
                onClick={() => { setEditandoTecnico(true); setNovoTecnicoId(visita.tecnico_id ?? ""); }}
                style={{
                  background: isLight ? "rgba(160,97,8,0.10)" : "rgba(248,200,17,0.10)",
                  border: isLight ? "1px solid rgba(160,97,8,0.28)" : "1px solid rgba(248,200,17,0.28)",
                  borderRadius: 10,
                  padding: "4px 12px",
                  fontFamily: "var(--fonte)",
                  fontWeight: 400,
                  fontSize: 11,
                  color: isLight ? "#A06108" : "#F8C811",
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                }}
              >
                Alterar técnico
              </button>
            )}
          </div>

          {tecPerfil && !editandoTecnico && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg,#FCDE48,#F8C811)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 16, color: "#08090E",
                }}
              >
                {initials(tecPerfil.nome ?? "?")}
              </div>
              <div>
                <div style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14, color: TXT_PRIMARY }}>
                  {tecPerfil.nome}
                </div>
                <div style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12, color: TXT_SECONDARY, textTransform: "capitalize" }}>
                  {tecPerfil.cargo ?? "—"}
                </div>
              </div>
            </div>
          )}

          {!tecPerfil && !editandoTecnico && (
            <div style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13, color: TXT_SECONDARY }}>
              Nenhum técnico atribuído
            </div>
          )}

          {isAdmin && editandoTecnico && (
            <div>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <select
                  value={novoTecnicoId}
                  onChange={(e) => setNovoTecnicoId(e.target.value)}
                  style={{
                    width: "100%", height: 48, borderRadius: 12,
                    border: "1px solid rgba(248,200,17,0.28)",
                    background: isLight ? "rgba(160,97,8,0.06)" : "rgba(248,200,17,0.06)", color: TXT_PRIMARY,
                    padding: "0 40px 0 14px",
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13,
                    appearance: "none", outline: "none", cursor: "pointer",
                  }}
                >
                  {/* o popup nativo não herda a cor do <select>: sem estas duas
                      propriedades o Chrome abre texto quase-preto sobre #0d0e14 */}
                  <option value="" style={{ background: isLight ? "#ffffff" : "#0d0e14", color: isLight ? "#1e2229" : "#ffffff" }}>Selecione o técnico…</option>
                  {todosProfiles.map((p: any) => (
                    <option key={p.id} value={p.id} style={{ background: isLight ? "#ffffff" : "#0d0e14", color: isLight ? "#1e2229" : "#ffffff" }}>
                      {p.nome} ({p.cargo ?? "sem cargo"})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} color={isLight ? "#A06108" : "rgba(248,200,17,0.6)"} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setEditandoTecnico(false); setNovoTecnicoId(""); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 12,
                    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
                    background: "transparent",
                    color: TXT_SECONDARY, cursor: "pointer",
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => novoTecnicoId && atribuirMutation.mutate(novoTecnicoId)}
                  disabled={!novoTecnicoId || atribuirMutation.isPending}
                  style={{
                    flex: 2, height: 40, borderRadius: 12,
                    border: isLight ? "1px solid rgba(160,97,8,0.35)" : "1px solid rgba(248,200,17,0.35)",
                    background: isLight ? "rgba(160,97,8,0.12)" : "rgba(248,200,17,0.12)",
                    color: isLight ? "#A06108" : "#F8C811", cursor: "pointer",
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12,
                    letterSpacing: "0.08em", opacity: novoTecnicoId ? 1 : 0.4,
                  }}
                >
                  {atribuirMutation.isPending ? "Salvando…" : "Confirmar atribuição"}
                </button>
              </div>
            </div>
          )}

          {isTecnico && !editandoTecnico && (
            <div style={{ marginTop: 10, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12, color: isLight ? "#A06108" : "#F8C811" }}>
              Você é o responsável por esta visita
            </div>
          )}
        </div>
      )}

      {/* Serviços propostos */}
      {visita && (
        <div style={GLASS}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Serviços propostos</div>
            {!editandoPropostos ? (
              <button
                onClick={() => {
                  setPropostosDraft(((visita as any).servicos_propostos as string[] | null) ?? []);
                  setEditandoPropostos(true);
                }}
                style={{
                  background: "transparent",
                  border: isLight ? "1px solid rgba(160,97,8,0.35)" : "1px solid rgba(248,200,17,0.30)",
                  borderRadius: 8,
                  color: isLight ? "#A06108" : "#F8C811",
                  fontFamily: "var(--fonte)",
                  fontWeight: 400,
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                Editar
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setEditandoPropostos(false)}
                  style={{ background: "transparent", border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: TXT_SECONDARY, fontFamily: "var(--fonte)", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => propostosMutation.mutate(propostosDraft)}
                  disabled={propostosMutation.isPending || propostosDraft.length === 0}
                  style={{ background: isLight ? "rgba(160,97,8,0.12)" : "rgba(248,200,17,0.12)", border: isLight ? "1px solid rgba(160,97,8,0.35)" : "1px solid rgba(248,200,17,0.45)", borderRadius: 8, color: isLight ? "#A06108" : "#F8C811", fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11, padding: "4px 10px", cursor: "pointer", opacity: propostosDraft.length === 0 ? 0.4 : 1 }}
                >
                  Salvar
                </button>
              </div>
            )}
          </div>
          {!editandoPropostos ? (
            (((visita as any).servicos_propostos as string[] | null) ?? []).length === 0 ? (
              <p style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12, color: TXT_SECONDARY, margin: 0 }}>
                Nenhum serviço proposto definido.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(((visita as any).servicos_propostos as string[] | null) ?? []).map((k) => (
                  <span
                    key={k}
                    style={{
                      background: "transparent",
                      border: isLight ? "1px solid rgba(0,0,0,0.20)" : "1px solid #FFFFFF",
                      color: TXT_PRIMARY,
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontFamily: "var(--fonte)",
                      fontSize: 11,
                      fontWeight: 400,
                    }}
                  >
                    {SERVICO_PROPOSTO_LABEL[k] ?? k}
                  </span>
                ))}
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SERVICOS_PROPOSTOS.map((s) => {
                const ativo = propostosDraft.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() =>
                      setPropostosDraft((prev) =>
                        prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key],
                      )
                    }
                    style={{
                      background: ativo ? (isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)") : (isLight ? "#ffffff" : "rgba(8,8,12,0.20)"),
                      border: ativo
                        ? (isLight ? "1.5px solid #1e2229" : "1.5px solid #FFFFFF")
                        : (isLight ? "1px solid rgba(0,0,0,0.18)" : "1px solid rgba(255,255,255,0.18)"),
                      borderRadius: 999,
                      padding: "6px 11px",
                      fontFamily: "var(--fonte)",
                      fontSize: 11,
                      fontWeight: 400,
                      color: ativo
                        ? (isLight ? "#1e2229" : "#FFFFFF")
                        : (isLight ? "#4a5060" : "rgba(200,200,200,0.65)"),
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>{s.emoji}</span> {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Descrição */}
      {visita.descricao_pedido && (
        <div style={GLASS}>
          <div style={SECTION_LABEL}>Descrição do pedido</div>
          <p
            style={{
              fontFamily: "var(--fonte)",
              fontWeight: 400,
              fontSize: 13,
              color: isLight ? "#1f2430" : "rgba(255,255,255,0.72)",
              whiteSpace: "pre-wrap",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {visita.descricao_pedido}
          </p>
        </div>
      )}

      {/* Escopo técnico — aparece assim que o técnico começa a montar os blocos;
          mesma lista em todas as telas (aqui, wizard e pré-envio). Comercial/Admin
          precisam disso para decidir aprovar ou reprovar. */}
      {blocosEscopo.length > 0 && (
        <div style={GLASS}>
          <div style={SECTION_LABEL}>Escopo técnico</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(() => {
              const counters: Record<string, number> = {};
              return blocosEscopo.map((bloco: any, idx: number) => {
                const tipo = bloco.tipo_bloco;
                counters[tipo] = (counters[tipo] || 0) + 1;
                const base = TIPOS_NOMES[tipo] || tipo;
                const nomeUsuario = (bloco.nome_acesso as string | null)?.trim();
                const label = nomeUsuario
                  ? nomeUsuario
                  : TIPOS_UNICOS.has(tipo)
                  ? base
                  : `${base} ${String(counters[tipo]).padStart(2, "0")}`;
                return (
                  <div key={bloco.id}>
                    {idx > 0 && (
                      <div style={{ height: 1, background: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.06)", marginBottom: 6 }} />
                    )}
                    <div
                      style={{
                        color: isLight ? "#A06108" : "#F8C811",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        fontFamily: "var(--fonte)",
                        textTransform: "uppercase",
                        marginBottom: 3,
                      }}
                    >
                      {label}
                    </div>
                    <BlocoItensEditor
                      visitaBlocoId={bloco.id}
                      codigo={bloco.codigo_bloco}
                      tipoBloco={bloco.tipo_bloco}
                      tecnologia={bloco.tecnologia}
                      qtdDome={bloco.qtd_dome}
                      qtdBullet={bloco.qtd_bullet}
                      cftvCameras={(bloco.alarme_config as any)?.cftv_cameras ?? null}
                      perimetro={bloco.perimetro}
                      esquinas={bloco.esquinas}
                      isLight={isLight}
                      readOnly
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Aprovação */}
      {(status === "aprovada" || status === "reprovada" || status === "aguardando_aprovacao" || showReprovarBtn) && (
        <div style={GLASS}>
          {status === "aprovada" && (
            <div
              style={{
                background: "rgba(45,210,165,0.09)",
                border: "1px solid rgba(45,210,165,0.22)",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "var(--fonte)",
                fontWeight: 400,
                fontSize: 13,
                color: isLight ? "#047862" : "#2DD2A5",
              }}
            >
              <CheckCircle size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />Aprovada{aprovPerf?.nome ? ` por ${aprovPerf.nome}` : ""}
              {visita.aprovado_em
                ? ` em ${new Date(visita.aprovado_em).toLocaleDateString("pt-BR")}`
                : ""}
            </div>
          )}

          {status === "reprovada" && (
            <div
              style={{
                background: "rgba(241,120,129,0.09)",
                border: "1px solid rgba(241,120,129,0.22)",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "var(--fonte)",
                fontWeight: 400,
                fontSize: 13,
                color: isLight ? "#B1242E" : "#F17881",
              }}
            >
              <XCircle size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />Reprovada
              {visita.motivo_reprovacao ? ` — ${visita.motivo_reprovacao}` : ""}
            </div>
          )}

          {status === "aguardando_aprovacao" && !showAprovarBtn && (
            <div
              style={{
                background: "rgba(251,191,36,0.09)",
                border: isLight ? "1px solid rgba(160,97,8,0.30)" : "1px solid rgba(251,191,36,0.28)",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "var(--fonte)",
                fontWeight: 400,
                fontSize: 13,
                color: isLight ? "#A06108" : "#FBBF24",
              }}
            >
              Aguardando aprovação do administrador.
            </div>
          )}

          {showAprovarBtn && !showReprovarForm && (
            <button
              onClick={() => aprovarMutation.mutate({ aprovar: true })}
              disabled={aprovarMutation.isPending}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 14,
                border: 0,
                cursor: aprovarMutation.isPending ? "not-allowed" : "pointer",
                color: TXT_PRIMARY,
                fontFamily: "var(--fonte)",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                background: "linear-gradient(135deg,#2DD2A5 0%,#059676 40%,#047862 100%)",
                boxShadow:
                  "0 4px 20px rgba(5,150,118,0.45), inset 0 0 0 1px rgba(110,231,183,0.35), inset 0 1px 0 rgba(255,255,255,0.20)",
                textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                marginBottom: 8,
                opacity: aprovarMutation.isPending ? 0.75 : 1,
              }}
            >
              <CheckCircle size={15} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
              Aprovar visita
            </button>
          )}



          {showReprovarBtn && !showReprovarForm && (
            <button
              onClick={() => setShowReprovarForm(true)}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 12,
                border: "1px solid rgba(241,120,129,0.35)",
                background: "rgba(241,120,129,0.08)",
                color: isLight ? "#B1242E" : "#F17881",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "var(--fonte)",
                fontWeight: 400,
                fontSize: 12,
                letterSpacing: "0.08em",
              }}
            >
              <X size={15} /> Reprovar visita
            </button>
          )}


          {showReprovarBtn && showReprovarForm && (
            <div>
              <div
                style={{
                  fontFamily: "var(--fonte)",
                  fontWeight: 400,
                  fontSize: 12,
                  color: isLight ? "rgba(177,36,46,0.85)" : "rgba(241,120,129,0.80)",
                  marginBottom: 10,
                  letterSpacing: "0.08em",
                }}
              >
                Motivo da reprovação
              </div>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo…"
                rows={3}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(241,120,129,0.28)",
                  background: "rgba(241,120,129,0.06)",
                  color: TXT_PRIMARY,
                  padding: "10px 12px",
                  fontFamily: "var(--fonte)",
                  fontWeight: 400,
                  fontSize: 13,
                  resize: "vertical",
                  boxSizing: "border-box",
                  marginBottom: 10,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setShowReprovarForm(false);
                    setMotivo("");
                  }}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
                    background: "transparent",
                    color: TXT_SECONDARY,
                    cursor: "pointer",
                    fontFamily: "var(--fonte)",
                    fontWeight: 400,
                    fontSize: 12,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => aprovarMutation.mutate({ aprovar: false, motivo })}
                  disabled={aprovarMutation.isPending || !motivo.trim()}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid rgba(241,120,129,0.35)",
                    background: "rgba(241,120,129,0.10)",
                    color: isLight ? "#B1242E" : "#F17881",
                    cursor: "pointer",
                    fontFamily: "var(--fonte)",
                    fontWeight: 400,
                    fontSize: 12,
                    opacity: motivo.trim() ? 1 : 0.5,
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {status === "aprovada" && canApprove && !showReprovarForm && (
            <>
              <button
                onClick={() => navigate({ to: "/visita/$id/pagamento", params: { id } })}
                style={{ ...CTA_GOLD(false), marginTop: 12 }}
              >
                <Banknote size={18} />
                Configurar Forma de Pagamento
              </button>

              {/* ── R38: o fluxo acaba no ENVIO (2026-08-22) ─────────────────
                  Não existe mais "aguardando a resposta do cliente" como
                  estado do app: enviar já fecha a atividade (vira "concluído"
                  sozinho — colunaDaVisita, em atividades/modelo.ts). O que o
                  cliente decide depois é acompanhado fora do app. */}
              {!propostaEnviada && (
                <>
                  <div style={{
                    marginTop: 12, padding: "10px 12px", borderRadius: 12,
                    background: isLight ? "rgba(160,97,8,0.07)" : "rgba(248,200,17,0.07)",
                    border: isLight ? "1px solid rgba(160,97,8,0.20)" : "1px solid rgba(248,200,17,0.20)",
                    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12,
                    color: isLight ? "#4a5060" : "rgba(255,255,255,0.65)", lineHeight: 1.5,
                  }}>
                    A visita está aprovada internamente. Enviar a proposta encerra
                    esta atividade — o que o cliente decide é combinado fora do app.
                  </div>
                  <button
                    onClick={() => enviarProposta.mutate()}
                    disabled={enviarProposta.isPending}
                    style={{ ...ACAO_SECUNDARIA, cursor: enviarProposta.isPending ? "wait" : "pointer" }}
                  >
                    <Send size={17} color={isLight ? "#A06108" : "#F8C811"} />
                    {enviarProposta.isPending ? "Registrando…" : "Marcar proposta como enviada"}
                  </button>
                </>
              )}

              {/* `registrar_envio_proposta` grava resultado='aguardando' por
                  padrão — é o estado normal de TODA proposta nova agora, já
                  que nada mais o tira dali. `!resultadoProposta` cobre visitas
                  antigas, de antes desta coluna existir. */}
              {propostaEnviada && (!resultadoProposta || resultadoProposta === "aguardando") && (
                <div style={{
                  marginTop: 12, fontFamily: "var(--fonte)", fontWeight: 400,
                  fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)",
                }}>
                  Proposta enviada em{" "}
                  {new Date(visita.proposta_enviada_em as string).toLocaleDateString("pt-BR")}
                  . Fluxo encerrado neste app.
                </div>
              )}

              {/* Histórico de visitas anteriores a esta mudança — a RPC que
                  gravava isto não é mais chamada por nenhum botão, mas o
                  registro que já existe continua legível. */}
              {resultadoProposta === "recusada" && (
                <div style={{
                  marginTop: 12, padding: "10px 12px", borderRadius: 12,
                  background: "rgba(241,120,129,0.10)", border: "1px solid rgba(241,120,129,0.28)",
                  fontFamily: "var(--fonte)", fontSize: 12.5,
                  color: isLight ? "#B1242E" : "#F17881", lineHeight: 1.5,
                }}>
                  Proposta recusada pelo cliente
                  {visita.proposta_resultado_em
                    ? ` em ${new Date(visita.proposta_resultado_em as string).toLocaleDateString("pt-BR")}`
                    : ""}.
                  {visita.proposta_motivo_recusa ? ` Motivo: ${visita.proposta_motivo_recusa}` : ""}
                </div>
              )}
              {resultadoProposta === "aceita" && (
                <div style={{
                  marginTop: 12, padding: "10px 12px", borderRadius: 12,
                  background: "rgba(45,210,165,0.10)", border: "1px solid rgba(45,210,165,0.28)",
                  fontFamily: "var(--fonte)", fontSize: 12.5,
                  color: isLight ? "#047862" : "#2DD2A5", lineHeight: 1.5,
                }}>
                  Proposta aceita
                  {visita.proposta_resultado_em
                    ? ` em ${new Date(visita.proposta_resultado_em as string).toLocaleDateString("pt-BR")}`
                    : ""}
                  {" "}— este agora é um cliente ativo.
                </div>
              )}

              {/* Gerar o chamado de implantação é ação MANUAL, disponível
                  assim que a proposta sai — não depende mais de um "aceite"
                  registrado no app (esse rastro não existe mais para
                  propostas novas). Quando souber que o cliente disse sim
                  (por telefone, WhatsApp…), o gestor aciona aqui. */}
              {propostaEnviada && (
                <button
                  onClick={() => gerarImplantacao.mutate()}
                  disabled={gerarImplantacao.isPending}
                  style={{ ...ACAO_SECUNDARIA, cursor: gerarImplantacao.isPending ? "wait" : "pointer" }}
                >
                  <Wrench size={17} color={isLight ? "#A06108" : "#F8C811"} />
                  {gerarImplantacao.isPending ? "Gerando chamado…" : "Gerar chamado de implantação"}
                </button>
              )}
            </>
          )}
        </div>
      )}


      {/* CTA principal por status */}
      {(showIniciar || showContinuar || showReagendar) && (
        <div style={{ marginTop: 16, paddingLeft: 16, paddingRight: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {showIniciar && (
            <button
              onClick={() => iniciarMutation.mutate()}
              disabled={iniciarMutation.isPending}
              style={CTA_GOLD(iniciarMutation.isPending)}
            >
              <Play size={18} />
              {iniciarMutation.isPending ? "Iniciando…" : "Iniciar Visita Técnica"}
            </button>
          )}

          {showContinuar && (
            <button
              onClick={() => navigate({ to: "/visita/$id/orcamento", params: { id } })}
              style={CTA_GOLD(false)}
            >
              <Play size={18} />
              Continuar Orçamento
            </button>
          )}

          {showReagendar && (
            <>
              <button
                onClick={() => navigate({ to: "/visita/$id/reagendar", params: { id } })}
                style={CTA_GOLD(false)}
              >
                <Play size={18} style={{ transform: "rotate(-45deg)" }} />
                Reagendar Visita
              </button>
              <button
                onClick={() => iniciarMutation.mutate()}
                disabled={iniciarMutation.isPending}
                style={CTA_GOLD_OUTLINE(iniciarMutation.isPending, isLight)}
              >
                <Play size={18} />
                {iniciarMutation.isPending ? "Iniciando…" : "Iniciar Visita Técnica"}
              </button>
            </>
          )}
        </div>
      )}



    </div>
  );
}
