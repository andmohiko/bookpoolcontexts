## はじめに

Cloud Functions for Firebaseの `onDocumentCreated` / `onDocumentUpdated` トリガーを使うと、ドキュメントの作成や更新をきっかけに自動処理を実行できます。しかし、トリガー内でドキュメントを更新すると、その更新が再びトリガーを発火させ、無限ループに陥る可能性があります。

本ドキュメントでは、`updatedBy` フィールドを使ってトリガーの連鎖発火を防止するパターンを解説します。

## 目的

Firestoreトリガーには以下の性質があります。

- `onDocumentCreated`: ドキュメント作成時に発火する
- `onDocumentUpdated`: ドキュメント更新時に発火する（トリガー内からの更新でも発火する）

たとえば、以下のようなケースで問題が発生します。

1. ユーザーがドキュメントを作成する
2. `onDocumentCreated` トリガーが発火し、OGP取得などの自動処理を行い、ドキュメントを更新する
3. ドキュメントが更新されたため `onDocumentUpdated` トリガーが発火する
4. `onDocumentUpdated` 内で再びドキュメントを更新する
5. 再び `onDocumentUpdated` が発火する → **無限ループ**

この連鎖的な発火を防止するために、「誰がこの更新を行ったか」をドキュメント自体に記録し、トリガー側でチェックするのが `updatedBy` パターンです。

## 設計

### updatedBy フィールドの定義

```
updatedBy: String ('trigger' | 'user')
```

| 値 | 意味 | セットする場所 |
|---|---|---|
| `'user'` | ユーザー操作による更新 | フロントエンド（クライアントSDK） |
| `'trigger'` | Cloud Functionsトリガーによる自動更新 | Cloud Functions |

### 制御フロー

```
ユーザーがドキュメントを作成（updatedBy: 'user'）
  │
  ▼
onDocumentCreated トリガー発火
  │  自動処理（OGP取得、embedding生成など）
  │  updatedBy: 'trigger' で更新
  │
  ▼
onDocumentUpdated トリガー発火
  │  updatedBy === 'trigger' → 即 return（処理スキップ）
  ✕  ループ発生しない
```

```
ユーザーがドキュメントを更新（updatedBy: 'user'）
  │
  ▼
onDocumentUpdated トリガー発火
  │  updatedBy === 'user' → 処理を実行
  │  自動処理実行後、updatedBy: 'trigger' で更新
  │
  ▼
onDocumentUpdated トリガー発火
  │  updatedBy === 'trigger' → 即 return（処理スキップ）
  ✕  ループ発生しない
```

### 設計のポイント

- **単純なフラグ管理**: boolean ではなく文字列リテラルを使うことで、将来的に操作主の種類を拡張可能（例: `'admin'`, `'migration'` など）
- **ドキュメント自体に状態を持たせる**: 外部の状態管理（メモリやRedisなど）に頼らないため、Cloud Functionsのステートレスな性質と相性がよい
- **フロントエンドとバックエンドの明確な責務分離**: クライアントは必ず `'user'` をセットし、トリガーは必ず `'trigger'` をセットするというルールを守るだけでよい

## 実装手順

### 1. 型定義

共通パッケージまたは型定義ファイルに `UpdatedBy` 型を定義します。

```typescript
/** ドキュメント更新の操作主 */
export type UpdatedBy = 'trigger' | 'user'
```

エンティティ型に `updatedBy` フィールドを追加します。

```typescript
export type Note = {
  // ... 既存のフィールド
  updatedBy: UpdatedBy
}
```

更新用のDTO型にもオプショナルで追加します。

```typescript
// フロントエンド用
export type UpdateNoteDto = {
  // ... 既存のフィールド
  updatedBy?: UpdatedBy
}

// Cloud Functions（Admin SDK）用
export type UpdateNoteDtoFromAdmin = {
  // ... 既存のフィールド
  updatedBy?: UpdatedBy
}
```

### 2. フロントエンド側の実装

ドキュメントの作成・更新を行うすべての箇所で `updatedBy: 'user'` をセットします。

```typescript
// 作成時
const createDto: CreateNoteDto = {
  content: values.content,
  // ... 他のフィールド
  updatedBy: 'user' as const,
}

// 更新時
const updateDto: UpdateNoteDto = {
  content: values.content,
  // ... 他のフィールド
  updatedBy: 'user' as const,
}
```

**重要**: `as const` を付けることで、型が `string` ではなく `'user'` リテラル型として推論されます。

### 3. Cloud Functions トリガーの実装

#### onDocumentCreated トリガー

`onDocumentCreated` トリガーでドキュメントを更新する際は、`updatedBy: 'trigger'` をセットします。

```typescript
export const onCreateNote = onDocumentCreated(
  'users/{uid}/notes/{noteId}',
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const data = snapshot.data() as Note

    // 自動処理（OGP取得など）
    const ogp = await fetchOgp(data.content)

    // 更新時に updatedBy: 'trigger' をセット
    const updateDto: UpdateNoteDtoFromAdmin = {
      ogp,
      updatedBy: 'trigger',
      updatedAt: FieldValue.serverTimestamp(),
    }
    await updateNoteOperation(uid, noteId, updateDto)
  },
)
```

#### onDocumentUpdated トリガー

`onDocumentUpdated` トリガーの**冒頭**で `updatedBy` をチェックし、`'trigger'` の場合は即座に `return` します。

```typescript
export const onUpdateNote = onDocumentUpdated(
  'users/{uid}/notes/{noteId}',
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const after = snapshot.after.data() as Note

    // ★ 再トリガー防止: トリガーによる更新なら処理をスキップ
    if (after.updatedBy === 'trigger') return

    // ここから先はユーザー操作による更新のみ実行される
    // 自動処理を実行...

    // 更新時に updatedBy: 'trigger' をセット
    const updateDto: UpdateNoteDtoFromAdmin = {
      // ... 処理結果
      updatedBy: 'trigger',
      updatedAt: FieldValue.serverTimestamp(),
    }
    await updateNoteOperation(uid, noteId, updateDto)
  },
)
```

**重要**: `updatedBy` のチェックは、トリガー関数の中でできるだけ早い段階（他の処理の前）に配置してください。不要な処理の実行を避け、Cloud Functionsの実行コストを抑えられます。

### 4. Firestoreセキュリティルールの更新

`updatedBy` フィールドを追加したら、**必ず `firestore.rules` のスキーマバリデーション関数も更新してください**。これを忘れると、フロントエンドからの作成・更新がセキュリティルールで拒否されます。

具体的には以下の2点を修正します。

1. **`requestData.size()` のフィールド数を +1 する**（フィールドが増えたため）
2. **`updatedBy` フィールドの存在チェックと型チェックを追加する**

```javascript
function isValidNoteSchema(requestData) {
  return requestData.size() == 10  // ← フィールド数を +1 する
    && 'updatedBy' in requestData && requestData.updatedBy is string
    // ... 他のフィールドの検証
}
```

> **補足**: Admin SDK（Cloud Functions）経由の書き込みはセキュリティルールをバイパスするため、トリガーからの更新は影響を受けません。クライアントからの書き込みのみが検証対象です。

## 注意事項

### トリガー内で複数回更新する場合

1つのトリガー実行内でドキュメントを複数回更新する場合（例: OGP取得後の更新とembedding生成後の更新）、**すべての更新で `updatedBy: 'trigger'` をセット**してください。いずれかの更新で設定を漏らすと、その更新が再びトリガーを発火させます。

```typescript
// 1回目の更新
await updateNoteOperation(uid, noteId, {
  ogp,
  updatedBy: 'trigger',
  updatedAt: FieldValue.serverTimestamp(),
})

// 2回目の更新（こちらにも忘れずに設定）
await updateNoteOperation(uid, noteId, {
  embedding: FieldValue.vector(embedding),
  updatedBy: 'trigger',
  updatedAt: FieldValue.serverTimestamp(),
})
```

### フロントエンドの更新漏れに注意

ドキュメントを更新するフロントエンドのすべての箇所で `updatedBy: 'user'` をセットする必要があります。新しいmutation hookを追加するときに設定を忘れると、`updatedBy` が前回の値（`'trigger'`）のまま残り、ユーザーの更新なのにトリガーが処理をスキップしてしまいます。

対策として、更新用DTOの型で `updatedBy` を必須にすることも検討してください。

### このパターンが適さないケース

- **トリガーがドキュメントを更新しない場合**: 外部APIの呼び出しのみなど、ドキュメント自体を変更しないトリガーでは不要です
- **onDocumentDeleted トリガー**: 削除されたドキュメントは再更新されないため、ループは発生しません

### Cloud Functionsのリトライとの関係

Cloud Functionsのリトライ設定が有効な場合、トリガーがエラーで失敗すると再実行されます。`updatedBy` による制御はリトライには影響しません。リトライ時はドキュメントの状態が変わっている可能性があるため、冪等な実装を心がけてください。
