// AGENDAR pelo quadro (R225, U119): soltar um card na coluna "Agendado" pede
// o dia — um card não entra em "Agendado" sem data, porque a coluna É a data.
//
// Davi, 08/09/2026: "toda atividade deve poder ser agendada (…) crie uma nova
// coluna no Kanban chamada 'Agendado' (…) uma atividade agendada, não deve ter
// prazo." O mesmo diálogo serve para REagendar (o card já agendado, arrastado
// de volta para a mesma coluna, ou pelo botão do Configurador) — o banco conta
// a remarcação (gatilho contar_reagendamento) e o card diz "Re-agendado Nx".

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, goldButton } from "@/lib/ui";
import { cinzas } from "@/lib/paleta";
import { rotuloReagendado, type Atividade } from "@/features/atividades/modelo";

/** O dia (aaaa-mm-dd, fuso local) que o campo de data mostra para uma atividade. */
export function diaInicial(a: Atividade | null, hoje: Date = new Date()): string {
  const base = a?.agendadaEm ? new Date(a.agendadaEm) : hoje;
  const d = Number.isNaN(base.getTime()) ? hoje : base;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function AgendarDialog({ atividade, aoFechar, aoConfirmar, salvando }: {
  atividade: Atividade | null;
  aoFechar: () => void;
  aoConfirmar: (dia: string) => void;
  salvando: boolean;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const [dia, setDia] = useState(() => diaInicial(atividade));
  useEffect(() => { setDia(diaInicial(atividade)); }, [atividade?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const remarcando = !!atividade?.agendada;
  const rotulo = rotuloReagendado(atividade?.reagendamentos);

  return (
    <Dialog open={!!atividade} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent style={{ maxWidth: 420, fontFamily: FONT, color: c.texto, background: c.superficie, border: `1px solid ${c.divisoria}` }}>
        <DialogTitle style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarClock size={18} /> {remarcando ? "Reagendar atividade" : "Agendar atividade"}
        </DialogTitle>
        <DialogDescription style={{ fontFamily: FONT, fontSize: 13, color: c.textoSecundario, lineHeight: 1.5 }}>
          <strong style={{ color: c.texto, fontWeight: 600 }}>{atividade?.titulo}</strong>
          {rotulo ? ` · ${rotulo}` : ""}
          <br />
          Uma atividade agendada não tem prazo: o que vale é o dia marcado. Ela fica na coluna
          "Agendado" até alguém começá-la, e quem está nela recebe o aviso às 08h do dia.
        </DialogDescription>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: c.textoSecundario }}>
          Dia
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            style={{
              height: 44, borderRadius: 12, padding: "0 12px", fontFamily: FONT, fontSize: 14, fontWeight: 400,
              background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto, outline: "none",
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={aoFechar}
            style={{
              height: 40, padding: "0 14px", borderRadius: 12, cursor: "pointer",
              background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!dia || salvando}
            onClick={() => { if (dia) aoConfirmar(dia); }}
            style={{ ...goldButton(), boxShadow: "none", height: 40, padding: "0 16px", borderRadius: 12, fontSize: 13, opacity: !dia || salvando ? 0.6 : 1 }}
          >
            {salvando ? "Gravando…" : remarcando ? "Reagendar" : "Agendar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
