// control.tsx — Control画面 (展示運用)。
// カメラ取得 + MediaPipe Pose 認識 + 接触判定 を行い、
// BroadcastChannel 経由で /projection へリアルタイム送信する。
// この画面では映像エフェクトや音響は再生せず、骨格プレビューと操作 UI のみ表示する。
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PoseTracker, type PersonPose } from "@/lib/art/pose";
import { ContactDetector } from "@/lib/art/contact";
import { createChannel, type ChannelMessage } from "@/lib/art/channel";
import { loadSettings, IMPACT_LABELS, type ArtSettings } from "@/lib/art/settings";

export const Route = createFileRoute("/control")({
  head: () => ({
    meta: [
      { title: "Control — Motion Resonance" },
      { name: "description", content: "プロジェクター運用のための Control 画面。カメラと認識のみを行い、映像は /projection に出力します。" },
    ],
  }),
  component: ControlPage,
});

type Status = { kind: "idle" | "starting" | "running" } | { kind: "error"; message: string };

function ControlPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contactRef = useRef<ContactDetector | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const rafRef = useRef<number | null>(null);
  const settingsRef = useRef<ArtSettings>(loadSettings());
  const projectionWinRef = useRef<Window | null>(null);

  const [settings, setSettings] = useState<ArtSettings>(() => loadSettings());
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [people, setPeople] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [closeness, setCloseness] = useState(0);
  const [projectionConnected, setProjectionConnected] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // チャネル受信 (projection からの hello)
  useEffect(() => {
    const ch = createChannel();
    if (!ch) return;
    channelRef.current = ch;
    ch.onmessage = (ev: MessageEvent<ChannelMessage>) => {
      if (ev.data.type === "hello") setProjectionConnected(true);
    };
    return () => { try { ch.postMessage({ type: "bye" }); ch.close(); } catch {} };
  }, []);

  const openProjection = useCallback(() => {
    if (projectionWinRef.current && !projectionWinRef.current.closed) {
      projectionWinRef.current.focus();
      return;
    }
    const w = window.open("/projection", "motion-projection", "width=1280,height=720,menubar=no,toolbar=no");
    if (!w) { setStatus({ kind: "error", message: "ポップアップがブロックされました。許可してから再度お試しください。" }); return; }
    projectionWinRef.current = w;
    const poll = window.setInterval(() => {
      if (w.closed) { window.clearInterval(poll); projectionWinRef.current = null; setProjectionConnected(false); }
    }, 600);
  }, []);

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

      trackerRef.current = await PoseTracker.create();
      contactRef.current = new ContactDetector();
      setStatus({ kind: "running" });

      let lastFpsT = performance.now(); let frames = 0;
      const ctx = previewRef.current?.getContext("2d") ?? null;

      const loop = () => {
        const v = videoRef.current;
        const s = settingsRef.current;
        if (v && v.readyState >= 2 && trackerRef.current) {
          const persons = trackerRef.current.detect(v, performance.now());
          const e = Math.min(1, persons.reduce((a, p) => Math.max(a, p.speed), 0) * s.sensitivity);
          const dist = ContactDetector.distance(persons);
          const close = dist == null ? 0 : Math.max(0, Math.min(1, 1 - dist * 1.4));

          // 接触イベント
          if (contactRef.current) {
            const events = contactRef.current.step(persons);
            for (const ev of events) {
              channelRef.current?.postMessage({
                type: "impact", at: ev.midpoint, sound: s.impactSound, settings: s,
              } satisfies ChannelMessage);
            }
          }

          // フレーム送信 (~30Hz でも軽い)
          channelRef.current?.postMessage({
            type: "frame", persons, energy: e, closeness: close, settings: s, ts: performance.now(),
          } satisfies ChannelMessage);

          // ローカル骨格プレビュー
          if (ctx && previewRef.current) drawPreview(ctx, previewRef.current, persons);

          setEnergy(e); setCloseness(close); setPeople(persons.length);

          frames++;
          const now = performance.now();
          if (now - lastFpsT > 500) {
            setFps(Math.round((frames * 1000) / (now - lastFpsT)));
            frames = 0; lastFpsT = now;
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === "NotAllowedError" ? "カメラへのアクセスが拒否されました。" : err.message)
        : "カメラを起動できませんでした。";
      setStatus({ kind: "error", message: msg });
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    trackerRef.current?.dispose();
    trackerRef.current = null;
    contactRef.current = null;
    setStatus({ kind: "idle" });
    setEnergy(0); setCloseness(0); setPeople(0); setFps(0);
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return (
    <>
      <AppHeader />
      <main className="container-app section-y">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2>Control</h2>
            <p className="text-sub">展示運用モード。カメラと認識はここで、映像と音響はプロジェクション画面で再生します。</p>
          </div>
          <span className="text-sub">
            {projectionConnected ? "● Projection 接続中" : "○ Projection 未接続"}
          </span>
        </div>

        {status.kind === "error" && (
          <div className="alert alert-error mb-6" role="alert">⚠️ {status.message}</div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="card">
            <h3 className="mb-3">カメラ映像</h3>
            <div className="canvas-area">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              {status.kind !== "running" && (
                <div className="absolute inset-0 grid place-items-center text-sub">カメラ未起動</div>
              )}
            </div>
          </section>
          <section className="card">
            <h3 className="mb-3">認識プレビュー (骨格)</h3>
            <div className="canvas-area" style={{ background: "#0b0f1f" }}>
              <canvas ref={previewRef} width={640} height={360} className="w-full h-full block" />
            </div>
          </section>
        </div>

        <section className="card mt-6">
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <Metric label="検出人数" value={`${people} / 2`} />
            <Metric label="動きの大きさ" value={`${Math.round(energy * 100)}%`} bar={energy} />
            <Metric label="二人の近さ" value={`${Math.round(closeness * 100)}%`} bar={closeness} accent />
            <Metric label="FPS" value={fps ? String(fps) : "—"} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sub" style={{ margin: 0 }}>
              インパクト: <strong style={{ color: "var(--text)" }}>{IMPACT_LABELS[settings.impactSound]}</strong>
              ・出力: <strong style={{ color: "var(--text)" }}>Projection ウィンドウ</strong>
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              {status.kind !== "running" ? (
                <button className="btn btn-primary" onClick={start} disabled={status.kind === "starting"}>
                  {status.kind === "starting" ? "起動中..." : "認識を開始"}
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stop}>停止</button>
              )}
              <button className="btn btn-secondary" onClick={openProjection}>
                📽 Projection を開く
              </button>
              <Link to="/settings" className="btn btn-secondary">設定</Link>
            </div>
          </div>
          <p className="text-sub mt-4" style={{ fontSize: 13 }}>
            運用手順: ①HDMI接続 → ②拡張ディスプレイモード → ③「Projection を開く」→ ④ Projection 画面をプロジェクター側へ移動 → ⑤ F キーでフルスクリーン。
          </p>
        </section>
      </main>
    </>
  );
}

function drawPreview(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, persons: PersonPose[]) {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "rgba(11,15,31,0.35)";
  ctx.fillRect(0, 0, w, h);
  for (const p of persons) {
    const color = p.id === 0 ? "#22D3EE" : "#C084FC";
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
    const lines: [{ x: number; y: number }, { x: number; y: number }][] = [
      [p.shoulderL, p.shoulderR],
      [p.shoulderL, p.elbowL], [p.elbowL, p.wristL],
      [p.shoulderR, p.elbowR], [p.elbowR, p.wristR],
      [p.head, p.torso],
    ];
    for (const [a, b] of lines) {
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
    for (const pt of [p.head, p.wristL, p.wristR]) {
      ctx.beginPath(); ctx.arc(pt.x * w, pt.y * h, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function Metric({ label, value, bar, accent }: { label: string; value: string; bar?: number; accent?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sub">{label}</span>
        <span className="text-sub" aria-live="polite">{value}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={bar == null ? 0 : Math.round(bar * 100)}
        style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{
          width: `${bar == null ? 0 : Math.min(100, bar * 100)}%`, height: "100%",
          background: accent
            ? "linear-gradient(90deg, var(--secondary), var(--accent))"
            : "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))",
          transition: "width 100ms linear",
        }} />
      </div>
    </div>
  );
}
