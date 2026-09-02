// Programação da equipe de campo — U3 (o dia), R57 (os filtros), U79 (a grade).
//
// ── O ÂNGULO: UMA ESTRUTURA, DUAS PROJEÇÕES ───────────────────────────────
// `linhasDaGrade` é chamada UMA VEZ, com os `dias` da SEMANA INTEIRA. A GRADE
// desenha todas as colunas; o DIA desenha uma (`celulas.find`). São o mesmo
// objeto. É o que o próprio modelo puro anuncia em `celulaDaGrade`: "o átomo…
// tudo o mais neste arquivo é composição disto — inclusive a grade da semana e
// a lista do celular, que é a razão de o átomo existir".
//
// A U3 escolheu programar por DIA "porque a grade não cabe na tela do celular,
// que é onde o Vinicius trabalha" (docs/PLANO_UNIFICACAO.md:686-688), e ele
// construiu a grade depois no sistema dele. Os dois estão certos, e por isso
// "grade" é o TERCEIRO valor do mesmo seletor de lente — não uma rota nova,
// não uma tela nova, nada para reaprender. Trocar de modo continua sendo trocar
// a lente, não a tela: os três leem o MESMO `dia`.
//
// ── A COSTURA DOS DOIS EIXOS DE SEMANA NÃO FOI COSTURADA: FOI REMOVIDA ────
// A régua desta tela ia de DOMINGO (`base.getDate() - base.getDay()`) e a
// escala é ISO (segunda). O arquivo assumia a contradição por escrito ("o
// domingo da régua pertence à semana anterior") e resolvia chamado por chamado.
// A régua agora é ISO, ancorada em `inicioSemana` — a mesma função do resto do
// sistema. Conferido, e é por isso que a troca é segura: para um DOMINGO,
// `inicioSemana` desloca −6 (a segunda anterior) e `semanaIso` joga para a
// quinta daquela mesma semana. `referenciaSemanal(domingo)` e
// `inicioSemana(domingo)` SEMPRE concordaram; quem criava o desencontro era a
// régua Sunday-first. Trocada a régua, os dois eixos são um eixo só.
//
// A vista MENSAL continua domingo→sábado, e a assimetria é declarada: a régua
// semanal fala de SEMANA (por isso é ISO); o mensal fala de MÊS e de DIA, não
// carrega chip de semana nenhum, e no Brasil um calendário se lê a partir de
// domingo.
//
// ── ESTA TELA NÃO CALCULA NADA ────────────────────────────────────────────
// Saíram daqui, para `features/programacao/modelo.ts`: `chaveDia` (era cópia de
// `dataIso`), a régua domingo→sábado, o `emAberto` cru, o balde-por-dia por
// comparação de `new Date(iso)` (que resolvia no fuso do NAVEGADOR em oito
// lugares), a `cargaPorDia` que contava CABEÇAS, o `porGrupo` com o balde nulo
// faltando, e a mutação `programar` inteira. O que sobra é orquestração,
// pixel e gesto.
//
// ── E ELA NÃO ESCREVE MAIS `chamados.data_hora_agendada` ─────────────────
// A coluna virou ESPELHO derivado (R101), mantido por gatilho. Quem escreve
// agenda de campo são as quatro portas da U78, abertas pela U79. `12:00` como
// SENTINELA morreu junto com o `new Date(\`${d}T12:00:00\`)` desta tela.

import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useTecnicos } from "@/features/gerencial/data";
import { useChamadosPorNatureza, useChamadosRealtime, type Chamado } from "@/features/chamados/data";
import { useSessao } from "@/features/home/data";
import { useDuplas, useEscala } from "@/features/duplas/data";
import {
  composicaoDaDupla, montarEscala, rotuloDaComposicao, rotuloDaOrigem,
} from "@/features/duplas/modelo";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { dataIso, inicioSemana, referenciaSemanal } from "@/lib/periodos";
import {
  TIPO_LABEL, TIPOS_DEMANDA_CAMPO, type ChamadoTipo,
} from "@/lib/chamado-status";
import {
  blocosForaDaGrade,
  chamadosParaGrade,
  classificarChamado,
  dataDoDia,
  diasDaGrade,
  divergenciasDoCiclo,
  duracaoTexto,
  erroDoAgendamento,
  idsComCicloFinanceiro,
  linhasDaGrade,
  parDoInstante,
  resumoDoCiclo,
  retornosPendentes,
  rotuloDoBloco,
  selosDaGrade,
  textoDoDia,
  type BlocoCandidato,
  type BlocoDeAgenda,
  type ContextoDoAgendamento,
  type ContextoDoTexto,
  type ItemDaGrade,
  type LinhaDaGrade,
} from "@/features/programacao/modelo";
import {
  useAutorizacaoDaAgenda, useBlocosDaGrade, useChamadosComBloco,
  useLancamentosDosChamados, useMarcarBloco, sqlstateDoErro,
} from "@/features/programacao/data";
import { useVeFinanceiro } from "@/features/gerencial/data";
import { GradeSemana, type RotulosDaEquipe } from "@/features/programacao/GradeSemana";
import { BotoesDeCompartilhar, ColunaDoDia } from "@/features/programacao/ColunaDoDia";
import { SELO_LABEL } from "@/features/programacao/CelulaDaGrade";
import {
  FaixaSemHorario, FilaSemData, RetornosPendentes, type ChamadoDaFila,
} from "@/features/programacao/FaixaSemHorario";
import { FormularioDoBloco, type AberturaDoFormulario } from "@/features/programacao/FormularioDoBloco";
import { PainelDoCiclo } from "@/features/programacao/PainelDoCiclo";

type ModoDeVisao = "semanal" | "mensal" | "grade";
const MODOS: ModoDeVisao[] = ["semanal", "mensal", "grade"];

export const Route = createFileRoute("/_authenticated/chamados/programacao")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("chamados.programacao");
    if (!ok) throw redirect({ to: destinoNegado("chamados.programacao") as any });
  },
  // O ESTADO SAI PARA A URL. Nada era persistido antes, e trocar de tela perdia
  // o dia aberto e os filtros. Num quadro compartilhado, "olha a quinta da
  // Equipe B" é o link mais pedido e o único que não existia.
  validateSearch: (s: Record<string, unknown>) => ({
    dia: typeof s.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.dia) ? s.dia : undefined,
    modo: MODOS.includes(s.modo as ModoDeVisao) ? (s.modo as ModoDeVisao) : undefined,
    equipe: typeof s.equipe === "string" ? s.equipe : undefined,
    tipo: typeof s.tipo === "string" ? s.tipo : undefined,
    chamado: typeof s.chamado === "string" ? s.chamado : undefined,
  }),
  component: ProgramacaoPage,
});

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MES_NOME = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Os seletores de filtro falam a mesma língua visual. Função de `(isLight)`
 *  porque constante de estilo em nível de módulo não enxerga tema (§8 do
 *  design system, anti-padrão nº 4). */
const SELETOR_FILTRO = (isLight: boolean, textPrimary: string): CSSProperties => ({
  height: 38, borderRadius: 999, padding: "0 13px", cursor: "pointer",
  background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
  border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
  color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 12,
  outline: "none", colorScheme: isLight ? "light" : "dark",
});

/**
 * O que está sendo arrastado. Vai num `useRef` e nunca em state (R87/U21): o
 * `dataTransfer` só carrega o id, porque `getData` não funciona no `dragover`.
 *
 * SÓ BLOCO. Arrastar um cartão da FAIXA "sem horário" para dentro de uma célula
 * seria um acelerador bom para a migração, e não está construído — ele foi
 * cortado, e não esquecido: o gesto do arrasto exprime (equipe, dia), e um
 * chamado da faixa precisa ainda de DURAÇÃO, que só o formulário pergunta. Ele
 * abriria o formulário do mesmo jeito, com dois campos a menos para digitar, e
 * o preço seria uma união de tipos no ref para economizar dois cliques. Se a
 * migração da base mostrar que vale, é um `tipo: "chamado"` aqui e um wrapper
 * `draggable` na faixa.
 */
type Arrastado = { tipo: "bloco"; item: ItemDaGrade };

function ProgramacaoPage() {
  const navigate = useNavigate();
  const busca = Route.useSearch();
  const { isLight } = useTheme();

  // ── as consultas ────────────────────────────────────────────────────────
  // A lista de chamados vai COMPLETA e sem filtro para a grade, e isso não é
  // descuido: `chamadoOculto` é `chamado_id !== null && !chamado`
  // (modelo.ts:1582), então um bloco de chamado CONCLUÍDO que não esteja na
  // lista entregue vira "Outro atendimento" no cartão e `divergencia: null`. A
  // tela antiga filtrava cedo (`emAberto`) e passava a lista filtrada para tudo
  // abaixo; repetir aquilo faria o rótulo mentir. Só os BALDES usam
  // `naProgramacao`, por dentro de `classificarChamado`.
  const { data: ordens = [], isLoading } = useChamadosPorNatureza("campo");
  const { data: tecnicos = [] } = useTecnicos();
  const { data: duplas = [] } = useDuplas();
  const { data: escala = montarEscala([], []), isPending: escalaPendente } = useEscala();
  const { data: sessao } = useSessao();

  // O quadro é COMPARTILHADO, e `agenda_campo` NÃO foi adicionada à publicação
  // do realtime pela U78 — uma inscrição em tabela fora da publicação conecta,
  // fica viva e nunca dispara, que é pior do que não existir (o repo já pagou
  // por isso: chamados/data.ts:746-751). Então o canal aqui é o de `chamados`,
  // que acorda quando o ESPELHO escreve. O que ele NÃO cobre, dito para ninguém
  // supor o contrário: mover um bloco sem mudar o valor espelhado (uma correção
  // de duração, um bloco que não é o mais antigo pendente) não dispara evento
  // nenhum. O resto é `staleTime` curto e foco de janela.
  useChamadosRealtime();

  const hojeIso = dataIso(new Date());
  const dia = busca.dia ?? hojeIso;
  const modo: ModoDeVisao = busca.modo ?? "semanal";
  const duplaFiltro = busca.equipe ?? "todas";
  const tipoFiltro = busca.tipo ?? "todos";

  const irPara = (patch: Record<string, string | undefined>) =>
    navigate({
      to: "/chamados/programacao",
      search: (s: Record<string, unknown>) => ({ ...s, ...patch }),
      replace: true,
    } as any);
  const setDia = (d: string) => irPara({ dia: d });

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const CARD: CSSProperties = { ...card(isLight), padding: "14px 16px" };

  const dataDoAberto = dataDoDia(dia) ?? new Date();
  const semanaAberta = referenciaSemanal(dataDoAberto);

  // ── os blocos ───────────────────────────────────────────────────────────
  const { blocos, idsDeChamado } = useBlocosDaGrade(dia);

  /**
   * O denominador da faixa. `classificarChamado` precisa saber se o chamado tem
   * bloco EM QUALQUER TEMPO, e não na janela desenhada — sem isto, um chamado
   * cujo único bloco está a três meses cai na faixa "sem horário" e o botão
   * "Dar horário" cria um SEGUNDO bloco, que a U78 lê como RETORNO.
   *
   * A MESMA resposta traz agora os DOIS Sets (U80): `ativos` é o de sempre, e
   * `pendentes` é o que ainda VAI acontecer. O chamado que está no primeiro e
   * não no segundo é um RETORNO PENDENTE — visita cumprida, atendimento aberto,
   * nada marcado à frente —, que era invisível em toda superfície desta tela.
   */
  const idsComData = useMemo(
    () => ordens.filter((c) => c.data_hora_agendada).map((c) => c.id),
    [ordens],
  );
  const VAZIO = useMemo(() => ({ ativos: new Set<string>(), pendentes: new Set<string>() }), []);
  const { data: comBlocoDados = VAZIO } = useChamadosComBloco(idsComData);
  const comBloco = comBlocoDados.ativos;

  /**
   * TRADUÇÃO DE DADOS, E NÃO MAIS UM `as unknown as`. Aquela dupla asserção
   * desligava o typechecker: `faturamento_status` (obrigatório desde a U80)
   * chegaria como `undefined` sem o `tsc` nem o CENSO dizerem nada, e o selo
   * cairia num ramo que ninguém escreveu.
   */
  const paraGrade = useMemo(
    () => chamadosParaGrade(ordens as unknown as Array<Record<string, unknown>>),
    [ordens],
  );
  const autz = useAutorizacaoDaAgenda(sessao?.userId ?? null, ordens as any[]);
  const { data: veFinanceiro = false } = useVeFinanceiro();

  /**
   * O CICLO FINANCEIRO — UMA chamada por semana carregada, e só sobre os
   * chamados cujo selo depende dela (campo + concluído). `Map` vazio é o "não
   * sei": para quem não é gestor a RPC devolve zero linhas e a grade fica
   * exatamente como era antes desta entrega.
   */
  const idsDoCiclo = useMemo(() => {
    // `blocos` é o SUPERSET (semana + irmãos de outras semanas, que o ordinal
    // precisa). A pergunta é sobre o que a SEMANA desenha, e é por isso que
    // `useBlocosDaGrade` passou a devolver `idsDeChamado`.
    const daSemana = new Set(idsDeChamado);
    return idsComCicloFinanceiro(
      blocos.filter((b) => b.chamado_id !== null && daSemana.has(b.chamado_id)),
      paraGrade,
    );
  }, [blocos, idsDeChamado, paraGrade]);
  // O vazio é ESTÁVEL (e não `= new Map()` no destructuring): um objeto novo a
  // cada render trocaria a identidade da dependência e faria os três `useMemo`
  // do ciclo recalcularem sempre — a mesma razão do `VAZIO` acima.
  const SEM_LANCAMENTOS = useMemo(() => new Map<string, boolean>(), []);
  const { data: lancamentos = SEM_LANCAMENTOS } = useLancamentosDosChamados(idsDoCiclo);

  // ── A CHAMADA ÚNICA ─────────────────────────────────────────────────────
  // `dias ∪ {dia}`: sem a união, escolher um sábado VAZIO na régua (que é
  // exatamente o gesto de marcar o primeiro bloco nele) tiraria o dia
  // selecionado das colunas — e o celular, que faz `celulas.find`, não acharia
  // célula nenhuma.
  const dias = useMemo(
    () => [...new Set([...diasDaGrade(dataDoAberto, blocos, dataIso), dia])].sort(),
    [dia, blocos],
  );
  const linhas = useMemo(
    () => linhasDaGrade(duplas, semanaAberta, dias, blocos, paraGrade, escala, referenciaSemanal),
    [duplas, semanaAberta, dias, blocos, paraGrade, escala],
  );

  /**
   * O GUARDA DOS DOIS LADOS, avaliado sobre a saída CRUA do modelo (nunca sobre
   * as linhas já filtradas pela tela): ele prova que `linhasDaGrade` não perdeu
   * nem inventou bloco. Quando o usuário filtra, a grade passa a mostrar menos
   * DE PROPÓSITO, e quem diz isso é o "· filtrado" do cabeçalho — não este
   * número. Tem de ser sempre {0, 0}.
   */
  const guarda = useMemo(
    () => blocosForaDaGrade(linhas, semanaAberta, blocos, referenciaSemanal),
    [linhas, semanaAberta, blocos],
  );

  /**
   * O guarda do ciclo, gêmeo de desenho de `blocosForaDaGrade`: decidido
   * (`aprovada`/`faturada`) e sem lançamento vivo. O cartão SE CALA nesse
   * estado — pintar "Lançado" afirmaria o que não existe, e pintar "nada a
   * cobrar" entregaria o cancelamento por inferência a quem não vê valores. A
   * faixa é gateada por `veFinanceiro` porque as duas conversas possíveis
   * (cancelaram; ou está corrompido) são de quem vê valores.
   *
   * SOBRE `linhas`, E NÃO SOBRE AS VISÍVEIS — é o mesmo critério do guarda
   * acima, e pelo mesmo motivo: filtrar por equipe é escolha de quem olha, e
   * uma corrupção não pode se esconder atrás de um filtro. Os SELOS são o
   * contrário (abaixo), porque eles são o que está DESENHADO.
   */
  const divergenciasCiclo = useMemo(
    () => (veFinanceiro ? divergenciasDoCiclo(linhas, lancamentos) : []),
    [veFinanceiro, linhas, lancamentos],
  );

  // ── nomes e rótulos ─────────────────────────────────────────────────────
  const nomePorTecnico = useMemo(
    () => Object.fromEntries((tecnicos as any[]).map((t) => [t.id, t.nome ?? "—"])) as Record<string, string>,
    [tecnicos],
  );
  const nomeDeTecnico = (id: string) => nomePorTecnico[id] ?? "Técnico";
  const duplaPorId = useMemo(() => new Map(duplas.map((d) => [d.id, d])), [duplas]);

  const rotulos: RotulosDaEquipe = {
    nome: (id) => {
      const d = duplaPorId.get(id);
      const membros = composicaoDaDupla(id, semanaAberta, escala);
      return d ? rotuloDaComposicao(d, membros, nomeDeTecnico) : "Equipe fora do cadastro";
    },
    sub: (id) => {
      const membros = composicaoDaDupla(id, semanaAberta, escala);
      return membros.length > 0 ? membros.map(nomeDeTecnico).join(" · ") : null;
    },
    // O selo de escala HERDADA vem de `rotuloDaOrigem` (duplas/modelo.ts:261) —
    // "ninguém confirmou a escala desta semana, esta é a da semana tal".
    origem: (l) => (l.herdada ? rotuloDaOrigem(l.semanaOrigem, l.semana) : null),
  };

  /** As equipes que TÊM composição na semana aberta — o filtro e o formulário. */
  const equipesDaSemana = useMemo(
    () => duplas
      .map((d) => ({ id: d.id, membros: composicaoDaDupla(d.id, semanaAberta, escala) }))
      .filter((x) => x.membros.length > 0)
      .map((x) => ({ id: x.id, rotulo: rotulos.nome(x.id) })),
    [duplas, semanaAberta, escala, nomePorTecnico],
  );

  // ── os filtros ──────────────────────────────────────────────────────────
  //
  // O FILTRO DE EQUIPE ESCONDE LINHAS; O DE TIPO ESMAECE CARTÕES. Não é
  // capricho, é a única forma de filtrar sem mentir num número:
  //   · esconder uma LINHA é honesto — a linha é uma equipe inteira, e o chip
  //     de ocupação das que ficam não muda;
  //   · tirar CARTÕES da célula mudaria `linha.ocupacao`, e o chip passaria a
  //     dizer "20% da semana" para uma equipe que está a 68% — um percentual
  //     sobre base fixa não sobrevive a um recorte. Então o tipo APAGA em vez de
  //     remover: o cartão continua contando e continua desenhado.
  // Os dois filtram as duas FILAS por inteiro, que são listas e não têm
  // denominador.
  const filtrando = tipoFiltro !== "todos" || duplaFiltro !== "todas";
  const linhasVisiveis = useMemo(() => {
    if (duplaFiltro === "todas") return linhas;
    if (duplaFiltro === "sem_equipe") return linhas.filter((l) => !l.ocupacao.comEscala);
    return linhas.filter((l) => l.duplaId === duplaFiltro);
  }, [linhas, duplaFiltro]);

  /**
   * A GRADE DO TÉCNICO NÃO PODE VIRAR UM MURO CINZA. `agenda_campo_select` é
   * `USING (true)` — decisão declarada da U78, porque sem ela o chip da equipe
   * dele mostraria 40% onde há 90% — mas `chamados_select` NÃO é aberta. Para
   * quem não é gestor, `chamadoOculto` é verdadeiro na maioria dos cartões
   * alheios, e a grade seria três linhas de retângulos escritos "Outro
   * atendimento".
   *
   * A saída óbvia — colapsar a linha alheia numa barra SEM cartões — é
   * proibida por `blocosForaDaGrade`: bloco não desenhado conta como
   * `naoMostrados`. Então a linha colapsada DESENHA os blocos, como segmentos
   * posicionados pela mesma janela, com o rótulo só no `title`. O guarda que
   * parecia obstáculo produziu a renderização certa: é o mesmo eixo, sem os
   * rótulos. Ver `CelulaDaGrade.tsx`.
   */
  const mostrarRotulos = (l: LinhaDaGrade) => {
    if (autz.ehGestor || l.ocultos === 0) return true;
    const itens = l.celulas.reduce((s, c) => s + c.itens.length, 0);
    return l.ocultos < itens; // colapsa só a linha em que TUDO é ilegível
  };

  // ── os baldes, num censo só ─────────────────────────────────────────────
  // Uma passada de `classificarChamado` produz os quatro, e é dela que saem a
  // faixa, a fila e os dois números da barra de progresso. Quem conta é quem
  // filtra, no sentido literal: é a mesma chamada.
  const baldes = useMemo(() => {
    const semHorario: ChamadoDaFila[] = [];
    const semData: ChamadoDaFila[] = [];
    let comHorario = 0;
    for (const c of ordens as unknown as ChamadoDaFila[]) {
      const classe = classificarChamado(c, comBloco.has(c.id));
      if (classe === "com_bloco") comHorario++;
      else if (classe === "sem_horario") semHorario.push(c);
      else if (classe === "sem_data") semData.push(c);
    }
    return { semHorario, semData, comHorario };
  }, [ordens, comBloco]);

  const passaTipo = (t: string | null | undefined) => tipoFiltro === "todos" || t === tipoFiltro;
  const semHorarioFiltrado = baldes.semHorario.filter((c) => passaTipo(c.tipo));
  const semDataFiltrado = baldes.semData.filter((c) => passaTipo(c.tipo));
  const semHorarioDoDia = semHorarioFiltrado.filter(
    (c) => parDoInstante(c.data_hora_agendada)?.dia === dia,
  );

  /** Ocupação e "sem horário" por dia — a régua, derivada das MESMAS células. */
  const porDia = useMemo(() => {
    const m = new Map<string, { minutos: number; pctMax: number; cartoes: number }>();
    for (const l of linhasVisiveis) {
      for (const c of l.celulas) {
        const v = m.get(c.dia) ?? { minutos: 0, pctMax: 0, cartoes: 0 };
        v.minutos += c.jornada.ocupadoMin;
        v.pctMax = Math.max(v.pctMax, c.ocupacao.pct);
        v.cartoes += c.itens.length;
        m.set(c.dia, v);
      }
    }
    return m;
  }, [linhasVisiveis]);

  const legadoPorDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of semHorarioFiltrado) {
      const d = parDoInstante(c.data_hora_agendada)?.dia;
      if (d) m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [semHorarioFiltrado]);

  const doDia = porDia.get(dia) ?? { minutos: 0, pctMax: 0, cartoes: 0 };

  // ── o ciclo financeiro: UMA origem para o cartão, o número e a lista ─────
  //
  // QUEM CONTA É QUEM FILTRA, e aqui isso é ESTRUTURAL e não disciplina: as
  // três leituras saem de `linhasVisiveis`, que é exatamente a lista que a
  // grade e a coluna do dia desenham (o filtro de equipe já aplicado).
  //   · `selos`          → o que cada cartão pinta;
  //   · `resumoCiclo`    → o "N a conferir" do cabeçalho;
  //   · `aConferirNoDia` → a lista que o número abre.
  // Computar os selos sobre `linhas` (o superset, sem filtro) daria o MESMO
  // resultado por bloco — `selosDaGrade` é determinística e o mapa é por
  // `bloco.id` —, mas dependeria dessa coincidência. Aqui é a mesma chamada.
  const selos = useMemo(() => selosDaGrade(linhasVisiveis, lancamentos), [linhasVisiveis, lancamentos]);
  const resumoCiclo = useMemo(
    () => resumoDoCiclo(linhasVisiveis, dia, lancamentos),
    [linhasVisiveis, dia, lancamentos],
  );

  /** A LISTA que o número acima conta — o MESMO mapa `selos`, filtrado ao dia. */
  const aConferirNoDia = useMemo(() => {
    const out: { chamadoId: string; rotulo: string }[] = [];
    const vistos = new Set<string>();
    for (const l of linhasVisiveis) {
      const cel = l.celulas.find((c) => c.dia === dia);
      if (!cel) continue;
      for (const item of cel.itens) {
        const id = item.bloco.chamado_id;
        if (!id || vistos.has(id)) continue;
        if (selos.get(item.bloco.id) !== "a_conferir") continue;
        vistos.add(id);
        out.push({ chamadoId: id, rotulo: item.rotulo });
      }
    }
    return out;
  }, [linhasVisiveis, dia, selos]);

  /** "quarta-feira, 03/09/2026" — formatação, e por isso mora na tela. */
  const rotuloLongoDoDia = (d: string) => {
    const data = dataDoDia(d);
    if (!data) return d;
    const semanaNome = ["domingo", "segunda-feira", "terça-feira", "quarta-feira",
                        "quinta-feira", "sexta-feira", "sábado"][data.getDay()];
    return `${semanaNome}, ${String(data.getDate()).padStart(2, "0")}/`
      + `${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
  };

  /**
   * A TERCEIRA PROJEÇÃO (R105). O texto sai das MESMAS `linhasVisiveis` — logo
   * "canceladas ficam de fora", "disponível" e a ocupação saem de graça, e o
   * texto não pode discordar da coluna: é o mesmo objeto.
   *
   * A MONTAGEM É `textoDoDia`, no modelo puro e com asserção de mutação. Esta
   * tela só INJETA os nomes, que o módulo não conhece — e `detalheDe` é o
   * ponto de vazamento que o docblock de lá vigia: para um item `oculto` a
   * função corta cliente, endereço e descrição antes de escrever a linha.
   *
   * O BOTÃO É DE GESTOR, e o argumento é do próprio texto: para um não-gestor o
   * dia sai cheio de "Outro atendimento" — honesto e inútil.
   */
  const detalhePorChamado = useMemo(() => {
    const m = new Map<string, { cliente: string | null; endereco: string | null; descricao: string | null }>();
    for (const c of ordens as any[]) {
      m.set(c.id, {
        cliente: c.cliente?.nome ?? null,
        endereco: c.cliente?.endereco ?? null,
        descricao: c.descricao_problema ?? null,
      });
    }
    return m;
  }, [ordens]);

  const textoDoDiaPronto = useMemo(() => {
    if (!autz.ehGestor) return null;
    const ctx: ContextoDoTexto = {
      rotuloDoDia: rotuloLongoDoDia,
      nomeDaEquipe: (id) => rotulos.nome(id),
      veiculoDaEquipe: (id) => duplaPorId.get(id)?.veiculo ?? null,
      membrosDaEquipe: (id) => composicaoDaDupla(id, semanaAberta, escala).map(nomeDeTecnico),
      detalheDe: (id) => detalhePorChamado.get(id) ?? null,
      // GANCHO VAZIO — o plantonista da semana é FASE 3. `null` não produz uma
      // linha sequer, e há asserção pinando exatamente isso.
      plantonista: null,
    };
    return textoDoDia(linhasVisiveis, dia, ctx, new Date());
  }, [autz.ehGestor, linhasVisiveis, dia, detalhePorChamado, duplaPorId, semanaAberta, escala, nomePorTecnico]);

  /**
   * RETORNOS PENDENTES (R106) — visita cumprida, atendimento aberto, nada
   * marcado à frente. Os dois Sets vêm da MESMA requisição de
   * `useChamadosComBloco`, em qualquer tempo: perguntar aos blocos da semana
   * responderia "nada à frente" para um retorno marcado daqui a três semanas.
   */
  const retornos = useMemo(
    () => retornosPendentes(
      ordens as unknown as ChamadoDaFila[],
      comBlocoDados.ativos,
      comBlocoDados.pendentes,
    ).filter((c) => passaTipo(c.tipo)),
    [ordens, comBlocoDados, tipoFiltro],
  );

  // ── a régua ─────────────────────────────────────────────────────────────
  // ISO, ancorada em `inicioSemana`. SETE botões FIXOS: a régua é NAVEGAÇÃO (é
  // preciso poder ir a um sábado vazio para marcar o primeiro bloco nele),
  // enquanto as COLUNAS da grade são CONTEÚDO (`diasDaGrade` só abre fim de
  // semana com bloco ativo). Os dois não são a mesma lista, de propósito.
  const semana = useMemo(() => {
    const seg = inicioSemana(dataDoAberto);
    return Array.from({ length: 7 }, (_, i) =>
      dataIso(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + i)),
    );
  }, [dia]);

  const gradeDoMes = useMemo(() => {
    const primeiro = new Date(dataDoAberto.getFullYear(), dataDoAberto.getMonth(), 1);
    const base = new Date(primeiro);
    base.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) =>
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + i),
    );
  }, [dia]);

  const deslocarSemana = (dias7: number) => {
    const d = new Date(dataDoAberto.getFullYear(), dataDoAberto.getMonth(), dataDoAberto.getDate() + dias7);
    setDia(dataIso(d));
  };

  // ── o gesto ─────────────────────────────────────────────────────────────
  const [gesto, setGesto] = useState<AberturaDoFormulario | null>(null);
  /**
   * O CICLO TEM PORTA PRÓPRIA, E ISSO É DECISÃO.
   *
   * Clicar no cartão continua abrindo o FORMULÁRIO DO BLOCO — é o gesto da
   * AGENDA, é o gesto primário desta tela nos dois viewports, e trocá-lo por
   * um painel de dinheiro faria a pessoa que só queria mover meia hora cair
   * numa decisão financeira. O ciclo entra pela lista abaixo da grade, que é
   * derivada dos MESMOS selos que os cartões mostram.
   */
  const [cicloAberto, setCicloAberto] = useState<string | null>(null);
  const [erroDoArrasto, setErroDoArrasto] = useState<{ frase: string; code: string | null } | null>(null);
  const arrastadoRef = useRef<Arrastado | null>(null);
  const [alvoArrasto, setAlvoArrasto] = useState<{ duplaId: string; dia: string } | null>(null);
  const marcar = useMarcarBloco();

  const porIdChamado = useMemo(() => new Map(paraGrade.map((c) => [c.id, c])), [paraGrade]);
  const contexto = (diaAlvo: string, bloco: BlocoDeAgenda | null, chamadoId: string | null): ContextoDoAgendamento => ({
    blocosDoDia: blocos.filter((b) => b.dia === diaAlvo),
    blocoAtual: bloco,
    chamado: chamadoId ? porIdChamado.get(chamadoId) ?? null : null,
    escala,
    chaveDaSemana: referenciaSemanal,
    rotuloDe: (b) => rotuloDoBloco(b, b.chamado_id ? porIdChamado.get(b.chamado_id) ?? null : null),
    autz,
  });

  const abrirBloco = (item: ItemDaGrade) => {
    setErroDoArrasto(null);
    setGesto({
      bloco: item.bloco, chamadoId: item.bloco.chamado_id,
      dia: item.bloco.dia, duplaId: item.bloco.dupla_id,
      servicoMin: null, deslocamentoMin: null, herdado: false, restantes: 0,
    });
  };

  const abrirNovoNaCelula = (diaAlvo: string, duplaId: string) => {
    setErroDoArrasto(null);
    setGesto({
      bloco: null, chamadoId: null, dia: diaAlvo, duplaId,
      servicoMin: null, deslocamentoMin: null, herdado: false, restantes: 0,
    });
  };

  const abrirDarHorario = (c: ChamadoDaFila, herdar?: { servicoMin: number | null; deslocamentoMin: number | null }) => {
    setErroDoArrasto(null);
    const doChamado = parDoInstante(c.data_hora_agendada)?.dia ?? dia;
    // A JANELA SEGUE O DIA JÁ NA ABERTURA, e não só quando alguém troca o
    // campo. Um chamado com data em OUTRA semana chega aqui pelos "irmãos"
    // (`useBlocosDosChamados` traz blocos de fora da semana desenhada), e o
    // formulário abriria num dia que a consulta da grade NÃO cobre: a lista
    // ficaria parcial e `erroDoAgendamento` deixaria de ver os conflitos
    // daquele dia — formulário mais permissivo que a porta, e o EXCLUDE
    // recusando depois. Navegar aqui é o mesmo gesto do `aoTrocarDia`, na porta
    // que o `aoTrocarDia` não alcança porque ninguém trocou nada.
    if (doChamado !== dia) setDia(doChamado);
    const restantes = semHorarioDoDia.filter((x) => x.id !== c.id).length;
    setGesto({
      bloco: null, chamadoId: c.id, dia: doChamado,
      duplaId: equipesDaSemana.length === 1 ? equipesDaSemana[0].id : null,
      servicoMin: herdar?.servicoMin ?? null,
      deslocamentoMin: herdar?.deslocamentoMin ?? null,
      herdado: !!herdar,
      restantes,
    });
  };

  /**
   * `?chamado=<uuid>` abre o formulário DAQUELE chamado, uma vez. É o link do
   * PainelChamado ("abrir na grade"), e ele existe porque um campo de data só
   * não consegue dizer a verdade sobre um chamado com dois blocos — a grade
   * consegue.
   *
   * A GUARDA É O QUE IMPEDE UM RETORNO ACIDENTAL: o formulário só abre em modo
   * CRIAR, e criar num chamado que JÁ TEM bloco é exatamente o segundo bloco
   * que a U78 lê como retorno. Então, com bloco, o link só leva ao DIA — e o
   * cartão está ali, para o gesto ser sobre ele.
   */
  const jaAbriuRef = useRef<string | null>(null);
  useEffect(() => {
    if (!busca.chamado || jaAbriuRef.current === busca.chamado) return;
    const c = (ordens as unknown as ChamadoDaFila[]).find((x) => x.id === busca.chamado);
    if (!c) return;
    jaAbriuRef.current = busca.chamado;
    if (comBloco.has(c.id)) return;
    abrirDarHorario(c);
  }, [busca.chamado, ordens, comBloco]);

  /**
   * SOLTAR O CARTÃO. A guarda final compara o que está DESENHADO com o destino
   * e SAI sem chamar a RPC quando são iguais — é a lição literal do
   * `Quadro.tsx:143-147`, onde soltar o card na própria coluna gravava
   * `status='aberto'` e apagava o agendamento.
   *
   * E o modelo puro é o ROTEADOR do gesto: `erroDoAgendamento` decide. `null`
   * dispara direto (que é o ponto de arrastar); não-`null` abre o FORMULÁRIO
   * com o erro já visível, em vez de um toast e um cartão que salta de volta.
   * O arrasto só sabe exprimir (equipe, dia) — os outros três campos são do
   * formulário, e é por isso que ele é o gesto primário e o arrasto é o
   * acelerador.
   */
  const soltar = (duplaId: string, diaAlvo: string, e: DragEvent) => {
    e.preventDefault();
    const a = arrastadoRef.current;
    arrastadoRef.current = null;
    setAlvoArrasto(null);
    if (!a) return;

    const b = a.item.bloco;
    if (b.dupla_id === duplaId && b.dia === diaAlvo) return; // nada mudou
    const cand: BlocoCandidato = {
      id: b.id, chamado_id: b.chamado_id, dupla_id: duplaId, dia: diaAlvo,
      inicio_min: b.inicio_min, servico_min: b.servico_min,
      deslocamento_min: b.deslocamento_min, titulo_externo: b.titulo_externo,
    };
    const recusa = erroDoAgendamento(cand, contexto(diaAlvo, b, b.chamado_id));
    const abertura: AberturaDoFormulario = {
      bloco: b, chamadoId: b.chamado_id, dia: diaAlvo, duplaId,
      servicoMin: null, deslocamentoMin: null, herdado: false, restantes: 0,
    };
    if (recusa) {
      setErroDoArrasto({ frase: recusa, code: null });
      setGesto(abertura);
      return;
    }
    marcar.mutate(
      {
        id: b.id,
        patch: { dupla_id: duplaId, dia: diaAlvo },
        valores: {
          chamado_id: b.chamado_id, dupla_id: duplaId, dia: diaAlvo,
          inicio_min: b.inicio_min, servico_min: b.servico_min,
          deslocamento_min: b.deslocamento_min,
          os_externa: b.os_externa, titulo_externo: b.titulo_externo,
        },
        atual: b,
      },
      {
        onSuccess: () => toast.success("Horário movido."),
        // A frase da RPC não morre num toast: ela abre o formulário, que é onde
        // dá para consertar o que ela apontou.
        onError: (err: unknown) => {
          setErroDoArrasto({ frase: (err as Error).message, code: sqlstateDoErro(err) });
          setGesto(abertura);
        },
      },
    );
  };

  const arrasto = {
    alvo: alvoArrasto,
    aoComecar: (item: ItemDaGrade) => { arrastadoRef.current = { tipo: "bloco", item }; },
    aoTerminar: () => { arrastadoRef.current = null; setAlvoArrasto(null); },
    aoPassarPorCima: (duplaId: string, diaAlvo: string, e: DragEvent) => {
      if (!arrastadoRef.current) return;
      e.preventDefault(); // sem isto o drop nunca dispara
      if (alvoArrasto?.duplaId !== duplaId || alvoArrasto?.dia !== diaAlvo) {
        setAlvoArrasto({ duplaId, dia: diaAlvo });
      }
    },
    aoSairDeCima: (duplaId: string, diaAlvo: string, e: DragEvent) => {
      // o `contains` é o que impede o realce de piscar ao passar sobre os filhos
      if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
      setAlvoArrasto((v) => (v && v.duplaId === duplaId && v.dia === diaAlvo ? null : v));
    },
    aoSoltar: soltar,
  };

  // ── render ──────────────────────────────────────────────────────────────
  const botaoDia = (k: string, compacto: boolean) => {
    const d = dataDoDia(k);
    const ativo = k === dia;
    const hoje = k === hojeIso;
    const carga = porDia.get(k);
    const legado = legadoPorDia.get(k) ?? 0;
    return (
      <button
        key={k}
        onClick={() => setDia(k)}
        aria-pressed={ativo}
        aria-current={ativo ? "date" : undefined}
        style={{
          flex: 1, minWidth: 0, padding: "7px 2px", borderRadius: 10, cursor: "pointer",
          border: ativo ? "none" : hoje
            ? `1px solid ${gold}`
            : isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
          background: ativo ? GOLD_GRAD : "transparent",
          color: ativo ? "#08090E" : textPrimary,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 400, opacity: 0.75 }}>
          {d ? DIA_CURTO[d.getDay()] : ""}
        </span>
        <span style={{ fontFamily: FONT, fontSize: compacto ? 13 : 14, fontWeight: 700 }}>
          {d ? d.getDate() : "?"}
        </span>
        {/* MINUTOS, e não cabeças. Uma visita de 30min e uma implantação de 6h
            contavam 1 e 1 na régua antiga — o instrumento de equilíbrio do
            Vinicius media a coisa errada. */}
        <span style={{
          fontFamily: FONT, fontSize: 9, fontWeight: 600,
          color: ativo ? "#08090E" : (carga?.minutos ?? 0) > 0 ? gold : "transparent",
        }}>
          {(carga?.minutos ?? 0) > 0 ? duracaoTexto(carga!.minutos) : "·"}
        </span>
        {/* A barra é o MÁXIMO entre as equipes daquele dia, nunca a média: duas
            equipes a 8h e uma a 0h somam "16h" e parecem saudáveis — é
            justamente a maldistribuição que a soma esconde. */}
        <span aria-hidden style={{
          width: "70%", height: 2, borderRadius: 1, marginTop: 1,
          background: ativo
            ? "rgba(8,9,14,0.35)"
            : isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)",
          overflow: "hidden", display: "block",
        }}>
          <span style={{
            display: "block", height: "100%",
            width: `${Math.min(100, carga?.pctMax ?? 0)}%`,
            background: ativo ? "#08090E" : gold,
          }} />
        </span>
        {/* o legado NUNCA em vermelho: ele é a barra de progresso da migração,
            não uma acusação */}
        <span style={{
          fontFamily: FONT, fontSize: 8.5, fontWeight: 500,
          color: ativo ? "rgba(8,9,14,0.7)" : legado > 0 ? textSecondary : "transparent",
        }}>
          {legado > 0 ? `${legado} s/ hora` : "·"}
        </span>
      </button>
    );
  };

  const filaProps = {
    onDarHorario: (c: ChamadoDaFila) => abrirDarHorario(c),
    onIrParaDia: (d: string) => setDia(d),
    onAbrirChamado: (id: string) => navigate({ to: "/chamados/$id", params: { id } }),
  };

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Voltar"
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>
            Programação da equipe técnica de campo
          </div>
          {/* QUEM CONTA É QUEM FILTRA: os três números saem do que está
              DESENHADO — as linhas visíveis e as filas já filtradas. */}
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {duracaoTexto(doDia.minutos)} marcadas · {doDia.cartoes} atendimento(s) no dia
            {semHorarioFiltrado.length > 0 && ` · ${semHorarioFiltrado.length} sem horário`}
            {semDataFiltrado.length > 0 && ` · ${semDataFiltrado.length} sem data`}
            {/* O AGREGADO DO CICLO mora AQUI, e não no `CabecalhoDaLinha`:
                aquele cabeçalho é por EQUIPE/semana e este número é por
                CHAMADO. Ele sai de `resumoDoCiclo`, sobre as MESMAS células
                que a grade desenha. */}
            {resumoCiclo.aConferir > 0 && ` · ${resumoCiclo.aConferir} a conferir`}
            {resumoCiclo.semOs > 0 && ` · ${resumoCiclo.semOs} sem OS`}
            {filtrando && " · filtrado"}
          </div>
          {/* COMPARTILHAR O DIA — o primeiro ponto de entrada, na identidade do
              dia aberto: "compartilhar ISTO" se lê sozinho. O segundo fica no
              topo da coluna do dia, que é onde a pessoa em campo está. */}
          {textoDoDiaPronto && (
            <div style={{ marginTop: 8 }}>
              <BotoesDeCompartilhar
                texto={textoDoDiaPronto}
                isLight={isLight}
                compacto
                aoCopiar={() => toast.success("Programação do dia copiada.")}
              />
            </div>
          )}
        </div>
        <button
          onClick={() => navigate({ to: "/chamados/novo-campo" })}
          aria-label="Nova atividade para técnico de campo"
          title="Nova atividade para técnico de campo"
          style={{
            width: 40, height: 40, borderRadius: 12, border: "none", background: GOLD_GRAD,
            color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
          }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* O guarda dos dois lados. Ele NUNCA deve aparecer; se aparecer, a grade
          está mostrando um número que a lista não contém, e é melhor dizer isso
          do que deixar o gestor decidir sobre um retrato incompleto. */}
      {(guarda.naoMostrados > 0 || guarda.foraDaSemana > 0) && (
        <div style={{
          ...CARD, display: "flex", alignItems: "center", gap: 9,
          background: isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)",
          border: isLight ? "1px solid rgba(177,36,46,0.22)" : "1px solid rgba(241,120,129,0.24)",
          fontFamily: FONT, fontSize: 12.5, color: isLight ? "#B1242E" : "#F17881",
        }}>
          A grade está incompleta: {guarda.naoMostrados} bloco(s) da semana não aparecem em
          nenhuma célula e {guarda.foraDaSemana} desenhado(s) não pertencem a esta semana.
          Recarregue; se continuar, avise — o número acima não pode ser confiado.
        </div>
      )}

      {/* O GUARDA DO CICLO, irmão do de cima e pela mesma razão: as DUAS
          verdades sobre "existe lançamento" — `chamados.faturamento_status` e
          `cobrancas` — discordaram. É legítimo se alguém cancelou a cobrança; é
          corrupção em qualquer outro caso, e nos dois a conversa é de quem vê
          valores. O cartão desses atendimentos fica MUDO de propósito: pintar
          um selo ali seria escolher entre duas mentiras. */}
      {divergenciasCiclo.length > 0 && (
        <div style={{
          ...CARD, display: "flex", flexDirection: "column", gap: 6,
          background: isLight ? "rgba(250,132,45,0.06)" : "rgba(250,132,45,0.07)",
          border: isLight ? "1px solid rgba(173,71,0,0.22)" : "1px solid rgba(250,132,45,0.24)",
          fontFamily: FONT, fontSize: 12.5,
          color: isLight ? "#AD4700" : "#FA842D",
        }}>
          <span>
            {divergenciasCiclo.length} atendimento(s) marcados como cobrança decidida e sem
            lançamento vivo. Ou a cobrança foi cancelada depois, ou o lançamento se perdeu — o
            cartão fica sem selo até alguém olhar.
          </span>
          <span style={{ opacity: 0.85 }}>
            {divergenciasCiclo.map((c) => c.numero ?? c.id.slice(0, 8)).join(" · ")}
          </span>
        </div>
      )}

      {/* modo + filtros */}
      <div className="barra-filtros sangra-x" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{
          display: "flex", padding: 3, borderRadius: 999, gap: 3, flexShrink: 0,
          background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
        }}>
          {MODOS.map((m) => (
            <button
              key={m}
              // A pílula "grade" só existe a partir de 1024px, e a decisão é de
              // CSS e não de `useIsMobile()`: aquele hook começa `false` no
              // primeiro render, então no celular ele daria um flash de desktop.
              className={m === "grade" ? "so-desktop" : undefined}
              onClick={() => irPara({ modo: m })}
              aria-pressed={modo === m}
              style={{
                padding: "7px 15px", borderRadius: 999, border: "none", cursor: "pointer",
                background: modo === m ? GOLD_GRAD : "transparent",
                color: modo === m ? "#08090E" : textSecondary,
                fontFamily: FONT, fontWeight: 700, fontSize: 11.5,
                letterSpacing: "0.04em", textTransform: "capitalize",
                alignItems: "center",
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <select
          value={duplaFiltro}
          onChange={(e) => irPara({ equipe: e.target.value })}
          aria-label="Filtrar por equipe de campo"
          style={{ ...SELETOR_FILTRO(isLight, textPrimary), minWidth: 150, flexShrink: 0 }}
        >
          <option value="todas">Todas as equipes</option>
          {equipesDaSemana.map((e) => (
            <option key={e.id} value={e.id}>{e.rotulo}</option>
          ))}
          <option value="sem_equipe">Sem escala nesta semana</option>
        </select>

        <select
          value={tipoFiltro}
          onChange={(e) => irPara({ tipo: e.target.value })}
          aria-label="Filtrar por tipo de demanda"
          style={{ ...SELETOR_FILTRO(isLight, textPrimary), minWidth: 175, flexShrink: 0 }}
        >
          <option value="todos">Todos os tipos</option>
          {TIPOS_DEMANDA_CAMPO.map((t) => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>

        {filtrando && (
          <button
            onClick={() => irPara({ equipe: undefined, tipo: undefined })}
            style={{
              padding: "8px 13px", borderRadius: 999, cursor: "pointer", flexShrink: 0,
              background: "transparent", color: textSecondary,
              border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
              fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* A RÉGUA — a mesma de sempre, com o eixo consertado e a carga em
          MINUTOS. Ela é o instrumento de equilíbrio do Vinicius e não foi
          trocada por outra coisa (U3). */}
      {modo === "mensal" ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setDia(dataIso(new Date(dataDoAberto.getFullYear(), dataDoAberto.getMonth() - 1, 1)))}
              aria-label="Mês anterior"
              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{
              flex: 1, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 13.5,
              color: textPrimary, textTransform: "capitalize",
            }}>
              {MES_NOME[dataDoAberto.getMonth()]} de {dataDoAberto.getFullYear()}
            </span>
            <button
              onClick={() => setDia(dataIso(new Date(dataDoAberto.getFullYear(), dataDoAberto.getMonth() + 1, 1)))}
              aria-label="Próximo mês"
              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {DIA_CURTO.map((d) => (
              <span key={d} style={{
                textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 9,
                letterSpacing: "0.08em", textTransform: "uppercase", color: textSecondary,
                paddingBottom: 2,
              }}>
                {d}
              </span>
            ))}
            {gradeDoMes.map((d) => {
              const k = dataIso(d);
              const doMes = d.getMonth() === dataDoAberto.getMonth();
              return (
                <span key={k} style={{ opacity: doMes || k === dia ? 1 : 0.35, display: "flex" }}>
                  {botaoDia(k, true)}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => deslocarSemana(-7)}
            aria-label="Semana anterior"
            style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
          >
            <ChevronLeft size={18} />
          </button>
          {semana.map((k) => botaoDia(k, false))}
          <button
            onClick={() => deslocarSemana(7)}
            aria-label="Próxima semana"
            style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex", padding: 4 }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* A FAIXA — logo abaixo da régua e acima da grade, nos dois modos. */}
      <FaixaSemHorario
        doDia={semHorarioDoDia}
        todos={semHorarioFiltrado}
        comHorario={baldes.comHorario}
        isLight={isLight}
        {...filaProps}
      />

      {/* A GRADE (desktop) e A COLUNA (celular) — a MESMA `linhas`. */}
      {isLoading || escalaPendente ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Carregando…
        </div>
      ) : (
        <>
          {modo === "grade" && (
            <div className="so-desktop" style={{ flexDirection: "column" }}>
              <GradeSemana
                linhas={linhasVisiveis}
                dias={dias}
                isLight={isLight}
                rotulos={rotulos}
                diaAberto={dia}
                mostrarRotulos={mostrarRotulos}
                selos={selos}
                onAbrirItem={abrirBloco}
                onNovoNaCelula={abrirNovoNaCelula}
                arrasto={autz.ehGestor || autz.usuarioId ? arrasto : undefined}
              />
            </div>
          )}
          {/* O CELULAR NUNCA FICA SEM PROJEÇÃO, e este envelope é a razão.
              `.so-desktop` é `display:none !important` abaixo de 1024px, então
              com `?modo=grade` a grade some — e, quando a coluna do dia era
              `modo !== "grade"`, sumia junto: entre a faixa e a fila não
              sobrava NADA, sem uma palavra. E é o link mais provável de chegar
              ao celular, porque é o que o gestor manda do desktop ("olha a
              quinta da Equipe B") — a razão declarada de o estado ter ido para
              a URL. Em `grade` o celular cai para o DIA, que é a doutrina da
              U3: a mesma `linhas`, uma célula em vez de cinco. */}
          <div
            className={modo === "grade" ? "so-celular" : undefined}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <ColunaDoDia
              linhas={linhasVisiveis}
              dia={dia}
              isLight={isLight}
              rotulos={rotulos}
              mostrarRotulos={mostrarRotulos}
              selos={selos}
              textoParaCompartilhar={textoDoDiaPronto}
              aoCopiar={() => toast.success("Programação do dia copiada.")}
              onAbrirItem={abrirBloco}
              onNovoNaCelula={abrirNovoNaCelula}
            />
            {linhasVisiveis.length > 0 && doDia.cartoes === 0 && (
              <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "22px 16px" }}>
                <CalendarClock size={24} color={gold} />
                <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>
                  {filtrando ? "Nada marcado neste dia com esse filtro" : "Nada marcado neste dia"}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
                  {filtrando
                    ? "Limpe os filtros acima para ver o dia inteiro."
                    : "Use a faixa e a fila para dar horário ao que ainda não tem."}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* O CICLO FINANCEIRO DO DIA (R104) — a porta do painel de conclusão.
          A lista é a MESMA origem do "N a conferir" do cabeçalho, e o painel é
          quem roteia por estado: com análise aponta para a conferência, sem
          análise oferece lançar, e "conferir depois" existe sempre. O cartão
          NUNCA lança — ele mostra o selo e aponta. */}
      {aConferirNoDia.length > 0 && (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
              textTransform: "uppercase", color: gold,
            }}>
              {SELO_LABEL.a_conferir} ({aConferirNoDia.length})
            </span>
          </div>
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            Atendimentos deste dia que acabaram e cuja cobrança ninguém decidiu.
          </span>
          {aConferirNoDia.map((x) => (
            <div
              key={x.chamadoId}
              style={{
                padding: "10px 12px", borderRadius: 12,
                background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}
            >
              <span style={{ flex: 1, minWidth: 140, fontFamily: FONT, fontSize: 13, color: textPrimary }}>
                {x.rotulo}
              </span>
              <button
                onClick={() => setCicloAberto(x.chamadoId)}
                style={{
                  padding: "8px 12px", borderRadius: 10, cursor: "pointer", minHeight: 36,
                  background: isLight ? "#ffffff" : "rgba(255,255,255,0.05)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                  color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 11,
                }}
              >
                Decidir cobrança
              </button>
            </div>
          ))}
        </div>
      )}

      {/* RETORNOS PENDENTES (R106) — entre a grade e a fila sem data, ordenado
          por quanto plano existe: sem hora → grade → retorno sem data marcada →
          sem plano nenhum. */}
      <RetornosPendentes lista={retornos} isLight={isLight} {...filaProps} />

      <FilaSemData lista={semDataFiltrado} isLight={isLight} {...filaProps} />

      {cicloAberto && (
        <PainelDoCiclo
          chamadoId={cicloAberto}
          isLight={isLight}
          aoFechar={() => setCicloAberto(null)}
          aoAbrirChamado={(id) => navigate({ to: "/chamados/$id", params: { id } })}
        />
      )}

      {gesto && (
        <FormularioDoBloco
          key={`${gesto.bloco?.id ?? "novo"}-${gesto.chamadoId ?? "sem"}-${gesto.dia}-${gesto.duplaId ?? ""}`}
          abertura={gesto}
          erroInicial={erroDoArrasto}
          aoFechar={() => { setGesto(null); setErroDoArrasto(null); }}
          aoGravar={(valores) => {
            setErroDoArrasto(null);
            // "DAR HORÁRIO EM SÉRIE": o formulário não fecha; ele avança para o
            // próximo do mesmo dia mantendo equipe, duração e deslocamento como
            // valor INICIAL — visível e editável. Repetição é o único lugar em
            // que um número inicial é honesto: é a última coisa que ESTA pessoa
            // digitou, não algo que o sistema inventou.
            const restantes = semHorarioDoDia.filter((c) => c.id !== gesto.chamadoId);
            if (!gesto.bloco && gesto.chamadoId && restantes.length > 0) {
              abrirDarHorario(restantes[0], {
                servicoMin: Number.isFinite(valores.servico_min) ? valores.servico_min : null,
                deslocamentoMin: valores.deslocamento_min,
              });
              return;
            }
            setGesto(null);
          }}
          blocos={blocos}
          /* A JANELA SEGUE O CAMPO. `blocos` é `useBlocosDaGrade(dia)` — a
             semana da PÁGINA mais os irmãos —, e o campo de dia do formulário é
             livre. Trocar a data para outra semana deixava a lista PARCIAL, e
             `erroDoAgendamento` roda sobre ela: deixava de ver o conflito
             daquele dia e de somar a jornada, ou seja, o formulário ficava mais
             permissivo que a PORTA (o EXCLUDE recusava depois, com 23P01).
             Aqui o invólucro que consulta é a própria página, então
             `aoTrocarDia` é o `setDia` que ela já tem: a grade atrás do
             formulário anda junto QUANDO A SEMANA MUDA (o formulário guarda a
             chamada por semana — dentro da mesma, a consulta devolveria a mesma
             lista), e ao fechar a pessoa cai na semana em que acabou de marcar. */
          diaDosBlocos={dia}
          aoTrocarDia={setDia}
          chamados={paraGrade}
          equipes={equipesDaSemana}
          escala={escala}
          autz={autz}
          isLight={isLight}
          rota="/chamados/programacao"
        />
      )}
    </div>
  );
}
