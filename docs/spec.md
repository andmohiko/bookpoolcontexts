# 📚 BookPoolContexts 要件定義書

**読みたい本の管理アプリケーション**

---

## 1. プロジェクト概要

### 1.1 背景と目的

読みたい本が多くなると、次にどの本を読めばいいかわからなくなることがあります。どこかで見かけただけの本がある日急に読みたくなることもあり、ちょっとでもいいと思った本は忘れないようにメモしておきたいものです。

本プロジェクトでは、読みたい本を登録・管理し、ジャンルや文脈ごとにグルーピングできるアプリケーションを開発します。読書は自分の中の文脈を増やす作業であり、文脈ごとに本を仕分け、ある文脈について勉強したくなったらそのグループの本を読んでいく、という読書スタイルをサポートします。

### 1.2 プロジェクトスコープ

| 項目 | 内容 |
|------|------|
| プロジェクト名 | BookPoolContexts |
| 開発期間 | Phase 1: 4週間（MVP） |
| 対象ユーザー | 読書好きな個人ユーザー |
| プラットフォーム | Webアプリケーション（SPA、レスポンシブ対応） |

### 1.3 用語定義

| 用語 | 定義 |
|------|------|
| Book | 読みたい本として登録された1冊のデータ |
| Group | 文脈やテーマごとに本をまとめるグルーピング単位（文脈グループ） |
| Tag | 本のジャンル（小説、新書、技術書など）を分類するラベル |
| Location | 本が読める場所（図書館、ブックオフ、本屋、Kindle Unlimitedなど） |
| PurchasedBy | 本の購入場所・手段（物理本、Kindle、オフィスなど） |
| SharedGroup | グループを外部に公開共有するためのデータ。共有リンクを通じて認証不要で閲覧可能 |
| ScrapingStatus | Amazonからの情報取得状態を表すステータス（`scraping` / `completed` / `failed` / `skipped`） |
| UpdatedBy | Bookドキュメント更新の操作主（`user` / `trigger`）。連鎖トリガー防止のために使用する |

---

## 2. 機能要件

### 2.1 認証機能

#### FR-AUTH-001: Googleログイン

| 項目 | 内容 |
|------|------|
| 概要 | Firebase AuthenticationによるGoogleアカウントログイン |
| 優先度 | 必須 |

**詳細要件:**
- Firebase Authenticationを使用したGoogleアカウントでのログイン機能を提供する
- 未ログイン状態ではログイン画面のみを表示する
- ログイン成功後、自動的に本の一覧画面へ遷移する
- ログアウト機能を提供し、セッションを完全にクリアする

#### FR-AUTH-002: セッション管理

| 項目 | 内容 |
|------|------|
| 概要 | ログイン状態の永続化と管理 |
| 優先度 | 必須 |

**詳細要件:**
- ログイン状態をブラウザセッションで維持する
- セッション有効期限は30日間とする
- 複数デバイスからの同時ログインを許可する
- TanStack Routerのルートガードで認証状態を検証する

---

### 2.2 本の管理機能

#### FR-BOOK-001: 本の登録

| 項目 | 内容 |
|------|------|
| 概要 | 読みたい本の新規登録機能 |
| 優先度 | 必須 |

**入力フィールド仕様:**

| フィールド名 | 必須/任意 | データ型 | バリデーション |
|-------------|----------|---------|---------------|
| タイトル (title) | 自動取得 | string \| null | Cloud Functionsが自動取得。登録時はnull |
| 著者 (author) | 自動取得 | string \| null | Cloud Functionsが自動取得。登録時はnull |
| 表紙画像URL (coverImageUrl) | 自動取得 | string \| null | Cloud Functionsが自動取得。登録時はnull |
| ページ数 (pages) | 自動取得 | number \| null | Cloud Functionsが自動取得。登録時はnull |
| AmazonURL (amazonUrl) | 条件付き必須 | string | URL または amazonHtml のいずれかが必須。入力時は有効なURL形式 |
| AmazonページのHTML (amazonHtml) | 条件付き必須 | string | 登録画面専用のフォーム項目。DBには保存しない。詳細は FR-BOOK-002 参照 |
| タグ (tags) | 任意 | string[] | 各タグ50文字以下、最大10個。`normalizeTagLabel` で正規化・重複除去される |
| どこで見つけたか (foundBy) | 任意 | string | 500文字以下 |
| どこで読めるか (location) | 任意 | string | 200文字以下 |
| 購入場所 (purchasedBy) | 任意 | string[] | 選択肢: 物理本, Kindle, オフィス |
| メモ (note) | 任意 | string | 2000文字以下 |
| グループ (groups) | 任意 | string[] | 既存グループ label の配列（label ベースで管理） |
| 読了フラグ (isRead) | 任意 | boolean | 登録時点で読了済みとしてマークすることも可能 |

**処理フロー:**
1. ユーザーがモーダル上で「AmazonのURL」または「AmazonページのHTML」と、タグ・グループ等のメタ情報を入力する（どちらか一方あれば登録可能）
2. クライアント側で Zod によるバリデーション（URL 形式・HTML 有無の相互補完チェック）
3. `amazonHtml` が入力されていれば、クライアント側で `parseAmazonHtml` により title / author / coverImageUrl / pages を抽出し、`scrapingStatus: 'skipped'` として保存する（Cloud Functions はスクレイピングを実行しない）
4. `amazonHtml` が入力されていなければ、title / author / coverImageUrl / pages は `null`、`scrapingStatus: 'scraping'` として保存する（Cloud Functions が後続で自動取得）
5. `updatedBy: 'user'` を明示して Firestore に保存する
6. モーダルを閉じ、一覧画面で楽観的にカード表示される
7. Cloud Functions の `onCreateBook` トリガーが、`scrapingStatus !== 'skipped'` の場合に限り Amazon 詳細ページをスクレイピングして結果を反映する
8. 同じ `onCreateBook` トリガーが、入力された tags/groups の count をサブコレクションに同期する（不在のタグは新規作成）

#### FR-BOOK-002: AmazonURLからの本情報自動取得

| 項目 | 内容 |
|------|------|
| 概要 | 本の登録後にAmazon詳細ページからタイトル・著者名・表紙画像URL・ページ数を自動取得する機能 |
| 優先度 | 必須 |

**詳細要件:**
- Cloud Functions の `onCreateBook` トリガーが、保存された `amazonUrl` を使って Amazon 詳細ページをスクレイピングする
- タイトル（title）、著者名（author）、表紙画像URL（coverImageUrl）、ページ数（pages）を自動取得し、Firestore の該当 Book ドキュメントを更新する
- 取得成否に応じて `scrapingStatus` を遷移させる：
  - 登録直後は `scraping`
  - 少なくとも1つのフィールドが取得できれば `completed`
  - すべて取得できなかった場合は `failed`
  - クライアントが HTML から取得済みで登録した場合は `skipped`（スクレイピング自体を実行しない）
- 取得処理の更新は `updatedBy: 'trigger'` を明示して保存し、`onUpdateBook` トリガーの連鎖発火を防ぐ
- 取得できなかったフィールドは `null` のまま維持する（エラーにはしない）
- スクレイピングには puppeteer-core + @sparticuz/chromium を使用する（Cloud Functions のメモリは 2GiB 設定）
- Amazon 検索 API（POST /books/search）は廃止。クライアント側での検索は行わない

**HTML 直接入力によるフォールバック:**
- スクレイピングが Amazon 側のブロックなどで失敗することを考慮し、本の登録モーダルには「Amazon 詳細ページのHTML」フィールドを用意する
- ユーザーがブラウザで Amazon ページを開き「ページのソース表示」から取得した HTML を貼り付けると、クライアントの `parseAmazonHtml` ユーティリティがタイトル・著者・表紙画像URL・ページ数を抽出する
- HTML から取得できた情報をそのまま Firestore に保存し、`scrapingStatus: 'skipped'` とする。Cloud Functions 側のスクレイピングは実行されない

#### FR-BOOK-006: 本の情報再取得（リフェッチ）

| 項目 | 内容 |
|------|------|
| 概要 | スクレイピング失敗状態の本について、ユーザーの手動操作で再度 Amazon から情報を取得し直す機能 |
| 優先度 | 必須 |

**詳細要件:**
- 一覧画面の BookCard 上で `scrapingStatus === 'failed'` の本は「取得失敗」バッジと再取得ボタンを表示する
- 再取得ボタンを押すと、クライアントは該当 Book の `scrapingStatus` を `'scraping'` に更新する（`updatedBy: 'user'`）
- Cloud Functions の `onUpdateBook` トリガーが「`scrapingStatus` が `'scraping'` に遷移した」ことを検知し、`scrapeAndUpdateBook` を実行して結果に応じて `completed` / `failed` に再遷移させる

#### FR-BOOK-003: 本の編集

| 項目 | 内容 |
|------|------|
| 概要 | 登録済みの本の情報を編集する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 一覧画面の BookCard をクリックすると BookEditModal が開き、タグ・グループ・foundBy・location・購入場所・メモ・読了フラグを編集できる
- title / author / coverImageUrl / pages / amazonUrl はスクレイピング結果に依存するためユーザー編集の対象外（モーダル上部に表紙・タイトル・著者を表示のみ）
- 更新日時（updatedAt）を自動更新する
- `updatedBy: 'user'` を明示して保存する（トリガーによる更新と区別するため）
- タグ・グループの変更時はカウントを Cloud Functions（`onUpdateBook`）が差分同期する

#### FR-BOOK-004: 本の削除

| 項目 | 内容 |
|------|------|
| 概要 | 登録済みの本を削除する機能 |
| 優先度 | 必須 |

**詳細要件:**
- BookEditModal から「削除」ボタンで AlertDialog を表示し、確認後に本を削除する
- 削除は物理削除（復元不可）とする
- 削除後はモーダルを閉じ、一覧画面に即時反映される
- 関連するタグ・グループのカウントは Cloud Functions（`onDeleteBook`）が自動同期する。`count` が 0 になるタグはドキュメント自体を削除する

#### FR-BOOK-005: 読了フラグ

| 項目 | 内容 |
|------|------|
| 概要 | 読み終わった本に読了マークをつける機能 |
| 優先度 | 必須 |

**詳細要件:**
- 本の登録モーダル・編集モーダルの両方から読了フラグをトグルできる
- 読了済みの本は BookCard の右上に緑色のチェックバッジで視覚的に区別される
- 設定画面で「読了済みの本を一覧に表示しない」をトグルでき、設定は localStorage で永続化される（FR-SETTINGS-002）

---

### 2.3 一覧・フィルタリング機能

#### FR-LIST-001: 本の一覧表示

| 項目 | 内容 |
|------|------|
| 概要 | ログイン後のデフォルト画面 |
| 優先度 | 必須 |

**詳細要件:**
- ログイン後のデフォルト画面として本の一覧を表示する
- 登録日時の降順（最新順）でソートする
- カードグリッド表示（モバイル 3 列、sm 4 列、md 5 列、lg 6 列）で、1 カード = 1 冊
- 各 BookCard は表紙画像・タグ・読了バッジ・スクレイピング状態（取得中スピナー／取得失敗リトライボタン）を表示する
- Firestore の `onSnapshot` によるリアルタイム購読でデータを同期する（上限 100 件）
- 画面右下の FAB から本の登録モーダルを開ける。キーボードショートカット `c` でも同様にモーダルを開ける

#### FR-LIST-002: タグによるフィルタリング

| 項目 | 内容 |
|------|------|
| 概要 | タグで本を絞り込む機能 |
| 優先度 | 必須 |

**詳細要件:**
- サイドナビ（SideNav）にタグ一覧を件数付きで表示する
- ホーム画面上部にもタグチップのフィルタバーを表示する
- タグを選択すると URL の search params `?tag=<label>` が更新され、そのタグが付いた本のみ表示する
- 現在選択中のタグはハイライト表示される

#### FR-LIST-003: グループビュー

| 項目 | 内容 |
|------|------|
| 概要 | グループ単位で本を閲覧する機能 |
| 優先度 | 必須 |

**詳細要件:**
- サイドナビ（SideNav）にグループ一覧を件数付きで表示する（「文脈グループ」セクション）
- グループを選択するとホーム画面に `?group=<label>` が付与され、そのグループに属する本の一覧を表示する
- ホーム画面とは別にグループ管理画面（`/groups`）を提供し、グループの新規作成・編集・削除ができる
- グループフィルタ中でも読了フラグによる絞り込みは有効

#### FR-LIST-004: 読了済みの本の非表示設定

| 項目 | 内容 |
|------|------|
| 概要 | 読了済みの本を一覧から除外する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 設定画面から「読了済みの本を一覧に表示しない」トグルを切り替えられる
- トグル状態は localStorage（`hideReadBooks`）に永続化される
- ホーム画面・タグフィルタ・グループフィルタのすべてで、設定が ON の場合は `isRead === true` の本を一覧から除外する

---

### 2.4 グループ管理機能

#### FR-GROUP-001: グループの作成

| 項目 | 内容 |
|------|------|
| 概要 | 本をまとめるグループを作成する機能 |
| 優先度 | 必須 |

**入力フィールド仕様:**

| フィールド名 | 必須/任意 | データ型 | バリデーション |
|-------------|----------|---------|---------------|
| グループ名 (label) | **必須** | string | 1文字以上、100文字以下 |

**詳細要件:**
- グループ名を入力して新規グループを作成できる
- 作成時のカウントは0とする

#### FR-GROUP-002: グループの編集・削除

| 項目 | 内容 |
|------|------|
| 概要 | 既存グループの名前変更・削除機能 |
| 優先度 | 必須 |

**詳細要件:**
- グループ名を変更できる
- グループを削除できる（確認ダイアログあり）
- グループ削除時、そのグループに属していた本のgroupsフィールドからグループIDを除去する

#### FR-GROUP-003: 本のグループへの追加・除去

| 項目 | 内容 |
|------|------|
| 概要 | 既存の本をグループに追加・除去する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 本の登録モーダル・編集モーダルの GroupSelectDropdown からグループを追加・除去できる
- 1 冊の本は複数のグループに所属できる
- グループ側の `count` フィールドは Cloud Functions の `onCreateBook` / `onUpdateBook` / `onDeleteBook` / `onDeleteGroup` トリガーが差分で自動同期する
- グループが削除された場合、`onDeleteGroup` トリガーがそのグループに属していた全ての本の `groups` フィールドから該当 label を除去する

---

### 2.5 グループ共有機能

#### FR-SHARE-001: グループの共有リンク生成

| 項目 | 内容 |
|------|------|
| 概要 | 文脈グループを外部に公開共有するリンクを生成する機能 |
| 優先度 | 必須 |

**詳細要件:**
- グループ管理画面（`/groups`）の各グループカードに「共有」ボタンを設置する
- 共有ボタンを押すと、クライアントが Firestore の `sharedGroups` トップレベルコレクションにドキュメントを直接作成する
- 作成時にグループに属する本の公開情報（タイトル・著者・表紙画像URL・タグ）をスナップショットとして `sharedGroups` ドキュメントに保存する
- 作成時にユーザーの `displayName` を `ownerName` として `sharedGroups` ドキュメントに保存する
- 共有リンクの形式は `/shared/{sharedGroupId}` とする
- 生成された共有リンクをクリップボードにコピーする機能を提供する
- すでに共有済みのグループは「共有リンクをコピー」ボタンと「共有を解除」ボタンを表示する

#### FR-SHARE-002: 共有グループの閲覧

| 項目 | 内容 |
|------|------|
| 概要 | 共有リンクを開いた外部ユーザーがグループの本一覧を閲覧できる機能 |
| 優先度 | 必須 |

**詳細要件:**
- `/shared/{sharedGroupId}` は認証不要でアクセスできるパブリックページとする
- 共有ページには `ownerName` が存在する場合「{ownerName} の {groupLabel}」、存在しない場合はグループ名のみを見出しとして表示し、所属する本のカードグリッドを表示する
- 各カードに表示する情報はタイトル・著者・表紙画像・タグのみとする（メモ・foundBy・location・purchasedBy・読了フラグなどの個人情報は含めない）
- 共有ページのヘッダーにはアプリ名とロゴを表示し、「このアプリを使ってみる」リンクでログイン画面へ誘導する

#### FR-SHARE-003: 共有グループの自動同期

| 項目 | 内容 |
|------|------|
| 概要 | 元グループや所属する本が更新・削除された際に、共有グループのスナップショットを自動同期する機能 |
| 優先度 | 必須 |

**詳細要件:**
- グループの label が変更された場合、Cloud Functions の `onUpdateGroup` トリガーが該当する `sharedGroups` ドキュメントの `groupLabel` を同期する
- グループが削除された場合、Cloud Functions の `onDeleteGroup` トリガーが該当する `sharedGroups` ドキュメントも削除する
- グループに属する本が追加・更新・削除された場合、Cloud Functions の `onCreateBook` / `onUpdateBook` / `onDeleteBook` トリガーが、その本が属するグループに紐づく `sharedGroups` ドキュメントの `books` 配列を最新状態に再構築する
- `books` 配列の再構築は、該当グループの label を `groups` に含む全 Book を取得し、公開情報（title, author, coverImageUrl, tags, amazonUrl）のみを抽出して上書きする

#### FR-SHARE-004: 共有の解除

| 項目 | 内容 |
|------|------|
| 概要 | 共有済みグループの共有を手動で解除する機能 |
| 優先度 | 必須 |

**詳細要件:**
- グループ管理画面から共有済みグループの「共有を解除」ボタンを押すと確認ダイアログを表示し、確認後にクライアントが Firestore から `sharedGroups` ドキュメントを直接削除する
- 共有解除後、共有リンクにアクセスすると「このページは公開されていません」と表示する

---

### 2.6 タグ管理機能

#### FR-TAG-001: タグの作成

| 項目 | 内容 |
|------|------|
| 概要 | 本に付けるタグを管理する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 本の登録・編集モーダルでタグを自由入力で追加できる（Enter キーで確定）
- TagSuggestionDropdown により、入力中のテキストにマッチする既存タグをオートコンプリートで表示する
- タグ label は `normalizeTagLabel`（前後空白除去・Unicode NFC 正規化）で正規化され、重複は弾く
- タグの Firestore ドキュメントはクライアントからは作成しない。Cloud Functions の `onCreateBook` / `onUpdateBook` トリガーが、本の保存時に未知のタグを `count: 1` で新規作成する（Firestore ルールでもクライアントからの `create` を禁止している）

#### FR-TAG-002: タグの編集・削除

| 項目 | 内容 |
|------|------|
| 概要 | 既存タグの名前変更・削除機能 |
| 優先度 | 必須 |

**詳細要件:**
- 専用のタグ管理画面（`/tags`）を提供する
- タグ label を変更でき、変更時は関連する全ての本の `tags` フィールドも一括更新する
- タグを削除でき、Cloud Functions の `onDeleteTag` トリガーが関連する全ての本からその label を除去する
- タグの `count` フィールドは Cloud Functions（`onCreateBook` / `onUpdateBook` / `onDeleteBook`）が差分で自動同期する。`count` が 0 になるタグはドキュメント自体が削除される

---

### 2.7 設定機能

#### FR-SETTINGS-001: テーマモードの切り替え

| 項目 | 内容 |
|------|------|
| 概要 | ライト／ダーク／デバイスに合わせる の 3 モードを切り替え |
| 優先度 | 必須 |

**詳細要件:**
- 設定画面にてテーマモードを選択できる
- 選択値は localStorage に永続化され、アプリ起動時に復元される
- `auto` モードの場合は OS の `prefers-color-scheme` に従う

#### FR-SETTINGS-002: 読了済みの本の非表示設定

FR-LIST-004 を参照。

#### FR-SETTINGS-003: ログアウト

設定画面にログアウトボタンを設置し、Firebase Authentication のセッションをクリアする。

#### FR-SETTINGS-004: 表示名の設定

| 項目 | 内容 |
|------|------|
| 概要 | グループ共有ページなどで表示されるユーザー名を設定する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 設定画面に「表示名」入力フィールドを追加する
- 入力値は users コレクションの `displayName` フィールドに保存する
- 未設定の場合は空文字とする
- 共有グループ閲覧ページで「{displayName} の {グループ名}」のように表示される

---

### 2.8 PWA 対応

#### FR-PWA-001: インストール可能な PWA としての提供

| 項目 | 内容 |
|------|------|
| 概要 | Webアプリをホーム画面にインストール可能にする |
| 優先度 | 必須 |

**詳細要件:**
- Service Worker（`sw.js`）とマニフェスト、アイコン（logo192.png / logo512.png）を提供する
- `beforeinstallprompt` イベントをフックしてインストール可能な環境ではサイドナビに「アプリをインストール」ボタンを表示する
- インストールボタン押下で `prompt()` を呼び出しネイティブのインストールフローを起動する

---

### 2.9 キーボードショートカット

| ショートカット | 動作 |
|---------------|------|
| `c` | 本の登録モーダルを開く（登録モーダルが開いていないとき） |

---

## 3. 非機能要件

### 3.1 パフォーマンス要件

| 項目 | 目標値 | 測定方法 |
|------|--------|---------|
| 初期ページ読み込み | 3秒以内 | LCP (Largest Contentful Paint) |
| 本の一覧表示 | 1秒以内 | Firestoreクエリ〜表示まで |
| 本の保存 | 1秒以内 | バリデーション〜保存完了まで |
| 同時接続ユーザー数 | 100人 | Phase 1目標 |
| バンドルサイズ | 200KB以下 | gzip圧縮後、初期ロード |

### 3.2 セキュリティ要件

#### NFR-SEC-001: 認証・認可

- Firebase Authenticationによる認証を必須とする
- Firestoreセキュリティルールにより、ユーザーは自身のデータのみアクセス可能

#### NFR-SEC-002: データ保護

- 通信はHTTPS（TLS 1.3）を使用する
- Firestoreのデータは保存時に自動暗号化される

### 3.3 可用性・信頼性

| 項目 | 目標値 |
|------|--------|
| 目標稼働率 | 99.5%（月間ダウンタイム約3.6時間以内） |
| SLA | Firebase/GCPのSLAに準拠 |
| データバックアップ | Firestoreの自動バックアップ（日次） |

### 3.4 スケーラビリティ

| 項目 | 初期 | 将来 |
|------|------|------|
| ユーザー数 | 1,000人 | 10,000人 |
| 本の登録数/ユーザー | 最大5,000件 | - |
| ストレージ | Firestore無料枠 | 自動スケール |

---

## 4. データモデル

### 4.1 Firestoreコレクション構造

```
firestore/
├── users/
│   └── {uid}/
│       ├── createdAt: Timestamp
│       ├── displayName: string              // 表示名（共有ページ等で使用）
│       ├── email: string
│       ├── updatedAt: Timestamp
│       ├── books/  (サブコレクション)
│       │   └── {bookId}/
│       │       ├── amazonUrl: string
│       │       ├── author: string | null
│       │       ├── coverImageUrl: string | null
│       │       ├── createdAt: Timestamp
│       │       ├── foundBy: string
│       │       ├── groups: string[]         // group label の配列
│       │       ├── isRead: boolean
│       │       ├── location: string
│       │       ├── note: string
│       │       ├── pages: number | null
│       │       ├── purchasedBy: string[]
│       │       ├── scrapingStatus: 'scraping' | 'completed' | 'failed' | 'skipped'
│       │       ├── tags: string[]           // tag label の配列
│       │       ├── title: string | null
│       │       ├── updatedAt: Timestamp
│       │       └── updatedBy: 'user' | 'trigger'
│       ├── groups/  (サブコレクション)
│       │   └── {groupId}/
│       │       ├── count: number
│       │       ├── createdAt: Timestamp
│       │       ├── label: string
│       │       └── updatedAt: Timestamp
│       └── tags/  (サブコレクション)
│           └── {tagId}/
│               ├── count: number
│               ├── createdAt: Timestamp
│               ├── label: string           // normalizeTagLabel で正規化済み
│               └── updatedAt: Timestamp
├── sharedGroups/
│   └── {sharedGroupId}/
│       ├── uid: string                      // 共有元ユーザーの UID
│       ├── groupId: string                  // 元の group ドキュメントID
│       ├── groupLabel: string               // グループ名
│       ├── ownerName: string                // 共有元ユーザーの表示名
│       ├── books: SharedBook[]              // 本の公開情報スナップショット
│       ├── createdAt: Timestamp
│       └── updatedAt: Timestamp
```

### 4.2 users コレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| uid | string | Firebase Auth UID（ドキュメントID） |
| createdAt | Timestamp | 作成日時 |
| displayName | string | 表示名（共有ページ等で使用。未設定の場合は空文字） |
| email | string | 認証に使用したメールアドレス |
| updatedAt | Timestamp | 更新日時 |

### 4.3 books サブコレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| bookId | string | 自動生成ID（ドキュメントID） |
| amazonUrl | string | Amazon詳細ページのURL（ユーザー入力。HTML 直接入力時は空文字の場合あり） |
| author | string \| null | 本の著者（Cloud Functions もしくはクライアントの `parseAmazonHtml` が取得、初期値 null） |
| coverImageUrl | string \| null | 表紙の画像URL（Cloud Functions もしくは `parseAmazonHtml` が取得、初期値 null） |
| createdAt | Timestamp | 登録日時 |
| foundBy | string | どこで見つけたか（誰に勧められたかなど） |
| groups | string[] | 所属するグループの label 配列 |
| isRead | boolean | 読了かどうか |
| location | string | どこで読めるか（図書館、ブックオフ、本屋、Kindle Unlimitedなど） |
| note | string | 自由記述のメモ |
| pages | number \| null | ページ数（Cloud Functions もしくは `parseAmazonHtml` が取得、初期値 null） |
| purchasedBy | string[] | 購入場所（物理本、Kindle、オフィス） |
| scrapingStatus | `'scraping' \| 'completed' \| 'failed' \| 'skipped'` | Amazon情報取得の進行状態 |
| tags | string[] | タグ label の配列（`normalizeTagLabel` で正規化） |
| title | string \| null | 本のタイトル（Cloud Functions もしくは `parseAmazonHtml` が取得、初期値 null） |
| updatedAt | Timestamp | 更新日時 |
| updatedBy | `'user' \| 'trigger'` | 直近の更新操作主。Firestore ルールではクライアント書き込み時 `'user'` のみ許可する |

### 4.4 groups サブコレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| groupId | string | 自動生成ID（ドキュメントID） |
| count | number | グループに登録されている本の数（Cloud Functions により差分同期） |
| createdAt | Timestamp | 作成日時 |
| label | string | グループ名（本の `groups` 配列で参照されるキー） |
| updatedAt | Timestamp | 更新日時 |

### 4.5 tags サブコレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| tagId | string | 自動生成ID（ドキュメントID） |
| count | number | タグに登録されている本の数（Cloud Functions により差分同期） |
| createdAt | Timestamp | 作成日時 |
| label | string | タグ名（`normalizeTagLabel` で正規化済み） |
| updatedAt | Timestamp | 更新日時 |

> ℹ️ `tags` コレクションのドキュメントはクライアントからは作成しない。Cloud Functions の Admin SDK 経由でのみ作成される（Firestore ルールでクライアント `create` を禁止）。

### 4.6 sharedGroups コレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| sharedGroupId | string | 自動生成ID（ドキュメントID） |
| uid | string | 共有元ユーザーの Firebase Auth UID |
| groupId | string | 元の group ドキュメントID |
| groupLabel | string | グループ名（スナップショット時点） |
| ownerName | string | 共有元ユーザーの表示名（スナップショット時点。未設定の場合は空文字） |
| books | SharedBook[] | 本の公開情報の配列（スナップショット） |
| createdAt | Timestamp | 共有作成日時 |
| updatedAt | Timestamp | 共有更新日時 |

**SharedBook 型（books 配列の各要素）:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| title | string \| null | 本のタイトル |
| author | string \| null | 著者名 |
| coverImageUrl | string \| null | 表紙画像URL |
| tags | string[] | タグ label の配列 |
| amazonUrl | string | Amazon 詳細ページの URL |

> ℹ️ `sharedGroups` はトップレベルコレクションとする（ユーザーのサブコレクションではない）。認証不要で読み取り可能にするため。書き込みは Cloud Functions（Firestore トリガー）および認証済みクライアントからのみ許可する。

### 4.7 TypeScript 型定義

共通型は `packages/common/src/entities/` に配置し、`@bookpoolcontexts/common` として web と functions の両方から参照する。Entity 型と DTO 型を分離し、タイムスタンプは Entity 側では `Date`、DTO 側では `FieldValue` で表現する（Firestore 実装ルールに準拠）。

```typescript
// packages/common/src/entities/Book.ts
import type { FieldValue } from 'firebase/firestore'

export const bookCollection = 'books' as const
export type BookId = string

export type UpdatedBy = 'trigger' | 'user'
export type ScrapingStatus = 'scraping' | 'completed' | 'failed' | 'skipped'

export type Book = {
  bookId: BookId
  amazonUrl: string
  author: string | null
  coverImageUrl: string | null
  createdAt: Date
  foundBy: string
  groups: string[]
  isRead: boolean
  location: string
  note: string
  pages: number | null
  purchasedBy: string[]
  scrapingStatus: ScrapingStatus
  tags: string[]
  title: string | null
  updatedAt: Date
  updatedBy: UpdatedBy
}

export type CreateBookDto = Omit<Book, 'bookId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

export type UpdateBookDto = {
  amazonUrl?: Book['amazonUrl']
  author?: Book['author']
  coverImageUrl?: Book['coverImageUrl']
  foundBy?: Book['foundBy']
  groups?: Book['groups']
  isRead?: Book['isRead']
  location?: Book['location']
  note?: Book['note']
  pages?: Book['pages']
  purchasedBy?: Book['purchasedBy']
  scrapingStatus?: Book['scrapingStatus']
  tags?: Book['tags']
  title?: Book['title']
  updatedAt: FieldValue
  updatedBy: UpdatedBy
}
```

Group / Tag / User も同様のパターンで `groupId` / `tagId` / `uid` を ID フィールドとして持ち、CreateDto / UpdateDto を定義する。Cloud Functions 側（firebase-admin）用には `UpdateBookDtoFromAdmin` / `UpdateGroupDtoFromAdmin` / `CreateTagDtoFromAdmin` / `UpdateTagDtoFromAdmin` などの Admin 用 DTO を別途定義している。

```typescript
// packages/common/src/entities/SharedGroup.ts
import type { FieldValue } from 'firebase/firestore'

export const sharedGroupCollection = 'sharedGroups' as const
export type SharedGroupId = string

export type SharedBook = {
  title: string | null
  author: string | null
  coverImageUrl: string | null
  tags: string[]
  amazonUrl: string
}

export type SharedGroup = {
  sharedGroupId: SharedGroupId
  uid: string
  groupId: string
  groupLabel: string
  ownerName: string
  books: SharedBook[]
  createdAt: Date
  updatedAt: Date
}

export type CreateSharedGroupDto = Omit<SharedGroup, 'sharedGroupId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

export type UpdateSharedGroupDtoFromAdmin = {
  groupLabel?: string
  ownerName?: string
  books?: SharedBook[]
  updatedAt: AdminFieldValue
}
```

---

## 5. 画面設計

### 5.1 画面一覧

| 画面ID | 画面名 | パス | 認証 | 概要 |
|--------|--------|------|------|------|
| SCR-001 | ログイン画面 | `/login` | 不要 | Google ログインボタンを表示 |
| SCR-002 | 本の一覧画面（ホーム） | `/` | 必要 | 登録した本のカードグリッド表示。`?tag=` / `?group=` でフィルタ |
| SCR-003 | グループ管理画面 | `/groups` | 必要 | グループの一覧、作成、編集、削除 |
| SCR-004 | タグ管理画面 | `/tags` | 必要 | タグの一覧、編集、削除 |
| SCR-005 | 設定画面 | `/settings` | 必要 | テーマ、読了非表示、ログアウト |
| SCR-006 | About 画面 | `/about` | 必要 | アプリの説明 |
| SCR-007 | 共有グループ閲覧画面 | `/shared/$sharedGroupId` | 不要 | 共有リンクから閲覧するパブリックページ |

> 本の登録／編集／削除は画面遷移ではなくホーム画面上のモーダル（`BookRegistrationModal` / `BookEditModal` / `DeleteBookAlertDialog`）で行う。そのため `/new` や `/book/$bookId`、`/group/$groupId` といった固有の画面ルートは持たない。

### 5.2 画面遷移図

```
[ログイン画面] ──(認証成功)──▶ [ホーム（本の一覧）]
                                    │
          ┌─────────────┬──────────┼──────────┬────────────┐
          │             │          │          │            │
          ▼             ▼          ▼          ▼            ▼
    (?tag=xxx でフィルタ)         [本の登録/編集モーダル]
                                                  │
                                                  ▼
                                         [削除確認ダイアログ]

  [サイドナビ] ──▶ [グループ管理] / [タグ管理] / [設定] / [About]
```

### 5.3 SCR-001: ログイン画面

**レイアウト:**
- 中央揃えのシンプルなレイアウト
- アプリロゴ + タイトル
- 「Googleでログイン」ボタン
- 簡単な説明テキスト

**コンポーネント:**
- Logo
- GoogleSignInButton
- FeatureDescription

### 5.4 SCR-002: 本の一覧画面（ホーム）

**レイアウト:**
```
┌────────────────────────────────────────────────────┐
│ [SideNav]                    [Header]              │
│ ┌─────────┐  ┌────────────────────────────────┐    │
│ │ すべて  │  │ [タグフィルタ: すべて | #小説 ..] │    │
│ │ ─────── │  ├────────────────────────────────┤    │
│ │ 文脈    │  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │    │
│ │ グループ │  │  │📕 │ │🔄 │ │📘 │ │❌ │ │📗 │ │    │
│ │ ・Web   │  │  │   │ │取得│ │ ✓ │ │再 │ │   │ │    │
│ │   開発  │  │  │#タグ│ │中 │ │#タ│ │取得│ │#タ│ │    │
│ │ ・キャリア│  │  └───┘ └───┘ └───┘ └───┘ └───┘ │    │
│ │ ─────── │  │  ...                            │    │
│ │ タグ    │  │                          [+ FAB] │    │
│ │ ・#新書 │  └────────────────────────────────┘    │
│ │ ・#技術 │                                         │
│ └─────────┘                                         │
└────────────────────────────────────────────────────┘
```

**特徴:**
- サイドナビのグループ／タグには件数バッジを表示し、選択中の項目はハイライトする
- BookCard は `scrapingStatus` に応じて表示を切り替える
  - `scraping`: スピナー + 「取得中...」
  - `completed`: 表紙画像（なければ `No Image`）
  - `failed`: 赤い「取得失敗」 + 再取得ボタン
  - `skipped`: 通常の表示（表紙画像など）
- 読了済みの本はカード右上に緑色のチェックバッジ
- タグはカード下部の横スクロール行に表示

**コンポーネント:**
- SideNav（グループ / タグ / PWA インストール）
- Header
- TagFilter（タグチップ）
- BookList / BookCard（リアルタイム購読）
- BookRegistrationModal / BookEditModal / DeleteBookAlertDialog
- FloatingActionButton（`c` キーでも開く）

### 5.5 本の登録モーダル（BookRegistrationModal）

ホーム画面に重ねて表示するダイアログ。URL ベース画面ではない。

**レイアウト:**
```
┌─────────────────────────────────────────────┐
│  本を登録                                    │
├─────────────────────────────────────────────┤
│  AmazonのURL                                │
│  ┌─────────────────────────────────────┐   │
│  │ https://www.amazon.co.jp/dp/...      │   │
│  └─────────────────────────────────────┘   │
│  URL または下のHTMLのいずれかを入力してください│
│                                             │
│  Amazon詳細ページのHTML（任意）              │
│  ┌─────────────────────────────────────┐   │
│  │ <html>...（ソースを貼り付け）        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  タグ  [小説] [技術書] (サジェスト)          │
│  どこで見つけたか                            │
│  どこで読めるか                              │
│  購入場所 ☐物理本 ☐Kindle ☐オフィス         │
│  グループ [Web開発] [キャリア] ▼            │
│  メモ                                        │
│  読了状態 ☐読み終わった                     │
│                                             │
│              [キャンセル] [登録]            │
└─────────────────────────────────────────────┘
```

**コンポーネント:**
- Dialog（`@/components/ui/dialog`）
- Amazon URL / HTML テキストエリア
- TagSuggestionDropdown（既存タグのサジェスト）
- GroupSelectDropdown（複数選択）
- PurchasedBy Checkbox
- Read Checkbox
- Submit / Cancel ボタン

**本の編集モーダル（BookEditModal）:** 上記に加え、上部にスクレイピング済みの表紙・タイトル・著者を表示する。`amazonUrl` / `amazonHtml` フィールドは持たない。フッターに「削除」ボタンを配置し、押下で `DeleteBookAlertDialog` を開く。

### 5.6 SCR-003: グループ管理画面

**レイアウト:**
```
┌─────────────────────────────────────────────┐
│  [←戻る]          グループ                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Web開発            (12冊) [共有] [編集]│   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ キャリア論          ( 5冊) [🔗コピー][編集]│  ← 共有済み
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 哲学・思想          ( 8冊) [共有] [編集]│   │
│  └─────────────────────────────────────┘   │
│                                             │
│                    [+]                      │  ← グループ追加
└─────────────────────────────────────────────┘
```

**コンポーネント:**
- GroupList
- GroupCard (label, count, 共有ボタン / 共有リンクコピーボタン)
- CreateGroupDialog / EditGroupDialog / DeleteGroupAlertDialog
- ShareGroupDialog（共有確認・共有リンクコピー・共有更新・共有解除）

### 5.7 SCR-004: タグ管理画面

- タグの一覧を件数付きで表示する
- 各タグに編集ボタン・削除ボタンを設置
- 編集ダイアログで label を変更でき、変更時は関連する本の `tags` を一括更新する
- 削除は `DeleteTagAlertDialog` で確認後、タグのドキュメントを削除し、Cloud Functions の `onDeleteTag` が関連する本から label を除去する

**コンポーネント:**
- TagList
- EditTagDialog
- DeleteTagAlertDialog

### 5.8 SCR-005: 設定画面

**セクション:**
- **プロフィール**: 表示名の入力フィールド（共有ページ等で「○○の」と表示される）
- **テーマ**: ライト / ダーク / デバイスに合わせる の 3 択ボタン
- **本の表示**: 「読了済みの本を一覧に表示しない」チェックボックス
- **アカウント**: ログアウトボタン

### 5.9 SCR-007: 共有グループ閲覧画面

**レイアウト:**
```
┌─────────────────────────────────────────────┐
│  [BookPoolContexts ロゴ]   [このアプリを使う] │
├─────────────────────────────────────────────┤
│                                             │
│  📚 ○○の Web開発                        │  ← ownerName + グループ名
│                                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐           │
│  │📕 │ │📘 │ │📗 │ │📙 │ │📕 │           │
│  │   │ │   │ │   │ │   │ │   │           │
│  │タイトル│タイトル│タイトル│タイトル│タイトル│           │
│  │著者│ │著者│ │著者│ │著者│ │著者│           │
│  │#タグ│ │#タグ│ │#タグ│ │#タグ│ │#タグ│           │
│  └───┘ └───┘ └───┘ └───┘ └───┘           │
│                                             │
└─────────────────────────────────────────────┘
```

**特徴:**
- 認証不要のパブリックページ
- ヘッダーにアプリロゴと「このアプリを使ってみる」リンク（→ `/login`）を表示
- グループ名を見出しとして表示
- カードグリッドで本の表紙画像・タイトル・著者・タグを表示
- メモ・foundBy・location・purchasedBy・読了フラグなどの個人情報は表示しない
- 存在しない `sharedGroupId` の場合は「このページは公開されていません」と表示

**コンポーネント:**
- SharedGroupHeader（ロゴ + CTA リンク）
- SharedBookList / SharedBookCard（表紙・タイトル・著者・タグのみ）

---

## 6. API設計

### 6.1 アーキテクチャ概要

```
┌─────────────────┐     ┌──────────────────┐
│  TanStack Start │     │ Firebase         │
│  (SPA)          │────▶│ Functions (v2)   │
│                 │     │                  │
│  TanStack Query │◀────│                  │
└─────────────────┘     └──────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌──────────────────┐
│ Firebase Auth   │     │ Cloud Firestore  │
│ (Google OAuth)  │     │                  │
└─────────────────┘     └──────────────────┘
```

### 6.2 Firebase Functions エンドポイント

すべてのトリガーは `triggerOnce` ラッパーで冪等性を担保し、リージョンは `asia-northeast1`。スクレイピングを行う関数は `memory: 2GiB`。

#### onCreateBook

| 項目 | 内容 |
|------|------|
| 関数名 | `onCreateBook` |
| タイプ | Firestore onDocumentCreated トリガー |
| トリガーパス | `users/{uid}/books/{bookId}` |

**処理内容:**
1. 作成されたBookの `scrapingStatus` を判定し、`'skipped'` 以外のときだけ `scrapeAndUpdateBook` を呼び出して Amazon 詳細ページをスクレイピング
2. スクレイピング結果で Book を更新（`updatedBy: 'trigger'`）。成否に応じて `scrapingStatus` を `completed` / `failed` に遷移
3. 本の `groups` 配列に含まれる各 group label の `count` をインクリメント
4. 本の `tags` 配列を正規化し、各タグの `count` をインクリメント（未知のタグは `count: 1` で新規作成）
5. 本の `groups` に含まれる label に紐づく `sharedGroups` ドキュメントが存在する場合、`books` 配列を最新状態に再構築する

#### onUpdateBook

| 項目 | 内容 |
|------|------|
| 関数名 | `onUpdateBook` |
| タイプ | Firestore onDocumentUpdated トリガー |
| トリガーパス | `users/{uid}/books/{bookId}` |

**処理内容:**
1. `after.updatedBy === 'trigger'` の更新は連鎖発火防止のためスキップ
2. `scrapingStatus` が `'scraping'` に遷移したときは再フェッチとして `scrapeAndUpdateBook` を実行
3. `groups` の差分を算出し、追加されたラベルの `count` をインクリメント、削除されたラベルの `count` をデクリメント
4. `tags` の差分を算出し、追加タグは count +1（未知のタグは新規作成）、削除タグは count -1（count<=1 ならドキュメント削除）
5. 本の `groups`（変更前・変更後いずれか）に含まれる label に紐づく `sharedGroups` ドキュメントが存在する場合、`books` 配列を最新状態に再構築する

#### onDeleteBook

| 項目 | 内容 |
|------|------|
| 関数名 | `onDeleteBook` |
| タイプ | Firestore onDocumentDeleted トリガー |
| トリガーパス | `users/{uid}/books/{bookId}` |

**処理内容:**
- 削除された Book の `groups` / `tags` を取り出し、それぞれの count を -1 する
- count<=1 のタグはドキュメント自体を削除する
- 削除された本の `groups` に含まれる label に紐づく `sharedGroups` ドキュメントが存在する場合、`books` 配列を最新状態に再構築する

#### onUpdateGroup

| 項目 | 内容 |
|------|------|
| 関数名 | `onUpdateGroup` |
| タイプ | Firestore onDocumentUpdated トリガー |
| トリガーパス | `users/{uid}/groups/{groupId}` |

**処理内容:**
- `label` が変更された場合、該当 `groupId` に紐づく `sharedGroups` ドキュメントの `groupLabel` を同期する

#### onDeleteGroup

| 項目 | 内容 |
|------|------|
| 関数名 | `onDeleteGroup` |
| タイプ | Firestore onDocumentDeleted トリガー |
| トリガーパス | `users/{uid}/groups/{groupId}` |

**処理内容:**
- 削除された group の label を読み出し、ユーザーの全 Book から当該 label を `groups` 配列から除去する
- 削除された group の `groupId` に紐づく `sharedGroups` ドキュメントが存在する場合、そのドキュメントも削除する

#### onDeleteTag

| 項目 | 内容 |
|------|------|
| 関数名 | `onDeleteTag` |
| タイプ | Firestore onDocumentDeleted トリガー |
| トリガーパス | `users/{uid}/tags/{tagId}` |

**処理内容:**
- 削除された tag の label を読み出し、ユーザーの全 Book から当該 label を `tags` 配列から除去する

#### HTTP API（`api`）

| 項目 | 内容 |
|------|------|
| 関数名 | `api` |
| タイプ | HTTPS（Express / express-promise-router） |
| リージョン | `asia-northeast1` |
| メモリ | 2GiB |

**現在のエンドポイント:**
- `POST /health` — ヘルスチェック用のテストエンドポイント

**備考:**
- スクレイピングには puppeteer-core + @sparticuz/chromium を使用する
- 取得できなかったフィールドは null のまま維持する（エラーにはしない）
- Amazon 検索 API（POST /books/search）は廃止

### 6.3 クライアントサイドAPI（Firestore 直接アクセス）

クライアントは Firestore の `onSnapshot` によるリアルタイム購読を中心に実装されている（Operations 層と `useEffect` ベースのカスタムフックで管理）。TanStack Query はインストールされているが、主要なデータ層には使用していない。データ操作は `apps/web/src/infrastructure/firestore/` の Operations 層にカプセル化する。

| 操作 | フック / Operation | 説明 |
|------|--------------------|------|
| 本の一覧購読 | `useBooks` / `subscribeBooksOperation` | 登録日時降順、上限 100 件 |
| 本の一覧（タグ絞り込み）| `subscribeBooksByTagOperation` | `tags` 配列に含むものを購読 |
| 本の一覧（グループ絞り込み）| `subscribeBooksByGroupOperation` | `groups` 配列に含むものを購読 |
| 本の作成 | `useCreateBookMutation` / `createBookOperation` | `scrapingStatus` 決定はフック側 |
| 本の更新 | `useUpdateBookMutation` / `updateBookOperation` | `updatedBy: 'user'` を付与 |
| 本の再フェッチ | `useRefetchBookMutation` | `scrapingStatus` を `'scraping'` に更新 |
| 本の削除 | `useDeleteBookMutation` | count 同期は `onDeleteBook` トリガーが担当 |
| グループ一覧購読 | `useGroups` | 全件取得 |
| グループ作成／更新／削除 | `features/groups/hooks` | label ベース管理 |
| タグ一覧購読 | `useTags` | 全件取得 |
| タグ編集／削除 | `features/tags/hooks` | 作成はトリガー経由のみ |
| 共有グループ作成 | `useCreateSharedGroupMutation` / `createSharedGroupOperation` | Firestore に直接書き込み。グループの本を取得しスナップショットを作成 |
| 共有グループ解除 | `useDeleteSharedGroupMutation` / `deleteSharedGroupOperation` | Firestore から直接削除 |
| 共有グループ取得 | `useSharedGroup` / `getSharedGroupOperation` | Firestore から直接読み取り（認証不要） |
| 共有状態の購読 | `useSharedGroups` / `subscribeSharedGroupsOperation` | 自分が作成した共有グループ一覧をリアルタイム購読 |

---

## 7. 技術スタック

### 7.1 フロントエンド

| 技術 | 用途 |
|------|------|
| TanStack Start | フルスタックReactフレームワーク（SPAモード） |
| TanStack Router | 型安全なファイルベースルーティング（`/_authed` レイアウトによる認証ガード） |
| TypeScript | 型安全な開発 |
| Tailwind CSS | ユーティリティファースト CSS |
| shadcn/ui | 再利用 UI コンポーネント（Dialog / Sidebar / AlertDialog など） |
| React Hook Form | フォーム状態管理 |
| Zod | スキーマバリデーション |
| sonner | トースト通知 |
| lucide-react | アイコン |
| Firebase SDK (web) | Firestore / Auth のクライアント SDK |
| dayjs | 日付操作ライブラリ |
| Vite | ビルドツール（TanStack Start 内蔵） |
| Service Worker（PWA）| インストール可能な PWA 対応 |

### 7.2 バックエンド / インフラ

| 技術 | 用途 |
|------|------|
| Firebase Authentication | ユーザー認証（Google OAuth） |
| Cloud Firestore | NoSQL データベース（`onSnapshot` によるリアルタイム同期） |
| Firebase Functions v2 | サーバーレス関数（Firestore トリガー、HTTPS API）、Node.js 22 ランタイム |
| puppeteer-core + @sparticuz/chromium | Cloud Functions 上での Amazon 詳細ページのスクレイピング |
| express + express-promise-router | HTTPS API ルーティング |
| express-validator | リクエストバリデーション |
| Firebase Hosting | 静的ホスティング + CDN |

### 7.3 開発ツール

| ツール | 用途 |
|--------|------|
| pnpm | パッケージマネージャー |
| Turborepo | モノレポタスクランナー |
| Biome | コード品質・フォーマット（Lint + Format） |
| tsup | Cloud Functions ビルドツール |
| Vitest | ユニットテスト |
| GitHub Actions | CI/CD |
| Firebase Emulator Suite | ローカル開発環境 |

### 7.4 モノレポ構成

pnpm workspace によるモノレポ構成。

```
bookpoolcontexts/
├── apps/
│   ├── web/                               # フロントエンド（TanStack Start SPA）
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── __root.tsx
│   │       │   ├── login.tsx              # /login
│   │       │   ├── _authed.tsx            # 認証ガード用レイアウト
│   │       │   ├── shared/
│   │       │   │   └── $sharedGroupId.tsx # /shared/$sharedGroupId（認証不要）
│   │       │   └── _authed/
│   │       │       ├── index.tsx          # / (ホーム)
│   │       │       ├── groups.tsx         # /groups
│   │       │       ├── tags.tsx           # /tags
│   │       │       ├── settings.tsx       # /settings
│   │       │       └── about.tsx          # /about
│   │       ├── features/
│   │       │   ├── books/
│   │       │   │   ├── components/        # BookList, BookCard, BookRegistrationModal, BookEditModal, DeleteBookAlertDialog
│   │       │   │   ├── hooks/              # useBooks, useCreateBookMutation, useUpdateBookMutation, useDeleteBookMutation, useRefetchBookMutation
│   │       │   │   ├── schemas/            # bookRegistrationSchema / bookEditSchema (Zod)
│   │       │   │   └── utils/              # parseAmazonHtml
│   │       │   ├── groups/                  # GroupList, GroupCheckboxList, GroupSelectDropdown, CreateGroupDialog, EditGroupDialog, DeleteGroupAlertDialog, ShareGroupDialog, useGroups
│   │       │   ├── shared/                  # SharedBookList, SharedBookCard, SharedGroupHeader, useSharedGroup
│   │       │   └── tags/                    # TagList, TagSuggestionDropdown, EditTagDialog, DeleteTagAlertDialog, useTags, useRecentTags
│   │       ├── components/                  # 共通コンポーネント（SideNav, Header, Footer, ThemeToggle, ui/）
│   │       ├── hooks/                       # useHideReadBooks, useThemeMode, useKeyboardShortcut, useDisclosure, usePWAInstall, useServiceWorker, use-mobile など
│   │       ├── infrastructure/
│   │       │   └── firestore/               # books.ts, groups.ts, tags.ts, users.ts（Operations 層）
│   │       ├── providers/
│   │       │   └── FirebaseAuthProvider.tsx
│   │       ├── lib/
│   │       │   └── firebase.ts              # Firebase 初期化
│   │       └── utils/
│   │           ├── array.ts                 # 配列ユーティリティ
│   │           ├── convertDate.ts           # Timestamp → Date 変換
│   │           └── errorMessage.ts          # エラーメッセージ整形
│   └── functions/                           # Firebase Functions v2
│       └── src/
│           ├── index.ts                     # エクスポート集約
│           ├── router.ts                    # Express ルーター
│           ├── triggers/
│           │   ├── onCreateBook.ts
│           │   ├── onUpdateBook.ts
│           │   ├── onDeleteBook.ts
│           │   ├── onUpdateGroup.ts
│           │   ├── onDeleteGroup.ts
│           │   └── onDeleteTag.ts
│           ├── services/
│           │   └── scrapeBook.ts
│           ├── api/
│           │   └── health/test.ts
│           ├── infrastructure/
│           │   └── firestore/               # books, groups, tags, sharedGroups の Admin SDK Operations
│           ├── lib/
│           │   ├── amazon.ts                # Amazon スクレイピング
│           │   └── firebase.ts
│           ├── config/firebase.ts
│           ├── middleware/auth.ts
│           └── utils/
│               ├── convertDate.ts           # Timestamp → Date 変換
│               ├── ogp.ts                   # OGP情報取得ユーティリティ
│               └── triggerOnce.ts           # 冪等性担保
├── packages/
│   └── common/                              # 共通型定義（@bookpoolcontexts/common）
│       └── src/
│           ├── entities/
│           │   ├── Auth.ts
│           │   ├── Book.ts
│           │   ├── Group.ts
│           │   ├── SharedGroup.ts
│           │   ├── Tag.ts
│           │   └── User.ts
│           └── utils/                       # normalizeTagLabel など
├── firebase.json
├── firestore.rules
├── pnpm-workspace.yaml
└── package.json
```

パスエイリアスは `@/` を使用する（`#/` は禁止）。

---

## 8. セキュリティ設計

### 8.1 Firestoreセキュリティルール

各コレクションに対してスキーマバリデーション関数を用意し、`size()` / 型 / 必須フィールド の過不足をチェックする。Book は `updatedBy == 'user'` のみ許可し、`tags` サブコレクションは `create` を禁止する（Cloud Functions が Admin SDK で作成するため）。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function requestData() { return request.resource.data; }
    function isSignedIn() { return request.auth.uid != null; }
    function isUser(userId) { return request.auth.uid == userId; }

    function isValidBookSchema(d) {
      return d.size() == 16
        && 'amazonUrl' in d && d.amazonUrl is string
        && 'author' in d && (d.author is string || d.author == null)
        && 'coverImageUrl' in d && (d.coverImageUrl is string || d.coverImageUrl == null)
        && 'createdAt' in d && d.createdAt is timestamp
        && 'foundBy' in d && d.foundBy is string
        && 'groups' in d && d.groups is list
        && 'isRead' in d && d.isRead is bool
        && 'location' in d && d.location is string
        && 'note' in d && d.note is string
        && 'pages' in d && (d.pages is number || d.pages == null)
        && 'purchasedBy' in d && d.purchasedBy is list
        && 'scrapingStatus' in d && d.scrapingStatus is string
        && 'tags' in d && d.tags is list
        && 'title' in d && (d.title is string || d.title == null)
        && 'updatedAt' in d && d.updatedAt is timestamp
        && 'updatedBy' in d && d.updatedBy == 'user';
    }

    // Group / Tag / User のスキーマバリデーションも size()・各フィールド型を検証

    match /users/{userId} {
      allow read: if isSignedIn() && isUser(userId);
      allow create, update: if isSignedIn() && isUser(userId) && isValidUserSchema(requestData());

      match /books/{bookId} {
        allow read: if isSignedIn() && isUser(userId);
        allow create, update: if isSignedIn() && isUser(userId) && isValidBookSchema(requestData());
        allow delete: if isSignedIn() && isUser(userId);
      }

      match /groups/{groupId} {
        allow read: if isSignedIn() && isUser(userId);
        allow create, update: if isSignedIn() && isUser(userId) && isValidGroupSchema(requestData());
        allow delete: if isSignedIn() && isUser(userId);
      }

      match /tags/{tagId} {
        allow read: if isSignedIn() && isUser(userId);
        allow update: if isSignedIn() && isUser(userId) && isValidTagSchema(requestData());
        allow delete: if isSignedIn() && isUser(userId);
        // create は Cloud Functions（Admin SDK）のみ許可
      }
    }

    match /sharedGroups/{sharedGroupId} {
      allow read: if true;  // 認証不要でパブリック読み取り可能
      allow create: if isSignedIn() && requestData().uid == request.auth.uid && isValidSharedGroupSchema(requestData());
      allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
      // update は Cloud Functions（Admin SDK）のみ許可
    }
  }
}
```

### 8.2 入力値検証

**クライアントサイド（Zod）:**

登録フォームと編集フォームでスキーマを分けている。登録フォームでは `amazonUrl` または `amazonHtml` のいずれかが入力されていることを `refine` で保証する。

```typescript
import { z } from 'zod'

export const bookRegistrationSchema = z
  .object({
    amazonUrl: z.string().default(''),
    amazonHtml: z.string().default(''),
    tags: z.array(z.string().max(50)).max(10).default([]),
    foundBy: z.string().max(500).default(''),
    location: z.string().max(200).default(''),
    purchasedBy: z.array(z.string()).default([]),
    groups: z.array(z.string()).default([]),
    note: z.string().max(2000).default(''),
    isRead: z.boolean().default(false),
  })
  .refine(
    (d) => d.amazonUrl.trim() !== '' || d.amazonHtml.trim() !== '',
    { message: 'AmazonのURLまたはHTMLのいずれかを入力してください', path: ['amazonUrl'] },
  )
  .refine(
    (d) => {
      if (d.amazonUrl.trim() === '') return true
      try { new URL(d.amazonUrl); return true } catch { return false }
    },
    { message: '有効なURLを入力してください', path: ['amazonUrl'] },
  )

export const bookEditSchema = z.object({
  tags: z.array(z.string().max(50)).max(10).default([]),
  foundBy: z.string().max(500).default(''),
  location: z.string().max(200).default(''),
  purchasedBy: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
  note: z.string().max(2000).default(''),
  isRead: z.boolean().default(false),
})

export const groupSchema = z.object({
  label: z.string().min(1).max(100),
})
```

---

## 9. 開発計画

### 9.1 Phase 1: MVP（4週間）

| 週 | タスク | 成果物 |
|----|--------|--------|
| Week 1 | 環境構築、Firebase設定、認証実装 | ログイン機能、Firestore接続、TanStack Start初期設定 |
| Week 2 | 本のCRUD、一覧画面実装 | 本の登録/編集/削除/一覧表示、TanStack Query統合 |
| Week 3 | グループ・タグ機能、フィルタリング実装 | グループCRUD、タグフィルタ、グループビュー |
| Week 4 | UI/UX改善、読了フラグ、テスト、デプロイ | 本番環境リリース |

### 9.2 Phase 2: 機能拡張（将来）

| 優先度 | 機能 | 概要 |
|--------|------|------|
| 高 | 読書ログ | 読了した本に感想やレビューを記録する機能 |
| 中 | 並び替え | 登録日時以外のソート（タイトル順、著者順、ページ数順） |
| 中 | 検索機能 | タイトル・著者によるテキスト検索 |
| 低 | 読書統計 | 月間読了数、ジャンル別の読書傾向をグラフ表示 |
| 低 | 共有機能 | 読みたい本リストを他のユーザーと共有 |
| 低 | ISBNバーコード読み取り | カメラでバーコードをスキャンして本を登録 |

### 9.3 リリース基準

- [ ] 全機能要件（FR-*）の実装完了
- [ ] 主要画面のE2Eテスト合格
- [ ] パフォーマンス目標値の達成（Lighthouse スコア 90+）
- [ ] セキュリティレビュー完了

---

## 10. 付録

### 10.1 環境変数

**`.env.local`（開発環境）:**
```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

### 10.2 コスト概算

| サービス | 無料枠 | 超過時料金 |
|---------|--------|-----------|
| Firestore | 1GB保存、50K読み取り/日 | $0.18/100K読み取り |
| Firebase Functions | 200万呼び出し/月 | $0.40/100万呼び出し |
| Firebase Hosting | 10GB保存、360MB/日転送 | $0.026/GB |

**月間コスト試算（1,000ユーザー、各100冊登録）:**
- Firestore: 無料枠内
- Functions: 無料枠内
- 合計: 無料枠内で運用可能

### 10.3 改訂履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|-----------|---------|--------|
| 2026-04-07 | 1.0 | 初版作成 | - |
| 2026-04-08 | 1.1 | 本の登録フローをAmazon検索方式からURL直接入力方式に変更。title/author/coverImageUrl/pagesはクライアントからnullで登録し、onCreateBookトリガーで自動取得する方式に変更。Amazon検索API廃止 | - |
| 2026-04-11 | 1.2 | 実装に合わせて全面更新。Book に `scrapingStatus` / `updatedBy` 追加、HTML 直接入力フォールバック、再フェッチ機能、`onUpdateBook` / `onDeleteBook` / `onDeleteGroup` / `onDeleteTag` トリガー、タグ管理画面、設定画面（テーマ／読了非表示）、PWA 対応、キーボードショートカット、モノレポ構成・フィールド命名（`bookId` / `tagId` / `groupId`）、Firestore スキーマバリデーションルールを追記 | - |
| 2026-06-15 | 1.3 | グループ共有機能（FR-SHARE-001〜004）を追加。`sharedGroups` トップレベルコレクション、共有リンク生成・閲覧・自動同期・解除機能、`onUpdateGroup` トリガー新設、既存トリガーに共有グループ同期処理を追加、公開ページ（`/shared/{sharedGroupId}`）、Firestore セキュリティルール追加 | - |
| 2026-09-24 | 1.4 | 実態との乖離を修正。開発ツールを ESLint+Prettier → Biome に変更、Turborepo・tsup・dayjs・express-validator を追記、Functions ランタイムを Node.js 22 に明記、Firestore ルールの sharedGroups を実態（クライアント create/delete 可能）に修正、`normalizeTagLabel` の説明を Unicode NFC 正規化に修正、ファイル構成に `onUpdateGroup.ts`・`ogp.ts`・`convertDate.ts`・`array.ts`・`errorMessage.ts`・`GroupCheckboxList`・`useRecentTags` 等を追加、未実装の `api/sharedGroups/` を削除 | - |

---

**— 以上 —**
