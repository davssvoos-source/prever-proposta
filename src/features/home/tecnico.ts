// A Início do TÉCNICO DE CAMPO (R263) — a lógica PURA. A tela só desenha.
//
// Davi, 12/09/2026: "Os técnicos de campo são os com cargo TÉCNICO, eles
// utilizarão pelo celular. Eles devem ter em seu app somente 3 páginas: INICIO,
// AGENDA, PERFIL. A página INICIO deve aparecer quantas atividades ele tem
// pendente hoje, além de aparecer em ordem da mais próxima no topo os cards das
// atividades na tela INICIO." E, perguntado se ele vê só as dele ou as da
// equipe: "Todas as atividades da equipe para saber o que os colegas tem."
//
// O que mora aqui: o RECORTE (minhas × equipe), a CONTA do dia (sempre a
// dele, R11), os DOIS GRUPOS da lista (hoje · a seguir, cada um da mais
// próxima para a mais distante) e a frase. Nenhuma destas funções sabe o que
// é um pixel — é o que deixa cada uma delas virar asserção.

import type { Atividade } from "@/features/atividades/modelo";
import { atividadesDeHoje } from "@/features/atividades/modelo";
import { ordenar } from "@/features/home/lentes";
import {
  plantonistasDaSemana, semanasDoMes, deslocarCompetencia,
  type LinhaSobreaviso, type PessoaCandidata,
} from "@/features/sobreaviso/modelo";

// ── O recorte: minhas × equipe ──────────────────────────────────────────────

export type RecorteDoTecnico = "minhas" | "equipe";

/** A chave no localStorage — UMA para a Início e a Agenda, que leem o mesmo interruptor. */
export const CHAVE_RECORTE = "prever:tecnico-recorte";

/** Qualquer coisa que não seja "equipe" é "minhas" — o padrão é o meu dia. */
export function lerRecorte(bruto: string | null | undefined): RecorteDoTecnico {
  return bruto === "equipe" ? "equipe" : "minhas";
}

/**
 * O que a lista mostra: só o que está EM ABERTO — concluída não é pendência —,
 * e ou só as dele (responsável ou apoio) ou as da equipe inteira. A base já
 * chega recortada pelo banco (R264: o técnico lê só atividade de campo), então
 * "equipe" aqui é literalmente tudo o que a consulta devolveu.
 */
export function atividadesDoTecnico(atividades: readonly Atividade[], recorte: RecorteDoTecnico): Atividade[] {
  return atividades.filter((a) => a.emAberto && (recorte === "equipe" || a.souResponsavel || a.souApoio));
}

/**
 * "Você tem N atividades hoje" — SEMPRE as dele (R11), mesmo com a lista em
 * "Equipe": o número do banner responde "quanto EU tenho", e a lista responde
 * "o que estou olhando". Misturar os dois faria o número mudar quando a pessoa
 * só quis espiar o colega.
 */
export function minhasDeHoje(atividades: readonly Atividade[], agora: Date): Atividade[] {
  return atividadesDeHoje(atividades.filter((a) => a.souResponsavel || a.souApoio), agora);
}

/**
 * Dois grupos, cada um em ordem da mais próxima para a mais distante.
 *
 * "Hoje" é a mesma régua do banner (`atividadesDeHoje`, R11): dia marcado hoje,
 * prazo hoje, atrasada ou em andamento — o que exige atenção agora. "A seguir"
 * é o resto. Dentro de cada grupo a ordem é a de `ordenar(…, "prazo")`: vence
 * antes primeiro, atrasada no topo, sem data por último — a mesma ordem que a
 * Início do gestor usa, para as duas telas não discordarem sobre "a próxima".
 */
export function gruposDoTecnico(
  lista: readonly Atividade[],
  agora: Date,
): { hoje: Atividade[]; depois: Atividade[] } {
  const deHoje = new Set(atividadesDeHoje([...lista], agora).map((a) => a.id));
  const ordenada = ordenar([...lista], "prazo");
  return {
    hoje: ordenada.filter((a) => deHoje.has(a.id)),
    depois: ordenada.filter((a) => !deHoje.has(a.id)),
  };
}

// ── A frase ─────────────────────────────────────────────────────────────────

/** Bom dia até 11:59, boa tarde até 17:59, boa noite depois. */
export function saudacao(agora: Date): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** "Breno Silva" → "Breno"; vazio → null (a frase sai sem o nome). */
export function primeiroNome(nome: string | null | undefined): string | null {
  const s = (nome ?? "").trim();
  if (!s) return null;
  return s.split(/\s+/)[0];
}

/** A frase do banner, que é a da R11 — só o número muda. */
export function fraseDoDia(quantas: number): string {
  if (quantas === 0) return "Nada para hoje.";
  return `Você tem ${quantas} ${quantas === 1 ? "atividade" : "atividades"} hoje.`;
}

// ── O sobreaviso visto pelo técnico ─────────────────────────────────────────

/** "AAAA-MM" de uma data, no fuso local. */
export function competenciaDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * As segundas das semanas em que EU sou plantonista, nesta competência e na
 * seguinte — o que o técnico precisa saber para se organizar. Usa a MESMA
 * `plantonistasDaSemana` da tela do Vinicius (R254): plantonista é quem tem
 * hora no miolo da semana, e a resposta aqui não pode ser outra que a de lá.
 */
export function minhasSemanasDeSobreaviso(
  competencia: string,
  candidatas: readonly PessoaCandidata[],
  linhas: readonly LinhaSobreaviso[],
  meuId: string | null,
): string[] {
  if (!meuId) return [];
  const segundas = new Set<string>([
    ...semanasDoMes(competencia),
    ...semanasDoMes(deslocarCompetencia(competencia, 1)),
  ]);
  return [...segundas]
    .sort()
    .filter((segunda) =>
      plantonistasDaSemana(segunda, [...candidatas], [...linhas]).some((q) => q.pessoa.id === meuId));
}
