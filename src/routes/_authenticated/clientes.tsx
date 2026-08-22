// Clientes — a base oficial, redesenhada na U24 (design v7).
//
// Desktop: lista à esquerda, o mapa do município à direita, lado a lado — o
// ponto colorido do card e o ponto do mapa são A MESMA COR (corDoCliente),
// que é como o olho liga as duas metades. Celular: mapa em cima, lista
// embaixo, e a navegação chega por Gerencial → Clientes (a barra inferior
// não ganhou item novo — 5 vagas, todas ocupadas).
//
// Quem vê: admin, comercial e SAC (decisão do Davi, U24). O técnico chega no
// cliente pelo chamado dele — detalhe não é gateado — mas não na base.
//
// R21 (2026-08-21): esta lista virou LEITURA. Cliente vem do QAP e só o botão
// Sincronizar atualiza — criar, consolidar e apagar saíram daqui. Prédio
// orçado que não é cliente foi para /prospeccao (R22).
//
// Layout das rotas filhas: /clientes/$id renderiza pelo Outlet.

import { createFileRoute, useNavigate, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft, Building2, MapPin, Search, SlidersHorizontal, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { GRAD_PRIMARIA, PRISMA, SOBRE_PRIMARIA } from "@/lib/paleta";
import { useIsGerente } from "@/features/gerencial/data";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import { MapaClientes } from "@/features/clientes/MapaClientes";
import { gradienteDoCliente } from "@/features/clientes/cores";
import {
  useClientes,
  SITUACAO_LABEL,
  SITUACAO_CORES,
  SERVICO_ORDEM,
  SERVICO_LABEL,
  SERVICO_CORES,
  temServico,
  type SituacaoCliente,
  type ServicoCliente,
} from "@/features/clientes/data";

export const Route = createFileRoute("/_authenticated/clientes")({
  // A trava é só da LISTA (mesmo padrão de chamados.tsx): o técnico não vê a
  // BASE de clientes, mas abre /clientes/$id vindo do chamado dele. Guardar o
  // pai inteiro derrubaria o técnico ao tocar no cliente do próprio chamado.
  //
  // Sem isto, a U24 tirava o item do menu e mais nada: bastava digitar
  // /clientes na barra de endereço para a base inteira carregar — a RLS de
  // SELECT em clientes é USING(true) e não segura ninguém.
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    if (location.pathname.replace(/\/$/, "") !== "/clientes") return;
    const { ok } = await guardaDeTela("clientes");
    if (!ok) throw redirect({ to: destinoNegado("clientes") as any });
  },
  component: ClientesPage,
});

type Filtro = "todos" | SituacaoCliente;

function ClientesPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: isGerente = false } = useIsGerente();
  const { data: clientes = [], isLoading } = useClientes();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  // Serviço é outra DIMENSÃO, não outro valor do mesmo filtro: um cliente é
  // ativo E tem portaria remota. Juntar tudo num seletor só obrigaria a
  // escolher entre "ver os ativos" e "ver os de portaria" (R41).
  const [servico, setServico] = useState<"todos" | ServicoCliente>("todos");
  // R71: os filtros viraram um painel que abre — o botão redondo ao lado da
  // busca é quem manda. Estado LOCAL e não persistido: é pergunta do
  // momento, não preferência (a mesma regra do drill-down do dashboard).
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  /** Há recorte escondido? É o que acende o ponto no botão. */
  const temFiltro = filtro !== "todos" || servico !== "todos";

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const norm = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const lista = useMemo(() => {
    const termo = norm(busca.trim());
    return clientes.filter((c) => {
      if (filtro !== "todos" && c.situacao !== filtro) return false;
      if (servico !== "todos" && !temServico(c, servico)) return false;
      if (!termo) return true;
      const alvo = norm(
        `${c.nome} ${c.endereco ?? ""} ${c.cidade ?? ""} ${c.posto_servico ?? ""} ${c.nome_sindico ?? ""}`,
      );
      return alvo.includes(termo);
    });
  }, [clientes, busca, filtro, servico]);

  // Paginação (R55): 10 por vez. O MAPA continua mostrando a `lista`
  // INTEIRA (filtrada, não paginada) — paginar é sobre quantos CARTÕES
  // aparecem de uma vez, não sobre "esconder" cliente do mapa; ver
  // `<MapaClientes clientes={lista}>` mais abaixo, não `listaPaginada`.
  const ITENS_POR_PAGINA = 10;
  const [paginaAtual, setPaginaAtual] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(lista.length / ITENS_POR_PAGINA));
  // busca/filtro/serviço mudou → a página 4 pode não existir mais na lista
  // nova; sem isto a tela ficaria em branco até alguém clicar em "1" à mão
  useEffect(() => { setPaginaAtual(1); }, [busca, filtro, servico]);
  const pagina = Math.min(paginaAtual, totalPaginas);
  const listaPaginada = useMemo(
    () => lista.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA),
    [lista, pagina],
  );

  /**
   * As contagens dos chips de SITUAÇÃO respeitam o filtro de serviço, e
   * vice-versa. Sem isso o chip diria "Ativos · 192" enquanto a lista
   * filtrada por portaria mostra 29 — e o número viraria uma promessa que a
   * tela não cumpre.
   */
  const contagem = useMemo(() => {
    const porServico = servico === "todos"
      ? clientes
      : clientes.filter((c) => temServico(c, servico));
    const porSituacao = filtro === "todos"
      ? clientes
      : clientes.filter((c) => c.situacao === filtro);
    return {
      todos: porServico.length,
      ativo: porServico.filter((c) => c.situacao === "ativo").length,
      inativo: porServico.filter((c) => c.situacao === "inativo").length,
      servicoTodos: porSituacao.length,
      portaria_remota: porSituacao.filter((c) => temServico(c, "portaria_remota")).length,
      monitoramento_alarmes: porSituacao.filter((c) => temServico(c, "monitoramento_alarmes")).length,
    };
  }, [clientes, filtro, servico]);

  const semEndereco = clientes.filter((c) => !c.endereco).length;

  if (pathname !== "/clientes") return <Outlet />;

  const chipFiltro = (ativo: boolean): CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    background: ativo
      ? GRAD_PRIMARIA
      : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? SOBRE_PRIMARIA : textPrimary,
    fontFamily: FONT,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  // o mapa mostra o que a lista mostra — filtrar a lista filtra o mapa
  return (
    // .sangra-x, não um padding próprio: é a MESMA classe que a Início usa no
    // quadro e nos filtros, para as duas páginas terem a régua exata — colado
    // na sidebar à esquerda, na borda da janela à direita.
    //
    // .clientes-tela-fixa: TETO, não piso (2026-08-22, Davi: "esta tela não
    // deve ser scrollável... adapte a tela para uma tela fixa") — mas só a
    // PARTIR de 1024px (a régua em styles.css). No celular, mapa empilhado
    // sobre lista sobre paginação não cabe inteiro sem rolar de jeito
    // nenhum — travar altura lá só cortaria conteúdo. Diferente do
    // Calendário (calendario.tsx), que usa `minHeight` de propósito porque a
    // grade dele cresce com o mês mais cheio — aqui a lista já vem paginada
    // em 10 (R55), então um teto com rolagem PRÓPRIA (na coluna da lista,
    // não na página) é o encaixe certo no desktop. paddingTop/paddingBottom
    // encolheram de 18/40 para 8/8: numa tela com teto, sobra desperdiçada
    // em cima é sobra que falta embaixo, no mapa.
    <div className="sangra-x clientes-tela-fixa" style={{
      paddingTop: 8, paddingBottom: 8, display: "flex", flexDirection: "column", gap: 10,
      color: textPrimary, minHeight: 0,
    }}>
      {/* Cabeçalho — título à esquerda, busca e filtro à DIREITA, na MESMA
          linha (R71, Davi: "o campo de buscar deve estar alinhado com o
          título Clientes"). O painel de filtros que ocupava uma faixa
          inteira virou um botão redondo ao lado da busca: com dois eixos de
          filtro que na maior parte do tempo ficam em "Todos", a faixa
          gastava permanentemente a altura que a lista precisa para caber 10.
          A volta é gesto de celular; no desktop a sidebar já situa. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
        <button
          className="so-celular"
          onClick={() => navigate({ to: "/gerencial" })}
          aria-label="Voltar"
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
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, letterSpacing: "-0.01em" }}>Clientes</div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
            {contagem.ativo} ativo{contagem.ativo === 1 ? "" : "s"} · {contagem.todos} cadastrado{contagem.todos === 1 ? "" : "s"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ position: "relative", width: "min(320px, 60vw)" }}>
            <Search
              size={15}
              color={textSecondary}
              style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, endereço, posto…"
              style={{
                width: "100%", boxSizing: "border-box", height: 42, borderRadius: 14,
                padding: "0 14px 0 36px",
                background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
                color: textPrimary, fontFamily: FONT, fontWeight: 400, fontSize: 13,
                outline: "none", colorScheme: isLight ? "light" : "dark",
              }}
            />
          </div>
          {/* O botão redondo dos filtros. `aria-expanded` porque ele revela
              um painel, e o PONTO dourado porque filtro escondido que está
              ativo é armadilha: sem o aviso, "sumiu cliente da lista" vira
              um mistério em vez de um clique. */}
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            aria-expanded={filtrosAbertos}
            aria-label={filtrosAbertos ? "Fechar filtros" : "Abrir filtros"}
            title={temFiltro ? "Filtros (ativos)" : "Filtros"}
            className="elevavel"
            style={{
              position: "relative", width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: filtrosAbertos
                ? GRAD_PRIMARIA
                : isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
              border: filtrosAbertos
                ? "none"
                : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
              color: filtrosAbertos ? SOBRE_PRIMARIA : textPrimary,
            }}
          >
            {filtrosAbertos ? <X size={17} /> : <SlidersHorizontal size={17} />}
            {temFiltro && !filtrosAbertos && (
              <span aria-hidden style={{
                position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4,
                background: gold, boxShadow: `0 0 0 2px ${isLight ? "#ffffff" : "#141416"}`,
              }} />
            )}
          </button>
        </div>
      </div>

      {/* O painel de filtros — só ocupa altura quando está aberto. Situação e
          Serviço são dois EIXOS que se combinam (um cliente é ativo E tem
          portaria), por isso continuam em duas fileiras rotuladas dentro do
          mesmo cartão, e não num seletor só. */}
      {filtrosAbertos && (
        <div style={{
          ...card(isLight), borderRadius: 14, padding: "10px 12px",
          display: "flex", flexDirection: "column", gap: 7, flexShrink: 0,
        }}>
          <div className="trilho-x" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.12em",
              textTransform: "uppercase", color: textSecondary, flexShrink: 0, paddingRight: 2,
              width: 52,
            }}>
              Situação
            </span>
            {([
              ["todos", `Todos · ${contagem.todos}`],
              ["ativo", `Ativos · ${contagem.ativo}`],
              ["inativo", `Inativos · ${contagem.inativo}`],
            ] as [Filtro, string][]).map(([valor, rotulo]) => (
              <button key={valor} style={chipFiltro(filtro === valor)} onClick={() => setFiltro(valor)}>
                {rotulo}
              </button>
            ))}
          </div>
          <div className="trilho-x" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.12em",
              textTransform: "uppercase", color: textSecondary, flexShrink: 0, paddingRight: 2,
              width: 52,
            }}>
              Serviço
            </span>
            <button style={chipFiltro(servico === "todos")} onClick={() => setServico("todos")}>
              {`Todos · ${contagem.servicoTodos}`}
            </button>
            {SERVICO_ORDEM.map((s) => (
              <button key={s} style={chipFiltro(servico === s)} onClick={() => setServico(s)}>
                {`${SERVICO_LABEL[s]} · ${contagem[s]}`}
              </button>
            ))}
          </div>
          {temFiltro && (
            <button
              onClick={() => { setFiltro("todos"); setServico("todos"); }}
              style={{
                alignSelf: "flex-start", background: "transparent", border: "none", padding: 0,
                cursor: "pointer", color: gold, fontFamily: FONT, fontWeight: 600, fontSize: 11.5,
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Lista + mapa. minmax(0,…) evita que o mapa estoure a coluna.
          flex:1 + minHeight:0 (inline, junto da classe): esta é a linha que
          consome o resto da tela fixa — sem o minHeight:0 um filho flex não
          encolhe abaixo do próprio conteúdo, e a rolagem vazaria pra página
          inteira em vez de ficar presa na coluna da lista, que é o pedido. */}
      <div className="clientes-duas-colunas" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, minHeight: 0 }}>
          {/* A LISTA NÃO ROLA (R71, Davi: "a lista de clientes não deve ter
              scroll, adapte a altura de cada item para caber 10 itens por
              página"). A régua é o grid de `.clientes-lista`: dez linhas de
              `1fr` dividem a altura disponível, e cada cartão preenche a
              linha dele. Como as linhas existem mesmo com menos de dez
              resultados, o cartão tem SEMPRE a mesma altura — a última
              página não fica com cartões gordos.

              A altura de cada cartão passa a ser o que sobrar, então o
              conteúdo dele é de duas linhas e trunca com reticências em vez
              de empurrar (ver o cartão abaixo). */}
          <div className="clientes-lista" style={{ flex: 1, minHeight: 0 }}>
          {isLoading ? (
            <div style={{ ...card(isLight), gridRow: "1 / -1", borderRadius: 16, padding: "28px 16px", textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
              Carregando clientes…
            </div>
          ) : lista.length === 0 ? (
            <div style={{ ...card(isLight), gridRow: "1 / -1", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "28px 16px" }}>
              <Building2 size={28} color={gold} />
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                {clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"}
              </span>
              <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary, textAlign: "center" }}>
                {clientes.length === 0
                  ? "Os clientes vêm do QAP — use Sincronizar para trazê-los."
                  : "Ajuste a busca ou o filtro de situação."}
              </span>
            </div>
          ) : (
            listaPaginada.map((c) => {
              const corSit = SITUACAO_CORES[c.situacao] ?? SITUACAO_CORES.ativo;
              // a segunda linha do cartão junta endereço, tipo e síndico num
              // texto só: com a altura fixa em 1/10 da coluna, três linhas
              // empilhadas não cabem — e jogar fora tipo/síndico apagaria
              // dado que a ficha tem. Um texto só trunca com reticências e
              // continua legível de relance.
              const detalhe = [
                c.endereco,
                c.tipo_local ? (TIPO_LABEL[c.tipo_local] ?? c.tipo_local) : null,
                c.nome_sindico,
              ].filter(Boolean).join(" · ");
              return (
                <button
                  key={c.id}
                  className="elevavel"
                  onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}
                  style={{
                    ...card(isLight), borderRadius: 14, padding: "0 12px",
                    textAlign: "left", cursor: "pointer", color: textPrimary,
                    display: "flex", gap: 10, alignItems: "center", width: "100%",
                    // o cartão preenche a linha do grid; o miolo se vira
                    minWidth: 0, minHeight: 0, overflow: "hidden",
                  }}
                >
                  {/* a bolinha do cliente — o MESMO degradê do ponto dele no
                      mapa. R71: sem contorno e sem glow, "somente a bolinha". */}
                  <span aria-hidden style={{
                    width: 10, height: 10, borderRadius: 5, flexShrink: 0,
                    background: gradienteDoCliente(c.id, isLight),
                  }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* nowrap: a linha das etiquetas não pode quebrar e
                        empurrar a altura — o nome encolhe com reticências e
                        as etiquetas seguem à direita dele */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{
                        fontFamily: FONT, fontWeight: 600, fontSize: 13.5, minWidth: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.nome}
                      </span>
                      <span style={{
                        padding: "1px 7px", borderRadius: 999, flexShrink: 0,
                        background: corSit.bg,
                        color: isLight ? corSit.light : corSit.dark,
                        fontFamily: FONT, fontWeight: 700, fontSize: 8.5,
                        letterSpacing: "0.07em", textTransform: "uppercase",
                      }}>
                        {SITUACAO_LABEL[c.situacao] ?? c.situacao}
                      </span>
                      {/* SERVIÇOS (R41) — na linha, não só no filtro: filtro
                          responde "quem tem?", a etiqueta responde "o que tem
                          este?", e é a segunda que se pergunta olhando um
                          cliente específico. */}
                      {SERVICO_ORDEM.filter((s) => temServico(c, s)).map((s) => (
                        <span key={s} style={{
                          padding: "1px 7px", borderRadius: 999, flexShrink: 0,
                          background: SERVICO_CORES[s].bg,
                          color: isLight ? SERVICO_CORES[s].light : SERVICO_CORES[s].dark,
                          fontFamily: FONT, fontWeight: 700, fontSize: 8.5,
                          letterSpacing: "0.07em", textTransform: "uppercase",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {SERVICO_LABEL[s]}
                        </span>
                      ))}
                      {c.cidade && c.cidade !== "São Paulo" && (
                        <span style={{
                          padding: "1px 7px", borderRadius: 999, flexShrink: 0,
                          background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                          fontFamily: FONT, fontWeight: 600, fontSize: 8.5,
                          letterSpacing: "0.07em", textTransform: "uppercase",
                          color: textSecondary, whiteSpace: "nowrap",
                        }}>
                          {c.cidade}
                        </span>
                      )}
                    </div>
                    {c.endereco ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <MapPin size={11} color={textSecondary} style={{ flexShrink: 0 }} />
                        <span style={{
                          fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {detalhe}
                        </span>
                      </div>
                    ) : (
                      <div style={{
                        fontFamily: FONT, fontWeight: 400, fontSize: 11.5,
                        color: isLight ? PRISMA.laranja.light : PRISMA.laranja.dark,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        sem endereço — precisa de revisão
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
          </div>

          {/* Paginação (R55) — FORA da região que rola, de propósito: fica
              sempre visível embaixo da lista, sem precisar rolar até ela.
              Só aparece quando há mais de uma página; uma lista de 3
              resultados não precisa de numerador nenhum. */}
          {lista.length > 0 && totalPaginas > 1 && (
            <div style={{ flexShrink: 0 }}>
              <Paginacao
                pagina={pagina}
                totalPaginas={totalPaginas}
                totalItens={lista.length}
                itensPorPagina={ITENS_POR_PAGINA}
                isLight={isLight}
                aoIrPara={setPaginaAtual}
              />
            </div>
          )}
        </div>

        <MapaClientes clientes={lista} />
      </div>
    </div>
  );
}

/**
 * 1, 2, 3, "…", N — trunca o meio quando há muita página, mas nunca esconde
 * a primeira, a última, nem a vizinhança da atual. Até 7 páginas, mostra
 * todas (a lista de clientes raramente passa disso; truncar cedo demais
 * seria complexidade sem público).
 */
function numerosDePagina(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const alvo = new Set([1, 2, total - 1, total, atual - 1, atual, atual + 1]);
  const validos = [...alvo].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultado: (number | "…")[] = [];
  let anterior = 0;
  for (const n of validos) {
    if (anterior && n - anterior > 1) resultado.push("…");
    resultado.push(n);
    anterior = n;
  }
  return resultado;
}

/**
 * Numerador de página (R55, Davi: "adicione o numerador de páginas no final
 * com opção de passar para próxima, para última, e o número da página
 * específico"). Botões no vocabulário do resto da tela — pílula dourada na
 * página atual, o MESMO gradiente que `chipFiltro(true)` já usa lá em cima,
 * não uma paleta nova só para paginação.
 */
function Paginacao({ pagina, totalPaginas, totalItens, itensPorPagina, isLight, aoIrPara }: {
  pagina: number; totalPaginas: number; totalItens: number; itensPorPagina: number;
  isLight: boolean; aoIrPara: (p: number) => void;
}) {
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const borda = isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)";
  const fundo = isLight ? "#ffffff" : "rgba(255,255,255,0.03)";
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";

  const botaoSeta = (desabilitado: boolean): CSSProperties => ({
    width: 32, height: 32, borderRadius: 9, border: borda,
    background: fundo, color: desabilitado ? textSecondary : textPrimary,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: desabilitado ? "default" : "pointer", opacity: desabilitado ? 0.45 : 1,
    flexShrink: 0,
  });
  const botaoNumero = (ativo: boolean): CSSProperties => ({
    minWidth: 32, height: 32, padding: "0 4px", borderRadius: 9,
    border: ativo ? "none" : borda,
    background: ativo ? GRAD_PRIMARIA : fundo,
    color: ativo ? SOBRE_PRIMARIA : textPrimary,
    fontFamily: FONT, fontWeight: 700, fontSize: 12.5,
    cursor: ativo ? "default" : "pointer", flexShrink: 0,
  });

  const primeiroItem = (pagina - 1) * itensPorPagina + 1;
  const ultimoItem = Math.min(pagina * itensPorPagina, totalItens);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 10, paddingTop: 12, marginTop: 2,
      borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
    }}>
      <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
        {primeiroItem}–{ultimoItem} de {totalItens}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <button
          aria-label="Primeira página" title="Primeira página"
          disabled={pagina === 1}
          onClick={() => aoIrPara(1)}
          style={botaoSeta(pagina === 1)}
        >
          <ChevronsLeft size={15} />
        </button>
        <button
          aria-label="Página anterior" title="Página anterior"
          disabled={pagina === 1}
          onClick={() => aoIrPara(pagina - 1)}
          style={botaoSeta(pagina === 1)}
        >
          <ChevronLeft size={15} />
        </button>
        {numerosDePagina(pagina, totalPaginas).map((n, i) => (
          n === "…" ? (
            <span key={`reticencias-${i}`} style={{
              width: 20, textAlign: "center", fontFamily: FONT, fontSize: 12.5, color: textSecondary,
            }}>
              …
            </span>
          ) : (
            <button
              key={n}
              aria-label={`Página ${n}`}
              aria-current={n === pagina ? "page" : undefined}
              onClick={() => aoIrPara(n)}
              style={botaoNumero(n === pagina)}
            >
              {n}
            </button>
          )
        ))}
        <button
          aria-label="Próxima página" title="Próxima página"
          disabled={pagina === totalPaginas}
          onClick={() => aoIrPara(pagina + 1)}
          style={botaoSeta(pagina === totalPaginas)}
        >
          <ChevronRight size={15} />
        </button>
        <button
          aria-label="Última página" title="Última página"
          disabled={pagina === totalPaginas}
          onClick={() => aoIrPara(totalPaginas)}
          style={botaoSeta(pagina === totalPaginas)}
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}
