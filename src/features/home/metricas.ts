// As contas dos painéis do topo da Início — separadas da pintura.
//
// Mesmo padrão de features/paineis/indicadores.ts: função pura, sem React,
// para poder ser travada com asserção. Número de painel que ninguém confere é
// número que mente sem ninguém notar — e aqui já aconteceu duas vezes (ver
// os comentários de cada função).

import type { Atividade } from "@/features/atividades/modelo";
import { inicioSemana, dataIso } from "@/lib/periodos";

/**
 * Quantos foram concluídos em cada semana, das PRÓPRIAS atividades.
 *
 * Era uma consulta à parte que trazia só `concluida_em` — números prontos, que
 * os filtros do quadro não tinham como recortar. Filtrar o futuro e não o
 * passado deixaria metade do gráfico respondendo ao filtro e metade não, que é
 * pior do que não filtrar nada: o mesmo gráfico contaria duas histórias.
 */
export function concluidosPorSemana(atividades: Atividade[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const a of atividades) {
    // `encerradoEm` é null enquanto está em aberto, e cancelar não é entregar
    if (!a.encerradoEm || a.coluna === "cancelado") continue;
    const k = dataIso(inicioSemana(new Date(a.encerradoEm)));
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

/**
 * A meta do mês: o que está no prato deste mês e o que já saiu dele.
 *
 * Era uma consulta presa ao `userId` — o painel mostrava a meta de quem estava
 * logado mesmo com o quadro filtrado por outra pessoa: dois números na mesma
 * tela falando de gente diferente. Contando do recorte, filtrar por Erik
 * mostra a meta do Erik e "todos" mostra a da casa.
 *
 * A ETIQUETA DE SPRINT ENVELHECE. "Este mês" no Notion é um rótulo que ninguém
 * volta para tirar: no export de 2026-08-21 havia 7 atividades marcadas "este
 * mês" concluídas em junho e julho. Contadas pela etiqueta, apareceriam como
 * entregas de agosto — a meta comemorando trabalho de dois meses atrás. Então
 * a etiqueta diz a INTENÇÃO e a data diz o FATO: entra o que ainda está em
 * aberto (é o que falta fazer) e o que foi encerrado DENTRO do mês corrente.
 */
export function metaDoMes(
  atividades: Atividade[],
  agora: Date = new Date(),
): { total: number; feitas: number } {
  const mes = agora.getMonth();
  const ano = agora.getFullYear();
  const nesteMes = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === mes && d.getFullYear() === ano;
  };

  const doMes = atividades.filter(
    (a) =>
      a.natureza === "interno" &&
      a.sprint === "este_mes" &&
      a.coluna !== "cancelado" &&
      (a.emAberto || nesteMes(a.encerradoEm)),
  );
  return { total: doMes.length, feitas: doMes.filter((a) => !a.emAberto).length };
}
