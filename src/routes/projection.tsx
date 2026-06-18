// projection.tsx — プロジェクション画面 (展示運用)。
// /control からの BroadcastChannel メッセージを受信し、映像と音響を再生する。
// UI は最小限。F キーでフルスクリーン切替。
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { VisualRenderer } from "@/lib/art/visuals";
import { AudioEngine } from "@/lib/art/audio";
import { createChannel, type ChannelMessage } from "@/lib/art/channel";
import { loadSettings, type ArtSettings } from "@/lib/art/settings";
import type { PersonPose } from "@/lib/art/pose";

export const Route = createFileRoute("/projection")({
  head: () => ({
    meta: [
      { title: "Projection — Motion Resonance" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectionPage,
});

function ProjectionPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VisualRenderer | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const settingsRef = useRef<ArtSettings>(loadSettings());
  const personsRef = useRef<PersonPose[]>([]);
  const energyRef = useRef(0);
  const closenessRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const arm = async () => {
    const renderer = new VisualRenderer(canvasRef.current!);
    rendererRef.current = renderer;
    const audio = new AudioEngine();
    await audio.start();
    audio.setVolume(settingsRef.current.volume);
    audio.setMuted(!settingsRef.current.soundOn);
    audio.setMode(settingsRef.current.mode);
    audioRef.current = audio;

    const ch = createChannel();
    if (ch) {
      ch.onmessage = (ev: MessageEvent<ChannelMessage>) => {
        const m = ev.data;
        if (m.type === "frame") {
          personsRef.current = m.persons;
          energyRef.current = m.energy;
          closenessRef.current = m.closeness;
          settingsRef.current = m.settings;
          if (audioRef.current) {
            audioRef.current.setVolume(m.settings.volume);
            audioRef.current.setMuted(!m.settings.soundOn);
            audioRef.current.setMode(m.settings.mode);
            audioRef.current.tick(m.energy, m.closeness);
          }
          setLinked(true);
        } else if (m.type === "impact") {
          audioRef.current?.playImpact(m.sound);
          rendererRef.current?.triggerImpact(m.at);
        } else if (m.type === "settings") {
          settingsRef.current = m.settings;
        } else if (m.type === "bye") {
          setLinked(false);
        }
      };
      ch.postMessage({ type: "hello" } satisfies ChannelMessage);
    }

    const loop = () => {
      rendererRef.current?.render(
        personsRef.current, settingsRef.current.displayMode,
        energyRef.current, closenessRef.current,
      );
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    setArmed(true);
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioRef.current?.dispose();
    rendererRef.current?.dispose();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", cursor: armed ? "none" : "default" }}>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
      {!armed && (
        <div style={{
          position: "fixed", inset: 0, display: "grid", placeItems: "center",
          color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24,
        }}>
          <div>
            <h1 style={{ fontSize: 28, marginBottom: 8 }}>Projection</h1>
            <p style={{ opacity: 0.7, marginBottom: 24 }}>
              ブラウザの音声再生許可のため、開始ボタンを押してください。<br />
              開始後、F キーでフルスクリーンになります。
            </p>
            <button onClick={arm} style={{
              padding: "12px 28px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, cursor: "pointer",
            }}>投影を開始</button>
          </div>
        </div>
      )}
      {armed && (
        <div style={{
          position: "fixed", bottom: 10, right: 14, fontSize: 11,
          color: linked ? "rgba(255,255,255,0.35)" : "rgba(255,180,120,0.7)",
          fontFamily: "system-ui, sans-serif",
        }}>
          {linked ? "● control linked  /  F: fullscreen" : "○ waiting for /control …"}
        </div>
      )}
    </div>
  );
}
