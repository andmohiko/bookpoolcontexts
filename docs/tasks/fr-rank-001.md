# FR-RANK-001〜003: 読みたい本ランキング機能 仕様・実装計画

## Context

未読の本同士を「どちらがより読みたいか」の 2 択で比較していき、読みたい順に並べた「読みたい本ランキング」を作る機能を追加する。比較の組み合わせはマージソートのアルゴリズムが要求する順に提示し、必要最小限の回答でソートを完了させる。ソートは途中で中断・再開でき、ランキング完成後に登録された本は「ランキング未追加」として分けておき、「ランキングを更新」で既存ランキングに組み込む。

設計方針:
- ランキングはユーザーごとに 1 つ。グループ・タグ単位のランキングは持たない
- 対象は未読（`isRead === false`）の本のみ
- ソートの途中状態は Firestore に保存し、別端末・別セッションからでも再開できる
- Cloud Functions の変更は不要。本の削除・読了はクライアント側で「存在しない ID を無視する」ことで吸収する
- ソート処理は純粋関数として実装し、Vitest でテストする

---

## 1. 機能仕様

### FR-RANK-001: ランキングの作成（2 択ソート）

| 項目 | 内容 |
|------|------|
| 概要 | 未読の本を 2 択比較で並び替え、読みたい順のランキングを作る |
| 優先度 | 必須 |

**詳細要件:**
- ランキング画面（`/ranking`）で「ランキングを作成」を押すと、その時点の未読本（除外済みを除く）を対象にソートを開始する
- 未読本が 2 冊未満のときは作成ボタンを無効化する
- 画面には本を 2 冊（表紙・タイトル・著者）並べて表示し、より読みたい方をタップで選ぶ。キーボードの `←` / `→` でも選べる
- 各本には「ランキングに含めない」ボタンを置き、押すとその本を除外して次の 2 択に進む（FR-RANK-003）
- 「1 つ戻る」で直前の回答を取り消せる
- 進捗を「回答数 / 最大比較回数」で表示する
- すべての比較が終わるとランキングが確定し、ランキング表示に切り替わる
- ソート中に画面を離れても状態は保持され、次に `/ranking` を開くと続きから再開する
- 「ソートを破棄」で進行中のソートを捨てられる（確認ダイアログあり）
- すでにランキングがある状態で「作り直す」を選んだ場合、新しいソートが完了するまで旧ランキングは保持する。中断中は旧ランキングを表示し、上部に「中断中のソートを再開」バナーを出す

**比較アルゴリズム:**
- 新規作成時はマージソート（トップダウン）。比較回数は最悪 `n⌈log₂n⌉ − 2^⌈log₂n⌉ + 1` 回
- 「同じくらい」の選択肢は設けない。必ずどちらかを選ぶ
- 左右の表示順はアルゴリズムが返す順で固定する（位置バイアス対策のランダム化は Phase 2）

### FR-RANK-002: ランキングの表示と更新

| 項目 | 内容 |
|------|------|
| 概要 | 確定したランキングを表示し、未追加の本を組み込む |
| 優先度 | 必須 |

**詳細要件:**
- ランキングは順位・表紙・タイトル・著者のリストで表示する
- ランキング確定後に読了になった本・削除された本は表示から外す（次回更新時にランキングからも除去する）
- ランキングに含まれていない未読本（ランキング確定後に登録した本など）を「ランキング未追加の本」として件数付きで表示する
- 「ランキングを更新（未追加 N 冊）」を押すと、未追加の本だけを比較対象として既存ランキングに組み込むソートを開始する。未追加が 0 冊なら無効化
- 「作り直す」を押すと、確認ダイアログの後に現時点の未読本全体を対象にソートし直す（FR-RANK-001）
- ソート中に新しく登録された本はそのソートに含めない。次回の「更新」で組み込む

**更新時の比較アルゴリズム:**
- 既存ランキングの順序は確定済みの比較結果として扱い、既存の本同士は再比較しない
- 未追加の本を 1 冊ずつ既存ランキングへ二分探索で挿入する。1 冊あたり最大 `⌈log₂(n+1)⌉` 回の比較で済む
- 純粋なマージソート（線形マージ）にすると、n 冊のランキングに 1 冊追加するだけで最悪 n 回の比較が必要になるため採用しない

### FR-RANK-003: ランキングからの除外

| 項目 | 内容 |
|------|------|
| 概要 | 特定の本をランキング対象から外す |
| 優先度 | 必須 |

**詳細要件:**
- 2 択画面の「ランキングに含めない」で本を除外できる。除外した本はそのソートの対象から即座に外れる
- 除外は永続的で、作り直し・更新のいずれでも対象外になる
- ランキング画面の「除外した本」セクションから除外を解除できる。解除した本は「ランキング未追加の本」に戻る
- ランキング表示から個別の本を除外する操作、順位の手動変更は Phase 1 では提供しない

---

## 2. データモデル

### 2.1 rankings サブコレクション

ユーザーごとに 1 ドキュメント。ドキュメント ID は固定で `current`。

```
users/{uid}/rankings/current
  ├── status: 'idle' | 'sorting'
  ├── mode: 'create' | 'update' | null          // sorting 中のモード。idle のとき null
  ├── candidateBookIds: string[]                // ソート開始時に確定した比較対象（createdAt 昇順）
  ├── decisions: Array<{ winner: string, loser: string }>  // 比較の回答ログ
  ├── rankedBookIds: string[]                   // 確定済みランキング（上位から）
  ├── excludedBookIds: string[]                 // 除外した本
  ├── createdAt: Timestamp
  └── updatedAt: Timestamp
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| status | `'idle' \| 'sorting'` | `sorting` = ソート進行中（中断中を含む） |
| mode | `'create' \| 'update' \| null` | `create`: 全体をマージソート。`update`: `candidateBookIds` を `rankedBookIds` に二分挿入 |
| candidateBookIds | string[] | ソート開始時のスナップショット。`create` では未読本全体、`update` では未追加の本のみ |
| decisions | `{ winner, loser }[]` | 回答ログ。ソート状態はこのログから再計算する |
| rankedBookIds | string[] | 確定済みランキング。`create` のソート中は旧ランキングを保持し、完了時に置き換える |
| excludedBookIds | string[] | 除外リスト。永続的 |

**「回答ログ + 再計算」方式を採る理由:**
- Firestore は配列の中に配列を保存できないため、マージソートのラン（部分列）の状態をそのまま保存すると構造が煩雑になる
- 除外・削除・読了で候補が減っても、残った本同士の回答ログはそのまま有効。状態の整合性を保つ処理が不要
- ソート処理が純粋関数になり、Vitest で「同じ入力なら同じ 2 択が出る」ことを検証できる
- 再計算のコストは 1000 冊で約 1 万回の比較演算で、体感できない

**制約:**
- 1 回答につき Firestore 書き込み 1 回
- ドキュメント上限 1MB から、実用上の上限は未読 1000 冊前後（decisions 約 1 万件）。超える場合は decisions をインデックス形式に圧縮する（Phase 2）

### 2.2 TypeScript 型定義

```typescript
// packages/common/src/entities/Ranking.ts
import type { FieldValue } from 'firebase/firestore'
import type { BookId } from './Book'

export const rankingCollection = 'rankings' as const
export const currentRankingId = 'current' as const
export type RankingId = string

export type RankingStatus = 'idle' | 'sorting'
export type RankingMode = 'create' | 'update'

export type RankingDecision = {
  winner: BookId
  loser: BookId
}

export type Ranking = {
  rankingId: RankingId
  status: RankingStatus
  mode: RankingMode | null
  candidateBookIds: BookId[]
  decisions: RankingDecision[]
  rankedBookIds: BookId[]
  excludedBookIds: BookId[]
  createdAt: Date
  updatedAt: Date
}

export type CreateRankingDto = Omit<Ranking, 'rankingId' | 'createdAt' | 'updatedAt'> & {
  createdAt: FieldValue
  updatedAt: FieldValue
}

export type UpdateRankingDto = {
  status?: Ranking['status']
  mode?: Ranking['mode']
  candidateBookIds?: Ranking['candidateBookIds']
  decisions?: Ranking['decisions'] | FieldValue   // arrayUnion / arrayRemove を許可
  rankedBookIds?: Ranking['rankedBookIds']
  excludedBookIds?: Ranking['excludedBookIds'] | FieldValue
  updatedAt: FieldValue
}
```

### 2.3 状態遷移

```
[ドキュメントなし]
   │ ランキングを作成
   ▼
[sorting / create] ──回答を繰り返す──▶ 完了 ──▶ [idle] rankedBookIds = 新ランキング
   │ ソートを破棄
   ▼
[idle]（rankedBookIds は変更しない）

[idle] ──ランキングを更新──▶ [sorting / update] ──完了──▶ [idle] rankedBookIds = 挿入後の順序
[idle] ──作り直す────────▶ [sorting / create]（rankedBookIds は完了まで保持）
```

---

## 3. ソートエンジン設計

`apps/web/src/features/ranking/utils/sortEngine.ts` に純粋関数として実装する。

```typescript
export type SortInput = {
  mode: RankingMode
  candidateBookIds: BookId[]    // 現在も有効（未読・未削除・未除外）な候補だけに絞ったもの
  baseRankedBookIds: BookId[]   // update のとき既存ランキング（有効な本だけに絞ったもの）。create では []
  decisions: RankingDecision[]
}

export type SortProgress =
  | {
      status: 'needComparison'
      left: BookId
      right: BookId
      answered: number   // 有効な候補に関する回答数
      maxTotal: number   // 最悪比較回数
    }
  | { status: 'completed'; order: BookId[] }

export const computeSortProgress = (input: SortInput): SortProgress
export const estimateMaxComparisons = (mode: RankingMode, candidateCount: number, baseCount: number): number
```

**記憶付きコンパレータ:**
- `decisions` から `Map<"a|b", winner>` を作る
- `compare(a, b)`:
  - `update` で両方が `baseRankedBookIds` に含まれる → 既存順位で決定（問い合わせなし）
  - ログに `(a, b)` または `(b, a)` がある → 記録どおりに決定
  - どちらでもない → **未知**。計算を中断し、`(a, b)` を次の 2 択として返す
- 決定的なので、何度再計算しても同じ組が返る

**create（マージソート）:**
- `candidateBookIds` をトップダウンで再帰的に分割し、マージ時に `compare` を呼ぶ
- 未知の比較に当たった時点で `needComparison` を返す
- 全マージが終わったら `completed` と順序を返す

**update（二分挿入）:**
- `baseRankedBookIds` をソート済みリストとし、`candidateBookIds` を順番に 1 冊ずつ二分探索で挿入する
- 二分探索の各ステップで `compare(候補, リストの中央)` を呼ぶ。未知なら `needComparison`
- 全候補を挿入し終えたら `completed`

**候補の絞り込み（フック側の責務）:**
- `candidateBookIds` と `rankedBookIds` から、現在の未読本一覧に存在しない ID（削除・読了）と `excludedBookIds` に含まれる ID を除いてからエンジンに渡す
- 絞り込みにより過去の回答の一部が無駄になることはあるが、矛盾は生じない

**テスト（Vitest）:**
- 回答をすべて「左が勝ち」で埋めた場合に `completed` の順序が期待どおりになる
- 同じ入力を 2 回渡すと同じ 2 択が返る（再開の再現性）
- 途中で候補を 1 冊除外しても、残りの回答ログで矛盾なく続行できる
- `update` で既存ランキング同士の比較が一度も要求されない
- `estimateMaxComparisons` が既知の値と一致する（n=8 → 17、n=100 → 573 など）

---

## 4. 画面設計

### SCR-008: ランキング画面（`/ranking`）

| 画面ID | 画面名 | パス | 認証 |
|--------|--------|------|------|
| SCR-008 | 読みたい本ランキング | `/ranking` | 必要 |

SideNav の「すべて」の下に「読みたい本ランキング」リンク（`Trophy` アイコン）を追加する。

**状態 A: ランキング未作成（ドキュメントなし、または `idle` かつ `rankedBookIds` が空）**

```
┌─────────────────────────────────────────────┐
│  読みたい本ランキング                        │
├─────────────────────────────────────────────┤
│  未読の本を 2 択で比べて、読みたい順に        │
│  並べましょう。                              │
│  対象: 未読 12 冊 / 最大 33 回の比較          │
│                                             │
│           [ランキングを作成]                 │
└─────────────────────────────────────────────┘
```

**状態 B: ソート中（`status === 'sorting'`）**

```
┌─────────────────────────────────────────────┐
│  どちらをより読みたい？        [あとで続ける] │
│  ████████░░░░░░░░  12 / 最大 33             │
├──────────────────────┬──────────────────────┤
│  ┌────────────────┐  │  ┌────────────────┐  │
│  │      📕        │  │  │      📘        │  │
│  │                │  │  │                │  │
│  └────────────────┘  │  └────────────────┘  │
│  タイトルA            │  タイトルB            │
│  著者A                │  著者B                │
│  [ランキングに含めない]│  [ランキングに含めない]│
├──────────────────────┴──────────────────────┤
│  [← 1つ戻る]                  [ソートを破棄] │
└─────────────────────────────────────────────┘
```

- カード全体がボタン。`←` / `→` キーでも選択できる
- 「あとで続ける」はホームに戻るだけ（状態は保存済み）
- 「ソートを破棄」は AlertDialog で確認

**状態 C: ランキング表示（`status === 'idle'` かつ `rankedBookIds` あり）**

```
┌─────────────────────────────────────────────┐
│  読みたい本ランキング                        │
│  [ランキングを更新（未追加 3冊）] [作り直す]  │
├─────────────────────────────────────────────┤
│  1  📕 タイトル / 著者                       │
│  2  📘 タイトル / 著者                       │
│  3  📗 タイトル / 著者                       │
│  ...                                        │
├─────────────────────────────────────────────┤
│  ▸ ランキング未追加の本 (3)                  │
│  ▸ 除外した本 (2)              [除外を解除]  │
└─────────────────────────────────────────────┘
```

- `create` モードのソートを中断している場合は、リストの上に「中断中のソートを再開」バナーを表示し、ソート画面（状態 B）へ切り替える
- 読了・削除された本はリストに出さない
- 「作り直す」は AlertDialog で確認

**コンポーネント:**
- `RankingEmptyState`
- `ComparisonView` / `ComparisonCard` / `SortProgressBar`
- `RankingList` / `RankingListItem`
- `UnrankedBooksSection` / `ExcludedBooksSection`
- `RebuildRankingAlertDialog` / `DiscardSortAlertDialog`

---

## 実装ステータス

| タスク | ステータス |
|--------|-----------|
| Task 1-1: Ranking エンティティ型を定義 | 未着手 |
| Task 1-2: entities/index.ts にエクスポート追加 | 未着手 |
| Task 2-1: sortEngine 実装 | 未着手 |
| Task 2-2: sortEngine テスト | 未着手 |
| Task 3-1: rankings Operations | 未着手 |
| Task 3-2: books.ts に未読本全件購読 Operation 追加 | 未着手 |
| Task 4-1: useRanking フック | 未着手 |
| Task 4-2: useUnreadBooks フック | 未着手 |
| Task 4-3: useRankingProgress フック | 未着手 |
| Task 4-4: useStartRankingMutation フック | 未着手 |
| Task 4-5: useAnswerComparisonMutation フック | 未着手 |
| Task 4-6: useUndoComparisonMutation フック | 未着手 |
| Task 4-7: useExcludeBookMutation / useUnexcludeBookMutation フック | 未着手 |
| Task 4-8: useDiscardSortMutation フック | 未着手 |
| Task 5-1: ComparisonView / ComparisonCard / SortProgressBar | 未着手 |
| Task 5-2: RankingList / RankingListItem | 未着手 |
| Task 5-3: UnrankedBooksSection / ExcludedBooksSection | 未着手 |
| Task 5-4: RankingEmptyState / AlertDialog 2 種 | 未着手 |
| Task 5-5: ranking.tsx ルート | 未着手 |
| Task 5-6: SideNav にリンク追加 | 未着手 |
| Task 6-1: Firestore Security Rules 更新 | 未着手 |
| Task 6-2: spec.md 追記 | 未着手 |
| Task 7: ビルド・テスト確認 | 未着手 |

---

## フェーズ 1: 型定義 (packages/common)

### Task 1-1: Ranking エンティティ型を定義

**ファイル:** `packages/common/src/entities/Ranking.ts`（新規）

「2.2 TypeScript 型定義」のとおり。

パターン参照: `packages/common/src/entities/Group.ts`

### Task 1-2: index.ts にエクスポート追加

**ファイル:** `packages/common/src/entities/index.ts`

`export * from './Ranking'` を追加。

---

## フェーズ 2: ソートエンジン (apps/web)

### Task 2-1: sortEngine 実装

**ファイル:** `apps/web/src/features/ranking/utils/sortEngine.ts`（新規）

「3. ソートエンジン設計」のとおり。`computeSortProgress` と `estimateMaxComparisons` をエクスポートする。React・Firestore に依存しない純粋関数にする。

### Task 2-2: sortEngine テスト

**ファイル:** `apps/web/src/features/ranking/utils/sortEngine.test.ts`（新規）

「3. ソートエンジン設計」のテスト項目を Vitest で実装する。実行は `pnpm --filter web test`。

---

## フェーズ 3: Firestore Operations 層

### Task 3-1: rankings Operations

**ファイル:** `apps/web/src/infrastructure/firestore/rankings.ts`（新規）

実装する関数:
- `subscribeRankingOperation(uid: Uid, setter: (ranking: Ranking | null) => void, onError?: (error: Error) => void): Unsubscribe` — `users/{uid}/rankings/current` を `onSnapshot` で購読。存在しなければ `null`
- `createRankingOperation(uid: Uid, dto: CreateRankingDto): Promise<void>` — `setDoc` で ID 固定
- `updateRankingOperation(uid: Uid, dto: UpdateRankingDto): Promise<void>` — `updateDoc`

日付変換: `convertDate(data, ['createdAt', 'updatedAt'])`。

パターン参照: `apps/web/src/infrastructure/firestore/users.ts`, `groups.ts`

### Task 3-2: books.ts に未読本全件購読 Operation 追加

**ファイル:** `apps/web/src/infrastructure/firestore/books.ts`（修正）

`subscribeUnreadBooksOperation(uid: Uid, setter: (books: Book[]) => void): Unsubscribe` を追加。`where('isRead', '==', false)` のみで `orderBy` は付けない（複合インデックス不要にするため）。並び順はクライアント側で `createdAt` 昇順に整える。既存の `subscribeBooksOperation` は 100 件上限があるため使わない。

---

## フェーズ 4: Hooks 層

### Task 4-1: useRanking フック

**ファイル:** `apps/web/src/features/ranking/hooks/useRanking.ts`（新規）

- `subscribeRankingOperation` でリアルタイム購読
- 戻り値: `{ ranking: Ranking | null, isLoading: boolean }`

### Task 4-2: useUnreadBooks フック

**ファイル:** `apps/web/src/features/ranking/hooks/useUnreadBooks.ts`（新規）

- `subscribeUnreadBooksOperation` で購読し、`createdAt` 昇順にソート
- 戻り値: `{ books: Book[], bookMap: Map<BookId, Book>, isLoading: boolean }`

### Task 4-3: useRankingProgress フック

**ファイル:** `apps/web/src/features/ranking/hooks/useRankingProgress.ts`（新規）

`useRanking` と `useUnreadBooks` の結果から派生値を `useMemo` で計算する。状態は持たない。

- `validCandidateBookIds`: `candidateBookIds` のうち `bookMap` に存在し `excludedBookIds` に含まれないもの
- `validRankedBookIds`: `rankedBookIds` のうち同上
- `unrankedBooks`: 未読本のうち `rankedBookIds` にも `excludedBookIds` にも含まれないもの
- `excludedBooks`: `excludedBookIds` のうち `bookMap` に存在するもの
- `progress`: `status === 'sorting'` のとき `computeSortProgress(...)` の結果。それ以外 `null`
- `rankedBooks`: `validRankedBookIds` を `Book[]` に解決したもの

戻り値の型を `export type` で定義する。

### Task 4-4: useStartRankingMutation フック

**ファイル:** `apps/web/src/features/ranking/hooks/useStartRankingMutation.ts`（新規）

- `startCreate(unreadBooks: Book[])`: ドキュメントがなければ `createRankingOperation`、あれば `updateRankingOperation` で `{ status: 'sorting', mode: 'create', candidateBookIds: 除外を除く未読本 ID（createdAt 昇順）, decisions: [] }`。`rankedBookIds` は変更しない
- `startUpdate(unrankedBooks: Book[])`: `{ status: 'sorting', mode: 'update', candidateBookIds: 未追加本 ID, decisions: [] }`
- 候補が 2 冊未満（create）または 0 冊（update）ならエラートースト
- `toast.success` は出さない（画面が切り替わるので不要）

### Task 4-5: useAnswerComparisonMutation フック

**ファイル:** `apps/web/src/features/ranking/hooks/useAnswerComparisonMutation.ts`（新規）

- `answer(winner: BookId, loser: BookId)`: `decisions: arrayUnion({ winner, loser })` で追記
- `complete(order: BookId[])`: `{ status: 'idle', mode: null, candidateBookIds: [], decisions: [], rankedBookIds: order }`
- 回答後に `computeSortProgress` が `completed` を返したら呼び出し側（ComparisonView）が `complete` を呼ぶ。`update` モードでは `order` は挿入後の全体順序
- 連打防止のため `isAnswering` を返し、処理中はカードを無効化する

### Task 4-6: useUndoComparisonMutation フック

**ファイル:** `apps/web/src/features/ranking/hooks/useUndoComparisonMutation.ts`（新規）

- `undo(last: RankingDecision)`: `decisions: arrayRemove(last)`。同じ組は 2 回記録されないので安全
- `decisions` が空なら無効

### Task 4-7: useExcludeBookMutation / useUnexcludeBookMutation フック

**ファイル:** `apps/web/src/features/ranking/hooks/useExcludeBookMutation.ts`, `useUnexcludeBookMutation.ts`（新規）

- `exclude(bookId)`: `excludedBookIds: arrayUnion(bookId)`。`rankedBookIds` に含まれていれば除いた配列で上書き
- `unexclude(bookId)`: `excludedBookIds: arrayRemove(bookId)`

### Task 4-8: useDiscardSortMutation フック

**ファイル:** `apps/web/src/features/ranking/hooks/useDiscardSortMutation.ts`（新規）

- `discard()`: `{ status: 'idle', mode: null, candidateBookIds: [], decisions: [] }`。`rankedBookIds` は保持

---

## フェーズ 5: UI コンポーネント + ルート

### Task 5-1: ComparisonView / ComparisonCard / SortProgressBar

**ファイル:** `apps/web/src/features/ranking/components/ComparisonView.tsx`, `ComparisonCard.tsx`, `SortProgressBar.tsx`（新規）

- `ComparisonView` Props: `{ ranking: Ranking, progress: SortProgress, bookMap: Map<BookId, Book> }`
- `progress.status === 'needComparison'` のとき左右の `ComparisonCard` を表示。`completed` になったら `complete(order)` を呼ぶ（`useEffect` で 1 回だけ）
- `ComparisonCard` Props: `{ book: Book, onSelect: () => void, onExclude: () => void, disabled: boolean }`。表紙・タイトル・著者を表示。表紙がなければ `No Image`
- `useKeyboardShortcut` で `ArrowLeft` / `ArrowRight` を選択にバインド
- モバイルは縦 2 段、`sm:` 以上で横並び

### Task 5-2: RankingList / RankingListItem

**ファイル:** `apps/web/src/features/ranking/components/RankingList.tsx`, `RankingListItem.tsx`（新規）

- Props: `{ books: Book[] }`。順位（index + 1）・表紙サムネイル・タイトル・著者
- 本をタップしたときの動作は Phase 1 では持たない（編集モーダルはホームに任せる）

### Task 5-3: UnrankedBooksSection / ExcludedBooksSection

**ファイル:** `apps/web/src/features/ranking/components/UnrankedBooksSection.tsx`, `ExcludedBooksSection.tsx`（新規）

- 折りたたみ式（`details` 要素または shadcn の Collapsible）。件数をラベルに表示
- `ExcludedBooksSection` は各行に「除外を解除」ボタン

### Task 5-4: RankingEmptyState / AlertDialog 2 種

**ファイル:** `apps/web/src/features/ranking/components/RankingEmptyState.tsx`, `RebuildRankingAlertDialog.tsx`, `DiscardSortAlertDialog.tsx`（新規）

- `RankingEmptyState`: 説明文 + 対象冊数 + 最大比較回数 + 「ランキングを作成」
- AlertDialog はパターン参照: `apps/web/src/features/groups/components/DeleteGroupAlertDialog.tsx`

### Task 5-5: ranking.tsx ルート

**ファイル:** `apps/web/src/routes/_authed/ranking.tsx`（新規）

- `createFileRoute('/_authed/ranking')`
- `useRankingProgress` の結果で状態 A / B / C を分岐
- ローディング中は `Skeleton`

パターン参照: `apps/web/src/routes/_authed/groups.tsx`

### Task 5-6: SideNav にリンク追加

**ファイル:** `apps/web/src/components/SideNav.tsx`（修正）

「すべて」の下に `Trophy` アイコンで「読みたい本ランキング」（`to="/ranking"`）を追加。`useLocation` でアクティブ判定する。

---

## フェーズ 6: セキュリティルール + ドキュメント

### Task 6-1: Firestore Security Rules 更新

**ファイル:** `firestore.rules`（修正）

```javascript
// Ranking のスキーマバリデーション
function isValidRankingSchema(requestData) {
  return requestData.size() == 8
    && 'status' in requestData && requestData.status is string
    && 'mode' in requestData && (requestData.mode is string || requestData.mode == null)
    && 'candidateBookIds' in requestData && requestData.candidateBookIds is list
    && 'decisions' in requestData && requestData.decisions is list
    && 'rankedBookIds' in requestData && requestData.rankedBookIds is list
    && 'excludedBookIds' in requestData && requestData.excludedBookIds is list
    && 'createdAt' in requestData && requestData.createdAt is timestamp
    && 'updatedAt' in requestData && requestData.updatedAt is timestamp;
}

match /users/{userId} {
  // ...既存...
  match /rankings/{rankingId} {
    allow read: if isSignedIn() && isUser(userId);
    allow create: if isSignedIn() && isUser(userId) && isValidRankingSchema(requestData());
    allow update: if isSignedIn() && isUser(userId) && isValidRankingSchema(requestData());
    allow delete: if isSignedIn() && isUser(userId);
  }
}
```

### Task 6-2: spec.md 追記

**ファイル:** `docs/spec.md`（修正）

- 2 章に「2.10 読みたい本ランキング機能（FR-RANK-001〜003）」を追加
- 4.1 のコレクション構造と 4.x に `rankings` サブコレクションを追加
- 5.1 の画面一覧に SCR-008 を追加し、5.x に画面設計を追加
- 6.3 のクライアントサイド API 表に ranking 関連フックを追加
- 7.4 のファイル構成に `features/ranking/` と `routes/_authed/ranking.tsx` を追加
- 8.1 に `rankings` のルールを追加
- 10.3 改訂履歴に 1.5 を追加

---

## 実装順序

```
フェーズ 1（型定義）
  ↓
フェーズ 2（ソートエンジン + テスト）  ← Firestore に依存しないので先に固める
  ↓
フェーズ 3（Operations 層）
  ↓
フェーズ 4（Hooks 層）
  ↓
フェーズ 5, 6（並行可能）
```

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/Ranking.ts` | 新規 | Ranking エンティティ型定義 |
| `packages/common/src/entities/index.ts` | 修正 | エクスポート追加 |
| `apps/web/src/features/ranking/utils/sortEngine.ts` | 新規 | マージソート / 二分挿入の純粋関数 |
| `apps/web/src/features/ranking/utils/sortEngine.test.ts` | 新規 | Vitest テスト |
| `apps/web/src/infrastructure/firestore/rankings.ts` | 新規 | rankings Operations |
| `apps/web/src/infrastructure/firestore/books.ts` | 修正 | 未読本全件購読 Operation 追加 |
| `apps/web/src/features/ranking/hooks/useRanking.ts` | 新規 | ランキング購読フック |
| `apps/web/src/features/ranking/hooks/useUnreadBooks.ts` | 新規 | 未読本購読フック |
| `apps/web/src/features/ranking/hooks/useRankingProgress.ts` | 新規 | 派生値計算フック |
| `apps/web/src/features/ranking/hooks/useStartRankingMutation.ts` | 新規 | ソート開始フック |
| `apps/web/src/features/ranking/hooks/useAnswerComparisonMutation.ts` | 新規 | 回答・完了フック |
| `apps/web/src/features/ranking/hooks/useUndoComparisonMutation.ts` | 新規 | 1 つ戻るフック |
| `apps/web/src/features/ranking/hooks/useExcludeBookMutation.ts` | 新規 | 除外フック |
| `apps/web/src/features/ranking/hooks/useUnexcludeBookMutation.ts` | 新規 | 除外解除フック |
| `apps/web/src/features/ranking/hooks/useDiscardSortMutation.ts` | 新規 | ソート破棄フック |
| `apps/web/src/features/ranking/components/ComparisonView.tsx` | 新規 | 2 択画面 |
| `apps/web/src/features/ranking/components/ComparisonCard.tsx` | 新規 | 2 択カード |
| `apps/web/src/features/ranking/components/SortProgressBar.tsx` | 新規 | 進捗バー |
| `apps/web/src/features/ranking/components/RankingList.tsx` | 新規 | ランキングリスト |
| `apps/web/src/features/ranking/components/RankingListItem.tsx` | 新規 | ランキング行 |
| `apps/web/src/features/ranking/components/UnrankedBooksSection.tsx` | 新規 | 未追加セクション |
| `apps/web/src/features/ranking/components/ExcludedBooksSection.tsx` | 新規 | 除外セクション |
| `apps/web/src/features/ranking/components/RankingEmptyState.tsx` | 新規 | 未作成時の表示 |
| `apps/web/src/features/ranking/components/RebuildRankingAlertDialog.tsx` | 新規 | 作り直し確認 |
| `apps/web/src/features/ranking/components/DiscardSortAlertDialog.tsx` | 新規 | 破棄確認 |
| `apps/web/src/routes/_authed/ranking.tsx` | 新規 | ランキング画面ルート |
| `apps/web/src/components/SideNav.tsx` | 修正 | リンク追加 |
| `firestore.rules` | 修正 | rankings ルール追加 |
| `docs/spec.md` | 修正 | FR-RANK / SCR-008 / データモデル追記 |

## 検証方法

### ビルド・テスト確認

```bash
pnpm --filter web test
pnpm web build
```

### 機能確認（新規作成）

1. 未読本を 5 冊以上登録した状態で `/ranking` を開き、「ランキングを作成」を押す
2. 2 択が表示され、進捗が「0 / 最大 N」であること（n=5 なら N=8）
3. 回答するたびに進捗が進み、同じ組が 2 回出ないこと
4. すべて回答するとランキングリストに切り替わり、Firestore の `rankings/current` が `status: 'idle'` で `rankedBookIds` が埋まっていること

### 機能確認（中断・再開）

1. ソート途中で「あとで続ける」でホームに戻る
2. リロード後に `/ranking` を開くと、同じ 2 択と進捗から再開すること
3. 別ブラウザでログインしても同じ状態から再開すること

### 機能確認（1 つ戻る・除外・破棄）

1. 「1 つ戻る」で直前の 2 択に戻ること。回答数が 1 減ること
2. 「ランキングに含めない」でその本が以後の 2 択に出ないこと。「除外した本」に表示されること
3. 「除外を解除」で「ランキング未追加の本」に戻ること
4. 「ソートを破棄」で旧ランキング（あれば）が表示されること

### 機能確認（更新）

1. ランキング確定後に本を 2 冊登録する
2. `/ranking` に「ランキング未追加の本 (2)」と「ランキングを更新（未追加 2冊）」が出ること
3. 更新を開始すると、既存ランキング同士の 2 択は出ず、新規本 1 冊あたり最大 ⌈log₂(n+1)⌉ 回で終わること
4. 完了後、新規本が既存ランキングの適切な位置に入っていること

### 機能確認（読了・削除）

1. ランキング内の本を読了にすると、リストから消えること
2. ソート中に候補の本を削除しても、次の 2 択が正常に出てソートを完了できること

### セキュリティ確認

- 他ユーザーの `rankings/current` を read / write できないこと
- フィールドが過不足ある書き込みが拒否されること

---

## 確認事項（未決定）

1. **更新モードのアルゴリズム**: 二分挿入で進める前提。厳密にマージソートに揃えたい場合はマージ時にギャロッピング（TimSort 方式）を入れる案があるが、実装が重くなる
2. **ランキング表示からの操作**: 個別の除外・順位の手動変更は Phase 1 では持たない前提
3. **2 択の左右ランダム化**: 位置バイアス対策として Phase 2 で検討
