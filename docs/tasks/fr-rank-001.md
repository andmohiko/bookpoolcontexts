# FR-RANK-001〜003: 読みたい本ランキング機能 仕様・実装計画

## Context

未読の本同士を「どちらがより読みたいか」の 2 択で比較していき、読みたい順に並べた「読みたい本ランキング」を作る機能を追加する。比較の組み合わせはボトムアップのマージソートが要求する順に提示し、必要最小限の回答でソートを完了させる。ソートは途中で中断・再開でき、ランキング完成後に登録された本は「ランキング未追加」として分けておき、「ランキングを更新」で既存ランキングに組み込む。

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
- 新規作成時は**ボトムアップのマージソート**
- 「同じくらい」の選択肢は設けない。必ずどちらかを選ぶ
- 左右の表示順はアルゴリズムが返す順で固定する（位置バイアス対策のランダム化は Phase 2）
- 候補 ID の重複はエンジンの入口で除去する。重複があると自分自身との比較が発生し、2 択の左右に同じ本が並ぶ

**ボトムアップを採る理由（実装時に変更）:**

当初はトップダウン（再帰）で設計したが、出題順が体験を損なうため変更した。

- トップダウンは前半の数冊を完全に並べ終えてから後半に移る。n=12 の計測では**全 12 冊が出題されるまで平均 14.2 問**かかり、総比較回数 29.8 回のうち半分近くを答えてもまだ見ていない本が残る。「全体像が見えないまま細部の順位付けに入る」状態になる
- ボトムアップは幅優先に進むため、**最初の `⌈n/2⌉` 問で全冊が 1 回ずつ登場**する（n=12 なら 6 問）。総比較回数はほぼ同じ（29.8 回）
- ランの数が奇数のとき、余った 1 本を次の段へ素通しすると、その中の本が終盤まで出題されない（n=9 で 9 冊目が 16 問目まで登場しない）。**余りは最短のランへ畳む**ことで `⌈n/2⌉` 問での全冊登場を保証する。この畳み込みにより最悪比較回数も改善した（n=5: 9 → 8、n=9: 25 → 21）

**最悪比較回数:**

ラン構造をたどり、各マージのコスト（左の長さ + 右の長さ − 1）を積み上げて求める。トップダウンの公式 `n⌈log₂n⌉ − 2^⌈log₂n⌉ + 1` は使わない（ボトムアップではランの畳み方で値が変わるため）。

| n | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 16 | 20 | 100 |
|---|---|---|---|---|---|---|---|---|----|----|----|----|-----|
| 最悪回数 | 1 | 3 | 5 | 8 | 11 | 15 | 17 | 21 | 25 | 33 | 49 | 69 | 577 |

n=1〜9 は全順列を網羅した実測値と一致。いずれもトップダウンの公式と同等以下に収まる。

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
- 未追加の本を 1 冊ずつ既存ランキングへ二分探索で挿入する
- 最大比較回数は **累積和** `Σ_{i=1..k} ⌈log₂(n+i)⌉`（n = 既存ランキング冊数、k = 未追加冊数）。挿入ごとにリストが 1 冊伸びるため、`k × ⌈log₂(n+1)⌉` では**実測を下回る**ことがある
  - 実測で検証済み（400 試行 × 各ケース）: `n=7, k=3` → 実測上限 11 / 累積和 11 / `k×⌈log₂(n+1)⌉` は 9 で過小。`n=15, k=5` → 実測 23 / 累積和 24 / 過小式 20。`n=0, k=3` → 実測 3 / 累積和 3 / 過小式 0
  - 進捗バーの分母に過小な式を使うと「回答数が最大値を超える」表示になるため、必ず累積和で実装する
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
- **除外解除は `status === 'idle'` のときのみ可能**。ソート進行中（`status === 'sorting'`）は解除ボタンを無効化する
  - 理由: ソート中に解除すると、その本に関する比較が改めて要求され、進捗が巻き戻ったように見える。決定ログ自体に矛盾は生じない（検証済み）が、体験が壊れるため禁止する
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
| mode | `'create' \| 'update' \| null` | `create`: 全体をボトムアップのマージソート。`update`: `candidateBookIds` を `rankedBookIds` に二分挿入 |
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

**`arrayUnion` の重複排除の挙動（実装上の必須前提）:**

firebase-js-sdk 4.8.0 の `applyArrayUnionTransformOperation` は、追加する要素が既存要素と `valueEquals` で等しい場合に**追加をスキップ**する。`valueEquals` はマップを `objectEquals` で再帰比較するため、`{ winner: 'a', loser: 'b' }` は配列内に 1 つしか入らない。

このため:
- 同じ回答を 2 回送っても `decisions` は増えない（冪等。連打自体は安全）
- ただし「最後の 1 問に回答 → `onSnapshot` 到着前にもう一度回答」した場合、2 回目の書き込みが無視され `decisions.length` が増えないため、**スナップショット待ちで `complete()` を呼ぶ設計だと画面が固まる**
- `arrayRemove` も `valueEquals` で一致する要素を**すべて**除去するが、`arrayUnion` 側で重複が入らないので undo で複数消える事故は起きない

対策は Task 4-5 を参照（回答と完了を 1 回の `updateDoc` に統合する）。

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

/**
 * 最悪比較回数を返す。
 * - create: ボトムアップのラン構造をたどり、各マージのコスト
 *           （左の長さ + 右の長さ − 1）を積み上げる（n ≤ 1 は 0。baseCount は無視）
 * - update: Σ_{i=1..candidateCount} ⌈log₂(baseCount + i)⌉
 */
export const estimateMaxComparisons = (
  mode: RankingMode,
  candidateCount: number,
  baseCount: number,
): number
```

**記憶付きコンパレータ:**
- `decisions` から `Map<"a|b", winner>` を作る
- `compare(a, b)`:
  - `update` で両方が `baseRankedBookIds` に含まれる → 既存順位で決定（問い合わせなし）
  - ログに `(a, b)` または `(b, a)` がある → 記録どおりに決定
  - どちらでもない → **未知**。計算を中断し、`(a, b)` を次の 2 択として返す
- 決定的なので、何度再計算しても同じ組が返る

**create（ボトムアップのマージソート）:**
- `candidateBookIds` を 1 冊ずつのランにし、隣接するランを 1 段ずつマージしていく
- 各段で、ランの数が奇数なら余った 1 本を**最短のランへ畳む**（次の段へ素通しすると、その中の本が終盤まで出題されない）
- マージ時に `compare` を呼び、未知の比較に当たった時点で `needComparison` を返す
- ラン数が 1 になったら `completed` と順序を返す
- トップダウン（再帰）にしない理由は「1. 機能仕様 > ボトムアップを採る理由」を参照

**入口での重複排除:**
- `baseRankedBookIds` と `candidateBookIds` から重複 ID を除去する
- `update` では既存ランキングを優先し、既存に含まれる ID は候補側から除く
- 重複があると自分自身との比較が発生し、2 択の左右に同じ本が並ぶ（実装時に発覚したバグ）

**update（二分挿入）:**
- `baseRankedBookIds` をソート済みリストとし、`candidateBookIds` を順番に 1 冊ずつ二分探索で挿入する
- 二分探索の各ステップで `compare(候補, リストの中央)` を呼ぶ。未知なら `needComparison`
- 全候補を挿入し終えたら `completed`

**候補の絞り込み（フック側の責務）:**
- `candidateBookIds` と `rankedBookIds` から、現在の未読本一覧に存在しない ID（削除・読了）と `excludedBookIds` に含まれる ID を除いてからエンジンに渡す
- 絞り込みにより過去の回答の一部が無駄になることはあるが、矛盾は生じない

**テスト（Vitest）: 実装済み 45 件**

ソートの進行:
- 回答をすべて「左が勝ち」で埋めた場合に `completed` の順序が期待どおりになる
- 同じ入力を 2 回渡すと同じ 2 択が返る（再開の再現性）
- 途中で候補を 1 冊除外しても、残りの回答ログで矛盾なく続行できる
- 同じ組の比較が 2 回要求されない（`arrayUnion` の重複排除で進捗が止まらないことの担保）
- `undo`（`decisions` の末尾を 1 件削除）すると、次に返る 2 択が削除した組と一致する
- `update` で既存ランキング同士の比較が一度も要求されない

同じ本が左右に並ばない（重複防御）:
- `create`: 候補に重複 ID があっても `left !== right`
- `update`: 候補が既存ランキングにも含まれていても `left !== right`
- `update`: 既存ランキング自体に重複があっても結果が重複しない
- 確定した順序に同じ本が 2 回現れない（ランダム 30 試行）
- テストヘルパー `runSort` が `left === right` を検出したら即座に失敗する

出題順（全体像を先に見せる）:
- 最初の `⌈n/2⌉` 問で全冊が 1 回ずつ登場する
- 偶数・奇数どちらでも `⌈n/2⌉` 問で全冊に触れる（n=8, 9, 10, 15, 16, 20 で検証）

`estimateMaxComparisons`:
- `create`: n=2 → 1、3 → 3、4 → 5、5 → 8、6 → 11、7 → 15、8 → 17、9 → 21、10 → 25、12 → 33、16 → 49、20 → 69
- `create`: トップダウンの公式と同等以下に収まる（余りの畳み込みの効果の回帰防止）
- `update`: 累積和 `Σ_{i=1..k} ⌈log₂(n+i)⌉`。`n=7,k=3` → 11、`n=15,k=5` → 24、`n=0,k=3` → 3
- いずれも実際のソートを回したときの比較回数が返り値以下に収まる（決定的な擬似乱数で再現可能な検証）

**テスト環境:** `apps/web/vite.config.ts` への `test` セクション追加は不要。`pnpm --filter web test` で `src/**/*.test.ts` がデフォルト設定（`environment: 'node'`）のまま実行できることを確認済み（`tanstackStart` プラグインとの干渉もなし）。

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
| Task 1-1: Ranking エンティティ型を定義 | 完了 |
| Task 1-2: entities/index.ts にエクスポート追加 | 完了 |
| Task 2-1: sortEngine 実装 | 完了 |
| Task 2-2: sortEngine テスト | 完了 |
| Task 3-1: rankings Operations | 完了 |
| Task 3-2: books.ts に未読本全件購読 Operation 追加 | 完了 |
| Task 4-1: useRanking フック | 完了 |
| Task 4-2: useUnreadBooks フック | 完了 |
| Task 4-3: useRankingProgress フック | 完了 |
| Task 4-4: useStartRankingMutation フック | 完了 |
| Task 4-5: useAnswerComparisonMutation フック | 完了 |
| Task 4-6: useUndoComparisonMutation フック | 完了 |
| Task 4-7: useExcludeBookMutation / useUnexcludeBookMutation フック | 完了 |
| Task 4-8: useDiscardSortMutation フック | 完了 |
| Task 4-9: useFinalizeRankingMutation フック（実装時に追加） | 完了 |
| Task 5-1: ComparisonView / ComparisonCard / SortProgressBar | 完了 |
| Task 5-2: RankingList / RankingListItem | 完了 |
| Task 5-3: UnrankedBooksSection / ExcludedBooksSection | 完了 |
| Task 5-4: RankingEmptyState / AlertDialog 2 種 | 完了 |
| Task 5-5: ranking.tsx ルート | 完了 |
| Task 5-6: SideNav にリンク追加 | 完了 |
| Task 6-1: Firestore Security Rules 更新 | 完了 |
| Task 6-2: spec.md 追記 | 完了 |
| Task 7: ビルド・テスト確認 | 完了 |

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

`subscribeUnreadBooksOperation(uid: Uid, setter: (books: Book[]) => void, onError?: (error: Error) => void): Unsubscribe` を追加。`where('isRead', '==', false)` のみで `orderBy` は付けない（複合インデックス不要にするため。単一フィールドは自動インデックスで足りる）。並び順はクライアント側で `createdAt` 昇順に整える。

- 既存の `subscribeBooksOperation` は `limit(pageSize)` 付き（`PAGE_SIZE = 18`）なので使えない
- `firestore.indexes.json` への追記は不要（既存の複合インデックスは `groups`/`tags` × `createdAt` の 2 件のみで、今回は該当しない）
- **コスト上の注意**: `limit` なしの全件購読なので、未読 1000 冊なら初回に 1000 ドキュメント読み取りが発生する。この Operation を購読するのは `/ranking` 配下のコンポーネントのみに限定し、`SideNav.tsx` や `routes/_authed.tsx` など常時マウントされる場所からは呼ばない
- `onError` は `subscribeGroupsOperation` と同じ形で受ける

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

- `answer(winner: BookId, loser: BookId)`: **次の状態をローカルで先に計算し、1 回の `updateDoc` で書き込む**

```typescript
const answer = async (winner: BookId, loser: BookId): Promise<void> => {
  const nextDecisions = [...decisions, { winner, loser }]
  const next = computeSortProgress({ ...sortInput, decisions: nextDecisions })

  if (next.status === 'completed') {
    // 完了: 回答の追記と確定を 1 回の書き込みにまとめる
    await updateRankingOperation(uid, {
      status: 'idle',
      mode: null,
      candidateBookIds: [],
      decisions: [],
      rankedBookIds: next.order,
      updatedAt: serverTimestamp,
    })
  } else {
    await updateRankingOperation(uid, {
      decisions: arrayUnion({ winner, loser }),
      updatedAt: serverTimestamp,
    })
  }
}
```

- `useEffect` + `onSnapshot` 待ちで `complete()` を呼ぶ設計にはしない。`arrayUnion` の重複排除により、スナップショット到着前の再回答が無視され進捗が止まるため（「2.1 `arrayUnion` の重複排除の挙動」参照）
- `update` モードでは `next.order` が挿入後の全体順序になる
- 連打防止のため `isAnswering` を返し、処理中はカードを無効化する
- `serverTimestamp` は `@/lib/firebase` から **値としてインポート**する（`lib/firebase.ts` でモジュール初期化時に `serverTimestamp()` を 1 回呼んだ `FieldValue` センチネルを export している）。既存の `useUpdateGroupMutation` と同じ形にする

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

### Task 4-9: useFinalizeRankingMutation フック（実装時に追加）

**ファイル:** `apps/web/src/features/ranking/hooks/useFinalizeRankingMutation.ts`（新規）

- `finalize(order)`: `{ status: 'idle', mode: null, candidateBookIds: [], decisions: [], rankedBookIds: order }`
- 通常の完了は Task 4-5 が回答と同一の書き込みで処理する。このフックは「候補が除外・削除・読了で減り、2 択を出さずに `completed` になった」ケース専用の経路
- `useEffect` の依存配列から呼ばれるため `useCallback` で参照を安定させる

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

- 折りたたみは **`details` / `summary` 要素**で実装する。件数をラベルに表示
  - shadcn の Collapsible は使わない: `apps/web/src/components/ui/collapsible.tsx` が存在せず、`@radix-ui/react-collapsible` も未インストール。この機能のために依存を増やさない
- `ExcludedBooksSection` は各行に「除外を解除」ボタン。`status === 'sorting'` のときは `disabled` にする（FR-RANK-003）

### Task 5-4: RankingEmptyState / AlertDialog 2 種

**ファイル:** `apps/web/src/features/ranking/components/RankingEmptyState.tsx`, `RebuildRankingAlertDialog.tsx`, `DiscardSortAlertDialog.tsx`（新規）

- `RankingEmptyState`: 説明文 + 対象冊数 + 最大比較回数 + 「ランキングを作成」
- 確認ダイアログは **`@/components/ui/dialog` の `Dialog`** で実装する
  - `apps/web/src/components/ui/alert-dialog.tsx` は存在せず、`@radix-ui/react-alert-dialog` も未インストール
  - パターン参照: `apps/web/src/features/groups/components/DeleteGroupAlertDialog.tsx`（名前は AlertDialog だが中身は通常の `Dialog` + `DialogFooter` に「キャンセル」/「実行」ボタン）
  - Props は `{ isOpen, onClose }` 形式、`onOpenChange={(open) => !open && onClose()}` に揃える

### Task 5-5: ranking.tsx ルート

**ファイル:** `apps/web/src/routes/_authed/ranking.tsx`（新規）

- `createFileRoute('/_authed/ranking')`
- `useRankingProgress` の結果で状態 A / B / C を分岐
- ローディング中は `Skeleton`

パターン参照: `apps/web/src/routes/_authed/groups.tsx`

### Task 5-6: SideNav にリンク追加

**ファイル:** `apps/web/src/components/SideNav.tsx`（修正）

「すべて」の下に `Trophy` アイコン（`lucide-react@0.577.0` に存在を確認済み）で「読みたい本ランキング」（`to="/ranking"`）を追加する。

- 既存の `SideNav.tsx` は `useSearch({ strict: false })` で `search.tag` / `search.group` を見てアクティブ判定している。`/ranking` は別ルートなのでこの仕組みでは判定できない
- `useLocation` を追加 import し、`location.pathname === '/ranking'` で判定する。既存のタグ／グループの判定ロジックは変更しない（別系統として共存させる）
- 既存の「すべて」の `isActive={selectedTag === null && selectedGroup === null}` は `/ranking` にいるときも true になってしまうため、`&& location.pathname === '/'` を足す

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

**`size() == 8` が部分 update でも通る根拠:**

[公式ドキュメント](https://firebase.google.com/docs/firestore/security/rules-conditions)より「For `update` operations that only modify a subset of the document fields, the `request.resource.data` variable will contain the pending document state after the operation.」つまり `request.resource.data` は**書き込み後のマージ済みドキュメント全体**を指す。`updateDoc` で `decisions` と `updatedAt` のみを送っても、既存の 6 フィールドを含んだ 8 フィールドとして評価されるため、既存の Book / Group ルールと同じ `size()` 固定の書き方がそのまま使える。

**フィールド構成（8 個）:** `status` / `mode` / `candidateBookIds` / `decisions` / `rankedBookIds` / `excludedBookIds` / `createdAt` / `updatedAt`

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
フェーズ 1（型定義）                   → 検証: pnpm web build
  ↓
フェーズ 2（ソートエンジン + テスト）  ← Firestore に依存しないので先に固める
                                       → 検証: pnpm --filter web test が全 pass
  ↓
フェーズ 3（Operations 層）            → 検証: pnpm web build
  ↓
フェーズ 4（Hooks 層）                 → 検証: pnpm web build
  ↓
フェーズ 5, 6（並行可能）              → 検証: pnpm web build + pnpm --filter web test
```

`vite.config.ts` への `test` セクション追加は不要（検証済み）。

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `packages/common/src/entities/Ranking.ts` | 新規 | Ranking エンティティ型定義 |
| `packages/common/src/entities/index.ts` | 修正 | エクスポート追加 |
| `apps/web/src/features/ranking/utils/sortEngine.ts` | 新規 | ボトムアップのマージソート / 二分挿入の純粋関数 |
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
| `apps/web/src/features/ranking/hooks/useFinalizeRankingMutation.ts` | 新規 | 2 択なしで完了した場合の確定フック |
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

## 確認事項

1. **新規作成のアルゴリズム**: ボトムアップのマージソート（余りは最短ランへ畳む）。**決定済み・実装時に変更**。当初のトップダウンは出題順が体験を損なうため採用しない（「実装時・動作確認時に判明した問題」2・3 参照）
2. **更新モードのアルゴリズム**: 二分挿入で進める。**決定済み**。厳密にマージソートに揃えたい場合はマージ時にギャロッピング（TimSort 方式）を入れる案があるが、実装が重くなるため採用しない
3. **ランキング表示からの操作**: 個別の除外・順位の手動変更は Phase 1 では持たない。**決定済み**
4. **2 択の左右ランダム化**: 位置バイアス対策として Phase 2 で検討。**Phase 1 ではアルゴリズムが返す順で固定**
5. **ソート中の除外解除**: `status === 'idle'` のときのみ解除可。**決定済み**（FR-RANK-003 参照）

---

## 事前検証の記録

実装前に以下を実コード・公式ドキュメント・シミュレーションで検証した。

| 検証項目 | 方法 | 結果 |
|---------|------|------|
| Rules の `size() == 8` が部分 update で通るか | [公式ドキュメント](https://firebase.google.com/docs/firestore/security/rules-conditions) | ✅ `request.resource.data` はマージ後の全体 |
| `create` の最大比較回数の式 | シミュレーション 300 試行 × n=2,3,4,5,8,10,100 | ⚠️ トップダウン前提の公式。ボトムアップへの変更に伴い実装し直した（下記「実装時に判明した問題」参照） |
| マージソートで同じ組が 2 回出ないか | 同上、全試行で重複 0 | ✅ |
| 候補を除外しても矛盾しないか | ランダム除外 2000 試行 | ✅ 同じ組の再要求 0 件 |
| `decisions` の順序 = 比較要求順序（undo の前提） | 500 試行で照合 | ✅ 完全一致。`arrayRemove(末尾)` で直前の回答が消える |
| `update` で既存同士を再比較しないか | base 10 冊 + 新 3 冊で実測 | ✅ 既存同士の比較 0 回 |
| `update` の最大比較回数 | 400 試行 × 7 ケース | ⚠️ `k×⌈log₂(n+1)⌉` は過小。累積和が正しい |
| `arrayUnion` の重複排除 | firebase-js-sdk 4.8.0 の `applyArrayUnionTransformOperation` / `objectEquals` | ⚠️ 深い等価で重複排除。Task 4-5 の設計を変更 |
| `alert-dialog` / `collapsible` の有無 | `apps/web/src/components/ui/` と `package.json` | ⚠️ どちらも未導入。`Dialog` と `details` で代替 |
| `Trophy` アイコンの有無 | `lucide-react@0.577.0` の型定義 | ✅ 存在 |
| Vitest が追加設定なしで動くか | `apps/web` に一時テストを置いて `pnpm --filter web test` | ✅ `test` セクション追加不要 |
| SideNav のアクティブ判定方式 | `apps/web/src/components/SideNav.tsx` | ⚠️ `useSearch` ベース。`/ranking` には `useLocation` が必要 |

---

## 実装時・動作確認時に判明した問題

### 1. 2 択の左右に同じ本が並ぶ（動作確認で発覚）

**症状:** 比較画面の左右に同一の本が表示される。

**原因:** 候補 ID に重複があると自分自身との比較が発生する。`update` モードで候補が既存ランキングにも含まれている場合、既存ランキング自体に重複がある場合に起きる。確定順序にも同じ本が 2 回入る。

**対策:** 3 層で防御した。
- `computeSortProgress` の入口で `baseRankedBookIds` / `candidateBookIds` の重複を除去（`update` では既存ランキングを優先し候補側から除く）
- `useStartRankingMutation` の `startCreate` / `startUpdate` でも候補生成時に重複と既存ランキング分を除外
- テストヘルパー `runSort` が `left === right` を検出したら即座に失敗する

**検証:** 対策を外すとテスト 3 件が落ちることを確認済み。

### 2. 全体像が見えないまま細部の順位付けに入る（動作確認で発覚）

**症状:** 数冊をソートすると、その中での優先順位付けに入ってしまい非効率。

**原因:** トップダウン（再帰）のマージソートは前半を完全に並べ終えてから後半に移る。n=12 の計測で**全 12 冊が出題されるまで平均 14.2 問**（総比較回数 29.8 回）。

**対策:** ボトムアップのマージソートへ変更。総比較回数をほぼ変えずに（29.8 → 29.8）、全冊登場が **6 問**（理想値 `⌈n/2⌉`）になった。

### 3. 奇数個のとき最後の 1 冊が終盤まで出題されない（対策 2 の実装中に発覚）

**症状:** ボトムアップ化しても n=9 で 9 冊目が 16 問目まで登場しない。

**原因:** ランの数が奇数のとき、余った 1 本を次の段へ素通ししていたため、最終段まで持ち上げられ続ける。

**対策:** 余りを**最短のランへ畳む**。全冊登場が `⌈n/2⌉` 問ちょうどになり、最悪比較回数も改善した（n=5: 9 → 8、n=9: 25 → 21）。

### 4. ボトムアップではトップダウンの公式が使えない（対策 2 の実装中に発覚）

**症状:** n=5 で実際に 9 回の比較が必要なのに `estimateMaxComparisons` が 8 を返し、進捗バーの分母を超えた。

**原因:** `n⌈log₂n⌉ − 2^⌈log₂n⌉ + 1` はトップダウン前提の式。ボトムアップはランの畳み方で値が変わる。

**対策:** ラン構造をたどって各マージのコスト（左の長さ + 右の長さ − 1）を積み上げる実装に変更。n=1〜9 の全順列を網羅して実測の最悪値と一致することを確認した。対策 3 の畳み込み後はトップダウンの公式と同等以下に収まる。

### 5. 2 択なしで完了するケースの確定経路がない（実装中に発覚）

**症状:** 除外・削除・読了で候補が減ると `needComparison` を経ずに `completed` になるが、`ComparisonView` は `needComparison` のときだけ描画されるため確定処理が走らない。

**対策:** `useFinalizeRankingMutation` を追加し、ルート側の `useEffect` で確定する。無限ループは内容ベースのキーと `useRef` で回避した。

### 6. 中断再開バナーが到達不能（実装中に発覚）

**症状:** ソート中は常に状態 B（2 択画面）へ入るため、仕様にある「中断中のソートを再開」バナーが表示されない。

**対策:** `isComparing` state を導入し、旧ランキングがある `create` 中断時のみバナーを経由する。`update` は旧ランキングを置き換える前提なので即座に 2 択へ入る。
