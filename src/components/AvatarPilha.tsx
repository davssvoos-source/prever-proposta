// Pilha de avatares — os participantes de uma atividade, sobrepostos como nas
// referências Versa UI. Foto quando o perfil tem, iniciais sobre um degradê da
// paleta quando não tem, e "+N" quando não cabem todos.
//
// Quem não tem foto ganha um dos quatro degradês do prisma (azul, amarelo,
// laranja, vermelho) com glow fraco. A escolha é por HASH do id, não por
// sorteio: sorteio de verdade trocaria a cor a cada render, e a cor do avatar
// é justamente como se reconhece alguém de relance numa lista.

import type { CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { degradeAvatar } from "@/lib/paleta";

export interface PessoaAvatar {
  nome: string;
  avatar_url: string | null;
}

interface Props {
  ids: string[];
  pessoas: Record<string, PessoaAvatar>;
  max?: number;
  tamanho?: number;
}

export function AvatarPilha({ ids, pessoas, max = 3, tamanho = 22 }: Props) {
  const { isLight } = useTheme();
  if (ids.length === 0) return null;

  const visiveis = ids.slice(0, max);
  const resto = ids.length - visiveis.length;
  // a borda na cor da superfície é o que faz a sobreposição ler como pilha
  const anel = isLight ? "#ffffff" : "#1a1a20";

  const circulo: CSSProperties = {
    width: tamanho,
    height: tamanho,
    borderRadius: "50%",
    border: `2px solid ${anel}`,
    boxSizing: "content-box",
    flexShrink: 0,
    objectFit: "cover",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }} aria-label={`${ids.length} participante(s)`}>
      {visiveis.map((id, i) => {
        const p = pessoas[id];
        const iniciais = (p?.nome ?? "?")
          .split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
        const d = degradeAvatar(id);
        return p?.avatar_url ? (
          <img
            key={id}
            src={p.avatar_url}
            alt={p.nome}
            title={p.nome}
            style={{ ...circulo, marginLeft: i === 0 ? 0 : -7 }}
          />
        ) : (
          <span
            key={id}
            title={p?.nome}
            style={{
              ...circulo,
              marginLeft: i === 0 ? 0 : -7,
              background: d.grad,
              color: d.sobre,
              // glow fraco: o suficiente para a pastilha descolar do card sem
              // virar farol numa lista com dez delas
              boxShadow: `0 0 10px ${d.glow}`,
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: Math.round(tamanho * 0.38),
            }}
          >
            {iniciais}
          </span>
        );
      })}
      {resto > 0 && (
        <span
          style={{
            ...circulo,
            marginLeft: -7,
            background: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
            color: isLight ? "#4a5060" : "rgba(255,255,255,0.75)",
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: Math.round(tamanho * 0.36),
          }}
        >
          +{resto}
        </span>
      )}
    </span>
  );
}
