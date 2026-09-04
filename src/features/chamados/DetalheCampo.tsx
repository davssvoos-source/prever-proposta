// Chamado de CAMPO — o corpo da tela quando natureza = 'campo'.
// Decide as ações pelo status e pelo papel: aqui o técnico executa (fotos
// antes/depois, diagnóstico, peças, assinatura) e o gestor confere e fecha.
// Extraído de /os/$id na Etapa U7 — quem monta a página é /chamados/$id.

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, ArrowLeft, Building2, Camera, CheckCircle2, ClipboardList, Clock,
  CheckSquare, FileDown, History, ListChecks, MapPin, Phone, PlayCircle, Plus, Receipt,
  Sparkles, Square, Trash2, User, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { card } from "@/lib/ui";
import { TextoComChecklist } from "@/components/TextoComChecklist";
import { useIsGerente, useTecnicos, useVeFinanceiro } from "@/features/gerencial/data";
import { AssinaturaCanvas } from "@/features/chamados/AssinaturaCanvas";
import {
  useChamado, useChamadoEventos, useChamadoFotos, useAssinaturaUrl,
  iniciarChamado, executarChamado, concluirChamado, reabrirChamado, cancelarChamado,
  atualizarChamado, anexarFoto, excluirFoto, salvarAssinatura,
} from "@/features/chamados/data";
import { gerarRelatorioOs } from "@/features/chamados/relatorio";
import {
  usePecas, registrarPeca, removerPeca,
  DIRECAO_LABEL, DIRECAO_CORES, type DirecaoPeca,
} from "@/features/chamados/pecas";
import {
  useAnaliseChamado, useCobrancasDoChamado, useLancamentoDoChamado, aprovarCobranca,
  marcarFaturada, ajustarItem, totalFaturavel, moeda,
  RESULTADO_LABEL, RESULTADO_CORES, FATURAMENTO_LABEL,
  type ResultadoItem, type FaturamentoStatus,
} from "@/features/chamados/cobranca";
import { analisarCobrancaChamado } from "@/lib/cobranca.functions";
import { useChecklist, marcarItemChecklist } from "@/features/chamados/checklist";
import { CronogramaObra } from "@/features/implantacao/CronogramaObra";
import { derivarInventarioDaVisita } from "@/features/clientes/inventario";
import {
  useAfirmarVisitas, useConcluirComCobranca, sqlstateDoErro, RecusaDaAgenda,
} from "@/features/programacao/data";
import { erroDoLancamento, reaisDigitados } from "@/features/programacao/modelo";
import { parcelar } from "@/lib/periodos";

/** As três decisões de `concluir_chamado_com_cobranca` (U80), na conferência. */
type DecisaoDoFechamento = "conferir_depois" | "nada_a_cobrar" | "lancar";
import {
  ConfirmacaoDasVisitas,
  useConfirmacaoDasVisitas,
} from "@/features/programacao/ConfirmacaoDasVisitas";
import {
  chamadoStatusInfo, situacaoPrazo, textoPrazo,
  TIPO_LABEL, PRIORIDADE_LABEL, PRIORIDADE_CORES,
  type ChamadoPrioridade,
} from "@/lib/chamado-status";

export function DetalheCampo({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  // SAC é gestor mas não vê valores (R13): o card de cobrança é só financeiro
  const { data: veFinanceiro = false } = useVeFinanceiro();
  const { data: os, isLoading } = useChamado(id);
  const { data: eventos = [] } = useChamadoEventos(id);
  const { data: fotos = [] } = useChamadoFotos(id);
  const { data: checklist = [] } = useChecklist(id);
  const { data: tecnicos = [] } = useTecnicos();
  const { data: assinaturaUrl } = useAssinaturaUrl(os?.assinatura_url);
  const [userId, setUserId] = useState<string | null>(null);

  const [diagnostico, setDiagnostico] = useState("");
  const [servico, setServico] = useState("");
  const [assinanteNome, setAssinanteNome] = useState("");
  const [assinaturaData, setAssinaturaData] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  // movimentação de equipamento — Etapa U3
  const { data: pecasOs = [] } = usePecas(id);
  const [novaDirecao, setNovaDirecao] = useState<DirecaoPeca>("instalado");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaSerie, setNovaSerie] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");
  // conferência de cobrança — Etapa U4
  const { data: analise = [] } = useAnaliseChamado(id);

  // ── A DECISÃO DE COBRANÇA NA CONFERÊNCIA (R121, U90) ─────────────────────
  // A CONTA NÃO MORA AQUI. `erroDoLancamento` e `parcelar` são os MESMOS que o
  // painel da programação usa — importados, não recriados. Duas telas que
  // dividissem R$ 100 em 3 cada uma do seu jeito dariam 99,99 numa e 100,00 na
  // outra, e o cliente pagaria a menos numa delas para sempre. O que se repete
  // abaixo é só o JSX; a aritmética tem um dono só.
  const [lancDescricao, setLancDescricao] = useState("");
  const [lancValor, setLancValor] = useState("");
  const [lancParcelas, setLancParcelas] = useState("1");

  const candidatoDoLancamento = {
    descricao: lancDescricao,
    valorTotal: (() => { const n = reaisDigitados(lancValor); return Number.isFinite(n) ? n : 0; })(),
    parcelas: (() => { const n = Number(lancParcelas); return Number.isFinite(n) ? n : 0; })(),
    tipoServico: (os?.tipo_servico ?? "manutencao") as "instalacao" | "manutencao",
  };
  const erroDoLanc = erroDoLancamento(candidatoDoLancamento);
  const previaDasParcelas = erroDoLanc
    ? []
    : parcelar(candidatoDoLancamento.valorTotal, candidatoDoLancamento.parcelas);

  /**
   * A CONDIÇÃO MORA NUM LUGAR SÓ, e isso não é economia de linha.
   * Ela decide DUAS coisas: o que o botão FAZ e o que o botão DIZ. Escrita
   * duas vezes, uma pode ganhar um termo que a outra não ganha — e aí o botão
   * anuncia "Conferir e fechar" e lança uma cobrança, ou anuncia o lançamento
   * e não lança. Um const torna a divergência inexprimível.
   */
  const podeDecidirValor = veFinanceiro && os?.natureza === "campo" && analise.length === 0;
  const vaiLancar = podeDecidirValor && lancDescricao.trim() !== "" && !erroDoLanc;
  const { data: cobrancasOs = [] } = useCobrancasDoChamado(id);
  /**
   * O RECORTE, VINDO DE UM LUGAR SÓ (U80). `cancelada` NÃO conta como
   * lançamento — é o mesmo predicado de `temLancamento`, de `montar_fechamento`
   * (u5:139), de `consolidar()` e dos dois índices únicos da U80. Antes desta
   * entrega o card somava a cancelada junto e anunciava dinheiro que não
   * existe.
   */
  const cobrancasVivas = cobrancasOs.filter((c) => c.status !== "cancelada");
  const canceladasOs = cobrancasOs.length - cobrancasVivas.length;
  /** O bit da U80 — a mesma resposta que o cartão da grade usa, para as duas
   *  telas nunca discordarem sobre o mesmo chamado. `undefined` = não sei. */
  const { data: temLancamentoRpc } = useLancamentoDoChamado(id);
  const analisarFn = useServerFn(analisarCobrancaChamado);
  const [itemEditando, setItemEditando] = useState<string | null>(null);
  const [novoResultado, setNovoResultado] = useState<ResultadoItem>("revisar");
  const [novoValor, setNovoValor] = useState("");

  /**
   * A SEGUNDA MÃO DO CARIMBO (U82 — R109/R110/R111).
   *
   * A afirmação vem ANTES do status, sempre, nos três encerramentos desta tela
   * (`concluir`, `fechar`, `cancelar`). É a única ordem em que o espelho anda
   * bloco a bloco (u78:895) — e portanto a única em que o congelamento da U81
   * pega a turma de CADA semana ISO — e a única em que `agenda_campo_valida`
   * (u78:774-776) ainda deixa o TÉCNICO corrigir o dia de um bloco.
   *
   * E ELA NUNCA DERRUBA O ENCERRAMENTO. Enquanto a migration não rodou, a porta
   * responde PGRST202 e `useAfirmarVisitas` devolve `portaAusente: true` — o
   * chamado encerra igual e a frase diz a verdade. É a regra 5 da casa (ordem
   * de deploy) como propriedade do código, e não como disciplina de commit.
   */
  const conf = useConfirmacaoDasVisitas(id);
  const afirmar = useAfirmarVisitas();
  const [erroDaVisita, setErroDaVisita] = useState<{ frase: string; code: string | null } | null>(null);

  /**
   * O passo comum dos TRÊS encerramentos. Se a porta ainda não existe no banco,
   * ele AVISA e segue — a frase é dita aqui, e não em cada `onSuccess`, para os
   * três caminhos nunca divergirem sobre o que aconteceu.
   */
  async function afirmarAntesDeEncerrar(): Promise<boolean> {
    setErroDaVisita(null);
    // O CINTO: SEM GESTO, NÃO HÁ PORTA, E LOGO NÃO HÁ RECUSA A ANTECIPAR.
    // Esta linha e o `temGesto` de `ConfirmacaoDasVisitas` são a MESMA regra
    // ditas dos dois lados, de propósito: esta tela recebe todo chamado que não
    // é `interno` (a rota só desvia esse), inclusive os COMERCIAIS, que não têm
    // bloco nenhum. Sem ela, a recusa de natureza vinha antes de existir gesto
    // e o `throw` abaixo tornava o chamado comercial impossível de concluir,
    // fechar ou cancelar — no instante do push, sem a migration ter rodado.
    const { feitos, desmarcados } = conf.payload;
    if (feitos.length === 0 && desmarcados.length === 0) return false;
    // `RecusaDaAgenda` E NÃO `Error`: ela leva o SQLSTATE junto (data.ts:493),
    // que é o que faz `classeDoErro` pintar o MESMO rosto para um erro nascido
    // aqui e para o mesmo erro nascido no Postgres. Com `new Error` o código
    // saía `null`, `classeDoErro(null)` dava "desconhecido", e a frase aparecia
    // sem cara nenhuma.
    if (conf.recusa) throw new RecusaDaAgenda(conf.recusa.frase, conf.recusa.code);
    const r = await afirmar.mutateAsync({ chamadoId: id, ...conf.payload });
    if (r.portaAusente) {
      toast.message(
        "As visitas não foram marcadas como feitas: a atualização do banco ainda não foi aplicada. Marque-as pela grade.",
      );
    } else if (r.portaMuda) {
      // A PORTA EXISTE E NÃO RESPONDEU (rede, 503, timeout). O encerramento
      // SEGUE: afirmar é cortesia, e prender o técnico no prédio com a
      // assinatura já gravada é o pior caso que este desenho existe para evitar.
      // E O AVISO NÃO PODE PROMETER O CHIP. Com a porta MUDA nada foi escrito,
      // mas o soltador do §3 roda assim mesmo: atendimento marcado para um dia
      // que ainda não chegou é DESMARCADO no encerramento, e `visitasNaoAfirmadas`
      // só enxerga bloco pendente — ele não aparece em chip nenhum. Ressuscitá-lo
      // é `agenda_campo_marcar` num chamado concluído, que devolve 42501 para
      // quem não é gestão. A versão anterior desta frase mandava "responder
      // depois pelo aviso", e o aviso não ia existir.
      toast.message(
        "Não consegui gravar a resposta sobre as visitas agora (conexão). O chamado foi encerrado, e o atendimento que ainda estava marcado para um dia que não chegou saiu da agenda — se ele aconteceu, peça à gestão para remarcá-lo.",
      );
    }
    return r.portaAusente || r.portaMuda;
  }

  function guardarErroDaVisita(e: unknown) {
    setErroDaVisita({ frase: (e as Error).message, code: sqlstateDoErro(e) });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!os) return;
    setDiagnostico(os.diagnostico ?? "");
    setServico(os.servico_executado ?? "");
    setAssinanteNome(os.assinatura_nome ?? "");
  }, [os?.id, os?.diagnostico, os?.servico_executado, os?.assinatura_nome]);

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // card() da casa — o mesmo do painel e da programação, telas que o usuário
  // percorre em sequência com esta
  const CARD: CSSProperties = {
    ...card(isLight),
    padding: "16px",
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
    width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const CTA: CSSProperties = {
    width: "100%", height: 54, borderRadius: 27, border: "none",
    background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)", color: "#08090E",
    fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 13,
    letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
  };
  const btnSec: CSSProperties = {
    height: 44, padding: "0 16px", borderRadius: 22,
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8,
    fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12,
  };
  const linha: CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0",
    borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
  };

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["chamado", id] });
    qc.invalidateQueries({ queryKey: ["chamados"] });
    qc.invalidateQueries({ queryKey: ["chamado-eventos", id] });
    qc.invalidateQueries({ queryKey: ["chamado-fotos", id] });
    // U82: encerrar DESMARCA blocos por GATILHO (`chamado_solta_agenda`), e
    // essa escrita acontece DEPOIS desta mutação — a invalidação de
    // `useAfirmarVisitas` veio ANTES dela e fotografou o estado velho. Sem esta
    // linha a grade e o chip continuam desenhando blocos que o banco acabou de
    // soltar, e arrastar um deles o RESSUSCITA (u78:1399 zera `cancelado_em`)
    // num chamado já encerrado, sem ninguém ter pedido.
    qc.invalidateQueries({ queryKey: ["agenda-campo"] });
  };

  const iniciar = useMutation({
    mutationFn: () => iniciarChamado(id),
    onSuccess: () => { invalidar(); toast.success("Atendimento iniciado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarRascunho = useMutation({
    // pecas_texto virou legado na U3: as peças têm tabela própria e não são
    // mais sobrescritas por este rascunho
    mutationFn: () => atualizarChamado(id, { diagnostico, servico_executado: servico }),
    onSuccess: () => { invalidar(); toast.success("Anotações salvas."); },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Movimentação de equipamento do atendimento — Etapa U3. */
  const mexerPeca = useMutation({
    mutationFn: async (acao: { tipo: "add" } | { tipo: "del"; pecaId: string }) => {
      if (acao.tipo === "del") return removerPeca(acao.pecaId);
      const descricao = novaDescricao.trim();
      if (!descricao) throw new Error("Descreva o equipamento ou material.");
      const qtd = Number(novaQtd.replace(",", "."));
      await registrarPeca(id, {
        descricao,
        direcao: novaDirecao,
        numero_serie: novaSerie.trim() || null,
        quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
      });
    },
    onSuccess: () => {
      setNovaDescricao("");
      setNovaSerie("");
      setNovaQtd("1");
      qc.invalidateQueries({ queryKey: ["chamado-pecas", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Análise de cobertura — Etapa U4. Nada é cobrado por ela; só classifica. */
  const invalidarCobranca = () => {
    qc.invalidateQueries({ queryKey: ["chamado-analise", id] });
    qc.invalidateQueries({ queryKey: ["cobrancas-chamado", id] });
    qc.invalidateQueries({ queryKey: ["chamado", id] });
  };

  const analisar = useMutation({
    mutationFn: async () => {
      const r = await analisarFn({ data: { chamadoId: id } });
      if (!r.ok || !r.resumo) throw new Error(r.erro ?? "Não consegui analisar.");
      return r.resumo;
    },
    onSuccess: (r) => {
      invalidarCobranca();
      if (r.aviso) toast.warning(r.aviso);
      toast.success(
        r.revisar > 0
          ? `${r.faturaveis} faturável(is), ${r.cobertos} coberto(s) e ${r.revisar} para conferir.`
          : `${r.faturaveis} item(ns) faturável(is) — ${moeda(r.valorFaturavel)}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ajustar = useMutation({
    mutationFn: async ({ pecaId }: { pecaId: string }) => {
      const v = novoValor.trim() ? Number(novoValor.replace(",", ".")) : null;
      if (novoResultado === "faturavel" && (v == null || !Number.isFinite(v) || v <= 0)) {
        throw new Error("Item faturável precisa de valor. Sem preço, deixe em revisão.");
      }
      await ajustarItem(pecaId, novoResultado, novoResultado === "coberto" ? null : v);
    },
    onSuccess: () => {
      setItemEditando(null);
      invalidarCobranca();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aprovar = useMutation({
    mutationFn: () => aprovarCobranca(id),
    onSuccess: (r) => {
      invalidarCobranca();
      toast.success(
        r.itens === 0
          ? "Conferência concluída: nada a cobrar neste atendimento."
          : `${r.itens} cobrança(s) geradas — ${moeda(r.total)}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const faturar = useMutation({
    mutationFn: () => marcarFaturada(id),
    onSuccess: (n) => {
      invalidarCobranca();
      toast.success(`${n} cobrança(s) marcadas como faturadas.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const concluir = useMutation({
    mutationFn: async () => {
      if (!diagnostico.trim()) throw new Error("Descreva o diagnóstico do problema.");
      if (!servico.trim()) throw new Error("Descreva o serviço executado.");
      if (!os?.assinatura_url) {
        if (!assinaturaData) throw new Error("Colete a assinatura de quem acompanhou o serviço.");
        if (!assinanteNome.trim()) throw new Error("Informe o nome de quem assinou.");
        await salvarAssinatura(id, assinaturaData, assinanteNome.trim());
      }
      // A AFIRMAÇÃO VEM ANTES DO STATUS — ver `afirmarAntesDeEncerrar`.
      await afirmarAntesDeEncerrar();
      await executarChamado(id, {
        diagnostico: diagnostico.trim(),
        servico_executado: servico.trim(),
      });
    },
    onSuccess: () => {
      invalidar();
      toast.success("Chamado concluído — enviado para conferência.");
    },
    onError: (e: Error) => { guardarErroDaVisita(e); toast.error(e.message); },
  });

  /**
   * A CONFERÊNCIA PASSA A DECIDIR O DINHEIRO (R121, U90).
   *
   * ── O QUE ESTE BOTÃO FAZIA, E POR QUE ERA POUCO ─────────────────────────
   * `concluirChamado` é um UPDATE puro: status (que já era 'concluido' desde
   * `executarChamado`), os carimbos, e `fechado_por`. Ele NÃO tocava em
   * `faturamento_status` — e como a caixa de conferência só aparece enquanto
   * esse campo é 'a_analisar', **"Conferir e fechar" não fechava nada**: o
   * chamado ficava na fila até alguém agir pelo cartão de cobrança.
   *
   * A porta que decide na MESMA transação já existia desde a U80
   * (`concluir_chamado_com_cobranca`), e vivia só no painel da programação.
   * Encerrar pela página do próprio chamado pulava a pergunta do dinheiro em
   * silêncio. Agora não pula.
   *
   * ── O TÉCNICO NÃO É AFETADO ─────────────────────────────────────────────
   * O botão dele é outro (`concluir`, que é `executarChamado`). Esta caixa é
   * do gestor. E dentro dela, quem NÃO vê valores (o SAC — R13) continua com
   * exatamente um botão, que dispara `conferir_depois`: mesma escrita de
   * antes, mais um evento na linha do tempo.
   *
   * ── A GUARDA DE NATUREZA, E ELA É A LIÇÃO DA U82 ────────────────────────
   * `chamados.$id.tsx:37` manda TUDO que não é `interno` para cá — inclusive
   * o COMERCIAL. A U82 tornou chamado comercial impossível de encerrar por
   * exatamente esse caminho. A RPC é de ciclo de CAMPO (tipo de serviço,
   * parcelas, competência), então o comercial continua pelo caminho antigo.
   * Não é cautela decorativa: é o defeito que já aconteceu, uma vez.
   */
  const concluirComCobranca = useConcluirComCobranca();

  const fechar = useMutation({
    mutationFn: async (decisao: DecisaoDoFechamento = "conferir_depois") => {
      await afirmarAntesDeEncerrar();
      if (os?.natureza === "campo") {
        await concluirComCobranca.mutateAsync({
          chamadoId: id,
          decisao,
          tipoServico: (os.tipo_servico ?? "manutencao") as "instalacao" | "manutencao",
          ...(decisao === "lancar"
            ? {
                descricao: lancDescricao.trim(),
                valorTotal: candidatoDoLancamento.valorTotal,
                parcelas: previaDasParcelas,
              }
            : {}),
        });
      } else {
        await concluirChamado(id);
      }
      // Implantação concluída alimenta o inventário do cliente (as-built):
      // é o que fecha o ciclo proposta → implantação → corretiva/preventiva.
      if (os?.tipo === "implantacao" && os.visita_id) {
        return derivarInventarioDaVisita(os.cliente_id, os.visita_id);
      }
      return null;
    },
    onSuccess: (derivado, decisao) => {
      invalidar();
      const oQueFoiDecidido =
        decisao === "lancar" ? "Cobrança lançada."
        : decisao === "nada_a_cobrar" ? "Sem cobrança."
        : "A cobrança fica para a conferência.";
      if (derivado && derivado.sistemas > 0) {
        qc.invalidateQueries({ queryKey: ["cliente-inventario", os?.cliente_id] });
        toast.success(
          `Chamado fechado. ${oQueFoiDecidido} Inventário do cliente atualizado: ${derivado.sistemas} sistema(s), ${derivado.equipamentos} equipamento(s).`,
        );
      } else {
        toast.success(`Chamado fechado. ${oQueFoiDecidido}`);
      }
    },
    // `guardarErroDaVisita` também AQUI, como em `concluir` e `cancelar`: sem
    // ele, um 23P01 vindo do ensaio da porta virava só um toast, e as DUAS
    // saídas que o painel desenha para `classe === "conflito"` nunca eram
    // vistas — o erro que mais precisa de painel era o único sem painel.
    onError: (e: Error) => { guardarErroDaVisita(e); toast.error(e.message); },
  });

  const marcarItem = useMutation({
    mutationFn: ({ itemId, concluido }: { itemId: string; concluido: boolean }) =>
      marcarItemChecklist(itemId, concluido),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chamado-checklist", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: () => reabrirChamado(id),
    onSuccess: () => { invalidar(); toast.success("Chamado reaberto."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      if (!motivoCancel.trim()) throw new Error("Informe o motivo do cancelamento.");
      // Cancelar NÃO afirma nada por conta própria — mas quem foi ao prédio e
      // só depois viu o chamado cair ainda pode dizer isso aqui, e é ANTES do
      // status que essa frase tem valor. Depois, o gatilho desmarca o resto.
      await afirmarAntesDeEncerrar();
      return cancelarChamado(id, motivoCancel.trim());
    },
    onSuccess: () => { invalidar(); setCancelando(false); toast.success("Chamado cancelado."); },
    onError: (e: Error) => { guardarErroDaVisita(e); toast.error(e.message); },
  });

  const trocarTecnico = useMutation({
    mutationFn: (novo: string) => atualizarChamado(id, { responsavel_id: novo || null }),
    onSuccess: () => { invalidar(); toast.success("Técnico atualizado."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixarRelatorio = useMutation({
    mutationFn: async () => {
      if (!os) throw new Error("Chamado não carregado.");
      await gerarRelatorioOs({
        os,
        tecnicoNome: (tecnicos as any[]).find((t) => t.id === os.responsavel_id)?.nome ?? null,
        fotos: fotos.map((f) => ({ etapa: f.etapa, storage_path: f.storage_path, legenda: f.legenda })),
        pecas: pecasOs.map((p) => ({
          direcao: p.direcao,
          descricao: p.descricao,
          numero_serie: p.numero_serie,
          tag_patrimonio: p.tag_patrimonio,
          quantidade: Number(p.quantidade),
        })),
      });
    },
    onSuccess: () => toast.success("Relatório gerado — o download foi iniciado."),
    onError: (e: Error) => toast.error(e.message),
  });

  const removerFoto = useMutation({
    mutationFn: ({ fotoId, path }: { fotoId: string; path: string | null }) => excluirFoto(fotoId, path),
    onSuccess: () => { invalidar(); toast.success("Foto removida."); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function enviarFoto(arquivo: File | undefined, etapa: "antes" | "depois") {
    if (!arquivo) return;
    setEnviandoFoto(true);
    try {
      await anexarFoto(id, arquivo, etapa);
      invalidar();
      toast.success(etapa === "antes" ? "Foto do problema anexada." : "Foto da solução anexada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a foto");
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: "24px 0", color: textSecondary, fontFamily: "var(--fonte)", fontSize: 13 }}>
        Carregando chamado…
      </div>
    );
  }
  if (!os) {
    return (
      <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: 12, color: textPrimary }}>
        <span style={{ fontFamily: "var(--fonte)", fontSize: 14 }}>Chamado não encontrado.</span>
        <button onClick={() => navigate({ to: "/dashboard" })} style={{ ...btnSec, alignSelf: "flex-start" }}>
          Voltar para a Início
        </button>
      </div>
    );
  }

  const info = chamadoStatusInfo(os.status);
  const corStatus = isLight ? info.colorLight : info.color;
  const prio = PRIORIDADE_CORES[os.prioridade as ChamadoPrioridade] ?? PRIORIDADE_CORES.normal;
  const prazo = situacaoPrazo(os.prazo_limite, os.status);
  const souTecnico = !!userId && os.responsavel_id === userId;
  const podeExecutar = souTecnico || isGerente;
  const emExecucao = os.status === "em_andamento";
  const fotosAntes = fotos.filter((f) => f.etapa === "antes");
  const fotosDepois = fotos.filter((f) => f.etapa === "depois");

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 12, color: gold, letterSpacing: "0.06em" }}>
            {os.numero ?? "—"} · {TIPO_LABEL[os.tipo] ?? os.tipo}
          </div>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 17 }}>{os.titulo}</div>
        </div>
      </div>

      {/* Status + prazo */}
      <div style={{ ...CARD, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "4px 10px", borderRadius: 12,
              background: info.bg, border: `1px solid ${info.border}`, color: corStatus,
              fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 10,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {info.labelUpper}
          </span>
          <span
            style={{
              padding: "4px 10px", borderRadius: 12,
              background: prio.bg, border: `1px solid ${prio.border}`,
              color: isLight ? prio.light : prio.dark,
              fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 10,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {PRIORIDADE_LABEL[os.prioridade as ChamadoPrioridade] ?? os.prioridade}
          </span>
          {(prazo === "estourado" || prazo === "proximo") && (
            <span
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600,
                color: prazo === "estourado" ? (isLight ? "#B1242E" : "#F17881") : (isLight ? "#A63E17" : "#F8C811"),
              }}
            >
              <AlertTriangle size={13} />
              {textoPrazo(os.prazo_limite)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...linha, borderTop: "none" }}>
            <span style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 }}>Cliente</span>
            <button
              onClick={() => navigate({ to: "/clientes/$id", params: { id: os.cliente_id } })}
              style={{
                background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "right",
                fontFamily: "var(--fonte)", fontSize: 13, color: gold, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <Building2 size={13} />
              {os.cliente?.nome ?? "—"}
            </button>
          </div>
          {os.cliente?.endereco && (
            <div style={linha}>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 }}>Endereço</span>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary, textAlign: "right" }}>
                <MapPin size={12} style={{ display: "inline", marginRight: 4 }} />
                {os.cliente.endereco}
              </span>
            </div>
          )}
          {os.cliente?.telefone_sindico && (
            <div style={linha}>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 }}>Contato</span>
              <a
                href={`tel:${os.cliente.telefone_sindico}`}
                style={{
                  fontFamily: "var(--fonte)", fontSize: 13, color: gold, fontWeight: 600,
                  textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <Phone size={12} />
                {os.cliente.telefone_sindico}
              </a>
            </div>
          )}
          {os.sistema?.nome && (
            <div style={linha}>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 }}>Sistema</span>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary }}>{os.sistema.nome}</span>
            </div>
          )}
          {os.data_hora_agendada && (
            <div style={linha}>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 }}>Agendado</span>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary }}>
                <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                {new Date(os.data_hora_agendada).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <div style={linha}>
            <span style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 600 }}>Técnico</span>
            {isGerente && ["aberto", "agendado", "em_andamento"].includes(os.status) ? (
              <select
                value={os.responsavel_id ?? ""}
                onChange={(e) => trocarTecnico.mutate(e.target.value)}
                style={{
                  ...INPUT, width: "auto", padding: "6px 10px", fontSize: 12,
                  textAlign: "right",
                }}
              >
                <option value="">Sem técnico</option>
                {tecnicos.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary }}>
                <User size={12} style={{ display: "inline", marginRight: 4 }} />
                {tecnicos.find((t: any) => t.id === os.responsavel_id)?.nome ?? "não atribuído"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Problema relatado — itens de checklist viram caixa de marcar (só
          leitura aqui: quem edita a descrição é o painel de propriedades). */}
      {os.descricao_problema && (
        <div style={CARD}>
          <span style={SEC}>Problema relatado</span>
          <TextoComChecklist texto={os.descricao_problema} estilo={{ fontSize: 13 }} />
        </div>
      )}

      {/* Cancelado */}
      {os.status === "cancelado" && os.motivo_cancelamento && (
        <div style={{ ...CARD, border: `1px solid ${isLight ? "rgba(177,36,46,0.35)" : "rgba(241,120,129,0.30)"}` }}>
          <span style={SEC}>Motivo do cancelamento</span>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 13, fontWeight: 400 }}>
            {os.motivo_cancelamento}
          </div>
        </div>
      )}

      {/* Checklist (preventiva e implantação) */}
      {checklist.length > 0 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <ListChecks size={15} color={gold} />
            <span style={SEC}>Roteiro de verificação</span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 700,
                color: checklist.every((i) => i.concluido) ? (isLight ? "#047862" : "#2DD2A5") : gold,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {checklist.filter((i) => i.concluido).length}/{checklist.length}
            </span>
          </div>
          {(() => {
            const grupos = Array.from(new Set(checklist.map((i) => i.grupo ?? "Geral")));
            return grupos.map((g) => (
              <div key={g} style={{ marginTop: 6 }}>
                <div style={{ ...LABEL, marginBottom: 4 }}>{g}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {checklist
                    .filter((i) => (i.grupo ?? "Geral") === g)
                    .map((i) => (
                      <button
                        key={i.id}
                        onClick={() => emExecucao && marcarItem.mutate({ itemId: i.id, concluido: !i.concluido })}
                        disabled={!emExecucao}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0",
                          background: "transparent", border: "none", textAlign: "left",
                          cursor: emExecucao ? "pointer" : "default", color: textPrimary,
                          borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {i.concluido ? (
                          <CheckSquare size={16} color={isLight ? "#047862" : "#2DD2A5"} style={{ flexShrink: 0, marginTop: 1 }} />
                        ) : (
                          <Square size={16} color={textSecondary} style={{ flexShrink: 0, marginTop: 1 }} />
                        )}
                        <span
                          style={{
                            flex: 1, fontFamily: "var(--fonte)", fontSize: 12.5,
                            opacity: i.concluido ? 0.6 : 1,
                            textDecoration: i.concluido ? "line-through" : "none",
                          }}
                        >
                          {i.item}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Cronograma da obra — só na implantação (R120, U89).
          Fica ANTES de "Iniciar atendimento" de propósito: o cronograma é o
          plano, e o plano se lê antes de executar. E não some quando a obra é
          concluída — é ele que documenta o que foi entregue. */}
      {os.tipo === "implantacao" && (
        <CronogramaObra
          chamadoId={os.id}
          isLight={isLight}
          podeEditar={!!isGerente}
          dadosDoPdf={{
            numero: os.numero ?? null,
            titulo: os.titulo ?? null,
            cliente: os.cliente?.nome ?? os.cliente_origem_nome ?? null,
            endereco: os.cliente?.endereco ?? null,
          }}
        />
      )}

      {/* Iniciar atendimento */}
      {podeExecutar && ["aberto", "agendado"].includes(os.status) && (
        <button style={CTA} onClick={() => iniciar.mutate()} disabled={iniciar.isPending}>
          <PlayCircle size={18} />
          {iniciar.isPending ? "Iniciando…" : "Iniciar atendimento"}
        </button>
      )}

      {/* Execução */}
      {podeExecutar && ["em_andamento", "concluido"].includes(os.status) && (
        <div style={CARD}>
          <span style={SEC}>Execução</span>

          {/* Fotos antes/depois */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([["antes", fotosAntes], ["depois", fotosDepois]] as const).map(([etapa, arr]) => (
              <div key={etapa}>
                <label style={LABEL}>{etapa === "antes" ? "Antes (problema)" : "Depois (solução)"}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {arr.map((f) => (
                    <div key={f.id} style={{ position: "relative" }}>
                      {f.signedUrl ? (
                        <img
                          src={f.signedUrl}
                          alt={f.legenda ?? etapa}
                          style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 10 }}
                        />
                      ) : (
                        <div style={{ width: 68, height: 68, borderRadius: 10, background: isLight ? "#e8eaee" : "#22222c" }} />
                      )}
                      {emExecucao && (
                        <button
                          onClick={() => removerFoto.mutate({ fotoId: f.id, path: f.storage_path })}
                          style={{
                            position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                            background: "#1e2229", color: "#fff", border: "none", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  {emExecucao && (
                    <label
                      style={{
                        width: 68, height: 68, borderRadius: 10, cursor: enviandoFoto ? "wait" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.04)",
                        border: isLight ? "1px dashed rgba(0,0,0,0.20)" : "1px dashed rgba(255,255,255,0.22)",
                      }}
                    >
                      <Camera size={18} color={gold} />
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: "none" }}
                        disabled={enviandoFoto}
                        onChange={(e) => { void enviarFoto(e.target.files?.[0], etapa); e.currentTarget.value = ""; }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={LABEL}>Diagnóstico</label>
            <textarea
              style={{ ...INPUT, height: 88, resize: "vertical" }}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              disabled={!emExecucao}
              placeholder="O que estava causando o problema"
            />
          </div>
          <div>
            <label style={LABEL}>Serviço executado</label>
            <textarea
              style={{ ...INPUT, height: 88, resize: "vertical" }}
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              disabled={!emExecucao}
              placeholder="O que foi feito para resolver"
            />
          </div>
          {/* Equipamento instalado / retirado — Etapa U3.
              Substitui o campo de texto: o que entra aqui vira a decisão de
              cobrança (U4) e o relatório de movimentação do QAP (U6). */}
          <div>
            <label style={LABEL}>Equipamento instalado / retirado</label>
            {pecasOs.length === 0 && (
              <span style={{ display: "block", fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 400, color: textSecondary, marginBottom: 8 }}>
                Nada registrado ainda.
              </span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: emExecucao ? 10 : 0 }}>
              {pecasOs.map((p) => {
                const dc = DIRECAO_CORES[p.direcao];
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 12px", borderRadius: 12,
                      background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                      border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span style={{
                      flexShrink: 0, padding: "3px 8px", borderRadius: 999,
                      fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: isLight ? dc.light : dc.dark, background: dc.bg, border: `1px solid ${dc.border}`,
                    }}>
                      {DIRECAO_LABEL[p.direcao]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                        {Number(p.quantidade) !== 1 ? `${p.quantidade}× ` : ""}{p.descricao}
                      </div>
                      {(p.numero_serie || p.tag_patrimonio) && (
                        <div style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                          {p.numero_serie ? `Série ${p.numero_serie}` : ""}
                          {p.tag_patrimonio ? `${p.numero_serie ? " · " : ""}TAG ${p.tag_patrimonio}` : ""}
                        </div>
                      )}
                    </div>
                    {emExecucao && (
                      <button
                        onClick={() => mexerPeca.mutate({ tipo: "del", pecaId: p.id })}
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {emExecucao && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(Object.keys(DIRECAO_LABEL) as DirecaoPeca[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNovaDirecao(d)}
                      style={{
                        padding: "7px 12px", borderRadius: 10, cursor: "pointer",
                        border: novaDirecao === d ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(252,222,72,0.16)",
                        background: novaDirecao === d
                          ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
                          : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
                        color: novaDirecao === d ? "#08090E" : textPrimary,
                        fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5,
                      }}
                    >
                      {DIRECAO_LABEL[d]}
                    </button>
                  ))}
                </div>
                <input
                  style={INPUT}
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Equipamento ou material"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 44px", gap: 8 }}>
                  <input
                    style={INPUT}
                    value={novaSerie}
                    onChange={(e) => setNovaSerie(e.target.value)}
                    placeholder="Nº de série (quando tiver)"
                  />
                  <input
                    style={INPUT}
                    value={novaQtd}
                    onChange={(e) => setNovaQtd(e.target.value)}
                    inputMode="decimal"
                    placeholder="Qtd"
                  />
                  <button
                    onClick={() => mexerPeca.mutate({ tipo: "add" })}
                    disabled={!novaDescricao.trim() || mexerPeca.isPending}
                    style={{
                      height: 46, borderRadius: 12, border: "none",
                      background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                      color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: novaDescricao.trim() ? "pointer" : "default",
                      opacity: novaDescricao.trim() ? 1 : 0.5,
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span style={{ fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 400, color: textSecondary, lineHeight: 1.5 }}>
                  O número de série é o que permite conciliar com o patrimônio no ERP — registre sempre que o equipamento tiver.
                </span>
              </div>
            )}

            {/* histórico anterior à U3, quando existir */}
            {os.pecas_texto?.trim() && (
              <div style={{
                marginTop: 10, padding: "10px 12px", borderRadius: 12,
                background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.02)",
                border: isLight ? "1px dashed rgba(0,0,0,0.10)" : "1px dashed rgba(255,255,255,0.10)",
              }}>
                <div style={{ fontFamily: "var(--fonte)", fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: textSecondary, marginBottom: 4 }}>
                  Anotação anterior
                </div>
                <div style={{ fontFamily: "var(--fonte)", fontSize: 12.5, fontWeight: 400, color: textPrimary, whiteSpace: "pre-wrap" }}>
                  {os.pecas_texto}
                </div>
              </div>
            )}
          </div>

          {/* Assinatura */}
          {os.assinatura_url ? (
            <div>
              <label style={LABEL}>Assinatura de {os.assinatura_nome ?? "quem recebeu"}</label>
              {assinaturaUrl ? (
                <img
                  src={assinaturaUrl}
                  alt="Assinatura"
                  style={{ width: "100%", maxWidth: 320, borderRadius: 10, background: "#fff" }}
                />
              ) : (
                <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                  carregando assinatura…
                </span>
              )}
            </div>
          ) : emExecucao ? (
            <div>
              <label style={LABEL}>Assinatura de quem acompanhou</label>
              <input
                style={{ ...INPUT, height: 46, marginBottom: 8 }}
                value={assinanteNome}
                onChange={(e) => setAssinanteNome(e.target.value)}
                placeholder="Nome de quem assina"
              />
              <AssinaturaCanvas onChange={setAssinaturaData} />
            </div>
          ) : null}

          {emExecucao && (
            <ConfirmacaoDasVisitas estado={conf} isLight={isLight} erro={erroDaVisita} />
          )}

          {emExecucao && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={{ ...btnSec, flex: 1 }} onClick={() => salvarRascunho.mutate()} disabled={salvarRascunho.isPending}>
                {salvarRascunho.isPending ? "Salvando…" : "Salvar anotações"}
              </button>
              <button style={{ ...CTA, flex: 2, width: "auto" }} onClick={() => concluir.mutate()} disabled={concluir.isPending || afirmar.isPending}>
                <CheckCircle2 size={18} />
                {concluir.isPending ? "Concluindo…" : conf.rotulo("Concluir atendimento")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Relatório de atendimento (PDF) — a partir da execução */}
      {os.status === "concluido" && (
        <button
          style={{ ...btnSec, height: 50, borderRadius: 25 }}
          onClick={() => baixarRelatorio.mutate()}
          disabled={baixarRelatorio.isPending}
        >
          <FileDown size={16} color={gold} />
          {baixarRelatorio.isPending ? "Gerando relatório…" : "Baixar relatório de atendimento (PDF)"}
        </button>
      )}

      {/* Cobrança — Etapa U4. Só quem responde pelo financeiro enxerga; o
          técnico registra a peça e não participa da decisão de cobrar, e o
          SAC (gestor sem valores, R13) também não vê este card. */}
      {veFinanceiro && os.status === "concluido" && pecasOs.length > 0 && (
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Receipt size={15} color={gold} />
            <span style={SEC}>Cobrança</span>
            <span style={{
              marginLeft: "auto", padding: "3px 8px", borderRadius: 999,
              fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: textSecondary,
              background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.05)",
              border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
            }}>
              {FATURAMENTO_LABEL[(os as any).faturamento_status as FaturamentoStatus] ?? "—"}
            </span>
          </div>

          {!os.contrato_id && (
            <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: gold, lineHeight: 1.5 }}>
              Cliente sem contrato vigente na abertura: tudo neste atendimento é faturável.
            </span>
          )}

          {analise.length === 0 ? (
            <span style={{ fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 400, color: textSecondary, lineHeight: 1.5 }}>
              Ainda não analisado. A análise confere item a item contra o contrato — nada é cobrado sem a sua
              aprovação depois.
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pecasOs.map((p) => {
                const a = analise.find((x) => x.peca_id === p.id);
                if (!a) return null;
                const rc = RESULTADO_CORES[a.resultado];
                const editando = itemEditando === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "10px 12px", borderRadius: 12,
                      background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${a.resultado === "revisar" || a.resultado === "nao_identificado"
                        ? rc.border
                        : isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}`,
                      display: "flex", flexDirection: "column", gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                          {Number(p.quantidade) !== 1 ? `${p.quantidade}× ` : ""}{p.descricao}
                        </div>
                        <div style={{ fontFamily: "var(--fonte)", fontSize: 11, fontWeight: 400, color: textSecondary, marginTop: 2, lineHeight: 1.45 }}>
                          {a.justificativa}
                          {a.ajustado_manualmente && " · ajustado manualmente"}
                          {!a.ajustado_manualmente && a.confianca != null && ` · ${Math.round(a.confianca * 100)}% de confiança`}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 999,
                          fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                          color: isLight ? rc.light : rc.dark, background: rc.bg, border: `1px solid ${rc.border}`,
                        }}>
                          {RESULTADO_LABEL[a.resultado]}
                        </span>
                        {a.valor_calculado != null && (
                          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600 }}>
                            {moeda(Number(a.valor_calculado) * Number(p.quantidade))}
                          </span>
                        )}
                      </div>
                    </div>

                    {os.faturamento_status === "a_analisar" && (
                      editando ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {(Object.keys(RESULTADO_LABEL) as ResultadoItem[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => setNovoResultado(r)}
                              style={{
                                padding: "5px 9px", borderRadius: 8, cursor: "pointer",
                                fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10.5,
                                border: novoResultado === r ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
                                background: novoResultado === r ? "linear-gradient(135deg,#FCDE48,#F8C811)" : "transparent",
                                color: novoResultado === r ? "#08090E" : textPrimary,
                              }}
                            >
                              {RESULTADO_LABEL[r]}
                            </button>
                          ))}
                          {novoResultado === "faturavel" && (
                            <input
                              value={novoValor}
                              onChange={(e) => setNovoValor(e.target.value)}
                              inputMode="decimal"
                              placeholder="valor unit."
                              style={{ ...INPUT, width: 110, padding: "6px 10px", fontSize: 12 }}
                            />
                          )}
                          <button
                            onClick={() => ajustar.mutate({ pecaId: p.id })}
                            style={{
                              padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                              background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                              color: "#08090E", fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 10.5,
                            }}
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setItemEditando(null)}
                            style={{
                              padding: "5px 10px", borderRadius: 8, cursor: "pointer",
                              background: "none", border: "none",
                              color: textSecondary, fontFamily: "var(--fonte)", fontSize: 10.5,
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setItemEditando(p.id);
                            setNovoResultado(a.resultado);
                            setNovoValor(a.valor_calculado != null ? String(a.valor_calculado) : "");
                          }}
                          style={{
                            alignSelf: "flex-start", padding: "4px 9px", borderRadius: 8, cursor: "pointer",
                            background: "none",
                            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                            color: textSecondary, fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 10.5,
                          }}
                        >
                          Ajustar
                        </button>
                      )
                    )}
                  </div>
                );
              })}

              {(() => {
                const emRevisao = analise.filter(
                  (a) => a.resultado === "revisar" || a.resultado === "nao_identificado",
                ).length;
                const total = totalFaturavel(
                  analise,
                  Object.fromEntries(pecasOs.map((p) => [p.id, Number(p.quantidade) || 1])),
                );
                return (
                  <>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "baseline",
                      paddingTop: 8,
                      borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                        Total faturável
                      </span>
                      <span style={{ fontFamily: "var(--fonte)", fontSize: 16, fontWeight: 700, color: gold }}>
                        {moeda(total)}
                      </span>
                    </div>
                    {emRevisao > 0 && (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <AlertTriangle size={15} color={gold} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
                          {emRevisao} item(ns) esperando decisão. A aprovação fica bloqueada até resolver — cobrança
                          indevida custa mais caro que uma conferência.
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* AS COBRANÇAS VIVAS — e "vivas" é o recorte de `temLancamento`
              (chamados/cobranca.ts), o mesmo do fechamento (u5:139) e o mesmo
              dos dois índices únicos da U80. Antes esta linha somava a
              CANCELADA junto: um chamado com uma cobrança de R$ 400 cancelada
              e nada mais anunciava "1 cobrança(s) geradas · R$ 400,00", que é
              dinheiro que não existe. A cancelada não some da tela — ela passa
              a ser dita à parte, que é o que ela é. */}
          {cobrancasVivas.length > 0 && (
            <div style={{
              padding: "10px 12px", borderRadius: 12,
              background: isLight ? "rgba(45,210,165,0.08)" : "rgba(45,210,165,0.08)",
              border: "1px solid rgba(45,210,165,0.28)",
            }}>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textPrimary }}>
                {cobrancasVivas.length} cobrança(s) geradas ·{" "}
                <strong>{moeda(cobrancasVivas.reduce((s, c) => s + Number(c.valor), 0))}</strong> na competência{" "}
                {cobrancasVivas[0]?.competencia}
                {canceladasOs > 0 && ` · ${canceladasOs} cancelada(s), fora da soma`}
              </span>
            </div>
          )}

          {/* O FURO, FECHADO ONDE ELE NASCE.
              `useCobrancasDoChamado` faz SELECT direto, e `cobrancas_select` é
              `pode_ver_financeiro(auth.uid())` (u4:293). Uma policy de SELECT
              FILTRA LINHAS e NÃO levanta erro: a resposta é HTTP 200 com `[]`,
              e `[]` quer dizer DUAS coisas indistinguíveis — "não há cobrança"
              e "a RLS apagou tudo". O `if (error) return []` do hook nem chega
              a ser exercido, porque não há erro nenhum.
              A RPC da U80 é a única que sabe separar as duas, e quando ela
              discorda da lista quem manda é ela: dizer "há lançamento e esta
              tela não consegue listá-lo" é honesto; desenhar a ausência não é.
              Hoje isto é inalcançável dentro deste card (ele é `veFinanceiro`,
              e quem vê financeiro lê as linhas), e é de propósito: o defeito
              deixa de depender de o gate acima continuar existindo. */}
          {temLancamentoRpc === true && cobrancasVivas.length === 0 && (
            <div style={{
              padding: "10px 12px", borderRadius: 12,
              background: isLight ? "rgba(250,132,45,0.07)" : "rgba(250,132,45,0.08)",
              border: "1px solid rgba(250,132,45,0.28)",
            }}>
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textPrimary }}>
                Existe lançamento vinculado a este atendimento, e esta tela não consegue listá-lo.
                Quem responde pelo financeiro vê o valor no fechamento.
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ ...btnSec, flex: 1 }}
              onClick={() => analisar.mutate()}
              disabled={analisar.isPending}
            >
              <Sparkles size={15} color={gold} />
              {analisar.isPending ? "Analisando…" : analise.length === 0 ? "Analisar cobrança" : "Reanalisar"}
            </button>
            {analise.length > 0 && os.faturamento_status === "a_analisar" && (
              <button
                style={{ ...btnSec, flex: 1, borderColor: gold, color: gold }}
                onClick={() => aprovar.mutate()}
                disabled={aprovar.isPending}
              >
                {aprovar.isPending ? "Aprovando…" : "Aprovar cobrança"}
              </button>
            )}
            {/* BOTÃO MORTO DESDE QUE NASCEU, CONSERTADO (U80).
                A condição era `c.status === "aberto" || c.status === "concluido"`
                — dois literais que NÃO EXISTEM no domínio de `cobrancas.status`,
                que é `('aberta','fechada','faturada','cancelada')` (CHECK em
                u4:54-55, e o tipo `Cobranca` diz o mesmo). Gênero masculino em
                cima de valores femininos, e o `as any` da consulta impediu o
                `tsc` de ver: o botão NUNCA renderizou para ninguém, e
                `marcar_chamado_faturado` está instalada, com REVOKE e GRANT
                corretos, sem um chamador vivo desde a U7.
                A condição certa é "há cobrança que ainda não virou nota":
                `aberta` ou `fechada`. `faturada` já saiu, `cancelada` não
                conta. */}
            {cobrancasOs.some((c) => c.status === "aberta" || c.status === "fechada") && (
              <button
                style={{ ...btnSec, flex: 1 }}
                onClick={() => faturar.mutate()}
                disabled={faturar.isPending}
              >
                Marcar faturada
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conferência do gestor. Depois da U13 ela não é mais um ESTADO do
          chamado — é a fila do faturamento, que é onde ela sempre morou de
          verdade. Um chamado sem nada a cobrar sai dela sozinho. */}
      {isGerente && os.status === "concluido" && os.faturamento_status === "a_analisar" && (
        <div style={{ ...CARD, border: `1px solid ${isLight ? "rgba(4,120,87,0.35)" : "rgba(45,210,165,0.30)"}` }}>
          <span style={SEC}>Conferência</span>
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            Revise o diagnóstico, as fotos e a assinatura antes de liberar a cobrança.
          </span>
          {/* O chamado já está `concluido` aqui: quem chegou a esta caixa vê a
              pergunta no MODO ATRASADO — foi encerrado por um caminho que não
              perguntou (o arrasto do quadro, o seletor de status, os chips do
              interno, `decidir_pedido_compra`, o gatilho da visita — P34). */}
          <ConfirmacaoDasVisitas estado={conf} isLight={isLight} erro={erroDaVisita} modo="atrasado" />

          {/* A DECISÃO DE COBRANÇA — só para quem responde pelo financeiro.
              O SAC é gestor e NÃO vê valores (R13): para ele esta seção não
              existe, e o botão de fechar dispara `conferir_depois`, que é
              exatamente a escrita que este botão já fazia antes da U90.
              Nada de campo de valor desabilitado: um campo cinza ensina que
              existe um número ali que ele não pode ver. */}
          {veFinanceiro && os.natureza === "campo" && (
            analise.length > 0 ? (
              /* OS DOIS CAMINHOS SÃO DISJUNTOS (u80:406-410): onde houve
                 análise item a item, a cobrança sai da APROVAÇÃO, com o
                 bloqueio de `revisar`. A porta RECUSA `lancar` aqui — então a
                 tela não oferece, em vez de oferecer e colher um 55000. */
              <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary }}>
                Este atendimento foi analisado item a item — a cobrança sai da
                conferência do cartão de peças, e não de um valor digitado aqui.
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={LABEL}>Lançar cobrança ao fechar (opcional)</label>
                <input
                  style={INPUT} placeholder="O que está sendo cobrado"
                  value={lancDescricao} onChange={(e) => setLancDescricao(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...INPUT, flex: 2 }} inputMode="decimal" placeholder="Valor total"
                    value={lancValor} onChange={(e) => setLancValor(e.target.value)}
                  />
                  <input
                    style={{ ...INPUT, flex: 1 }} inputMode="numeric" placeholder="parcelas"
                    aria-label="Número de parcelas"
                    value={lancParcelas} onChange={(e) => setLancParcelas(e.target.value)}
                  />
                </div>
                {/* A PRÉVIA É O QUE IMPEDE A SURPRESA. `parcelar` põe o resto na
                    PRIMEIRA parcela, então 100 em 3 é 33,34 + 33,33 + 33,33 —
                    e quem lança precisa ver isso ANTES, não descobrir no boleto. */}
                {previaDasParcelas.length > 0 && (
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, fontVariantNumeric: "tabular-nums" }}>
                    {previaDasParcelas.length}× — primeira de{" "}
                    {previaDasParcelas[0].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    {previaDasParcelas.length > 1 && previaDasParcelas[1] !== previaDasParcelas[0]
                      ? `, demais de ${previaDasParcelas[1].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : ""}
                    {candidatoDoLancamento.tipoServico === "instalacao" ? " · instalação, até 60×" : " · manutenção, até 12×"}
                  </span>
                )}
                {lancDescricao.trim() !== "" && erroDoLanc && (
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: isLight ? "#8A5A00" : "#F0B429" }}>
                    {erroDoLanc}
                  </span>
                )}
              </div>
            )
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{ ...btnSec, flex: 1 }} onClick={() => reabrir.mutate()} disabled={reabrir.isPending}>
              Reabrir
            </button>
            {podeDecidirValor && (
              <button
                style={{ ...btnSec, flex: 1 }}
                onClick={() => fechar.mutate("nada_a_cobrar")}
                disabled={fechar.isPending || afirmar.isPending}
              >
                Nada a cobrar
              </button>
            )}
            <button
              style={{
                ...CTA, flex: 2, width: "auto",
                background: "linear-gradient(135deg,#2DD2A5 0%,#059676 40%,#047862 100%)",
                color: "#FFFFFF",
                boxShadow: "0 4px 20px rgba(5,150,118,0.45)",
              }}
              /* O BOTÃO GRANDE MUDA DE DECISÃO, NÃO DE LUGAR. Com o formulário
                 preenchido e válido ele LANÇA; vazio, ele faz o que sempre fez.
                 Dois botões grandes concorrentes fariam a pessoa escolher entre
                 dois verbos parecidos com o dedo em cima do mais próximo. */
              onClick={() => fechar.mutate(vaiLancar ? "lancar" : "conferir_depois")}
              disabled={fechar.isPending || afirmar.isPending}
            >
              <CheckCircle2 size={18} />
              {fechar.isPending
                ? "Fechando…"
                : conf.rotulo(vaiLancar ? `Fechar e lançar ${previaDasParcelas.length}×` : "Conferir e fechar")}
            </button>
          </div>
        </div>
      )}

      {/* Reabrir quando já fechada */}
      {isGerente && os.status === "concluido" && (
        <button style={btnSec} onClick={() => reabrir.mutate()} disabled={reabrir.isPending}>
          Reabrir chamado
        </button>
      )}

      {/* Cancelar */}
      {isGerente && ["aberto", "agendado", "em_andamento"].includes(os.status) && (
        <div style={CARD}>
          {cancelando ? (
            <>
              <span style={SEC}>Cancelar chamado</span>
              <textarea
                style={{ ...INPUT, height: 70, resize: "vertical" }}
                value={motivoCancel}
                onChange={(e) => setMotivoCancel(e.target.value)}
                placeholder="Motivo do cancelamento"
              />
              {/* Cancelar não afirma nada sozinho: o gatilho desmarca TODO
                  pendente, de qualquer dia. Quem foi ao prédio e só depois viu
                  o chamado cair diz isso AQUI, antes do status. */}
              <ConfirmacaoDasVisitas estado={conf} isLight={isLight} erro={erroDaVisita} />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...btnSec, flex: 1 }} onClick={() => setCancelando(false)}>Voltar</button>
                <button
                  style={{
                    ...btnSec, flex: 1,
                    color: isLight ? "#B1242E" : "#F17881",
                    border: `1px solid ${isLight ? "rgba(177,36,46,0.35)" : "rgba(241,120,129,0.32)"}`,
                  }}
                  onClick={() => cancelar.mutate()}
                  disabled={cancelar.isPending}
                >
                  {cancelar.isPending ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
              </div>
            </>
          ) : (
            <button
              style={{ ...btnSec, color: isLight ? "#B1242E" : "#F17881" }}
              onClick={() => setCancelando(true)}
            >
              <Trash2 size={14} />
              Cancelar chamado
            </button>
          )}
        </div>
      )}

      {/* Linha do tempo */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <History size={15} color={gold} />
          <span style={SEC}>Linha do tempo</span>
        </div>
        {eventos.length === 0 ? (
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            Sem movimentações registradas.
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eventos.map((ev, i) => (
              <div key={ev.id} style={i === 0 ? { ...linha, borderTop: "none" } : linha}>
                <span style={{ fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600 }}>
                  {ev.descricao ?? ev.tipo}
                </span>
                <span style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary, flexShrink: 0 }}>
                  {new Date(ev.created_at).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!podeExecutar && (
        <div style={{ ...CARD, alignItems: "center" }}>
          <ClipboardList size={20} color={textSecondary} />
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, textAlign: "center" }}>
            Este chamado está atribuído a outro técnico — você está apenas visualizando.
          </span>
        </div>
      )}
    </div>
  );
}
