// Logotipo do Grupo Prever — o arquivo oficial, sem modificação.
//
// `public/logo-grupo-prever.png` é o "Logo Grupo Prever_vazado.png" entregue
// pelo Davi, copiado tal e qual (999×641, PNG com fundo transparente). A versão
// anterior deste componente era uma recriação vetorial feita quando só existia
// a imagem de referência — está descartada.
//
// O logotipo é monocromático dourado e vem com transparência, então serve nos
// dois temas sem tratamento. NÃO aplicar filtro de cor: "sem modificá-lo" foi
// a instrução.

interface Props {
  /** Altura em px; a largura acompanha a proporção do arquivo. */
  altura?: number;
  className?: string;
}

export function LogoPrever({ altura = 56, className }: Props) {
  return (
    <img
      src="/logo-grupo-prever.png"
      alt="Grupo Prever"
      className={className}
      style={{ height: altura, width: "auto", display: "block" }}
    />
  );
}
