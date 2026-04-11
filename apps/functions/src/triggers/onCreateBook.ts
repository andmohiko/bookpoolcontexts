import type { ScrapingStatus } from '@bookpoolcontexts/common'
import { normalizeTagLabel } from '@bookpoolcontexts/common'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
import {
  createTagOperation,
  fetchTagByLabelOperation,
  updateTagOperation,
} from '~/infrastructure/firestore/tags'
import { serverTimestamp } from '~/lib/firebase'
import { scrapeAndUpdateBook } from '~/services/scrapeBook'
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
    const amazonUrl = data.amazonUrl as string | undefined
    const scrapingStatus = data.scrapingStatus as ScrapingStatus | undefined

    // スクレイピング処理
    if (scrapingStatus === 'skipped') {
      // HTMLから情報取得済みならスクレイピングをスキップ
      console.log(
        'scrapingStatus=skippedのためスクレイピングをスキップ:',
        bookId,
      )
    } else {
      await scrapeAndUpdateBook(uid, bookId, amazonUrl)
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
