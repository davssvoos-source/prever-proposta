// Renderiza a Descrição de um chamado como texto, trocando cada linha
// `- [ ] item` / `- [x] item` (a sintaxe que a barra de ferramentas do painel
// escreve — ver lib/edicao-texto.ts) por uma caixa de marcar de verdade.
// Design da caixa: pedido do Davi (Uiverse.io, por mrhyddenn — CSS em
// styles.css, classes `.checklist-input`/`.checklist-check`), 2026-08-21.
//
// Continua TEXTO PURO por baixo: clicar chama `aoMudar` com o texto INTEIRO
// já com `[ ]`/`[x]` trocado na linha certa — quem grava é quem já grava
// `descricao_problema` hoje (atualizarChamado). Sem `aoMudar`, é só leitura.
//
// R135 (U95): a linha passou a ser pintada por SEGMENTOS (lib/texto-rico.ts):
// `**negrito**`, `*itálico*` e a MENÇÃO `@[Nome](user:id)` viram negrito,
// itálico e um chip com o nome — em vez do token cru. A linha de lista
// (`- item`) ganhou o ponto. É a mesma leitura do editor quando a linha não
// está em edição, e é o que faz as três telas que leem a descrição (o painel,
// a página interna e a de campo) mostrarem a mesma coisa.

import { type CSSProperties } from "react";
import { AtSign } from "lucide-react";
import {
  ehLinhaChecklist, checklistMarcado, checklistTexto, alternarLinhaChecklist,
} from "@/lib/edicao-texto";
import { segmentar, type Segmento } from "@/lib/texto-rico";

interface Props {
  texto: string;
  aoMudar?: (novoTexto: string) => void;
  estilo?: CSSProperties;
}

/** Os segmentos de uma linha pintados — usado aqui e no editor (linha fora de edição). */
export function LinhaRica({ texto, tamanhoChip = 12 }: { texto: string; tamanhoChip?: number }) {
  const segs: Segmento[] = segmentar(texto);
  return (
    <>
      {segs.map((s, i) => {
        if (s.tipo === "negrito") return <strong key={i} style={{ fontWeight: 700 }}>{s.texto}</strong>;
        if (s.tipo === "italico") return <em key={i}>{s.texto}</em>;
        if (s.tipo === "mencao") {
          return (
            <span
              key={i}
              className="mencao-chip"
              title={`Menção a ${s.texto}`}
              style={{ fontSize: tamanhoChip }}
            >
              <AtSign size={Math.max(9, tamanhoChip - 2)} />
              {s.texto}
            </span>
          );
        }
        return <span key={i}>{s.texto}</span>;
      })}
    </>
  );
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
          if (linha === "") return <div key={i} style={{ height: "0.9em" }} />;
          const item = linha.match(/^- (.*)$/);
          if (item) {
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, whiteSpace: "pre-wrap" }}>
                <span className="lista-ponto" aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}><LinhaRica texto={item[1]} /></span>
              </div>
            );
          }
          return <div key={i} style={{ whiteSpace: "pre-wrap" }}><LinhaRica texto={linha} /></div>;
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
              <svg width="19" height="19" viewBox="0 0 18 18">
                <path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z" />
                <polyline points="1 9 7 14 15 4" />
              </svg>
            </span>
            <span style={{
              textDecoration: marcado ? "line-through" : "none",
              opacity: marcado ? 0.6 : 1,
            }}>
              <LinhaRica texto={checklistTexto(linha)} />
            </span>
          </label>
        );
      })}
    </div>
  );
}
