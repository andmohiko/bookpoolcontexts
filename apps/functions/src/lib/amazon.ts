import chromium from '@sparticuz/chromium'
import type { Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'

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
  await page.goto('https://www.amazon.co.jp', { waitUntil: 'networkidle2', timeout: 30000 })
}

/** AmazonのURLからクリーンな /dp/ASIN URLを生成する */
const normalizeAmazonUrl = async (url: string): Promise<string> => {
  // /dp/ASIN パターンを抽出（10桁の英数字）
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/)
  if (dpMatch) {
    return `https://www.amazon.co.jp/dp/${dpMatch[1]}`
  }

  // 短縮URL（amzn.asia等）の場合、リダイレクト先のLocationヘッダーからASINを抽出する
  console.log('短縮URLを解決します:', url)
  const res = await fetch(url, { redirect: 'manual' })
  const location = res.headers.get('location') ?? ''
  console.log('リダイレクト先:', location)

  const resolvedDpMatch = location.match(/\/dp\/([A-Z0-9]{10})/)
  if (resolvedDpMatch) {
    return `https://www.amazon.co.jp/dp/${resolvedDpMatch[1]}`
  }

  // ASINが取れない場合はクエリパラメータを除去して返す
  try {
    const urlObj = new URL(location || url)
    return `${urlObj.origin}${urlObj.pathname}`
  } catch {
    return url
  }
}

export type AmazonBookDetail = {
  title: string
  author: string
  coverImageUrl: string
  pages: number
}

const EMPTY_RESULT: AmazonBookDetail = { title: '', author: '', coverImageUrl: '', pages: 0 }

/** Amazon詳細ページからタイトル・著者名・表紙画像URL・ページ数を取得する */
export const fetchAmazonBookDetail = async (
  amazonUrl: string,
): Promise<AmazonBookDetail> => {
  const normalizedUrl = await normalizeAmazonUrl(amazonUrl)
  console.log('正規化URL:', normalizedUrl)

  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await setupAmazonPage(page)

    await page.goto(normalizedUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // デバッグ: ページURLとタイトルをログ出力
    const pageUrl = page.url()
    const pageTitle = await page.title()
    console.log('スクレイピング対象URL:', pageUrl)
    console.log('ページタイトル:', pageTitle)

    // CAPTCHA検知
    const hasCaptcha = await page.evaluate(() => {
      return !!document.querySelector('#captchacharacters') || !!document.querySelector('form[action*="validateCaptcha"]')
    })
    if (hasCaptcha) {
      console.error('CAPTCHA検知: Amazonからボットブロックされています')
      return EMPTY_RESULT
    }

    // 503検知
    if (pageTitle.includes('503') || pageTitle.includes('Service Unavailable')) {
      console.error('503検知: ページが利用できません。リトライします')
      // 少し待ってリトライ
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await page.goto(normalizedUrl, { waitUntil: 'networkidle2', timeout: 30000 })
      const retryTitle = await page.title()
      console.log('リトライ後ページタイトル:', retryTitle)
      if (retryTitle.includes('503') || retryTitle.includes('Service Unavailable')) {
        console.error('リトライ後も503: 取得を断念します')
        return EMPTY_RESULT
      }
    }

    const detail = await page.evaluate(() => {
      // タイトルを取得
      const titleEl =
        document.querySelector('#productTitle') ??
        document.querySelector('#ebooksProductTitle')
      const title = titleEl?.textContent?.trim() ?? ''

      // 著者名を取得
      const authorEl =
        document.querySelector('#bylineInfo .author a') ??
        document.querySelector('.author a') ??
        document.querySelector('.contributorNameID')
      const author = authorEl?.textContent?.trim() ?? ''

      // 表紙画像URLを取得
      const imgEl =
        (document.querySelector('#imgTagWrapperId img') as HTMLImageElement | null) ??
        (document.querySelector('#landingImage') as HTMLImageElement | null) ??
        (document.querySelector('#imgBlkFront') as HTMLImageElement | null) ??
        (document.querySelector('#ebooksImgBlkFront') as HTMLImageElement | null) ??
        (document.querySelector('#main-image-container img') as HTMLImageElement | null)
      const coverImageUrl = imgEl?.src ?? ''

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

      return { title, author, coverImageUrl, pages }
    })

    return detail
  } finally {
    await browser.close()
  }
}
