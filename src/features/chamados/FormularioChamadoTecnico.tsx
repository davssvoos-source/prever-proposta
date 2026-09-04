// O FORMULÁRIO de chamado de CAMPO — a dupla se desloca até o cliente (U7).
// Cliente → sistema → problema/prioridade → técnico/equipe e agenda.
// O número e o prazo de atendimento (SLA) são preenchidos pelo banco.
//
// ── R126/U93: UM FORMULÁRIO, DOIS LUGARES ──────────────────────────────────
// Até a U93 este corpo vivia dentro da rota `/chamados/novo-campo`. O "+" da
// Operacional Técnica precisava do MESMO formulário num pop-up, e copiar 500
// linhas criaria o segundo caminho de escrita que este repositório se recusa
// a manter. Então o corpo virou componente; a página e o pop-up são molduras.
// Quem chama decide para onde ir ao terminar (`aoConcluir`): a página navega
// para o chamado, o pop-up abre o painel lateral (R33).
//
// ── U79: ABRIR O CHAMADO E MARCAR O HORÁRIO SÃO DUAS ETAPAS ───────────────
// `abrirChamado` não recebe `data_hora_agendada` — aquela coluna é ESPELHO
// derivado do bloco (R101), e quem marca hora de campo é `agenda_campo_marcar`.
// O bloco precisa do id do chamado, então a ordem é obrigatória: cria, e só
// então marca.
//
// A REGRESSÃO QUE EU ME RECUSO A DEIXAR SILENCIOSA. Sem EQUIPE não há bloco —
// `agenda_campo.dupla_id` é NOT NULL, porque o bloco É o compromisso de uma
// equipe com uma janela — e a data seria simplesmente perdida. A saída não é
// travar o formulário (isso impediria alguém de abrir um chamado só porque
// ainda não sabe a equipe): a seção de agendamento DECLARA o que vai
// acontecer, a linha secundária do botão diz para onde o chamado vai, e o toast
// confirma. Nada some; muda de fila, e a tela diz qual.
//
// E A ORDEM DE FALHA É DITA PARA NÃO VIRAR MENTIRA: o chamado é criado ANTES do
// bloco. Se `agenda_campo_marcar` recusar (conflito, jornada, escala), o chamado
// JÁ EXISTE — então a tela NÃO conclui e NÃO diz "falhou ao abrir chamado". Ela
// diz "o chamado foi aberto; o horário não entrou:", mostra a frase da RPC no
// próprio formulário, e o botão passa a chamar só `marcar` (o id está em mão).
//
// ── O QUE A R126 ACRESCENTOU (Davi, 03/09/2026) ────────────────────────────
// · RESPONSÁVEL: EQUIPE OU TÉCNICO SOLO. Escolher a equipe sem técnico propõe
//   o primeiro da escala como responsável (`responsavelProposto`, abertura.ts).
// · SISTEMA A IMPLANTAR: na implantação o sistema ainda não existe no cliente,
//   e o formulário oferece criá-lo ali (`criarSistema`), ligando o chamado.
// · TÍTULO SUGERIDO quando ninguém digita (`sugerirTitulo`).
// · A seção de problema pergunta conforme o tipo (`secaoDoProblema`).

import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { card } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { referenciaSemanal } from "@/lib/periodos";
import { useTecnicos } from "@/features/gerencial/data";
import { useClientes } from "@/features/clientes/data";
import {
  useInventario, criarSistema, TIPOS_SISTEMA, TIPO_SISTEMA_LABEL, type TipoSistema,
} from "@/features/clientes/inventario";
import { abrirChamado, useSla } from "@/features/chamados/data";
import { montarChecklistPreventiva } from "@/features/chamados/checklist";
import { useDuplas, useEscala } from "@/features/duplas/data";
import {
  composicaoDaDupla, duplaDaPessoaNaSemana, montarEscala, rotuloDaComposicao,
} from "@/features/duplas/modelo";
import { useBlocosDaSemana, useMarcarBloco, sqlstateDoErro } from "@/features/programacao/data";
import {
  blocosDaEquipeNaSemana, classeDoErro, dataDoDia, duracaoTexto, horaTexto,
  primeiroInicioPossivel, type BlocoEditavel,
} from "@/features/programacao/modelo";
import {
  TIPO_LABEL, PRIORIDADE_LABEL, PRIORIDADE_CORES, tiposDaNatureza,
  type ChamadoPrioridade, type ChamadoTipo,
} from "@/lib/chamado-status";
import {
  podeCriarSistema, responsavelProposto, rotuloDoSistema, secaoDoProblema, sugerirTitulo,
} from "./abertura";

interface Props {
  /**
   * O chamado nasceu — e, se era para marcar horário, o horário entrou. Quem
   * chama decide o destino: a página navega, o pop-up abre o painel lateral.
   */
  aoConcluir: (id: string) => void;
  /**
   * R138 (U96): o pop-up de nova atividade da Início faz DUAS perguntas antes
   * de qualquer formulário — o tipo de demanda e o responsável — e, quando o
   * responsável é da equipe Técnica, cai aqui. As duas respostas chegam
   * prontas para a pessoa não escolher de novo o que acabou de escolher.
   */
  tipoInicial?: ChamadoTipo;
  tecnicoInicial?: string | null;
}

export function FormularioChamadoTecnico({ aoConcluir, tipoInicial, tecnicoInicial }: Props) {
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: clientes = [] } = useClientes();
  const { data: tecnicos = [] } = useTecnicos();
  const { data: sla = {} } = useSla();

  const [tipo, setTipo] = useState<ChamadoTipo>(
    tipoInicial && (tiposDaNatureza("campo") as string[]).includes(tipoInicial) ? tipoInicial : "corretiva",
  );
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [sistemaId, setSistemaId] = useState<string | null>(null);
  // R126: o sistema A IMPLANTAR pode não existir ainda — nasce daqui.
  const [criandoSistema, setCriandoSistema] = useState(false);
  const [novoSistemaTipo, setNovoSistemaTipo] = useState<TipoSistema>("CFTV");
  const [novoSistemaNome, setNovoSistemaNome] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>("normal");
  const [tecnicoId, setTecnicoId] = useState(tecnicoInicial ?? "");
  const [data, setData] = useState("");
  // 09:00 é `CAMPO_ABRE_MIN`: a equipe SAI às 09h, então este default já passa
  // no `v_inicio - v_desloc < 540` da jornada. Não é um chute — é a política.
  const [hora, setHora] = useState("09:00");
  // `null` = "ainda não mexi" (vale a derivação do técnico); `""` = "escolhi NÃO
  // agendar". Um estado só, com `""` fazendo os dois papéis, tornava impossível
  // desmarcar a equipe: apagar caía de volta na derivação, e o formulário
  // discutia com quem o preenche.
  const [equipeId, setEquipeId] = useState<string | null>(null);
  // A DURAÇÃO ABRE VAZIA E É OBRIGATÓRIA PARA AGENDAR. Não existe duração de
  // serviço em lugar nenhum do repositório, e `useSla()` responde outra
  // pergunta (PRAZO de atendimento: "até quando alguém tem de ir"). Um default
  // aqui seria um backfill, um clique por vez — exatamente o que a U78 recusou
  // ao não semear bloco nenhum.
  const [servico, setServico] = useState("");
  const [deslocamento, setDeslocamento] = useState("");
  /** o chamado já nasceu e o bloco não entrou — o estado que não pode mentir */
  const [criado, setCriado] = useState<string | null>(null);
  const [erroDoBloco, setErroDoBloco] = useState<{ frase: string; code: string | null } | null>(null);

  const { data: sistemas = [] } = useInventario(clienteId ?? undefined);
  const { data: duplas = [] } = useDuplas();
  const { data: escala = montarEscala([], []) } = useEscala();
  const { data: blocosDaSemana = [] } = useBlocosDaSemana(data);
  const marcarBloco = useMarcarBloco();
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const sistema = sistemas.find((s) => s.id === sistemaId) ?? null;

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // card() do lib/ui — o mesmo das telas irmãs do fluxo (novo, painel,
  // programação); antes esta era a única com o card v3 feito à mão
  const CARD: CSSProperties = {
    ...card(isLight), padding: "16px",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const NOTA: CSSProperties = { fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary };
  const chip = (ativo: boolean, cores?: { bg: string; border: string; cor: string }): CSSProperties => ({
    padding: "9px 13px", borderRadius: 11,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
    background: ativo
      ? cores
        ? cores.bg
        : "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? (cores ? cores.cor : "#08090E") : textPrimary,
    boxShadow: ativo && cores ? `inset 0 0 0 1px ${cores.border}` : undefined,
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12, cursor: "pointer",
  });

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!termo) return [];
    return clientes.filter((c) =>
      `${c.nome} ${c.endereco ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(termo),
    );
  }, [clientes, buscaCliente]);

  /**
   * A semana do DIA ESCOLHIDO — nunca "a semana de hoje". É a mesma que a
   * camada (iv) do gate consulta no servidor (`dupla_da_pessoa(auth.uid(),
   * v_dia)`), e é justamente no gesto que empurra o atendimento para a semana
   * seguinte que a resposta muda.
   */
  const semanaDoDia = useMemo(() => {
    const d = dataDoDia(data);
    return d ? referenciaSemanal(d) : referenciaSemanal(new Date());
  }, [data]);

  const equipesDaSemana = useMemo(
    () => duplas
      .map((d) => ({ dupla: d, membros: composicaoDaDupla(d.id, semanaDoDia, escala) }))
      .filter((x) => x.membros.length > 0),
    [duplas, semanaDoDia, escala],
  );
  const nomeDeTecnico = (id: string) =>
    (tecnicos as any[]).find((t) => t.id === id)?.nome ?? "Técnico";

  /**
   * A equipe DERIVADA do técnico escolhido, na semana do dia de destino — é a
   * doutrina da U47/U76 ("a dupla é derivada do responsável"). Ela PROPÕE o
   * valor do campo; quem manda é o que estiver selecionado, porque
   * `agenda_campo.dupla_id` é quem se comprometeu com a janela e pode ser outro.
   */
  const equipeDerivada = useMemo(
    () => duplaDaPessoaNaSemana(tecnicoId || null, semanaDoDia, escala),
    [tecnicoId, semanaDoDia, escala],
  );
  const equipeEscolhida = equipeId ?? equipeDerivada ?? "";

  /**
   * R126 — o RESPONSÁVEL EFETIVO: o técnico, ou o primeiro da escala da equipe
   * escolhida. É o que vai para `responsavel_id`; a tela mostra a proposta
   * antes de gravar, para ninguém descobrir depois quem ficou com o chamado.
   */
  const composicaoEscolhida = useMemo(
    () => (equipeEscolhida ? composicaoDaDupla(equipeEscolhida, semanaDoDia, escala) : []),
    [equipeEscolhida, semanaDoDia, escala],
  );
  const responsavelEfetivo = responsavelProposto(tecnicoId || null, composicaoEscolhida);

  /** O que a equipe escolhida já tem naquela semana — substitui a prévia antiga,
   *  que consultava `chamados` por responsável e não enxergava nem OS de fora
   *  nem retorno, e ainda era por PESSOA em vez de por equipe. */
  const agendaDaEquipe = useMemo(
    () => (equipeEscolhida
      ? blocosDaEquipeNaSemana(equipeEscolhida, semanaDoDia, blocosDaSemana, referenciaSemanal)
      : []),
    [equipeEscolhida, semanaDoDia, blocosDaSemana],
  );

  const servicoMin = Number(servico) > 0 ? Math.round(Number(servico)) : null;
  const deslocamentoMin = deslocamento.trim() === "" ? 0 : Math.max(0, Math.round(Number(deslocamento) || 0));
  const vaiAgendar = !!data && !!equipeEscolhida && servicoMin !== null;
  const propostaDeInicio = useMemo(
    () => (equipeEscolhida && data
      ? primeiroInicioPossivel(equipeEscolhida, data, blocosDaSemana, deslocamentoMin)
      : null),
    [equipeEscolhida, data, blocosDaSemana, deslocamentoMin],
  );

  const horasPrazo = sla[prioridade] ?? null;
  const prazoPrevisto = useMemo(() => {
    if (horasPrazo == null) return null;
    const d = new Date();
    d.setHours(d.getHours() + horasPrazo);
    return d;
  }, [horasPrazo]);

  // R126: a sugestão de título — o sistema (existente ou o que vai ser criado)
  // vence o cliente. Vira o placeholder E o valor gravado quando o campo fica
  // vazio, para o que a pessoa lê ser exatamente o que o banco recebe.
  const nomeDoSistemaAlvo = criandoSistema && podeCriarSistema(tipo)
    ? novoSistemaNome.trim() || null
    : sistema?.nome ?? null;
  const tituloSugerido = sugerirTitulo(tipo, nomeDoSistemaAlvo, cliente?.nome ?? null);
  const secao = secaoDoProblema(tipo);

  /** O bloco que o formulário está prometendo, se estiver prometendo algum. */
  const valoresDoBloco = (chamadoId: string): BlocoEditavel => ({
    chamado_id: chamadoId,
    dupla_id: equipeEscolhida,
    dia: data,
    inicio_min: (() => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    })(),
    servico_min: servicoMin ?? NaN,
    deslocamento_min: deslocamentoMin,
    os_externa: null,
    titulo_externo: null,
  });

  /**
   * A SEGUNDA ETAPA, isolada para poder ser repetida sozinha quando a primeira
   * já aconteceu. `_id: null` é criação: este chamado acabou de nascer e não
   * tem bloco nenhum, então não há como isto virar um "retorno" acidental.
   */
  const marcarHorario = (chamadoId: string, aoConseguir: () => void) => {
    marcarBloco.mutate(
      { id: null, patch: {}, valores: valoresDoBloco(chamadoId), atual: null },
      {
        onSuccess: aoConseguir,
        onError: (e: unknown) => {
          setCriado(chamadoId);
          setErroDoBloco({ frase: (e as Error).message, code: sqlstateDoErro(e) });
        },
      },
    );
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Escolha o cliente do chamado.");
      // R126: o sistema a implantar nasce ANTES do chamado, para o chamado já
      // apontar para ele. Se a criação do sistema falhar, nada foi aberto.
      let sistemaFinal = sistemaId;
      if (criandoSistema && podeCriarSistema(tipo)) {
        if (!novoSistemaNome.trim()) throw new Error("Dê um nome ao sistema a implantar.");
        sistemaFinal = await criarSistema({
          cliente_id: clienteId,
          tipo: novoSistemaTipo,
          nome: novoSistemaNome.trim(),
          descricao: "Em implantação — cadastrado ao abrir o chamado.",
        });
        qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
      }
      const chamadoId = await abrirChamado({
        natureza: "campo",
        tipo,
        cliente_id: clienteId,
        cliente_sistema_id: sistemaFinal,
        titulo: titulo.trim() || tituloSugerido,
        descricao_problema: descricao.trim() || null,
        prioridade,
        responsavel_id: responsavelEfetivo,
      });
      // Preventiva já nasce com o roteiro de verificação dos sistemas
      if (tipo === "preventiva") {
        const alvos = sistemaFinal ? sistemas.filter((s) => s.id === sistemaFinal) : sistemas.filter((s) => s.ativo);
        if (alvos.length > 0) {
          await montarChecklistPreventiva(
            chamadoId,
            alvos.map((s) => ({ id: s.id, nome: s.nome, tipo: s.tipo })),
          );
        }
      }
      return chamadoId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      const terminar = () => aoConcluir(id);
      if (vaiAgendar) {
        marcarHorario(id, () => { toast.success("Chamado aberto e horário marcado."); terminar(); });
        return;
      }
      // NADA SOME CALADO: se havia data e não havia equipe (ou duração), o
      // chamado vai para a fila da programação, e a tela DIZ isso.
      toast.success(
        data
          ? "Chamado aberto — ele está aguardando programação."
          : "Chamado aberto!",
      );
      terminar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ocupado = criar.isPending || marcarBloco.isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Tipo */}
      <div style={CARD}>
        <span style={SEC}>Tipo de atendimento</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* U83: era uma cópia à mão da lista de tipos de campo, com
              `as ChamadoTipo[]` desligando o compilador. Agora DERIVA da
              lista de OFERTA — este seletor grava, então ele é o lugar em que
              a diferença entre "renderizável" e "oferecido" morde. */}
          {tiposDaNatureza("campo").map((t) => (
            <button
              key={t}
              style={chip(tipo === t)}
              onClick={() => {
                setTipo(t);
                // trocar de tipo desliga a criação de sistema: só a implantação a oferece
                if (!podeCriarSistema(t)) setCriandoSistema(false);
              }}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente + sistema */}
      <div style={CARD}>
        <span style={SEC}>Cliente</span>
        {cliente ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Building2 size={18} color={gold} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 14 }}>{cliente.nome}</div>
              <div style={NOTA}>{cliente.endereco ?? "sem endereço"}</div>
            </div>
            <button
              onClick={() => { setClienteId(null); setSistemaId(null); setBuscaCliente(""); setCriandoSistema(false); }}
              style={{
                height: 34, padding: "0 12px", borderRadius: 10, flexShrink: 0,
                background: isLight ? "#ffffff" : "#191921",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: textPrimary, cursor: "pointer",
                fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 600,
              }}
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <Search size={15} color={textSecondary} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ ...INPUT, paddingLeft: 36 }}
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar cliente por nome ou endereço"
              />
            </div>
            {buscaCliente.trim() !== "" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {clientesFiltrados.length === 0 ? (
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                    Nenhum cliente encontrado. Cadastre em Gerencial → Clientes.
                  </span>
                ) : (
                  clientesFiltrados.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteId(c.id); setBuscaCliente(""); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                        background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                        border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                        color: textPrimary,
                      }}
                    >
                      <span style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13 }}>{c.nome}</span>
                      <span style={NOTA}>{c.endereco ?? "sem endereço"}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {cliente && (
          <div>
            {/* R126/R127: o campo pergunta conforme o tipo — "a implantar",
                "a revisar", "afetado". Uma pergunta só, três sentidos, e a
                função pura decide qual (abertura.ts). */}
            <label style={LABEL}>{rotuloDoSistema(tipo)}</label>
            {sistemas.length === 0 && !criandoSistema ? (
              <span style={NOTA}>
                {podeCriarSistema(tipo)
                  ? "Este cliente ainda não tem sistemas cadastrados — cadastre o que vai ser implantado abaixo."
                  : "Este cliente ainda não tem inventário — registre os sistemas na ficha do cliente."}
              </span>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sistemas.map((s) => (
                  <button
                    key={s.id}
                    style={chip(!criandoSistema && sistemaId === s.id)}
                    onClick={() => { setCriandoSistema(false); setSistemaId(sistemaId === s.id ? null : s.id); }}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            )}
            {podeCriarSistema(tipo) && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => { setCriandoSistema((v) => !v); setSistemaId(null); }}
                  aria-pressed={criandoSistema}
                  style={{
                    ...chip(criandoSistema), display: "inline-flex", alignItems: "center", gap: 6,
                    alignSelf: "flex-start",
                  }}
                >
                  <Plus size={13} />
                  Novo sistema neste cliente
                </button>
                {criandoSistema && (
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 10 }}>
                    <div>
                      <label style={LABEL}>Tipo do sistema</label>
                      <select
                        style={INPUT}
                        value={novoSistemaTipo}
                        onChange={(e) => setNovoSistemaTipo(e.target.value as TipoSistema)}
                      >
                        {TIPOS_SISTEMA.map((t) => (
                          <option key={t} value={t}>{TIPO_SISTEMA_LABEL[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={LABEL}>Nome do sistema</label>
                      <input
                        style={INPUT}
                        value={novoSistemaNome}
                        onChange={(e) => setNovoSistemaNome(e.target.value)}
                        placeholder={`Ex.: ${TIPO_SISTEMA_LABEL[novoSistemaTipo]} — bloco A`}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Problema / escopo — a seção muda de pergunta conforme o tipo (R126) */}
      <div style={CARD}>
        <span style={SEC}>{secao.titulo}</span>
        <div>
          <label style={LABEL}>Assunto</label>
          <input
            style={INPUT}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={cliente ? tituloSugerido : secao.placeholderAssunto}
          />
          {cliente && !titulo.trim() && (
            <div style={{ ...NOTA, marginTop: 6 }}>
              Sem assunto, o chamado se chama <b style={{ color: textPrimary, fontWeight: 600 }}>{tituloSugerido}</b>.
            </div>
          )}
        </div>
        <div>
          <label style={LABEL}>Detalhes</label>
          <textarea
            style={{ ...INPUT, height: 96, padding: "12px 14px", resize: "vertical" }}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={secao.placeholderDetalhes}
          />
        </div>
        <div>
          <label style={LABEL}>Prioridade</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["baixa", "normal", "alta", "urgente"] as ChamadoPrioridade[]).map((p) => {
              const c = PRIORIDADE_CORES[p];
              return (
                <button
                  key={p}
                  style={chip(prioridade === p, { bg: c.bg, border: c.border, cor: isLight ? c.light : c.dark })}
                  onClick={() => setPrioridade(p)}
                >
                  {PRIORIDADE_LABEL[p]}
                </button>
              );
            })}
          </div>
          <div style={{ ...NOTA, marginTop: 8 }}>
            {tipo === "implantacao"
              ? "Implantação não tem SLA por prioridade: o prazo é o fim previsto do período da obra (R120)."
              : horasPrazo == null
                ? "Sem prazo definido — agendável livremente."
                : `Prazo de atendimento: ${horasPrazo}h · vence ${prazoPrevisto?.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          </div>
        </div>
      </div>

      {/* Responsável e agenda */}
      <div style={CARD}>
        <span style={SEC}>Responsável e agenda</span>
        {/* A EQUIPE, e não o técnico, é quem se compromete com a janela.
            `agenda_campo.dupla_id` é NOT NULL e o EXCLUDE de sobreposição é por
            equipe — a equipe sai JUNTA, no mesmo carro. O campo vem proposto
            pela derivação do técnico (U47/U76) e continua editável. R126: a
            equipe vem PRIMEIRO, porque é ela que o Vinicius escolhe na maioria
            dos chamados — o técnico solo é a exceção. */}
        <div>
          <label style={LABEL}>Equipe de campo</label>
          <select
            style={INPUT}
            value={equipeEscolhida}
            onChange={(e) => setEquipeId(e.target.value)}
          >
            <option value="">— sem equipe: técnico solo, ou “aguardando programação” —</option>
            {equipesDaSemana.map(({ dupla, membros }) => (
              <option key={dupla.id} value={dupla.id}>
                {rotuloDaComposicao(dupla, membros, nomeDeTecnico)}
              </option>
            ))}
          </select>
          {tecnicoId && !equipeDerivada && (
            <div style={{ ...NOTA, marginTop: 6 }}>
              Este técnico não está escalado em nenhuma equipe na semana deste dia. Escolha a equipe acima,
              ou lance a escala em Operacional Técnica → Equipes.
            </div>
          )}
        </div>
        <div>
          <label style={LABEL}>Técnico responsável</label>
          <select style={INPUT} value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
            <option value="">{equipeEscolhida ? "O primeiro da escala da equipe" : "Definir depois"}</option>
            {tecnicos.map((t: any) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          {/* R126: a proposta é DITA antes de gravar. Quem lê "responsável:
              Breno" e não quer, troca acima — ninguém descobre depois. */}
          {!tecnicoId && responsavelEfetivo && (
            <div style={{ ...NOTA, marginTop: 6 }}>
              Responsável proposto: <b style={{ color: textPrimary, fontWeight: 600 }}>{nomeDeTecnico(responsavelEfetivo)}</b>
              {" "}(primeiro da escala desta equipe) — escolha outro acima se for o caso.
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Data</label>
            <input style={INPUT} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Hora</label>
            <input style={INPUT} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Duração do serviço (min)</label>
            <input
              style={INPUT} type="number" min={1} step={5} placeholder="—"
              value={servico} onChange={(e) => setServico(e.target.value)}
            />
          </div>
          <div>
            <label style={LABEL}>Deslocamento (min)</label>
            <input
              style={INPUT} type="number" min={0} step={5} placeholder="0"
              value={deslocamento} onChange={(e) => setDeslocamento(e.target.value)}
            />
          </div>
        </div>
        {propostaDeInicio !== null && (
          <div style={NOTA}>
            A equipe está livre a partir das {horaTexto(propostaDeInicio)} nesse dia
            {servicoMin ? ` · este atendimento ocupa ${duracaoTexto(servicoMin + deslocamentoMin)}` : ""}.
          </div>
        )}
        {equipeEscolhida && data && propostaDeInicio === null && (
          <div style={NOTA}>
            Este dia já está cheio para esta equipe (8h de campo). Escolha outro dia, outra equipe,
            ou marque depois pela programação.
          </div>
        )}
        {agendaDaEquipe.length > 0 && (
          <div>
            <label style={LABEL}>A equipe já tem estes horários na semana</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {agendaDaEquipe.slice(0, 8).map((b) => (
                <span key={b.id} style={NOTA}>
                  {b.dia} · {horaTexto(b.inicio_min)}–{horaTexto(b.inicio_min + b.servico_min)}
                  {b.deslocamento_min > 0 ? ` (+${duracaoTexto(b.deslocamento_min)} de estrada)` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* O ERRO DO BLOCO VOLTA AQUI DENTRO, e o cabeçalho dele não mente: o
            chamado JÁ EXISTE. Um toast dizendo "falhou ao abrir chamado" seria
            falso, e um toast solto sumiria levando junto a única pista. */}
        {erroDoBloco && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 14px", borderRadius: 12,
            background: classeDoErro(erroDoBloco.code) === "regra"
              ? PRISMA.laranja.bg
              : isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)",
            border: `1px solid ${classeDoErro(erroDoBloco.code) === "regra"
              ? PRISMA.laranja.border
              : isLight ? "rgba(177,36,46,0.22)" : "rgba(241,120,129,0.24)"}`,
            fontFamily: "var(--fonte)", fontSize: 12.5,
            color: classeDoErro(erroDoBloco.code) === "regra"
              ? (isLight ? PRISMA.laranja.light : PRISMA.laranja.dark)
              : (isLight ? "#B1242E" : "#F17881"),
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <b>O chamado foi aberto. O horário não entrou:</b><br />
              {erroDoBloco.frase}<br />
              Ajuste os campos acima e toque em “Marcar horário”, ou abra o chamado e marque pela programação.
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          if (criado) {
            setErroDoBloco(null);
            marcarHorario(criado, () => {
              toast.success("Horário marcado.");
              aoConcluir(criado);
            });
            return;
          }
          criar.mutate();
        }}
        disabled={ocupado}
        style={{
          width: "100%", height: 56, borderRadius: 28, border: "none",
          background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)", color: "#08090E",
          fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 13,
          letterSpacing: "0.16em", textTransform: "uppercase",
          cursor: ocupado ? "wait" : "pointer",
          opacity: ocupado ? 0.7 : 1,
          boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
        }}
      >
        {criado
          ? (marcarBloco.isPending ? "Marcando…" : "Marcar horário")
          : ocupado ? "Abrindo…" : "Abrir chamado"}
      </button>
      {/* A LINHA QUE DIZ PARA ONDE O CHAMADO VAI. Sem ela, preencher a data e
          esquecer a equipe faria a data desaparecer em silêncio — que é
          exatamente o defeito que este religamento existe para não ter. */}
      {!criado && (
        <div style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, textAlign: "center" }}>
          {vaiAgendar
            ? `Vai para a agenda: ${data} às ${hora}, ${duracaoTexto((servicoMin ?? 0) + deslocamentoMin)} da equipe.`
            : data
              ? "Sem equipe ou sem duração, o chamado entra na fila “aguardando programação” — a data escolhida aqui não é gravada."
              : "Sem data, o chamado entra na fila “aguardando programação”."}
        </div>
      )}
    </div>
  );
}
