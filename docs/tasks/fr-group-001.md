<!-- @format -->

# FR-GROUP-001: グループの作成 実装計画

## Context

BookPoolContexts ではユーザーが本をグループ（コンテキスト）に整理できる。Group エンティティ型定義（`packages/common/src/entities/Group.ts`）、Firestore Operations（`apps/web/src/infrastructure/firestore/groups.ts`）、セキュリティルールは実装済みだが、グループを作成・表示するための UI 層（hooks、コンポーネント、ルート）が存在しない。

本タスクでは以下を実装する：

1. グループ一覧をリアルタイム購読するフック
2. グループ作成のミューテーションフック
3. グループ一覧ページ（`/groups` ルート）
4. グループ作成ダイアログ

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: useGroups 購読フック | 実装済み |
| Task 2: useCreateGroupMutation フック | 実装済み |
| Task 3: CreateGroupDialog コンポーネント | 実装済み |
| Task 4: GroupList コンポーネント | 実装済み |
| Task 5: /groups ルートページ | 実装済み |
| Task 6: ナビゲーションにグループ管理リンク追加 | 実装済み |

---

## 実装タスク

### Task 1: useGroups 購読フック

**ファイル:** `apps/web/src/features/groups/hooks/useGroups.ts`（新規）

既存の `useTags`（`apps/web/src/features/tags/hooks/useTags.ts`）と同じパターンで `subscribeGroupsOperation` をリアルタイム購読する。

```typescript
import { useEffect, useState } from 'react'
import type { Group } from '@bookpoolcontexts/common'
import { subscribeGroupsOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseGroupsReturn = {
  groups: Array<Group>
  isLoading: boolean
  error: string | null
}

export const useGroups = (): UseGroupsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [groups, setGroups] = useState<Array<Group>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeGroupsOperation(
      uid,
      (updatedGroups) => {
        setGroups(updatedGroups)
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { groups, isLoading, error }
}
```

---

### Task 2: useCreateGroupMutation フック

**ファイル:** `apps/web/src/features/groups/hooks/useCreateGroupMutation.ts`（新規）

`useCreateBookMutation`（`apps/web/src/features/books/hooks/useCreateBookMutation.ts`）と同じパターン。

```typescript
import { useState } from 'react'
import { toast } from 'sonner'
import type { CreateGroupDto } from '@bookpoolcontexts/common'
import { createGroupOperation } from '@/infrastructure/firestore/groups'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { serverTimestamp } from '@/lib/firebase'
import { errorMessage } from '@/utils/errorMessage'

export type CreateGroupInput = {
  label: string
}

export type UseCreateGroupMutationReturn = {
  createGroup: (input: CreateGroupInput) => Promise<void>
  isCreating: boolean
}

export const useCreateGroupMutation = (): UseCreateGroupMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isCreating, setIsCreating] = useState(false)

  const createGroup = async (input: CreateGroupInput): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsCreating(true)
    try {
      const dto: CreateGroupDto = {
        label: input.label,
        count: 0,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      }
      await createGroupOperation(uid, dto)
      toast.success('グループを作成しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsCreating(false)
    }
  }

  return { createGroup, isCreating }
}
```

---

### Task 3: CreateGroupDialog コンポーネント

**ファイル:** `apps/web/src/features/groups/components/CreateGroupDialog.tsx`（新規）

`BookRegistrationModal` と同じ Dialog + react-hook-form + zod パターン。

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateGroupMutation } from '@/features/groups/hooks/useCreateGroupMutation'

const createGroupSchema = z.object({
  label: z.string().min(1, 'グループ名は必須です').max(100),
})

type CreateGroupFormValues = z.infer<typeof createGroupSchema>

type CreateGroupDialogProps = {
  isOpen: boolean
  onClose: () => void
}

export const CreateGroupDialog = ({
  isOpen,
  onClose,
}: CreateGroupDialogProps) => {
  const { createGroup, isCreating } = useCreateGroupMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { label: '' },
  })

  const onSubmit = async (data: CreateGroupFormValues): Promise<void> => {
    await createGroup(data)
    reset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>グループを作成</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">グループ名 *</Label>
            <Input id="label" {...register('label')} />
            {errors.label && (
              <p className="text-xs text-destructive">
                {errors.label.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? '作成中...' : '作成'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Task 4: GroupList コンポーネント

**ファイル:** `apps/web/src/features/groups/components/GroupList.tsx`（新規）

グループ一覧表示。各グループのラベルとカウントを表示し、作成ダイアログの開閉も管理する。

- `useGroups()` でグループ一覧を取得
- `useDisclosure()`（`apps/web/src/hooks/useDisclosure.ts`）でダイアログ開閉を管理
- グループ名をクリックするとそのグループの本一覧にナビゲーション（`/?group={groupId}` など。FR-LIST-003 の実装時に対応）
- ローディング中は `Skeleton` を表示
- 0件の場合は「グループがありません」メッセージ

使用コンポーネント: `Card`, `Button`, `Skeleton`, `CreateGroupDialog`

---

### Task 5: /groups ルートページ

**ファイル:** `apps/web/src/routes/_authed/groups.tsx`（新規）

TanStack Router のファイルベースルーティングで `/groups` ルートを作成。`_authed` 配下のため認証は自動保護される。

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { GroupList } from '@/features/groups/components/GroupList'

export const Route = createFileRoute('/_authed/groups')({
  component: GroupsPage,
})

function GroupsPage() {
  return (
    <main className="pb-8 pt-4">
      <h1 className="mb-6 text-xl font-semibold">グループ管理</h1>
      <GroupList />
    </main>
  )
}
```

---

### Task 6: ナビゲーションにグループ管理リンク追加

**ファイル:** ヘッダーまたはサイドナビゲーション（既存のナビゲーションコンポーネント）を修正

`/groups` へのリンクを追加して、グループ管理ページへの導線を作る。

---

## 実装順序

1. Task 1（useGroups）→ データ取得の基盤
2. Task 2（useCreateGroupMutation）→ 作成ロジック
3. Task 3（CreateGroupDialog）→ 作成 UI
4. Task 4（GroupList）→ 一覧 UI（Task 1, 3 に依存）
5. Task 5（/groups ルート）→ ページ統合（Task 4 に依存）
6. Task 6（ナビゲーション）→ 導線

## 検証方法

1. `/groups` にアクセスし、空のグループ一覧が表示されること
2. 「グループを作成」ボタンをクリックし、ダイアログが表示されること
3. グループ名を入力して作成 → Firestore に `users/{uid}/groups/{groupId}` ドキュメントが作成され `count=0` であること
4. 作成後、一覧にリアルタイムで反映されること
5. バリデーション: 空のグループ名では作成できないこと
6. `pnpm web build` が通ること
