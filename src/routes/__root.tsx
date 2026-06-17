// __root.tsx — ルートシェル。フォント読み込みとグローバルレイアウト/エラー境界。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center card">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-sub mt-2">お探しのページは見つかりませんでした。</p>
        <div className="mt-6">
          <Link to="/" className="btn btn-primary">ホームに戻る</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center card">
        <h2 className="text-xl font-semibold">読み込みに失敗しました</h2>
        <p className="text-sub mt-2">時間をおいて再試行してください。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="btn btn-primary">
            再試行
          </button>
          <a href="/" className="btn btn-secondary">ホームへ</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Motion Resonance — 動きが音と光になる体験" },
      { name: "description", content: "Webカメラで身体の動きを感じ取り、リアルタイムに音と映像を生成するインタラクティブアート作品。" },
      { name: "theme-color", content: "#0B1020" },
      { property: "og:title", content: "Motion Resonance — 動きが音と光になる体験" },
      { property: "og:description", content: "Webカメラで身体の動きを感じ取り、リアルタイムに音と映像を生成するインタラクティブアート作品。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Motion Resonance — 動きが音と光になる体験" },
      { name: "twitter:description", content: "Webカメラで身体の動きを感じ取り、リアルタイムに音と映像を生成するインタラクティブアート作品。" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe9091bc-5751-4022-98c5-3f753f943db6/id-preview-d5d01f9f--da2c8eb7-330d-4adb-9ead-b296938703e9.lovable.app-1781686746207.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe9091bc-5751-4022-98c5-3f753f943db6/id-preview-d5d01f9f--da2c8eb7-330d-4adb-9ead-b296938703e9.lovable.app-1781686746207.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
