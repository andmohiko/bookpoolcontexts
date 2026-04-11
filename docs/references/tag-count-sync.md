## はじめに

タグサジェスト機能を実現するためには、「どのタグが何件のメモに使われているか」の情報（`count`）を常に最新に保つ必要があります。本ドキュメントでは、メモ（`notes` サブコレクション）の作成・更新・削除に連動して、タグ（`users/{uid}/tags` サブコレクション）の `count` をインクリメント／デクリメントし、差分同期する実装手順を解説します。

## 目的

タグ情報をメモと一貫した状態に保ちます。以下の要件を満たす実装を行います。

- メモ作成時：各タグの `count` を +1 する（存在しなければ新規作成）
- メモ更新時：タグ配列の差分のみを検出し、追加分は +1、削除分は -1 する
- メモ削除時：各タグの `count` を -1 する（`count=0` になれば物理削除）
- 冪等性を担保し、トリガーの再実行でも二重カウントしないようにする
- クライアントから直接 `tags` を書き換えず、必ずサーバー側で集約する
- 他の処理（embedding 再生成など）の再トリガーを引き起こさない

## 設計

### アーキテクチャ

Cloud Functions for Firebase の Firestore トリガーで、`notes` ドキュメントの変更を検知し、サブコレクション `users/{uid}/tags` を同期します。

```
[client]
Firestore へ notes を作成 / 更新 / 削除
    ↓
[Cloud Functions]
onCreateNote  → 追加タグを +1
onUpdateNote  → 差分だけ +1 / -1
onDeleteNote  → 全タグを -1（0 になれば delete）
    ↓
[Operations Layer]
fetchTagByLabelOperation / createTagOperation /
updateTagOperation / deleteTagOperation
    ↓
Firestore: users/{uid}/tags/{tagId}
```

### 構成要素

| 要素 | 役割 | ファイルパス |
|------|------|------------|
| `Tag` エンティティ | タグの型定義・Admin 用 DTO | `packages/common/src/entities/Tag.ts` |
| `fetchTagByLabelOperation` | label からタグを検索 | `apps/functions/src/infrastructure/firestore/tags.ts` |
| `createTagOperation` | タグの新規作成 | 同上 |
| `updateTagOperation` | タグの更新（count 増減） | 同上 |
| `deleteTagOperation` | タグの物理削除 | 同上 |
| `onCreateNote` | メモ作成時の同期トリガー | `apps/functions/src/triggers/onCreateNote.ts` |
| `onUpdateNote` | メモ更新時の差分同期トリガー | `apps/functions/src/triggers/onUpdateNote.ts` |
| `onDeleteNote` | メモ削除時の同期トリガー | `apps/functions/src/triggers/onDeleteNote.ts` |
| `triggerOnce` | 冪等性を担保するラッパー | `apps/functions/src/utils/triggerOnce.ts` |

### データモデル

```
users/{uid}/notes/{noteId}
  ├─ title: string | null
  ├─ content: string
  ├─ tags: Array<string>   ← ここが同期元
  └─ ...

users/{uid}/tags/{tagId}
  ├─ label: string         ← タグ名（一意）
  ├─ count: number         ← このタグが付いているメモ数
  ├─ createdAt: Date
  └─ updatedAt: Date       ← 「最近使ったタグ」のソートキー
```

### 処理フロー

```
[作成]
notes ドキュメント作成
  │
  ▼
onDocumentCreated が発火
  │
  ▼
triggerOnce で重複実行をチェック
  │
  ▼
for each label in note.tags:
  fetchTagByLabelOperation(uid, label)
    ├─ 既存あり → updateTagOperation(count: increment(+1))
    └─ 既存なし → createTagOperation({ label, count: 1 })

[更新]
notes ドキュメント更新
  │
  ▼
onDocumentUpdated が発火
  │
  ▼
after.updatedBy === 'trigger' なら早期 return（再トリガー防止）
  │
  ▼
before.tags と after.tags をソートして比較 → 変更なしなら同期スキップ
  │
  ▼
addedTags = after にあって before にないもの
removedTags = before にあって after にないもの
  │
  ▼
addedTags に対して +1（なければ新規作成）
removedTags に対して -1（count<=1 なら delete）

[削除]
notes ドキュメント削除
  │
  ▼
onDocumentDeleted が発火
  │
  ▼
for each label in deletedNote.tags:
  count<=1 なら delete、それ以外は -1
```

## 実装手順

### 1. Admin 用 DTO 型の定義

`FieldValue` は `firebase`（クライアント）と `firebase-admin`（サーバー）で型が異なるため、Admin SDK を使う Functions 側では専用の DTO を用意します。`count` を `FieldValue.increment()` で渡せるよう、`count` の型は `number | AdminFieldValue` のユニオンにしておきます。

```typescript
// packages/common/src/entities/Tag.ts
import type { FieldValue as AdminFieldValue } from 'firebase-admin/firestore'

/** firebase-admin を使用した作成用DTO */
export type CreateTagDtoFromAdmin = Omit<
  Tag,
  'tagId' | 'createdAt' | 'updatedAt'
> & {
  createdAt: AdminFieldValue
  updatedAt: AdminFieldValue
}

/** firebase-admin を使用した更新用DTO */
export type UpdateTagDtoFromAdmin = {
  count?: number | AdminFieldValue
  updatedAt: AdminFieldValue
}
```

**設計ポイント:**

- **`count` をユニオンに**: `FieldValue.increment(1)` を受け入れつつ、初期値（数値）での更新も可能にする
- **DTO を分離**: クライアント用（`UpdateTagDto`）とサーバー用（`UpdateTagDtoFromAdmin`）を別定義にしておくことで、型混在による事故を防ぐ

### 2. Operations 層

Functions 側でも 4 層構造を守り、Firestore への直接アクセスは Operations 層に閉じ込めます。特定のフィールド更新用の関数は作らず、「タグを更新する」という抽象的な責務だけを担わせます。

```typescript
// apps/functions/src/infrastructure/firestore/tags.ts
import type {
  CreateTagDtoFromAdmin,
  Tag,
  TagId,
  Uid,
  UpdateTagDtoFromAdmin,
} from '@vectornote/common'
import { tagCollection, userCollection } from '@vectornote/common'

import { db } from '~/lib/firebase'
import { convertDate } from '~/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const tagsRef = (uid: Uid) =>
  db.collection(userCollection).doc(uid).collection(tagCollection)

const tagDocRef = (uid: Uid, tagId: TagId) => tagsRef(uid).doc(tagId)

/** ラベル名でタグを取得する */
export const fetchTagByLabelOperation = async (
  uid: Uid,
  label: string,
): Promise<Tag | null> => {
  const snapshot = await tagsRef(uid)
    .where('label', '==', label)
    .limit(1)
    .get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  const data = doc.data()
  return { tagId: doc.id, ...convertDate(data, dateColumns) } as Tag
}

/** タグを作成する（自動生成ID） */
export const createTagOperation = async (
  uid: Uid,
  dto: CreateTagDtoFromAdmin,
): Promise<void> => {
  await tagsRef(uid).add(dto)
}

/** タグを更新する */
export const updateTagOperation = async (
  uid: Uid,
  tagId: TagId,
  dto: UpdateTagDtoFromAdmin,
): Promise<void> => {
  await tagDocRef(uid, tagId).update(dto)
}

/** タグを削除する */
export const deleteTagOperation = async (
  uid: Uid,
  tagId: TagId,
): Promise<void> => {
  await tagDocRef(uid, tagId).delete()
}
```

**設計ポイント:**

- **`fetchTagByLabelOperation` で重複防止**: `label` はユニーク制約を持たないので、作成前に必ず存在確認をする。`limit(1)` を付けて無駄な読み取りを避ける
- **自動生成ID**: `tagId` はユーザーには見えないため `add()` で自動生成にしている。ラベルを ID にすると特殊文字のエスケープや正規化の問題が出るため、本実装では分離している
- **特化した関数を作らない**: `incrementTagCountOperation` のような関数を作ると Operations 層の責務がぼやけるため、呼び出し側で DTO を組み立てる

### 3. 作成トリガー（onCreateNote）

新規作成時は、すべてのタグについて「存在すれば +1、なければ新規作成」を行います。

```typescript
// apps/functions/src/triggers/onCreateNote.ts（タグ同期部分を抜粋）
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'

import {
  createTagOperation,
  fetchTagByLabelOperation,
  updateTagOperation,
} from '~/infrastructure/firestore/tags'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onCreateNote = onDocumentCreated(
  'users/{uid}/notes/{noteId}',
  triggerOnce('onCreateNote', async (event) => {
    if (!event.data) return

    const { uid } = event.params
    const { tags } = event.data.data()

    // ...他の処理（OGP 取得、embedding 生成など）...

    // タグ同期：各タグのカウントをインクリメント（存在しなければ新規作成）
    const tagList: string[] = tags ?? []
    for (const label of tagList) {
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
        console.error('Tag sync failed for label:', label, error)
      }
    }
  }),
)
```

**設計ポイント:**

- **`FieldValue.increment(1)` を使う**: 読み取り→加算→書き込みのレースコンディションを避け、複数のトリガーが同時実行されても `count` がずれない
- **`try / catch` で部分失敗を許容**: 1 つのタグ同期失敗が他のタグ同期を巻き込まないよう、ラベル単位で例外を握る。ログに出しておけば後追い調査できる
- **`tags ?? []`**: フィールドが欠損しているノート（マイグレーション前データ等）でも落ちないようにガード
- **`updatedAt` を必ず更新**: 「最近使ったタグ」のソートキーなので、`count` 更新時にも必ず一緒に更新する

### 4. 更新トリガー（onUpdateNote）

更新時は、`before.tags` と `after.tags` の差分だけを同期します。全件同期すると「変更されていないタグ」の `count` が誤って増減するので注意が必要です。

```typescript
// apps/functions/src/triggers/onUpdateNote.ts（タグ同期部分を抜粋）
export const onUpdateNote = onDocumentUpdated(
  'users/{uid}/notes/{noteId}',
  triggerOnce('onUpdateNote', async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return

    // トリガーによる更新なら再処理をスキップ（再トリガー防止）
    if (after.updatedBy === 'trigger') return

    const { uid } = event.params

    // タグ同期：before/after の差分のみ同期
    const beforeTags: string[] = before.tags ?? []
    const afterTags: string[] = after.tags ?? []
    const tagsChanged =
      JSON.stringify([...beforeTags].sort()) !==
      JSON.stringify([...afterTags].sort())

    if (!tagsChanged) return

    const addedTags = afterTags.filter((t) => !beforeTags.includes(t))
    const removedTags = beforeTags.filter((t) => !afterTags.includes(t))

    // 追加されたタグをインクリメント（なければ新規作成）
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
        console.error('Tag increment failed for label:', label, error)
      }
    }

    // 削除されたタグをデクリメント（count=0 になれば削除）
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
        console.error('Tag decrement failed for label:', label, error)
      }
    }
  }),
)
```

**設計ポイント:**

- **`updatedBy === 'trigger'` ガードで再トリガー防止**: embedding 再生成や OGP 追加などもこのトリガー内で `updateNoteOperation` を呼ぶため、そのまま処理すると `onUpdateNote` が再帰的に発火する。`updatedBy` フィールドで自分自身の更新を識別し、早期リターンする。詳しくは `docs/references/firestore-trigger-loop-prevention.md` を参照
- **`JSON.stringify([...sort()])` で順序非依存の比較**: 配列の順序が違うだけで「変更あり」と判定しないよう、sort してから文字列化する。タグが少数なら十分高速
- **差分だけを同期**: `afterTags.filter(t => !beforeTags.includes(t))` で `addedTags`、逆で `removedTags` を抽出する。これにより「変更されなかったタグ」には触らない
- **`count<=1` で物理削除**: `count=0` のタグを残しておくと「最近使ったタグ」にゴミが残るため、0 になる時点で削除する。`count<1` のガードは異常系対策
- **`!existing` なら continue**: 何らかの理由で対応するタグが存在しなくても落ちないようにする

### 5. 削除トリガー（onDeleteNote）

削除時は、そのノートに付いていた全タグをデクリメントします。`event.data` には削除前のドキュメントが入っているため、そこから `tags` を取り出します。

```typescript
// apps/functions/src/triggers/onDeleteNote.ts
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import {
  deleteTagOperation,
  fetchTagByLabelOperation,
  updateTagOperation,
} from '~/infrastructure/firestore/tags'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteNote = onDocumentDeleted(
  'users/{uid}/notes/{noteId}',
  triggerOnce('onDeleteNote', async (event) => {
    if (!event.data) return

    const { uid } = event.params
    const tags: string[] = event.data.data().tags ?? []

    // タグ同期：各タグのカウントをデクリメント（count=0 になれば削除）
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
        console.error('Tag sync failed on delete for label:', label, error)
      }
    }
  }),
)
```

**設計ポイント:**

- **`event.data` が削除前スナップショット**: `onDocumentDeleted` では削除直前のデータが渡されるため、ここから `tags` を取り出せる
- **更新トリガーとデクリメントロジックを共通化しない**: 似た処理だが、引数や文脈が異なるため無理に関数化せずインライン展開したほうが読みやすい。必要になってから切り出す

### 6. 冪等性の担保（triggerOnce）

Firestore トリガーは at-least-once 配送のため、同一イベントで 2 回ハンドラが呼ばれる可能性があります。`FieldValue.increment` は原子的ですが、ハンドラ自体が 2 回走ると二重カウントになります。そのため、`triggerOnce` で `eventId` を `triggerEvents` コレクションに記録し、既に処理済みなら何もしません。

```typescript
// apps/functions/src/utils/triggerOnce.ts
import * as admin from 'firebase-admin'
import type { FirestoreEvent } from 'firebase-functions/v2/firestore'
import { db, serverTimestamp } from '~/lib/firebase'

const hasAlreadyTriggered = (
  eventId: string,
  suffix: string,
): Promise<boolean> => {
  const id = [eventId, suffix].join('-')
  return db.runTransaction(async (t) => {
    const ref = admin.firestore().collection('triggerEvents').doc(id)
    const doc = await t.get(ref)
    if (doc.exists) return true
    t.set(ref, { createTime: serverTimestamp })
    return false
  })
}

export const triggerOnce =
  <T, P extends Record<string, string>>(
    suffix: string,
    handler: (event: FirestoreEvent<T, P>) => PromiseLike<any> | any,
  ) =>
  async (event: FirestoreEvent<T, P>) => {
    if (await hasAlreadyTriggered(event.id, suffix)) return undefined
    return handler(event)
  }
```

**設計ポイント:**

- **トランザクションでの `exists` チェック**: 同時に 2 つのインスタンスが処理しても、片方だけが書き込みに成功するようトランザクションで atomicity を担保する
- **`suffix` で関数ごとにキーを分離**: 同一イベントから複数のトリガーが派生するケース（例: `onCreateNote` と `onWriteNote`）で互いに干渉しないようにする
- **`triggerEvents` コレクションの肥大化対策**: 長期運用では TTL 付きフィールドで自動削除するか、Scheduled Functions で古いドキュメントを定期削除する運用にする

## 同期モデルの妥当性

### なぜクライアントから書き込まないのか

- **冪等性**: クライアント書き込みだとネットワークリトライで二重カウントが発生しやすい。サーバー側 + `triggerOnce` なら制御可能
- **セキュリティ**: `count` を改竄されると「よく使うタグ」が信用できない情報になる。Security Rules で `allow write: if false;` にできる
- **原子性**: メモと `tags` の書き込みを分離するとデータの不整合が起きやすい。サーバー側で一元化すれば、メモ更新に対して「必ず後続で同期される」という保証ができる

### なぜバッチ／トランザクションで一括更新しないのか

技術的には `WriteBatch` や `runTransaction` で一括更新することも可能ですが、以下の理由でループ + 個別更新を採用しています。

- **読み込み + 書き込みの依存**: `fetchTagByLabelOperation` の結果で分岐する（作成 or 更新）ため、単純なバッチにしにくい
- **部分失敗の許容**: あるタグの同期が失敗しても他は進めたい。バッチだと失敗した瞬間に全ロールバックされる
- **タグ数が少ない**: メモあたり最大 10 個なので、直列処理でも十分高速

ただし、タグ数の上限を大きくする／同期頻度が上がる場合は、バッチ化や `Promise.all` での並列化を検討する価値があります。

## Security Rules

クライアントから `tags` サブコレクションに書き込ませないよう、以下のルールを設定します。

```javascript
match /users/{userId}/tags/{tagId} {
  allow read: if isSignedIn() && isUser(userId);
  allow write: if false; // 書き込みは Cloud Functions のみ
}
```

`notes` 側は、`updatedBy` フィールドを含めたスキーマ検証を行い、クライアントから `updatedBy: 'trigger'` を詐称できないようにします。

```javascript
function isValidNoteSchema(requestData) {
  return requestData.size() == /* n */
    && 'tags' in requestData && requestData.tags is list
    && 'updatedBy' in requestData && requestData.updatedBy in ['user']
    // ...その他フィールド...
}
```

## 注意事項

### タグ配列の重複要素

同一ノートに同じタグが複数含まれていると、作成時に +2 され、削除時に -2 される...とはならず、トリガー側で同じ label に対して `fetchTagByLabelOperation` が 2 回呼ばれ、2 回 +1 されます。クライアント側の `addTag` で重複チェックをしているため通常は発生しませんが、マイグレーションや手動書き込みで混入する可能性があります。気になる場合はトリガー側でも `Array.from(new Set(tags))` で重複除去してから処理するのが安全です。

### ラベル正規化の一貫性

`fetchTagByLabelOperation` は `where('label', '==', label)` で厳密一致検索をするため、大文字小文字や前後空白の差で別タグ扱いになります。クライアント側の `addTag` では `trim()` しかしていないので、クライアント・サーバー両方で同じ正規化ルール（例: `trim().normalize('NFC')`）を通すのが安全です。正規化ルールを変更する場合は、既存タグのマイグレーションが必要になることに注意してください。

### カウントの整合性を定期的に検証する

長期運用すると、何らかのバグ・中断・データ移行によって `count` が実際のノート数とずれる可能性があります。定期的に「全ノートの `tags` を集計して `count` を再計算する」バッチ処理を用意しておくと、ずれが発生しても自動補正できます。

### 差分比較のコスト

`JSON.stringify([...sort()])` による比較は、タグが 10 個程度なら問題になりません。ただし、今後フィールド全体を比較するように拡張するときは、`fast-deep-equal` のようなライブラリへの置き換えを検討してください。

### embedding 再生成との相乗効果

`onUpdateNote` 内ではタグ同期と embedding 再生成を両方行っています。タグのみを変更してもメモ本体は変わらないため、同期完了後にさらに `updateNoteOperation` で `embedding` を書き戻しますが、これは `updatedBy: 'trigger'` で再帰を止めているため安全です。この辺りのループ防止の詳細は `docs/references/firestore-trigger-loop-prevention.md` を参照してください。
