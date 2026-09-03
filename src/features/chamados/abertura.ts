// A abertura do chamado técnico — a lógica pura do formulário (R126, U93).
//
// O formulário de chamado de campo (`FormularioChamadoTecnico.tsx`) passou a
// ser usado em DOIS lugares — a página `/chamados/novo-campo` e o pop-up do
// "+" da Operacional Técnica — e ganhou três regras que o Davi ditou em
// 03/09/2026: o responsável pode ser a EQUIPE (e não só o técnico), o campo de
// sistema muda de sentido conforme o tipo, e o título é sugerido quando
// ninguém o digita. As três moram aqui, sem React, para o verificador as
// prender como prende o resto (`carregar()` transpila `.ts`; `.tsx` só por
// regex no fonte).
//
// O QUE ESTE MÓDULO NÃO FAZ: não conhece nomes de gente nem de cliente — recebe
// o texto pronto e devolve texto pronto, como `erroDoAgendamento` e
// `rotuloDaComposicao` fazem nos módulos vizinhos.

import { TIPO_LABEL, type ChamadoTipo } from "@/lib/chamado-status";

/**
 * O RESPONSÁVEL PROPOSTO — "equipe ou técnico solo" (R126).
 *
 * Técnico escolhido vence sempre. Sem técnico e com equipe, o responsável é o
 * PRIMEIRO da escala da semana: é o que faz o chamado contar para a equipe no
 * gráfico (`duplaDaPessoaNaSemana` resolve pela pessoa) e receber o apoio
 * automático dos outros (R75/R96). Sem os dois, fica sem responsável — e a
 * tela diz para onde o chamado vai.
 *
 * A composição chega ORDENADA por `ordem` (montarEscala já ordena): o primeiro
 * é quem o gestor pôs primeiro, que na prática é o líder da equipe (R14: só o
 * líder tem conta). Não há sorteio.
 */
export function responsavelProposto(
  tecnicoId: string | null | undefined,
  composicaoDaEquipe: string[],
): string | null {
  if (tecnicoId) return tecnicoId;
  return composicaoDaEquipe[0] ?? null;
}

/**
 * O TÍTULO SUGERIDO — "Tipo — Sistema", ou "Tipo — Cliente" quando não há
 * sistema, ou só o tipo quando não há nem cliente (o formulário recusa criar
 * sem cliente antes de chegar aqui; o terceiro caso existe para a função ser
 * total).
 *
 * O travessão é o MESMO das outras sugestões do sistema ("Implantação —
 * CFTV"), e não dois-pontos: dois-pontos em título vira sub-título na tabela
 * da Início, que já tem coluna de cliente.
 */
export function sugerirTitulo(
  tipo: ChamadoTipo,
  sistemaNome: string | null | undefined,
  clienteNome: string | null | undefined,
): string {
  const alvo = (sistemaNome ?? "").trim() || (clienteNome ?? "").trim();
  return alvo ? `${TIPO_LABEL[tipo]} — ${alvo}` : TIPO_LABEL[tipo];
}

/**
 * O que o campo de SISTEMA pergunta, por tipo (R126/R127):
 *   · implantação → o sistema A IMPLANTAR — ainda não existe no cliente, e o
 *     formulário oferece criá-lo ali;
 *   · preventiva → o sistema A REVISAR — vazio quer dizer todos (é o que monta
 *     o checklist, `montarChecklistPreventiva`);
 *   · os demais → o sistema AFETADO, opcional.
 */
export function rotuloDoSistema(tipo: ChamadoTipo): string {
  switch (tipo) {
    case "implantacao": return "Sistema a implantar";
    case "preventiva": return "Sistema a revisar (vazio = todos)";
    default: return "Sistema afetado (opcional)";
  }
}

/** Só a implantação pode CRIAR o sistema na abertura — os outros só apontam. */
export function podeCriarSistema(tipo: ChamadoTipo): boolean {
  return tipo === "implantacao";
}

export interface SecaoDoProblema {
  titulo: string;
  placeholderAssunto: string;
  placeholderDetalhes: string;
}

/**
 * "Problema se for manutenção, sistema se for implantação" (Davi, 03/09).
 * A seção continua existindo em todo tipo — o campo de texto é o mesmo —,
 * mas o que ela PERGUNTA muda: ninguém "relata problema" numa implantação.
 */
export function secaoDoProblema(tipo: ChamadoTipo): SecaoDoProblema {
  switch (tipo) {
    case "implantacao":
      return {
        titulo: "Escopo da implantação",
        placeholderAssunto: "Ex.: implantação de CFTV — 16 câmeras e gravador",
        placeholderDetalhes: "O que será instalado, o que foi combinado com o cliente, o que já foi comprado…",
      };
    case "preventiva":
      return {
        titulo: "Roteiro da preventiva",
        placeholderAssunto: "Ex.: preventiva trimestral",
        placeholderDetalhes: "Pontos de atenção além do roteiro padrão dos sistemas…",
      };
    case "vistoria":
      return {
        titulo: "O que vistoriar",
        placeholderAssunto: "Ex.: conferir a instalação da eclusa",
        placeholderDetalhes: "O que precisa ser visto, o que o cliente relatou…",
      };
    default:
      return {
        titulo: "Problema relatado",
        placeholderAssunto: "Ex.: portão da garagem não abre pelo controle",
        placeholderDetalhes: "Quem informou, desde quando, o que já tentaram…",
      };
  }
}
