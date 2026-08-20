// Criação rápida de chamado — no lugar da caixa de notificações do painel
// superior (o sino foi para a sidebar). Etapa U20.
//
// Adaptação do componente do Davi (Uiverse, por Cobp): a pílula de texto com
// os ícones de anexo que se recolhem num "+" quando se começa a escrever, e o
// botão de envio que cresce do nada à direita. O que ficou de fora, e por quê:
// o modo de voz (o blob gigante de IA) — o pedido foi "escrever texto e
// colocar arquivo"; e o degradê roxo do botão de envio virou o da marca.
//
// Raio: o painel é 20px (em styles.css, com !important — o inline do card()
// diria 18) e a caixa de texto é 16px. A de fora PRECISA ser mais redonda que a
// de dentro; invertido, o olho lê a interna como solta.
//
// É o ÚNICO painel do topo com o degradê no fundo (pedido do Davi, 2026-08-20):
// nos gráficos ele competia com os dados, aqui não há dado nenhum para competir
// — é um convite a escrever, e a cor faz o convite. Granulado em 10%, quase
// invisível: o pouco que sobrou existe para quebrar o banding do blur de 46px,
// que num degradê tão liso apareceria em faixas.
//
// O fluxo: o texto vai para a IA interpretar (chamado-rapido.functions.ts),
// o chamado é criado pelo MESMO abrirChamado() do formulário — mesmos
// triggers, mesmas policies, nenhum segundo caminho de escrita — e os anexos
// sobem como fotos do chamado já criado. No fim, navega para ele: a pessoa
// confere a interpretação com os próprios olhos.

import { useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card } from "@/lib/ui";
import { GRAD_PRIMARIA, SOBRE_PRIMARIA, PRISMA, degradePrisma } from "@/lib/paleta";
import { interpretarChamado } from "@/lib/chamado-rapido.functions";
import { abrirChamado, anexarFoto } from "@/features/chamados/data";

const ALTURA = 252;
const CURVA = "all .5s cubic-bezier(0.175, 0.885, 0.32, 1.05)";

export function CriarRapido() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const interpretarFn = useServerFn(interpretarChamado);

  const [texto, setTexto] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  // sobre o degradê o cinza de 55% afundava; aqui o secundário é mais claro
  const textSecondary = isLight ? "#3a4152" : "rgba(255,255,255,0.80)";
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  const MICRO: CSSProperties = {
    fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
    letterSpacing: "0.10em", textTransform: "uppercase", color: gold,
  };

  async function enviar() {
    if (texto.trim().length < 8 || enviando) return;
    setEnviando(true);
    try {
      const r = await interpretarFn({ data: { texto: texto.trim() } });
      if (!r.ok || !r.chamado) throw new Error(r.erro ?? "Não consegui interpretar.");
      const c = r.chamado;

      const id = await abrirChamado({
        natureza: c.natureza,
        tipo: c.tipo,
        titulo: c.titulo,
        // o cliente citado fica registrado na descrição até alguém vincular —
        // casar nome livre com cadastro é decisão humana, não da IA
        descricao_problema: c.cliente_citado
          ? `${c.descricao}\n\nCliente citado: ${c.cliente_citado}`
          : c.descricao,
        prioridade: c.prioridade,
        equipe: c.natureza === "interno" ? c.equipe : undefined,
      });

      for (const f of arquivos) {
        try {
          await anexarFoto(id, f, "outra");
        } catch {
          toast.error(`Não consegui anexar ${f.name} — o chamado foi criado sem ele.`);
        }
      }

      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["home-chamados"] });
      toast.success("Chamado criado — confira a interpretação.");
      setTexto("");
      setArquivos([]);
      navigate({ to: "/chamados/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar o chamado.");
    } finally {
      setEnviando(false);
    }
  }

  const temTexto = texto.trim().length > 0;

  return (
    <div className="elevavel campo-degrade" style={{ ...card(isLight), flex: 1, minWidth: 264, height: ALTURA, padding: "14px 16px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <div className="campo-degrade-fundo" aria-hidden style={{ background: degradePrisma(isLight, "150deg") }} />
      <div className="campo-degrade-conteudo">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={MICRO}>Abrir chamado</span>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 11, color: textSecondary }}>
          descreva e a IA monta
        </span>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); }
        }}
        className="campo-ia"
        placeholder={'Ex.: "portão do Green Village travando, urgente" — cliente, problema e pressa; o resto a IA resolve.'}
        disabled={enviando}
        style={{
          flex: 1,
          minHeight: 0,
          margin: "10px 0",
          padding: "10px 12px",
          borderRadius: 16,
          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
          // sobre o degradê a caixa precisa de mais corpo, senão o texto
          // digitado disputa com a cor de trás
          background: isLight ? "rgba(255,255,255,0.72)" : "rgba(10,10,15,0.62)",
          color: textPrimary,
          fontFamily: FONT,
          fontWeight: 400,
          fontSize: 13,
          lineHeight: 1.55,
          outline: "none",
          resize: "none",
        }}
      />

      {arquivos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 8 }}>
          {arquivos.map((f, i) => (
            <span key={`${f.name}-${i}`} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 999,
              background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
              fontFamily: FONT, fontWeight: 400, fontSize: 10.5, color: textSecondary,
              maxWidth: 160,
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
              </span>
              <button
                onClick={() => setArquivos((l) => l.filter((_, j) => j !== i))}
                aria-label={`Remover ${f.name}`}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", padding: 0, display: "flex" }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          ref={arquivoRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const novos = Array.from(e.target.files ?? []);
            if (novos.length) setArquivos((l) => [...l, ...novos].slice(0, 5));
            e.target.value = "";
          }}
        />
        <button
          onClick={() => arquivoRef.current?.click()}
          disabled={enviando}
          title="Anexar arquivo"
          aria-label="Anexar arquivo"
          className="clip-anexo"
          style={{
            width: 38, height: 38, borderRadius: 999, border: "none",
            background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
            color: textSecondary, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Paperclip size={16} />
        </button>

        <span style={{ flex: 1, fontFamily: FONT, fontWeight: 400, fontSize: 10, color: textSecondary }}>
          {arquivos.length > 0
            ? `${arquivos.length} anexo${arquivos.length > 1 ? "s" : ""} · entram no chamado`
            : "Enter envia · Shift+Enter quebra linha"}
        </span>

        {/* o botão de envio "cresce do nada" quando há texto — o gesto do
            componente original, com o degradê da marca no lugar do roxo */}
        <button
          onClick={() => void enviar()}
          disabled={!temTexto || enviando}
          aria-label="Criar chamado"
          className="ruido"
          style={{
            width: 38, height: 38, borderRadius: 999, border: "none",
            background: GRAD_PRIMARIA,
            color: SOBRE_PRIMARIA,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: temTexto && !enviando ? "pointer" : "default",
            transition: CURVA,
            transform: temTexto || enviando ? "scale(1)" : "scale(0.25)",
            opacity: temTexto || enviando ? 1 : 0,
            boxShadow: `0 4px 14px rgba(245,190,69,0.38)`,
            flexShrink: 0,
          }}
        >
          {enviando
            ? <Loader2 size={16} className="animate-spin" />
            : <ArrowUp size={16} strokeWidth={2.5} />}
        </button>
      </div>
      </div>
    </div>
  );
}
