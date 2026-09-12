// O pop-up de nova atividade (R91, U72) — reescrito na U96 pela ESTRUTURA DAS
// ATIVIDADES (R137/R138, Davi, 2026-09-03):
//
//   "quando o usuário cria uma nova atividade, o campo que surge em pop up no
//    meio da tela deve começar com duas perguntas iniciais: QUAL O TIPO DE
//    DEMANDA? […] e também QUEM É O RESPONSÁVEL? Pois é a partir dessas 2
//    perguntas que nós vamos saber […] qual dos 6 tipos de demanda […] e
//    consequentemente os campos mudam, e também vamos saber se o responsável é
//    da equipe TÉCNICA […] para cada opção, o campo se expande para tela
//    inteira porém com os campos da maneira condizente com o que foi passado."
//
// Então o diálogo tem DOIS momentos. Antes das duas respostas ele é pequeno e
// só pergunta. Depois ele cresce e mostra o corpo certo:
//   · tipo "Proposta Comercial" → o formulário da visita EMBUTIDO aqui (R214,
//     U117 — antes navegava para /gerencial/nova), o mesmo da rota, que já
//     tem local, tipo de local, síndico/proprietário, técnico e data (R147);
//   · responsável da equipe TÉCNICA → o formulário de campo (R126), que já
//     sabe de cliente, sistema, dupla e agenda — a estrutura da área técnica
//     ainda vai ser ditada pelo Davi, e até lá é este o fluxo;
//   · os demais → a estrutura da atividade FORA da técnica (R137): título,
//     cliente (um cliente, um GRUPO ou interno), descrição, impacto
//     operacional (só corretiva e operacional, R142), prazo, apoio, a proposta
//     de origem (implantação, R148) e arquivos.
//
// O que NÃO se pergunta mais: equipe (R139 — é a das pessoas), prioridade no
// interno (R142 — virou impacto) e sprint (R141 — é cálculo sobre o prazo).
//
// Continua a MESMA porta de escrita (`abrirChamado`) do campo de IA, e o
// atendimento de PLANTÃO (R117) continua entrando por aqui, como modo à parte.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, ListPlus, Paperclip, X, Building2, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, botaoSelecao, goldButton, etiqueta } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import {
  abrirChamado, usePessoas, adicionarApoio, adicionarSetorChamado, adicionarClienteChamado, anexarFoto,
  usePropostasEnviadas, equipeDaPessoa,
} from "@/features/chamados/data";
import { useClientes, type ServicoCliente } from "@/features/clientes/data";
import { SERVICOS_OFERECIDOS } from "@/features/clientes/data";
import {
  checklistDoGrupo, acrescentarChecklist, rotuloDoGrupo, valorDoGrupo, setorDoValor,
} from "@/features/chamados/grupos";
import { CampoComBusca, type OpcaoBusca } from "@/components/CampoComBusca";
import { CampoQuando } from "@/components/CampoQuando";
import { usePermissoes } from "@/features/gerencial/permissoes";
import { AvatarCirculo } from "@/components/PessoaComFoto";
import {
  TIPO_LABEL, TIPO_CORES, IMPACTO_ORDEM, IMPACTO_LABEL, IMPACTO_CORES, temImpacto, dataParaPrazo,
  TIPOS_DE_DEMANDA, tiposDaNatureza,
  type ChamadoTipo, type ImpactoOperacional,
} from "@/lib/chamado-status";
import { EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import { FormularioChamadoTecnico } from "@/features/chamados/FormularioChamadoTecnico";
import { NovaVisitaTecnica } from "@/features/gerencial/NovaVisitaTecnica";
import { PainelDePlantao } from "@/features/plantao/PainelDePlantao";

// A lista dos SEIS tipos de demanda (R137) mora em chamado-status.ts
// (`TIPOS_DE_DEMANDA`) — o único endereço autorizado para uma lista de tipos
// (U83). A pergunta é feita antes de a natureza existir: é a resposta, com o
// responsável, que decide qual corpo abre.

export function NovaAtividadeDialog({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();
  const { data: propostas = [] } = usePropostasEnviadas();

  // ── as duas perguntas ──────────────────────────────────────────────────
  const [tipo, setTipo] = useState<ChamadoTipo | null>(null);
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [euId, setEuId] = useState<string | null>(null);
  const [modoPlantao, setModoPlantao] = useState(false);

  // ── o corpo da atividade fora da técnica ───────────────────────────────
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  /**
   * R151: os LOCAIS da atividade — ids de cliente e/ou `setor:<grupo>` (R143),
   * na ordem em que foram escolhidos. Vazio = interno, na Prever. O primeiro
   * cliente é o principal (chamados.cliente_id); os demais e os grupos vão
   * para chamado_locais, exatamente como o painel lateral já fazia.
   */
  const [locais, setLocais] = useState<string[]>([]);
  const [impacto, setImpacto] = useState<ImpactoOperacional | null>(null);
  const [prazo, setPrazo] = useState("");
  // R225 (U119): toda atividade pode nascer AGENDADA — com dia marcado ela
  // vai para a coluna "Agendado" e não tem prazo
  const [agendarPara, setAgendarPara] = useState("");
  const [apoios, setApoios] = useState<string[]>([]);
  const [propostaId, setPropostaId] = useState<string | null>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const textPrimary = isLight ? "#212121" : "#ffffff";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  // quem está registrando costuma ser o responsável — proposto, não imposto
  useEffect(() => {
    if (!aberto) return;
    supabase.auth.getUser().then(({ data }) => {
      const eu = (pessoas as any[]).find((p) => p.id === data.user?.id);
      if (!eu) return;
      setEuId(eu.id);
      setResponsavelId((v) => v ?? eu.id);
    });
  }, [aberto, pessoas]);

  const equipeDoResponsavel = equipeDaPessoa(pessoas, responsavelId);
  const ehTecnico = equipeDoResponsavel === "tecnica";
  const ehProposta = tipo === "prospeccao";
  const pronto = !!tipo && !!responsavelId;
  // R163: quem não tem a chave `chamados.novo` (o técnico, por padrão) não vê
  // as duas perguntas — o "+" fica com ele porque é a porta do plantão (R117).
  // Enquanto a matriz carrega (undefined) o corpo aparece: é gate de tela, o
  // dado continua protegido pela RLS.
  const { podeVer } = usePermissoes();
  const podeAbrirChamado = podeVer("chamados.novo") !== false;

  const pessoasOrdenadas = useMemo(
    () => [...(pessoas as any[])].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    [pessoas],
  );
  const pessoasPorId = useMemo(() => Object.fromEntries((pessoas as any[]).map((p) => [p.id, p])), [pessoas]);
  const clientesPorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const rotuloDoLocal = (v: string) => {
    const setor = setorDoValor(v);
    return setor ? rotuloDoGrupo(setor) : (clientesPorId[v]?.nome ?? "Cliente");
  };
  const opcoesPessoas: OpcaoBusca[] = useMemo(
    () => pessoasOrdenadas.map((p) => ({
      valor: p.id as string,
      rotulo: (p.nome ?? "Sem nome") as string,
      secundario: p.equipe ? EQUIPE_LABEL[p.equipe as Equipe] : undefined,
    })),
    [pessoasOrdenadas],
  );
  // R143: os GRUPOS entram na MESMA lista do cliente, no topo — Davi: "Adicione
  // as opções mencionadas na lista de clientes que expande no campo de seleção
  // CLIENTE". O vazio é "Interno — Prever" (manutenção interna, sem cliente).
  const opcoesClientes: OpcaoBusca[] = useMemo(
    () => [
      ...SERVICOS_OFERECIDOS.map((s) => ({ valor: valorDoGrupo(s), rotulo: rotuloDoGrupo(s), secundario: "grupo de clientes" })),
      ...[...clientes]
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
        .map((c) => ({ valor: c.id, rotulo: c.nome, secundario: (c as any).posto_servico ?? undefined })),
    ],
    [clientes],
  );
  const opcoesPropostas: OpcaoBusca[] = useMemo(
    () => propostas.map((p) => ({
      valor: p.id,
      rotulo: p.cliente_nome ?? p.nome_predio ?? p.titulo ?? "Proposta",
      secundario: `enviada em ${new Date(p.proposta_enviada_em).toLocaleDateString("pt-BR")}`,
    })),
    [propostas],
  );

  // R151: cada escolha ACRESCENTA um local (o campo fica vazio para a próxima);
  // R143: escolher um GRUPO põe o checklist dos clientes dele na descrição
  function escolherCliente(v: string | null) {
    if (!v) return;
    setLocais((l) => (l.includes(v) ? l : [...l, v]));
    const setor = setorDoValor(v);
    if (setor) {
      setDescricao((d) => acrescentarChecklist(d, checklistDoGrupo(clientes, setor), `Clientes de ${rotuloDoGrupo(setor).replace(/^Clientes de /, "")}:`));
    }
  }

  // a mesma pessoa nunca é responsável e apoio; trocar o responsável tira o
  // nome dele do apoio se estava lá
  useEffect(() => {
    setApoios((a) => a.filter((id) => id !== responsavelId));
  }, [responsavelId]);
  // o impacto só existe em corretiva/operacional — trocar o tipo limpa
  useEffect(() => {
    if (!temImpacto(tipo)) setImpacto(null);
    if (tipo !== "implantacao") setPropostaId(null);
  }, [tipo]);

  /**
   * R260 (Davi, 12/09/2026): "Sempre que um usuário for abrir uma nova
   * atividade e o tipo de demanda selecionado for 'Proposta Comercial', altere
   * o Responsável para um usuário pertencente a equipe Comercial (Atualmente
   * só o Davi Voos)."
   *
   * É a EQUIPE do cadastro (`profiles.equipe`), como no Sobreaviso (R254): o
   * cargo é permissão, a equipe é roteamento — e quem faz proposta é a equipe
   * comercial, tenha o cargo que tiver.
   *
   * TRÊS CUIDADOS:
   *  · quem JÁ está no campo e é do comercial fica — trocar o nome de quem a
   *    pessoa acabou de escolher seria a tela discordando dela;
   *  · se EU sou do comercial, o escolhido sou eu: o caso normal é o comercial
   *    abrindo a própria proposta;
   *  · se não houver NINGUÉM com equipe comercial no cadastro, o campo fica
   *    como está. Melhor vazio do que escalar o primeiro da lista por sorteio —
   *    e o campo continua aberto para escolher à mão, sempre.
   */
  useEffect(() => {
    if (tipo !== "prospeccao") return;
    if (equipeDaPessoa(pessoas, responsavelId) === "comercial") return;
    const doComercial = pessoasOrdenadas.filter((p: any) => p.equipe === "comercial");
    const alvo = doComercial.find((p: any) => p.id === euId) ?? doComercial[0];
    if (alvo) setResponsavelId(alvo.id as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, pessoasOrdenadas, euId]);

  function limpar() {
    setTipo(null); setTitulo(""); setDescricao(""); setLocais([]);
    setImpacto(null); setPrazo(""); setAgendarPara(""); setApoios([]); setPropostaId(null); setArquivos([]);
    setModoPlantao(false);
  }
  function fechar() { limpar(); aoFechar(); }

  async function criar() {
    if (!tipo || !responsavelId) return;
    if (!titulo.trim()) { toast.error("Escreva o título da atividade."); return; }
    setSalvando(true);
    try {
      // R151: o primeiro cliente é o PRINCIPAL; os outros e os grupos entram
      // depois, em chamado_locais, cada um falhando sozinho
      const clientesIds = locais.filter((v) => !setorDoValor(v));
      const setores = locais.map(setorDoValor).filter((x): x is ServicoCliente => !!x);
      const id = await abrirChamado({
        natureza: "interno",
        tipo,
        titulo: titulo.trim(),
        descricao_problema: descricao.trim() || null,
        responsavel_id: responsavelId,
        // R139: a coluna do banco recebe a equipe do responsável; a etiqueta
        // da tela sai das pessoas. Sem equipe no cadastro, o balde de sempre.
        equipe: equipeDoResponsavel ?? "outras",
        cliente_id: clientesIds[0] ?? null,
        prazo_limite: prazo && !agendarPara ? dataParaPrazo(prazo) : null,
        data_agendada: agendarPara || null,
        impacto_operacional: temImpacto(tipo) ? impacto : null,
        proposta_id: tipo === "implantacao" ? propostaId : null,
      });
      // o resto é aditivo e cada peça falha sozinha (o chamado JÁ existe)
      const pendencias: string[] = [];
      const tentar = async (o: string, f: () => Promise<unknown>) => {
        try { await f(); } catch { pendencias.push(o); }
      };
      for (const cid of clientesIds.slice(1)) await tentar("cliente", () => adicionarClienteChamado(id, clientesIds[0], cid));
      for (const st of setores) await tentar("grupo de clientes", () => adicionarSetorChamado(id, st));
      for (const p of apoios) await tentar("apoio", () => adicionarApoio(id, p));
      for (const f of arquivos) await tentar(`arquivo ${f.name}`, () => anexarFoto(id, f, "outra"));

      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["home-locais-todos"] });
      qc.invalidateQueries({ queryKey: ["home-apoios-todos"] });
      if (pendencias.length) toast.warning(`Atividade criada, mas não entrou: ${[...new Set(pendencias)].join(", ")}.`);
      else toast.success("Atividade criada.");
      fechar();
      navigate({ to: "/chamados/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui criar a atividade.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  const rotulo: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const entrada: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 13px",
    background: isLight ? "#ffffff" : "#1b1b1b",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const bt = (ativo: boolean, cor?: any): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, cor),
    padding: "9px 13px", borderRadius: 10, fontSize: 12,
  });
  const chipPessoa: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 8px 4px 5px", borderRadius: 999,
    background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.10)",
    fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: textPrimary,
  };
  const nomeDe = (id: string) => pessoasPorId[id]?.nome ?? "Alguém";

  const subtitulo = modoPlantao
    ? "O que aconteceu fora do expediente. Isto não vira chamado."
    : !podeAbrirChamado
      ? "Chamado, quem abre é o SAC e a gestão. O que se registra por aqui é o plantão."
    : !pronto
      ? "Duas perguntas decidem o resto: o tipo de demanda e quem é o responsável."
      : ehProposta
        // R259: a proposta não ganha subtítulo — a tela abaixo já diz o que
        // ela pede, em três colunas numeradas.
        ? ""
        : ehTecnico
          ? "Responsável da equipe Técnica — o chamado é de campo, com cliente, sistema e agenda."
          : `${TIPO_LABEL[tipo!]} · ${equipeDoResponsavel ? EQUIPE_LABEL[equipeDoResponsavel] : "sem equipe no cadastro"}`;

  return (
    <div
      onClick={fechar}
      role="dialog"
      aria-modal="true"
      aria-label="Nova atividade"
      style={{
        position: "fixed", inset: 0, zIndex: 100, padding: 20,
        background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...card(isLight), padding: 18, width: "100%",
          // R138: "o campo se expande para tela inteira" — pequeno enquanto só
          // pergunta, largo quando o corpo entra
          maxWidth: pronto || modoPlantao ? "min(1120px, 96vw)" : 620,
          maxHeight: "92vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 14,
          transition: "max-width .25s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ListPlus size={17} color={gold} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: textPrimary }}>
              {modoPlantao ? "Atendimento de plantão" : "Nova atividade"}
            </div>
            {/* R259: a proposta não tem subtítulo, e o que não tem texto não
                vira elemento. MEDIDO: um <div> vazio não gera caixa de linha,
                então ele não empurrava nada — a altura da fileira dá 32px com
                ou sem ele, e o título continua centrado no ícone. Ou seja,
                isto NÃO conserta um espaço perdido: conserta a marcação, que
                não deve declarar um parágrafo que não existe (o leitor de
                tela e o próximo que ler o código agradecem). */}
            {subtitulo ? (
              <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
                {subtitulo}
              </div>
            ) : null}
          </div>
          <button
            onClick={fechar}
            aria-label="Fechar"
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: "pointer",
              background: "transparent", color: textSecondary,
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {modoPlantao ? (
          <PainelDePlantao euId={euId} opcoesPessoas={opcoesPessoas} aoFechar={fechar} />
        ) : !podeAbrirChamado ? (
          /* R163 (Davi, 04/09/2026): "O técnico de campo não pode abrir chamado
             sozinho, vamos manter assim por enquanto." As duas perguntas não
             aparecem para ele; sobra a porta do plantão, que sempre foi dele. */
          <div style={{
            display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", borderRadius: 14,
            background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
          }}>
            <span style={{ fontFamily: FONT, fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>
              Abrir chamado é tarefa do SAC e da gestão — o chamado chega a você pela programação.
              O que você registra por aqui é o <strong>atendimento de plantão</strong>.
            </span>
            <button
              type="button"
              onClick={() => setModoPlantao(true)}
              style={{ ...goldButton(), padding: "11px 20px", borderRadius: 12, fontSize: 12.5, alignSelf: "flex-start" }}
            >
              Registrar atendimento de plantão
            </button>
          </div>
        ) : (
          <>
            {/* ── AS DUAS PERGUNTAS (R138) ─────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
              <div>
                <label style={rotulo}>Qual o tipo de demanda?</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TIPOS_DE_DEMANDA.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tipo === t}
                      style={bt(tipo === t, TIPO_CORES[t])}
                      onClick={() => setTipo(t)}
                    >
                      {TIPO_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={rotulo}>Quem é o responsável?</label>
                <CampoComBusca
                  id="nova-responsavel"
                  opcoes={opcoesPessoas}
                  valor={responsavelId}
                  aoMudar={setResponsavelId}
                  placeholder="Quem faz"
                  iconeEsquerda={(esc) => esc
                    ? <AvatarCirculo id={esc.valor} nome={esc.rotulo} pessoa={pessoasPorId[esc.valor]} tamanho={18} />
                    : null}
                />
                {responsavelId && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>Equipe:</span>
                    {equipeDoResponsavel ? (
                      <span style={{
                        padding: "2px 8px", borderRadius: 999,
                        fontFamily: FONT, fontWeight: 600, fontSize: 10.5,
                        ...etiqueta(equipeCores(equipeDoResponsavel)),
                      }}>
                        {EQUIPE_LABEL[equipeDoResponsavel]}
                      </span>
                    ) : (
                      <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                        sem equipe no cadastro
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── O CORPO, decidido pelas duas respostas ───────────────────── */}
            {/* R214 (U117): a Proposta Comercial EXPANDE aqui, como os outros tipos —
                é o MESMO formulário da rota /gerencial/nova, embutido. O portão de
                tela é a chave da rota (gerencial.nova): a RLS de visitas_tecnicas
                não protege o INSERT, e o redirect do beforeLoad não passa por aqui. */}
            {pronto && ehProposta && (
              podeVer("gerencial.nova") !== false ? (
                <NovaVisitaTecnica
                  embutido
                  tecnicoInicial={ehTecnico ? responsavelId : null}
                  aoConcluir={() => {
                    qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
                    fechar();
                  }}
                />
              ) : (
                <span style={{ fontFamily: FONT, fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>
                  Agendar a visita de uma proposta é do Comercial e da gestão — peça a alguém com acesso.
                </span>
              )
            )}

            {pronto && !ehProposta && ehTecnico && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!(tiposDaNatureza("campo") as string[]).includes(tipo!) && (
                  <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                    "{TIPO_LABEL[tipo!]}" não é um tipo de chamado de campo — o formulário abre como corretiva; troque ali se for outro.
                  </span>
                )}
                <FormularioChamadoTecnico
                  tipoInicial={tipo!}
                  tecnicoInicial={responsavelId}
                  aoConcluir={(id) => { fechar(); navigate({ to: "/chamados/$id", params: { id } }); }}
                />
              </div>
            )}

            {pronto && !ehProposta && !ehTecnico && (
              <>
                <div className="detalhe-grid">
                  {/* coluna larga: o texto */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                    <div>
                      <label style={rotulo} htmlFor="nova-titulo">Título</label>
                      <input
                        id="nova-titulo"
                        autoFocus
                        style={entrada}
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder={tipo === "corretiva" ? "O problema apresentado" : "O que precisa ser feito"}
                      />
                      {/* R86: o título descreve o trabalho; o lugar tem campo próprio */}
                      <span style={{ display: "block", marginTop: 5, fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                        O local vai na etiqueta, não no título.
                      </span>
                    </div>
                    <div>
                      <label style={rotulo} htmlFor="nova-descricao">
                        {tipo === "corretiva" ? "Descrição do problema detectado" : "Descrição"}
                        {tipo !== "corretiva" && <span style={{ fontWeight: 400 }}> (opcional)</span>}
                      </label>
                      <textarea
                        id="nova-descricao"
                        style={{ ...entrada, height: 220, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Contexto, o que já se sabe, links… Um grupo de clientes traz o checklist para cá."
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Fotos e arquivos <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {arquivos.map((f, i) => (
                          <span key={`${f.name}-${i}`} style={{ ...chipPessoa, gap: 5 }}>
                            <FileText size={12} color={gold} />
                            <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                            <button
                              onClick={() => setArquivos((l) => l.filter((_, j) => j !== i))}
                              aria-label={`Remover ${f.name}`}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: textSecondary, padding: 0, display: "flex" }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        <input
                          ref={arquivoRef}
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const novos = Array.from(e.target.files ?? []);
                            if (novos.length) setArquivos((l) => [...l, ...novos].slice(0, 10));
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => arquivoRef.current?.click()}
                          style={{ ...bt(false), display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Paperclip size={13} /> Anexar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* coluna estreita: as propriedades */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                    <div>
                      <label style={rotulo}>Cliente <span style={{ fontWeight: 400 }}>(um ou mais)</span></label>
                      {/* R151: mais de um cliente na mesma atividade — chips, como o
                          Apoio. O primeiro é o principal; um grupo entra como etiqueta
                          e traz o checklist (R143). Nada escolhido = interno. */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {locais.length === 0 && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 12, color: textSecondary }}>
                            <Building2 size={13} /> Interno — Prever
                          </span>
                        )}
                        {locais.map((v) => (
                          <span key={v} style={{ ...chipPessoa, paddingLeft: 8 }}>
                            {setorDoValor(v) ? <Layers size={13} /> : <Building2 size={13} />}
                            {rotuloDoLocal(v)}
                            <button
                              type="button"
                              onClick={() => setLocais((l) => l.filter((x) => x !== v))}
                              aria-label={`Remover ${rotuloDoLocal(v)}`}
                              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 2, display: "flex" }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                        <div style={{ minWidth: 180, flex: 1 }}>
                          <CampoComBusca
                            id="nova-cliente"
                            compacto
                            limpavel={false}
                            opcoes={opcoesClientes.filter((o) => !locais.includes(o.valor))}
                            valor={null}
                            aoMudar={escolherCliente}
                            placeholder={locais.length === 0 ? "+ cliente ou grupo (ou deixe interno)" : "+ outro cliente ou grupo"}
                          />
                        </div>
                      </div>
                    </div>
                    {temImpacto(tipo) && (
                      <div>
                        <label style={rotulo}>Impacto operacional</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {IMPACTO_ORDEM.map((i) => (
                            <button
                              key={i}
                              type="button"
                              aria-pressed={impacto === i}
                              style={bt(impacto === i, IMPACTO_CORES[i])}
                              onClick={() => setImpacto(impacto === i ? null : i)}
                            >
                              {IMPACTO_LABEL[i]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* R232 (U120), Davi: "os itens PRAZO / AGENDAR PARA devem
                        ter design estratégico de acordo com o design system,
                        quero que fique mais claro que é um ou outro."
                        Eram dois campos de data empilhados, um deles cinza
                        quando o outro tinha valor — o "ou" ficava por conta de
                        quem lesse a legenda. Agora é UMA pergunta ("quando?"),
                        com dois botões de seleção (botaoSelecao, o mesmo par
                        do tipo e do impacto acima) e UM campo de data: a
                        escolha é o botão, e trocar de botão apaga a outra data.
                        Nenhum dos dois é obrigatório — "sem data" é o estado
                        inicial e continua alcançável pelo botão aceso. */}
                    <div>
                      <label style={rotulo}>Quando <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                      <CampoQuando
                        idBase="nova"
                        prazo={prazo}
                        agendado={agendarPara}
                        aoMudar={({ prazo: p, agendado: a }) => { setPrazo(p); setAgendarPara(a); }}
                        estiloEntrada={entrada}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Apoio <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {apoios.map((pid) => (
                          <span key={pid} style={chipPessoa}>
                            <AvatarCirculo id={pid} nome={nomeDe(pid)} pessoa={pessoasPorId[pid]} tamanho={18} />
                            {nomeDe(pid)}
                            <button
                              onClick={() => setApoios((a) => a.filter((x) => x !== pid))}
                              aria-label={`Remover ${nomeDe(pid)} do apoio`}
                              style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, padding: 2, display: "flex" }}
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                        <div style={{ minWidth: 160, flex: 1 }}>
                          <CampoComBusca
                            id="nova-apoio"
                            compacto
                            limpavel={false}
                            placeholder="+ adicionar apoio"
                            opcoes={opcoesPessoas.filter((o) => o.valor !== responsavelId && !apoios.includes(o.valor))}
                            valor={null}
                            aoMudar={(v) => { if (v) setApoios((a) => [...a, v]); }}
                          />
                        </div>
                      </div>
                    </div>
                    {tipo === "implantacao" && (
                      <div>
                        <label style={rotulo}>Proposta comercial aprovada</label>
                        <CampoComBusca
                          id="nova-proposta"
                          opcoes={opcoesPropostas}
                          valor={propostaId}
                          aoMudar={setPropostaId}
                          vazio="— nenhuma vinculada —"
                          placeholder="A proposta que origina esta implantação"
                        />
                        <span style={{ display: "block", marginTop: 5, fontFamily: FONT, fontSize: 11, color: textSecondary, lineHeight: 1.4 }}>
                          Só as propostas já enviadas aparecem. A leitura da proposta para montar as atividades vem depois.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={criar}
                    disabled={salvando || !titulo.trim()}
                    style={{
                      ...goldButton(),
                      padding: "11px 20px", borderRadius: 12, fontSize: 12.5,
                      opacity: salvando || !titulo.trim() ? 0.55 : 1,
                      cursor: salvando || !titulo.trim() ? "default" : "pointer",
                    }}
                  >
                    {salvando ? "Criando…" : "Criar atividade"}
                  </button>
                </div>
              </>
            )}

            {/* R231 (U120): o atalho do plantão saiu daqui — pedido do Davi em
                08/09/2026, a frase dele está na R231 do PRODUTO. Ele ficava
                neste ponto, sublinhado, para quem ABRE chamado — e abrir
                chamado é o assunto desta tela; o plantão é registro de outra
                coisa (R117) e virava ruído no fim de um formulário longo. A
                porta do plantão continua existindo para quem a usa de verdade:
                o técnico de campo, que não abre chamado (R163) e cai no bloco
                acima, onde aquele botão é a única ação da tela. */}
          </>
        )}
      </div>
    </div>
  );
}
