// Acessos por papel — a matriz que o admin edita. Etapa U11.
//
// Uma linha por tela, uma coluna por papel, agrupadas pela mesma divisão que o
// app usa. O admin não tem coluna: tem tudo por regra de sistema, e pôr isso
// numa caixa de seleção seria dar a ele a chance de se trancar para fora desta
// própria tela.
//
// A tela não salva a cada clique. Marcar tudo e salvar uma vez evita o estado
// intermediário — vinte requisições soltas, e um refresh no meio pega metade
// da matriz nova e metade da velha.

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { FONT, GOLD_GRAD } from "@/lib/ui";
import { TELAS, GRUPOS, PAPEIS, type PapelPermissao } from "@/lib/telas";
import {
  useMatrizPermissoes, salvarPermissoes, matrizCompleta, useInvalidarPermissoes,
  type Matriz, type LinhaPermissao,
} from "@/features/gerencial/permissoes";

export const Route = createFileRoute("/_authenticated/gerencial/permissoes")({
  // Esta guarda NÃO passa por permissoes_tela de propósito: quem manda na tela
  // de permissões tem que ser o cargo, senão uma linha errada na própria
  // matriz tornaria a correção impossível pelo app.
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase
      .from("profiles").select("cargo").eq("id", user.id).maybeSingle();
    if ((perfil as any)?.cargo !== "admin") throw redirect({ to: "/dashboard" });
  },
  component: PermissoesPage,
});

function PermissoesPage() {
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: doBanco, isLoading } = useMatrizPermissoes();
  const invalidar = useInvalidarPermissoes();

  const [rascunho, setRascunho] = useState<Matriz>({});
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setRascunho(matrizCompleta(doBanco));
    setTocado(false);
  }, [doBanco, isLoading]);

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";
  const gold = isLight ? "#b87800" : "#FFC000";
  const linhaBorda = isLight ? "1px solid rgba(0,0,0,0.07)" : "1px solid rgba(255,255,255,0.07)";

  const salvo = useMemo(() => matrizCompleta(doBanco), [doBanco]);
  const mudancas = useMemo(() => {
    const l: LinhaPermissao[] = [];
    for (const t of TELAS) {
      for (const p of PAPEIS) {
        const antes = salvo[t.chave]?.[p.chave];
        const agora = rascunho[t.chave]?.[p.chave];
        if (typeof agora === "boolean" && agora !== antes) {
          l.push({ tela: t.chave, cargo: p.chave, permitido: agora });
        }
      }
    }
    return l;
  }, [rascunho, salvo]);

  const gravar = useMutation({
    mutationFn: async () => salvarPermissoes(mudancas),
    onSuccess: (n) => {
      invalidar();
      setTocado(false);
      toast.success(`${n} permissão(ões) atualizada(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function alternar(tela: string, papel: PapelPermissao) {
    setRascunho((m) => ({
      ...m,
      [tela]: { ...m[tela], [papel]: !m[tela]?.[papel] },
    }));
    setTocado(true);
  }

  const CAIXA = (marcada: boolean, travada: boolean): CSSProperties => ({
    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: marcada ? (isLight ? "#b87800" : "#FFC000") : "transparent",
    border: marcada
      ? "none"
      : isLight ? "1.5px solid rgba(0,0,0,0.25)" : "1.5px solid rgba(255,255,255,0.28)",
    cursor: travada ? "not-allowed" : "pointer",
    opacity: travada ? 0.45 : 1,
    padding: 0,
  });

  // alvo de 44px em volta da caixa de 24 — o app trava o zoom e a matriz é
  // densa; errar o toque aqui muda a permissão de outra pessoa
  const CELULA: CSSProperties = {
    width: 92, flexShrink: 0, minHeight: 44,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  const CABECALHO: CSSProperties = {
    ...CELULA,
    fontFamily: FONT, fontWeight: 700, fontSize: 11,
    letterSpacing: "0.06em", textTransform: "uppercase", color: textSecondary,
  };

  return (
    <div style={{ padding: "12px 0 120px", display: "flex", flexDirection: "column", gap: 14, color: textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => navigate({ to: "/gerencial" })}
          style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: isLight ? "#ffffff" : "#191921",
            border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
            color: textPrimary, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 20 }}>Acessos por papel</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: textSecondary }}>
            Marque quais telas cada papel pode abrir.
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", borderRadius: 12,
        background: isLight ? "rgba(184,120,0,0.07)" : "rgba(255,192,0,0.07)",
        border: isLight ? "1px solid rgba(184,120,0,0.20)" : "1px solid rgba(255,192,0,0.20)",
      }}>
        <ShieldCheck size={15} color={gold} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
          <b style={{ color: textPrimary, fontWeight: 600 }}>Administrador sempre vê tudo</b> — por isso
          não tem coluna aqui. Isto controla a <b style={{ color: textPrimary, fontWeight: 600 }}>navegação</b>:
          impede de abrir a tela, mas não substitui a regra de dado. O técnico continua vendo só os
          chamados dele mesmo com o calendário liberado.
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 48, borderRadius: 10, background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : (
        <div style={{
          margin: "0 -16px", padding: "0 16px",
          overflowX: "auto", overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch",
        }}>
          <div style={{ minWidth: "max-content" }}>
            {/* cabeçalho */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 0", borderBottom: linhaBorda,
              position: "sticky", top: 0, zIndex: 2,
              background: isLight ? "#f4f5f7" : "#08090e",
            }}>
              <span style={{
                width: 210, flexShrink: 0,
                fontFamily: FONT, fontWeight: 700, fontSize: 11,
                letterSpacing: "0.06em", textTransform: "uppercase", color: textSecondary,
              }}>
                Tela
              </span>
              {PAPEIS.map((p) => <span key={p.chave} style={CABECALHO}>{p.label}</span>)}
            </div>

            {GRUPOS.map((grupo) => (
              <div key={grupo}>
                <div style={{
                  fontFamily: FONT, fontWeight: 700, fontSize: 10.5,
                  letterSpacing: "0.12em", textTransform: "uppercase", color: gold,
                  padding: "16px 0 7px",
                }}>
                  {grupo}
                </div>
                {TELAS.filter((t) => t.grupo === grupo).map((t) => (
                  <div key={t.chave} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 0", borderBottom: linhaBorda,
                  }}>
                    <div style={{ width: 210, flexShrink: 0, paddingRight: 8 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: textPrimary }}>
                        {t.label}
                        {t.sempre && (
                          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 10.5, color: textSecondary }}>
                            {" "}· sempre
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: FONT, fontWeight: 300, fontSize: 11, color: textSecondary, marginTop: 1 }}>
                        {t.rota}
                      </div>
                      {t.nota && (
                        <div style={{
                          fontFamily: FONT, fontWeight: 300, fontSize: 10.5,
                          color: gold, marginTop: 2, lineHeight: 1.35,
                        }}>
                          {t.nota}
                        </div>
                      )}
                    </div>
                    {PAPEIS.map((p) => {
                      const marcada = t.sempre ? true : !!rascunho[t.chave]?.[p.chave];
                      return (
                        <div key={p.chave} style={CELULA}>
                          <button
                            aria-label={`${t.label} — ${p.label}`}
                            disabled={t.sempre}
                            onClick={() => !t.sempre && alternar(t.chave, p.chave)}
                            style={CAIXA(marcada, !!t.sempre)}
                          >
                            {marcada && <Check size={15} color={isLight ? "#ffffff" : "#08090E"} strokeWidth={3} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de gravação: só aparece com mudança pendente, e diz quantas.
          Fica acima da BottomNav (110px) para não ficar embaixo dela. */}
      {tocado && mudancas.length > 0 && (
        <div style={{
          position: "fixed", left: 12, right: 12, bottom: 118, zIndex: 40,
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderRadius: 16,
          background: isLight ? "#ffffff" : "#16161d",
          border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
        }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 12.5, color: textPrimary }}>
            {mudancas.length} {mudancas.length === 1 ? "mudança" : "mudanças"} sem salvar
          </span>
          <button
            onClick={() => { setRascunho(matrizCompleta(doBanco)); setTocado(false); }}
            style={{
              height: 40, padding: "0 12px", borderRadius: 11, flexShrink: 0,
              background: "transparent",
              border: isLight ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.14)",
              color: textPrimary, fontFamily: FONT, fontWeight: 600, fontSize: 12,
              display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
            }}
          >
            <RotateCcw size={13} /> Desfazer
          </button>
          <button
            onClick={() => gravar.mutate()}
            disabled={gravar.isPending}
            style={{
              height: 40, padding: "0 16px", borderRadius: 11, border: "none", flexShrink: 0,
              background: GOLD_GRAD, color: "#08090E",
              fontFamily: FONT, fontWeight: 700, fontSize: 12.5,
              cursor: gravar.isPending ? "wait" : "pointer",
            }}
          >
            {gravar.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      )}
    </div>
  );
}
