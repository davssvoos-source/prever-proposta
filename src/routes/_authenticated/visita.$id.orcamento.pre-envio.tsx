import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Calendar, Layers, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  PED: "Acesso de Pedestres",
  VEI: "Acesso de Veículos",
  CFTV: "CFTV",
  AL: "Alarme",
  CER: "Cerca Elétrica",
  CENT: "Central",
};

function PreEnvioPage() {
  const { id: visitaId } = Route.useParams();
  const navigate = useNavigate();

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

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({ status_aprovacao: "aguardando_aprovacao" } as any)
        .eq("id", visitaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento enviado para aprovação!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar"),
  });

  const dataInicio = visita?.iniciada_em || visita?.data_hora_inicio || visita?.data_hora_agendada;
  const dataFmt = dataInicio
    ? format(new Date(dataInicio), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    : "—";

  const endereco =
    [visita?.endereco, visita?.complemento].filter(Boolean).join(" - ") || "—";

  const servicos: string[] = visita?.servicos_propostos || [];

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 14px" }}>
        <button
          onClick={() =>
            navigate({ to: "/visita/$id/orcamento/categorias", params: { id: visitaId } })
          }
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 400,
              fontSize: 18,
              color: "#fff",
            }}
          >
            Orçamento
          </div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 11,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
            }}
          >
            Revisão antes do envio
          </div>
        </div>
      </div>

      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        <SectionCard icon={<MapPin size={16} color="#FFC000" />} titulo="LOCAL">
          <div style={{ color: "#fff", fontSize: 14, fontFamily: "'Montserrat',sans-serif" }}>
            {endereco}
          </div>
          {visita?.cliente?.nome && (
            <div
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 12,
                marginTop: 6,
                fontFamily: "'Montserrat',sans-serif",
              }}
            >
              {visita.cliente.nome}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<Calendar size={16} color="#FFC000" />}
          titulo="DATA E HORÁRIO DA VISITA"
        >
          <div style={{ color: "#fff", fontSize: 14, fontFamily: "'Montserrat',sans-serif" }}>
            {dataFmt}
          </div>
        </SectionCard>

        <SectionCard
          icon={<CheckCircle2 size={16} color="#FFC000" />}
          titulo="SERVIÇOS PROPOSTOS"
        >
          {servicos.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
              Nenhum serviço selecionado
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {servicos.map((s) => (
                <span
                  key={s}
                  style={{
                    background: "rgba(255,192,0,0.10)",
                    border: "1px solid rgba(255,192,0,0.35)",
                    color: "#FFD700",
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

        <SectionCard icon={<Layers size={16} color="#FFC000" />} titulo="ESCOPO DO PROJETO">
          {blocos.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
              Nenhum bloco adicionado
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {blocos.map((bloco: any, idx: number) => (
                <div key={bloco.id}>
                  {idx > 0 && (
                    <div
                      style={{
                        height: 1,
                        background: "rgba(255,255,255,0.08)",
                        marginBottom: 16,
                      }}
                    />
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        color: "#FFC000",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        fontFamily: "'Montserrat',sans-serif",
                      }}
                    >
                      {TIPOS_NOMES[bloco.tipo_bloco] || bloco.tipo_bloco}
                    </span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 11,
                        fontFamily: "'Montserrat',sans-serif",
                      }}
                    >
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 500,
                      marginBottom: 6,
                      fontFamily: "'Montserrat',sans-serif",
                    }}
                  >
                    {bloco.nome_descritivo}
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.55)",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      letterSpacing: 0.4,
                      marginBottom: 10,
                    }}
                  >
                    {bloco.codigo_bloco}
                  </div>
                  {bloco.fotos_urls && bloco.fotos_urls.length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 6,
                      }}
                    >
                      {(bloco.fotos_urls as string[]).map((url, fi) => (
                        <div
                          key={fi}
                          style={{
                            aspectRatio: "1 / 1",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
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
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Footer fixo */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "14px 14px 22px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0))",
          backdropFilter: "blur(10px)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => enviarMutation.mutate()}
          disabled={enviarMutation.isPending}
          style={{
            width: "100%",
            padding: "18px 0",
            background: enviarMutation.isPending ? "#166534" : "#16a34a",
            border: "none",
            borderRadius: 16,
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 800,
            cursor: enviarMutation.isPending ? "not-allowed" : "pointer",
            letterSpacing: 0.5,
            fontFamily: "'Montserrat',sans-serif",
            boxShadow: enviarMutation.isPending
              ? "none"
              : "0 0 24px rgba(34,197,94,0.35), 0 4px 16px rgba(34,197,94,0.2)",
            transition: "box-shadow 0.2s, background 0.2s",
          }}
        >
          {enviarMutation.isPending ? "ENVIANDO..." : "ENVIAR PARA APROVAÇÃO"}
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  titulo,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(8,8,12,0.22)",
        backdropFilter: "blur(12px) saturate(130%)",
        border: "1px solid rgba(255,192,0,0.10)",
        borderRadius: 18,
        padding: "16px 16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        {icon}
        <span
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 11,
            fontWeight: 700,
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
