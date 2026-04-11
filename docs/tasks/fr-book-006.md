# FR-BOOK-006: 読了機能の実装

## Context

`Book.isRead` フィールド自体はすでにエンティティに存在するが、UIから操作する手段が提供されていなかった（作成・編集フォームに項目がなく、初期値 `false` で固定）。また `BookCard` には右上に小さなテキストだけの「読了」表示があり、視認性が低かった。

このタスクでは以下を実現する:

1. 本の作成・編集モーダルに読了チェックボックスを追加し、ユーザーが読了状態をトグルできるようにする
2. `BookCard` の右上に読了状態を示すバッジ（`Badge` コンポーネント）を表示し、視覚的に区別しやすくする
3. 設定画面に「読了済みの本を非表示にする」トグルを追加する
4. 非表示はフロントエンドでの配列フィルタで実現する（Firestoreクエリはシンプルな `where` のままに保つ）

Spec上は FR-BOOK-005（読了フラグ）に該当する要件だが、既存の `docs/tasks/fr-book-005.md` が Amazon HTML 機能に使われているため、本タスクは `fr-book-006.md` として作成する。

## 現状の確認

- `Book.isRead: boolean` はエンティティに既存（`packages/common/src/entities/Book.ts`）
- `UpdateBookDto.isRead` も既存のため、rules / 型定義の変更は不要
- `BookCard` には右上に小さな span の「読了」表示があり、視認性が低い
- 本の作成・編集フォームには `isRead` 入力がなく、作成時は固定で `false`

## 設計方針

### 読了チェックボックスの入力

- Zod スキーマ（登録・編集の両方）に `isRead: z.boolean().default(false)` を追加
- 登録・編集モーダルの購入場所 Checkbox と同じパターンで1個の Checkbox を配置
- 配置位置: 登録・編集とも「メモ」の下
- `useCreateBookMutation` / `useUpdateBookMutation` の入力型に `isRead: boolean` を追加し、DTO にそのまま渡す

### 読了バッジの表示

- `BookCard` の既存の右上テキスト表示（`<span>読了</span>`）を削除し、同じ右上位置に `Badge` コンポーネントで置換
- `absolute top-1 right-1` で配置（既存の refetch ボタンは `top-1 left-1` にあるため競合しない）
- `Badge variant="secondary"` ＋ `lucide-react` の `CheckCircle2` アイコン ＋「読了」テキスト
- カードクリックを妨げないよう `pointer-events-none` を付与

### 読了非表示設定

- `useThemeMode` と同じ localStorage ベースのパターンで `useHideReadBooks` フックを新規作成
  - キー: `'hideReadBooks'`, 値: `'true' | 'false'`（デフォルト `false`）
  - 戻り値: `{ hideReadBooks: boolean, setHideReadBooks: (v: boolean) => void }`
- 設定画面にセクションを追加し、Checkbox + ラベルで設定できるようにする
- `BookList` コンポーネント内でフックを呼び、`hideReadBooks === true` のときだけ `books.filter((b) => !b.isRead)` した配列を描画する
- フィルタは `BookList` 側で一元適用することで、トップ・タグフィルタ・グループフィルタの全ページに自動適用される

### Firestore スキーマへの影響

`isRead` フィールドはすでにエンティティ・`firestore.rules`・`CreateBookDto` / `UpdateBookDto` に存在するため、Firestore rules や型定義に追加は不要。変更はフロント側のみ。

## 実装タスク

| タスク | ステータス |
|--------|-----------|
| Task 1: Zod スキーマに `isRead` を追加 | 完了 |
| Task 2: `useCreateBookMutation` / `useUpdateBookMutation` の入力型を拡張 | 完了 |
| Task 3: `BookRegistrationModal` に読了チェックボックスを追加 | 完了 |
| Task 4: `BookEditModal` に読了チェックボックスを追加 | 完了 |
| Task 5: `BookCard` の読了バッジを `Badge` コンポーネントに置換 | 完了 |
| Task 6: `useHideReadBooks` フックの新規作成 | 完了 |
| Task 7: `BookList` でフロントエンドフィルタを適用 | 完了 |
| Task 8: 設定画面に「読了済みの本を非表示」トグルを追加 | 完了 |
| Task 9: タスクドキュメント作成（本ファイル） | 完了 |
| Task 10: ビルド確認 | 完了 |

## 変更対象ファイル一覧

| ファイルパス | 操作 | 内容 |
|-------------|------|------|
| `apps/web/src/features/books/schemas/bookSchema.ts` | 修正 | 両スキーマに `isRead` を追加 |
| `apps/web/src/features/books/hooks/useCreateBookMutation.ts` | 修正 | `CreateBookInput` に `isRead`、DTO の固定値を差し替え |
| `apps/web/src/features/books/hooks/useUpdateBookMutation.ts` | 修正 | `UpdateBookInput` に `isRead` を追加 |
| `apps/web/src/features/books/components/BookRegistrationModal.tsx` | 修正 | 読了 Checkbox を追加 |
| `apps/web/src/features/books/components/BookEditModal.tsx` | 修正 | 読了 Checkbox を追加、`book.isRead` を初期値に |
| `apps/web/src/features/books/components/BookCard.tsx` | 修正 | 右上 span を削除し `Badge`（アイコン付き）に置換 |
| `apps/web/src/hooks/useHideReadBooks.ts` | 新規 | localStorage ベースのフック |
| `apps/web/src/features/books/components/BookList.tsx` | 修正 | `hideReadBooks` でフロントフィルタ |
| `apps/web/src/routes/_authed/settings.tsx` | 修正 | 「本の表示」セクションを追加 |
| `docs/tasks/fr-book-006.md` | 新規 | タスクドキュメント |

## 実装順序

1. Task 1（Zod スキーマ）
2. Task 2（Mutation フック型）
3. Task 3, 4（モーダル UI）
4. Task 5（BookCard バッジ）
5. Task 6（`useHideReadBooks` フック）
6. Task 7（BookList フィルタ）
7. Task 8（設定画面 UI）
8. Task 9（タスクドキュメント作成）
9. Task 10（ビルド確認）

## 検証方法

### ビルド確認

```bash
pnpm web build
```

エラーなく通ること。

### 機能確認（作成）

1. 新規本の登録モーダルを開く
2. 「読了状態」チェックボックスが表示されている
3. チェックを入れて登録 → Firestore で `isRead: true` で保存されていること
4. 一覧のカード右上に「読了」バッジが表示されていること

### 機能確認（編集）

1. 既存の本をクリックして編集モーダルを開く
2. 現状の `isRead` 値がチェックボックスに反映されている
3. トグルして更新 → BookCard のバッジ表示が即座に切り替わる（リアルタイム購読で反映）

### 機能確認（非表示設定）

1. 読了の本と未読の本を混在させた状態で `/` を表示
2. 設定画面を開き「読了済みの本を一覧に表示しない」をON
3. `/` に戻ると読了の本が非表示になっている
4. タグフィルタ・グループフィルタのビューでも同様に非表示になっている
5. 設定をOFFに戻すと再度表示される
6. ページをリロードしても設定が保持されている（localStorage）

### リグレッション確認

- 既存の本の一覧・編集・削除が引き続き動作する
- 既存のタグフィルタ・グループフィルタが引き続き動作する
- Firestore 側のスキーマ変更がないため rules の影響はない
- 非ログイン時の挙動に影響しないこと
