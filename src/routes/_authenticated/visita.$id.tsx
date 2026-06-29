import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Copy, ExternalLink, Phone, MessageCircle,
  Check, X, Play, Square, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


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
        background: "rgba(8,8,12,0.55)",
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:     { label: "Pendente",     color: "rgba(255,192,0,0.9)" },
  em_andamento: { label: "Em andamento", color: "rgba(96,165,250,0.9)" },
  concluida:    { label: "Concluída",    color: "rgba(52,211,153,0.9)" },
  aprovada:     { label: "Aprovada",     color: "rgba(52,211,153,0.9)" },
  reprovada:    { label: "Reprovada",    color: "rgba(248,113,113,0.9)" },
};

// ─── Componente principal ─────────────────────────────────────────────────────
function VisitaDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });


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
          descricao_pedido, tecnico_id, cliente_id, prioridade,
          data_hora_inicio, data_hora_fim,
          aprovado_por, aprovado_em, motivo_reprovacao,
          servicos_solicitados,
          clientes (nome, email, telefone, tipo_empreendimento)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
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

  const verEquip =
    visita?.status === "em_andamento" ||
    visita?.status === "concluida" ||
    visita?.status === "aprovada";

  const { data: orcamento } = useQuery({
    queryKey: ["orcamento", id],
    enabled: !!verEquip,
    queryFn: async () => {
      const { data } = await supabase
        .from("visita_orcamentos")
        .select("blocos_selecionados, qtd_apartamentos, servicos_ofertados, sistema_atual")
        .eq("visita_id", id)
        .maybeSingle();
      return data;
    },
  });

  const blocoIds = useMemo(() => {
    const sel =
      (orcamento?.blocos_selecionados as Record<string, Record<string, number>> | null) ?? {};
    return Object.values(sel).flatMap((cat) => Object.keys(cat));
  }, [orcamento]);

  const { data: blocoDetalhes = [] } = useQuery({
    queryKey: ["blocos-detalhe", blocoIds.sort().join(",")],
    enabled: blocoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocos")
        .select("id, code, name, descricao, hh, blocos_itens(*)")
        .in("id", blocoIds);
      if (error) throw error;
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
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["visita", id] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      toast.success(vars.aprovar ? "Visita aprovada!" : "Visita reprovada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mapUrl =
    visita?.latitude && visita?.longitude
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${visita.longitude - 0.01}%2C${visita.latitude - 0.01}%2C${visita.longitude + 0.01}%2C${visita.latitude + 0.01}&layer=mapnik&marker=${visita.latitude}%2C${visita.longitude}`
      : null;

  const [showReprovarForm, setShowReprovarForm] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [editandoTecnico, setEditandoTecnico] = useState(false);
  const [novoTecnicoId, setNovoTecnicoId] = useState("");


  // ── computed (após todos os hooks) ──────────────────────────────────────────
  const status = visita?.status;
  const isTecnico = !!userId && userId === visita?.tecnico_id;
  const canApprove =
    mePerfil?.cargo === "admin" || mePerfil?.cargo === "comercial";
  const isAdmin = canApprove;
  const showSlide =
    status === "pendente" && isTecnico && !visita?.data_hora_inicio;
  const showFinalizar = status === "em_andamento" && isTecnico;
  const showApproval = canApprove && status === "concluida";
  const sInfo = status ? STATUS_LABELS[status] : null;

  const GLASS: React.CSSProperties = {
    background: "rgba(8,8,12,0.22)",
    backdropFilter: "blur(24px) saturate(200%)",
    WebkitBackdropFilter: "blur(24px) saturate(200%)",
    border: "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18,
    padding: "18px 16px",
  };
  const SECTION_LABEL: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontSize: 10,
    color: "rgba(255,192,0,0.65)",
    marginBottom: 10,
  };
  const BTN_GHOST: React.CSSProperties = {
    flex: 1,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
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

  const cliente = visita.clientes as any;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: isAdmin ? "/gerencial" : "/dashboard" })}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: 16,
              color: "#fff",
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
                color: "rgba(255,255,255,0.55)",
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
          {fmtDateLong(visita.data_hora_agendada)}
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
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 13,
              color: "#fff",
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

      {/* Cliente */}
      {cliente && (
        <div style={GLASS}>
          <div style={SECTION_LABEL}>Cliente</div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: 14,
              color: "#fff",
            }}
          >
            {cliente.nome}
          </div>
          {cliente.tipo_empreendimento && (
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "rgba(255,255,255,0.40)",
                marginTop: 2,
                textTransform: "capitalize",
              }}
            >
              {cliente.tipo_empreendimento}
            </div>
          )}
          {cliente.telefone && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a href={`tel:${cliente.telefone}`} style={BTN_GHOST}>
                <Phone size={14} /> Ligar
              </a>
              <a
                href={`https://wa.me/${String(cliente.telefone).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...BTN_GHOST,
                  border: "1px solid rgba(52,211,153,0.30)",
                  color: "#34D399",
                }}
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {/* Condomínio / síndico */}
      {(visita.nome_sindico ?? visita.nome_predio) && (
        <div style={GLASS}>
          <div style={SECTION_LABEL}>Condomínio</div>
          {visita.nome_predio && (
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 500,
                fontSize: 14,
                color: "#fff",
              }}
            >
              {visita.nome_predio}
            </div>
          )}
          {visita.nome_sindico && (
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
                marginTop: 4,
              }}
            >
              Síndico: {visita.nome_sindico}
            </div>
          )}
        </div>
      )}

      {/* Técnico responsável */}
      {(tecPerfil || isAdmin) && (
        <div style={GLASS}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={SECTION_LABEL}>Técnico responsável</div>
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

      {/* Equipamentos do orçamento */}
      {verEquip && blocoDetalhes.length > 0 && (
        <div style={GLASS}>
          <div style={SECTION_LABEL}>Equipamentos do orçamento</div>
          {Object.entries(
            (orcamento?.blocos_selecionados as Record<string, Record<string, number>>) ?? {},
          ).map(([cat, catQtds]) =>
            Object.entries(catQtds).map(([blocoId, qty]) => {
              const bloco = blocoDetalhes.find((b: any) => b.id === blocoId) as any;
              if (!bloco || !qty) return null;
              return (
                <div
                  key={`${cat}-${blocoId}`}
                  style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ background: "rgba(255,192,0,0.12)", borderRadius: 6, padding: "2px 8px", fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 10, color: "#FFC000" }}>
                      {bloco.code}
                    </span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 13, color: "#fff" }}>
                      {bloco.name}
                    </span>
                    <span style={{ marginLeft: "auto", fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11, color: "rgba(255,192,0,0.65)" }}>
                      ×{qty}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                    {(bloco.blocos_itens ?? []).map((item: any) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                        <span>{item.nome} · {item.modelo}</span>
                        <span style={{ color: "#FFC000", fontWeight: 400 }}>
                          {item.qty * qty}{item.variavel ? " (V)" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }),
          )}
          {orcamento?.qtd_apartamentos && (
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
              {orcamento.qtd_apartamentos} apartamentos{orcamento.sistema_atual ? ` · ${orcamento.sistema_atual}` : ""}
            </div>
          )}
        </div>
      )}



      {/* Aprovação */}
      {(status === "aprovada" || status === "reprovada" || showApproval) && (
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
              ✅ Aprovada{aprovPerf?.nome ? ` por ${aprovPerf.nome}` : ""}
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
              ❌ Reprovada
              {visita.motivo_reprovacao ? ` — ${visita.motivo_reprovacao}` : ""}
            </div>
          )}

          {showApproval && !showReprovarForm && (
            <>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 14,
                }}
              >
                Visita concluída — aguardando aprovação
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={async () => {
                    await aprovarMutation.mutateAsync({ aprovar: true });
                    fetch("https://grupoprever.app.n8n.cloud/webhook/visita-aprovada", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visita_id: id }),
                    }).catch(() => {});
                  }}
                  disabled={aprovarMutation.isPending}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid rgba(52,211,153,0.35)",
                    background: "rgba(52,211,153,0.09)",
                    color: "#34D399",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 12,
                    letterSpacing: "0.08em",
                  }}
                >
                  <Check size={15} /> Aprovar
                </button>
                <button
                  onClick={() => setShowReprovarForm(true)}
                  style={{
                    flex: 1,
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
                    fontWeight: 300,
                    fontSize: 12,
                    letterSpacing: "0.08em",
                  }}
                >
                  <X size={15} /> Reprovar
                </button>
              </div>
            </>
          )}

          {showApproval && showReprovarForm && (
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
        </div>
      )}


      {/* CTA fixo: Finalizar */}
      {showFinalizar && (
        <div
          style={{
            position: "fixed",
            bottom: 64,
            left: 0,
            right: 0,
            zIndex: 30,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(8,9,14,0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: "12px 16px",
          }}
        >
          <button
            onClick={async () => {
              await finalizarMutation.mutateAsync();
              fetch("https://grupoprever.app.n8n.cloud/webhook/visita-concluida", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visita_id: id }),
              }).catch(() => {});
            }}
            disabled={finalizarMutation.isPending}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 28,
              background: "rgba(96,165,250,0.12)",
              border: "1.5px solid rgba(96,165,250,0.35)",
              color: "#60A5FA",
              cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: finalizarMutation.isPending ? 0.6 : 1,
            }}
          >
            <Square size={18} />
            {finalizarMutation.isPending ? "Finalizando…" : "Finalizar Visita"}
          </button>
        </div>
      )}

      {/* SlideToStart — fluxo normal */}
      {showSlide && (
        <div
          style={{
            borderTop: "1px solid rgba(255,192,0,0.10)",
            background: "rgba(8,9,14,0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            padding: "12px 16px",
          }}
        >
          <SlideToStart
            onConfirm={() => iniciarMutation.mutate()}
            pending={iniciarMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}
