import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
});

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function CalendarioPage() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59);

  const { data: visitas = [] } = useQuery({
    queryKey: ["visitas-calendario", ano, mes],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("id, titulo, data_hora_agendada, status")
        .gte("data_hora_agendada", inicioMes.toISOString())
        .lte("data_hora_agendada", fimMes.toISOString());
      return data ?? [];
    },
  });

  const visitasPorDia = useMemo(() => {
    return visitas.reduce((acc: Record<string, any[]>, v: any) => {
      const date = v.data_hora_agendada.substring(0, 10);
      if (!acc[date]) acc[date] = [];
      acc[date].push(v);
      return acc;
    }, {} as Record<string, any[]>);
  }, [visitas]);

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const cellsTotal = Math.ceil((primeiroDiaSemana + diasNoMes) / 7) * 7;

  function prevMes() {
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else setMes((m) => m - 1);
  }
  function nextMes() {
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else setMes((m) => m + 1);
  }

  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <button
          onClick={prevMes}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 600,
              fontSize: 20,
              color: "#fff",
            }}
          >
            {MESES[mes]}
          </div>
          <div
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.10em",
            }}
          >
            {ano}
          </div>
        </div>
        <button
          onClick={nextMes}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#fff",
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div
        style={{
          background: "rgba(255,192,0,0.06)",
          border: "1px solid rgba(255,192,0,0.18)",
          borderRadius: 14,
          padding: "10px 16px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Total de visitas no mês
        </span>
        <span
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
            fontSize: 20,
            color: "#FFC000",
          }}
        >
          {visitas.length}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: 4,
        }}
      >
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 300,
              fontSize: 10,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {Array.from({ length: cellsTotal }).map((_, idx) => {
          const dayNum = idx - primeiroDiaSemana + 1;
          const isValidDay = dayNum >= 1 && dayNum <= diasNoMes;
          const dateStr = isValidDay
            ? `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
            : null;
          const visitasNoDia = dateStr ? visitasPorDia[dateStr] ?? [] : [];
          const temVisitas = visitasNoDia.length > 0;
          const isHoje = dateStr === hojeStr;

          if (!isValidDay) {
            return <div key={idx} style={{ aspectRatio: "1", borderRadius: 12 }} />;
          }

          return (
            <div
              key={idx}
              onClick={() => temVisitas && navigate({ to: "/dashboard" })}
              style={{
                aspectRatio: "1",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: temVisitas ? "pointer" : "default",
                transition: "transform 0.15s",
                ...(temVisitas
                  ? {
                      background: "linear-gradient(135deg, #FFD700, #FFC000, #FF9F00)",
                      boxShadow: "0 4px 20px rgba(255,192,0,0.45)",
                    }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      backdropFilter: "blur(8px)",
                      border: isHoje
                        ? "1.5px solid rgba(255,192,0,0.6)"
                        : "1px solid rgba(255,255,255,0.07)",
                    }),
              }}
            >
              {temVisitas ? (
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 800,
                    fontSize: 22,
                    color: "#08090E",
                    lineHeight: 1,
                    userSelect: "none",
                  }}
                >
                  {visitasNoDia.length}
                </span>
              ) : (
                <span
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: isHoje ? 600 : 300,
                    fontSize: 18,
                    color: isHoje ? "#FFC000" : "rgba(255,255,255,0.55)",
                    lineHeight: 1,
                    userSelect: "none",
                  }}
                >
                  {dayNum}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20 }}>
        <Legenda swatch="linear-gradient(135deg,#FFD700,#FF9F00)" label="Nº de visitas no dia" />
        <Legenda
          swatch="rgba(255,255,255,0.04)"
          border="1px solid rgba(255,192,0,0.5)"
          label="Hoje"
        />
        <Legenda
          swatch="rgba(255,255,255,0.04)"
          border="1px solid rgba(255,255,255,0.07)"
          label="Sem visitas"
        />
      </div>
    </div>
  );
}

function Legenda({ swatch, border, label }: { swatch: string; border?: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 12, height: 12, borderRadius: 4, background: swatch, border }} />
      <span
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 300,
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
