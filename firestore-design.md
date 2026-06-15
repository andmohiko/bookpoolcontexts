<!-- @format -->

# Firestore 設計

- [sharedGroups](#sharedgroups)
- [users](#users)
  - [books](#books)
  - [groups](#groups)
  - [tags](#tags)

## sharedGroups

### 概要

- グループの公開共有データコレクション
- ID: 自動生成
- トップレベルコレクション（ユーザーのサブコレクションではない）
- 認証不要で読み取り可能（パブリック公開）
- クライアントから create / delete 可能。update は Cloud Functions の Admin SDK のみ

### 詳細

- books: Array\<SharedBook\> 本の公開情報のスナップショット
  - amazonUrl: String Amazon詳細ページのURL
  - author: String | null 著者名
  - coverImageUrl: String | null 表紙画像URL
  - tags: Array\<String\> タグの配列
  - title: String | null 本のタイトル
- createdAt: Timestamp 共有作成日時
- groupId: String 元の group ドキュメントID
- groupLabel: String グループ名
- ownerName: String 共有元ユーザーの表示名（スナップショット時点。未設定の場合は空文字）
- uid: String 共有元ユーザーの Firebase Auth UID
- updatedAt: Timestamp 共有更新日時

### 同期ルール

- グループ名変更時（onUpdateGroup）: `groupLabel` を同期
- グループ削除時（onDeleteGroup）: 対応する sharedGroups ドキュメントも削除
- 本の作成時（onCreateBook）: 本の `groups` に含まれる label に紐づく sharedGroups の `books` 配列を再構築
- 本の更新時（onUpdateBook）: 公開対象フィールド（title, author, coverImageUrl, tags, amazonUrl, groups）が変更された場合、影響する sharedGroups の `books` 配列を再構築
- 本の削除時（onDeleteBook）: 本の `groups` に含まれる label に紐づく sharedGroups の `books` 配列を再構築

## users

### 概要

- ユーザー一覧コレクション
- ID: Firebase Auth の Uid

### 詳細

- createdAt: Timestamp 作成日時
- displayName: String 表示名（共有ページ等で使用。未設定の場合は空文字）
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
