// app-header.tsx — 全画面で共通のヘッダー (ロゴ + タイトル + ナビ)
import { Link } from "@tanstack/react-router";

export function AppHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-deep)]/60 backdrop-blur sticky top-0 z-20">
      <div className="container-app flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3 group" aria-label="ホームへ">
          <span
            className="inline-block w-6 h-6 rounded-md"
            style={{
              background: "conic-gradient(from 180deg, var(--primary), var(--secondary), var(--accent), var(--primary))",
              boxShadow: "var(--glow-primary)",
            }}
            aria-hidden
          />
          <span className="font-semibold tracking-wide" style={{ color: "var(--text)" }}>
            Motion <span style={{ color: "var(--accent)" }}>Resonance</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/experience" className="btn btn-secondary" style={{ height: 40, padding: "0 14px" }}>
            体験
          </Link>
          <Link to="/settings" className="btn btn-secondary" style={{ height: 40, padding: "0 14px" }} aria-label="設定">
            設定
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="container-app text-center py-8 text-sub">
      © {new Date().getFullYear()} Motion Resonance — v0.1 prototype
    </footer>
  );
}
