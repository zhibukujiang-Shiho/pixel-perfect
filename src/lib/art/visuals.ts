// visuals.ts — 生成映像レンダラ。
// 通常モード: 重心からのパーティクル + 動きの軌跡。
// 身体追従モード: 骨格のキーポイントに残像・粒子・オーラを描く。
// 二人同時対応 (Person A = 青系 / Person B = 紫系)。
// 接触インパクト: フラッシュ・波紋・パーティクル爆発・光線・リング・バーストの複合演出。

import type { PersonPose, Vec2 } from "./pose";
import type { DisplayMode } from "./settings";

// 通常時は淡い単色 (静かな空間)
const PALETTE_A = ["#4F7CFF", "#22D3EE", "#7DD3FC"];
const PALETTE_B = ["#8B5CF6", "#C084FC", "#F0ABFC"];
// 接触イベント専用のカラフルパレット (シアン/マゼンタ/イエロー/パープル/ブルー/ピンク)
const IMPACT_PALETTE = ["#22D3EE", "#F472B6", "#FACC15", "#A78BFA", "#3B82F6", "#EC4899", "#FFFFFF"];
const pickImpactColor = () => IMPACT_PALETTE[Math.floor(Math.random() * IMPACT_PALETTE.length)];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  gravity: number;
}

interface Ring {
  x: number; y: number; r: number; max: number;
  color: string; width: number; life: number;
}

interface Ray {
  x: number; y: number; angle: number; len: number; life: number; max: number; color: string;
}

interface Trail {
  x: number; y: number; life: number; max: number; size: number; color: string;
}

export interface ImpactBurst {
  x: number; y: number; color: string; sizeBoost?: number;
}

export class VisualRenderer {
  private targets: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number }[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private rays: Ray[] = [];
  private trails: Trail[] = [];
  private flash = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.addTarget(canvas);
    window.addEventListener("resize", this.resize);
  }

  addTarget(canvas: HTMLCanvasElement) {
    if (this.targets.some((t) => t.canvas === canvas)) return;
    const ctx = canvas.getContext("2d")!;
    this.targets.push({ canvas, ctx, w: 0, h: 0, dpr: 1 });
    this.sizeOne(this.targets[this.targets.length - 1]);
  }

  removeTarget(canvas: HTMLCanvasElement) {
    this.targets = this.targets.filter((t) => t.canvas !== canvas);
  }

  private sizeOne(t: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number }) {
    const rect = t.canvas.getBoundingClientRect();
    const dpr = Math.min(2, (t.canvas.ownerDocument?.defaultView?.devicePixelRatio) || 1);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    t.canvas.width = w * dpr;
    t.canvas.height = h * dpr;
    t.w = w; t.h = h; t.dpr = dpr;
    t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize = () => { this.targets.forEach((t) => this.sizeOne(t)); };

  /** 接触インパクト演出 — 大型フラッシュ + 多色波紋 + 光線 + パーティクル爆発 */
  triggerImpact(at: Vec2, _color?: string) {
    this.flash = Math.min(1, this.flash + 0.95);
    const t0 = this.targets[0];
    if (!t0) return;
    const cx = at.x * t0.w;
    const cy = at.y * t0.h;
    const screenR = Math.hypot(t0.w, t0.h);
    // 多色リング (エネルギー拡散)
    for (let i = 0; i < 6; i++) {
      this.rings.push({
        x: cx, y: cy, r: 8,
        max: screenR * (0.55 + i * 0.22),
        color: IMPACT_PALETTE[i % IMPACT_PALETTE.length],
        width: 7 - i * 0.6, life: 0,
      });
    }
    // 光線 (放射) — 色をローテート
    const rays = 26;
    for (let i = 0; i < rays; i++) {
      this.rays.push({
        x: cx, y: cy, angle: (i / rays) * Math.PI * 2,
        len: 240 + Math.random() * 360, life: 0, max: 36,
        color: IMPACT_PALETTE[i % IMPACT_PALETTE.length],
      });
    }
    // パーティクル爆発 — 各粒子がカラフル
    for (let i = 0; i < 360; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 16;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, max: 60 + Math.random() * 70,
        size: 2 + Math.random() * 5,
        color: pickImpactColor(),
        gravity: 0.02,
      });
    }
  }

  render(persons: PersonPose[], displayMode: DisplayMode, energy: number, closeness: number) {
    for (const t of this.targets) this.renderOne(t, persons, displayMode, energy, closeness);
    // フラッシュ減衰
    this.flash *= 0.94; // 約0.5〜1秒かけて減衰
  }

  private renderOne(
    t: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number },
    persons: PersonPose[], displayMode: DisplayMode, energy: number, closeness: number,
  ) {
    const ctx = t.ctx;
    // 残像
    ctx.fillStyle = `rgba(7, 10, 24, ${displayMode === "bodyFollow" ? 0.22 : 0.16})`;
    ctx.fillRect(0, 0, t.w, t.h);
    ctx.globalCompositeOperation = "lighter";

    // --- 各人の演出 ---
    persons.forEach((p) => {
      const palette = p.id === 0 ? PALETTE_A : PALETTE_B;
      const main = palette[0];
      // 軌跡
      this.pushTrail(p, palette);

      if (displayMode === "bodyFollow") {
        this.drawSkeleton(ctx, t, p, palette);
      }

      // 動きの大きさに応じて手から粒子放出
      this.emitFromWrist(p.wristL, p.wristLSpeed, palette, t);
      this.emitFromWrist(p.wristR, p.wristRSpeed, palette, t);

      // 全身が大きく動く時はオーラ
      if (p.speed > 0.45) this.drawAura(ctx, t, p, main, p.speed);
    });

    // 近さに応じて色のブリッジ
    if (persons.length === 2 && closeness > 0.5) {
      const a = persons[0], b = persons[1];
      const grad = ctx.createLinearGradient(a.torso.x * t.w, a.torso.y * t.h, b.torso.x * t.w, b.torso.y * t.h);
      grad.addColorStop(0, "rgba(79,124,255,0.6)");
      grad.addColorStop(1, "rgba(139,92,246,0.6)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2 + closeness * 4;
      ctx.globalAlpha = (closeness - 0.5) * 1.4;
      ctx.beginPath();
      ctx.moveTo(a.torso.x * t.w, a.torso.y * t.h);
      ctx.lineTo(b.torso.x * t.w, b.torso.y * t.h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // --- パーティクル更新 + 描画 ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.life++;
      const tt = 1 - p.life / p.max;
      if (tt <= 0) { this.particles.splice(i, 1); continue; }
      ctx.globalAlpha = tt;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * tt, 0, Math.PI * 2); ctx.fill();
    }
    if (this.particles.length > 1500) this.particles.splice(0, this.particles.length - 1500);

    // --- リング ---
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life++; r.r += (r.max - r.r) * 0.06;
      const tt = 1 - r.r / r.max;
      if (tt <= 0.02) { this.rings.splice(i, 1); continue; }
      ctx.globalAlpha = tt;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * tt + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }

    // --- 光線 ---
    for (let i = this.rays.length - 1; i >= 0; i--) {
      const ry = this.rays[i];
      ry.life++;
      const tt = 1 - ry.life / ry.max;
      if (tt <= 0) { this.rays.splice(i, 1); continue; }
      const len = ry.len * (1 - tt) + 40;
      ctx.globalAlpha = tt;
      ctx.strokeStyle = ry.color;
      ctx.lineWidth = 3 * tt + 1;
      ctx.beginPath();
      ctx.moveTo(ry.x, ry.y);
      ctx.lineTo(ry.x + Math.cos(ry.angle) * len, ry.y + Math.sin(ry.angle) * len);
      ctx.stroke();
    }

    // --- トレイル ---
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.life++;
      const tt = 1 - tr.life / tr.max;
      if (tt <= 0) { this.trails.splice(i, 1); continue; }
      ctx.globalAlpha = tt * 0.7;
      ctx.fillStyle = tr.color;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.size * tt, 0, Math.PI * 2); ctx.fill();
    }
    if (this.trails.length > 600) this.trails.splice(0, this.trails.length - 600);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // --- フラッシュ (画面全体白) ---
    if (this.flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, this.flash)})`;
      ctx.fillRect(0, 0, t.w, t.h);
    }
  }

  private pushTrail(p: PersonPose, palette: string[]) {
    const t0 = this.targets[0]; if (!t0) return;
    const points: [Vec2, number][] = [
      [p.wristL, p.wristLSpeed], [p.wristR, p.wristRSpeed], [p.torso, p.speed],
    ];
    for (const [pt, sp] of points) {
      if (sp < 0.06) continue;
      this.trails.push({
        x: pt.x * t0.w, y: pt.y * t0.h,
        life: 0, max: 30 + sp * 40,
        size: 4 + sp * 14, color: palette[1],
      });
    }
  }

  private emitFromWrist(at: Vec2, speed: number, palette: string[], t: { w: number; h: number }) {
    if (speed < 0.08) return;
    const n = Math.floor(speed * 10);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + speed * 3;
      this.particles.push({
        x: at.x * t.w + (Math.random() - 0.5) * 10,
        y: at.y * t.h + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.3,
        life: 0, max: 40 + Math.random() * 40,
        size: 1.5 + Math.random() * 2.5,
        color: palette[Math.floor(Math.random() * palette.length)],
        gravity: 0.01,
      });
    }
  }

  private drawSkeleton(
    ctx: CanvasRenderingContext2D,
    t: { w: number; h: number },
    p: PersonPose, palette: string[],
  ) {
    const pts: Vec2[] = [p.head, p.shoulderL, p.shoulderR, p.elbowL, p.elbowR, p.wristL, p.wristR, p.torso];
    // 骨ライン
    ctx.strokeStyle = palette[0];
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    const lines: [Vec2, Vec2][] = [
      [p.shoulderL, p.shoulderR],
      [p.shoulderL, p.elbowL], [p.elbowL, p.wristL],
      [p.shoulderR, p.elbowR], [p.elbowR, p.wristR],
      [p.head, p.torso],
    ];
    for (const [a, b] of lines) {
      ctx.beginPath();
      ctx.moveTo(a.x * t.w, a.y * t.h);
      ctx.lineTo(b.x * t.w, b.y * t.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 各キーポイントに光るドット
    for (const pt of pts) {
      const x = pt.x * t.w, y = pt.y * t.h;
      const r = 12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, palette[0]); g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawAura(ctx: CanvasRenderingContext2D, t: { w: number; h: number }, p: PersonPose, color: string, intensity: number) {
    const x = p.torso.x * t.w, y = p.torso.y * t.h;
    const r = 80 + intensity * 240;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.5, "rgba(255,255,255,0.15)");
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.5 * intensity;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  dispose() {
    window.removeEventListener("resize", this.resize);
    this.targets = [];
  }
}
