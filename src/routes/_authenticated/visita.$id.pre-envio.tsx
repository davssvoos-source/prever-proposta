import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { statusLabel } from "@/lib/visita-route";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id/pre-envio")({
  component: PreEnvioRapidoPage,
});

function PreEnvioRapidoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();

  const { data: visita } = useQuery({
    queryKey: ["visita_pre_envio_rapido", id],
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

  const { data: blocos = [] } = useQuery({
    queryKey: ["visita_blocos_resumo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visita_blocos" as any)
        .select("id, nome_descritivo, tipo_bloco, codigo_bloco")
        .eq("visita_id", id)
        .order("ordem");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({ status: "aguardando_aprovacao", status_aprovacao: "aguardando_aprovacao" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      toast.success("Visita enviada para aprovação!");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar"),
  });

  const c = isLight
    ? { bg: "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)", border: "1px solid rgba(0,0,0,0.07)", shadow: "0 1px 6px rgba(0,0,0,0.07)", text: "#0a0b0e", sub: "#4a5060", muted: "#8a909e", gold: "#b87800", goldBg: "rgba(180,120,0,0.10)" }
    : { bg: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", shadow: "none", text: "#FFFFFF", sub: "rgba(255,255,255,0.65)", muted: "rgba(255,255,255,0.45)", gold: "#FFC000", goldBg: "rgba(255,192,0,0.10)" };

  const sLabel = statusLabel(visita?.status);
  const nomeLocal = visita?.nome_predio || visita?.titulo || visita?.cliente?.nome || "—";

  const card: React.CSSProperties = { background: c.bg, border: c.border, borderRadius: 16, padding: 16, boxShadow: c.shadow };
  const label: React.CSSProperties = { color: c.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: 0, marginBottom: 10, fontFamily: "'Montserrat',sans-serif" };

  return (
    <div style={{ minHeight: "100vh", padding: "16px 16px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/visita/$id/orcamento/blocos/$cat", params: { id, cat: "controle_acesso" } })}
          style={{ background: isLight ? "#ffffff" : "transparent", border: c.border, width: 40, height: 40, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: c.shadow }}
        >
          <ArrowLeft size={20} color={c.text} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: c.muted, fontSize: 11, margin: 0, letterSpacing: 1 }}>VISITA EM ANDAMENTO</p>
          <p style={{ color: c.text, fontSize: 17, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeLocal}</p>
        </div>
        <span style={{ background: sLabel.bg, color: sLabel.color, padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
          {sLabel.label}
        </span>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Layers size={16} color={c.gold} />
          <span style={label}>RESUMO DO ORÇAMENTO</span>
        </div>
        {blocos.length === 0 ? (
          <p style={{ color: c.muted, fontSize: 13, margin: 0 }}>Nenhum bloco adicionado ainda.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {blocos.map((b: any, i: number) => (
              <li key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingBottom: 8, borderBottom: i < blocos.length - 1 ? `1px solid ${isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}` : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: c.text, fontSize: 13, margin: 0, fontWeight: 600 }}>{b.nome_descritivo}</p>
                  <p style={{ color: c.muted, fontSize: 11, margin: 0 }}>{b.tipo_bloco} · {b.codigo_bloco}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={() => navigate({ to: "/visita/$id/orcamento/blocos/$cat", params: { id, cat: "controle_acesso" } })}
        style={{ padding: "14px 0", background: "transparent", border: c.border, borderRadius: 14, color: c.text, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
      >
        Continuar editando →
      </button>

      <button
        onClick={() => enviar.mutate()}
        disabled={enviar.isPending}
        style={{ padding: "16px 0", background: c.gold, border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: enviar.isPending ? "not-allowed" : "pointer", letterSpacing: 0.5, boxShadow: isLight ? `0 6px 18px rgba(180,120,0,0.25)` : "0 0 24px rgba(255,192,0,0.25)" }}
      >
        {enviar.isPending ? "ENVIANDO..." : "ENVIAR PARA APROVAÇÃO"}
      </button>
    </div>
  );
}
