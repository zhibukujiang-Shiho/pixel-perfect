// motion.ts — Webカメラ映像から動きの大きさを推定する。
// MediaPipe / TensorFlow を使わず、フレーム間差分でロバストに「動きエネルギー」を算出する。
// 軽量で全ブラウザで安定動作。複数人にも自然に反応する。
// 出力:
//   - energy: 0..1 の動きの大きさ
//   - centroid: 動きの重心座標 (画面比率 0..1) — 映像演出の中心に使う
//   - cells: グリッド単位の動き強度 — 骨格的な可視化に使う

export interface MotionFrame {
  energy: number;
  centroid: { x: number; y: number };
  cells: Float32Array; // length = COLS * ROWS
}

const COLS = 24;
const ROWS = 14;
const SAMPLE_W = 160; // 解析用ダウンサンプル幅 (高速化)
const SAMPLE_H = 90;

export class MotionAnalyzer {
  private prev: Uint8ClampedArray | null = null;
  private work: HTMLCanvasElement;
  private workCtx: CanvasRenderingContext2D;
  private cells = new Float32Array(COLS * ROWS);
  sensitivity = 1.2;

  readonly cols = COLS;
  readonly rows = ROWS;

  constructor() {
    this.work = document.createElement("canvas");
    this.work.width = SAMPLE_W;
    this.work.height = SAMPLE_H;
    this.workCtx = this.work.getContext("2d", { willReadFrequently: true })!;
  }

  analyze(video: HTMLVideoElement): MotionFrame {
    // ミラー反転して描画 (自分の動きと一致させる)
    this.workCtx.save();
    this.workCtx.scale(-1, 1);
    this.workCtx.drawImage(video, -SAMPLE_W, 0, SAMPLE_W, SAMPLE_H);
    this.workCtx.restore();

    const img = this.workCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    const cur = img.data;
    let energy = 0;
    let cx = 0, cy = 0, weight = 0;
    this.cells.fill(0);

    if (this.prev && this.prev.length === cur.length) {
      const cellW = SAMPLE_W / COLS;
      const cellH = SAMPLE_H / ROWS;
      for (let y = 0; y < SAMPLE_H; y += 2) {
        for (let x = 0; x < SAMPLE_W; x += 2) {
          const i = (y * SAMPLE_W + x) * 4;
          const dr = cur[i] - this.prev[i];
          const dg = cur[i + 1] - this.prev[i + 1];
          const db = cur[i + 2] - this.prev[i + 2];
          const diff = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
          if (diff > 30) {
            const w = diff / 765;
            energy += w;
            cx += x * w; cy += y * w; weight += w;
            const ci = Math.min(COLS - 1, Math.floor(x / cellW));
            const ri = Math.min(ROWS - 1, Math.floor(y / cellH));
            this.cells[ri * COLS + ci] += w;
          }
        }
      }
    }
    this.prev = new Uint8ClampedArray(cur);

    // 正規化
    const norm = Math.min(1, (energy / (SAMPLE_W * SAMPLE_H / 4)) * 40 * this.sensitivity);
    const centroid = weight > 0
      ? { x: cx / weight / SAMPLE_W, y: cy / weight / SAMPLE_H }
      : { x: 0.5, y: 0.5 };

    // セルも正規化
    let max = 0;
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] > max) max = this.cells[i];
    if (max > 0) for (let i = 0; i < this.cells.length; i++) this.cells[i] /= max;

    return { energy: norm, centroid, cells: this.cells };
  }
}
