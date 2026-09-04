// A tela que aparece quando algo falha — com o CÓDIGO em destaque.
//
// A hierarquia da tela é deliberada: primeiro o que houve em linguagem de
// gente, depois o que fazer, e só então o código. O código é o que resolve o
// problema DEPOIS; a pessoa que está com o trabalho parado precisa antes
// saber se o problema é dela (sem sinal, sem acesso) ou nosso.
//
// O código tem botão de copiar porque o caminho real dele é o WhatsApp: o
// técnico em campo manda o código, e o código sozinho diz onde procurar.
// Digitar "PRV-CLI-PERM-42501" à mão erraria um caractere em cada três.
//
// Não usa Tailwind: o resto do sistema pinta por style/tokens (lib/ui,
// paleta), e uma tela de erro que herda um tema meio aplicado seria uma
// segunda falha em cima da primeira.

import { useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Copy, Home, RefreshCw } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT } from "@/lib/ui";
import { classificarErro, codigoDeErro, EXPLICACAO, type ClasseErro } from "@/lib/erros";

interface Props {
  erro: unknown;
  pathname?: string | null;
  /** quando existe, mostra "Tentar de novo" */
  aoTentarDeNovo?: () => void;
}

/** A cor da moldura por classe — semântica, não decoração. */
function corDaClasse(classe: ClasseErro, isLight: boolean): string {
  // REDE e AUTH são passageiros (o trabalho volta sozinho); PERM e ROTA são
  // "não é aqui"; ESQM, DADO e APP são defeito a corrigir — e só esses três
  // ganham o vermelho, senão o vermelho perde o significado de alarme.
  if (classe === "REDE" || classe === "AUTH") return isLight ? "#1d4ed8" : "#60A5FA";
  if (classe === "PERM" || classe === "ROTA") return isLight ? "#A06108" : "#F8C811";
  return isLight ? "#B1242E" : "#F17881";
}

export function TelaDeErro({ erro, pathname, aoTentarDeNovo }: Props) {
  const { isLight } = useTheme();
  const [copiado, setCopiado] = useState(false);

  const { classe, tecnico } = classificarErro(erro);
  const codigo = codigoDeErro(erro, pathname);
  const texto = EXPLICACAO[classe];
  const cor = corDaClasse(classe, isLight);

  const fundo = isLight ? "#f5f6f8" : "#08090E";
  const textPrimary = isLight ? "#1e2229" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.60)";
  const superficie = isLight ? "#ffffff" : "#14141b";
  const borda = isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)";

  const botao = (primario: boolean): CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    fontFamily: FONT, fontSize: 13, fontWeight: 600,
    padding: "10px 18px", borderRadius: 12, cursor: "pointer",
    background: primario ? "linear-gradient(135deg,#FCDE48,#F8C811,#E8B00A)" : superficie,
    color: primario ? "#08090E" : textPrimary,
    border: primario ? "none" : borda,
    textDecoration: "none",
  });

  const copiar = () => {
    // O relatório útil não é só o código: sem a mensagem crua eu sei ONDE, mas
    // não O QUÊ. Vai o pacote inteiro, já formatado para colar no WhatsApp.
    const relatorio = `${codigo}\n${texto.titulo}\n${tecnico}\n${pathname ?? ""}\n${new Date().toLocaleString("pt-BR")}`;
    navigator.clipboard?.writeText(relatorio).then(
      () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); },
      () => {},
    );
  };

  return (
    <div style={{
      minHeight: "100vh", background: fundo, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 460, background: superficie, border: borda,
        borderRadius: 20, padding: "28px 24px",
        boxShadow: isLight ? "0 2px 12px rgba(0,0,0,0.08)" : "0 8px 24px rgba(0,0,0,0.45)",
        // a faixa de cor no topo é a leitura instantânea da classe
        borderTop: `3px solid ${cor}`,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: `${cor}1F`, color: cor, marginBottom: 16,
        }}>
          <AlertTriangle size={22} />
        </div>

        <h1 style={{
          fontFamily: FONT, fontWeight: 600, fontSize: 20,
          color: textPrimary, margin: 0, letterSpacing: "-0.01em",
        }}>
          {texto.titulo}
        </h1>

        <p style={{
          fontFamily: FONT, fontWeight: 400, fontSize: 13.5, lineHeight: 1.55,
          color: textSecondary, marginTop: 8, marginBottom: 0,
        }}>
          {texto.oQueHouve}
        </p>
        <p style={{
          fontFamily: FONT, fontWeight: 500, fontSize: 13.5, lineHeight: 1.55,
          color: textPrimary, marginTop: 10, marginBottom: 0,
        }}>
          {texto.oQueFazer}
        </p>

        {/* O código. Monoespaçado e com tabular-nums: é para ser lido
            caractere a caractere, inclusive em voz alta no telefone. */}
        <div style={{
          marginTop: 20, padding: "12px 14px", borderRadius: 12,
          background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 9,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: textSecondary, marginBottom: 4,
            }}>
              Código do erro
            </div>
            <code style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14, fontWeight: 600, color: cor,
              wordBreak: "break-all", fontVariantNumeric: "tabular-nums",
            }}>
              {codigo}
            </code>
          </div>
          <button
            onClick={copiar}
            aria-label="Copiar código do erro"
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: 11,
              border: borda, background: superficie, color: copiado ? cor : textSecondary,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            {copiado ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* O detalhe técnico fica fechado: é para mim, não para quem só quer
            voltar a trabalhar. Mas fica À MÃO — esconder de vez obrigaria a
            abrir o console do navegador no celular, que na prática é nunca. */}
        {tecnico && (
          <details style={{ marginTop: 12 }}>
            <summary style={{
              fontFamily: FONT, fontSize: 11.5, color: textSecondary,
              cursor: "pointer", userSelect: "none",
            }}>
              Detalhe técnico
            </summary>
            <pre style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11, lineHeight: 1.5, color: textSecondary,
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
              padding: 12, borderRadius: 10, marginTop: 8,
              whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "auto",
            }}>
              {tecnico}
            </pre>
          </details>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
          {aoTentarDeNovo && (
            <button onClick={aoTentarDeNovo} style={botao(true)}>
              <RefreshCw size={15} /> Tentar de novo
            </button>
          )}
          {/* <a> e não <Link>: se o que quebrou foi o próprio roteador, a
              navegação interna quebraria junto e o botão de escape não
              escaparia. Recarregar a página é o caminho que sempre funciona. */}
          <a href="/dashboard" style={botao(!aoTentarDeNovo)}>
            <Home size={15} /> Ir para a Início
          </a>
        </div>
      </div>
    </div>
  );
}
