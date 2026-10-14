import type { Book } from '@bookpoolcontexts/common'

/** Amazon の URL から ASIN（10 桁の英数字）を取り出す */
const extractAsin = (url: string): string | null => {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/)
  return match ? match[1] : null
}

/**
 * 同じ本かどうかを判定するためのキーを返す。
 *
 * 本の登録に重複チェックがないため、同じ本を 2 回登録すると別の bookId で
 * 中身が同一のドキュメントができる。ランキングでは別の本として扱われ、
 * 2 択の左右に同じ本が並んでしまうため、ここで同一性を判定する。
 *
 * ASIN が取れればそれを使う。短縮 URL などで取れない場合は
 * クエリパラメータを除いた URL、それも無ければタイトルと著者の組で判定する。
 */
export const getBookIdentity = (book: Book): string => {
  const amazonUrl = book.amazonUrl.trim()

  if (amazonUrl !== '') {
    const asin = extractAsin(amazonUrl)
    if (asin !== null) return `asin:${asin}`

    try {
      const url = new URL(amazonUrl)
      return `url:${url.origin}${url.pathname}`
    } catch {
      return `url:${amazonUrl}`
    }
  }

  return `title:${book.title ?? ''}|${book.author ?? ''}`
}
