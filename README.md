# Motion Resonance

身体の動きを音と光に変換するインタラクティブアート Web アプリ。

---

## 1. 完成イメージ

- トップ画面でアプリの世界観を提示し、「カメラを開始」ボタンから体験画面へ遷移
- 体験画面では Web カメラ映像と、動きに反応して生成される映像を並列表示
- 身体を動かすと、動きの大きさ・速度・位置に応じて
  - パーティクルが噴き出し、色が混ざり合う
  - 音階・音量・発音頻度が変化する
- 設定画面で音量・感度・音楽モード (アンビエント / EDM / ピアノ風) を変更し LocalStorage に保存

## 2. 技術構成

| 領域 | 採用 |
|---|---|
| フレームワーク | TanStack Start (React 19 + Vite 7) |
| スタイル | Tailwind CSS v4 + CSS 変数によるデザインシステム |
| 動き検出 | Canvas フレーム差分 (`MotionAnalyzer`) — 軽量・全ブラウザ対応・複数人OK |
| 映像生成 | Canvas 2D パーティクル + 動きグリッド (`VisualRenderer`) |
| 音生成 | Web Audio API ベースの簡易シンセ (`AudioEngine`) |
| 永続化 | LocalStorage (設定のみ) |

外部 AI / 重量モデルや有料 SDK は使用していません。

## 3. ファイル構成

```
src/
├─ styles.css                  # デザイントークン (色/余白/ボタン/カード) を集約
├─ routes/
│  ├─ __root.tsx               # 共通シェル + フォント読込
│  ├─ index.tsx                # トップ画面
│  ├─ experience.tsx           # 体験画面 (中核)
│  └─ settings.tsx             # 設定画面
├─ components/
│  └─ app-header.tsx           # 共通ヘッダー / フッター
└─ lib/art/
   ├─ motion.ts                # カメラ → 動きエネルギーへ
   ├─ visuals.ts               # 動き → Canvas 演出
   ├─ audio.ts                 # 動き → Web Audio
   └─ settings.ts              # 設定の型 + LocalStorage
```

## 4. 各ファイルの役割

- **styles.css** — 色・角丸・余白・ボタン・カードの共通ルール (CSS 変数 + Tailwind v4 `@utility`)。
- **routes/__root.tsx** — html/head/body、フォント読み込み、エラー境界。
- **routes/index.tsx** — タイトル/コンセプト説明/開始ボタン。
- **routes/experience.tsx** — カメラ起動、動き解析ループ、音と映像の駆動、操作 UI。
- **routes/settings.tsx** — 音量/感度/モードの編集 + 保存。
- **components/app-header.tsx** — 全画面共通のヘッダー (ロゴ + ナビ)。
- **lib/art/motion.ts** — フレーム差分で `energy` / `centroid` / `cells` を算出。
- **lib/art/visuals.ts** — 上記を Canvas に描画 (パーティクル + 動きの可視化)。
- **lib/art/audio.ts** — `energy` から音階を選び発音。モードで音色・スケールを切替。
- **lib/art/settings.ts** — 型定義と LocalStorage I/O。

## 5. 実装コード

各ファイルは `src/` 配下に実装済みです。コードは役割で分離されており、必要な箇所だけ差し替え可能です。

## 6. UI 共通ルールの説明

- すべての色・角丸・余白・影は `src/styles.css` 内の CSS 変数で定義 (`--primary`, `--bg`, `--radius-md` …)。
- 共通クラスは Tailwind v4 の `@utility` で定義:
  - `card` / `btn` / `btn-primary` / `btn-secondary` / `btn-danger` / `btn-disabled`
  - `input-field` / `alert` / `canvas-area` / `container-app` / `section-y`
- ボタンは高さ 48px / 角丸 12px / 文字 16px Medium に統一。
- 無効状態は `btn-disabled` (opacity 0.4 + クリック不可) で表現。
- 状態表示は色だけでなくテキストとアイコン (●、✓、⚠️) も併用しアクセシビリティを担保。

## 7. JavaScript の主要処理の説明

- **カメラ起動 (`experience.tsx > start`)** — `getUserMedia` で映像取得 → `<video>` にバインド → `MotionAnalyzer` / `VisualRenderer` / `AudioEngine` を初期化 → `requestAnimationFrame` ループ開始。
- **動き解析 (`motion.ts`)** — 160×90 にダウンサンプルし、前フレームとの RGB 差分を集計。`energy`(0..1) / `centroid` / セルごとの強度を返す。複数人にも自然対応。
- **音生成 (`audio.ts > tick`)** — `energy` が閾値を超え、かつ最終発音から最低間隔を経過した場合のみペンタトニックスケールから音を選んで発音。動きが大きいほど高音・短間隔。
- **映像生成 (`visuals.ts > render`)** — 残像フェード → セル単位の発光ドット (骨格的) → 重心から放射するパーティクル。`lighter` 合成で発光感を出す。
- **設定 (`settings.ts`)** — `loadSettings` / `saveSettings` で永続化し、`experience.tsx` の `useEffect` が変更を各エンジンへ反映。

## 8. レスポンシブ対応

- 1440px を最大幅とする `container-app` で中央寄せ。
- ブレークポイント (Tailwind の `sm` / `md` / `lg`):
  - **〜768px (スマホ)** — 1 カラム、ボタンは横並びだが折返し可、見出しサイズは `clamp()` で自動縮小。
  - **768〜1024px (タブレット)** — トップの特徴カードを 3 カラムに、体験画面は引き続き縦並びで操作しやすく。
  - **1024px〜 (PC)** — トップは 2 カラム (説明 + ビジュアル)、体験は「カメラ映像」「生成映像」を横並びに。
- 文字は最小 14px (補助) / 16px (本文)、ボタンは常に高さ 48px を確保しタップしやすい。

## 9. 変更・カスタマイズしやすい箇所

| やりたいこと | 触る場所 |
|---|---|
| 色を変える | `src/styles.css` の `:root` 内 CSS 変数 |
| 音階・音色を変える | `src/lib/art/audio.ts` の `SCALES` / `OSC_TYPES` |
| パーティクル数・色 | `src/lib/art/visuals.ts` の `PALETTE` とパーティクル生成箇所 |
| 感度の初期値 | `src/lib/art/settings.ts` の `DEFAULTS` |
| 動きの解析解像度 | `src/lib/art/motion.ts` の `SAMPLE_W` / `SAMPLE_H` / `COLS` / `ROWS` |

## 10. 公開前チェックリスト

- [ ] `.env` などの秘密情報をリポジトリに含めていない
- [ ] HTTPS で公開している (Web カメラはセキュア文脈必須)
- [ ] 利用ブラウザ (Chrome / Safari / Firefox 最新版) で動作確認
- [ ] PC / タブレット / スマホでレイアウト崩れがないことを確認
- [ ] カメラ許可ダイアログを拒否した場合のエラーメッセージが表示される
- [ ] 3 分以上連続動作させてもメモリリーク・音割れがない
- [ ] フッターのコピーライト / バージョン表示が最新
- [ ] OGP / favicon / `lang="ja"` の設定確認

## 11. 余裕がある人向けの発展機能

- **MediaPipe Pose 連携** — `motion.ts` を差し替えれば手・頭・足など部位ごとの音割当が可能。
- **複数人色分け** — フレーム差分のクラスタリングで領域分割し、人ごとに別 PALETTE を割当。
- **セッション録画** — `MediaRecorder` で `<canvas>` をキャプチャして `.webm` ダウンロード。
- **テーマ切替** — `visuals.ts` の PALETTE と背景を「水 / 光 / 星 / 花」プリセットで切替。
- **MIDI 出力** — Web MIDI API で外部音源と連動し展示の音響をリッチに。
