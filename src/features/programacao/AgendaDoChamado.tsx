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
import { CalendarClock, CalendarPlus, Check, ExternalLink, Pencil } from "lucide-react";
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
  classificarChamado,
  comparaBlocos,
  dataDoDia,
  duracaoTexto,
  horaTexto,
  ordinalDoBloco,
  parDoInstante,
  type BlocoDeAgenda,
  type ChamadoParaGrade,
} from "./modelo";
import { useAutorizacaoDaAgenda, useBlocosDaSemana, useBlocosDoChamado } from "./data";
import { FormularioDoBloco, type AberturaDoFormulario } from "./FormularioDoBloco";

interface Props {
  chamado: ChamadoParaGrade;
}

export function AgendaDoChamado({ chamado }: Props) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const { data: blocosDoChamado = [] } = useBlocosDoChamado(chamado.id);
  const [abertura, setAbertura] = useState<AberturaDoFormulario | null>(null);

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
  const { data: blocosDaSemana = [] } = useBlocosDaSemana(abertura.dia);
  const { data: sessao } = useSessao();
  const autz = useAutorizacaoDaAgenda(sessao?.userId ?? null, ordens as any[]);

  // `dataDoDia` monta a data pelos COMPONENTES: `new Date('2026-09-01')` seria
  // meia-noite UTC e devolveria 31/08 no Brasil — e a semana ISO iria junto.
  const semana = referenciaSemanal(dataDoDia(abertura.dia) ?? new Date());
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
  const chamados = useMemo(() => {
    const lista = ordens as unknown as ChamadoParaGrade[];
    return lista.some((c) => c.id === chamado.id) ? lista : [...lista, chamado];
  }, [ordens, chamado]);

  return (
    <FormularioDoBloco
      abertura={abertura}
      aoFechar={aoFechar}
      aoGravar={aoFechar}
      blocos={blocosDaSemana}
      chamados={chamados}
      equipes={equipes}
      escala={escala}
      autz={autz}
      isLight={isLight}
      rota="/chamados"
    />
  );
}
