// O painel de ATENDIMENTO DE PLANTÃO (R117, U87).
//
// ── ONDE ELE MORA, E POR QUE NÃO TEM ROTA ─────────────────────────────────
// É a TERCEIRA opção do "+" da Início (R91) — o botão que já existe no celular
// de propósito, ao lado do alternador kanban/lista. Zero item novo na barra
// (R7), zero rota nova, zero chave em `permissoes_tela` (uma tela existe quando
// existe ROTA — `src/lib/telas.ts`, e uma chave sem rota seria órfã nos dois
// sentidos). Quem registra é o plantonista, às 2h da manhã, no celular: o
// caminho tinha de ser o que ele já usa.
//
// ── A TELA NÃO CALCULA ────────────────────────────────────────────────────
// A recusa é `erroDoAtendimento`, o corpo da RPC é `corpoDoAtendimento`, o
// aviso de escala é `avisoDaEscala`, a hora é `horaCurta`, o cliente é
// `clienteDoAtendimento`. Este arquivo é pixel e gesto.
//
// ── E ELE NÃO CALCULA O `dia`, QUE É O PONTO MAIS FÁCIL DE ERRAR ──────────
// O plantão atravessa a meia-noite. Quem projeta o instante no dia é o GATILHO
// do banco, em America/Sao_Paulo; a tela só mostra o dia DEPOIS de gravar, e o
// que ela mostra é o que voltou do servidor. Calcular aqui daria uma segunda
// resposta, no fuso do APARELHO, e as duas divergiriam justamente na madrugada.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, CalendarClock, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, botaoSelecao, goldButton } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { CampoComBusca } from "@/components/CampoComBusca";
import { useClientes } from "@/features/clientes/data";
import {
  avisoDaEscala,
  clienteDoAtendimento,
  erroDoAtendimento,
  horaCurta,
  localDoInstante,
  RASCUNHO_VAZIO,
  TIPO_LABEL,
  TIPO_NOTA,
  TIPOS_DO_ATENDIMENTO,
  diaCurto,
  type AvisoDaEscala,
  type RascunhoDoAtendimento,
  type TipoDoAtendimento,
} from "./modelo";
import {
  useApagarPlantao,
  useChamadosParaVincular,
  useMeusAtendimentos,
  useSalvarPlantao,
} from "./data";

/** Da lista de clientes, ou escrito à mão — as duas formas do XOR do banco. */
type FormaDoCliente = "lista" | "texto";

export function PainelDePlantao({
  euId,
  opcoesPessoas,
  aoFechar,
}: {
  euId: string | null;
  opcoesPessoas: { valor: string; rotulo: string }[];
  aoFechar: () => void;
}) {
  const { isLight } = useTheme();
  const { data: clientes = [] } = useClientes();
  const chamados = useChamadosParaVincular(true);
  const lista = useMeusAtendimentos(euId);
  const salvar = useSalvarPlantao();
  const apagar = useApagarPlantao();

  const [rascunho, setRascunho] = useState<RascunhoDoAtendimento>(RASCUNHO_VAZIO);
  const [forma, setForma] = useState<FormaDoCliente>("lista");
  const [aviso, setAviso] = useState<AvisoDaEscala | null>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  // Abre com a hora de AGORA e com quem está registrando. É quem mais registra
  // para si — e é o único que a porta deixa registrar sem procuração.
  useEffect(() => {
    setRascunho((r) => ({
      ...r,
      hora: r.hora || localDoInstante(new Date().toISOString()) || "",
      plantonistaId: r.plantonistaId ?? euId,
    }));
  }, [euId]);

  const erro = erroDoAtendimento(rascunho);

  const nomePorCliente = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.id, c.nome);
    return m;
  }, [clientes]);

  const opcoesClientes = useMemo(
    () => [...clientes]
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
      .map((c) => ({ valor: c.id, rotulo: c.nome })),
    [clientes],
  );

  const opcoesChamados = useMemo(
    () => (chamados.data ?? []).map((c) => ({
      valor: c.id,
      rotulo: [c.numero, c.titulo].filter(Boolean).join(" — ") || c.id.slice(0, 8),
    })),
    [chamados.data],
  );

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
  const bt = (ativo: boolean, cor?: any): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, cor),
    padding: "8px 12px", borderRadius: 10, fontSize: 11.5,
  });

  async function registrar() {
    if (erro) { toast.error(erro); return; }
    try {
      const r = await salvar.mutateAsync({ rascunho });
      // O AVISO VEM DO SERVIDOR, e é o único lugar em que a divergência entre a
      // escala e quem realmente atendeu aparece. Ele NÃO impede nada: quem
      // atendeu foi quem atendeu.
      setAviso(avisoDaEscala(r));
      toast.success(`Atendimento de plantão registrado — ${diaCurto(r.dia_do_plantao)}, ${horaCurta(r.hora_gravada)}.`);
      // SÓ AQUI o rascunho é zerado. Uma gravação RECUSADA deixa na tela
      // exatamente o que a pessoa digitou — é o espelho do defeito da U86
      // (célula que limpava sozinha) e a razão de `limpar` não morar no `catch`
      // nem no `finally`.
      setRascunho({
        ...RASCUNHO_VAZIO,
        hora: localDoInstante(new Date().toISOString()) ?? "",
        plantonistaId: rascunho.plantonistaId,
      });
      setForma("lista");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui registrar o atendimento.");
    }
  }

  const corDoAviso = (a: AvisoDaEscala) =>
    a.tom === "ok" ? PRISMA.verde : a.tom === "fora" ? PRISMA.amarelo : PRISMA.azul;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CalendarClock size={15} color={gold} />
        <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
          O que aconteceu no plantão. Não vira chamado, não gera cobrança e não sai do seu registro.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div>
          <label style={rotulo} htmlFor="plantao-hora">Hora do atendimento</label>
          <input
            id="plantao-hora"
            type="datetime-local"
            style={entrada}
            value={rascunho.hora}
            onChange={(e) => setRascunho((r) => ({ ...r, hora: e.target.value }))}
          />
          <div style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, marginTop: 5 }}>
            02:30 de domingo é o plantão de domingo — o dia sai do servidor, não daqui.
          </div>
        </div>
        <div>
          <label style={rotulo}>Quem atendeu</label>
          <CampoComBusca
            id="plantao-plantonista"
            opcoes={opcoesPessoas}
            valor={rascunho.plantonistaId}
            aoMudar={(v) => setRascunho((r) => ({ ...r, plantonistaId: v }))}
            placeholder="Plantonista"
          />
        </div>
      </div>

      <div>
        <label style={rotulo}>Tipo</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TIPOS_DO_ATENDIMENTO.map((t: TipoDoAtendimento) => (
            <button
              key={t}
              type="button"
              title={TIPO_NOTA[t]}
              style={bt(rascunho.tipo === t, PRISMA.azul)}
              onClick={() => setRascunho((r) => ({ ...r, tipo: r.tipo === t ? "" : t }))}
            >
              {TIPO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={rotulo}>Cliente</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {/* AS DUAS FORMAS SÃO EXCLUDENTES no banco (num_nonnulls = 1), então
              trocar de forma LIMPA a outra — deixar as duas preenchidas mandaria
              para a porta um corpo que ela recusa, e a recusa apareceria como
              erro em vez de como escolha. */}
          <button
            type="button"
            style={bt(forma === "lista", PRISMA.azulEscuro)}
            onClick={() => { setForma("lista"); setRascunho((r) => ({ ...r, clienteInformado: "" })); }}
          >
            Da lista
          </button>
          <button
            type="button"
            style={bt(forma === "texto", PRISMA.azulEscuro)}
            onClick={() => { setForma("texto"); setRascunho((r) => ({ ...r, clienteId: null })); }}
          >
            Escrever o nome
          </button>
        </div>
        {forma === "lista" ? (
          <CampoComBusca
            id="plantao-cliente"
            opcoes={opcoesClientes}
            valor={rascunho.clienteId}
            aoMudar={(v) => setRascunho((r) => ({ ...r, clienteId: v, clienteInformado: "" }))}
            placeholder="Quem chamou"
          />
        ) : (
          <input
            id="plantao-cliente-texto"
            style={entrada}
            value={rascunho.clienteInformado}
            onChange={(e) => setRascunho((r) => ({ ...r, clienteInformado: e.target.value, clienteId: null }))}
            placeholder="Ex.: Condomínio Vila Nova"
          />
        )}
        <div style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, marginTop: 5 }}>
          Escrever o nome resolve o cliente que você não enxerga na lista — e enquanto for texto o atendimento não é cobrável.
        </div>
      </div>

      <div>
        <label style={rotulo} htmlFor="plantao-descricao">O que foi feito</label>
        <textarea
          id="plantao-descricao"
          style={{ ...entrada, height: 84, padding: "11px 13px", resize: "vertical" }}
          value={rascunho.descricao}
          onChange={(e) => setRascunho((r) => ({ ...r, descricao: e.target.value }))}
          placeholder="Alarme disparou no setor 3; orientei o porteiro a rearmar."
        />
      </div>

      <div>
        <label style={rotulo}>Chamado (opcional)</label>
        {chamados.isError ? (
          <div style={{ fontFamily: FONT, fontSize: 11.5, color: PRISMA.vermelho.dark }}>
            Não consegui carregar os chamados. Registre assim mesmo e ligue o chamado depois — é a mesma porta.
          </div>
        ) : (
          <CampoComBusca
            id="plantao-chamado"
            opcoes={opcoesChamados}
            valor={rascunho.chamadoId}
            aoMudar={(v) => setRascunho((r) => ({ ...r, chamadoId: v }))}
            placeholder={chamados.isLoading ? "Carregando…" : "Ligar a um chamado que já existe"}
          />
        )}
      </div>

      {aviso && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12,
          background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${corDoAviso(aviso)[isLight ? "light" : "dark"]}44`,
        }}>
          {aviso.tom === "ok"
            ? <Check size={14} color={corDoAviso(aviso)[isLight ? "light" : "dark"]} />
            : <AlertTriangle size={14} color={corDoAviso(aviso)[isLight ? "light" : "dark"]} />}
          <span style={{ fontFamily: FONT, fontSize: 12, color: textPrimary }}>{aviso.texto}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {erro && (
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary }}>{erro}</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={registrar}
          disabled={salvar.isPending || !!erro}
          style={{
            ...goldButton(),
            padding: "11px 20px", borderRadius: 12, fontSize: 12.5,
            opacity: salvar.isPending || erro ? 0.55 : 1,
            cursor: salvar.isPending || erro ? "default" : "pointer",
          }}
        >
          {salvar.isPending ? "Registrando…" : "Registrar atendimento"}
        </button>
      </div>

      {/* ── A LISTA, E OS TRÊS ESTADOS QUE NÃO SÃO O MESMO ────────────────
          "carregando", "falhou" e "não há" são coisas diferentes, e uma lista
          que os colapsasse diria "nenhum atendimento" quando a consulta caiu.
          É a R116 aplicada aqui: uma tela que não distingue vazio de falhou
          mente, e alguém age em cima da mentira. */}
      <div style={{ borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
        <div style={{ ...rotulo, marginBottom: 8 }}>Últimos atendimentos</div>
        {lista.isLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            <Loader2 size={13} /> carregando…
          </div>
        ) : lista.isError ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, color: PRISMA.vermelho.dark }}>
            <AlertTriangle size={13} /> não consegui ler os atendimentos — isto NÃO quer dizer que não há nenhum.
          </div>
        ) : (lista.data ?? []).length === 0 ? (
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            Nenhum atendimento registrado ainda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(lista.data ?? []).map((a) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10,
                background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)",
              }}>
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, color: gold, flexShrink: 0 }}>
                  {diaCurto(a.dia)} {horaCurta(a.hora)}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: textPrimary, flex: 1, minWidth: 0 }}>
                  {clienteDoAtendimento(a, (id) => nomePorCliente.get(id) ?? null)} · {a.descricao}
                </span>
                <span style={{ fontFamily: FONT, fontSize: 10.5, color: textSecondary, flexShrink: 0 }}>
                  {a.tipo}
                </span>
                <button
                  onClick={async () => {
                    try {
                      const n = await apagar.mutateAsync(a.id);
                      toast.success(n > 0 ? "Atendimento apagado." : "Esse atendimento já não estava lá.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Não consegui apagar.");
                    }
                  }}
                  aria-label="Apagar atendimento"
                  title="Apagar atendimento"
                  style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                    background: "transparent", color: textSecondary,
                    border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={aoFechar}
        style={{
          background: "transparent", border: "none", cursor: "pointer", alignSelf: "flex-start",
          fontFamily: FONT, fontSize: 11.5, color: textSecondary, textDecoration: "underline", padding: 0,
        }}
      >
        Fechar
      </button>
    </div>
  );
}
