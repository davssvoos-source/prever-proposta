// Chamado INTERNO — o corpo da tela quando natureza = 'interno'.
// Edição, feed de comentários, apoio e equipamentos envolvidos: é o que era o
// quadro do Notion. Extraído de /demandas/$id na Etapa U7 — quem monta a
// página é /chamados/$id. Ver docs/PLANO_UNIFICACAO.md §5.1.
//
// ── R135 (U95): A TELA DO COMPUTADOR, EM DUAS COLUNAS ──────────────────────
// Davi, 03/09/2026, sobre esta tela ("Croqui demonstrativo para projeto de
// Portaria Remota"): "agrupe as opções de cada item — STATUS deve ser uma
// opção que ao clicar abre a lista de seleção. Faça isso com todas as opções.
// Vamos aproveitar que a tela do desktop é grande, organize os itens e a maior
// caixa deverá ser um espaço grande para texto."
//
// Então: a coluna LARGA é o texto — a descrição num editor de blocos (caixa de
// marcar de verdade, menção com "@") e a conversa embaixo; a coluna ESTREITA
// são as propriedades, cada uma num SELETOR que abre a lista, pintado pela cor
// da coisa escolhida (R87 no botão único). Responsável e apoio mostram o
// rosto. Quem escreveu um comentário pode apagá-lo. No celular as duas colunas
// empilham (classe .detalhe-grid) — mas o técnico de campo não vive nesta
// tela: o fluxo dele é o do chamado de campo (DetalheCampo).
//
// ── U96 (R137–R150): A ESTRUTURA DAS ATIVIDADES ─────────────────────────────
// O documento do Davi (docs/CONTEXTO_ESTRUTURA_ATIVIDADES.md) ditou o que uma
// atividade FORA da área técnica tem — e o que não tem mais:
//   · SAÍRAM: Prioridade (virou impacto, R142), Equipe (é a das pessoas, R139),
//     Sprint (é cálculo sobre o prazo, R141) e o pedido de compra (R140).
//   · ENTRARAM: Impacto operacional (só corretiva e operacional); as etiquetas
//     das equipes ENVOLVIDAS, derivadas de responsável + apoios; o Recebimento
//     (quem criou, quando — R144), início e conclusão; a "Solução aplicada" da
//     corretiva (R149, em `servico_executado`); a proposta comercial de origem
//     na implantação (R148); fotos e arquivos (R150); e o Cliente como cliente,
//     GRUPO de clientes ou "interno — Prever" (R143).

import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CalendarClock, FileText, Layers, Paperclip, Plus, Send, Trash2, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { card, etiqueta } from "@/lib/ui";
import { TextoComChecklist } from "@/components/TextoComChecklist";
import { SeletorDeOpcao, type OpcaoDoSeletor } from "@/components/SeletorDeOpcao";
import { EditorDeDescricao, TextareaComMencoes, type PessoaParaMencao } from "@/components/EditorDeDescricao";
import { EquipamentosDaAtividade } from "@/features/chamados/EquipamentosDaAtividade";
import { RoscaDeProgresso } from "@/components/RoscaDeProgresso";
import { CampoQuando } from "@/components/CampoQuando";
import { progressoDaAtividade } from "@/features/chamados/progresso";
import { temDiagnostico } from "@/features/chamados/registro";
import { rotuloReagendado } from "@/features/atividades/modelo";
import { CampoComBusca, type OpcaoBusca } from "@/components/CampoComBusca";
import { AvatarCirculo } from "@/components/PessoaComFoto";
import { useIsGerente } from "@/features/gerencial/data";
import {
  useChamado, useChamadoEventos, useChamadoApoios, useChamadoEquipamentos, useChamadoLocais,
  useChamadoFotos, usePropostasEnviadas,
  usePessoas, mapaDePessoas, equipeDaPessoa, atualizarChamado, comentarChamado, excluirComentario, excluirChamado,
  adicionarApoio, removerApoio, adicionarEquipamentoChamado, removerEquipamentoChamado,
  anexarFoto, excluirFoto,
  adicionarClienteChamado, removerClienteChamado, adicionarSetorChamado, removerLocalChamado,
  type ChamadoPatch,
} from "@/features/chamados/data";
import { useReacoesDoChamado, SEM_REACOES } from "./reacoes";
import { FileiraDeReacoes } from "./FileiraDeReacoes";
import { useClientes, SERVICO_LABEL, SERVICO_CORES, SERVICOS_OFERECIDOS, type ServicoCliente } from "@/features/clientes/data";
import { checklistDoGrupo, acrescentarChecklist, rotuloDoGrupo, valorDoGrupo, setorDoValor } from "@/features/chamados/grupos";
import {
  chamadoStatusInfo, chamadoEmAberto, situacaoPrazo, textoPrazo,
  prazoParaData, dataParaPrazo,
  statusDaNatureza, tiposDaNatureza, TIPO_LABEL, TIPO_CORES,
  IMPACTO_ORDEM, IMPACTO_LABEL, IMPACTO_CORES, temImpacto,
  type ChamadoStatus, type ImpactoOperacional,
} from "@/lib/chamado-status";
import { especieDoApoio } from "@/features/programacao/modelo";
import { EQUIPE_LABEL, equipeCores, equipesDePessoas, type Equipe } from "@/lib/equipes";
import { tempoRelativo } from "@/hooks/useNotificacoes";

const EXT_IMAGEM = /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function DetalheInterno({ id, embutido = false }: {
  id: string;
  /** R238: dentro do diálogo da Início — sem a casca da página. A chapelaria
   *  (fechar, "página inteira") é do diálogo, não desta tela (R239). */
  embutido?: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: chamado, isLoading } = useChamado(id);
  const { data: eventos = [] } = useChamadoEventos(id, "asc");
  // R217: as reações dos comentários desta atividade
  const { data: reacoes = SEM_REACOES } = useReacoesDoChamado(id);
  const { data: apoios = [] } = useChamadoApoios(id);
  const { data: equipamentos = [] } = useChamadoEquipamentos(id);
  const { data: locais = [] } = useChamadoLocais(id);
  // R226 (U119): os equipamentos removidos/instalados só valem para CLIENTE
  // ÚNICO — nem interna (sem cliente), nem grupo (mais de um local com cliente)
  const clienteUnico = !!chamado?.cliente_id
    && !locais.some((l) => !!l.cliente_id && l.cliente_id !== chamado?.cliente_id);
  const { data: fotos = [] } = useChamadoFotos(id);
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();
  const { data: propostas = [] } = usePropostasEnviadas();

  const [comentario, setComentario] = useState("");
  const [novoEquip, setNovoEquip] = useState("");
  const [novaSerie, setNovaSerie] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);
  const pessoasOrdenadas = useMemo(
    () => [...(pessoas as any[])].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [pessoas],
  );
  const opcoesPessoas: OpcaoBusca[] = useMemo(
    () => pessoasOrdenadas.map((p) => ({
      valor: p.id, rotulo: p.nome, secundario: p.equipe ? EQUIPE_LABEL[p.equipe as Equipe] : undefined,
    })),
    [pessoasOrdenadas],
  );
  const pessoasMencao: PessoaParaMencao[] = useMemo(
    () => pessoasOrdenadas.map((p) => ({ id: p.id, nome: p.nome, avatar_url: p.avatar_url ?? null })),
    [pessoasOrdenadas],
  );
  const opcoesPropostas: OpcaoBusca[] = useMemo(
    () => propostas.map((p) => ({
      valor: p.id,
      rotulo: p.cliente_nome ?? p.nome_predio ?? p.titulo ?? "Proposta",
      secundario: `enviada em ${new Date(p.proposta_enviada_em).toLocaleDateString("pt-BR")}`,
    })),
    [propostas],
  );
  const clientesPorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  // R151: o que ainda pode entrar como local — grupos no topo, depois os
  // clientes, menos quem já está (principal, extras, etiquetas)
  const opcoesLocais: OpcaoBusca[] = useMemo(() => {
    const usados = new Set<string>([
      ...(chamado?.cliente_id ? [chamado.cliente_id] : []),
      ...locais.map((l) => l.cliente_id ?? (l.setor ? valorDoGrupo(l.setor as ServicoCliente) : "")).filter(Boolean),
    ]);
    return [
      ...SERVICOS_OFERECIDOS.map((g) => ({ valor: valorDoGrupo(g), rotulo: rotuloDoGrupo(g), secundario: "grupo de clientes" })),
      ...[...clientes]
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
        .map((c) => ({ valor: c.id, rotulo: c.nome, secundario: (c as any).posto_servico ?? undefined })),
    ].filter((o) => !usados.has(o.valor));
  }, [clientes, locais, chamado?.cliente_id]);
  const nomeDe = (pid: string) => pessoasPorId[pid]?.nome ?? "Alguém";

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  // card() de lib/ui: a superfície da casa nos dois temas — aqui havia uma
  // cópia v3 que já divergia do resto das telas do grupo.
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
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 12px",
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #161616 0%, #101010 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const LINHA_INFO: CSSProperties = {
    fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, lineHeight: 1.5,
  };

  const salvar = useMutation({
    mutationFn: async (patch: ChamadoPatch) => atualizarChamado(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamado", id] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["chamado-eventos", id] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Não foi possível salvar. Confira se você é responsável ou gestor."),
  });

  const enviarComentario = useMutation({
    mutationFn: async () => {
      const t = comentario.trim();
      if (!t) throw new Error("Escreva alguma coisa antes de enviar.");
      await comentarChamado(id, t);
    },
    onSuccess: () => {
      setComentario("");
      qc.invalidateQueries({ queryKey: ["chamado-eventos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // R135: quem escreveu apaga. A policy decide no banco; aqui só se pede.
  const apagarComentario = useMutation({
    mutationFn: async (eventoId: string) => excluirComentario(eventoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chamado-eventos", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarApoio = useMutation({
    mutationFn: async ({ profileId, entrar }: { profileId: string; entrar: boolean }) =>
      entrar ? adicionarApoio(id, profileId) : removerApoio(id, profileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamado-apoios", id] });
      qc.invalidateQueries({ queryKey: ["home-apoios-todos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar o apoio."),
  });

  // R151 (e R143): mais de um cliente na mesma atividade — a MESMA porta do
  // painel lateral: adicionarClienteChamado/removerClienteChamado (o primeiro
  // cliente é o principal, os demais vão para chamado_locais) e a etiqueta do
  // grupo. Escolher um grupo põe o checklist dos clientes dele na descrição.
  const mexerLocal = useMutation({
    mutationFn: async (acao: { valor: string; remover: boolean }) => {
      const setor = setorDoValor(acao.valor);
      if (setor) {
        if (acao.remover) {
          const linha = locais.find((l) => l.setor === setor);
          if (linha) await removerLocalChamado(linha.id);
        } else {
          await adicionarSetorChamado(id, setor);
          const lista = checklistDoGrupo(clientes, setor);
          if (lista) {
            await atualizarChamado(id, {
              descricao_problema: acrescentarChecklist(
                chamado?.descricao_problema ?? "", lista, `Clientes de ${SERVICO_LABEL[setor]}:`,
              ),
            });
          }
        }
      } else if (acao.remover) {
        await removerClienteChamado(id, chamado?.cliente_id ?? null, acao.valor);
      } else {
        await adicionarClienteChamado(id, chamado?.cliente_id ?? null, acao.valor);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamado", id] });
      qc.invalidateQueries({ queryKey: ["chamado-locais", id] });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["home-locais-todos"] });
      qc.invalidateQueries({ queryKey: ["calendario"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar o cliente."),
  });

  const mexerEquip = useMutation({
    mutationFn: async (acao: { tipo: "add" } | { tipo: "del"; equipId: string }) => {
      if (acao.tipo === "del") return removerEquipamentoChamado(acao.equipId);
      if (!novoEquip.trim()) throw new Error("Descreva o equipamento.");
      await adicionarEquipamentoChamado(id, {
        descricao: novoEquip.trim(),
        numero_serie: novaSerie.trim() || null,
      });
    },
    onSuccess: () => {
      setNovoEquip("");
      setNovaSerie("");
      qc.invalidateQueries({ queryKey: ["chamado-equipamentos", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // R150: fotos e arquivos — a MESMA tabela e o MESMO bucket do chamado de
  // campo (`chamado_fotos`, `fotos-os`), com etapa "outra". Nada novo no banco.
  const removerArquivo = useMutation({
    mutationFn: async ({ fotoId, path }: { fotoId: string; path: string | null }) => excluirFoto(fotoId, path),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chamado-fotos", id] }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover o arquivo."),
  });
  async function anexarArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setEnviandoArquivo(true);
    try {
      for (const f of arquivos) await anexarFoto(id, f, "outra");
      qc.invalidateQueries({ queryKey: ["chamado-fotos", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui anexar o arquivo.");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  const excluir = useMutation({
    mutationFn: async () => excluirChamado(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      toast.success("Chamado excluído.");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir."),
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "var(--fonte)" }}>
        Carregando…
      </div>
    );
  }
  if (!chamado) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: "var(--fonte)" }}>
        Chamado não encontrado.
      </div>
    );
  }

  const sp = situacaoPrazo(chamado.prazo_limite, chamado.status);
  const comentarios = eventos.filter((e) => e.tipo === "comentario");
  const timeline = eventos.filter((e) => e.tipo !== "comentario");
  const podeEditar =
    isGerente ||
    chamado.responsavel_id === userId ||
    chamado.aberto_por === userId ||
    !chamado.responsavel_id ||
    // U81: `apoios` virou lista de LINHAS (profile_id, origem, congelado_em) —
    // antes era um array de ids. Este predicado continua sendo o gêmeo
    // DESATUALIZADO de `pode_editar_chamado`: ele não aplica
    // `apoioValeComoVinculo`, ao contrário da grade (programacao/modelo.ts:724).
    // Está em docs/PENDENCIAS_TECNICAS.md; alargar aqui seria mudar autorização
    // de carona numa entrega que prometeu não tocar em nenhuma.
    apoios.some((a) => a.profile_id === (userId ?? ""));

  // R139: as equipes ENVOLVIDAS — a do responsável e a de cada apoio, pelo
  // cadastro. Não há campo para escolher; troca a pessoa, troca a etiqueta.
  const equipesEnvolvidas = equipesDePessoas(
    [chamado.responsavel_id, ...apoios.map((a) => a.profile_id)],
    (pid) => pessoasPorId[pid]?.equipe,
  );
  // R143: o cliente da atividade — um cliente, os grupos (setores) ou interno
  const setoresDoChamado = locais.map((l) => l.setor).filter((s): s is string => !!s);
  const clientesExtras = locais
    .map((l) => l.cliente_id)
    .filter((cid): cid is string => !!cid && cid !== chamado.cliente_id);
  const ehInterno = !chamado.cliente && setoresDoChamado.length === 0 && clientesExtras.length === 0;

  // ── as opções de cada seletor, com a cor da coisa (R87 no botão único) ───
  const opcoesStatus: OpcaoDoSeletor[] = statusDaNatureza("interno").map((s) => {
    const i = chamadoStatusInfo(s);
    return { valor: s, rotulo: i.label, cor: { dark: i.color, light: i.colorLight, bg: i.bg, border: i.border } };
  });
  const opcoesTipo: OpcaoDoSeletor[] = tiposDaNatureza("interno").map((t) => ({
    valor: t, rotulo: TIPO_LABEL[t], cor: TIPO_CORES[t] ?? null,
  }));
  const opcoesImpacto: OpcaoDoSeletor[] = IMPACTO_ORDEM.map((i) => ({
    valor: i, rotulo: IMPACTO_LABEL[i], cor: IMPACTO_CORES[i],
  }));

  const chipPessoa: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 8px 4px 5px", borderRadius: 999,
    background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)",
    fontFamily: "var(--fonte)", fontSize: 12.5, fontWeight: 600, color: textPrimary,
  };
  const chipEquipe = (e: string): CSSProperties => {
    const c = equipeCores(e);
    return {
      padding: "3px 8px", borderRadius: 999,
      fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9.5,
      letterSpacing: "0.06em", textTransform: "uppercase",
      // R177: sólida, sem borda — o preenchimento já separa do card
      ...etiqueta(c),
    };
  };

  // ── R234/R238 (U121): DOCUMENTO À ESQUERDA, FICHA À DIREITA ───────────────
  // A estrutura que o Davi aprovou em 08/09/2026 sobre o mockup "Layout da
  // Atividade" (artifact), depois de duas rodadas que não bateram: a atividade é
  // um DOCUMENTO com uma FICHA.
  //
  //   · DOCUMENTO (1fr): cabeçalho (título, número, há quanto tempo, por quem,
  //     tipo), os TEXTOS ocupando a faixa inteira (Descrição; na corretiva,
  //     Problema e Solução lado a lado a partir de 1700px), os equipamentos por
  //     arrasto (R236/R237) e a conversa. O texto é onde a pessoa trabalha, e é
  //     ele que fica com a largura — ~1180px em 1920.
  //   · FICHA (340px, sticky): abre com o PROGRESSO (R235, "canto superior
  //     direito") e lista as propriedades em LINHAS rótulo | valor — 96px de
  //     rótulo, 40px de altura, uma borda entre elas —, o formato de ficha que
  //     Linear, Jira e Notion usam. Depois, arquivos e a linha do tempo. Ela
  //     acompanha a rolagem: status, prazo e responsável ficam à vista enquanto
  //     se lê um texto longo.
  //
  // O que saiu, e por quê: a coluna de 2fr com um seletor esticado por caixa
  // (na tela dele, 660px de largura — "botões esticados para adaptar para PC");
  // a faixa horizontal de propriedades da U120 (sete controles de larguras
  // diferentes quebrando em duas linhas — "o layout dos campos ainda não está de
  // acordo"); e a etiqueta de status duplicada no título (o status é a primeira
  // linha da ficha, pintado).
  //
  // EMBUTIDO (R238): a mesma tela dentro do diálogo da Início
  // (DialogDaAtividade) — sem a casca da página e com "abrir em página inteira"
  // no lugar do "voltar". Um layout, dois lugares.
  const prog = progressoDaAtividade({
    tipo: chamado.tipo, status: chamado.status,
    descricao: chamado.descricao_problema, solucao: chamado.servico_executado,
  });
  // R213: o MESMO predicado do Configurador rápido — "é corretiva?" se pergunta
  // em um lugar só (registro.ts), e a página e o painel o chamam igual.
  const ehCorretiva = temDiagnostico(chamado.tipo);
  const reagendado = rotuloReagendado(chamado.reagendamentos);
  const tipoRotulo = chamado.tipo ? TIPO_LABEL[chamado.tipo] ?? null : null;

  const ROTULO_LINHA: CSSProperties = { ...LABEL, marginBottom: 0 };
  const DICA: CSSProperties = {
    fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11, color: textSecondary,
    lineHeight: 1.4,
  };
  /**
   * O CABEÇALHO DE UM BLOCO (R239): o rótulo e, na MESMA linha, a dica. Todo
   * card da tela abre igual — era isto que fazia os "tópicos" terem espaços
   * diferentes entre si (a dica antes subia com um marginTop negativo).
   */
  const cabecalho = (titulo: string, dica?: string | null) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
      <span style={SEC}>{titulo}</span>
      {dica && <span style={DICA}>{dica}</span>}
    </div>
  );
  const BOTAO_QUADRADO: CSSProperties = {
    width: 40, height: 40, borderRadius: 12,
    background: isLight ? "#ffffff" : "#1b1b1b",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  };
  /**
   * Uma LINHA da ficha: rótulo à esquerda, valor à direita. É FUNÇÃO, não
   * componente: um componente declarado aqui dentro nasceria com identidade nova
   * a cada render e o React remontaria o campo — tirando o foco de quem digita.
   */
  const linha = (rotulo: string, filho: ReactNode) => (
    <div className="ficha-linha">
      <span style={ROTULO_LINHA}>{rotulo}</span>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>{filho}</div>
    </div>
  );

  const conteudo = (
    <div className="atividade-grade">

      {/* ══ DOCUMENTO ═══════════════════════════════════════════════════════ */}
      <section className="atividade-documento" aria-label="Documento da atividade">
        <header style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* R239: no diálogo o "voltar" não existe — a chapelaria (fechar,
              "Página inteira") é da barra do diálogo, e o conteúdo começa no
              título. Na página, o quadrado leva de volta para a Início. */}
          {!embutido && (
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              aria-label="Voltar para a Início"
              title="Voltar para a Início"
              style={BOTAO_QUADRADO}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* R195: título de página de 22px é 700 */}
            <h1 style={{
              margin: 0, fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 22,
              lineHeight: 1.25, textWrap: "balance" as any,
            }}>
              {chamado.titulo}
            </h1>
            <div style={{
              fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11.5,
              color: textSecondary, marginTop: 5, display: "flex", flexWrap: "wrap", gap: "0 6px",
            }}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{chamado.numero}</span>
              <span>· aberta {tempoRelativo(chamado.created_at)}{chamado.aberto_por ? ` por ${nomeDe(chamado.aberto_por)}` : ""}</span>
              {tipoRotulo && <span>· {tipoRotulo}</span>}
              {chamado.origem === "notion" && <span>· importada do Notion</span>}
            </div>
          </div>
        </header>

        {/* os TEXTOS — o trabalho. Descrição (R135); na corretiva, Problema
            detectado e Solução aplicada (R149), lado a lado no monitor grande. */}
        <div className={ehCorretiva ? "atividade-textos duplo" : "atividade-textos"}>
          <div style={{ ...CARD, minWidth: 0 }}>
            {cabecalho(
              temDiagnostico(chamado.tipo) ? "Problema detectado" : "Descrição",
              prog.campo === "descricao" ? "Cada item de checklist daqui conta no progresso da atividade." : null,
            )}
            <EditorDeDescricao
              valor={chamado.descricao_problema ?? ""}
              chaveReset={id}
              pessoas={pessoasMencao}
              somenteLeitura={!podeEditar}
              minAltura={ehCorretiva ? 440 : 520}
              placeholder={ehCorretiva
                ? "O que foi detectado, onde, desde quando… Digite @ para mencionar alguém."
                : "O que precisa ser feito, o que já se sabe… Digite @ para mencionar alguém."}
              aoSalvar={(v) => salvar.mutate({ descricao_problema: v || null })}
            />
          </div>
          {ehCorretiva && (
            <div style={{ ...CARD, minWidth: 0 }}>
              {cabecalho(
                "Solução aplicada",
                prog.campo === "solucao" ? "Cada item de checklist daqui conta no progresso da atividade." : null,
              )}
              <EditorDeDescricao
                valor={chamado.servico_executado ?? ""}
                chaveReset={`${id}-solucao`}
                pessoas={pessoasMencao}
                somenteLeitura={!podeEditar}
                minAltura={440}
                placeholder="O que foi feito para resolver. Digite @ para mencionar alguém."
                aoSalvar={(v) => salvar.mutate({ servico_executado: v || null })}
              />
            </div>
          )}
        </div>

        {/* EQUIPAMENTOS (R226/R236/R237): cliente ÚNICO → Blocos | Sem bloco,
            arrastar para o bloco onde foi instalado, remover do cliente.
            Precisa de largura, por isso mora no documento. */}
        {clienteUnico && chamado.cliente_id && (
          <EquipamentosDaAtividade
            chamadoId={id}
            clienteId={chamado.cliente_id}
            podeEditar={podeEditar}
            estiloCard={CARD}
            estiloSecao={SEC}
          />
        )}
        {/* Equipamentos envolvidos — a lacuna do Notion. Fica para a atividade
            interna ou de grupo (R226 só vale para cliente único) e para o que
            já foi anotado à mão em atividades antigas */}
        {(!clienteUnico || equipamentos.length > 0) && (
          <div style={CARD}>
            <span style={SEC}>Equipamentos envolvidos</span>
            {equipamentos.length === 0 && (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                Nenhum equipamento vinculado.
              </span>
            )}
            <div className="atividade-equip-lista">
              {equipamentos.map((eq) => (
                <div
                  key={eq.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 12,
                    background: isLight ? "#fafafa" : "rgba(255,255,255,0.03)",
                    border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Wrench size={14} color={gold} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                      {eq.descricao ?? "Equipamento"}
                    </div>
                    {eq.numero_serie && (
                      <div style={{ fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                        Série {eq.numero_serie}
                      </div>
                    )}
                  </div>
                  {podeEditar && (
                    <button
                      onClick={() => mexerEquip.mutate({ tipo: "del", equipId: eq.id })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, display: "flex" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {podeEditar && !clienteUnico && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px 44px", gap: 8, maxWidth: 620 }}>
                <input
                  style={INPUT}
                  value={novoEquip}
                  onChange={(e) => setNovoEquip(e.target.value)}
                  placeholder="Equipamento"
                />
                <input
                  style={INPUT}
                  value={novaSerie}
                  onChange={(e) => setNovaSerie(e.target.value)}
                  placeholder="Nº série"
                />
                <button
                  onClick={() => mexerEquip.mutate({ tipo: "add" })}
                  disabled={!novoEquip.trim()}
                  aria-label="Adicionar equipamento"
                  style={{
                    height: 44, borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                    color: "#0E0E0E", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: novoEquip.trim() ? "pointer" : "default", opacity: novoEquip.trim() ? 1 : 0.5,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* A CONVERSA — secundária ao trabalho, mas pertence ao documento:
            logo abaixo dele, na mesma coluna. Quem escreveu apaga (R135). */}
        <div style={CARD}>
          <span style={SEC}>Comentários</span>
          {comentarios.length === 0 && (
            <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
              Ninguém comentou ainda.
            </span>
          )}
          {comentarios.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <span style={{ marginTop: 2, flexShrink: 0 }}>
                {c.user_id ? (
                  <AvatarCirculo id={c.user_id} nome={nomeDe(c.user_id)} pessoa={pessoasPorId[c.user_id]} tamanho={26} />
                ) : (
                  <span style={{ width: 26, height: 26, borderRadius: "50%", display: "inline-block", background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }} />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5, color: textPrimary }}>
                    {c.user_id ? nomeDe(c.user_id) : "—"}
                    <span style={{ fontWeight: 400, color: textSecondary }}> · {tempoRelativo(c.created_at)}</span>
                  </span>
                  {c.user_id && c.user_id === userId && (
                    <button
                      onClick={() => { if (confirm("Apagar este comentário?")) apagarComentario.mutate(c.id); }}
                      disabled={apagarComentario.isPending}
                      title="Apagar meu comentário"
                      aria-label="Apagar meu comentário"
                      style={{
                        marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                        color: textSecondary, display: "flex", padding: 2,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <TextoComChecklist
                  texto={c.descricao ?? ""}
                  estilo={{ fontSize: 13, color: textPrimary, lineHeight: 1.55, marginTop: 2 }}
                />
                {/* R217: a mesma fileira de reações do painel e do chat */}
                <FileiraDeReacoes chamadoId={id} eventoId={c.id} reacoes={reacoes.reacoes} faltaMigration={reacoes.faltaMigration} euId={userId} />
              </div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", gap: 8, alignItems: "start" }}>
            <TextareaComMencoes
              valor={comentario}
              aoMudar={setComentario}
              pessoas={pessoasMencao}
              rows={2}
              placeholder="Escrever um comentário… (@ menciona, Enter envia)"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && comentario.trim() && !enviarComentario.isPending) {
                  e.preventDefault();
                  enviarComentario.mutate();
                }
              }}
              estilo={{ ...INPUT, height: "auto", minHeight: 44, padding: "11px 12px", resize: "vertical", lineHeight: 1.5 }}
            />
            <button
              onClick={() => enviarComentario.mutate()}
              disabled={!comentario.trim() || enviarComentario.isPending}
              aria-label="Enviar comentário"
              style={{
                height: 44, borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                color: "#0E0E0E", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: comentario.trim() ? "pointer" : "default", opacity: comentario.trim() ? 1 : 0.5,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ══ FICHA ═══════════════════════════════════════════════════════════ */}
      <aside className="atividade-ficha" aria-label="Ficha da atividade">
        {/* R235: o progresso abre a ficha — "quanto andou" se lê antes de qualquer campo */}
        <div style={{ ...CARD, padding: "12px 16px 12px 12px" }}>
          <RoscaDeProgresso p={prog} tamanho={96} />
        </div>

        <div style={{ ...CARD, gap: 8 }}>
          <span style={SEC}>Ficha</span>
          <div className="ficha-linhas">
            {linha("Status", (
              <SeletorDeOpcao
                id="det-status"
                valor={chamado.status ?? null}
                opcoes={opcoesStatus}
                desabilitado={!podeEditar || salvar.isPending}
                aoMudar={(v) => v && salvar.mutate({ status: v as ChamadoStatus })}
              />
            ))}
            {linha("Tipo", (
              <SeletorDeOpcao
                id="det-tipo"
                valor={chamado.tipo ?? null}
                opcoes={opcoesTipo}
                vazio="— sem tipo —"
                desabilitado={!podeEditar}
                aoMudar={(v) => salvar.mutate({ tipo: v as any })}
              />
            ))}
            {/* R142: impacto operacional só em corretiva e operacional —
                implantação, preventiva, melhoria e proposta não têm grau de
                urgência (Davi). Prioridade NÃO aparece aqui: é do campo. */}
            {temImpacto(chamado.tipo) && linha("Impacto", (
              <SeletorDeOpcao
                id="det-impacto"
                valor={chamado.impacto_operacional ?? null}
                opcoes={opcoesImpacto}
                vazio="— sem impacto definido —"
                desabilitado={!podeEditar}
                aoMudar={(v) => salvar.mutate({ impacto_operacional: (v ?? null) as ImpactoOperacional | null })}
              />
            ))}
            {/* R232: prazo OU dia agendado, no mesmo controle das duas telas */}
            {linha("Quando", (
              <>
                <CampoQuando
                  idBase="det"
                  compacto
                  desabilitado={!podeEditar}
                  prazo={prazoParaData(chamado.prazo_limite)}
                  agendado={chamado.data_agendada ?? ""}
                  nota={reagendado}
                  estiloEntrada={{ ...INPUT, height: 32, fontSize: 12.5 }}
                  aoMudar={({ prazo, agendado }) => salvar.mutate({
                    prazo_limite: dataParaPrazo(prazo),
                    data_agendada: agendado || null,
                  })}
                />
                {chamado.prazo_limite && chamadoEmAberto(chamado.status) && !chamado.data_agendada && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontFamily: "var(--fonte)", fontSize: 11,
                    color: sp === "estourado" ? (isLight ? "#B1242E" : "#F17881") : textSecondary,
                  }}>
                    <CalendarClock size={12} /> {textoPrazo(chamado.prazo_limite)}
                  </span>
                )}
              </>
            ))}
            {linha("Responsável", (
              <CampoComBusca
                id="det-responsavel"
                compacto
                opcoes={opcoesPessoas}
                valor={chamado.responsavel_id ?? null}
                vazio="— sem responsável —"
                aoMudar={(v) => {
                  if (!podeEditar) return;
                  // R139: a coluna `equipe` acompanha o responsável
                  const eq = equipeDaPessoa(pessoas, v);
                  salvar.mutate({ responsavel_id: v, ...(eq ? { equipe: eq } : {}) });
                }}
                iconeEsquerda={(esc) => esc
                  ? <AvatarCirculo id={esc.valor} nome={esc.rotulo} pessoa={pessoasPorId[esc.valor]} tamanho={18} />
                  : null}
              />
            ))}
            {linha("Apoio", (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {apoios.map(({ profile_id: pid, origem, congelado_em }) => (
                  <span
                    key={pid}
                    title={especieDoApoio({ origem, congelado_em }) === "registro"
                      ? "Esteve num atendimento que já aconteceu — o sistema não troca mais este nome sozinho."
                      : undefined}
                    style={{
                      ...chipPessoa,
                      border: especieDoApoio({ origem, congelado_em }) === "registro"
                        ? (isLight ? "1px solid rgba(0,0,0,0.28)" : "1px solid rgba(255,255,255,0.32)")
                        : "1px solid transparent",
                    }}
                  >
                    <AvatarCirculo id={pid} nome={nomeDe(pid)} pessoa={pessoasPorId[pid]} tamanho={18} />
                    {nomeDe(pid)}
                    {(podeEditar || pid === userId) && (
                      <button
                        onClick={() => mudarApoio.mutate({ profileId: pid, entrar: false })}
                        aria-label={`Remover ${nomeDe(pid)} do apoio`}
                        title="Remover apoio"
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 2, display: "flex" }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                ))}
                {podeEditar && (
                  <div style={{ minWidth: 120, flex: 1 }}>
                    <CampoComBusca
                      id="det-apoio"
                      compacto
                      limpavel={false}
                      placeholder="+ apoio"
                      opcoes={opcoesPessoas.filter(
                        (o) => o.valor !== chamado.responsavel_id
                          && !apoios.some((a) => a.profile_id === o.valor),
                      )}
                      valor={null}
                      aoMudar={(v) => { if (v) mudarApoio.mutate({ profileId: v, entrar: true }); }}
                    />
                  </div>
                )}
                {apoios.length === 0 && !podeEditar && (
                  <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>ninguém ainda</span>
                )}
              </div>
            ))}
            {/* R139: as equipes ENVOLVIDAS — derivadas, não escolhidas */}
            {linha("Equipes", (
              equipesEnvolvidas.length === 0 ? (
                <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>ninguém com equipe no cadastro</span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {equipesEnvolvidas.map((e) => (
                    <span key={e} style={chipEquipe(e)}>{EQUIPE_LABEL[e] ?? e}</span>
                  ))}
                </div>
              )
            ))}
            {/* R148: a proposta comercial que origina a implantação */}
            {chamado.tipo === "implantacao" && linha("Proposta", (
              <CampoComBusca
                id="det-proposta"
                compacto
                opcoes={opcoesPropostas}
                valor={chamado.proposta_id ?? null}
                vazio="— nenhuma vinculada —"
                aoMudar={(v) => { if (podeEditar) salvar.mutate({ proposta_id: v }); }}
              />
            ))}
            {/* R143/R151: cliente(s), GRUPO(s) de clientes ou interno */}
            {linha("Cliente", (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ehInterno && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 12.5, color: textSecondary }}>
                    <Building2 size={14} color={gold} /> Interno — Prever
                  </div>
                )}
                {chamado.cliente && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 12.5, color: textPrimary }}>
                    <Building2 size={14} color={gold} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={chamado.cliente.nome}>{chamado.cliente.nome}</span>
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => mexerLocal.mutate({ valor: chamado.cliente_id as string, remover: true })}
                        aria-label={`Remover ${chamado.cliente.nome}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 2, display: "flex" }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}
                {clientesExtras.map((cid) => (
                  <div key={cid} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 12.5, color: textPrimary }}>
                    <Building2 size={14} color={textSecondary} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientesPorId[cid]?.nome ?? "Cliente"}</span>
                    {podeEditar && (
                      <button
                        type="button"
                        onClick={() => mexerLocal.mutate({ valor: cid, remover: true })}
                        aria-label={`Remover ${clientesPorId[cid]?.nome ?? "cliente"}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 2, display: "flex" }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {setoresDoChamado.map((s) => {
                  const cor = SERVICO_CORES[s as ServicoCliente];
                  return (
                    <span key={s} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
                      padding: "4px 9px", borderRadius: 999,
                      ...(cor ? etiqueta(cor) : {}),
                      fontFamily: "var(--fonte)", fontSize: 11.5, fontWeight: 600,
                    }}>
                      <Layers size={12} /> Clientes de {SERVICO_LABEL[s as ServicoCliente] ?? s}
                      {podeEditar && (
                        <button
                          type="button"
                          onClick={() => mexerLocal.mutate({ valor: valorDoGrupo(s as ServicoCliente), remover: true })}
                          aria-label={`Remover o grupo ${SERVICO_LABEL[s as ServicoCliente] ?? s}`}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex" }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  );
                })}
                {setoresDoChamado.length > 0 && (
                  <span style={LINHA_INFO}>Uma atividade só; conta no histórico de cada cliente do grupo.</span>
                )}
                {podeEditar && (
                  <CampoComBusca
                    id="detalhe-local"
                    compacto
                    limpavel={false}
                    opcoes={opcoesLocais}
                    valor={null}
                    aoMudar={(v) => { if (v) mexerLocal.mutate({ valor: v, remover: false }); }}
                    placeholder={ehInterno ? "+ cliente ou grupo" : "+ outro cliente ou grupo"}
                  />
                )}
              </div>
            ))}
          </div>

          {/* R144: o RECEBIMENTO — quem criou e quando; início e conclusão são os
              carimbos do banco. Rodapé fino da ficha: informação que não se edita. */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 3, paddingTop: 10,
            borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={LINHA_INFO}>
              Recebida{chamado.aberto_por ? ` de ${nomeDe(chamado.aberto_por)}` : ""} em {dataHora(chamado.created_at)}
              {chamado.origem && chamado.origem !== "app" ? ` · via ${chamado.origem}` : ""}
            </span>
            {chamado.iniciada_em && <span style={LINHA_INFO}>Iniciada em {dataHora(chamado.iniciada_em)}</span>}
            {chamado.concluida_em && <span style={LINHA_INFO}>Concluída em {dataHora(chamado.concluida_em)}</span>}
          </div>
        </div>

        {/* R150: fotos de registro e arquivos */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={SEC}>Fotos e arquivos</span>
            <span style={{ flex: 1 }} />
            {podeEditar && (
              <>
                <input
                  ref={arquivoRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => { void anexarArquivos(e.target.files); e.currentTarget.value = ""; }}
                />
                <button
                  onClick={() => arquivoRef.current?.click()}
                  disabled={enviandoArquivo}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 11px",
                    borderRadius: 10, cursor: enviandoArquivo ? "wait" : "pointer",
                    background: isLight ? "#ffffff" : "#1b1b1b",
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                    color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 11.5,
                  }}
                >
                  <Paperclip size={13} color={gold} /> {enviandoArquivo ? "Enviando…" : "Anexar"}
                </button>
              </>
            )}
          </div>
          {fotos.length === 0 ? (
            <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
              Nenhum arquivo ainda.
            </span>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              {fotos.map((f) => {
                const ehImagem = EXT_IMAGEM.test(f.storage_path ?? f.url ?? "");
                return (
                  <div key={f.id} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                    {ehImagem && f.signedUrl ? (
                      <a href={f.signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", height: "100%" }}>
                        <img
                          src={f.signedUrl}
                          alt={f.legenda ?? "arquivo"}
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, display: "block" }}
                        />
                      </a>
                    ) : (
                      <a
                        href={f.signedUrl ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={f.storage_path ?? undefined}
                        style={{
                          width: "100%", height: "100%", borderRadius: 12, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none",
                          background: isLight ? "#f5f5f5" : "rgba(255,255,255,0.04)",
                          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                          color: textSecondary, fontFamily: "var(--fonte)", fontSize: 10,
                        }}
                      >
                        <FileText size={20} color={gold} />
                        <span style={{ maxWidth: "88%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {(f.storage_path ?? "").split("/").pop()?.replace(/^\d+-/, "") ?? "arquivo"}
                        </span>
                      </a>
                    )}
                    {podeEditar && (
                      <button
                        onClick={() => { if (confirm("Remover este arquivo?")) removerArquivo.mutate({ fotoId: f.id, path: f.storage_path }); }}
                        aria-label="Remover arquivo"
                        style={{
                          position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                          background: "#212121", color: "#fff", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Linha do tempo — o que o sistema registrou: histórico, não conversa */}
        {timeline.length > 0 && (
          <div style={CARD}>
            <span style={SEC}>Linha do tempo</span>
            {timeline.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: gold, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 12, color: textSecondary, flex: 1 }}>
                  {e.descricao}
                  {e.user_id ? ` — ${pessoasPorId[e.user_id]?.nome ?? ""}` : ""}
                </span>
                <span style={{ fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 10.5, color: textSecondary, flexShrink: 0 }}>
                  {tempoRelativo(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {isGerente && (
          <button
            onClick={() => {
              if (confirm(`Excluir o chamado ${chamado.numero}? Não tem desfazer.`)) excluir.mutate();
            }}
            style={{
              height: 44, borderRadius: 22,
              background: "none",
              border: isLight ? "1px solid rgba(177,36,46,0.30)" : "1px solid rgba(241,120,129,0.30)",
              color: isLight ? "#B1242E" : "#F17881",
              fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Excluir chamado
          </button>
        )}
      </aside>
    </div>
  );

  // R238: dentro do diálogo da Início a casca é a do diálogo — sem a sangria da
  // página e sem a ficha sticky (o scroll é do diálogo)
  if (embutido) {
    return <div className="atividade-embutida" style={{ color: textPrimary }}>{conteudo}</div>;
  }
  // CUIDADO (U120): aqui havia `padding: "12px 0 56px"` — o ATALHO inline zera
  // padding-left/right e apagava a margem que a classe dá. Era ISTO que colava o
  // conteúdo nas duas bordas da janela na tela do Davi, não a classe. Estilo
  // inline nesta página mexe só no eixo VERTICAL; o horizontal é da classe, que
  // sabe do rail e do breakpoint (anti-padrão nº 10 do DESIGN_SYSTEM).
  return (
    <div className="pagina-trabalho" style={{ paddingTop: 12, paddingBottom: 56, color: textPrimary }}>
      <div className="trabalho-miolo">{conteudo}</div>
    </div>
  );
}
