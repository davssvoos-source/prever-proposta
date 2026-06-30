import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, ChevronLeft, MapPin, Check, Camera, Square, CheckSquare, Building2, Home, Factory, Camera as CameraIcon, Lock, Phone, Bell, Zap, Eye, DoorOpen, Wrench, Settings, Video, Shield, Satellite } from "lucide-react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SERVICOS_PROPOSTOS } from "@/features/visitas/servicosPropostos";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

export const Route = createFileRoute("/_authenticated/gerencial/nova")({
  component: NovaVisitaPage,
});

const L = {
  card: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
  cardSolid: "#ffffff",
  border: "1px solid rgba(0,0,0,0.07)",
  borderMd: "1px solid rgba(0,0,0,0.10)",
  shadow: "0 1px 6px rgba(0,0,0,0.07)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.05)",
  text: "#0a0b0e",
  textSub: "#4a5060",
  textMuted: "#8a909e",
  gold: "#b87800",
  goldBg: "rgba(180,120,0,0.10)",
  goldBorder: "1px solid rgba(180,120,0,0.22)",
  inputBg: "#f0f1f4",
  inputBorder: "1px solid rgba(0,0,0,0.10)",
};


const TIPOS_LOCAL: { id: string; label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: "condominio_vertical", label: "Cond. Vertical", Icon: Building2 },
  { id: "condominio_horizontal", label: "Cond. Horizontal", Icon: Home },
  { id: "empresa", label: "Empresa", Icon: Factory },
  { id: "residencia", label: "Residência", Icon: (props) => <Home {...props} strokeWidth={1.5} /> },
];

const SERVICO_PROPOSTO_ICON: Record<string, ComponentType<{ size?: number }>> = {
  portaria_remota: Building2,
  monitoramento_alarmes: Eye,
  implantacao_controle_acesso: Lock,
  implantacao_cftv: CameraIcon,
  implantacao_alarmes: Bell,
  manutencao_alarmes: Wrench,
  manutencao_controle_acesso: Settings,
  manutencao_cftv: Video,
  portaria_virtual_24h: Shield,
  cftv_cameras: CameraIcon,
  controle_acesso: Lock,
  interfone_ip: Phone,
  alarme_sensores: Bell,
  cerca_eletrica: Zap,
  monitoramento_remoto: Satellite,
  automacao_portoes: DoorOpen,
};

const PRIORIDADES = [
  { id: "baixa", label: "Baixa", color: "#9CA3AF" },
  { id: "normal", label: "Normal", color: "#60A5FA" },
  { id: "alta", label: "Alta", color: "#FFC000" },
  { id: "urgente", label: "Urgente", color: "#F87171" },
];


function NovaVisitaPage() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  const [nomePredio, setNomePredio] = useState("");
  const [tipoLocal, setTipoLocal] = useState("");

  const [nomeSindico, setNomeSindico] = useState("");
  const [contato, setContato] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [servicosPropostos, setServicosPropostos] = useState<string[]>([]);
  const [endereco, setEndereco] = useState("");

  const [complemento, setComplemento] = useState("");
  const [obsAgendamento, setObsAgendamento] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");

  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [tecnicoId, setTecnicoId] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [descricao, setDescricao] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Dynamic styles
  const GLASS: CSSProperties = isLight
    ? {
        background: L.card,
        border: L.border,
        borderRadius: 18,
        boxShadow: L.shadow,
      }
    : {
        background: "rgba(8, 8, 12, 0.18)",
        backdropFilter: "blur(10px) saturate(120%)",
        WebkitBackdropFilter: "blur(10px) saturate(120%)",
        border: "1px solid rgba(255, 192, 0, 0.20)",
        borderRadius: 18,
        boxShadow: "0 0 0 1px rgba(255,192,0,0.06) inset, 0 8px 32px rgba(0,0,0,0.35)",
      };

  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,192,0,0.65)",
    marginBottom: 8,
    display: "block",
  };

  const INPUT: CSSProperties = {
    width: "100%",
    background: isLight ? L.inputBg : "rgba(8,8,12,0.25)",
    border: isLight ? L.inputBorder : "1px solid rgba(255,192,0,0.16)",
    borderRadius: 10,
    color: isLight ? L.text : "#F0F2F5",
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: 300,
    fontSize: 14,
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: visitasTecnico = [] } = useQuery({
    queryKey: ["visitas-tecnico", tecnicoId],
    queryFn: async () => {
      if (!tecnicoId) return [];
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 1);
      const fim = new Date();
      fim.setDate(fim.getDate() + 7);
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("data_hora_agendada, titulo, nome_predio")
        .eq("tecnico_id", tecnicoId)
        .eq("status", "pendente")
        .gte("data_hora_agendada", inicio.toISOString())
        .lte("data_hora_agendada", fim.toISOString())
        .order("data_hora_agendada");
      return data ?? [];
    },
    enabled: !!tecnicoId,
  });

  const geocodificar = async () => {
    if (!endereco.trim()) return;
    setGeoStatus("loading");
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        endereco + ", São Paulo, Brasil",
      )}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
      const json = await res.json();
      if (json[0]) {
        setLat(parseFloat(json[0].lat));
        setLng(parseFloat(json[0].lon));
        setGeoStatus("ok");
      } else {
        setGeoStatus("err");
      }
    } catch {
      setGeoStatus("err");
    }
  };

  const passo1Valido =
    nomePredio.trim() !== "" &&
    tipoLocal !== "" &&
    nomeSindico.trim() !== "" &&
    contato.trim() !== "" &&
    servicosPropostos.length > 0 &&
    servicosPropostos.length > 0 &&
    endereco.trim() !== "";
  const passo2Valido = true;

  const criarMutation = useMutation({
    mutationFn: async () => {
      const dataHoraAgendada = data && hora ? new Date(`${data}T${hora}:00`).toISOString() : null;
      const { data: { user } } = await supabase.auth.getUser();

      const { data: clienteRow, error: clienteErr } = await supabase
        .from("clientes")
        .insert({
          nome: nomeSindico,
          email: clienteEmail || null,
          telefone: contato,
          owner_id: user?.id as string,
        })
        .select("id")
        .single();
      if (clienteErr) throw clienteErr;

      let foto_fachada_url: string | null = null;
      if (fotoFile) {
        const ext = fotoFile.name.split(".").pop() || "jpg";
        const path = `visitas/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("visita-fotos")
          .upload(path, fotoFile, { upsert: true });
        if (upErr) {
          toast.error("Erro ao enviar foto: " + upErr.message);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("visita-fotos")
            .getPublicUrl(path);
          foto_fachada_url = publicUrl;
        }
      }

      const payload = {
        cliente_id: clienteRow.id,
        titulo: nomePredio,
        nome_predio: nomePredio,
        tipo_local: tipoLocal,
        nome_sindico: nomeSindico,
        contato_sindico: contato,
        servicos_solicitados: servicos,
        servicos_propostos: servicosPropostos,
        servico_solicitado: servicos[0] ?? null,
        endereco,
        complemento: complemento || null,
        obs_agendamento: obsAgendamento || null,
        descricao_pedido: descricao || null,
        data_hora_agendada: dataHoraAgendada,
        tecnico_id: tecnicoId || null,
        prioridade,
        status: "pendente",
        latitude: lat,
        longitude: lng,
        foto_fachada_url,
        created_by: user?.id ?? null,
      };
      const { error } = await supabase.from("visitas_tecnicas").insert(payload as any);
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      toast.success("Visita agendada com sucesso!");
      navigate({ to: "/gerencial" });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const mapUrl =
    lat && lng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.008}%2C${lng + 0.008}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;

  return (
    <div style={{ paddingBottom: 140 }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => (step === 1 ? navigate({ to: "/gerencial" }) : setStep(1))}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isLight ? L.textSub : "rgba(200,200,200,0.7)",
            padding: 4,
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              fontSize: 18,
              color: isLight ? L.text : "#F0F2F5",
              margin: 0,
            }}
          >
            Nova Visita Técnica
          </h1>
        </div>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12, color: isLight ? L.gold : "rgba(255,192,0,0.7)" }}>
          {step}/2
        </span>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
        {[{ n: 1, label: "Local e Cliente" }, { n: 2, label: "Agendamento" }].map((s, i) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 6, flex: i === 0 ? "0 1 auto" : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: step >= s.n
                    ? "linear-gradient(135deg, #FFD700, #FFC000)"
                    : isLight
                      ? "#f0f1f4"
                      : "rgba(255,192,0,0.08)",
                  border: step >= s.n
                    ? "none"
                    : isLight
                      ? "1px solid rgba(0,0,0,0.12)"
                      : "1px solid rgba(255,192,0,0.20)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: step >= s.n ? "#000" : isLight ? L.textSub : "rgba(200,200,200,0.4)",
                  flexShrink: 0,
                }}
              >
                {step > s.n ? <Check size={12} /> : s.n}
              </div>
              <span
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 300,
                  fontSize: 11,
                  color: step >= s.n
                    ? isLight ? L.gold : "#FFC000"
                    : isLight ? L.textSub : "rgba(200,200,200,0.4)",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < 1 && (
              <div style={{
                flex: 1,
                height: 1,
                background: step > 1
                  ? isLight ? "rgba(180,120,0,0.4)" : "rgba(255,192,0,0.4)"
                  : isLight ? "rgba(0,0,0,0.08)" : "rgba(255,192,0,0.12)",
              }} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Nome do Prédio / Empresa</label>
            <input style={INPUT} placeholder="Ex: Edifício Garden Hills" value={nomePredio} onChange={(e) => setNomePredio(e.target.value)} />
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Tipo de Local</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {TIPOS_LOCAL.map((t) => {
                const ativo = tipoLocal === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTipoLocal(t.id)}
                    style={{
                      background: ativo
                        ? isLight ? "rgba(180,120,0,0.08)" : "rgba(255,192,0,0.12)"
                        : isLight ? L.cardSolid : "rgba(8,8,12,0.20)",
                      border: ativo
                        ? isLight ? "2px solid #b87800" : "1.5px solid rgba(255,192,0,0.55)"
                        : isLight ? L.borderMd : "1px solid rgba(255,192,0,0.12)",
                      borderRadius: 12,
                      padding: "16px 8px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: ativo ? (isLight ? "none" : "0 0 16px rgba(255,192,0,0.18)") : "none",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: ativo ? (isLight ? L.gold : "#FFC000") : (isLight ? L.textSub : "rgba(200,200,200,0.65)") }}>
                      <t.Icon size={26} />
                    </span>
                    <span
                      style={{
                        fontFamily: "'Montserrat', sans-serif",
                        fontSize: 10,
                        fontWeight: 300,
                        color: ativo
                          ? isLight ? L.gold : "#FFC000"
                          : isLight ? L.textSub : "rgba(200,200,200,0.65)",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...GLASS, padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LABEL}>Nome do Cliente</label>
              <input style={INPUT} value={nomeSindico} onChange={(e) => setNomeSindico(e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>WhatsApp</label>
              <input style={INPUT} value={contato} onChange={(e) => setContato(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={LABEL}>E-mail do Cliente</label>
              <input style={INPUT} type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} placeholder="cliente@email.com" />
            </div>
          </div>




          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Serviços Propostos (selecione um ou mais)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SERVICOS_PROPOSTOS.map((s) => {
                const ativo = servicosPropostos.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() =>
                      setServicosPropostos((prev) =>
                        prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key],
                      )
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: ativo
                        ? isLight ? L.goldBg : "rgba(255,192,0,0.12)"
                        : isLight ? L.cardSolid : "rgba(8,8,12,0.20)",
                      border: ativo
                        ? isLight ? L.goldBorder : "1.5px solid rgba(255,192,0,0.55)"
                        : isLight ? L.borderMd : "1px solid rgba(255,192,0,0.14)",
                      borderRadius: 999,
                      padding: "7px 12px",
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 11,
                      fontWeight: 300,
                      color: ativo
                        ? isLight ? L.gold : "#FFC000"
                        : isLight ? L.textSub : "rgba(255,255,255,0.70)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>{ativo ? <CheckSquare size={12} /> : <Square size={12} />}</span>
                    {(() => {
                      const Ico = SERVICO_PROPOSTO_ICON[s.key];
                      return Ico ? (
                        <span style={{ display: "inline-flex", alignItems: "center", color: isLight ? L.gold : "#FFC000" }}>
                          <Ico size={14} />
                        </span>
                      ) : null;
                    })()}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Endereço</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...INPUT, flex: 1 }}
                placeholder="Rua, número, bairro"
                value={endereco}
                onChange={(e) => {
                  setEndereco(e.target.value);
                  setLat(null);
                  setLng(null);
                  setGeoStatus("idle");
                }}
                onBlur={geocodificar}
              />
              <button
                onClick={geocodificar}
                style={{
                  background: isLight ? L.cardSolid : "rgba(255,192,0,0.10)",
                  border: isLight ? L.borderMd : "1px solid rgba(255,192,0,0.30)",
                  borderRadius: 10,
                  width: 44,
                  cursor: "pointer",
                  color: isLight ? L.gold : "#FFC000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MapPin size={16} />
              </button>
            </div>
            {geoStatus === "loading" && (
              <p style={{ marginTop: 8, fontSize: 11, color: isLight ? L.textMuted : "rgba(200,200,200,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>
                Buscando localização...
              </p>
            )}
            {geoStatus === "err" && (
              <p style={{ marginTop: 8, fontSize: 11, color: "#F87171", fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>
                Endereço não encontrado.
              </p>
            )}
            {mapUrl && (
              <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: isLight ? L.border : "1px solid rgba(255,192,0,0.16)" }}>
                <iframe title="mapa" src={mapUrl} style={{ width: "100%", height: 160, border: 0 }} />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label style={LABEL}>Complemento</label>
              <input style={INPUT} placeholder="Apto, andar, bloco..." value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Observações para o Técnico</label>
            <textarea
              style={{ ...INPUT, minHeight: 80, resize: "vertical" }}
              placeholder="Informações adicionais, acesso ao local..."
              value={obsAgendamento}
              onChange={(e) => setObsAgendamento(e.target.value)}
            />
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Foto da Fachada (opcional)</label>
            <div
              onClick={() => document.getElementById("foto-fachada-input")?.click()}
              style={{
                width: "100%",
                minHeight: fotoPreview ? "auto" : 90,
                borderRadius: 14,
                border: isLight ? "2px dashed rgba(180,120,0,0.30)" : "2px dashed rgba(255,192,0,0.30)",
                background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {fotoPreview ? (
                <>
                  <img
                    src={fotoPreview}
                    alt="preview"
                    style={{ width: "100%", borderRadius: 12, display: "block" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: isLight ? "rgba(255,255,255,0.85)" : "rgba(8,8,12,0.7)",
                      borderRadius: 20,
                      padding: "4px 10px",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 11,
                      color: isLight ? L.gold : "#FFC000",
                    }}
                  >
                    Alterar foto
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 8px" }}>
                  <div style={{ marginBottom: 4, display: "flex", justifyContent: "center" }}>
                    <Camera size={24} color={isLight ? L.gold : "rgba(255,192,0,0.65)"} />
                  </div>
                  <div
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 300,
                      fontSize: 12,
                      color: isLight ? L.textMuted : "rgba(255,255,255,0.45)",
                    }}
                  >
                    Toque para adicionar foto da fachada
                  </div>
                </div>
              )}
            </div>
            <input
              id="foto-fachada-input"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFotoFile(file);
                setFotoPreview(URL.createObjectURL(file));
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Data e Horário (opcional)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="date"
                style={{ ...INPUT, flex: 2 }}
                value={data}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setData(e.target.value)}
              />
              <input type="time" style={{ ...INPUT, flex: 1 }} value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {[
                { label: "Amanhã 09:00", days: 1, time: "09:00" },
                { label: "Amanhã 14:00", days: 1, time: "14:00" },
                { label: "Em 2 dias 09:00", days: 2, time: "09:00" },
                { label: "Próx. Semana", days: 7, time: "09:00" },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + a.days);
                    setData(d.toISOString().split("T")[0]);
                    setHora(a.time);
                  }}
                  style={{
                    background: isLight ? L.goldBg : "rgba(255,192,0,0.06)",
                    border: isLight ? L.goldBorder : "1px solid rgba(255,192,0,0.18)",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: 10,
                    fontWeight: 300,
                    color: isLight ? L.gold : "rgba(255,192,0,0.75)",
                    cursor: "pointer",
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Técnico Responsável</label>
            <select
              style={{ ...INPUT, appearance: "none" }}
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
            >
              <option value="">— Sem técnico definido —</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.cargo})
                </option>
              ))}
            </select>

            {tecnicoId && visitasTecnico.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 300, color: isLight ? L.gold : "rgba(255,192,0,0.6)", letterSpacing: "0.10em", textTransform: "uppercase", margin: "0 0 6px" }}>
                  Agenda dos próximos 7 dias
                </p>
                {visitasTecnico.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 0",
                      borderBottom: i < visitasTecnico.length - 1
                        ? isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,192,0,0.08)"
                        : "none",
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: isLight ? L.gold : "#FFC000", flexShrink: 0, boxShadow: isLight ? "none" : "0 0 6px rgba(255,192,0,0.5)" }} />
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 300, color: isLight ? L.textSub : "rgba(200,200,200,0.6)" }}>
                      {new Date(v.data_hora_agendada).toLocaleString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" — "}
                      {(v as any).nome_predio ?? v.titulo}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {tecnicoId && visitasTecnico.length === 0 && (
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 300, color: "rgba(52,211,153,0.7)", margin: "8px 0 0" }}>
                Técnico livre nos próximos 7 dias
              </p>
            )}
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Prioridade</label>
            <div style={{ display: "flex", gap: 8 }}>
              {PRIORIDADES.map((p) => {
                const ativo = prioridade === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPrioridade(p.id)}
                    style={{
                      flex: 1,
                      background: ativo
                        ? `${p.color}18`
                        : isLight ? L.cardSolid : "rgba(8,8,12,0.20)",
                      border: ativo
                        ? `1.5px solid ${p.color}55`
                        : isLight ? L.borderMd : "1px solid rgba(255,192,0,0.10)",
                      borderRadius: 10,
                      padding: "10px 4px",
                      cursor: "pointer",
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: 10,
                      fontWeight: ativo ? 500 : 300,
                      color: ativo ? p.color : isLight ? L.textSub : "rgba(200,200,200,0.5)",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...GLASS, padding: 16 }}>
            <label style={LABEL}>Descrição do Pedido</label>
            <textarea
              style={{ ...INPUT, minHeight: 90, resize: "vertical" }}
              placeholder="Descreva o que o cliente precisa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div style={{
            ...GLASS,
            padding: 16,
            borderColor: isLight ? "rgba(52,211,153,0.20)" : "rgba(52,211,153,0.25)",
            background: isLight ? "rgba(52,211,153,0.05)" : "rgba(52,211,153,0.04)",
          }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 300, color: "rgba(52,211,153,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 10px" }}>
              Resumo da visita
            </p>
            {[
              { label: "Prédio", value: nomePredio },
              { label: "Tipo", value: TIPOS_LOCAL.find((t) => t.id === tipoLocal)?.label ?? tipoLocal },
              { label: "Síndico", value: nomeSindico },
              { label: "Serviços", value: servicosPropostos.map((k) => SERVICOS_PROPOSTOS.find((s) => s.key === k)?.label).filter(Boolean).join(", ") },
              { label: "Endereço", value: endereco + (complemento ? ` — ${complemento}` : "") },
              {
                label: "Data/Hora",
                value: data ? `${new Date(data + "T12:00:00").toLocaleDateString("pt-BR")} às ${hora}` : "—",
              },
              { label: "Técnico", value: tecnicos.find((t) => t.id === tecnicoId)?.nome ?? "Não definido" },
              { label: "Prioridade", value: PRIORIDADES.find((p) => p.id === prioridade)?.label },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: isLight ? "1px solid rgba(0,0,0,0.05)" : "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 300, color: isLight ? L.textMuted : "rgba(200,200,200,0.45)" }}>{row.label}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 400, color: isLight ? L.text : "#F0F2F5", textAlign: "right", maxWidth: "60%" }}>{row.value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rodapé fixo */}
      <div
        style={{
          position: "fixed",
          bottom: 72,
          left: 0,
          right: 0,
          padding: "12px 16px",
          background: isLight ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.7)",
          backdropFilter: isLight ? "none" : "blur(20px)",
          borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,192,0,0.10)",
          display: "flex",
          gap: 10,
          zIndex: 30,
        }}
      >
        {step === 2 && (
          <button
            onClick={() => setStep(1)}
            style={{
              height: 50,
              width: 50,
              flexShrink: 0,
              background: isLight ? L.cardSolid : "rgba(255,192,0,0.06)",
              border: isLight ? L.borderMd : "1px solid rgba(255,192,0,0.20)",
              borderRadius: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isLight ? L.gold : "#FFC000",
            }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <button
          onClick={() => {
            if (step === 1) {
              if (!passo1Valido) {
                toast.error("Preencha todos os campos obrigatórios");
                return;
              }
              setStep(2);
            } else {
              if (!passo2Valido) {
                toast.error("Informe a data e o horário");
                return;
              }
              criarMutation.mutate();
            }
          }}
          disabled={criarMutation.isPending}
          style={{
            flex: 1,
            height: 50,
            background: isLight ? L.gold : "linear-gradient(135deg, #FFD700 0%, #FFC000 50%, #FF9F00 100%)",
            color: "#ffffff",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 500,
            fontSize: 13,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            border: "none",
            borderRadius: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: isLight ? "0 4px 14px rgba(180,120,0,0.30)" : "0 4px 18px rgba(255,192,0,0.38)",
            opacity: criarMutation.isPending ? 0.7 : 1,
          }}
        >
          {criarMutation.isPending ? (
            "Agendando..."
          ) : step === 1 ? (
            <>
              Próximo <ChevronRight size={16} />
            </>
          ) : (
            <>
              Agendar Visita <Check size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
