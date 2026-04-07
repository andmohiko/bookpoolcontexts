import type { OgpInfo } from '@bookpoolcontexts/common'

const URL_REGEX = /https?:\/\/[^\s]+/

/** 本文から最初のURLを抽出する */
export const extractFirstUrl = (content: string): string | null => {
  const match = content.match(URL_REGEX)
  return match ? match[0] : null
}

const extractMetaContent = (html: string, property: string): string | null => {
  // property が先のパターン
  const match = html.match(
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
  )
  if (match) return match[1]

  // content が先のパターン
  const matchReverse = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      'i',
    ),
  )
  return matchReverse ? matchReverse[1] : null
}

const extractTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : null
}

/** URLのOGP情報を取得する */
export const fetchOgp = async (url: string): Promise<OgpInfo> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VectorNoteBot/1.0)',
      },
    })

    if (!response.ok) {
      return { url, title: null, description: null, image: null }
    }

    const html = await response.text()

    return {
      url,
      title: extractMetaContent(html, 'og:title') ?? extractTitle(html),
      description: extractMetaContent(html, 'og:description'),
      image: extractMetaContent(html, 'og:image'),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
