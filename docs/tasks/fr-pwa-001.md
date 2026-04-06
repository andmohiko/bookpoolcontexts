# FR-PWA-001: PWA化（最小構成）

## 概要

Vector MemoをPWA（Progressive Web App）化し、スマホではホーム画面へのインストール、PCではChrome Appとしてのインストールを可能にする。

## 背景

モバイル端末でもネイティブアプリのように利用できるようにするため、PWA対応を行う。

## 技術選定

- **vite-plugin-pwa**: `manifest.webmanifest` の自動生成のみに使用。Service Workerの自動生成機能（Workbox）は使用しない
- **手動Service Worker**: PWAインストール要件を満たすための最小限のSWを `public/sw.js` に手動配置。TanStack Start SPAモードではvite-plugin-pwaのWorkbox SW生成が正常に動作しないため
- **キャッシュ戦略・更新通知・プッシュ通知**: 不要のためスコープ外

## 実装手順

### 1. パッケージインストール

```bash
pnpm --filter @vectornote/web add -D vite-plugin-pwa
```

### 2. 既存manifest.jsonの削除

`apps/web/public/manifest.json` を削除する。vite-plugin-pwaがビルド時に `manifest.webmanifest` を自動生成するため。

### 3. 最小Service Worker配置 (`apps/web/public/sw.js`)

PWAインストール要件を満たすための最小限のService Worker。キャッシュは行わない。

```javascript
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
```

### 4. Vite設定 (`apps/web/vite.config.ts`)

VitePWAプラグインをプラグイン配列の**最後**に追加する。manifest生成のみを担当させ、SW生成・登録は無効化する。

```typescript
import { VitePWA } from 'vite-plugin-pwa'

// plugins配列の最後に追加
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: null,
  includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png'],
  manifest: {
    name: 'Vector Memo',
    short_name: 'Vector Memo',
    description: 'セマンティック検索メモ帳アプリケーション',
    theme_color: '#000000',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: 'logo192.png', sizes: '192x192', type: 'image/png' },
      { src: 'logo512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },
  selfDestroying: true,
  devOptions: { enabled: false },
})
```

### 5. TypeScript型定義 (`apps/web/tsconfig.json`)

```json
"types": ["vite/client", "vite-plugin-pwa/client"]
```

### 6. PWAメタタグ追加 (`apps/web/src/routes/__root.tsx`)

`head()` に以下を追加:

```typescript
// meta追加
{ name: 'theme-color', content: '#000000' },
{ name: 'apple-mobile-web-app-capable', content: 'yes' },
{ name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
{ name: 'apple-mobile-web-app-title', content: 'Vector Memo' },

// links追加
{ rel: 'apple-touch-icon', href: '/logo192.png' },
```

### 7. SW登録フック (`apps/web/src/hooks/useServiceWorker.ts`)

- `navigator.serviceWorker.register` でSWを登録
- `AppLayout` コンポーネントで呼び出し

### 8. インストールプロンプトフック (`apps/web/src/hooks/usePWAInstall.ts`)

- `beforeinstallprompt` イベントを捕捉
- 返り値: `{ canInstall, promptInstall }`

### 9. SideNavにインストールボタン追加 (`apps/web/src/components/SideNav.tsx`)

- `SidebarFooter` を追加
- `canInstall` が true の場合のみ「アプリをインストール」ボタンを表示
- DownloadIcon（lucide-react）を使用

## 修正対象ファイル

| ファイル | 操作 |
|---------|------|
| `apps/web/package.json` | vite-plugin-pwa を devDependencies に追加 |
| `apps/web/public/manifest.json` | 削除 |
| `apps/web/public/sw.js` | 新規作成（最小限のService Worker） |
| `apps/web/vite.config.ts` | VitePWAプラグイン追加（manifest生成のみ） |
| `apps/web/tsconfig.json` | vite-plugin-pwa/client 型定義追加 |
| `apps/web/src/routes/__root.tsx` | PWAメタタグ追加 + useServiceWorker統合 |
| `apps/web/src/hooks/useServiceWorker.ts` | 新規作成 |
| `apps/web/src/hooks/usePWAInstall.ts` | 新規作成 |
| `apps/web/src/components/SideNav.tsx` | インストールボタン追加 |

## 注意事項

- **TanStack Start SPAモードとの互換性**: vite-plugin-pwaのWorkbox SW生成はTanStack Startの複数段階ビルド（client + server + prerender）と互換性がないため、SWは手動配置とした
- **maskableアイコン**: logo512.pngが安全領域内にロゴが収まるデザインでない場合、Android端末でアイコンが切れる可能性あり。必要に応じて専用アイコンを用意

## 検証方法

1. `pnpm web build` でビルド成功を確認
2. ビルド出力に `sw.js` と `manifest.webmanifest` が存在することを確認
3. `pnpm web preview` でプレビューサーバー起動し動作確認
4. DevTools > Application > Service Workers でSW登録確認
5. DevTools > Application > Manifest でマニフェスト確認
