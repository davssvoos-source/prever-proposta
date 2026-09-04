// O FORMULÁRIO DO BLOCO — o ÚNICO do sistema (U79).
//
// A grade, o /chamados/novo-campo e o PainelChamado usam ESTE componente. Um
// formulário, um conjunto de campos, uma caixa de erro, três telas. Três cópias
// de um formulário que fala com a mesma porta divergem — é só questão de
// quando —, e a divergência aparece como "aqui deixa e ali não".
//
// ── ELE NÃO VALIDA NADA: ELE PERGUNTA AO MODELO ───────────────────────────
// `erroDoAgendamento` (modelo.ts:861) tem os DEZ passos NA ORDEM DA RPC, com as
// frases da RPC palavra por palavra. Este arquivo monta o `BlocoCandidato` e o
// `ContextoDoAgendamento`, chama, e mostra o que voltou. Pré-validar aqui por
// conta própria criaria a segunda regra — o defeito que esta entrega existe
// para matar, um andar acima.
//
// E ele NÃO pré-valida ABAIXO do modelo: um corretiva+urgente às 07:00 é aceito
// (é a isenção da jornada da R100), e um campo de hora com `min="09:00"` o
// recusaria antes de o modelo opinar.
//
// ── O ERRO VOLTA NO PRÓPRIO FORMULÁRIO, NOMEANDO O CONFLITO ───────────────
// Nunca um toast solto. `classeDoErro(code)` escolhe o rosto — 23P01 conflito
// (vermelho), 55000 regra (laranja), 42501 permissão (com o código PRV- que a
// casa usa para RLS). A frase vem pronta em português da RPC ou do modelo puro,
// e esta camada NUNCA a reescreve.
//
// ── O QUE ESTE FORMULÁRIO NÃO PERGUNTA: O RESPONSÁVEL ─────────────────────
// R102. `responsavel_id` não é parâmetro de `agenda_campo_marcar`, e a
// invariante do CLAUDE.md diz que a equipe do CHAMADO é derivada do responsável
// enquanto `agenda_campo.dupla_id` é quem se comprometeu com a JANELA. Escrever
// os dois no mesmo gesto seriam DOIS updates, duas reavaliações de apoio, e uma
// janela de falha parcial ("o técnico mudou e nada foi agendado"). O
// `<option value="">Definir depois</option>` da tela antiga ainda por cima
// APAGAVA o responsável de quem só queria mudar a data. Trocar responsável é
// ato próprio, com campo próprio e selo próprio, no chamado.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Loader2, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PRISMA } from "@/lib/paleta";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { codigoDeErro, EXPLICACAO } from "@/lib/erros";
import { referenciaSemanal } from "@/lib/periodos";
import { duplaDaPessoaNaSemana, type Escala } from "@/features/duplas/modelo";
import {
  baixaPedida,
  classeDoErro,
  dataDoDia,
  divergenciaDeEquipe,
  duracaoTexto,
  erroDaBaixa,
  erroDoAgendamento,
  erroDoCancelamento,
  erroDoDesagendamento,
  espelhoAposDesagendar,
  espelhoDoChamado,
  horaTexto,
  patchDoBloco,
  patchImpossivel,
  primeiroInicioPossivel,
  rotuloDoBloco,
  semanaDoDia,
  type AutorizacaoDaAgenda,
  type BlocoCandidato,
  type BlocoDeAgenda,
  type BlocoEditavel,
  type ChamadoParaGrade,
  type ContextoDoAgendamento,
} from "./modelo";
import {
  sqlstateDoErro,
  useCancelarBloco,
  useCumprirBloco,
  useDesagendarChamado,
  useMarcarBloco,
} from "./data";

/**
 * ATALHOS DE DURAÇÃO, EM ORDEM CRESCENTE E SEM NENHUM PRÉ-SELECIONADO.
 *
 * NÃO EXISTE RESPOSTA HONESTA PARA "QUANTO DURA", e por isso o campo abre
 * VAZIO. Varri o repositório: não há duração de serviço em lugar nenhum.
 * `useSla()` devolve PRAZO DE ATENDIMENTO ("até quando alguém tem de ir"), que
 * é pergunta semanticamente outra — usá-lo faria uma corretiva urgente de 4h de
 * SLA ocupar 4h de agenda, e três delas estourariam o dia por um motivo sem
 * relação com a realidade.
 *
 * UM DEFAULT AQUI SERIA UM BACKFILL, UM CLIQUE POR VEZ. A U78 recusou semear
 * blocos porque "chutar uma duração envenenaria o chip de ocupação no primeiro
 * dia, com um número inventado que tem cara de medição" — pré-selecionar um
 * chip faria exatamente isso, mais devagar.
 *
 * A ORDEM CRESCENTE É DELIBERADA: se alguém chutar, que chute para BAIXO, o que
 * faz o dia parecer mais CHEIO do que é. Errar para o lado de recusar
 * sobrecarga, nunca para o lado de inventar capacidade — a mesma direção que
 * `isentoDaJornada` escolheu.
 *
 * O número inicial POR TIPO de serviço é frase do Davi, e até ela existir o
 * campo é vazio (ver docs/PENDENCIAS_TECNICAS.md).
 */
export const ATALHOS_DE_DURACAO = [30, 60, 90, 120, 180, 240];

export interface AberturaDoFormulario {
  /** a linha viva (PATCH) ou null (criar) */
  bloco: BlocoDeAgenda | null;
  chamadoId: string | null;
  dia: string;
  duplaId: string | null;
  /** herdados do gesto anterior ("dar horário em série") — visíveis e editáveis */
  servicoMin: number | null;
  deslocamentoMin: number | null;
  herdado: boolean;
  /** quantos ainda faltam na fila do dia; > 0 liga o "em série" */
  restantes: number;
}

interface Props {
  abertura: AberturaDoFormulario;
  /**
   * A recusa que o ARRASTO já colheu, para ela nascer visível dentro do
   * formulário em vez de virar um toast e um cartão que salta de volta. O
   * arrasto só sabe exprimir (equipe, dia); os outros três campos são daqui, e
   * é aqui que a pessoa conserta o que a frase apontou.
   */
  erroInicial?: { frase: string; code: string | null } | null;
  aoFechar: () => void;
  /** o gesto gravou; o pai decide fechar ou avançar para o próximo da fila */
  aoGravar: (valores: BlocoEditavel) => void;
  blocos: BlocoDeAgenda[];
  /**
   * O DIA CUJA SEMANA O INVÓLUCRO CONSULTOU para montar `blocos`. Obrigatório.
   *
   * `blocos` é sempre a janela de UMA SEMANA (`useBlocosDaSemana` /
   * `useBlocosDaGrade`), e o campo de dia deste formulário é um `<input
   * type="date">` LIVRE. Este componente só sabe se precisa pedir OUTRA semana
   * comparando a semana do campo com a semana desta prop — e é essa comparação
   * que evita avisar o invólucro a cada tecla dentro da MESMA semana, onde a
   * consulta devolveria exatamente a mesma lista.
   *
   * É prop OBRIGATÓRIA para que o `tsc` force qualquer invólucro futuro a
   * responder a pergunta em vez de herdar um silêncio por omissão.
   */
  diaDosBlocos: string;
  /**
   * O invólucro é avisado quando o dia muda de SEMANA, PARA A CONSULTA SEGUIR
   * O CAMPO.
   *
   * O defeito é PRÉ-EXISTENTE e não tem nada de estimativa: `blocos` alimenta
   * `blocosDoDia`, que alimenta `erroDoAgendamento`. Trocar a data para outra
   * semana deixava a lista SEM os blocos daquele dia, e a checagem de conflito
   * e a soma da jornada rodavam sobre uma lista que não continha o dia — o
   * formulário ficava MAIS PERMISSIVO QUE A PORTA (o EXCLUDE e a RPC recusavam
   * depois, com 23P01), que é a pior direção da divergência: a tela deixa
   * marcar e o banco recusa.
   *
   * Levantar o dia para o invólucro conserta isso com uma mudança só. O preço é
   * visível e está no manual: em /chamados/programacao a grade ANDA JUNTO
   * quando a data do formulário muda de semana.
   */
  aoTrocarDia?: (dia: string) => void;
  chamados: ChamadoParaGrade[];
  equipes: { id: string; rotulo: string }[];
  escala: Escala;
  autz: AutorizacaoDaAgenda;
  isLight: boolean;
  /** a rota, para o código PRV- de recusa por permissão */
  rota: string;
}

function numeroOuNulo(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** "09:00" → 540. Devolve null para vazio ou malformado. */
function minutosDaHora(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function FormularioDoBloco({
  abertura, erroInicial, aoFechar, aoGravar, blocos, diaDosBlocos, aoTrocarDia,
  chamados, equipes, escala, autz, isLight, rota,
}: Props) {
  const marcar = useMarcarBloco();
  const cancelar = useCancelarBloco();
  const cumprir = useCumprirBloco();
  const desagendar = useDesagendarChamado();

  const bloco = abertura.bloco;
  // A ABERTURA VENCE A LINHA VIVA. Quem abre o formulário por um arrasto já
  // escolheu equipe e dia soltando o cartão; ler `bloco.dupla_id` aqui
  // devolveria o cartão ao lugar de onde ele saiu, e o erro que o arrasto
  // colheu passaria a falar de um gesto que a tela não está mais mostrando.
  const [duplaId, setDuplaId] = useState<string>(abertura.duplaId ?? bloco?.dupla_id ?? "");
  const [dia, setDia] = useState<string>(abertura.dia || bloco?.dia || "");
  const [hora, setHora] = useState<string>(bloco ? horaTexto(bloco.inicio_min) : "");
  const [servico, setServico] = useState<string>(
    bloco ? String(bloco.servico_min) : abertura.servicoMin != null ? String(abertura.servicoMin) : "",
  );
  const [deslocamento, setDeslocamento] = useState<string>(
    bloco ? String(bloco.deslocamento_min) : abertura.deslocamentoMin != null ? String(abertura.deslocamentoMin) : "",
  );
  const [osExterna, setOsExterna] = useState<string>(bloco?.os_externa ?? "");
  const [tituloExterno, setTituloExterno] = useState<string>(bloco?.titulo_externo ?? "");
  const [erroDoServidor, setErroDoServidor] = useState<{ frase: string; code: string | null } | null>(
    erroInicial ?? null,
  );

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const chamadoId = bloco ? bloco.chamado_id : abertura.chamadoId;
  const porId = useMemo(() => new Map(chamados.map((c) => [c.id, c])), [chamados]);
  const chamado = chamadoId ? porId.get(chamadoId) ?? null : null;
  const blocosDoDia = useMemo(() => blocos.filter((b) => b.dia === dia), [blocos, dia]);
  const desloc = numeroOuNulo(deslocamento) ?? 0;

  /**
   * A SEMANA QUE O INVÓLUCRO CONSULTOU.
   *
   * Ela existe para o `onChange` do campo de dia saber SE precisa avisar o
   * invólucro: a consulta de blocos é POR SEMANA (`gte(dia, segunda) /
   * lte(dia, domingo)`), então andar de terça para quarta não muda UMA linha de
   * `blocos` — avisar ali seria uma navegação da página inteira sem nenhum
   * efeito sobre a lista. O outro lado da comparação o `onChange` calcula na
   * hora, com o valor que acabou de chegar do campo; ter uma variável para ele
   * aqui seria um segundo cálculo do mesmo número, e a versão anterior deste
   * bloco tinha exatamente isso — um `semanaDoDia_` que o `onChange` NÃO lia,
   * descrito por este docblock como se lesse.
   *
   * `semanaDoDia` é a MESMA chave ISO do resto do sistema; o formulário não
   * reimplementa nenhuma aqui. Dia malformado devolve `null`, e `null` nunca é
   * comparado com `null` como se fosse igualdade conhecida — quando não se sabe
   * a semana, o aviso SAI (é o lado seguro: uma consulta a mais, nunca uma
   * lista parcial a menos).
   */
  const semanaDosBlocos = diaDosBlocos ? semanaDoDia(diaDosBlocos, referenciaSemanal) : null;

  /**
   * A PROPOSTA DE HORA, e ela é PROPOSTA: `primeiroInicioPossivel` devolve o
   * primeiro início ≥ 09:00 + deslocamento que não conflita com o que a equipe
   * já tem naquele dia. `null` quer dizer QUE O DIA NÃO COMPORTA MAIS NADA — e
   * aí o campo abre vazio, e a caixa de erro já mostra a frase da jornada antes
   * de a pessoa digitar. É o retorno do modelo virando desenho.
   */
  const proposta = useMemo(
    () => (duplaId && dia ? primeiroInicioPossivel(duplaId, dia, blocos, desloc) : null),
    [duplaId, dia, blocos, desloc],
  );
  // A PROPOSTA ACONTECE UMA VEZ SÓ, e o `useRef` é o que garante isso. Sem ele,
  // o efeito reencheria o campo toda vez que a pessoa o APAGASSE — o formulário
  // discutindo com quem o preenche, que é o pior tipo de campo "inteligente".
  const jaPropos = useRef(false);
  useEffect(() => {
    if (bloco || jaPropos.current || hora !== "" || proposta === null) return;
    jaPropos.current = true;
    setHora(horaTexto(proposta));
  }, [bloco, hora, proposta]);

  const valores: BlocoEditavel = {
    chamado_id: chamadoId,
    dupla_id: duplaId,
    dia,
    inicio_min: minutosDaHora(hora) ?? NaN,
    servico_min: numeroOuNulo(servico) ?? NaN,
    deslocamento_min: desloc,
    os_externa: osExterna.trim() || null,
    titulo_externo: tituloExterno.trim() || null,
  };

  const candidato: BlocoCandidato = {
    id: bloco?.id ?? null,
    chamado_id: valores.chamado_id,
    dupla_id: valores.dupla_id,
    dia: valores.dia,
    inicio_min: valores.inicio_min,
    servico_min: valores.servico_min,
    deslocamento_min: valores.deslocamento_min,
    titulo_externo: valores.titulo_externo,
  };

  const ctx: ContextoDoAgendamento = {
    blocosDoDia,
    blocoAtual: bloco,
    chamado,
    escala,
    chaveDaSemana: referenciaSemanal,
    rotuloDe: (b) => rotuloDoBloco(b, b.chamado_id ? porId.get(b.chamado_id) ?? null : null),
    autz,
  };

  const erroLocal = erroDoAgendamento(candidato, ctx);
  const atual: BlocoEditavel | null = bloco
    ? {
        chamado_id: bloco.chamado_id,
        dupla_id: bloco.dupla_id,
        dia: bloco.dia,
        inicio_min: bloco.inicio_min,
        servico_min: bloco.servico_min,
        deslocamento_min: bloco.deslocamento_min,
        os_externa: bloco.os_externa,
        titulo_externo: bloco.titulo_externo,
      }
    : null;
  const patch = atual ? patchDoBloco(atual, valores) : {};
  const impossivel = atual ? patchImpossivel(patch) : null;
  const semMudanca = !!atual && Object.keys(patch).length === 0;

  const erro = erroDoServidor ?? (erroLocal ? { frase: erroLocal, code: null } : impossivel ? { frase: impossivel, code: "55000" } : null);

  /**
   * A DIVERGÊNCIA É OBSERVAÇÃO, NUNCA ERRO. O bloco diz Equipe B e a escala da
   * semana põe o responsável na A: isso ACONTECE (basta remanejar a escala
   * depois de marcar) e não tem conserto automático — escrita de cadastro não
   * reescreve registro (U76). O formulário mostra e deixa gravar.
   */
  const semanaDoDestino = dia ? semanaDoDia(dia, referenciaSemanal) : null;
  const divergencia = duplaId && semanaDoDestino
    ? divergenciaDeEquipe({ dupla_id: duplaId, chamado_id: chamadoId }, chamado, semanaDoDestino, escala)
    : null;
  const derivada = chamado?.responsavel_id && semanaDoDestino
    ? duplaDaPessoaNaSemana(chamado.responsavel_id, semanaDoDestino, escala)
    : null;

  // ── estilos ───────────────────────────────────────────────────────────────
  const rotulo: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const entrada: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 13px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const setinha: CSSProperties = {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: "pointer",
    background: "transparent", color: textSecondary,
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const secundario: CSSProperties = {
    height: 40, padding: "0 13px", borderRadius: 20, cursor: "pointer",
    background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
    color: textSecondary, fontFamily: FONT, fontWeight: 600, fontSize: 12,
    display: "inline-flex", alignItems: "center", gap: 6,
  };

  const emVoo = marcar.isPending || cancelar.isPending || cumprir.isPending || desagendar.isPending;

  function guardarErro(e: unknown) {
    const code = sqlstateDoErro(e);
    const frase = (e as Error)?.message ?? "Não consegui gravar. Tente de novo.";
    setErroDoServidor({ frase, code });
  }

  function gravar() {
    setErroDoServidor(null);
    // A ORDEM É A DO MODELO: erroDoAgendamento → patchDoBloco →
    // patchImpossivel → paramsDeMarcar. Se o modelo recusou, a chamada NÃO sai:
    // a frase já está na caixa, e mandar assim mesmo só trocaria a mesma recusa
    // por uma viagem de rede.
    if (erroLocal) return;
    if (impossivel) return;
    if (semMudanca) { aoFechar(); return; }
    marcar.mutate(
      { id: bloco?.id ?? null, patch, valores, atual: bloco },
      {
        onSuccess: () => { toast.success(bloco ? "Horário atualizado." : "Horário marcado."); aoGravar(valores); },
        onError: guardarErro,
      },
    );
  }

  /**
   * DAR "FEITO" PODE MANDAR A DATA DO CHAMADO PARA OUTRA SEMANA, E ISSO PRECISA
   * DE UMA PERGUNTA.
   *
   * Carimbar um bloco move o espelho para o próximo bloco PENDENTE (estágio 1),
   * o que está certo e é o que ele existe para fazer. A SURPRESA continua
   * existindo — o chamado passa a aparecer no dia do retorno —, e por isso a
   * pergunta fica.
   *
   * ── O QUE MUDOU NA U81, E POR QUE O TEXTO TEVE DE MUDAR JUNTO ────────────
   * A segunda metade deste aviso era verdadeira e deixou de ser. Até a U81, o
   * carimbo fazia o gatilho da U76 reavaliar o apoio contra a semana NOVA e
   * APAGAR as linhas `origem='dupla'` da turma que JÁ FOI. Agora o mesmo
   * carimbo CONGELA essas linhas (`chamado_apoios.congelado_em`) antes de a
   * cascata rodar, e o DELETE de `chamado_sincronizar_apoio` não as alcança
   * mais: a turma da ida FICA, e a turma do retorno é ACRESCENTADA.
   *
   * Um aviso obsoleto é pior do que nenhum: ele ensina a operação a temer um
   * gesto que ficou seguro, e ensina a não ler a caixa. O que a tela continua
   * dizendo é o que continua sendo verdade — a data anda, e a lista de apoio
   * passa a ter os dois times. Os dois lados são puramente calculáveis com
   * `espelhoDoChamado`, e o texto usa o vocabulário do modelo.
   *
   * O QUE ESTE AVISO NÃO PROMETE: que a lista diga QUEM foi em QUAL ida. A PK
   * `(chamado_id, profile_id)` continua colapsando quem foi nas duas, e
   * "computado POR VISITA" segue não sendo computável (R107).
   */
  function baixar(feito: boolean) {
    if (!bloco) return;
    setErroDoServidor(null);
    const recusa = erroDaBaixa(bloco, feito, autz);
    if (recusa) { setErroDoServidor({ frase: recusa, code: "42501" }); return; }
    if (baixaPedida(feito) && bloco.chamado_id) {
      const antes = espelhoDoChamado(bloco.chamado_id, blocos);
      const depois = espelhoDoChamado(
        bloco.chamado_id,
        blocos.map((b) => (b.id === bloco.id ? { ...b, cumprido_em: "(feito)" } : b)),
      );
      const sa = antes && dataDoDia(antes.dia) ? referenciaSemanal(dataDoDia(antes.dia) as Date) : null;
      const sd = depois && dataDoDia(depois.dia) ? referenciaSemanal(dataDoDia(depois.dia) as Date) : null;
      if (sa && sd && sa !== sd && depois) {
        const ok = window.confirm(
          `Este chamado tem outro atendimento marcado em outra semana.\n\n` +
          `Ao dar "feito" aqui, o chamado passa a aparecer no dia do retorno (${depois.dia}, ${horaTexto(depois.inicio_min)}).\n\n` +
          // A primeira metade é garantida pela U81 (a linha congelada não é mais
          // alcançável pelo DELETE). A segunda é CONDICIONAL e o texto diz isso:
          // `chamado_sincronizar_apoio` volta cedo quando nenhuma escala cobre a
          // semana do retorno, e não insere ninguém quando o responsável não tem
          // parceiro lá. Prometer "os dois times" chapado seria afirmar o que a
          // máquina não garante — e este é o texto que aparece no instante do
          // gesto irreversível.
          `O registro de quem foi NESTA ida fica GUARDADO, e a turma do retorno entra na lista de apoio assim que a escala daquela semana estiver lançada.\n\nMarcar assim mesmo?`,
        );
        if (!ok) return;
      }
    }
    cumprir.mutate(
      { bloco, feito },
      {
        onSuccess: () => { toast.success(feito ? "Atendimento marcado como feito." : "O “feito” foi tirado."); aoGravar(valores); },
        onError: guardarErro,
      },
    );
  }

  function desmarcar() {
    if (!bloco) return;
    setErroDoServidor(null);
    const recusa = erroDoCancelamento(bloco, autz);
    if (recusa) { setErroDoServidor({ frase: recusa, code: "55000" }); return; }
    if (!window.confirm("Desmarcar este horário? A agenda da equipe fica livre nesta janela.")) return;
    cancelar.mutate(bloco, {
      onSuccess: () => { toast.success("Horário desmarcado."); aoGravar(valores); },
      onError: guardarErro,
    });
  }

  /**
   * TIRAR DA AGENDA — o ato do §6.4, e o TEXTO DA CONFIRMAÇÃO É DERIVADO.
   * `espelhoAposDesagendar` existe com o propósito declarado de acertar esta
   * frase: sobrando bloco CUMPRIDO, `data_hora_agendada` NÃO fica nula (o
   * estágio 2 a põe no último atendimento que ACONTECEU), e prometer "o horário
   * some" seria mentira escrita à mão em cima de uma função que sabe a resposta.
   */
  function tirarDaAgenda() {
    if (!chamado) return;
    setErroDoServidor(null);
    const recusa = erroDoDesagendamento(chamado, autz);
    if (recusa) { setErroDoServidor({ frase: recusa, code: "42501" }); return; }
    const resto = espelhoAposDesagendar(chamado.id, blocos);
    const texto = resto
      ? `O chamado volta para "aberto", e a data continua mostrando a última visita que ACONTECEU (${resto.dia}, ${horaTexto(resto.inicio_min)}).`
      : `O chamado volta para "aberto" e fica sem data.`;
    if (!window.confirm(`Tirar este chamado da agenda?\n\n${texto}\n\nOs atendimentos já marcados como feitos não são apagados.`)) return;
    desagendar.mutate(chamado.id, {
      onSuccess: () => { toast.success("Chamado tirado da agenda."); aoGravar(valores); },
      onError: guardarErro,
    });
  }

  const classe = classeDoErro(erro?.code);
  const rostoDoErro = classe === "regra"
    ? { cor: isLight ? PRISMA.laranja.light : PRISMA.laranja.dark, bg: PRISMA.laranja.bg, borda: PRISMA.laranja.border }
    : { cor: isLight ? "#B1242E" : "#F17881",
        bg: isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)",
        borda: isLight ? "rgba(177,36,46,0.22)" : "rgba(241,120,129,0.24)" };

  const titulo = bloco
    ? rotuloDoBloco(bloco, chamado)
    : chamado
      ? rotuloDoBloco({ chamado_id: chamado.id, os_externa: null, titulo_externo: null } as BlocoDeAgenda, chamado)
      : "Serviço fora do sistema";

  return (
    <div
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Horário do atendimento"
      style={{
        position: "fixed", inset: 0, zIndex: 100, padding: 20,
        background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...card(isLight), padding: 18, width: "100%", maxWidth: 520,
          maxHeight: "88vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 13,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15.5, color: textPrimary }}>
              {titulo}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, marginTop: 2 }}>
              {bloco ? "Horário marcado — o que mudar aqui vale para este bloco." : "Dar horário: equipe, dia, hora e duração."}
            </div>
          </div>
          <button onClick={aoFechar} aria-label="Fechar" style={setinha}><X size={15} /></button>
        </div>

        {/* EQUIPE — o formulário PERGUNTA, e não deriva.
            `agenda_campo.dupla_id` é NOT NULL e o EXCLUDE é por equipe: o bloco
            É o compromisso de uma EQUIPE com uma janela. Perguntar a PESSOA e
            derivar a equipe cria um formulário que se preenche inteiro e ainda
            assim não tem resposta (`duplaDaPessoaNaSemana(null,…)` é null), e
            formulário completável e não-submetível é formulário quebrado.
            É também o campo que a camada (iv) do gate confere no servidor. */}
        <div>
          <label style={rotulo}>Equipe de campo</label>
          <select
            value={duplaId}
            onChange={(e) => { setDuplaId(e.target.value); setErroDoServidor(null); }}
            style={{ ...entrada, cursor: "pointer" }}
          >
            <option value="">— escolha a equipe —</option>
            {equipes.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
          </select>
          {divergencia === "fora_da_equipe" && derivada && (
            <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontSize: 11, color: textSecondary }}>
              O responsável deste chamado está em <b>{equipes.find((e) => e.id === derivada)?.rotulo ?? "outra equipe"}</b> nesta semana.
              Isto é observação, não impedimento — quem se compromete com a janela é a equipe escolhida acima.
            </span>
          )}
          {divergencia === "sem_escala" && (
            <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontSize: 11, color: textSecondary }}>
              O responsável deste chamado não está escalado em nenhuma equipe nesta semana. Quem conserta isso é a escala, não a agenda.
            </span>
          )}
          {divergencia === "sem_responsavel" && (
            <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontSize: 11, color: textSecondary }}>
              Este chamado ainda não tem responsável. A equipe abaixo assume a janela mesmo assim.
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={rotulo}>Dia</label>
            {/* A JANELA SEGUE O CAMPO — E SÓ QUANDO A SEMANA MUDA.
                `aoTrocarDia` avisa o invólucro para ele refazer a consulta;
                sem isso `blocos` fica PARCIAL e `erroDoAgendamento` deixa de
                ver os conflitos daquele dia — o formulário fica mais permissivo
                que a porta, e o EXCLUDE recusa depois.

                A GUARDA DE SEMANA NÃO É ENFEITE. Em /chamados/programacao o
                `aoTrocarDia` É uma navegação da página inteira, e o
                `<input type="date">` emite um `change` por segmento
                comprometido — a seta ↑ segurada é um evento por passo. Dentro
                da MESMA semana a consulta devolveria a mesma lista, então
                avisar ali é render (e navegação) puro desperdício. A chave da
                comparação é a mesma `semanaDoDia` que a consulta usa.

                E O QUE A GUARDA **NÃO** COBRE, dito aqui para ninguém supor o
                contrário: o ANO digitado dígito a dígito. Teclar "2026" produz
                as datas dos anos 0002, 0020, 0202 e 2026, que são QUATRO
                semanas distintas — a guarda passa nas quatro e são quatro
                navegações. Um piso (`v >= "2000-01-01"`) fecharia isso e abriria
                coisa pior: o campo continuaria ACEITANDO o ano parcial, só que
                sem avisar o invólucro, e aí `blocos` volta a não conter o dia
                escolhido — que é exatamente a cegueira PRÉ-EXISTENTE que esta
                prop veio consertar. Três navegações desperdiçadas e visíveis
                valem menos que uma checagem de conflito cega. Está declarado em
                docs/PENDENCIAS_TECNICAS.md, P42.

                O `if (v)` existe porque limpar o campo devolve string vazia, e
                uma consulta de semana sem dia não tem o que buscar. */}
            <input
              type="date" value={dia}
              onChange={(e) => {
                const v = e.target.value;
                setDia(v);
                if (v && semanaDoDia(v, referenciaSemanal) !== semanaDosBlocos) aoTrocarDia?.(v);
                setErroDoServidor(null);
              }}
              style={entrada}
            />
          </div>
          <div>
            <label style={rotulo}>Hora de início</label>
            <input
              type="time" value={hora}
              onChange={(e) => { setHora(e.target.value); setErroDoServidor(null); }}
              style={entrada}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={rotulo}>Duração do serviço (min)</label>
            <input
              type="number" min={1} step={5} value={servico} placeholder="—"
              onChange={(e) => { setServico(e.target.value); setErroDoServidor(null); }}
              style={entrada}
            />
          </div>
          <div>
            <label style={rotulo}>Deslocamento (min)</label>
            <input
              type="number" min={0} step={5} value={deslocamento} placeholder="0"
              onChange={(e) => { setDeslocamento(e.target.value); setErroDoServidor(null); }}
              style={entrada}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {ATALHOS_DE_DURACAO.map((m) => (
            <button
              key={m}
              onClick={() => { setServico(String(m)); setErroDoServidor(null); }}
              aria-pressed={numeroOuNulo(servico) === m}
              style={{
                padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                background: numeroOuNulo(servico) === m ? GOLD_GRAD : "transparent",
                color: numeroOuNulo(servico) === m ? "#08090E" : textSecondary,
                border: numeroOuNulo(servico) === m ? "none"
                  : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                fontFamily: FONT, fontWeight: 600, fontSize: 11,
              }}
            >
              {duracaoTexto(m)}
            </button>
          ))}
          {abertura.herdado && !bloco && (
            <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary }}>
              (duração e deslocamento vieram do anterior — confira)
            </span>
          )}
        </div>

        {/* A estrada OCUPA a equipe: um dia de quatro visitas espalhadas pela
            cidade apareceria como meio dia livre se o deslocamento não
            contasse, e a grade convidaria a marcar a quinta. Nesta fase ele é
            DIGITADO. Calculá-lo é entrega própria e está descrita em
            docs/PENDENCIAS_TECNICAS.md — ela precisa de uma chave de serviço de
            rota que ainda não existe no ambiente. */}
        <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary }}>
          A equipe ocupa {duracaoTexto((numeroOuNulo(servico) ?? 0) + desloc)} do dia: o deslocamento vem ANTES do serviço e conta na jornada.
          {proposta !== null && !bloco && ` Sugestão de início: ${horaTexto(proposta)}.`}
        </span>

        {/* OS de fora do sistema: só aparece quando não há chamado. Ela existe
            porque `chamados.cliente_id` é NOT NULL — serviço para quem não está
            na base de clientes não CABE num chamado, mas ocupa a equipe igual. */}
        {!chamadoId && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
            <div>
              <label style={rotulo}>Nº da OS</label>
              <input value={osExterna} onChange={(e) => setOsExterna(e.target.value)} style={entrada} placeholder="OS-9911" />
            </div>
            <div>
              <label style={rotulo}>O que é este serviço</label>
              <input value={tituloExterno} onChange={(e) => setTituloExterno(e.target.value)} style={entrada} placeholder="Portão do condomínio vizinho" />
            </div>
          </div>
        )}

        {/* A CAIXA DE ERRO — no formulário, nomeando o obstáculo. Nunca um toast
            solto: o toast some, e o que ele dizia era a única pista de por que o
            gesto morreu. */}
        {erro && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 14px", borderRadius: 12,
            background: rostoDoErro.bg, border: `1px solid ${rostoDoErro.borda}`,
            fontFamily: FONT, fontSize: 12.5, color: rostoDoErro.cor,
          }}>
            {classe === "permissao" ? <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              : <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span style={{ minWidth: 0 }}>
              {erro.frase}
              {classe === "permissao" && (
                <>
                  <br />
                  <span style={{ opacity: 0.85 }}>{EXPLICACAO.PERM.oQueFazer}</span>{" "}
                  {/* o código carrega o SQLSTATE da RPC, não um hash da frase:
                      `classificarErro` lê `code`, e sem ele o 42501 viraria
                      PRV-CHM-APP-<hash>, que não diz que foi permissão. */}
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10 }}>
                    {codigoDeErro({ message: erro.frase, code: erro.code ?? "42501" }, rota)}
                  </span>
                </>
              )}
              {classe === "conflito" && (
                <>
                  <br />
                  <span style={{ opacity: 0.85 }}>Se isto apareceu de repente, outra pessoa marcou agora mesmo — recarregue a grade e refaça o gesto.</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* ações do bloco vivo */}
        {bloco && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => baixar(bloco.cumprido_em === null)} disabled={emVoo} style={secundario}>
              <Check size={13} /> {bloco.cumprido_em === null ? "Marcar como feito" : "Tirar o “feito”"}
            </button>
            <button onClick={desmarcar} disabled={emVoo} style={secundario}>
              <X size={13} /> Desmarcar
            </button>
            {chamado && (
              <button onClick={tirarDaAgenda} disabled={emVoo} style={secundario}>
                <Trash2 size={13} /> Tirar da agenda
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={aoFechar} style={{ ...secundario, height: 46, borderRadius: 23, flex: 1, justifyContent: "center" }}>
            Fechar
          </button>
          <button
            onClick={gravar}
            disabled={emVoo || !!erroLocal || !!impossivel}
            style={{
              flex: 2, height: 46, borderRadius: 23, border: "none", background: GOLD_GRAD,
              color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
              cursor: emVoo || erroLocal || impossivel ? "default" : "pointer",
              opacity: emVoo || erroLocal || impossivel ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {emVoo && <Loader2 size={14} className="animate-spin" />}
            {bloco ? "Salvar horário" : abertura.restantes > 0 ? `Marcar e ir para o próximo (${abertura.restantes})` : "Marcar horário"}
          </button>
        </div>
        {semMudanca && (
          <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, textAlign: "center" }}>
            Nada mudou neste bloco — salvar aqui não gera gravação.
          </span>
        )}
        {abertura.restantes > 0 && !bloco && (
          <span style={{ fontFamily: FONT, fontSize: 10.5, color: gold, textAlign: "center" }}>
            Ainda faltam {abertura.restantes} sem horário neste dia. Ao gravar, o formulário abre o próximo mantendo equipe, duração e deslocamento.
          </span>
        )}
      </div>
    </div>
  );
}
