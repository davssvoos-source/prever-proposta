// Detalhe do fechamento — instalações × manutenções, CSV e PDF para o
// financeiro. Etapa U5 da unificação.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileDown, FileSpreadsheet, Lock, LockOpen, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { rotuloReferencia } from "@/lib/periodos";
import { formatarDocumento } from "@/lib/normalizar";
import { moeda } from "@/features/os/cobranca";
import {
  useFechamento, useCobrancasDoFechamento, consolidar, csvFechamento,
  gerarPdfFechamento, baixarArquivo, montarFechamento, fecharPeriodo,
  reabrirPeriodo, excluirFechamento,
} from "@/features/financeiro/fechamentos";

export const Route = createFileRoute("/_authenticated/fechamentos/$id")({
  component: FechamentoDetalhePage,
});

function FechamentoDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: f, isLoading } = useFechamento(id);
  const { data: cobrancas = [] } = useCobrancasDoFechamento(id);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";
  const CARD: CSSProperties = { ...card(isLight), padding: "16px", display: "flex", flexDirection: "column", gap: 12 };
  const btn: CSSProperties = {
    height: 44, padding: "0 14px", borderRadius: 22, cursor: "pointer",
    background: isLight ? "#ffffff" : "#191921",
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    fontFamily: FONT, fontWeight: 600, fontSize: 12,
  };

  const { secoes, total } = useMemo(() => consolidar(cobrancas), [cobrancas]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["fechamento", id] });
    qc.invalidateQueries({ queryKey: ["fechamento-cobrancas", id] });
    qc.invalidateQueries({ queryKey: ["fechamentos"] });
    qc.invalidateQueries({ queryKey: ["cobrancas-abertas"] });
  };

  const recolher = useMutation({
    mutationFn: () => montarFechamento(f!.tipo, f!.inicio),
    onSuccess: (r) => {
      invalidar();
      toast.success(r.itens === 0 ? "Nada novo para recolher." : `${r.itens} cobrança(s) adicionadas.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fechar = useMutation({
    mutationFn: () => fecharPeriodo(id),
    onSuccess: (n) => { invalidar(); toast.success(`${n} cobrança(s) fechadas.`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: () => reabrirPeriodo(id),
    onSuccess: (n) => { invalidar(); toast.success(`${n} cobrança(s) reabertas.`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: () => excluirFechamento(id),
    onSuccess: (n) => {
      invalidar();
      toast.success(`Período excluído. ${n} cobrança(s) voltaram para a fila.`);
      navigate({ to: "/fechamentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: FONT }}>Carregando…</div>;
  }
  if (!f) {
    return <div style={{ padding: 24, textAlign: "center", color: textSecondary, fontFamily: FONT }}>Período não encontrado.</div>;
  }

  const fechado = f.status === "fechado";

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/fechamentos" })}
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
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18 }}>
            {rotuloReferencia(f.referencia)}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11.5, color: textSecondary, marginTop: 2 }}>
            {f.tipo === "semanal" ? "Semanal" : "Mensal"} ·{" "}
            {f.inicio.split("-").reverse().join("/")} a {f.fim.split("-").reverse().join("/")}
            {fechado && f.fechado_em && ` · fechado em ${new Date(f.fechado_em).toLocaleDateString("pt-BR")}`}
          </div>
        </div>
        <span style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 999,
          fontFamily: FONT, fontWeight: 600, fontSize: 9.5,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: fechado ? (isLight ? "#047857" : "#34D399") : gold,
          background: fechado ? "rgba(52,211,153,0.12)" : "rgba(255,192,0,0.12)",
          border: `1px solid ${fechado ? "rgba(52,211,153,0.30)" : "rgba(255,192,0,0.30)"}`,
        }}>
          {fechado ? <Lock size={10} /> : null}
          {fechado ? "Fechado" : "Aberto"}
        </span>
      </div>

      {/* Total */}
      <div style={{ ...CARD, alignItems: "center", gap: 2 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: textSecondary }}>
          Total do período
        </span>
        <span style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, color: gold }}>
          {moeda(total)}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 300, color: textSecondary }}>
          {cobrancas.length} cobrança(s)
        </span>
      </div>

      {/* Entrega para o financeiro */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{ ...btn, flex: 1 }}
          onClick={() => {
            baixarArquivo(
              `fechamento-${f.tipo}-${f.referencia}.csv`,
              csvFechamento(f, cobrancas),
              "text/csv;charset=utf-8",
            );
            toast.success("CSV baixado.");
          }}
        >
          <FileSpreadsheet size={15} color={gold} /> CSV
        </button>
        <button
          style={{ ...btn, flex: 1 }}
          onClick={async () => {
            await gerarPdfFechamento(f, cobrancas);
            toast.success("PDF gerado.");
          }}
        >
          <FileDown size={15} color={gold} /> PDF
        </button>
      </div>

      {/* Seções */}
      {secoes.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center" }}>
          <span style={{ fontFamily: FONT, fontSize: 13, color: textSecondary }}>
            Nenhuma cobrança neste período ainda.
          </span>
        </div>
      ) : (
        secoes.map((secao) => (
          <div key={secao.titulo} style={CARD}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em",
                textTransform: "uppercase", color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
              }}>
                {secao.titulo}
              </span>
              <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 13, fontWeight: 700 }}>
                {moeda(secao.total)}
              </span>
            </div>
            {secao.grupos.map((g) => (
              <div key={g.clienteId} style={{
                padding: "10px 12px", borderRadius: 12,
                background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>{g.nome}</div>
                    {g.documento && (
                      <div style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 300, color: textSecondary }}>
                        {formatarDocumento(g.documento)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: gold }}>
                    {moeda(g.subtotal)}
                  </span>
                </div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  {g.itens.map((it) => (
                    <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, flexShrink: 0 }}>
                        {it.data_referencia.split("-").reverse().join("/")}
                      </span>
                      <span style={{ flex: 1, fontFamily: FONT, fontSize: 11.5, fontWeight: 300, color: textPrimary }}>
                        {it.descricao}
                      </span>
                      <span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, flexShrink: 0 }}>
                        {moeda(Number(it.valor))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Ações do período */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!fechado && (
          <>
            <button style={{ ...btn, flex: 1 }} onClick={() => recolher.mutate()} disabled={recolher.isPending}>
              <RefreshCw size={15} color={gold} />
              {recolher.isPending ? "Recolhendo…" : "Recolher novas"}
            </button>
            <button
              style={{
                ...btn, flex: 1, border: "none", background: GOLD_GRAD, color: "#08090E", fontWeight: 700,
              }}
              onClick={() => fechar.mutate()}
              disabled={fechar.isPending || cobrancas.length === 0}
            >
              <Lock size={15} />
              {fechar.isPending ? "Fechando…" : "Fechar período"}
            </button>
          </>
        )}
        {fechado && (
          <button style={{ ...btn, flex: 1 }} onClick={() => reabrir.mutate()} disabled={reabrir.isPending}>
            <LockOpen size={15} color={gold} />
            {reabrir.isPending ? "Reabrindo…" : "Reabrir período"}
          </button>
        )}
      </div>

      <button
        onClick={() => {
          if (
            confirm(
              "Excluir este período? As cobranças NÃO são apagadas — voltam para a fila e podem entrar em outro fechamento.",
            )
          ) {
            excluir.mutate();
          }
        }}
        style={{
          height: 46, borderRadius: 23, background: "none",
          border: isLight ? "1px solid rgba(185,28,28,0.30)" : "1px solid rgba(248,113,113,0.30)",
          color: isLight ? "#b91c1c" : "#F87171",
          fontFamily: FONT, fontWeight: 600, fontSize: 12.5, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}
      >
        <Trash2 size={14} /> Excluir período
      </button>
    </div>
  );
}
