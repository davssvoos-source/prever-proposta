// Abertura de chamado pelo gestor (SAC) — Etapa 3 do sistema de OS.
// Cliente → sistema afetado → problema/prioridade → técnico e agenda.
// O número e o prazo de atendimento (SLA) são preenchidos pelo banco.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useTecnicos } from "@/features/gerencial/data";
import { useClientes } from "@/features/clientes/data";
import { useInventario } from "@/features/clientes/inventario";
import { abrirOs, useSla } from "@/features/os/data";
import {
  OS_TIPO_LABEL, OS_PRIORIDADE_LABEL, OS_PRIORIDADE_CORES,
  type OsPrioridade, type OsTipo,
} from "@/lib/os-status";

export const Route = createFileRoute("/_authenticated/os/nova")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase
      .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
    if (!["admin", "comercial"].includes((perfil as any)?.cargo ?? "")) {
      throw redirect({ to: "/os" });
    }
  },
  component: NovaOsPage,
});

function NovaOsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: clientes = [] } = useClientes();
  const { data: tecnicos = [] } = useTecnicos();
  const { data: sla = {} } = useSla();

  const [tipo, setTipo] = useState<OsTipo>("corretiva");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [sistemaId, setSistemaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<OsPrioridade>("normal");
  const [tecnicoId, setTecnicoId] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");

  const { data: sistemas = [] } = useInventario(clienteId ?? undefined);
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";

  const CARD: CSSProperties = {
    background: isLight
      ? "linear-gradient(135deg,#ffffff 0%,#f5f6f8 100%)"
      : "linear-gradient(160deg, #14141b 0%, #0b0b10 100%)",
    border: isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,192,0,0.10)",
    borderRadius: 18, padding: "16px",
    boxShadow: isLight ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    display: "flex", flexDirection: "column", gap: 12,
  };
  const SEC: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 10,
    letterSpacing: "0.16em", textTransform: "uppercase",
    color: isLight ? "rgba(0,0,0,0.5)" : "rgba(255,192,0,0.65)",
  };
  const LABEL: CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10,
    letterSpacing: "0.12em", textTransform: "uppercase",
    color: textSecondary, marginBottom: 6, display: "block",
  };
  const INPUT: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 46, borderRadius: 12, padding: "0 14px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 14,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };
  const chip = (ativo: boolean, cores?: { bg: string; border: string; cor: string }): CSSProperties => ({
    padding: "9px 13px", borderRadius: 11,
    border: ativo ? "none" : isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,215,0,0.16)",
    background: ativo
      ? cores
        ? cores.bg
        : "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)"
      : isLight ? "#f5f6f8" : "rgba(255,255,255,0.03)",
    color: ativo ? (cores ? cores.cor : "#08090E") : textPrimary,
    boxShadow: ativo && cores ? `inset 0 0 0 1px ${cores.border}` : undefined,
    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer",
  });

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!termo) return [];
    return clientes.filter((c) =>
      `${c.nome} ${c.endereco ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(termo),
    );
  }, [clientes, buscaCliente]);

  // agenda do técnico escolhido, para não marcar em cima de outro chamado
  const { data: agenda = [] } = useQuery({
    queryKey: ["os-agenda-tecnico", tecnicoId],
    enabled: !!tecnicoId,
    queryFn: async () => {
      const de = new Date(); de.setDate(de.getDate() - 1);
      const ate = new Date(); ate.setDate(ate.getDate() + 14);
      const { data, error } = await supabase
        .from("ordens_servico" as any)
        .select("id, numero, titulo, data_hora_agendada, status")
        .eq("tecnico_id", tecnicoId)
        .not("data_hora_agendada", "is", null)
        .gte("data_hora_agendada", de.toISOString())
        .lte("data_hora_agendada", ate.toISOString())
        .order("data_hora_agendada");
      if (error) throw error;
      return ((data as any[]) ?? []).filter((o) => ["aberta", "agendada", "em_atendimento"].includes(o.status));
    },
  });

  const horasPrazo = sla[prioridade] ?? null;
  const prazoPrevisto = useMemo(() => {
    if (horasPrazo == null) return null;
    const d = new Date();
    d.setHours(d.getHours() + horasPrazo);
    return d;
  }, [horasPrazo]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Escolha o cliente do chamado.");
      if (!titulo.trim()) throw new Error("Descreva o assunto do chamado.");
      const agendada = data && hora ? new Date(`${data}T${hora}:00`).toISOString() : null;
      return abrirOs({
        tipo,
        cliente_id: clienteId,
        cliente_sistema_id: sistemaId,
        titulo: titulo.trim(),
        descricao_problema: descricao.trim() || null,
        prioridade,
        tecnico_id: tecnicoId || null,
        data_hora_agendada: agendada,
      });
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["ordens-servico"] });
      toast.success("Chamado aberto!");
      navigate({ to: "/os/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate({ to: "/os" })}
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
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 18 }}>Abrir chamado</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            O número é gerado ao salvar
          </div>
        </div>
      </div>

      {/* Tipo */}
      <div style={CARD}>
        <span style={SEC}>Tipo de atendimento</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["corretiva", "preventiva", "implantacao"] as OsTipo[]).map((t) => (
            <button key={t} style={chip(tipo === t)} onClick={() => setTipo(t)}>
              {OS_TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente + sistema */}
      <div style={CARD}>
        <span style={SEC}>Cliente</span>
        {cliente ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Building2 size={18} color={gold} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14 }}>{cliente.nome}</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                {cliente.endereco ?? "sem endereço"}
              </div>
            </div>
            <button
              onClick={() => { setClienteId(null); setSistemaId(null); setBuscaCliente(""); }}
              style={{
                height: 34, padding: "0 12px", borderRadius: 10, flexShrink: 0,
                background: isLight ? "#ffffff" : "#191921",
                border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                color: textPrimary, cursor: "pointer",
                fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600,
              }}
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <Search size={15} color={textSecondary} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ ...INPUT, paddingLeft: 36 }}
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar cliente por nome ou endereço"
              />
            </div>
            {buscaCliente.trim() !== "" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {clientesFiltrados.length === 0 ? (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
                    Nenhum cliente encontrado. Cadastre em Gerencial → Clientes.
                  </span>
                ) : (
                  clientesFiltrados.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteId(c.id); setBuscaCliente(""); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                        background: isLight ? "#ffffff" : "rgba(255,255,255,0.03)",
                        border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                        color: textPrimary,
                      }}
                    >
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>{c.nome}</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                        {c.endereco ?? "sem endereço"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {cliente && (
          <div>
            <label style={LABEL}>Sistema afetado (opcional)</label>
            {sistemas.length === 0 ? (
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                Este cliente ainda não tem inventário — registre os sistemas na ficha do cliente.
              </span>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sistemas.map((s) => (
                  <button
                    key={s.id}
                    style={chip(sistemaId === s.id)}
                    onClick={() => setSistemaId(sistemaId === s.id ? null : s.id)}
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Problema */}
      <div style={CARD}>
        <span style={SEC}>Problema relatado</span>
        <div>
          <label style={LABEL}>Assunto</label>
          <input
            style={INPUT}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: portão da garagem não abre pelo controle"
          />
        </div>
        <div>
          <label style={LABEL}>Detalhes (o que o cliente relatou)</label>
          <textarea
            style={{ ...INPUT, height: 96, padding: "12px 14px", resize: "vertical" }}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Quem informou, desde quando, o que já tentaram…"
          />
        </div>
        <div>
          <label style={LABEL}>Prioridade</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["baixa", "normal", "alta", "urgente"] as OsPrioridade[]).map((p) => {
              const c = OS_PRIORIDADE_CORES[p];
              return (
                <button
                  key={p}
                  style={chip(prioridade === p, { bg: c.bg, border: c.border, cor: isLight ? c.light : c.dark })}
                  onClick={() => setPrioridade(p)}
                >
                  {OS_PRIORIDADE_LABEL[p]}
                </button>
              );
            })}
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary, marginTop: 8 }}>
            {horasPrazo == null
              ? "Sem prazo definido — agendável livremente."
              : `Prazo de atendimento: ${horasPrazo}h · vence ${prazoPrevisto?.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          </div>
        </div>
      </div>

      {/* Técnico e agenda */}
      <div style={CARD}>
        <span style={SEC}>Técnico e agenda</span>
        <div>
          <label style={LABEL}>Técnico responsável</label>
          <select style={INPUT} value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
            <option value="">Definir depois</option>
            {tecnicos.map((t: any) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={LABEL}>Data</label>
            <input style={INPUT} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Hora</label>
            <input style={INPUT} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        {tecnicoId && agenda.length > 0 && (
          <div>
            <label style={LABEL}>Já agendado para este técnico</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {agenda.slice(0, 6).map((a: any) => (
                <span key={a.id} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: textSecondary }}>
                  {new Date(a.data_hora_agendada).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })} · {a.numero} {a.titulo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => criar.mutate()}
        disabled={criar.isPending}
        style={{
          width: "100%", height: 56, borderRadius: 28, border: "none",
          background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)", color: "#08090E",
          fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
          letterSpacing: "0.16em", textTransform: "uppercase",
          cursor: criar.isPending ? "wait" : "pointer", opacity: criar.isPending ? 0.7 : 1,
          boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
        }}
      >
        {criar.isPending ? "Abrindo…" : "Abrir chamado"}
      </button>
    </div>
  );
}
