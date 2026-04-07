import type { AmazonBookItem } from '@bookpoolcontexts/common'
import chromium from '@sparticuz/chromium'
import type { Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'

const AMAZON_SEARCH_URL = 'https://www.amazon.co.jp/s'

const isLocal = process.env.FUNCTIONS_EMULATOR === 'true'

/** ローカルのChrome実行パスを取得する */
const getLocalChromePath = (): string => {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
  return '/usr/bin/google-chrome'
}

/** Puppeteerブラウザを起動する */
const launchBrowser = async (): Promise<ReturnType<typeof puppeteer.launch>> => {
  return puppeteer.launch({
    args: isLocal
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: isLocal
      ? getLocalChromePath()
      : await chromium.executablePath(),
    headless: true,
  })
}

/** ページにブラウザヘッダーを設定し、Amazonトップページでcookieを取得する */
const setupAmazonPage = async (page: Page): Promise<void> => {
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  )
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  })
  await page.goto('https://www.amazon.co.jp', { waitUntil: 'networkidle2', timeout: 20000 })
}

export type AmazonBookDetail = {
  author: string
  pages: number
}

/** Amazon詳細ページから著者名とページ数を取得する */
export const fetchAmazonBookDetail = async (
  amazonUrl: string,
): Promise<AmazonBookDetail> => {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await setupAmazonPage(page)

    await page.goto(amazonUrl, { waitUntil: 'networkidle2', timeout: 20000 })

    const detail = await page.evaluate(() => {
      // 著者名を取得
      const authorEl =
        document.querySelector('#bylineInfo .author a') ??
        document.querySelector('.author a') ??
        document.querySelector('.contributorNameID')
      const author = authorEl?.textContent?.trim() ?? ''

      // ページ数を取得
      let pages = 0
      // パターン1: 詳細情報テーブルの「ページ数」行
      const detailItems = document.querySelectorAll('#detailBullets_feature_div li span.a-list-item')
      for (const item of detailItems) {
        const text = item.textContent ?? ''
        const match = text.match(/(\d+)\s*ページ/)
        if (match) {
          pages = Number.parseInt(match[1], 10)
          break
        }
      }
      // パターン2: 商品情報テーブル
      if (pages === 0) {
        const tableRows = document.querySelectorAll('#productDetailsTable tr, .detail-bullet-list li')
        for (const row of tableRows) {
          const text = row.textContent ?? ''
          const match = text.match(/(\d+)\s*ページ/)
          if (match) {
            pages = Number.parseInt(match[1], 10)
            break
          }
        }
      }

      return { author, pages }
    })

    return detail
  } finally {
    await browser.close()
  }
}

/** Amazon.co.jp の書籍検索ページをスクレイピングして本の情報を取得する */
export const searchAmazonBooks = async (
  keyword: string,
): Promise<AmazonBookItem[]> => {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await setupAmazonPage(page)

    const url = `${AMAZON_SEARCH_URL}?k=${encodeURIComponent(keyword)}&i=stripbooks`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })

    const items = await page.evaluate(() => {
      const results: Array<{
        asin: string
        title: string
        coverImageUrl: string
        amazonUrl: string
      }> = []

      // data-asin 属性を持つ要素を探す
      const allWithAsin = document.querySelectorAll('[data-asin]')
      for (const el of allWithAsin) {
        if (results.length >= 15) break

        const asin = el.getAttribute('data-asin')
        if (!asin || asin === '') continue

        // タイトルを探す（複数パターンに対応）
        const titleEl =
          el.querySelector('h2 a span') ??
          el.querySelector('h2 .a-text-normal') ??
          el.querySelector('.a-size-medium.a-text-normal') ??
          el.querySelector('[data-cy="title-recipe"] a span')
        const title = titleEl?.textContent?.trim() ?? ''
        if (!title) continue

        // 画像を探す
        const imgEl =
          (el.querySelector('.s-image') as HTMLImageElement | null) ??
          (el.querySelector('img[data-image-latency="s-product-image"]') as HTMLImageElement | null) ??
          (el.querySelector('.s-product-image-container img') as HTMLImageElement | null)
        const coverImageUrl = imgEl?.src ?? ''

        results.push({ asin, title, coverImageUrl, amazonUrl: `https://www.amazon.co.jp/dp/${asin}` })
      }

      return results
    })

    return items
  } finally {
    await browser.close()
  }
}
