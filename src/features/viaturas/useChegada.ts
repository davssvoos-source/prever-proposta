// A CHEGADA POR LOCALIZAÇÃO (R273/R274) — o gancho que ouve o GPS enquanto há
// viagem aberta e o app está na frente, e pergunta ao modelo puro se chegou.
//
// Davi, 13/09/2026: "quando o técnico fica mais de 2 minutos num raio próximo
// do cliente, o sistema entende que ele chegou no cliente, e sugere término da
// viagem." E, sobre os celulares: "terá a localização ligada do inicio do
// expediente ao término" (Q27).
//
// TRÊS DECISÕES, todas do contexto (D8):
//  · só com viagem aberta E a página visível — sem viagem não há o que
//    sugerir, e com o app atrás não há como sugerir (na casca WebView de hoje
//    o navegador para o watch; o segundo plano é plugin nativo, etapa própria);
//  · a posição NÃO sai daqui: vira `avaliarChegada(...)` e morre — nada é
//    gravado, nada é enviado;
//  · quem encerra é a pessoa. Este gancho só diz "chegou a X"; a tela mostra a
//    sugestão e o botão continua sendo o mesmo de sempre.

import { useEffect, useMemo, useRef, useState } from "react";
import { avaliarChegada, CHEGADA_INICIAL, type Destino, type EstadoDaChegada } from "./modelo";

export interface Chegada {
  /** o destino em que a pessoa está há mais de 2 minutos — a SUGESTÃO */
  chegou: Destino | null;
  /** dentro do raio de qual destino agora (antes dos 2 minutos) */
  dentroDe: Destino | null;
  /** o aparelho não tem GPS, ou a pessoa negou — a tela avisa uma vez, baixinho */
  erro: string | null;
  suportado: boolean;
}

export function useChegadaPorLocalizacao(ativo: boolean, destinos: readonly Destino[]): Chegada {
  const [chegada, setChegada] = useState<Chegada>({ chegou: null, dentroDe: null, erro: null, suportado: true });
  const estadoRef = useRef<EstadoDaChegada>(CHEGADA_INICIAL);
  const destinosRef = useRef<readonly Destino[]>(destinos);
  destinosRef.current = destinos;
  // reassina só quando o CONJUNTO de destinos muda, não a cada render
  const chaveDestinos = useMemo(() => destinos.map((d) => d.id).sort().join("|"), [destinos]);

  useEffect(() => {
    if (!ativo || !chaveDestinos) {
      estadoRef.current = CHEGADA_INICIAL;
      setChegada((c) => (c.chegou || c.dentroDe ? { ...c, chegou: null, dentroDe: null } : c));
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setChegada({ chegou: null, dentroDe: null, erro: "Este aparelho não informa a localização.", suportado: false });
      return;
    }

    let watchId: number | null = null;

    const ler = (p: GeolocationPosition) => {
      const r = avaliarChegada(
        estadoRef.current,
        { latitude: p.coords.latitude, longitude: p.coords.longitude },
        Date.now(),
        destinosRef.current,
      );
      estadoRef.current = r.estado;
      setChegada({ chegou: r.chegou, dentroDe: r.dentroDe, erro: null, suportado: true });
    };
    const falhou = (e: GeolocationPositionError) => {
      // negou (1) é decisão da pessoa; indisponível (2) e tempo (3) são do aparelho
      const msg = e.code === 1
        ? "A localização está desligada para o Prever — ligue nas permissões do aparelho para a sugestão de chegada funcionar."
        : "Sem sinal de localização agora.";
      setChegada((c) => ({ ...c, erro: msg }));
    };
    const ligar = () => {
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(ler, falhou, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 });
    };
    const desligar = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };
    // com a página atrás, o relógio dos 2 minutos para — e não pode acusar
    // chegada com dado velho quando ela volta: o estado reinicia
    const visibilidade = () => {
      if (document.visibilityState === "visible") ligar();
      else { desligar(); estadoRef.current = CHEGADA_INICIAL; }
    };
    document.addEventListener("visibilitychange", visibilidade);
    visibilidade();
    return () => {
      document.removeEventListener("visibilitychange", visibilidade);
      desligar();
    };
  }, [ativo, chaveDestinos]);

  return chegada;
}
