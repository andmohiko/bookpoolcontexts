## はじめに

メモ作成フォームでタグを入力する際、ユーザーが過去に使用したタグを候補として表示し、クリック／キーボードで選択できると、タグの揺れ（「React」「react」「ReactJS」など）を防ぎ、入力の手間を削減できます。本ドキュメントでは、Firestore に保存済みの `tags` コレクションから候補を取得し、入力に応じて絞り込み表示する「タグサジェスト機能」の実装手順を解説します。

## 目的

タグ入力の揺れを防ぎつつ、入力効率を高めます。以下の要件を満たす実装を行います。

- タグ入力フィールドにフォーカスするとサジェストが表示される
- 未入力時は「最近使ったタグ」を表示する
- 入力開始後は入力文字列に前方一致するタグを候補として表示する
- 既に選択済みのタグは候補から除外する
- 候補をクリックすると、そのタグが選択済みタグに追加される
- 候補のない場合はサジェストUI自体を表示しない

## 設計

### アーキテクチャ

Firestore 実装ルールに従い、4層構造で実装します。

```
UI Layer           : NoteForm / TagSuggestionDropdown
    ↓
Hooks Layer        : useRecentTags / useTags
    ↓
Operations Layer   : subscribeTagsOperation / subscribeRecentTagsOperation
    ↓
Entity Types Layer : Tag (packages/common/src/entities/Tag.ts)
    ↓
Firestore          : users/{uid}/tags サブコレクション
```

### 構成要素

| 要素 | 役割 | ファイルパス |
|------|------|------------|
| `Tag` エンティティ | タグの型定義・コレクション名定数 | `packages/common/src/entities/Tag.ts` |
| `subscribeTagsOperation` | 全タグのリアルタイム購読 | `apps/web/src/infrastructure/firestore/tags.ts` |
| `subscribeRecentTagsOperation` | 最近使ったタグの購読（updatedAt降順） | `apps/web/src/infrastructure/firestore/tags.ts` |
| `useTags` | 全タグ取得フック（count 降順） | `apps/web/src/features/tags/hooks/useTags.ts` |
| `useRecentTags` | 最近使ったタグ取得フック | `apps/web/src/features/tags/hooks/useRecentTags.ts` |
| `TagSuggestionDropdown` | サジェスト表示コンポーネント | `apps/web/src/features/tags/components/TagSuggestionDropdown.tsx` |
| `NoteForm` | タグ入力欄とサジェストを組み合わせるフォーム | `apps/web/src/features/notes/components/NoteForm.tsx` |
| タグ集計トリガー | メモ作成・更新・削除時にタグドキュメントを upsert | `apps/functions/src/triggers/onCreateNote.ts` ほか |

### データモデル

タグは `users/{uid}/tags/{tagId}` のサブコレクションに保存します。ユーザーごとに独立し、以下のフィールドを持ちます。

| フィールド | 型 | 説明 |
|----------|---|------|
| `tagId` | string | ドキュメントID（ラベルを正規化したもの、または自動ID） |
| `label` | string | 表示用ラベル |
| `count` | number | このタグが付いているメモ数 |
| `createdAt` | Date | 初回作成日時 |
| `updatedAt` | Date | 最終更新日時（最近使ったタグの並び順に利用） |

### 処理フロー

```
[メモ作成]
ユーザーがタグを入力して保存
  │
  ▼
Firestore の notes ドキュメントが作成される
  │
  ▼
Cloud Functions の onCreateNote が発火
  │
  ▼
users/{uid}/tags に対して各ラベルを upsert
  （存在しなければ count=1 で作成、あれば count をインクリメント）

[サジェスト表示]
NoteForm のタグ入力欄にフォーカス
  │
  ▼
useRecentTags / useTags がリアルタイム購読を開始
  │
  ▼
TagSuggestionDropdown が以下をメモ化して表示
  │  tagInput が空     → 最近使ったタグから activeTags を除外
  │  tagInput が非空   → 全タグから前方一致 + activeTags を除外
  │
  ▼
候補の Badge をクリック
  │  onMouseDown で e.preventDefault()（blur による入力クリアを防止）
  │
  ▼
onSelect(label) → NoteForm.addTagByLabel()
  │  重複チェック・上限チェックを経て setValue('tags', ...)
  │
  ▼
tagInput をクリアして次の入力へ
```

## 実装手順

### 1. Entity 型と Operations 層

`Tag` 型と、ユーザーごとのタグコレクションへの購読関数を用意します。

```typescript
// packages/common/src/entities/Tag.ts
import type { FieldValue } from 'firebase/firestore'

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
```

Operations 層ではリアルタイム購読のみ提供します（候補表示はリアルタイム性が求められるため）。

```typescript
// apps/web/src/infrastructure/firestore/tags.ts
import type { Tag, Uid } from '@vectornote/common'
import { tagCollection, userCollection } from '@vectornote/common'
import type { Unsubscribe } from 'firebase/firestore'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { convertDate } from '@/utils/convertDate'

const dateColumns = ['createdAt', 'updatedAt'] as const satisfies Array<string>

const tagsRef = (uid: Uid) =>
  collection(db, userCollection, uid, tagCollection)

/** タグ一覧をリアルタイム購読する（label 昇順） */
export const subscribeTagsOperation = (
  uid: Uid,
  setter: (tags: Array<Tag>) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(tagsRef(uid), orderBy('label', 'asc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const tags = snapshot.docs.map(
        (d) => ({ tagId: d.id, ...convertDate(d.data(), dateColumns) }) as Tag,
      )
      setter(tags)
    },
    onError,
  )
}

/** 最近更新されたタグをリアルタイム購読する（updatedAt 降順、上位 maxCount 件） */
export const subscribeRecentTagsOperation = (
  uid: Uid,
  maxCount: number,
  setter: (tags: Array<Tag>) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const q = query(tagsRef(uid), orderBy('updatedAt', 'desc'), limit(maxCount))
  return onSnapshot(
    q,
    (snapshot) => {
      const tags = snapshot.docs.map(
        (d) => ({ tagId: d.id, ...convertDate(d.data(), dateColumns) }) as Tag,
      )
      setter(tags)
    },
    onError,
  )
}
```

**設計ポイント:**

- **サブコレクション構成**: `users/{uid}/tags` に配置することで、Firestore Security Rules による所有権チェックが簡単になり、ユーザー間でのタグ混在を防げる
- **Operations 層では汎用的な操作に限定**: 特定のフィールド／値に特化した関数（例: `fetchTopTagsByCount`）は作らず、必要な並び順はフック層でメモリ上で行う
- **`convertDate` の使用**: Firestore の `Timestamp` を `Date` に変換するユーティリティを必ず通す

### 2. カスタムフック層

Operations 層を React から使いやすく包みます。`useRecentTags` は `updatedAt` 降順の上位 N 件、`useTags` は全件（コンポーネント側で count 降順にソート）を返します。

```typescript
// apps/web/src/features/tags/hooks/useRecentTags.ts
import type { Tag } from '@vectornote/common'
import { useEffect, useState } from 'react'

import { subscribeRecentTagsOperation } from '@/infrastructure/firestore/tags'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

const RECENT_TAGS_COUNT = 10

export type UseRecentTagsReturn = {
  tags: Array<Tag>
  isLoading: boolean
  error: string | null
}

export const useRecentTags = (): UseRecentTagsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [tags, setTags] = useState<Array<Tag>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeRecentTagsOperation(
      uid,
      RECENT_TAGS_COUNT,
      (updatedTags) => {
        setTags(updatedTags)
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { tags, isLoading, error }
}
```

```typescript
// apps/web/src/features/tags/hooks/useTags.ts
export const useTags = (): UseTagsReturn => {
  const { uid } = useFirebaseAuthContext()
  const [tags, setTags] = useState<Array<Tag>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    setIsLoading(true)
    const unsubscribe = subscribeTagsOperation(
      uid,
      (updatedTags) => {
        // count 降順で並び替え（よく使うタグを先頭に）
        setTags([...updatedTags].sort((a, b) => b.count - a.count))
        setIsLoading(false)
      },
      (err) => {
        setError(errorMessage(err))
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [uid])

  return { tags, isLoading, error }
}
```

**設計ポイント:**

- **認証チェック**: `useFirebaseAuthContext()` から `uid` を取得し、未ログイン時は購読を開始しない
- **クリーンアップ必須**: `useEffect` の戻り値で `unsubscribe()` を呼び、メモリリークと不要な読み取りコストを防ぐ
- **エラーハンドリング**: `onSnapshot` の `onError` コールバックで捕捉し、`errorMessage()` でユーザー向け文字列に変換する
- **ソートはクライアント側で**: Firestore のクエリ側で `count` 降順にするとインデックスが増えるため、件数が多くなければクライアント側ソートで十分

### 3. サジェスト表示コンポーネント

入力文字列と選択済みタグを受け取り、候補を表示します。候補の選択イベントは親に委譲します。

```typescript
// apps/web/src/features/tags/components/TagSuggestionDropdown.tsx
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { useRecentTags } from '@/features/tags/hooks/useRecentTags'
import { useTags } from '@/features/tags/hooks/useTags'

type TagSuggestionDropdownProps = {
  tagInput: string
  activeTags: Array<string>
  onSelect: (label: string) => void
}

export const TagSuggestionDropdown = ({
  tagInput,
  activeTags,
  onSelect,
}: TagSuggestionDropdownProps) => {
  const { tags: recentTags } = useRecentTags()
  const { tags: allTags } = useTags()

  const suggestions = useMemo(() => {
    if (tagInput === '') {
      return recentTags.filter((tag) => !activeTags.includes(tag.label))
    }

    const lowerInput = tagInput.toLowerCase()
    return allTags
      .filter((tag) => !activeTags.includes(tag.label))
      .filter((tag) => tag.label.toLowerCase().startsWith(lowerInput))
  }, [recentTags, allTags, tagInput, activeTags])

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {tagInput === '' ? '最近使ったタグ' : '候補'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((tag) => (
          <Badge
            key={tag.tagId}
            variant="outline"
            className="cursor-pointer hover:bg-secondary"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(tag.label)
            }}
          >
            {tag.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}
```

**設計ポイント:**

- **`onMouseDown` + `e.preventDefault()` でクリック選択**: `onClick` を使うと、クリックより先に入力欄の `onBlur` が発火してしまい、`NoteForm` 側の `onBlur` で `tagInput` がクリアされたり `TagSuggestionDropdown` 自体がアンマウントされてクリックが無効化される。`onMouseDown` で `preventDefault()` することでフォーカス移動自体を抑止し、確実に選択を処理できる
- **`useMemo` で絞り込みをメモ化**: `recentTags` / `allTags` / `tagInput` / `activeTags` のいずれかが変わったときだけ再計算する
- **候補なしなら何も描画しない**: `if (suggestions.length === 0) return null` で空の枠が残らないようにする
- **`activeTags` は親で管理**: 既に選択済みのタグを親から受け取って除外することで、サジェスト表示と選択状態を一元管理できる
- **大文字小文字を無視した前方一致**: `toLowerCase()` で正規化してから比較する

### 4. フォームへの組み込み

`NoteForm` 側では、タグ入力欄にフォーカスされている間だけサジェストを表示します。

```typescript
// apps/web/src/features/notes/components/NoteForm.tsx（抜粋）
const tags = watch('tags') ?? []

const [tagInput, setTagInput] = useState('')
const [isTagInputFocused, setIsTagInputFocused] = useState(false)

const addTag = () => {
  const trimmed = tagInput.trim()
  if (!trimmed) return
  if (tags.length >= 10) return
  setValue('tags', [...tags, trimmed], { shouldValidate: true })
  setTagInput('')
}

const addTagByLabel = (label: string) => {
  if (!label.trim()) return
  if (tags.length >= 10) return
  if (tags.includes(label)) return
  setValue('tags', [...tags, label], { shouldValidate: true })
  setTagInput('')
}

const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.nativeEvent.isComposing) return // IME変換中のEnterは無視
  if (e.key === 'Enter') {
    e.preventDefault()
    addTag()
  } else if (e.key === ',') {
    e.preventDefault()
    addTag()
  }
}

return (
  <div className="space-y-2">
    <Label htmlFor="tags">タグ</Label>
    <Input
      id="tags"
      placeholder="タグを入力してEnterで追加（最大10個）"
      value={tagInput}
      onChange={(e) => setTagInput(e.target.value)}
      onKeyDown={handleTagKeyDown}
      onFocus={() => setIsTagInputFocused(true)}
      onBlur={() => {
        setIsTagInputFocused(false)
        addTag() // 入力途中で blur したら確定
      }}
      disabled={tags.length >= 10}
    />
    {isTagInputFocused && (
      <TagSuggestionDropdown
        tagInput={tagInput}
        activeTags={tags}
        onSelect={addTagByLabel}
      />
    )}
    {/* 選択済みタグの Badge リスト */}
  </div>
)
```

**設計ポイント:**

- **`addTag` と `addTagByLabel` を分離**: 手入力（トリムのみ）と候補選択（重複チェック込み）で責務を分ける。候補選択時は既に正規化されたラベルなのでトリム処理は不要
- **IME 対応**: `e.nativeEvent.isComposing` で変換中の Enter を無視しないと、日本語入力中に意図せずタグが確定される
- **`onBlur` で未確定入力を救済**: `addTag()` を呼び、入力途中のまま別箇所をクリックしても入力が失われないようにする（`TagSuggestionDropdown` の `onMouseDown` + `preventDefault` と併用する前提）
- **フォーカス中のみサジェストを描画**: `isTagInputFocused` でガードすることで、フォームの他の領域に影響しない
- **上限チェック**: `tags.length >= 10` で Input 自体を `disabled` にし、フォームスキーマ（Zod）の上限と二重にガードする

### 5. タグの書き込み（Functions トリガー）

サジェストの元となる `users/{uid}/tags` ドキュメントは、メモ作成・更新・削除のトリガーで自動的に upsert します。フロントエンドから直接書き込むと冪等性の担保が難しいため、サーバー側で集約するのが推奨構成です。

```
apps/functions/src/triggers/onCreateNote.ts  … 新規タグを作成 / count++
apps/functions/src/triggers/onUpdateNote.ts  … 差分を計算して増減
apps/functions/src/triggers/onDeleteNote.ts  … count-- / 0 になったら削除
```

**設計ポイント:**

- **`triggerOnce` で冪等化**: Firestore トリガーは at-least-once 配送なので、冪等性キーで二重実行を防ぐ
- **`onDocumentCreated` / `onDocumentUpdated` / `onDocumentDeleted` を使い分け**: 汎用の `onWrite` は差分計算が複雑になるため避ける
- **Operations 層を必ず挟む**: トリガー関数から直接 Firestore を叩かず、`apps/functions/src/infrastructure/firestore/tags.ts` 経由で書き込む

## Security Rules

`users/{uid}/tags` への読み取りは本人のみ許可し、書き込みは Cloud Functions（admin SDK）に限定します。クライアントからの書き込みは不要なので `allow write: if false;` にしておくと安全です。

```javascript
match /users/{userId}/tags/{tagId} {
  allow read: if isSignedIn() && isUser(userId);
  allow write: if false; // 書き込みは Cloud Functions のみ
}
```

## 拡張のヒント

### キーボード操作対応

現在の実装はクリック（MouseDown）のみ対応しています。`↑` `↓` で候補を移動し `Enter` で確定する操作を追加する場合は、`TagSuggestionDropdown` 側で `activeIndex` state を管理し、`NoteForm` の `onKeyDown` からキーイベントを委譲する構成が必要です。ただし、Enter キーは手入力確定にも使われているため、「候補がハイライトされているときだけ候補を確定、それ以外は手入力を確定」という分岐が必要になります。

### 部分一致・ファジーマッチ

前方一致で不足する場合は、`String.prototype.includes` で部分一致にする、もしくは `fuse.js` などのファジー検索ライブラリを導入します。タグ数が多くなった場合でも、`useTags` が全件フェッチしているためクライアント側で十分高速に動きます。

### 候補の上限

全タグをクライアントで保持しているので、候補が多すぎる場合は `suggestions.slice(0, 20)` のように上限を設けると UI が見やすくなります。

## 注意事項

### リアルタイム購読のコスト

`useTags` は全タグを購読するため、ユーザーが大量のタグを持つと読み取りコストが増えます。以下で緩和できます。

- タグ入力にフォーカスしたときだけ購読を開始する（`isTagInputFocused` をフックに渡して条件付き購読にする）
- 初回だけ取得してキャッシュする（`onSnapshot` ではなく `getDocs` を使う）

### タグラベルの正規化

`addTag` では `trim()` のみで正規化しているため、「React」と「react」は別タグとして扱われます。サーバー側でラベルを小文字化してから `tagId` にする、あるいはクライアント側でも正規化を揃えるかは要件次第で決めてください。正規化を変更する場合、既存データのマイグレーションが必要になることがあります。

### サジェストのちらつき

`onBlur` で `setIsTagInputFocused(false)` を呼ぶと、候補クリック前にサジェストがアンマウントされてクリックが無視されることがあります。これを防ぐには `onMouseDown` + `e.preventDefault()` を使うのが最も簡単で確実です（本実装で採用）。`setTimeout` で blur 処理を遅延させる方法もありますが、挙動が非決定的になりがちなので避けたほうが無難です。
