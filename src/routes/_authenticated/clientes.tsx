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
// Layout das rotas filhas: /clientes/novo, /clientes/$id e /clientes/migrar
// renderizam pelo Outlet (mesmo padrão de gerencial.tsx).

import { createFileRoute, useNavigate, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Building2, MapPin, Plus, Search, Users, Wand2 } from "lucide-react";
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
  type SituacaoCliente,
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

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const norm = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const lista = useMemo(() => {
    const termo = norm(busca.trim());
    return clientes.filter((c) => {
      if (filtro !== "todos" && c.situacao !== filtro) return false;
      if (!termo) return true;
      const alvo = norm(
        `${c.nome} ${c.endereco ?? ""} ${c.cidade ?? ""} ${c.posto_servico ?? ""} ${c.nome_sindico ?? ""}`,
      );
      return alvo.includes(termo);
    });
  }, [clientes, busca, filtro]);

  const contagem = useMemo(
    () => ({
      todos: clientes.length,
      ativo: clientes.filter((c) => c.situacao === "ativo").length,
      prospecto: clientes.filter((c) => c.situacao === "prospecto").length,
      inativo: clientes.filter((c) => c.situacao === "inativo").length,
    }),
    [clientes],
  );

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
        {isGerente && (
          <button
            className="elevavel"
            onClick={() => navigate({ to: "/clientes/novo" })}
            style={{
              height: 40, padding: "0 16px", borderRadius: 12, border: "none",
              background: GRAD_PRIMARIA, color: SOBRE_PRIMARIA,
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: FONT, fontWeight: 700, fontSize: 12,
              cursor: "pointer", flexShrink: 0,
              boxShadow: "0 4px 14px rgba(248,200,17,0.30)",
            }}
          >
            <Plus size={16} />
            Novo
          </button>
        )}
      </div>

      {/* Consolidação pendente — herdada da Etapa 1, continua valendo */}
      {isGerente && semEndereco > 0 && (
        <button
          className="elevavel"
          onClick={() => navigate({ to: "/clientes/migrar" })}
          style={{
            ...card(isLight),
            border: `1px solid ${PRISMA.azulClaro.border}`,
            background: PRISMA.azulClaro.bg,
            borderRadius: 16, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer",
            color: textPrimary,
          }}
        >
          <Wand2 size={18} color={isLight ? PRISMA.azulClaro.light : PRISMA.azulClaro.dark} />
          <span style={{ flex: 1, fontFamily: FONT, fontWeight: 400, fontSize: 13 }}>
            {semEndereco} cadastro{semEndereco === 1 ? "" : "s"} sem endereço, vindo{semEndereco === 1 ? "" : "s"} das visitas antigas.
            <br />
            <span style={{ color: textSecondary, fontSize: 12 }}>Toque para revisar e consolidar por prédio.</span>
          </span>
        </button>
      )}

      {/* Busca + filtros na mesma linha (desktop); empilha sozinho no celular */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="trilho-x" style={{ display: "flex", gap: 8, flex: 1, minWidth: 240 }}>
          {([
            ["todos", `Todos · ${contagem.todos}`],
            ["ativo", `Ativos · ${contagem.ativo}`],
            ["prospecto", `Prospectos · ${contagem.prospecto}`],
            ["inativo", `Inativos · ${contagem.inativo}`],
          ] as [Filtro, string][]).map(([valor, rotulo]) => (
            <button key={valor} style={chipFiltro(filtro === valor)} onClick={() => setFiltro(valor)}>
              {rotulo}
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
                  ? "Cadastre os condomínios e empresas atendidos pela Prever."
                  : "Ajuste a busca ou o filtro de situação."}
              </span>
            </div>
          ) : (
            lista.map((c) => {
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
        </div>

        <MapaClientes clientes={lista} />
      </div>
    </div>
  );
}
