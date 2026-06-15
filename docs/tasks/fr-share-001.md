# FR-SHARE-001〜004: グループ共有機能 実装計画

## Context

文脈グループを外部ユーザーに共有する機能を追加する。共有リンク（`/shared/{sharedGroupId}`）を生成し、認証不要で閲覧可能なパブリックページを提供する。共有データはスナップショットだが、元グループや本の変更時に Cloud Functions トリガーで自動同期する。

設計方針:
- クライアントから Firestore に直接読み書きし、Cloud Functions は Firestore トリガーによる自動同期のみ担当する（HTTPS API は使わない）
- `sharedGroups` はトップレベルコレクション（ユーザーのサブコレクションではない）。認証不要で読み取り可能にするため
- 共有ページに表示する情報はタイトル・著者・表紙画像・タグのみ（メモ・foundBy・location・purchasedBy・読了フラグは含めない）

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1-1: SharedGroup エンティティ型を定義 | 未着手 |
| Task 1-2: entities/index.ts にエクスポート追加 | 未着手 |
| Task 2-1: クライアント側 sharedGroups Operations | 未着手 |
| Task 2-2: books.ts に全件取得用 Operation 追加 | 未着手 |
| Task 2-3: Admin SDK 側 sharedGroups Operations | 未着手 |
| Task 3-1: useSharedGroups フック | 未着手 |
| Task 3-2: useCreateSharedGroupMutation フック | 未着手 |
| Task 3-3: useDeleteSharedGroupMutation フック | 未着手 |
| Task 3-4: useSharedGroup フック（公開ページ用） | 未着手 |
| Task 3-5: ShareGroupDialog コンポーネント | 未着手 |
| Task 3-6: GroupList.tsx を修正 | 未着手 |
| Task 4-1: onUpdateGroup トリガー新規作成 | 未着手 |
| Task 4-2: onDeleteGroup トリガー修正 | 未着手 |
| Task 4-3: onCreateBook トリガー修正 | 未着手 |
| Task 4-4: onUpdateBook トリガー修正 | 未着手 |
| Task 4-5: onDeleteBook トリガー修正 | 未着手 |
| Task 4-6: functions/index.ts にエクスポート追加 | 未着手 |
| Task 5-1: 共有グループ閲覧ページ | 未着手 |
| Task 5-2: SharedBookCard コンポーネント | 未着手 |
| Task 5-3: __root.tsx のレイアウト分岐修正 | 未着手 |
| Task 5-4: Firestore Security Rules 更新 | 未着手 |
| Task 6: ビルド確認 | 未着手 |

---

## フェーズ 1: 型定義 (packages/common)

### Task 1-1: SharedGroup エンティティ型を定義

**ファイル:** `packages/common/src/entities/SharedGroup.ts`（新規）

定義する型・定数:
- `sharedGroupCollection = 'sharedGroups' as const`
- `SharedGroupId = string`
- `SharedBook`: `{ title: string | null, author: string | null, coverImageUrl: string | null, tags: string[], amazonUrl: string }`
- `SharedGroup`: `{ sharedGroupId: SharedGroupId, uid: string, groupId: string, groupLabel: string, books: SharedBook[], createdAt: Date, updatedAt: Date }`
- `CreateSharedGroupDto`: `Omit<SharedGroup, 'sharedGroupId' | 'createdAt' | 'updatedAt'> & { createdAt: FieldValue, updatedAt: FieldValue }`（firebase/firestore の FieldValue）
- `UpdateSharedGroupDtoFromAdmin`: `{ groupLabel?: string, books?: SharedBook[], updatedAt: AdminFieldValue }`（firebase-admin の FieldValue）

パターン参照: `packages/common/src/entities/Group.ts`

### Task 1-2: index.ts にエクスポート追加

**ファイル:** `packages/common/src/entities/index.ts`

`export * from './SharedGroup'` を追加。

---

## フェーズ 2: Firestore Operations 層

### Task 2-1: クライアント側 Operations

**ファイル:** `apps/web/src/infrastructure/firestore/sharedGroups.ts`（新規）

sharedGroups はトップレベルコレクション（`collection(db, sharedGroupCollection)`）。

実装する関数:
- `createSharedGroupOperation(dto: CreateSharedGroupDto): Promise<string>` — `addDoc` で自動ID生成、生成された docId を返す
- `deleteSharedGroupOperation(sharedGroupId: SharedGroupId): Promise<void>` — `deleteDoc`
- `getSharedGroupOperation(sharedGroupId: SharedGroupId): Promise<SharedGroup | null>` — `getDoc` で単体取得（公開ページ用、認証不要）
- `subscribeSharedGroupsByUidOperation(uid: Uid, setter: (groups: SharedGroup[]) => void, onError?: (error: Error) => void): Unsubscribe` — `where('uid', '==', uid)` で購読

日付変換: `convertDate(data, ['createdAt', 'updatedAt'])` パターンを使用。

パターン参照: `apps/web/src/infrastructure/firestore/groups.ts`, `apps/web/src/infrastructure/firestore/books.ts`

### Task 2-2: books.ts に全件取得用 Operation 追加

**ファイル:** `apps/web/src/infrastructure/firestore/books.ts`（修正）

`fetchAllBooksByGroupOperation(uid: Uid, groupLabel: string): Promise<Book[]>` を追加。

既存の `fetchBooksByGroupOperation` はページネーション前提（limit + cursor）のため、共有スナップショット作成時に全件取得する関数を新設する。`where('groups', 'array-contains', groupLabel)` + `orderBy('createdAt', 'desc')` で全件取得。

### Task 2-3: Admin SDK 側 Operations

**ファイル:** `apps/functions/src/infrastructure/firestore/sharedGroups.ts`（新規）

実装する関数:
- `fetchSharedGroupsByGroupIdOperation(uid: string, groupId: string): Promise<Array<{ sharedGroupId: string }>>` — `where('uid', '==', uid).where('groupId', '==', groupId)` でクエリ
- `fetchSharedGroupsByGroupLabelOperation(uid: string, groupLabel: string): Promise<Array<{ sharedGroupId: string }>>` — `where('uid', '==', uid).where('groupLabel', '==', groupLabel)` でクエリ（本変更時の books 再構築用）
- `updateSharedGroupOperation(sharedGroupId: string, dto: UpdateSharedGroupDtoFromAdmin): Promise<void>`
- `deleteSharedGroupOperation(sharedGroupId: string): Promise<void>`
- `rebuildSharedGroupBooksOperation(uid: string, groupLabel: string): Promise<void>` — 該当グループに属する全 Book を取得し、SharedBook[] に変換して `sharedGroups` ドキュメントの `books` フィールドを上書き更新

パターン参照: `apps/functions/src/infrastructure/firestore/groups.ts`

---

## フェーズ 3: Hooks + UI コンポーネント (apps/web)

### Task 3-1: useSharedGroups フック

**ファイル:** `apps/web/src/features/groups/hooks/useSharedGroups.ts`（新規）

- `useFirebaseAuthContext()` から uid を取得
- `subscribeSharedGroupsByUidOperation` でリアルタイム購読
- `useEffect` + cleanup で unsubscribe
- 戻り値: `{ sharedGroups: SharedGroup[], isLoading: boolean }`

パターン参照: `apps/web/src/features/groups/hooks/useGroups.ts`

### Task 3-2: useCreateSharedGroupMutation フック

**ファイル:** `apps/web/src/features/groups/hooks/useCreateSharedGroupMutation.ts`（新規）

処理フロー:
1. uid チェック
2. `fetchAllBooksByGroupOperation(uid, group.label)` でグループの全本を取得
3. 各 Book から SharedBook に変換: `{ title, author, coverImageUrl, tags, amazonUrl }` のみ抽出
4. `createSharedGroupOperation({ uid, groupId, groupLabel, books, createdAt: serverTimestamp, updatedAt: serverTimestamp })` で Firestore に書き込み
5. 返された sharedGroupId でクリップボードにリンクをコピー: `navigator.clipboard.writeText(url)`
6. `toast.success('共有リンクを作成しました')`

入力型: `{ group: Group }`（groupId と label を使用）

パターン参照: `apps/web/src/features/groups/hooks/useCreateGroupMutation.ts`

### Task 3-3: useDeleteSharedGroupMutation フック

**ファイル:** `apps/web/src/features/groups/hooks/useDeleteSharedGroupMutation.ts`（新規）

- `deleteSharedGroupOperation(sharedGroupId)` を呼ぶ
- `toast.success('共有を解除しました')`

パターン参照: `apps/web/src/features/groups/hooks/useDeleteGroupMutation.ts`

### Task 3-4: useSharedGroup フック（公開ページ用）

**ファイル:** `apps/web/src/features/shared/hooks/useSharedGroup.ts`（新規）

- 引数: `sharedGroupId: string`
- `useEffect` 内で `getSharedGroupOperation(sharedGroupId)` を呼び出し
- 認証不要（uid を使わない）
- 戻り値: `{ sharedGroup: SharedGroup | null | undefined, isLoading: boolean }`
  - `undefined`: 初期ローディング状態
  - `null`: ドキュメントが存在しない

### Task 3-5: ShareGroupDialog コンポーネント

**ファイル:** `apps/web/src/features/groups/components/ShareGroupDialog.tsx`（新規）

Props: `{ isOpen: boolean, onClose: () => void, group: Group, sharedGroup: SharedGroup | null }`

表示の条件分岐:
- `sharedGroup === null`: 「共有リンクを生成」ボタン → `useCreateSharedGroupMutation` を呼ぶ
- `sharedGroup` が存在:
  - 共有リンク表示: `{window.location.origin}/shared/{sharedGroup.sharedGroupId}`
  - 「リンクをコピー」ボタン: `navigator.clipboard.writeText(url)` + `toast.success('リンクをコピーしました')`
  - 「共有を解除」ボタン: 確認後に `useDeleteSharedGroupMutation` を呼ぶ

パターン参照: `apps/web/src/features/groups/components/DeleteGroupAlertDialog.tsx`

### Task 3-6: GroupList.tsx を修正

**ファイル:** `apps/web/src/features/groups/components/GroupList.tsx`（修正）

変更内容:
1. `useSharedGroups()` を追加呼び出し
2. 各グループカードに「共有」ボタン（`Share2` アイコン from lucide-react）を追加
3. `useDisclosure()` で `shareDisclosure` を追加
4. `selectedGroup` をセットして `shareDisclosure.open()` するハンドラを追加
5. `ShareGroupDialog` をレンダリング（sharedGroups から該当する sharedGroup を検索して渡す）

---

## フェーズ 4: Cloud Functions トリガー (apps/functions)

### Task 4-1: onUpdateGroup トリガー新規作成

**ファイル:** `apps/functions/src/triggers/onUpdateGroup.ts`（新規）

- `onDocumentUpdated` で `users/{uid}/groups/{groupId}` を監視
- `triggerOnce('onUpdateGroup', ...)` でラップ
- before/after の `label` を比較し、変更があれば:
  - `fetchSharedGroupsByGroupIdOperation(uid, groupId)` で対象の sharedGroup を取得
  - `updateSharedGroupOperation(sharedGroupId, { groupLabel: after.label, updatedAt: FieldValue.serverTimestamp() })` で同期

パターン参照: `apps/functions/src/triggers/onUpdateBook.ts`

### Task 4-2: onDeleteGroup トリガー修正

**ファイル:** `apps/functions/src/triggers/onDeleteGroup.ts`（修正）

既存処理（`removeGroupFromAllBooksOperation`）の後に追加:
- `fetchSharedGroupsByGroupIdOperation(uid, groupId)` で対象の sharedGroup を取得
- 各 sharedGroup を `deleteSharedGroupOperation(sharedGroupId)` で削除

### Task 4-3: onCreateBook トリガー修正

**ファイル:** `apps/functions/src/triggers/onCreateBook.ts`（修正）

グループ count 同期の後に追加:
- 本の `groups` 配列の各 label に対して `rebuildSharedGroupBooksOperation(uid, label)` を呼ぶ
- sharedGroup が存在しないグループは rebuildSharedGroupBooksOperation 内でスキップされる

### Task 4-4: onUpdateBook トリガー修正

**ファイル:** `apps/functions/src/triggers/onUpdateBook.ts`（修正）

タグ count 差分同期の後に追加:
- before/after の公開対象フィールド（title, author, coverImageUrl, tags, amazonUrl, groups）を比較
- 変更があれば、影響を受ける全グループ（before.groups ∪ after.groups）に対して `rebuildSharedGroupBooksOperation` を呼ぶ

### Task 4-5: onDeleteBook トリガー修正

**ファイル:** `apps/functions/src/triggers/onDeleteBook.ts`（修正）

タグ count 同期の後に追加:
- 削除された本の `groups` 配列の各 label に対して `rebuildSharedGroupBooksOperation(uid, label)` を呼ぶ

### Task 4-6: index.ts にエクスポート追加

**ファイル:** `apps/functions/src/index.ts`

`export { onUpdateGroup } from './triggers/onUpdateGroup'` を追加。

---

## フェーズ 5: 公開ページ + セキュリティルール

### Task 5-1: 共有グループ閲覧ページ

**ファイル:** `apps/web/src/routes/shared/$sharedGroupId.tsx`（新規）

- `createFileRoute('/shared/$sharedGroupId')` で定義
- 認証不要のパブリックページ（`beforeLoad` で認証チェックしない）
- `useSharedGroup(sharedGroupId)` で sharedGroup を取得
- sharedGroup が `null`: 「このページは公開されていません」メッセージ
- sharedGroup が存在:
  - ヘッダー: アプリ名「BookPoolContexts」+ 「このアプリを使ってみる」リンク（→ `/login`）
  - グループ名を見出し表示
  - 本のカードグリッド（SharedBookCard を使用）

### Task 5-2: SharedBookCard コンポーネント

**ファイル:** `apps/web/src/features/shared/components/SharedBookCard.tsx`（新規）

- Props: `{ book: SharedBook }`
- 表紙画像（coverImageUrl、なければ No Image プレースホルダー）
- タイトル・著者名
- タグバッジ
- レスポンシブグリッド対応

### Task 5-3: __root.tsx のレイアウト分岐修正

**ファイル:** `apps/web/src/routes/__root.tsx`（修正）

- 既存の `isAuthPath`（`/login` 判定）を拡張し、`/shared/` で始まるパスもサイドバー/ヘッダー/フッターを非表示にする

### Task 5-4: Firestore Security Rules 更新

**ファイル:** `firestore.rules`（修正）

```javascript
function isValidSharedGroupSchema(d) {
  return d.size() == 6
    && 'uid' in d && d.uid is string
    && 'groupId' in d && d.groupId is string
    && 'groupLabel' in d && d.groupLabel is string
    && 'books' in d && d.books is list
    && 'createdAt' in d && d.createdAt is timestamp
    && 'updatedAt' in d && d.updatedAt is timestamp;
}

match /sharedGroups/{sharedGroupId} {
  allow read;  // パブリック読み取り
  allow create: if isSignedIn() && isUser(requestData().uid) && isValidSharedGroupSchema(requestData());
  allow delete: if isSignedIn() && isUser(resource.data.uid);
  // update はクライアント不可（Cloud Functions の Admin SDK のみ）
}
```

---

## 実装順序

```
フェーズ 1（型定義）
  ↓
フェーズ 2（Operations 層）
  ↓
フェーズ 3, 4, 5（並行可能）
```

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/SharedGroup.ts` | 新規 | SharedGroup エンティティ型定義 |
| `packages/common/src/entities/index.ts` | 修正 | エクスポート追加 |
| `apps/web/src/infrastructure/firestore/sharedGroups.ts` | 新規 | クライアント側 Operations |
| `apps/web/src/infrastructure/firestore/books.ts` | 修正 | 全件取得用 Operation 追加 |
| `apps/web/src/features/groups/hooks/useSharedGroups.ts` | 新規 | 共有グループ一覧購読フック |
| `apps/web/src/features/groups/hooks/useCreateSharedGroupMutation.ts` | 新規 | 共有グループ作成フック |
| `apps/web/src/features/groups/hooks/useDeleteSharedGroupMutation.ts` | 新規 | 共有グループ削除フック |
| `apps/web/src/features/shared/hooks/useSharedGroup.ts` | 新規 | 公開ページ用取得フック |
| `apps/web/src/features/groups/components/ShareGroupDialog.tsx` | 新規 | 共有ダイアログ |
| `apps/web/src/features/groups/components/GroupList.tsx` | 修正 | 共有ボタン追加 |
| `apps/web/src/features/shared/components/SharedBookCard.tsx` | 新規 | 公開ページ用カード |
| `apps/web/src/routes/shared/$sharedGroupId.tsx` | 新規 | 公開ページルート |
| `apps/web/src/routes/__root.tsx` | 修正 | レイアウト分岐修正 |
| `apps/functions/src/infrastructure/firestore/sharedGroups.ts` | 新規 | Admin SDK 側 Operations |
| `apps/functions/src/triggers/onUpdateGroup.ts` | 新規 | グループ更新トリガー |
| `apps/functions/src/triggers/onDeleteGroup.ts` | 修正 | 共有グループ削除追加 |
| `apps/functions/src/triggers/onCreateBook.ts` | 修正 | 共有グループ books 再構築追加 |
| `apps/functions/src/triggers/onUpdateBook.ts` | 修正 | 共有グループ books 再構築追加 |
| `apps/functions/src/triggers/onDeleteBook.ts` | 修正 | 共有グループ books 再構築追加 |
| `apps/functions/src/index.ts` | 修正 | onUpdateGroup エクスポート追加 |
| `firestore.rules` | 修正 | sharedGroups ルール追加 |

## 検証方法

### ビルド確認

```bash
pnpm web build
pnpm functions pre-build
```

### 機能確認（共有リンク生成）

1. グループ管理画面で任意のグループの「共有」ボタンを押す
2. ShareGroupDialog で「共有リンクを生成」を押す
3. Firestore に `sharedGroups` ドキュメントが作成されていること
4. クリップボードに共有リンクがコピーされていること

### 機能確認（公開ページ閲覧）

1. 共有リンクを未ログインブラウザで開く
2. グループ名と本の一覧が表示されること
3. 表示される情報がタイトル・著者・表紙画像・タグのみであること
4. 存在しない sharedGroupId でアクセスすると「このページは公開されていません」と表示されること

### 機能確認（自動同期）

1. 元グループの label を変更 → 共有ページのグループ名が変わること
2. グループに属する本を追加 → 共有ページに反映されること
3. グループに属する本の title や tags を変更 → 共有ページに反映されること
4. グループに属する本を削除 → 共有ページから消えること
5. 元グループを削除 → 共有ページが「公開されていません」表示になること

### 機能確認（共有解除）

1. ShareGroupDialog で「共有を解除」を押す
2. 確認後、sharedGroups ドキュメントが削除されること
3. 共有リンクにアクセスすると「公開されていません」と表示されること

### セキュリティ確認

- 未ログイン状態で sharedGroups を read できること
- 未ログイン状態で sharedGroups を create/delete できないこと
- 他ユーザーの uid で sharedGroups を create できないこと
- 他ユーザーの sharedGroups を delete できないこと
