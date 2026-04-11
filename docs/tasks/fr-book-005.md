# FR-BOOK-005: Amazon HTMLを直接貼り付けて本を登録する 実装計画

## Context

現状の本登録フローは、ユーザーが `amazonUrl` を入力 → Firestoreに保存 → `onCreateBook` トリガーが Puppeteer で Amazon 詳細ページをスクレイピングして title/author/coverImageUrl/pages を取得する、という流れになっている。

しかし Amazon はボット検知（CAPTCHA、503）やDOM変更などでスクレイピングが失敗することがあり、`scrapingStatus === 'failed'` となって本の情報が取得できないケースが発生する。

そこでユーザーが自分のブラウザで開いた Amazon 詳細ページの HTML をコピー＆ペーストして登録時に送れる選択肢を追加する。HTML が送られた場合はフロントエンドのカスタムフック内で `DOMParser` を使って必要情報を抽出し、Firestoreに保存する。`scrapingStatus` には新しい値 `'skipped'` をセットし、`onCreateBook` トリガー側ではスクレイピング処理を完全にスキップする。

## 現状の確認

- `ScrapingStatus` 型は既に存在: `'scraping' | 'completed' | 'failed'` → `'skipped'` を追加する
- `scrapingStatus` フィールドは Book エンティティに必須として存在
- `firestore.rules` で `scrapingStatus is string` としてバリデーション済み（値の制限はルール側では行っていないので、型変更のみでOK）
- サーバー側のAmazonスクレイピング（`apps/functions/src/lib/amazon.ts`）のDOMセレクタはフロント側のHTMLパースに再利用可能

## 設計上の決定事項（ユーザー確認済み）

| 項目 | 決定 |
|------|------|
| `scrapingStatus` に追加する値 | `'skipped'` |
| HTML入力UI | 登録モーダルに `Textarea` を追加、URL欄と並記 |
| URL / HTML の必須要件 | URL または HTML のいずれか一方が必須 |
| `scrapingStatus` の決定基準 | **HTMLの有無のみで決定**。HTMLあり→`skipped`、HTMLなし→`scraping`。URLが一緒に入力されていても、HTMLが入っていればスクレイピングはしない |
| HTML解析失敗時の扱い | HTMLあり＆解析失敗でも `scrapingStatus: 'skipped'` とし、`title`等はnullのまま保存（URLへのフォールバックはしない） |

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: `ScrapingStatus` 型に `'skipped'` を追加 | 未着手 |
| Task 2: Amazon HTML パースユーティリティの新規作成 | 未着手 |
| Task 3: Zodスキーマの更新 | 未着手 |
| Task 4: `useCreateBookMutation` の更新 | 未着手 |
| Task 5: 登録モーダルに HTML 入力欄を追加 | 未着手 |
| Task 6: `onCreateBook` トリガーで `skipped` をスキップする | 未着手 |
| Task 7: BookCard の確認（変更不要見込み） | 未着手 |
| Task 8: `firestore.rules` の確認（変更不要見込み） | 未着手 |
| Task 9: ビルド確認 | 未着手 |

---

## 登録時のフロー（新）

`scrapingStatus` は **HTMLの有無のみ** で決定する。URLが同時に入力されていてもHTMLが入っていればスクレイピングはしない（ユーザーがHTMLを貼った＝「自分で情報を渡したいので自動取得は不要」という意思表示）。

```
[ユーザー入力] amazonUrl and/or amazonHtml, その他メタ情報
    ↓
[Zod バリデーション] URLまたはHTMLのいずれかが入力されていること
    ↓
[useCreateBookMutation]
  if amazonHtml が入力されている:
    // HTMLがあれば必ず skipped（URLの有無は問わない）
    parsed = parseAmazonHtml(amazonHtml)
    → title/author/coverImageUrl/pages を parsed の値でセット
      （解析に失敗したフィールドは null のまま）
    → scrapingStatus: 'skipped'
  else:
    // HTMLなし、URLのみ（従来通り）
    → すべて null, scrapingStatus: 'scraping'
    ↓
[Firestore に保存]（amazonHtmlは保存しない、フィールドはamazonUrlのみ）
    ↓
[onCreateBook トリガー]
  if scrapingStatus === 'skipped':
    → スクレイピング処理をスキップ、グループcount同期のみ実行
  else:
    → 従来通りスクレイピング実行（success→'completed' / 失敗→'failed'）
```

---

## 実装タスク

### Task 1: `ScrapingStatus` 型に `'skipped'` を追加

**ファイル:** `packages/common/src/entities/Book.ts`

```ts
export type ScrapingStatus = 'scraping' | 'completed' | 'failed' | 'skipped'
```

他の Book / DTO 型は既に `scrapingStatus` を持っているため、型追加のみで波及する。

---

### Task 2: Amazon HTML パースユーティリティの新規作成

**ファイル（新規）:** `apps/web/src/features/books/utils/parseAmazonHtml.ts`

ブラウザ組み込みの `DOMParser` を使用し、`apps/functions/src/lib/amazon.ts`（行 134-183）と同じセレクタでデータを抽出する。

```ts
export type ParsedAmazonBook = {
  title: string | null
  author: string | null
  coverImageUrl: string | null
  pages: number | null
}

/**
 * Amazon詳細ページのHTMLから本の情報を抽出する
 * 抽出できなかったフィールドは null を返す
 */
export const parseAmazonHtml = (html: string): ParsedAmazonBook => {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // タイトル
  const titleEl =
    doc.querySelector('#productTitle') ??
    doc.querySelector('#ebooksProductTitle')
  const title = titleEl?.textContent?.trim() || null

  // 著者名
  const authorEl =
    doc.querySelector('#bylineInfo .author a') ??
    doc.querySelector('.author a') ??
    doc.querySelector('.contributorNameID')
  const author = authorEl?.textContent?.trim() || null

  // 表紙画像URL
  const imgEl =
    (doc.querySelector('#imgTagWrapperId img') as HTMLImageElement | null) ??
    (doc.querySelector('#landingImage') as HTMLImageElement | null) ??
    (doc.querySelector('#imgBlkFront') as HTMLImageElement | null) ??
    (doc.querySelector('#ebooksImgBlkFront') as HTMLImageElement | null) ??
    (doc.querySelector('#main-image-container img') as HTMLImageElement | null)
  // DOMParserではsrcが評価されないためgetAttributeを使う
  const coverImageUrl =
    imgEl?.getAttribute('src') ||
    imgEl?.getAttribute('data-old-hires') ||
    null

  // ページ数
  let pages: number | null = null
  const detailItems = doc.querySelectorAll(
    '#detailBullets_feature_div li span.a-list-item',
  )
  for (const item of detailItems) {
    const match = (item.textContent ?? '').match(/(\d+)\s*ページ/)
    if (match) {
      pages = Number.parseInt(match[1], 10)
      break
    }
  }
  if (pages === null) {
    const rows = doc.querySelectorAll(
      '#productDetailsTable tr, .detail-bullet-list li',
    )
    for (const row of rows) {
      const match = (row.textContent ?? '').match(/(\d+)\s*ページ/)
      if (match) {
        pages = Number.parseInt(match[1], 10)
        break
      }
    }
  }

  return { title, author, coverImageUrl, pages }
}
```

**注記:** `scrapingStatus` の決定は HTML の有無だけで行う方針のため、解析が空振り（全フィールド null）だった場合でも `skipped` として保存する。有効性を判定する `isValidParsedAmazonBook` は不要になった。

**注意点:**
- ブラウザの `DOMParser.parseFromString('...', 'text/html')` で `<img>` の `src` がスキームに応じて評価されないことがあるため、`getAttribute('src')` を使う
- `data-old-hires` 属性に高解像度URLが入っていることがあるためフォールバックに使う
- ページ数セレクタは functions 側と完全一致させる（将来のメンテ性）

---

### Task 3: Zodスキーマの更新

**ファイル:** `apps/web/src/features/books/schemas/bookSchema.ts`

```ts
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
  })
  .refine(
    (data) => data.amazonUrl.trim() !== '' || data.amazonHtml.trim() !== '',
    {
      message: 'AmazonのURLまたはHTMLのいずれかを入力してください',
      path: ['amazonUrl'],
    },
  )
  .refine(
    (data) => {
      if (data.amazonUrl.trim() === '') return true
      try {
        new URL(data.amazonUrl)
        return true
      } catch {
        return false
      }
    },
    { message: '有効なURLを入力してください', path: ['amazonUrl'] },
  )
```

**ポイント:**
- `amazonUrl` は空文字を許容（HTMLのみ入力のケース）
- `amazonHtml` は任意。保存時はDBには含めない
- `refine` で「少なくともどちらか一方」を必須化

---

### Task 4: `useCreateBookMutation` の更新

**ファイル:** `apps/web/src/features/books/hooks/useCreateBookMutation.ts`

```ts
import type { CreateBookDto, ScrapingStatus } from '@bookpoolcontexts/common'
import { parseAmazonHtml } from '@/features/books/utils/parseAmazonHtml'
// ... 既存import

export type CreateBookInput = {
  amazonUrl: string
  amazonHtml: string  // 追加（DB保存しない、パース用のみ）
  tags: string[]
  foundBy: string
  location: string
  purchasedBy: string[]
  groups: string[]
  note: string
}

export const useCreateBookMutation = (): UseCreateBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isCreating, setIsCreating] = useState(false)

  const createBook = async (input: CreateBookInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsCreating(true)
    try {
      // amazonHtml は保存しないため分離
      const { amazonHtml, ...rest } = input

      // scrapingStatus は HTMLの有無だけで決定する。
      // HTMLがあれば URLが一緒に入力されていても skipped（= スクレイピング不要の意思表示）
      const hasHtml = amazonHtml.trim() !== ''

      let title: string | null = null
      let author: string | null = null
      let coverImageUrl: string | null = null
      let pages: number | null = null
      let scrapingStatus: ScrapingStatus = 'scraping'

      if (hasHtml) {
        const parsed = parseAmazonHtml(amazonHtml)
        title = parsed.title
        author = parsed.author
        coverImageUrl = parsed.coverImageUrl
        pages = parsed.pages
        scrapingStatus = 'skipped'
      }

      const dto: CreateBookDto = {
        ...rest,
        title,
        author,
        coverImageUrl,
        pages,
        isRead: false,
        scrapingStatus,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
        updatedBy: 'user' as const,
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

**ポイント:**
- HTMLが入力されていれば、パース結果に関わらず `scrapingStatus: 'skipped'`（URL併用でもスクレイピングはしない）
- パースに失敗したフィールドは `null` のまま保存され、BookCard は `coverImageUrl` 無し＝No Image 表示になる
- HTMLが無ければ従来通り `scrapingStatus: 'scraping'` でトリガーに任せる

---

### Task 5: 登録モーダルに HTML 入力欄を追加

**ファイル:** `apps/web/src/features/books/components/BookRegistrationModal.tsx`

- `defaultValues` と `reset` に `amazonHtml: ''` を追加
- `amazonUrl` のラベルから `*` 表記を外し、説明文を追加
- `amazonUrl` 入力欄の下に `<Textarea>` による `amazonHtml` 欄を追加（説明文: 「スクレイピングが失敗する場合、AmazonページのHTMLを貼り付けてください（任意）」）
- rows={6} 程度、モノスペースフォントは不要

```tsx
<div className="space-y-2">
  <Label htmlFor="amazonUrl">AmazonのURL</Label>
  <Input
    id="amazonUrl"
    placeholder="https://www.amazon.co.jp/dp/..."
    {...register('amazonUrl')}
  />
  {errors.amazonUrl && (
    <p className="text-xs text-destructive">{errors.amazonUrl.message}</p>
  )}
  <p className="text-xs text-muted-foreground">
    URL または下のHTMLのいずれかを入力してください
  </p>
</div>

<div className="space-y-2">
  <Label htmlFor="amazonHtml">Amazon詳細ページのHTML（任意）</Label>
  <Textarea
    id="amazonHtml"
    placeholder="スクレイピングが失敗する場合、Amazon詳細ページを開いて右クリック→ページのソース表示からHTMLをコピーして貼り付け"
    rows={6}
    {...register('amazonHtml')}
  />
</div>
```

---

### Task 6: `onCreateBook` トリガーで `skipped` をスキップする

**ファイル:** `apps/functions/src/triggers/onCreateBook.ts`

現在の構造に、`scrapingStatus === 'skipped'` の分岐を追加する。スクレイピング関連の処理は完全にスキップし、グループcount同期は実行する。

```ts
triggerOnce('onCreateBook', async (event) => {
  if (!event.data) return

  const { uid, bookId } = event.params
  const data = event.data.data()
  const amazonUrl = data.amazonUrl as string
  const scrapingStatus = data.scrapingStatus as ScrapingStatus | undefined

  // HTMLから情報取得済みならスクレイピングをスキップ
  if (scrapingStatus === 'skipped') {
    console.log('scrapingStatus=skippedのためスクレイピングをスキップ:', bookId)
  } else if (!amazonUrl) {
    // 既存の failed 処理
    console.log('amazonUrl が存在しないためスキップ:', bookId)
    await updateBookOperation(uid, bookId, {
      scrapingStatus: 'failed',
      updatedAt: serverTimestamp,
      updatedBy: 'trigger' as const,
    })
  } else {
    // 既存のスクレイピング処理（変更なし）
    try {
      // ...
    } catch (error) {
      // ...
    }
  }

  // グループ count 同期（scrapingStatus に関係なく常に実行）
  // ... 既存のまま
})
```

**ポイント:**
- `ScrapingStatus` 型を `@bookpoolcontexts/common` から import
- グループ count 同期ロジックは変更しない（既に try/catch の外にある）
- `skipped` の場合は Firestore を書き換える必要なし（既にクライアント側で完成形で保存されているため）

---

### Task 7: BookCard の確認（変更不要見込み）

**ファイル:** `apps/web/src/features/books/components/BookCard.tsx`

現在のロジック:
- `scrapingStatus === 'scraping'` → スピナー
- 上記以外かつ `coverImageUrl` あり → 画像
- 上記以外かつ `scrapingStatus === 'failed'` → 取得失敗表示
- それ以外 → No Image

`'skipped'` の場合、HTMLパースで `coverImageUrl` が取れていれば画像表示、取れていなければ No Image になるため、追加の分岐は不要。

**変更なし**で動作するが、念のためコードレビュー時に確認する。

---

### Task 8: `firestore.rules` の確認（変更不要見込み）

**ファイル:** `firestore.rules`

現在の定義:
```
&& 'scrapingStatus' in requestData && requestData.scrapingStatus is string
```

値を文字列として検証しているだけなので、`'skipped'` を追加するための変更は不要。フィールド数 `size() == 15` も不変。

---

### Task 9: ビルド確認

以下のコマンドでビルドが通ることを確認する。

```bash
pnpm web build
pnpm functions pre-build
```

---

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/Book.ts` | 修正 | `ScrapingStatus` に `'skipped'` 追加 |
| `apps/web/src/features/books/utils/parseAmazonHtml.ts` | 新規 | HTMLパースユーティリティ |
| `apps/web/src/features/books/schemas/bookSchema.ts` | 修正 | `amazonHtml` 追加、URL/HTMLいずれか必須の refine |
| `apps/web/src/features/books/hooks/useCreateBookMutation.ts` | 修正 | HTMLパースと `skipped` ステータスのハンドリング |
| `apps/web/src/features/books/components/BookRegistrationModal.tsx` | 修正 | `amazonHtml` Textarea追加 |
| `apps/functions/src/triggers/onCreateBook.ts` | 修正 | `skipped` の場合スクレイピングをスキップ |
| `docs/tasks/fr-book-005.md` | 新規 | タスクドキュメント |

---

## 実装順序

1. Task 1（型定義追加）
2. Task 2（HTMLパースユーティリティ新規作成）
3. Task 3（Zodスキーマ更新）
4. Task 4（mutation hook更新）
5. Task 5（モーダルUI更新）
6. Task 6（トリガー更新）
7. Task 7, 8（変更不要の確認）
8. Task 9（ビルド確認）

---

## 検証方法

### ビルド確認
```bash
pnpm web build
pnpm functions pre-build
```
両方ともエラーなく通ること。

### 機能確認（HTMLあり）
1. Chrome で Amazon の任意の書籍ページ（例: `https://www.amazon.co.jp/dp/XXXXXXXXXX`）を開く
2. 右クリック→ページのソース表示 → 全選択コピー
3. アプリの登録モーダルを開き、HTML欄に貼り付け（URLは空でもOK）
4. その他のタグなどを入力して登録
5. Firestoreコンソールで該当ドキュメントを確認:
   - `scrapingStatus: 'skipped'`
   - `title`, `author`, `coverImageUrl`, `pages` が埋まっている
6. BookCard に画像が即時表示される（スピナー表示されない）
7. Cloud Functions ログで `scrapingStatus=skippedのためスクレイピングをスキップ` が出力されていること
8. グループを指定した場合、グループの count が +1 されていること

### 機能確認（URLのみ・従来通り）
1. URL欄のみ入力して登録
2. `scrapingStatus: 'scraping'` で保存される
3. 数秒後、トリガーが完了して `scrapingStatus: 'completed'` に更新される
4. 既存の挙動が変わっていないこと

### 機能確認（HTML + URL 両方入力）
1. HTML と URL を両方入力して登録
2. `scrapingStatus: 'skipped'` で保存される（HTML が優先）
3. Cloud Functions のログでスクレイピングが実行されていないこと
4. `amazonUrl` フィールドは入力値のまま保存されていること

### 機能確認（バリデーション）
- URL・HTML両方空で送信 → エラーメッセージ
- 不正な形式のURL（`not-a-url`）を入力 → エラーメッセージ
- HTML解析が空振り（Amazon以外のHTMLやゴミ） → `scrapingStatus: 'skipped'` で保存され、title等は null のまま（BookCard は No Image 表示）

### リグレッション確認
- 既存の本（`scrapingStatus` が `'completed'` / `'failed'` / `'scraping'`）のBookCardが正常表示される
- 本の編集・削除・グループ追加が引き続き動作する
