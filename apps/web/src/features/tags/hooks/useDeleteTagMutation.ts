import { useState } from 'react'
import { toast } from 'sonner'
import type { TagId } from '@bookpoolcontexts/common'
import { deleteTagOperation } from '@/infrastructure/firestore/tags'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseDeleteTagMutationReturn = {
  deleteTag: (tagId: TagId) => Promise<void>
  isDeleting: boolean
}

export const useDeleteTagMutation = (): UseDeleteTagMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteTag = async (tagId: TagId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')
    setIsDeleting(true)
    try {
      // タグドキュメントを削除するだけで、連動する本の tags 配列は
      // onDeleteTag トリガー（Functions 側）が全本から arrayRemove で除去する
      await deleteTagOperation(uid, tagId)
      toast.success('タグを削除しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsDeleting(false)
    }
  }

  return { deleteTag, isDeleting }
}
