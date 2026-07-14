import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, Layers, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { BlocoItensEditor } from "@/features/orcamento/BlocoItensEditor";
import { reconcileGuaritaProjeto } from "@/features/orcamento/guarita";

export const Route = createFileRoute("/_authenticated/visita/$id/orcamento/pre-envio")({
  component: PreEnvioPage,
});

const SERVICOS_LABELS: Record<string, string> = {
  controle_acesso: "Controle de Acesso",
  cftv: "CFTV",
  alarme: "Alarme",
  cerca_eletrica: "Cerca Elétrica",
  portaria_remota: "Portaria Remota",
  automacao: "Automação",
  interfonia: "Interfonia",
  fechaduras: "Fechaduras",
};

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

// Tipos que existem no máximo 1 por projeto — sem numeração
const TIPOS_UNICOS = new Set(["CENT"]);

function PreEnvioPage() {
  const { id: visitaId } = Route.useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from;
  const { isLight } = useTheme();
  const qc = useQueryClient();

  // Ao abrir o resumo, garante que a guarita do projeto está reconciliada
  // (soma dos receptores de todos os blocos). Roda uma vez por visita.
  const guaritaReconciledRef = useRef<string | null>(null);
  useEffect(() => {
    if (guaritaReconciledRef.current === visitaId) return;
    guaritaReconciledRef.current = visitaId;
    reconcileGuaritaProjeto(visitaId).then(() => {
      qc.invalidateQueries({ queryKey: ["visita_bloco_itens"] });
      qc.invalidateQueries({ queryKey: ["visita_blocos_completo", visitaId] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitaId]);

  const { data: visita } = useQuery({
    queryKey: ["visita_pre_envio", visitaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("*, cliente:clientes(*)")
        .eq("id", visitaId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: blocos = [] } = useQuery({
    queryKey: ["visita_blocos_completo", visitaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("*")
        .eq("visita_id", visitaId)
        .order("ordem");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: fotosSignadas = {} } = useQuery({
    queryKey: ["visita_blocos_fotos_urls", visitaId, blocos.length],
    enabled: blocos.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        blocos.flatMap((b: any) =>
          ((b.fotos_urls as string[]) || []).map(async (path) => {
            if (!path) return;
            if (path.startsWith("http")) {
              map[path] = path;
              return;
            }
            const { data } = await supabase.storage
              .from("blocos-fotos")
              .createSignedUrl(path, 3600);
            if (data?.signedUrl) map[path] = data.signedUrl;
          }),
        ),
      );
      return map;
    },
  });

  const [fotoBanner, setFotoBanner] = useState<string | null>(null);
  const fileBannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visita?.foto_fachada_url && !fotoBanner) {
      setFotoBanner(visita.foto_fachada_url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visita?.foto_fachada_url]);

  function handleFotoBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFotoBanner(reader.result as string);
    };
    reader.readAsDataURL(file);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `fachadas/${visitaId}.${ext}`;
    supabase.storage
      .from("blocos-fotos")
      .upload(path, file, { upsert: true, contentType: file.type })
      .then(({ error }) => {
        if (!error) {
          const { data } = supabase.storage.from("blocos-fotos").getPublicUrl(path);
          supabase
            .from("visitas_tecnicas")
            .update({ foto_fachada_url: data.publicUrl })
            .eq("id", visitaId);
        }
      });

    e.target.value = "";
  }

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({
          status: "aguardando_aprovacao",
          status_aprovacao: "aguardando_aprovacao",
          data_hora_fim: new Date().toISOString(),
        } as any)
        .eq("id", visitaId);
      if (error) throw error;

      // Notifica admins (fila de aprovação — mesma tela/fluxo)
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("cargo", "admin")
        .eq("ativo", true);
      const local = visita?.nome_predio || visita?.titulo || visita?.cliente?.nome || "local não informado";
      if (admins && admins.length > 0) {
        await supabase.from("notificacoes").insert(
          admins.map((a: any) => ({
            user_id: a.id,
            tipo: "visita_aguardando_aprovacao",
            titulo: "Visita aguardando aprovação",
            corpo: `A visita técnica em ${local} foi concluída e aguarda sua aprovação.`,
            visita_id: visitaId,
            lida: false,
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Visita enviada para aprovação!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao concluir"),
  });


  const dataInicio = visita?.iniciada_em || visita?.data_hora_inicio || visita?.data_hora_agendada;
  const dataFmt = dataInicio
    ? format(new Date(dataInicio), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : "—";

  const endereco =
    [visita?.endereco, visita?.complemento].filter(Boolean).join(" - ") || "—";

  const nomeLocal =
    visita?.nome_local ||
    visita?.nome_condominio ||
    visita?.titulo ||
    visita?.nome ||
    visita?.cliente?.nome ||
    visita?.cliente?.nome_completo ||
    visita?.cliente?.razao_social ||
    "—";

  const servicos: string[] = visita?.servicos_propostos || [];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <input
        ref={fileBannerRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFotoBanner}
      />

      {/* ── BANNER ─────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {fotoBanner ? (
          /* Com foto */
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "25vh",
              minHeight: 140,
              maxHeight: 210,
              overflow: "hidden",
            }}
          >
            <img
              src={fotoBanner}
              alt="Fachada"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            {/* Overlay degradê */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.70) 100%)",
                pointerEvents: "none",
              }}
            />
            {/* Botão voltar sobreposto */}
            <button
              onClick={() => {
                if (from) navigate({ to: from });
                else window.history.back();
              }}
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                width: 34,
                height: 34,
                background: isLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "none",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: isLight ? undefined : "blur(6px)",
                WebkitBackdropFilter: isLight ? undefined : "blur(6px)",
                boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
              }}
            >
              <ArrowLeft size={18} color={isLight ? "#0a0b0e" : "#FFFFFF"} />
            </button>
            {/* Nome do local na borda inferior */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "12px 20px 16px",
                textAlign: "center",
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
              }}
            >
              <p
                style={{
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                  textShadow: "0 2px 10px rgba(0,0,0,0.9)",
                }}
              >
                {nomeLocal}
              </p>
            </div>
          </div>
        ) : (
          /* Sem foto — header padrão */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 16px",
              borderBottom: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <button
              onClick={() => {
                if (from) navigate({ to: from });
                else window.history.back();
              }}
              style={{
                background: isLight ? "#ffffff" : "none",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "none",
                borderRadius: isLight ? 12 : undefined,
                width: isLight ? 40 : undefined,
                height: isLight ? 40 : undefined,
                cursor: "pointer",
                padding: isLight ? undefined : 4,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : undefined,
              }}
            >
              <ArrowLeft size={24} color={isLight ? "#0a0b0e" : "#FFFFFF"} />
            </button>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: isLight ? "#4a5060" : "#9CA3AF", fontSize: 12, margin: 0 }}>Revisão da visita</p>
              <p
                style={{
                  color: isLight ? "#0a0b0e" : "#FFFFFF",
                  fontSize: 17,
                  fontWeight: 600,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {nomeLocal}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CONTEÚDO SCROLLÁVEL */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: fotoBanner ? "20px 16px 48px" : "16px 16px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <SectionCard icon={<MapPin size={16} color={isLight ? "#b87800" : "#FFC000"} />} titulo="LOCAL" isLight={isLight}>
          <div style={{ color: isLight ? "#0a0b0e" : "#fff", fontSize: 14, fontFamily: "'Montserrat',sans-serif" }}>
            {endereco}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
              gap: 8,
            }}
          >
            <p
              style={{
                color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)",
                fontSize: 12,
                margin: 0,
                fontFamily: "'Montserrat',sans-serif",
              }}
            >
              {nomeLocal}
            </p>
            <button
              onClick={() => fileBannerRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: isLight ? "1.5px solid rgba(0,0,0,0.20)" : "1.5px solid #4B5563",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: isLight ? "#4a5060" : "#9CA3AF", fontSize: 14, lineHeight: 1 }}>+</span>
              </div>
              <span
                style={{
                  color: isLight ? "#4a5060" : "#9CA3AF",
                  fontSize: 11,
                  fontFamily: "'Montserrat',sans-serif",
                }}
              >
                {fotoBanner ? "Trocar foto da fachada" : "Adicionar foto da fachada"}
              </span>
            </button>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Calendar size={16} color={isLight ? "#b87800" : "#FFC000"} />}
          titulo="DATA E HORÁRIO DA VISITA"
          isLight={isLight}
        >
          <div style={{ color: isLight ? "#0a0b0e" : "#fff", fontSize: 14, fontFamily: "'Montserrat',sans-serif" }}>
            {dataFmt}
          </div>
        </SectionCard>

        <SectionCard
          icon={<CheckCircle2 size={16} color={isLight ? "#b87800" : "#FFC000"} />}
          titulo="SERVIÇOS PROPOSTOS"
          isLight={isLight}
        >
          {servicos.length === 0 ? (
            <div style={{ color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)", fontSize: 13 }}>
              Nenhum serviço selecionado
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {servicos.map((s) => (
                <span
                  key={s}
                  style={{
                    background: isLight ? "rgba(180,120,0,0.10)" : "rgba(255,192,0,0.10)",
                    border: isLight ? "1px solid rgba(180,120,0,0.22)" : "1px solid rgba(255,192,0,0.35)",
                    color: isLight ? "#b87800" : "#FFD700",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'Montserrat',sans-serif",
                  }}
                >
                  {SERVICOS_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={<Layers size={16} color={isLight ? "#b87800" : "#FFC000"} />} titulo="ESCOPO DO PROJETO" isLight={isLight}>
          {blocos.length === 0 ? (
            <div style={{ color: isLight ? "#4a5060" : "rgba(255,255,255,0.45)", fontSize: 13 }}>
              Nenhum bloco adicionado
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(() => {
                const counters: Record<string, number> = {};
                return blocos.map((bloco: any, idx: number) => {
                  const tipo = bloco.tipo_bloco;
                  counters[tipo] = (counters[tipo] || 0) + 1;
                  const base = TIPOS_NOMES[tipo] || tipo;
                  // Nome dado pelo usuário na montagem do bloco (PED/VEI) tem prioridade
                  const nomeUsuario = (bloco.nome_acesso as string | null)?.trim();
                  const label = nomeUsuario
                    ? nomeUsuario
                    : TIPOS_UNICOS.has(tipo)
                    ? base
                    : `${base} ${String(counters[tipo]).padStart(2, "0")}`;
                  return (
                    <div key={bloco.id}>
                      {idx > 0 && (
                        <div
                          style={{
                            height: 1,
                            background: isLight ? "rgba(0,0,0,0.08)" : "#191921",
                            marginBottom: 8,
                          }}
                        />
                      )}
                      <div
                        style={{
                          color: isLight ? "#b87800" : "#FFC000",
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: 0.6,
                          fontFamily: "'Montserrat',sans-serif",
                          textTransform: "uppercase",
                          marginBottom: 6,
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
                        hideSubtotal
                        hideConcluir
                      />
                      {bloco.fotos_urls && bloco.fotos_urls.length > 0 && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: 6,
                            marginTop: 12,
                          }}
                        >
                          {(bloco.fotos_urls as string[]).map((url, fi) => (
                            <div
                              key={fi}
                              style={{
                                aspectRatio: "1 / 1",
                                borderRadius: 8,
                                overflow: "hidden",
                                background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
                                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              {fotosSignadas[url] && (
                                <img
                                  src={fotosSignadas[url]}
                                  alt=""
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </SectionCard>

        {/* BOTÃO CONCLUIR — padrão ouro (verde) */}
        <div style={{ padding: "24px 0 48px" }}>
          <button
            onClick={() => enviarMutation.mutate()}
            disabled={enviarMutation.isPending}
            style={{
              width: "100%",
              height: 56,
              borderRadius: 14,
              border: 0,
              cursor: enviarMutation.isPending ? "not-allowed" : "pointer",
              color: "#FFFFFF",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background:
                "linear-gradient(135deg,#34D399 0%,#10B981 40%,#059669 100%)",
              boxShadow:
                "0 4px 20px rgba(16,185,129,0.45), inset 0 0 0 1px rgba(110,231,183,0.35), inset 0 1px 0 rgba(255,255,255,0.20)",
              textShadow: "0 1px 3px rgba(0,0,0,0.35)",
              opacity: enviarMutation.isPending ? 0.75 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {enviarMutation.isPending ? "ENVIANDO..." : "CONCLUIR VISITA"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  titulo,
  children,
  isLight,
}: {
  icon: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
  isLight: boolean;
}) {
  return (
    <div
      style={
        isLight
          ? {
              background: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)",
              border: "1px solid rgba(0,0,0,0.07)",
              borderRadius: 16,
              padding: "16px",
              marginBottom: 12,
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
            }
          : {
              background: "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "16px",
              marginBottom: 12,
            }
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {icon}
        <span
          style={{
            color: isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            fontFamily: "'Montserrat',sans-serif",
          }}
        >
          {titulo}
        </span>
      </div>
      {children}
    </div>
  );
}
