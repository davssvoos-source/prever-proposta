// A PERGUNTA DO ENCERRAMENTO (R109/R110 — U82).
//
// ── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
// A U78:1566-1568 prometeu que concluir um chamado marcaria os blocos abertos
// dele. Nunca foi construído. Enquanto isso, toda a proteção da U81 (o registro
// de quem esteve no prédio) pendia de UM clique OPCIONAL num único botão da
// grade — e o atendimento que aconteceu e ninguém carimbou continuava
// desprotegido.
//
// Quem AFIRMA que uma visita aconteceu é GENTE, e afirma ANTES do status. Um
// gatilho no encerramento não consegue afirmar com honestidade: em BEFORE o
// espelho lê o status antigo e escreve na própria linha em atualização (09000);
// em AFTER o status já é terminal, o espelho casa zero linhas e o congelamento
// da U81 grava UMA turma e perde as demais. O teorema inteiro está no cabeçalho
// da migration.
//
// ── NÃO É UM QUARTO `window.confirm` ──────────────────────────────────────
// Já existem três em `FormularioDoBloco.tsx` (:367, :396, :419). Um `confirm`
// aceita SIM ou NÃO; aqui a pergunta é por BLOCO e tem três respostas, e uma
// delas ("aconteceu") ainda tem uma segunda pergunta (em que dia). Isso é uma
// seção que expande no lugar, dentro da tela, com o gesto a um clique de
// distância do botão que encerra.
//
// ── NADA NASCE MARCADO ────────────────────────────────────────────────────
// É a recusa 5 do §5 da U81 dita na tela: "o dia passou e ninguém marcou" não é
// prova de que aconteceu. Um formulário que chegasse com "aconteceu"
// pré-selecionado transformaria o silêncio de quem clica em afirmação — a
// substituição exata que este desenho existe para não fazer.

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, HelpCircle, ShieldAlert, X } from "lucide-react";
import { FONT } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { useChamado } from "@/features/chamados/data";
import { useSessao } from "@/features/home/data";
import { useAutorizacaoDaAgenda, useBlocosDoChamado } from "./data";
import {
  classeDoErro,
  diaCurto,
  diaDaOperacao,
  diaPadraoDaAfirmacao,
  erroDaAfirmacao,
  horaTexto,
  payloadDaAfirmacao,
  respostaInicial,
  rotuloDoEncerramento,
  visitasAConfirmar,
  type DiaDaAfirmacao,
  type PayloadDaAfirmacao,
  type RecusaAntecipada,
  type RespostaDaVisita,
  type VisitaAConfirmar,
} from "./modelo";

export interface EstadoDaConfirmacao {
  visitas: VisitaAConfirmar[];
  respostas: Record<string, RespostaDaVisita>;
  dias: Record<string, DiaDaAfirmacao>;
  hoje: string;
  payload: PayloadDaAfirmacao;
  /**
   * a recusa que o modelo puro antecipou — a FRASE da RPC e o SQLSTATE que a
   * PORTA usaria para ela; `null` = passa. O código não é enfeite: é ele que
   * `classeDoErro` lê para escolher o rosto, e as três recusas não têm todas o
   * mesmo (natureza é 55000 = regra; vínculo é 42501 = permissão).
   */
  recusa: RecusaAntecipada | null;
  responder: (id: string, r: RespostaDaVisita) => void;
  escolherDia: (id: string, d: DiaDaAfirmacao) => void;
  rotulo: (base: string) => string;
}

/**
 * O ESTADO DA PERGUNTA, num lugar só — três telas fazem o mesmo gesto
 * (DetalheCampo, PainelDoCiclo e o chip da AgendaDoChamado) e três cópias deste
 * `useState` divergiriam.
 *
 * As duas consultas são as MESMAS chaves que as telas já carregam
 * (`["chamado", id]` e `["agenda-campo","chamado",id]`): o react-query dedupe,
 * então isto não custa requisição nova em nenhuma das três.
 */
export function useConfirmacaoDasVisitas(chamadoId: string | null | undefined): EstadoDaConfirmacao {
  const { data: blocos = [] } = useBlocosDoChamado(chamadoId);
  const { data: chamado } = useChamado(chamadoId ?? undefined);
  const { data: sessao } = useSessao();
  const paraAutz = useMemo(
    () =>
      chamado
        ? [{ id: chamado.id, responsavel_id: chamado.responsavel_id, aberto_por: chamado.aberto_por }]
        : [],
    [chamado?.id, chamado?.responsavel_id, chamado?.aberto_por],
  );
  const autz = useAutorizacaoDaAgenda(sessao?.userId ?? null, paraAutz);

  const [respostas, setRespostas] = useState<Record<string, RespostaDaVisita>>({});
  const [dias, setDias] = useState<Record<string, DiaDaAfirmacao>>({});

  const hoje = diaDaOperacao();
  const visitas = useMemo(
    () => (chamadoId ? visitasAConfirmar(chamadoId, blocos, hoje) : []),
    [chamadoId, blocos, hoje],
  );
  const payload = payloadDaAfirmacao(visitas, respostas, dias, hoje);
  // ── NADA A AFIRMAR = NADA A RECUSAR ────────────────────────────────────
  // `erroDaAfirmacao` responde sobre a PORTA DA AGENDA, e a porta só é chamada
  // quando existe gesto. Antecipar a recusa antes de existir gesto fez a
  // cortesia nova virar DONA DO ENCERRAMENTO: um chamado COMERCIAL chega a
  // `DetalheCampo` pela rota (chamados.$id.tsx só desvia `interno`), a recusa
  // de natureza dispara sozinha e o `throw` de `afirmarAntesDeEncerrar` tornava
  // o chamado impossível de concluir, fechar OU cancelar — e isso quebrava no
  // instante do PUSH, sem a migration ter rodado (regra 5 da casa).
  //
  // E `autz.pronta` é a segunda metade: `ehGestor` nasce `false` e `apoios`
  // nasce vazio, numa cadeia de DUAS idas (sessão -> is_gestor). Antecipar
  // recusa com a autorização ainda carregando é recusar todo mundo — o gestor
  // que abre o chamado por link direto levaria "Você não responde por este
  // chamado", que é o contrário da verdade. Enquanto ela não fecha, a única
  // resposta honesta é "não sei", e quem decide é o servidor.
  const temGesto = payload.feitos.length > 0 || payload.desmarcados.length > 0;
  const recusa =
    temGesto && chamado && autz.pronta
      ? erroDaAfirmacao(
          { id: chamado.id, natureza: chamado.natureza, status: chamado.status },
          payload.movidos,
          autz,
        )
      : null;
  return {
    visitas,
    respostas,
    dias,
    hoje,
    payload,
    recusa,
    responder: (id, r) => setRespostas((v) => ({ ...v, [id]: r })),
    escolherDia: (id, d) => setDias((v) => ({ ...v, [id]: d })),
    rotulo: (base: string) => rotuloDoEncerramento(base, visitas, respostas),
  };
}

interface Props {
  estado: EstadoDaConfirmacao;
  isLight: boolean;
  /** o erro CRU da porta (a frase em português + o SQLSTATE), ou `null` */
  erro?: { frase: string; code: string | null } | null;
  /** o texto de abertura muda entre "vou encerrar" e "já encerraram" */
  modo?: "encerrando" | "atrasado";
}

export function ConfirmacaoDasVisitas({ estado, isLight, erro = null, modo = "encerrando" }: Props) {
  const { visitas, respostas, dias, hoje, recusa } = estado;
  if (visitas.length === 0) return null;

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;

  // O ROSTO SAI DO CÓDIGO, VENHA O ERRO DE ONDE VIER. `recusa` agora carrega o
  // SQLSTATE que a PORTA usaria para a mesma recusa (modelo.ts,
  // `RecusaAntecipada`): a recusa de natureza é `55000` (regra — dá para
  // corrigir aqui) e as de vínculo são `42501` (permissão — o gesto não vai
  // acontecer). Sem isso, a MESMA frase ganhava duas caras dependendo de quem a
  // dissesse: o servidor ou a antecipação.
  const classe = classeDoErro(erro?.code ?? recusa?.code);
  const corErro =
    classe === "permissao"
      ? isLight ? PRISMA.laranja.light : PRISMA.laranja.dark
      : isLight ? "#B1242E" : "#F17881";

  const botao = (ativo: boolean, cor: string) => ({
    minHeight: 32,
    padding: "0 10px",
    borderRadius: 9,
    cursor: "pointer",
    background: ativo ? `${cor}22` : isLight ? "#ffffff" : "rgba(255,255,255,0.05)",
    border: `1px solid ${ativo ? cor : isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)"}`,
    color: ativo ? cor : textPrimary,
    fontFamily: FONT,
    fontWeight: ativo ? 700 : 600,
    fontSize: 11,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 13px",
        borderRadius: 12,
        background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isLight ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.10)"}`,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <CalendarClock size={14} color={gold} />
        <span
          style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", color: gold,
          }}
        >
          {visitas.length === 1 ? "Este atendimento aconteceu?" : `Estes ${visitas.length} atendimentos aconteceram?`}
        </span>
      </span>

      <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
        {/* A MESMA CAIXA NÃO PODE PROMETER E DESMENTIR 100 LINHAS DEPOIS, E NÃO
            PODE PROMETER SÓ METADE DA MÁQUINA.
            (1) A frase mais antiga dizia "o que ficar sem resposta continua
                pendente — a máquina não decide por você", e o rodapé desta
                mesma caixa avisa que o bloco de dia que não chegou É DESMARCADO
                ao encerrar. Para esse bloco, o silêncio É decisão da máquina.
            (2) A frase seguinte falava só do CONCLUIR — e este painel é
                renderizado TAMBÉM no fluxo de CANCELAR (DetalheCampo), onde a
                régua é outra: `chamado_solta_agenda` é
                `NEW.status = 'cancelado' OR a.dia > v_hoje`, isto é, no
                cancelamento TODO pendente cai, inclusive o de dia PASSADO. O
                gestor lia "o de dia passado continua pendente", deixava sem
                resposta, e o bloco de ontem sumia do chip para sempre —
                ressuscitá-lo é `agenda_campo_marcar`, que num chamado cancelado
                devolve 42501 a quem não é gestão (u78:774-778).
                A assimetria concluído × cancelado é decisão declarada (P39); o
                que não podia ficar é a tela prometendo o CONTRÁRIO dela no
                exato fluxo em que ela morde. O texto diz os DOIS lados, sem um
                terceiro `modo` — a máquina não mudou, a promessa é que estava
                errada.
            (3) E ele deixou de PROMETER a desmarcação automática como se fosse
                certa: entre o push e a migration o gatilho ainda não existe, e
                quem lê aquela promessa não responde nada — e aí o bloco fica lá
                para sempre, porque o gatilho só dispara na transição de status,
                que já passou. Agora a frase PEDE a resposta. */}
        {modo === "encerrando"
          ? "Marcar “aconteceu” é o que guarda o registro de quem esteve no prédio, e esta é a melhor hora de dizer. Ao CONCLUIR, o que ficar sem resposta e já tiver dia passado continua pendente; o que estiver marcado para um dia que ainda não chegou NÃO conte que continue — encerrar tira esse atendimento da agenda, e depois só a gestão o traz de volta. Ao CANCELAR, TODO atendimento sem resposta é desmarcado, inclusive os de dia já passado. Responda agora: é a única hora em que a resposta é sua."
          : "Este chamado foi encerrado sem que ninguém respondesse. Responder agora ainda guarda o registro de quem esteve no prédio."}
      </span>

      {visitas.map((v) => {
        const r = respostas[v.id] ?? respostaInicial();
        const escolha = dias[v.id] ?? diaPadraoDaAfirmacao(v);
        return (
          <div
            key={v.id}
            style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: `1px solid ${isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)"}` }}
          >
            <span style={{ fontFamily: FONT, fontSize: 12, color: textPrimary }}>
              {diaCurto(v.diaMarcado)} · {horaTexto(v.inicioMin)}
              <span style={{ color: textSecondary }}>
                {v.ordinal > 1 && ` · ${v.ordinal}ª ida`}
                {v.tempo === "futuro" && " · o dia ainda não chegou"}
                {v.tempo === "hoje" && " · marcado para hoje"}
              </span>
            </span>

            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => estado.responder(v.id, r === "aconteceu" ? "sem_resposta" : "aconteceu")}
                style={botao(r === "aconteceu", verde)}
              >
                <Check size={12} /> Aconteceu
              </button>
              <button
                type="button"
                onClick={() =>
                  estado.responder(v.id, r === "nao_vai_acontecer" ? "sem_resposta" : "nao_vai_acontecer")
                }
                style={botao(r === "nao_vai_acontecer", isLight ? PRISMA.laranja.light : PRISMA.laranja.dark)}
              >
                <X size={12} /> Não vai acontecer
              </button>
              {r === "sem_resposta" && (
                <span
                  style={{
                    fontFamily: FONT, fontSize: 10.5, color: textSecondary,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  <HelpCircle size={11} /> sem resposta — fica pendente
                </span>
              )}
            </div>

            {/* A SEGUNDA PERGUNTA, e só para o bloco cujo dia é PROVADAMENTE
                falso. Fazer o serviço antes do dia marcado é legítimo (Davi,
                04/09) — o que não é legítimo é o sistema afirmar que a equipe
                esteve no prédio num dia que não chegou. */}
            {r === "aconteceu" && v.diaFalso && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => estado.escolherDia(v.id, "hoje")}
                  style={botao(escolha === "hoje", verde)}
                >
                  Aconteceu HOJE ({diaCurto(hoje)})
                </button>
                <button
                  type="button"
                  onClick={() => estado.escolherDia(v.id, "marcado")}
                  style={botao(escolha === "marcado", gold)}
                >
                  Aconteceu no dia marcado
                </button>
              </div>
            )}
            {/* O AVISO DIZ OS QUATRO EFEITOS, E NÃO UM. Escolher isto num bloco
                de dia futuro grava `cumprido_em` com `dia` no futuro — o estado
                PRESO que o §4.3 da própria U82 existe para limpar do estoque. A
                opção FICA porque ela é a única saída de uma colisão de agenda
                que não impede o técnico de encerrar o chamado (sem ela, colidir
                obriga a ir ajustar a grade antes de fechar, com a assinatura na
                mão). Mas ela não pode ser oferecida com um aviso pela metade. */}
            {r === "aconteceu" && v.diaFalso && escolha === "marcado" && (
              <span style={{ fontFamily: FONT, fontSize: 10.5, color: corErro, lineHeight: 1.45 }}>
                O registro vai dizer {diaCurto(v.diaMarcado)} — um dia que ainda não chegou. O
                horário daquele dia fica ocupado para a equipe, o bloco não se move mais, não dá
                mais para desmarcá-lo, e a turma de apoio guardada será a da semana do plano.
                Prefira “Aconteceu HOJE”; use isto só para sair de uma colisão de agenda, e
                ajuste o horário na grade depois.
              </span>
            )}
          </div>
        );
      })}

      {(recusa || erro) && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px",
            borderRadius: 11, background: `${corErro}14`, border: `1px solid ${corErro}44`,
            fontFamily: FONT, fontSize: 11.5, color: corErro, lineHeight: 1.5,
          }}
        >
          {classe === "permissao" ? (
            <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : (
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          )}
          <span style={{ minWidth: 0 }}>
            {erro?.frase ?? recusa?.frase}
            {/* AS DUAS SAÍDAS, NO MESMO PAINEL — e elas aparecem ANTES de o
                chamado ter sido encerrado, que é a correção do pior caso: uma
                colisão de agenda não pode prender um técnico em campo com a
                assinatura na mão. */}
            {classe === "conflito" && (
              <>
                <br />
                <span style={{ opacity: 0.85 }}>
                  Duas saídas: escolha “Aconteceu no dia marcado” aqui mesmo, ou ajuste o horário
                  desse atendimento na grade. Nada foi gravado e o chamado NÃO foi encerrado.
                </span>
              </>
            )}
          </span>
        </div>
      )}

      <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, lineHeight: 1.45 }}>
        Nada é marcado como feito sem você dizer. Responder “Não vai acontecer” é o que libera o
        horário da equipe na grade — no cancelamento, o que ficar sem resposta é desmarcado de
        qualquer jeito, de qualquer dia.
      </span>
    </div>
  );
}
