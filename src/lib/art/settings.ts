// settings.ts — 体験のグローバル設定 (音量・感度・モード) を管理。
// LocalStorage に保存して、ページ遷移しても保持する。
// 変更箇所: DEFAULTS の値を変えれば初期値を調整できる。

export type MusicMode = "ambient" | "edm" | "piano";

export interface ArtSettings {
  volume: number;       // 0..1
  sensitivity: number;  // 0.5..3 (動き検知の倍率)
  mode: MusicMode;
  soundOn: boolean;
}

const KEY = "art-settings-v1";

const DEFAULTS: ArtSettings = {
  volume: 0.6,
  sensitivity: 1.2,
  mode: "ambient",
  soundOn: true,
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
  ambient: "アンビエント",
  edm: "EDM",
  piano: "ピアノ風",
};
