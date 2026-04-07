/** Amazon検索で取得した本の情報 */
export type AmazonBookItem = {
  asin: string
  title: string
  coverImageUrl: string
  amazonUrl: string
}

/** 検索APIレスポンス */
export type SearchBooksResponse = {
  items: AmazonBookItem[]
}
