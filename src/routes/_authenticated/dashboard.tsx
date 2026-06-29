import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, XCircle, MapPin, Play, Hourglass, CalendarRange, CalendarCheck, UserRound, ChevronDown, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const GLASS: React.CSSProperties = {
  background: "rgba(8, 8, 12, 0.18)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
  border: "1px solid rgba(255, 192, 0, 0.20)",
  borderRadius: 18,
  boxShadow: "0 0 0 1px rgba(255,192,0,0.06) inset, 0 8px 32px rgba(0,0,0,0.35)",
};

const STATUS_OPCOES = [
  { key: 'todos',                label: 'Todos os status',     color: 'rgba(255,255,255,0.35)' },
  { key: 'pendente',             label: 'Visitas pendentes',   color: '#FFC000' },
  { key: 'em_andamento',         label: 'Em andamento',        color: '#60A5FA' },
  { key: 'aguardando_aprovacao', label: 'Ag. Aprovação',       color: '#3B82F6' },
  { key: 'aprovado',             label: 'Aprovadas',           color: '#10B981' },
  { key: 'reprovada',            label: 'Reprovadas',          color: '#EF4444' },
];

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function fmtData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hhmm}`;
  if (d.toDateString() === amanha.toDateString()) return `Amanhã, ${hhmm}`;
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filtroAtivo, setFiltroAtivo] = useState<'hoje' | 'semana' | 'mes' | null>(null);
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const irParaReagendar = (visitaId: string) => {
    navigate({ to: '/visita/$id/reagendar', params: { id: visitaId } });
  };

  useEffect(() => {
    if (!showStatusDropdown) return;
    const handler = () => setShowStatusDropdown(false);
    const timeout = setTimeout(
      () => document.addEventListener('pointerdown', handler),
      100
    );
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('pointerdown', handler);
    };
  }, [showStatusDropdown]);

  const { data: perfil } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("cargo, nome")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const isAdmin = perfil?.cargo === "admin" || perfil?.cargo === "comercial";

  const { data: listaTecnicos } = useQuery({
    queryKey: ['tecnicos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('cargo', 'tecnico')
        .order('nome');
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["dashboard-visitas", perfil?.cargo, tecnicoFiltro],
    enabled: !!perfil,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let q = supabase
        .from("visitas_tecnicas")
        .select(`
          id, status, data_hora_agendada, endereco, titulo,
          nome_sindico, nome_predio, tecnico_id,
          clientes (nome)
        `)
        .order("data_hora_agendada", { ascending: true });

      if (perfil?.cargo === "tecnico") {
        q = q.eq("tecnico_id", user!.id);
      } else if (isAdmin && tecnicoFiltro !== 'todos') {
        q = q.eq("tecnico_id", tecnicoFiltro);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("visitas-realtime-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas_tecnicas" },
        () => {
          qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
          qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Filtro de período
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const visitasFiltradas = visitas.filter((v: any) => {
    if (!filtroAtivo) return true;
    if (!v.data_hora_agendada) return false;
    const d = new Date(v.data_hora_agendada);
    if (filtroAtivo === 'hoje') return d >= startOfDay && d <= endOfDay;
    if (filtroAtivo === 'semana') return d >= startOfWeek && d <= endOfWeek;
    if (filtroAtivo === 'mes') return d >= startOfMonth && d <= endOfMonth;
    return true;
  });

  const visitasExibidas = statusFiltro === 'todos'
    ? visitasFiltradas
    : visitasFiltradas.filter((v: any) => v.status === statusFiltro);

  const pendentes = visitasExibidas.filter((v: any) => v.status === "pendente");
  const emAndamento = visitasExibidas.filter((v: any) => v.status === "em_andamento");
  const aguardando = visitasExibidas.filter((v: any) => v.status === "aguardando_aprovacao");
  const aprovadas = visitasExibidas.filter((v: any) => v.status === "aprovado");
  const reprovadas = visitasExibidas.filter((v: any) => v.status === "reprovada");

  const metrics = [
    { label: "Pendentes", value: pendentes.length, color: "#FFC000", icon: <Clock size={14} /> },
    { label: "Ag. Aprovação", value: aguardando.length, color: "#FBBF24", icon: <CalendarDays size={14} /> },
    { label: "Aprovadas", value: aprovadas.length, color: "#34D399", icon: <CheckCircle2 size={14} /> },
    { label: "Reprovadas", value: reprovadas.length, color: "#F87171", icon: <XCircle size={14} /> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 22,
            color: "#F0F2F5",
            margin: 0,
          }}
        >
          {saudacao()}{perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}
        </h1>
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            color: "rgba(200,200,200,0.6)",
            margin: "4px 0 0",
          }}
        >
          {perfil?.cargo === "tecnico"
            ? "Aqui estão suas visitas técnicas"
            : "Visão geral das visitas técnicas"}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} style={{ ...GLASS, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ color: m.color, display: "flex", justifyContent: "center" }}>{m.icon}</div>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: 18,
                color: m.color,
                marginTop: 4,
              }}
            >
              {m.value}
            </div>
            <div
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                fontSize: 10,
                color: "rgba(200,200,200,0.55)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>


      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, marginBottom: 16 }}>
        <button
          onClick={() => setFiltroAtivo(filtroAtivo === 'hoje' ? null : 'hoje')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 20,
            border: filtroAtivo === 'hoje' ? '1px solid rgba(255,192,0,0.60)' : '1px solid rgba(255,255,255,0.20)',
            background: filtroAtivo === 'hoje' ? 'rgba(255,192,0,0.12)' : 'rgba(255,255,255,0.06)',
            color: filtroAtivo === 'hoje' ? '#FFC000' : '#FFFFFF',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            boxShadow: filtroAtivo === 'hoje' ? '0 0 10px rgba(255,192,0,0.25)' : '0 0 6px rgba(255,255,255,0.08)',
            transition: 'all 0.2s',
          }}
        >
          <CalendarDays size={14} /> Hoje
        </button>
        <button
          onClick={() => setFiltroAtivo(filtroAtivo === 'semana' ? null : 'semana')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 20,
            border: filtroAtivo === 'semana' ? '1px solid rgba(255,192,0,0.60)' : '1px solid rgba(255,255,255,0.20)',
            background: filtroAtivo === 'semana' ? 'rgba(255,192,0,0.12)' : 'rgba(255,255,255,0.06)',
            color: filtroAtivo === 'semana' ? '#FFC000' : '#FFFFFF',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            boxShadow: filtroAtivo === 'semana' ? '0 0 10px rgba(255,192,0,0.25)' : '0 0 6px rgba(255,255,255,0.08)',
            transition: 'all 0.2s',
          }}
        >
          <CalendarRange size={14} /> Essa semana
        </button>
        <button
          onClick={() => setFiltroAtivo('mes')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 20,
            border: filtroAtivo === 'mes' ? '1px solid rgba(255,192,0,0.60)' : '1px solid rgba(255,255,255,0.20)',
            background: filtroAtivo === 'mes' ? 'rgba(255,192,0,0.12)' : 'rgba(255,255,255,0.06)',
            color: filtroAtivo === 'mes' ? '#FFC000' : '#FFFFFF',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            boxShadow: filtroAtivo === 'mes' ? '0 0 10px rgba(255,192,0,0.25)' : '0 0 6px rgba(255,255,255,0.08)',
            transition: 'all 0.2s',
          }}
        >
          <CalendarCheck size={14} /> Esse mês
        </button>
        {isAdmin && listaTecnicos && listaTecnicos.length > 0 && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <UserRound
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.6)',
                pointerEvents: 'none',
              }}
            />
            <select
              value={tecnicoFiltro}
              onChange={(e) => setTecnicoFiltro(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px', borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.20)',
                background: 'rgba(255,255,255,0.06)',
                color: '#FFFFFF', fontSize: 13, cursor: 'pointer',
                outline: 'none', appearance: 'none', WebkitAppearance: 'none', minWidth: 170,
              }}
            >
              <option value="todos" style={{ background: '#0a0a14' }}>Todos os técnicos</option>
              {listaTecnicos.map((t: any) => (
                <option key={t.id} value={t.id} style={{ background: '#0a0a14' }}>
                  {t.nome ?? t.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filtro de status — full width */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowStatusDropdown((v) => !v); }}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 12,
            border: statusFiltro !== 'todos' ? '1px solid rgba(255,192,0,0.50)' : '1px solid rgba(255,255,255,0.16)',
            background: statusFiltro !== 'todos' ? 'rgba(255,192,0,0.08)' : 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: STATUS_OPCOES.find((o) => o.key === statusFiltro)?.color ?? 'rgba(255,255,255,0.35)',
              }}
            />
            <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 500 }}>
              {STATUS_OPCOES.find((o) => o.key === statusFiltro)?.label ?? 'Filtrar por status'}
            </span>
          </div>
          <ChevronDown
            size={18}
            color="rgba(255,255,255,0.6)"
            style={{ transform: showStatusDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </button>

        {showStatusDropdown && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
              background: 'rgba(10,10,20,0.96)',
              backdropFilter: 'blur(14px) saturate(140%)',
              WebkitBackdropFilter: 'blur(14px) saturate(140%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            {STATUS_OPCOES.map((opt, i) => (
              <button
                key={opt.key}
                onClick={() => { setStatusFiltro(opt.key); setShowStatusDropdown(false); }}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: statusFiltro === opt.key ? 'rgba(255,192,0,0.10)' : 'transparent',
                  border: 'none',
                  borderBottom: i < STATUS_OPCOES.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                <span style={{ color: '#FFFFFF', fontSize: 14, flex: 1 }}>{opt.label}</span>
                {statusFiltro === opt.key && <CheckCircle size={16} color="#FFC000" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ ...GLASS, padding: 24, textAlign: "center", color: "rgba(200,200,200,0.5)" }}>
          Carregando visitas...
        </div>
      ) : visitasExibidas.length === 0 ? (
        <div style={{ ...GLASS, padding: 32, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 13,
              color: "rgba(200,200,200,0.6)",
              margin: 0,
            }}
          >
            {filtroAtivo === 'hoje' ? 'Nenhuma visita hoje' : filtroAtivo === 'semana' ? 'Nenhuma visita esta semana' : 'Nenhuma visita este mês'}
          </p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && <Section title="Pendentes" icon={<CalendarDays size={14} />} items={pendentes} onReagendar={isAdmin ? undefined : irParaReagendar} />}
          {emAndamento.length > 0 && <Section title="Em andamento" icon={<Play size={14} />} items={emAndamento} onReagendar={isAdmin ? undefined : irParaReagendar} />}
          {aguardando.length > 0 && <Section title="Aguardando aprovação" icon={<Hourglass size={14} />} items={aguardando} onReagendar={isAdmin ? undefined : irParaReagendar} />}
          {aprovadas.length > 0 && <Section title="Aprovadas" icon={<CheckCircle2 size={14} />} items={aprovadas.slice(0, 5)} onReagendar={isAdmin ? undefined : irParaReagendar} />}
          {reprovadas.length > 0 && <Section title="Reprovadas" icon={<XCircle size={14} />} items={reprovadas.slice(0, 5)} onReagendar={isAdmin ? undefined : irParaReagendar} />}

        </>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pendente:     { label: "Visita Técnica Pendente", color: "#FFC000",  bg: "rgba(255,192,0,0.12)"   },
  em_andamento: { label: "Em Andamento",            color: "#60A5FA",  bg: "rgba(96,165,250,0.12)"  },
  concluida:    { label: "Aguardando Aprovação",    color: "#FBBF24",  bg: "rgba(251,191,36,0.12)"  },
  aprovada:     { label: "Aprovada",                color: "#34D399",  bg: "rgba(52,211,153,0.12)"  },
  reprovada:    { label: "Reprovada",               color: "#F87171",  bg: "rgba(248,113,113,0.12)" },
};

function VisitaCard({ visita }: { visita: any }) {
  const sInfo = STATUS_LABELS[visita.status] ?? { label: visita.status, color: "#fff", bg: "rgba(255,255,255,0.08)" };
  const nome =
    visita.nome_predio ??
    visita.clientes?.nome ??
    visita.nome_sindico ??
    visita.titulo ??
    "Sem nome";
  return (
    <div
      style={{
        background: "rgba(8,8,12,0.22)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
        padding: "18px 16px",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 15,
            color: "#fff",
            flex: 1,
          }}
        >
          {nome}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: sInfo.bg,
            border: `1px solid ${sInfo.color}40`,
            borderRadius: 20,
            padding: "3px 10px",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 10,
            color: sInfo.color,
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          {sInfo.label}
        </div>
      </div>
      {visita.endereco && (
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.65)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <MapPin size={12} style={{ opacity: 0.75 }} /> {visita.endereco}
        </div>
      )}
      {visita.data_hora_agendada && (
        <div
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 11,
            color: "#FFFFFF",
            marginTop: 6,
            letterSpacing: "0.06em",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <CalendarDays size={12} /> {fmtData(visita.data_hora_agendada)}
        </div>
      )}

    </div>
  );
}

function SwipeableCard({
  visitaId,
  onReagendar,
  children,
}: {
  visitaId: string;
  onReagendar: (id: string) => void;
  children: React.ReactNode;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);

  const ACTION_W = 72;
  const EXECUTE_AT = 140;
  const clamp = (v: number) => Math.min(0, Math.max(-EXECUTE_AT, v));

  const onStart = (clientX: number) => {
    dragging.current = true;
    startX.current = clientX - currentX.current;
  };
  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    const next = clamp(clientX - startX.current);
    currentX.current = next;
    setOffsetX(next);
    if (next <= -EXECUTE_AT) {
      dragging.current = false;
      currentX.current = 0;
      setOffsetX(0);
      onReagendar(visitaId);
    }
  };
  const onEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (currentX.current < -ACTION_W / 2) {
      currentX.current = -ACTION_W;
      setOffsetX(-ACTION_W);
    } else {
      currentX.current = 0;
      setOffsetX(0);
    }
  };

  return (
    <div style={{ position: "relative", marginBottom: 12, borderRadius: 18, overflow: "hidden" }}>
      <div
        onClick={() => onReagendar(visitaId)}
        style={{
          position: "absolute",
          top: 0, right: 0, bottom: 0,
          width: 140,
          background: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          cursor: "pointer",
        }}
      >
        <CalendarDays size={20} color="#0a0a14" />
        <span style={{ fontSize: 11, color: "#0a0a14", fontWeight: 500, letterSpacing: "0.04em" }}>
          Reagendar
        </span>
      </div>
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragging.current ? "none" : "transform 0.25s ease",
          touchAction: "pan-y",
        }}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
      >
        {children}
      </div>
    </div>
  );
}

function Section({ title, icon, items, onReagendar }: { title: string; icon?: React.ReactNode; items: any[]; onReagendar?: (id: string) => void }) {
  return (
    <section>
      <h2
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 400,
          fontSize: 13,
          color: "rgba(255,192,0,0.85)",
          letterSpacing: "0.06em",
          margin: "0 0 10px",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {title}
      </h2>

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((v) => {
          const cardLink = (
            <Link
              to="/visita/$id"
              params={{ id: v.id }}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <VisitaCard visita={v} />
            </Link>
          );
          return (
            <li key={v.id}>
              {onReagendar ? (
                <SwipeableCard visitaId={v.id} onReagendar={onReagendar}>
                  {cardLink}
                </SwipeableCard>
              ) : (
                cardLink
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
