// settings.tsx — 設定画面。音量・感度・モードを変更しLocalStorageへ保存。
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  loadSettings, saveSettings, MODE_LABELS,
  type ArtSettings, type MusicMode,
} from "@/lib/art/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定 — Motion Resonance" },
      { name: "description", content: "音量・感度・音楽モードなど演出の設定を変更します。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [s, setS] = useState<ArtSettings>(() => loadSettings());
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof ArtSettings>(key: K, value: ArtSettings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(s);
    setSaved(true);
  };

  const handleReset = () => {
    const defaults: ArtSettings = { volume: 0.6, sensitivity: 1.2, mode: "ambient", soundOn: true };
    setS(defaults);
    saveSettings(defaults);
    setSaved(true);
  };

  return (
    <>
      <AppHeader />
      <main className="container-app section-y" style={{ maxWidth: 760 }}>
        <Link to="/experience" className="text-sub inline-flex items-center gap-1 mb-4">
          ← 体験画面に戻る
        </Link>
        <h2>設定</h2>
        <p className="text-sub mb-8">演出の感じ方を調整できます。設定はこのブラウザに保存されます。</p>

        <div className="grid gap-6">
          {/* 音量 */}
          <section className="card">
            <label htmlFor="volume" className="flex items-center justify-between">
              <span><strong>音量</strong></span>
              <span className="text-sub">{Math.round(s.volume * 100)}%</span>
            </label>
            <input
              id="volume" type="range" min={0} max={1} step={0.01}
              value={s.volume}
              onChange={(e) => update("volume", Number(e.target.value))}
              className="mt-3"
              aria-valuetext={`${Math.round(s.volume * 100)}パーセント`}
            />
          </section>

          {/* 感度 */}
          <section className="card">
            <label htmlFor="sens" className="flex items-center justify-between">
              <span><strong>映像感度</strong></span>
              <span className="text-sub">×{s.sensitivity.toFixed(1)}</span>
            </label>
            <input
              id="sens" type="range" min={0.5} max={3} step={0.1}
              value={s.sensitivity}
              onChange={(e) => update("sensitivity", Number(e.target.value))}
              className="mt-3"
            />
            <p className="text-sub mt-2">値が大きいほど、小さな動きにも強く反応します。</p>
          </section>

          {/* モード */}
          <section className="card">
            <fieldset>
              <legend><strong>音楽モード</strong></legend>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                {(Object.keys(MODE_LABELS) as MusicMode[]).map((m) => {
                  const active = s.mode === m;
                  return (
                    <label
                      key={m}
                      className={`btn ${active ? "btn-primary" : "btn-secondary"}`}
                      style={{ width: "100%" }}
                    >
                      <input
                        type="radio" name="mode" value={m}
                        checked={active}
                        onChange={() => update("mode", m)}
                        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                      />
                      {MODE_LABELS[m]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          {saved && (
            <div className="alert alert-success" role="status">
              <span aria-hidden>✓</span>
              設定を保存しました。
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-between">
            <button className="btn btn-secondary" onClick={handleReset}>初期値に戻す</button>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => navigate({ to: "/experience" })}>
                体験に戻る
              </button>
              <button className="btn btn-primary" onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
