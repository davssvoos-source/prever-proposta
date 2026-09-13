// A FAIXA DA VIATURA na Início do técnico (R266/R273) — só enquanto ele está com
// um carro. É o mesmo desenho da faixa do sobreaviso: um card com a borda na
// cor da marca, sem brilho. Quando a chegada por localização diz "chegou", a
// faixa vira a sugestão ("Você chegou a X? Encerrar") — e quem encerra é a
// pessoa, na tela da etiqueta, que abre por um toque.
//
// Sem viagem aberta a faixa não existe; fica só um atalho discreto para a
// lista de viaturas — a etiqueta é atalho, não exigência (R266).

import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { PRISMA, cinzas, misturar } from "@/lib/paleta";
import type { Atividade } from "@/features/atividades/modelo";
import type { Sessao } from "@/features/home/data";
import { useClientes } from "@/features/clientes/data";
import { useLocaisDeReferencia, useViagensAbertas, useViaturas } from "./data";
import { destinosDoDia, formatarKm } from "./modelo";
import { useChegadaPorLocalizacao } from "./useChegada";

export function FaixaDaViatura({ sessao, atividadesDeHoje }: { sessao: Sessao; atividadesDeHoje: readonly Atividade[] }) {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const cz = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const textPrimary = isLight ? "#212121" : "#FFFFFF";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";

  const { data: viaturas = [] } = useViaturas();
  const { data: abertas = [] } = useViagensAbertas();
  const minha = abertas.find((v) => v.tecnico_id === sessao.userId) ?? null;
  const viatura = minha ? viaturas.find((x) => x.id === minha.viatura_id) ?? null : null;

  // R274: os destinos são TODAS as atividades de hoje dele, mais a sede
  const { data: clientes = [] } = useClientes();
  const { data: referencias = [] } = useLocaisDeReferencia();
  const sede = referencias.find((r) => r.codigo === "sede") ?? null;
  const destinos = useMemo(() => destinosDoDia(atividadesDeHoje, clientes as any, sede), [atividadesDeHoje, clientes, sede]);
  const chegada = useChegadaPorLocalizacao(!!minha, destinos);

  // a sugestão avisa UMA vez por destino — não a cada leitura do GPS
  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (!chegada.chegou) { avisado.current = null; return; }
    if (avisado.current === chegada.chegou.id) return;
    avisado.current = chegada.chegou.id;
    toast.message(`Você chegou a ${chegada.chegou.nome}?`, { description: "Toque na faixa da viatura para encerrar a viagem." });
  }, [chegada.chegou]);

  // sem cadastro de viaturas (ou sem a migration) a faixa e o atalho não existem
  if (viaturas.length === 0) return null;

  if (!minha || !viatura) {
    return (
      <button
        onClick={() => navigate({ to: "/viatura" })}
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: "2px 0", color: textSecondary, fontFamily: FONT, fontSize: 12.5, cursor: "pointer" }}
      >
        <Car size={15} color={gold} /> Registrar viatura sem etiqueta
      </button>
    );
  }

  const hora = new Date(minha.saida_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const chegou = chegada.chegou;
  return (
    <button
      onClick={() => navigate({ to: "/viatura/$codigo", params: { codigo: viatura.codigo } })}
      aria-label={chegou ? `Você chegou a ${chegou.nome} — encerrar a viagem` : `Você está com a ${viatura.apelido} — encerrar a viagem`}
      style={{
        ...card(isLight), padding: "12px 14px", textAlign: "left", cursor: "pointer", width: "100%",
        border: `1px solid ${misturar(gold, cz.superficie, chegou ? 0.35 : 0.55)}`,
        display: "flex", alignItems: "center", gap: 10, color: textPrimary,
      }}
    >
      <Car size={20} color={gold} style={{ flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5 }}>
          {chegou ? `Você chegou a ${chegou.nome}?` : `Você está com a ${viatura.apelido}`}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, marginTop: 2 }}>
          {chegou
            ? `Há mais de 2 minutos no local · saiu às ${hora} com ${formatarKm(minha.km_saida)} km`
            : `desde ${hora} · saiu com ${formatarKm(minha.km_saida)} km`}
        </div>
      </div>
      <span style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 12, background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)", color: "#0E0E0E", fontFamily: FONT, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center" }}>
        Encerrar
      </span>
    </button>
  );
}
