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
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CalendarClock, FileText, Layers, Paperclip, Plus, Send, Trash2, Wrench, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { card } from "@/lib/ui";
import { TextoComChecklist } from "@/components/TextoComChecklist";
import { SeletorDeOpcao, type OpcaoDoSeletor } from "@/components/SeletorDeOpcao";
import { EditorDeDescricao, TextareaComMencoes, type PessoaParaMencao } from "@/components/EditorDeDescricao";
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
import { useClientes, SERVICO_LABEL, SERVICO_CORES, SERVICO_ORDEM, type ServicoCliente } from "@/features/clientes/data";
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

export function DetalheInterno({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: chamado, isLoading } = useChamado(id);
  const { data: eventos = [] } = useChamadoEventos(id, "asc");
  const { data: apoios = [] } = useChamadoApoios(id);
  const { data: equipamentos = [] } = useChamadoEquipamentos(id);
  const { data: locais = [] } = useChamadoLocais(id);
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
      ...SERVICO_ORDEM.map((g) => ({ valor: valorDoGrupo(g), rotulo: rotuloDoGrupo(g), secundario: "grupo de clientes" })),
      ...[...clientes]
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
        .map((c) => ({ valor: c.id, rotulo: c.nome, secundario: (c as any).posto_servico ?? undefined })),
    ].filter((o) => !usados.has(o.valor));
  }, [clientes, locais, chamado?.cliente_id]);
  const nomeDe = (pid: string) => pessoasPorId[pid]?.nome ?? "Alguém";

  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
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
    background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
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

  const st = chamadoStatusInfo(chamado.status);
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
      color: isLight ? c.light : c.dark, background: c.bg, border: `1px solid ${c.border}`,
    };
  };

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
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
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18, lineHeight: 1.3 }}>
            {chamado.titulo}
          </div>
          <div style={{
            fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11.5,
            color: textSecondary, marginTop: 3,
          }}>
            {chamado.numero} · aberto {tempoRelativo(chamado.created_at)}
            {chamado.origem === "notion" && " · importada do Notion"}
          </div>
        </div>
        <span style={{
          flexShrink: 0, padding: "5px 10px", borderRadius: 999,
          fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 9.5,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: isLight ? st.colorLight : st.color,
          background: st.bg, border: `1px solid ${st.border}`,
        }}>
          {st.label}
        </span>
      </div>

      <div className="detalhe-grid">
        {/* ══ COLUNA LARGA — o texto e a conversa ═══════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* Descrição — o editor de blocos (R135): caixa de marcar de verdade,
              ponto de lista, negrito/itálico, menção com "@". Grava sozinho.
              Na corretiva ela é a "descrição do problema detectado" (R149). */}
          <div style={CARD}>
            <span style={SEC}>{chamado.tipo === "corretiva" ? "Problema detectado" : "Descrição"}</span>
            <EditorDeDescricao
              valor={chamado.descricao_problema ?? ""}
              chaveReset={id}
              pessoas={pessoasMencao}
              somenteLeitura={!podeEditar}
              minAltura={chamado.tipo === "corretiva" ? 220 : 320}
              placeholder={chamado.tipo === "corretiva"
                ? "O que foi detectado, onde, desde quando… Digite @ para mencionar alguém."
                : "O que precisa ser feito, o que já se sabe… Digite @ para mencionar alguém."}
              aoSalvar={(v) => salvar.mutate({ descricao_problema: v || null })}
            />
          </div>

          {/* R149: a corretiva tem DOIS textos — o problema e a solução aplicada.
              A solução mora em `servico_executado`, a mesma coluna que o chamado
              de campo já usa para "o que foi feito para resolver". */}
          {chamado.tipo === "corretiva" && (
            <div style={CARD}>
              <span style={SEC}>Solução aplicada</span>
              <EditorDeDescricao
                valor={chamado.servico_executado ?? ""}
                chaveReset={`${id}-solucao`}
                pessoas={pessoasMencao}
                somenteLeitura={!podeEditar}
                minAltura={160}
                placeholder="O que foi feito para resolver. Digite @ para mencionar alguém."
                aoSalvar={(v) => salvar.mutate({ servico_executado: v || null })}
              />
            </div>
          )}

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
                      display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 11px",
                      borderRadius: 10, cursor: enviandoArquivo ? "wait" : "pointer",
                      background: isLight ? "#ffffff" : "#191921",
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {fotos.map((f) => {
                  const ehImagem = EXT_IMAGEM.test(f.storage_path ?? f.url ?? "");
                  return (
                    <div key={f.id} style={{ position: "relative" }}>
                      {ehImagem && f.signedUrl ? (
                        <a href={f.signedUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={f.signedUrl}
                            alt={f.legenda ?? "arquivo"}
                            style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 12, display: "block" }}
                          />
                        </a>
                      ) : (
                        <a
                          href={f.signedUrl ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={f.storage_path ?? undefined}
                          style={{
                            width: 92, height: 92, borderRadius: 12, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none",
                            background: isLight ? "#f5f6f8" : "rgba(255,255,255,0.04)",
                            border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                            color: textSecondary, fontFamily: "var(--fonte)", fontSize: 10,
                          }}
                        >
                          <FileText size={20} color={gold} />
                          <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                            background: "#1e2229", color: "#fff", border: "none", cursor: "pointer",
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

          {/* Feed — a conversa sobre a atividade. Quem escreveu apaga (R135). */}
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
                  color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: comentario.trim() ? "pointer" : "default", opacity: comentario.trim() ? 1 : 0.5,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Linha do tempo */}
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
        </div>

        {/* ══ COLUNA ESTREITA — as propriedades, cada uma num seletor ═══════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={CARD}>
            <span style={SEC}>Propriedades</span>
            <div>
              <label style={LABEL}>Status</label>
              <SeletorDeOpcao
                id="det-status"
                valor={chamado.status ?? null}
                opcoes={opcoesStatus}
                desabilitado={!podeEditar || salvar.isPending}
                aoMudar={(v) => v && salvar.mutate({ status: v as ChamadoStatus })}
              />
            </div>
            <div>
              <label style={LABEL}>Tipo de demanda</label>
              <SeletorDeOpcao
                id="det-tipo"
                valor={chamado.tipo ?? null}
                opcoes={opcoesTipo}
                vazio="— sem tipo —"
                desabilitado={!podeEditar}
                aoMudar={(v) => salvar.mutate({ tipo: v as any })}
              />
            </div>
            {/* R142: impacto operacional só em corretiva e operacional —
                implantação, preventiva, melhoria e proposta não têm grau de
                urgência (Davi). Prioridade NÃO aparece aqui: é do campo. */}
            {temImpacto(chamado.tipo) && (
              <div>
                <label style={LABEL}>Impacto operacional</label>
                <SeletorDeOpcao
                  id="det-impacto"
                  valor={chamado.impacto_operacional ?? null}
                  opcoes={opcoesImpacto}
                  vazio="— sem impacto definido —"
                  desabilitado={!podeEditar}
                  aoMudar={(v) => salvar.mutate({ impacto_operacional: (v ?? null) as ImpactoOperacional | null })}
                />
              </div>
            )}
            <div>
              <label style={LABEL}>Prazo</label>
              <input
                style={INPUT}
                type="date"
                disabled={!podeEditar}
                value={prazoParaData(chamado.prazo_limite)}
                onChange={(e) => salvar.mutate({ prazo_limite: dataParaPrazo(e.target.value) })}
              />
              {chamado.prazo_limite && chamadoEmAberto(chamado.status) && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 5, marginTop: 6,
                  fontFamily: "var(--fonte)", fontSize: 11,
                  color: sp === "estourado" ? (isLight ? "#B1242E" : "#F17881") : textSecondary,
                }}>
                  <CalendarClock size={12} /> {textoPrazo(chamado.prazo_limite)}
                </div>
              )}
            </div>
            {/* R148: a proposta comercial que origina a implantação */}
            {chamado.tipo === "implantacao" && (
              <div>
                <label style={LABEL}>Proposta comercial aprovada</label>
                <CampoComBusca
                  id="det-proposta"
                  opcoes={opcoesPropostas}
                  valor={chamado.proposta_id ?? null}
                  vazio="— nenhuma vinculada —"
                  aoMudar={(v) => { if (podeEditar) salvar.mutate({ proposta_id: v }); }}
                />
              </div>
            )}

            {/* R144: o RECEBIMENTO — quem criou e quando; início e conclusão
                são os carimbos do banco (em andamento / concluído). */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 4, borderTop: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)" }}>
              <span style={LINHA_INFO}>
                Recebido{chamado.aberto_por ? ` de ${nomeDe(chamado.aberto_por)}` : ""} em {dataHora(chamado.created_at)}
                {chamado.origem && chamado.origem !== "app" ? ` · via ${chamado.origem}` : ""}
              </span>
              {chamado.iniciada_em && <span style={LINHA_INFO}>Iniciado em {dataHora(chamado.iniciada_em)}</span>}
              {chamado.concluida_em && <span style={LINHA_INFO}>Concluído em {dataHora(chamado.concluida_em)}</span>}
            </div>
          </div>

          <div style={CARD}>
            <span style={SEC}>Pessoas</span>
            <div>
              <label style={LABEL}>Responsável</label>
              <CampoComBusca
                id="det-responsavel"
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
            </div>
            <div>
              <label style={LABEL}>Apoio</label>
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
                  <div style={{ minWidth: 160, flex: 1 }}>
                    <CampoComBusca
                      id="det-apoio"
                      compacto
                      limpavel={false}
                      placeholder="+ adicionar apoio"
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
            </div>
            {/* R139: as equipes ENVOLVIDAS — derivadas, não escolhidas */}
            <div>
              <label style={LABEL}>Equipes envolvidas</label>
              {equipesEnvolvidas.length === 0 ? (
                <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                  ninguém com equipe no cadastro
                </span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {equipesEnvolvidas.map((e) => (
                    <span key={e} style={chipEquipe(e)}>{EQUIPE_LABEL[e] ?? e}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* R143/R151: cliente(s), GRUPO(s) de clientes ou interno — mais de um
              cliente na mesma atividade, aqui como no painel lateral */}
          <div style={CARD}>
            <span style={SEC}>Cliente</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ehInterno && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 13, color: textSecondary }}>
                  <Building2 size={14} color={gold} /> Interno — Prever
                </div>
              )}
              {chamado.cliente && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                  <Building2 size={14} color={gold} /> <span style={{ flex: 1, minWidth: 0 }}>{chamado.cliente.nome}</span>
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
                <div key={cid} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--fonte)", fontSize: 13, color: textPrimary }}>
                  <Building2 size={14} color={textSecondary} /> <span style={{ flex: 1, minWidth: 0 }}>{clientesPorId[cid]?.nome ?? "Cliente"}</span>
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
                    background: cor?.bg, color: isLight ? cor?.light : cor?.dark,
                    fontFamily: "var(--fonte)", fontSize: 12, fontWeight: 600,
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
                <span style={LINHA_INFO}>
                  Uma atividade só; conta no histórico de cada cliente do grupo.
                </span>
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
          </div>

          {/* Equipamentos envolvidos — a lacuna do Notion */}
          <div style={CARD}>
            <span style={SEC}>Equipamentos envolvidos</span>
            {equipamentos.length === 0 && (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                Nenhum equipamento vinculado.
              </span>
            )}
            {equipamentos.map((eq) => (
              <div
                key={eq.id}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 12,
                  background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
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
            {podeEditar && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 44px", gap: 8 }}>
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
                  style={{
                    height: 44, borderRadius: 12, border: "none",
                    background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
                    color: "#08090E", display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: novoEquip.trim() ? "pointer" : "default", opacity: novoEquip.trim() ? 1 : 0.5,
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>

          {isGerente && (
            <button
              onClick={() => {
                if (confirm(`Excluir o chamado ${chamado.numero}? Não tem desfazer.`)) excluir.mutate();
              }}
              style={{
                height: 46, borderRadius: 23,
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
        </div>
      </div>
    </div>
  );
}
