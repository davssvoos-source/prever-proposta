import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, XCircle, MapPin, CalendarRange, CalendarCheck, UserRound, ChevronDown, CheckCircle, AlarmClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import bannerAsset from "@/assets/banner-home.jpg.asset.json";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const GLASS_DARK: React.CSSProperties = {
  background: "rgba(8, 8, 12, 0.18)",
  backdropFilter: "blur(10px) saturate(120%)",
  WebkitBackdropFilter: "blur(10px) saturate(120%)",
  border: "1px solid rgba(255, 192, 0, 0.20)",
  borderRadius: 18,
  boxShadow: "0 0 0 1px rgba(255,192,0,0.06) inset, 0 8px 32px rgba(0,0,0,0.35)",
};

const GLASS_LIGHT: React.CSSProperties = {
  background: "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 18,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
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
  const { isLight } = useTheme();
  const GLASS = isLight ? GLASS_LIGHT : GLASS_DARK;
  const [filtroAtivo, setFiltroAtivo] = useState<'hoje' | 'semana' | 'mes' | null>(null);
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!showStatusDropdown) return;
    const handler = (e: Event) => {
      if (statusDropdownRef.current && statusDropdownRef.current.contains(e.target as Node)) return;
      setShowStatusDropdown(false);
    };
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
    { label: "Ag. Aprovação", value: aguardando.length, color: "#3B82F6", icon: <CalendarDays size={14} /> },
    { label: "Aprovadas", value: aprovadas.length, color: "#34D399", icon: <CheckCircle2 size={14} /> },
    { label: "Reprovadas", value: reprovadas.length, color: "#F87171", icon: <XCircle size={14} /> },
  ];

  // ─── Banner data ──────────────────────────────────────────
  const visitasHoje = visitas.filter((v: any) => {
    if (!v.data_hora_agendada) return false;
    const d = new Date(v.data_hora_agendada);
    return d >= startOfDay && d <= endOfDay;
  });

  const agoraMs = Date.now();
  const proximaVisita = visitas
    .filter((v: any) => v.data_hora_agendada && new Date(v.data_hora_agendada).getTime() > agoraMs)
    .sort((a: any, b: any) => new Date(a.data_hora_agendada).getTime() - new Date(b.data_hora_agendada).getTime())[0];

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!proximaVisita?.data_hora_agendada) return;
    const update = () => {
      const diff = new Date(proximaVisita.data_hora_agendada).getTime() - Date.now();
      if (diff <= 0) { setCountdown("Agora"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setCountdown(`${h}h ${m.toString().padStart(2, '0')}m`);
      else setCountdown(`${m}m ${s.toString().padStart(2, '0')}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proximaVisita]);

  return (
    <>
      {/* ═══ BANNER FROTA ═══ */}
      <div
        style={{
          marginTop: -76,
          marginLeft: -16,
          marginRight: -16,
          position: 'relative',
          height: '28vh',
          minHeight: 180,
          overflow: 'hidden',
        }}
      >
        <img
          src={isLight ? '/banner-home-light.jpg' : bannerAsset.url}
          alt="Frota Prever"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 60%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isLight
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(244,245,247,0.9) 100%)'
              : 'linear-gradient(to bottom, rgba(8,8,12,0.30) 0%, rgba(8,8,12,0.45) 60%, rgba(8,8,12,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Fade inferior — transição suave para o fundo da página */}
        {!isLight && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40%',
              background:
                'linear-gradient(to bottom, rgba(8,9,14,0) 0%, rgba(8,9,14,0.7) 55%, rgb(8,9,14) 100%)',
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
          }}
        >
          <h2
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
              fontSize: 18,
              color: isLight ? '#0a0b0e' : '#FFFFFF',
              margin: 0,
              textShadow: isLight ? 'none' : '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            Você tem {visitasHoje.length} {visitasHoje.length === 1 ? 'visita' : 'visitas'} hoje{perfil?.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}
          </h2>
        </div>
      </div>


      <div className="space-y-5" style={{ paddingTop: 20 }}>
        {/* ═══ CARD PRÓXIMA VISITA ═══ */}
        {proximaVisita && (
          <Link
            to="/visita/$id"
            params={{ id: proximaVisita.id }}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div
              style={{
                ...GLASS,
                ...(isLight ? { border: '1px solid rgba(180,120,0,0.25)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' } : {}),
                padding: '20px 18px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {!isLight && (
                <div
                  style={{
                    position: 'absolute',
                    top: -30,
                    right: -30,
                    width: 100,
                    height: 100,
                    background: 'radial-gradient(circle, rgba(255,192,0,0.20), transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: isLight ? '#b87800' : 'rgba(255,192,0,0.7)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Próxima visita
              </div>
              <div
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 600,
                  fontSize: 16,
                  color: isLight ? '#0a0b0e' : '#FFFFFF',
                  marginBottom: 6,
                }}
              >
                {proximaVisita.nome_predio ?? proximaVisita.clientes?.nome ?? proximaVisita.nome_sindico ?? proximaVisita.titulo ?? 'Sem nome'}
              </div>
              {proximaVisita.endereco && (
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 12,
                    color: isLight ? '#4a5060' : 'rgba(255,255,255,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginBottom: 4,
                  }}
                >
                  <MapPin size={12} style={{ opacity: 0.75 }} /> {proximaVisita.endereco}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 300,
                    fontSize: 12,
                    color: isLight ? '#0a0b0e' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <CalendarDays size={12} /> {fmtData(proximaVisita.data_hora_agendada)}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: isLight ? 'rgba(180,120,0,0.10)' : 'rgba(255,192,0,0.12)',
                    border: isLight ? '1px solid rgba(180,120,0,0.30)' : '1px solid rgba(255,192,0,0.30)',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: 11,
                    color: isLight ? '#b87800' : '#FFC000',
                  }}
                >
                  <AlarmClock size={11} /> {countdown}
                </div>
              </div>
            </div>

          </Link>
        )}

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
                color: isLight ? "#4a5060" : "rgba(200,200,200,0.55)",
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, marginBottom: 8 }}>
        {isAdmin && listaTecnicos && listaTecnicos.length > 0 && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <UserRound
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: isLight ? '#4a5060' : 'rgba(255,255,255,0.6)',
                pointerEvents: 'none',
              }}
            />
            <select
              value={tecnicoFiltro}
              onChange={(e) => setTecnicoFiltro(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px', borderRadius: 20,
                border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.20)',
                background: isLight ? '#ffffff' : 'rgba(255,255,255,0.06)',
                color: isLight ? '#0a0b0e' : '#FFFFFF', fontSize: 13, cursor: 'pointer',
                outline: 'none', appearance: 'none', WebkitAppearance: 'none', minWidth: 170,
                boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <option value="todos" style={{ background: isLight ? '#fff' : '#0a0a14', color: isLight ? '#0a0b0e' : '#fff' }}>Todos os técnicos</option>
              {listaTecnicos.map((t: any) => (
                <option key={t.id} value={t.id} style={{ background: isLight ? '#fff' : '#0a0a14', color: isLight ? '#0a0b0e' : '#fff' }}>
                  {t.nome ?? t.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div style={{
        display: 'flex',
        gap: 8,
        paddingLeft: 16,
        paddingRight: 16,
        marginBottom: 8,
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {(['hoje','semana','mes'] as const).map((key) => {
          const active = filtroAtivo === key;
          const Icon = key === 'hoje' ? CalendarDays : key === 'semana' ? CalendarRange : CalendarCheck;
          const label = key === 'hoje' ? 'Hoje' : key === 'semana' ? 'Essa semana' : 'Esse mês';
          return (
            <button
              key={key}
              onClick={() => setFiltroAtivo(active ? null : key)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                paddingTop: 8, paddingBottom: 8, paddingLeft: 4, paddingRight: 4, borderRadius: 20,
                border: active
                  ? (isLight ? '1px solid #b87800' : '1px solid rgba(255,192,0,0.60)')
                  : (isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.20)'),
                background: active
                  ? (isLight ? '#b87800' : 'rgba(255,192,0,0.12)')
                  : (isLight ? '#ffffff' : 'rgba(255,255,255,0.06)'),
                color: active
                  ? (isLight ? '#ffffff' : '#FFC000')
                  : (isLight ? '#0a0b0e' : '#FFFFFF'),
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: active
                  ? (isLight ? '0 2px 8px rgba(184,120,0,0.25)' : '0 0 10px rgba(255,192,0,0.25)')
                  : (isLight ? '0 1px 3px rgba(0,0,0,0.05)' : '0 0 6px rgba(255,255,255,0.08)'),
                transition: 'all 0.2s',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>



      {/* Filtro de status — full width */}
      <div ref={statusDropdownRef} style={{ position: 'relative', marginTop: 16, marginBottom: 16 }}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowStatusDropdown((v) => !v); }}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 24,
            border: statusFiltro !== 'todos'
              ? (isLight ? '1px solid rgba(180,120,0,0.50)' : '1px solid rgba(255,192,0,0.50)')
              : (isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.16)'),
            background: statusFiltro !== 'todos'
              ? (isLight ? 'rgba(180,120,0,0.08)' : 'rgba(255,192,0,0.08)')
              : (isLight ? '#ffffff' : 'rgba(255,255,255,0.04)'),
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
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
            <span style={{ color: isLight ? '#0a0b0e' : '#FFFFFF', fontSize: 14, fontWeight: 500 }}>
              {STATUS_OPCOES.find((o) => o.key === statusFiltro)?.label ?? 'Filtrar por status'}
            </span>
          </div>
          <ChevronDown
            size={18}
            color={isLight ? '#4a5060' : 'rgba(255,255,255,0.6)'}
            style={{ transform: showStatusDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </button>

        {showStatusDropdown && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
              background: isLight ? '#ffffff' : 'rgba(10,10,20,0.96)',
              backdropFilter: isLight ? 'none' : 'blur(14px) saturate(140%)',
              WebkitBackdropFilter: isLight ? 'none' : 'blur(14px) saturate(140%)',
              border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: isLight ? '0 10px 30px rgba(0,0,0,0.12)' : '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            {STATUS_OPCOES.map((opt, i) => (
              <button
                key={opt.key}
                onClick={() => { setStatusFiltro(opt.key); setShowStatusDropdown(false); }}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: statusFiltro === opt.key
                    ? (isLight ? 'rgba(180,120,0,0.10)' : 'rgba(255,192,0,0.10)')
                    : 'transparent',
                  border: 'none',
                  borderBottom: i < STATUS_OPCOES.length - 1
                    ? (isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.07)')
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                <span style={{ color: isLight ? '#0a0b0e' : '#FFFFFF', fontSize: 14, flex: 1 }}>{opt.label}</span>
                {statusFiltro === opt.key && <CheckCircle size={16} color={isLight ? '#b87800' : '#FFC000'} />}
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
            {filtroAtivo === 'hoje' ? 'Nenhuma visita hoje' : filtroAtivo === 'semana' ? 'Nenhuma visita esta semana' : filtroAtivo === 'mes' ? 'Nenhuma visita este mês' : 'Nenhuma visita encontrada'}
          </p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && <Section items={pendentes} />}
          {emAndamento.length > 0 && <Section items={emAndamento} />}
          {aguardando.length > 0 && <Section items={aguardando} />}
          {aprovadas.length > 0 && <Section items={aprovadas.slice(0, 5)} />}
          {reprovadas.length > 0 && <Section items={reprovadas.slice(0, 5)} />}

        </>
      )}
      </div>
    </>
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



function Section({ items }: { items: any[] }) {
  return (
    <section>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((v) => (
          <li key={v.id}>
            <Link
              to="/visita/$id"
              params={{ id: v.id }}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <VisitaCard visita={v} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
