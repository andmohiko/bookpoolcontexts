# FR-SETTINGS-004 + FR-SHARE 拡張: 表示名の設定と共有ページへの反映

## Context

共有グループ閲覧ページで「○○ の Web開発」のようにユーザー名を表示したい。そのために:
1. users コレクションに `displayName` フィールドを追加する
2. 設定画面に表示名の編集機能を追加する
3. sharedGroups コレクションに `ownerName` フィールドを追加する
4. 共有リンク生成時に `ownerName` をスナップショットとして保存する
5. 共有ページで「{ownerName} の {グループ名}」と表示する

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1: User エンティティ型に displayName を追加 | 未着手 |
| Task 2: Firestore Security Rules を更新 | 未着手 |
| Task 3: ユーザー初回作成時に displayName を設定 | 未着手 |
| Task 4: 設定画面に表示名の編集 UI を追加 | 未着手 |
| Task 5: SharedGroup エンティティ型に ownerName を追加 | 未着手 |
| Task 6: 共有グループ作成時に ownerName を保存 | 未着手 |
| Task 7: 共有ページで ownerName を表示 | 未着手 |
| Task 8: firestore-design.md の更新 | 完了 |
| Task 9: ビルド確認 | 未着手 |

---

## 実装タスク

### Task 1: User エンティティ型に displayName を追加

**ファイル:** `packages/common/src/entities/User.ts`（修正）

- `User` 型に `displayName: string` を追加
- `CreateUserDto` は `Omit` パターンで自動的に含まれる
- `UpdateUserDto` に `displayName?: string` を追加

### Task 2: Firestore Security Rules を更新

**ファイル:** `firestore.rules`（修正）

- `isValidUserSchema`: `size() == 3` → `size() == 4` に変更、`'displayName' in requestData && requestData.displayName is string` を追加
- `isValidSharedGroupSchema`: `size() == 6` → `size() == 7` に変更、`'ownerName' in requestData && requestData.ownerName is string` を追加

### Task 3: ユーザー初回作成時に displayName を設定

**ファイル:** `apps/web/src/providers/FirebaseAuthProvider.tsx`（修正）

`createUserOperation` の呼び出しで `displayName` を追加:
- Google Auth の `result.user.displayName` が取得できればそれを使用
- なければメールアドレスの `@` より前の部分を使用
- メールアドレスも取得できなければ空文字

```typescript
const email = result.user.email ?? ''
const defaultDisplayName =
  result.user.displayName ?? email.split('@')[0] ?? ''

await createUserOperation(uid, {
  displayName: defaultDisplayName,
  email,
  createdAt: serverTimestamp,
  updatedAt: serverTimestamp,
})
```

### Task 4: 設定画面に表示名の編集 UI を追加

**ファイル:** `apps/web/src/routes/_authed/settings.tsx`（修正）

- 「プロフィール」セクションを追加（テーマセクションの上に配置）
- 表示名の入力フィールドと「保存」ボタン
- 現在の `displayName` を初期値として表示するために、`fetchUserOperation` でユーザー情報を取得
- 保存時は `updateUserOperation` で `displayName` と `updatedAt` を更新
- 成功時に `toast.success('表示名を更新しました')`

パターン参照: 同ファイル内のテーマ設定・読了非表示の UI パターン

### Task 5: SharedGroup エンティティ型に ownerName を追加

**ファイル:** `packages/common/src/entities/SharedGroup.ts`（修正）

- `SharedGroup` 型に `ownerName: string` を追加
- `CreateSharedGroupDto` は `Omit` パターンで自動的に含まれる
- `UpdateSharedGroupDtoFromAdmin` に `ownerName?: string` を追加

### Task 6: 共有グループ作成時に ownerName を保存

**ファイル:** `apps/web/src/features/groups/hooks/useCreateSharedGroupMutation.ts`（修正）

- `fetchUserOperation(uid)` でユーザー情報を取得
- `dto` に `ownerName: user?.displayName ?? ''` を追加

```typescript
const user = await fetchUserOperation(uid)
const dto: CreateSharedGroupDto = {
  uid,
  groupId: group.groupId,
  groupLabel: group.label,
  ownerName: user?.displayName ?? '',
  books: sharedBooks,
  createdAt: serverTimestamp,
  updatedAt: serverTimestamp,
}
```

パターン参照: `apps/web/src/infrastructure/firestore/users.ts` の `fetchUserOperation`

### Task 7: 共有ページで ownerName を表示

**ファイル:** `apps/web/src/routes/shared/$sharedGroupId.tsx`（修正）

見出し表示を変更:
- `ownerName` が存在する（空文字でない）場合: 「{ownerName} の {groupLabel}」
- `ownerName` が空文字または未設定の場合: `groupLabel` のみ

```tsx
<h1 className="mb-6 text-2xl font-bold">
  {sharedGroup.ownerName
    ? `${sharedGroup.ownerName} の ${sharedGroup.groupLabel}`
    : sharedGroup.groupLabel}
</h1>
```

---

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/User.ts` | 修正 | displayName フィールド追加 |
| `packages/common/src/entities/SharedGroup.ts` | 修正 | ownerName フィールド追加 |
| `firestore.rules` | 修正 | スキーマバリデーション更新 |
| `apps/web/src/providers/FirebaseAuthProvider.tsx` | 修正 | 初回作成時に displayName を設定 |
| `apps/web/src/routes/_authed/settings.tsx` | 修正 | 表示名の編集 UI を追加 |
| `apps/web/src/features/groups/hooks/useCreateSharedGroupMutation.ts` | 修正 | ownerName を DTO に追加 |
| `apps/web/src/routes/shared/$sharedGroupId.tsx` | 修正 | ownerName の表示 |

## 実装順序

1. Task 1（User 型定義）
2. Task 5（SharedGroup 型定義）
3. Task 2（セキュリティルール）
4. Task 3（初回ユーザー作成）
5. Task 4（設定画面 UI）
6. Task 6（共有グループ作成時の ownerName）
7. Task 7（共有ページ表示）
8. Task 9（ビルド確認）

## 検証方法

### ビルド確認

```bash
pnpm web build
pnpm functions pre-build
```

### 機能確認（表示名の設定）

1. 設定画面を開く
2. 「プロフィール」セクションに表示名の入力フィールドが表示されている
3. 表示名を入力して保存 → Firestore の users ドキュメントの `displayName` が更新されること
4. ページをリロードしても設定値が保持されていること

### 機能確認（共有ページへの反映）

1. 表示名を設定した状態で、グループの共有リンクを新規作成する
2. 共有リンクを開く → 「{表示名} の {グループ名}」と表示されること
3. 表示名を未設定（空文字）の状態で共有リンクを新規作成する
4. 共有リンクを開く → グループ名のみ表示されること

### 機能確認（新規ユーザー）

1. 新しい Google アカウントで初回ログインする
2. Firestore の users ドキュメントに `displayName` フィールドが存在すること
3. Google アカウントの表示名がデフォルト値として設定されていること

### 既存ユーザーへの影響

- 既存ユーザーの users ドキュメントには `displayName` フィールドが存在しないため、セキュリティルールの `size() == 4` と不整合になる
- 既存ユーザーが設定画面で任意のフィールドを更新する際に `displayName` を含めて保存するか、マイグレーション処理が必要
- 対応方針: 設定画面の表示名保存時に全フィールドを含めて更新する（`updateUserOperation` で `displayName` を必ず含める）
