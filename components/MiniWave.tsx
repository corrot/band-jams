"use client";

import { useEffect, useRef } from "react";

export function MiniWave({
  peaks,
  progress = 0,
  onSeek,
  height = 36,
  color = "#4a4f5c",
  progressColor = "#f5a524",
}: {
  peaks: number[] | null;
  progress?: number;
  onSeek?: (fraction: number) => void;
  height?: number;
  color?: string;
  progressColor?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      c.width = Math.max(1, Math.floor(w * dpr));
      c.height = Math.floor(height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, height);
      const bar = 2;
      const gap = 1;
      const n = Math.max(1, Math.floor(w / (bar + gap)));
      const src = peaks && peaks.length ? peaks : null;
      for (let i = 0; i < n; i++) {
        let v = 0.06;
        if (src) {
          const a = Math.floor((i / n) * src.length);
          const b = Math.max(a + 1, Math.floor(((i + 1) / n) * src.length));
          let m = 0;
          for (let j = a; j < b && j < src.length; j++) m = Math.max(m, src[j]);
          v = Math.max(0.04, m);
        }
        const h = Math.max(1, v * (height - 2));
        ctx.fillStyle = i / n < progress ? progressColor : color;
        ctx.fillRect(i * (bar + gap), (height - h) / 2, bar, h);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [peaks, progress, height, color, progressColor]);

  return (
    <canvas
      ref={ref}
      className="mini"
      style={{ height, cursor: onSeek ? "pointer" : "default" }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
      }}
    />
  );
}
