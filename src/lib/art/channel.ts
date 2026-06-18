// channel.ts — Control画面 → Projection画面 のリアルタイム通信。
// BroadcastChannel API を利用 (同一オリジン・別ウィンドウ間で低遅延)。
// 失敗時 (古いブラウザ) は localStorage を fallback として使う。

import type { PersonPose } from "./pose";
import type { ArtSettings, ImpactSound } from "./settings";

export type ChannelMessage =
  | { type: "frame"; persons: PersonPose[]; energy: number; closeness: number; settings: ArtSettings; ts: number }
  | { type: "impact"; at: { x: number; y: number }; sound: ImpactSound; settings: ArtSettings }
  | { type: "settings"; settings: ArtSettings }
  | { type: "hello" }                          // projection → control: 接続確認
  | { type: "bye" };                           // control → projection: 停止

const CHANNEL_NAME = "motion-resonance-v1";

export function createChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try { return new BroadcastChannel(CHANNEL_NAME); } catch { return null; }
}
