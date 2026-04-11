<!-- @format -->

# Firestore 設計

- [users](#users)
  - [books](#books)
  - [groups](#groups)
  - [tags](#tags)

## users

### 概要

- ユーザー一覧コレクション
- ID: Firebase Auth の Uid

### 詳細

- createdAt: Timestamp 作成日時
- email: String 認証に使用したメールアドレス
- updatedAt: Timestamp 更新日時

## books

### 概要

- ユーザーの読みたい本一覧コレクション
- ID: 自動生成
- 親コレクションのユーザーのみがアクセス可能

### 詳細

- amazonUrl: String Amazon商品ページのURL
- author: String 本の著者
- coverImageUrl: String 表紙の画像URL
- createdAt: Timestamp 作成日時
- foundBy: String どこで見つけたか（誰に勧められたかなど）
- groups: Array\<String\> 所属するグループIDの配列
- isRead: Boolean 読了かどうか
- location: String どこで読めるか（図書館、ブックオフ、本屋、Kindle Unlimitedなど）
- note: String 自由記述のメモ
- pages: Number ページ数
- purchasedBy: Array\<String\> 購入場所（物理本、Kindle、オフィス）
- scrapingStatus: String スクレイピングの状態（scraping: 取得中, completed: 完了, failed: 失敗）
- tags: Array\<String\> ジャンルタグ
- title: String 本のタイトル
- updatedAt: Timestamp 更新日時

## groups

### 概要

- ユーザーの本のグルーピング一覧コレクション
- ID: 自動生成
- 親コレクションのユーザーのみがアクセス可能

### 詳細

- count: Number グループに登録されている本の数
- createdAt: Timestamp 作成日時
- label: String グループ名
- updatedAt: Timestamp 更新日時

### 同期ルール

- 本の作成時（onCreateBook）: グループが指定されていれば各グループの `count` をインクリメント
- 本の更新時（onUpdateBook）: `before.groups` と `after.groups` の差分を計算し、追加グループをインクリメント・削除グループをデクリメント
- 本の削除時（onDeleteBook）: 各グループの `count` をデクリメント、`count=0` になればドキュメントを削除
- `count` の増減は `FieldValue.increment()` でアトミックに操作する

## tags

### 概要

- ユーザーのタグ一覧コレクション
- ID: 自動生成
- 親コレクションのユーザーのみがアクセス可能
- クライアントからは read のみ。write は Firebase Functions のトリガーが行う

### 詳細

- count: Number タグがついている本の件数
- createdAt: Timestamp 作成日時
- label: String タグ名
- updatedAt: Timestamp 更新日時

### 同期ルール

- 本の作成時（onCreateBook）: タグが存在すれば `count` をインクリメント、なければドキュメントを新規作成
- 本の更新時（onUpdateBook）: `before.tags` と `after.tags` の差分を計算し、追加タグをインクリメント・削除タグをデクリメント
- 本の削除時（onDeleteBook）: 各タグの `count` をデクリメント、`count=0` になればドキュメントを削除
- `count` の増減は `FieldValue.increment()` でアトミックに操作する
