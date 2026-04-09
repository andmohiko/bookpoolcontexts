# FR-BOOK-003: 本の登録フローをAmazon URL直接入力方式に変更

## Context

現在、本の登録はクライアント側でキーワード検索 → Cloud FunctionsでAmazon.co.jpをスクレイピング → 検索結果グリッドから本を選択 → モーダルで登録、というフロー。Puppeteerでの検索スクレイピングが遅く、UXが悪い。

これを、ユーザーがAmazonのURLを直接貼り付けて登録 → onCreateBookトリガーでスクレイピングしてtitle/author/coverImageUrl/pagesを自動取得する方式に変更する。

クライアント側で入力するのはamazonUrl（必須）とタグ等のメタ情報のみ。title/author/coverImageUrl/pagesはnullで登録し、onCreateBookトリガーで非同期に取得・更新する。

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: Book エンティティの型定義変更（common） | 実装済み |
| Task 2: Firestore セキュリティルール更新 | 実装済み |
| Task 3: onCreateBookトリガーの修正（functions） | 実装済み |
| Task 4: Amazon検索API・関連コードの削除（functions） | 実装済み |
| Task 5: Zodスキーマ・フォーム型の変更（web） | 実装済み |
| Task 6: useCreateBookMutation の修正（web） | 実装済み |
| Task 7: 本の登録画面の全面変更（web） | 実装済み |
| Task 8: BookCard/一覧のnull対応（web） | 実装済み |
| Task 9: ビルド確認 | 実装済み |

---

## 実装タスク

### Task 1: Book エンティティの型定義変更（common）

**ファイル:** `packages/common/src/entities/Book.ts`

title, coverImageUrlをnull許容に変更する。author, pagesは既にnull許容。

```typescript
export type Book = {
  bookId: BookId
  amazonUrl: string
  author: string | null        // 変更なし（既にnull許容）
  coverImageUrl: string | null // 変更: string → string | null
  createdAt: Date
  foundBy: string
  groups: string[]
  isRead: boolean
  location: string
  note: string
  pages: number | null         // 変更なし（既にnull許容）
  purchasedBy: string[]
  tags: string[]
  title: string | null         // 変更: string → string | null
  updatedAt: Date
}
```

CreateBookDtoはOmitベースのため自動的に反映される。

UpdateBookDtoFromAdminは既にtitle/author/coverImageUrl/pagesを含んでいるため変更不要。

---

### Task 2: Firestore セキュリティルール更新

**ファイル:** `firestore.rules`

BookスキーマバリデーションでtitleとcoverImageUrlをnull許容にする。

```javascript
function isValidBookSchema(requestData) {
  return requestData.size() == 14
    && 'amazonUrl' in requestData && requestData.amazonUrl is string
    && 'author' in requestData && (requestData.author is string || requestData.author == null)
    && 'coverImageUrl' in requestData && (requestData.coverImageUrl is string || requestData.coverImageUrl == null)  // 変更
    && 'createdAt' in requestData && requestData.createdAt is timestamp
    && 'foundBy' in requestData && requestData.foundBy is string
    && 'groups' in requestData && requestData.groups is list
    && 'isRead' in requestData && requestData.isRead is bool
    && 'location' in requestData && requestData.location is string
    && 'note' in requestData && requestData.note is string
    && 'pages' in requestData && (requestData.pages is number || requestData.pages == null)
    && 'purchasedBy' in requestData && requestData.purchasedBy is list
    && 'tags' in requestData && requestData.tags is list
    && 'title' in requestData && (requestData.title is string || requestData.title == null)  // 変更
    && 'updatedAt' in requestData && requestData.updatedAt is timestamp;
}
```

---

### Task 3: onCreateBookトリガーの修正（functions）

**ファイル:** `apps/functions/src/triggers/onCreateBook.ts`

現在はauthor/pagesのみ取得・更新しているが、title/coverImageUrlも取得・更新するように変更する。

```typescript
// 変更点:
// 1. fetchAmazonBookDetail の返り値に title, coverImageUrl を追加（Task 3で対応）
// 2. updateDto に title, coverImageUrl を含める

const detail = await fetchAmazonBookDetail(amazonUrl)

const updateDto: UpdateBookDtoFromAdmin = {
  updatedAt: serverTimestamp,
}

if (detail.title) {
  updateDto.title = detail.title
}
if (detail.author) {
  updateDto.author = detail.author
}
if (detail.coverImageUrl) {
  updateDto.coverImageUrl = detail.coverImageUrl
}
if (detail.pages > 0) {
  updateDto.pages = detail.pages
}

// すべて取得できなかった場合は更新しない
if (!detail.title && !detail.author && !detail.coverImageUrl && detail.pages === 0) {
  console.log('本の情報を取得できませんでした:', bookId)
  return
}

await updateBookOperation(uid, bookId, updateDto)
```

**ファイル:** `apps/functions/src/lib/amazon.ts`

`fetchAmazonBookDetail` の返り値とスクレイピング対象を拡張する。

```typescript
export type AmazonBookDetail = {
  title: string       // 追加
  author: string
  coverImageUrl: string  // 追加
  pages: number
}
```

スクレイピングで追加取得するもの:
- title: `#productTitle` のテキスト
- coverImageUrl: `#landingImage` または `#imgBlkFront` の `src` 属性

---

### Task 4: Amazon検索API・関連コードの削除（functions & web）

**削除・修正するファイル:**

#### functions側
- `apps/functions/src/api/books/searchBooks.ts` — ファイル削除
- `apps/functions/src/router.ts` — `/books/search` ルートを削除
- `apps/functions/src/lib/amazon.ts` — `searchAmazonBooks` 関数を削除（`fetchAmazonBookDetail` は残す）

#### web側
- `apps/web/src/features/books/hooks/useSearchBooks.ts` — ファイル削除
- `apps/web/src/features/books/components/BookSearchResultGrid.tsx` — ファイル削除
- `apps/web/src/lib/api.ts` — 他で使われていなければファイル削除（要確認）

#### common側
- `packages/common/src/entities/AmazonBook.ts` — ファイル削除（AmazonBookItem, SearchBooksResponseはもう不要）
- `packages/common/src/index.ts` — AmazonBook関連のexportを削除

---

### Task 5: Zodスキーマ・フォーム型の変更（web）

**ファイル:** `apps/web/src/features/books/schemas/bookSchema.ts`

タイトル入力欄をなくし、amazonUrlを必須にする。

```typescript
import { z } from 'zod'

export const bookRegistrationSchema = z.object({
  amazonUrl: z.string().url('有効なURLを入力してください'),
  tags: z.array(z.string().max(50)).max(10).default([]),
  foundBy: z.string().max(500).default(''),
  location: z.string().max(200).default(''),
  purchasedBy: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
  note: z.string().max(2000).default(''),
})

export type BookRegistrationFormValues = z.infer<typeof bookRegistrationSchema>
```

---

### Task 6: useCreateBookMutation の修正（web）

**ファイル:** `apps/web/src/features/books/hooks/useCreateBookMutation.ts`

CreateBookInputからtitle, coverImageUrlを削除し、amazonUrlを必須にする。dtoのtitle, coverImageUrl, author, pagesはすべてnullで作成する。

```typescript
export type CreateBookInput = {
  amazonUrl: string
  tags: string[]
  foundBy: string
  location: string
  purchasedBy: string[]
  groups: string[]
  note: string
}

// dto構築部分
const dto: CreateBookDto = {
  ...input,
  title: null,
  author: null,
  coverImageUrl: null,
  pages: null,
  isRead: false,
  createdAt: serverTimestamp,
  updatedAt: serverTimestamp,
}
```

---

### Task 7: 本の登録画面の全面変更（web）

**ファイル:** `apps/web/src/routes/_authed/new.tsx`

検索バー + 検索結果グリッド + モーダル方式を廃止し、Amazon URL入力フォーム + メタ情報入力のシンプルなフォームに変更する。BookRegistrationModalは使わず、ページ内に直接フォームを配置する。

**新しい画面構成:**

```
┌─────────────────────────────────────────────┐
│  [←戻る]             本を登録               │
├─────────────────────────────────────────────┤
│                                             │
│  AmazonのURL *                              │
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
│  どこで読めるか（任意）                     │
│  購入場所（任意）                           │
│  グループ（任意）                           │
│  メモ（任意）                               │
│                                             │
│              [キャンセル] [登録]            │
└─────────────────────────────────────────────┘
```

**実装方針:**
- `useSearchBooks`, `BookSearchResultGrid`, `BookRegistrationModal` のimportを削除
- `useDisclosure`, `selectedBook` のstate管理を削除
- `react-hook-form` + `zodResolver` を直接ページコンポーネントに配置、またはBookRegistrationModalのフォームロジックをインライン化
- amazon URL入力 + タグ入力 + メタ情報入力 + 送信ボタンの構成

**削除するファイル:**
- `apps/web/src/features/books/components/BookRegistrationModal.tsx` — ファイル削除（フォームはnew.tsxに直接配置）

---

### Task 8: BookCard/一覧のnull対応（web）

**ファイル:** `apps/web/src/features/books/components/BookCard.tsx`

title, coverImageUrlがnullの可能性があるため、表示をフォールバック対応する。

```typescript
// coverImageUrl: 既に null チェック済み（No Image 表示あり）→ 変更不要
// title: altテキストでnull対応が必要
// alt={book.title ?? ''}
```

titleがnullの場合、BookCardでは「取得中...」のような表示にする。一覧画面でもtitleがnullの本が表示される可能性があるため対応が必要。

---

### Task 9: ビルド確認

以下のコマンドでビルドが通ることを確認する。

```bash
pnpm web build
pnpm functions pre-build
```

---

## 実装順序

```
Step 1: Task 1（型定義変更）
    ↓
Step 2: Task 2（Firestoreルール更新）+ Task 3（onCreateBookトリガー修正）
    ↓
Step 3: Task 4（検索API・関連コード削除）
    ↓
Step 4: Task 5（Zodスキーマ変更）+ Task 6（useCreateBookMutation修正）
    ↓
Step 5: Task 7（登録画面変更）+ Task 8（BookCard null対応）
    ↓
Step 6: Task 9（ビルド確認）
```

---

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/Book.ts` | 修正 | title, coverImageUrlをnull許容に |
| `packages/common/src/entities/AmazonBook.ts` | 削除 | 検索型定義は不要 |
| `packages/common/src/index.ts` | 修正 | AmazonBook関連のexportを削除 |
| `firestore.rules` | 修正 | title, coverImageUrlをnull許容に |
| `apps/functions/src/triggers/onCreateBook.ts` | 修正 | title, coverImageUrlも取得・更新 |
| `apps/functions/src/lib/amazon.ts` | 修正 | fetchAmazonBookDetailにtitle/coverImageUrl取得を追加、searchAmazonBooks削除 |
| `apps/functions/src/api/books/searchBooks.ts` | 削除 | 検索APIは廃止 |
| `apps/functions/src/router.ts` | 修正 | `/books/search` ルートを削除 |
| `apps/web/src/features/books/schemas/bookSchema.ts` | 修正 | title削除、amazonUrl必須に |
| `apps/web/src/features/books/hooks/useCreateBookMutation.ts` | 修正 | title/coverImageUrl削除、nullで作成 |
| `apps/web/src/features/books/hooks/useSearchBooks.ts` | 削除 | 検索フック不要 |
| `apps/web/src/features/books/components/BookSearchResultGrid.tsx` | 削除 | 検索結果グリッド不要 |
| `apps/web/src/features/books/components/BookRegistrationModal.tsx` | 削除 | モーダル不要（フォームはnew.tsxに配置） |
| `apps/web/src/routes/_authed/new.tsx` | 全面変更 | URL入力+メタ情報のシンプルフォームに |
| `apps/web/src/features/books/components/BookCard.tsx` | 修正 | title/coverImageUrl null対応 |
| `apps/web/src/lib/api.ts` | 削除検討 | 他で使われていなければ削除 |

---

## 検証方法

1. **登録フロー**: `/new` にアクセス → AmazonのURLを入力 → タグ等を入力 → 送信 → Firestoreにドキュメントが作成されること（title/author/coverImageUrl/pagesはnull）
2. **トリガー動作**: 本の登録後、数秒〜十数秒後にFirestoreコンソールでtitle/author/coverImageUrl/pagesが更新されていること
3. **一覧表示**: 登録直後はtitle/coverImageUrlがnullの状態で表示され、トリガー完了後にリアルタイムで表示が更新されること
4. **バリデーション**: amazonUrl空で送信 → エラーメッセージが表示されること
5. **ビルド確認**: `pnpm web build` と `pnpm functions pre-build` が通ること
