// EQUIPAMENTOS REMOVIDOS e EQUIPAMENTOS INSTALADOS na página da atividade
// (R226, U119) — só quando o cliente da atividade é UM cliente.
//
// Davi, 08/09/2026: "O campo 'Equipamentos envolvidos' deve virar dois:
// 'Equipamentos Removidos' — deve listar os blocos do cliente, ao expandir o
// bloco aparecem os equipamentos e o botão remover; o equipamento passa a ser
// 'Retirado do cliente' — e 'Equipamentos Instalados' — lista os equipamentos
// que não estão vinculados a nenhum bloco do cliente, e ao selecionar o
// equipamento deve ser possível escolher para qual bloco ele foi instalado.
// Somente quando o cliente da atividade for um cliente único (não interna,
// não grupo)."
//
// Dois cards, a mesma anatomia: o que ESTA atividade já fez (a lista, com
// desfazer para o clique errado) e o gesto para fazer mais (um painel que
// abre embaixo). O gesto grava pela RPC `mover_equipamento` (U119) — validada
// no banco — e o patrimônio do cliente (a ficha, R199) reflete na hora.

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, PackageMinus, PackagePlus, Search, Undo2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, goldButton } from "@/lib/ui";
import { PRISMA, cinzas } from "@/lib/paleta";
import { useInventario } from "@/features/clientes/inventario";
import {
  agruparPorBloco, desfazerMovimento, moverEquipamento, rotuloDoEquipamento,
  useEquipamentosDaAtividade, useEquipamentosDoClienteDaAtividade, useEquipamentosLivres,
  type EquipamentoLivre, type MovimentoDeEquipamento,
} from "./equipamentos-atividade";

interface Props {
  chamadoId: string;
  clienteId: string;
  podeEditar: boolean;
  /** o card e o micro-rótulo da página — a MESMA casca dos outros blocos */
  estiloCard: CSSProperties;
  estiloSecao: CSSProperties;
}

export function EquipamentosDaAtividade({ chamadoId, clienteId, podeEditar, estiloCard, estiloSecao }: Props) {
  const { isLight } = useTheme();
  const c = cinzas(isLight);
  const qc = useQueryClient();
  const { data: mov, isLoading } = useEquipamentosDaAtividade(chamadoId);
  const movimentos = mov?.itens ?? [];
  const removidos = movimentos.filter((m) => m.tipo === "retirada");
  const instalados = movimentos.filter((m) => m.tipo === "instalacao");

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["equipamentos-atividade", chamadoId] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente-atividade", chamadoId] });
    qc.invalidateQueries({ queryKey: ["equipamentos-livres"] });
    qc.invalidateQueries({ queryKey: ["equipamentos-cliente", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-inventario", clienteId] });
  }

  const desfazer = useMutation({
    mutationFn: (m: MovimentoDeEquipamento) => desfazerMovimento(m.movimento_id),
    onSuccess: () => { recarregar(); toast.success("Movimento desfeito."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const linha: CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 12,
    background: c.campo, border: `1px solid ${c.divisoria}`,
  };
  const texto: CSSProperties = { fontFamily: FONT, fontSize: 13, color: c.texto, minWidth: 0 };
  const sub: CSSProperties = { fontFamily: FONT, fontSize: 11, color: c.textoSecundario };

  function Lista({ itens, verbo }: { itens: MovimentoDeEquipamento[]; verbo: "de" | "em" }) {
    if (itens.length === 0) return null;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {itens.map((m) => (
          <div key={m.movimento_id} style={linha}>
            <Wrench size={14} color={isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotuloDoEquipamento(m)}</div>
              <div style={sub}>{verbo === "de" ? "Retirado de" : "Instalado em"} {m.sistema_nome ?? "sem bloco"}</div>
            </div>
            {podeEditar && (
              <button
                type="button"
                onClick={() => desfazer.mutate(m)}
                disabled={desfazer.isPending}
                title="Desfazer este movimento"
                aria-label="Desfazer este movimento"
                style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${c.divisoria}`, background: c.superficie, color: c.textoSecundario, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Undo2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div style={estiloCard}>
        <span style={estiloSecao}>Equipamentos removidos</span>
        {mov?.faltaMigration && <AvisoMigration c={c} />}
        {isLoading && <span style={sub}>Carregando…</span>}
        {!isLoading && removidos.length === 0 && !mov?.faltaMigration && (
          <span style={{ ...sub, fontSize: 12 }}>Nenhum equipamento retirado nesta atividade.</span>
        )}
        <Lista itens={removidos} verbo="de" />
        {podeEditar && !mov?.faltaMigration && (
          <PainelRemover chamadoId={chamadoId} aoMover={recarregar} c={c} isLight={isLight} />
        )}
      </div>

      <div style={estiloCard}>
        <span style={estiloSecao}>Equipamentos instalados</span>
        {isLoading && <span style={sub}>Carregando…</span>}
        {!isLoading && instalados.length === 0 && !mov?.faltaMigration && (
          <span style={{ ...sub, fontSize: 12 }}>Nenhum equipamento instalado nesta atividade.</span>
        )}
        <Lista itens={instalados} verbo="em" />
        {podeEditar && !mov?.faltaMigration && (
          <PainelInstalar chamadoId={chamadoId} clienteId={clienteId} aoMover={recarregar} c={c} isLight={isLight} />
        )}
      </div>
    </>
  );
}

function AvisoMigration({ c }: { c: ReturnType<typeof cinzas> }) {
  return (
    <span style={{ fontFamily: FONT, fontSize: 12, color: c.textoSecundario, lineHeight: 1.5 }}>
      Os equipamentos da atividade precisam da migration <strong>U119</strong>. Até ela rodar, nada aparece aqui.
    </span>
  );
}

function BotaoLeve({ children, onClick, aberto, c }: { children: ReactNode; onClick: () => void; aberto: boolean; c: ReturnType<typeof cinzas> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      style={{
        alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6,
        height: 40, padding: "0 12px 0 10px", borderRadius: 12, cursor: "pointer",
        background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto,
        fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
      }}
    >
      <ChevronRight size={14} style={{ transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      {children}
    </button>
  );
}

// ── remover: os blocos do cliente → expande → o item → Remover ──────────────

function PainelRemover({ chamadoId, aoMover, c, isLight }: { chamadoId: string; aoMover: () => void; c: ReturnType<typeof cinzas>; isLight: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [blocoAberto, setBlocoAberto] = useState<string | null>(null);
  const { data, isLoading } = useEquipamentosDoClienteDaAtividade(chamadoId, aberto);
  const grupos = useMemo(() => agruparPorBloco(data?.itens ?? []), [data]);
  const remover = useMutation({
    mutationFn: (patrimonioId: string) => moverEquipamento({ patrimonioId, chamadoId, tipo: "retirada" }),
    onSuccess: () => { aoMover(); toast.success("Equipamento retirado do cliente."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const vermelho = isLight ? PRISMA.vermelho.light : PRISMA.vermelho.dark;

  return (
    <>
      <BotaoLeve onClick={() => setAberto((a) => !a)} aberto={aberto} c={c}>
        <PackageMinus size={14} /> Remover equipamento…
      </BotaoLeve>
      {aberto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {isLoading && <span style={{ fontFamily: FONT, fontSize: 12, color: c.textoSecundario }}>Carregando os blocos…</span>}
          {!isLoading && grupos.length === 0 && (
            <span style={{ fontFamily: FONT, fontSize: 12, color: c.textoSecundario }}>Este cliente não tem equipamento ativo no patrimônio.</span>
          )}
          {grupos.map((g) => {
            const chave = g.sistemaId ?? "__sem";
            const abertoG = blocoAberto === chave;
            return (
              <div key={chave} style={{ borderRadius: 12, border: `1px solid ${c.divisoria}`, background: c.superficie, overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setBlocoAberto(abertoG ? null : chave)}
                  aria-expanded={abertoG}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "transparent", border: "none", cursor: "pointer", color: c.texto, textAlign: "left" }}
                >
                  <ChevronRight size={14} style={{ transform: abertoG ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                  <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, flex: 1 }}>{g.nome}</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>{g.itens.length} {g.itens.length === 1 ? "item" : "itens"}</span>
                </button>
                {abertoG && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 8px 8px" }}>
                    {g.itens.map((it) => (
                      <div key={it.patrimonio_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px 7px 12px", borderRadius: 10, background: c.campo }}>
                        <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.texto, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {rotuloDoEquipamento(it)}
                        </span>
                        <button
                          type="button"
                          onClick={() => remover.mutate(it.patrimonio_id)}
                          disabled={remover.isPending}
                          style={{
                            height: 30, padding: "0 10px", borderRadius: 9, cursor: "pointer",
                            background: "transparent", border: `1px solid ${vermelho}`, color: vermelho,
                            fontFamily: FONT, fontSize: 11.5, fontWeight: 600, flexShrink: 0,
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── instalar: buscar entre os que não estão em cliente → escolher o bloco ───

function PainelInstalar({ chamadoId, clienteId, aoMover, c, isLight }: { chamadoId: string; clienteId: string; aoMover: () => void; c: ReturnType<typeof cinzas>; isLight: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<EquipamentoLivre | null>(null);
  const [sistemaId, setSistemaId] = useState<string>("");
  const { data, isLoading } = useEquipamentosLivres(busca, aberto);
  const { data: sistemas = [] } = useInventario(aberto ? clienteId : undefined);
  const blocos = sistemas.filter((s) => s.ativo !== false);
  const instalar = useMutation({
    mutationFn: () => {
      if (!escolhido) throw new Error("Escolha o equipamento.");
      if (!sistemaId) throw new Error("Escolha o bloco em que ele foi instalado.");
      return moverEquipamento({ patrimonioId: escolhido.patrimonio_id, chamadoId, tipo: "instalacao", sistemaId });
    },
    onSuccess: () => { aoMover(); setEscolhido(null); setSistemaId(""); toast.success("Equipamento instalado no bloco."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const entrada: CSSProperties = {
    height: 40, borderRadius: 12, padding: "0 12px", fontFamily: FONT, fontSize: 13, fontWeight: 400,
    background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto, outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <>
      <BotaoLeve onClick={() => setAberto((a) => !a)} aberto={aberto} c={c}>
        <PackagePlus size={14} /> Instalar equipamento…
      </BotaoLeve>
      {aberto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color={c.textoSecundario} style={{ position: "absolute", left: 12, top: 13 }} />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setEscolhido(null); }}
              placeholder="Buscar por identificação, nome, modelo, fabricante ou local…"
              aria-label="Buscar equipamento"
              style={{ ...entrada, paddingLeft: 34 }}
            />
          </div>
          {data?.faltaMigration && <AvisoMigration c={c} />}
          {isLoading && <span style={{ fontFamily: FONT, fontSize: 12, color: c.textoSecundario }}>Buscando…</span>}
          {!isLoading && (data?.itens.length ?? 0) === 0 && !data?.faltaMigration && (
            <span style={{ fontFamily: FONT, fontSize: 12, color: c.textoSecundario }}>Nenhum equipamento fora de cliente com esse texto.</span>
          )}
          {!escolhido && (data?.itens ?? []).map((it) => (
            <button
              key={it.patrimonio_id}
              type="button"
              onClick={() => setEscolhido(it)}
              className="hover-suave"
              style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "8px 12px", borderRadius: 10, background: c.campo, border: `1px solid ${c.divisoria}`, color: c.texto, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600 }}>{rotuloDoEquipamento(it)}</span>
              <span style={{ fontFamily: FONT, fontSize: 11, color: c.textoSecundario }}>
                {it.pessoa_nome ? `Com ${it.pessoa_nome}` : it.situacao === "retirado" ? "Retirado de cliente" : (it.local_qap || "Sem local")}
              </span>
            </button>
          ))}
          {escolhido && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 12, background: c.superficie, border: `1px solid ${c.divisoria}` }}>
              <span style={{ fontFamily: FONT, fontSize: 12.5, color: c.texto }}>
                <strong style={{ fontWeight: 600 }}>{rotuloDoEquipamento(escolhido)}</strong>
                <button type="button" onClick={() => setEscolhido(null)} style={{ marginLeft: 8, background: "none", border: "none", color: c.textoSecundario, cursor: "pointer", fontFamily: FONT, fontSize: 11.5, textDecoration: "underline" }}>trocar</button>
              </span>
              <select value={sistemaId} onChange={(e) => setSistemaId(e.target.value)} aria-label="Bloco em que foi instalado" style={entrada}>
                <option value="">Em qual bloco foi instalado?</option>
                {blocos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              {blocos.length === 0 && (
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: c.textoSecundario }}>Este cliente ainda não tem bloco cadastrado — crie na ficha do cliente.</span>
              )}
              <button
                type="button"
                onClick={() => instalar.mutate()}
                disabled={!sistemaId || instalar.isPending}
                style={{ ...goldButton(), boxShadow: "none", height: 40, borderRadius: 12, fontSize: 12.5, alignSelf: "flex-start", padding: "0 14px", opacity: !sistemaId || instalar.isPending ? 0.6 : 1 }}
              >
                {instalar.isPending ? "Gravando…" : "Confirmar instalação"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
