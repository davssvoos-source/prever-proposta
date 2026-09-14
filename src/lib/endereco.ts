// O CAMPO DE ENDEREÇO — o que ele pede e o que ele diz quando o mapa não acha
// (R242, U125). Lógica pura: um texto, quatro telas.
//
// Davi, 09/09/2026, sobre a tela de nova visita: "Não consigo inserir o
// endereço do local." O endereço ESTAVA no campo — o que ele leu como recusa
// foi a frase vermelha embaixo dele, do botão "Localizar no mapa" que não achou
// "Rua Engelbert Romer, 124" (sem bairro nem cidade, o Nominatim volta vazio).
//
// A REGRA, que já era a do código e não estava na tela: o endereço é TEXTO e
// vale sozinho. A coordenada é do mapa, é opcional, e não bloqueia nada — a
// visita, o cliente e a proposta se salvam sem ela (`formularioValido` nunca
// olhou lat/lng). Então a frase não é erro: é recado. Vermelho ali dizia
// "recusei o seu endereço", o que era mentira.
//
// A mesma frase vivia copiada em QUATRO telas (ClienteForm, NovaVisitaTecnica,
// VisitaForm, NovaVisitaDialog) — e por isso corrigir o tom em uma só deixaria
// as outras três mentindo.

// O motivo vem de QUEM O PRODUZ (o servidor), e não de uma cópia escrita à
// mão aqui: duas declarações da mesma forma divergem em silêncio, e o `tsc`
// não reclamaria porque continuariam compatíveis. `import type` some na
// compilação — nenhuma tela passa a carregar o módulo de servidor por isto.
import type { MotivoSemMapa } from "@/lib/geocodificar.functions";
export type { MotivoSemMapa };

/** O que o campo de endereço pede — e a cidade está aí porque o mapa precisa dela. */
export const DICA_DO_CAMPO_ENDERECO = "Rua, número, bairro, cidade";

/**
 * OS RECADOS DE QUANDO O MAPA NÃO DÁ COORDENADA (R242 + P43).
 *
 * Todos os três começam pela MESMA coisa, que é o que o Davi pediu na R242:
 * **o endereço está salvo**. Nenhum deles afirma que o endereço não existe —
 * isso o sistema não sabe, e dizer que sabe é o erro que a R242 proibiu.
 *
 * O que muda entre eles é a SEGUNDA metade: o que a pessoa faz agora. Até a
 * P43 havia uma frase só, que precisava servir para os dois casos ao mesmo
 * tempo e por isso hesitava nos dois ("pode ser o texto, pode ser o serviço").
 * Com o motivo chegando do servidor, cada frase pode dizer uma coisa só — e a
 * frase certa é a diferença entre corrigir um endereço que está certo e
 * esperar cinco minutos.
 */
/** O serviço RESPONDEU e não achou: o texto é o suspeito. */
export const AVISO_ENDERECO_SEM_MAPA =
  "O endereço fica salvo assim mesmo — só não achei este ponto no mapa, então " +
  "isto vai sem coordenada. Incluir bairro e cidade costuma resolver.";

/** Não deu para PERGUNTAR — rede, timeout. Mexer no endereço não ajuda. */
export const AVISO_MAPA_FORA_DO_AR =
  "O endereço fica salvo assim mesmo — o que falhou foi a consulta ao serviço " +
  "de mapas, então isto vai sem coordenada. Não é o texto do endereço: dá " +
  "para tentar de novo daqui a pouco.";

/**
 * O serviço RECUSOU (429/403/401). É o único em que insistir piora — e o
 * único que carrega a instrução de diagnóstico, porque o bloqueio do
 * Nominatim é **por IP** e cai sobre a operação inteira: se o Localizar parou
 * em todas as telas ao mesmo tempo e continua parado, isso é banimento da
 * identidade, e a resposta é escrever à OSM — não mexer no endereço. Essa
 * frase só existia no documento de dívida; agora ela aparece para quem está
 * olhando o sintoma.
 */
export const AVISO_MAPA_RECUSOU =
  "O endereço fica salvo assim mesmo — o serviço de mapas recusou a consulta " +
  "agora (limite de uso), então isto vai sem coordenada. Repetir na mesma hora " +
  "não adianta, e não é o texto do endereço. Se o Localizar continuar assim em " +
  "todas as telas, avise o T.I.: o limite é da operação inteira, não deste " +
  "cadastro.";

/** A frase de cada motivo — uma função para as quatro telas não escolherem sozinhas. */
export function avisoDoEndereco(motivo: MotivoSemMapa): string {
  if (motivo === "servico_falhou") return AVISO_MAPA_FORA_DO_AR;
  if (motivo === "sem_provedor") return AVISO_MAPA_RECUSOU;
  return AVISO_ENDERECO_SEM_MAPA;
}

/**
 * O endereço está preenchido o bastante para salvar? É só ter texto — a
 * coordenada não entra na conta (R242). Existe como função para a asserção
 * poder perguntar isso sem abrir tela.
 */
export function enderecoServe(endereco: string | null | undefined): boolean {
  return (endereco ?? "").trim().length > 0;
}
