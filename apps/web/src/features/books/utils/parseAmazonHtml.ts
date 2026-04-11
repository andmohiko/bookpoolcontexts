export type ParsedAmazonBook = {
  title: string | null
  author: string | null
  coverImageUrl: string | null
  pages: number | null
}

/**
 * Amazon詳細ページのHTMLから本の情報を抽出する
 * 抽出できなかったフィールドは null を返す
 */
export const parseAmazonHtml = (html: string): ParsedAmazonBook => {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // タイトル
  const titleEl =
    doc.querySelector('#productTitle') ??
    doc.querySelector('#ebooksProductTitle')
  const title = titleEl?.textContent?.trim() || null

  // 著者名
  const authorEl =
    doc.querySelector('#bylineInfo .author a') ??
    doc.querySelector('.author a') ??
    doc.querySelector('.contributorNameID')
  const author = authorEl?.textContent?.trim() || null

  // 表紙画像URL
  // DOMParserではHTMLImageElement.srcが評価されないことがあるためgetAttributeを使う
  const imgEl =
    (doc.querySelector('#imgTagWrapperId img') as HTMLImageElement | null) ??
    (doc.querySelector('#landingImage') as HTMLImageElement | null) ??
    (doc.querySelector('#imgBlkFront') as HTMLImageElement | null) ??
    (doc.querySelector('#ebooksImgBlkFront') as HTMLImageElement | null) ??
    (doc.querySelector('#main-image-container img') as HTMLImageElement | null)
  const coverImageUrl =
    imgEl?.getAttribute('data-old-hires') ||
    imgEl?.getAttribute('src') ||
    null

  // ページ数
  let pages: number | null = null
  // パターン1: 詳細情報テーブルの「ページ数」行
  const detailItems = doc.querySelectorAll(
    '#detailBullets_feature_div li span.a-list-item',
  )
  for (const item of detailItems) {
    const match = (item.textContent ?? '').match(/(\d+)\s*ページ/)
    if (match) {
      pages = Number.parseInt(match[1], 10)
      break
    }
  }
  // パターン2: 商品情報テーブル
  if (pages === null) {
    const rows = doc.querySelectorAll(
      '#productDetailsTable tr, .detail-bullet-list li',
    )
    for (const row of rows) {
      const match = (row.textContent ?? '').match(/(\d+)\s*ページ/)
      if (match) {
        pages = Number.parseInt(match[1], 10)
        break
      }
    }
  }

  return { title, author, coverImageUrl, pages }
}
