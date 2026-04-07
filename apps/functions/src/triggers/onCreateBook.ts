import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateBookOperation } from '~/infrastructure/firestore/books'
import { fetchAmazonBookDetail } from '~/lib/amazon'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onCreateBook = onDocumentCreated(
  {
    document: 'users/{uid}/books/{bookId}',
    memory: '2GiB',
    region: 'asia-northeast1',
  },
  triggerOnce('onCreateBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const data = event.data.data()
    const amazonUrl = data.amazonUrl as string

    if (!amazonUrl) {
      console.log('amazonUrl が存在しないためスキップ:', bookId)
      return
    }

    try {
      const detail = await fetchAmazonBookDetail(amazonUrl)

      const updateDto: UpdateBookDtoFromAdmin = {
        updatedAt: serverTimestamp,
      }

      if (detail.author) {
        updateDto.author = detail.author
      }
      if (detail.pages > 0) {
        updateDto.pages = detail.pages
      }

      // author も pages も取得できなかった場合は更新しない
      if (!detail.author && detail.pages === 0) {
        console.log('著者名・ページ数ともに取得できませんでした:', bookId)
        return
      }

      await updateBookOperation(uid, bookId, updateDto)
      console.log('Book詳細情報を更新しました:', bookId, detail)
    } catch (error) {
      console.error('Amazon詳細ページのスクレイピングに失敗:', bookId, error)
    }
  }),
)
