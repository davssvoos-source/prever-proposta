// A AGENDA DE UM CHAMADO, vista de dentro do chamado — U79.
//
// Substitui o `<input type="datetime-local">` do PainelChamado, e a
// substituição é um ESTREITAMENTE deliberado, não uma tradução.
//
// ── O PROBLEMA ESTRUTURAL: UM CAMPO NÃO SABE REPRESENTAR N BLOCOS ─────────
// `chamados.data_hora_agendada` virou ESPELHO (R101): ela é o início do bloco
// PENDENTE mais antigo, ou — se todos foram cumpridos — o do ÚLTIMO. Com dois
// blocos (a visita de terça e o retorno da quinta), um campo só NÃO CONSEGUE
// dizer a verdade: qualquer valor que ele mostre esconde o outro, e qualquer
// valor que ele grave escolhe um dos dois sem perguntar. Pior: `marcar` sem
// `_id` CRIA bloco, então editar a data de um chamado que já tem bloco criaria
// um segundo — um retorno que ninguém pediu.
//
// Então:
//   · 0 blocos          → um gesto de CRIAR, e o formulário completo;
//   · 1 bloco           → editável AQUI MESMO, com o `_id` do bloco. É a
//     fronteira que a U78 escolheu preservar: este é o lugar onde o técnico
//     não-gestor remarca o PRÓPRIO atendimento, e tirar isso dele não era o
//     assunto daquela migration;
//   · 2 ou mais blocos  → LISTA somente-leitura, com o ordinal ("2ª ida"), e
//     "abrir na grade". Onde dois blocos se veem juntos é a grade.
//
// ── E EM `sem_horario` MOSTRAMOS SÓ A DATA, NUNCA A HORA ─────────────────
// 12:00 SENTINELA (o que a programação antiga escrevia) e 12:00 de verdade são
// indistinguíveis por valor na base. Imprimir "12:00" aqui seria a segunda
// verdade aparecendo na interface, na tela em que ela é mais crível.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CalendarPlus, Check, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { FONT } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { referenciaSemanal } from "@/lib/periodos";
import { useTheme } from "@/contexts/ThemeContext";
import { useChamadosPorNatureza, usePessoas } from "@/features/chamados/data";
import { useSessao } from "@/features/home/data";
import { useDuplas, useEscala } from "@/features/duplas/data";
import { composicaoDaDupla, montarEscala, rotuloDaComposicao } from "@/features/duplas/modelo";
import {
  blocoVale,
  chamadosParaGrade,
  classificarChamado,
  comparaBlocos,
  dataDoDia,
  duracaoTexto,
  horaTexto,
  ordinalDoBloco,
  parDoInstante,
  visitasNaoAfirmadas,
  type BlocoDeAgenda,
  type ChamadoParaGrade,
} from "./modelo";
import {
  sqlstateDoErro,
  useAfirmarVisitas,
  useAutorizacaoDaAgenda,
  useBlocosDaSemana,
  useBlocosDoChamado,
} from "./data";
import { ConfirmacaoDasVisitas, useConfirmacaoDasVisitas } from "./ConfirmacaoDasVisitas";
import { FormularioDoBloco, type AberturaDoFormulario } from "./FormularioDoBloco";

interface Props {
  chamado: ChamadoParaGrade;
}

export function AgendaDoChamado({ chamado }: Props) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const { data: blocosDoChamado = [] } = useBlocosDoChamado(chamado.id);
  const [abertura, setAbertura] = useState<AberturaDoFormulario | null>(null);

  /**
   * O CHIP DO FURO (U82 — P34). Cinco caminhos encerram um chamado sem passar
   * por uma linha desta tela: o arrasto do quadro, o seletor de status do
   * painel, os chips do interno, `decidir_pedido_compra` (u9:139-151) e
   * `sincronizar_chamado_da_visita` (u38:68-86) — os dois últimos sem uma linha
   * de TypeScript no caminho. Nenhum `onClick` os alcança.
   *
   * Este chip alcança, porque ele está preso ao ESTADO e não ao gesto: chamado
   * ENCERRADO com visita PENDENTE é uma pergunta que ninguém respondeu, e ela
   * continua ali até alguém abrir o chamado. É o gêmeo do lado ENCERRADO da
   * conferência 130, e é o número que decide se este desenho funcionou.
   */
  const conf = useConfirmacaoDasVisitas(chamado.id);
  const afirmar = useAfirmarVisitas();
  const [afirmando, setAfirmando] = useState(false);
  const [erroDaVisita, setErroDaVisita] = useState<{ frase: string; code: string | null } | null>(null);
  const naoAfirmadas = visitasNaoAfirmadas(chamado, blocosDoChamado);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.62)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const ativos = useMemo(
    () => blocosDoChamado.filter(blocoVale).sort(comparaBlocos),
    [blocosDoChamado],
  );
  const classe = classificarChamado(chamado, ativos.length > 0);
  const legado = parDoInstante(chamado.data_hora_agendada);

  const linha = {
    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const,
    padding: "9px 11px", borderRadius: 12,
    background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)",
  };
  const botao = {
    minHeight: 36, padding: "0 12px", borderRadius: 10, cursor: "pointer",
    background: isLight ? "#ffffff" : "rgba(255,255,255,0.06)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
    display: "inline-flex", alignItems: "center", gap: 6,
  };

  const abrirCriar = (dia: string) =>
    setAbertura({
      bloco: null, chamadoId: chamado.id, dia, duplaId: null,
      servicoMin: null, deslocamentoMin: null, herdado: false, restantes: 0,
    });

  const abrirEditar = (b: BlocoDeAgenda) =>
    setAbertura({
      bloco: b, chamadoId: b.chamado_id, dia: b.dia, duplaId: b.dupla_id,
      servicoMin: null, deslocamentoMin: null, herdado: false, restantes: 0,
    });

  const naGrade = (dia: string) =>
    navigate({
      to: "/chamados/programacao",
      search: { dia, chamado: chamado.id } as any,
    });

  const hoje = new Date();
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 15 }}>
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 11, color: textPrimary }}>
          Agendado para
        </span>
      </span>

      {naoAfirmadas.length > 0 && (
        <div
          style={{
            ...linha,
            alignItems: "flex-start",
            background: isLight ? "rgba(250,132,45,0.07)" : "rgba(250,132,45,0.08)",
            border: `1px solid ${PRISMA.laranja.border}`,
          }}
        >
          <AlertTriangle
            size={14}
            color={isLight ? PRISMA.laranja.light : PRISMA.laranja.dark}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12, color: textPrimary, lineHeight: 1.5 }}>
            {/* A TELA NÃO PODE PROMETER O QUE A MÁQUINA NÃO FAZ. A frase antiga
                dizia que responder GUARDA o registro de quem esteve no prédio —
                e para visita de OUTRA semana isso é falso: aqui o chamado já
                está encerrado, o espelho está pinado (u78:895) e a turma daquela
                semana nunca foi sequer escrita em `chamado_apoios`. Reconstruí-la
                seria inventar registro, que a U64 e a U81 recusaram por escrito.
                Limitação declarada no P38, com canário SQL. */}
            Este chamado foi encerrado com {naoAfirmadas.length} atendimento(s) que ninguém afirmou.
            <span style={{ color: textSecondary }}>
              {" "}Responder guarda o registro do atendimento. Para visita de outra semana, confira
              também o chip de apoio: o registro de quem foi pode precisar ser posto à mão.
            </span>
          </span>
          {!afirmando && (
            <button style={botao} onClick={() => setAfirmando(true)}>
              <Check size={13} /> Afirmar agora
            </button>
          )}
        </div>
      )}

      {afirmando && (
        <>
          <ConfirmacaoDasVisitas estado={conf} isLight={isLight} erro={erroDaVisita} modo="atrasado" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={botao} onClick={() => { setAfirmando(false); setErroDaVisita(null); }}>
              Deixar para depois
            </button>
            <button
              style={botao}
              disabled={afirmar.isPending}
              onClick={() => {
                setErroDaVisita(null);
                // O CÓDIGO VEM DO MODELO PURO, junto com a frase — um "42501"
                // fixo pintava a recusa de NATUREZA (que a porta levanta como
                // 55000 = regra) com o rosto de permissão.
                if (conf.recusa) { setErroDaVisita({ frase: conf.recusa.frase, code: conf.recusa.code }); return; }
                // O MESMO CINTO DO `DetalheCampo`: sem gesto a mutationFn volta
                // cedo, o painel fecharia e o toast diria "0 atendimento(s)
                // marcados como feitos", que é anunciar um gesto que não houve.
                if (conf.payload.feitos.length === 0 && conf.payload.desmarcados.length === 0) {
                  setAfirmando(false);
                  return;
                }
                afirmar.mutate(
                  { chamadoId: chamado.id, ...conf.payload },
                  {
                    onSuccess: (r) => {
                      setAfirmando(false);
                      // `toast.message` e não `toast.success` quando NADA foi
                      // gravado: verde para "não fiz nada" é mentira de cor.
                      if (r.portaAusente) {
                        toast.message("A atualização do banco ainda não foi aplicada — nada foi marcado.");
                      } else if (r.portaMuda) {
                        toast.message("Não consegui gravar as respostas agora (conexão) — nada foi marcado. Tente de novo.");
                      } else {
                        toast.success(`${r.afirmados} atendimento(s) marcados como feitos.`);
                      }
                    },
                    onError: (e: unknown) =>
                      setErroDaVisita({ frase: (e as Error).message, code: sqlstateDoErro(e) }),
                  },
                );
              }}
            >
              <Check size={13} /> {conf.rotulo("Gravar as respostas")}
            </button>
          </div>
        </>
      )}

      {classe === "fora_da_programacao" && ativos.length === 0 && (
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>
          Este chamado está encerrado — a agenda dele é registro.
        </span>
      )}

      {classe === "sem_data" && (
        <div style={linha}>
          <CalendarClock size={14} color={textSecondary} />
          <span style={{ flex: 1, fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>
            Sem horário
          </span>
          <button style={botao} onClick={() => abrirCriar(hojeIso)}>
            <CalendarPlus size={13} /> Dar horário
          </button>
        </div>
      )}

      {/* A FAIXA "AGENDADO SEM HORÁRIO", vista de dentro do chamado. SÓ A DATA. */}
      {classe === "sem_horario" && (
        <div style={linha}>
          <CalendarClock size={14} color={gold} />
          <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12.5, color: textPrimary }}>
            {legado?.dia ?? "—"}
            <span style={{ color: textSecondary }}> · sem horário marcado</span>
          </span>
          <button style={botao} onClick={() => abrirCriar(legado?.dia ?? hojeIso)}>
            <CalendarPlus size={13} /> Dar horário
          </button>
        </div>
      )}

      {ativos.map((b) => {
        const ordinal = ordinalDoBloco(b, blocosDoChamado);
        const soUm = ativos.length === 1;
        return (
          <div key={b.id} style={linha}>
            {b.cumprido_em ? <Check size={14} color={isLight ? "#047862" : "#2DD2A5"} /> : <CalendarClock size={14} color={gold} />}
            <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12.5, color: textPrimary }}>
              {b.dia} · {horaTexto(b.inicio_min)}–{horaTexto(b.inicio_min + b.servico_min)}
              <span style={{ color: textSecondary }}>
                {" · "}{duracaoTexto(b.servico_min + b.deslocamento_min)}
                {ordinal > 1 && ` · ${ordinal}ª ida`}
                {b.cumprido_em && " · feito"}
              </span>
            </span>
            {soUm ? (
              <button style={botao} onClick={() => abrirEditar(b)}>
                <Pencil size={13} /> Alterar
              </button>
            ) : (
              <button style={botao} onClick={() => naGrade(b.dia)}>
                <ExternalLink size={13} /> Na grade
              </button>
            )}
          </div>
        );
      })}

      {ativos.length > 1 && (
        <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
          Este chamado tem {ativos.length} idas marcadas. A data que aparece nas outras telas é a da
          próxima que ainda vai acontecer — por isso a edição é na grade, onde as duas se veem juntas.
        </span>
      )}

      {abertura && (
        <EditorDoBloco
          // O `diaConsultado` do editor é estado LOCAL dele e segue o campo do
          // formulário. Abrir OUTRO bloco sem remontar deixaria a consulta na
          // semana do bloco anterior — a chave garante que cada abertura nasce
          // consultando o próprio dia.
          key={`${abertura.bloco?.id ?? "novo"}-${abertura.dia}`}
          abertura={abertura}
          chamado={chamado}
          aoFechar={() => setAbertura(null)}
        />
      )}
    </div>
  );
}

/**
 * O invólucro que carrega o CONTEXTO do formulário — e ele só monta quando o
 * formulário abre, de propósito.
 *
 * `erroDoAgendamento` precisa dos blocos DO DIA (de todas as equipes) para
 * nomear o conflito e somar a jornada, e da lista de chamados para o rótulo do
 * conflitante. Se essas consultas vivessem no painel, todo chamado aberto —
 * inclusive interno, inclusive só para ler — pagaria por elas. Aqui elas custam
 * o que a edição custa, e as três chaves (`chamados/campo`, `duplas`,
 * `duplas-escala`) são as MESMAS da tela de programação: quem veio de lá as
 * encontra quentes.
 */
function EditorDoBloco({ abertura, chamado, aoFechar }: {
  abertura: AberturaDoFormulario;
  chamado: ChamadoParaGrade;
  aoFechar: () => void;
}) {
  const { isLight } = useTheme();
  const { data: ordens = [] } = useChamadosPorNatureza("campo");
  const { data: pessoas = [] } = usePessoas();
  const { data: duplas = [] } = useDuplas();
  const { data: escala = montarEscala([], []) } = useEscala();
  /**
   * O DIA DA CONSULTA SEGUE O CAMPO DO FORMULÁRIO — e antes ele não seguia.
   *
   * `useBlocosDaSemana(abertura.dia)` fixava a janela na ABERTURA, enquanto o
   * campo de dia lá dentro é livre. Trocar a data para outra semana deixava
   * `blocos` sem UM bloco daquele dia, e `erroDoAgendamento` rodava sobre essa
   * lista: ele deixava de ver o conflito e de somar a jornada daquele dia. O
   * formulário ficava MAIS PERMISSIVO QUE A PORTA — a tela deixava marcar e o
   * EXCLUDE recusava depois, com 23P01 —, que é a pior direção possível para
   * uma divergência entre a tela e o banco.
   *
   * É defeito PRÉ-EXISTENTE, e levantar o dia para cá é o conserto inteiro.
   */
  const [diaConsultado, setDiaConsultado] = useState(abertura.dia);
  const { data: blocosDaSemana = [] } = useBlocosDaSemana(diaConsultado);
  const { data: sessao } = useSessao();
  const autz = useAutorizacaoDaAgenda(sessao?.userId ?? null, ordens as any[]);

  // `dataDoDia` monta a data pelos COMPONENTES: `new Date('2026-09-01')` seria
  // meia-noite UTC e devolveria 31/08 no Brasil — e a semana ISO iria junto.
  //
  // E A SEMANA DAS EQUIPES SAI DO **MESMO** `diaConsultado` QUE A CONSULTA DE
  // BLOCOS. Enquanto ela saía de `abertura.dia` — congelado na abertura —,
  // trocar a data para outra semana movia a consulta e NÃO movia a composição:
  // o `<select>` imprimia "Equipe A · João e Pedro" quando a escala da semana
  // escolhida põe João e Carlos, uma equipe que só existe na semana de destino
  // não era oferecida (o filtro de membros roda contra a semana velha), e a
  // frase da divergência degradava para "outra equipe" porque `derivada` vem da
  // semana certa e `equipes`, da errada. `erroDoAgendamento` não pega nada
  // disso: ele confere conflito de PESSOA na semana certa, e nunca confere se a
  // equipe escolhida existe naquela semana. Um identificador conserta.
  const semana = referenciaSemanal(dataDoDia(diaConsultado) ?? new Date());
  const nomePorId = useMemo(
    () => Object.fromEntries(pessoas.map((p: any) => [p.id, p.nome ?? "—"])) as Record<string, string>,
    [pessoas],
  );
  const nomeDe = (id: string) => nomePorId[id] ?? "Técnico";

  const equipes = useMemo(
    () => duplas
      .map((d) => ({ dupla: d, membros: composicaoDaDupla(d.id, semana, escala) }))
      .filter((x) => x.membros.length > 0)
      .map((x) => ({ id: x.dupla.id, rotulo: rotuloDaComposicao(x.dupla, x.membros, nomeDe) })),
    [duplas, semana, escala, nomePorId],
  );

  // A lista de chamados vai COMPLETA (nunca filtrada): `chamadoOculto` é
  // `chamado_id !== null && !chamado`, e uma lista curta faria o conflitante
  // legítimo se apresentar como "Outro atendimento" na frase da recusa.
  //
  // E A CONVERSÃO É UM CONSTRUTOR, NÃO UM `as unknown as` (U84). A dupla
  // asserção que estava aqui DESLIGAVA o typechecker exatamente neste ponto: a
  // gêmea dela no `/chamados/programacao` foi morta na U80 e ganhou asserção, e
  // ESTA sobreviveu porque a asserção olhava só para o outro arquivo — presença
  // provada num lugar, ausência não provada no outro. Com ela, uma coluna que a
  // consulta não traga chega `undefined` (e não `null`) ao formulário, sem erro
  // de tipo e sem censo: o formulário mudaria de comportamento conforme a PORTA
  // por onde foi aberto, que é o defeito mais difícil de reproduzir que existe.
  //
  // E O `chamado` QUE CHEGA POR PROP PASSA PELO MESMO CONSTRUTOR. Ele vem do
  // PainelChamado com um `as any` (PainelChamado.tsx:1209) — outro typechecker
  // desligado, do outro lado do mesmo cano. Na prática ele quase sempre já está
  // dentro de `ordens` e a versão construída vence; "quase sempre" não é
  // garantia, e o ramo em que ele NÃO está é justamente o ramo raro que ninguém
  // testa. Convertê-lo custa uma linha e tira o `as any` do caminho dos dados.
  const chamados = useMemo(() => {
    const lista = chamadosParaGrade(ordens as unknown as Array<Record<string, unknown>>);
    if (lista.some((c) => c.id === chamado.id)) return lista;
    return [...lista, ...chamadosParaGrade([chamado as unknown as Record<string, unknown>])];
  }, [ordens, chamado]);

  return (
    <FormularioDoBloco
      abertura={abertura}
      aoFechar={aoFechar}
      aoGravar={aoFechar}
      blocos={blocosDaSemana}
      diaDosBlocos={diaConsultado}
      aoTrocarDia={setDiaConsultado}
      chamados={chamados}
      equipes={equipes}
      escala={escala}
      autz={autz}
      isLight={isLight}
      rota="/chamados"
    />
  );
}
