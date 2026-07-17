// Fundo estático (sem animação) para o modo escuro — usado em todas as telas
// autenticadas exceto Início, que mantém o AnimatedBackground dinâmico.
// Fonte: projeto de design "Fundo geométrico com glow" (claude.ai/design).

export function DatacenterBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 120% 90% at 30% 20%, #14140f 0%, #0a0a08 38%, #050504 70%, #000000 100%)",
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="dcGlowLine" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={3} result="blur1" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dcGlowNode" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation={6} result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="dcNodeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe27a" />
            <stop offset="55%" stopColor="#e8b923" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#e8b923" stopOpacity={0} />
          </radialGradient>
        </defs>

        <g stroke="#4a4a46" strokeWidth={1.4} fill="none" filter="url(#dcGlowLine)" opacity={0.55}>
          <line x1={120} y1={860} x2={420} y2={640} />
          <line x1={420} y1={640} x2={760} y2={760} />
          <line x1={420} y1={640} x2={360} y2={340} />
          <line x1={360} y1={340} x2={120} y2={180} />
          <line x1={360} y1={340} x2={640} y2={220} />
          <line x1={640} y1={220} x2={960} y2={120} />
          <line x1={640} y1={220} x2={880} y2={420} />
          <line x1={880} y1={420} x2={760} y2={760} />
          <line x1={880} y1={420} x2={1180} y2={360} />
          <line x1={1180} y1={360} x2={1440} y2={180} />
          <line x1={1180} y1={360} x2={1320} y2={620} />
          <line x1={1320} y1={620} x2={1080} y2={820} />
          <line x1={1080} y1={820} x2={760} y2={760} />
          <line x1={1320} y1={620} x2={1620} y2={700} />
          <line x1={1620} y1={700} x2={1860} y2={540} />
          <line x1={1620} y1={700} x2={1780} y2={940} />
          <line x1={1440} y1={180} x2={1720} y2={260} />
          <line x1={1720} y1={260} x2={1860} y2={540} />
          <line x1={960} y1={120} x2={1440} y2={180} />
          <line x1={120} y1={180} x2={360} y2={60} />
          <line x1={120} y1={860} x2={60} y2={600} />
          <line x1={1080} y1={820} x2={1180} y2={1000} />
          <line x1={760} y1={760} x2={560} y2={960} />
        </g>

        <g fill="url(#dcNodeGrad)" filter="url(#dcGlowNode)">
          <circle cx={120} cy={860} r={9} />
          <circle cx={420} cy={640} r={9} />
          <circle cx={760} cy={760} r={10} />
          <circle cx={360} cy={340} r={9} />
          <circle cx={120} cy={180} r={8} />
          <circle cx={640} cy={220} r={10} />
          <circle cx={960} cy={120} r={8} />
          <circle cx={880} cy={420} r={9} />
          <circle cx={1180} cy={360} r={10} />
          <circle cx={1440} cy={180} r={9} />
          <circle cx={1320} cy={620} r={9} />
          <circle cx={1080} cy={820} r={9} />
          <circle cx={1620} cy={700} r={10} />
          <circle cx={1860} cy={540} r={8} />
          <circle cx={1780} cy={940} r={8} />
          <circle cx={1720} cy={260} r={8} />
          <circle cx={360} cy={60} r={6} />
          <circle cx={60} cy={600} r={6} />
          <circle cx={1180} cy={1000} r={6} />
          <circle cx={560} cy={960} r={6} />
        </g>

        <g fill="#fff2c4">
          <circle cx={120} cy={860} r={2.4} />
          <circle cx={420} cy={640} r={2.4} />
          <circle cx={760} cy={760} r={2.6} />
          <circle cx={360} cy={340} r={2.4} />
          <circle cx={640} cy={220} r={2.6} />
          <circle cx={880} cy={420} r={2.4} />
          <circle cx={1180} cy={360} r={2.6} />
          <circle cx={1440} cy={180} r={2.4} />
          <circle cx={1320} cy={620} r={2.4} />
          <circle cx={1080} cy={820} r={2.4} />
          <circle cx={1620} cy={700} r={2.6} />
          <circle cx={1860} cy={540} r={2.2} />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </div>
  );
}
