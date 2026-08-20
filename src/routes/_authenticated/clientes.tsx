// Lista de clientes (registro mestre) — Etapa 1 do sistema de OS.
// Layout das rotas filhas: /clientes/novo, /clientes/$id e /clientes/migrar
// renderizam pelo Outlet (mesmo padrão de gerencial.tsx).

import { createFileRoute, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, Building2, Plus, Search, MapPin, Users, Wand2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsGerente } from "@/features/gerencial/data";
import { TIPO_LABEL } from "@/features/gerencial/constants";
import {
  useClientes,
  SITUACAO_LABEL,
  SITUACAO_CORES,
  type SituacaoCliente,
} from "@/features/clientes/data";

export const Route = createFileRoute("/_authenticated/clientes")({
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
  const gold = isLight ? "#A06108" : "#F8C811";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(248,200,17,0.10)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
  };
  const LABEL: CSSProperties = {
    fontFamily: "var(--fonte)",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(248,200,17,0.65)",
  };

  const lista = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return clientes.filter((c) => {
      if (filtro !== "todos" && c.situacao !== filtro) return false;
      if (!termo) return true;
      const alvo = `${c.nome} ${c.endereco ?? ""} ${c.nome_sindico ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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
      ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)"
      : isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
    color: ativo ? "#08090E" : textPrimary,
    fontFamily: "var(--fonte)",
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/gerencial" })}
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
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 18 }}>Clientes</div>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            {contagem.todos} cadastrado{contagem.todos === 1 ? "" : "s"} · {contagem.ativo} ativo{contagem.ativo === 1 ? "" : "s"}
          </div>
        </div>
        {isGerente && (
          <button
            onClick={() => navigate({ to: "/clientes/novo" })}
            style={{
              height: 40, padding: "0 16px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
              color: "#08090E", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 12,
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <Plus size={16} />
            Novo
          </button>
        )}
      </div>

      {/* Aviso de consolidação pendente */}
      {isGerente && semEndereco > 0 && (
        <button
          onClick={() => navigate({ to: "/clientes/migrar" })}
          style={{
            ...CARD,
            border: isLight ? "1px solid rgba(96,165,250,0.45)" : "1px solid rgba(96,165,250,0.35)",
            background: isLight ? "rgba(96,165,250,0.08)" : "rgba(96,165,250,0.10)",
            display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer",
            color: textPrimary,
          }}
        >
          <Wand2 size={18} color={isLight ? "#1d4ed8" : "#60A5FA"} />
          <span style={{ flex: 1, fontFamily: "var(--fonte)", fontSize: 13 }}>
            {semEndereco} cadastro{semEndereco === 1 ? "" : "s"} sem endereço, vindo{semEndereco === 1 ? "" : "s"} das visitas antigas.
            <br />
            <span style={{ color: textSecondary, fontSize: 12 }}>Toque para revisar e consolidar por prédio.</span>
          </span>
        </button>
      )}

      {/* Busca */}
      <div style={{ position: "relative" }}>
        <Search
          size={16}
          color={textSecondary}
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, endereço ou síndico"
          style={{
            width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14,
            padding: "0 14px 0 38px",
            background: isLight ? "#ffffff" : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
            border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.10)",
            color: textPrimary, fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 14,
            outline: "none", colorScheme: isLight ? "light" : "dark",
          }}
        />
      </div>

      {/* Filtros */}
      <div className="trilho-x" style={{ display: "flex", gap: 8, paddingBottom: 2 }}>
        {([
          ["todos", `Todos (${contagem.todos})`],
          ["ativo", `Ativos (${contagem.ativo})`],
          ["prospecto", `Prospectos (${contagem.prospecto})`],
          ["inativo", `Inativos (${contagem.inativo})`],
        ] as [Filtro, string][]).map(([valor, rotulo]) => (
          <button key={valor} style={chipFiltro(filtro === valor)} onClick={() => setFiltro(valor)}>
            {rotulo}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: "var(--fonte)", fontSize: 13 }}>
          Carregando clientes…
        </div>
      ) : lista.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px" }}>
          <Building2 size={28} color={gold} />
          <span style={{ fontFamily: "var(--fonte)", fontSize: 14, fontWeight: 600 }}>
            {clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"}
          </span>
          <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, textAlign: "center" }}>
            {clientes.length === 0
              ? "Cadastre os condomínios e empresas atendidos pela Prever para abrir chamados e registrar os equipamentos."
              : "Ajuste a busca ou o filtro de situação."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lista.map((c) => {
            const cor = SITUACAO_CORES[c.situacao] ?? SITUACAO_CORES.ativo;
            return (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}
                style={{ ...CARD, textAlign: "left", cursor: "pointer", color: textPrimary, display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: isLight ? "rgba(160,97,8,0.10)" : "rgba(248,200,17,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Building2 size={18} color={gold} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 14 }}>{c.nome}</span>
                    <span
                      style={{
                        padding: "3px 8px", borderRadius: 12,
                        background: cor.bg, border: `1px solid ${cor.border}`,
                        color: isLight ? cor.light : cor.dark,
                        fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 9,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                      }}
                    >
                      {SITUACAO_LABEL[c.situacao] ?? c.situacao}
                    </span>
                  </div>
                  {c.endereco ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                      <MapPin size={12} color={textSecondary} style={{ flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
                        {c.endereco}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: isLight ? "#A63E17" : "#F8C811", marginTop: 4 }}>
                      sem endereço — precisa de revisão
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                    {c.tipo_local && (
                      <span style={{ ...LABEL, color: textSecondary }}>{TIPO_LABEL[c.tipo_local] ?? c.tipo_local}</span>
                    )}
                    {c.nome_sindico && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--fonte)", fontSize: 11, color: textSecondary }}>
                        <Users size={11} /> {c.nome_sindico}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
