import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, User, Phone, Mail, Edit2, Wrench } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { statusLabel } from "@/lib/visita-route";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id/pendente")({
  component: VisitaPendentePage,
});

function VisitaPendentePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const [editingDate, setEditingDate] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("09:00");

  const { data: visita } = useQuery({
    queryKey: ["visita_pendente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("*, cliente:clientes(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: tecnico } = useQuery({
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

  const updateDate = useMutation({
    mutationFn: async (iso: string | null) => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({ data_hora_agendada: iso })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visita_pendente", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      toast.success("Data atualizada");
      setEditingDate(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const c = isLight
    ? { bg: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)", border: "1px solid rgba(0,0,0,0.07)", shadow: "0 1px 6px rgba(0,0,0,0.07)", text: "#0a0b0e", sub: "#4a5060", muted: "#8a909e", gold: "#b87800", goldBg: "rgba(180,120,0,0.10)" }
    : { bg: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", shadow: "none", text: "#FFFFFF", sub: "rgba(255,255,255,0.65)", muted: "rgba(255,255,255,0.45)", gold: "#FFC000", goldBg: "rgba(255,192,0,0.10)" };

  const sLabel = statusLabel(visita?.status);
  const endereco = [visita?.endereco, visita?.complemento].filter(Boolean).join(" — ");
  const nomeLocal = visita?.nome_predio || visita?.titulo || visita?.cliente?.nome || "—";
  const dataFormatada = visita?.data_hora_agendada
    ? new Date(visita.data_hora_agendada).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })
    : null;

  const card: React.CSSProperties = { background: c.bg, border: c.border, borderRadius: 16, padding: 16, boxShadow: c.shadow };
  const label: React.CSSProperties = { color: c.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: 0, marginBottom: 10, fontFamily: "'Montserrat',sans-serif" };

  function salvar() {
    if (!draftDate) return;
    const iso = new Date(`${draftDate}T${draftTime}:00`).toISOString();
    updateDate.mutate(iso);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          style={{ background: isLight ? "#ffffff" : "transparent", border: c.border, width: 40, height: 40, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: c.shadow }}
        >
          <ArrowLeft size={20} color={c.text} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: c.muted, fontSize: 11, margin: 0, letterSpacing: 1 }}>VISITA TÉCNICA</p>
          <p style={{ color: c.text, fontSize: 17, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeLocal}</p>
        </div>
        <span style={{ background: sLabel.bg, color: sLabel.color, padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>
          {sLabel.label}
        </span>
      </div>

      {/* Data e horário */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Calendar size={16} color={c.gold} />
          <span style={label}>DATA E HORÁRIO</span>
        </div>
        {!editingDate && dataFormatada && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ color: c.text, fontSize: 14, textTransform: "capitalize" }}>{dataFormatada}</span>
            <button
              onClick={() => {
                const d = visita?.data_hora_agendada ? new Date(visita.data_hora_agendada) : new Date();
                setDraftDate(d.toISOString().split("T")[0]);
                setDraftTime(d.toTimeString().slice(0, 5));
                setEditingDate(true);
              }}
              style={{ background: "none", border: "none", color: c.gold, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}
            >
              <Edit2 size={13} /> Editar
            </button>
          </div>
        )}
        {!editingDate && !dataFormatada && (
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setDraftDate(d.toISOString().split("T")[0]);
              setDraftTime("09:00");
              setEditingDate(true);
            }}
            style={{ width: "100%", padding: "12px", background: c.goldBg, border: `1px dashed ${c.gold}`, borderRadius: 10, color: c.gold, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + Agendar data e horário
          </button>
        )}
        {editingDate && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                style={{ flex: 2, padding: 10, borderRadius: 8, border: c.border, background: isLight ? "#f0f1f4" : "rgba(255,255,255,0.05)", color: c.text }}
              />
              <input
                type="time"
                value={draftTime}
                onChange={(e) => setDraftTime(e.target.value)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: c.border, background: isLight ? "#f0f1f4" : "rgba(255,255,255,0.05)", color: c.text }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setEditingDate(false)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: c.border, background: "transparent", color: c.sub, cursor: "pointer", fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={!draftDate || updateDate.isPending}
                style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: c.gold, color: "#fff", cursor: "pointer", fontWeight: 700 }}
              >
                {updateDate.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Local + mapa */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <MapPin size={16} color={c.gold} />
          <span style={label}>LOCAL</span>
        </div>
        <p style={{ color: c.text, fontSize: 14, margin: 0, marginBottom: 12 }}>{endereco || "—"}</p>
        {endereco && (
          <iframe
            title="Mapa do local"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`}
            style={{ width: "100%", height: 180, borderRadius: 12, border: "none" }}
            loading="lazy"
          />
        )}
      </div>

      {/* Cliente */}
      {(visita?.cliente?.nome || visita?.cliente?.email || visita?.cliente?.telefone) && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <User size={16} color={c.gold} />
            <span style={label}>CLIENTE</span>
          </div>
          {visita?.cliente?.nome && <p style={{ color: c.text, fontSize: 14, margin: 0, marginBottom: 6 }}>{visita.cliente.nome}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: c.sub, fontSize: 12 }}>
            {visita?.cliente?.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {visita.cliente.email}</span>}
            {visita?.cliente?.telefone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {visita.cliente.telefone}</span>}
          </div>
        </div>
      )}

      {/* Sindico */}
      {visita?.nome_sindico && (
        <div style={card}>
          <span style={label}>SÍNDICO</span>
          <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{visita.nome_sindico}</p>
        </div>
      )}

      {/* Zelador */}
      {visita?.nome_zelador && (
        <div style={card}>
          <span style={label}>ZELADOR(A)</span>
          <p style={{ color: c.text, fontSize: 14, margin: 0 }}>{visita.nome_zelador}</p>
        </div>
      )}

      {/* Técnico */}
      {tecnico?.nome && (
        <div style={card}>
          <span style={label}>TÉCNICO RESPONSÁVEL</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.goldBg, color: c.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {tecnico.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ color: c.text, fontSize: 14, margin: 0, fontWeight: 600 }}>{tecnico.nome}</p>
              {tecnico.cargo && <p style={{ color: c.muted, fontSize: 11, margin: 0 }}>{tecnico.cargo}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Serviços */}
      {visita?.servicos_propostos && visita.servicos_propostos.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Wrench size={16} color={c.gold} />
            <span style={label}>SERVIÇOS PROPOSTOS</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {visita.servicos_propostos.map((s: string) => (
              <span key={s} style={{ background: c.goldBg, color: c.gold, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Observações */}
      {visita?.obs_agendamento && (
        <div style={card}>
          <span style={label}>OBSERVAÇÕES</span>
          <p style={{ color: c.text, fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{visita.obs_agendamento}</p>
        </div>
      )}
    </div>
  );
}
