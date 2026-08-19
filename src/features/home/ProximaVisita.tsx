// O card "A seguir". Vive em componente próprio por um motivo concreto: o
// countdown roda num setInterval de 1 segundo, e enquanto ele morava dentro da
// Home o componente inteiro — banner, filtros, lista e quadro — recalculava
// uma vez por segundo. Isolado, só este card re-renderiza.
//
// Correção de comportamento junto: a versão antiga só considerava visita com
// data FUTURA, então uma visita pendente que passou do horário simplesmente
// desaparecia do card. Agora a atrasada aparece em primeiro lugar, com chip
// vermelho no lugar da contagem regressiva.

import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, MapPin, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { isPendenteBucket } from "@/lib/visita-status";
import type { BrutoVisita } from "@/features/atividades/modelo";

export function proximaVisitaDe(visitas: BrutoVisita[]): (BrutoVisita & { atrasada: boolean }) | null {
  const agora = Date.now();
  const candidatas = visitas
    .filter((v) => v.data_hora_agendada && isPendenteBucket(v.status as any))
    .sort((a, b) =>
      new Date(a.data_hora_agendada as string).getTime() - new Date(b.data_hora_agendada as string).getTime());
  // atrasada primeiro: é a que exige decisão agora
  const atrasada = candidatas.find((v) => new Date(v.data_hora_agendada as string).getTime() <= agora);
  if (atrasada) return { ...atrasada, atrasada: true };
  const futura = candidatas.find((v) => new Date(v.data_hora_agendada as string).getTime() > agora);
  return futura ? { ...futura, atrasada: false } : null;
}

function useContagem(quando: string | null | undefined, ativo: boolean) {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    if (!quando || !ativo) { setTxt(""); return; }
    const atualiza = () => {
      const diff = new Date(quando).getTime() - Date.now();
      if (diff <= 0) { setTxt("Agora"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTxt(h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`);
    };
    atualiza();
    const t = setInterval(atualiza, 1000);
    return () => clearInterval(t);
  }, [quando, ativo]);
  return txt;
}

function useFotoAssinada(url: string | null | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ["foto-fachada-signed", id, url],
    enabled: !!url,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const raw = url as string;
      const m = raw.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
      if (!m) return raw;
      const [, bucket, path] = m;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}

interface Props {
  visita: (BrutoVisita & { atrasada: boolean }) | null;
  onAbrir: () => void;
}

export function ProximaVisita({ visita, onAbrir }: Props) {
  const { isLight } = useTheme();
  const contagem = useContagem(visita?.data_hora_agendada, !!visita && !visita.atrasada);
  const { data: foto } = useFotoAssinada((visita as any)?.foto_fachada_url, visita?.id);

  if (!visita) return null;

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.58)";
  const gold = isLight ? "#b87800" : "#FFC000";
  const vermelho = isLight ? "#b91c1c" : "#F87171";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg, #ffffff 0%, #f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(180,120,0,0.25)" : "1px solid rgba(255,192,0,0.20)",
    borderRadius: 18,
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.06)" : "0 8px 32px rgba(0,0,0,0.35)",
    padding: "18px 16px",
    position: "relative",
    overflow: "hidden",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    display: "block",
  };

  const quando = new Date(visita.data_hora_agendada as string);

  return (
    <button onClick={onAbrir} style={CARD}>
      {foto && (
        <>
          <img
            src={foto} alt=""
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "35%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }}
          />
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: "45%",
            background: isLight
              ? "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0.6) 30%, transparent 100%)"
              : "linear-gradient(to right, #0a0a14 0%, rgba(10,10,20,0.6) 30%, transparent 100%)",
            pointerEvents: "none", zIndex: 1,
          }} />
        </>
      )}

      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.14em",
          textTransform: "uppercase", color: visita.atrasada ? vermelho : gold, marginBottom: 8,
        }}>
          {visita.atrasada ? "Visita atrasada" : "A seguir"}
        </div>

        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 17, color: textPrimary, lineHeight: 1.3 }}>
          {visita.nome_predio ?? visita.titulo ?? visita.clientes?.nome ?? "Visita técnica"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>
            <AlarmClock size={13} color={visita.atrasada ? vermelho : gold} />
            {visita.atrasada
              ? `era ${quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : `${quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${contagem ? ` · em ${contagem}` : ""}`}
          </span>
          {(visita as any).nome_sindico && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>
              <UserRound size={13} /> {(visita as any).nome_sindico}
            </span>
          )}
        </div>

        {(visita as any).endereco && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5, marginTop: 7,
            fontFamily: FONT, fontWeight: 300, fontSize: 12, color: textSecondary,
          }}>
            <MapPin size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(visita as any).endereco}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
