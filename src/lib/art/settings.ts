// settings.ts — 体験のグローバル設定。LocalStorage に保存して画面遷移後も保持する。
// 変更箇所: DEFAULTS の値を変えれば初期値を調整できる。

export type MusicMode = "ambient" | "electronic" | "piano" | "orchestra" | "futurebass" | "music";
export type DisplayMode = "normal" | "bodyFollow";
export type OutputTarget = "preview" | "projector";
export type ImpactSound =
  | "spark" | "explosion" | "magic" | "water"
  | "cyber" | "drum" | "orchestraHit" | "edmDrop";

export interface ArtSettings {
  volume: number;        // 0..1
  sensitivity: number;   // 0.5..3
  mode: MusicMode;
  soundOn: boolean;
  displayMode: DisplayMode;
  outputTarget: OutputTarget;
  impactSound: ImpactSound;
}

const KEY = "art-settings-v2";

export const DEFAULTS: ArtSettings = {
  volume: 0.6,
  sensitivity: 1.2,
  mode: "ambient",
  soundOn: true,
  displayMode: "normal",
  outputTarget: "preview",
  impactSound: "magic",
};

export function loadSettings(): ArtSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: ArtSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const MODE_LABELS: Record<MusicMode, string> = {
  ambient: "Ambient",
  electronic: "Electronic",
  piano: "Piano",
  orchestra: "Orchestra",
  futurebass: "Future Bass",
  music: "Music",
};

export const DISPLAY_LABELS: Record<DisplayMode, string> = {
  normal: "通常モード",
  bodyFollow: "身体追従モード",
};

export const OUTPUT_LABELS: Record<OutputTarget, string> = {
  preview: "PCプレビュー",
  projector: "プロジェクター出力",
};

export const IMPACT_LABELS: Record<ImpactSound, string> = {
  spark: "Spark",
  explosion: "Explosion",
  magic: "Magic",
  water: "Water",
  cyber: "Cyber",
  drum: "Drum Hit",
  orchestraHit: "Orchestra Hit",
  edmDrop: "EDM Drop",
};
