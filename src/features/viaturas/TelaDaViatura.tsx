// A TELA DA ETIQUETA — …/viatura/<codigo> (R266–R270). Nasceu para o celular.
//
// Davi, 13/09/2026: "a pessoa bipar para iniciar a viagem de ida a um cliente
// e bipar para encerrar" — e, no fim do mesmo dia (R276), "Remova a inserção
// do KM […] Quero apenas mapear local e data e com quem estava a viatura".
//
// A tela NÃO pergunta o que a pessoa quer fazer: ela lê o carro e o estado
// (`estadoDaViatura`, puro) e responde — livre inicia; em viagem sua encerra;
// em uso por um colega oferece assumir. Sem o km, sobrou UM TOQUE: a única
// pergunta que resta é a atividade, e ela é opcional (R270). O mockup
// aprovado antes do código está citado em docs/CONTEXTO_VIATURAS.md.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Car, ShieldAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton, rotuloDeSecao, botaoSelecao, etiqueta } from "@/lib/ui";
import { PRISMA, cinzas, misturar } from "@/lib/paleta";
import { useAtividades, useSessao } from "@/features/home/data";
import { minhasDeHoje } from "@/features/home/tecnico";
import { usePessoas, mapaDePessoas } from "@/features/chamados/data";
import { useClientes } from "@/features/clientes/data";
import {
  useViaturaPorCodigo, useViagensAbertas, useUltimasViagensDaViatura, useLocaisDeReferencia,
  useIniciarViagem, useEncerrarViagem, useViaturasProntas, RecusaDaViatura,
} from "./data";
import {
  estadoDaViatura, formatarDuracao, minutosDeViagem,
  ultimaDevolucao, destinosDoDia, RAIO_CHEGADA_M,
} from "./modelo";
import { useChegadaPorLocalizacao } from "./useChegada";

export function TelaDaViatura({ codigo }: { codigo: string }) {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const cz = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;
  const laranja = isLight ? PRISMA.laranja.light : PRISMA.laranja.dark;
  const textPrimary = isLight ? "#212121" : "#FFFFFF";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";

  const { data: sessao } = useSessao();
  const s = sessao ?? { userId: null, cargo: null };
  const ehTecnico = s.cargo === "tecnico";
  const ehGestor = s.cargo === "admin" || s.cargo === "sac" || s.cargo === "comercial";

  const { data: pronta } = useViaturasProntas();
  const { data: viatura, isLoading: carregandoViatura, error: erroViatura } = useViaturaPorCodigo(codigo);
  const { data: abertas = [] } = useViagensAbertas();
  const { data: ultimas = [] } = useUltimasViagensDaViatura(viatura?.id);
  const { data: pessoas = [] } = usePessoas();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);

  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // as atividades DELE de hoje — as opções de "para qual atividade" (R270) e os
  // destinos da chegada por localização (R274: todas as do dia)
  const { atividades } = useAtividades(s, "todos", agora, { semEncerradas: true });
  const hoje = useMemo(() => minhasDeHoje(atividades, agora), [atividades, agora]);
  const { data: clientes = [] } = useClientes();
  const { data: referencias = [] } = useLocaisDeReferencia();
  const sede = referencias.find((r) => r.codigo === "sede") ?? null;
  const destinos = useMemo(() => destinosDoDia(hoje, clientes as any, sede), [hoje, clientes, sede]);

  const abertaDaViatura = viatura ? abertas.find((v) => v.viatura_id === viatura.id) ?? null : null;
  const ultima = viatura ? ultimaDevolucao(ultimas, viatura.id) : null;
  const estado = estadoDaViatura(viatura, abertaDaViatura, s.userId, ultima);

  const chegada = useChegadaPorLocalizacao(estado.tipo === "minha", destinos);

  const [chamadoId, setChamadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const iniciar = useIniciarViagem();
  const encerrar = useEncerrarViagem();
  const salvando = iniciar.isPending || encerrar.isPending;

  const BOTAO: CSSProperties = {
    ...goldButton(), width: "100%", height: 48, borderRadius: 14, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    cursor: salvando ? "wait" : "pointer", opacity: salvando ? 0.7 : 1,
  };
  const GHOST: CSSProperties = {
    width: "100%", height: 44, borderRadius: 14, background: "transparent", border: `1px solid ${cz.divisoria}`,
    color: textSecondary, fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: "pointer",
  };
  /** O chip de estado — o MESMO do resto do app (`etiqueta`, DS §6): fundo
   *  sólido no tom rebaixado e tinta clara. O que eu tinha antes (texto na
   *  cor sobre a cor esmaecida) media 4,45:1 no tema claro, abaixo do piso
   *  de 4,5 para texto — MEDIDO no navegador. */
  const chip = (cor: { dark: string; light: string }, texto: string) => (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999,
      fontFamily: FONT, fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
      whiteSpace: "nowrap", ...etiqueta(cor),
    }}>{texto}</span>
  );
  const linha = (rotulo: string, valor: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: `1px solid ${cz.divisoria}`, fontFamily: FONT, fontSize: 12.5 }}>
      <span style={{ color: textSecondary, whiteSpace: "nowrap" }}>{rotulo}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{valor}</span>
    </div>
  );
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nomeDe = (id: string | null | undefined) => (id ? pessoasPorId[id]?.nome ?? "alguém" : "—");

  function recusa(e: unknown) {
    const msg = e instanceof RecusaDaViatura ? e.message : "Não foi possível registrar. Tente de novo.";
    setErro(msg);
    toast.error(msg);
  }

  async function aoIniciar(assumir: boolean) {
    if (!viatura) return;
    setErro(null);
    try {
      const r = await iniciar.mutateAsync({ codigo: viatura.codigo, chamadoId, assumir });
      if (r.assumida_de) toast.message(`A viagem de ${nomeDe(r.assumida_de)} foi encerrada agora.`);
      toast.success("Viagem iniciada. Boa viagem.");
      navigate({ to: "/dashboard" });
    } catch (e) { recusa(e); }
  }

  async function aoEncerrar() {
    if (estado.tipo !== "minha") return;
    setErro(null);
    try {
      const r = await encerrar.mutateAsync({ viagemId: estado.viagem.id });
      toast.success(`Viagem encerrada — ${formatarDuracao(r.minutos)} de deslocamento.`);
      navigate({ to: "/dashboard" });
    } catch (e) { recusa(e); }
  }

  // ── as cascas: carregando · migration · desconhecida ──────────────────────
  const casca = (filho: React.ReactNode) => (
    <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, paddingBottom: 96, color: textPrimary }}>
      {/* padding + margem negativa de mesmo valor: 56×19 vira 76×41 de área
          de toque sem tirar o texto do lugar (R275 — medido a 375px) */}
      <button onClick={() => navigate({ to: "/dashboard" })} aria-label="Voltar para a Início" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: textSecondary, fontFamily: FONT, fontSize: 12.5, cursor: "pointer", padding: "11px 10px", margin: "-11px -10px" }}>
        <ArrowLeft size={16} /> Início
      </button>
      {filho}
    </div>
  );
  const aviso = (texto: string, cor = textSecondary) => (
    <div style={{ ...card(isLight), padding: 16, fontFamily: FONT, fontSize: 13, color: cor, lineHeight: 1.5 }}>{texto}</div>
  );

  if (pronta === false) return casca(aviso("O controle de viaturas ainda não está ligado neste banco — precisa da migration U134. Fale com o Davi."));
  if (erroViatura) return casca(aviso("Não consegui carregar a viatura. Confira a conexão e tente de novo.", isLight ? "#B1242E" : "#F17881"));
  if (carregandoViatura || !sessao) return casca(aviso("Carregando…"));
  if (estado.tipo === "desconhecida") return casca(aviso(`Esta etiqueta (${codigo}) não corresponde a nenhuma viatura cadastrada. Se o carro é novo, a gestão cadastra em Administrativo › Viaturas.`));

  const v = estado.viatura;
  const cabecalho = (
    <div style={{ ...card(isLight), padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: cz.campo, display: "grid", placeItems: "center", color: gold, flexShrink: 0 }}>
          <Car size={22} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16 }}>{v.apelido}</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v.placa}</div>
        </div>
        {estado.tipo === "livre" && chip(PRISMA.verde, "Livre")}
        {estado.tipo === "minha" && chip(PRISMA.amarelo, "Em viagem")}
        {estado.tipo === "de_outro" && chip(PRISMA.laranja, "Em uso")}
        {estado.tipo === "inativa" && chip(PRISMA.neutro, "Removida")}
      </div>
      <div style={{ marginTop: 12 }}>
        {/* R276: sem o km, o que o cabeçalho tem a dizer é QUEM e QUANDO. */}
        {estado.tipo === "livre" && linha(
          "Última saída",
          ultima
            ? `${nomeDe(ultima.tecnicoId)} · ${new Date(ultima.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora(ultima.quando)}`
            : "nenhuma ainda",
        )}
        {estado.tipo === "minha" && (
          <>
            {linha("Você saiu", `${hora(estado.viagem.saida_em)} · há ${formatarDuracao(minutosDeViagem(estado.viagem, agora))}`)}
            {estado.viagem.chamado_id && linha("Atividade", hoje.find((a) => a.registroId === estado.viagem.chamado_id)?.titulo ?? "vinculada")}
          </>
        )}
        {estado.tipo === "de_outro" && linha("Com", `${nomeDe(estado.viagem.tecnico_id)} · desde ${hora(estado.viagem.saida_em)}`)}
      </div>
    </div>
  );

  if (estado.tipo === "inativa") {
    return casca(<>{cabecalho}{aviso("Esta viatura foi removida do sistema — as viagens antigas continuam na folha. Se o carro voltou, a gestão a reativa em Administrativo › Viaturas.")}</>);
  }

  // quem não é técnico vê o estado e o caminho para a folha (D11)
  if (!ehTecnico) {
    return casca(
      <>
        {cabecalho}
        {aviso("Só quem tem cargo técnico registra a viagem (R266). Você está vendo o estado do carro.")}
        {ehGestor && (
          <button onClick={() => navigate({ to: "/painel/administrativo", search: { aba: "viaturas" } as any })} style={GHOST}>
            Abrir a folha das viaturas
          </button>
        )}
      </>,
    );
  }

  const erroCaixa = erro && (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5, color: isLight ? "#B1242E" : "#F17881", background: isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)", border: isLight ? "1px solid rgba(177,36,46,0.22)" : "1px solid rgba(241,120,129,0.24)" }}>
      <WifiOff size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {erro}
    </div>
  );

  // ── LIVRE: iniciar ────────────────────────────────────────────────────────
  if (estado.tipo === "livre") {
    return casca(
      <>
        {cabecalho}
        <div>
          <span style={rotuloDeSecao(isLight)}>Para qual atividade <span style={{ opacity: 0.55, fontWeight: 600 }}>(opcional)</span></span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {hoje.map((a) => (
              <button key={a.id} type="button" aria-pressed={chamadoId === a.registroId}
                onClick={() => setChamadoId(chamadoId === a.registroId ? null : a.registroId)}
                style={{ ...botaoSelecao(chamadoId === a.registroId, isLight, null), boxShadow: "none", minHeight: 40, padding: "0 14px", borderRadius: 999, fontSize: 12.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.cliente ? `${a.cliente} · ${a.titulo}` : a.titulo}
              </button>
            ))}
            <button type="button" aria-pressed={chamadoId === null} onClick={() => setChamadoId(null)}
              style={{ ...botaoSelecao(chamadoId === null, isLight, null), boxShadow: "none", minHeight: 40, padding: "0 14px", borderRadius: 999, fontSize: 12.5 }}>
              Sem atividade
            </button>
          </div>
        </div>
        {erroCaixa}
        <button onClick={() => void aoIniciar(false)} disabled={salvando} style={BOTAO}>
          {salvando ? "Registrando…" : "Iniciar viagem →"}
        </button>
        <div style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, textAlign: "center", lineHeight: 1.5 }}>
          Ao chegar, bipe a etiqueta de novo — ou encerre pela Início.
        </div>
      </>,
    );
  }

  // ── MINHA: encerrar ───────────────────────────────────────────────────────
  if (estado.tipo === "minha") {
    return casca(
      <>
        {cabecalho}
        {chegada.chegou && (
          <div style={{ ...card(isLight), padding: "12px 14px", border: `1px solid ${misturar(gold, cz.superficie, 0.45)}`, display: "flex", alignItems: "center", gap: 12 }}>
            <ShieldAlert size={18} color={gold} style={{ flexShrink: 0 }} />
            <div style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.4 }}>
              <b style={{ fontWeight: 600 }}>Você chegou a {chegada.chegou.nome}?</b>
              <div style={{ fontSize: 12, color: textSecondary }}>Há mais de 2 minutos a menos de {RAIO_CHEGADA_M} m daqui.</div>
            </div>
          </div>
        )}
        {erroCaixa}
        <button onClick={() => void aoEncerrar()} disabled={salvando} style={BOTAO}>
          {salvando ? "Registrando…" : "Encerrar viagem ✓"}
        </button>
        {chegada.erro && <div style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, textAlign: "center", lineHeight: 1.5 }}>{chegada.erro}</div>}
      </>,
    );
  }

  // ── DE OUTRO: assumir ─────────────────────────────────────────────────────
  return casca(
    <>
      {cabecalho}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5, background: misturar(laranja, cz.superficie, 0.88), border: `1px solid ${misturar(laranja, cz.superficie, 0.6)}` }}>
        <ShieldAlert size={16} color={laranja} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{nomeDe(estado.viagem.tecnico_id)} não encerrou a viagem. Se o carro está com você, <b style={{ fontWeight: 600 }}>assuma</b>: a viagem dele encerra agora, e a sua começa daqui.</span>
      </div>
      {erroCaixa}
      <button onClick={() => void aoIniciar(true)} disabled={salvando} style={BOTAO}>
        {salvando ? "Registrando…" : "Assumir e iniciar viagem →"}
      </button>
      <button onClick={() => navigate({ to: "/dashboard" })} style={GHOST}>Voltar</button>
      <div style={{ fontFamily: FONT, fontSize: 11.5, color: textSecondary, textAlign: "center", lineHeight: 1.5 }}>
        A gestão vê "encerrada ao assumir" na folha de {nomeDe(estado.viagem.tecnico_id)}.
      </div>
    </>,
  );
}
