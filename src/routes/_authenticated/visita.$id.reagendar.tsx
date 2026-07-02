import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/visita/$id/reagendar")({
  component: ReagendarPage,
});

function isoParaDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ReagendarPage() {
  const { id } = useParams({ from: "/_authenticated/visita/$id/reagendar" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [novaData, setNovaData] = useState("");

  const { data: visita } = useQuery({
    queryKey: ["visita-reagendar", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitas_tecnicas")
        .select("id, data_hora_agendada, endereco, nome_predio, titulo, clientes(nome)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (visita?.data_hora_agendada) {
      setNovaData(isoParaDatetimeLocal(visita.data_hora_agendada));
    }
  }, [visita]);

  const mutation = useMutation({
    mutationFn: async (dataHora: string) => {
      const valor = dataHora ? new Date(dataHora).toISOString() : null;
      const { error } = await supabase
        .from("visitas_tecnicas")
        .update({
          data_hora_agendada: valor,
          status: "pendente",
          motivo_reprovacao: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["historico-visitas"] });
      toast.success("Visita reagendada com sucesso!");
      navigate({ to: "/dashboard" });
    },
    onError: () => toast.error("Erro ao reagendar. Tente novamente."),
  });

  const handleSalvar = () => {
    if (novaData) {
      const d = new Date(novaData);
      if (isNaN(d.getTime())) {
        toast.error("Data inválida.");
        return;
      }
    }
    mutation.mutate(novaData);
  };

  const nomeCliente: string | undefined =
    visita?.nome_predio ?? visita?.clientes?.nome ?? visita?.titulo ?? undefined;

  const CARD: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: "20px 18px",
    marginBottom: 16,
  };
  const LABEL: React.CSSProperties = {
    fontSize: 11,
    color: "rgba(255,192,0,0.65)",
    fontWeight: 300,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", padding: "0 0 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 20px" }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </button>
        <div>
          <h1 style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 500, margin: 0 }}>
            Agendar / Reagendar
          </h1>
          {nomeCliente && (
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: "2px 0 0" }}>
              {nomeCliente}
            </p>
          )}
        </div>
      </div>

      <div>
        {visita?.data_hora_agendada && (
          <div style={CARD}>
            <span style={LABEL}>Data atual</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#FFFFFF", fontSize: 15 }}>
              <CalendarDays size={16} color="rgba(255,255,255,0.65)" />
              {new Date(visita.data_hora_agendada).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        )}

        <div style={CARD}>
          <span style={LABEL}>Nova data e horário</span>
          <input
            type="datetime-local"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#FFFFFF",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              colorScheme: "dark",
            }}
          />
        </div>

        {visita?.endereco && (
          <div style={CARD}>
            <span style={LABEL}>Endereço</span>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
              {visita.endereco}
            </div>
          </div>
        )}

        <button
          onClick={handleSalvar}
          disabled={mutation.isPending}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(255,192,0,0.55)",
            background: "rgba(255,192,0,0.16)",
            color: "#FFC000",
            fontSize: 15,
            fontWeight: 600,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: mutation.isPending ? 0.7 : 1,
          }}
        >
          {mutation.isPending ? (
            "Salvando..."
          ) : (
            <>
              <Check size={18} />
              Confirmar reagendamento
            </>
          )}
        </button>
      </div>
    </div>
  );
}
