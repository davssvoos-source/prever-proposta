import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, User, Phone, Mail, Edit2, Wrench, Copy, Map, MessageCircle, Play } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [editingContact, setEditingContact] = useState<null | "sindico" | "zelador">(null);
  const [draftNome, setDraftNome] = useState("");
  const [draftTel, setDraftTel] = useState("");
  const [savingContact, setSavingContact] = useState(false);



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
                style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: c.gold, color: "#08090E", cursor: "pointer", fontWeight: 700 }}
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
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(endereco);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10, flex: 1,
                  background: isLight ? "#f0f1f4" : "#191921",
                  border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
                  color: c.text, fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                <Copy size={14} />
                {copied ? "Copiado!" : "Copiar endereço"}
              </button>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(endereco)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10, flex: 1,
                  background: isLight ? "rgba(37,99,235,0.08)" : "rgba(96,165,250,0.10)",
                  border: isLight ? "1px solid rgba(37,99,235,0.18)" : "1px solid rgba(96,165,250,0.22)",
                  color: isLight ? "#1d4ed8" : "#93c5fd",
                  fontSize: 13, fontWeight: 500, textDecoration: "none", cursor: "pointer",
                }}
              >
                <Map size={14} />
                Abrir Maps
              </a>
            </div>
            <iframe
              title="Mapa do local"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`}
              style={{ width: "100%", height: 180, borderRadius: 12, border: "none" }}
              loading="lazy"
            />
          </>
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

      {/* Sindico + Zelador 50/50 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {(["sindico", "zelador"] as const).map((kind) => {
          const nome = kind === "sindico" ? visita?.nome_sindico : visita?.nome_zelador;
          const tel = kind === "sindico" ? visita?.telefone_sindico : visita?.telefone_zelador;
          const isEditing = editingContact === kind;
          return (
            <div
              key={kind}
              style={{
                background: c.bg, border: c.border, borderRadius: 16,
                padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8,
                boxShadow: c.shadow,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...label, marginBottom: 0 }}>{kind === "sindico" ? "SÍNDICO" : "ZELADOR(A)"}</span>
                {!isEditing && (
                  <button
                    onClick={() => {
                      setDraftNome(nome || "");
                      setDraftTel(tel || "");
                      setEditingContact(kind);
                    }}
                    style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: c.gold, display: "flex" }}
                    aria-label="Editar"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>

              {!isEditing && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 500, color: c.text, lineHeight: 1.3 }}>
                    {nome || <span style={{ color: c.muted, fontWeight: 400 }}>Não informado</span>}
                  </span>
                  <a
                    href={tel ? `https://wa.me/55${String(tel).replace(/\D/g, "")}` : undefined}
                    onClick={(e) => { if (!tel) { e.preventDefault(); toast.error("Telefone não informado"); } }}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 10px", borderRadius: 8,
                      background: tel
                        ? (isLight ? "rgba(22,163,74,0.08)" : "rgba(34,197,94,0.10)")
                        : (isLight ? "rgba(0,0,0,0.04)" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)"),
                      border: tel
                        ? (isLight ? "1px solid rgba(22,163,74,0.20)" : "1px solid rgba(34,197,94,0.22)")
                        : (isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)"),
                      color: tel
                        ? (isLight ? "#15803d" : "#4ade80")
                        : c.muted,
                      fontSize: 12, fontWeight: 600, textDecoration: "none", marginTop: 2,
                      alignSelf: "flex-start", cursor: tel ? "pointer" : "not-allowed",
                    }}
                  >
                    <MessageCircle size={13} />
                    WhatsApp
                  </a>
                </>
              )}

              {isEditing && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    type="text"
                    value={draftNome}
                    placeholder="Nome"
                    onChange={(e) => setDraftNome(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: c.border, background: isLight ? "#f0f1f4" : "rgba(255,255,255,0.05)", color: c.text, fontSize: 12 }}
                  />
                  <input
                    type="tel"
                    value={draftTel}
                    placeholder="Telefone"
                    onChange={(e) => setDraftTel(e.target.value)}
                    style={{ padding: 8, borderRadius: 8, border: c.border, background: isLight ? "#f0f1f4" : "rgba(255,255,255,0.05)", color: c.text, fontSize: 12 }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => setEditingContact(null)}
                      style={{ flex: 1, padding: 7, borderRadius: 8, border: c.border, background: "transparent", color: c.sub, cursor: "pointer", fontWeight: 600, fontSize: 12 }}
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={savingContact}
                      onClick={async () => {
                        setSavingContact(true);
                        try {
                          const payload = kind === "sindico"
                            ? { nome_sindico: draftNome || null, telefone_sindico: draftTel || null }
                            : { nome_zelador: draftNome || null, telefone_zelador: draftTel || null };
                          const { error } = await supabase.from("visitas_tecnicas").update(payload).eq("id", id);
                          if (error) throw error;
                          qc.invalidateQueries({ queryKey: ["visita_pendente", id] });
                          toast.success("Atualizado");
                          setEditingContact(null);
                        } catch (e: any) {
                          toast.error(e?.message || "Erro ao salvar");
                        } finally {
                          setSavingContact(false);
                        }
                      }}
                      style={{ flex: 1, padding: 7, borderRadius: 8, border: "none", background: c.gold, color: "#08090E", cursor: "pointer", fontWeight: 700, fontSize: 12 }}
                    >
                      {savingContact ? "..." : "Salvar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>



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

      {/* Iniciar Visita */}
      <div style={{ padding: "24px 0 40px" }}>
        <button
          onClick={async () => {
            setIniciando(true);
            try {
              const { error } = await supabase
                .from("visitas_tecnicas")
                .update({ status: "em_andamento", iniciada_em: new Date().toISOString() })
                .eq("id", id);
              if (error) throw error;
              qc.invalidateQueries({ queryKey: ["visita_pendente", id] });
              qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
              navigate({ to: "/visita/$id/orcamento", params: { id } });
            } catch (err: any) {
              toast.error(err?.message || "Erro ao iniciar visita");
              setIniciando(false);
            }
          }}
          disabled={iniciando}
          style={{
            width: "100%",
            padding: "16px 0",
            borderRadius: 16,
            border: "none",
            cursor: iniciando ? "not-allowed" : "pointer",
            background: iniciando
              ? (isLight ? "#d4a800" : "rgba(255,192,0,0.50)")
              : "linear-gradient(135deg, #FFC000 0%, #FFD700 50%, #FFA500 100%)",
            boxShadow: iniciando ? "none" : "0 4px 20px rgba(255,192,0,0.35)",
            color: "#0a0b0e",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {iniciando ? "Iniciando..." : (<><Play size={18} fill="currentColor" /> Iniciar Visita Técnica</>)}
        </button>
      </div>
    </div>
  );

}
