import type { BookId, UpdateRankingDto } from '@bookpoolcontexts/common'
import { arrayRemove } from 'firebase/firestore'
import { useState } from 'react'
import { toast } from 'sonner'

import { updateRankingOperation } from '@/infrastructure/firestore/rankings'
import { serverTimestamp } from '@/lib/firebase'
import { useFirebaseAuthContext } from '@/providers/FirebaseAuthProvider'
import { errorMessage } from '@/utils/errorMessage'

export type UseUnexcludeBookMutationReturn = {
  unexclude: (bookId: BookId) => Promise<void>
  isUnexcluding: boolean
}

/**
 * 除外を解除する。解除した本は「ランキング未追加の本」に戻る。
 *
 * NOTE: 呼び出し側は status === 'idle' のときのみ実行すること。
 * ソート中に解除すると、その本に関する比較が改めて要求され進捗が巻き戻って見える。
 */
export const useUnexcludeBookMutation = (): UseUnexcludeBookMutationReturn => {
  const { uid } = useFirebaseAuthContext()
  const [isUnexcluding, setIsUnexcluding] = useState(false)

  const unexclude = async (bookId: BookId): Promise<void> => {
    if (!uid) throw new Error('認証エラー：再ログインしてください')

    setIsUnexcluding(true)
    try {
      const dto: UpdateRankingDto = {
        excludedBookIds: arrayRemove(bookId),
        updatedAt: serverTimestamp,
      }
      await updateRankingOperation(uid, dto)
      toast.success('除外を解除しました')
    } catch (e) {
      toast.error(errorMessage(e))
      throw e
    } finally {
      setIsUnexcluding(false)
    }
  }

  return { unexclude, isUnexcluding }
}
