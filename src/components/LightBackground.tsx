import { useEffect, useRef } from "react";

export function LightBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const accent = "#d99000";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const ar = parseInt(accent.slice(1, 3), 16);
    const ag = parseInt(accent.slice(3, 5), 16);
    const ab = parseInt(accent.slice(5, 7), 16);
    const acc = (al: number) => `rgba(${ar},${ag},${ab},${al})`;

    let W = 0;
    let H = 0;
    type Node = { x: number; y: number; vx: number; vy: number; pulse: number; ps: number };
    type Vert = { ang: number; rad: number; phase: number; amp: number; ms: number };
    type Shape = { cx: number; cy: number; vx: number; vy: number; rot: number; rs: number; r: number; verts: Vert[] };
    const nodes: Node[] = [];
    const shapes: Shape[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    const init = () => {
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes.length = 0;
      const count = Math.round((35 * (W * H)) / (1280 * 800));
      for (let i = 0; i < Math.max(10, count); i++) {
        nodes.push({
          x: rnd(0, W),
          y: rnd(0, H),
          vx: rnd(-0.18, 0.18),
          vy: rnd(-0.18, 0.18),
          pulse: Math.random() * Math.PI * 2,
          ps: rnd(0.4, 1.1),
        });
      }
      shapes.length = 0;
      const scount = Math.max(4, Math.round((6 * (W * H)) / (1280 * 800)));
      for (let i = 0; i < scount; i++) {
        const sides = 3 + Math.floor(Math.random() * 4);
        const r = rnd(50, 130);
        const verts: Vert[] = Array.from({ length: sides }, (_, k) => ({
          ang: (k / sides) * Math.PI * 2,
          rad: r * rnd(0.7, 1),
          phase: Math.random() * Math.PI * 2,
          amp: rnd(0.12, 0.32),
          ms: rnd(0.4, 1.0),
        }));
        shapes.push({
          cx: rnd(0, W),
          cy: rnd(0, H),
          vx: rnd(-0.12, 0.12),
          vy: rnd(-0.12, 0.12),
          rot: Math.random() * Math.PI * 2,
          rs: rnd(-0.0025, 0.0025),
          r,
          verts,
        });
      }
    };

    const LINK = 200;
    let raf = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -50) n.x = W + 50;
        if (n.x > W + 50) n.x = -50;
        if (n.y < -50) n.y = H + 50;
        if (n.y > H + 50) n.y = -50;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i];
          const B = nodes[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < LINK) {
            const f = 1 - d / LINK;
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(150,156,165,${0.7 * f})`;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
            if (f > 0.45) {
              ctx.save();
              ctx.shadowColor = acc(0.9);
              ctx.shadowBlur = 10;
              ctx.lineWidth = 0.9;
              ctx.strokeStyle = acc((0.22 * (f - 0.45)) / 0.55);
              ctx.beginPath();
              ctx.moveTo(A.x, A.y);
              ctx.lineTo(B.x, B.y);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      const tt = t * 0.001;
      for (const s of shapes) {
        s.cx += s.vx;
        s.cy += s.vy;
        s.rot += s.rs;
        if (s.cx < -160) s.cx = W + 160;
        if (s.cx > W + 160) s.cx = -160;
        if (s.cy < -160) s.cy = H + 160;
        if (s.cy > H + 160) s.cy = -160;
        const pts = s.verts.map((v) => {
          const rad = v.rad * (1 + v.amp * Math.sin(tt * v.ms + v.phase));
          const ang = v.ang + s.rot;
          return { x: s.cx + Math.cos(ang) * rad, y: s.cy + Math.sin(ang) * rad };
        });
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(140,146,156,0.6)";
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
        ctx.save();
        ctx.shadowColor = acc(0.9);
        ctx.shadowBlur = 13;
        ctx.lineWidth = 1;
        ctx.strokeStyle = acc(0.3);
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        for (const p of pts) {
          ctx.save();
          ctx.shadowColor = acc(0.95);
          ctx.shadowBlur = 15;
          ctx.fillStyle = acc(0.98);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (const n of nodes) {
        n.pulse += 0.02 * n.ps;
        const pul = 0.55 + 0.45 * Math.sin(n.pulse);
        ctx.save();
        ctx.shadowColor = acc(0.95);
        ctx.shadowBlur = 16 * pul;
        ctx.fillStyle = acc(0.95);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = acc(0.16 * pul);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5 * pul, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    init();
    const onResize = () => init();
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "radial-gradient(ellipse at top, #f7f8fa 0%, #eef0f4 60%, #e4e7ec 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.06) 100%)",
        }}
      />
    </div>
  );
}
