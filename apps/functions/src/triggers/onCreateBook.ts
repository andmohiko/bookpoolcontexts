import type { UpdateBookDtoFromAdmin } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateBookOperation } from '~/infrastructure/firestore/books'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
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
      console.log('スクレイピング開始:', bookId, amazonUrl)
      const detail = await fetchAmazonBookDetail(amazonUrl)
      console.log('スクレイピング結果:', bookId, JSON.stringify(detail))

      const updateDto: UpdateBookDtoFromAdmin = {
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

      // すべて取得できなかった場合は更新しない
      if (!detail.title && !detail.author && !detail.coverImageUrl && detail.pages === 0) {
        console.log('本の情報を取得できませんでした:', bookId)
        return
      }

      await updateBookOperation(uid, bookId, updateDto)
      console.log('Book詳細情報を更新しました:', bookId, detail)
    } catch (error) {
      console.error('Amazon詳細ページのスクレイピングに失敗:', bookId, error)
    }

    // グループ count 同期
    const groups: string[] = data.groups ?? []
    if (groups.length > 0) {
      for (const groupLabel of groups) {
        try {
          await updateGroupByLabelOperation(uid, groupLabel, {
            count: FieldValue.increment(1),
            updatedAt: serverTimestamp,
          })
        } catch (error) {
          console.error('グループカウント更新に失敗:', groupLabel, error)
        }
      }
      console.log('グループカウントを更新しました:', bookId, groups)
    }
  }),
)
