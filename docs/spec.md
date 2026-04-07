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
| Group | 文脈やテーマごとに本をまとめるグルーピング単位 |
| Tag | 本のジャンル（小説、新書、技術書など）を分類するラベル |
| Location | 本が読める場所（図書館、ブックオフ、本屋、Kindle Unlimitedなど） |
| PurchasedBy | 本の購入場所・手段（物理本、Kindle、オフィスなど） |

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
| タイトル (title) | **必須** | string | 1文字以上、200文字以下 |
| 著者 (author) | 自動取得 | string \| null | Cloud Functionsが自動取得。登録時はnull |
| 表紙画像URL (coverImageUrl) | 任意 | string | 有効なURL形式 |
| ページ数 (pages) | 自動取得 | number \| null | Cloud Functionsが自動取得。登録時はnull |
| AmazonURL (amazonUrl) | 自動設定 | string | Amazon検索結果から自動設定 |
| タグ (tags) | 任意 | string[] | 各タグ50文字以下、最大10個 |
| どこで見つけたか (foundBy) | 任意 | string | 500文字以下 |
| どこで読めるか (location) | 任意 | string | 200文字以下 |
| 購入場所 (purchasedBy) | 任意 | string[] | 選択肢: 物理本, Kindle, オフィス |
| メモ (note) | 任意 | string | 2000文字以下 |
| グループ (groups) | 任意 | string[] | 既存グループIDから選択 |

**処理フロー:**
1. ユーザーがフォームに入力
2. クライアント側でZodによるバリデーション
3. Firestoreに本のデータを保存（author: null, pages: null, amazonUrl付き）
4. タグ・グループのカウントを更新
5. 成功後、一覧画面へ遷移
6. Cloud Functions（onCreateBook トリガー）がamazonUrlからAmazon詳細ページをスクレイピングし、著者名・ページ数を自動取得してFirestoreを更新

#### FR-BOOK-002: Amazon情報からの自動取得

| 項目 | 内容 |
|------|------|
| 概要 | 本の登録時にAmazon詳細ページから著者名・ページ数を自動取得する機能 |
| 優先度 | 中 |

**詳細要件:**
- Amazon検索結果から本を選択・登録すると、ASINからAmazon詳細ページURLを自動生成しBookドキュメントに保存する
- Cloud Functions の onCreateBook トリガーが、保存された amazonUrl を使ってAmazon詳細ページをスクレイピングする
- 著者名（author）とページ数（pages）を自動取得し、Firestoreの該当Bookドキュメントを更新する
- 取得できなかった場合はnullのまま維持する（エラーにはしない）
- スクレイピングにはpuppeteer-core + @sparticuz/chromiumを使用する
- 情報取得はFirebase Functions（Firestoreトリガー）経由で実行する

#### FR-BOOK-003: 本の編集

| 項目 | 内容 |
|------|------|
| 概要 | 登録済みの本の情報を編集する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 登録済みの本の全フィールドを編集可能とする
- 更新日時（updatedAt）を自動更新する
- タグ・グループの変更時はカウントを適切に更新する
- 楽観的更新（Optimistic Update）を実装し、UXを向上させる

#### FR-BOOK-004: 本の削除

| 項目 | 内容 |
|------|------|
| 概要 | 登録済みの本を削除する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 確認ダイアログを表示後、本を削除する
- 削除は物理削除（復元不可）とする
- 削除後は一覧画面へ遷移する
- 関連するタグ・グループのカウントを更新する

#### FR-BOOK-005: 読了フラグ

| 項目 | 内容 |
|------|------|
| 概要 | 読み終わった本に読了マークをつける機能 |
| 優先度 | 必須 |

**詳細要件:**
- 一覧画面・詳細画面から読了フラグをトグルできる
- 読了済みの本は一覧画面で視覚的に区別される
- デフォルトでは未読の本のみ表示し、読了済みも含める切り替えが可能

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
- 無限スクロールによるページネーションを実装する（1回あたり20件）
- 各本はタイトル、著者、表紙画像、タグ、登録日時を表示する
- TanStack Queryによるデータフェッチとキャッシュ管理

#### FR-LIST-002: タグによるフィルタリング

| 項目 | 内容 |
|------|------|
| 概要 | タグで本を絞り込む機能 |
| 優先度 | 必須 |

**詳細要件:**
- タグ一覧をサイドバーまたはフィルタUIで表示する
- タグを選択すると、そのタグが付いた本のみ表示する
- 各タグに登録されている本の件数を表示する

#### FR-LIST-003: グループビュー

| 項目 | 内容 |
|------|------|
| 概要 | グループ単位で本を閲覧する機能 |
| 優先度 | 必須 |

**詳細要件:**
- グループ一覧画面でグループを選択すると、そのグループに属する本の一覧を表示する
- 各グループに登録されている本の件数を表示する
- グループ内でも読了/未読の切り替えが可能

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
- 本の詳細画面・編集画面からグループを追加・除去できる
- 1冊の本は複数のグループに所属できる
- グループのカウントを自動更新する

---

### 2.5 タグ管理機能

#### FR-TAG-001: タグの作成

| 項目 | 内容 |
|------|------|
| 概要 | 本に付けるタグを管理する機能 |
| 優先度 | 必須 |

**詳細要件:**
- 本の登録・編集時にタグを自由入力で追加できる
- 既存タグの候補をオートコンプリートで表示する
- 新規タグは本の保存時に自動作成される

#### FR-TAG-002: タグの編集・削除

| 項目 | 内容 |
|------|------|
| 概要 | 既存タグの名前変更・削除機能 |
| 優先度 | 低 |

**詳細要件:**
- タグ名を変更できる（変更時は関連する全ての本のタグも更新する）
- タグを削除できる（削除時は関連する全ての本からそのタグを除去する）

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
│       ├── email: string
│       ├── updatedAt: Timestamp
│       ├── books/  (サブコレクション)
│       │   └── {bookId}/
│       │       ├── amazonUrl: string
│       │       ├── author: string | null
│       │       ├── coverImageUrl: string
│       │       ├── createdAt: Timestamp
│       │       ├── foundBy: string
│       │       ├── groups: string[]
│       │       ├── isRead: boolean
│       │       ├── location: string
│       │       ├── note: string
│       │       ├── pages: number | null
│       │       ├── purchasedBy: string[]
│       │       ├── tags: string[]
│       │       ├── title: string
│       │       └── updatedAt: Timestamp
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
│               ├── label: string
│               └── updatedAt: Timestamp
```

### 4.2 users コレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| uid | string | Firebase Auth UID（ドキュメントID） |
| createdAt | Timestamp | 作成日時 |
| email | string | 認証に使用したメールアドレス |
| updatedAt | Timestamp | 更新日時 |

### 4.3 books サブコレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 自動生成ID（ドキュメントID） |
| amazonUrl | string | Amazon詳細ページのURL（ASINから自動生成） |
| author | string \| null | 本の著者（Cloud Functionsが自動取得、初期値null） |
| coverImageUrl | string | 表紙の画像URL |
| createdAt | Timestamp | 登録日時 |
| foundBy | string | どこで見つけたか（誰に勧められたかなど） |
| groups | string[] | 所属するグループIDの配列 |
| isRead | boolean | 読了かどうか |
| location | string | どこで読めるか（図書館、ブックオフ、本屋、Kindle Unlimitedなど） |
| note | string | 自由記述のメモ |
| pages | number \| null | ページ数（Cloud Functionsが自動取得、初期値null） |
| purchasedBy | string[] | 購入場所（物理本、Kindle、オフィス） |
| tags | string[] | ジャンルタグ |
| title | string | 本のタイトル |
| updatedAt | Timestamp | 更新日時 |

### 4.4 groups サブコレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 自動生成ID（ドキュメントID） |
| count | number | グループに登録されている本の数 |
| createdAt | Timestamp | 作成日時 |
| label | string | グループ名 |
| updatedAt | Timestamp | 更新日時 |

### 4.5 tags サブコレクション

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 自動生成ID（ドキュメントID） |
| count | number | タグに登録されている本の数 |
| createdAt | Timestamp | 作成日時 |
| label | string | タグ名 |
| updatedAt | Timestamp | 更新日時 |

### 4.6 TypeScript型定義

```typescript
// types/book.ts
import { Timestamp } from 'firebase/firestore';

export interface Book {
  id: string;
  amazonUrl: string;
  author: string | null;
  coverImageUrl: string;
  createdAt: Timestamp;
  foundBy: string;
  groups: string[];
  isRead: boolean;
  location: string;
  note: string;
  pages: number | null;
  purchasedBy: string[];
  tags: string[];
  title: string;
  updatedAt: Timestamp;
}

export interface BookInput {
  amazonUrl?: string;
  coverImageUrl?: string;
  foundBy?: string;
  groups?: string[];
  location?: string;
  note?: string;
  purchasedBy?: string[];
  tags?: string[];
  title: string;
}

export interface Group {
  id: string;
  count: number;
  createdAt: Timestamp;
  label: string;
  updatedAt: Timestamp;
}

export interface GroupInput {
  label: string;
}

export interface Tag {
  id: string;
  count: number;
  createdAt: Timestamp;
  label: string;
  updatedAt: Timestamp;
}

export interface User {
  uid: string;
  createdAt: Timestamp;
  email: string;
  updatedAt: Timestamp;
}
```

---

## 5. 画面設計

### 5.1 画面一覧

| 画面ID | 画面名 | パス | 認証 | 概要 |
|--------|--------|------|------|------|
| SCR-001 | ログイン画面 | `/login` | 不要 | Googleログインボタンを表示 |
| SCR-002 | 本の一覧画面 | `/` | 必要 | 登録した本を一覧表示（ホーム） |
| SCR-003 | 本の登録画面 | `/new` | 必要 | 新規の本の登録フォーム |
| SCR-004 | 本の詳細画面 | `/book/$bookId` | 必要 | 本の詳細表示と編集 |
| SCR-005 | グループ一覧画面 | `/groups` | 必要 | グループの一覧表示 |
| SCR-006 | グループ詳細画面 | `/group/$groupId` | 必要 | グループに属する本の一覧表示 |
| SCR-007 | 設定画面 | `/settings` | 必要 | ユーザー設定 |

### 5.2 画面遷移図

```
[ログイン画面] ──(認証成功)──▶ [本の一覧画面]
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              [本の登録]      [本の詳細]     [グループ一覧]
                    │               │               │
                    └───────┬───────┘               ▼
                            │               [グループ詳細]
                            ▼                       │
                      [設定画面]              [本の詳細]
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
┌─────────────────────────────────────────────┐
│  [Logo]    [Groups]     [Avatar][Logout]    │  ← ヘッダー
├─────────────────────────────────────────────┤
│  [タグフィルタ: 全て | 小説 | 技術書 | ...]  │  ← フィルタバー
│  [未読のみ ☑]                               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ 📕表紙  │  │ 📗表紙  │  │ 📘表紙  │     │  ← カードグリッド
│  │ タイトル │  │ タイトル │  │ タイトル │     │
│  │ 著者    │  │ 著者    │  │ 著者    │     │
│  │ タグ    │  │ タグ    │  │ タグ    │     │
│  │ 日時    │  │ 日時    │  │ 日時    │     │
│  └─────────┘  └─────────┘  └─────────┘     │
│                                             │
│                    [+]                      │  ← FAB（新規登録）
└─────────────────────────────────────────────┘
```

**コンポーネント:**
- Header (Logo, Navigation, UserMenu)
- TagFilter (tag chips)
- BookCard (coverImage, title, author, tags, date, isRead badge)
- BookGrid (infinite scroll)
- FloatingActionButton

### 5.5 SCR-003: 本の登録画面

**レイアウト:**
```
┌─────────────────────────────────────────────┐
│  [←戻る]             本を登録               │
├─────────────────────────────────────────────┤
│                                             │
│  AmazonのURL（任意）                        │
│  ┌────────────────────────────────[取得]┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  タイトル *                                 │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  著者 *                                     │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ページ数（任意）                           │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  タグ（任意）                               │
│  ┌─────────────────────────────────────┐   │
│  │ [小説] [技術書] [+追加]              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  どこで見つけたか（任意）                   │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  どこで読めるか（任意）                     │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  購入場所（任意）                           │
│  ☐ 物理本  ☐ Kindle  ☐ オフィス           │
│                                             │
│  グループ（任意）                           │
│  ┌─────────────────────────────────────┐   │
│  │ [Web開発] [キャリア] [+追加]         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  メモ（任意）                               │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│              [キャンセル] [登録]            │
└─────────────────────────────────────────────┘
```

**コンポーネント:**
- BookForm
- AmazonUrlInput (with fetch button)
- TagInput (autocomplete)
- GroupSelect (multi-select)
- PurchasedByCheckbox
- SubmitButton (with loading state)

### 5.6 SCR-005: グループ一覧画面

**レイアウト:**
```
┌─────────────────────────────────────────────┐
│  [←戻る]          グループ                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Web開発                     (12冊)  │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ キャリア論                  ( 5冊)  │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 哲学・思想                  ( 8冊)  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│                    [+]                      │  ← グループ追加
└─────────────────────────────────────────────┘
```

**コンポーネント:**
- GroupList
- GroupCard (label, count)
- CreateGroupButton

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

#### scrapeAmazon

| 項目 | 内容 |
|------|------|
| 関数名 | `scrapeAmazon` |
| タイプ | onCall (v2) |
| 認証 | Firebase Auth必須 |

**リクエスト:**
```typescript
interface ScrapeAmazonRequest {
  url: string;  // AmazonのURL
}
```

**レスポンス:**
```typescript
interface ScrapeAmazonResponse {
  title: string;
  author: string;
  coverImageUrl: string;
  pages: number | null;
}
```

**処理内容:**
1. 認証トークンを検証
2. AmazonのURLからページ情報をスクレイピング
3. タイトル、著者、表紙画像URL、ページ数を返却

### 6.3 クライアントサイドAPI（Firestore直接アクセス）

TanStack Queryを使用してFirestoreに直接アクセスする操作:

| 操作 | Query Key | 説明 |
|------|-----------|------|
| 本の一覧取得 | `['books', uid]` | ページネーション付き |
| 本の詳細取得 | `['book', bookId]` | 単一の本 |
| 本の作成 | mutation | invalidate: `['books']` |
| 本の更新 | mutation | invalidate: `['books']`, `['book', id]` |
| 本の削除 | mutation | invalidate: `['books']` |
| グループ一覧取得 | `['groups', uid]` | 全件取得 |
| グループ作成 | mutation | invalidate: `['groups']` |
| グループ更新 | mutation | invalidate: `['groups']` |
| グループ削除 | mutation | invalidate: `['groups']`, `['books']` |
| タグ一覧取得 | `['tags', uid]` | 全件取得 |

---

## 7. 技術スタック

### 7.1 フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| TanStack Start | 1.x | フルスタックReactフレームワーク（SPAモード） |
| TanStack Router | 1.x | 型安全なファイルベースルーティング |
| TanStack Query | 5.x | サーバー状態管理、キャッシュ |
| TypeScript | 5.x | 型安全な開発 |
| Tailwind CSS | 3.x | ユーティリティファーストCSS |
| React Hook Form | 7.x | フォーム状態管理 |
| Zod | 3.x | スキーマバリデーション |
| Vite | 5.x | ビルドツール（TanStack Start内蔵） |

### 7.2 バックエンド / インフラ

| 技術 | バージョン | 用途 |
|------|-----------|------|
| Firebase Authentication | - | ユーザー認証（Google OAuth） |
| Cloud Firestore | - | NoSQLデータベース |
| Firebase Functions | v2 | サーバーレス関数（Amazon情報取得） |
| Firebase Hosting | - | 静的ホスティング + CDN |

### 7.3 開発ツール

| ツール | 用途 |
|--------|------|
| pnpm | パッケージマネージャー |
| ESLint + Prettier | コード品質・フォーマット |
| Vitest | ユニットテスト |
| GitHub Actions | CI/CD |
| Firebase Emulator Suite | ローカル開発環境 |

### 7.4 TanStack Start プロジェクト構成

```
bookgroups/
├── apps/
│   ├── web/                        # フロントエンド（TanStack Start SPA）
│   │   ├── app/
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx          # ルートレイアウト
│   │   │   │   ├── index.tsx           # / (本の一覧)
│   │   │   │   ├── login.tsx           # /login
│   │   │   │   ├── new.tsx             # /new (本の登録)
│   │   │   │   ├── book.$bookId.tsx    # /book/:bookId (詳細)
│   │   │   │   ├── groups.tsx          # /groups (グループ一覧)
│   │   │   │   ├── group.$groupId.tsx  # /group/:groupId (グループ詳細)
│   │   │   │   └── settings.tsx        # /settings
│   │   │   ├── components/
│   │   │   │   ├── ui/                 # 汎用UIコンポーネント
│   │   │   │   ├── book/               # 本関連コンポーネント
│   │   │   │   ├── group/              # グループ関連コンポーネント
│   │   │   │   └── layout/             # レイアウトコンポーネント
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useBooks.ts
│   │   │   │   ├── useGroups.ts
│   │   │   │   └── useTags.ts
│   │   │   ├── lib/
│   │   │   │   ├── firebase.ts         # Firebase初期化
│   │   │   │   ├── firestore.ts        # Firestore操作
│   │   │   │   └── functions.ts        # Firebase Functions呼び出し
│   │   │   ├── types/
│   │   │   │   └── book.ts
│   │   │   ├── router.tsx
│   │   │   ├── routeTree.gen.ts        # 自動生成
│   │   │   └── client.tsx
│   │   └── package.json
│   └── functions/                   # Firebase Functions
│       ├── src/
│       │   ├── index.ts
│       │   └── scrapeAmazon.ts
│       └── package.json
├── packages/
│   └── common/                      # 共通型定義
│       └── types/
├── firebase.json
├── firestore.rules
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

## 8. セキュリティ設計

### 8.1 Firestoreセキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザードキュメント
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;

      // 本サブコレクション
      match /books/{bookId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId;
      }

      // グループサブコレクション
      match /groups/{groupId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId;
      }

      // タグサブコレクション
      match /tags/{tagId} {
        allow read, write: if request.auth != null
                           && request.auth.uid == userId;
      }
    }
  }
}
```

### 8.2 入力値検証

**クライアントサイド（Zod）:**
```typescript
import { z } from 'zod';

export const bookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  pages: z.number().min(1).max(99999).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  foundBy: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  purchasedBy: z.array(z.enum(['物理本', 'Kindle', 'オフィス'])).optional(),
  groups: z.array(z.string()).optional(),
  note: z.string().max(2000).optional(),
});

export type BookInput = z.infer<typeof bookSchema>;

export const groupSchema = z.object({
  label: z.string().min(1).max(100),
});

export type GroupInput = z.infer<typeof groupSchema>;
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
| 高 | Amazon情報自動取得 | URLからタイトル・著者・表紙・ページ数を自動入力 |
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

---

**— 以上 —**
