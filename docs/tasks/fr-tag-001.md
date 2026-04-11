<!-- @format -->

# FR-TAG-001 / FR-TAG-002: タグ機能 実装計画

## Context

BookPoolContexts では本に自由入力のタグを付与し、タグごとに読みたい本を絞り込めるようにする。spec.md の FR-TAG-001（タグの作成・サジェスト）/ FR-TAG-002（タグの編集・削除）に対応する。

調査の結果、タグ機能の**基盤の多くはすでに実装済み**である：

- `packages/common/src/entities/Tag.ts` — Entity / DTO 型（client / admin 両対応）
- `apps/web/src/infrastructure/firestore/tags.ts` — `subscribeTagsOperation`, `subscribeRecentTagsOperation`（read のみ）
- `apps/functions/src/infrastructure/firestore/tags.ts` — `fetchTagByLabelOperation`, `createTagOperation`, `updateTagOperation`, `deleteTagOperation`
- `apps/web/src/features/tags/hooks/useTags.ts`, `useRecentTags.ts`
- `apps/web/src/features/tags/components/TagSuggestionDropdown.tsx`
- `BookRegistrationModal.tsx` / `BookEditModal.tsx` のタグ入力 UI（Enter / IME 対応済み、サジェスト dropdown 組み込み済み）
- `SideNav.tsx` のタグ一覧表示（count 付き、`/?tag=xxx` リンク）
- `routes/_authed/index.tsx` のタグピル表示 + `validateSearch: { tag?, group? }`
- `fetchBooksOperation(uid, pageSize, lastDoc, tag?)` — タグ絞り込みパラメータ対応済み
- `firestore.rules` の `match /tags/{tagId}` で read のみ許可

一方、**以下が未実装または壊れている**：

1. `onCreateBook` / `onUpdateBook` / `onDeleteBook` にタグ同期ロジックがない（グループは同期しているがタグは素通り）
2. `onDeleteTag` トリガー不在（タグ削除時に本の `tags` 配列から該当ラベルを除去する処理がない）
3. `useBooks` フックがタグ絞り込みを受け取れない（`{ group }` しか受け付けていない）
4. `BookList` が `tag` prop を無視している（`useBooks({ group })` のみ呼び出し）
5. `subscribeBooksByTagOperation` 不在
6. タグ管理 UI 一式なし（FR-TAG-002 用）: ミューテーションフック、ダイアログ、`/tags` ルート
7. `firestore.rules` の tags はスキーマバリデーションなし、write 不可（FR-TAG-002 対応が必要）
8. `firestore.indexes.json` に `tags` array-contains + createdAt desc 複合インデックスがない
9. `apps/functions/src/infrastructure/firestore/index.ts` が存在しない `fetchTagOperation` を参照している（既存バグ）
10. タグリネーム時の本への波及処理が必要（FR-TAG-002）

本タスクでは **FR-TAG-001 + FR-TAG-002 両方** を実装する。未知タグに遭遇したときは onCreateBook / onUpdateBook トリガー内で `count=1` のタグドキュメントを自動作成する（spec 準拠）。

実装方針は `docs/references/tag-count-sync.md`（タグカウント同期の設計ドキュメント）と `docs/references/tag-suggestion-autocomplete.md`（サジェスト設計）に準拠する。特に以下のポイントを踏襲する：

- `FieldValue.increment()` による原子的な count 更新（レースコンディション回避）
- `try / catch` でラベル単位の部分失敗を許容（1 タグの失敗が他タグ同期を巻き込まない）
- `updatedAt` を count 更新時にも必ず同時更新（「最近使ったタグ」のソートキー）
- `JSON.stringify([...sort()])` による順序非依存の差分比較
- `count <= 1` で物理削除（`count = 0` のゴミを残さない）
- `updatedBy === 'trigger'` による再トリガー防止
- `triggerOnce` による冪等性担保（既存実装を利用）
- トリガー側でも `Array.from(new Set(tags))` で配列重複除去（クライアント側でガードしているが二重の保険）
- ラベル正規化（`trim().normalize('NFC')`）をクライアント・サーバー両方で揃える

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: Functions 側 Operations 層の追加・整備 | 未着手 |
| Task 2: ラベル正規化ユーティリティの追加 | 未着手 |
| Task 3: onCreateBook トリガーにタグ同期を追加 | 未着手 |
| Task 4: onUpdateBook トリガーにタグ差分同期を追加 | 未着手 |
| Task 5: onDeleteBook トリガーにタグ同期を追加 | 未着手 |
| Task 6: onDeleteTag トリガーの新規作成 | 未着手 |
| Task 7: Firestore セキュリティルール更新 | 未着手 |
| Task 8: Firestore インデックス追加 | 未着手 |
| Task 9: Web Operations 層にタグ絞り込み購読を追加 | 未着手 |
| Task 10: useBooks フックのタグ絞り込み対応 | 未着手 |
| Task 11: BookList にタグ絞り込みを渡す | 未着手 |
| Task 12: BookRegistrationModal / BookEditModal のタグ正規化適用 | 未着手 |
| Task 13: タグ管理用ミューテーションフックの追加 | 未着手 |
| Task 14: タグ管理 UI コンポーネント | 未着手 |
| Task 15: /tags ルートページの追加 | 未着手 |

---

## 実装タスク

### Task 1: Functions 側 Operations 層の追加・整備

**ファイル:**

- `apps/functions/src/infrastructure/firestore/books.ts`（追記）
- `apps/functions/src/infrastructure/firestore/index.ts`（既存バグ含む修正）

`onDeleteTag` トリガーで「削除したタグを全ての本から arrayRemove で除去」するために、books operation を追加する。パターンは既存の `removeGroupFromAllBooksOperation` を踏襲。

追加する関数：

| 関数名 | 用途 |
|--------|------|
| `removeTagFromAllBooksOperation(uid, label)` | 削除したタグを全ての本の `tags` 配列から除去（batch + arrayRemove） |

対象本は `where('tags', 'array-contains', label)` で取得し、`updatedBy: 'trigger'` で更新して onUpdateBook の連鎖発火を防ぐ。

**既存バグの修正:** `apps/functions/src/infrastructure/firestore/index.ts` は `fetchTagOperation` を export しようとしているが実在しない（実体は `fetchTagByLabelOperation`）。正しいエクスポート名に修正する。また `notes` / `users` の export が存在する一方で `books` / `groups` の export が欠けている。必要なものを正しく export する形に書き換える。

### Task 2: ラベル正規化ユーティリティの追加

**ファイル:**

- `packages/common/src/utils/normalizeTagLabel.ts`（新規）
- `packages/common/src/utils/index.ts`（追記、存在しなければ新規）
- `packages/common/src/index.ts`（`export * from './utils'` 追記）

`tag-count-sync.md` の注意事項を踏まえ、クライアント・サーバー両方で共通の正規化関数を導入する。これがないと、「React」「React 」「Ｒｅａｃｔ」「react」のような表記揺れが別タグとして扱われてしまう。

```typescript
// packages/common/src/utils/normalizeTagLabel.ts

/**
 * タグラベルを正規化する
 * - 前後の空白を除去
 * - Unicode NFC 正規化（濁点・半角全角のゆらぎを統一）
 *
 * 大文字小文字の変換は行わない（React と react を同一視するかは要件次第で、
 * 現状は区別する方針。区別したくなったら toLowerCase を追加する）
 */
export const normalizeTagLabel = (label: string): string => {
  return label.trim().normalize('NFC')
}
```

この関数を以下の箇所で呼ぶ（Task 3 / Task 4 / Task 5 / Task 12 で参照）：

- Functions 側: onCreateBook / onUpdateBook / onDeleteBook トリガーで `data.tags` を受け取った直後
- Web 側: `BookRegistrationModal` / `BookEditModal` の `addTag` 関数内

**注意:** 既存データには未正規化のタグが入っている可能性があるが、本タスクではマイグレーションは行わない（今後データ量が増える前に対応する想定）。

### Task 3: onCreateBook トリガーにタグ同期を追加

**ファイル:** `apps/functions/src/triggers/onCreateBook.ts`（修正）

既存のグループ count 同期と同じブロック末尾で、タグ同期を追加する。正規化 + 重複除去を同期前に行う。

```typescript
// タグ count 同期
// 重複除去 + 正規化（クライアントでもガード済みだが二重の保険）
const rawTags: string[] = data.tags ?? []
const tags = Array.from(
  new Set(rawTags.map((t) => normalizeTagLabel(t)).filter((t) => t !== '')),
)
if (tags.length > 0) {
  for (const label of tags) {
    try {
      const existing = await fetchTagByLabelOperation(uid, label)
      if (existing) {
        await updateTagOperation(uid, existing.tagId, {
          count: FieldValue.increment(1),
          updatedAt: serverTimestamp,
        })
      } else {
        // 未知のタグは count=1 で新規作成
        await createTagOperation(uid, {
          label,
          count: 1,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        })
      }
    } catch (error) {
      console.error('タグカウント更新に失敗:', label, error)
    }
  }
  console.log('タグカウントを更新しました:', bookId, tags)
}
```

**注意点:**

- `fetchTagByLabelOperation` は `limit(1).get()` で label 完全一致で検索する（既存実装）
- `createTagOperation` は `.add(dto)` で自動 ID を発行する（既存実装）
- グループ同期と同様、`try/catch` で個別エラーは握って全体を止めない
- `triggerOnce` で冪等性は担保済み

### Task 4: onUpdateBook トリガーにタグ差分同期を追加

**ファイル:** `apps/functions/src/triggers/onUpdateBook.ts`（修正）

既存のグループ差分同期と同じパターンで、タグの差分同期を追加する。正規化 + 重複除去を比較前に行う。

```typescript
// 正規化 + 重複除去
const normalizeTagList = (tags: string[]): string[] =>
  Array.from(
    new Set(tags.map((t) => normalizeTagLabel(t)).filter((t) => t !== '')),
  )

const beforeTags = normalizeTagList(before.tags ?? [])
const afterTags = normalizeTagList(after.tags ?? [])

const tagsChanged =
  JSON.stringify([...beforeTags].sort()) !==
  JSON.stringify([...afterTags].sort())

if (tagsChanged) {
  const addedTags = afterTags.filter((t) => !beforeTags.includes(t))
  const removedTags = beforeTags.filter((t) => !afterTags.includes(t))

  // 追加されたタグの count をインクリメント（存在しなければ新規作成）
  for (const label of addedTags) {
    try {
      const existing = await fetchTagByLabelOperation(uid, label)
      if (existing) {
        await updateTagOperation(uid, existing.tagId, {
          count: FieldValue.increment(1),
          updatedAt: serverTimestamp,
        })
      } else {
        await createTagOperation(uid, {
          label,
          count: 1,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        })
      }
    } catch (error) {
      console.error('タグカウントのインクリメントに失敗:', label, error)
    }
  }

  // 除去されたタグの count をデクリメント（count<=1 の場合はドキュメント削除）
  for (const label of removedTags) {
    try {
      const existing = await fetchTagByLabelOperation(uid, label)
      if (!existing) continue
      if (existing.count <= 1) {
        await deleteTagOperation(uid, existing.tagId)
      } else {
        await updateTagOperation(uid, existing.tagId, {
          count: FieldValue.increment(-1),
          updatedAt: serverTimestamp,
        })
      }
    } catch (error) {
      console.error('タグカウントのデクリメントに失敗:', label, error)
    }
  }

  console.log('タグカウントを同期しました:', bookId, { addedTags, removedTags })
}
```

**重要:**

- 既存の `if (after.updatedBy === 'trigger') return` のガードはそのまま活かす（連鎖発火防止）
- **グループが変更されていないときに早期 return している既存ロジックを撤去**し、グループ差分同期・タグ差分同期をそれぞれ独立した条件ブロックにする（タグだけが変わったケースで処理が止まるのを防ぐ）

### Task 5: onDeleteBook トリガーにタグ同期を追加

**ファイル:** `apps/functions/src/triggers/onDeleteBook.ts`（修正）

```typescript
const rawTags: string[] = data.tags ?? []
const tags = Array.from(
  new Set(rawTags.map((t) => normalizeTagLabel(t)).filter((t) => t !== '')),
)
if (tags.length > 0) {
  for (const label of tags) {
    try {
      const existing = await fetchTagByLabelOperation(uid, label)
      if (!existing) continue
      if (existing.count <= 1) {
        await deleteTagOperation(uid, existing.tagId)
      } else {
        await updateTagOperation(uid, existing.tagId, {
          count: FieldValue.increment(-1),
          updatedAt: serverTimestamp,
        })
      }
    } catch (error) {
      console.error('タグカウントのデクリメントに失敗:', label, error)
    }
  }
  console.log('本の削除に伴いタグカウントを更新しました:', bookId, tags)
}
```

既存のグループ同期と並列に追加する（`if (groups.length === 0) return` を削除し、グループ/タグを独立に処理する）。

### Task 6: onDeleteTag トリガーの新規作成

**ファイル:**

- `apps/functions/src/triggers/onDeleteTag.ts`（新規）
- `apps/functions/src/index.ts`（export 追加）

FR-TAG-002 でクライアント（オーナー）からタグドキュメントを削除できるようにするため、連動して全本の `tags` 配列から該当ラベルを除去するトリガーを追加する。`onDeleteGroup` の実装パターンを踏襲。

```typescript
export const onDeleteTag = onDocumentDeleted(
  {
    document: 'users/{uid}/tags/{tagId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onDeleteTag', async (event) => {
    if (!event.data) return
    const { uid, tagId } = event.params
    const data = event.data.data()
    const tagLabel = data.label as string
    if (!tagLabel) {
      console.warn('削除されたタグにラベルがありません:', tagId)
      return
    }
    await removeTagFromAllBooksOperation(uid, tagLabel)
    console.log('タグ削除に伴う本の更新が完了しました:', tagId, tagLabel)
  }),
)
```

### Task 7: Firestore セキュリティルール更新

**ファイル:** `firestore.rules`（修正）

tag サブコレクションに以下を追加する：

1. `isValidTagSchema` 関数を追加（Group と同構造の 4 フィールド検証）
2. `match /tags/{tagId}` で以下を許可：
   - `read`: オーナー
   - `update` / `delete`: オーナー + スキーマ検証（FR-TAG-002 用）
   - `create`: 禁止（Functions の Admin SDK は Rules をバイパスするため）

3. `isValidBookSchema` を強化して **`updatedBy` の値を `'user'` のみに制限**する（tag-count-sync.md の Security Rules セクション準拠）。現状はただの `is string` チェックなので、クライアントから `updatedBy: 'trigger'` を詐称できてしまい、`onUpdateBook` のガードが素通りされる。以下のように修正する：

```javascript
&& 'updatedBy' in requestData && requestData.updatedBy == 'user';
```

これにより、Functions 側の更新（Admin SDK / Rules バイパス）は `'trigger'` を書き込めるが、クライアントは `'user'` しか書けなくなる。

```javascript
function isValidTagSchema(requestData) {
  return requestData.size() == 4
    && 'count' in requestData && requestData.count is number
    && 'createdAt' in requestData && requestData.createdAt is timestamp
    && 'label' in requestData && requestData.label is string
    && 'updatedAt' in requestData && requestData.updatedAt is timestamp;
}

match /tags/{tagId} {
  allow read: if isSignedIn() && isUser(userId);
  allow update: if isSignedIn() && isUser(userId) && isValidTagSchema(requestData());
  allow delete: if isSignedIn() && isUser(userId);
  // create は Cloud Functions のみ許可（Admin SDK が Rules をバイパス）
}
```

### Task 8: Firestore インデックス追加

**ファイル:** `firestore.indexes.json`（修正）

`subscribeBooksByTagOperation`（Task 9）で `where('tags', 'array-contains', tag) + orderBy('createdAt', 'desc')` を使うため、複合インデックスを追加する。既存の groups インデックスと同型。

```json
{
  "collectionGroup": "books",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ],
  "density": "SPARSE_ALL"
}
```

### Task 9: Web Operations 層にタグ絞り込みリアルタイム購読を追加

**ファイル:** `apps/web/src/infrastructure/firestore/books.ts`（追記）

既存の `subscribeBooksByGroupOperation` と同型の `subscribeBooksByTagOperation` を追加する。

```typescript
export const subscribeBooksByTagOperation = (
  uid: Uid,
  tagLabel: string,
  pageSize: number,
  setter: (books: Array<Book>) => void,
): Unsubscribe => {
  const q = query(
    booksRef(uid),
    where('tags', 'array-contains', tagLabel),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  )
  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map(
      (d) => ({ bookId: d.id, ...convertDate(d.data(), dateColumns) }) as Book,
    )
    setter(books)
  })
}
```

あわせて FR-TAG-002 のタグリネーム処理に使う `fetchBooksByTagOperation` も追加する（`fetchBooksByGroupOperation` と同型）。

### Task 10: useBooks フックのタグ絞り込み対応

**ファイル:** `apps/web/src/features/books/hooks/useBooks.ts`（修正）

`UseBooksParams` に `tag?: string` を追加し、`tag` と `group` が同時に指定された場合は `tag` を優先する。

```typescript
type UseBooksParams = { tag?: string; group?: string }

export const useBooks = ({ tag, group }: UseBooksParams = {}): UseBooksReturn => {
  // ...
  const unsubscribe = tag
    ? subscribeBooksByTagOperation(uid, tag, 100, ...)
    : group
      ? subscribeBooksByGroupOperation(uid, group, 100, ...)
      : subscribeBooksOperation(uid, 100, ...)
  // deps に tag を追加
}
```

### Task 11: BookList コンポーネントにタグ絞り込みを渡す

**ファイル:** `apps/web/src/features/books/components/BookList.tsx`（修正）

現状 `tag` prop を受け取っているが無視している。`useBooks({ tag, group })` に渡すよう修正する。

```typescript
export const BookList = ({ tag, group, onClickBook }: BookListProps) => {
  const { books, isLoading } = useBooks({ tag, group })
  // ...
}
```

### Task 12: BookRegistrationModal / BookEditModal のタグ正規化適用

**ファイル:**

- `apps/web/src/features/books/components/BookRegistrationModal.tsx`（修正）
- `apps/web/src/features/books/components/BookEditModal.tsx`（修正）

両モーダルの `addTag` 関数内でクライアント側でも正規化を行い、サーバー側と同じルールで揃える。

```typescript
import { normalizeTagLabel } from '@bookpoolcontexts/common'

const addTag = (label: string): void => {
  const normalized = normalizeTagLabel(label)
  if (normalized && !tags.includes(normalized)) {
    setValue('tags', [...tags, normalized])
  }
  setTagInput('')
}
```

`TagSuggestionDropdown` から渡ってくる label は既に正規化済みの前提だが、二重正規化しても結果は冪等なので問題ない。

### Task 13: タグ管理用ミューテーションフック・Operation の追加（FR-TAG-002）

**ファイル:**

- `apps/web/src/infrastructure/firestore/tags.ts`（追記）
- `apps/web/src/features/tags/hooks/useUpdateTagMutation.ts`（新規）
- `apps/web/src/features/tags/hooks/useDeleteTagMutation.ts`（新規）

クライアント側で必要な Operations を追加する：

```typescript
// apps/web/src/infrastructure/firestore/tags.ts
export const deleteTagOperation = async (
  uid: Uid,
  tagId: TagId,
): Promise<void> => {
  await deleteDoc(doc(db, userCollection, uid, tagCollection, tagId))
}
```

ミューテーションフックは `useUpdateGroupMutation` / `useDeleteGroupMutation` のパターンを踏襲する（認証チェック、`serverTimestamp`、トースト通知）。

**重要 — リネーム時の本への波及:**

spec.md FR-TAG-002「変更時は関連する全ての本のタグも更新する」を満たすため、**`useUpdateTagMutation` は以下を順次実行する**：

1. `fetchBooksByTagOperation(uid, oldLabel)` で対象本を全取得
2. 各本に対して `updateBookOperation` を呼び、`tags` を `[...book.tags.filter(t => t !== oldLabel), newLabel]` に置き換え、`updatedBy: 'user'` で更新
3. タグドキュメント自身には**触らない**

この設計により、各本の更新が `onUpdateBook`（Task 4 で改修済み）を発火させ、

- 新ラベルの count が `+1` される（存在しなければ新タグドキュメントが自動作成される）
- 旧ラベルの count が `-1` され、0 になれば旧タグドキュメントが自動削除される

という連鎖処理で整合性が取れる。`useDeleteTagMutation` は対象タグドキュメントを単純に `deleteDoc` するだけで、あとは Task 6 の `onDeleteTag` トリガーが全本から該当ラベルを除去する。

### Task 14: タグ管理 UI コンポーネント（FR-TAG-002）

**ファイル:**

- `apps/web/src/features/tags/components/TagList.tsx`（新規）
- `apps/web/src/features/tags/components/EditTagDialog.tsx`（新規）
- `apps/web/src/features/tags/components/DeleteTagAlertDialog.tsx`（新規）

既存の `GroupList.tsx` / `EditGroupDialog.tsx` / `DeleteGroupAlertDialog.tsx` をほぼそのまま流用したパターンで作る。タグは**新規作成 UI は不要**（本登録経由で自動作成されるため）、リネームと削除のみ提供する。

- `TagList`: `useTags()` でタグ一覧を取得し、ラベルと count を表示。各タグに「編集」「削除」ボタン
- `EditTagDialog`: 新ラベルを入力 → `useUpdateTagMutation` を呼ぶ
- `DeleteTagAlertDialog`: 確認後 `useDeleteTagMutation` を呼ぶ

### Task 15: /tags ルートページの追加（FR-TAG-002）

**ファイル:**

- `apps/web/src/routes/_authed/tags.tsx`（新規）
- `apps/web/src/components/SideNav.tsx`（修正：「タグ管理」リンク追加）

`/groups` ルートと同型で `/tags` ルートを作る。`TagList` を表示するシンプルなページ。SideNav のタグセクション末尾に「タグ管理」リンクを追加（`Settings2` アイコンで統一）。

---

## 実装順序

1. Task 1（Functions Operations 整備）
2. Task 2（ラベル正規化ユーティリティ）
3. Task 3 → Task 4 → Task 5（book triggers にタグ同期追加）
4. Task 6（onDeleteTag トリガー）
5. Task 7（セキュリティルール、`updatedBy` 詐称防止含む）
6. Task 8（インデックス）
7. Task 9 → Task 10 → Task 11（Web 側のタグ絞り込み）
8. Task 12（既存モーダルのタグ正規化適用）
9. Task 13 → Task 14 → Task 15（タグ管理 UI）

## 変更対象ファイル一覧

### 修正

- `apps/functions/src/triggers/onCreateBook.ts`
- `apps/functions/src/triggers/onUpdateBook.ts`
- `apps/functions/src/triggers/onDeleteBook.ts`
- `apps/functions/src/index.ts`
- `apps/functions/src/infrastructure/firestore/books.ts`
- `apps/functions/src/infrastructure/firestore/index.ts`（既存バグ修正含む）
- `apps/web/src/infrastructure/firestore/books.ts`
- `apps/web/src/infrastructure/firestore/tags.ts`
- `apps/web/src/features/books/hooks/useBooks.ts`
- `apps/web/src/features/books/components/BookList.tsx`
- `apps/web/src/features/books/components/BookRegistrationModal.tsx`
- `apps/web/src/features/books/components/BookEditModal.tsx`
- `apps/web/src/components/SideNav.tsx`
- `firestore.rules`
- `firestore.indexes.json`
- `packages/common/src/index.ts`

### 新規

- `packages/common/src/utils/normalizeTagLabel.ts`
- `packages/common/src/utils/index.ts`
- `apps/functions/src/triggers/onDeleteTag.ts`
- `apps/web/src/features/tags/hooks/useUpdateTagMutation.ts`
- `apps/web/src/features/tags/hooks/useDeleteTagMutation.ts`
- `apps/web/src/features/tags/components/TagList.tsx`
- `apps/web/src/features/tags/components/EditTagDialog.tsx`
- `apps/web/src/features/tags/components/DeleteTagAlertDialog.tsx`
- `apps/web/src/routes/_authed/tags.tsx`

## 再利用する既存コード

- `triggerOnce`（`apps/functions/src/utils/triggerOnce.ts`）
- `serverTimestamp`（`apps/functions/src/lib/firebase.ts`, `apps/web/src/lib/firebase.ts`）
- `convertDate`（両 apps）
- `fetchTagByLabelOperation` / `createTagOperation` / `updateTagOperation` / `deleteTagOperation`（`apps/functions/src/infrastructure/firestore/tags.ts`）
- `subscribeTagsOperation` / `subscribeRecentTagsOperation`（`apps/web/src/infrastructure/firestore/tags.ts`）
- `useTags` / `useRecentTags`（既存）
- `TagSuggestionDropdown`（既存、修正不要）
- `BookRegistrationModal` / `BookEditModal` のタグ入力 UI（既存、修正不要）
- `removeGroupFromAllBooksOperation`（パターンを流用）
- `onDeleteGroup` トリガー（パターンを流用）
- `GroupList.tsx` / `EditGroupDialog.tsx` / `DeleteGroupAlertDialog.tsx` / `routes/_authed/groups.tsx`（パターンを流用）

---

## 検証方法

### Functions トリガー

1. タグ付きで本を登録 → `onCreateBook` が発火し、`users/{uid}/tags/{autoId}` に `label` / `count=1` で新規タグ作成されること
2. 同じタグを別の本に付けて登録 → 既存タグの `count=2` になること
3. 本のタグを編集で変更 → `onUpdateBook` が差分を検出し、追加タグ `+1`、削除タグ `-1` されること
4. 本を削除 → `onDeleteBook` がタグ count をデクリメントし、count が 0 になれば該当タグドキュメントが消えること

### タグ絞り込み UI

5. サイドナビの任意タグをクリック → URL が `/?tag=xxx` になり、`BookList` がそのタグを含む本のみ表示すること
6. 「すべて」クリックで絞り込みが解除されること
7. タグ絞り込み中にタグピル（上部ナビ）のハイライトが切り替わること

### タグ管理（FR-TAG-002）

8. `/tags` ページでタグ一覧が表示されること
9. タグを削除 → `onDeleteTag` が発火し、全ての本の `tags` 配列から該当ラベルが除去されること
10. タグ名を変更 → 対象本の `tags` 配列で旧ラベルが新ラベルに置き換わり、`onUpdateBook` 経由で旧タグ count が 0 になり自動削除、新タグが自動作成されること

### 正規化・重複除去

11. 「React 」（末尾に空白）と「React」を異なる本に登録 → 同じタグにマージされて `count=2` になること
12. 同一本に同じタグを 2 回入力しようとしても重複追加されないこと（クライアント側ガード）
13. 仮に Firestore に直接 `tags: ['React', 'React']` が書かれた状態でトリガーが走っても、count が `+1` しか増えないこと（サーバー側重複除去の保険）

### セキュリティ

14. クライアントから `updatedBy: 'trigger'` で book を更新しようとすると rules で拒否されること

### ビルド確認

最終的に以下を実行し両方通ること：

```bash
pnpm web build
pnpm functions pre-build
```
