// O pop-up de cadastro de duplas (R56/U47) — Davi, 2026-08-22: "adicione um
// botão no painel operacional que leva para um pop up de um campo com as
// opções para cadastrar duplas de acordo com os usuários do sistema."
//
// As opções vêm de `useTecnicos()` (profiles ativos com cargo 'tecnico') —
// "de acordo com os usuários do sistema", literalmente: quem não tem usuário
// não aparece aqui, e é por isso que o Davi está criando um usuário para cada
// técnico antes de montar as duplas.
//
// DESATIVA, NÃO APAGA: a dupla desfeita ainda explica o histórico do gráfico.
// Ver o comentário de useSalvarDupla em ./data.ts.

import { useMemo, useState, type CSSProperties } from "react";
import { Pencil, Plus, RotateCcw, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD, card } from "@/lib/ui";
import { useTecnicos } from "@/features/gerencial/data";
import { useDuplas, useSalvarDupla } from "./data";
import { erroDaDupla, membrosDaDupla, rotuloDaDupla, type Dupla } from "./modelo";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

export function DialogoDuplas({ aberto, aoFechar }: Props) {
  const { isLight } = useTheme();
  const { data: duplas = [] } = useDuplas();
  const { data: tecnicos = [] } = useTecnicos();
  const salvar = useSalvarDupla();

  const [emEdicao, setEmEdicao] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [membroA, setMembroA] = useState("");
  const [membroB, setMembroB] = useState("");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";

  const nomePorId = useMemo(
    () => Object.fromEntries((tecnicos as any[]).map((t) => [t.id, t.nome ?? "—"])) as Record<string, string>,
    [tecnicos],
  );
  const nomeDe = (id: string) => nomePorId[id] ?? "Técnico";

  const ativas = duplas.filter((d) => d.ativa);
  const inativas = duplas.filter((d) => !d.ativa);

  function limpar() {
    setEmEdicao(null);
    setNome("");
    setMembroA("");
    setMembroB("");
  }

  function carregarParaEdicao(d: Dupla) {
    setEmEdicao(d.id);
    setNome(d.nome);
    setMembroA(d.membro_a);
    setMembroB(d.membro_b ?? "");
  }

  function submeter() {
    const erro = erroDaDupla(
      { nome, membroA: membroA || null, membroB: membroB || null },
      duplas,
      nomeDe,
      emEdicao ?? undefined,
    );
    if (erro) { toast.error(erro); return; }
    const dados = { nome: nome.trim(), membro_a: membroA, membro_b: membroB || null };
    salvar.mutate(
      emEdicao ? { tipo: "editar", id: emEdicao, dados } : { tipo: "criar", dados },
      {
        onSuccess: () => {
          toast.success(emEdicao ? "Dupla atualizada." : "Dupla cadastrada.");
          limpar();
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  if (!aberto) return null;

  const rotulo: CSSProperties = {
    fontFamily: FONT, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: textSecondary, marginBottom: 6, display: "block",
  };
  const entrada: CSSProperties = {
    width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, padding: "0 13px",
    background: isLight ? "#ffffff" : "#16161d",
    border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
    color: textPrimary, fontFamily: FONT, fontSize: 13.5,
    outline: "none", colorScheme: isLight ? "light" : "dark",
  };

  // quem já está em OUTRA dupla ativa não aparece nas opções: o banco recusaria
  // (índice + trigger da U47) e oferecer o nome seria convidar ao erro
  const disponiveis = (excetoEsteCampo: string) => (tecnicos as any[]).filter((t) => {
    if (t.id === excetoEsteCampo) return true;
    const outra = duplas.find(
      (d) => d.ativa && d.id !== emEdicao && membrosDaDupla(d).includes(t.id),
    );
    return !outra;
  });

  return (
    <div
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Cadastro de duplas de campo"
      style={{
        position: "fixed", inset: 0, zIndex: 100, padding: 20,
        background: isLight ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...card(isLight), padding: 18, width: "100%", maxWidth: 520,
          maxHeight: "86vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Users size={17} color={gold} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: textPrimary }}>
              Duplas de campo
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
              Quem sai com quem. A dupla de um atendimento vem do técnico responsável.
            </div>
          </div>
          <button
            onClick={aoFechar}
            aria-label="Fechar"
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0, cursor: "pointer",
              background: "transparent", color: textSecondary,
              border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── formulário ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label htmlFor="dupla-nome" style={rotulo}>Nome da dupla</label>
            <input
              id="dupla-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Dupla 1, Zona Sul, Preventivas…"
              style={entrada}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div>
              <label htmlFor="dupla-membro-a" style={rotulo}>Técnico</label>
              <select id="dupla-membro-a" value={membroA} onChange={(e) => setMembroA(e.target.value)} style={entrada}>
                <option value="">— escolher —</option>
                {disponiveis(membroA).map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div>
              {/* opcional de propósito: técnico sem par continua sendo uma
                  "dupla" de um, e continua aparecendo no filtro e no gráfico */}
              <label htmlFor="dupla-membro-b" style={rotulo}>Parceiro (opcional)</label>
              <select id="dupla-membro-b" value={membroB} onChange={(e) => setMembroB(e.target.value)} style={entrada}>
                <option value="">— sem parceiro —</option>
                {disponiveis(membroB).filter((t) => t.id !== membroA).map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            {emEdicao && (
              <button
                onClick={limpar}
                style={{
                  flex: 1, height: 44, borderRadius: 22, cursor: "pointer",
                  background: isLight ? "#f3f4f6" : "rgba(255,255,255,0.04)",
                  border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.10)",
                  color: textSecondary, fontFamily: FONT, fontSize: 13,
                }}
              >
                Cancelar edição
              </button>
            )}
            <button
              onClick={submeter}
              disabled={salvar.isPending}
              style={{
                flex: 2, height: 44, borderRadius: 22, border: "none", background: GOLD_GRAD,
                color: "#08090E", fontFamily: FONT, fontWeight: 700, fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                cursor: salvar.isPending ? "default" : "pointer", opacity: salvar.isPending ? 0.6 : 1,
              }}
            >
              {emEdicao ? <Pencil size={15} /> : <Plus size={16} />}
              {salvar.isPending ? "Salvando…" : emEdicao ? "Salvar dupla" : "Cadastrar dupla"}
            </button>
          </div>
        </div>

        {/* ── as duplas que já existem ───────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{
            fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase", color: gold,
          }}>
            Duplas ativas ({ativas.length})
          </span>
          {ativas.length === 0 ? (
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 12, color: textSecondary }}>
              Nenhuma dupla cadastrada ainda.
            </span>
          ) : (
            ativas.map((d) => (
              <LinhaDupla
                key={d.id} dupla={d} nomeDe={nomeDe} isLight={isLight}
                aoEditar={() => carregarParaEdicao(d)}
                aoAlternar={() => salvar.mutate(
                  { tipo: "desativar", id: d.id },
                  { onSuccess: () => toast.success("Dupla desfeita."), onError: (e: Error) => toast.error(e.message) },
                )}
              />
            ))
          )}

          {inativas.length > 0 && (
            <>
              <span style={{
                fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em",
                textTransform: "uppercase", color: textSecondary, marginTop: 4,
              }}>
                Desfeitas ({inativas.length})
              </span>
              {inativas.map((d) => (
                <LinhaDupla
                  key={d.id} dupla={d} nomeDe={nomeDe} isLight={isLight}
                  aoAlternar={() => salvar.mutate(
                    { tipo: "reativar", id: d.id },
                    { onSuccess: () => toast.success("Dupla reativada."), onError: (e: Error) => toast.error(e.message) },
                  )}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LinhaDupla({ dupla, nomeDe, isLight, aoEditar, aoAlternar }: {
  dupla: Dupla; nomeDe: (id: string) => string; isLight: boolean;
  aoEditar?: () => void; aoAlternar: () => void;
}) {
  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const botao: CSSProperties = {
    width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: "pointer",
    background: "transparent", color: textSecondary,
    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12,
      background: isLight ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.045)",
      opacity: dupla.ativa ? 1 : 0.6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: textPrimary }}>
          {rotuloDaDupla(dupla, nomeDe)}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
          {membrosDaDupla(dupla).map(nomeDe).join(" · ")}
        </div>
      </div>
      {aoEditar && (
        <button onClick={aoEditar} aria-label={`Editar ${rotuloDaDupla(dupla, nomeDe)}`} style={botao}>
          <Pencil size={13} />
        </button>
      )}
      <button
        onClick={aoAlternar}
        aria-label={dupla.ativa ? `Desfazer ${rotuloDaDupla(dupla, nomeDe)}` : `Reativar ${rotuloDaDupla(dupla, nomeDe)}`}
        title={dupla.ativa ? "Desfazer a dupla" : "Reativar a dupla"}
        style={botao}
      >
        {dupla.ativa ? <X size={14} /> : <RotateCcw size={13} />}
      </button>
    </div>
  );
}
