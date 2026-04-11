import type {
  ScrapingStatus,
  UpdateBookDtoFromAdmin,
} from '@bookpoolcontexts/common'
import { normalizeTagLabel } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateBookOperation } from '~/infrastructure/firestore/books'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
import {
  createTagOperation,
  fetchTagByLabelOperation,
  updateTagOperation,
} from '~/infrastructure/firestore/tags'
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
    const scrapingStatus = data.scrapingStatus as ScrapingStatus | undefined

    // スクレイピング処理
    if (scrapingStatus === 'skipped') {
      // HTMLから情報取得済みならスクレイピングをスキップ
      console.log(
        'scrapingStatus=skippedのためスクレイピングをスキップ:',
        bookId,
      )
    } else if (!amazonUrl) {
      console.log('amazonUrl が存在しないためスキップ:', bookId)
      await updateBookOperation(uid, bookId, {
        scrapingStatus: 'failed',
        updatedAt: serverTimestamp,
        updatedBy: 'trigger' as const,
      })
    } else {
      try {
        console.log('スクレイピング開始:', bookId, amazonUrl)
        const detail = await fetchAmazonBookDetail(amazonUrl)
        console.log('スクレイピング結果:', bookId, JSON.stringify(detail))

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

        // すべて取得できなかった場合はfailedにする
        if (!detail.title && !detail.author && !detail.coverImageUrl && detail.pages === 0) {
          console.log('本の情報を取得できませんでした:', bookId)
          await updateBookOperation(uid, bookId, {
            scrapingStatus: 'failed',
            updatedAt: serverTimestamp,
            updatedBy: 'trigger' as const,
          })
        } else {
          await updateBookOperation(uid, bookId, updateDto)
          console.log('Book詳細情報を更新しました:', bookId, detail)
        }
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

    // タグ count 同期
    // 重複除去 + 正規化（クライアントでもガード済みだが二重の保険）
    const rawTags: string[] = data.tags ?? []
    const tags = Array.from(
      new Set(
        rawTags.map((t) => normalizeTagLabel(t)).filter((t) => t !== ''),
      ),
    )
    if (tags.length > 0) {
      for (const label of tags) {
        try {
          const existing = await fetchTagByLabelOperation(uid, label)
          if (existing) {
            await updateTagOperation(uid, existing.tagId, {
              count: FieldValue.increment(1),
              updatedAt: serverTimestamp,
            })
          } else {
            // 未知のタグは count=1 で新規作成
            await createTagOperation(uid, {
              label,
              count: 1,
              createdAt: serverTimestamp,
              updatedAt: serverTimestamp,
            })
          }
        } catch (error) {
          console.error('タグカウント更新に失敗:', label, error)
        }
      }
      console.log('タグカウントを更新しました:', bookId, tags)
    }
  }),
)
