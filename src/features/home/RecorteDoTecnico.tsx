// O interruptor Minhas | Equipe do técnico de campo (R263) — e o gancho que o
// guarda. É UM para as duas telas dele: a Início e a Agenda leem a mesma chave
// do localStorage, então trocar numa troca na outra. Dois interruptores
// independentes fariam a Agenda dizer "equipe" enquanto a Início diz "minhas",
// e a pessoa não saberia o que está olhando.

import { useCallback, useEffect, useState } from "react";
import { Users, User } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, botaoSelecao } from "@/lib/ui";
import { CHAVE_RECORTE, lerRecorte, type RecorteDoTecnico } from "@/features/home/tecnico";

export function useRecorteDoTecnico(): [RecorteDoTecnico, (r: RecorteDoTecnico) => void] {
  const [recorte, setRecorte] = useState<RecorteDoTecnico>(() => {
    try { return lerRecorte(localStorage.getItem(CHAVE_RECORTE)); } catch { return "minhas"; }
  });
  useEffect(() => {
    try { localStorage.setItem(CHAVE_RECORTE, recorte); } catch { /* modo privado */ }
  }, [recorte]);
  // a outra tela pode ter trocado: ao voltar o foco, relê
  useEffect(() => {
    const reler = () => {
      try { setRecorte(lerRecorte(localStorage.getItem(CHAVE_RECORTE))); } catch { /* modo privado */ }
    };
    window.addEventListener("focus", reler);
    return () => window.removeEventListener("focus", reler);
  }, []);
  const trocar = useCallback((r: RecorteDoTecnico) => setRecorte(r), []);
  return [recorte, trocar];
}

interface Props {
  valor: RecorteDoTecnico;
  aoMudar: (r: RecorteDoTecnico) => void;
  /** quantas atividades cada lado tem — o número diz o que a troca vai mostrar */
  contagens?: { minhas: number; equipe: number };
}

/**
 * Dois botões, não um <select>: é uma escolha de dois valores e a escolhida
 * fica visível sem abrir nada (a mesma decisão de Mensal | Semanal, R133).
 * Alvo de 40px — quem opera está de luva (R11).
 */
export function SeletorMinhasEquipe({ valor, aoMudar, contagens }: Props) {
  const { isLight } = useTheme();
  const botao = (ativo: boolean) => ({
    ...botaoSelecao(ativo, isLight, null),
    boxShadow: "none",
    minHeight: 40, padding: "0 14px", borderRadius: 999, fontSize: 12.5,
    display: "inline-flex", alignItems: "center", gap: 6,
  });
  const numero = (n: number | undefined) => (n === undefined ? null : (
    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11.5, opacity: 0.75 }}>{n}</span>
  ));
  return (
    <div role="group" aria-label="O que a lista mostra" style={{ display: "flex", gap: 8 }}>
      <button type="button" aria-pressed={valor === "minhas"} onClick={() => aoMudar("minhas")} style={botao(valor === "minhas")}>
        <User size={14} /> Minhas {numero(contagens?.minhas)}
      </button>
      <button type="button" aria-pressed={valor === "equipe"} onClick={() => aoMudar("equipe")} style={botao(valor === "equipe")}>
        <Users size={14} /> Equipe {numero(contagens?.equipe)}
      </button>
    </div>
  );
}
