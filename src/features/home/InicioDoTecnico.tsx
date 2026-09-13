// A Início do TÉCNICO DE CAMPO (R263) — a tela do celular.
//
// Davi, 12/09/2026: "Os técnicos de campo são os com cargo TÉCNICO, eles
// utilizarão pelo celular. Eles devem ter em seu app somente 3 páginas: INICIO,
// AGENDA, PERFIL. A página INICIO deve aparecer quantas atividades ele tem
// pendente hoje, além de aparecer em ordem da mais próxima no topo os cards das
// atividades na tela INICIO."
//
// NASCEU PARA O CELULAR (R134), e NÃO é a Início do gestor com menos coisas —
// é outra tela: sem painéis, sem quadro, sem barra de filtros, sem busca. O
// que ela tem, de cima para baixo:
//   1. a frase do dia — "Bom dia, Breno. Você tem 3 atividades hoje." — que
//      conta SEMPRE as dele (R11), seja qual for o recorte da lista;
//   2. a faixa de sobreaviso, quando ele é o plantonista da semana;
//   3. UM interruptor, Minhas | Equipe — o mesmo que a Agenda lê (Davi: "todas
//      as atividades da equipe para saber o que os colegas tem");
//   4. os cards em dois grupos, Hoje · A seguir, cada um da mais próxima para
//      a mais distante — atrasada vem antes de tudo;
//   5. o "+", que para ele é só o registro de plantão (R163/R231).
// Toda a conta mora em `tecnico.ts` (puro, com asserção); aqui só se desenha.
// No computador ela também abre — numa coluna só, sem o banner — porque a
// pessoa pode estar na sede; mas a tela foi desenhada para o polegar.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Inbox, Plus, ShieldAlert, WifiOff } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, card, goldButton, rotuloDeSecao } from "@/lib/ui";
import { PRISMA, cinzas, misturar } from "@/lib/paleta";
import { dataIso } from "@/lib/periodos";
import { visitaRouteFor } from "@/lib/visita-route";
import { usePessoas, mapaDePessoas, useChamadosRealtime } from "@/features/chamados/data";
import { useAtividades, type Sessao } from "@/features/home/data";
import { CardAtividade } from "@/features/home/CardAtividade";
import { NovaAtividadeDialog } from "@/features/home/NovaAtividadeDialog";
import { SeletorMinhasEquipe, useRecorteDoTecnico } from "@/features/home/RecorteDoTecnico";
import {
  atividadesDoTecnico, gruposDoTecnico, minhasDeHoje, fraseDoDia, saudacao, primeiroNome, competenciaDe,
} from "@/features/home/tecnico";
import { useSobreaviso, usePessoasDoSobreaviso } from "@/features/sobreaviso/data";
import { plantonistasDaSemana, segundaDaSemana, rotuloDaSemana } from "@/features/sobreaviso/modelo";
import type { Atividade } from "@/features/atividades/modelo";

export function InicioDoTecnico({ sessao }: { sessao: Sessao }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLight } = useTheme();
  const cz = cinzas(isLight);
  const gold = isLight ? PRISMA.amarelo.light : PRISMA.amarelo.dark;

  // um relógio que anda — a mesma decisão da Início do gestor: `agora`
  // congelado deixaria "hoje" errado para quem abre o app às 7h e só fecha à
  // noite, que é exatamente o técnico
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useChamadosRealtime();
  // "todos": o recorte de pessoa é escolha de quem olha (o interruptor), não
  // imposição da consulta — e o banco já devolve só atividade de campo (R264)
  // `semEncerradas`: o técnico só lista pendência — as 300 encerradas e as
  // quatro semanas de histórico dos painéis do gestor são ~2.300 linhas que
  // esta tela nunca desenharia, num aparelho em 4G
  const { atividades, visitas, carregando, erro } = useAtividades(sessao, "todos", agora, { semEncerradas: true });
  const { data: pessoas = [] } = usePessoas();
  const pessoasPorId = useMemo(() => mapaDePessoas(pessoas), [pessoas]);
  const meuNome = sessao.userId ? pessoasPorId[sessao.userId]?.nome : null;

  const [recorte, setRecorte] = useRecorteDoTecnico();
  const hoje = useMemo(() => minhasDeHoje(atividades, agora), [atividades, agora]);
  const minhas = useMemo(() => atividadesDoTecnico(atividades, "minhas"), [atividades]);
  const daEquipe = useMemo(() => atividadesDoTecnico(atividades, "equipe"), [atividades]);
  const grupos = useMemo(
    () => gruposDoTecnico(recorte === "equipe" ? daEquipe : minhas, agora),
    [recorte, daEquipe, minhas, agora],
  );

  // o sobreaviso: sou o plantonista desta semana? A janela da competência já
  // traz um mês de cada lado, então a semana que atravessa o mês vem inteira.
  const { data: linhasEscala = [] } = useSobreaviso(competenciaDe(agora));
  const { data: candidatas = [] } = usePessoasDoSobreaviso();
  const segunda = segundaDaSemana(dataIso(agora));
  const souPlantonista = useMemo(
    () => !!sessao.userId && plantonistasDaSemana(segunda, candidatas, linhasEscala).some((q) => q.pessoa.id === sessao.userId),
    [segunda, candidatas, linhasEscala, sessao.userId],
  );

  const [novaAberta, setNovaAberta] = useState(false);

  /** O card abre o FLUXO da atividade (R134): a visita, a tela do funil dela;
   *  o chamado de campo, a página inteira — no celular não há diálogo largo. */
  function abrir(a: Atividade) {
    if (a.fonte === "visita") {
      const v = visitas.find((x) => x.id === a.registroId);
      navigate({ ...visitaRouteFor((v?.status ?? "pendente") as any, a.registroId), state: { from: location.pathname } } as any);
      return;
    }
    navigate({ to: "/chamados/$id", params: { id: a.registroId } });
  }

  const textPrimary = isLight ? "#212121" : "#FFFFFF";
  const textSecondary = isLight ? "#505050" : "rgba(255,255,255,0.55)";
  const frase = fraseDoDia(hoje.length);
  const nome = primeiroNome(meuNome);
  const cumprimento = `${saudacao(agora)}${nome ? `, ${nome}` : ""}.`;

  const secao = (titulo: string, lista: Atividade[], vazio: string) => (
    <section aria-label={titulo} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={rotuloDeSecao(isLight)}>{titulo}</span>
        <span style={{ fontFamily: FONT, fontSize: 12, color: textSecondary, fontVariantNumeric: "tabular-nums" }}>{lista.length}</span>
      </div>
      {lista.length === 0 ? (
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: textSecondary, padding: "6px 2px" }}>{vazio}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map((a) => (
            <CardAtividade key={a.id} a={a} onClick={() => abrir(a)} pessoas={pessoasPorId} />
          ))}
        </div>
      )}
    </section>
  );

  const FAB: CSSProperties = {
    ...goldButton(),
    position: "fixed", right: 16,
    // acima da barra inferior: a pílula mede ~78px (padding 10 + ícone 22 +
    // 3 + texto 12 + py 16 + borda) e fica a 16px do chão — 96px de folga
    // deixam o botão inteiro acima do ombro direito dela num celular de
    // 360px, mais o recuo do aparelho quando ele tem
    bottom: "calc(max(16px, env(safe-area-inset-bottom)) + 96px)",
    width: 52, height: 52, borderRadius: 26, zIndex: 45,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  };

  return (
    <>
      {/* O banner — só no celular, com as margens negativas casadas com o
          padding do <main> (as mesmas da Início do gestor). */}
      <div className="banner-home so-celular" style={{
        marginTop: -76, marginLeft: -16, marginRight: -16,
        position: "relative", height: "28vh", minHeight: 180, overflow: "hidden",
      }}>
        <img
          src={isLight ? "/banner-home-light.jpg" : "/banner-home.jpg"}
          alt="Frota Prever"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: isLight
            ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(244,245,247,0.9) 100%)"
            : "linear-gradient(to bottom, rgba(8,8,12,0.30) 0%, rgba(8,8,12,0.45) 60%, rgba(8,8,12,0.55) 100%)",
          pointerEvents: "none",
        }} />
        {!isLight && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
            background: "linear-gradient(to bottom, rgba(8,9,14,0) 0%, rgba(8,9,14,0.7) 55%, rgb(8,9,14) 100%)",
            pointerEvents: "none",
          }} />
        )}
        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, padding: "0 20px", textAlign: "center" }}>
          <div style={{
            fontFamily: FONT, fontWeight: 400, fontSize: 13, lineHeight: 1.2,
            color: isLight ? "#505050" : "rgba(255,255,255,0.85)",
            textShadow: isLight ? "0 1px 6px rgba(255,255,255,0.6)" : "0 1px 6px rgba(0,0,0,0.6)",
          }}>
            {cumprimento}
          </div>
          <div style={{
            fontFamily: FONT, fontWeight: 600, fontSize: 24, lineHeight: 1.2, marginTop: 4,
            color: isLight ? "#212121" : "#FFFFFF",
            textShadow: isLight ? "0 1px 8px rgba(255,255,255,0.65)" : "0 1px 8px rgba(0,0,0,0.55), 0 2px 16px rgba(0,0,0,0.35)",
          }}>
            {carregando && atividades.length === 0 ? "Carregando seu dia" : frase}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16, paddingTop: 4, paddingBottom: 96 }}>
        {/* No computador não há banner: a frase vira o título da página. */}
        <div className="so-desktop" style={{ flexDirection: "column", gap: 2 }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, margin: "2px 0 0", color: textPrimary, letterSpacing: "-0.01em" }}>
            {carregando && atividades.length === 0 ? "Carregando seu dia" : frase}
          </h1>
        </div>

        {/* Falha de rede não pode parecer "não tenho trabalho hoje" — é a
            mentira mais cara possível para quem está em campo. */}
        {erro && (
          <div style={{
            display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 12,
            background: isLight ? "rgba(177,36,46,0.06)" : "rgba(241,120,129,0.08)",
            border: isLight ? "1px solid rgba(177,36,46,0.22)" : "1px solid rgba(241,120,129,0.24)",
            fontFamily: FONT, fontSize: 12.5, color: isLight ? "#B1242E" : "#F17881",
          }}>
            <WifiOff size={15} style={{ flexShrink: 0 }} />
            Não consegui carregar suas atividades. O que está abaixo pode estar incompleto.
          </div>
        )}

        {/* A faixa do sobreaviso: só quando é ele. Cor da marca REBAIXADA por
            mistura com a superfície — é informação, não ação (R174). */}
        {souPlantonista && (
          <div style={{
            ...card(isLight), padding: "12px 14px",
            border: `1px solid ${misturar(gold, cz.superficie, 0.55)}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <ShieldAlert size={18} color={gold} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: textPrimary }}>
                Você é o plantonista desta semana
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
                Semana de {rotuloDaSemana(segunda)} · segunda 18h → segunda 8h
              </div>
            </div>
          </div>
        )}

        <SeletorMinhasEquipe
          valor={recorte}
          aoMudar={setRecorte}
          contagens={{ minhas: minhas.length, equipe: daEquipe.length }}
        />

        {!carregando && !erro && minhas.length === 0 && daEquipe.length === 0 ? (
          <div style={{
            ...card(isLight), padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            fontFamily: FONT, fontSize: 13, color: textSecondary, textAlign: "center",
          }}>
            <Inbox size={22} color={gold} />
            Nenhuma atividade em aberto na equipe.
          </div>
        ) : (
          <>
            {secao("Hoje", grupos.hoje, recorte === "minhas" ? "Nada marcado para hoje." : "Ninguém da equipe tem nada marcado para hoje.")}
            {secao("A seguir", grupos.depois, "Nada agendado para os próximos dias.")}
          </>
        )}
      </div>

      {/* O "+": para o técnico, só o registro de plantão (R163/R231) — o
          diálogo é quem esconde as duas perguntas de quem não abre chamado. */}
      <button onClick={() => setNovaAberta(true)} title="Registrar atendimento de plantão" aria-label="Registrar atendimento de plantão" style={FAB}>
        <Plus size={22} />
      </button>
      <NovaAtividadeDialog aberto={novaAberta} aoFechar={() => setNovaAberta(false)} />
    </>
  );
}
