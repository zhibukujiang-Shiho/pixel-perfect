// projector.tsx — プロジェクター出力用のフルスクリーン画面。
// メインウィンドウから window.open で開かれ、UIは表示せず canvas のみを露出する。
// メイン側の VisualRenderer は window.opener 経由でこの canvas にも描画する。
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/projector")({
  head: () => ({
    meta: [
      { title: "Projector — Motion Resonance" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectorPage,
});

function ProjectorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.id = "projector-canvas";
    // F キーでフルスクリーン
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    // 親に「準備完了」を通知
    try { (window.opener as Window | null)?.postMessage({ type: "projector-ready" }, window.location.origin); } catch {}
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "#000", cursor: "none", overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
      <div
        style={{
          position: "fixed", bottom: 12, right: 16,
          color: "rgba(255,255,255,0.35)", fontSize: 12,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        F でフルスクリーン切替
      </div>
    </div>
  );
}
