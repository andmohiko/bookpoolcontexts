import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import '~/config/firebase'
import { removeTagFromAllBooksOperation } from '~/infrastructure/firestore/books'
import { triggerOnce } from '~/utils/triggerOnce'

export const onDeleteTag = onDocumentDeleted(
  {
    document: 'users/{uid}/tags/{tagId}',
    region: 'asia-northeast1',
  },
  triggerOnce('onDeleteTag', async (event) => {
    if (!event.data) return

    const { uid, tagId } = event.params
    const data = event.data.data()
    const tagLabel = data.label as string

    if (!tagLabel) {
      console.warn('削除されたタグにラベルがありません:', tagId)
      return
    }

    try {
      await removeTagFromAllBooksOperation(uid, tagLabel)
      console.log(
        'タグ削除に伴う本の更新が完了しました:',
        tagId,
        tagLabel,
      )
    } catch (error) {
      console.error('タグ削除時の本の更新に失敗:', tagId, error)
      throw error
    }
  }),
)
