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
  ArrowLeft, Building2, MapPin, Plus, Search, Users, Wand2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { GRAD_PRIMARIA, PRISMA, SOBRE_PRIMARIA } from "@/lib/paleta";
import { useIsGerente } from "@/features/gerencial/data";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import { MapaClientes } from "@/features/clientes/MapaClientes";
import { corDoCliente } from "@/features/clientes/cores";
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
    // na sidebar à esquerda, na borda da janela à direita. paddingTop 18
    // replica o espaçamento que a Início usa acima do próprio conteúdo.
    <div className="sangra-x" style={{ paddingTop: 18, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Cabeçalho — a volta é gesto de celular; no desktop a sidebar já situa */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, letterSpacing: "-0.01em" }}>Clientes</div>
          <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
            {contagem.ativo} ativo{contagem.ativo === 1 ? "" : "s"} · {contagem.todos} cadastrado{contagem.todos === 1 ? "" : "s"}
          </div>
        </div>
        {/* O botão "Novo" saiu (R21): o app não cria cliente — quem cria é o
            QAP, e o caminho é o Sincronizar. Aqui entra o botão de sincronizar
            quando a integração existir (S9/U28). */}
      </div>

      {/* A consolidação assistida saiu (R21): ela criava, reescrevia e apagava
          cliente — exatamente o que deixou de ser nosso. Cadastro duplicado
          passa a ser resolvido no QAP, que é a fonte. */}

      {/* Busca + filtros na mesma linha (desktop); empilha sozinho no celular */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="trilho-x" style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
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
        {/* SERVIÇO PRESTADO (R41) — segunda linha de chips, com separador
            visual: são dois eixos que se combinam, e emendá-los na mesma
            fileira faria parecer que só um pode estar ativo. */}
        <div className="trilho-x" style={{ display: "flex", gap: 8, flexBasis: "100%", minWidth: 0 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.12em",
            textTransform: "uppercase", color: textSecondary,
            alignSelf: "center", flexShrink: 0, paddingRight: 2,
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
        <div style={{ position: "relative", width: "min(320px, 100%)" }}>
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
              width: "100%", boxSizing: "border-box", height: 42, borderRadius: 999,
              padding: "0 14px 0 36px",
              background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
              border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
              color: textPrimary, fontFamily: FONT, fontWeight: 400, fontSize: 13,
              outline: "none", colorScheme: isLight ? "light" : "dark",
            }}
          />
        </div>
      </div>

      {/* Lista + mapa. minmax(0,…) evita que o mapa estoure a coluna. */}
      <div className="clientes-duas-colunas">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {isLoading ? (
            <div style={{ ...card(isLight), borderRadius: 16, padding: "28px 16px", textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
              Carregando clientes…
            </div>
          ) : lista.length === 0 ? (
            <div style={{ ...card(isLight), borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
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
              const cor = corDoCliente(c.id, isLight);
              return (
                <button
                  key={c.id}
                  className="elevavel"
                  onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}
                  style={{
                    ...card(isLight), borderRadius: 16, padding: "12px 14px",
                    textAlign: "left", cursor: "pointer", color: textPrimary,
                    display: "flex", gap: 11, alignItems: "flex-start", width: "100%",
                  }}
                >
                  {/* o ponto do cliente — a MESMA cor dele no mapa */}
                  <span aria-hidden style={{
                    width: 10, height: 10, borderRadius: 6, flexShrink: 0,
                    marginTop: 5,
                    background: cor,
                    boxShadow: `0 0 8px ${cor}66`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14 }}>{c.nome}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999,
                        background: corSit.bg,
                        color: isLight ? corSit.light : corSit.dark,
                        fontFamily: FONT, fontWeight: 700, fontSize: 9,
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
                          padding: "2px 8px", borderRadius: 999,
                          background: SERVICO_CORES[s].bg,
                          color: isLight ? SERVICO_CORES[s].light : SERVICO_CORES[s].dark,
                          fontFamily: FONT, fontWeight: 700, fontSize: 9,
                          letterSpacing: "0.07em", textTransform: "uppercase",
                        }}>
                          {SERVICO_LABEL[s]}
                        </span>
                      ))}
                      {c.cidade && c.cidade !== "São Paulo" && (
                        <span style={{
                          padding: "2px 8px", borderRadius: 999,
                          background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                          fontFamily: FONT, fontWeight: 600, fontSize: 9,
                          letterSpacing: "0.07em", textTransform: "uppercase",
                          color: textSecondary,
                        }}>
                          {c.cidade}
                        </span>
                      )}
                    </div>
                    {c.endereco ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <MapPin size={12} color={textSecondary} style={{ flexShrink: 0 }} />
                        <span style={{
                          fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {c.endereco}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: isLight ? PRISMA.laranja.light : PRISMA.laranja.dark, marginTop: 4 }}>
                        sem endereço — precisa de revisão
                      </div>
                    )}
                    {(c.tipo_local || c.nome_sindico) && (
                      <div style={{ display: "flex", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                        {c.tipo_local && (
                          <span style={{
                            fontFamily: FONT, fontWeight: 700, fontSize: 9.5,
                            letterSpacing: "0.09em", textTransform: "uppercase", color: textSecondary,
                          }}>
                            {TIPO_LABEL[c.tipo_local] ?? c.tipo_local}
                          </span>
                        )}
                        {c.nome_sindico && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
                            <Users size={11} /> {c.nome_sindico}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}

          {/* Paginação (R55) — só aparece quando há mais de uma página; uma
              lista de 3 resultados não precisa de numerador nenhum. */}
          {lista.length > 0 && totalPaginas > 1 && (
            <Paginacao
              pagina={pagina}
              totalPaginas={totalPaginas}
              totalItens={lista.length}
              itensPorPagina={ITENS_POR_PAGINA}
              isLight={isLight}
              aoIrPara={setPaginaAtual}
            />
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
