import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Check, Camera, Square, CheckSquare, Building2, Home, Warehouse, Camera as CameraIcon, Lock, Phone, Bell, Zap, Eye, DoorOpen, Wrench, Settings, Video, Shield, Satellite, Radio, Briefcase } from "lucide-react";
import type { ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SERVICOS_PROPOSTOS,
  validarServicosPropostos,
  SERVICOS_INDISPONIVEIS_RESIDENCIA,
  type ServicoPropostoKey,
} from "@/features/visitas/servicosPropostos";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useClientes,
  criarCliente,
  atualizarCliente,
  acharClienteEquivalente,
  baixarFachadaComoArquivo,
  type Cliente,
} from "@/features/clientes/data";
import { geocode } from "@/features/gerencial/data";
import { FONT, card, botaoSelecao, goldButton, GOLD_GRAD } from "@/lib/ui";
import { PRISMA, cinzas, misturar } from "@/lib/paleta";
import { SeletorDeOpcao } from "@/components/SeletorDeOpcao";

export const Route = createFileRoute("/_authenticated/gerencial/nova")({
  component: NovaVisitaPage,
});

// A paleta local `L` (um segundo tema claro só desta tela) e o "vidro dourado"
// dos campos no escuro SAÍRAM na U107 (R194): a tela passou a falar o design
// system — card(isLight), cinzas(isLight), botaoSelecao, goldButton. Um design
// system por tela era o anti-padrão que a skill de designer nomeia primeiro.


const TIPOS_LOCAL: { id: string; label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: "condominio_vertical", label: "Cond. Vertical", Icon: Building2 },
  { id: "condominio_horizontal", label: "Cond. Horizontal", Icon: Home },
  { id: "empresa", label: "Galpão", Icon: Warehouse },
  { id: "residencia", label: "Residência", Icon: (props) => <Home {...props} strokeWidth={1.5} /> },
];

const SERVICO_PROPOSTO_ICON: Record<string, ComponentType<{ size?: number }>> = {
  controle_acesso: Lock,
  portaria_remota: Building2,
  monitoramento_24h: Eye,
  cftv: CameraIcon,
  alarmes: Bell,
  totem_monitoramento: Satellite,
  cerca_eletrica: Zap,
  // legadas (visitas antigas)
  monitoramento_alarmes: Eye,
  implantacao_controle_acesso: Lock,
  implantacao_cftv: CameraIcon,
  implantacao_alarmes: Bell,
  manutencao_alarmes: Wrench,
  manutencao_controle_acesso: Settings,
  manutencao_cftv: Video,
  implantacao_cerca_eletrica: Zap,
  manutencao_cerca_eletrica: Zap,
  gestao_portaria_presencial: Briefcase,
  portaria_virtual_24h: Shield,
  cftv_cameras: CameraIcon,
  interfone_ip: Phone,
  alarme_sensores: Bell,
  monitoramento_remoto: Radio,
  automacao_portoes: DoorOpen,
};


function NovaVisitaPage() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [nomePredio, setNomePredio] = useState("");
  const [tipoLocal, setTipoLocal] = useState("");
  // Vínculo com o cadastro de clientes (Etapa 1 do sistema de OS)
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [sincronizarCliente, setSincronizarCliente] = useState(true);
  // Residência/Galpão: não têm síndico/zelador — usa proprietário/encarregado(a)
  const isResidenciaOuGalpao = tipoLocal === "residencia" || tipoLocal === "empresa";
  const labelResponsavel1 = isResidenciaOuGalpao ? "Proprietário" : "Síndico";
  const labelResponsavel2 = isResidenciaOuGalpao ? "Encarregado(a)" : "Zelador(a)";

  const [nomeSindico, setNomeSindico] = useState("");
  const [telefoneSindico, setTelefoneSindico] = useState("");
  const [emailSindico, setEmailSindico] = useState("");
  const [nomeZelador, setNomeZelador] = useState("");
  const [telefoneZelador, setTelefoneZelador] = useState("");
  const [emailZelador, setEmailZelador] = useState("");
  const [servicos, setServicos] = useState<string[]>([]);
  const [servicosPropostos, setServicosPropostos] = useState<string[]>([]);
  const [endereco, setEndereco] = useState("");

  const [complemento, setComplemento] = useState("");
  const [obsAgendamento, setObsAgendamento] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  /**
   * O QUE O MAPA ENTENDEU — U84.
   *
   * `setGeoStatus("ok")` afirmava "ok" sobre algo que ninguém tinha lido: o
   * `geocode()` devolve `bairro/cidade/uf/display_name` desde a U84,
   * explicitamente para um humano CONFERIR, e esta tela pegava `lat`/`lng` e
   * descartava o resto. O campo é uma linha de texto livre ("Rua, número,
   * bairro"), e texto livre é como se erra de cidade — a coordenada errada
   * entra no cadastro do cliente por `consolidarGrupo` e passa a ser o lugar
   * dele no mapa de clientes, para sempre, em silêncio, sem nada que a
   * reconfira. Nenhuma requisição a mais: o dado já chegava e estava sendo
   * jogado fora.
   */
  const [resolvido, setResolvido] = useState<string | null>(null);

  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [tecnicoId, setTecnicoId] = useState("");
  // Prioridade não é mais escolhida na criação — a coluna tem DEFAULT 'normal' no banco
  const prioridade = "normal";
  const [descricao, setDescricao] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // ── Estilos do design system (R194, U107) — nenhuma paleta local ────────────
  const cz = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;
  /** o card de cada bloco do formulário */
  const SECAO: CSSProperties = { ...card(isLight), padding: 16 };
  /** micro-rótulo de campo (DESIGN_SYSTEM §6.2) */
  const LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.10em",
    textTransform: "uppercase", color: cz.textoSecundario, marginBottom: 8, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", background: cz.campo, border: `1px solid ${cz.divisoria}`, borderRadius: 12,
    color: cz.texto, fontFamily: FONT, fontWeight: 500, fontSize: 14, padding: "11px 13px",
    outline: "none", boxSizing: "border-box", colorScheme: isLight ? "light" : "dark",
  };
  /** botão secundário pequeno (desvincular, atalhos de data, localizar) */
  const BOTAO_SEC: CSSProperties = {
    height: 34, padding: "0 12px", borderRadius: 10, background: cz.campo,
    border: `1px solid ${cz.divisoria}`, color: cz.texto, cursor: "pointer",
    fontFamily: FONT, fontSize: 11.5, fontWeight: 600, flexShrink: 0,
  };

  // ── Cadastro de clientes: seleção e preenchimento automático ──────────────
  const { data: clientes = [] } = useClientes();
  const clienteSelecionado = clientes.find((c) => c.id === clienteId) ?? null;
  const clientesFiltrados = (() => {
    const termo = buscaCliente
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!termo) return [];
    return clientes.filter((c) =>
      `${c.nome} ${c.endereco ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(termo),
    );
  })();

  /** true quando algum dado da visita difere do cadastro vinculado. */
  const clienteDivergente = !!clienteSelecionado && (
    (clienteSelecionado.nome_predio || clienteSelecionado.nome) !== nomePredio ||
    (clienteSelecionado.endereco ?? "") !== endereco ||
    (clienteSelecionado.complemento ?? "") !== complemento ||
    (clienteSelecionado.nome_sindico ?? "") !== nomeSindico ||
    (clienteSelecionado.telefone_sindico ?? "") !== telefoneSindico ||
    (clienteSelecionado.email_sindico ?? "") !== emailSindico ||
    (clienteSelecionado.nome_zelador ?? "") !== nomeZelador ||
    (clienteSelecionado.telefone_zelador ?? "") !== telefoneZelador ||
    (clienteSelecionado.email_zelador ?? "") !== emailZelador
  );

  /** Ao escolher um cliente, herda os dados dele nos campos da visita. */
  function aplicarCliente(c: Cliente) {
    setClienteId(c.id);
    setBuscaCliente("");
    setNomePredio(c.nome_predio || c.nome);
    if (c.tipo_local) setTipoLocal(c.tipo_local);
    if (c.endereco) setEndereco(c.endereco);
    if (c.complemento) setComplemento(c.complemento);
    // AS GUARDAS SAÍRAM, E ERA A ASSIMETRIA DELAS QUE ERA O DEFEITO. O endereço
    // é SUBSTITUÍDO pelo do cliente; a coordenada só era substituída quando o
    // cliente TINHA uma. Vincular um cliente sem coordenada depois de ter
    // buscado o endereço digitado deixava lat/lng da BUSCA anterior no estado —
    // e `submeter()` os manda em `dadosDoCliente` para `atualizarCliente`: o
    // cliente ganhava a coordenada de um endereço que não é o dele. O gatilho da
    // U84 não pega (`NEW.endereco` é igual a `OLD.endereco`, veio do próprio
    // cliente, e a perna 1 é falsa). `resolvido` ia junto no descuido: a tela
    // continuava dizendo "O mapa entendeu: ⟨Guarulhos⟩" sobre o endereço do
    // cliente recém-vinculado. Herdar o cliente é herdar TAMBÉM a ausência.
    setLat(c.latitude ?? null);
    setLng(c.longitude ?? null);
    setResolvido(null);
    setGeoStatus(c.latitude != null && c.longitude != null ? "ok" : "idle");
    if (c.nome_sindico) setNomeSindico(c.nome_sindico);
    if (c.telefone_sindico) setTelefoneSindico(c.telefone_sindico);
    if (c.email_sindico) setEmailSindico(c.email_sindico);
    if (c.nome_zelador) setNomeZelador(c.nome_zelador);
    if (c.telefone_zelador) setTelefoneZelador(c.telefone_zelador);
    if (c.email_zelador) setEmailZelador(c.email_zelador);
    // R147 (U96): a fachada do cliente vem junto — como ARQUIVO, para seguir
    // pelo mesmo caminho de upload da foto tirada na hora. Quem já escolheu
    // uma foto não a perde: só preenche o que está vazio.
    if (c.foto_fachada_url && !fotoFile) {
      void baixarFachadaComoArquivo(c.foto_fachada_url).then((f) => {
        if (!f) return;
        setFotoFile(f);
        setFotoPreview(URL.createObjectURL(f));
      });
    }
  }

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .eq("cargo", "tecnico")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: visitasTecnico = [] } = useQuery({
    queryKey: ["visitas-tecnico", tecnicoId],
    queryFn: async () => {
      if (!tecnicoId) return [];
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 1);
      const fim = new Date();
      fim.setDate(fim.getDate() + 7);
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("data_hora_agendada, titulo, nome_predio")
        .eq("tecnico_id", tecnicoId)
        .eq("status", "pendente")
        .gte("data_hora_agendada", inicio.toISOString())
        .lte("data_hora_agendada", fim.toISOString())
        .order("data_hora_agendada");
      return data ?? [];
    },
    enabled: !!tecnicoId,
  });

  // A TERCEIRA CÓPIA INLINE DE NOMINATIM, APAGADA NA U84 — e esta era a pior
  // das quatro: ela GRUDAVA ", São Paulo, Brasil" no fim do endereço digitado.
  // Isso não é um padrão, é um chute com cara de conveniência: um endereço em
  // Bertioga (a base tem um) ou em Porto Seguro (a base tem outro) era
  // silenciosamente reancorado na capital, e a visita nascia com a coordenada
  // de uma rua homônima a 200 km de onde o técnico ia. É exatamente o modo de
  // falha que esta entrega existe para não repetir: um número plausível que
  // ninguém sabe distinguir de um certo.
  const geocodificar = async () => {
    if (!endereco.trim()) return;
    setGeoStatus("loading");
    const r = await geocode(endereco.trim());
    if (r) {
      setLat(r.lat);
      setLng(r.lng);
      setResolvido(
        r.display_name || [r.bairro, r.cidade, r.uf].filter(Boolean).join(", ") || null,
      );
      setGeoStatus("ok");
    } else {
      setResolvido(null);
      setGeoStatus("err");
    }
  };

  const formularioValido =
    nomePredio.trim() !== "" &&
    tipoLocal !== "" &&
    servicosPropostos.length > 0 &&
    endereco.trim() !== "";

  const criarMutation = useMutation({
    mutationFn: async () => {
      const dataHoraAgendada = data && hora ? new Date(`${data}T${hora}:00`).toISOString() : null;
      const { data: { user } } = await supabase.auth.getUser();

      // Cliente do cadastro mestre: usa o selecionado ou cria um completo
      // (com endereço e contatos) — não mais uma linha descartável por visita.
      const dadosDoCliente = {
        nome: nomePredio,
        nome_predio: nomePredio,
        tipo_local: tipoLocal || null,
        endereco,
        complemento: complemento || null,
        // NÃO MANDAR O QUE NÃO SE SABE. Este objeto vai para `atualizarCliente`
        // no cadastro MESTRE quando um equivalente é achado — e `lat`/`lng`
        // nascem `null` (:110-111). Enquanto existia `onBlur={geocodificar}` no
        // campo de endereço eles se preenchiam sozinhos; a U84 tirou aquele
        // onBlur (a geocodificação passou a ser um gesto com conferência), e
        // sem esta guarda o UPDATE sairia com `latitude = NULL` sobre um
        // cliente da planilha oficial da U24, cujo endereço nem mudou.
        // O gatilho da U84 NÃO salva esse caso: ele zera quando o endereço
        // muda, e aqui o endereço é idêntico (é o que faz `acharClienteEquivalente`
        // casar). Perda silenciosa e permanente, com o portão da migration
        // verde — porque o app a rompe uma camada ACIMA do gatilho.
        // Não nomear a coluna é o que devolve a decisão ao banco: endereço
        // igual, nada é tocado; endereço mudou, o gatilho zera.
        ...(lat != null && lng != null ? { latitude: lat, longitude: lng } : {}),
        email: emailSindico || null,
        telefone: telefoneSindico || null,
        nome_sindico: nomeSindico || null,
        telefone_sindico: telefoneSindico || null,
        email_sindico: emailSindico || null,
        nome_zelador: nomeZelador || null,
        telefone_zelador: telefoneZelador || null,
        email_zelador: emailZelador || null,
      };

      let clienteIdFinal = clienteId;
      if (clienteIdFinal) {
        // Cliente vinculado: se o gestor corrigiu algo aqui, o cadastro
        // acompanha — senão a OS leria o dado velho na ficha do cliente.
        if (sincronizarCliente && clienteDivergente) {
          await atualizarCliente(clienteIdFinal, dadosDoCliente);
        }
      } else {
        // Sem vínculo: reaproveita um cadastro equivalente (mesmo nome e
        // endereço) em vez de criar um duplicado.
        const equivalente = acharClienteEquivalente(clientes, nomePredio, endereco);
        if (equivalente) {
          clienteIdFinal = equivalente.id;
          await atualizarCliente(equivalente.id, dadosDoCliente);
        } else {
          // SEM `situacao`, E A DELEÇÃO CONSERTA UM DEFEITO VIVO. Esta linha
          // gravava `situacao: 'prospecto'` — valor que a U27 APAGOU do CHECK
          // (`clientes_situacao_check` aceita só 'ativo' e 'inativo', u27:218).
          // Todo cadastro de prédio novo por esta tela batia em 23514 e
          // derrubava a criação da visita inteira, que é a mesma mutação.
          // O `tsc` já acusava (TS2322: '"prospecto"' não é `SituacaoCliente`),
          // e o erro estava escondido dentro do baseline de 78 — um defeito de
          // produção morando numa contagem que a casa aprendeu a não olhar.
          // Não é escolher entre duas saídas: a R21/R22 fechou 'prospecto' com
          // argumento, e `SITUACAO_LABEL['prospecto']` é `undefined` em toda
          // tela que renderize o valor. Sem a chave, vale o DEFAULT 'ativo'.
          clienteIdFinal = await criarCliente(dadosDoCliente);
        }
      }

      let foto_fachada_url: string | null = null;
      if (fotoFile) {
        const ext = fotoFile.name.split(".").pop() || "jpg";
        const path = `visitas/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("visita-fotos")
          .upload(path, fotoFile, { upsert: true });
        if (upErr) {
          toast.error("Erro ao enviar foto: " + upErr.message);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("visita-fotos")
            .getPublicUrl(path);
          foto_fachada_url = publicUrl;
        }
      }

      const payload = {
        cliente_id: clienteIdFinal,
        titulo: nomePredio,
        nome_predio: nomePredio,
        tipo_local: tipoLocal,
        nome_sindico: nomeSindico || null,
        telefone_sindico: telefoneSindico || null,
        email_sindico: emailSindico || null,
        nome_zelador: nomeZelador || null,
        telefone_zelador: telefoneZelador || null,
        email_zelador: emailZelador || null,
        contato_sindico: telefoneSindico || null,


        servicos_solicitados: servicos,
        servicos_propostos: servicosPropostos,
        servico_solicitado: servicos[0] ?? null,
        endereco,
        complemento: complemento || null,
        obs_agendamento: obsAgendamento || null,
        descricao_pedido: descricao || null,
        data_hora_agendada: dataHoraAgendada,
        tecnico_id: tecnicoId || null,
        prioridade,
        status: "pendente",
        latitude: lat,
        longitude: lng,
        foto_fachada_url,
        created_by: user?.id ?? null,
      };
      const { error } = await supabase.from("visitas_tecnicas").insert(payload as any);
      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gerencial-visitas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-visitas"] });
      toast.success("Visita agendada com sucesso!");
      navigate({ to: "/gerencial" });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  // `!= null`, e não teste de veracidade: latitude 0 é uma coordenada (o Golfo
  // da Guiné) e cairia como ausente num `&&`. É o mesmo padrão de `VisitaForm`.
  const mapUrl =
    lat != null && lng != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.008}%2C${lng + 0.008}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;

  // ── O que falta para agendar — dito na tela, não só no toast (R194) ────────
  const faltam = [
    !nomePredio.trim() && "o nome do prédio",
    !tipoLocal && "o tipo de local",
    servicosPropostos.length === 0 && "pelo menos um serviço proposto",
    !endereco.trim() && "o endereço",
  ].filter((x): x is string => !!x);

  return (
    <div className="sangra-x" style={{ paddingTop: 14, paddingBottom: 40, color: cz.texto }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => navigate({ to: "/gerencial" })}
          aria-label="Voltar ao Painel Comercial"
          style={{ background: "none", border: "none", cursor: "pointer", color: cz.textoSecundario, padding: 4, display: "flex" }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.01em" }}>
            Nova Visita Técnica
          </h1>
          <div style={{ fontFamily: FONT, fontSize: 12, color: cz.textoSecundario, marginTop: 2 }}>
            O local, os contatos e o agendamento numa tela só. A visita nasce pendente; a proposta
            é outra atividade, que nasce quando ela é feita (R170).
          </div>
        </div>
      </div>

      {/* R194 (U107): as duas etapas viraram TRÊS COLUNAS na mesma tela — local ·
          contatos e serviços · agendamento. No celular, uma embaixo da outra,
          na mesma ordem (classe .nova-visita-colunas em styles.css). */}
      <div className="nova-visita-colunas">

        {/* ══ 1 · LOCAL ═══════════════════════════════════════════════════════ */}
        <section aria-labelledby="nv-local" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <TituloDaColuna n={1} id="nv-local" titulo="Local" sub="Quem é e onde fica" />

          {/* Cliente: vincula a visita ao cadastro (Etapa 1 do sistema de OS).
              Antes, cada visita criava um cliente novo e descartável. R147: ao
              escolher, a visita herda os dados e a fachada do cadastro. */}
          <div style={SECAO}>
            <label style={LABEL}>Cliente</label>
            {clienteSelecionado ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Building2 size={18} color={gold} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: cz.texto }}>
                    {clienteSelecionado.nome}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: cz.textoSecundario }}>
                    {clienteSelecionado.endereco ?? "sem endereço no cadastro"}
                  </div>
                </div>
                <button onClick={() => { setClienteId(null); setBuscaCliente(""); }} style={BOTAO_SEC}>
                  Desvincular
                </button>
              </div>
            ) : null}
            {clienteSelecionado && clienteDivergente && (
              <button
                onClick={() => setSincronizarCliente((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 12,
                  background: "transparent", border: "none", padding: 0, cursor: "pointer",
                  textAlign: "left", color: cz.textoSecundario,
                }}
              >
                {sincronizarCliente ? (
                  <CheckSquare size={16} color={gold} style={{ flexShrink: 0 }} />
                ) : (
                  <Square size={16} style={{ flexShrink: 0 }} />
                )}
                <span style={{ fontFamily: FONT, fontSize: 11 }}>
                  Atualizar o cadastro do cliente com os dados desta visita
                </span>
              </button>
            )}
            {!clienteSelecionado && (
              <>
                <input
                  style={INPUT}
                  placeholder="Buscar cliente já cadastrado…"
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                />
                {buscaCliente.trim() !== "" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {clientesFiltrados.length === 0 ? (
                      <span style={{ fontFamily: FONT, fontSize: 12, color: cz.textoSecundario }}>
                        Nenhum cliente encontrado — os dados preenchidos abaixo criarão um cadastro novo.
                      </span>
                    ) : (
                      clientesFiltrados.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          // A SEGUNDA PORTA DA CORRIDA, e ela é só desta tela.
                          // Travar o campo de endereço durante a busca não basta
                          // aqui: escolher um cliente da lista TAMBÉM troca o
                          // endereço (`aplicarCliente`), e a resposta em voo
                          // chegaria depois, escrevendo a coordenada do endereço
                          // ANTIGO por cima do cliente recém-escolhido — com a
                          // frase "O mapa entendeu" descrevendo um lugar que não
                          // é mais o da tela. As outras três telas não têm este
                          // caminho; por isso a trava delas fechava e a daqui não.
                          disabled={geoStatus === "loading"}
                          onClick={() => aplicarCliente(c)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                            padding: "10px 12px", borderRadius: 10, textAlign: "left",
                            cursor: geoStatus === "loading" ? "wait" : "pointer",
                            opacity: geoStatus === "loading" ? 0.6 : 1,
                            background: cz.campo, border: `1px solid ${cz.divisoria}`, color: cz.texto,
                          }}
                        >
                          <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13 }}>{c.nome}</span>
                          <span style={{ fontFamily: FONT, fontSize: 11, color: cz.textoSecundario }}>
                            {c.endereco ?? "sem endereço"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <div style={{ fontFamily: FONT, fontSize: 11, color: cz.textoSecundario, marginTop: 8 }}>
                  Deixe em branco para cadastrar um cliente novo com os dados desta visita.
                </div>
              </>
            )}
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Nome do Prédio / Empresa</label>
            <input style={INPUT} placeholder="Ex: Edifício Garden Hills" value={nomePredio} onChange={(e) => setNomePredio(e.target.value)} />
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Tipo de Local</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
              {TIPOS_LOCAL.map((t) => {
                const ativo = tipoLocal === t.id;
                return (
                  <button
                    key={t.id}
                    aria-pressed={ativo}
                    onClick={() => {
                      setTipoLocal(t.id);
                      // Residência não aceita Controle de Acesso/Portaria — remove se já marcado
                      if (t.id === "residencia") {
                        setServicosPropostos((prev) =>
                          prev.filter((k) => !SERVICOS_INDISPONIVEIS_RESIDENCIA.includes(k as ServicoPropostoKey)),
                        );
                      }
                    }}
                    style={{
                      // o botão de seleção do design system, sem o brilho (R174)
                      ...botaoSelecao(ativo, isLight, null), boxShadow: "none",
                      borderRadius: 12, padding: "14px 8px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    }}
                  >
                    <span style={{ display: "inline-flex", color: ativo ? "#08090E" : cz.textoSecundario }}>
                      <t.Icon size={24} />
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Endereço</label>
            <div style={{ display: "flex", gap: 8 }}>
              {/* TRAVADO ENQUANTO A BUSCA ESTÁ NO AR: editar o texto durante a
                  requisição deixaria a resposta do endereço ANTIGO chegar
                  depois e reescrever `resolvido`/`lat`/`lng` por cima do NOVO —
                  a mesma coordenada errada de sempre, agora por CORRIDA. */}
              <input
                style={{ ...INPUT, flex: 1 }}
                placeholder="Rua, número, bairro"
                value={endereco}
                disabled={geoStatus === "loading"}
                onChange={(e) => {
                  setEndereco(e.target.value);
                  setLat(null);
                  setLng(null);
                  setResolvido(null);
                  setGeoStatus("idle");
                }}
              />
              {/* O `onBlur={geocodificar}` SAIU AQUI (U84). Ele disparava uma
                  requisição ao Nominatim toda vez que o cursor deixava o campo
                  — corrigir um dígito e sair era outra requisição, e passar o
                  Tab pelo formulário disparava sem ninguém ter digitado nada.
                  A regra passou a ser: um gesto humano explícito = no máximo
                  uma requisição. O gesto explícito é o botão ao lado. E ELE TEM
                  `disabled`, como os das outras TRÊS telas: N cliques
                  impacientes não viram N requisições ao Nominatim. */}
              <button
                onClick={geocodificar}
                disabled={geoStatus === "loading"}
                aria-label="Localizar o endereço no mapa"
                title="Localizar no mapa"
                style={{
                  ...BOTAO_SEC, height: "auto", width: 44, padding: 0, color: gold,
                  cursor: geoStatus === "loading" ? "wait" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <MapPin size={16} />
              </button>
            </div>
            {geoStatus === "loading" && (
              <p style={{ marginTop: 8, fontSize: 11, color: cz.textoSecundario, fontFamily: FONT, margin: "8px 0 0" }}>
                Buscando localização...
              </p>
            )}
            {/* A CASCA `geocode()` COLAPSA "não achei" e "o serviço recusou" no
                mesmo `null` — o SERVIDOR distingue os dois (`nao_encontrado` ×
                `servico_falhou`) e a casca de gerencial/data.ts apaga a
                diferença. Enquanto ela apagar, esta frase NÃO PODE afirmar que
                o endereço não existe: o bloqueio do Nominatim é por IP e cai
                sobre a operação inteira, e "endereço não encontrado" é a única
                frase do sistema que instrui a pessoa a martelar o serviço que
                acabou de bloqueá-la. */}
            {geoStatus === "err" && (
              <p style={{ fontSize: 11, color: vermelho, fontFamily: FONT, margin: "8px 0 0" }}>
                Não achei este endereço. Confira o texto (bairro e cidade ajudam) — e, se ele está
                certo, o serviço de mapas pode ter recusado agora: repetir na mesma hora não adianta.
              </p>
            )}
            {/* O NOME DO LUGAR, NÃO A PALAVRA "OK". Duas coordenadas não são
                conferíveis por um humano; "Interlagos, São Paulo, SP" é. É a
                única rede contra "o mapa achou a rua homônima em outra
                cidade" — nada mais no sistema reconfere esta coordenada. */}
            {geoStatus === "ok" && resolvido && (
              <p style={{ fontSize: 11, color: cz.textoSecundario, fontFamily: FONT, margin: "8px 0 0" }}>
                O mapa entendeu: <b style={{ color: cz.texto }}>{resolvido}</b> — se não é este o lugar, corrija o endereço
                (inclua bairro e cidade) e busque de novo.
              </p>
            )}
            {mapUrl && (
              <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: `1px solid ${cz.divisoria}` }}>
                <iframe title="mapa" src={mapUrl} style={{ width: "100%", height: 160, border: 0 }} />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label style={LABEL}>Complemento</label>
              <input style={INPUT} placeholder="Apto, andar, bloco..." value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Foto da Fachada (opcional)</label>
            <div
              onClick={() => document.getElementById("foto-fachada-input")?.click()}
              style={{
                width: "100%", minHeight: fotoPreview ? "auto" : 90, borderRadius: 14,
                border: `2px dashed ${cz.divisoria}`, background: cz.campo,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", overflow: "hidden", position: "relative",
              }}
            >
              {fotoPreview ? (
                <>
                  <img src={fotoPreview} alt="preview" style={{ width: "100%", borderRadius: 12, display: "block" }} />
                  <div style={{
                    position: "absolute", top: 8, right: 8, borderRadius: 20, padding: "4px 10px",
                    background: cz.elevada, border: `1px solid ${cz.divisoria}`,
                    fontFamily: FONT, fontWeight: 600, fontSize: 11, color: cz.texto,
                  }}>
                    Alterar foto
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 8px" }}>
                  <div style={{ marginBottom: 4, display: "flex", justifyContent: "center" }}>
                    <Camera size={22} color={gold} />
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: cz.textoSecundario }}>
                    Toque para adicionar a foto da fachada
                  </div>
                </div>
              )}
            </div>
            <input
              id="foto-fachada-input"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFotoFile(file);
                setFotoPreview(URL.createObjectURL(file));
              }}
            />
          </div>
        </section>

        {/* ══ 2 · CONTATOS E SERVIÇOS ════════════════════════════════════════ */}
        <section aria-labelledby="nv-contatos" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <TituloDaColuna n={2} id="nv-contatos" titulo="Contatos e serviços" sub="Com quem falar e o que propor" />

          {/* Residência/Galpão não têm síndico/zelador — os rótulos seguem o tipo */}
          <div style={SECAO}>
            <label style={LABEL}>{labelResponsavel1} (opcional)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input style={INPUT} value={nomeSindico} onChange={(e) => setNomeSindico(e.target.value)} placeholder={`Nome do ${labelResponsavel1.toLowerCase()}`} />
              <input style={INPUT} value={telefoneSindico} onChange={(e) => setTelefoneSindico(e.target.value)} placeholder="WhatsApp — (11) 90000-0000" />
              <input style={INPUT} type="email" value={emailSindico} onChange={(e) => setEmailSindico(e.target.value)} placeholder={`E-mail do ${labelResponsavel1.toLowerCase()}`} />
            </div>
          </div>

          <div style={SECAO}>
            <label style={LABEL}>{labelResponsavel2} (opcional)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input style={INPUT} value={nomeZelador} onChange={(e) => setNomeZelador(e.target.value)} placeholder={`Nome do ${labelResponsavel2.toLowerCase()}`} />
              <input style={INPUT} value={telefoneZelador} onChange={(e) => setTelefoneZelador(e.target.value)} placeholder="WhatsApp — (11) 90000-0000" />
              <input style={INPUT} type="email" value={emailZelador} onChange={(e) => setEmailZelador(e.target.value)} placeholder={`E-mail do ${labelResponsavel2.toLowerCase()}`} />
            </div>
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Serviços Propostos (selecione um ou mais)</label>
            {tipoLocal === "residencia" && (
              <p style={{ fontFamily: FONT, fontSize: 11, color: cz.textoSecundario, margin: "0 0 8px" }}>
                Controle de Acesso e serviços de portaria não se aplicam a Residência.
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SERVICOS_PROPOSTOS
                .filter((s) => !(tipoLocal === "residencia" && SERVICOS_INDISPONIVEIS_RESIDENCIA.includes(s.key)))
                .map((s) => {
                const ativo = servicosPropostos.includes(s.key);
                const Ico = SERVICO_PROPOSTO_ICON[s.key];
                return (
                  <button
                    key={s.key}
                    aria-pressed={ativo}
                    onClick={() =>
                      setServicosPropostos((prev) =>
                        prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key],
                      )
                    }
                    style={{
                      ...botaoSelecao(ativo, isLight, null), boxShadow: "none",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      borderRadius: 999, padding: "7px 12px", fontSize: 11.5,
                    }}
                  >
                    {Ico && (
                      <span style={{ display: "inline-flex", alignItems: "center", color: ativo ? "#08090E" : gold }}>
                        <Ico size={13} />
                      </span>
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Descrição do Pedido</label>
            <textarea
              style={{ ...INPUT, minHeight: 110, resize: "vertical", lineHeight: 1.5 }}
              placeholder="Descreva o que o cliente precisa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </section>

        {/* ══ 3 · AGENDAMENTO ════════════════════════════════════════════════ */}
        <section aria-labelledby="nv-agendamento" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <TituloDaColuna n={3} id="nv-agendamento" titulo="Agendamento" sub="Quando e com quem" />

          <div style={SECAO}>
            <label style={LABEL}>Data e Horário (opcional)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="date"
                style={{ ...INPUT, flex: 2 }}
                value={data}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setData(e.target.value)}
              />
              <input type="time" style={{ ...INPUT, flex: 1 }} value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {[
                { label: "Amanhã 09:00", days: 1, time: "09:00" },
                { label: "Amanhã 14:00", days: 1, time: "14:00" },
                { label: "Em 2 dias 09:00", days: 2, time: "09:00" },
                { label: "Próx. Semana", days: 7, time: "09:00" },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + a.days);
                    setData(d.toISOString().split("T")[0]);
                    setHora(a.time);
                  }}
                  style={{ ...BOTAO_SEC, height: 28, borderRadius: 999, padding: "0 10px", fontSize: 11 }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div style={SECAO}>
            <label style={LABEL}>Técnico Responsável</label>
            {/* o seletor do design system (R135), não o <select> nativo */}
            <SeletorDeOpcao
              valor={tecnicoId || null}
              vazio="— Sem técnico definido —"
              opcoes={tecnicos.map((t) => ({ valor: t.id, rotulo: t.nome ?? "—" }))}
              aoMudar={(v) => setTecnicoId(v ?? "")}
            />

            {tecnicoId && visitasTecnico.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ ...LABEL, color: gold, marginBottom: 6 }}>Agenda dos próximos 7 dias</p>
                {visitasTecnico.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
                      borderBottom: i < visitasTecnico.length - 1 ? `1px solid ${cz.divisoria}` : "none",
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: gold, flexShrink: 0 }} />
                    <span style={{ fontFamily: FONT, fontSize: 11.5, color: cz.textoSecundario }}>
                      {new Date(v.data_hora_agendada!).toLocaleString("pt-BR", {
                        weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                      {" — "}
                      {(v as any).nome_predio ?? v.titulo}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {tecnicoId && visitasTecnico.length === 0 && (
              <p style={{ fontFamily: FONT, fontSize: 11.5, color: verde, margin: "8px 0 0" }}>
                Técnico livre nos próximos 7 dias
              </p>
            )}
          </div>

          {/* O RESUMO e o botão — a ação principal mora na coluna do agendamento,
              e o que falta para agendar é dito aqui, não só no toast. */}
          <div style={{ ...SECAO, border: `1px solid ${misturar(verde, cz.superficie, 0.55)}` }}>
            <p style={{ ...LABEL, color: verde }}>Resumo da visita</p>
            {[
              { label: "Prédio", value: nomePredio },
              { label: "Tipo", value: TIPOS_LOCAL.find((t) => t.id === tipoLocal)?.label ?? tipoLocal },
              ...(nomeSindico ? [{ label: labelResponsavel1, value: nomeSindico }] : []),
              ...(nomeZelador ? [{ label: labelResponsavel2, value: nomeZelador }] : []),
              { label: "Serviços", value: servicosPropostos.map((k) => SERVICOS_PROPOSTOS.find((s) => s.key === k)?.label).filter(Boolean).join(", ") },
              { label: "Endereço", value: endereco + (complemento ? ` — ${complemento}` : "") },
              {
                label: "Data/Hora",
                value: data ? `${new Date(data + "T12:00:00").toLocaleDateString("pt-BR")} às ${hora}` : "—",
              },
              { label: "Técnico", value: tecnicos.find((t) => t.id === tecnicoId)?.nome ?? "Não definido" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderBottom: `1px solid ${cz.divisoria}` }}>
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: cz.textoSecundario, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color: cz.texto, textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>
                  {row.value || "—"}
                </span>
              </div>
            ))}

            {faltam.length > 0 && (
              <p style={{ fontFamily: FONT, fontSize: 11.5, color: cz.textoSecundario, margin: "10px 0 0", lineHeight: 1.5 }}>
                Para agendar, falta {faltam.join(", ")}.
              </p>
            )}
            <button
              onClick={() => {
                if (!formularioValido) {
                  toast.error(`Para agendar, falta ${faltam.join(", ")}.`);
                  return;
                }
                criarMutation.mutate();
              }}
              disabled={criarMutation.isPending}
              style={{
                ...goldButton(), width: "100%", height: 48, marginTop: 12, borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: FONT, fontWeight: 700, fontSize: 13,
                cursor: criarMutation.isPending ? "not-allowed" : "pointer",
                opacity: criarMutation.isPending ? 0.7 : formularioValido ? 1 : 0.6,
              }}
            >
              {criarMutation.isPending ? "Agendando..." : (<>Agendar visita <Check size={17} /></>)}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** O título de cada coluna (R194): número dourado + nome + o que ela responde. */
function TituloDaColuna({ n, id, titulo, sub }: { n: number; id: string; titulo: string; sub: string }) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 0" }}>
      <span aria-hidden style={{
        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
        background: GOLD_GRAD, color: "#08090E",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT, fontWeight: 700, fontSize: 11.5,
      }}>
        {n}
      </span>
      <div style={{ minWidth: 0 }}>
        <h2 id={id} style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, margin: 0, color: c.texto }}>{titulo}</h2>
        <div style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>{sub}</div>
      </div>
    </div>
  );
}
