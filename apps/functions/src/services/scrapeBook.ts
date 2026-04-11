import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'

import { updateBookOperation } from '~/infrastructure/firestore/books'
import { fetchAmazonBookDetail } from '~/lib/amazon'
import { serverTimestamp } from '~/lib/firebase'

/**
 * Amazonをスクレイピングして本の情報を取得し、Firestoreを更新する
 * @description onCreateBook と onUpdateBook（再フェッチ時）の共通処理
 */
export const scrapeAndUpdateBook = async (
  uid: string,
  bookId: string,
  amazonUrl: string | undefined,
): Promise<void> => {
  if (!amazonUrl) {
    console.log('amazonUrl が存在しないためスキップ:', bookId)
    await updateBookOperation(uid, bookId, {
      scrapingStatus: 'failed',
      updatedAt: serverTimestamp,
      updatedBy: 'trigger' as const,
    })
    return
  }

  try {
    console.log('スクレイピング開始:', bookId, amazonUrl)
    const detail = await fetchAmazonBookDetail(amazonUrl)
    console.log('スクレイピング結果:', bookId, JSON.stringify(detail))

    // すべて取得できなかった場合はfailedにする
    if (
      !detail.title &&
      !detail.author &&
      !detail.coverImageUrl &&
      detail.pages === 0
    ) {
      console.log('本の情報を取得できませんでした:', bookId)
      await updateBookOperation(uid, bookId, {
        scrapingStatus: 'failed',
        updatedAt: serverTimestamp,
        updatedBy: 'trigger' as const,
      })
      return
    }

    const updateDto: UpdateBookDtoFromAdmin = {
      scrapingStatus: 'completed',
      updatedAt: serverTimestamp,
      updatedBy: 'trigger' as const,
    }
    if (detail.title) {
      updateDto.title = detail.title
    }
    if (detail.author) {
      updateDto.author = detail.author
    }
    if (detail.coverImageUrl) {
      updateDto.coverImageUrl = detail.coverImageUrl
    }
    if (detail.pages > 0) {
      updateDto.pages = detail.pages
    }

    await updateBookOperation(uid, bookId, updateDto)
    console.log('Book詳細情報を更新しました:', bookId, detail)
  } catch (error) {
    console.error('Amazon詳細ページのスクレイピングに失敗:', bookId, error)
    try {
      await updateBookOperation(uid, bookId, {
        scrapingStatus: 'failed',
        updatedAt: serverTimestamp,
        updatedBy: 'trigger' as const,
      })
    } catch (updateError) {
      console.error('scrapingStatus更新にも失敗:', bookId, updateError)
    }
  }
}
