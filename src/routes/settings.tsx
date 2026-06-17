// settings.tsx — 設定画面。LocalStorage に保存し、各画面に反映される。
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import {
  loadSettings, saveSettings, DEFAULTS,
  MODE_LABELS, DISPLAY_LABELS, OUTPUT_LABELS, IMPACT_LABELS,
  type ArtSettings, type MusicMode, type DisplayMode, type OutputTarget, type ImpactSound,
} from "@/lib/art/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "設定 — Motion Resonance" },
      { name: "description", content: "出力先・表示モード・音楽・インパクトサウンドなど演出の設定を変更します。" },
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
  const handleSave = () => { saveSettings(s); setSaved(true); };
  const handleReset = () => { setS(DEFAULTS); saveSettings(DEFAULTS); setSaved(true); };

  return (
    <>
      <AppHeader />
      <main className="container-app section-y" style={{ maxWidth: 820 }}>
        <Link to="/experience" className="text-sub inline-flex items-center gap-1 mb-4">
          ← 体験画面に戻る
        </Link>
        <h2>設定</h2>
        <p className="text-sub mb-8">演出の感じ方を調整できます。設定はこのブラウザに保存されます。</p>

        <div className="grid gap-6">
          {/* 出力先 */}
          <RadioGroup<OutputTarget>
            legend="出力先"
            note="プロジェクター出力を選ぶと別ウィンドウが開きます。拡張ディスプレイで全画面 (F キー) にして投影してください。"
            value={s.outputTarget}
            options={Object.entries(OUTPUT_LABELS) as [OutputTarget, string][]}
            onChange={(v) => update("outputTarget", v)}
          />

          {/* 表示モード */}
          <RadioGroup<DisplayMode>
            legend="表示モード"
            note="身体追従モードは、認識した骨格の上に光や粒子を直接描画します。"
            value={s.displayMode}
            options={Object.entries(DISPLAY_LABELS) as [DisplayMode, string][]}
            onChange={(v) => update("displayMode", v)}
          />

          {/* 音楽モード */}
          <RadioGroup<MusicMode>
            legend="音楽モード"
            value={s.mode}
            options={Object.entries(MODE_LABELS) as [MusicMode, string][]}
            onChange={(v) => update("mode", v)}
            columns={3}
          />

          {/* インパクトサウンド */}
          <RadioGroup<ImpactSound>
            legend="インパクトサウンド"
            note="二人の手が触れた瞬間に再生される効果音です。"
            value={s.impactSound}
            options={Object.entries(IMPACT_LABELS) as [ImpactSound, string][]}
            onChange={(v) => update("impactSound", v)}
            columns={4}
          />

          {/* 音量 */}
          <section className="card">
            <label htmlFor="volume" className="flex items-center justify-between">
              <span><strong>音量</strong></span>
              <span className="text-sub">{Math.round(s.volume * 100)}%</span>
            </label>
            <input id="volume" type="range" min={0} max={1} step={0.01}
              value={s.volume} onChange={(e) => update("volume", Number(e.target.value))}
              className="mt-3"
            />
          </section>

          {/* 感度 */}
          <section className="card">
            <label htmlFor="sens" className="flex items-center justify-between">
              <span><strong>映像感度</strong></span>
              <span className="text-sub">×{s.sensitivity.toFixed(1)}</span>
            </label>
            <input id="sens" type="range" min={0.5} max={3} step={0.1}
              value={s.sensitivity} onChange={(e) => update("sensitivity", Number(e.target.value))}
              className="mt-3"
            />
            <p className="text-sub mt-2">値が大きいほど、小さな動きにも強く反応します。</p>
          </section>

          {saved && (
            <div className="alert alert-success" role="status">
              <span aria-hidden>✓</span> 設定を保存しました。
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

function RadioGroup<T extends string>({
  legend, note, value, options, onChange, columns = 2,
}: {
  legend: string; note?: string; value: T;
  options: [T, string][]; onChange: (v: T) => void; columns?: number;
}) {
  return (
    <section className="card">
      <fieldset>
        <legend><strong>{legend}</strong></legend>
        {note && <p className="text-sub mt-1 mb-3">{note}</p>}
        <div
          className="grid gap-3 mt-3"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${columns >= 4 ? 140 : 160}px, 1fr))` }}
        >
          {options.map(([key, label]) => {
            const active = value === key;
            return (
              <label
                key={key}
                className={`btn ${active ? "btn-primary" : "btn-secondary"}`}
                style={{ width: "100%", cursor: "pointer" }}
              >
                <input
                  type="radio" name={legend} value={key} checked={active}
                  onChange={() => onChange(key)}
                  style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
