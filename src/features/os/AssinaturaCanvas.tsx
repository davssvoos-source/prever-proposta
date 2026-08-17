// Assinatura de quem recebeu o serviço — desenhada na tela do celular do
// técnico. Etapa 3 do sistema de OS. Gera um PNG (dataURL) que sobe para o
// bucket privado fotos-os e entra no relatório da OS.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Eraser } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export interface AssinaturaCanvasProps {
  /** Recebe o PNG em dataURL, ou null quando o traço é apagado. */
  onChange: (dataUrl: string | null) => void;
  altura?: number;
}

export function AssinaturaCanvas({ onChange, altura = 170 }: AssinaturaCanvasProps) {
  const { isLight } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desenhando = useRef(false);
  const temTraco = useRef(false);
  const [vazio, setVazio] = useState(true);

  // A assinatura é sempre desenhada em preto sobre branco: vai para o PDF e
  // precisa ficar legível independentemente do tema da tela.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.strokeStyle = "#0a0b0e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [altura]);

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!temTraco.current) {
      temTraco.current = true;
      setVazio(false);
    }
  }

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    if (temTraco.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, altura);
    ctx.strokeStyle = "#0a0b0e";
    temTraco.current = false;
    setVazio(true);
    onChange(null);
  }

  const moldura: CSSProperties = {
    borderRadius: 12,
    overflow: "hidden",
    border: isLight ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.18)",
    background: "#ffffff",
    position: "relative",
    touchAction: "none",
  };

  return (
    <div>
      <div style={moldura}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: altura, touchAction: "none", cursor: "crosshair" }}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
        />
        {vazio && (
          <span
            style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", color: "#8a909e",
              fontFamily: "'Montserrat', sans-serif", fontSize: 12,
            }}
          >
            Assine com o dedo ou o mouse
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={limpar}
        style={{
          marginTop: 8, height: 34, padding: "0 12px", borderRadius: 10,
          background: isLight ? "#ffffff" : "#191921",
          border: isLight ? "1px solid rgba(0,0,0,0.10)" : "1px solid rgba(255,255,255,0.12)",
          color: isLight ? "#0a0b0e" : "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600,
        }}
      >
        <Eraser size={13} />
        Apagar
      </button>
    </div>
  );
}
