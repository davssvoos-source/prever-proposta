// A ABA VIATURAS do Painel Administrativo (R271/R272): o CADASTRO dos carros,
// a SEDE como ponto e a FOLHA — quem usou qual carro em que dia.
//
// Davi, 13/09/2026: "quero um espaço dentro do sistema, na tela do Painel
// Administrativo para cadastrar viaturas e remover viaturas do sistema"; "A
// ideia também é contar o tempo de ida entre clientes, o tempo de transporte
// em cada trecho."
//
// A folha e os números dela saem da MESMA lista (`filtrarFolha` →
// `resumoDaFolha`/`totaisPor`, puros): o total não tem como discordar das
// linhas. A duração é calculada; "assumida" vem etiquetada; a viagem deixada
// aberta o gestor encerra na própria linha (com rastro — a porta
// grava quem e quando).

import { useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { Car, Check, Pencil, Plus, Trash2, X, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton, rotuloDeSecao, etiqueta } from "@/lib/ui";
import { PRISMA, cinzas, misturar } from "@/lib/paleta";
import { MenuFiltro } from "@/features/home/MenuFiltro";
import { usePessoas, mapaDePessoas } from "@/features/chamados/data";
import {
  useViaturas, useViagensDaCompetencia, useLocaisDeReferencia, useTitulosDeChamados,
  useSalvarViatura, useDesativarViatura, useExcluirViatura, useCorrigirViagem, useSalvarLocalDeReferencia, useViaturasProntas,
} from "./data";
import {
  filtrarFolha, resumoDaFolha, totaisPor, minutosDeViagem, formatarDuracao,
  codigoSugerido, erroDaViatura, permanencias, type Viatura, type Viagem,
} from "./modelo";
import { competenciaDe } from "@/features/home/tecnico";

export function PainelDeViaturas() {
  const { isLight } = useTheme();
  const cz = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const verde = isLight ? PRISMA.verde.light : PRISMA.verde.dark;
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  const textPrimary = isLight ? "#212121" : "#FFFFFF";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const agora = useMemo(() => new Date(), []);

  const { data: pronta } = useViaturasProntas();
  const { data: viaturas = [] } = useViaturas();
  const { data: pessoas = [] } = usePessoas();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);
  const { data: referencias = [] } = useLocaisDeReferencia();
  const sede = referencias.find((r) => r.codigo === "sede") ?? null;

  const [competencia, setCompetencia] = useState(() => competenciaDe(new Date()));
  const [viaturaFiltro, setViaturaFiltro] = useState<string | null>(null);
  const [tecnicoFiltro, setTecnicoFiltro] = useState<string | null>(null);
  const { data: viagens = [], isLoading: carregandoFolha } = useViagensDaCompetencia(competencia);
  const linhas = useMemo(() => filtrarFolha(viagens, { competencia, viaturaId: viaturaFiltro, tecnicoId: tecnicoFiltro }), [viagens, competencia, viaturaFiltro, tecnicoFiltro]);
  const resumo = useMemo(() => resumoDaFolha(linhas, agora), [linhas, agora]);
  const porTecnico = useMemo(() => totaisPor(linhas, "tecnico_id", agora), [linhas, agora]);
  const porViatura = useMemo(() => totaisPor(linhas, "viatura_id", agora), [linhas, agora]);
  const paradas = useMemo(() => permanencias(linhas), [linhas]);
  const { data: titulos = {} } = useTitulosDeChamados(linhas.map((v) => v.chamado_id).filter((x): x is string => !!x));

  const INPUT: CSSProperties = {
    height: 36, borderRadius: 10, padding: "0 12px", background: cz.campo, border: `1px solid ${cz.divisoria}`,
    color: textPrimary, fontFamily: FONT, fontSize: 12.5, outline: "none", boxSizing: "border-box", colorScheme: isLight ? "light" : "dark",
  };
  const BOTAO_SEC: CSSProperties = {
    height: 34, padding: "0 12px", borderRadius: 10, background: cz.campo, border: `1px solid ${cz.divisoria}`,
    color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  };
  /** O mesmo chip do resto do app (`etiqueta`, DS §6) — o porquê está na TelaDaViatura. */
  const chip = (cor: { dark: string; light: string }, texto: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999, fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", ...etiqueta(cor) }}>{texto}</span>
  );
  const nomeDe = (id: string | null | undefined) => (id ? pessoasPorId[id]?.nome ?? "—" : "—");
  const viaturaDe = (id: string) => viaturas.find((v) => v.id === id);

  if (pronta === false) {
    return (
      <div style={{ ...card(isLight), padding: 16, fontFamily: FONT, fontSize: 13, color: textSecondary, lineHeight: 1.5 }}>
        O controle de viaturas precisa da migration <b style={{ color: textPrimary, fontWeight: 600 }}>U134</b> — rode-a no SQL Editor e volte aqui para cadastrar os carros.
      </div>
    );
  }

  return (
    <div className="viaturas-colunas">
      {/* ── coluna 1: o cadastro e a sede ─────────────────────────────────── */}
      <section aria-labelledby="adm-viaturas" style={{ ...card(isLight), borderRadius: 18, padding: 16, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 id="adm-viaturas" style={{ ...rotuloDeSecao(isLight), display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
          <Car size={13} /> Viaturas
        </h2>
        <Cadastro viaturas={viaturas} isLight={isLight} INPUT={INPUT} BOTAO_SEC={BOTAO_SEC} chip={chip} cores={{ gold, verde, textSecondary, textPrimary, divisoria: cz.divisoria }} />
        <div style={{ borderTop: `1px solid ${cz.divisoria}`, paddingTop: 12 }}>
          <span style={rotuloDeSecao(isLight)}>A sede <span style={{ opacity: 0.55, fontWeight: 600 }}>(o ponto da volta)</span></span>
          <Sede sede={sede} INPUT={INPUT} BOTAO_SEC={BOTAO_SEC} textSecondary={textSecondary} />
        </div>
      </section>

      {/* ── coluna 2: a folha ──────────────────────────────────────────────── */}
      <section aria-labelledby="adm-folha" style={{ ...card(isLight), borderRadius: 18, padding: 16, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h2 id="adm-folha" style={{ ...rotuloDeSecao(isLight), margin: 0 }}>Folha — quem usou qual carro</h2>
          <div style={{ flex: 1 }} />
          <input type="month" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} aria-label="Competência" style={{ ...INPUT, width: 150 }} />
          <MenuFiltro rotulo="Viatura" vazio="Todas as viaturas" opcoes={viaturas.map((v) => ({ valor: v.id, label: v.apelido, nota: v.placa }))}
            selecionados={viaturaFiltro ? [viaturaFiltro] : []} onMudar={(v) => setViaturaFiltro(v[0] ?? null)} />
          <MenuFiltro rotulo="Técnico" vazio="Todos os técnicos" opcoes={pessoas.filter((p) => p.cargo === "tecnico").map((p) => ({ valor: p.id, label: p.nome }))}
            selecionados={tecnicoFiltro ? [tecnicoFiltro] : []} onMudar={(v) => setTecnicoFiltro(v[0] ?? null)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          {[
            { n: String(resumo.viagens), l: "viagens" },
            { n: formatarDuracao(resumo.minutos), l: "em deslocamento" },
            { n: String(resumo.abertas), l: "em aberto agora" },
            { n: String(resumo.avisos), l: "para conferir" },
          ].map((k) => (
            <div key={k.l} style={{ background: cz.elevada, border: `1px solid ${cz.divisoria}`, borderRadius: 14, padding: "10px 12px" }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{k.n}</div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, marginTop: 2 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {carregandoFolha ? (
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary }}>Carregando a folha…</div>
        ) : linhas.length === 0 ? (
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, padding: "12px 0" }}>Nenhuma viagem neste recorte.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: 12.5 }}>
              <thead>
                <tr>
                  {/* R276: as duas colunas de km e a de rodados saíram — o que
                      a folha responde agora é quem, quando e para onde. */}
                  {["Dia", "Viatura", "Técnico", "Saída → chegada", "Tempo", "Destino", ""].map((h, i) => (
                    <th key={h + i} style={{ textAlign: i === 4 ? "right" : "left", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: textSecondary, fontWeight: 700, padding: "8px 10px", borderBottom: `1px solid ${cz.divisoria}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((v) => (
                  <LinhaDaFolha key={v.id} v={v} viatura={viaturaDe(v.viatura_id)} nome={nomeDe(v.tecnico_id)} encerradaPor={v.encerrada_por && v.encerrada_por !== v.tecnico_id ? nomeDe(v.encerrada_por) : null}
                    titulo={v.chamado_id ? titulos[v.chamado_id] ?? null : null} agora={agora} cores={{ gold, laranja, textSecondary, textPrimary, divisoria: cz.divisoria, campo: cz.campo }} chip={chip} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {linhas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, borderTop: `1px solid ${cz.divisoria}`, paddingTop: 12 }}>
            <div>
              <span style={rotuloDeSecao(isLight)}>Por técnico</span>
              {porTecnico.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontFamily: FONT, fontSize: 12.5, borderBottom: `1px solid ${cz.divisoria}` }}>
                  <span>{nomeDe(t.id)}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: textSecondary }}>{t.resumo.viagens} viag. · <b style={{ color: textPrimary, fontWeight: 600 }}>{formatarDuracao(t.resumo.minutos)}</b> em deslocamento</span>
                </div>
              ))}
            </div>
            <div>
              <span style={rotuloDeSecao(isLight)}>Por viatura</span>
              {porViatura.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontFamily: FONT, fontSize: 12.5, borderBottom: `1px solid ${cz.divisoria}` }}>
                  <span>{viaturaDe(t.id)?.apelido ?? "—"}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: textSecondary }}>{t.resumo.viagens} viag. · <b style={{ color: textPrimary, fontWeight: 600 }}>{formatarDuracao(t.resumo.minutos)}</b> em deslocamento</span>
                </div>
              ))}
            </div>
            {paradas.length > 0 && (
              <div>
                <span style={rotuloDeSecao(isLight)}>Permanência nos clientes <span style={{ opacity: 0.55, fontWeight: 600 }}>(entre trechos)</span></span>
                <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, marginTop: 8, lineHeight: 1.5 }}>
                  {paradas.length} parada{paradas.length === 1 ? "" : "s"} · média de {formatarDuracao(paradas.reduce((s, p) => s + p.minutos, 0) / paradas.length)} por parada
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── uma linha da folha, com o encerramento pela gestão (R276) ───────────────
function LinhaDaFolha({ v, viatura, nome, encerradaPor, titulo, agora, cores, chip }: {
  v: Viagem; viatura: Viatura | undefined; nome: string; encerradaPor: string | null; titulo: string | null; agora: Date;
  cores: { gold: string; laranja: string; textSecondary: string; textPrimary: string; divisoria: string; campo: string };
  chip: (cor: { dark: string; light: string }, texto: string) => ReactElement;
}) {
  const corrigir = useCorrigirViagem();
  const aberta = !v.chegada_em;
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const td = (filho: ReactNode, alinhar: "left" | "right" = "left", quebra = false) => (
    <td style={{
      padding: "8px 10px", borderBottom: `1px solid ${cores.divisoria}`, textAlign: alinhar,
      // só o destino quebra: o resto é data, hora e número, que ficam
      // ilegíveis partidos ao meio
      whiteSpace: quebra ? "normal" : "nowrap", minWidth: quebra ? 160 : undefined,
      fontVariantNumeric: "tabular-nums", color: aberta ? cores.gold : cores.textPrimary,
    }}>{filho}</td>
  );

  /** A viagem que o técnico esqueceu aberta: a gestão encerra agora, com rastro. */
  async function encerrarPelaGestao() {
    try {
      await corrigir.mutateAsync({ viagemId: v.id, chegadaEm: new Date().toISOString() });
      toast.success("Viagem encerrada pela gestão — fica registrado quem encerrou e quando.");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <tr>
      {td(new Date(v.saida_em).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }))}
      {td(viatura?.apelido ?? "—")}
      {td(nome)}
      {td(<>{hora(v.saida_em)} → {v.chegada_em ? hora(v.chegada_em) : <i>em viagem</i>}
        {v.encerramento === "assumida" && <span title={encerradaPor ? `assumida por ${encerradaPor}` : "assumida por outro técnico"} style={{ marginLeft: 8 }}>{chip(PRISMA.laranja, "assumida")}</span>}
        {v.encerramento === "gestor" && <span title="encerrada pela gestão, na folha" style={{ marginLeft: 8 }}>{chip(PRISMA.neutro, "pela gestão")}</span>}
      </>)}
      {td(formatarDuracao(minutosDeViagem(v, agora)), "right")}
      {td(titulo ?? <span style={{ color: cores.textSecondary }}>—</span>, "left", true)}
      {td(aberta ? (
        <button onClick={() => void encerrarPelaGestao()} disabled={corrigir.isPending}
          title="Encerrar esta viagem agora, pela gestão" aria-label={`Encerrar a viagem de ${nome} agora`}
          style={{ ...goldButton(), height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", opacity: corrigir.isPending ? 0.7 : 1 }}>
          <Check size={13} /> Encerrar
        </button>
      ) : null, "right")}
    </tr>
  );
}

// ── o cadastro (R271) ───────────────────────────────────────────────────────
function Cadastro({ viaturas, isLight, INPUT, BOTAO_SEC, chip, cores }: {
  viaturas: Viatura[]; isLight: boolean; INPUT: CSSProperties; BOTAO_SEC: CSSProperties;
  chip: (cor: { dark: string; light: string }, texto: string) => ReactElement;
  cores: { gold: string; verde: string; textSecondary: string; textPrimary: string; divisoria: string };
}) {
  const salvar = useSalvarViatura();
  const desativar = useDesativarViatura();
  const excluir = useExcluirViatura();
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({ apelido: "", placa: "", codigo: "" });
  const [codigoTocado, setCodigoTocado] = useState(false);

  function abrir(v?: Viatura) {
    setEditando(v?.id ?? null);
    setNova(!v);
    setForm(v ? { apelido: v.apelido, placa: v.placa, codigo: v.codigo } : { apelido: "", placa: "", codigo: "" });
    setCodigoTocado(!!v);
  }
  function mudarApelido(a: string) {
    setForm((f) => ({ ...f, apelido: a, codigo: codigoTocado ? f.codigo : codigoSugerido(a) }));
  }
  async function gravar() {
    const erro = erroDaViatura(form);
    if (erro) { toast.error(erro); return; }
    try {
      await salvar.mutateAsync({ id: editando ?? undefined, ...form });
      toast.success(editando ? "Viatura atualizada." : `Viatura cadastrada. Grave na etiqueta: …/viatura/${form.codigo}`);
      setNova(false); setEditando(null);
    } catch (e) { toast.error((e as Error).message); }
  }

  const formulario = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: isLight ? "#f7f7f7" : "rgba(255,255,255,0.03)", border: `1px solid ${cores.divisoria}` }}>
      <input value={form.apelido} onChange={(e) => mudarApelido(e.target.value)} placeholder="Apelido (ex.: Fiorino branca)" aria-label="Apelido" style={INPUT} />
      <input value={form.placa} onChange={(e) => setForm((f) => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="Placa (ex.: ABC-1D23)" aria-label="Placa" style={INPUT} />
      <div>
        <input value={form.codigo} onChange={(e) => { setCodigoTocado(true); setForm((f) => ({ ...f, codigo: e.target.value.toLowerCase() })); }} placeholder="Código da etiqueta (ex.: fiorino-1)" aria-label="Código da etiqueta" style={INPUT} />
        <div style={{ fontFamily: FONT, fontSize: 11, color: cores.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
          É o que vai gravado na etiqueta: <code style={{ fontFamily: "ui-monospace, Consolas, monospace", color: cores.textPrimary }}>{typeof window !== "undefined" ? window.location.origin : ""}/viatura/{form.codigo || "…"}</code>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void gravar()} disabled={salvar.isPending} style={{ ...goldButton(), height: 36, padding: "0 14px", borderRadius: 10, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Check size={14} /> {editando ? "Salvar" : "Cadastrar"}
        </button>
        <button onClick={() => { setNova(false); setEditando(null); }} style={BOTAO_SEC}><X size={14} /> Cancelar</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {viaturas.length === 0 && !nova && (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: cores.textSecondary, lineHeight: 1.5 }}>Nenhuma viatura ainda. Cadastre a primeira — placa, apelido e o código que vai na etiqueta.</div>
      )}
      {viaturas.map((v) => (
        editando === v.id ? <div key={v.id}>{formulario}</div> : (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 14, border: `1px solid ${cores.divisoria}`, opacity: v.ativa ? 1 : 0.6 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>{v.apelido} {v.ativa ? chip(PRISMA.verde, "ativa") : chip(PRISMA.neutro, "removida")}</div>
              <div style={{ fontFamily: FONT, fontSize: 11.5, color: cores.textSecondary, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{v.placa} · etiqueta <code style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{v.codigo}</code></div>
            </div>
            <button onClick={() => abrir(v)} title="Editar" aria-label={`Editar ${v.apelido}`} style={{ ...BOTAO_SEC, width: 32, padding: 0, justifyContent: "center" }}><Pencil size={13} /></button>
            {v.ativa ? (
              <button onClick={() => desativar.mutate({ id: v.id, ativa: false }, { onSuccess: () => toast.success("Viatura removida — as viagens dela ficam na folha.") })} title="Remover (desativar)" aria-label={`Remover ${v.apelido}`} style={{ ...BOTAO_SEC, width: 32, padding: 0, justifyContent: "center" }}><Trash2 size={13} /></button>
            ) : (
              <>
                <button onClick={() => desativar.mutate({ id: v.id, ativa: true }, { onSuccess: () => toast.success("Viatura reativada.") })} title="Reativar" aria-label={`Reativar ${v.apelido}`} style={{ ...BOTAO_SEC, width: 32, padding: 0, justifyContent: "center" }}><RotateCcw size={13} /></button>
                <button onClick={() => excluir.mutate(v.id, { onSuccess: () => toast.success("Viatura apagada."), onError: (e) => toast.error((e as Error).message) })} title="Apagar de verdade (só sem viagens)" aria-label={`Apagar ${v.apelido}`} style={{ ...BOTAO_SEC, width: 32, padding: 0, justifyContent: "center" }}><X size={13} /></button>
              </>
            )}
          </div>
        )
      ))}
      {nova ? formulario : (
        <button onClick={() => abrir()} style={{ ...BOTAO_SEC, alignSelf: "flex-start" }}><Plus size={14} /> Cadastrar viatura</button>
      )}
    </div>
  );
}

// ── a sede (Q25): o ponto do trecho de volta ────────────────────────────────
function Sede({ sede, INPUT, BOTAO_SEC, textSecondary }: {
  sede: { id: string; endereco: string | null; latitude: number | null; longitude: number | null } | null;
  INPUT: CSSProperties; BOTAO_SEC: CSSProperties; textSecondary: string;
}) {
  const salvar = useSalvarLocalDeReferencia();
  const [coord, setCoord] = useState(sede && sede.latitude !== null && sede.longitude !== null ? `${sede.latitude}, ${sede.longitude}` : "");
  const [endereco, setEndereco] = useState(sede?.endereco ?? "");
  if (!sede) return <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, marginTop: 8 }}>A sede entra com a migration U134.</div>;

  async function gravar() {
    const m = coord.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!m) { toast.error("Cole a coordenada como no Google Maps: -23.7089, -46.7035"); return; }
    const lat = Number(m[1].replace(",", ".")), lng = Number(m[2].replace(",", "."));
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { toast.error("Coordenada fora do mundo."); return; }
    try {
      await salvar.mutateAsync({ id: sede!.id, endereco: endereco.trim() || null, latitude: lat, longitude: lng });
      toast.success("Sede atualizada — é o ponto que a chegada por localização usa na volta.");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      <input value={endereco} onChange={(e) => setEndereco(e.target.value)} aria-label="Endereço da sede" style={INPUT} />
      <div style={{ display: "flex", gap: 8 }}>
        <input value={coord} onChange={(e) => setCoord(e.target.value)} placeholder="-23.7089, -46.7035" aria-label="Coordenada da sede" style={{ ...INPUT, flex: 1 }} />
        <button onClick={() => void gravar()} disabled={salvar.isPending} style={BOTAO_SEC}><MapPin size={14} /> Salvar</button>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 11, color: textSecondary, lineHeight: 1.5 }}>
        A coordenada semeada é o centro da rua no mapa aberto. Para o ponto exato: no Google Maps, toque e segure sobre a sede, copie os dois números e cole aqui.
      </div>
    </div>
  );
}
