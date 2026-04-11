<!-- @format -->

# FR-TAG-001: タグ絞り込み機能 実装計画

## Context

VectorNote のメモには `tags` フィールドがあり、タグを付与して管理できる。現在サイドナビゲーションは未実装であり、タグによる絞り込みもできない。

本タスクでは以下を実装する：

1. `users/{uid}/tags` サブコレクションの追加（タグ名・件数を管理）
2. Firebase Functions の note トリガーでタグのカウントを同期する処理（作成・更新・削除）
3. サイドナビゲーションにタグ一覧と件数を表示
4. タグをクリックして絞り込みができる UI

タグの同期はクライアント側ではなく、Firebase Functions の Firestore トリガーで行う。

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: Tag エンティティ型定義 | 未着手 |
| Task 2: Firestore Operations 層（tags・Functions 用） | 未着手 |
| Task 3: Firestore セキュリティルール更新 | 未着手 |
| Task 4: onCreateNote トリガー更新（タグ同期追加） | 未着手 |
| Task 5: onUpdateNote トリガー更新（タグ同期追加） | 未着手 |
| Task 6: onDeleteNote トリガー新規作成 | 未着手 |
| Task 7: タグ取得フック | 未着手 |
| Task 8: サイドナビゲーションコンポーネント | 未着手 |
| Task 9: レイアウト更新 | 未着手 |
| Task 10: ホームページのタグフィルタリング対応 | 未着手 |
| Task 11: firestore-design.md の更新 | 未着手 |

---

## 実装タスク

### Task 1: Tag エンティティ型定義

**ファイル:**

- `packages/common/src/entities/Tag.ts`（新規）
- `packages/common/src/entities/index.ts`（修正）

`.claude/rules/firestore.md` に従い、3種類の型を定義する。
Firebase Admin SDK を使う Functions 側のための `CreateTagDtoFromAdmin` / `UpdateTagDtoFromAdmin` も定義する。

```typescript
import type { FieldValue } from 'firebase/firestore'
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

export const tagCollection = 'tags' as const

export type TagId = string

export type Tag = {
  tagId: TagId
  label: string
  count: number
  createdAt: Date
  updatedAt: Date
}

export type CreateTagDto = Omit<Tag, 'tagId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

export type UpdateTagDto = {
  count?: number
  updatedAt: FieldValue
}

/** firebase-admin を使用した作成用 DTO */
export type CreateTagDtoFromAdmin = Omit<Tag, 'tagId' | 'createdAt' | 'updatedAt'> & {
  createdAt: AdminFieldValue
  updatedAt: AdminFieldValue
}

/** firebase-admin を使用した更新用 DTO */
export type UpdateTagDtoFromAdmin = {
  count?: number | AdminFieldValue  // FieldValue.increment() を受け付けるため AdminFieldValue も許容
  updatedAt: AdminFieldValue
}
```

- `index.ts` に `export * from './Tag'` を追加

### Task 2: Firestore Operations 層（tags・Functions 用）

**ファイル:** `apps/functions/src/infrastructure/firestore/tags.ts`（新規）

Functions（firebase-admin）側でタグを操作する Operations 層。
既存の `apps/functions/src/infrastructure/firestore/notes.ts` と同じパターンで実装する。

タグ ID はラベル名をそのまま使用する（例: `users/{uid}/tags/react`）。

実装する関数：

| 関数名 | 用途 | 戻り値 |
|--------|------|--------|
| `fetchTagOperation` | 単一タグ取得 | `Promise<Tag \| null>` |
| `createTagOperation` | タグ作成（setDoc でラベルを ID として使用） | `Promise<void>` |
| `updateTagOperation` | タグ更新 | `Promise<void>` |
| `deleteTagOperation` | タグ削除 | `Promise<void>` |

`apps/functions/src/infrastructure/firestore/index.ts` にエクスポートを追加。

また、クライアント側でタグ一覧を取得するための Operations 層も追加する。

**ファイル:** `apps/web/src/infrastructure/firestore/tags.ts`（新規）

実装する関数：

| 関数名 | 用途 | 戻り値 |
|--------|------|--------|
| `subscribeTagsOperation` | タグ一覧リアルタイム購読（label 昇順） | `Unsubscribe` |

### Task 3: Firestore セキュリティルール更新

**ファイル:** `firestore.rules`

`tags` サブコレクションのスキーマバリデーション関数とルールを追加する。

`/users/{userId}` ブロック内に追加：

```javascript
match /tags/{tagId} {
  allow read: if isSignedIn() && isUser(userId);
}
```

クライアントからは read のみ許可。write（create / update / delete）は Firebase Admin SDK を使う Functions トリガーのみが行うため、クライアント側のルールには含めない。

### Task 4: onCreateNote トリガー更新（タグ同期追加）

**ファイル:** `apps/functions/src/triggers/onCreateNote.ts`（修正）

既存の OGP 取得・embedding 生成処理の後に、タグ同期処理を追加する。

```typescript
const { tags } = event.data.data()

// タグが存在する場合、各タグのカウントを同期
if (tags && tags.length > 0) {
  for (const label of tags) {
    const existing = await fetchTagOperation(uid, label)
    if (existing) {
      // FieldValue.increment(1) でアトミックにインクリメント
      await updateTagOperation(uid, label, {
        count: FieldValue.increment(1),
        updatedAt: serverTimestamp,
      })
    } else {
      await createTagOperation(uid, label, {
        label,
        count: 1,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      })
    }
  }
}
```

### Task 5: onUpdateNote トリガー更新（タグ同期追加）

**ファイル:** `apps/functions/src/triggers/onUpdateNote.ts`（修正）

`before.tags` と `after.tags` を比較し、差分のみ同期する。

```typescript
const beforeTags: string[] = before.tags ?? []
const afterTags: string[] = after.tags ?? []

const addedTags = afterTags.filter((t) => !beforeTags.includes(t))
const removedTags = beforeTags.filter((t) => !afterTags.includes(t))

// 追加されたタグをインクリメント（なければ新規作成）
for (const label of addedTags) {
  const existing = await fetchTagOperation(uid, label)
  if (existing) {
    // FieldValue.increment(1) でアトミックにインクリメント
    await updateTagOperation(uid, label, { count: FieldValue.increment(1), updatedAt: serverTimestamp })
  } else {
    await createTagOperation(uid, label, { label, count: 1, createdAt: serverTimestamp, updatedAt: serverTimestamp })
  }
}

// 削除されたタグをデクリメント（count=0 になれば削除）
for (const label of removedTags) {
  const existing = await fetchTagOperation(uid, label)
  if (!existing) continue
  if (existing.count <= 1) {
    // count が 1 以下になる場合はタグごと削除
    await deleteTagOperation(uid, label)
  } else {
    // FieldValue.increment(-1) でアトミックにデクリメント
    await updateTagOperation(uid, label, { count: FieldValue.increment(-1), updatedAt: serverTimestamp })
  }
}
```

タグが変更されていない場合はスキップする（`JSON.stringify(before.tags) === JSON.stringify(after.tags)`）。

### Task 6: onDeleteNote トリガー新規作成

**ファイル:** `apps/functions/src/triggers/onDeleteNote.ts`（新規）

`onDocumentDeleted` を使用し、削除されたメモのタグをデクリメントする。

```typescript
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { fetchTagOperation, deleteTagOperation, updateTagOperation } from '~/infrastructure/firestore/tags'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteNote = onDocumentDeleted(
  'users/{uid}/notes/{noteId}',
  triggerOnce('onDeleteNote', async (event) => {
    if (!event.data) return

    const { uid } = event.params
    const tags: string[] = event.data.data().tags ?? []

    for (const label of tags) {
      const existing = await fetchTagOperation(uid, label)
      if (!existing) continue
      if (existing.count <= 1) {
        // count が 1 以下になる場合はタグごと削除
        await deleteTagOperation(uid, label)
      } else {
        // FieldValue.increment(-1) でアトミックにデクリメント
        await updateTagOperation(uid, label, { count: FieldValue.increment(-1), updatedAt: serverTimestamp })
      }
    }
  }),
)
```

**ファイル:** `apps/functions/src/index.ts`（修正）

`export { onDeleteNote } from './triggers/onDeleteNote'` を追加。

### Task 7: タグ取得フック

**ファイル:** `apps/web/src/features/tags/hooks/useTags.ts`（新規）

```typescript
export type UseTagsReturn = {
  tags: Array<Tag>
  isLoading: boolean
  error: string | null
}

export const useTags = (): UseTagsReturn
```

- `subscribeTagsOperation` でリアルタイム購読
- `useEffect` でサブスクリプション管理（クリーンアップ必須）

### Task 8: サイドナビゲーションコンポーネント

**ファイル:** `apps/web/src/components/SideNav.tsx`（新規）

- `useTags()` でタグ一覧を取得
- タグ名と件数をリスト表示（`{label} ({count})`）
- 選択されたタグを URL クエリパラメータ（`?tag=xxx`）に反映
- 現在選択中のタグをハイライト表示
- 「すべて」項目でフィルターをリセット
- Skeleton ローディング表示

### Task 9: レイアウト更新

**ファイル:** `apps/web/src/routes/__root.tsx`（修正）

`AppLayout` を 2 カラムレイアウトに変更。

```tsx
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()
  const isAuthPath = location.pathname === '/login'

  if (isAuthPath) {
    return <>{children}</>
  }

  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-5xl">
        <SideNav />
        <div className="flex-1">{children}</div>
      </div>
      <Footer />
    </>
  )
}
```

### Task 10: ホームページのタグフィルタリング対応

**ファイル:** `apps/web/src/routes/_authed/index.tsx`（修正）

URL クエリパラメータ `?tag=xxx` を読み取り、メモ一覧をタグでフィルタリングする。

```typescript
export const Route = createFileRoute('/_authed/')({
  validateSearch: z.object({ tag: z.string().optional() }),
  component: HomePage,
})
```

**ファイル:** `apps/web/src/infrastructure/firestore/notes.ts`（修正）

`fetchNotesOperation` にオプションの `tag` パラメータを追加。`tag` が指定された場合、クエリに `where('tags', 'array-contains', tag)` を追加する。

**ファイル:** `apps/web/src/features/notes/hooks/useNotes.ts`（修正）

`tag` パラメータを受け取り `fetchNotesOperation` に渡す。クエリキーにも含める。

**ファイル:** `apps/web/src/features/notes/components/NoteList.tsx`（修正）

`tag?: string` を props に追加し `useNotes(tag)` に渡す。

### Task 11: firestore-design.md の更新

**ファイル:** `firestore-design.md`（修正）

tags コレクションのセクションを詳細に更新する。

---

## 実装順序

1. Task 1（型定義）→ 全体の基盤
2. Task 2（Operations 層）→ Firestore アクセス
3. Task 3（セキュリティルール）→ データ保護
4. Task 4〜6（Functions トリガー更新・追加）→ タグ同期ロジック
5. Task 7（タグ取得フック）→ React 統合
6. Task 8（SideNav コンポーネント）→ UI
7. Task 9（レイアウト更新）→ ページ統合
8. Task 10（フィルタリング）→ 絞り込み機能
9. Task 11（設計書更新）→ ドキュメント

## 検証方法

1. タグ付きメモを作成 → Functions トリガーが実行され `users/{uid}/tags/{label}` ドキュメントが作成・`count=1` になること
2. 同じタグを 2 つ目のメモに付ける → `count=2` になること
3. メモを削除 → `onDeleteNote` トリガーが実行され `count=1` に戻ること（`count=0` ならドキュメントが削除されること）
4. メモのタグを変更 → `onUpdateNote` トリガーが実行され、古いタグがデクリメント、新しいタグがインクリメントされること
5. サイドナビにタグ一覧と件数がリアルタイム表示されること
6. タグをクリック → URL が `/?tag=xxx` になり、そのタグのメモのみ表示されること
7. 「すべて」クリック → フィルターが解除されること
