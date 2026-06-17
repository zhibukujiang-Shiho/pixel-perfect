// pose.ts — MediaPipe PoseLandmarker を使い、最大2人分の骨格を取得する。
// 返り値は人物配列 (最大2人) で、それぞれ重要な部位 (頭・両肩・両肘・両手首・胴体中心) と
// 動きの速度 (前フレーム比) を提供する。
// パフォーマンス重視で `pose_landmarker_lite` を使用。
//
// 使い方:
//   const tracker = await PoseTracker.create();
//   const persons = tracker.detect(video, performance.now());
//
// 解析と描画は分離されており、`detect` は数値のみ返す。

import { PoseLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface PersonPose {
  id: 0 | 1;
  head: Vec2;          // 鼻
  shoulderL: Vec2;
  shoulderR: Vec2;
  elbowL: Vec2;
  elbowR: Vec2;
  wristL: Vec2;
  wristR: Vec2;
  torso: Vec2;         // 両肩・両腰の中心
  // 0..1 全体としての動きの大きさ (前フレーム比)
  speed: number;
  // 個別キーポイントの瞬間速度 (px/frame換算ではなく 0..1 正規化)
  wristLSpeed: number;
  wristRSpeed: number;
}

export type Vec2 = { x: number; y: number };

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// 各人物の最後の状態 (速度計算用)
interface PrevState { wristL: Vec2; wristR: Vec2; torso: Vec2; }

export class PoseTracker {
  private landmarker: PoseLandmarker;
  private prev: (PrevState | null)[] = [null, null];

  private constructor(landmarker: PoseLandmarker) { this.landmarker = landmarker; }

  static async create(): Promise<PoseTracker> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 2,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return new PoseTracker(landmarker);
  }

  detect(video: HTMLVideoElement, ts: number): PersonPose[] {
    const result = this.landmarker.detectForVideo(video, ts);
    const out: PersonPose[] = [];
    const persons = result.landmarks ?? [];

    // 人物を「水平位置 (左→右)」でソートして安定したIDを割り当てる
    const indexed = persons.map((lm, i) => ({ lm, originalIdx: i, x: midX(lm) }));
    indexed.sort((a, b) => a.x - b.x);

    for (let i = 0; i < Math.min(2, indexed.length); i++) {
      const lm = indexed[i].lm;
      const id = i as 0 | 1;
      const head = mirror(lm[0]);
      const shoulderL = mirror(lm[12]); // 鏡像反転に合わせて L/R 入れ替え
      const shoulderR = mirror(lm[11]);
      const elbowL = mirror(lm[14]);
      const elbowR = mirror(lm[13]);
      const wristL = mirror(lm[16]);
      const wristR = mirror(lm[15]);
      const hipL = mirror(lm[24]);
      const hipR = mirror(lm[23]);
      const torso = avg(shoulderL, shoulderR, hipL, hipR);

      const prev = this.prev[id];
      const dWL = prev ? dist(prev.wristL, wristL) : 0;
      const dWR = prev ? dist(prev.wristR, wristR) : 0;
      const dT  = prev ? dist(prev.torso, torso) : 0;
      const speed = Math.min(1, (dWL + dWR + dT * 0.6) * 6);

      out.push({
        id, head, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR, torso,
        speed,
        wristLSpeed: Math.min(1, dWL * 15),
        wristRSpeed: Math.min(1, dWR * 15),
      });
      this.prev[id] = { wristL, wristR, torso };
    }
    // 検出消失時は速度をリセット
    for (let i = out.length; i < 2; i++) this.prev[i] = null;
    return out;
  }

  dispose() { try { this.landmarker.close(); } catch {} }
}

// --- helpers ---
function mirror(l: NormalizedLandmark): Vec2 {
  // カメラ映像は左右反転で扱っているので x を反転
  return { x: 1 - l.x, y: l.y };
}
function midX(lm: NormalizedLandmark[]): number {
  const l = lm[11], r = lm[12];
  if (!l || !r) return 0.5;
  return (l.x + r.x) / 2;
}
function avg(...ps: Vec2[]): Vec2 {
  const s = ps.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 });
  return { x: s.x / ps.length, y: s.y / ps.length };
}
export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
