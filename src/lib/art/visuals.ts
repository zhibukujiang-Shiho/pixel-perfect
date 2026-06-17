// visuals.ts — 生成映像 (パーティクル + 動きグリッド) を Canvas に描画する。
// MotionFrame を毎フレーム受け取って演出する。
// 色は DESIGN.md のメイン/サブ/アクセントカラーをそのまま使用。

import type { MotionFrame } from "./motion";

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; hue: number; size: number;
}

const PALETTE = ["#4F7CFF", "#8B5CF6", "#22D3EE", "#F8FAFC"];

export class VisualRenderer {
  private particles: Particle[] = [];
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.w = rect.width;
    this.h = rect.height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  render(frame: MotionFrame) {
    const ctx = this.ctx;
    // フェード残像
    ctx.fillStyle = "rgba(11, 16, 32, 0.18)";
    ctx.fillRect(0, 0, this.w, this.h);

    // セルグリッド (動きの可視化 = 骨格的な点)
    const cols = 24, rows = 14;
    const cellW = this.w / cols, cellH = this.h / rows;
    ctx.globalCompositeOperation = "lighter";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = frame.cells[r * cols + c];
        if (v < 0.15) continue;
        const x = c * cellW + cellW / 2;
        const y = r * cellH + cellH / 2;
        const radius = 2 + v * 10;
        const color = PALETTE[(r + c) % 3];
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.min(1, v * 0.9);
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 新規パーティクル生成 (動きの重心から放出)
    const spawn = Math.floor(frame.energy * 12);
    const cx = frame.centroid.x * this.w;
    const cy = frame.centroid.y * this.h;
    for (let i = 0; i < spawn; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + frame.energy * 4;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: 60 + Math.random() * 60,
        hue: Math.floor(Math.random() * PALETTE.length),
        size: 1.5 + Math.random() * 3 + frame.energy * 4,
      });
    }
    if (this.particles.length > 800) this.particles.splice(0, this.particles.length - 800);

    // パーティクル更新 + 描画
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.02; // 軽い重力
      p.life++;
      const t = 1 - p.life / p.maxLife;
      if (t <= 0) { this.particles.splice(i, 1); continue; }
      ctx.globalAlpha = t * 0.9;
      ctx.fillStyle = PALETTE[p.hue];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  dispose() {
    window.removeEventListener("resize", this.resize);
  }
}
