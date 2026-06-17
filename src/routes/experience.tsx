// experience.tsx — 体験画面。
// カメラ → MediaPipe骨格認識 → 音楽生成 + 映像生成 + 接触検知 + プロジェクター出力。
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PoseTracker, type PersonPose } from "@/lib/art/pose";
import { ContactDetector } from "@/lib/art/contact";
import { VisualRenderer } from "@/lib/art/visuals";
import { AudioEngine } from "@/lib/art/audio";
import {
  loadSettings, MODE_LABELS, DISPLAY_LABELS, OUTPUT_LABELS,
  type ArtSettings,
} from "@/lib/art/settings";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "体験 — Motion Resonance" },
      { name: "description", content: "Webカメラの前で身体を動かし、二人の動きと接触が音と光を生む体験。" },
    ],
  }),
  component: ExperiencePage,
});

type Status =
  | { kind: "idle" }
  | { kind: "starting"; message?: string }
  | { kind: "running" }
  | { kind: "error"; message: string };

function ExperiencePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const rendererRef = useRef<VisualRenderer | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const contactRef = useRef<ContactDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const projectorWinRef = useRef<Window | null>(null);
  const settingsRef = useRef<ArtSettings>(loadSettings());

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [settings, setSettings] = useState<ArtSettings>(() => loadSettings());
  const [energy, setEnergy] = useState(0);
  const [closeness, setCloseness] = useState(0);
  const [fps, setFps] = useState(0);
  const [people, setPeople] = useState(0);
  const [projectorOpen, setProjectorOpen] = useState(false);

  // 設定変更を各エンジンに即時反映 + ref にも保持
  useEffect(() => {
    settingsRef.current = settings;
    if (audioRef.current) {
      audioRef.current.setMode(settings.mode);
      audioRef.current.setVolume(settings.volume);
      audioRef.current.setMuted(!settings.soundOn);
    }
  }, [settings]);

  // プロジェクター出力先トグル
  useEffect(() => {
    if (settings.outputTarget === "projector") openProjector();
    else closeProjector();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.outputTarget]);

  const openProjector = useCallback(() => {
    if (projectorWinRef.current && !projectorWinRef.current.closed) return;
    const w = window.open("/projector", "motion-projector", "width=1280,height=720,menubar=no,toolbar=no");
    if (!w) {
      setStatus({ kind: "error", message: "プロジェクター用ウィンドウを開けませんでした。ポップアップを許可してください。" });
      setSettings((s) => ({ ...s, outputTarget: "preview" }));
      return;
    }
    projectorWinRef.current = w;
    setProjectorOpen(true);
    // 準備完了通知を待ってから canvas を追加
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== w) return;
      if ((ev.data as { type?: string })?.type === "projector-ready") {
        const canvas = w.document.getElementById("projector-canvas") as HTMLCanvasElement | null;
        if (canvas && rendererRef.current) rendererRef.current.addTarget(canvas);
        window.removeEventListener("message", onMsg);
      }
    };
    window.addEventListener("message", onMsg);
    // ウィンドウ閉鎖を監視
    const poll = window.setInterval(() => {
      if (w.closed) {
        window.clearInterval(poll);
        projectorWinRef.current = null;
        setProjectorOpen(false);
        setSettings((s) => s.outputTarget === "projector" ? { ...s, outputTarget: "preview" } : s);
      }
    }, 600);
  }, []);

  const closeProjector = useCallback(() => {
    const w = projectorWinRef.current;
    if (w && !w.closed) {
      try {
        const canvas = w.document.getElementById("projector-canvas") as HTMLCanvasElement | null;
        if (canvas) rendererRef.current?.removeTarget(canvas);
      } catch {}
      w.close();
    }
    projectorWinRef.current = null;
    setProjectorOpen(false);
  }, []);

  const start = useCallback(async () => {
    setStatus({ kind: "starting", message: "カメラと骨格モデルを読み込み中..." });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const tracker = await PoseTracker.create();
      trackerRef.current = tracker;

      const renderer = new VisualRenderer(canvasRef.current!);
      rendererRef.current = renderer;
      // 既存のプロジェクターウィンドウがあればターゲット追加
      if (projectorWinRef.current && !projectorWinRef.current.closed) {
        const c = projectorWinRef.current.document.getElementById("projector-canvas") as HTMLCanvasElement | null;
        if (c) renderer.addTarget(c);
      }

      const audio = new AudioEngine();
      await audio.start();
      audio.setMode(settings.mode);
      audio.setVolume(settings.volume);
      audio.setMuted(!settings.soundOn);
      audioRef.current = audio;

      contactRef.current = new ContactDetector();

      setStatus({ kind: "running" });

      // FPS計測
      let lastFpsT = performance.now(); let frames = 0;
      // 音楽tick用スロットル
      let lastAudioTick = 0;

      const loop = () => {
        const v = videoRef.current;
        const s = settingsRef.current;
        if (v && v.readyState >= 2 && trackerRef.current && rendererRef.current) {
          const persons = trackerRef.current.detect(v, performance.now());
          const e = persons.reduce((a, p) => Math.max(a, p.speed), 0) * s.sensitivity;
          const clampedE = Math.min(1, e);
          const dist = ContactDetector.distance(persons); // null / 0..~1
          const close = dist == null ? 0 : Math.max(0, Math.min(1, 1 - dist * 1.4));

          // 接触判定
          if (contactRef.current && audioRef.current) {
            const events = contactRef.current.step(persons);
            for (const ev of events) {
              audioRef.current.playImpact(s.impactSound);
              rendererRef.current.triggerImpact(ev.midpoint, "#A78BFA");
            }
          }

          rendererRef.current.render(persons, s.displayMode, clampedE, close);

          // 音楽は ~15Hz で更新 (CPU負荷低減)
          const now = performance.now();
          if (audioRef.current && now - lastAudioTick > 66) {
            audioRef.current.tick(clampedE, close);
            lastAudioTick = now;
          }

          setEnergy(clampedE);
          setCloseness(close);
          setPeople(persons.length);

          frames++;
          if (now - lastFpsT > 500) {
            setFps(Math.round((frames * 1000) / (now - lastFpsT)));
            frames = 0; lastFpsT = now;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error
        ? (err.name === "NotAllowedError"
            ? "カメラへのアクセスが許可されませんでした。ブラウザの設定から許可してください。"
            : err.message)
        : "カメラを起動できませんでした。";
      setStatus({ kind: "error", message });
    }
  }, [settings]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioRef.current?.dispose();
    audioRef.current = null;
    rendererRef.current?.dispose();
    rendererRef.current = null;
    trackerRef.current?.dispose();
    trackerRef.current = null;
    contactRef.current = null;
    setEnergy(0); setCloseness(0); setPeople(0); setFps(0);
    setStatus({ kind: "idle" });
  }, []);

  // アンマウント時に確実に停止
  useEffect(() => () => { stop(); closeProjector(); }, [stop, closeProjector]);

  const toggleSound = () => setSettings((s) => ({ ...s, soundOn: !s.soundOn }));
  const toggleProjector = () =>
    setSettings((s) => ({ ...s, outputTarget: s.outputTarget === "projector" ? "preview" : "projector" }));

  return (
    <>
      <AppHeader />
      <main className="container-app section-y">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2>体験</h2>
            <p className="text-sub">二人で動き、近づき、触れてください。空間が音と光で応答します。</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {status.kind === "error" && (
          <div className="alert alert-error mb-6" role="alert">
            <span aria-hidden>⚠️</span>
            <div>{status.message}</div>
          </div>
        )}
        {status.kind === "starting" && status.message && (
          <div className="alert mb-6" role="status">
            <span aria-hidden>⏳</span>
            <div>{status.message}</div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <section aria-labelledby="cam-title" className="card">
            <h3 id="cam-title" className="mb-3">カメラ映像</h3>
            <div className="canvas-area">
              <video
                ref={videoRef} playsInline muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
                aria-label="カメラ映像のプレビュー"
              />
              {status.kind !== "running" && (
                <div className="absolute inset-0 grid place-items-center text-sub">
                  カメラ未起動
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="gen-title" className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 id="gen-title">生成映像</h3>
              {projectorOpen && (
                <span className="text-sub" aria-live="polite">
                  📽 プロジェクター出力中
                </span>
              )}
            </div>
            <div className="canvas-area">
              <canvas ref={canvasRef} className="w-full h-full block" aria-label="動きに連動して生成される映像" />
            </div>
          </section>
        </div>

        {/* メトリクス */}
        <section className="card mt-6">
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <Metric label="動きの大きさ" value={`${Math.round(energy * 100)}%`} bar={energy} />
            <Metric label="二人の近さ" value={`${Math.round(closeness * 100)}%`} bar={closeness} accent />
            <Metric label="検出人数" value={`${people} / 2`} />
            <Metric label="FPS" value={fps ? String(fps) : "—"} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sub" style={{ margin: 0 }}>
              モード: <strong style={{ color: "var(--text)" }}>{MODE_LABELS[settings.mode]}</strong>
              ・表示: <strong style={{ color: "var(--text)" }}>{DISPLAY_LABELS[settings.displayMode]}</strong>
              ・出力: <strong style={{ color: "var(--text)" }}>{OUTPUT_LABELS[settings.outputTarget]}</strong>
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              {status.kind !== "running" ? (
                <button
                  className={`btn btn-primary ${status.kind === "starting" ? "btn-disabled" : ""}`}
                  onClick={start}
                  disabled={status.kind === "starting"}
                >
                  {status.kind === "starting" ? "起動中..." : "カメラを開始"}
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={toggleSound} aria-pressed={settings.soundOn}>
                    {settings.soundOn ? "🔊 音 ON" : "🔇 音 OFF"}
                  </button>
                  <button className="btn btn-secondary" onClick={toggleProjector} aria-pressed={settings.outputTarget === "projector"}>
                    {settings.outputTarget === "projector" ? "📽 出力 OFF" : "📽 プロジェクター"}
                  </button>
                  <button className="btn btn-danger" onClick={stop} aria-label="体験をリセット">
                    リセット
                  </button>
                </>
              )}
              <Link to="/settings" className="btn btn-secondary">設定</Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Metric({ label, value, bar, accent }: { label: string; value: string; bar?: number; accent?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sub">{label}</span>
        <span className="text-sub" aria-live="polite">{value}</span>
      </div>
      <div
        role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={bar == null ? 0 : Math.round(bar * 100)}
        style={{
          height: 8, borderRadius: 999,
          background: "var(--surface-2)", overflow: "hidden",
        }}
      >
        <div style={{
          width: `${bar == null ? 0 : Math.min(100, bar * 100)}%`,
          height: "100%",
          background: accent
            ? "linear-gradient(90deg, var(--secondary), var(--accent))"
            : "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))",
          transition: "width 100ms linear",
        }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    idle: { color: "var(--text-muted)", label: "停止中" },
    starting: { color: "var(--accent)", label: "起動中" },
    running: { color: "var(--success)", label: "動作中" },
    error: { color: "var(--danger)", label: "エラー" },
  } as const;
  const s = map[status.kind];
  return (
    <span className="inline-flex items-center gap-2 text-sub" aria-live="polite">
      <span className="dot-pulse" style={{
        width: 10, height: 10, borderRadius: "50%", background: s.color,
        boxShadow: `0 0 12px ${s.color}`,
      }} aria-hidden />
      {s.label}
    </span>
  );
}
