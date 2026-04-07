<!-- @format -->

# FR-BOOK-001: 本の登録機能 実装計画

## Context

BookPoolContexts の中核機能として、読みたい本を検索して登録できるようにする。

ユーザーは本のタイトルで検索し、Cloud Functions上でAmazon.co.jpの検索ページをスクレイピングした結果がグリッド表示される（タイトル+サムネイル）。追加したい本をタップするとモーダルが開き、著者やタグなどの追加情報を入力して送信するとFirestoreに登録される。

PA-API 5.0はアソシエイト登録+売上実績が必要で現実的ではないため、puppeteer-core + @sparticuz/chromium によるスクレイピング方式を採用する。

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: Amazon検索レスポンス型定義（common） | 実装済み → 修正必要 |
| Task 2: Amazonスクレイピングクライアント（Functions側） | 実装済み → 全面書き換え |
| Task 3: 本の検索APIエンドポイント（Functions側） | 実装済み |
| Task 4: Functions設定（メモリ増量、secrets削除） | 実装済み → 修正必要 |
| Task 5: フロントエンド認証付きfetchユーティリティ | 実装済み |
| Task 6: useSearchBooks フック | 実装済み |
| Task 7: useCreateBookMutation フック | 実装済み |
| Task 8: 検索結果グリッドコンポーネント | 実装済み → 修正必要 |
| Task 9: 本の登録モーダルコンポーネント | 実装済み → 修正必要 |
| Task 10: /new ルートページ | 実装済み → 修正必要 |

---

## 実装タスク

### Task 1: Amazon検索レスポンス型定義（common）

**ファイル:** `packages/common/src/entities/AmazonBook.ts`（修正）

スクレイピングでは検索結果一覧からタイトルとサムネイルのみ安定取得できる。author, pagesは検索結果からは取得せず、登録モーダルで手入力とする。

```typescript
// packages/common/src/entities/AmazonBook.ts

/** Amazon検索で取得した本の情報 */
export type AmazonBookItem = {
  asin: string
  title: string
  coverImageUrl: string
}

/** 検索APIレスポンス */
export type SearchBooksResponse = {
  items: AmazonBookItem[]
}
```

---

### Task 2: Amazonスクレイピングクライアント（Functions側）

**ファイル:**

- `apps/functions/src/lib/amazon.ts`（全面書き換え）
- `apps/functions/package.json`（修正: puppeteer-core, @sparticuz/chromium 追加）

puppeteer-core + @sparticuz/chromium を使い、Amazon.co.jp の書籍検索ページをスクレイピングする。

```typescript
// apps/functions/src/lib/amazon.ts
import type { AmazonBookItem } from '@bookpoolcontexts/common'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const searchAmazonBooks = async (
  keyword: string,
): Promise<AmazonBookItem[]> => {
  // 1. @sparticuz/chromium でヘッドレスChromiumを起動
  // 2. https://www.amazon.co.jp/s?k={keyword}&i=stripbooks にアクセス
  // 3. 検索結果の .s-result-item から ASIN, タイトル, サムネイルURLを抽出
  // 4. 最大10件を AmazonBookItem[] として返す
  // 5. ブラウザを閉じる
}
```

**スクレイピング対象のDOM構造:**

| CSSセレクタ | 取得する値 |
|------------|-----------|
| `[data-asin]` 属性 | `asin` |
| `.a-text-normal` のテキスト | `title` |
| `.s-image` の `src` 属性 | `coverImageUrl` |

---

### Task 3: 本の検索APIエンドポイント（Functions側）

**ファイル:**

- `apps/functions/src/api/books/searchBooks.ts`（新規）
- `apps/functions/src/router.ts`（修正）

既存の `apps/functions/src/api/search/searchNotes.ts` と同じパターンで実装する。

**router.ts への追記:**

```typescript
router.post(
  '/books/search',
  authMiddleware,
  [
    check('keyword').isString().notEmpty(),
    check('itemCount').optional().isInt({ min: 1, max: 30 }),
  ],
  require('./api/books/searchBooks').handle,
)
```

**searchBooks.ts:**

```typescript
import type { Response } from 'express'
import { validationResult } from 'express-validator'
import type { AuthenticatedRequest } from '~/middleware/auth'
import { searchAmazonBooks } from '~/lib/amazon'

exports.handle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() })
    }

    const { keyword, itemCount } = req.body
    const items = await searchAmazonBooks(keyword, itemCount)

    return res.status(200).json({ items })
  } catch (error) {
    console.error('Book search failed:', error)
    return res.status(500).json({ error: '本の検索に失敗しました' })
  }
}
```

---

### Task 4: Functions設定（メモリ増量、secrets削除）

**ファイル:** `apps/functions/src/index.ts`（修正）

スクレイピング方式ではAmazon関連のシークレットは不要。代わりにChromium起動のためメモリを`2GiB`に増量する。

```typescript
export const api = onRequest(
  {
    memory: '2GiB',
    invoker: 'public',
    cors: true,
  },
  app,
)
```

---

### Task 5: フロントエンド認証付きfetchユーティリティ

**ファイル:** `apps/web/src/lib/api.ts`（新規）

既存の `apps/web/src/infrastructure/api/searchApi.ts`（削除済み）で使われていたパターンを汎用化する。

```typescript
import { auth } from '@/lib/firebase'

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL

export const authenticatedFetch = async <T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const user = auth.currentUser
  if (!user) throw new Error('認証エラー：再ログインしてください')

  const idToken = await user.getIdToken()

  const response = await fetch(`${FUNCTIONS_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `APIエラー: ${response.status}`)
  }

  return response.json() as Promise<T>
}
```

---

### Task 6: useSearchBooks フック

**ファイル:** `apps/web/src/features/books/hooks/useSearchBooks.ts`（新規）

```typescript
import { useState } from 'react'
import type { AmazonBookItem, SearchBooksResponse } from '@bookpoolcontexts/common'
import { authenticatedFetch } from '@/lib/api'
import { errorMessage } from '@/utils/errorMessage'

export type UseSearchBooksReturn = {
  results: AmazonBookItem[]
  isSearching: boolean
  error: string | null
  search: (keyword: string) => Promise<void>
  clearResults: () => void
}

export const useSearchBooks = (): UseSearchBooksReturn => {
  const [results, setResults] = useState<AmazonBookItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (keyword: string): Promise<void> => {
    if (!keyword.trim()) return
    setIsSearching(true)
    setError(null)
    try {
      const data = await authenticatedFetch<SearchBooksResponse>('/books/search', { keyword })
      setResults(data.items)
    } catch (e) {
      setError(errorMessage(e))
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const clearResults = (): void => {
    setResults([])
    setError(null)
  }

  return { results, isSearching, error, search, clearResults }
}
```

---

### Task 7: useCreateBookMutation フック

**ファイル:** `apps/web/src/features/books/hooks/useCreateBookMutation.ts`（新規）

既存のミューテーションフックパターン（`.claude/rules/firestore.md` 3.3）に従う。

```typescript
import { useState } from 'react'
import { toast } from 'sonner'
import { createBookOperation } from '@/infrastructure/firestore/books'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'
import type { CreateBookDto } from '@bookpoolcontexts/common'

export type CreateBookInput = {
  title: string
  author: string
  coverImageUrl: string
  pages: number
  tags: string[]
  foundBy: string
  location: string
  purchasedBy: string[]
  groups: string[]
  note: string
}

export type UseCreateBookMutationReturn = {
  createBook: (input: CreateBookInput) => Promise<void>
  isCreating: boolean
}

export const useCreateBookMutation = (): UseCreateBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isCreating, setIsCreating] = useState(false)

  const createBook = async (input: CreateBookInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsCreating(true)
    try {
      const dto: CreateBookDto = {
        ...input,
        isRead: false,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      }
      await createBookOperation(uid, dto)
      toast.success('本を登録しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsCreating(false)
    }
  }

  return { createBook, isCreating }
}
```

---

### Task 8: 検索結果グリッドコンポーネント

**ファイル:** `apps/web/src/features/books/components/BookSearchResultGrid.tsx`（新規）

```typescript
import type { AmazonBookItem } from '@bookpoolcontexts/common'
import { Skeleton } from '@/components/ui/skeleton'

type BookSearchResultGridProps = {
  items: AmazonBookItem[]
  isLoading: boolean
  onSelect: (item: AmazonBookItem) => void
}
```

**UI仕様:**

- グリッドレイアウト: `grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4`
- 各カード: 表紙画像（aspect-ratio 2:3）+ タイトル（2行で切り詰め）+ 著者名（1行で切り詰め）
- ローディング中: `Skeleton` で6つのプレースホルダー表示
- 結果0件: 「検索結果がありません」メッセージ
- カードタップで `onSelect(item)` を発火
- ホバー/タップ時のフィードバック（opacity変化やborder変化）

---

### Task 9: 本の登録モーダルコンポーネント

**ファイル:**

- `apps/web/src/features/books/schemas/bookSchema.ts`（新規）
- `apps/web/src/features/books/components/BookRegistrationModal.tsx`（新規）

**Zodスキーマ:**

```typescript
// apps/web/src/features/books/schemas/bookSchema.ts
import { z } from 'zod'

export const bookRegistrationSchema = z.object({
  title: z.string().min(1, 'タイトルは必須で��').max(200),
  author: z.string().min(1, '著者は必須です').max(100),
  coverImageUrl: z.string(),
  pages: z.number().int().min(0).default(0),
  tags: z.array(z.string().max(50)).max(10).default([]),
  foundBy: z.string().max(500).default(''),
  location: z.string().max(200).default(''),
  purchasedBy: z.array(z.string()).default([]),
  groups: z.array(z.string()).default([]),
  note: z.string().max(2000).default(''),
})

export type BookRegistrationFormValues = z.infer<typeof bookRegistrationSchema>
```

**コンポーネント設計:**

```typescript
type BookRegistrationModalProps = {
  isOpen: boolean
  onClose: () => void
  defaultValues: Partial<BookRegistrationFormValues>
  onSuccess: () => void
}
```

- `react-hook-form` + `zodResolver` でフォーム管理
- `defaultValues` でAmazon検索結果のtitle, author, coverImageUrl, pagesをプリフィル
- `useEffect` でモーダルが開くたびに `reset(defaultValues)` を呼ぶ
- タグ入力は既存の `TagSuggestionDropdown`（`apps/web/src/features/tags/components/TagSuggestionDropdown.tsx`）を再利用
- グループ選択は既存グループからの複数選択UI
- purchasedByはチェックボックス（物理本 / Kindle / オフィス）
- 使用UIコンポーネント: Dialog, Input, Label, Button, Textarea, Badge, Checkbox

---

### Task 10: /new ルートページ

**ファイル:** `apps/web/src/routes/_authed/new.tsx`（新規）

`_authed` レイアウト配下のため認証は自動保護される。

**ページ構成:**

```
┌─────────────────────────────────────────────┐
│  [←戻る]             本を登録               │
├─────────────────────────────────────────────┤
│                                             │
│  検索バー [Input          ] [検索ボタン]    │
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ 表紙 │  │ 表紙 │  │ 表紙 │  │ 表紙 │   │
│  │      │  │      │  │      │  │      │   │
│  │タイトル│ │タイトル│ │タイトル│ │タイトル│  │
│  │ 著者 │  │ 著者 │  │ 著者 │  │ 著者 │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ ...  │  │ ...  │  │ ...  │  │ ...  │   │
│  └──────┘  └──────┘  └──────┘  └──────┘   │
│                                             │
│  [登録モーダル（本を選択時に表示）]          │
└─────────────────────────────────────────────┘
```

**状態管理:**

```typescript
const { results, isSearching, error, search, clearResults } = useSearchBooks()
const { isOpen, open, close } = useDisclosure()
const [selectedBook, setSelectedBook] = useState<AmazonBookItem | null>(null)
const { createBook, isCreating } = useCreateBookMutation()
const navigate = useNavigate()

const handleSelect = (item: AmazonBookItem) => {
  setSelectedBook(item)
  open()
}

const handleSuccess = () => {
  close()
  navigate({ to: '/' })
}
```

**フロー:**
1. 検索バーにキーワード入力 → 検索ボタン押下（またはEnter）
2. `search(keyword)` → ローディング表示 → グリッド表示
3. 本をタップ → `selectedBook` を設定 → モーダル表示
4. モーダルでフォーム入力 → 送信 → `createBook()` → 成功時にトースト + 一覧へ遷移

---

## 実装順序（修正作業）

Task 3, 5, 6, 7 は変更不要。以下の順で修正する：

```
Step 1: Task 1（型定義修正）+ Task 2（puppeteerスクレイピングに書き換え）+ Task 4（index.ts修正）
    ↓
Step 2: Task 8, 9, 10（フロントエンドのauthor/pages参照を調整）
    ↓
Step 3: ビルド確認
```

---

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/AmazonBook.ts` | 修正 | author, pages を削除 |
| `apps/functions/package.json` | 修正 | puppeteer-core, @sparticuz/chromium 追加 |
| `apps/functions/src/lib/amazon.ts` | 書き換え | PA-API → puppeteerスクレイピング |
| `apps/functions/src/index.ts` | 修正 | secrets からAMAZON_*削除、memory を 2GiB に |
| `apps/web/src/features/books/components/BookSearchResultGrid.tsx` | 修正 | 著者表示を削除 |
| `apps/web/src/features/books/components/BookRegistrationModal.tsx` | 修正 | defaultValues からauthor, pagesプリフィル除去 |
| `apps/web/src/routes/_authed/new.tsx` | 修正 | selectedBook のマッピング調整 |

---

## 検証方法

1. **Functions API 単体テスト**: Firebase エミュレーターで `POST /books/search` を curl で叩き、Amazon検索結果が返ることを確認
2. **フロントエンド検索**: `/new` にアクセス → キーワード入力 → 検索 → グリッドに表紙画像とタイトルが表示されること
3. **���録フロー**: グリッドから本を選択 → モーダルでtitle/authorがプリフィルされていること → 追加情報を入力 → 送信 → Firestore にドキュメントが作成されること
4. **バリデーション**: タイトル空・著者空で送信 → エラーメッセージが表示されること
5. **エラーケース**: 存在しないキーワードで検索 → 空のグリッド + メッセージ表示
6. **ビルド確認**: `pnpm web build` と `pnpm functions pre-build` が通ること
