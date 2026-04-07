# FR-BOOK-002: 本の登録時にAmazon詳細ページから著者名・ページ数を自動取得する

## Context

現在、本の登録時に `author` は空文字、`pages` は 0 がハードコードされている。ユーザーが手入力する必要があり不便。

Amazon検索結果から本を選択した際に、その本のAmazon詳細ページURL（ASINから生成可能）をBookエンティティに保存し、Cloud FunctionsのFirestoreトリガー（onCreateBook）で詳細ページをスクレイピングして著者名・ページ数を自動取得・保存する。

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: Book エンティティに `amazonUrl` フィールドを追加 | 実装済み |
| Task 2: AmazonBookItem に `amazonUrl` を追加 | 実装済み |
| Task 3: Amazon検索スクレイピングで URL も返す | 実装済み |
| Task 4: フロントエンド - 登録時に `amazonUrl` を保存する | 実装済み |
| Task 5: Functions - Amazon詳細ページスクレイピング関数 | 実装済み |
| Task 6: Functions - Firestore operations（books） | 実装済み |
| Task 7: Functions - onCreateBook トリガー | 実装済み |
| Task 8: Firestore セキュリティルール更新 | 実装済み |

---

## 実装タスク

### Task 1: Book エンティティに `amazonUrl` フィールドを追加 + `author`/`pages` を null 許容に変更

**ファイル:** `packages/common/src/entities/Book.ts`

- `amazonUrl` フィールドを追加
- `author` を `string` → `string | null` に変更（フロントエンドでは null で保存し、トリガーで値を埋める）
- `pages` を `number` → `number | null` に変更（同上）

```typescript
// Book entity
export type Book = {
  // ...既存フィールド
  amazonUrl: string   // 追加
  author: string | null  // 変更: string → string | null
  pages: number | null   // 変更: number → number | null
}

// CreateBookDto は Omit ベースなので自動的に含まれる

// UpdateBookDto
export type UpdateBookDto = {
  // ...既存フィールド
  amazonUrl?: Book['amazonUrl']  // 追加
}

// UpdateBookDtoFromAdmin
export type UpdateBookDtoFromAdmin = {
  author?: Book['author']
  coverImageUrl?: Book['coverImageUrl']
  pages?: Book['pages']
  amazonUrl?: Book['amazonUrl']  // 追加
  title?: Book['title']
  updatedAt: AdminFieldValue
}
```

---

### Task 2: AmazonBookItem に `amazonUrl` を追加

**ファイル:** `packages/common/src/entities/AmazonBook.ts`

検索結果の各アイテムにAmazon詳細ページURLを含める。URLは `https://www.amazon.co.jp/dp/{asin}` の形式で生成する。

```typescript
export type AmazonBookItem = {
  asin: string
  title: string
  coverImageUrl: string
  amazonUrl: string  // 追加
}
```

---

### Task 3: Amazon検索スクレイピングで URL も返す

**ファイル:** `apps/functions/src/lib/amazon.ts`

`searchAmazonBooks` 関数の `page.evaluate` 内で、ASINから `amazonUrl` を生成して返すように修正する。

```typescript
// page.evaluate 内の results.push を修正
results.push({
  asin,
  title,
  coverImageUrl,
  amazonUrl: `https://www.amazon.co.jp/dp/${asin}`,
})
```

---

### Task 4: フロントエンド - 登録時に `amazonUrl` を保存する

以下のファイルを修正する。

**ファイル:**
- `apps/web/src/features/books/hooks/useCreateBookMutation.ts`
- `apps/web/src/features/books/schemas/bookSchema.ts`
- `apps/web/src/features/books/components/BookRegistrationModal.tsx`
- `apps/web/src/routes/_authed/new.tsx`

#### 4-1: Zodスキーマに `amazonUrl` を追加

```typescript
// apps/web/src/features/books/schemas/bookSchema.ts
export const bookRegistrationSchema = z.object({
  // ...既存フィールド
  amazonUrl: z.string().default(''),  // 追加
})
```

#### 4-2: CreateBookInput に `amazonUrl` を追加

```typescript
// apps/web/src/features/books/hooks/useCreateBookMutation.ts
export type CreateBookInput = {
  // ...既存フィールド
  amazonUrl: string  // 追加
}
```

`useCreateBookMutation` 内の dto 構築では、`author: null` と `pages: null` をセットする（トリガーが自動取得するため、初期値は null）。`amazonUrl` は input から渡される。

#### 4-3: BookRegistrationModal で `amazonUrl` をフォームに含める

- `amazonUrl` はhiddenフィールドとして保持する（ユーザーに表示しない）
- `defaultValues` と `reset` 時に `amazonUrl` を含める

```typescript
// BookRegistrationModal.tsx の reset 部分
reset({
  title: defaultValues.title ?? '',
  coverImageUrl: defaultValues.coverImageUrl ?? '',
  amazonUrl: defaultValues.amazonUrl ?? '',  // 追加
  tags: [],
  foundBy: '',
  location: '',
  purchasedBy: [],
  groups: [],
  note: '',
})
```

#### 4-4: /new ルートページで `amazonUrl` を defaultValues に渡す

```typescript
// apps/web/src/routes/_authed/new.tsx
<BookRegistrationModal
  isOpen={isOpen}
  onClose={close}
  defaultValues={{
    title: selectedBook.title,
    coverImageUrl: selectedBook.coverImageUrl,
    amazonUrl: selectedBook.amazonUrl,  // 追加
  }}
  onSuccess={handleSuccess}
/>
```

---

### Task 5: Functions - Amazon詳細ページスクレイピング関数

**ファイル:** `apps/functions/src/lib/amazon.ts`

新しい関数 `fetchAmazonBookDetail` を追加する。Amazon詳細ページから著者名とページ数を取得する。

```typescript
export type AmazonBookDetail = {
  author: string
  pages: number
}

/**
 * Amazon詳細ページから著者名とページ数を取得する
 * @param amazonUrl Amazon詳細ページのURL
 * @returns 著者名とページ数
 */
export const fetchAmazonBookDetail = async (
  amazonUrl: string,
): Promise<AmazonBookDetail> => {
  const browser = await puppeteer.launch({
    args: isLocal
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: isLocal
      ? getLocalChromePath()
      : await chromium.executablePath(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )
    await page.goto(amazonUrl, { waitUntil: 'networkidle2', timeout: 20000 })

    const detail = await page.evaluate(() => {
      // 著者名を取得
      // パターン1: .author a タグ
      // パターン2: #bylineInfo .author a
      // パターン3: .contributorNameID
      const authorEl =
        document.querySelector('#bylineInfo .author a') ??
        document.querySelector('.author a') ??
        document.querySelector('.contributorNameID')
      const author = authorEl?.textContent?.trim() ?? ''

      // ページ数を取得
      // 商品詳細テーブルまたは詳細情報セクションから取得
      let pages = 0
      // パターン1: 詳細情報テーブルの「ページ数」行
      const detailItems = document.querySelectorAll('#detailBullets_feature_div li span.a-list-item')
      for (const item of detailItems) {
        const text = item.textContent ?? ''
        const match = text.match(/(\d+)\s*ページ/)
        if (match) {
          pages = parseInt(match[1], 10)
          break
        }
      }
      // パターン2: 商品情報テーブル
      if (pages === 0) {
        const tableRows = document.querySelectorAll('#productDetailsTable tr, .detail-bullet-list li')
        for (const row of tableRows) {
          const text = row.textContent ?? ''
          const match = text.match(/(\d+)\s*ページ/)
          if (match) {
            pages = parseInt(match[1], 10)
            break
          }
        }
      }

      return { author, pages }
    })

    return detail
  } finally {
    await browser.close()
  }
}
```

**スクレイピング対象のDOM構造（推定）:**

| CSSセレクタ | 取得する値 |
|------------|-----------|
| `#bylineInfo .author a` | 著者名 |
| `#detailBullets_feature_div li` の `{数字}ページ` | ページ数 |

**注意:** Amazon のDOM構造は変更される可能性があるため、複数のセレクタパターンでフォールバックする。取得できなかった場合は空文字/0を返す（エラーにはしない）。

---

### Task 6: Functions - Firestore operations（books）

**ファイル:** `apps/functions/src/infrastructure/firestore/books.ts`（新規作成）

firebase-admin を使用した Books コレクションの更新用 operation を作成する。

```typescript
import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'
import { bookCollection } from '@bookpoolcontexts/common'
import { db } from '~/lib/firebase'

/** Bookドキュメントを更新する */
export const updateBookOperation = async (
  uid: string,
  bookId: string,
  dto: UpdateBookDtoFromAdmin,
): Promise<void> => {
  await db
    .collection('users')
    .doc(uid)
    .collection(bookCollection)
    .doc(bookId)
    .update(dto)
}
```

---

### Task 7: Functions - onCreateBook トリガー

**ファイル:**
- `apps/functions/src/triggers/onCreateBook.ts`（新規作成）
- `apps/functions/src/index.ts`（修正: export追加）

onCreateNote のパターンに倣い、Firestoreトリガーで本の作成を検知し、`amazonUrl` が存在する場合に詳細ページをスクレイピングして `author` と `pages` を更新する。

```typescript
// apps/functions/src/triggers/onCreateBook.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { fetchAmazonBookDetail } from '~/lib/amazon'
import { updateBookOperation } from '~/infrastructure/firestore/books'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'
import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'

export const onCreateBook = onDocumentCreated(
  {
    document: 'users/{uid}/books/{bookId}',
    memory: '2GiB',  // Puppeteer使用のためメモリ増量
    region: 'asia-northeast1',
  },
  triggerOnce('onCreateBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const data = event.data.data()
    const amazonUrl = data.amazonUrl as string

    if (!amazonUrl) {
      console.log('amazonUrl が存在しないためスキップ:', bookId)
      return
    }

    try {
      const detail = await fetchAmazonBookDetail(amazonUrl)

      const updateDto: UpdateBookDtoFromAdmin = {
        updatedAt: serverTimestamp,
      }

      if (detail.author) {
        updateDto.author = detail.author
      }
      if (detail.pages > 0) {
        updateDto.pages = detail.pages
      }

      // author も pages も取得できなかった場合は更新しない
      if (!detail.author && detail.pages === 0) {
        console.log('著者名・ページ数ともに取得できませんでした:', bookId)
        return
      }

      await updateBookOperation(uid, bookId, updateDto)
      console.log('Book詳細情報を更新しました:', bookId, detail)
    } catch (error) {
      console.error('Amazon詳細ページのスクレイピングに失敗:', bookId, error)
      // エラーでも本の登録自体は成功しているため、リスローしない
    }
  }),
)
```

**index.ts に export を追加:**

```typescript
// apps/functions/src/index.ts
export { onCreateBook } from './triggers/onCreateBook'
```

**重要:** `onCreateBook` トリガーは Puppeteer を使用するため、`memory: '2GiB'` を指定する。

---

### Task 8: Firestore セキュリティルール更新

**ファイル:** `firestore.rules`

Book のスキーマバリデーションに `amazonUrl` フィールドを追加する。フィールド数が 13 → 14 に増加。

```javascript
function isValidBookSchema(requestData) {
  return requestData.size() == 14
    && 'amazonUrl' in requestData && requestData.amazonUrl is string  // 追加
    && 'author' in requestData && (requestData.author is string || requestData.author == null)  // 変更: null許容
    && 'coverImageUrl' in requestData && requestData.coverImageUrl is string
    && 'createdAt' in requestData && requestData.createdAt is timestamp
    && 'foundBy' in requestData && requestData.foundBy is string
    && 'groups' in requestData && requestData.groups is list
    && 'isRead' in requestData && requestData.isRead is bool
    && 'location' in requestData && requestData.location is string
    && 'note' in requestData && requestData.note is string
    && 'pages' in requestData && (requestData.pages is number || requestData.pages == null)  // 変更: null許容
    && 'purchasedBy' in requestData && requestData.purchasedBy is list
    && 'tags' in requestData && requestData.tags is list
    && 'title' in requestData && requestData.title is string
    && 'updatedAt' in requestData && requestData.updatedAt is timestamp;
}
```

**注意:** update ルールのスキーマバリデーションについて、admin SDKからの更新（トリガー）はセキュリティルールをバイパスするため、クライアント側の update はこのスキーマに合致する必要がある。既存の `allow update` ルールは全フィールドを要求しているため、クライアント側の更新が `updateDoc` で部分更新する場合、security rules は request.resource.data（マージ後）を見るので問題ない。

---

## 実装順序

```
Step 1: Task 1 + Task 2（型定義の変更）
    ↓
Step 2: Task 3（検索スクレイピングの修正）
    ↓
Step 3: Task 4（フロントエンドの修正）
    ↓
Step 4: Task 5 + Task 6（Functions側のスクレイピング関数とoperations）
    ↓
Step 5: Task 7（トリガー関数）
    ↓
Step 6: Task 8（セキュリティルール）
    ↓
Step 7: ビルド確認
```

---

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/Book.ts` | 修正 | `amazonUrl` フィールド追加 |
| `packages/common/src/entities/AmazonBook.ts` | 修正 | `amazonUrl` フィールド追加 |
| `apps/functions/src/lib/amazon.ts` | 修正 | 検索結果にURL追加 + `fetchAmazonBookDetail` 関数追加 |
| `apps/functions/src/infrastructure/firestore/books.ts` | 新規 | `updateBookOperation` |
| `apps/functions/src/triggers/onCreateBook.ts` | 新規 | onCreateBook トリガー |
| `apps/functions/src/index.ts` | 修正 | onCreateBook の export 追加 |
| `apps/web/src/features/books/schemas/bookSchema.ts` | 修正 | `amazonUrl` 追加 |
| `apps/web/src/features/books/hooks/useCreateBookMutation.ts` | 修正 | `amazonUrl` 追加 |
| `apps/web/src/features/books/components/BookRegistrationModal.tsx` | 修正 | `amazonUrl` を hidden で保持 |
| `apps/web/src/routes/_authed/new.tsx` | 修正 | `amazonUrl` を defaultValues に渡す |
| `firestore.rules` | 修正 | Book スキーマに `amazonUrl` 追加 |

---

## 検証方法

1. **型定義の確認**: `pnpm web build` と `pnpm functions pre-build` がビルドエラーなく通ること
2. **検索API**: `/new` でAmazon検索 → 結果の各アイテムに `amazonUrl` が含まれることを確認（DevToolsのNetworkタブ）
3. **本の登録**: 検索結果から本を選択 → 登録 → Firestoreコンソールで `amazonUrl` フィールドが保存されていることを確認
4. **トリガー動作**: 本の登録後、数秒〜十数秒後にFirestoreコンソールで `author` と `pages` が更新されていることを確認
5. **トリガー失敗時**: `amazonUrl` が空の本を登録した場合、トリガーがスキップされエラーにならないこと
6. **セキュリティルール**: クライアント側からの本の登録・更新が引き続き動作すること
