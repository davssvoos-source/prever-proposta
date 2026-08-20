// Fechamentos — lista e montagem do período. Etapa U5 da unificação.
// Rota filha (/fechamentos/$id) entra pelo Outlet.

import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { createFileRoute, useNavigate, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, CircleDollarSign, Lock, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, GOLD_GLOW, card } from "@/lib/ui";
import { rotuloReferencia, dataIso } from "@/lib/periodos";
import { useClientes } from "@/features/clientes/data";
import { moeda, useCobrancasAbertas } from "@/features/chamados/cobranca";
import {
  useFechamentos, montarFechamento, lancarCobrancaAvulsa, type TipoFechamento,
} from "@/features/financeiro/fechamentos";

export const Route = createFileRoute("/_authenticated/fechamentos")({
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("fechamentos");
    if (!ok) throw redirect({ to: destinoNegado("fechamentos") as any });
  },
  component: FechamentosPage,
});

function FechamentosPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: fechamentos = [], isLoading } = useFechamentos();
  const { data: abertas = [] } = useCobrancasAbertas();
  const { data: clientes = [] } = useClientes();

  const [lancando, setLancando] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [tipoServico, setTipoServico] = useState<"instalacao" | "manutencao">("manutencao");
  const [dataBase, setDataBase] = useState(dataIso(new Date()));

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";
  const CARD: CSSProperties = { ...card(isLight), padding: "14px 16px" };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontWeight: 300, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const LABEL: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };

  const semFechamento = useMemo(() => abertas.filter((c) => !c.fechamento_id), [abertas]);
  const totalSolto = useMemo(
    () => semFechamento.reduce((s, c) => s + Number(c.valor), 0),
    [semFechamento],
  );

  const montar = useMutation({
    mutationFn: (tipo: TipoFechamento) => montarFechamento(tipo),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["fechamentos"] });
      qc.invalidateQueries({ queryKey: ["cobrancas-abertas"] });
      toast.success(
        r.itens === 0
          ? `Período ${r.referencia} já estava completo.`
          : `${r.itens} cobrança(s) recolhidas em ${r.referencia} — ${moeda(r.total)}.`,
      );
      navigate({ to: "/fechamentos/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lancar = useMutation({
    mutationFn: async () => {
      const v = Number(valor.replace(",", "."));
      const n = Number(parcelas);
      if (!clienteId) throw new Error("Escolha o cliente.");
      if (!descricao.trim()) throw new Error("Descreva a cobrança.");
      if (!Number.isFinite(v) || v <= 0) throw new Error("Informe um valor maior que zero.");
      if (!Number.isFinite(n) || n < 1) throw new Error("Número de parcelas inválido.");
      const [a, m, d] = dataBase.split("-").map(Number);
      return lancarCobrancaAvulsa({
        clienteId,
        descricao: descricao.trim(),
        valorTotal: v,
        parcelas: n,
        tipoServico,
        dataBase: new Date(a, (m ?? 1) - 1, d ?? 1),
      });
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["cobrancas-abertas"] });
      setLancando(false);
      setDescricao(""); setValor(""); setParcelas("1");
      toast.success(n > 1 ? `${n} parcelas lançadas.` : "Cobrança lançada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (pathname !== "/fechamentos") return <Outlet />;

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Fechamentos</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            {semFechamento.length} cobrança(s) aguardando período
          </div>
        </div>
        <button
          onClick={() => setLancando((v) => !v)}
          title="Lançamento avulso"
          style={{
            height: 42, padding: "0 14px", borderRadius: 12, border: "none",
            background: GOLD_GRAD, color: "#08090E", display: "flex", alignItems: "center", gap: 6,
            fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: "pointer", boxShadow: GOLD_GLOW,
          }}
        >
          <Plus size={16} /> Lançar
        </button>
      </div>

      {/* Lançamento avulso — mensalidade, acerto, parcela de instalação */}
      {lancando && (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.16em",
            textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
          }}>
            Lançamento avulso
          </span>
          <select style={INPUT} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Escolher cliente…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input
            style={INPUT}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: Mensalidade de portaria remota"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", gap: 8 }}>
            <div>
              <label style={LABEL}>Valor total</label>
              <input style={INPUT} value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" />
            </div>
            <div>
              <label style={LABEL}>Parcelas</label>
              <input style={INPUT} value={parcelas} onChange={(e) => setParcelas(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label style={LABEL}>1ª competência</label>
              <input style={INPUT} type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["manutencao", "instalacao"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipoServico(t)}
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: 12, cursor: "pointer",
                  border: tipoServico === t ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
                  background: tipoServico === t ? GOLD_GRAD : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
                  color: tipoServico === t ? "#08090E" : textPrimary,
                  fontFamily: FONT, fontWeight: 600, fontSize: 12,
                }}
              >
                {t === "manutencao" ? "Manutenção" : "Instalação"}
              </button>
            ))}
          </div>
          {Number(parcelas) > 1 && (
            <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary }}>
              Cada parcela cai numa competência seguinte. A divisão é em centavos, com o resto na primeira —
              a soma fecha exatamente o total.
            </span>
          )}
          <button
            onClick={() => lancar.mutate()}
            disabled={lancar.isPending}
            style={{
              height: 46, borderRadius: 23, border: "none", background: GOLD_GRAD, color: "#08090E",
              fontFamily: FONT, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
              opacity: lancar.isPending ? 0.6 : 1,
            }}
          >
            {lancar.isPending ? "Lançando…" : "Lançar cobrança"}
          </button>
        </div>
      )}

      {/* Cobranças soltas + montar período */}
      <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CircleDollarSign size={18} color={gold} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>
              {moeda(totalSolto)} aguardando fechamento
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 300, color: textSecondary }}>
              {semFechamento.length} cobrança(s) aprovadas ainda sem período
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["semanal", "mensal"] as const).map((t) => (
            <button
              key={t}
              onClick={() => montar.mutate(t)}
              disabled={montar.isPending}
              style={{
                flex: 1, height: 44, borderRadius: 12, cursor: "pointer",
                background: isLight ? "#ffffff" : "rgba(255,255,255,0.04)",
                border: `1px solid ${gold}`, color: gold,
                fontFamily: FONT, fontWeight: 700, fontSize: 12,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <CalendarRange size={15} />
              {montar.isPending ? "Montando…" : `Fechar ${t === "semanal" ? "semana" : "mês"}`}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11, color: textSecondary, lineHeight: 1.5 }}>
          Montar o período recolhe as cobranças da janela. Pode rodar de novo à vontade: só entra o que ainda
          não estava em nenhum fechamento.
        </span>
      </div>

      {/* Períodos */}
      {isLoading ? (
        <div style={{ ...CARD, textAlign: "center", color: textSecondary, fontFamily: FONT, fontSize: 13 }}>
          Carregando…
        </div>
      ) : fechamentos.length === 0 ? (
        <div style={{ ...CARD, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "26px 16px" }}>
          <TriangleAlert size={26} color={gold} />
          <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600 }}>Nenhum período montado</span>
          <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, textAlign: "center" }}>
            Monte a semana ou o mês para gerar o CSV e o PDF do financeiro.
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {fechamentos.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate({ to: "/fechamentos/$id", params: { id: f.id } })}
              style={{ ...CARD, display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600 }}>
                  {rotuloReferencia(f.referencia)}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 300, color: textSecondary, marginTop: 2 }}>
                  {f.tipo === "semanal" ? "Semanal" : "Mensal"} ·{" "}
                  {f.inicio.split("-").reverse().join("/")} a {f.fim.split("-").reverse().join("/")}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: gold }}>
                  {moeda(Number(f.total))}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end",
                  fontFamily: FONT, fontSize: 10, color: textSecondary, marginTop: 2,
                }}>
                  {f.status === "fechado" && <Lock size={10} />}
                  {f.status === "fechado" ? "Fechado" : "Aberto"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
