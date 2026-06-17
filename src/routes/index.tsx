// index.tsx — トップ画面。アプリの説明とカメラ開始ボタン。
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader, AppFooter } from "@/components/app-header";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Motion Resonance — 動きが音と光になる体験" },
      { name: "description", content: "Webカメラで身体の動きを認識し、音と映像をリアルタイム生成するインタラクティブアート作品です。" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="container-app section-y">
        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="text-sub mb-4" style={{ letterSpacing: "0.18em" }}>
              INTERACTIVE ART · PROTOTYPE
            </p>
            <h1 className="mb-6">
              身体の動きが、<br />
              <span style={{
                background: "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}>音と光</span>に変わる。
            </h1>
            <p style={{ color: "var(--text-muted)", maxWidth: 520 }}>
              Motion Resonance は、Webカメラで人の動きを感じ取り、その大きさや速度をリアルタイムに
              音楽と映像へ変換するインタラクティブアートです。複数人が同じ空間で身体を動かすことで、
              自然なコミュニケーションが生まれます。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/experience" className="btn btn-primary">カメラを開始する</Link>
              <Link to="/settings" className="btn btn-secondary">演出を設定</Link>
            </div>
            <ul className="mt-8 grid sm:grid-cols-3 gap-3 text-sub">
              <li className="card" style={{ padding: 16 }}>🎥 ブラウザだけで動作</li>
              <li className="card" style={{ padding: 16 }}>🔒 映像は端末内で処理</li>
              <li className="card" style={{ padding: 16 }}>🎼 3つの音楽モード</li>
            </ul>
          </div>

          <HeroVisual />
        </section>

        <section className="section-y">
          <h2 className="mb-6">想定する利用シーン</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { t: "卒業制作のプロトタイプ", d: "身体表現とコミュニケーションの関係を素早く検証できる。" },
              { t: "展示会での体験デモ", d: "来場者が動くだけで作品コンセプトを体感できる。" },
              { t: "ワークショップ・授業", d: "学生同士が動きを共有しながらメディア表現を学べる。" },
            ].map((c) => (
              <article key={c.t} className="card">
                <h3 className="mb-2">{c.t}</h3>
                <p className="text-sub" style={{ marginTop: 4 }}>{c.d}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <AppFooter />
    </>
  );
}

/** トップに表示する装飾ビジュアル (CSSのみ。実カメラ起動前のプレビュー) */
function HeroVisual() {
  return (
    <div className="canvas-area" aria-hidden>
      <div style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(400px 220px at 30% 40%, rgba(79,124,255,0.55), transparent 60%)," +
          "radial-gradient(360px 200px at 70% 60%, rgba(139,92,246,0.55), transparent 60%)," +
          "radial-gradient(280px 180px at 50% 50%, rgba(34,211,238,0.45), transparent 60%)",
        filter: "blur(2px)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1.2px)",
        backgroundSize: "22px 22px",
        opacity: 0.18,
      }} />
    </div>
  );
}
