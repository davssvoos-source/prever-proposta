// Menu lateral — a navegação do desktop (≥1024px). Etapa U15.
//
// Estrutura, de cima para baixo, seguindo as referências de layout que o Davi
// mandou (rail à esquerda, conteúdo à direita):
//
//   banner da fachada · logotipo · itens · [respiro] · tema · perfil
//
// O banner da frota saiu do topo da Home e virou o cabeçalho DO MENU (pedido
// do Davi). Faz sentido: na Home ele comia 210px da dobra — o espaço onde o
// trabalho aparece — e aqui identifica o produto sem disputar com conteúdo.
//
// O item ativo é uma pílula no degradê da marca com texto escuro — o mesmo
// tratamento dos botões de ação do app, para "onde estou" e "o que posso
// fazer" falarem a mesma língua visual.
//
// No celular nada disto existe: lá a navegação segue sendo a barra inferior,
// que é onde o polegar alcança. As duas leem a mesma lista de itens
// (nav-itens.ts) e a mesma matriz de permissões.

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import bannerAsset from "@/assets/banner-home.jpg.asset.json";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserCargo } from "@/features/gerencial/data";
import { usePermissoes } from "@/features/gerencial/permissoes";
import { itensDoCargo } from "@/components/nav-itens";
import { LogoPrever } from "@/components/LogoPrever";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FONT, GOLD_GRAD } from "@/lib/ui";
import { SUPERNOVA, SOBRE_PRIMARIA } from "@/lib/paleta";

export const LARGURA_RAIL = 232;

function usePerfilRail() {
  return useQuery({
    queryKey: ["perfil-header"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, cargo, avatar_url, status, ativo")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function SideNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isLight } = useTheme();
  const { data: cargo } = useUserCargo();
  const { podeVer } = usePermissoes();
  const { data: perfil } = usePerfilRail();

  const itens = itensDoCargo(cargo).filter(
    (i) => !i.tela || podeVer(i.tela) !== false,
  );

  const textPrimary = isLight ? "#0a0b0e" : "#ffffff";
  const textSecondary = isLight ? "#4a5060" : "rgba(255,255,255,0.55)";

  const ASIDE: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: LARGURA_RAIL,
    zIndex: 55,
    flexDirection: "column",
    gap: 6,
    // sem padding no topo: o banner sangra até a borda da sidebar
    padding: "0 14px 18px",
    boxSizing: "border-box",
    overflow: "hidden",
    background: isLight
      ? "#ffffff"
      : "linear-gradient(180deg, #121216 0%, #0a0a0e 100%)",
    borderRight: isLight
      ? "1px solid rgba(0,0,0,0.08)"
      : "1px solid rgba(248,200,17,0.10)",
  };

  const item = (ativo: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 11,
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 12,
    border: "none",
    width: "100%",
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
    background: ativo ? GOLD_GRAD : "transparent",
    color: ativo ? SOBRE_PRIMARIA : textSecondary,
    fontFamily: FONT,
    fontWeight: ativo ? 700 : 500,
    fontSize: 13.5,
    boxShadow: ativo ? "0 4px 14px rgba(248,200,17,0.28)" : "none",
    transition: "background .15s, color .15s",
  });

  const iniciais = perfil?.nome
    ? perfil.nome.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    // .so-desktop: display none no celular, flex no desktop (styles.css)
    <aside className="so-desktop" style={ASIDE} aria-label="Navegação principal">
      {/* Banner da fachada — sangra até as bordas da sidebar (os -14px anulam
          o padding lateral) e escurece embaixo para o logotipo pousar em cima. */}
      <div style={{
        position: "relative",
        margin: "0 -14px 0",
        height: 132,
        flexShrink: 0,
        overflow: "hidden",
      }}>
        <img
          src={isLight ? "/banner-home-light.jpg" : bannerAsset.url}
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 60%",
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: isLight
            ? "linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(255,255,255,0.55) 62%, #ffffff 100%)"
            : "linear-gradient(to bottom, rgba(8,8,12,0.30) 0%, rgba(10,10,14,0.82) 62%, #121216 100%)",
          pointerEvents: "none",
        }} />
      </div>

      <Link
        to="/dashboard"
        aria-label="Início"
        style={{
          display: "flex", justifyContent: "center",
          // sobe sobre o degradê do banner: o logotipo fecha a composição
          marginTop: -46, marginBottom: 14, position: "relative", zIndex: 1,
        }}
      >
        <LogoPrever altura={74} />
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {itens.map(({ to, label, icon: Icon }) => {
          const ativo = to === "/dashboard"
            ? pathname === "/dashboard" || pathname === "/"
            : pathname.startsWith(to);
          return (
            <Link key={to} to={to} style={item(ativo)}>
              <Icon size={17} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
        <ThemeToggle />
      </div>

      <button
        onClick={() => navigate({ to: "/perfil" })}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 10px",
          borderRadius: 14,
          border: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
          background: isLight ? "#f7f7f5" : "rgba(255,255,255,0.03)",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        {perfil?.avatar_url ? (
          <img
            src={perfil.avatar_url}
            alt=""
            style={{
              width: 34, height: 34, borderRadius: "50%", objectFit: "cover",
              border: "2px solid rgba(248,200,17,0.45)", flexShrink: 0,
            }}
          />
        ) : (
          <span style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: GOLD_GRAD, color: SOBRE_PRIMARIA,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT, fontWeight: 700, fontSize: 12.5,
          }}>
            {iniciais}
          </span>
        )}
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: "block", fontFamily: FONT, fontWeight: 600, fontSize: 12.5,
            color: textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {perfil?.nome ?? "Carregando…"}
          </span>
          {perfil?.cargo && (
            <span style={{
              display: "block", fontFamily: FONT, fontWeight: 300, fontSize: 10,
              letterSpacing: "0.10em", textTransform: "uppercase",
              color: isLight ? SUPERNOVA[800] : SUPERNOVA[400],
            }}>
              {perfil.cargo}
            </span>
          )}
        </span>
      </button>
    </aside>
  );
}
