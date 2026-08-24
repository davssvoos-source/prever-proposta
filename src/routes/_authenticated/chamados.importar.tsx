// Importação do quadro do Notion — U1, revista no export de 2026-08-21 (U31).
//
// A tela é só a casca: ler o arquivo, MOSTRAR o que vai acontecer e gravar.
// As regras de leitura (datas em português, status novos, células com vários
// valores, apelidos de cliente) moram em features/chamados/importar-notion.ts,
// que é testado contra o arquivo real no verificador.
//
// A prévia é o coração desta tela. Importação é operação que mexe em muita
// linha de uma vez e é chata de desfazer; mostrar antes o que casou, o que
// não casou e o que vai ser PULADO é o que transforma "confia em mim" em uma
// decisão informada do Davi.

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Upload, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { guardaDeTela, destinoNegado } from "@/features/gerencial/permissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { useClientes } from "@/features/clientes/data";
import { usePessoas } from "@/features/chamados/data";
import { normalizarTexto } from "@/lib/normalizar";
import { card } from "@/lib/ui";
import { SPRINT_LABEL, TIPO_LABEL, dataParaPrazo } from "@/lib/chamado-status";
import { EQUIPE_LABEL } from "@/lib/equipes";
import {
  lerLinhas, indicePessoas,
  type LinhaImport, type ResultadoLeitura,
} from "@/features/chamados/importar-notion";

export const Route = createFileRoute("/_authenticated/chamados/importar")({
  // guarda própria: o pai /chamados virou tronco (R31) e não gateia ninguém
  beforeLoad: async () => {
    const { ok } = await guardaDeTela("chamados.importar");
    if (!ok) throw redirect({ to: destinoNegado("chamados.importar") as any });
  },
  component: ImportarChamadosPage,
});

/** Parser mínimo com suporte a aspas e quebra de linha dentro do campo. */
function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === ",") { linha.push(campo); campo = ""; continue; }
    if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; continue; }
    campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Sinônimos de cabeçalho — o Notion renomeia coluna e o export muda de nome. */
const SINONIMOS: Record<string, string[]> = {
  titulo: ["resumo da demanda", "titulo", "title", "name", "nome", "tarefa", "demanda"],
  descricao: ["descricao", "description", "detalhes", "observacoes"],
  responsavel: ["responsavel principal", "responsavel", "assignee", "owner", "dono"],
  cliente: ["cliente", "client", "condominio", "empresa"],
  sprint: ["sprint", "ciclo"],
  prazo: ["prazo", "prazo limite", "due", "data limite", "deadline", "vencimento"],
  equipe: ["equipe", "team", "time", "area"],
  status: ["status", "situacao", "estado"],
  conclusao: ["conclusao", "atividade concluida", "concluido em"],
  criacao: ["criacao", "created", "criado em"],
};

function acharColuna(cabecalho: string[], chave: string): string {
  const alvos = SINONIMOS[chave] ?? [chave];
  // do sinônimo mais específico para o mais genérico: "demanda" também casaria
  // com "Resumo da demanda", e a coluna certa é a primeira da lista
  for (const alvo of alvos) {
    const achou = cabecalho.find((h) => normalizarTexto(h) === alvo);
    if (achou) return achou;
  }
  for (const alvo of alvos) {
    const achou = cabecalho.find((h) => normalizarTexto(h).startsWith(alvo));
    if (achou) return achou;
  }
  return "";
}

function ImportarChamadosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();
  const [res, setRes] = useState<ResultadoLeitura | null>(null);
  const [arquivo, setArquivo] = useState("");

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#A06108" : "#F8C811";
  const verde = isLight ? "#047862" : "#2DD2A5";

  // superfície da casa (card v4) — a versão inline daqui tinha ficado no
  // vocabulário antigo e destoava das telas irmãs do grupo chamados
  const CARD: CSSProperties = {
    ...card(isLight),
    padding: "16px",
    display: "flex", flexDirection: "column", gap: 12,
  };

  const pessoasPorNome = useMemo(() => indicePessoas(pessoas as any[]), [pessoas]);

  const clientesPorNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) {
      m.set(normalizarTexto(c.nome), c.id);
      if ((c as any).nome_predio) m.set(normalizarTexto((c as any).nome_predio), c.id);
    }
    return m;
  }, [clientes]);

  function processar(texto: string) {
    const grade = lerCsv(texto);
    if (grade.length < 2) { toast.error("O arquivo não tem linhas de dados."); return; }
    const cab = grade[0].map((s) => s.trim());
    const col = {
      titulo: acharColuna(cab, "titulo"),
      descricao: acharColuna(cab, "descricao"),
      responsavel: acharColuna(cab, "responsavel"),
      cliente: acharColuna(cab, "cliente"),
      equipe: acharColuna(cab, "equipe"),
      sprint: acharColuna(cab, "sprint"),
      status: acharColuna(cab, "status"),
      prazo: acharColuna(cab, "prazo"),
      conclusao: acharColuna(cab, "conclusao"),
      criacao: acharColuna(cab, "criacao"),
    };
    if (!col.titulo) { toast.error('Não achei a coluna de título ("Resumo da demanda" ou "Name").'); return; }
    if (!col.criacao) { toast.error('Não achei a coluna "Criação" — ela é a chave que evita duplicar na reimportação.'); return; }

    const registros = grade.slice(1).map((l) =>
      Object.fromEntries(cab.map((c, i) => [c, (l[i] ?? "").trim()])),
    );
    const r = lerLinhas(registros, col, pessoasPorNome, clientesPorNome);
    if (!r.linhas.length) {
      toast.error("Nenhuma linha importável — confira se as pessoas do quadro têm conta no app.");
      return;
    }
    setRes(r);
  }

  const linhas: LinhaImport[] = res?.linhas ?? [];

  const importar = useMutation({
    mutationFn: async () => {
      if (!linhas.length) throw new Error("Nada para importar.");
      const { data: u } = await supabase.auth.getUser();
      const registros = linhas.map((l) => ({
        natureza: "interno",
        titulo: l.titulo,
        descricao_problema: l.descricao,
        cliente_id: l.clienteId,
        // U31: o nome como veio, para a etiqueta existir mesmo sem vínculo
        cliente_origem_nome: l.clienteNome,
        equipe: l.equipe,
        responsavel_id: l.responsavelId,
        prazo_limite: dataParaPrazo(l.prazo_limite),
        concluida_em: l.concluida_em,
        sprint: l.sprint,
        tipo: l.tipo,
        status: l.status,
        aberto_por: u.user?.id ?? null,
        origem: "notion",
        origem_id: l.origemId,
      }));
      // Grava em lotes: 2 mil linhas numa requisição só estoura o limite de
      // corpo do PostgREST, e o erro que volta ("payload too large") não diz
      // que o problema é o tamanho do lote.
      let total = 0;
      for (let i = 0; i < registros.length; i += 400) {
        const { error, count } = await supabase
          .from("chamados" as any)
          .upsert(registros.slice(i, i + 400) as any, {
            // o índice único (origem, origem_id) é o que segura a reimportação
            onConflict: "origem,origem_id", ignoreDuplicates: true, count: "exact",
          });
        if (error) throw error;
        total += count ?? 0;
      }
      return total;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      toast.success(n > 0 ? `${n} chamado(s) importado(s).` : "Tudo já estava no app — nada duplicado.");
      navigate({ to: "/dashboard" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na importação."),
  });

  const emAberto = linhas.filter((l) => !["concluido", "cancelado"].includes(l.status)).length;
  const comCliente = linhas.filter((l) => l.clienteId).length;
  const soNome = linhas.filter((l) => !l.clienteId && l.clienteNome).length;
  const puladosPorPessoa = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of res?.semConta ?? []) m.set(s.nome, (m.get(s.nome) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [res]);

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
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
        <div>
          <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 20 }}>
            Importar do Notion
          </div>
          <div style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary }}>
            Exporte o quadro como CSV e escolha o arquivo aqui.
          </div>
        </div>
      </div>

      <div style={CARD}>
        <label
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "28px 16px", borderRadius: 14, cursor: "pointer",
            border: isLight ? "1.5px dashed rgba(0,0,0,0.18)" : "1.5px dashed rgba(248,200,17,0.28)",
          }}
        >
          <Upload size={26} color={gold} />
          <span style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13.5 }}>
            {arquivo || "Escolher arquivo CSV"}
          </span>
          <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, textAlign: "center" }}>
            No Notion: ··· → Export → Markdown &amp; CSV. Use o arquivo terminado em
            {" "}<strong>_all.csv</strong> — é o que traz todas as colunas.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setArquivo(f.name);
              processar(await f.text());
            }}
          />
        </label>
      </div>

      {res && (
        <>
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={17} color={verde} />
              <span style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 14 }}>
                {linhas.length} atividade(s) prontas — {emAberto} em aberto
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Building2 size={16} color={gold} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                <strong style={{ color: textPrimary }}>{comCliente}</strong> vinculadas a um cliente do QAP
                {soNome > 0 && <> · <strong style={{ color: textPrimary }}>{soNome}</strong> guardam só o nome escrito no Notion (a etiqueta aparece igual, sem vínculo)</>}
              </span>
            </div>

            {/* Quem foi PULADO. É a informação mais importante da prévia: o
                que não entra é invisível depois, então tem que ser visível
                agora — com nome e quantidade, não só um número. */}
            {puladosPorPessoa.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <UserX size={16} color={gold} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--fonte)", fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                  <strong style={{ color: textPrimary }}>{res.semConta.length}</strong> puladas — o responsável não tem conta no app:{" "}
                  {puladosPorPessoa.map(([n, c]) => `${n} (${c})`).join(", ")}.
                  <br />
                  Entram quando a pessoa tiver conta. Importá-las sem responsável
                  as jogaria na fila de todo mundo.
                </span>
              </div>
            )}

            <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary, lineHeight: 1.5 }}>
              Reimportar o mesmo arquivo não duplica: a chave é a data de criação + o título.
            </span>
          </div>

          <div style={{ ...CARD, gap: 8, maxHeight: 420, overflowY: "auto" }}>
            {linhas.slice(0, 200).map((l, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px", borderRadius: 12,
                  background: isLight ? "#f9fafb" : "rgba(255,255,255,0.03)",
                  border: isLight ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontFamily: "var(--fonte)", fontWeight: 600, fontSize: 13 }}>
                  {l.titulo}
                </div>
                <div style={{
                  fontFamily: "var(--fonte)", fontWeight: 400, fontSize: 11,
                  color: textSecondary, marginTop: 3,
                }}>
                  {l.clienteNome && (
                    <span style={{ color: l.clienteId ? verde : gold }}>
                      {l.clienteNome}{l.clienteId ? "" : " (sem vínculo)"} ·{" "}
                    </span>
                  )}
                  {EQUIPE_LABEL[l.equipe]} · {SPRINT_LABEL[l.sprint]} · {TIPO_LABEL[l.tipo]}
                  {l.prazo_limite ? ` · prazo ${l.prazo_limite.split("-").reverse().join("/")}` : ""}
                  {" · "}{l.responsavelNome}
                </div>
              </div>
            ))}
            {linhas.length > 200 && (
              <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary }}>
                …e mais {linhas.length - 200}. Todas serão importadas.
              </span>
            )}
          </div>

          <button
            onClick={() => importar.mutate()}
            disabled={importar.isPending}
            style={{
              height: 52, borderRadius: 26, border: "none",
              background: "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)",
              color: "#08090E",
              fontFamily: "var(--fonte)", fontWeight: 700, fontSize: 13,
              letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: importar.isPending ? "wait" : "pointer",
              opacity: importar.isPending ? 0.7 : 1,
              boxShadow: "0 6px 20px rgba(248,200,17,0.35)",
            }}
          >
            {importar.isPending ? "Importando…" : `Importar ${linhas.length} atividade(s)`}
          </button>
        </>
      )}

      {res && res.semTitulo > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={14} color={gold} />
          <span style={{ fontFamily: "var(--fonte)", fontSize: 11.5, color: textSecondary }}>
            {res.semTitulo} linha(s) sem título foram ignoradas.
          </span>
        </div>
      )}
    </div>
  );
}
