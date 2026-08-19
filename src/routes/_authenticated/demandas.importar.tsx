// Importação do quadro do Notion — Etapa U1 da unificação.
// Ver docs/PLANO_UNIFICACAO.md §7. Lê o CSV exportado do Notion, casa as
// colunas com o modelo daqui e mostra tudo antes de gravar: pessoa que não for
// reconhecida vira "sem responsável" em vez de travar a importação inteira.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useClientes } from "@/features/clientes/data";
import { usePessoas } from "@/features/demandas/data";
import { normalizarTexto } from "@/lib/normalizar";
import {
  SPRINT_LABEL, TIPO_DEMANDA_LABEL, sugerirTipoDemanda,
  type DemandaSprint, type DemandaStatus, type DemandaTipo,
} from "@/lib/demanda-status";
import { EQUIPE_LABEL, type Equipe } from "@/lib/equipes";

export const Route = createFileRoute("/_authenticated/demandas/importar")({
  component: ImportarDemandasPage,
});

// ── CSV ─────────────────────────────────────────────────────────────────────
/** Parser mínimo com suporte a aspas e quebra de linha dentro do campo. */
function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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

const SINONIMOS: Record<string, string[]> = {
  titulo: ["titulo", "title", "name", "nome", "tarefa"],
  descricao: ["descricao", "description", "detalhes", "observacoes"],
  responsavel: ["responsavel", "assignee", "owner", "dono"],
  apoio: ["apoio", "support", "colaborador"],
  cliente: ["cliente", "client", "condominio", "empresa"],
  sprint: ["sprint", "ciclo", "mes"],
  prazo: ["prazo", "due", "data limite", "deadline", "vencimento"],
  equipe: ["equipe", "team", "time", "area"],
  status: ["status", "situacao", "estado"],
};

function acharColuna(cabecalho: string[], chave: string): number {
  const alvos = SINONIMOS[chave] ?? [chave];
  return cabecalho.findIndex((h) => {
    const n = normalizarTexto(h);
    return alvos.some((a) => n === a || n.startsWith(a));
  });
}

const STATUS_NOTION: Record<string, DemandaStatus> = {
  "nao iniciada": "nao_iniciada",
  "nao iniciado": "nao_iniciada",
  "a fazer": "nao_iniciada",
  "em andamento": "em_andamento",
  "fazendo": "em_andamento",
  "stand by": "stand_by",
  "standby": "stand_by",
  "pausada": "stand_by",
  "aguardando aprovacao": "aguardando_aprovacao",
  "aguardando": "aguardando_aprovacao",
  "concluido": "concluida",
  "concluida": "concluida",
  "feito": "concluida",
  "cancelada": "cancelada",
  "cancelado": "cancelada",
};

const SPRINT_NOTION: Record<string, DemandaSprint> = {
  "este mes": "este_mes",
  "esse mes": "este_mes",
  "mes que vem": "mes_que_vem",
  "proximo mes": "mes_que_vem",
  "mes passado": "mes_passado",
  "backlog": "backlog",
};

// nomes REAIS do quadro do Notion (confirmados no export de 2026-08-18)
const EQUIPE_NOTION: Record<string, Equipe> = {
  "t.i / tecnica": "ti",
  "t.i": "ti",
  "ti": "ti",
  "tecnologia": "ti",
  "controle patrimonial": "patrimonio",
  "patrimonio": "patrimonio",
  "marketing / comercial": "comercial",
  "comercial": "comercial",
  "sac": "sac",
  "monitoramento / portaria": "monitoramento",
  "monitoramento": "monitoramento",
  "audiovisual": "audiovisual",
  "business ops": "business_ops",
  "businessops": "business_ops",
  "tecnica": "tecnica",
};

interface LinhaImport {
  titulo: string;
  descricao: string | null;
  responsavelNome: string;
  responsavelId: string | null;
  clienteNome: string;
  clienteId: string | null;
  equipe: Equipe;
  sprint: DemandaSprint;
  status: DemandaStatus;
  tipo: DemandaTipo;
  prazo: string | null;
  origemId: string;
}

/** "12/03/2026", "2026-03-12" e "March 12, 2026" viram AAAA-MM-DD. */
function lerData(v: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function ImportarDemandasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLight } = useTheme();
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();
  const [linhas, setLinhas] = useState<LinhaImport[] | null>(null);
  const [arquivo, setArquivo] = useState("");

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

  const pessoaPorNome = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of pessoas) {
      m[normalizarTexto(p.nome)] = p.id;
      // "Erik" casa com "Erik Souza": o Notion costuma guardar só o primeiro nome
      const primeiro = normalizarTexto(p.nome).split(" ")[0];
      if (primeiro && !m[primeiro]) m[primeiro] = p.id;
    }
    return m;
  }, [pessoas]);

  const clientePorNome = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clientes) {
      m[normalizarTexto(c.nome)] = c.id;
      if (c.nome_predio) m[normalizarTexto(c.nome_predio)] = c.id;
    }
    return m;
  }, [clientes]);

  function processar(texto: string) {
    const grade = lerCsv(texto);
    if (grade.length < 2) {
      toast.error("O arquivo não tem linhas de dados.");
      return;
    }
    const cab = grade[0];
    const iTitulo = acharColuna(cab, "titulo");
    if (iTitulo < 0) {
      toast.error('Não encontrei a coluna de título ("Título" ou "Name").');
      return;
    }
    const idx = {
      titulo: iTitulo,
      descricao: acharColuna(cab, "descricao"),
      responsavel: acharColuna(cab, "responsavel"),
      cliente: acharColuna(cab, "cliente"),
      sprint: acharColuna(cab, "sprint"),
      prazo: acharColuna(cab, "prazo"),
      equipe: acharColuna(cab, "equipe"),
      status: acharColuna(cab, "status"),
    };
    const pega = (l: string[], i: number) => (i >= 0 ? (l[i] ?? "").trim() : "");

    const out: LinhaImport[] = [];
    for (const l of grade.slice(1)) {
      const titulo = pega(l, idx.titulo);
      if (!titulo) continue;
      const descricao = pega(l, idx.descricao) || null;
      const respNome = pega(l, idx.responsavel);
      const cliNome = pega(l, idx.cliente);
      const prazo = lerData(pega(l, idx.prazo));
      out.push({
        titulo,
        descricao,
        responsavelNome: respNome,
        responsavelId: pessoaPorNome[normalizarTexto(respNome)] ?? null,
        clienteNome: cliNome,
        clienteId: clientePorNome[normalizarTexto(cliNome)] ?? null,
        // célula multi-equipe ("Controle Patrimonial, T.I / Técnica") usa a primeira
        equipe: EQUIPE_NOTION[normalizarTexto(pega(l, idx.equipe).split(",")[0])] ?? "ti",
        sprint: SPRINT_NOTION[normalizarTexto(pega(l, idx.sprint))] ?? "backlog",
        status: STATUS_NOTION[normalizarTexto(pega(l, idx.status))] ?? "nao_iniciada",
        tipo: sugerirTipoDemanda(titulo, descricao),
        prazo,
        // chave de reimportação: mesmo título + mesmo prazo não entra duas vezes
        origemId: `${normalizarTexto(titulo)}|${prazo ?? ""}`,
      });
    }
    if (out.length === 0) {
      toast.error("Nenhuma linha com título preenchido.");
      return;
    }
    setLinhas(out);
  }

  const importar = useMutation({
    mutationFn: async () => {
      if (!linhas?.length) throw new Error("Nada para importar.");
      const { data: u } = await supabase.auth.getUser();
      const registros = linhas.map((l) => ({
        titulo: l.titulo,
        descricao: l.descricao,
        cliente_id: l.clienteId,
        equipe: l.equipe,
        responsavel_id: l.responsavelId,
        prazo: l.prazo,
        sprint: l.sprint,
        tipo: l.tipo,
        status: l.status,
        criada_por: u.user?.id ?? null,
        origem: "notion",
        origem_id: l.origemId,
      }));
      // o índice único (origem, origem_id) garante que rodar de novo não duplica
      const { error, count } = await supabase
        .from("demandas" as any)
        .upsert(registros as any, { onConflict: "origem,origem_id", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      return count ?? registros.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success(`${n} demanda(s) importada(s).`);
      navigate({ to: "/demandas" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na importação."),
  });

  const semResponsavel = linhas?.filter((l) => l.responsavelNome && !l.responsavelId).length ?? 0;
  const semCliente = linhas?.filter((l) => l.clienteNome && !l.clienteId).length ?? 0;

  return (
    <div style={{ padding: "12px 0 48px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/demandas" })}
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
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 20 }}>
            Importar do Notion
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: textSecondary }}>
            Exporte o quadro como CSV e escolha o arquivo aqui.
          </div>
        </div>
      </div>

      <div style={CARD}>
        <label
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "28px 16px", borderRadius: 14, cursor: "pointer",
            border: isLight ? "1.5px dashed rgba(0,0,0,0.18)" : "1.5px dashed rgba(255,192,0,0.28)",
          }}
        >
          <Upload size={26} color={gold} />
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13.5 }}>
            {arquivo || "Escolher arquivo CSV"}
          </span>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: textSecondary, textAlign: "center" }}>
            No Notion: ··· → Export → Markdown &amp; CSV, sem subpáginas.
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

      {linhas && (
        <>
          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={17} color="#34D399" />
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14 }}>
                {linhas.length} demanda(s) prontas para importar
              </span>
            </div>
            {(semResponsavel > 0 || semCliente > 0) && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={16} color={gold} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 12,
                  color: textSecondary, lineHeight: 1.5,
                }}>
                  {semResponsavel > 0 && `${semResponsavel} sem responsável reconhecido (entram sem dono, dá para atribuir depois). `}
                  {semCliente > 0 && `${semCliente} com cliente que não existe no cadastro (entram como demanda interna).`}
                </span>
              </div>
            )}
            <span style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11.5,
              color: textSecondary, lineHeight: 1.5,
            }}>
              Reimportar o mesmo arquivo não duplica: título + prazo é a chave de origem.
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
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13 }}>
                  {l.titulo}
                </div>
                <div style={{
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: 11,
                  color: textSecondary, marginTop: 3,
                }}>
                  {EQUIPE_LABEL[l.equipe]} · {SPRINT_LABEL[l.sprint]} · {TIPO_DEMANDA_LABEL[l.tipo]}
                  {l.prazo ? ` · prazo ${l.prazo.split("-").reverse().join("/")}` : ""}
                  {" · "}
                  {l.responsavelId
                    ? l.responsavelNome
                    : l.responsavelNome
                      ? `${l.responsavelNome} (não reconhecido)`
                      : "sem responsável"}
                </div>
              </div>
            ))}
            {linhas.length > 200 && (
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: textSecondary }}>
                …e mais {linhas.length - 200}. Todas serão importadas.
              </span>
            )}
          </div>

          <button
            onClick={() => importar.mutate()}
            disabled={importar.isPending}
            style={{
              height: 52, borderRadius: 26, border: "none",
              background: "linear-gradient(135deg,#FFD700,#FFC000,#FF9F00)",
              color: "#08090E",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13,
              letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: importar.isPending ? "wait" : "pointer",
              opacity: importar.isPending ? 0.7 : 1,
              boxShadow: "0 6px 20px rgba(255,192,0,0.35)",
            }}
          >
            {importar.isPending ? "Importando…" : `Importar ${linhas.length} demanda(s)`}
          </button>
        </>
      )}
    </div>
  );
}
