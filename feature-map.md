# Feature Map — BookPoolContexts

> Generated: 2026-09-24
> Tech Stack: TanStack Start (SPA), TanStack Router, React, Tailwind CSS, shadcn/ui, Firebase (Auth / Firestore / Functions / Hosting)

## Overview

読みたい本を登録・管理し、文脈（コンテキスト）ごとにグルーピングできる読書管理アプリ。Amazon URL から本の情報を自動取得し、タグやグループで整理する。グループを外部に公開共有する機能も持つ。

### 画面一覧

| パス | 画面名 | 認証 |
|------|--------|------|
| `/login` | ログイン画面 | 不要 |
| `/` | ホーム（本の一覧） | 必要 |
| `/groups` | グループ管理 | 必要 |
| `/tags` | タグ管理 | 必要 |
| `/settings` | 設定 | 必要 |
| `/about` | About | 必要 |
| `/shared/{sharedGroupId}` | 共有グループ閲覧 | 不要 |

## Getting Started

+ Dev server: `pnpm web dev` (port 3000)
+ Full monorepo dev: `pnpm dev` (Turborepo parallel)
+ URL: `http://localhost:3000`
+ Auth: Firebase Authentication (Google OAuth)。未認証時は `/login` にリダイレクト

## Selectors Note

`data-testid` はコードベース全体で未使用。安定セレクタは `id` 属性（フォーム入力）と一部の `aria-label` に限られる。

---

## Features

### 1. 認証

#### 1.1 Googleログイン
Google アカウントでアプリにログインする。

##### How a user gets there
+ Click path: `/login` 画面 → 「Googleでログイン」ボタン
+ Keyboard shortcut: なし

##### How the control adapter drives it
+ Click "Googleでログイン" button should trigger Firebase Google OAuth popup and redirect to `/` on success

##### Stable selectors
+ Button text: "Googleでログイン"

##### Gotchas
+ 既にログイン済みの場合、`/login` にアクセスすると自動的に `/` へリダイレクトされる
+ 認証が必要なページ（`/_authed/*`）に未認証でアクセスすると `/login` にリダイレクトされる

---

### 2. ホーム画面（本の一覧）

#### 2.1 本の一覧表示
登録した本をカードグリッドで一覧表示する。

##### How a user gets there
+ Click path: ログイン後自動遷移、またはヘッダーの「BookPoolContexts」テキストをクリック、またはサイドナビの「すべて」
+ Keyboard shortcut: なし

##### How the control adapter drives it
+ Navigate to `/` should display a grid of BookCard elements
+ Each card shows cover image (or "No Image" / spinner / failure state), tag badges, and read badge

##### Stable selectors
+ BookCard: `role="button"`, `tabIndex={0}`
+ Read badge: `aria-label="読了"`
+ Refetch button: `aria-label="本の情報を再取得"`
+ Empty state text: "本が登録されていません"

##### Sub-features
+ スクレイピング中の本: スピナー + "取得中..." 表示
+ スクレイピング失敗の本: "取得失敗" + 再取得ボタン（`aria-label="本の情報を再取得"`）
+ 読了済みの本: 右上に緑色チェックバッジ（`aria-label="読了"`）
+ タグ表示: カード下部にタグバッジ行

##### Gotchas
+ リアルタイム購読（`onSnapshot`）のため、他デバイスでの変更も即座に反映される
+ 一覧の上限は100件

---

#### 2.2 タグでフィルタリング
タグを選択して本を絞り込む。

##### How a user gets there
+ Click path: ホーム画面上部のタグチップをクリック、またはサイドナビのタグ名をクリック
+ Keyboard shortcut: なし

##### How the control adapter drives it
+ Click a tag chip should update URL to `/?tag=<label>` and filter the book grid
+ Click "すべて" chip (or サイドナビの「すべて」) should clear filter and show all books

##### Stable selectors
+ Tag chips: `Link` elements with `search={{ tag: label }}`
+ Active tag: highlighted styling (primary background)
+ サイドナビ active item: `data-[active=true]`

##### Gotchas
+ タグフィルタバーはグループフィルタ中（`?group=` あり）には表示されない

---

#### 2.3 グループでフィルタリング
グループを選択してそのグループの本だけを表示する。

##### How a user gets there
+ Click path: サイドナビの「文脈グループ」セクション → グループ名をクリック
+ Keyboard shortcut: なし

##### How the control adapter drives it
+ Click a group name in SideNav should update URL to `/?group=<label>` and filter the book grid

##### Stable selectors
+ サイドナビ group items: `Link` elements with `search={{ group: label }}`
+ Count badge next to each group name

---

#### 2.4 本の登録
新しい本を登録する。

##### How a user gets there
+ Click path: ホーム画面右下の FAB（+ボタン）をクリック
+ Keyboard shortcut: `c`（入力フィールドにフォーカスがないとき）

##### How the control adapter drives it
+ Click FAB (or press `c`) should open BookRegistrationModal dialog
+ Fill `#amazonUrl` with a valid Amazon URL
+ Optionally fill `#amazonHtml` with HTML source (URL と HTML のどちらか一方が必須)
+ Add tags by typing in tag input + pressing Enter
+ Fill `#foundBy`, `#location`, `#note`
+ Toggle purchasedBy checkboxes (物理本 / Kindle / オフィス)
+ Select groups via GroupSelectDropdown
+ Toggle isRead checkbox
+ Click "登録" button to submit

##### Stable selectors
+ Dialog title: "本を登録"
+ `id="amazonUrl"` — Amazon URL input
+ `id="amazonHtml"` — Amazon HTML textarea
+ `id="foundBy"` — どこで見つけたか
+ `id="location"` — どこで読めるか
+ `id="note"` — メモ textarea
+ Submit button text: "登録" / "登録中..."
+ Cancel button text: "キャンセル"

##### Sub-features
+ TagSuggestionDropdown: タグ入力時に既存タグをサジェスト（"最近使ったタグ" / "候補"）
+ GroupSelectDropdown: 既存グループを複数選択（placeholder: "グループを選択"）
+ 購入場所チェックボックス: 物理本, Kindle, オフィス

##### Gotchas
+ `amazonUrl` フィールドはダイアログ表示時に自動フォーカスされる
+ URL と HTML の両方が空だとバリデーションエラー
+ HTML を入力した場合はクライアント側で情報抽出し `scrapingStatus: 'skipped'` で保存（Cloud Functions のスクレイピングは実行されない）
+ `c` キーは INPUT / TEXTAREA / contentEditable にフォーカス中は発火しない

##### Verification
+ Launch: `pnpm web dev` → `http://localhost:3000`
+ Drive: Press `c` → fill `#amazonUrl` → click "登録"
+ Evidence: ダイアログが閉じ、一覧にカードが追加される（scrapingStatus に応じてスピナーまたは表紙画像が表示）
+ Cleanup: 登録した本を編集モーダルから削除

---

#### 2.5 本の編集
登録済みの本の情報を編集する。

##### How a user gets there
+ Click path: ホーム画面 → BookCard をクリック
+ Keyboard shortcut: BookCard 上で Enter / Space

##### How the control adapter drives it
+ Click a BookCard should open BookEditModal dialog
+ Modify tag input, `#edit-foundBy`, `#edit-location`, `#edit-note`, purchasedBy, groups, isRead
+ Click "更新" to save

##### Stable selectors
+ Dialog title: "本を編集"
+ `id="edit-foundBy"` — どこで見つけたか
+ `id="edit-location"` — どこで読めるか
+ `id="edit-note"` — メモ textarea
+ Submit button text: "更新" / "更新中..."
+ Cancel button text: "キャンセル"
+ Delete button text: "削除"

##### Gotchas
+ タイトル・著者・表紙画像・Amazon URL はスクレイピング結果に依存するため編集不可（モーダル上部に表示のみ）

---

#### 2.6 本の削除
登録済みの本を削除する。

##### How a user gets there
+ Click path: BookCard → BookEditModal → 「削除」ボタン → DeleteBookAlertDialog

##### How the control adapter drives it
+ Open BookEditModal → click "削除" button (variant="destructive") → confirmation dialog appears
+ Click "削除" in AlertDialog to confirm

##### Stable selectors
+ AlertDialog title: "本を削除"
+ AlertDialog description: 「{title}」を削除しますか？この操作は取り消せません。
+ Confirm button text: "削除" / "削除中..."
+ Cancel button text: "キャンセル"

##### Gotchas
+ 物理削除のため復元不可
+ 関連するタグ・グループのカウントは Cloud Functions が自動同期

---

#### 2.7 本の再取得（リフェッチ）
スクレイピング失敗した本の情報を再取得する。

##### How a user gets there
+ Click path: ホーム画面 → scrapingStatus が `failed` の BookCard 上の再取得ボタン

##### How the control adapter drives it
+ Click button with `aria-label="本の情報を再取得"` should trigger refetch (scrapingStatus → 'scraping')

##### Stable selectors
+ `aria-label="本の情報を再取得"` — RefreshCw icon button

##### Gotchas
+ 再取得ボタンのクリックは BookCard のクリックイベント（編集モーダル起動）とは独立（stopPropagation）

---

### 3. グループ管理

#### 3.1 グループ一覧
グループの作成・編集・削除・共有を管理する。

##### How a user gets there
+ Click path: サイドナビ → 「グループ管理」リンク（`/groups`）

##### How the control adapter drives it
+ Navigate to `/groups` should display group cards with label, count, and action buttons

##### Stable selectors
+ Page heading: "グループ管理"
+ Empty state text: "グループがありません"
+ Per-group: FolderOpen icon + label text + "{count}冊" badge + Share2 / Pencil / Trash2 icon buttons

---

#### 3.2 グループの作成
新しいグループを作成する。

##### How a user gets there
+ Click path: `/groups` → 「グループを作成」ボタン

##### How the control adapter drives it
+ Click "グループを作成" button → CreateGroupDialog opens
+ Fill `#label` with group name
+ Click "作成" to submit

##### Stable selectors
+ Trigger button text: "グループを作成"
+ Dialog title: "グループを作成"
+ `id="label"` — グループ名 input
+ Submit button text: "作成" / "作成中..."

---

#### 3.3 グループの編集
グループ名を変更する。

##### How a user gets there
+ Click path: `/groups` → グループカードの Pencil アイコンボタン

##### How the control adapter drives it
+ Click Pencil icon → EditGroupDialog opens
+ Modify `#edit-label`
+ Click "更新" to submit

##### Stable selectors
+ Dialog title: "グループを編集"
+ `id="edit-label"` — グループ名 input
+ Submit button text: "更新" / "更新中..."

---

#### 3.4 グループの削除
グループを削除する。

##### How a user gets there
+ Click path: `/groups` → グループカードの Trash2 アイコンボタン

##### How the control adapter drives it
+ Click Trash2 icon → DeleteGroupAlertDialog opens
+ Click "削除" to confirm

##### Stable selectors
+ AlertDialog title: "グループを削除"
+ AlertDialog description: 「{label}」を削除しますか？
+ Confirm button text: "削除" / "削除中..."

##### Gotchas
+ グループに本が登録されている場合、説明文に冊数と「本自体は削除されませんが、グループの紐付けが解除されます。」が追加表示される
+ 削除後、Cloud Functions が該当グループに属していた全ての本の `groups` から label を除去する

---

#### 3.5 グループの共有
グループを外部に公開共有するリンクを生成する。

##### How a user gets there
+ Click path: `/groups` → グループカードの Share2 アイコンボタン

##### How the control adapter drives it
+ Click Share2 icon → ShareGroupDialog opens
+ **未共有の場合**: Click "共有リンクを生成" → 共有リンクが作成されクリップボードにコピーされる
+ **共有済みの場合**: Copy icon button でリンクコピー、"共有を解除" で共有削除

##### Stable selectors
+ Dialog title: "グループを共有"
+ Dialog description: 「{label}」の共有設定
+ Generate button text: "共有リンクを生成" / "作成中..."
+ Unshare button text: "共有を解除" / "解除中..."
+ Copy button: variant="outline" size="icon" (Copy icon)
+ Close button text: "閉じる"

##### Gotchas
+ 共有リンク生成時にトースト「リンクをコピーしました」が表示される
+ 共有されるのはタイトル・著者・表紙画像・タグのみ（メモ等の個人情報は含まない）

---

### 4. タグ管理

#### 4.1 タグ一覧
タグの編集・削除を管理する。

##### How a user gets there
+ Click path: サイドナビ → 「タグ管理」リンク（`/tags`）

##### How the control adapter drives it
+ Navigate to `/tags` should display tag cards with label, count, and action buttons

##### Stable selectors
+ Page heading: "タグ管理"
+ Empty state text: "タグがありません。本を登録する際にタグを追加すると、ここに表示されます。"
+ Per-tag: TagIcon + label text + "{count}冊" badge + Pencil / Trash2 icon buttons

##### Gotchas
+ タグの新規作成ボタンはない。タグは本の登録・編集時に追加すると Cloud Functions が自動作成する

---

#### 4.2 タグの編集
タグ名を変更する。

##### How a user gets there
+ Click path: `/tags` → タグカードの Pencil アイコンボタン

##### How the control adapter drives it
+ Click Pencil icon → EditTagDialog opens
+ Modify `#edit-tag-label`
+ Click "更新" to submit

##### Stable selectors
+ Dialog title: "タグを編集"
+ `id="edit-tag-label"` — タグ名 input
+ Help text: "{count}冊の本のタグが更新されます"
+ Submit button text: "更新" / "更新中..."

---

#### 4.3 タグの削除
タグを削除する。

##### How a user gets there
+ Click path: `/tags` → タグカードの Trash2 アイコンボタン

##### How the control adapter drives it
+ Click Trash2 icon → DeleteTagAlertDialog opens
+ Click "削除" to confirm

##### Stable selectors
+ AlertDialog title: "タグを削除"
+ AlertDialog description: 「{label}」を削除しますか？
+ Confirm button text: "削除" / "削除中..."

##### Gotchas
+ タグに本が登録されている場合、説明文に冊数と「本自体は削除されませんが、タグの紐付けが解除されます。」が追加表示される
+ 削除後、Cloud Functions が該当タグを持つ全ての本の `tags` から label を除去する

---

### 5. 設定

#### 5.1 プロフィール設定
共有ページ等で表示される表示名を設定する。

##### How a user gets there
+ Click path: ヘッダー右の Settings アイコン → `/settings` → 「プロフィール」セクション

##### How the control adapter drives it
+ Navigate to `/settings`
+ Fill display name input (placeholder: "表示名")
+ Click "保存" button

##### Stable selectors
+ Section heading: "プロフィール"
+ Input placeholder: "表示名"
+ Save button text: "保存"

---

#### 5.2 テーマ切り替え
ライト / ダーク / デバイスに合わせるの3モードを切り替える。

##### How a user gets there
+ Click path: `/settings` → 「テーマ」セクション

##### How the control adapter drives it
+ Click one of three buttons: "ライト" / "ダーク" / "デバイスに合わせる"
+ Active button is highlighted with primary variant

##### Stable selectors
+ Section heading: "テーマ"
+ Button texts: "ライト", "ダーク", "デバイスに合わせる"

##### Gotchas
+ デフォルトは `dark`
+ localStorage key: `"theme"`

---

#### 5.3 読了済み非表示設定
読了済みの本を一覧から除外する。

##### How a user gets there
+ Click path: `/settings` → 「本の表示」セクション

##### How the control adapter drives it
+ Toggle checkbox "読了済みの本を一覧に表示しない"

##### Stable selectors
+ Section heading: "本の表示"
+ Checkbox label: "読了済みの本を一覧に表示しない"

##### Gotchas
+ localStorage key: `"hideReadBooks"`
+ ホーム画面・タグフィルタ・グループフィルタのすべてに適用される

---

#### 5.4 ログアウト
アプリからログアウトする。

##### How a user gets there
+ Click path: `/settings` → 「アカウント」セクション → 「ログアウト」ボタン

##### How the control adapter drives it
+ Click "ログアウト" button (variant="outline") should clear session and redirect to `/login`

##### Stable selectors
+ Section heading: "アカウント"
+ Button text: "ログアウト"

---

### 6. 共有グループ閲覧（パブリック）

#### 6.1 共有グループページ
共有リンクからグループの本一覧を認証なしで閲覧する。

##### How a user gets there
+ Click path: 共有リンク `/shared/{sharedGroupId}` を直接開く（認証不要）

##### How the control adapter drives it
+ Navigate to `/shared/{sharedGroupId}` should display:
  - Header: "BookPoolContexts" + "このアプリを使ってみる" button (links to `/login`)
  - Heading: "{ownerName} の {groupLabel}" or "{groupLabel}"
  - Grid of SharedBookCard (cover image, tags only — no interactive elements)

##### Stable selectors
+ Header text: "BookPoolContexts"
+ CTA button text: "このアプリを使ってみる"
+ Empty state text: "このグループにはまだ本が登録されていません"

##### Gotchas
+ 存在しない `sharedGroupId` の場合はエラー表示
+ メモ・foundBy・location・purchasedBy・読了フラグなどの個人情報は表示されない
+ SharedBookCard はクリック不可（読み取り専用）

---

### 7. PWA インストール

#### 7.1 アプリのインストール
ホーム画面にアプリをインストールする。

##### How a user gets there
+ Click path: サイドナビ下部 → 「アプリをインストール」ボタン（PWA インストール可能な環境でのみ表示）

##### How the control adapter drives it
+ Click "アプリをインストール" button should trigger native PWA install prompt

##### Stable selectors
+ Button text: "アプリをインストール"

##### Gotchas
+ `beforeinstallprompt` イベントが発火しない環境（既にインストール済み、非対応ブラウザ等）ではボタン自体が表示されない

---

### 8. ナビゲーション

#### 8.1 サイドナビ
アプリ全体のナビゲーションを提供するサイドバー。

##### How a user gets there
+ Click path: 常に画面左に表示（アイコン折りたたみ可）。ヘッダーの SidebarTrigger で展開/折りたたみ

##### How the control adapter drives it
+ Click SidebarTrigger (`aria-label="Toggle Sidebar"`) to expand/collapse
+ Click navigation items to navigate

##### Stable selectors
+ `aria-label="Toggle Sidebar"` — サイドバー展開トグル
+ "すべて" — 全件表示リンク
+ "グループ管理" — `/groups` リンク
+ "タグ管理" — `/tags` リンク
+ Active item: `data-[active=true]`

##### Sub-features
+ 文脈グループセクション: 各グループ名 + 冊数バッジ
+ タグセクション: 各タグ名 + 冊数バッジ
+ PWA インストールボタン（条件付き表示）

#### 8.2 ヘッダー
アプリ上部の固定ヘッダー。

##### How a user gets there
+ Click path: 認証後の全ページで画面上部に常時表示

##### Stable selectors
+ "BookPoolContexts" text → `/` リンク
+ Settings icon (Cog) → `/settings` リンク
+ `aria-label="Toggle Sidebar"` — SidebarTrigger

---

## Keyboard Shortcuts

| Key | Condition | Action |
|-----|-----------|--------|
| `c` | ホーム画面で、INPUT/TEXTAREA/contentEditable にフォーカスがないとき | 本の登録モーダルを開く |
