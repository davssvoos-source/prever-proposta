// Foto + nome — o par usado em qualquer lugar que precise identificar uma
// pessoa de relance (tabela da Início, painel de propriedades do chamado).
//
// Extraído de TabelaAtividades.tsx (U33) quando o painel de propriedades
// (U40) precisou do mesmo par: duas cópias da mesma lógica de avatar
// divergiriam na primeira alteração de estilo, e pior — cada cópia poderia
// escolher hashear a cor por um campo diferente (nome vs id), quebrando a
// promessa de que a MESMA pessoa tem a MESMA cor em toda tela do sistema.

import { type CSSProperties } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { degradeAvatar } from "@/lib/paleta";
import type { PessoaAvatar } from "@/components/AvatarPilha";

export function PessoaComFoto({ id, nome, pessoa, tamanho = 20 }: {
  id: string; nome: string; pessoa: PessoaAvatar | undefined; tamanho?: number;
}) {
  const { isLight } = useTheme();
  const iniciais = nome.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  // hash pelo ID, não pelo nome: é o que AvatarPilha usa no resto do app
  // (kanban, pilha de participantes). Hashear por nome faria a MESMA pessoa
  // ter cor diferente em cada tela — e a cor é justamente como se reconhece
  // alguém de relance.
  const d = degradeAvatar(id);
  const circulo: CSSProperties = {
    width: tamanho, height: tamanho, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    objectFit: "cover",
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      {pessoa?.avatar_url ? (
        <img src={pessoa.avatar_url} alt="" style={circulo} />
      ) : (
        <span style={{
          ...circulo, background: d.grad, color: d.sobre,
          boxShadow: `0 0 8px ${d.glow}`,
          fontFamily: FONT, fontWeight: 700, fontSize: Math.round(tamanho * 0.4),
        }}>
          {iniciais}
        </span>
      )}
      <span style={{
        minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: isLight ? "#0a0b0e" : "#ffffff",
      }}>
        {nome}
      </span>
    </span>
  );
}

/** Só o círculo, sem o nome — para overlays dentro de campos de texto/busca. */
export function AvatarCirculo({ id, nome, pessoa, tamanho = 18 }: {
  id: string; nome: string; pessoa: PessoaAvatar | undefined; tamanho?: number;
}) {
  const iniciais = (nome || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const d = degradeAvatar(id);
  const circulo: CSSProperties = {
    width: tamanho, height: tamanho, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", objectFit: "cover",
  };
  return pessoa?.avatar_url ? (
    <img src={pessoa.avatar_url} alt="" style={circulo} />
  ) : (
    <span style={{
      ...circulo, background: d.grad, color: d.sobre,
      fontFamily: FONT, fontWeight: 700, fontSize: Math.round(tamanho * 0.42),
    }}>
      {iniciais}
    </span>
  );
}
