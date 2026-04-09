import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { updateGroupByLabelOperation } from '~/infrastructure/firestore/groups'
import { serverTimestamp } from '~/lib/firebase'
import { triggerOnce } from '~/utils/triggerOnce'

export const onUpdateBook = onDocumentUpdated(
  {
    document: 'users/{uid}/books/{bookId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onUpdateBook', async (event) => {
    if (!event.data) return

    const { uid, bookId } = event.params
    const before = event.data.before.data()
    const after = event.data.after.data()

    // トリガーによる更新なら処理をスキップ（連鎖発火防止）
    if (after.updatedBy === 'trigger') {
      console.log('トリガーによる更新のためスキップ:', bookId)
      return
    }

    const beforeGroups: string[] = before.groups ?? []
    const afterGroups: string[] = after.groups ?? []

    // groups が変更されていない場合はスキップ
    if (
      JSON.stringify([...beforeGroups].sort()) ===
      JSON.stringify([...afterGroups].sort())
    ) {
      return
    }

    const addedGroups = afterGroups.filter((g) => !beforeGroups.includes(g))
    const removedGroups = beforeGroups.filter(
      (g) => !afterGroups.includes(g),
    )

    // 追加されたグループの count をインクリメント
    for (const groupLabel of addedGroups) {
      try {
        await updateGroupByLabelOperation(uid, groupLabel, {
          count: FieldValue.increment(1),
          updatedAt: serverTimestamp,
        })
      } catch (error) {
        console.error(
          'グループカウントのインクリメントに失敗:',
          groupLabel,
          error,
        )
      }
    }

    // 除去されたグループの count をデクリメント
    for (const groupLabel of removedGroups) {
      try {
        await updateGroupByLabelOperation(uid, groupLabel, {
          count: FieldValue.increment(-1),
          updatedAt: serverTimestamp,
        })
      } catch (error) {
        console.error(
          'グループカウントのデクリメントに失敗:',
          groupLabel,
          error,
        )
      }
    }

    console.log('グループカウントを同期しました:', bookId, {
      added: addedGroups,
      removed: removedGroups,
    })
  }),
)
