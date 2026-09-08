// Ficha do cliente — o centro do cliente no sistema, numa página só (R146, R200–R207).
//
// ── R203 (U112): UMA PÁGINA SÓ, EDIÇÃO NO LUGAR ─────────────────────────────
// Davi, 2026-09-07: "na página do cliente, eu quero que tenha tudo, não deve
// conter outra página para configurar o cliente, deve estar tudo na mesma
// página. Quero que seja uma página só, com layout bem estruturado, design
// clean."
//
// Não existe mais "modo de configuração": cada card da coluna de identidade
// tem o próprio lápis e edita no lugar, com Salvar/Cancelar dentro dele
// (CardLocal, CardContatos, CardEstrutura — features/clientes/ClienteForm.tsx).
// As etiquetas de serviço prestado, no cabeçalho, já eram o próprio controle
// (R41/R173). A foto da fachada sobe pelo card dela (R146).
//
// A ordem da ficha é a ordem em que se trabalha o cliente (R201):
//   · CABEÇALHO (largura toda): nome 22/700, situação, tipo de local, endereço
//     numa linha e as etiquetas de serviço prestado.
//   · COLUNA LARGA — o LOCAL: Sistemas instalados (os blocos e o vínculo por
//     arrasto em dois painéis, R200/R202/R206), Atividades, Plantão, Visitas.
//   · COLUNA ESTREITA — a IDENTIDADE: a fachada, o local, os contatos (com os
//     botões de WhatsApp e copiar, R207), os contratos (só quem vê financeiro)
//     e a estrutura com as observações.
// A grade é a da página da atividade (.detalhe-grid); no celular empilha.
//
// R205 (U114): a página PREENCHE A LARGURA da janela (`.pagina-larga`, a mesma
// conta da sangria da Início) — a coluna larga cresce com o monitor, a de
// identidade tem teto. Davi: "o conteúdo da tela deverá preencher o espaço,
// adaptando a largura da tela."

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Camera, FileText, MapPin, CalendarDays, Wrench, Trash2, Home, Image as ImagemIcone,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente, useVeFinanceiro } from "@/features/gerencial/data";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import { getStatusInfo } from "@/lib/visita-status";
import { visitaRouteFor } from "@/lib/visita-route";
import { FONT, card, etiqueta } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { CardLocal, CardContatos, CardEstrutura } from "@/features/clientes/ClienteForm";
import { InventarioCliente } from "@/features/clientes/InventarioCliente";
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

  // R203: cada card grava SÓ os campos dele — o patch é parcial de propósito
  const salvar = useMutation({
    mutationFn: (patch: ClientePatch) => atualizarCliente(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente atualizado.");
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
  const chamadosVisiveis = todosOsChamados ? ordens : ordens.slice(0, TETO_CHAMADOS);
  const enderecoCurto = [cliente.endereco, [cliente.cidade, cliente.uf].filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
  const propsDosCards = { cliente, podeEditar: isGerente, salvando: salvar.isPending, onSalvar: (p: ClientePatch) => salvar.mutateAsync(p) };

  return (
    <div className="pagina-larga" style={{ paddingTop: 12, paddingBottom: 48, display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* ══ CABEÇALHO DA PÁGINA (R201) ═══════════════════════════════════════ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <button
          onClick={voltar}
          aria-label="Voltar para clientes"
          style={{ ...botaoLeve, width: 40, height: 40, padding: 0, justifyContent: "center", borderRadius: 12, marginTop: 2 }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: 0, letterSpacing: "-0.01em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
            }}>
              {cliente.nome}
            </h1>
            <span style={chipStatus(cor)}>{SITUACAO_LABEL[cliente.situacao] ?? cliente.situacao}</span>
            {/* R146: o tipo de local sempre visível; sem ele, o aviso */}
            <span style={{
              fontFamily: FONT, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5,
              color: cliente.tipo_local ? textSecondary : (isLight ? "#AD4700" : "#FA842D"),
            }}>
              <Home size={12} />
              {cliente.tipo_local ? (TIPO_LABEL[cliente.tipo_local] ?? cliente.tipo_local) : "tipo de local não informado"}
            </span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <MapPin size={12} color={gold} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {enderecoCurto || "endereço não informado"}
            </span>
            <span style={{ opacity: 0.6 }}>·</span>
            <span>{ordens.length} atividade{ordens.length === 1 ? "" : "s"} · {visitas.length} visita{visitas.length === 1 ? "" : "s"}</span>
          </div>

          {/* SERVIÇO PRESTADO (R41) — etiquetas que também são o controle. A
              gravação manda o ARRAY inteiro. R173: um grupo ainda não aceito
              pelo banco não se OFERECE — mas, se já estiver marcado, aparece
              (para poder ser desmarcado). */}
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
        </div>
      </div>

      <div className="detalhe-grid">
        {/* ══ COLUNA LARGA — o LOCAL ═════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* R200/R202/R206: os sistemas instalados — os blocos, nomeados direto,
              e o vínculo por arrasto em dois painéis (Blocos | Sem bloco). O
              painel "Sem bloco" mora DENTRO do card, não é mais um card à parte. */}
          <InventarioCliente clienteId={id} podeEditar={isGerente} />

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
          {/* A FACHADA (R146) — sobe pelo próprio card, para o bucket privado */}
          {(fotoUrl || isGerente) && (
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
                    display: "flex", gap: 6, alignItems: "center", padding: fotoUrl ? 0 : "14px 16px",
                  }}>
                    {!fotoUrl && (
                      <>
                        <ImagemIcone size={15} color={gold} />
                        <span style={SEC_LABEL}>Fachada</span>
                        <span style={{ flex: 1 }} />
                      </>
                    )}
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
            </div>
          )}

          {/* R203: os três cards editam no lugar — cada um grava só os seus campos */}
          <CardLocal {...propsDosCards} />
          <CardContatos {...propsDosCards} veFinanceiro={veFinanceiro} />

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

          <CardEstrutura {...propsDosCards} />
        </div>
      </div>
    </div>
  );
}
