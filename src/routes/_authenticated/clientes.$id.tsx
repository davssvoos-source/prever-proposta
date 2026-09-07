// Ficha do cliente — o centro do cliente no sistema (R146, R200, R201).
//
// ── R201 (U111): A FICHA V2 — CABEÇALHO DE PÁGINA E DUAS COLUNAS ───────────
// Davi, 2026-09-07: "Revise toda a página do cliente, quero um design
// atualizado, layout para desktop, revise toda a página de configuração do
// cliente." E, sobre o conteúdo: "Cada página de cliente deverá ter um campo
// para os sistemas instalados. Os sistemas instalados consistem em blocos com
// equipamentos vinculados a estes blocos."
//
// A ordem da ficha é a ordem em que se trabalha o cliente:
//   · CABEÇALHO (largura toda): nome 22/700, situação, tipo de local, endereço
//     numa linha, as etiquetas de serviço prestado (que também são o controle,
//     R41/R173) e o botão de configurar.
//   · COLUNA LARGA — o LOCAL: Sistemas instalados (os blocos, R200), a fila de
//     Equipamentos a vincular (o QAP), Atividades, Plantão, Histórico de visitas.
//   · COLUNA ESTREITA — a IDENTIDADE: a fachada e os dados do local, os
//     Contatos (WhatsApp clicável), os Contratos (só quem vê financeiro) e as
//     Observações.
// A grade é a mesma da página da atividade (.detalhe-grid, R135/R146); no
// celular empilha. O modo de configuração é o ClienteForm, em duas colunas
// (.ficha-colunas) — R201.
//
// O que a R146 (U96) trouxe continua: fachada pela ficha (bucket privado),
// síndico/zelador com WhatsApp, proprietário/encarregado(a) em residência e
// galpão, o histórico com as atividades de grupo (R143) e teto declarado.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, Camera, FileText, MapPin, Pencil, Phone, Mail, Users, CalendarDays, Wrench, X, Trash2, Home,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente, useVeFinanceiro } from "@/features/gerencial/data";
import { TIPO_LABEL, whatsappLink } from "@/features/gerencial/constants";
import { getStatusInfo } from "@/lib/visita-status";
import { visitaRouteFor } from "@/lib/visita-route";
import { FONT, card, etiqueta } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { ClienteForm } from "@/features/clientes/ClienteForm";
import { InventarioCliente } from "@/features/clientes/InventarioCliente";
import { EquipamentosDoCliente } from "@/features/clientes/EquipamentosDoCliente";
import { useChamadosDoCliente } from "@/features/chamados/data";
import { useAtendimentosDoCliente, TETO_DA_LISTA as TETO_PLANTAO } from "@/features/plantao/data";
import { diaCurto, horaCurta, TIPO_LABEL as PLANTAO_TIPO_LABEL } from "@/features/plantao/modelo";
import { chamadoStatusInfo } from "@/lib/chamado-status";
import {
  useContratosDoCliente, contratoVigente,
  MODALIDADE_LABEL, STATUS_CONTRATO_LABEL, STATUS_CONTRATO_CORES,
} from "@/features/contratos/data";
import {
  useCliente,
  useVisitasDoCliente,
  useFachadaUrl,
  atualizarCliente,
  subirFachada,
  removerFachada,
  SITUACAO_LABEL,
  SITUACAO_CORES,
  SERVICO_ORDEM,
  SERVICOS_OFERECIDOS,
  SERVICO_LABEL,
  SERVICO_CORES,
  temServico,
  type ClientePatch,
} from "@/features/clientes/data";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetalhePage,
});

/**
 * Quantos chamados a ficha mostra antes do "ver todos". Antes eram 8, cortados
 * em SILÊNCIO (`slice(0, 8)` sem aviso) — uma lista cortada calada lê-se como o
 * histórico inteiro. Agora o teto é declarado, e há um botão para abrir tudo.
 */
const TETO_CHAMADOS = 12;

/** Um bloco de contato: nome, WhatsApp (abre o WhatsApp) e e-mail (abre o e-mail). */
function Contato({ rotulo, nome, whatsapp, email }: {
  rotulo: string; nome: string | null; whatsapp: string | null; email: string | null;
}) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  if (!nome && !whatsapp && !email) return null;
  const linha: CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0",
    borderTop: `1px solid ${c.divisoria}`,
  };
  const valor: CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 400, color: c.textoSecundario, textAlign: "right", minWidth: 0, wordBreak: "break-word" };
  const link: CSSProperties = { ...valor, color: gold, fontWeight: 600, textDecoration: "none" };
  const rotuloForte: CSSProperties = { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: c.texto, display: "flex", alignItems: "center", gap: 6 };
  const rotuloLeve: CSSProperties = { fontFamily: FONT, fontSize: 12, fontWeight: 400, color: c.textoSecundario, display: "flex", alignItems: "center", gap: 6 };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ ...linha, borderTop: "none", paddingTop: 10 }}>
        <span style={rotuloForte}><Users size={13} color={gold} /> {rotulo}</span>
        <span style={{ ...valor, color: c.texto, fontWeight: 600 }}>{nome ?? "—"}</span>
      </div>
      <div style={linha}>
        <span style={rotuloLeve}><Phone size={12} color={gold} /> WhatsApp</span>
        {whatsapp
          ? <a href={whatsappLink(whatsapp)} target="_blank" rel="noopener noreferrer" style={link}>{whatsapp}</a>
          : <span style={valor}>—</span>}
      </div>
      <div style={linha}>
        <span style={rotuloLeve}><Mail size={12} color={gold} /> E-mail</span>
        {email
          ? <a href={`mailto:${email}`} style={link}>{email}</a>
          : <span style={valor}>—</span>}
      </div>
    </div>
  );
}

function ClienteDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: veFinanceiro = false } = useVeFinanceiro();
  const { data: cliente, isLoading } = useCliente(id);
  const { data: visitas = [] } = useVisitasDoCliente(id);
  // R143: inclui as atividades de GRUPO a que este cliente pertence, e as em
  // que ele é local extra — não só as em que é o cliente principal
  const { data: ordens = [] } = useChamadosDoCliente(id, cliente?.servicos_prestados);
  const plantao = useAtendimentosDoCliente(id);
  const { data: contratos = [] } = useContratosDoCliente(id);
  const { data: fotoUrl } = useFachadaUrl(cliente?.foto_fachada_url);
  const [editando, setEditando] = useState(false);
  const [todosOsChamados, setTodosOsChamados] = useState(false);
  const [fotoPronta, setFotoPronta] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const c = cinzas(isLight);
  const textPrimary = c.texto;
  const textSecondary = c.textoSecundario;
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;

  // card() de lib/ui — a superfície da casa (as telas irmãs usam a mesma)
  const CARD: CSSProperties = { ...card(isLight), borderRadius: 18, padding: 16 };
  // o micro-rótulo de seção do design system (§6.2): dourado, 10,5/700, caixa alta
  const SEC_LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };
  const linha: CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "6px 0",
    borderTop: `1px solid ${c.divisoria}`,
  };
  const linhaLabel: CSSProperties = { fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: textPrimary };
  const linhaValor: CSSProperties = {
    fontFamily: FONT, fontSize: 12.5, fontWeight: 400,
    color: textSecondary, textAlign: "right", minWidth: 0, wordBreak: "break-word",
  };
  const botaoLeve: CSSProperties = {
    height: 32, padding: "0 12px", borderRadius: 10,
    background: c.campo, border: `1px solid ${c.divisoria}`,
    color: textPrimary, cursor: "pointer", flexShrink: 0,
    fontFamily: FONT, fontSize: 12, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
  };
  /** a linha clicável das listas de histórico (atividade, visita, contrato) */
  const itemLista = (corDaBorda?: string): CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    padding: "9px 12px", borderRadius: 12, cursor: "pointer",
    background: c.campo, border: `1px solid ${c.divisoria}`,
    borderLeft: corDaBorda ? `3px solid ${corDaBorda}` : `1px solid ${c.divisoria}`,
    color: textPrimary,
  });
  const chipStatus = (cor: { dark: string; light: string; bg: string }): CSSProperties => ({
    padding: "3px 8px", borderRadius: 999, flexShrink: 0,
    ...etiqueta(cor),
    fontFamily: FONT, fontWeight: 700, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase",
  });

  const salvar = useMutation({
    mutationFn: (patch: ClientePatch) => atualizarCliente(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setEditando(false);
      toast.success("Cliente atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // R146: a foto da fachada — sobe para o bucket privado e grava o caminho
  const trocarFoto = useMutation({
    mutationFn: async (arquivo: File) => {
      if (!cliente) throw new Error("Cliente ainda não carregou.");
      return subirFachada(cliente, arquivo);
    },
    onSuccess: () => {
      setFotoPronta(false);
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["fachada-url"] });
      toast.success("Foto da fachada atualizada.");
    },
    onError: (e: Error) => toast.error(e.message || "Não consegui enviar a foto. O bucket clientes-fachadas existe? (migration U96)"),
  });
  const apagarFoto = useMutation({
    mutationFn: async () => {
      if (!cliente) throw new Error("Cliente ainda não carregou.");
      return removerFachada(cliente);
    },
    onSuccess: () => {
      setFotoPronta(false);
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["fachada-url"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voltar = () => navigate({ to: "/clientes" });

  if (isLoading) {
    return (
      <div style={{ padding: "24px 0", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
        Carregando cliente…
      </div>
    );
  }
  if (!cliente) {
    return (
      <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", gap: 12, color: textPrimary }}>
        <span style={{ fontFamily: FONT, fontSize: 14 }}>Cliente não encontrado.</span>
        <button
          onClick={voltar}
          style={{
            alignSelf: "flex-start", height: 40, padding: "0 16px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)", color: "#0E0E0E",
            fontFamily: FONT, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
          }}
        >
          Voltar para clientes
        </button>
      </div>
    );
  }

  const cor = SITUACAO_CORES[cliente.situacao] ?? SITUACAO_CORES.ativo;

  // Residência e galpão não têm síndico nem zelador: é proprietário e
  // encarregado(a) — o mesmo vocabulário do formulário da proposta (R147).
  const semSindico = cliente.tipo_local === "residencia" || cliente.tipo_local === "empresa";
  const rotuloContato1 = semSindico ? "Proprietário" : "Síndico";
  const rotuloContato2 = semSindico ? "Encarregado(a)" : "Zelador(a)";
  const semContatos = !cliente.nome_sindico && !cliente.telefone_sindico && !cliente.email_sindico
    && !cliente.nome_zelador && !cliente.telefone_zelador && !cliente.email_zelador;

  const chamadosVisiveis = todosOsChamados ? ordens : ordens.slice(0, TETO_CHAMADOS);
  const enderecoCurto = [cliente.endereco, [cliente.cidade, cliente.uf].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* ══ CABEÇALHO DA PÁGINA (R201) ═══════════════════════════════════════ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <button
          onClick={editando ? () => setEditando(false) : voltar}
          aria-label={editando ? "Cancelar a configuração" : "Voltar para clientes"}
          style={{ ...botaoLeve, width: 40, height: 40, padding: 0, justifyContent: "center", borderRadius: 12, marginTop: 2 }}
        >
          {editando ? <X size={18} /> : <ArrowLeft size={18} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.01em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
            }}>
              {editando ? "Configurar cliente" : cliente.nome}
            </h1>
            {!editando && (
              <>
                <span style={chipStatus(cor)}>{SITUACAO_LABEL[cliente.situacao] ?? cliente.situacao}</span>
                {/* R146: o tipo de local sempre visível; sem ele, o aviso */}
                <span style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5,
                  color: cliente.tipo_local ? textSecondary : (isLight ? "#AD4700" : "#FA842D"),
                }}>
                  <Home size={12} />
                  {cliente.tipo_local ? (TIPO_LABEL[cliente.tipo_local] ?? cliente.tipo_local) : "tipo de local não informado"}
                </span>
              </>
            )}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {editando ? (
              <span>{cliente.nome}</span>
            ) : (
              <>
                <MapPin size={12} color={gold} style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {enderecoCurto || "endereço não informado"}
                </span>
                <span style={{ opacity: 0.6 }}>·</span>
                <span>{ordens.length} atividade{ordens.length === 1 ? "" : "s"} · {visitas.length} visita{visitas.length === 1 ? "" : "s"}</span>
              </>
            )}
          </div>

          {/* SERVIÇO PRESTADO (R41) — etiquetas que também são o controle. A
              gravação manda o ARRAY inteiro. R173: um grupo ainda não aceito
              pelo banco não se OFERECE — mas, se já estiver marcado, aparece
              (para poder ser desmarcado). */}
          {!editando && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ ...SEC_LABEL, fontSize: 9.5, color: textSecondary }}>Serviço prestado</span>
              {SERVICO_ORDEM.filter((s) => SERVICOS_OFERECIDOS.includes(s) || temServico(cliente, s)).map((s) => {
                const tem = temServico(cliente, s);
                const cs = SERVICO_CORES[s];
                return (
                  <button
                    key={s}
                    onClick={() => {
                      const atuais = (cliente.servicos_prestados ?? []) as string[];
                      const novos = tem ? atuais.filter((x) => x !== s) : [...atuais, s];
                      salvar.mutate({ servicos_prestados: novos });
                    }}
                    disabled={salvar.isPending || !isGerente}
                    aria-pressed={tem}
                    title={!isGerente ? SERVICO_LABEL[s] : tem ? `Remover ${SERVICO_LABEL[s]}` : `Marcar ${SERVICO_LABEL[s]}`}
                    style={{
                      padding: "4px 11px", borderRadius: 999, cursor: isGerente ? "pointer" : "default",
                      ...(tem ? etiqueta(cs) : { background: "transparent", color: textSecondary }),
                      border: tem ? "1px solid transparent" : `1px dashed ${c.divisoria}`,
                      fontFamily: FONT, fontWeight: tem ? 700 : 600, fontSize: 10.5, letterSpacing: "0.04em",
                    }}
                  >
                    {SERVICO_LABEL[s]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {!editando && isGerente && (
          <button onClick={() => setEditando(true)} style={{ ...botaoLeve, height: 40, padding: "0 14px", borderRadius: 12 }}>
            <Pencil size={14} color={gold} />
            Configurar
          </button>
        )}
      </div>

      {editando ? (
        <ClienteForm
          inicial={cliente}
          salvando={salvar.isPending}
          onSubmit={(patch) => salvar.mutate(patch)}
          onCancelar={() => setEditando(false)}
          rotuloAcao="Salvar alterações"
        />
      ) : (
        <div className="detalhe-grid">
          {/* ══ COLUNA LARGA — o LOCAL ═════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {/* R200: os sistemas instalados — os blocos, com os equipamentos do QAP vinculados */}
            <InventarioCliente clienteId={id} podeEditar={isGerente} />

            {/* R200: a FILA — os equipamentos do QAP que ainda não estão em
                bloco nenhum, com seleção múltipla e o seletor de sistema.
                Não aparece quando o cliente não tem equipamento; vira uma linha
                de confirmação quando tudo está vinculado. */}
            <EquipamentosDoCliente clienteId={id} />

            {/* Atividades do cliente — Etapa 3, completadas na U96 (R143): as
                dele, as em que ele é local extra e as do GRUPO a que pertence. */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wrench size={15} color={gold} />
                <span style={SEC_LABEL}>Atividades</span>
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>{ordens.length}</span>
                <span style={{ flex: 1 }} />
                {isGerente && (
                  <button onClick={() => navigate({ to: "/chamados/novo" })} style={botaoLeve}>
                    Abrir atividade
                  </button>
                )}
              </div>
              {ordens.length === 0 ? (
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, paddingTop: 10 }}>
                  Nenhuma atividade registrada para este cliente.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {chamadosVisiveis.map((o) => {
                    const info = chamadoStatusInfo(o.status);
                    const corSt = isLight ? info.colorLight : info.color;
                    // veio pelo grupo ou como local extra — a ficha diz, para a
                    // pessoa não estranhar uma atividade "de outro cliente" aqui
                    const indireta = o.cliente_id !== id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => navigate({ to: "/chamados/$id", params: { id: o.id } })}
                        style={itemLista(corSt)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600 }}>{o.titulo}</div>
                          <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                            {o.numero ?? "—"} · {new Date(o.created_at).toLocaleDateString("pt-BR")}
                            {indireta ? " · pelo grupo de clientes ou como local extra" : ""}
                          </div>
                        </div>
                        <span style={chipStatus({ dark: info.color, light: info.colorLight, bg: info.bg })}>
                          {info.labelUpper}
                        </span>
                      </button>
                    );
                  })}
                  {ordens.length > TETO_CHAMADOS && (
                    /* O TETO É DECLARADO — a lição da seção de plantão. */
                    <button
                      onClick={() => setTodosOsChamados((v) => !v)}
                      style={{
                        alignSelf: "flex-start", background: "transparent", border: "none", padding: 0,
                        cursor: "pointer", color: gold, fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
                      }}
                    >
                      {todosOsChamados
                        ? "Mostrar só as mais recentes"
                        : `Mostrando ${TETO_CHAMADOS} de ${ordens.length} · ver todas`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Plantão — o pedaço que faltava no histórico (R123, U92).
                FECHADO POR `isGerente`, e não deixado aberto: a policy de
                `atendimentos_plantao` é "dono OU gestor", então para o técnico
                a lista viria PARCIAL — só os atendimentos dele — parecendo o
                histórico inteiro do cliente. Uma lista que mostra um pedaço com
                cara de tudo é pior que uma seção ausente. */}
            {isGerente && (
              <div style={CARD}>
                <span style={SEC_LABEL}>Plantão</span>
                {plantao.isError ? (
                  /* Erro NÃO vira "nenhum atendimento" — a lição da U86. */
                  <div style={{ fontFamily: FONT, fontSize: 12.5, color: vermelho, paddingTop: 10 }}>
                    Não foi possível ler os atendimentos de plantão: {(plantao.error as Error)?.message}
                  </div>
                ) : plantao.isLoading ? (
                  <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, paddingTop: 10 }}>
                    Carregando…
                  </div>
                ) : (plantao.data ?? []).length === 0 ? (
                  <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, paddingTop: 10 }}>
                    Nenhum atendimento de plantão registrado para este cliente.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {(plantao.data ?? []).map((a) => (
                      <div key={a.id} style={{ ...itemLista(), cursor: "default" }}>
                        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: gold, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                          {diaCurto(a.dia)} · {horaCurta(a.hora)}
                        </span>
                        <span style={{ fontFamily: FONT, fontSize: 12.5, color: textPrimary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.descricao}
                        </span>
                        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, flexShrink: 0, letterSpacing: "0.08em", textTransform: "uppercase", color: textSecondary }}>
                          {PLANTAO_TIPO_LABEL[a.tipo as "remoto" | "presencial"] ?? a.tipo}
                        </span>
                      </div>
                    ))}
                    {(plantao.data ?? []).length === TETO_PLANTAO && (
                      <span style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                        Mostrando os {TETO_PLANTAO} mais recentes.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Histórico de visitas */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={15} color={gold} />
                <span style={SEC_LABEL}>Histórico de visitas</span>
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>{visitas.length}</span>
              </div>
              {visitas.length === 0 ? (
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, paddingTop: 10 }}>
                  Nenhuma visita técnica registrada para este cliente.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {visitas.map((v: any) => {
                    const info = getStatusInfo(v.status);
                    const corVisita = isLight ? info.colorLight : info.color;
                    const quando = v.data_hora_agendada ?? v.created_at;
                    return (
                      <button
                        key={v.id}
                        onClick={() => navigate(visitaRouteFor(v.status, v.id) as any)}
                        style={itemLista(corVisita)}
                      >
                        <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12.5, fontWeight: 600 }}>
                          {quando
                            ? new Date(quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                            : "sem data"}
                          {v.nome_predio || v.titulo ? <span style={{ fontWeight: 400, color: textSecondary }}> · {v.nome_predio ?? v.titulo}</span> : null}
                        </span>
                        <span style={chipStatus({ dark: info.color, light: info.colorLight, bg: info.bg })}>
                          {info.labelUpper}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══ COLUNA ESTREITA — a IDENTIDADE ═════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {/* O local, com a FACHADA no topo (R146) */}
            <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
              <div style={{ position: "relative", minHeight: fotoUrl ? 190 : 0, background: fotoUrl ? c.campo : "transparent" }}>
                {fotoUrl && (
                  <img
                    src={fotoUrl}
                    alt={`Fachada de ${cliente.nome}`}
                    onLoad={() => setFotoPronta(true)}
                    style={{
                      width: "100%", height: 190, objectFit: "cover", display: "block",
                      opacity: fotoPronta ? 1 : 0, transition: "opacity .45s ease",
                    }}
                  />
                )}
                {isGerente && (
                  <div style={{
                    position: fotoUrl ? "absolute" : "static", right: 10, bottom: 10,
                    display: "flex", gap: 6, padding: fotoUrl ? 0 : "14px 16px 0",
                  }}>
                    <input
                      ref={fotoRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) trocarFoto.mutate(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <button
                      onClick={() => fotoRef.current?.click()}
                      disabled={trocarFoto.isPending}
                      style={{
                        ...botaoLeve,
                        background: fotoUrl ? (isLight ? "rgba(255,255,255,0.9)" : "rgba(14,14,14,0.78)") : botaoLeve.background,
                        cursor: trocarFoto.isPending ? "wait" : "pointer",
                      }}
                    >
                      <Camera size={13} color={gold} />
                      {trocarFoto.isPending ? "Enviando…" : fotoUrl ? "Trocar foto" : "Adicionar foto da fachada"}
                    </button>
                    {fotoUrl && (
                      <button
                        onClick={() => { if (confirm("Remover a foto da fachada?")) apagarFoto.mutate(); }}
                        aria-label="Remover foto da fachada"
                        title="Remover foto da fachada"
                        style={{
                          ...botaoLeve, width: 32, padding: 0, justifyContent: "center",
                          background: isLight ? "rgba(255,255,255,0.9)" : "rgba(14,14,14,0.78)",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={15} color={gold} />
                  <span style={SEC_LABEL}>O local</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                  <div style={{ ...linha, borderTop: "none" }}>
                    <span style={linhaLabel}>Endereço</span>
                    <span style={linhaValor}>{cliente.endereco ?? "—"}</span>
                  </div>
                  {cliente.complemento && (
                    <div style={linha}>
                      <span style={linhaLabel}>Complemento</span>
                      <span style={linhaValor}>{cliente.complemento}</span>
                    </div>
                  )}
                  {(cliente.cidade || cliente.uf) && (
                    <div style={linha}>
                      <span style={linhaLabel}>Cidade</span>
                      <span style={linhaValor}>{[cliente.cidade, cliente.uf].filter(Boolean).join(" / ")}</span>
                    </div>
                  )}
                  {cliente.documento && (
                    <div style={linha}>
                      <span style={linhaLabel}>CNPJ / CPF</span>
                      <span style={{ ...linhaValor, fontFamily: "ui-monospace, Menlo, monospace" }}>{cliente.documento}</span>
                    </div>
                  )}
                  {cliente.qtd_apartamentos != null && (
                    <div style={linha}>
                      <span style={linhaLabel}>Apartamentos / unidades</span>
                      <span style={linhaValor}>{cliente.qtd_apartamentos}</span>
                    </div>
                  )}
                  {cliente.qtd_acessos != null && (
                    <div style={linha}>
                      <span style={linhaLabel}>Acessos controlados</span>
                      <span style={linhaValor}>{cliente.qtd_acessos}</span>
                    </div>
                  )}
                  {cliente.latitude != null && cliente.longitude != null && (
                    <div style={linha}>
                      <span style={linhaLabel}>Coordenadas</span>
                      <span style={{ ...linhaValor, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", fontVariantNumeric: "tabular-nums" }}>
                        <MapPin size={12} color={gold} />
                        {cliente.latitude.toFixed(5)}, {cliente.longitude.toFixed(5)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contatos (R146): síndico e zelador — nome, WhatsApp e e-mail */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={15} color={gold} />
                <span style={SEC_LABEL}>Contatos</span>
              </div>
              {semContatos ? (
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, paddingTop: 10 }}>
                  Nenhum contato cadastrado{isGerente ? " — use Configurar para preencher." : "."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Contato rotulo={rotuloContato1} nome={cliente.nome_sindico} whatsapp={cliente.telefone_sindico} email={cliente.email_sindico} />
                  <Contato rotulo={rotuloContato2} nome={cliente.nome_zelador} whatsapp={cliente.telefone_zelador} email={cliente.email_zelador} />
                </div>
              )}
              {(cliente.responsavel_financeiro || cliente.email_financeiro) && veFinanceiro && (
                <div style={{ ...linha, marginTop: 6 }}>
                  <span style={linhaLabel}>Financeiro</span>
                  <span style={linhaValor}>
                    {[cliente.responsavel_financeiro, cliente.email_financeiro].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            </div>

            {/* Contratos — Etapa U2. Só quem enxerga financeiro (admin/comercial):
                a RLS já barra, e o card seria eternamente vazio para SAC/técnico. */}
            {veFinanceiro && (
              <div style={CARD}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={15} color={gold} />
                  <span style={SEC_LABEL}>Contratos</span>
                  <button
                    onClick={() => navigate({ to: "/contratos/novo", search: { cliente: id } as any })}
                    style={{ ...botaoLeve, marginLeft: "auto", height: 28, padding: "0 10px", fontSize: 11.5 }}
                  >
                    Novo
                  </button>
                </div>
                {contratos.length === 0 ? (
                  <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 400, color: textSecondary, marginTop: 8, lineHeight: 1.5 }}>
                    Nenhum contrato cadastrado. Sem contrato vigente, todo atendimento
                    deste cliente é faturável — mão de obra e equipamento.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    {contratos.map((ct) => {
                      const stc = STATUS_CONTRATO_CORES[ct.status];
                      const vigente = contratoVigente(contratos)?.id === ct.id;
                      return (
                        <button
                          key={ct.id}
                          onClick={() => navigate({ to: "/contratos/$id", params: { id: ct.id } })}
                          style={itemLista()}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: textPrimary }}>
                              {MODALIDADE_LABEL[ct.modalidade]}
                              {ct.numero ? ` · nº ${ct.numero}` : ""}
                              {vigente && <span style={{ color: gold, fontSize: 11 }}> · vigente</span>}
                            </div>
                            <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary }}>
                              {ct.vigencia_fim
                                ? `até ${ct.vigencia_fim.split("-").reverse().join("/")}`
                                : "vigência aberta"}
                              {ct.valor_mensal != null &&
                                ` · ${ct.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês`}
                            </div>
                          </div>
                          <span style={chipStatus(stc)}>{STATUS_CONTRATO_LABEL[ct.status]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            {cliente.observacoes && (
              <div style={CARD}>
                <span style={SEC_LABEL}>Observações</span>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, color: textPrimary, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                  {cliente.observacoes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
