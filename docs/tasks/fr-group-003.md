<!-- @format -->

# FR-GROUP-003: 本のグループへの追加・除去 実装計画

## Context

本の登録・編集時にグループを選択できるようにし、グループの `count` フィールドを Cloud Functions トリガーで自動同期する。`bookRegistrationSchema` には既に `groups` フィールドが定義されているが、UI でグループを選択する手段がない。また、本の作成・更新・削除時にグループの `count` を同期する Cloud Functions トリガーが存在しない。

本タスクでは以下を実装する：

1. 本の作成・更新・削除時にグループの `count` を同期する Cloud Functions トリガー
2. グループ選択 UI コンポーネント（チェックボックスリスト）
3. `BookRegistrationModal` へのグループ選択 UI 統合

## 前提

- FR-GROUP-001 の `useGroups` フック（`apps/web/src/features/groups/hooks/useGroups.ts`）が実装済みであること
- FR-GROUP-002 の Functions groups Operations（`apps/functions/src/infrastructure/firestore/groups.ts`）が実装済みであること

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: onCreateBook トリガー更新（グループ count 同期追加） | 実装済み |
| Task 2: onUpdateBook トリガー新規作成 | 実装済み |
| Task 3: onDeleteBook トリガー新規作成 | 実装済み |
| Task 4: GroupCheckboxList コンポーネント | 実装済み |
| Task 5: BookRegistrationModal にグループ選択 UI 追加 | 実装済み |

---

## 実装タスク

### Task 1: onCreateBook トリガー更新（グループ count 同期追加）

**ファイル:** `apps/functions/src/triggers/onCreateBook.ts`（修正）

既存の Amazon 情報取得処理の後に、グループ count 同期処理を追加する。

```typescript
// 既存のインポートに追加
import { updateGroupOperation } from '~/infrastructure/firestore/groups'
import { FieldValue } from 'firebase-admin/firestore'

// 既存の Amazon 情報取得処理の後に追加:
const groups: string[] = data.groups ?? []
if (groups.length > 0) {
  for (const groupId of groups) {
    try {
      await updateGroupOperation(uid, groupId, {
        count: FieldValue.increment(1),
        updatedAt: serverTimestamp,
      })
    } catch (error) {
      console.error('グループカウント更新に失敗:', groupId, error)
    }
  }
  console.log('グループカウントを更新しました:', bookId, groups)
}
```

**注意:** グループ count の同期は Amazon 情報取得の成否に関わらず実行する。Amazon 情報取得処理の `try-catch` の外（後ろ）に配置する。

---

### Task 2: onUpdateBook トリガー新規作成

**ファイル:** `apps/functions/src/triggers/onUpdateBook.ts`（新規）

`onDocumentUpdated` を使用。`before.groups` と `after.groups` の差分のみ同期する。FR-TAG-001 の `onUpdateNote` と同じパターン。

```typescript
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import '~/config/firebase'
import { updateGroupOperation } from '~/infrastructure/firestore/groups'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onUpdateBook = onDocumentUpdated(
  {
    document: 'users/{uid}/books/{bookId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onUpdateBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const before = event.data.before.data()
    const after = event.data.after.data()

    const beforeGroups: string[] = before.groups ?? []
    const afterGroups: string[] = after.groups ?? []

    // groups が変更されていない場合はスキップ
    if (
      JSON.stringify(beforeGroups.sort()) ===
      JSON.stringify(afterGroups.sort())
    ) {
      return
    }

    const addedGroups = afterGroups.filter((g) => !beforeGroups.includes(g))
    const removedGroups = beforeGroups.filter(
      (g) => !afterGroups.includes(g),
    )

    // 追加されたグループの count をインクリメント
    for (const groupId of addedGroups) {
      try {
        await updateGroupOperation(uid, groupId, {
          count: FieldValue.increment(1),
          updatedAt: serverTimestamp,
        })
      } catch (error) {
        console.error(
          'グループカウントのインクリメントに失敗:',
          groupId,
          error,
        )
      }
    }

    // 除去されたグループの count をデクリメント
    for (const groupId of removedGroups) {
      try {
        await updateGroupOperation(uid, groupId, {
          count: FieldValue.increment(-1),
          updatedAt: serverTimestamp,
        })
      } catch (error) {
        console.error(
          'グループカウントのデクリメントに失敗:',
          groupId,
          error,
        )
      }
    }

    console.log('グループカウントを同期しました:', bookId, {
      added: addedGroups,
      removed: removedGroups,
    })
  }),
)
```

---

### Task 3: onDeleteBook トリガー新規作成

**ファイル:** `apps/functions/src/triggers/onDeleteBook.ts`（新規）

`onDocumentDeleted` を使用。削除された本の `groups` に含まれる全グループの count をデクリメントする。

```typescript
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import '~/config/firebase'
import { updateGroupOperation } from '~/infrastructure/firestore/groups'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteBook = onDocumentDeleted(
  {
    document: 'users/{uid}/books/{bookId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onDeleteBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const data = event.data.data()
    const groups: string[] = data.groups ?? []

    if (groups.length === 0) return

    for (const groupId of groups) {
      try {
        await updateGroupOperation(uid, groupId, {
          count: FieldValue.increment(-1),
          updatedAt: serverTimestamp,
        })
      } catch (error) {
        console.error(
          'グループカウントのデクリメントに失敗:',
          groupId,
          error,
        )
      }
    }

    console.log(
      '本の削除に伴いグループカウントを更新しました:',
      bookId,
      groups,
    )
  }),
)
```

**ファイル:** `apps/functions/src/index.ts`（修正）

```typescript
export { onUpdateBook } from './triggers/onUpdateBook'
export { onDeleteBook } from './triggers/onDeleteBook'
```

---

### Task 4: GroupCheckboxList コンポーネント

**ファイル:** `apps/web/src/features/groups/components/GroupCheckboxList.tsx`（新規）

チェックボックスでグループを選択/解除する。`useGroups()`（FR-GROUP-001 で作成）でグループ一覧を取得する。

```typescript
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useGroups } from '@/features/groups/hooks/useGroups'

type GroupCheckboxListProps = {
  selectedGroupIds: string[]
  onChange: (groupIds: string[]) => void
}

export const GroupCheckboxList = ({
  selectedGroupIds,
  onChange,
}: GroupCheckboxListProps) => {
  const { groups, isLoading } = useGroups()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-6 w-32" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">グループがありません</p>
    )
  }

  const toggleGroup = (groupId: string): void => {
    if (selectedGroupIds.includes(groupId)) {
      onChange(selectedGroupIds.filter((id) => id !== groupId))
    } else {
      onChange([...selectedGroupIds, groupId])
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {groups.map((group) => (
        <label
          key={group.groupId}
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox
            checked={selectedGroupIds.includes(group.groupId)}
            onCheckedChange={() => toggleGroup(group.groupId)}
          />
          {group.label}
        </label>
      ))}
    </div>
  )
}
```

---

### Task 5: BookRegistrationModal にグループ選択 UI 追加

**ファイル:** `apps/web/src/features/books/components/BookRegistrationModal.tsx`（修正）

既存の「購入場所」チェックボックスセクションの直後にグループ選択セクションを追加する。

```typescript
// インポート追加
import { GroupCheckboxList } from '@/features/groups/components/GroupCheckboxList'

// watch に groups を追加（既存の tags, purchasedBy の後）
const groups = watch('groups')

// フォーム内の「購入場所」セクションの後に追加:
<div className="space-y-2">
  <Label>グループ</Label>
  <GroupCheckboxList
    selectedGroupIds={groups}
    onChange={(groupIds) => setValue('groups', groupIds)}
  />
</div>
```

---

## 実装順序

1. Task 1（onCreateBook 更新）→ 作成時の count 同期
2. Task 2（onUpdateBook 新規）→ 更新時の count 同期
3. Task 3（onDeleteBook 新規）→ 削除時の count 同期
4. Task 4（GroupCheckboxList）→ グループ選択 UI コンポーネント
5. Task 5（BookRegistrationModal 修正）→ 登録モーダルへの統合

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `apps/functions/src/triggers/onCreateBook.ts` | 修正 | グループ count 同期処理追加 |
| `apps/functions/src/triggers/onUpdateBook.ts` | 新規 | groups 差分の count 同期 |
| `apps/functions/src/triggers/onDeleteBook.ts` | 新規 | 削除時の count デクリメント |
| `apps/functions/src/index.ts` | 修正 | onUpdateBook, onDeleteBook のエクスポート追加 |
| `apps/web/src/features/groups/components/GroupCheckboxList.tsx` | 新規 | チェックボックスによるグループ選択 UI |
| `apps/web/src/features/books/components/BookRegistrationModal.tsx` | 修正 | グループ選択セクション追加 |

## 検証方法

1. 本の登録モーダルでグループのチェックボックスが表示されること（グループが存在する場合）
2. グループが 0 件の場合、「グループがありません」と表示されること
3. グループを選択して本を登録 → Firestore の本ドキュメントの `groups` 配列に `groupId` が含まれること
4. 本の登録後、`onCreateBook` トリガーが発火し、対象グループの `count` がインクリメントされること
5. 本の編集でグループを追加/除去 → `onUpdateBook` トリガーが発火し、追加分がインクリメント・除去分がデクリメントされること
6. 本の削除 → `onDeleteBook` トリガーが発火し、所属グループの `count` がデクリメントされること
7. `pnpm web build` と `pnpm functions pre-build` が通ること
