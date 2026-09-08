// O PROGRESSO DA ATIVIDADE — a rosca de 0% a 100% (R235, U120).
//
// Davi, 08/09/2026: "No canto superior direito da tela, adicione um campo
// contendo um gráfico de rosca que vai de 0% a 100%, este gráfico será o
// progresso da atividade. Quando o usuário adicionar um checklist no campo
// 'Descrição' (para atv. manutenções corretivas, considere o campo 'Solução'),
// o sistema irá contabilizar o progresso da atividade. Caso não tenha nenhum
// checklist na atividade, o progresso só pode ser 0% (Qualquer Status) ou 100%
// (Concluída)."
//
// ── DE ONDE SAI O NÚMERO ───────────────────────────────────────────────────
// Do MESMO texto que a pessoa escreve — não existe campo de progresso no banco
// para alguém esquecer de atualizar. O checklist do editor (`- [x] item`, ver
// lib/edicao-texto.ts) É o plano de trabalho, e contar quantos itens estão
// marcados é a definição menos mentirosa de "quanto andou".
//
// ── QUAL CAMPO CONTA ───────────────────────────────────────────────────────
// Na CORRETIVA o trabalho está na Solução aplicada — a Descrição ali é o
// problema detectado, e marcar caixas no problema não seria progresso nenhum.
// Nos outros tipos o plano está na Descrição. O predicado é o mesmo
// `temDiagnostico` da R213: uma definição de "é corretiva" no sistema inteiro.
//
// ── O STATUS VENCE O CHECKLIST ─────────────────────────────────────────────
// Davi, 08/09/2026 (resposta à pergunta direta): concluída é 100%, tenha
// checklist ou não. O checklist governa enquanto a atividade está em aberto.
// Sem checklist, o progresso é 0% até ela ser concluída: é honesto: o sistema
// não sabe medir o que ninguém descreveu em passos.
//
// PURO DE PROPÓSITO: texto e status entram, número e frase saem. É o que
// permite travar cada regra com asserção — a rosca (RoscaDeProgresso.tsx) só
// desenha o que esta função devolve.

import { ehLinhaChecklist, checklistMarcado } from "@/lib/edicao-texto";
import { temDiagnostico } from "./registro";

export interface ContagemDeChecklist {
  total: number;
  marcados: number;
}

/** Quantos itens de checklist há no texto, e quantos estão marcados. */
export function contarChecklist(texto: string | null | undefined): ContagemDeChecklist {
  const linhas = (texto ?? "").split("\n").filter(ehLinhaChecklist);
  return { total: linhas.length, marcados: linhas.filter(checklistMarcado).length };
}

/** Qual campo carrega o plano de trabalho: a Solução na corretiva, a Descrição nos outros (R213). */
export type CampoDoProgresso = "descricao" | "solucao";

export function campoDoProgresso(tipo: string | null | undefined): CampoDoProgresso {
  return temDiagnostico(tipo) ? "solucao" : "descricao";
}

/** O rótulo do campo que conta — o mesmo que a tela escreve no card. */
export const ROTULO_DO_CAMPO: Record<CampoDoProgresso, string> = {
  descricao: "Descrição",
  solucao: "Solução aplicada",
};

export interface EntradaDoProgresso {
  tipo: string | null | undefined;
  status: string | null | undefined;
  descricao: string | null | undefined;
  solucao: string | null | undefined;
}

export interface ProgressoDaAtividade {
  /** 0 a 100, inteiro */
  pct: number;
  total: number;
  marcados: number;
  /** `checklist` = contado dos itens; `status` = 0% ou 100% porque não há checklist (ou porque concluiu) */
  fonte: "checklist" | "status";
  /** de qual campo o checklist foi lido */
  campo: CampoDoProgresso;
  /** a frase para quem não vê a rosca (aria-label e title) */
  frase: string;
}

export function progressoDaAtividade(a: EntradaDoProgresso): ProgressoDaAtividade {
  const campo = campoDoProgresso(a.tipo);
  const { total, marcados } = contarChecklist(campo === "solucao" ? a.solucao : a.descricao);
  const concluida = a.status === "concluido";

  if (concluida) {
    return {
      pct: 100, total, marcados, fonte: "status", campo,
      frase: total > 0
        ? `Concluída — 100% (${marcados} de ${total} ${total === 1 ? "item" : "itens"} marcados)`
        : "Concluída — 100%",
    };
  }
  if (total === 0) {
    return {
      pct: 0, total: 0, marcados: 0, fonte: "status", campo,
      frase: `Sem checklist em ${ROTULO_DO_CAMPO[campo]} — o progresso fica em 0% até a atividade ser concluída`,
    };
  }
  return {
    pct: Math.round((marcados / total) * 100),
    total, marcados, fonte: "checklist", campo,
    frase: `${marcados} de ${total} ${total === 1 ? "item" : "itens"} do checklist marcados`,
  };
}
