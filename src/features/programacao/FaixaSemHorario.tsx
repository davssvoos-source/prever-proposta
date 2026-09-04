// A FAIXA "AGENDADO SEM HORÁRIO" e a FILA "SEM DATA" — U79.
//
// São os DOIS baldes que não têm célula: um chamado sem hora não tem coluna, e
// um chamado sem data não tem nem dia. `classificarChamado` (modelo.ts:1503)
// entrega os quatro baldes numa passada só, e é ele que finalmente dá a esta
// tela o TERCEIRO — a versão antiga só sabia "tem data" e "não tem data", e um
// chamado com data e sem bloco caía na agenda do dia como um cartão normal, sem
// nada indicando que ninguém marcou hora.
//
// ── ELA NÃO PODE PARECER ERRO, E CADA ESCOLHA TEM MOTIVO ──────────────────
// No dia 1 ela é 100% da base. Uma faixa vermelha com trezentos itens ensina,
// em uma hora, a ignorá-la — e junto com ela a que importa.
//   · ícone `CalendarClock`, NUNCA `AlertTriangle`. O triângulo é a voz de
//     "aguardando programação" (a fila sem data, logo abaixo), e lá ele está
//     certo: aquilo é trabalho sem plano. Aqui não há nada errado.
//   · cor informativa (azul do PRISMA), nem o vermelho de erro nem o dourado de
//     alarme.
//   · o título descreve a ORIGEM, não uma falha de alguém.
//   · o progresso é uma CONTAGEM que SOBE — "28 de 340 já têm horário". Um
//     número que anda conforme se trabalha não é mensagem de erro. Os dois
//     termos saem do MESMO censo (`classificarChamado` sobre a mesma lista),
//     que é "quem conta é quem filtra" aplicado a uma barra de progresso.
//   · o cartão mostra SÓ A DATA, nunca a hora: a base tem 12:00 SENTINELA (a
//     programação antiga escrevia `T12:00:00` literal) misturado com 12:00 de
//     verdade, indistinguíveis por valor. Imprimir "12:00" ali seria a segunda
//     verdade aparecendo na interface.
//
// ── E ELA SOME SOZINHA ────────────────────────────────────────────────────
// Renderiza sob `lista.length > 0`. No dia em que o último ganhar horário, o
// cartão simplesmente não existe mais, e nada anuncia isso — faixa de migração
// que deixa um troféu "0 restantes" vira entulho.

import { CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";
import { PRISMA } from "@/lib/paleta";
import { FONT, card } from "@/lib/ui";
import { situacaoPrazo, textoPrazo } from "@/lib/chamado-status";
import { parDoInstante, type ChamadoParaGrade } from "./modelo";

export type ChamadoDaFila = ChamadoParaGrade & {
  prazo_limite?: string | null;
  cliente?: { nome?: string | null } | null;
};

/**
 * A ordenação das duas filas: prazo ESTOURADO primeiro, depois o prazo mais
 * curto. É a mesma da fila "sem data" de hoje, e ela existe por um motivo
 * prático: os primeiros vinte minutos de quem for migrar a base devem ser os
 * que pagam.
 */
export function ordenarPorPrazo<T extends { prazo_limite?: string | null; status: string | null }>(
  lista: T[],
): T[] {
  return [...lista].sort((a, b) => {
    const pa = situacaoPrazo(a.prazo_limite ?? null, a.status) === "estourado" ? 0 : 1;
    const pb = situacaoPrazo(b.prazo_limite ?? null, b.status) === "estourado" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.prazo_limite ?? "9").localeCompare(b.prazo_limite ?? "9");
  });
}

interface PropsFaixa {
  /** os `sem_horario` do dia aberto */
  doDia: ChamadoDaFila[];
  /** todos os `sem_horario`, para o contador e o "e mais N" */
  todos: ChamadoDaFila[];
  /** quantos já têm bloco — o outro termo da fração */
  comHorario: number;
  isLight: boolean;
  onDarHorario: (c: ChamadoDaFila) => void;
  onIrParaDia: (dia: string) => void;
  onAbrirChamado: (id: string) => void;
}

export function FaixaSemHorario({
  doDia, todos, comHorario, isLight, onDarHorario, onIrParaDia, onAbrirChamado,
}: PropsFaixa) {
  if (todos.length === 0) return null;

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const azul = isLight ? PRISMA.azul.light : PRISMA.azul.dark;
  const total = comHorario + todos.length;
  const fora = todos.filter((c) => !doDia.some((d) => d.id === c.id));
  // O primeiro de OUTRO dia, para o botão "e mais N" devolver a pessoa a um DIA
  // — a faixa não vira uma segunda caixa de entrada.
  const proximoDia = fora
    .map((c) => parDoInstante(c.data_hora_agendada)?.dia)
    .filter((d): d is string => !!d)
    .sort()[0] ?? null;

  return (
    <div style={{ ...card(isLight), padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <CalendarClock size={15} color={azul} />
        <span style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: azul,
        }}>
          Agendado sem horário ({todos.length})
        </span>
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: textSecondary }}>
          {comHorario} de {total} já têm horário
        </span>
      </div>
      <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
        Tem data e ainda não tem hora — dê um horário quando quiser.
      </span>
      {/* a barra é a MESMA fração da linha acima; ela não sabe nada que o texto
          não diga, e existe só para o progresso ser visível de longe */}
      <div style={{
        height: 4, borderRadius: 2, overflow: "hidden",
        background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
      }}>
        <div style={{
          width: `${total > 0 ? Math.round((comHorario / total) * 100) : 0}%`,
          height: "100%", background: azul,
        }} />
      </div>

      {ordenarPorPrazo(doDia).map((c) => (
        <CartaoDaFila
          key={c.id} c={c} isLight={isLight}
          mostrarData
          acao="Dar horário"
          onAcao={() => onDarHorario(c)}
          onAbrir={() => onAbrirChamado(c.id)}
        />
      ))}

      {doDia.length === 0 && (
        <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
          Nenhum deles é do dia aberto.
        </span>
      )}

      {fora.length > 0 && proximoDia && (
        <button
          onClick={() => onIrParaDia(proximoDia)}
          style={{
            height: 40, borderRadius: 12, cursor: "pointer",
            background: "transparent", color: textPrimary,
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            fontFamily: FONT, fontWeight: 600, fontSize: 12,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          …e mais {fora.length} em outros dias <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

interface PropsFila {
  lista: ChamadoDaFila[];
  isLight: boolean;
  onDarHorario: (c: ChamadoDaFila) => void;
  onAbrirChamado: (id: string) => void;
}

/**
 * A fila "aguardando programação" — o balde `sem_data`. Aqui o
 * `AlertTriangle` é a voz certa: é trabalho aberto sem nenhum plano, e a tela
 * de hoje já o usa assim.
 */
export function FilaSemData({ lista, isLight, onDarHorario, onAbrirChamado }: PropsFila) {
  if (lista.length === 0) return null;
  const gold = isLight ? "#A06108" : "#F8C811";
  return (
    <div style={{ ...card(isLight), padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={15} color={gold} />
        <span style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
        }}>
          Aguardando programação ({lista.length})
        </span>
      </div>
      {ordenarPorPrazo(lista).map((c) => (
        <CartaoDaFila
          key={c.id} c={c} isLight={isLight}
          mostrarData={false}
          acao="Programar"
          onAcao={() => onDarHorario(c)}
          onAbrir={() => onAbrirChamado(c.id)}
        />
      ))}
    </div>
  );
}

interface PropsRetornos {
  lista: ChamadoDaFila[];
  isLight: boolean;
  onDarHorario: (c: ChamadoDaFila) => void;
  onAbrirChamado: (id: string) => void;
}

/**
 * RETORNOS PENDENTES (R106) — a TERCEIRA seção, no mesmo molde das duas
 * irmãs, com o mesmo `CartaoDaFila`.
 *
 * O balde: o chamado teve visita CUMPRIDA, continua ABERTO e não tem nenhum
 * bloco pendente. Ele é invisível hoje — `espelhoDoChamado` deixa a data no
 * último bloco cumprido, `classificarChamado` o joga em `com_bloco` (de
 * propósito, para a barra de progresso não andar para trás), e aí ele não está
 * na faixa, não está na fila e não desenha cartão na semana aberta. Quem o
 * calcula é `retornosPendentes`, no modelo puro.
 *
 * ── AQUI O `AlertTriangle` É A VOZ CERTA, E ISSO NÃO CONTRADIZ O TOPO ─────
 * O cabeçalho deste arquivo proíbe o triângulo na FAIXA "agendado sem
 * horário", e o motivo está escrito lá: no dia 1 aquela faixa é 100% da base,
 * e uma faixa vermelha com trezentos itens ensina a ignorá-la. Aqui é o
 * oposto — é trabalho ABERTO E PARADO, sem nada marcado à frente, e a lista é
 * curta por construção. É a mesma voz de `FilaSemData`, logo abaixo.
 *
 * Some sozinha quando a lista esvazia, como as outras duas.
 */
export function RetornosPendentes({ lista, isLight, onDarHorario, onAbrirChamado }: PropsRetornos) {
  if (lista.length === 0) return null;
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  return (
    <div style={{ ...card(isLight), padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={15} color={laranja} />
        <span style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: laranja,
        }}>
          Retornos pendentes ({lista.length})
        </span>
      </div>
      <span style={{ fontFamily: FONT, fontSize: 12, color: isLight ? "#4a5060" : "rgba(255,255,255,0.55)" }}>
        A visita aconteceu, o atendimento continua aberto e não há nada marcado à frente.
      </span>
      {ordenarPorPrazo(lista).map((c) => (
        <CartaoDaFila
          key={c.id} c={c} isLight={isLight}
          mostrarData
          acao="Marcar retorno"
          onAcao={() => onDarHorario(c)}
          onAbrir={() => onAbrirChamado(c.id)}
        />
      ))}
    </div>
  );
}

function CartaoDaFila({ c, isLight, mostrarData, acao, onAcao, onAbrir }: {
  c: ChamadoDaFila; isLight: boolean; mostrarData: boolean;
  acao: string; onAcao: () => void; onAbrir: () => void;
}) {
  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const atrasado = situacaoPrazo(c.prazo_limite ?? null, c.status) === "estourado";
  // SÓ A DATA, nunca a hora: 12:00 sentinela e 12:00 de verdade são
  // indistinguíveis por valor na base (é a razão de a faixa existir).
  const par = mostrarData ? parDoInstante(c.data_hora_agendada) : null;

  return (
    <div style={{
      padding: "10px 12px", borderRadius: 12,
      background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
      border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    }}>
      <button
        onClick={onAbrir}
        style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", flex: 1, minWidth: 140 }}
      >
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: textPrimary }}>
          {c.titulo ?? "Chamado sem título"}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, marginTop: 2 }}>
          {c.numero ?? "—"} · {c.cliente?.nome ?? "cliente"}
          {par && ` · ${par.dia}`}
        </div>
      </button>
      {c.prazo_limite && (
        <span style={{
          fontFamily: FONT, fontSize: 10.5,
          color: atrasado ? (isLight ? "#B1242E" : "#F17881") : textSecondary,
        }}>
          {textoPrazo(c.prazo_limite)}
        </span>
      )}
      <button
        onClick={onAcao}
        style={{
          padding: "8px 12px", borderRadius: 10, cursor: "pointer", minHeight: 36,
          background: isLight ? "#ffffff" : "rgba(255,255,255,0.05)",
          border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
          color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 11,
        }}
      >
        {acao}
      </button>
    </div>
  );
}
