# FR-BOOK-004: スクレイピングステータスの追加 実装計画

## Context

本の登録時にonCreateBookトリガーでAmazonスクレイピングが非同期実行されるが、現在はスクレイピングの進行状態がトラッキングされていない。ユーザーは登録直後にtitle/coverImageUrlがnullの状態を見ることになるが、それがスクレイピング中なのか失敗なのか区別できない。

`scrapingStatus` フィールド（`'scraping' | 'completed' | 'failed'`）を追加し、フロントエンドのBookCardで状態に応じた表示を行う。

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: Book エンティティの型定義変更（common） | 実装済み |
| Task 2: Firestore セキュリティルール更新 | 実装済み |
| Task 3: onCreateBookトリガーの修正（functions） | 実装済み |
| Task 4: useCreateBookMutation の修正（web） | 実装済み |
| Task 5: BookCard のステータス表示対応（web） | 実装済み |
| Task 6: ドキュメント更新 | 実装済み |
| Task 7: ビルド確認 | 実装済み |

---

## 実装タスク

### Task 1: Book エンティティの型定義変更（common）

**ファイル:** `packages/common/src/entities/Book.ts`

ScrapingStatus型を追加し、BookエンティティおよびDTO型にscrapingStatusフィールドを追加する。

```typescript
/** スクレイピングの状態 */
export type ScrapingStatus = 'scraping' | 'completed' | 'failed'

/** Entity型 */
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
  scrapingStatus: ScrapingStatus  // 追加
  tags: string[]
  title: string | null
  updatedAt: Date
  updatedBy: UpdatedBy
}
```

CreateBookDtoはOmitベースのためBookから自動的に反映される。

UpdateBookDto に追加:
```typescript
scrapingStatus?: Book['scrapingStatus']
```

UpdateBookDtoFromAdmin に追加:
```typescript
scrapingStatus?: Book['scrapingStatus']
```

---

### Task 2: Firestore セキュリティルール更新

**ファイル:** `firestore.rules`

isValidBookSchemaのフィールド数を15→16に変更し、scrapingStatusのバリデーションを追加する。

```javascript
function isValidBookSchema(requestData) {
  return requestData.size() == 16  // 15 → 16
    && 'amazonUrl' in requestData && requestData.amazonUrl is string
    && 'author' in requestData && (requestData.author is string || requestData.author == null)
    && 'coverImageUrl' in requestData && (requestData.coverImageUrl is string || requestData.coverImageUrl == null)
    && 'createdAt' in requestData && requestData.createdAt is timestamp
    && 'foundBy' in requestData && requestData.foundBy is string
    && 'groups' in requestData && requestData.groups is list
    && 'isRead' in requestData && requestData.isRead is bool
    && 'location' in requestData && requestData.location is string
    && 'note' in requestData && requestData.note is string
    && 'pages' in requestData && (requestData.pages is number || requestData.pages == null)
    && 'purchasedBy' in requestData && requestData.purchasedBy is list
    && 'scrapingStatus' in requestData && requestData.scrapingStatus is string  // 追加
    && 'tags' in requestData && requestData.tags is list
    && 'title' in requestData && (requestData.title is string || requestData.title == null)
    && 'updatedAt' in requestData && requestData.updatedAt is timestamp
    && 'updatedBy' in requestData && requestData.updatedBy is string;
}
```

---

### Task 3: onCreateBookトリガーの修正（functions）

**ファイル:** `apps/functions/src/triggers/onCreateBook.ts`

スクレイピング結果に応じてscrapingStatusを更新する。

**成功時（スクレイピング結果あり）:**
```typescript
const updateDto: UpdateBookDtoFromAdmin = {
  scrapingStatus: 'completed',  // 追加
  updatedAt: serverTimestamp,
  updatedBy: 'trigger' as const,
}
// ... title, author, coverImageUrl, pages の設定
```

**データ取得失敗時（全フィールド未取得）:**
```typescript
if (!detail.title && !detail.author && !detail.coverImageUrl && detail.pages === 0) {
  console.log('本の情報を取得できませんでした:', bookId)
  await updateBookOperation(uid, bookId, {
    scrapingStatus: 'failed',
    updatedAt: serverTimestamp,
    updatedBy: 'trigger' as const,
  })
  return
}
```

**例外発生時（catchブロック）:**
```typescript
catch (error) {
  console.error('Amazon詳細ページのスクレイピングに失敗:', bookId, error)
  try {
    await updateBookOperation(uid, bookId, {
      scrapingStatus: 'failed',
      updatedAt: serverTimestamp,
      updatedBy: 'trigger' as const,
    })
  } catch (updateError) {
    console.error('scrapingStatus更新にも失敗:', bookId, updateError)
  }
}
```

**amazonUrl未設定時:**
```typescript
if (!amazonUrl) {
  console.log('amazonUrl が存在しないためスキップ:', bookId)
  await updateBookOperation(uid, bookId, {
    scrapingStatus: 'failed',
    updatedAt: serverTimestamp,
    updatedBy: 'trigger' as const,
  })
  return
}
```

---

### Task 4: useCreateBookMutation の修正（web）

**ファイル:** `apps/web/src/features/books/hooks/useCreateBookMutation.ts`

dtoにscrapingStatusを追加する。

```typescript
const dto: CreateBookDto = {
  ...input,
  title: null,
  author: null,
  coverImageUrl: null,
  pages: null,
  isRead: false,
  scrapingStatus: 'scraping',  // 追加
  createdAt: serverTimestamp,
  updatedAt: serverTimestamp,
  updatedBy: 'user' as const,
}
```

---

### Task 5: BookCard のステータス表示対応（web）

**ファイル:** `apps/web/src/features/books/components/BookCard.tsx`

scrapingStatusに応じてBookCardの画像エリアの表示を切り替える。
既存データ（scrapingStatusが未設定）は `'completed'` として扱う。

```tsx
import { Spinner } from '@/components/ui/spinner'

export const BookCard = ({ book, onClick }: BookCardProps) => {
  const scrapingStatus = book.scrapingStatus ?? 'completed'

  return (
    <button ...>
      {scrapingStatus === 'scraping' ? (
        <div className="flex h-[calc(100%-32px)] w-full flex-col items-center justify-center gap-2 bg-muted">
          <Spinner className="size-6" />
          <span className="text-xs text-muted-foreground">取得中...</span>
        </div>
      ) : book.coverImageUrl ? (
        <img
          src={book.coverImageUrl}
          alt={book.title ?? ''}
          className="h-[calc(100%-32px)] w-full object-contain"
        />
      ) : scrapingStatus === 'failed' ? (
        <div className="flex h-[calc(100%-32px)] w-full flex-col items-center justify-center gap-1 bg-destructive/10">
          <span className="text-xs text-destructive">取得失敗</span>
        </div>
      ) : (
        <div className="flex h-[calc(100%-32px)] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No Image
        </div>
      )}
      {/* タグ表示・読了バッジは変更なし */}
    </button>
  )
}
```

---

### Task 6: ドキュメント更新

**ファイル:** `firestore-design.md`

booksコレクションの「### 詳細」セクションにscrapingStatusフィールドを追記する。

```markdown
- scrapingStatus: String スクレイピングの状態（scraping: 取得中, completed: 完了, failed: 失敗）
```

---

### Task 7: ビルド確認

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
Step 2: Task 2（Firestoreルール）+ Task 3（トリガー修正）+ Task 4（フロント作成）
    ↓
Step 3: Task 5（BookCard表示対応）
    ↓
Step 4: Task 6（ドキュメント更新）
    ↓
Step 5: Task 7（ビルド確認）
```

---

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/Book.ts` | 修正 | ScrapingStatus型追加、Book/DTO型にscrapingStatusフィールド追加 |
| `firestore.rules` | 修正 | isValidBookSchemaにscrapingStatusバリデーション追加、size 15→16 |
| `apps/functions/src/triggers/onCreateBook.ts` | 修正 | スクレイピング結果に応じてscrapingStatus更新 |
| `apps/web/src/features/books/hooks/useCreateBookMutation.ts` | 修正 | dtoにscrapingStatus: 'scraping'追加 |
| `apps/web/src/features/books/components/BookCard.tsx` | 修正 | scrapingStatusに応じた表示切り替え |
| `firestore-design.md` | 修正 | scrapingStatusフィールドを追記 |

---

## 注意事項

- **既存データ**: Firestoreの既存ドキュメントには`scrapingStatus`が存在しない。フロントエンドでは `book.scrapingStatus ?? 'completed'` でフォールバックする
- **同時デプロイ必須**: Firestoreルールの `size() == 16` とクライアントコード（`scrapingStatus` を含むCreateBookDto）は同時にデプロイすること。ずれると本の登録が失敗する
- **catch内の二重失敗**: onCreateBookのcatchブロック内でupdateBookOperationを呼ぶが、これも失敗する可能性があるためtry-catchでラップする
- **リアルタイム更新**: subscribeBooksOperationによるリアルタイム購読があるため、トリガーが`scrapingStatus`を更新すればBookCardは自動で再描画される

---

## 検証方法

1. **正常系**: 本を新規登録 → BookCardに「取得中...」+Spinnerが表示される → 数秒後にスクレイピング完了 → リアルタイムで表紙画像に切り替わる
2. **失敗系**: 無効なURLで登録 → 「取得失敗」表示になる
3. **既存データ**: 既存の本のBookCardが正常に表示される（`scrapingStatus`未設定でも`completed`扱い）
4. **ビルド**: `pnpm web build` と `pnpm functions pre-build` が通ること
