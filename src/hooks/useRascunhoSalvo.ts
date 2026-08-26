// Rascunho que se salva sozinho (R90, U72).
//
// Davi, 2026-08-26: "qualquer alteração que o usuário faça, deve ser salva em
// tempo real. Por exemplo — se começar a escrever um texto na descrição e
// parar no meio, o sistema deve salvar automaticamente. Tudo é salvo
// automaticamente."
//
// Antes disto, título e descrição do painel só gravavam no `onBlur`. Quem
// escrevia e fechava o painel pelo X, ou clicava direto noutro card, perdia o
// texto sem aviso — e o pior caso era clicar num botão da barra de formatação,
// que usa `onMouseDown` + `preventDefault` justamente para NÃO tirar o foco:
// negrito aplicado e nunca salvo.
//
// ── O problema que este hook existe para resolver ───────────────────────────
// Salvar enquanto se digita cria uma corrida com o próprio recarregamento: a
// gravação invalida a query, a query volta do servidor, e o valor do servidor
// sobrescreve o que a pessoa está escrevendo NAQUELE momento. É o bug clássico
// do campo que "come letras" ou volta atrás sozinho.
//
// A regra aqui é uma só, e resolve os dois lados: **enquanto o campo tem foco,
// o servidor nunca escreve nele.** Sem foco, o campo sempre espelha o
// servidor — que é o que faz o painel refletir a edição de outra pessoa.

import { useCallback, useEffect, useRef, useState } from "react";

/** Quanto tempo parado antes de gravar. */
const ESPERA_MS = 700;

export interface RascunhoSalvo {
  /** O valor a exibir no campo. */
  valor: string;
  /** Chame no onChange. */
  mudar: (v: string) => void;
  /** Ligue no onFocus/onBlur do controle — é o que protege o rascunho. */
  aoFocar: () => void;
  aoDesfocar: () => void;
  /** Grava agora o que estiver pendente. Idempotente. */
  gravarAgora: () => void;
}

export function useRascunhoSalvo(
  valorServidor: string,
  aoSalvar: (v: string) => void,
  /** Muda quando o REGISTRO muda (id do chamado): descarta o rascunho. */
  chaveReset?: string | null,
): RascunhoSalvo {
  const [valor, setValor] = useState(valorServidor);
  const focado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estes refs existem para o `gravarAgora` de desmontagem não depender de
  // props: no cleanup do efeito, o closure enxergaria o valor de quando o
  // efeito foi criado, e gravaria texto velho por cima do novo.
  const valorRef = useRef(valor);
  const servidorRef = useRef(valorServidor);
  const salvarRef = useRef(aoSalvar);
  valorRef.current = valor;
  servidorRef.current = valorServidor;
  salvarRef.current = aoSalvar;

  const limpar = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const gravarAgora = useCallback(() => {
    limpar();
    if (valorRef.current !== servidorRef.current) salvarRef.current(valorRef.current);
  }, []);

  // Troca de registro: o rascunho do chamado anterior não vale para este.
  // Grava o que estava pendente ANTES de descartar — trocar de card não pode
  // ser uma forma de perder texto.
  useEffect(() => {
    return () => { gravarAgora(); };
  }, [chaveReset, gravarAgora]);

  useEffect(() => {
    setValor(valorServidor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveReset]);

  // O espelho do servidor, com a única trava que importa: campo focado não é
  // tocado. Sem esta guarda, o refetch disparado pela própria gravação
  // apagaria as letras digitadas nos milissegundos seguintes.
  useEffect(() => {
    if (focado.current) return;
    setValor(valorServidor);
  }, [valorServidor]);

  const mudar = useCallback((v: string) => {
    setValor(v);
    limpar();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (valorRef.current !== servidorRef.current) salvarRef.current(valorRef.current);
    }, ESPERA_MS);
  }, []);

  const aoFocar = useCallback(() => { focado.current = true; }, []);
  const aoDesfocar = useCallback(() => {
    focado.current = false;
    gravarAgora(); // sair do campo grava na hora, sem esperar os 700ms
  }, [gravarAgora]);

  return { valor, mudar, aoFocar, aoDesfocar, gravarAgora };
}
