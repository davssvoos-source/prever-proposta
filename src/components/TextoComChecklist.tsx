// Renderiza a Descrição de um chamado como texto, trocando cada linha
// `- [ ] item` / `- [x] item` (a sintaxe que a barra de ferramentas do painel
// escreve — ver lib/edicao-texto.ts) por uma caixa de marcar de verdade.
// Design da caixa: pedido do Davi (Uiverse.io, por mrhyddenn — CSS em
// styles.css, classes `.checklist-input`/`.checklist-check`), 2026-08-21.
//
// Continua TEXTO PURO por baixo: clicar chama `aoMudar` com o texto INTEIRO
// já com `[ ]`/`[x]` trocado na linha certa — quem grava é quem já grava
// `descricao_problema` hoje (atualizarChamado). Sem `aoMudar`, é só leitura.

import { type CSSProperties } from "react";
import {
  ehLinhaChecklist, checklistMarcado, checklistTexto, alternarLinhaChecklist,
} from "@/lib/edicao-texto";

interface Props {
  texto: string;
  aoMudar?: (novoTexto: string) => void;
  estilo?: CSSProperties;
}

export function TextoComChecklist({ texto, aoMudar, estilo }: Props) {
  const linhas = texto.split("\n");
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13.5,
      lineHeight: 1.6, ...estilo,
    }}>
      {linhas.map((linha, i) => {
        if (!ehLinhaChecklist(linha)) {
          return linha === ""
            ? <div key={i} style={{ height: "0.9em" }} />
            : <div key={i} style={{ whiteSpace: "pre-wrap" }}>{linha}</div>;
        }
        const marcado = checklistMarcado(linha);
        return (
          <label key={i} style={{
            display: "flex", alignItems: "center", gap: 9,
            cursor: aoMudar ? "pointer" : "default",
          }}>
            <input
              type="checkbox"
              className="checklist-input"
              checked={marcado}
              disabled={!aoMudar}
              onChange={() => {
                if (!aoMudar) return;
                const novasLinhas = [...linhas];
                novasLinhas[i] = alternarLinhaChecklist(linha);
                aoMudar(novasLinhas.join("\n"));
              }}
              style={{ display: "none" }}
            />
            <span className="checklist-check">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z" />
                <polyline points="1 9 7 14 15 4" />
              </svg>
            </span>
            <span style={{
              textDecoration: marcado ? "line-through" : "none",
              opacity: marcado ? 0.6 : 1,
            }}>
              {checklistTexto(linha)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
