<!-- @format -->

# FR-GROUP-002: グループの編集・削除 実装計画

## Context

FR-GROUP-001 で作成したグループのラベル変更と削除が必要。削除時には、そのグループに所属する全ての本の `groups` 配列から該当 `groupId` を除去する必要がある。この一括更新は Cloud Functions の `onDeleteGroup` トリガーで Admin SDK のバッチ処理として実装し、クライアント側はグループドキュメントの削除のみを行う。

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: useUpdateGroupMutation フック | 実装済み |
| Task 2: useDeleteGroupMutation フック | 実装済み |
| Task 3: EditGroupDialog コンポーネント | 実装済み |
| Task 4: DeleteGroupAlertDialog コンポーネント | 実装済み |
| Task 5: GroupList にアクションメニュー追加 | 実装済み |
| Task 6: Functions - groups admin Operations | 実装済み |
| Task 7: Functions - books admin Operations に一括除去関数追加 | 実装済み |
| Task 8: Functions - onDeleteGroup トリガー | 実装済み |

---

## 実装タスク

### Task 1: useUpdateGroupMutation フック

**ファイル:** `apps/web/src/features/groups/hooks/useUpdateGroupMutation.ts`（新規）

既存の `useCreateBookMutation` と同じパターン。

```typescript
import { useState } from 'react'
import { toast } from 'sonner'
import type { GroupId, UpdateGroupDto } from '@bookpoolcontexts/common'
import { updateGroupOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'

export type UpdateGroupInput = {
  label: string
}

export type UseUpdateGroupMutationReturn = {
  updateGroup: (groupId: GroupId, input: UpdateGroupInput) => Promise<void>
  isUpdating: boolean
}

export const useUpdateGroupMutation = (): UseUpdateGroupMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isUpdating, setIsUpdating] = useState(false)

  const updateGroup = async (
    groupId: GroupId,
    input: UpdateGroupInput,
  ): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsUpdating(true)
    try {
      const dto: UpdateGroupDto = {
        label: input.label,
        updatedAt: serverTimestamp,
      }
      await updateGroupOperation(uid, groupId, dto)
      toast.success('グループを更新しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsUpdating(false)
    }
  }

  return { updateGroup, isUpdating }
}
```

---

### Task 2: useDeleteGroupMutation フック

**ファイル:** `apps/web/src/features/groups/hooks/useDeleteGroupMutation.ts`（新規）

クライアント側ではグループドキュメントの削除のみ。本の `groups` 配列からの除去は Cloud Functions の `onDeleteGroup` トリガー（Task 8）が担当する。

```typescript
import { useState } from 'react'
import { toast } from 'sonner'
import type { GroupId } from '@bookpoolcontexts/common'
import { deleteGroupOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseDeleteGroupMutationReturn = {
  deleteGroup: (groupId: GroupId) => Promise<void>
  isDeleting: boolean
}

export const useDeleteGroupMutation = (): UseDeleteGroupMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteGroup = async (groupId: GroupId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsDeleting(true)
    try {
      await deleteGroupOperation(uid, groupId)
      toast.success('グループを削除しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsDeleting(false)
    }
  }

  return { deleteGroup, isDeleting }
}
```

---

### Task 3: EditGroupDialog コンポーネント

**ファイル:** `apps/web/src/features/groups/components/EditGroupDialog.tsx`（新規）

CreateGroupDialog と同様のパターンだが、既存のラベルを初期値に設定する。`useEffect` でモーダルが開くたびに `reset(defaultValues)` を呼ぶ。

```typescript
type EditGroupDialogProps = {
  isOpen: boolean
  onClose: () => void
  group: Group
}
```

- `useUpdateGroupMutation()` で更新
- `react-hook-form` + `zodResolver` でバリデーション
- スキーマ: `label: z.string().min(1).max(100)`

---

### Task 4: DeleteGroupAlertDialog コンポーネント

**ファイル:** `apps/web/src/features/groups/components/DeleteGroupAlertDialog.tsx`（新規）

確認ダイアログ。グループに所属する本がある場合は本の数を表示して注意喚起する。

```typescript
type DeleteGroupAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  group: Group
}
```

- `group.count > 0` の場合:「このグループには{count}冊の本が登録されています。本自体は削除されませんが、グループの紐付けが解除されます。」
- 削除ボタンは `variant="destructive"`
- `useDeleteGroupMutation()` で削除

---

### Task 5: GroupList にアクションメニュー追加

**ファイル:** `apps/web/src/features/groups/components/GroupList.tsx`（修正 — FR-GROUP-001 Task 4 で作成）

各グループの Card に編集・削除ボタンを追加。

- `useState<Group | null>` で選択中のグループを管理
- `useDisclosure` で EditGroupDialog と DeleteGroupAlertDialog の開閉を管理
- 各 Card 内に「編集」「削除」ボタン（`variant="ghost"`, `size="sm"`）

---

### Task 6: Functions - groups admin Operations

**ファイル:** `apps/functions/src/infrastructure/firestore/groups.ts`（新規）

`apps/functions/src/infrastructure/firestore/books.ts` と同じパターンで firebase-admin SDK を使用。

```typescript
import type {
  GroupId,
  Uid,
  UpdateGroupDtoFromAdmin,
} from '@bookpoolcontexts/common'
import { groupCollection, userCollection } from '@bookpoolcontexts/common'
import { db } from '~/lib/firebase'

const groupsRef = (uid: Uid) =>
  db.collection(userCollection).doc(uid).collection(groupCollection)

const groupDocRef = (uid: Uid, groupId: GroupId) =>
  groupsRef(uid).doc(groupId)

/** グループを更新する */
export const updateGroupOperation = async (
  uid: Uid,
  groupId: GroupId,
  dto: UpdateGroupDtoFromAdmin,
): Promise<void> => {
  await groupDocRef(uid, groupId).update(dto)
}
```

**ファイル:** `apps/functions/src/infrastructure/firestore/index.ts`（修正）

`export * from './groups'` を追加。

---

### Task 7: Functions - books admin Operations に一括除去関数追加

**ファイル:** `apps/functions/src/infrastructure/firestore/books.ts`（修正）

特定グループに所属する全ての本の `groups` 配列から `groupId` を除去するバッチ処理関数を追加する。

```typescript
import { bookCollection, userCollection } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '~/lib/firebase'

/** 特定グループに所属する全ての本から groupId を除去する */
export const removeGroupFromAllBooksOperation = async (
  uid: string,
  groupId: string,
): Promise<void> => {
  const booksRef = db
    .collection(userCollection)
    .doc(uid)
    .collection(bookCollection)
  const snapshot = await booksRef
    .where('groups', 'array-contains', groupId)
    .get()

  if (snapshot.empty) return

  const batch = db.batch()
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      groups: FieldValue.arrayRemove(groupId),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
}
```

---

### Task 8: Functions - onDeleteGroup トリガー

**ファイル:** `apps/functions/src/triggers/onDeleteGroup.ts`（新規）

グループ削除時に、そのグループに所属する全ての本の `groups` 配列から該当 `groupId` を除去する。

```typescript
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { removeGroupFromAllBooksOperation } from '~/infrastructure/firestore/books'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteGroup = onDocumentDeleted(
  {
    document: 'users/{uid}/groups/{groupId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onDeleteGroup', async (event) => {
    if (!event.data) return

    const { uid, groupId } = event.params

    try {
      await removeGroupFromAllBooksOperation(uid, groupId)
      console.log(
        'グループ削除に伴う本の更新が完了しました:',
        groupId,
      )
    } catch (error) {
      console.error(
        'グループ削除時の本の更新に失敗:',
        groupId,
        error,
      )
      throw error
    }
  }),
)
```

**ファイル:** `apps/functions/src/index.ts`（修正）

```typescript
export { onDeleteGroup } from './triggers/onDeleteGroup'
```

---

## 実装順序

1. Task 6（Functions groups Operations）→ Functions 側の基盤
2. Task 7（books admin Operations 一括除去）→ バッチ削除ロジック
3. Task 8（onDeleteGroup トリガー）→ 削除時の一括更新
4. Task 1（useUpdateGroupMutation）→ 更新ロジック
5. Task 2（useDeleteGroupMutation）→ 削除ロジック
6. Task 3（EditGroupDialog）→ 編集 UI
7. Task 4（DeleteGroupAlertDialog）→ 削除確認 UI
8. Task 5（GroupList 修正）→ アクション統合

## 検証方法

1. グループ一覧で「編集」をクリックし、ラベルを変更して保存 → Firestore の `label` フィールドが更新されること
2. グループ一覧で「削除」をクリックし、確認ダイアログが表示されること
3. 本が 0 冊のグループを削除 → ドキュメントが削除されること
4. 本が登録されたグループを削除 → 確認ダイアログに本の数が表示されること
5. 削除実行後、`onDeleteGroup` トリガーが発火し、該当グループに所属していた全ての本の `groups` 配列から `groupId` が除去されること
6. `pnpm web build` と `pnpm functions pre-build` が通ること
