// A CÉLULA DE HORAS DA GRADE — U86.
//
// ── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
// A primeira versão desta célula era um `<input>` CONTROLADO pelo dado do
// servidor (`value={cel.horas ?? ""}`) com `onChange` gravando direto, e sem
// nenhum estado local. Isso não é "salva sozinho": é um número ERRADO gravado
// EM SILÊNCIO, e o passo a passo é este:
//
//   1. a caixa está vazia e o gestor quer lançar 24h;
//   2. ele digita `2` → o onChange grava **2h** no banco;
//   3. o React restaura o valor do DOM a partir da prop `value` da última
//      renderização — que não mudou, porque nada local mudou — e o `2` SOME da
//      caixa;
//   4. ele digita `4` numa caixa agora vazia → grava **4h**;
//   5. o refetch chega e a célula mostra **4**.
//
// Ele queria 24, o banco ficou com 4, e ninguém foi avisado. Em célula já
// preenchida é pior: `14` → seleciona tudo → digita `2` → a caixa volta para
// `14` e o banco fica com `2`. E são DUAS escritas por dígito, disparadas em
// paralelo, cuja ordem de commit HTTP ninguém garante.
//
// TODO OUTRO input numérico do repositório usa estado local
// (`features/programacao/FormularioDoBloco.tsx`, `chamados.novo-campo.tsx`,
// `admin.tsx`). Esta tela era a exceção; o conserto é adotar o padrão da casa.
//
// ── O CONTRATO, EM TRÊS LINHAS ────────────────────────────────────────────
//  · a caixa é do RASCUNHO enquanto se digita, e as teclas se acumulam nela;
//  · GRAVA no blur e no Enter — uma escrita por decisão, não uma por tecla;
//  · o servidor reescreve a caixa quando o VALOR DO SERVIDOR muda, e só então
//    (o efeito depende de `doServidor` e de mais nada). É isso que impede o
//    pisão do refetch em cima do que está sendo digitado, e é isso que impede
//    a caixa de piscar de volta para o valor antigo logo depois de gravar.
//
// E O CLAMP FICA VISÍVEL: digitar 99 deixa **24** escrito na caixa, e não um
// 99 na tela com um 24 no banco. Um limite que corrige calado é a mesma classe
// de defeito que o `<input>` controlado, com outro nome.

import { useEffect, useState, type CSSProperties } from "react";
import { HORAS_MAX } from "./modelo";

interface Props {
  /** O que o BANCO diz. `null` = não há linha, a célula está vazia. */
  horas: number | null;
  ariaLabel: string;
  title?: string;
  estilo: CSSProperties;
  /**
   * Chamada UMA VEZ por decisão (blur/Enter), e só quando o valor muda.
   *
   * PODE DEVOLVER UMA PROMESSA, e quando devolve a célula ESCUTA a recusa. Sem
   * isso, uma gravação recusada (RLS, token expirado, rede, janela de deploy)
   * deixava o número digitado na caixa PARA SEMPRE: o efeito de sincronia
   * depende de `doServidor`, que numa recusa não muda, então ele nunca mais
   * dispara. A tela mostrava 24, o total da linha mostrava 14, e o PDF — que
   * sai do dado do servidor — saía com 14. É o defeito que esta célula veio
   * consertar, com o valor errado do outro lado.
   */
  aoDefinir: (horas: number | null) => void | Promise<unknown>;
}

export function CelulaHoras({ horas, ariaLabel, title, estilo, aoDefinir }: Props) {
  const doServidor = horas === null ? "" : String(horas);
  const [texto, setTexto] = useState(doServidor);

  // DEPENDE SÓ DE `doServidor`, e a lista curta é a regra. Com `editando` na
  // lista, sair do campo dispararia o efeito e a caixa voltaria ao valor
  // ANTIGO do servidor até o refetch chegar — o dígito reaparecendo e sumindo,
  // que é o defeito de novo, só que mais curto.
  useEffect(() => { setTexto(doServidor); }, [doServidor]);

  /**
   * DESFAZ A CAIXA SE A GRAVAÇÃO FOR RECUSADA. O efeito de sincronia depende de
   * `doServidor` — e numa recusa o servidor não muda, logo ele nunca dispara e
   * a caixa segura o número digitado para sempre. Quem sabe que houve recusa é
   * a promessa que o chamador devolve; sem ela (chamador que não devolve nada)
   * o comportamento é o de antes, e é por isso que o tipo aceita `void`.
   */
  function comRecusa(r: void | Promise<unknown>) {
    // `r.then(undefined, …)` e não `Promise.resolve(r).catch(…)`: para uma
    // promessa de verdade os dois são a mesma coisa, e este não embrulha nada
    // — o que dispensa a asserção de comportamento de esperar microtarefa e
    // faz o teste do caso RECUSADO ser síncrono como todos os outros. Quem não
    // devolve nada (o tipo aceita `void`) simplesmente não tem `then`.
    if (r && typeof (r as { then?: unknown }).then === "function") {
      (r as Promise<unknown>).then(undefined, () => setTexto(doServidor));
    }
  }

  function gravar() {
    const v = texto.trim();
    if (v === "") {
      setTexto("");
      if (horas !== null) comRecusa(aoDefinir(null));
      return;
    }
    const num = Math.round(Number(v));
    if (!Number.isFinite(num)) { setTexto(doServidor); return; }
    // O teto é a MESMA constante que o CHECK do banco carrega, e o banco
    // continua sendo quem recusa. Isto aqui é conforto de digitação, não
    // guarda — se fosse guarda, a regra teria duas respostas.
    const limpo = Math.max(0, Math.min(HORAS_MAX, num));
    setTexto(limpo === 0 ? "" : String(limpo));
    // Zero é AUSÊNCIA DE LINHA (o CHECK do banco é `horas > 0`), então zerar é
    // apagar. E `horas ?? 0` é o que faz "digitei 0 numa célula já vazia" não
    // virar um DELETE de nada.
    if (limpo !== (horas ?? 0)) comRecusa(aoDefinir(limpo === 0 ? null : limpo));
  }

  return (
    <input
      type="number"
      min={0}
      max={HORAS_MAX}
      step={1}
      inputMode="numeric"
      value={texto}
      aria-label={ariaLabel}
      title={title}
      style={estilo}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={gravar}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        // Escape RESTAURA E NÃO SAI DO CAMPO, de propósito: chamar `.blur()`
        // aqui dispararia o `onBlur` no MESMO evento, com o `texto` de ANTES
        // do Escape na clausura — ou seja, gravaria exatamente o valor que o
        // Escape existe para desfazer.
        if (e.key === "Escape") setTexto(doServidor);
      }}
    />
  );
}
