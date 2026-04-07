<!-- @format -->

# FR-TAG-002: 複数タグAND絞り込み機能（Algolia導入 Phase 1）

## Context

VectorNote のサイドバーでタグによる絞り込みは1つのタグしか選択できない。ユーザーがタグを複数選択してAND条件で段階的に絞り込み、サイドバーも絞り込まれたメモに含まれるタグだけに動的更新される機能を実装する。

Firestoreの `array-contains` は1クエリにつき1つしか使えないため、複数タグのANDクエリはFirestore単体では不可能。クライアント側でのover-fetchもメモ増加に伴いスケールしないため、Algoliaを導入しfacet filteringでネイティブにAND絞り込みを実現する。

Phase 1 では**タグ絞り込み機能のみ**をAlgoliaで実装し、セマンティック検索は既存のFirestore Vector Searchを維持する。全文検索のAlgolia移行は次フェーズで対応。

## 前提：手動で行う作業

1. Algoliaアカウント作成（https://www.algolia.com/）
2. Application作成、以下のキーを取得:
   - Application ID
   - Admin API Key（Cloud Functions: インデックス書き込み用）
   - Search-Only API Key（Cloud Functions: Secured API Key生成の親キーとして使用。**クライアントには直接渡さない**）
3. Algoliaダッシュボードでインデックス `notes` を作成し、facet属性を設定:
   - `attributesForFaceting: ['filterOnly(uid)', 'tags']`
   - `unretrievableAttributes: ['uid']`（uidは検索結果に含めない）
4. 環境変数の設定（Task 2参照）

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: パッケージ追加 | 未着手 |
| Task 2: 環境変数設定 | 未着手 |
| Task 3: Cloud Functions — Algoliaクライアント初期化 | 未着手 |
| Task 4: Cloud Functions — メモのAlgolia同期（トリガー更新） | 未着手 |
| Task 5: Cloud Functions — Secured API Key生成エンドポイント | 未着手 |
| Task 6: Web — Algoliaクライアント・API層 | 未着手 |
| Task 7: Web — Algolia経由のメモ検索Operation | 未着手 |
| Task 8: Web — useNotesフック変更（複数タグ対応） | 未着手 |
| Task 9: Web — URLパラメータ変更（tag → tags） | 未着手 |
| Task 10: Web — NoteListのprops変更 | 未着手 |
| Task 11: Web — SideNavの複数タグ選択・絞り込み対応 | 未着手 |
| Task 12: 既存メモのバックフィルスクリプト | 未着手 |

---

## 実装タスク

### Task 1: パッケージ追加

```bash
# Cloud Functions（インデックス同期用）
cd apps/functions && pnpm add algoliasearch

# Web（検索クライアント用）
cd apps/web && pnpm add algoliasearch
```

### Task 2: 環境変数設定

**apps/functions** — Firebase Functionsの環境変数（`defineSecret` または `firebase functions:secrets:set`）:
- `ALGOLIA_APP_ID`
- `ALGOLIA_ADMIN_API_KEY` — インデックス書き込み用
- `ALGOLIA_SEARCH_API_KEY` — Secured API Key生成の親キー用

**apps/web** — Vite環境変数（`.env`）:
- `VITE_ALGOLIA_APP_ID` — Application IDのみ。**API Keyはクライアントに埋め込まない**

> **セキュリティ注意:** Search-Only API Keyをクライアント（`VITE_` 環境変数）に埋め込むと、ブラウザのDevToolsから取得でき、uidフィルタなしで全ユーザーのデータにアクセス可能になる。クライアントではCloud Functionsから取得したSecured API Keyのみを使用すること。

### Task 3: Cloud Functions — Algoliaクライアント初期化

**新規作成:** `apps/functions/src/lib/algolia.ts`

algoliasearchクライアントを初期化し、`notes` インデックスへの参照を提供する。

```typescript
import { algoliasearch } from 'algoliasearch'

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID ?? ''
const ALGOLIA_ADMIN_API_KEY = process.env.ALGOLIA_ADMIN_API_KEY ?? ''

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY)

export const ALGOLIA_NOTES_INDEX = 'notes'
export { client as algoliaClient }
```

### Task 4: Cloud Functions — メモのAlgolia同期（トリガー更新）

既存の3つのトリガー関数にAlgolia同期処理を追加する。

**`apps/functions/src/triggers/onCreateNote.ts`（変更）:**

既存の embedding・OGP・タグ同期処理の後に、Algoliaへのレコード保存を追加。

```typescript
// Algolia同期
try {
  await algoliaClient.saveObject({
    indexName: ALGOLIA_NOTES_INDEX,
    body: {
      objectID: `${uid}_${noteId}`,
      uid,
      noteId,
      tags: tags ?? [],
      updatedAt: Date.now(),
    },
  })
} catch (error) {
  console.error('Algolia sync failed for note:', noteId, error)
}
```

- objectID: `${uid}_${noteId}` でユーザー横断でユニーク
- 同期フィールド: `uid`, `noteId`, `tags`, `updatedAt`
- **`title` と `content` はAlgoliaに同期しない**（Phase 1はタグ絞り込みのみが目的。データ露出を最小限にする）
- メモの表示に必要な情報（title, content等）はAlgoliaから取得したnoteIdでFirestoreから取得する

**`apps/functions/src/triggers/onUpdateNote.ts`（変更）:**

title/tags が変更された場合、Algoliaのレコードも更新。

```typescript
// Algolia同期（tags が変更された場合のみ）
if (tagsChanged) {
  try {
    await algoliaClient.partialUpdateObject({
      indexName: ALGOLIA_NOTES_INDEX,
      objectID: `${uid}_${noteId}`,
      attributesToUpdate: {
        tags: afterTags,
        updatedAt: Date.now(),
      },
    })
  } catch (error) {
    console.error('Algolia update failed for note:', noteId, error)
  }
}
```

**`apps/functions/src/triggers/onDeleteNote.ts`（変更）:**

メモ削除時にAlgoliaからもレコード削除。

```typescript
// Algolia削除
try {
  await algoliaClient.deleteObject({
    indexName: ALGOLIA_NOTES_INDEX,
    objectID: `${uid}_${event.params.noteId}`,
  })
} catch (error) {
  console.error('Algolia delete failed for note:', event.params.noteId, error)
}
```

### Task 5: Cloud Functions — Secured API Key生成エンドポイント

**新規作成:** `apps/functions/src/api/algolia/generateSearchKey.ts`

認証済みユーザーのuidを使い、`filters: 'uid:${uid}'` を埋め込んだSecured API Keyを生成する。これによりクライアントは自分のメモのみ検索可能。

```typescript
import type { Response } from 'express'
import { algoliaClient } from '~/lib/algolia'
import type { AuthenticatedRequest } from '~/middleware/auth'

/** Secured API Keyの有効期限（秒） */
const KEY_VALIDITY_SECONDS = 3600 // 1時間

exports.handle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.uid
    const SEARCH_API_KEY = process.env.ALGOLIA_SEARCH_API_KEY ?? ''

    const validUntil = Math.floor(Date.now() / 1000) + KEY_VALIDITY_SECONDS

    const securedApiKey = algoliaClient.generateSecuredApiKey({
      parentApiKey: SEARCH_API_KEY,
      restrictions: {
        filters: `uid:${uid}`,
        validUntil,
      },
    })

    return res.status(200).json({
      searchKey: securedApiKey,
      expiresAt: validUntil * 1000, // クライアント用にミリ秒で返す
    })
  } catch (error) {
    console.error('Algolia key generation failed:', error)
    return res.status(500).json({ error: 'キーの生成に失敗しました' })
  }
}
```

**セキュリティポイント:**
- `validUntil` で有効期限（1時間）を設定。期限切れ後はキーが無効になる
- `filters: 'uid:${uid}'` で自分のメモのみにアクセスを制限
- 親キーは `Search-Only API Key`（Admin API Keyではない）

**ルーター登録:** `apps/functions/src/router.ts` に `/algolia/search-key` エンドポイントを追加。

### Task 6: Web — Algoliaクライアント・API層

**新規作成:** `apps/web/src/lib/algolia.ts`

Algoliaクライアントのファクトリ関数を提供する。**グローバルなクライアントインスタンスは作らない**。Secured API Keyを受け取って都度クライアントを生成する。

```typescript
import { liteClient as algoliasearch } from 'algoliasearch/lite'

const ALGOLIA_APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID

export const ALGOLIA_NOTES_INDEX = 'notes'

/** Secured API Keyを使ってAlgoliaクライアントを生成する */
export const createAlgoliaClient = (securedApiKey: string) =>
  algoliasearch(ALGOLIA_APP_ID, securedApiKey)
```

> **セキュリティ注意:** `VITE_ALGOLIA_APP_ID` はApplication IDのみでありパブリックな値。API Keyは一切クライアントに埋め込まない。検索時はCloud Functionsから取得したSecured API Key（uidフィルタ＋有効期限付き）のみを使用する。

**新規作成:** `apps/web/src/infrastructure/api/algoliaApi.ts`

Cloud FunctionsからSecured API Keyを取得するAPI関数。既存の `searchApi.ts` と同じパターン（Bearer token認証）。レスポンスに `searchKey` と `expiresAt` が含まれる。

**新規作成:** `apps/web/src/hooks/useAlgoliaSearchKey.ts`

Secured API Keyを取得・キャッシュするhook。TanStack Queryで管理する。

```typescript
export const useAlgoliaSearchKey = () => {
  const { uid } = useFirebaseAuthContext()

  return useQuery({
    queryKey: ['algoliaSearchKey', uid],
    queryFn: () => fetchAlgoliaSearchKeyApi(),
    enabled: !!uid,
    // サーバー側の有効期限（1時間）より少し前に再取得
    staleTime: 50 * 60 * 1000, // 50分
    gcTime: 55 * 60 * 1000,    // 55分
  })
}
```

- サーバー側の `validUntil`（1時間）より前に `staleTime` で自動再取得する設計
- キーが期限切れの場合、Algoliaが403エラーを返すため、エラー時のリトライ（再取得）も実装する

### Task 7: Web — Algolia経由のメモ検索Operation

**新規作成:** `apps/web/src/infrastructure/algolia/notes.ts`

Algoliaでタグフィルタ付きメモ検索を行う関数。

```typescript
import type { NoteId } from '@bookpoolcontexts/common'
import { createAlgoliaClient, ALGOLIA_NOTES_INDEX } from '@/lib/algolia'

type AlgoliaTagFilterResult = {
  noteIds: Array<NoteId>
  totalPages: number
  currentPage: number
  hasMore: boolean
}

/** Algoliaでタグ絞り込みを行い、noteIdリストを返す */
export const filterNoteIdsByTagsOperation = async (
  securedApiKey: string,
  tags: string[],
  page: number,
  hitsPerPage: number,
): Promise<AlgoliaTagFilterResult> => {
  const client = createAlgoliaClient(securedApiKey)

  // facetFilters: AND条件 → 各タグを別々の配列に
  // e.g., [['tags:react'], ['tags:typescript']] = react AND typescript
  const facetFilters = tags.map((tag) => [`tags:${tag}`])

  const result = await client.searchSingleIndex({
    indexName: ALGOLIA_NOTES_INDEX,
    searchParams: {
      query: '',
      facetFilters,
      page,
      hitsPerPage,
      attributesToRetrieve: ['noteId'], // 必要最小限のフィールドのみ取得
    },
  })

  const noteIds = result.hits.map((hit) => hit.noteId as NoteId)

  return {
    noteIds,
    totalPages: result.nbPages ?? 0,
    currentPage: result.page ?? 0,
    hasMore: (result.page ?? 0) < (result.nbPages ?? 0) - 1,
  }
}
```

**方針:**
- Algoliaからは **noteIdのみ** 取得し、メモの詳細（title, content等）はFirestoreから取得する
- Secured API Key（uidフィルタ＋有効期限付き）を毎回渡してクライアントを生成する
- タグ未選択時は従来通りFirestoreから直接取得（高速・リアルタイム）。タグ2つ以上選択時のみAlgolia経由で絞り込み

### Task 8: Web — useNotesフック変更（複数タグ対応）

**変更:** `apps/web/src/features/notes/hooks/useNotes.ts`

```typescript
export const notesQueryKey = (uid: string, tags: string[]) =>
  tags.length > 0 ? (['notes', uid, { tags }] as const) : (['notes', uid] as const)

export const useNotes = (tags: string[] = []) => {
  const { uid } = useFirebaseAuthContext()

  return useInfiniteQuery({
    queryKey: notesQueryKey(uid!, tags),
    queryFn: async ({ pageParam }) => {
      if (tags.length === 0) {
        // タグ未選択: 既存のFirestore取得
        return fetchNotesOperation(uid!, PAGE_SIZE, pageParam, undefined)
      }
      if (tags.length === 1) {
        // タグ1つ: 既存のFirestore array-contains
        return fetchNotesOperation(uid!, PAGE_SIZE, pageParam, tags[0])
      }
      // タグ複数: Algolia経由
      return searchNotesByTagsOperation(searchKey, tags, pageParam, PAGE_SIZE)
    },
    // ...
  })
}
```

### Task 9: Web — URLパラメータ変更（tag → tags）

**新規作成:** `apps/web/src/utils/tagParams.ts`

```typescript
export const parseTags = (tags?: string): string[] =>
  tags ? tags.split(',').filter(Boolean) : []

export const serializeTags = (tags: string[]): string | undefined =>
  tags.length > 0 ? tags.join(',') : undefined
```

**変更:** `apps/web/src/routes/_authed/index.tsx`

```typescript
export const Route = createFileRoute('/_authed/')({
  validateSearch: z.object({ tags: z.string().optional() }),
  component: HomePage,
})

function HomePage() {
  const { tags: tagsParam } = Route.useSearch()
  const selectedTags = parseTags(tagsParam)

  return (
    <main className="pb-8 pt-14">
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          {selectedTags.length > 0
            ? selectedTags.map((t) => `#${t}`).join(' ')
            : 'メモ一覧'}
        </h2>
        <NoteList tags={selectedTags} onClickCreate={openCreateModal} />
      </section>
      {/* ... */}
    </main>
  )
}
```

### Task 10: Web — NoteListのprops変更

**変更:** `apps/web/src/features/notes/components/NoteList.tsx`

- props: `tag?: string` → `tags: string[]`
- `useNotes(tags)` に渡す

### Task 11: Web — SideNavの複数タグ選択・絞り込み対応

**変更:** `apps/web/src/components/SideNav.tsx`

主な変更点:

1. **URLパラメータ**: `search.tag` → `search.tags` を `parseTags` で配列化
2. **トグル動作**: クリックでタグを追加/解除

```typescript
const search = useSearch({ strict: false }) as { tags?: string }
const selectedTags = parseTags(search.tags)

const toggleTag = (tagLabel: string): { tags?: string } => {
  const newTags = selectedTags.includes(tagLabel)
    ? selectedTags.filter((t) => t !== tagLabel)
    : [...selectedTags, tagLabel]
  return { tags: serializeTags(newTags) }
}
```

3. **選択中タグ**: active表示、クリックで解除
4. **タグ絞り込み表示**: タグ選択時、`useNotes(selectedTags)` を呼び出し（TanStack Queryの重複排除で再fetchなし）、取得済みメモからサイドバーに表示するタグとカウントを算出
5. **未選択タグ**: フィルタ後のメモに含まれるタグのみ表示、カウントはメモ群内での出現数
6. **「すべて」ボタン**: `search={{}}` で全タグクリア

### Task 12: 既存メモのバックフィルスクリプト

**新規作成:** `apps/functions/src/scripts/backfillAlgolia.ts`

全ユーザーの全メモをAlgoliaに一括同期するワンショットスクリプト。本番デプロイ後に1回実行する。

```typescript
// 全ユーザーのメモをバッチでAlgoliaに同期
// algoliaClient.batch() を使用して一括保存
```

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `apps/functions/package.json` | 変更 | algoliasearch追加 |
| `apps/web/package.json` | 変更 | algoliasearch追加 |
| `apps/functions/src/lib/algolia.ts` | 新規 | Algolia Adminクライアント初期化 |
| `apps/functions/src/triggers/onCreateNote.ts` | 変更 | Algolia同期追加 |
| `apps/functions/src/triggers/onUpdateNote.ts` | 変更 | Algolia同期追加 |
| `apps/functions/src/triggers/onDeleteNote.ts` | 変更 | Algolia削除追加 |
| `apps/functions/src/api/algolia/generateSearchKey.ts` | 新規 | Secured API Key生成 |
| `apps/functions/src/router.ts` | 変更 | Algoliaルート追加 |
| `apps/web/src/lib/algolia.ts` | 新規 | Algoliaクライアントファクトリ（Secured API Key受け取り） |
| `apps/web/src/infrastructure/api/algoliaApi.ts` | 新規 | Secured API Key取得API |
| `apps/web/src/hooks/useAlgoliaSearchKey.ts` | 新規 | Secured API Keyフック |
| `apps/web/src/infrastructure/algolia/notes.ts` | 新規 | Algoliaでのタグ絞り込み（noteIdリスト取得） |
| `apps/web/src/utils/tagParams.ts` | 新規 | タグパラメータユーティリティ |
| `apps/web/src/features/notes/hooks/useNotes.ts` | 変更 | 複数タグ対応 |
| `apps/web/src/routes/_authed/index.tsx` | 変更 | URLパラメータ変更 |
| `apps/web/src/features/notes/components/NoteList.tsx` | 変更 | props変更 |
| `apps/web/src/components/SideNav.tsx` | 変更 | 複数選択・タグ絞り込み表示 |
| `apps/functions/src/scripts/backfillAlgolia.ts` | 新規 | 既存データ一括同期 |

## セキュリティ

### APIキー管理
- **クライアントにAPI Keyを埋め込まない**: `VITE_ALGOLIA_APP_ID`（パブリック値）のみ。Search-Only API Key / Admin API Keyはクライアントバンドルに含めない
- **Secured API Keyのみ使用**: Cloud Functionsで `uid` フィルタ＋有効期限（1時間）付きのSecured API Keyを生成し、クライアントに返す
- **Admin API Key**: Cloud Functions側のみで使用。トリガー関数でのインデックス書き込みに限定
- **Search-Only API Key**: Cloud Functions側のみで保持。Secured API Key生成の親キーとしてのみ使用

### データ露出の最小化
- **Algoliaに同期するフィールドは最小限**: `uid`, `noteId`, `tags`, `updatedAt` のみ。`title`, `content`, `keywords` は同期しない
- **`uid` は `unretrievableAttributes` に設定**: フィルタには使えるが検索結果には含まれない
- **`attributesToRetrieve: ['noteId']`**: クライアントへのレスポンスも最小限に制限
- メモの表示に必要な情報はFirestoreから取得（Firestoreのセキュリティルールで保護済み）

### 有効期限とキーのローテーション
- Secured API Keyに `validUntil` を設定（1時間後）。期限切れ後は自動的に無効化
- クライアント側で `staleTime: 50分` で期限前に自動再取得
- Algoliaの403エラー時はキーを再取得するリトライ機構を実装

### その他
- AlgoliaはSOC2、GDPR準拠でデータは暗号化される
- Algolia同期失敗時はFirestoreのデータには影響しない（エラーログで監視、定期バックフィルで不整合を解消）

## 実装順序

1. Task 1〜2（パッケージ・環境変数）→ インフラ準備
2. Task 3（Algoliaクライアント初期化）→ Functions側の基盤
3. Task 4（トリガー更新）→ データ同期
4. Task 5（Secured API Key）→ セキュリティ確保
5. Task 6〜7（Web側Algoliaクライアント・Operation）→ クライアント側の基盤
6. Task 8〜11（useNotes・URL・NoteList・SideNav）→ UI統合
7. Task 12（バックフィル）→ 既存データ対応

## 検証方法

### ビルド確認
1. `pnpm functions pre-build` でFunctionsビルド成功を確認
2. `pnpm web build` でWebビルド成功を確認

### 機能確認
3. ブラウザ動作確認:
   - メモ作成 → Algoliaダッシュボードでレコードが同期されること（uid, noteId, tags, updatedAtのみ）
   - タグ1つクリック → そのタグを持つメモだけ表示される（Firestore経由）
   - タグ2つ以上クリック → AND条件で絞り込み（Algolia経由）
   - サイドバーのタグが、表示中メモに含まれるタグだけに絞られる
   - 選択中タグをクリック → そのタグが解除される
   - 「すべて」クリック → フィルタ全解除、従来のFirestore取得に戻る
   - 無限スクロール（ページネーション）が正常動作する

### セキュリティ確認
4. クライアントバンドルの確認:
   - ビルド成果物にSearch-Only API Key / Admin API Keyが含まれていないこと（`grep -r` で確認）
   - `VITE_ALGOLIA_APP_ID` のみが含まれていること
5. Secured API Keyの確認:
   - Secured API Keyで他ユーザーのメモが検索できないこと
   - 有効期限切れのキーでAlgoliaにアクセスすると403が返ること
   - 403エラー時にキーが自動再取得されること
6. Algoliaダッシュボードの確認:
   - インデックスに `title`, `content` が含まれていないこと
   - `uid` が `unretrievableAttributes` に設定されていること

## 次フェーズ（Phase 2）への展望

- Algoliaに `content` も同期し、全文検索機能を追加
- セマンティック検索とAlgolia検索の統合（ハイブリッド検索）
- Algolia InstantSearchの導入検討
