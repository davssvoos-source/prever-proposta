import { createFileRoute, useNavigate, Outlet, useRouterState, useLocation, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
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
import { Layers, Banknote } from "lucide-react";
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
        border: "1px solid rgba(255,192,0,0.22)",
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
            "linear-gradient(135deg, rgba(255,215,0,0.35), rgba(255,160,0,0.30))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Montserrat', sans-serif",
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
          background: "linear-gradient(135deg, #FFD700, #FFC000, #FF9F00)",
          boxShadow:
            "0 4px 18px rgba(255,192,0,0.55), inset 0 1px 0 rgba(255,255,255,0.35)",
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
  background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
  color: "#0A0A0A",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Montserrat', sans-serif",
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

const CTA_GOLD_OUTLINE = (pending: boolean): React.CSSProperties => ({
  width: "100%",
  height: 56,
  borderRadius: 28,
  background: "transparent",
  color: "#F59E0B",
  border: "1.5px solid #F59E0B",
  cursor: "pointer",
  fontFamily: "'Montserrat', sans-serif",
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

      // Notificar técnico responsável
      if (visita?.tecnico_id) {
        const local = visita.nome_predio || visita.titulo || visita.endereco || "local não informado";
        await supabase.from("notificacoes").insert({
          user_id: visita.tecnico_id,
          tipo: aprovar ? "visita_aprovada" : "visita_reprovada",
          titulo: aprovar ? "Visita aprovada ✓" : "Visita reprovada",
          corpo: aprovar
            ? `A visita técnica em ${local} foi aprovada.`
            : `A visita técnica em ${local} foi reprovada. Verifique o agendamento.`,
          visita_id: id,
          lida: false,
        });
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      toast.success(vars.aprovar ? "Visita aprovada!" : "Visita reprovada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);

  const lat = visita?.latitude ?? geoLat;
  const lng = visita?.longitude ?? geoLng;

  async function geocodificar() {
    if (!visita?.endereco) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(visita.endereco)}`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
      const arr = await res.json();
      if (Array.isArray(arr) && arr[0]) {
        setGeoLat(parseFloat(arr[0].lat));
        setGeoLng(parseFloat(arr[0].lon));
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (visita?.endereco && visita.endereco.trim() && !lat && !lng) {
      geocodificar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visita?.endereco]);

  const mapUrl =
    lat && lng
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
  const showAprovarBtn  = canApprove && status === "aguardando_aprovacao";
  const showReprovarBtn = canApprove && (status === "em_andamento" || status === "aprovada" || status === "aguardando_aprovacao");
  const sInfo = status ? STATUS_LABELS[status] : null;


  const GLASS: React.CSSProperties = {
    background: isLight ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)" : "rgba(8,8,12,0.22)",
    backdropFilter: isLight ? "none" : "blur(24px) saturate(200%)",
    WebkitBackdropFilter: isLight ? "none" : "blur(24px) saturate(200%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "18px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const SECTION_LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: isLight ? "#b87800" : "rgba(255,192,0,0.65)",
    marginBottom: 10,
  };
  const BTN_GHOST: React.CSSProperties = {
    flex: 1,
    height: 40,
    borderRadius: 12,
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    color: isLight ? "#0a0b0e" : "#fff",
    boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 12,
    textDecoration: "none",
  };
  const TXT_PRIMARY = isLight ? "#0a0b0e" : "#fff";
  const TXT_SECONDARY = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";

  // EARLY RETURN obrigatório (após todos os hooks) — delega às rotas filhas
  if (pathname !== `/visita/${id}`) {
    return <Outlet />;
  }

  if (isLoading || !visita) {

    return (
      <div style={{ padding: 24 }}>
        <div style={{ ...GLASS, textAlign: "center", color: "rgba(200,200,200,0.5)" }}>
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
              fontFamily: "'Montserrat', sans-serif",
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
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
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
              border: `1px solid ${sInfo.color}`,
              color: sInfo.color,
              fontFamily: "'Montserrat', sans-serif",
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
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 14,
            color: "#fff",
            textTransform: "capitalize",
          }}
        >
          {visita.data_hora_agendada ? fmtDateLong(visita.data_hora_agendada) : "Sem data agendada"}
        </div>
        {visita.data_hora_inicio && (
          <div
            style={{
              marginTop: 10,
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
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
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
                marginBottom: 4,
              }}
            >
              {visita.nome_predio}
            </div>
          )}
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 13,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {visita.endereco}
          </div>
          {visita.complemento && (
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "rgba(255,255,255,0.50)",
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
                background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: "1px solid rgba(255,215,0,0.15)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={SECTION_LABEL}>{labelResponsavel1}</div>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  <Pencil size={14} color="rgba(255,255,255,0.45)" />
                </button>
              </div>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: 14,
                  color: "#fff",
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
                    color: "#fff",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
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
                background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                border: "1px solid rgba(255,215,0,0.15)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={SECTION_LABEL}>{labelResponsavel2}</div>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                  <Pencil size={14} color="rgba(255,255,255,0.45)" />
                </button>
              </div>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  fontSize: 14,
                  color: "#fff",
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
                    color: "#fff",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 500,
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
              <HardHat size={16} color="#F59E0B" />
              Técnico responsável
            </div>
            {isAdmin && !editandoTecnico && (
              <button
                onClick={() => { setEditandoTecnico(true); setNovoTecnicoId(visita.tecnico_id ?? ""); }}
                style={{
                  background: "rgba(255,192,0,0.10)",
                  border: "1px solid rgba(255,192,0,0.28)",
                  borderRadius: 10,
                  padding: "4px 12px",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: "#FFC000",
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
                  background: "linear-gradient(135deg,#FFD700,#FFC000)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 16, color: "#08090E",
                }}
              >
                {initials(tecPerfil.nome ?? "?")}
              </div>
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 14, color: "#fff" }}>
                  {tecPerfil.nome}
                </div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12, color: "rgba(255,255,255,0.40)", textTransform: "capitalize" }}>
                  {tecPerfil.cargo ?? "—"}
                </div>
              </div>
            </div>
          )}

          {!tecPerfil && !editandoTecnico && (
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
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
                    border: "1px solid rgba(255,192,0,0.28)",
                    background: "rgba(255,192,0,0.06)", color: "#fff",
                    padding: "0 40px 0 14px",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 13,
                    appearance: "none", outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="">Selecione o técnico…</option>
                  {todosProfiles.map((p: any) => (
                    <option key={p.id} value={p.id} style={{ background: "#0d0e14" }}>
                      {p.nome} ({p.cargo ?? "sem cargo"})
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} color="rgba(255,192,0,0.6)" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setEditandoTecnico(false); setNovoTecnicoId(""); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)", background: "transparent",
                    color: "rgba(255,255,255,0.45)", cursor: "pointer",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => novoTecnicoId && atribuirMutation.mutate(novoTecnicoId)}
                  disabled={!novoTecnicoId || atribuirMutation.isPending}
                  style={{
                    flex: 2, height: 40, borderRadius: 12,
                    border: "1px solid rgba(255,192,0,0.35)", background: "rgba(255,192,0,0.12)",
                    color: "#FFC000", cursor: "pointer",
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 12,
                    letterSpacing: "0.08em", opacity: novoTecnicoId ? 1 : 0.4,
                  }}
                >
                  {atribuirMutation.isPending ? "Salvando…" : "Confirmar atribuição"}
                </button>
              </div>
            </div>
          )}

          {isTecnico && !editandoTecnico && (
            <div style={{ marginTop: 10, fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 12, color: "#FFC000" }}>
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
                  border: "1px solid rgba(255,192,0,0.30)",
                  borderRadius: 8,
                  color: "#FFC000",
                  fontFamily: "'Montserrat', sans-serif",
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
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => propostosMutation.mutate(propostosDraft)}
                  disabled={propostosMutation.isPending || propostosDraft.length === 0}
                  style={{ background: "rgba(255,192,0,0.12)", border: "1px solid rgba(255,192,0,0.45)", borderRadius: 8, color: "#FFC000", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 11, padding: "4px 10px", cursor: "pointer", opacity: propostosDraft.length === 0 ? 0.4 : 1 }}
                >
                  Salvar
                </button>
              </div>
            )}
          </div>
          {!editandoPropostos ? (
            (((visita as any).servicos_propostos as string[] | null) ?? []).length === 0 ? (
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                Nenhum serviço proposto definido.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(((visita as any).servicos_propostos as string[] | null) ?? []).map((k) => (
                  <span
                    key={k}
                    style={{
                      background: "transparent",
                      border: "1px solid #FFFFFF",
                      color: "#FFFFFF",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontFamily: "'Montserrat', sans-serif",
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
                      background: ativo ? "rgba(255,255,255,0.10)" : "rgba(8,8,12,0.20)",
                      border: ativo ? "1.5px solid #FFFFFF" : "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 999,
                      padding: "6px 11px",
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 11,
                      fontWeight: 300,
                      color: ativo ? "#FFFFFF" : "rgba(200,200,200,0.65)",
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
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 13,
              color: "rgba(255,255,255,0.72)",
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
                      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 6 }} />
                    )}
                    <div
                      style={{
                        color: "#FFC000",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        fontFamily: "'Montserrat',sans-serif",
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
                background: "rgba(52,211,153,0.09)",
                border: "1px solid rgba(52,211,153,0.22)",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 13,
                color: "#34D399",
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
                background: "rgba(248,113,113,0.09)",
                border: "1px solid rgba(248,113,113,0.22)",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 13,
                color: "#F87171",
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
                border: "1px solid rgba(251,191,36,0.28)",
                borderRadius: 12,
                padding: "12px 14px",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 13,
                color: "#FBBF24",
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
                color: "#FFFFFF",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                background: "linear-gradient(135deg,#34D399 0%,#10B981 40%,#059669 100%)",
                boxShadow:
                  "0 4px 20px rgba(16,185,129,0.45), inset 0 0 0 1px rgba(110,231,183,0.35), inset 0 1px 0 rgba(255,255,255,0.20)",
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
                border: "1px solid rgba(248,113,113,0.35)",
                background: "rgba(248,113,113,0.08)",
                color: "#F87171",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
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
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 12,
                  color: "rgba(248,113,113,0.80)",
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
                  border: "1px solid rgba(248,113,113,0.28)",
                  background: "rgba(248,113,113,0.06)",
                  color: "#fff",
                  padding: "10px 12px",
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
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
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "transparent",
                    color: "rgba(255,255,255,0.45)",
                    cursor: "pointer",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
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
                    border: "1px solid rgba(248,113,113,0.35)",
                    background: "rgba(248,113,113,0.10)",
                    color: "#F87171",
                    cursor: "pointer",
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
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
            <button
              onClick={() => navigate({ to: "/visita/$id/pagamento", params: { id } })}
              style={{ ...CTA_GOLD(false), marginTop: 12 }}
            >
              <Banknote size={18} />
              Configurar Forma de Pagamento
            </button>
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
                style={CTA_GOLD_OUTLINE(iniciarMutation.isPending)}
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
