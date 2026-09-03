// O pop-up de nova atividade (R91, U72) — Davi, 2026-08-26: "Adicione um
// botão de '+' ao lado direito do botão de alternar entre kanban e lista na
// tela de início. Este botão de + deve abrir um pop Up de um campo onde o
// usuário pode criar uma nova atividade manualmente."
//
// É o par MANUAL do campo de I.A. que fica no painel de cima. Os dois criam
// pela mesma porta — `abrirChamado()` —, então passam pelos mesmos triggers
// (número CH-, prazo do SLA, classificação) e pelas mesmas policies. Não
// existe um segundo caminho de escrita para manter.
//
// Por que um diálogo e não a rota /chamados/novo-interno que já existe: aquela
// tela é um formulário longo (compra, fornecedor, link do produto) e tira a
// pessoa da Início. Aqui o ponto é não sair do quadro — abre, escreve, fecha,
// e o card aparece na coluna. Quem precisa do formulário completo continua
// tendo o atalho no fim do diálogo.
//
// Segue a moldura do DialogoDuplas: overlay que fecha no clique de fora,
// `card()` no miolo, cabeçalho com ícone dourado e botão de fechar.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ListPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, botaoSelecao, goldButton } from "@/lib/ui";
import { PRISMA } from "@/lib/paleta";
import { abrirChamado, usePessoas } from "@/features/chamados/data";
import { useClientes } from "@/features/clientes/data";
import { CampoComBusca } from "@/components/CampoComBusca";
import {
  tiposDaNatureza, TIPO_LABEL, TIPO_CORES,
  PRIORIDADE_LABEL, PRIORIDADE_CORES, dataParaPrazo,
  type ChamadoPrioridade, type ChamadoTipo, type Natureza,
} from "@/lib/chamado-status";
import { EQUIPES, EQUIPE_LABEL, equipeCores, type Equipe } from "@/lib/equipes";
import { PainelDePlantao } from "@/features/plantao/PainelDePlantao";

// ── A TERCEIRA OPÇÃO, E POR QUE ELA NÃO É UMA NATUREZA (R117, U87) ─────────
// O atendimento de PLANTÃO entra por aqui — este botão já existe no celular de
// propósito (R91), e quem registra é o plantonista às 2h da manhã. Zero item
// novo na barra (R7), zero rota nova.
//
// MAS ELE NÃO É `natureza = 'plantao'`, e a distinção é a R117: `natureza`
// responde "de que espécie é este trabalho", e o CHECK vivo é
// ('campo','interno','comercial') — um quarto valor arrastaria kanban,
// numeração CH-, SLA, Painel Operacional e fila de conferência. O plantão traz
// perguntas que `chamados` não faz (a que HORAS se atendeu, remoto ou
// presencial, quem estava de sobreaviso), então ele é SATÉLITE: tabela própria,
// porta própria, e este seletor é de MODO, não de natureza.
type ModoDaNova = Natureza | "plantao";

const MODOS: { v: ModoDaNova; t: string; nota: string }[] = [
  { v: "campo", t: "De campo", nota: "alguém se desloca" },
  { v: "interno", t: "Interna", nota: "trabalho de mesa" },
  { v: "plantao", t: "Plantão", nota: "atendimento fora do expediente — não vira chamado" },
];

export function NovaAtividadeDialog({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: pessoas = [] } = usePessoas();
  const { data: clientes = [] } = useClientes();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modo, setModo] = useState<ModoDaNova>("interno");
  const natureza: Natureza = modo === "plantao" ? "interno" : modo;
  const [euId, setEuId] = useState<string | null>(null);
  const [tipo, setTipo] = useState<ChamadoTipo | "">("");
  const [equipe, setEquipe] = useState<Equipe>("ti");
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>("normal");
  const [responsavelId, setResponsavelId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  // Abre já com quem está registrando: é quem mais cria atividade para si.
  useEffect(() => {
    if (!aberto) return;
    supabase.auth.getUser().then(({ data }) => {
      const eu = (pessoas as any[]).find((p) => p.id === data.user?.id);
      if (!eu) return;
      setEuId(eu.id);
      setResponsavelId((v) => v ?? eu.id);
      if (eu.equipe && (EQUIPES as string[]).includes(eu.equipe)) setEquipe(eu.equipe as Equipe);
    });
  }, [aberto, pessoas]);

  // Trocar de natureza pode invalidar o tipo escolhido — um tipo que a nova
  // natureza não oferece ficaria selecionado e invisível, e iria para o banco.
  useEffect(() => {
    if (tipo && !(tiposDaNatureza(natureza) as string[]).includes(tipo)) setTipo("");
  }, [natureza, tipo]);

  function limpar() {
    setTitulo(""); setDescricao(""); setTipo(""); setPrazo("");
    setPrioridade("normal"); setClienteId(null);
  }

  async function criar() {
    if (!titulo.trim()) { toast.error("Escreva o que precisa ser feito."); return; }
    setSalvando(true);
    try {
      const id = await abrirChamado({
        natureza,
        titulo: titulo.trim(),
        descricao_problema: descricao.trim() || null,
        // vazio = deixa o banco classificar pelo título (trigger), igual ao
        // formulário completo
        tipo: (tipo || null) as ChamadoTipo | null,
        equipe,
        prioridade,
        responsavel_id: responsavelId,
        cliente_id: clienteId,
        prazo_limite: prazo ? dataParaPrazo(prazo) : null,
      });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      toast.success("Atividade criada.");
      limpar();
      aoFechar();
      navigate({ to: "/chamados/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui criar a atividade.");
    } finally {
      setSalvando(false);
    }
  }

  const opcoesPessoas = useMemo(
    () => [...(pessoas as any[])]
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
      .map((p) => ({ valor: p.id as string, rotulo: (p.nome ?? "Sem nome") as string })),
    [pessoas],
  );
  const opcoesClientes = useMemo(
    () => [...clientes]
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))
      .map((c) => ({ valor: c.id, rotulo: c.nome })),
    [clientes],
  );

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
  const bt = (ativo: boolean, cor?: any): CSSProperties => ({
    ...botaoSelecao(ativo, isLight, cor),
    padding: "8px 12px", borderRadius: 10, fontSize: 11.5,
  });

  return (
    <div
      onClick={aoFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Nova atividade"
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
          ...card(isLight), padding: 18, width: "100%", maxWidth: 560,
          maxHeight: "88vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ListPlus size={17} color={gold} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: textPrimary }}>
              {modo === "plantao" ? "Atendimento de plantão" : "Nova atividade"}
            </div>
            {/* O subtítulo segue o MODO: no plantão, "o local vai na etiqueta,
                não no título" seria conselho sobre um campo que aquele corpo
                nem tem. */}
            <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11.5, color: textSecondary }}>
              {modo === "plantao"
                ? "O que aconteceu fora do expediente. Isto não vira chamado."
                : "O que precisa ser feito. O local vai na etiqueta, não no título."}
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

        {/* O SELETOR DE MODO VEM PRIMEIRO, e não no meio do formulário: ele
            troca o CORPO inteiro do diálogo, e um seletor que muda tudo abaixo
            dele não pode estar embaixo de dois campos que talvez não sirvam. */}
        <div>
          <label style={rotulo}>O que é</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MODOS.map((n) => (
              <button
                key={n.v}
                type="button"
                style={bt(modo === n.v, PRISMA.azul)}
                onClick={() => setModo(n.v)}
                title={n.nota}
              >
                {n.t}
              </button>
            ))}
          </div>
        </div>

        {modo === "plantao" ? (
          <PainelDePlantao euId={euId} opcoesPessoas={opcoesPessoas} aoFechar={aoFechar} />
        ) : (
        <>
        <div>
          <label style={rotulo} htmlFor="nova-titulo">Título</label>
          <input
            id="nova-titulo"
            autoFocus
            style={entrada}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !salvando) criar(); }}
            placeholder="Ex.: Revisar cadastro de moradores do Bloco C"
          />
        </div>

        <div>
          <label style={rotulo} htmlFor="nova-descricao">Descrição</label>
          <textarea
            id="nova-descricao"
            style={{ ...entrada, height: 84, padding: "11px 13px", resize: "vertical" }}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Contexto, o que já se sabe, links…"
          />
        </div>

        <div>
          <label style={rotulo}>Classificação</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tiposDaNatureza(natureza).map((t) => (
              <button
                key={t}
                type="button"
                style={bt(tipo === t, TIPO_CORES[t])}
                onClick={() => setTipo(tipo === t ? "" : t)}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
          {!tipo && (
            <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, marginTop: 6 }}>
              Sem escolha, o sistema classifica pelo título.
            </div>
          )}
        </div>

        <div>
          <label style={rotulo}>Equipe</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EQUIPES.map((e) => (
              <button key={e} type="button" style={bt(equipe === e, equipeCores(e))} onClick={() => setEquipe(e)}>
                {EQUIPE_LABEL[e]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={rotulo}>Prioridade</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(["baixa", "normal", "alta", "urgente"] as ChamadoPrioridade[]).map((p) => (
              <button
                key={p}
                type="button"
                style={bt(prioridade === p, PRIORIDADE_CORES[p])}
                onClick={() => setPrioridade(p)}
              >
                {PRIORIDADE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <label style={rotulo}>Responsável</label>
            <CampoComBusca
              id="nova-responsavel"
              opcoes={opcoesPessoas}
              valor={responsavelId}
              aoMudar={setResponsavelId}
              placeholder="Quem faz"
            />
          </div>
          <div>
            <label style={rotulo}>Local</label>
            <CampoComBusca
              id="nova-local"
              opcoes={opcoesClientes}
              valor={clienteId}
              aoMudar={setClienteId}
              placeholder="Onde acontece"
            />
          </div>
          <div>
            <label style={rotulo} htmlFor="nova-prazo">Prazo</label>
            <input
              id="nova-prazo"
              type="date"
              style={entrada}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          <button
            onClick={() => { aoFechar(); navigate({ to: "/chamados/novo" }); }}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: FONT, fontSize: 11.5, color: textSecondary, textDecoration: "underline",
              padding: 0,
            }}
          >
            Abrir o formulário completo
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={criar}
            disabled={salvando || !titulo.trim()}
            style={{
              ...goldButton(),
              padding: "11px 20px", borderRadius: 12, fontSize: 12.5,
              opacity: salvando || !titulo.trim() ? 0.55 : 1,
              cursor: salvando || !titulo.trim() ? "default" : "pointer",
            }}
          >
            {salvando ? "Criando…" : "Criar atividade"}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
