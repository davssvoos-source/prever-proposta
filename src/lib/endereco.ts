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

/** O que o campo de endereço pede — e a cidade está aí porque o mapa precisa dela. */
export const DICA_DO_CAMPO_ENDERECO = "Rua, número, bairro, cidade";

/**
 * O recado quando o mapa não acha o endereço.
 *
 * Duas coisas, nesta ordem: (1) o endereço está salvo — é o que o Davi precisava
 * ler; (2) o que ajuda a achar, e por que insistir agora não ajuda. A casca
 * `geocode()` colapsa "não achei" e "o serviço recusou" no mesmo `null`
 * (o servidor distingue, a casca apaga), então a frase NÃO pode afirmar que o
 * endereço não existe: o bloqueio do Nominatim é por IP e cai sobre a operação
 * inteira, e "este endereço não existe" seria a única frase do sistema a
 * instruir a pessoa a martelar o serviço que acabou de bloqueá-la.
 */
export const AVISO_ENDERECO_SEM_MAPA =
  "O endereço fica salvo assim mesmo — só não achei este ponto no mapa, então " +
  "isto vai sem coordenada. Incluir bairro e cidade costuma resolver; se o " +
  "texto já está certo, o serviço de mapas pode ter recusado agora, e repetir " +
  "na mesma hora não adianta.";

/**
 * O endereço está preenchido o bastante para salvar? É só ter texto — a
 * coordenada não entra na conta (R242). Existe como função para a asserção
 * poder perguntar isso sem abrir tela.
 */
export function enderecoServe(endereco: string | null | undefined): boolean {
  return (endereco ?? "").trim().length > 0;
}
