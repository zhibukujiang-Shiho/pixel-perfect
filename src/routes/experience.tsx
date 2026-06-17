// experience.tsx — 体験画面。カメラ起動 → 動き解析 → 音と映像を生成する中核画面。
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { MotionAnalyzer } from "@/lib/art/motion";
import { VisualRenderer } from "@/lib/art/visuals";
import { AudioEngine } from "@/lib/art/audio";
import { loadSettings, MODE_LABELS, type ArtSettings } from "@/lib/art/settings";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "体験 — Motion Resonance" },
      { name: "description", content: "Webカメラの前で身体を動かし、音と映像のリアルタイム生成を体験できます。" },
    ],
  }),
  component: ExperiencePage,
});

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running" }
  | { kind: "error"; message: string };

function ExperiencePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<MotionAnalyzer | null>(null);
  const rendererRef = useRef<VisualRenderer | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [settings, setSettings] = useState<ArtSettings>(() => loadSettings());
  const [energy, setEnergy] = useState(0);

  // 設定変更を各エンジンに反映
  useEffect(() => {
    if (analyzerRef.current) analyzerRef.current.sensitivity = settings.sensitivity;
    if (audioRef.current) {
      audioRef.current.setMode(settings.mode);
      audioRef.current.setVolume(settings.volume);
      audioRef.current.setMuted(!settings.soundOn);
    }
  }, [settings]);

  const start = useCallback(async () => {
    setStatus({ kind: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const analyzer = new MotionAnalyzer();
      analyzer.sensitivity = settings.sensitivity;
      analyzerRef.current = analyzer;

      const renderer = new VisualRenderer(canvasRef.current!);
      rendererRef.current = renderer;

      const audio = new AudioEngine();
      await audio.start();
      audio.setMode(settings.mode);
      audio.setVolume(settings.volume);
      audio.setMuted(!settings.soundOn);
      audioRef.current = audio;

      setStatus({ kind: "running" });

      const loop = () => {
        const v = videoRef.current;
        if (v && v.readyState >= 2) {
          const frame = analyzer.analyze(v);
          renderer.render(frame);
          audio.tick(frame.energy);
          setEnergy(frame.energy);
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
    analyzerRef.current = null;
    setEnergy(0);
    setStatus({ kind: "idle" });
  }, []);

  // アンマウント時に確実にカメラ・音を停止
  useEffect(() => () => stop(), [stop]);

  const toggleSound = () => {
    const next = { ...settings, soundOn: !settings.soundOn };
    setSettings(next);
  };

  return (
    <>
      <AppHeader />
      <main className="container-app section-y">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2>体験</h2>
            <p className="text-sub">カメラの前で身体を動かしてください。動きが音と光に変わります。</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {status.kind === "error" && (
          <div className="alert alert-error mb-6" role="alert">
            <span aria-hidden>⚠️</span>
            <div>{status.message}</div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* カメラ映像 */}
          <section aria-labelledby="cam-title" className="card">
            <h3 id="cam-title" className="mb-3">カメラ映像</h3>
            <div className="canvas-area">
              <video
                ref={videoRef}
                playsInline
                muted
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

          {/* 生成映像 */}
          <section aria-labelledby="gen-title" className="card">
            <h3 id="gen-title" className="mb-3">生成映像</h3>
            <div className="canvas-area">
              <canvas ref={canvasRef} className="w-full h-full block" aria-label="動きに連動して生成される映像" />
            </div>
          </section>
        </div>

        {/* メーター & 操作 */}
        <section className="card mt-6">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sub">動きの大きさ</span>
                <span className="text-sub" aria-live="polite">{Math.round(energy * 100)}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(energy * 100)}
                style={{
                  height: 10, borderRadius: 999,
                  background: "var(--surface-2)", overflow: "hidden",
                }}
              >
                <div style={{
                  width: `${Math.min(100, energy * 100)}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))",
                  transition: "width 80ms linear",
                }} />
              </div>
              <p className="text-sub mt-3">
                現在のモード: <strong style={{ color: "var(--text)" }}>{MODE_LABELS[settings.mode]}</strong>
                ・音量: <strong style={{ color: "var(--text)" }}>{Math.round(settings.volume * 100)}%</strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
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
