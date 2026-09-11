// Sobreaviso — a tela (R116, U86).
//
// ── UMA ESTRUTURA, DUAS PROJEÇÕES ─────────────────────────────────────────
// `gradeDoMes` é chamada UMA VEZ, com os 28-31 dias do mês, nos DOIS
// viewports. O desktop desenha a matriz inteira; o celular faz
// `plantaoDoDia(grade, dia)` sobre o MESMO objeto. O celular NUNCA chama
// `gradeDoMes` com um dia só — se chamasse, o total do mês viraria o total do
// dia e o número passaria a mentir com a mesma cara. É a doutrina de
// `features/programacao/ColunaDoDia.tsx`.
//
// E O FALLBACK É DECLARADO: `.so-desktop` é `display:none !important` abaixo de
// 1024px. O link com `?mes=` é justamente o que o gestor manda do desktop para
// o celular de quem está de plantão — sem o fallback, ele abriria em branco. É
// a cicatriz literal da U79 (docs/PLANO_UNIFICACAO.md:5357-5364), onde a grade
// sumia e o dia sumia junto.
//
// ── ESTA TELA NÃO CALCULA ─────────────────────────────────────────────────
// Cobertura, semana padrão, ação sobre célula preenchida, quem entra na grade,
// veredito do dia e janela de leitura estão todos em
// `features/sobreaviso/modelo.ts`, com asserção. O que sobra aqui é
// orquestração, pixel e gesto.
//
// ── O GESTO DESTRUTIVO NOMEIA O QUE SE PERDE ──────────────────────────────
// Não há "tem certeza?" nesta tela. "Aplicar semana padrão" mostra os OITO
// dias com o antes, o depois e o que vai acontecer com cada um, e só a segunda
// chamada escreve — e é o BANCO que decide isso, não uma promessa do app.
// "Limpar" é assimétrico: ele lista as linhas que morreriam, com as horas de
// cada uma, e não tem caminho livre.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Eraser, FileDown, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente } from "@/features/gerencial/data";
import { FONT, card, goldButton, rotuloDeSecao } from "@/lib/ui";
import { ERRO, AVISO } from "@/lib/paleta";
import { competencia as competenciaDe, dataIso } from "@/lib/periodos";
import { ANO_CONFERIDO_ATE, conferido, somarDias } from "@/lib/feriados";
import {
  ACAO_LABEL, VEREDITO_LABEL,
  deslocarCompetencia, diasDaSemana, diasDoMes, gradeDeDias, gradeDoMes,
  plantaoDoDia, precisaConfirmar, resumoDaSemana, rotuloDaCompetencia,
  rotuloDaSemana, segundaDaSemana, semanaPadrao, semanasDoMes, trechosDaEscala,
  type TrechoDaEscala,
} from "@/features/sobreaviso/modelo";
import {
  faltaMigrationDaTroca,
  useAplicarPadrao, useDefinirCelula, useLimpar, usePessoasDoSobreaviso, useSobreaviso,
  useTrocarPlantonista,
  type LinhaDaPrevia,
} from "@/features/sobreaviso/data";
import { GradeMes, type DiaSelecionado } from "@/features/sobreaviso/GradeMes";
import { EscalaDasSemanas } from "@/features/sobreaviso/EscalaDasSemanas";
import { gerarPdfSobreaviso } from "@/features/sobreaviso/pdf";
import { PainelDoPlantao } from "@/features/plantao/PainelDoPlantao";

export const Route = createFileRoute("/_authenticated/sobreaviso")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("sobreaviso");
    if (!ok) throw redirect({ to: destinoNegado("sobreaviso") as any });
  },
  // O ESTADO VAI PARA A URL: "olha o plantão do dia 14" é o link que se manda.
  //
  // O MÊS TEM DE SER 01..12, E NÃO `\d{2}`. Entrada de URL é entrada de
  // usuário, e esta é justamente a tela cujo link o gestor cola do desktop para
  // o celular: `?mes=2026-13` fazia `diasDoMes` devolver `[]`, `diaAberto`
  // virar `undefined` e a página inteira estourar em branco, sem mensagem, num
  // `.split` de `undefined`. Apertar o regex é o conserto inteiro — o
  // `?? competenciaDe(hoje)` logo abaixo já é o fallback.
  validateSearch: (s: Record<string, unknown>) => ({
    mes: typeof s.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.mes) ? s.mes : undefined,
    dia: typeof s.dia === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s.dia) ? s.dia : undefined,
    // R253: a visão do período. Valor fora do par cai no padrão (mês).
    visao: s.visao === "semana" || s.visao === "mes" ? (s.visao as "semana" | "mes") : undefined,
  }),
  component: SobreavisoPage,
});

function SobreavisoPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const busca = Route.useSearch();
  const navegar = Route.useNavigate();

  const hoje = useMemo(() => new Date(), []);
  const mes = busca.mes ?? competenciaDe(hoje);
  // R253: o dia aberto pode ser de OUTRO mês — a semana que cobre o dia 1º
  // começa na segunda anterior, e é ela a primeira linha da faixa de escala.
  // O guarda continua (entrada de URL é entrada de usuário): o que vale agora
  // é o dia pertencer a uma das semanas que TOCAM o mês.
  const diaPedido = busca.dia ?? (competenciaDe(hoje) === mes ? dataIso(hoje) : diasDoMes(mes)[0]);
  /**
   * Todos os dias alcançáveis com este mês aberto: os do mês MAIS os das
   * semanas que o tocam. É maior que `diasDoMes` de propósito — a última
   * semana do mês tem o oitavo dia no mês seguinte, e era ele que o guarda
   * antigo recusava: clicar na última coluna da visão de semana jogava a tela
   * para o dia 1º (cinco semanas atrás).
   */
  const diasAlcancaveis = useMemo(
    () => new Set([...diasDoMes(mes), ...semanasDoMes(mes).flatMap(diasDaSemana)]),
    [mes],
  );
  const diaAberto = diasAlcancaveis.has(diaPedido) ? diaPedido : diasDoMes(mes)[0];

// ── O PERÍODO: semana ou mês (R253) ───────────────────────────────────────
  // A visão mora na URL junto do mês e do dia, pelo mesmo motivo deles: "olha a
  // semana do Breno" é um link que se manda.
  const visao: "semana" | "mes" = busca.visao ?? "mes";
  /** A segunda da semana em foco — a unidade de decisão do Vinicius. */
  const segundaFoco = segundaDaSemana(diaAberto);

  const pessoas = usePessoasDoSobreaviso();
  const escala = useSobreaviso(mes);
  const gerente = useIsGerente();
  const podeEditar = gerente.data === true;

  const definir = useDefinirCelula();
  const aplicar = useAplicarPadrao();
  const limpar = useLimpar();
  const trocar = useTrocarPlantonista();

  // R254: a barra selecionada (âncora — o trecho é derivado dela a cada
  // render) e o modo "remover dia".
  const [selecao, setSelecao] = useState<DiaSelecionado | null>(null);
  const [removendoDia, setRemovendoDia] = useState(false);

  /**
   * A grade DO QUE ESTÁ NA TELA: os 31 dias do mês ou os 8 da semana. A função
   * é a mesma (`gradeDeDias`) — o que muda é a lista de dias.
   */
  const grade = useMemo(
    () => gradeDeDias(
      visao === "semana" ? diasDaSemana(segundaFoco) : diasDoMes(mes),
      mes, pessoas.data ?? [], escala.data ?? [],
    ),
    [visao, segundaFoco, mes, pessoas.data, escala.data],
  );

  /**
   * O PDF é SEMPRE do mês — é a folha que vai para o financeiro, e ela não
   * muda de tamanho porque o gestor estava olhando uma semana. Sai da mesma
   * função, com a lista de dias do mês.
   */
  const gradeDoMesCheio = useMemo(
    () => gradeDoMes(mes, pessoas.data ?? [], escala.data ?? []),
    [mes, pessoas.data, escala.data],
  );

  /**
   * R254: os trechos contínuos — as BARRAS. Saem do modelo puro, das MESMAS
   * células que a grade desenha, para barra e números não poderem discordar.
   */
  const trechos = useMemo(
    () => trechosDaEscala(grade, escala.data ?? []),
    [grade, escala.data],
  );

  /** As semanas da faixa de escala: a do foco, ou todas as que tocam o mês. */
  const semanas = useMemo(
    () => (visao === "semana" ? [segundaFoco] : semanasDoMes(mes))
      .map((s) => resumoDaSemana(s, pessoas.data ?? [], escala.data ?? [])),
    [visao, segundaFoco, mes, pessoas.data, escala.data],
  );

  /**
   * Quem o seletor da semana oferece: quem pode ser escalado HOJE. O histórico
   * (quem saiu da empresa) continua aparecendo na grade, esmaecido, e NÃO é
   * oferecido — escalar um ex-funcionário para a semana que vem não é um
   * gesto que a tela deva permitir por distração.
   */
  const opcoesDePessoa = useMemo(
    () => grade.linhas.filter((l) => !l.pessoa.historico)
      // A COR É NEUTRA DE PROPÓSITO. Sem `cor`, o `botaoSelecao` pinta a escolha
      // com o DOURADO da marca (é o que faz sentido no Status de uma atividade,
      // onde há um botão só na tela). Aqui são cinco linhas, uma por semana: cinco
      // pílulas douradas empilhadas roubariam a atenção do único dourado que
      // importa nesta tela, o PDF — e a cor que precisa gritar é a do estado
      // ("N dias sem cobertura"), não a do nome de quem está escalado.
      .map((l) => ({ valor: l.pessoa.id, rotulo: l.pessoa.nome, cor: COR_DO_PLANTONISTA })),
    [grade.linhas],
  );

  const [padrao, setPadrao] = useState<{
    pessoaId: string; segunda: string; doBanco: LinhaDaPrevia[];
  } | null>(null);

  const textPrimary = isLight ? "#141414" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const ano = Number(mes.slice(0, 4));

  /** ‹ › — anda uma SEMANA ou um MÊS, conforme a visão (R253). */
  function andar(passo: number) {
    if (visao === "semana") {
      const nova = somarDias(segundaFoco, 7 * passo);
      navegar({ search: (s: any) => ({ ...s, mes: nova.slice(0, 7), dia: nova }), replace: true });
      return;
    }
    navegar({ search: (s: any) => ({ ...s, mes: deslocarCompetencia(mes, passo), dia: undefined }), replace: true });
  }

  // ── o gesto em massa, fase 1 ────────────────────────────────────────────
  // A PRÉVIA VEM DO BANCO, E NÃO DE UMA SEGUNDA CONTA AQUI. A RPC monta as oito
  // linhas no MESMO instantâneo em que escreveria: prévia e escrita não podem
  // discordar. Uma prévia calculada no app leria o cache de três meses e
  // discordaria justamente nas 12 semanas por ano que atravessam o mês.
  async function abrirPadrao(pessoaId: string, segunda: string) {
    try {
      const doBanco = await aplicar.mutateAsync({
        pessoa_id: pessoaId, segunda, celulas: semanaPadrao(segunda), confirmar: false,
      });
      // Sem nada a perder, a fase 1 já gravou — e a tela não pergunta o que não
      // precisa perguntar, senão treina todo mundo a clicar "sim" sem ler.
      if (!precisaConfirmar(doBanco)) {
        const n = doBanco.filter((l) => l.aplicado).length;
        toast.success(n > 0 ? `Semana aplicada: ${n} dia(s) gravado(s).` : "A semana já estava assim — nada mudou.");
        setPadrao(null);
        return;
      }
      setPadrao({ pessoaId, segunda, doBanco });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível montar a prévia da semana padrão.");
    }
  }

  async function confirmarPadrao() {
    if (!padrao) return;
    try {
      const r = await aplicar.mutateAsync({
        pessoa_id: padrao.pessoaId, segunda: padrao.segunda,
        celulas: semanaPadrao(padrao.segunda), confirmar: true,
      });
      // A CONFIRMAÇÃO PODE ESTAR CONFIRMANDO UM ESTADO QUE JÁ NÃO EXISTE.
      // Com `_confirmar = true` a RPC recalcula contra um instantâneo NOVO: se
      // outro gestor (ou o SAC) lançou horas nestes dias entre a prévia e o
      // clique, a tabela que se leu não descrevia o que foi gravado. Não há
      // realtime aqui (staleTime de 30s), então nada avisaria.
      //
      // O QUE ISTO É, DITO: post-hoc. Torna a perda ENCONTRÁVEL, não a impede.
      // A prevenção de verdade é trava otimista (mandar o `antes` esperado e
      // abortar na divergência), e isso é ACRESCENTAR mecanismo para um caso
      // que ainda não apareceu — regra 8. Fica para quando doer.
      const previsto = padrao.doBanco.map((l) => `${l.dia}:${l.antes}`).join("|");
      const real = r.map((l) => `${l.dia}:${l.antes}`).join("|");
      if (real !== previsto) {
        toast.warning("A escala MUDOU entre a prévia e a gravação — outra pessoa editou estes dias. Confira a semana antes de fechar a folha.");
      } else {
        toast.success(`${r.filter((l) => l.aplicado).length} dia(s) gravado(s).`);
      }
      setPadrao(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível aplicar a semana padrão.");
    }
  }

  // ── A TROCA DE PLANTONISTA (R254) ───────────────────────────────────────
  //
  // Davi, 11/09/2026: "quando altera o usuário selecionado para fazer o
  // plantão, as horas zeram do usuário que estava e passa para o que colocou
  // depois. Ou seja não é cumulativo entre alternância do botão."
  //
  // Três casos, um gesto só na tela:
  //  · slot VAZIO recebe um nome  → ninguém sai: é lançar a semana padrão, e
  //    esse caminho continua sendo o `aplicar_padrao`, com a prévia de duas
  //    fases para quando houver colisão;
  //  · slot COM NOME muda de nome → sai um e entra outro NA MESMA TRANSAÇÃO
  //    (RPC da U129): quem sai perde exatamente o que a semana padrão pôs, e a
  //    ponta que pertence à semana vizinha FICA;
  //  · slot COM NOME vira "Sem plantonista" → só a saída, pela mesma RPC.
  async function trocarNaSemana(segunda: string, de: string | null, para: string | null) {
    if (de === para) return;
    if (!de && para) { await abrirPadrao(para, segunda); return; }
    try {
      const linhas = await trocar.mutateAsync({
        de_pessoa: de, para_pessoa: para, segunda, celulas: semanaPadrao(segunda),
      });
      const saiu = linhas.filter((l) => l.pessoa_id === de);
      const entrou = linhas.filter((l) => l.pessoa_id === para);
      const substituidos = entrou.filter((l) => l.acao === "trocar").length;
      // O GESTO NOMEIA O QUE FEZ. Não há "tem certeza?" aqui — a volta é
      // escolher o nome de antes —, então o recibo é o aviso.
      const partes: string[] = [];
      if (para) partes.push(`${entrou.length} dia(s) para quem entrou`);
      if (de) partes.push(`${saiu.filter((l) => l.acao !== "nada").length} dia(s) tirado(s) de quem saiu`);
      toast.success(partes.join(" · ") || "Nada mudou nesta semana.");
      if (substituidos > 0) {
        toast.warning(`${substituidos} dia(s) tinham horas diferentes e foram substituídos pela semana padrão.`);
      }
    } catch (e: any) {
      if (faltaMigrationDaTroca(e)) {
        toast.error("A troca de plantonista precisa da migration U129 — ela ainda não foi rodada neste banco.");
        return;
      }
      toast.error(e?.message ?? "Não foi possível trocar o plantonista.");
    }
  }

  // ── APAGAR A BARRA (R254) ───────────────────────────────────────────────
  //
  // Davi: "Quando o usuário clica em uma barra sem estar com o seletor de DIA
  // habilitado, ele seleciona a barra inteira, e ao clicar em delete no PC
  // (Apagar ou delete) ele apaga aquela barra."
  //
  // Apaga o TRECHO — os dias contíguos daquela pessoa, nem mais nem menos —,
  // e alcança também o que foi digitado à mão (`so_padrao: false`): a barra na
  // tela é feita de horas, e mandar apagá-la e ver metade dela continuar ali
  // seria a tela desobedecendo. Sem modal: o gesto é de uma tecla, e o recibo
  // é o aviso que nomeia quantos dias e de quem.
  async function apagarTrecho(t: TrechoDaEscala) {
    const pessoa = grade.linhas.find((l) => l.pessoa.id === t.pessoaId)?.pessoa.nome ?? "essa pessoa";
    try {
      const r = await limpar.mutateAsync({
        pessoa_id: t.pessoaId, de: t.dias[0], ate: t.dias[t.dias.length - 1],
        confirmar: true, so_padrao: false,
      });
      setSelecao(null);
      toast.success(`${r.length} dia(s) de ${pessoa} apagado(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível apagar a barra.");
    }
  }

  const plantao = plantaoDoDia(grade, diaAberto);

  // ── UMA GRADE VAZIA POR FALHA É INDISTINGUÍVEL DE UM MÊS SEM NINGUÉM ─────
  // …e é a mais cara das duas. Antes daqui o único tratamento era `?? []`: uma
  // consulta que falhasse produzia a grade COMPLETA, com todos os nomes,
  // dizendo "total do mês 0 h" e "dias descobertos 31" — e o botão de PDF, sem
  // guarda nenhuma, exportava essa mentira em A4 paisagem com a faixa dourada
  // da Prever. Um PDF circula por e-mail e SOBREVIVE À TELA.
  //
  // ISTO É A REGRA 5 SENDO PROPRIEDADE DO CÓDIGO, e não do comentário da
  // migration: a U86 exige MIGRATION PRIMEIRO, PUSH DEPOIS, e na ordem
  // invertida `public.sobreaviso` não existe, a consulta volta `PGRST205` e a
  // tela passa a se auto-diagnosticar em vez de depender de alguém lembrar. Os
  // outros três momentos não dependem de ordem de deploy nenhuma: o primeiro
  // paint, a troca de mês (chave de consulta nova, `data` volta a `undefined`)
  // e o DESFAZER rodado com o front no ar.
  //
  // O BOTÃO DE PDF NÃO EXISTE nestes dois estados, porque ele está DEPOIS
  // destes returns. Não é `disabled`: é ausência.
  if (escala.isError || pessoas.isError) {
    const err: any = escala.error ?? pessoas.error;
    return (
      <Aviso isLight={isLight} tom="erro">
        <strong>A escala não pôde ser lida — isto NÃO é um mês vazio.</strong>
        <p style={{ color: textSecondary, margin: "8px 0 0" }}>
          {err?.code === "PGRST205"
            ? "public.sobreaviso ainda não existe neste banco: a migration U86 não foi rodada. Rode a migration ANTES de usar esta tela."
            : (err?.message ?? "erro desconhecido")}
        </p>
      </Aviso>
    );
  }
  if (escala.isLoading || pessoas.isLoading) {
    return <Aviso isLight={isLight} tom="neutro">Carregando a escala…</Aviso>;
  }

  return (
    // R254: a MESMA régua da Início. O atalho `padding` inline escrevia os
    // QUATRO lados e o "0" do meio zerava o `padding-left/right: var(--gutter)`
    // que a .sangra-x dá — anti-padrão nº 10, medido: o conteúdo nascia em
    // x=232 (colado na sidebar) contra 256 da Início, e a grade, que tem
    // .sangra-x PRÓPRIA, recuperava os 24px sozinha e ficava 24px à direita de
    // todo o resto DENTRO da mesma tela. Em página com classe de largura, o
    // estilo inline mexe só no eixo VERTICAL. O paddingTop 4 é o número
    // literal da Início (R178).
    <div className="sangra-x" style={{ paddingTop: 4, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── a barra do período (R253) ──────────────────────────────────────
          Título, navegação, as DUAS visões e o PDF. Nada mais: a escala tem
          faixa própria logo abaixo, e filtro esta tela não tem — quem aparece
          na grade é quem pode ser escalado, e isso não é escolha de quem olha. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{
          fontFamily: FONT, fontSize: 22, fontWeight: 700, color: textPrimary,
          margin: 0, letterSpacing: "-0.01em",
        }}>
          Sobreaviso
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
          <button
            type="button" aria-label={visao === "semana" ? "semana anterior" : "mês anterior"}
            onClick={() => andar(-1)}
            style={botaoIcone(isLight)}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontFamily: FONT, fontSize: 13, fontWeight: 700, color: textPrimary,
            minWidth: 150, textAlign: "center", fontVariantNumeric: "tabular-nums",
          }}>
            {visao === "semana" ? rotuloDaSemana(segundaFoco) : rotuloDaCompetencia(mes)}
          </span>
          <button
            type="button" aria-label={visao === "semana" ? "próxima semana" : "próximo mês"}
            onClick={() => andar(1)}
            style={botaoIcone(isLight)}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* R253 (Davi: "ele pode montar da semana ou do mês, por isso deve ter
            um botão que alterna o período"). Dois botões e não um menu: são
            dois valores, e a escolhida fica visível sem abrir nada — o mesmo
            par do Calendário (R133). */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button" aria-pressed={visao === "semana"}
            onClick={() => navegar({ search: (s: any) => ({ ...s, visao: "semana", dia: diaAberto }), replace: true })}
            style={botaoVisao(visao === "semana", isLight, textPrimary)}
          >
            <CalendarRange size={13} /> Semana
          </button>
          <button
            type="button" aria-pressed={visao === "mes"}
            onClick={() => navegar({ search: (s: any) => ({ ...s, visao: "mes" }), replace: true })}
            style={botaoVisao(visao === "mes", isLight, textPrimary)}
          >
            <LayoutGrid size={13} /> Mês
          </button>
        </div>

        <span style={{ flex: 1 }} />
        <button
          type="button"
          title="A folha do MÊS inteiro, em paisagem — é o que vai para o financeiro"
          onClick={() => gerarPdfSobreaviso(gradeDoMesCheio).catch(() => toast.error("Não foi possível gerar o PDF."))}
          style={{ ...goldButton(), height: 34, padding: "0 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
        >
          <FileDown size={14} /> PDF do mês
        </button>
      </div>

      {/* A HONESTIDADE DO CALENDÁRIO, NA TELA. O módulo não sabe quando a lei
          muda — o que ele sabe é até que ano alguém conferiu contra o decreto.
          Esconder isso faria um calendário derivado passar por conferido. */}
      {!conferido(ano) ? (
        <div
          style={{
            ...card(isLight), padding: "10px 14px", fontFamily: FONT, fontSize: 12,
            color: isLight ? AVISO.light : AVISO.dark,
          }}
        >
          O calendário de feriados foi conferido até <strong>{ANO_CONFERIDO_ATE}</strong>. Para{" "}
          {ano} as datas são <strong>derivadas</strong> (algoritmo da Páscoa + as leis já
          conhecidas) e podem divergir do decreto — confira antes de fechar a folha.
        </div>
      ) : null}

      {/* ── o resumo do período ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <Selo rotulo={visao === "semana" ? "total da semana" : "total do mês"} valor={`${grade.total} h`} isLight={isLight} />
        <Selo rotulo="dias cobertos" valor={`${grade.censo.ok}/${grade.colunas.length}`} isLight={isLight} />
        {grade.censo.curto + grade.censo.vazio > 0 ? (
          <Selo
            rotulo="dias descobertos"
            valor={String(grade.censo.curto + grade.censo.vazio)}
            cor={isLight ? ERRO.light : ERRO.dark}
            isLight={isLight}
          />
        ) : null}
      </div>

      {/* UMA ESCRITA QUE FALHOU NÃO PODE PARECER UMA QUE DEU CERTO — é a mesma
          doutrina do guarda de leitura lá em cima, aplicada à escrita. O aviso
          é DERIVADO de `definir.isError`, então ele não guarda estado próprio e
          SE LIMPA SOZINHO na próxima gravação que der certo. Um toast de quatro
          segundos não servia: quem estava digitando em outra célula não o vê, e
          a contradição entre a caixa e o total do mês sobreviveria a ele. */}
      {definir.isError ? (
        <Aviso isLight={isLight} tom="erro">
          <strong>A última célula não foi salva.</strong>
          <p style={{ color: textSecondary, margin: "6px 0 0" }}>
            {(definir.error as any)?.message ?? "erro desconhecido"} — a caixa voltou ao valor
            que está no banco. Tente de novo; se persistir, recarregue a página.
          </p>
        </Aviso>
      ) : null}

      {/* ── A ESCALA: uma linha por semana, um seletor por linha (R253) ──
          Vem ANTES da grade porque é a decisão; a grade é a conferência. */}
      <EscalaDasSemanas
        semanas={semanas}
        opcoes={opcoesDePessoa}
        isLight={isLight}
        ativa={segundaFoco}
        aoFocarSemana={(s) => navegar({
          search: (q: any) => ({ ...q, mes: s.slice(0, 7), dia: s }),
          replace: true,
        })}
        aoTrocar={podeEditar ? trocarNaSemana : undefined}
        ocupado={aplicar.isPending || limpar.isPending || trocar.isPending}
      />

      {/* ── O CALENDÁRIO DO PLANTÃO (R254) ──────────────────────────────────
          Título de seção no padrão da casa e UM botão de modo — o "remover
          dia". Tudo o mais que se faz aqui é clique na barra ou tecla. */}
      <div className="so-desktop" style={{ flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={rotuloDeSecao(isLight)}>Calendário do plantão</span>
          <span style={{ flex: 1 }} />
          {podeEditar ? (
            <button
              type="button"
              aria-pressed={removendoDia}
              onClick={() => { setRemovendoDia((v) => !v); setSelecao(null); }}
              title="Ligado, o clique num dia da barra tira o sobreaviso daquele dia"
              style={botaoVisao(removendoDia, isLight, textPrimary)}
            >
              <Eraser size={13} /> Remover dia
            </button>
          ) : null}
          <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
            {removendoDia
              ? "Clique no dia que sai da escala."
              : "Clique na barra para selecionar · Delete apaga · clique num dia vazio para lançar horas"}
          </span>
        </div>

        <GradeMes
          grade={grade}
          trechos={trechos}
          isLight={isLight}
          diaAberto={diaAberto}
          aoAbrirDia={(d) => navegar({ search: (s: any) => ({ ...s, dia: d }), replace: true })}
          selecao={selecao}
          aoSelecionar={setSelecao}
          aoRemoverTrecho={podeEditar ? apagarTrecho : undefined}
          removendoDia={removendoDia && podeEditar}
          // DEVOLVE A PROMESSA, e é isso que deixa a célula desfazer a caixa
          // quando a gravação é recusada. Com `mutate` (fogo e esquece) a
          // recusa só existia num toast de quatro segundos: a caixa seguia
          // mostrando o número digitado para sempre, o total da linha mostrava
          // o valor antigo, e o PDF — que sai do dado do servidor — saía com o
          // antigo. A tela se contradizia e quem digitou jurava ter lançado.
          aoDefinir={podeEditar
            ? (dia, pessoaId, horas) =>
                definir.mutateAsync({ dia, pessoa_id: pessoaId, horas })
            : undefined}
        />
      </div>

      {/* ── O QUE ACONTECEU: o painel do plantão (R122, U91) ───────────────
          Fica DEPOIS da grade nas duas larguras, e não numa tela própria: a
          escala é o PLANO e o atendimento é o REGISTRO, e separá-los obrigaria
          a comparar de memória. As colunas de dia são as mesmas dos dois lados
          — o mesmo `diasDoMes` gera a grade e a série. */}
      <PainelDoPlantao mes={mes} isLight={isLight} />

      {/* ── CELULAR: quem está de plantão no dia ───────────────────────── */}
      <div className="so-celular" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button" aria-label="dia anterior"
            // R254: anda DIA A DIA, inclusive virando o mês. Antes ela procurava
            // o dia na lista do mês aberto e, no dia 1º, simplesmente não fazia
            // nada — um botão mudo, que é pior que um botão ausente.
            onClick={() => {
              const d = somarDias(diaAberto, -1);
              navegar({ search: (s: any) => ({ ...s, mes: d.slice(0, 7), dia: d }), replace: true });
            }}
            style={botaoIcone(isLight)}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: textPrimary, flex: 1, textAlign: "center" }}>
            {diaAberto.split("-").reverse().join("/")}
          </span>
          <button
            type="button" aria-label="próximo dia"
            onClick={() => {
              const d = somarDias(diaAberto, 1);
              navegar({ search: (s: any) => ({ ...s, mes: d.slice(0, 7), dia: d }), replace: true });
            }}
            style={botaoIcone(isLight)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {plantao.coluna?.rotulo ? (
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {plantao.coluna.rotulo}
          </span>
        ) : null}
        {/* R254: "ninguém de sobreaviso" é uma AFIRMAÇÃO sobre o dia, e só pode
            ser feita quando o dia está na janela desenhada. Fora dela o que a
            tela sabe é que não sabe — e dizer a falta em vermelho seria inventar
            um buraco na escala de alguém. */}
        {!plantao.coluna ? (
          <div style={{ ...card(isLight), padding: "22px 14px", textAlign: "center" }}>
            <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
              Este dia está fora do período aberto — use as setas do topo.
            </span>
          </div>
        ) : plantao.quem.length === 0 ? (
          <div style={{ ...card(isLight), padding: "22px 14px", textAlign: "center" }}>
            <span style={{ fontFamily: FONT, fontSize: 13, color: isLight ? ERRO.light : ERRO.dark }}>
              Ninguém de sobreaviso neste dia.
            </span>
          </div>
        ) : (
          plantao.quem.map((q) => (
            <div key={q.pessoa.id} style={{ ...card(isLight), padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: textPrimary }}>
                {q.pessoa.nome}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: textSecondary }}>
                {q.horas}h
              </span>
            </div>
          ))
        )}
        {plantao.coluna ? (
          <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, textAlign: "center" }}>
            {plantao.coluna.somado}h de {plantao.coluna.cobertura}h — {VEREDITO_LABEL[plantao.coluna.veredito]}
          </span>
        ) : null}
      </div>

      {/* ── A CONFIRMAÇÃO DO GESTO EM MASSA: os oito números ───────────── */}
      {padrao ? (
        <Modal isLight={isLight} aoFechar={() => setPadrao(null)}>
          <h2 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: textPrimary, margin: "0 0 4px" }}>
            Aplicar a semana padrão vai SUBSTITUIR horas já lançadas
          </h2>
          <p style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, margin: "0 0 12px" }}>
            Nada foi gravado ainda. Estes são os oito dias, com o que está lá hoje e o que ficaria:
          </p>
          <TabelaDaPrevia linhas={padrao.doBanco} isLight={isLight} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button type="button" onClick={() => setPadrao(null)} style={botaoPequeno(isLight)}>
              Não gravar
            </button>
            <button
              type="button" onClick={confirmarPadrao} disabled={aplicar.isPending}
              style={{ ...goldButton(), height: 32, padding: "0 14px", fontSize: 12 }}
            >
              Gravar assim
            </button>
          </div>
        </Modal>
      ) : null}

    </div>
  );
}

// ── peças de tela ───────────────────────────────────────────────────────────

/**
 * O cartão dos dois estados em que a grade NÃO PODE SER DESENHADA — falha de
 * leitura e carregamento. Ele traz o título da tela porque uma página que
 * mostra só uma frase solta não diz onde a pessoa está; e NÃO traz o botão de
 * PDF, porque enquanto o dado não é confiável não há folha para exportar.
 */
function Aviso({ children, isLight, tom }: {
  children: React.ReactNode; isLight: boolean; tom: "erro" | "neutro";
}) {
  const textPrimary = isLight ? "#141414" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  return (
    // R254: carregando e erro na MESMA casca do conteúdo — sem isto a tela
    // saltava de lugar quando o dado chegava (x≈452 centrado → x=232).
    <div className="sangra-x" style={{ paddingTop: 4, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CalendarDays size={18} color={isLight ? "#A06108" : "#F8C811"} />
        <h1 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: textPrimary, margin: 0 }}>
          Sobreaviso
        </h1>
      </div>
      <div
        style={{
          ...card(isLight), padding: 20, fontFamily: FONT, fontSize: 13,
          color: tom === "erro" ? (isLight ? ERRO.light : ERRO.dark) : textSecondary,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TabelaDaPrevia({ linhas, isLight }: { linhas: LinhaDaPrevia[]; isLight: boolean }) {
  const textPrimary = isLight ? "#141414" : "rgba(255,255,255,0.92)";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: 12 }}>
      <thead>
        <tr style={{ color: textSecondary, textAlign: "left" }}>
          <th style={{ padding: "3px 6px", fontWeight: 600 }}>dia</th>
          <th style={{ padding: "3px 6px", fontWeight: 600, textAlign: "right" }}>hoje</th>
          <th style={{ padding: "3px 6px", fontWeight: 600, textAlign: "right" }}>ficaria</th>
          <th style={{ padding: "3px 6px", fontWeight: 600 }}>o que acontece</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.dia}>
            <td style={{ padding: "3px 6px", color: textPrimary }}>{l.dia.split("-").reverse().join("/")}</td>
            <td style={{ padding: "3px 6px", color: textSecondary, textAlign: "right" }}>
              {l.antes === null ? "—" : `${l.antes}h`}
            </td>
            <td style={{ padding: "3px 6px", color: textPrimary, textAlign: "right", fontWeight: 700 }}>{l.depois}h</td>
            <td
              style={{
                padding: "3px 6px", fontWeight: l.acao === "trocar" ? 700 : 400,
                color: l.acao === "trocar" ? (isLight ? ERRO.light : ERRO.dark) : textSecondary,
              }}
            >
              {ACAO_LABEL[l.acao]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Selo({ rotulo, valor, cor, isLight }: { rotulo: string; valor: string; cor?: string; isLight: boolean }) {
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontFamily: FONT, fontSize: 10, color: textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {rotulo}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: cor ?? (isLight ? "#141414" : "rgba(255,255,255,0.92)") }}>
        {valor}
      </span>
    </div>
  );
}

function Modal({ children, isLight, aoFechar }: { children: React.ReactNode; isLight: boolean; aoFechar: () => void }) {
  return (
    <div
      onClick={aoFechar}
      style={{
        position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...card(isLight), padding: 18, maxWidth: 560, width: "100%", maxHeight: "84vh", overflowY: "auto" }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * O véu neutro do seletor de plantonista (R253). Cinza puro, como toda
 * superfície desde a R186 — e com par claro/escuro, que é o anti-padrão nº 9.
 */
const COR_DO_PLANTONISTA = {
  dark: "#d4d4d4", light: "#3f3f3f",
  bg: "rgba(150,150,150,0.12)", border: "rgba(150,150,150,0.30)",
};

function botaoIcone(isLight: boolean): React.CSSProperties {
  return {
    height: 30, width: 30, borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    color: isLight ? "#141414" : "rgba(255,255,255,0.92)",
  };
}

/**
 * R253: o par Semana | Mês. É o MESMO botão do Calendário (R133) — a escolhida
 * em dourado sólido, a outra com borda. Dois valores num par de botões, nunca
 * num menu: a escolha fica visível sem abrir nada.
 */
function botaoVisao(ativa: boolean, isLight: boolean, textPrimary: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    height: 30, padding: "0 11px", borderRadius: 15, cursor: "pointer",
    border: ativa ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativa ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)" : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativa ? "#0E0E0E" : textPrimary,
    fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
  };
}

function botaoPequeno(isLight: boolean): React.CSSProperties {
  return {
    height: 30, padding: "0 10px", borderRadius: 8, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 5,
    fontFamily: FONT, fontSize: 12, fontWeight: 600,
    background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    color: isLight ? "#141414" : "rgba(255,255,255,0.92)",
  };
}
